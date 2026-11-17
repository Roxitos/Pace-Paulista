# 018 — Mapa sem recarregar (`mapa.js` + `GET /api/mapa/:slug`) e acessibilidade dos pins
Marco: M7 · Status: pronta para Coder (aguarda OK do usuário em P1–P4)
Depende de: 007 (mapa sem JS), 016 (`res.renderPartial`, `scripts` no layout, `ui.js`)

## Objetivo
Com JS, clicar num pin ou num item da lista do `/mapa` seleciona o grupo **sem recarregar a página**, como `selectOnMap`/`renderMapDetail` do protótipo (linhas 812–830 e 1091): o painel `#mapDetail` vem de `GET /api/mapa/:slug` e a URL vira `/mapa/<slug>` via `history.replaceState`. Sem JS, nada muda (links da spec 007). Junto, corrigir a acessibilidade dos pins herdada do protótipo: foco de teclado visível nos pins não selecionados e alvo de toque de pelo menos 24 px a 360 px.

## Fora do escopo
- Rolagem suave até `#matchResults` no `/encontrar`, `aria-current` em `/encontrar` e deslocamento antes das webfontes (pendências M7 que continuam abertas; spec própria, se quiserem).
- Anunciar a troca do painel a leitores de tela (`aria-live`) e `aria-current` nos pins: o protótipo não tem; ver **P4**.
- Mapa real (Leaflet/OSM): fora da v1.
- Regras CSS `.ztog[aria-pressed]` órfãs: **não são reaproveitadas aqui**. O mapa marca a seleção com `aria-current` (o certo para um item de lista de links; `aria-pressed` é de botão de alternância) e a spec 016 já decidiu mantê-las por estarem no bloco literal do protótipo, comparado byte a byte em `tests/http/scaffold.test.js`. Orquestrador: marcar `[x]` na pendência M3 citando 016/018.
- Rate limit e cache de `/api/mapa/:slug` (M8, junto com `/api/grupos`).

## Mudanças

### Banco
Nenhuma.

### Domínio
Nenhuma função nova (`pinPos`, `gmapsRota`, `gmapsBusca` da 007 continuam como estão).

### Service — `src/modules/pages/pages.service.js`
- `loadMapPanel(slug) → Promise<object|null>`: `(await loadMapData(slug))?.selected ?? null`. Reaproveita `getMapData`/`toMapGroup`, então o grupo devolvido **já vem sem `contact`** (P4 da 006). Uma consulta de lista por chamada, como a página (dataset pequeno; ver Riscos).

### Rotas — `src/modules/pages/pages.routes.js`
| Método | Caminho | Auth | Resultado |
|---|---|---|---|
| GET | `/mapa` | — | igual à 007, mais `scripts: ['mapa']` |
| GET | `/mapa/:slug` | — | igual à 007 (404 sem banco se `!isSlug`; 404 se não publicado), mais `scripts: ['mapa']` só na resposta 200 |
| GET | `/api/mapa/:slug` | — | **novo**. `!isSlug(slug)` → `404` JSON `{"error":"not_found"}` **sem consultar o banco**; `loadMapPanel` → `null` → mesmo 404 JSON; senão `200` JSON `{ "slug": "<slug>", "panel": "<html>" }` com `panel = await res.renderPartial('map-detail', { g })`. Sempre `Cache-Control: private, no-store` (o selo "Cadastrado por você" depende da sessão). Erro de banco segue o `errorHandler` (HTML 500), como a `/api/grupos`. |
- **Só os campos `slug` e `panel`.** Nunca serializar o objeto do grupo, `res.locals` nem `owner_id`/`contact`.
- `renderPartial` não consome o flash (spec 016).

### Views
- `src/views/partials/map-detail.ejs` (**novo**): o conteúdo atual de `#mapDetail` em `mapa.ejs` para um grupo `g` (o `<div class="panel" …>` até o link "Ver detalhes do grupo"), **sem mudar um byte do HTML**.
- `src/views/pages/mapa.ejs`:
  - `#mapDetail` passa a fazer `<% if (selected) { %><%- include('../partials/map-detail', { g: selected }) %><% } %>`. O HTML do painel na página fica idêntico ao de hoje (os testes da 007 continuam passando sem alteração).
  - Cada pin ganha, **como primeiro filho**, uma área de toque invisível: `<circle class="hit" r="17" fill="transparent"/>`, antes de `circle.ring` e `circle.dot` (que continuam iguais). Conta: a 360 px o SVG tem ~290 px para 400 unidades (escala ≈ 0,725); `r=17` → 34 unidades ≈ **24,6 px** (WCAG 2.5.8). O ponto visível continua com 12 unidades (≈ 9 px). Vale também sem JS.

