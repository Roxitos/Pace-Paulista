# QA — 007 Mapa esquemático `/mapa` e `/mapa/:slug` sem JS, e `/sobre`
Veredito: APROVADO

Data: 2026-11-11 · Branch `feat/m3-detalhe-mapa-sobre` · Windows 11, Node 24.19.0 (o AGENTS pede 22), Docker `postgres:16` em `127.0.0.1:5433`, Chrome 157 headless via CDP.

Escopo: o diff da 007 é o `git diff` sem `--cached` mais os arquivos não rastreados (`src/domain/map.js`, `src/domain/slug.js`, `src/views/pages/mapa.ejs` e `sobre.ejs`, e os testes novos). A 006, já aprovada, está no stage e serviu de base para a regressão. O stage não foi tocado. Decisões aplicadas: P8, P9 e P10 com os defaults da spec. P4: nenhum HTML do mapa pode trazer o `contact` do grupo.

## Ambiente
- `npm run db:up`: não rodei. O container `pace-paulista-db-1` já estava saudável.
- `npm run migrate` 2x: `já está em dia (5 migrations)` nas duas vezes. A spec não traz migration.
- `npm run seed`: `0 de 11 grupos demo inseridos (11 já existiam)`.
- `package.json` e `package-lock.json` sem diff, nem no working tree nem no stage, ou seja, nenhuma dependência nova.
- Servidores:
  - O working tree (006 + 007) rodou na porta 3200.
  - O stage (só a 006), extraído com `git checkout-index -a --prefix=<scratchpad>/stage007/`, rodou na 3201 com o mesmo banco.
  - Conferi a cópia com `diff -rq`: ela difere do working tree só nos arquivos da 007.
- Dados temporários no banco de dev:
  - 1 usuário com `display_name` igual a `<script>alert(9)</script>`.
  - O grupo `qa-007-xss`, com `<script>` no nome e no local (o local ainda leva `&`, `#` e aspas), `<img onerror>` no ponto de encontro, dono, `map_pin` NULL e `contact`.
  - O grupo `qa-007-longo`, com nome de 50 caracteres sem espaço, local de 80, ponto de 60, `map_pin = {999,999}` (fora do viewBox) e `contact`.
  - O grupo `qa-007-pend`, com status `pending`.
  - Também gravei um `contact` com link de WhatsApp em `pace-da-oca`.
  - Para o CA5, passei todos os publicados para `rejected` e depois os devolvi para `published`.
  - **Tudo foi desfeito no fim**: 11 grupos, todos `published` e com `contact` NULL, 0 usuários e 0 memberships.

