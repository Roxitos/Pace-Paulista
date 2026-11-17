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
