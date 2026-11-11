# 005 — Busca `/grupos` com filtros via query string (sem JS) e `/grupos/zona/:zona`
Marco: M3 · Status: pronta para Coder após resposta a **P3** (P2 tem default; ver "Perguntas em aberto")
Depende de: 004-leitura-banco-home-zonas
Ordem no M3: 004 → **005** → 006 → 007

## Objetivo
Reproduzir `PageGrupos` (prototipo.html linhas 655–718) como página renderizada no servidor: os 7 filtros do protótipo (zona múltipla, nome, local, dia, período, faixa de pace, nível) vão na query string, o banco filtra, e tudo funciona **sem JS** — critério de pronto do M3.

## Fora do escopo
- Filtro ao vivo, skeleton de carregamento, toast "Filtros limpos…", botão "Ocultar filtros" com `aria-expanded` e `GET /api/grupos` (M7).
- Detalhe do grupo (006), mapa (007).
- Paginação (dataset pequeno; o protótipo não pagina).

## Mudanças

### Banco
Nenhuma migration.

### Constantes — `src/domain/constants.js`
Acrescentar, copiados do protótipo (linhas 433–434):
```js
export const PERIODOS = { cedo: 'Antes das 7h', manha: 'Das 7h às 12h', tarde: 'Das 12h às 18h', noite: 'A partir das 18h' };
export const PACE_FAIXAS = {
  ate5:  { nome: 'Até 5:00 min/km',      min: 0,   max: 300 },
  '5a6': { nome: '5:00 a 6:00 min/km',   min: 300, max: 360 },
  '6a7': { nome: '6:00 a 7:00 min/km',   min: 360, max: 420 },
  mais7: { nome: 'Acima de 7:00 min/km', min: 420, max: 9999 },
};
```
**Decisão** (pendência M3 "formato de PACE_FAIXAS"): fica o formato do protótipo `{nome,min,max}`, porque `nome` é o texto do `<select>` e do chip. Orquestrador: atualizar o AGENTS §6 (hoje `[min,max]`).

### Domínio
`src/domain/schedule.js` — acrescentar:
- `periodoDe(hhmm: string): 'cedo'|'manha'|'tarde'|'noite'` — igual à linha 546: hora `< 7` cedo, `< 12` manha, `< 18` tarde, senão noite. Aceita `'HH:MM'` e `'HH:MM:SS'`; valor inválido → `RangeError` (mesma regra de `fmtHora`).

`src/domain/filters.js` (novo, puro). A montagem do `WHERE` fica no repo (CONVENTIONS: SQL só em `*.repo.js`); aqui só normalização e URLs. Orquestrador: ajustar o comentário de `filters.js` no AGENTS §3.
- `EMPTY_FILTERS = { zonas: [], nome: '', local: '', dia: '', periodo: '', pace: '', nivel: '' }` (mesmo formato de `state.filters` do protótipo). Congelado (`Object.freeze`, inclusive o array).
- `parseFilters(query: object): Filters` — recebe `req.query` (Express 5, parser "simple": cada chave é `string`, `string[]` ou ausente).
  - `zona`: string ou array; mantém só valores em `ZONA_ORDEM`, sem repetição, **ordenados por `ZONA_ORDEM`**.
  - `nome`, `local`: se array, usa o primeiro elemento string; `trim()`; corta em 80 caracteres.
  - `dia` ∈ `DIA_ORDEM`, `periodo` ∈ chaves de `PERIODOS`, `pace` ∈ chaves de `PACE_FAIXAS`, `nivel` ∈ chaves de `NIVEIS`; se array, usa o primeiro; valor desconhecido → `''`. Verificar com `Object.hasOwn`/`includes` (nunca `obj[valor]` direto: `constructor`, `__proto__`, `toString` têm de ser ignorados).
  - Qualquer outro tipo (objeto) ou chave desconhecida → ignorado. Nunca lança.