| Critério | Resultado | Evidência |
|---|---|---|
| CA1 — `/mapa` | ✅ | `curl`: 200 e `<title>Mapa e rotas · Pace Paulista</title>`. Há 5 `path` de zona, idênticos ao `ZPOLY` do protótipo, e 5 rótulos: "ZONA NORTE", "ZONA OESTE", "CENTRO" (`font-size="11"`), "ZONA LESTE" e "ZONA SUL" (13). As 2 linhas tracejadas estão lá. São 11 `class="pin"` e 11 `class="map-item"` na ordem padrão (cantareira → … → represa). Há exatamente 1 `aria-current="true"`, em Cantareira Trail, com o pin em `translate(188 56)`, `r="14"` e `r="8"`; os outros 10 têm `0`/`6`. O painel traz o chip "Zona Norte", "Fictício · demo", o h2 "Cantareira Trail", Local "Parque Estadual Alberto Löfgren (Horto Florestal)", Encontro "Combinado no grupo, na entrada do Horto", Quando "Dom · 7h" e Pace "6:30–8:00 min/km" |
| CA2 — `/mapa/pace-da-oca` | ✅ | 200. Pace da Oca aparece selecionado na lista (único `aria-current="true"`), no pin (`translate(200 246)`, 14/8; os outros 10 em 0/6) e no painel ("Seg, Qua, Sex · 6h", "4:15–5:00 min/km"). "Traçar rota" e "Abrir no Maps" batem byte a byte com a tabela da spec (`&amp;`, `%C3%A3`), com `target="_blank" rel="noopener"`. "Ver detalhes do grupo" leva a `/grupos/pace-da-oca`. `gmapsRota`/`gmapsBusca` crus (sem `&amp;`) também batem |
| CA3 — sem JS: clique e teclado | ✅ | Chrome com `Emulation.setScriptExecutionDisabled` (o `/js/app.js` nem é baixado), a 360 e a 1280 px. **Clique real com o mouse** (`Input.dispatchMouseEvent`) no pin do Pace da Oca leva a `/mapa/pace-da-oca#mapDetail`, com lista, pin e h2 do Pace da Oca. O clique no item "Raia Olímpica" leva a `/mapa/raia-usp#mapDetail`, com a seleção certa. Com **Tab a partir do topo**, os 13 pins recebem foco na ordem da lista, todos visíveis, e o Tab seguinte vai ao 1º item da lista. Tab até o pin do Villa-Lobos e Enter levam a `/mapa/villa-lobos-runners#mapDetail`. Enter no item "Represa" leva a `/mapa/represa-run-club#mapDetail`. Nos pins não há `tabindex`, `role="button"` nem `role="listitem"`, e não há nenhum `href="#`. Depois da âncora, o topo do `#mapDetail` fica em y=84, abaixo do cabeçalho fixo (que termina em 71): o `scroll-margin-top:84px` do Coder funciona. Repeti tudo com JS ligado e o resultado é o mesmo |
| CA4 — 404 | ✅ | Dão 404 com "Página não encontrada" / "Esse endereço não existe.": `/mapa/nao-existe`, `/mapa/ABC`, `/mapa/PACE-DA-OCA`, `/mapa/pace%20da%20oca`, `/mapa/-`, `/mapa/pace-da-oca%0A` e `/mapa/pace-da-oca/x`. O mesmo vale para `/mapa/qa-007-pend` (`pending`), que também não aparece em `/mapa`. Um escape malformado (`/mapa/%`, `/mapa/%E0%A4%A`) dá 400 com "Algo deu errado", sem stack, como os testes do Hardener esperam. O teste "sem consulta ao banco" para `ABC`, `pace_da_oca` e 61×`a` passa |
| CA5 — nenhum grupo publicado | ✅ | Banco temporariamente sem nenhum `published`: `/mapa` responde 200 com `<g id="pins"></g>`, `<ul class="map-list"></ul>` e `<div id="mapDetail" class="map-detail"></div>`. Estão lá os 5 polígonos e os 5 rótulos, e não aparece nenhum `NaN`, `undefined` ou `Infinity`. No Chrome, a 360 e a 1280, a página não tem scroll horizontal (o mapa e a nota ficam sozinhos). `/mapa/pace-da-oca` dá 404 nesse estado. Depois disso, restaurei o status dos 13 grupos |
| CA6 — `pinPos` | ✅ | `{slug:'abc', zone:'sul', map_pin:null}` dá `[177, 305]`. Os 11 do seed usam o `map_pin`. `qa-007-xss` (NULL) caiu em `translate(192 297)`, igual ao `pinPos`. O hash coincide com a função do protótipo em 2.500 slugs gerados (5 zonas × 500), com 0 divergências. `[1]` e `[1.5,2]` usam a zona. `[0,0]` e `[400,380]` são aceitos. `{999,999}` é ignorado e cai na zona: o pin de `qa-007-longo` ficou visível, na Zona Leste |
| CA7 — `/sobre` | ✅ | 200, `<title>Sobre · Pace Paulista</title>` e `aria-current="page"` só em "Sobre". O cabeçalho, o painel "A ideia" (2 parágrafos) e a nota final são literais do protótipo (`innerText` igual). O botão "Explorar grupos" leva a `/grupos`. O status tem 2 ATIVO (`st on`) e 3 PENDENTE (`st off`), com o texto exato da P10. Não há "Supabase" nem "navegador" na página |
| CA8 — escape | ✅ | `qa-007-xss`: o `aria-label` do pin sai `&lt;script&gt;alert(1)&lt;/script&gt;N, &lt;script&gt;alert(2)&lt;/script&gt; &amp; #x &#34;q&#34;`. Na lista, `<b>`/`<small>` saem escapados. No painel, h2, Local, Encontro (`&lt;img …&gt;`) e "Cadastrado por &lt;script&gt;alert(9)…" também. O local entra codificado nas URLs do Maps (`%3Cscript%3E…%26%20%23x%20%22q%22`). O único `<script>` cru é o `src="/js/app.js"`, e não há nenhum `<img`. No Chrome com JS, não houve exceção nem diálogo |
| CA9 — 360 px | ✅ | Chrome a 360×800, com e sem JS, claro e escuro. `.map-layout` em 1 coluna (`320px`) e o SVG com 290 px, que é a largura útil inteira do `.map-box`. `scrollWidth` = 360 em `/mapa`, `/mapa/pace-da-oca`, `/mapa/qa-007-longo` (50/80 caracteres sem espaço), `/mapa/qa-007-xss`, `/mapa/nao-existe`, `/mapa/ABC` e `/sobre` (`.about` em 1 coluna). Nenhum `.map-item` estoura, e o h2 não transborda. No grupo longo, o nome quebra em 4 linhas dentro do painel. A 1280: `630.781px 485.219px`, sem scroll |
| CA10 — camadas, testes, lint | ✅ | Nenhum SQL fora de `*.repo.js` (grep por `SELECT/INSERT/UPDATE/pool.query` em `src`). O mapa usa `listPublishedGroups` pelo `pages.service`. O `contact` é removido em `toMapGroup` antes da view. Testes 520/0, lint ok |

