# 016 — Filtros ao vivo na `/grupos` (`GET /api/grupos`)
Marco: M7 · Status: concluída (QA aprovado)
Depende de: 005 (busca e filtros sem JS), 015 (`joinedSlugs` nos cards)
Primeira spec do M7. Próximas propostas: 017 (modal "Entrar no grupo" + toasts de participar/sair/cadastrar + badge), 018 (`mapa.js` sem recarregar + rolagem suave do `/encontrar`).

## Objetivo
Com JS, a `/grupos` filtra na hora, como `updateResults`/`renderChips` do protótipo: skeleton, contagem, chips removíveis, "Limpar filtros" com toast e botão "Filtros/Ocultar filtros" no celular, buscando os resultados em `GET /api/grupos`. Sem JS, nada muda (form GET da spec 005).

## Fora do escopo
- Modal "Entrar no grupo", toasts de participar/sair/cadastro, badge sem recarregar (017).
- Seleção no mapa sem recarregar e rolagem suave do `/encontrar` (018).
- Menu mobile: já existe desde a spec 001 (`[data-act="menu"]` em `public/js/app.js`). Esta spec só muda o arquivo de lugar no módulo (ver JS), sem mudar o comportamento.
- URL limpa sem JS (pendência M3+ "campos vazios na URL"): continua aberta. Com JS a URL passa a ser a canônica (CA5).
- Rate limit/cache de `/api/grupos` (M8, junto com `/grupos`).
- Remover as regras CSS `.ztog[aria-pressed]` órfãs: ficam no bloco literal do protótipo, que é comparado byte a byte em `tests/http/scaffold.test.js`. Fecha a pendência M3 como "mantidas por serem literais".
- Separar `SELECT_LIST` sem `contact` no repo (recomendação do Hardener 007): desnecessário aqui, porque o JSON não serializa grupos (CA3). Vale se um dia houver JSON com objetos `Group`.

## Mudanças

### Banco
Nenhuma.

### Domínio — `src/domain/filters.js`
- `countLabel(n: number) → string` — `"1 grupo encontrado"` / `"N grupos encontrados"` (texto do `updateResults`, linha 698 do protótipo). Usado pela view e pela API, para o texto não divergir.

### Service — `groups.service.js`
- `searchGroups(query)` passa a devolver também `query: filtersToQuery(filters)` (string canônica, sem campos vazios; `''` sem filtros). Nada mais muda.

### Middleware — `src/middlewares/locals.js`
- Novo `res.renderPartial(view, data = {}) → Promise<string>`: renderiza `views/partials/<view>.ejs` com `{ ...res.locals, ...data }`. **Não consome o flash** (só `renderPage` consome).

### Rota — `GET /api/grupos` (em `groups.routes.js`)
- Auth: nenhuma. Sem CSRF (GET).
- Lê `req.query` com os mesmos filtros da `/grupos` (`searchGroups`).
- Resposta `200`, `Content-Type: application/json`, cabeçalho `Cache-Control: private, no-store` sempre (logado e visitante recebem HTML diferente nos cards; proxy não pode misturar):
  ```json
  {
    "count": 3,
    "countText": "3 grupos encontrados",
    "query": "zona=sul&nivel=iniciante",
    "chips": "<a class=\"achip\" …>…</a>…",
    "results": "<div class=\"grid-cards\">…</div>"
  }
  ```
  - `chips` = `renderPartial('search-chips', { chips })`; `results` = `renderPartial('search-results', { groups })`. Mesmos partials da página, então os cards saem idênticos aos do SSR (inclusive "Você participa" e os links de "Entrar no grupo" conforme a sessão).
  - **Só esses 5 campos.** Nunca serializar objetos `Group`, `filters`, `res.locals` ou `joinedSlugs` (pendências M7 de `contact`/`owner_id` e 015/Hardener).
- Erro (ex.: banco fora): segue o `errorHandler` atual (HTML 500); o cliente trata qualquer não-2xx (ver JS).