- `filtersToQuery(f: Filters): string` — query canônica sem `?`: `zona` (uma por zona), `nome`, `local`, `dia`, `periodo`, `pace`, `nivel`, nessa ordem, omitindo vazios; codificação de `URLSearchParams`. Sem filtros → `''`.
- `searchHref(f): string` → `'/grupos'` ou `'/grupos?' + filtersToQuery(f)`.
- `activeChips(f): { label: string, href: string }[]` — mesma ordem e textos de `renderChips` (linhas 707–718); `href` = `searchHref` de `f` **sem** aquele filtro (para zona, sem aquela zona). Rótulos: `ZONAS[z].nome`; `Nome: {nome}`; `Local: {local}`; `DIAS[dia]`; `PERIODOS[periodo]`; `PACE_FAIXAS[pace].nome`; `NIVEIS[nivel].nome`.
- `escapeLike(s: string): string` — prefixa `\` em `\`, `%` e `_` (para `ILIKE … ESCAPE '\'`).
- `periodRange(periodo): { from: 'HH:MM', to: 'HH:MM' | null }` — cedo `00:00–07:00`, manha `07:00–12:00`, tarde `12:00–18:00`, noite `18:00–null`. Deve concordar com `periodoDe` (teste cruzado).

### Repo — `src/modules/groups/groups.repo.js`
`listPublished(filters = EMPTY_FILTERS)` — mesma consulta e ordem da 004, acrescentando ao `WHERE` (cada valor como parâmetro `$n`, índices montados dinamicamente; nenhum valor concatenado no SQL):
| filtro | condição |
|---|---|
| `zonas` não vazio | `g.zone = ANY($n::text[])` |
| `nome` | `g.name ILIKE $n ESCAPE '\'` com `'%' + escapeLike(nome) + '%'` |
| `local` | `g.location ILIKE $n ESCAPE '\'` idem |
| `dia` | `$n = ANY(g.days)` |
| `periodo` | `g.start_time >= $a::time` e, se `to` não for `null`, `g.start_time < $b::time` (de `periodRange`) |
| `pace` | `g.pace_min_s < $max AND g.pace_max_s > $min` (de `PACE_FAIXAS`; AGENTS §6: faixas que **cruzam**) |
| `nivel` | `g.level = $n` |

O repo espera `filters` vindo de `parseFilters`; mesmo assim só lê `PACE_FAIXAS`/`periodRange` para chaves validadas com `Object.hasOwn`.

### Serviço — `groups.service.js`
- `listPublishedGroups(filters = EMPTY_FILTERS)` → repo.
- `searchGroups(query)` → `const filters = parseFilters(query)`; devolve `{ filters, groups: await listPublishedGroups(filters), chips: activeChips(filters) }`.

### Rotas — `src/modules/groups/groups.routes.js` (novo; montado no `app.js` depois de `pagesRouter`)
| Método | Caminho | Auth | Resultado |
|---|---|---|---|
| GET | `/grupos` | — | 200, `renderPage('grupos', { title: 'Grupos de corrida em SP · Pace Paulista', ...await searchGroups(req.query) })` |
| GET | `/grupos/zona/:zona` | — | `:zona` ∈ `ZONA_ORDEM` → **301** para `/grupos?zona=<zona>`; senão 404 (página padrão) |

Parâmetros inválidos em `/grupos` nunca dão erro: são ignorados (ex.: `?zona=marte&pace=constructor` = sem filtro).

