# QA — 005 Busca `/grupos` com filtros via query string (sem JS) e `/grupos/zona/:zona`
Veredito: APROVADO

Data: 2026-11-11 · Branch `claude/pipeline-m3-start-059610`, com o diff no working tree (nada commitado; HEAD `09193ae`) · Windows 10, Node 22.23.4, Docker `postgres:16`, Chrome 157 headless via CDP.

## Ambiente
- `npm ci`: ok. Nenhuma dependência nova (`package.json` e `package-lock.json` sem diff).
- `npm run db:up`: **não rodei a partir deste worktree**, como pedido. Usei o container do checkout principal, que já estava saudável em `127.0.0.1:5432`.
- `npm run migrate` 2x: `Banco localhost:5432/pace_paulista já está em dia (5 migrations).` nas duas, código 0. A spec não traz migration. `npm run seed`: `0 de 11 grupos demo inseridos (11 já existiam)`.
- Servidores: o diff na porta 3321 (banco de dev) e uma cópia da HEAD (`git archive HEAD`) na 3322, para a regressão. O log do servidor do diff não registrou nenhum erro durante todo o QA.
- Relatórios das etapas: usei o resumo do orquestrador (Coder, Cleaner e Hardener). Não existe `docs/reports/005-*`.

| Critério | Resultado | Evidência |
|---|---|---|
| CA1 — sem JS, os 7 filtros pelo formulário, URL com os parâmetros e resultados iguais aos da tabela | ✅ | **Navegador sem JS** (`Emulation.setScriptExecutionDisabled`, 360 px). Cliques reais no rótulo "Sul", texto "pace" digitado no nome e **Enter**: a URL ficou `?zona=sul&nome=pace&local=&dia=&periodo=&pace=&nivel=`, com "1 grupo encontrado" (Pace da Oca). Só a zona Sul ficou marcada, sem efeito colateral. Pelo botão "Aplicar filtros": `nivel=avancado`+`pace=ate5` deu 2; `dia=sab` deu Raia Olímpica, Correria do Carmo e Primeiro Km Ibira; `periodo=noite` deu Juventude, Minhocão e Tietê; `local=ibirapuera` deu Pace da Oca e Primeiro Km Ibira; Leste+Sul deu `?zona=leste&zona=sul…`, com 5. Com `curl`, **as 24 linhas da tabela de resultados** bateram nos slugs e na ordem, inclusive as bordas `minhocao`/`ate5`, `primeiro-km`/`6a7` e `juventude`/`mais7` |
| CA2 — form preenchido, contagem, chips, remover chip, "Limpar filtros" | ✅ | `?zona=leste&zona=sul&nome=pace&local=ibira&dia=seg&periodo=cedo&pace=ate5&nivel=avancado`: `checked` só em leste e sul, `value="pace"` e `value="ibira"`, e `selected` em seg, cedo, ate5 e avancado. A página mostra 8 chips na ordem do protótipo, e o `href` de cada um remove só o próprio filtro (ex.: "Zona Leste" leva a `/grupos?zona=sul&nome=pace&…`). No navegador sem JS, o clique no chip "Avançado" levou a `?pace=ate5` (3 grupos). "Limpar filtros" do estado vazio leva a `/grupos` (11). O do título é `<a href="/grupos">` (a 1280 px, `elementFromPoint` confirma o alvo) |
| CA3 — `/grupos/zona/sul` 301 e `/grupos/zona/marte` 404 | ✅ | `curl -i`: `301 Moved Permanently`, `Location: /grupos?zona=sul`. `marte`, `SUL`, `__proto__` e `/grupos/zona/` dão 404 com `<title>Página não encontrada · Pace Paulista</title>` |
| CA4 — parâmetros inválidos, repetidos ou objeto não dão 500 | ✅ | `curl -g`: `?nome[a]=1`, `?nome[]=x`, `?zona[]=sul`, `?zona[a]=sul`, `?nome=%00`, `?__proto__=x&constructor=y` e `?zona=marte&dia=xyz&pace=constructor&nivel=__proto__` dão todos 200 com 11 grupos e sem chips. `zona=sul&zona=sul&zona=SUL` dá 3. Em `nome=a&nome=b` vale o primeiro valor |
| CA5 — `%`/`_` literais e `<script>` escapado | ✅ | `nome=%25`, `nome=_` e `nome=%5C` dão 200 e "0 grupos encontrados". Com `nome=<script>alert(1)</script>`, a página traz `value="&lt;script&gt;…"` e o chip `aria-label="Remover filtro Nome: &lt;script&gt;…"`, sem nenhum `<script>alert` cru. Bônus do Hardener: `nome=pelota%CC%83o` (NFD) acha Pelotão Paulista |
| CA6 — 360 px: sem scroll horizontal, filtros ocultos, link "Filtros" abre o painel sem JS, uma coluna | ✅ | Sem JS, 360×800, claro e escuro: `scrollWidth` = `innerWidth` = 360 e `scrollTo(500,0)` mantém `scrollX = 0`. `#filters` sai com `display:none`; depois do clique real em "Filtros", vira `#filters` com `display:grid`, e a largura continua em 360. Os 11 cards ficam numa única coluna (um só `x`). O `.sr-only` sem `margin:-1px;border:0` é cópia literal do protótipo (linha 38) e não gerou overflow em nenhum cenário. Os únicos elementos além da borda são os SVG da `track-deco`, recortados como no protótipo. Ver o problema 1, que não bloqueia |
| CA7 — `aria-live`, checkbox com rótulo visível, foco visível no toggle, `aria-current` | ✅ | `<span class="count" id="count" aria-live="polite">`. Cada zona é `<label class="ztog"><input class="sr-only" type="checkbox" name="zona" …>Norte</label>`. Com Tab real (JS ligado e desligado, 360 e 1280), os 5 checkboxes deixam no rótulo `outline: solid 3px rgb(58,120,194)` (`--focus`), e os chips, o botão e o link "Filtros" mostram o mesmo contorno (`:focus-visible` do protótipo). Espaço alterna o checkbox. O `:has(:checked)` pinta a zona marcada com a cor dela (Norte `rgb(94,154,34)`/branco, Centro `rgb(232,137,43)`/asfalto, Sul `rgb(58,120,194)`), em claro e escuro, igual ao `aria-pressed="true"` do protótipo. `aria-current="page"` só em "Encontrar grupos" |
| CA8 — textos do protótipo; só "Aplicar filtros" é novo | ✅ | Kicker, título, texto do page-head (com "Os resultados atualizam na hora." literal, P2), rótulos, placeholders, opções ("Qualquer dia"… "Todos os níveis"), hint, contagem, vazio e chips: tudo confere com `PageGrupos`/`renderChips` (linhas 666–718). Além de "Aplicar filtros", a única troca é `button`→`a`/`label`, como manda a spec |
| CA9 — SQL só no repo, valores em `$n`; testes e lint | ✅ | `grep` de `SELECT\|WHERE\|ILIKE…` em `src/` acha só `groups.repo.js` (e 2 comentários em `filters.js`). Só o repo importa `db/pool`. Interceptei `pool.query` com todos os filtros e `nome="x' OR 1=1 --"`: o WHERE só tem `$2…$9`, e os valores vão em `params` (`"%x' OR 1=1 --%"`, `"%a\\%\\_\\\\%"`, 360, 300…). Testes 389/0, lint ok |