### CSS — `public/css/app.css` (só acréscimos, no bloco antes de `/* Layout: cabeçalho fixo`)
```css
/* Mapa (spec 018): foco de teclado visível também nos pins não selecionados (lá o anel tem r=0) e contínuo,
   para não se confundir com o anel tracejado da seleção. */
a.pin:focus-visible circle.ring{r:14px;stroke:var(--focus);stroke-width:3;stroke-dasharray:none}
```
- Especificidade (0,2,2) maior que `.pin:focus-visible circle.ring` do bloco literal; a propriedade CSS `r` vence o atributo `r="0"`. Clique com mouse não mostra o anel (`:focus-visible`).
- Nada no bloco literal do protótipo muda.

### JS do cliente — `public/js/mapa.js` (**novo**, módulo; carregado pelo layout só quando a rota passa `scripts: ['mapa']`)
Comportamento (porta de `selectOnMap` + `renderMapDetail` + o `map-select` do clique):
1. Se não houver `#mapDetail` e `#pins` na página, não faz nada.
2. Estado: `selected` = `data-id` do `.map-item[aria-current="true"]` (ou nenhum); `cache = new Map()` com `selected → #mapDetail.innerHTML` inicial.
3. Delegação de `click` no `.map-layout` para `a[data-act="map-select"]` (pin ou item). Se não for clique simples (`isPlainClick` de `ui.js`: Ctrl/Cmd/Shift/Alt/botão do meio), **não intercepta** (nova aba funciona como sem JS). Senão `preventDefault()`.
4. Slug: `getAttribute('data-id')`. **Não usar `link.href`** (em `<a>` SVG é `SVGAnimatedString`, não string); para o fallback usar `getAttribute('href')`.
5. Seleção visual imediata, igual ao protótipo: `aria-current` `"true"`/`"false"` em todos os `.map-item`; em cada `#pins .pin`, `circle.ring` `r` 14/0 e `circle.dot` `r` 8/6 (atributos).
6. Painel: se o slug já está no `cache`, troca na hora; senão `fetch('/api/mapa/' + encodeURIComponent(slug), { headers: { Accept: 'application/json' }, signal })`, com `AbortController` (um clique novo cancela o anterior; só a resposta do último clique é aplicada, como em `filtros.js`). Enquanto espera, `#mapDetail` fica com `aria-busy="true"` (removido ao terminar). Com a resposta: `#mapDetail.innerHTML = data.panel` (HTML do servidor, já escapado pelo EJS) e guarda no `cache`.
7. Depois de trocar o painel: `history.replaceState(null, '', '/mapa/' + encodeURIComponent(slug))` (sem `#mapDetail`; ver **P1**).
8. Rolagem no celular (protótipo linha 1091): se `window.innerWidth < 900`, `#mapDetail.scrollIntoView({ behavior, block: 'nearest' })` com `behavior = 'auto'` quando `matchMedia('(prefers-reduced-motion: reduce)').matches`, senão `'smooth'`. O `scroll-margin-top:84px` da 007 mantém o painel abaixo do cabeçalho fixo.
9. Clique no grupo já selecionado: não busca nada; só faz a rolagem do passo 8.
10. Falha (resposta não-2xx — inclusive 404 de grupo despublicado nesse meio-tempo —, erro de rede ou JSON sem `panel`): `location.assign(getAttribute('href'))`, ou seja, cai na navegação normal da 007 (que mostra o 404 se o grupo sumiu). `AbortError` é ignorado.
11. Foco: continua no pin/item clicado (como no protótipo). Sem `innerHTML` com dado que não venha do servidor; sem script inline.

## Regras e mensagens
| Elemento | Regra | Valor exato |
|---|---|---|
| `GET /api/mapa/pace-da-oca` | 200 JSON | `{"slug":"pace-da-oca","panel":"<div class=\"panel\" style=\"--z:#3A78C2;--zon:#FFFFFF;border-color:var(--z)\">…Ver detalhes do grupo</a>\n  </div>"}` — `panel` igual ao miolo de `#mapDetail` em `GET /mapa/pace-da-oca` |
| `GET /api/mapa/ABC`, `/api/mapa/nao-existe`, grupo `pending` | 404 JSON | `{"error":"not_found"}` |
| Cabeçalho da API | sempre | `Cache-Control: private, no-store` |
| URL após selecionar | `replaceState` (P1) | `/mapa/pace-da-oca` (sem entrada nova no histórico) |
| Pin selecionado / não selecionado | protótipo | `ring` `r="14"` / `r="0"`; `dot` `r="8"` / `r="6"` |
| Área de toque do pin | 1º filho do `<a class="pin">` | `<circle class="hit" r="17" fill="transparent"/>` |
| Foco de teclado no pin | CSS | `a.pin:focus-visible circle.ring{r:14px;stroke:var(--focus);stroke-width:3;stroke-dasharray:none}` |
| Rolagem no celular | `innerWidth < 900` | `scrollIntoView({behavior:'smooth'\|'auto', block:'nearest'})` |