### Views
- `partials/search-chips.ejs` (novo): o laço atual de chips de `grupos.ejs`, **sem mudar o HTML** (`<a class="achip" href="…" aria-label="Remover filtro …">… ic('x','ico-sm')</a>`).
- `partials/search-results.ejs` (novo): o conteúdo atual de `#results` (grid de `group-card` ou o `.empty` "Nenhum grupo nesse ritmo" com o link `/grupos` "Limpar filtros"), **sem mudar o HTML**.
- `pages/grupos.ejs`: `#chips` e `#results` passam a incluir esses partials; `#count` usa `countLabel(n)` (exposto em `app.locals`). HTML final idêntico ao de hoje (os testes atuais de `/grupos` continuam passando sem alteração).
- `layout.ejs`:
  - `<script src="/js/app.js" defer></script>` → `<script type="module" src="/js/app.js"></script>` (módulos já são diferidos; navegador sem suporte a módulo fica no caminho sem JS, que funciona).
  - Depois dele, um `<script type="module" src="/js/<nome>.js"></script>` para cada nome em `locals.scripts` (array definido pela rota; nunca vem do usuário).
- Rota `GET /grupos` passa `scripts: ['filtros']`.

### JS do cliente
- `public/js/ui.js` (novo, módulo): exporta
  - `ic(name, cls = '')` — mesmo HTML do helper do servidor (`<svg class="ico {cls}" viewBox="0 0 24 24" aria-hidden="true">…</svg>`), com os paths de `P` usados no cliente: `menu`, `x`, `check`, `filter` (copiar literalmente do protótipo).
  - `toast(msg)` — `toast()` do protótipo (linha 1031): `#toastRoot` recebe `<div class="toast">{ic('check')}<span>{msg}</span></div>`, some após **3200 ms**; um toast novo substitui o anterior e reinicia o tempo. A mensagem entra por `textContent` (nunca `innerHTML`).
- `public/js/app.js`: vira módulo; importa `ic` de `./ui.js` (remove a cópia local de `ICONS`/`ic`). Menu e contador de caracteres sem mudança de comportamento.
- `public/js/filtros.js` (novo, módulo; só roda se existir `form#filters`):
  1. **Ao carregar**: esconde o botão "Aplicar filtros" (`hidden`); troca o link `a.filters-toggle` por `<button class="btn btn-outline btn-sm filters-toggle" type="button" aria-controls="filters" aria-expanded="false">{ic('filter','ico-sm')} Filtros</button>` (HTML do protótipo, linha 686). Não busca nada: a página já veio renderizada.
  2. **Mudanças no form** (como os listeners `input` do protótipo, linhas 1103–1107): `select` e checkbox de zona → atualiza na hora; `nome`/`local` (`input`) → debounce de **220 ms**. `submit` (Enter num campo) → `preventDefault`, cancela o debounce e atualiza na hora.
  3. **Atualizar** (`updateResults`, linha 694): monta a query com `new URLSearchParams(new FormData(form))`; põe em `#results` o skeleton literal do protótipo (`<div class="grid-cards" aria-busy="true">` + 3 `.skeleton` com os `.sk` e larguras da linha 704); chama `fetch('/api/grupos?' + query, { headers: { Accept: 'application/json' } })` e aplica a resposta **não antes de 260 ms** após o início (o `setTimeout(run,260)` do protótipo; P2). Aplicar = `#count.textContent = countText`, `#chips.innerHTML = chips`, `#results.innerHTML = results`, `history.replaceState(null, '', query ? '/grupos?' + query : '/grupos')` com a `query` **devolvida pelo servidor**.
     - Só a última requisição vale: a anterior é abortada (`AbortController`) e resposta atrasada é ignorada.
     - Falha (rede ou status não-2xx): `location.assign('/grupos?' + queryDoForm)` — vira a navegação normal sem JS.
  4. **Chip** (`a.achip` dentro de `#chips`, `rm-filter` do protótipo): `preventDefault`; aplica ao form os filtros do `href` do chip (desmarca zonas ausentes, limpa campos ausentes) e atualiza. Sem toast. Foco vai para `#count` (o JS põe `tabindex="-1"` nele), já que o chip clicado some.
  5. **Limpar filtros** (link `a[href="/grupos"]` no `h2` de `#filters` ou no `.empty` de `#results`; `clear` do protótipo, linha 1088): `preventDefault`; desmarca todas as zonas, esvazia `nome`/`local` e volta os `select` para `''`; atualiza; `toast('Filtros limpos. Mostrando todos os grupos.')`. Se o link clicado foi o do `.empty` (que some), foco vai para `#count`.
  6. **Filtros/Ocultar filtros** (`filters-toggle`, linha 1090): alterna `.open` em `#filters`, `aria-expanded` e o conteúdo do botão entre `{ic('filter','ico-sm')} Filtros` e `{ic('filter','ico-sm')} Ocultar filtros`.
  - Sem `<script>` inline; sem `eval`/`new Function`; HTML de servidor só vem de `/api/grupos` (mesma origem, já escapado pelo EJS).