Testes: 389 passaram / 0 falharam (22 arquivos, 49 s) · Lint: ok (ESLint sem erros; "All matched files use Prettier code style!")

## Fidelidade ao protótipo (`/grupos`)
- Abri `docs/prototipo.html#grupos` no mesmo Chrome e comparei com `/grupos` em 360 e 1280 px, claro e escuro, em 3 estados (sem filtro, `zona=sul&nivel=avancado`, `periodo=tarde`). Para 28 seletores (`page-head`, `#filters` e campos, `.ztog`, `.results-bar`, `#count`, `.filters-toggle`, `#chips`, `.achip`, `.grid-cards`, `.card`, `.empty`…), comparei a assinatura: posição, tamanho, cor, fundo, fonte, padding, margin, raio, borda, display e grid. Todas as diferenças têm explicação:
  - `#filters` fica 64 px mais alto pelo botão "Aplicar filtros" (P2), e os elementos abaixo descem o mesmo tanto.
  - Em `.ztog`, só muda o texto da assinatura, porque o `label` tem o `input` como filho. Cor, fundo, borda, padding e tamanho são idênticos, com a zona marcada ou não.
  - A ordem dos cards é diferente: o protótipo lista na ordem do array `DEMO`, e o site usa zona (`ZONA_ORDEM`) e depois nome, como pedem a spec ("na ordem da 004") e o AGENTS §6. O texto de cada card é idêntico ao do card do mesmo grupo no protótipo, e a altura também é (a 360 px).
  - Em 360 px, o protótipo mostra "Ocultar filtros" com o painel aberto (estado JS do M7). Isso está fora do escopo.