Testes: 520 passaram / 0 falharam (27 arquivos, 16 s) · Lint: ok (ESLint sem erros; "All matched files use Prettier code style!")

## P4 — contato fora do HTML do mapa
- Os 3 grupos `qa-007-*` e o `pace-da-oca` tinham `contact` preenchido durante o teste.
- Em `/mapa`, `/mapa/pace-da-oca`, `/mapa/qa-007-xss` e `/mapa/qa-007-longo`: `grep -ci 'QA007CONTATO\|QA007Segredo\|whatsapp\|contato'` deu **0** em todas. Isso cobre texto, `data-*`, atributos e comentários; as views usam `<%#`, que não sai no HTML. Não há JSON embutido na página.
- Há uma barreira no serviço (`delete g.contact`), e os testes de `getMapData` e o HTTP da P4 passam.

## Fidelidade ao protótipo
- Abri `docs/prototipo.html#mapa-<id>` e `#sobre` (JS ligado) no mesmo Chrome do site (JS desligado), a 360 e a 1280 px, nos esquemas claro e escuro.
- Comparei a assinatura (x, y, largura, altura, cor, fundo, fonte, borda) de `.page-head`, h1, `.map-layout`, `.map-box`, SVG, `.map-note`, `#mapDetail`, `.panel`, `.card-top`, `.zchip`, `.demo-tag`, h2, cada linha/dt/dd de `dl.spec`, `.btn`, `a.link` e `.map-list`. Também comparei cada `.map-item` (com `b`, `small`, `.dotz` e dias), cada pin (transform, raios e cor) e o `outerHTML` de cada `path`/`text` do SVG.
- **`pace-da-oca` e `minhocao-noturno`: tudo idêntico** nas 4 combinações de largura e esquema.
  - A única diferença é a ordem da lista: a ordem padrão (P9), contra a ordem do array `DEMO`.
  - Os itens comparados um a um, pelo slug, são idênticos.
  - O `<ul>`/`<a>` no lugar de `div`/`button` não muda nenhum pixel medido.
  - O cabeçalho e o painel têm `innerText` idêntico.
