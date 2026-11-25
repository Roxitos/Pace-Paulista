# QA — 024 Mapa real (2ª rodada)
Veredito: APROVADO

Revalidação após correções do Coder (volta 2). Resultados da 1ª rodada que seguem válidos: CA1, CA2, CA5-CA7, CA11, CA12.

| Critério | Resultado | Evidência |
|---|---|---|
| CA1/CA2 migration, seed, CHECKs | ✅ | migrate 2x "em dia (8)"; seed 0/11 novos; testes db |
| CA3 menu | ✅ | aria-current "Mapa"; a 1241, 1000 e 360 px header 71 px (sem quebra) |
| CA4 mapa com JS | ✅ | getComputedStyle(.map-box > svg).display = none a 1280, 1241, 1000 e 360 px; 11 pinos, atribuição OSM |
| CA5 seleção | ✅ | clique na lista/pino muda URL sem recarregar |
| CA8 sem JS | ✅ | JS desligado a 1280 e 360: 200, esquema SVG visível (screenshot) |
| CA9 CSP/console | ✅ | tiles OSM simulados via route; clique em 3 itens da lista, zoom +/- e clique em pino a 1280 e 360 px: 0 erros de console |
| CA13 reduced motion | ✅ | emulação reducedMotion=reduce: após clique, sem classe leaflet-zoom-anim e pane sem transform residual (setView sem animação); 0 erros; código usa setView quando reducedMotion() |
| CA14 360 px | ✅ | scrollWidth 360, SVG oculto, sem scroll horizontal |
| CA15 testes/lint | ✅ | npm test 58 arquivos, 937/937; eslint e prettier ok |
| Regressão | ✅ | /, /grupos?zona=sul, /grupos/pace-da-oca, /mapa/pace-da-oca: 200 |

Testes: 937 passaram / 0 falharam · Lint: ok

## Problemas encontrados
Nenhum.

## Não verificado (manual, com internet)
Tiles reais do OSM e pinos sobre os locais certos (proxy bloqueia o OSM aqui); CA10 contra o OSM real.

## Sugestões não bloqueantes
- Fallback automático para o SVG se os tiles falharem (risco já aceito).

---
# Histórico: 1ª rodada (REPROVADO)
Veredito: REPROVADO (devolver ao Coder)

| Critério | Resultado | Evidência |
|---|---|---|
| CA1 migration/seed | ✅ | migrate 2x "em dia"; seed 0/11 novos; 11 demos com lat/lng no banco; testes db |
| CA2 CHECKs | ✅ | UPDATE lat=-46.6,lng=-23.5 recusado por groups_lat_lng_sp_check; testes db |
| CA3 menu | ✅ | aria-current="page" em /mapa e /mapa/<slug>; visível no menu mobile; 1241 px sem quebra de linha (header 71 px, igual a 1000/1400) |
| CA4 mapa com JS | ❌ | 11 pinos, atribuição OSM, sem zoom por roda, zoom por botão ok. Mas o esquema SVG NÃO fica escondido (ver Problema 1). Tiles reais não verificáveis (proxy bloqueia tile.openstreetmap.org); usei tiles simulados via rota do Playwright |
| CA5 seleção | ✅ | clique na lista e no pino: URL /mapa/pace-da-oca, 1 pino is-selected, zoom 15, sem recarregar; /mapa/<slug> abre centrado |
| CA6 sem coordenadas | ✅ (testes) | cobertos por testes http/client; não reproduzido no navegador (todos os demos têm coordenadas) |
| CA7 rota lat,lng | ✅ (testes) | tests/domain/map.test.js |
| CA8 sem JS | ✅ | JS desligado: #mapReal display none, SVG visível; páginas 200 |
| CA9 CSP / console | ❌ | CSP só ganhou tile.openstreetmap.org em img-src, mas há erros de CSP no console (Problema 2) |
| CA10 Referer dos tiles | ✅ (parcial) | pedidos de tile saem com Referer só da origem (http://localhost:3100/); cabeçalho global segue same-origin. Não testado contra o OSM real |
| CA11 /vendor/leaflet | ✅ | css e esm 200, Cache-Control public, max-age=31536000, immutable; ../, %2e%2e, ..%2f -> 404 |
| CA12 sem contact | ✅ | "contact" ausente de /mapa e /api/mapa/:slug |
| CA13 reduced motion | ⚠️ | não confirmado de forma conclusiva no navegador; coberto por teste de cliente |
| CA14 360 px | ✅ (com ressalva) | sem scroll horizontal (scrollWidth 360), botões de zoom 30x30 px, 1 coluna, dark mode legível. Ressalva: SVG duplicado abaixo do mapa (Problema 1) |
| CA15 testes/lint | ✅ | npm test 58 arquivos, 932/932; lint e prettier ok |

Testes: 932 passaram / 0 falharam · Lint: ok

## Problemas encontrados
1. **SVG esquemático continua visível com JS (bloqueante, CA4/CA14).** A regra `.map-box > svg{display:block}` em public/css/app.css (linha ~346) sobrescreve o atributo `hidden`. Reproduzir: abrir /mapa com JS e viewport 1280 ou 360: o esquema aparece junto com o mapa real. Correção sugerida: `.map-box > svg[hidden]{display:none}`. Os testes não pegam porque são jsdom e checam só o atributo.
2. **Erros de CSP no console ao dar zoom ou selecionar (bloqueante, CA9).** O Leaflet troca o `src` dos tiles removidos por `data:image/gif;base64,R0lGOD...` (L.Util.emptyImageUrl), bloqueado por `img-src 'self' https://tile.openstreetmap.org`. Reproduzir: abrir /mapa, clicar em qualquer item da lista ou no zoom: dezenas de erros "violates the following Content Security Policy directive: img-src". Sem erros no carregamento inicial. Funcionalmente inofensivo, mas viola o CA9. Opções para o Coder: apontar `L.Util.emptyImageUrl` para um arquivo próprio (`/img/...`), ou decidir com o Specifier se `data:` em img-src é aceitável (a spec diz que o único acréscimo é o OSM).

## Não verificado
Tiles reais do OSM e conferência visual dos 11 pinos sobre os locais certos (rede bloqueada neste ambiente); precisa de verificação manual com internet. Também não confirmei CA6 em navegador nem CA13 de forma conclusiva.

## Sugestões não bloqueantes
- Fallback automático para o SVG se os tiles falharem (risco já aceito pelo Hardener).
- Obs.: durante o teste alterei temporariamente raia-usp no banco local para validar o CHECK e já restaurei (-23.5565, -46.721).