- `.empty` (ícone, título, texto, botão) e `.achip` têm estilo idêntico ao do protótipo.

## Console do navegador
- Em todos os carregamentos de `/grupos` (360/1280, claro/escuro, JS ligado/desligado) não houve nenhum `console.*` nem exceção. Só aparece o `404 /favicon.ico` já registrado no QA 004 (não é regressão), mais um 404 de `/meus` que **eu** provoquei ao clicar no header (ver o problema 1). `/meus` é do M5.

## Regressão
- Comparei a cópia da HEAD (3322) com o diff (3321): `/` (21551 bytes), `/zonas` (13034), `/sobre`, `/mapa`, `/x404`, `/grupos/pace-da-oca`, `/grupos/novo` e `/js/app.js` dão o **mesmo código e os mesmos bytes**. `/grupos/:slug` continua 404, porque a 006 ainda não entrou; não dá para testar o detalhe de um grupo demo. Os links da home `/grupos?zona=<z>` agora dão 200.
- `/css/app.css` só muda pelo bloco novo antes do marcador "Layout" (10 linhas, seletores `.ztog:has`, `a.achip` e `.filters:target`). Por isso `/` e `/zonas` saem idênticas.

## Problemas encontrados
Nenhum bloqueante.

1. **[RESOLVIDO na reverificação abaixo] (menor, UX sem JS em ≤ 900 px)** Em 360 px, ao tocar em "Filtros", o painel abre e a página rola até `#filters`. O topo do painel (o título "FILTROS" e o link "Limpar filtros") fica **atrás do cabeçalho fixo**, cerca de 70 px.
   Passos: JS desligado, viewport 360×800, abrir `/grupos?nivel=iniciante` e tocar em "Filtros". O link "Limpar filtros" fica em `y≈27`, sob o header, e `elementFromPoint` no centro dele devolve o link `/meus` do header. Rolando um pouco para cima, o link aparece e funciona. O CA6 é cumprido ao pé da letra (o painel abre). Correção sugerida para o Coder, quando for conveniente: `.filters{scroll-margin-top:calc(env(safe-area-inset-top,0px) + 84px)}` no bloco de acréscimos (o mesmo `top` do sticky).

## Resolvidos
- Problema 1 / antiga sugestão 1 (topo do painel de filtros atrás do cabeçalho fixo em ≤ 900 px): corrigido com `.filters{scroll-margin-top:84px}`. Ver a seção "Reverificação — scroll-margin dos filtros".