Nenhum texto novo de UI.

## Critérios de aceite
- [ ] CA1 — Dado `/mapa` com JS, quando clico (clique simples) num item da lista ou num pin de outro grupo, então a página **não recarrega**, exatamente um `.map-item` fica com `aria-current="true"` (o clicado), só o pin dele tem `ring r=14`/`dot r=8` (demais 0/6), `#mapDetail` mostra o painel desse grupo (nome, Local, Encontro, Quando, Pace, "Traçar rota", "Abrir no Maps", "Ver detalhes do grupo") e a barra de endereço mostra `/mapa/<slug>`.
- [ ] CA2 — Dado que selecionei 3 grupos seguidos, quando aperto Voltar, então saio do mapa para a página anterior (nenhuma entrada nova no histórico); recarregar mostra o último grupo selecionado (SSR da 007).
- [ ] CA3 — Voltar a um grupo já visto não faz nova requisição a `/api/mapa/…` (cache); o grupo da carga inicial também não.
- [ ] CA4 — Ctrl/Cmd+clique ou botão do meio num pin/item abre `/mapa/<slug>#mapDetail` em nova aba e não muda a seleção da aba atual.
- [ ] CA5 — Cliques rápidos em A, B e C: o estado final (lista, pins, painel e URL) é o de C.
- [ ] CA6 — Em ≤ 900 px de largura, após selecionar, o painel rola para a vista (`block:'nearest'`) e para abaixo do cabeçalho fixo; com `prefers-reduced-motion: reduce` a rolagem é instantânea.
- [ ] CA7 — Se `/api/mapa/<slug>` responder não-2xx (ex.: grupo despublicado depois de a página abrir) ou a rede falhar, o navegador navega para `/mapa/<slug>#mapDetail` (404 "Esse endereço não existe." se o grupo sumiu).
- [ ] CA8 — `GET /api/mapa/pace-da-oca` → 200 JSON só com `slug` e `panel`; `panel` idêntico ao miolo de `#mapDetail` de `GET /mapa/pace-da-oca`; `Cache-Control: private, no-store`. Slug fora do formato → 404 JSON sem consultar o banco; inexistente ou `pending` → 404 JSON. Com `contact` preenchido, nem ele nem `owner_id` aparecem na resposta; nome/local com `<script>` saem escapados no `panel`; a chamada não consome flash pendente.
- [ ] CA9 — **Sem JS**: `/mapa` e `/mapa/:slug` se comportam como na 007 (links, seleção pela URL, `#mapDetail`); o HTML só muda pelo `<circle class="hit" …/>` em cada pin. Todos os testes de `tests/http/mapa.test.js` continuam passando sem alteração.
- [ ] CA10 — `<script type="module" src="/js/mapa.js">` aparece em `/mapa` e `/mapa/<slug>` (200) e **não** aparece no 404 de `/mapa/nao-existe` nem em outras páginas (ex.: `/grupos`, `/`).
- [ ] CA11 — Teclado: Tab num pin **não selecionado** mostra anel contínuo de raio 14 na cor `--focus` (3 px); no selecionado também; clique com mouse não mostra o anel. Enter num pin focado seleciona sem recarregar (com JS) ou navega (sem JS).
- [ ] CA12 — Toque: a 360 px, o alvo de cada pin mede ≥ 24 × 24 px (círculo `hit` de 34 unidades); tocar a ~10 px do centro do ponto seleciona o grupo. Visual do mapa inalterado (o `hit` é transparente).
- [ ] CA13 — Responsivo em 360 px sem scroll horizontal (com e sem JS, inclusive após trocar para um grupo de nome longo); sem erros no console.
- [ ] CA14 — Nada de SQL fora de `*.repo.js` (a API usa `loadMapData`); `npm test` e `npm run lint` passam.