### CSS
Nada novo esperado (`.skeleton`, `.sk`, `.toast`, `.filters.open`, `.filters-toggle` já estão no bloco literal). Se precisar, só na área de acréscimos, acima do marcador "Layout".

## Regras e mensagens
| Situação | Regra | Texto exato |
|---|---|---|
| contagem | `n === 1` | `1 grupo encontrado` / `N grupos encontrados` |
| limpar filtros (JS) | toast 3200 ms | `Filtros limpos. Mostrando todos os grupos.` |
| botão de filtros (JS, ≤ 900 px) | fechado / aberto | `Filtros` / `Ocultar filtros` |
| sem resultado | igual ao SSR (spec 005) | `Nenhum grupo nesse ritmo` / `Nenhum grupo atende a todos os filtros. Tente ampliar a faixa de pace, escolher outro dia ou incluir mais zonas.` / `Limpar filtros` |
| debounce texto | `nome`, `local` | 220 ms |
| skeleton | duração mínima | 260 ms |

## Critérios de aceite
- [ ] CA1 — `GET /api/grupos?zona=sul&nivel=iniciante` responde 200 JSON com exatamente as chaves `count`, `countText`, `query`, `chips`, `results`; `count` = nº de cards em `results`; `countText` = `countLabel(count)`; `query` = `zona=sul&nivel=iniciante`.
- [ ] CA2 — Para a mesma query, `results` e `chips` são **iguais** ao conteúdo de `#results` e `#chips` de `GET /grupos` (mesma sessão). Vale para: sem filtros (11 cards), filtro sem resultado (`.empty`), e logado participante (card com `Você participa`).
- [ ] CA3 — O corpo de `/api/grupos` não contém `contact`, `owner_id`, `password_hash`, `email` nem o contato de um grupo real cadastrado no teste (visitante **e** logado).
- [ ] CA4 — `/api/grupos` envia `Cache-Control: private, no-store` (visitante e logado). Parâmetro inválido (`?zona=marte&pace=xyz&nome=%00`) é ignorado como na `/grupos` (200, `query` sem eles).
- [ ] CA5 — Query desordenada ou com vazios (`?nome=&dia=sab&zona=sul&local=`) devolve `query` canônica `zona=sul&dia=sab`; com JS, a barra de endereço fica `/grupos?zona=sul&dia=sab` após filtrar.
- [ ] CA6 — `GET /grupos` continua com o HTML atual (testes existentes da spec 005 passam sem alteração) e inclui `<script type="module" src="/js/filtros.js"></script>`; as demais páginas não incluem `filtros.js`. Todas as páginas têm `<script type="module" src="/js/app.js"></script>` e nenhum script inline.
- [ ] CA7 — Com JS (inspeção no navegador): marcar uma zona ou trocar um `select` mostra o skeleton e atualiza contagem, chips, cards e URL sem recarregar; digitar em "Nome" só busca após 220 ms parado; Enter no campo não recarrega; "Aplicar filtros" não aparece.
- [ ] CA8 — Com JS: clicar num chip remove só aquele filtro (form e resultados), sem toast, foco em `#count`; "Limpar filtros" (no título e no estado vazio) zera o form, mostra todos os grupos e o toast `Filtros limpos. Mostrando todos os grupos.` por ~3,2 s.
- [ ] CA9 — Com JS a 360 px: o botão vira `<button … aria-expanded>` e alterna `Filtros`/`Ocultar filtros` abrindo e fechando o painel; sem scroll horizontal (skeleton, toast, chips).
- [ ] CA10 — Com o servidor parado ou `/api/grupos` respondendo 500 (DevTools), mudar um filtro leva à navegação normal `/grupos?…` (sem tela travada no skeleton).
- [ ] CA11 — Sem JS (e em navegador sem módulos): tudo como na spec 005 (botão "Aplicar filtros", link `#filters`, chips e "Limpar" como links). Menu mobile e contador de caracteres do cadastro continuam funcionando com JS.
- [ ] CA12 — `countLabel` usado na view e na API; nada de SQL fora de `*.repo.js`; `npm test` e `npm run lint` passam.