### View — `src/views/pages/grupos.ejs` (nova)
Mesmo HTML/classes de `PageGrupos`, com estas trocas para funcionar sem JS:
| protótipo | aqui |
|---|---|
| `<aside class="filters" id="filters" aria-label="Filtros">` | `<form class="filters" id="filters" method="get" action="/grupos" role="search" aria-label="Filtros">` (mesma classe: o CSS não muda de layout) |
| `<button class="link" data-act="clear" style="…">Limpar filtros</button>` | `<a class="link" href="/grupos" style="font-family:var(--f-body);font-size:14px;text-transform:none">Limpar filtros</a>` |
| `<button class="ztog" … data-act="toggle-zona" aria-pressed>` | **P3 (default)**: `<label class="ztog" style="<%= zstyle(z) %>"><input class="sr-only" type="checkbox" name="zona" value="<z>" data-z="<z>"<% if (selecionada) { %> checked<% } %>><%= ZONAS[z].curto %></label>` |
| inputs/selects `data-f="…"` sem `name` | mesmos, com `name` = `nome`, `local`, `dia`, `periodo`, `pace`, `nivel` (manter `data-f`, `id`, `placeholder`, `autocomplete="off"`, `class="select mono"` no pace) e valor atual preenchido (`value="<%= filters.nome %>"`, `selected` na opção ativa) |
| (sem botão; filtra ao digitar) | **P2 (default)**: último item do form: `<button class="btn btn-primary" type="submit"><%- ic('search','ico-sm') %> Aplicar filtros</button>` |
| `<button class="… filters-toggle" data-act="filters-toggle" aria-expanded>` | `<a class="btn btn-outline btn-sm filters-toggle" href="#filters" aria-controls="filters"><%- ic('filter','ico-sm') %> Filtros</a>` |
| `#count` preenchido por JS | `<span class="count" id="count" aria-live="polite">{N} grupos encontrados</span>` (1 → "1 grupo encontrado") |
| chips `<button class="achip" data-act="rm-filter">` | `<a class="achip" href="<%= chip.href %>" aria-label="Remover filtro <%= chip.label %>"><%= chip.label %> <%- ic('x','ico-sm') %></a>` dentro de `<div class="active-chips" id="chips" style="margin-bottom:16px">` |
| `#results` preenchido por JS | `<div id="results">` com `<div class="grid-cards">` + `partials/group-card` por grupo, ou o estado vazio |
| estado vazio com `<button data-act="clear">` | `<div class="empty"><%- ic('run') %><h3>Nenhum grupo nesse ritmo</h3><p>Nenhum grupo atende a todos os filtros. Tente ampliar a faixa de pace, escolher outro dia ou incluir mais zonas.</p><a class="btn btn-primary" href="/grupos">Limpar filtros</a></div>` |
- `page-head`: kicker "Encontrar grupos", título "Grupos de corrida em SP", texto literal "Filtre por zona, dia, horário, pace e nível. Os resultados atualizam na hora." (ver P2).
- Opções dos selects, na ordem e com os textos do protótipo: vazio "Qualquer dia" + `DIA_ORDEM` com `DIAS[d]`; "Qualquer horário" + `PERIODOS`; "Qualquer pace" + `PACE_FAIXAS[k].nome`; "Todos os níveis" + `NIVEIS[k].nome`. Hint do pace: "Mostra grupos cuja faixa cruza a escolhida."
- Todo texto vindo da query (`nome`, `local`, rótulos e `href` dos chips) com `<%= %>`.

### CSS — `public/css/app.css` (só acréscimos, sem cor solta)
```css
/* Toggles de zona como checkbox: mesmo visual do aria-pressed, funcionando sem JS. */
.ztog:has(input:checked){background:var(--z);border-color:var(--z);color:var(--zon)}
.ztog:has(input:checked)::before{background:currentColor}
.ztog:has(input:focus-visible){outline:3px solid var(--focus);outline-offset:2px}
a.achip{text-decoration:none}
@media (max-width:900px){ .filters:target{display:grid} }
```
(Em ≤ 900 px o `.filters` fica oculto e o link "Filtros" aponta para `#filters`; o `:target` o mostra sem JS.)

