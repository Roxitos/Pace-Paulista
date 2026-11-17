# 018 — Mapa sem recarregar

Spec: [`docs/specs/018-mapa-sem-recarregar.md`](../specs/018-mapa-sem-recarregar.md) · Marco: M7

## Specifier
Spec 018 escrita, terceira do M7. Selecionar no mapa (pin ou lista) sem recarregar; sem JS continua como na 007.
- `GET /api/mapa/:slug` devolve `{slug, panel}` (HTML do partial novo `map-detail.ejs`, extraído de `mapa.ejs` sem mudar bytes, via `renderPartial`, sem consumir flash). `Cache-Control: private, no-store`. Slug inválido, inexistente ou `pending` → 404 JSON. `loadMapPanel` reaproveita `loadMapData` (sem `contact` para deslogado).
- `public/js/mapa.js` (novo): clique em `a[data-act="map-select"]` (Ctrl/Cmd/botão do meio seguem o navegador), seleção imediata, `AbortController` (vale o último clique), cache por slug, `history.replaceState`, rolagem até o painel abaixo de 900 px (respeita `prefers-reduced-motion`), falha → navegação normal. Nos `<a>` do SVG usar `getAttribute('href')`.
- Rotas `/mapa` e `/mapa/:slug` passam `scripts: ['mapa']` (só em 200).
- Acessibilidade: `<circle class="hit" r="17" fill="transparent"/>` em cada pin (alvo ~24,6 px a 360 px) e anel de foco visível em pins não selecionados (`a.pin:focus-visible circle.ring`).
- Regras CSS `[aria-pressed]` órfãs: mantidas (trecho copiado do protótipo, testado byte a byte; o mapa usa `aria-current`).
- 14 critérios de aceite; testes HTTP, teste de cliente com DOM falso, resto no navegador (QA).

Perguntas em aberto (defaults na spec), aguardando o usuário: P1 (`replaceState` × `pushState`), P2 (área de toque `r=17`, pins próximos se sobrepõem; lista é o controle equivalente), P3 (anel de foco contínuo, muda o foco tracejado do selecionado), P4 (sem `aria-live` no painel, como no protótipo).
Fora da spec e abertas: rolagem suave do `/encontrar`, `aria-current` em `/encontrar`, deslocamento antes das webfontes.

Aprovação: usuário aceitou os defaults de P1–P4 (`replaceState`; área de toque `r=17`; anel de foco contínuo; sem `aria-live` no painel).

## Coder
Spec 018 implementada. `npm test` (53 arquivos, 828 testes) e `npm run lint` passam.
- Novos: `public/js/mapa.js`, `src/views/partials/map-detail.ejs` (extraído de `mapa.ejs`), `tests/client/mapa.test.js` (DOM falso).
- Alterados: `mapa.ejs` (usa o partial; `circle.hit r=17` em cada pin), `pages.service.js` (`loadMapPanel`), `pages.routes.js` (`scripts: ['mapa']` só nos 200; `GET /api/mapa/:slug`), `app.css` (foco do pin, antes do marcador `/* Layout: cabeçalho fixo`), `tests/http/mapa.test.js`.
- Testes: CA8–CA12 e CA14 por HTTP/cliente; testes antigos do mapa passam sem alteração (CA9). CA1–CA7 e CA11–CA13 só no navegador (QA); o Coder não rodou Chromium.
- Alertas: `loadMapPanel` lê a lista inteira de publicados a cada chamada (rate limit/cache no M8). Seguem abertas e fora da spec: rolagem do `/encontrar`, `aria-current` em `/encontrar`, webfonts.

## Cleaner
Sem mudança de comportamento. `npm test` 828/828 e `npm run lint` OK.
- `pages.routes.js`: helper `renderMap(res, data)` no lugar da repetição de `title`/`scripts` nas duas rotas de `/mapa`.
- `map-detail.ejs`: includes de `zone-chip` e `demo-tag` com caminho relativo ao partial, como em `group-card.ejs`.
- `mapa.js`: `catch {` sem `err` e guarda só `controller !== mine` (a checagem de `AbortError` era redundante).
- Alertas para o Hardener: `loadMapPanel` lê toda a lista de publicados a cada chamada (M8); testes de cliente com DOM falso, então CA1–CA7 e CA11–CA13 ficam para o QA no navegador.