## Testes esperados
- unit `tests/domain/filters.test.js`: `countLabel(0)`, `countLabel(1)`, `countLabel(11)`.
- http `tests/http/api-grupos.test.js` (novo):
  - CA1: chaves e valores para `?zona=sul&nivel=iniciante`.
  - CA2: igualdade `results`/`chips` × `#results`/`#chips` da página — sem filtros, um filtro vazio e um logado participante (um teste cada).
  - CA3: grupo real com contato cadastrado no teste; corpo sem as chaves/valores proibidos, visitante e logado.
  - CA4/CA5: cabeçalho `Cache-Control` e query canônica com parâmetros inválidos/vazios (um teste).
- http `tests/http/scaffold.test.js`: ajustar a asserção do script para `<script type="module" src="/js/app.js"></script>`; servir `/js/ui.js` e `/js/filtros.js` com `content-type` JavaScript.
- http `tests/http/grupos.test.js`: um caso para o `<script … filtros.js>` (CA6) e um mostrando que `/` não o inclui.
- CA7–CA11: inspeção no navegador pelo QA (não há DOM de teste no projeto; não adicionar jsdom).

## Riscos / perguntas em aberto
- **P1 — Formato do JSON: HTML renderizado no servidor (default) × objetos de grupo renderizados no cliente.** O AGENTS só diz "JSON para melhoria progressiva". Default: JSON com fragmentos HTML dos mesmos partials (zero duplicação do `group-card`, nada de dado cru do grupo vai ao cliente, "Você participa" sai certo). A alternativa (lista de grupos sem `contact`/`owner_id` e um `GroupCard` em JS, como o protótipo) duplicaria ícones, `LevelMeter`, `DemoTag` e as variantes de link de sessão. Confirmar.
- **P2 — Skeleton por no mínimo 260 ms (default, literal do protótipo, que simulava rede).** Com o banco local a resposta chega em poucos ms; sem o mínimo, o skeleton "pisca". Alternativa: mostrar o skeleton só se a resposta passar de ~150 ms.
- **P3 — "Os resultados atualizam na hora." (pendência M3/005 P2).** Com esta spec o texto passa a ser verdade com JS; sem JS continua impreciso (há "Aplicar filtros"). Default: manter literal e fechar a pendência.
- **P4 — Foco após remover chip ou limpar pelo estado vazio vai para `#count` (default).** O protótipo deixava o foco cair no `body`. Alternativa: próximo chip.
- Risco: cada filtro gera uma consulta completa (debounce reduz digitação); sem rate limit nem cache — já registrado para o M8 junto com `/grupos`.
- Risco: o skeleton tem `style="width:…"` inline (literal do protótipo), mais um caso para a CSP do M8 (`style-src-attr`), como `style="--z:…"`.
- Risco: ordem dos cards na API = da `/grupos` (zona + nome), não a do array `DEMO`; intencional (spec 005).
- Pendência M7 "testar `inputmode="numeric"` em iPhone" fica para a 017 (formulários com pace não mudam aqui).