## Regras e mensagens
| Elemento | Regra | Texto/valor exato |
|---|---|---|
| Contagem | `n === 1 ? 'grupo encontrado' : 'grupos encontrados'` | "11 grupos encontrados", "1 grupo encontrado", "0 grupos encontrados" |
| Vazio | 0 resultados | título "Nenhum grupo nesse ritmo"; texto "Nenhum grupo atende a todos os filtros. Tente ampliar a faixa de pace, escolher outro dia ou incluir mais zonas."; botão "Limpar filtros" → `/grupos` |
| Chip zona | `ZONAS[z].nome` | "Zona Sul" |
| Chip nome/local | prefixo | "Nome: pace", "Local: ibirapuera" |
| Chip dia/período/pace/nível | rótulo da opção | "Sábado", "Antes das 7h", "5:00 a 6:00 min/km", "Iniciante" |
| `aria-label` do chip | `Remover filtro {rótulo}` | "Remover filtro Zona Sul" |
| `nome`/`local` | `ILIKE '%termo%'`, `%`/`_`/`\` escapados, trim, máx. 80 | — |
| `zona` | OR entre zonas | — |
| `pace` | `pace_min_s < max AND pace_max_s > min` | — |
| `/grupos/zona/x` | zona válida → 301 | `Location: /grupos?zona=x` |

Resultados esperados com os 11 demo (slugs na ordem padrão da 004):
| query | resultado |
|---|---|
| (nenhum) | os 11, na ordem da 004 |
| `zona=sul` | pace-da-oca, primeiro-km-ibira, represa-run-club |
| `zona=leste&zona=sul` (e `zona=sul&zona=leste`) | correria-do-carmo, tiete-em-movimento, pace-da-oca, primeiro-km-ibira, represa-run-club |
| `nome=pace` / `nome=PACE` / `nome=%20pace%20` | juventude-em-pace, pace-da-oca |
| `nome=pelot%C3%A3o` ("pelotão") | pelotao-paulista |
| `nome=%25` / `nome=_` / `nome=%5C` | nenhum (sem erro 500) |
| `local=ibirapuera` | pace-da-oca, primeiro-km-ibira |
| `dia=sab` | raia-usp, correria-do-carmo, primeiro-km-ibira |
| `periodo=cedo` | villa-lobos-runners, correria-do-carmo, pace-da-oca |
| `periodo=manha` | cantareira-trail, raia-usp, pelotao-paulista, primeiro-km-ibira, represa-run-club |
| `periodo=tarde` | nenhum → estado vazio |
| `periodo=noite` | juventude-em-pace, minhocao-noturno, tiete-em-movimento |
| `pace=ate5` | raia-usp, pelotao-paulista, pace-da-oca |
| `pace=5a6` | villa-lobos-runners, minhocao-noturno, pelotao-paulista, correria-do-carmo, represa-run-club |
| `pace=6a7` | cantareira-trail, juventude-em-pace, correria-do-carmo, tiete-em-movimento, represa-run-club |
| `pace=mais7` | cantareira-trail, tiete-em-movimento, primeiro-km-ibira |
| `nivel=iniciante` | juventude-em-pace, tiete-em-movimento, primeiro-km-ibira |
| `zona=sul&nivel=avancado` | pace-da-oca ("1 grupo encontrado") |
| `zona=marte&dia=xyz&pace=constructor&nivel=__proto__` | os 11, sem chips |

(Bordas conferidas: `minhocao-noturno` 5:00–6:00 **não** entra em `ate5` nem em `6a7`; `primeiro-km-ibira` 7:00–8:30 **não** entra em `6a7`; `juventude-em-pace` 6:00–7:00 **não** entra em `mais7` — a faixa precisa cruzar, encostar não basta.)

## Critérios de aceite
- [ ] CA1 — **(pronto do M3)** Com o JavaScript desligado no navegador, cada um dos 7 filtros pode ser aplicado pelo formulário (marcar zonas, digitar nome/local, escolher dia/horário/pace/nível e "Aplicar filtros", ou Enter num campo de texto), a URL fica com os parâmetros do formulário, e os resultados batem com a tabela acima.
- [ ] CA2 — Com filtros ativos, o formulário volta preenchido (zonas marcadas, textos no `value`, opção `selected`), a contagem e os chips aparecem; clicar num chip remove só aquele filtro; "Limpar filtros" (no título e no estado vazio) leva a `/grupos`.
- [ ] CA3 — `GET /grupos/zona/sul` → 301 com `Location: /grupos?zona=sul`; `GET /grupos/zona/marte` → 404 com a página "Página não encontrada".
- [ ] CA4 — Parâmetros inválidos, repetidos ou em formato de objeto (`?nome[a]=1`, `?zona[]=sul`) não causam 500: são ignorados como em `parseFilters`.
- [ ] CA5 — `nome=%25` e `nome=_` devolvem 0 grupos (o `%`/`_` é literal, não curinga); `nome=<script>` aparece escapado no `value` e no chip.
- [ ] CA6 — Em 360 px: sem scroll horizontal; o formulário de filtros fica oculto e o link "Filtros" o exibe (via `#filters`, sem JS); os cards ocupam uma coluna.
- [ ] CA7 — Acessibilidade: `aria-live="polite"` na contagem; cada zona é um checkbox com rótulo visível; foco visível no toggle de zona; `aria-current="page"` em "Encontrar grupos" no header.
- [ ] CA8 — Os textos de títulos, opções, hint, vazio e chips são os do protótipo (tabela "Regras e mensagens"); só "Aplicar filtros" é novo (P2).
- [ ] CA9 — SQL só no `groups.repo.js`, com todo valor de filtro em parâmetro `$n` (inspeção: nenhum valor de filtro interpolado no texto do SQL); `npm test` e `npm run lint` passam.