## Sugestões não bloqueantes
1. Sem JS, a URL depois de enviar o form leva todos os campos vazios (`&local=&dia=&periodo=&pace=&nivel=`). Funciona, e os chips já usam a forma canônica. Se incomodar, um redirect 302 para `searchHref(filters)` quando a query não for canônica deixaria a URL limpa e compartilhável. Isso muda comportamento, então a decisão fica com o Specifier.
2. "Os resultados atualizam na hora." continua no cabeçalho, mas sem JS não é verdade até o M7 (P2). Vale registrar em `PENDENCIAS.md` para revisar no M7 ou trocar antes.
3. A ordem dos cards em `/grupos` difere da do protótipo (zona+nome × ordem do `DEMO`). Está correto pela spec e pelo AGENTS §6; registro só para que ninguém "corrija" na comparação visual.
4. Pendências que continuam do QA 004: `/favicon.ico` 404 e headers sem CSP/`helmet` (marco de segurança).
5. O orquestrador ainda precisa aplicar as decisões da spec no AGENTS: §6 `PACE_FAIXAS` `{nome,min,max}`, §3 comentário de `filters.js` e §8 `aria-pressed`→checkbox (P3).

## Reverificação — scroll-margin dos filtros
Veredito mantido: **APROVADO**. Problema 1 resolvido.

Data: 2026-11-11 · mesmo worktree, diff ainda não commitado · Chrome headless via CDP, servidor do diff na porta 3331 com o banco de dev (Postgres já de pé em 127.0.0.1:5432; não rodei `db:up`).

Mudança verificada: `public/css/app.css`, linha 15, no bloco de acréscimos e antes do marcador "Layout": `.filters{scroll-margin-top:84px}`. A safe-area vem do `html{scroll-padding-top:env(safe-area-inset-top,0px)}` da linha 2, que se soma ao valor. Existe um teste novo em `tests/http/grupos.test.js` (linha 325) que confere a regra no CSS servido.

| Cenário | Resultado | Evidência |
|---|---|---|
| 360×800, **sem JS**, claro: `/grupos?nivel=iniciante` e clique real em "Filtros" | ✅ | URL `…#filters`, `#filters` com `display:grid`, `scrollY` 267. O cabeçalho é sticky e termina em y=71. O topo do painel fica em y=84, o título "FILTROS" (`text-transform:uppercase`) em y=105 e "Limpar filtros" em y=111. `elementFromPoint` no centro do link devolve o **próprio link**, não mais `/meus`. No título, devolve o `h2`. O clique real no link leva a `/grupos`. `scrollWidth` = 360 |
| 360×800, **sem JS**, escuro | ✅ | Mesmos números (fundo `rgb(23,23,26)`). Screenshot: título e link visíveis logo abaixo da faixa vermelha do cabeçalho |
| 360×800, **com JS**, claro e escuro | ✅ | O `app.js` não intercepta o link, então o comportamento é o mesmo do sem JS: painel em y=84, link clicável, sem overflow |
| ≥ 901 px (901 e 1280), com e sem JS | ✅ | `.filters-toggle` fica com `display:none` e a página carrega com `scrollY` 0. Comparei a assinatura (x, y, largura, altura e display) de 11 seletores (`.hdr`, `.page-head`, `#filters`, `#filters h2`, o link, `.results-bar`, `#count`, `.filters-toggle`, `.grid-cards`, `.card` e `footer`) com a regra e depois de injetar `.filters{scroll-margin-top:0!important}`: **idêntica** nos 4 casos. `scrollWidth` = largura da viewport. `scroll-margin` só age em rolagem até âncora, e nessa largura não existe link para `#filters` |
| Console | ✅ | Nenhum `console.*` nem exceção nos 8 carregamentos. Só aparece o `404 /favicon.ico` já conhecido. O log do servidor não registrou erros |

Testes: 390 passaram / 0 falharam (22 arquivos; eram 389, +1 do teste novo) · Lint: ok (ESLint sem erros; "All matched files use Prettier code style!")