- `/sobre`: o cabeçalho e o painel "A ideia" são idênticos.
  - O painel de status mudou de propósito (P10). Com 5 itens em vez de 6, ele fica 55 px mais curto a 1280 e 122 px a 360.
  - O painel "A ideia" acompanha a altura da linha do grid.
  - O painel de status começa 18 px abaixo do "A ideia" (y 357 contra 339) **também no protótipo**, como o Coder relatou.
- Screenshots: `site-oca-1280.png`, `proto-oca-1280.png` e `site-sobre-1280.png`, em `C:\Users\Xitos\AppData\Local\Temp\claude\9519414f725d5b3e\d37d8a38-e6a7-47b3-8d4c-5c8f264d1ee0\scratchpad\qa7shots\`.

## Console do navegador
Sem JS e com JS: nenhum `console.*` e nenhuma exceção. Os únicos erros de rede são o `/favicon.ico` 404, já conhecido, e o próprio 404 do documento em `nao-existe`/`ABC`.

## Regressão
- Comparei o stage (3201) com o working tree (3200), no mesmo banco, por md5 do corpo e dos cabeçalhos, sem `Date`/`ETag`.
- **Iguais**, tanto com os dados temporários quanto depois da limpeza: `/`, `/grupos`, `/grupos?zona=sul&nivel=avancado`, `/grupos?nome=pace`, `/zonas`, `/grupos/pace-da-oca`, `/grupos/cantareira-trail`, `/grupos/qa-007-xss`, `/grupos/zona/leste` (301), `/grupos/nao-existe`, `/grupos/ABC`, `/grupos/novo`, `/encontrar`, `/x404` e `/js/app.js`.
- A troca de `SLUG_RE` por `isSlug` em `groups.routes.js` não muda nada.
- `/css/app.css` só ganha as 7 linhas do bloco "Mapa (spec 007)", antes do marcador "Layout". Os seletores `.map-list`, `.map-item` e `.map-detail` só existem em `mapa.ejs`.
- `/mapa`, `/mapa/:slug` e `/sobre` passam de 404 (stage) para 200. O link "Mapa de encontros" do rodapé (`/mapa`) deixou de dar 404.

## Problemas encontrados
Nenhum.

## Sugestões não bloqueantes
1. **Foco do teclado nos pins é discreto (vem do protótipo):** `.pin:focus{outline:none}` e `.pin:focus-visible circle.ring{stroke:var(--focus)}`, mas o anel tem `r="0"` nos pins não selecionados. O único sinal de foco é o ponto, que cresce de 6 para 9. É visível no screenshot (`nojs-foco-pin-360.png`), mas fraco. O protótipo faz igual. Vale anotar para a revisão de acessibilidade (M7/M8).
2. **Pins pequenos a 360 px (vem do protótipo):** o SVG escala para 0,725, e o ponto fica com cerca de 9 px de diâmetro. A lista ao lado é a alternativa acessível, e o clique real funcionou. Mesmo assim, o alvo fica abaixo de 24 px (WCAG 2.5.8). Pode entrar no M7, junto com o `mapa.js`.
3. `/mapa/` e `/mapa/pace-da-oca/` (com barra no fim) respondem 200, porque o Express não usa roteamento estrito. As outras rotas fazem o mesmo, e os links são absolutos. Sem efeito prático.
4. Continuam valendo as sugestões do QA 006: `/favicon.ico` 404, CSP/`helmet` no M8, Node 24 local contra 22 do AGENTS, 3 px de scroll a 320 px (anterior) e escape malformado dando a página 500/400 genérica.

## Limpeza
- Servidores das portas 3200 e 3201 derrubados.
- Chrome headless do QA encerrado (nenhum processo restante).
- Cópia do stage e perfil do Chrome removidos. A junção para `node_modules` foi desfeita antes, com `rmdir`.
- Banco: 11 grupos `published`, todos com `contact` NULL, 0 usuários e 0 memberships.
- O stage do git não foi tocado: nada de `add`, `reset` ou `stash`, e nenhum commit.