## Testes esperados
- http (`tests/http/mapa.test.js`, acrescentar):
  - CA8: 200 com `Object.keys(body)` = `['slug','panel']`, `panel` igual ao miolo de `#mapDetail` da página (reusar o helper `detail`), cabeçalho `Cache-Control`; `/api/mapa/ABC` → 404 sem `pool.query` (spy); `pending` → 404; contato e `owner_id` ausentes; `<script>` escapado no `panel`.
  - CA9/CA12: todo pin começa com `<circle class="hit" r="17" fill="transparent"/>` antes do `ring`.
  - CA10: script presente em `/mapa` e `/mapa/pace-da-oca`; ausente em `/mapa/nao-existe` e `/grupos`.
  - CSS (CA11): `app.css` contém a regra do foco antes do marcador `/* Layout: cabeçalho fixo`.
- client (`tests/client/mapa.test.js`, novo, DOM falso como em `participar.test.js`): clique simples num item → `preventDefault`, `fetch('/api/mapa/pace-da-oca', …)` e `history.replaceState(null, '', '/mapa/pace-da-oca')`; clique com `ctrlKey` → nem `preventDefault` nem `fetch`. (Um teste de cada; o resto fica com o QA no navegador.)
- QA no navegador (Chromium, com e sem JS, 360 e 1280 px): CA1–CA7, CA11–CA13.

## Riscos / perguntas em aberto

### Perguntas em aberto (com defaults; aguardar OK antes do Coder)
- **P1 — Histórico.** Default: **`replaceState`** — selecionar no mapa não cria entrada nova (Voltar sai do mapa), como no protótipo (a seleção não mudava o `#hash`) e como os filtros ao vivo da 016; a URL continua compartilhável e recarregável. Alternativa: `pushState` + `popstate` (Voltar desfaz a seleção, mas 10 cliques = 10 Voltar).
- **P2 — Área de toque.** Default: círculo invisível `r=17` (≈ 24,6 px a 360 px) em todos os pins, sem mudar o visual. Pins muito próximos têm áreas sobrepostas (nos demos: Pace da Oca × Primeiro Km Ibira, ~20 px de distância a 360 px); na sobreposição vence o pin que vem depois no HTML. Para esses casos vale a exceção "equivalente" do WCAG 2.5.8: o mesmo grupo é selecionável pelo item da lista, que tem bem mais de 24 px. Alternativa: aumentar o ponto visível (muda o desenho do protótipo).
- **P3 — Visual do foco.** Default: anel **contínuo** na cor `--focus` (o protótipo usava o anel tracejado, que nos não selecionados tinha raio 0). Muda também o foco do pin selecionado (antes tracejado azul, agora contínuo). Alternativa: manter tracejado só com o raio corrigido.
- **P4 — Leitor de tela.** Default: como no protótipo, sem `aria-live` no painel e sem `aria-current` nos pins (o foco fica no pin/item e a lista já tem `aria-current`). Querem que a troca do painel seja anunciada?

### Riscos / decisões técnicas
- **API própria em vez de buscar a página inteira**: `GET /api/mapa/:slug` devolve só o painel (partial da própria página, então não diverge do SSR) e não consome flash; buscar `/mapa/<slug>` e recortar `#mapDetail` evitaria a rota, mas traria a página toda a cada clique e consumiria o flash. Embutir os painéis de todos os grupos na página cresceria com o número de grupos (e pesaria também sem JS).
- `loadMapPanel` lê a lista inteira de publicados para achar um grupo (mesmo custo da página atual por clique, agora sem o HTML). Rever junto com o pool sem `statement_timeout`/rate limit (M8).
- Propriedade CSS `r` (já usada pelo protótipo em `.pin:hover circle.dot{r:9}`): em navegador sem suporte, o foco volta ao comportamento atual (só o ponto cresce), sem quebrar.
- `<a>` SVG: `href` é `SVGAnimatedString`; o Coder deve usar `getAttribute`. `closest()` funciona em elementos SVG.
- O cache do cliente vive só enquanto a página está aberta: se o grupo mudar no banco nesse meio-tempo, o painel já visto mostra a versão antiga até recarregar (aceitável; dados mudam raramente).
- Ao trocar o painel, um foco que estivesse **dentro** do `#mapDetail` se perderia, mas a troca só nasce de cliques em pins/itens, que ficam fora dele.
- Pendência M3 `[aria-pressed]`: fechada como "mantidas, literais do protótipo" (016) e "não reaproveitadas no mapa" (018). Pendências M7 do mapa (foco discreto, alvo de 9 px e "selecionar sem recarregar") ficam resolvidas por esta spec após o QA.
