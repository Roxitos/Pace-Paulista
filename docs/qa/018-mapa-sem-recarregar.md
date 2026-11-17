# QA — 018 Mapa sem recarregar e acessibilidade dos pins
Veredito: APROVADO

Ambiente: `npm ci`, migrate (duas vezes, "já está em dia"), seed idempotente, app em :3100. Chromium (Playwright) em 1280 e 360 px, com e sem JS.

| Critério | Resultado | Evidência |
|---|---|---|
| CA1 | ✅ | Clique em item e em pin: sem reload (marcador `window` sobrevive), 1 `aria-current`, só o pin clicado com ring 14/dot 8, painel com Local/Encontro/Quando/Pace/Traçar rota/Abrir no Maps/Ver detalhes, URL `/mapa/<slug>` |
| CA2 | ✅ | `replaceState`: Voltar saiu para `/grupos`; reload após 1 seleção mostrou o grupo selecionado |
| CA3 | ✅ | 6 cliques (3 novos + 2 revisitados + inicial): só 3 requisições a `/api/mapa/…` |
| CA4 | ✅ | Ctrl+clique (item) e botão do meio (pin): nova aba em `/mapa/<slug>#mapDetail`; aba original inalterada |
| CA5 | ✅ | A (800 ms), B (400 ms), C (50 ms) disparados em sequência: estado final é C (lista, pin, painel, URL) |
| CA6 | ✅ | 360 px: rolagem suave gradual; com `reducedMotion: reduce` instantânea; painel termina em top=84 px (cabeçalho em 71 px) |
| CA7 | ✅ | Rota abortada e resposta 404 simulada: navegação para `/mapa/<slug>#mapDetail` |
| CA8 | ✅ (testes) | `tests/http/mapa.test.js`, passando; inspeção: usa `renderPartial` |
| CA9 | ✅ | Sem JS: item e pin navegam para `/mapa/<slug>#mapDetail`, seleção pela URL; testes da 007 passam |
| CA10 | ✅ | `/mapa/pace-da-oca` traz `mapa.js`; `/grupos` não (e teste http) |
| CA11 | ✅ | Tab em pin não selecionado: `:focus-visible`, r=14, stroke `--focus` 3 px, dash none; Enter seleciona sem reload; clique do mouse: `:focus-visible` falso |
| CA12 | ✅ | A 360 px o `hit` mede 24,6 × 24,6 px (mínimo); toque a ~7 px do centro seleciona; visual inalterado (screenshot) |
| CA13 | ✅ | 360 px com e sem JS, inclusive grupo de nome longo: scrollWidth = clientWidth = 360; console sem erros |
| CA14 | ✅ | API usa `loadMapData`; sem SQL fora de repo; testes e lint OK |

Testes: 829 passaram / 0 falharam (53 arquivos) · Lint: ok (ESLint + Prettier)

## Problemas encontrados
Nenhum bloqueante.

## Sugestões não bloqueantes
- Sem JS, logo após o carregamento e antes das webfontes, `scrollWidth` a 360 px chega a 375 (estabiliza em 360). Acontece igual em `/grupos`: é a pendência já conhecida "deslocamento antes das webfontes", não da 018.
- O banco local tem muitos grupos de teste (`aaaa…`) agrupados no mesmo ponto do mapa; com pins sobrepostos vale o item da lista (exceção P2).
- Pendências do Hardener (M8): sem `nosniff`/rate limit na API, `data.slug` não conferido, seleção visual divergente após falha e bfcache.