## Testes esperados
- unit:
  - `tests/domain/schedule.test.js`: `periodoDe` — `'06:59'` cedo, `'07:00'` manha, `'11:59'` manha, `'12:00'` tarde, `'17:59'` tarde, `'18:00'` noite, `'00:00'` cedo, `'06:30:00'` cedo; inválido lança `RangeError`.
  - `tests/domain/filters.test.js` (novo): `parseFilters` — vazio → `EMPTY_FILTERS`; `zona` string e array, repetidas e fora de ordem → ordenadas por `ZONA_ORDEM`; inválidas descartadas; `nome` com espaços → trim; 200 chars → 80; array em `nome` → primeiro; objeto → ignorado; `pace=constructor`, `nivel=__proto__`, `dia=toString` → `''`. `filtersToQuery` — ordem canônica (`zona=leste&zona=sul&nome=…&nivel=…`), vazio → `''`, espaço codificado. `activeChips` — rótulos e ordem do protótipo; `href` de cada chip remove só aquele filtro. `escapeLike('50%_a\\b')` → `'50\\%\\_a\\\\b'`. `periodRange` × `periodoDe`: para todo `HH:MM` de 00:00 a 23:59 (passo de 1 min), `periodoDe(h) === p` ⇔ `h` está em `periodRange(p)`.
  - `tests/domain/constants.test.js`: `PERIODOS` e `PACE_FAIXAS` iguais ao protótipo.
- db (`tests/db/groups-repo.test.js`): cada linha da tabela de resultados chamando `listPublished(parseFilters(query))`.
- http (`tests/http/grupos.test.js`, novo, com `seedDemo`): `GET /grupos` 200 com "11 grupos encontrados" e 11 `class="card"`; amostra da tabela (`zona=sul`, `zona=leste&zona=sul`, `pace=5a6`, `periodo=tarde` com o estado vazio, `zona=sul&nivel=avancado` com "1 grupo encontrado"); formulário preenchido (`checked` no checkbox `value="sul"`, `selected` em `value="avancado"`, `value="pace"` no input `nome`); chips com `href` esperado (ex.: em `?zona=sul&nivel=avancado`, o chip "Zona Sul" aponta para `/grupos?nivel=avancado`); CA3; CA4 (`?nome[a]=1` → 200); CA5; nenhum `href="#` além de `href="#filters"`; nenhum `data-act="clear"`.

## Riscos / perguntas em aberto
### Perguntas em aberto
- **P2** — Sem JS é preciso um botão para enviar o formulário. **Default**: "Aplicar filtros" (ícone de busca), visível sempre no M3; o M7 pode escondê-lo quando o JS filtrar ao vivo. O texto do cabeçalho "Os resultados atualizam na hora." fica literal (só é verdade com o JS do M7) — manter, ou trocar no M3?
- **P3** — Toggles de zona: o AGENTS §8 pede `aria-pressed` (botões do protótipo). Sem JS, botões `aria-pressed` não alternam estado num formulário GET; a alternativa com um `<button type="submit">` por zona faz o Enter num campo de texto "clicar" no primeiro botão (Norte) e alternar a zona sem querer. **Default desta spec**: checkboxes visualmente idênticos (`label.ztog` + `:has(:checked)`), com semântica de checkbox para leitores de tela. Confirmar a troca (e o orquestrador ajusta o AGENTS §8), ou pedir outra solução.

### Riscos / decisões técnicas
- `:has()` exige navegadores de 2023+ (Chrome 105, Safari 15.4, Firefox 121). Em navegador antigo o filtro funciona; só o destaque visual da zona marcada não aparece.
- A busca por nome/local não ignora acentos (igual ao protótipo: `pelotao` não acha "Pelotão"). Ignorar acentos com `unaccent` seria regra nova; não entra.
- Termos de `nome`/`local` são cortados em 80 caracteres (a maior coluna buscável, `location`, tem 80); limita o tamanho do parâmetro sem mudar resultado prático.
- Em ≤ 900 px, depois de "Aplicar filtros" a página recarrega sem `#filters` e o formulário volta a ficar oculto, mostrando contagem, chips e resultados (o protótipo mantinha o painel aberto via estado JS).
- `/grupos/:slug` (006) e `/grupos/novo` (M6) virão neste mesmo router; `/grupos/zona/:zona` tem dois segmentos e não conflita.
