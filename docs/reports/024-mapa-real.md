# 024 — Mapa real (Leaflet + OpenStreetMap) na aba "Mapa"

Spec: [`docs/specs/024-mapa-real.md`](../specs/024-mapa-real.md) · Marco: M11 — mapa real (pedido do usuário em 2026-11-25; antes do M10)

## Specifier
Spec 024 escrita a partir do pedido do usuário (2026-11-25). A spec seguinte prevista é a 025 (ponto no mapa no cadastro do grupo).
- Migration `008_groups_lat_lng.sql`: `groups.lat`/`lng` com CHECKs e UPDATE dos 11 demos. Seed e repo passam a usar lat/lng.
- `domain/map.js`: `hasCoords`; os links `gmaps*` usam as coordenadas do grupo quando ele tem.
- `leaflet@1.9.4` servido de `node_modules` em `/vendor/leaflet`. A CSP ganha `img-src` com `tile.openstreetmap.org`, e os tiles usam `referrerPolicy` `strict-origin-when-cross-origin`.
- Item "Mapa" no menu. O `mapa.js` monta o Leaflet sobre a seleção da spec 018, e o SVG fica como fallback sem JS.
- Perguntas P1–P7 com propostas: P1 coordenadas aproximadas, P2 SVG como fallback sem JS, P3 tiles do OSM, P4 "Sem ponto no mapa", P5 pinos fora do Tab, P6 tiles claros no dark mode, P7 frase no `/sobre`.
- Alertas: o M10 passa a usar a migration 009, e o AGENTS.md precisa ser atualizado no PR.

## OK do usuário (2026-11-25)
O usuário aprovou todas as propostas (P1–P7). P1: sem correções, ficam as coordenadas aproximadas e o QA confere os 11 pinos no navegador. Uma correção de coordenada exige migration nova. P7: o texto do `/sobre` foi aprovado.

## Coder
Spec implementada, retomando alterações não commitadas de uma execução anterior. `npm test` (931 testes) e `npm run lint` verdes.
- **Dependência nova:** `leaflet` 1.9.4, versão exata.
- **Arquivos novos:** `db/migrations/008_groups_lat_lng.sql`, `public/js/mapa-real.js`, `tests/client/mapa-real.test.js`.
- **Banco e servidor:**
  - Seed (11 lat/lng) e `groups.repo` passam a usar lat/lng.
  - `domain/map.js` ganhou `SP_CENTRO`, `SP_ZOOM` e `hasCoords`. Os links `gmaps*` recebem o grupo.
  - `app.js` serve `/vendor/leaflet` só a partir de `dist/`, com cache imutável de 1 ano.
  - CSP `img-src` com o OSM.
  - `styles` no layout e `currentNav` devolvendo `'mapa'`.
- **Views e cliente:** header, `mapa.ejs`, `map-detail.ejs`, `/sobre` (texto da P7; mapa ATIVO), `mapa.js` (import dinâmico com fallback para o SVG) e `app.css`.
- **Docs:** AGENTS §1–§5, §8, §9 e §12; MILESTONES (M11; o M10 passa para a migration 009).
- **Testes:** db (migrate, schema, seed, groups-repo), domain (map, view-helpers, pages-service, demo-groups), http (mapa, seguranca, sobre) e client (mapa, mapa-real com Leaflet falso).
- **Desvios:**
  1. Montagem do Leaflet em `mapa-real.js`, que recebe o Leaflet por parâmetro, para dar para testar.
  2. CSS antes do marcador "Layout", por exigência do `scaffold.test.js`.
  3. `sobre.test` proíbe "no navegador" em vez de "navegador", porque o texto da P7 diz "seu navegador".
  4. O título da aba não mudou.
- **Alertas:**
  - Só o QA no navegador verifica CA4, CA10 e CA14: tiles, Referer, 360 px, dark mode e os 11 pinos.
  - O Hardener deve olhar o traversal em `/vendor/leaflet`, a CSP e a origem de `data-lat`/`data-lng`.
  - O `npm audit` tem avisos que já existiam.
  - Rodar o vitest com saída para arquivo: `| head` deixa processos órfãos.
- **Nota do orquestrador:** duas execuções do Coder rodaram ao mesmo tempo nesta etapa. A segunda só rodou o prettier em `mapa.js` e `map.test.js` e completou o AGENTS.md. Na árvore final, `npm test` (931) e `npm run lint` passaram, rodados pelo orquestrador.

## Cleaner
Refatoração sem mudança de comportamento. `npm test` (931 testes) e `npm run lint` verdes.
- `src/domain/map.js`: removidos `SP_CENTRO` e `SP_ZOOM`, que não eram usados em `src/` (código morto), e o comentário que citava uma cópia inexistente em `mapa.js`.
- `public/js/mapa-real.js`: `SP_CENTRO` e `SP_ZOOM` ficam só aqui, com comentário explicando que o navegador não importa `src/`. `readCoords` checa atributo ausente antes do `Number`, porque `Number(null)` daria 0,0.
- `public/js/mapa.js`: a busca do SVG (`.map-box > svg`) virou uma constante única, usada no mapa real e no fallback.
- Testes revisados (http/mapa, client/mapa-real, domain/map): nenhum removido, porque cobrem os critérios CA3, CA6–CA9, CA11 e CA13.

## Hardener
Revisão de segurança do diff da 024. Um achado corrigido, de severidade baixa. `npm test` (931 testes) e `npm run lint` verdes.
- **Achado (baixa):** `readCoords` em `public/js/mapa-real.js` aceitava `data-lat=""` ou `" "` como 0 (`Number('') === 0`), o que poria um pino em 0,0. O servidor não gera esse atributo vazio (`hasCoords` filtra), então é defesa extra no cliente: atributo ausente, vazio ou só com espaços agora conta como grupo sem ponto. Teste: caso `item('vazio', '', ' ')` em `tests/client/mapa-real.test.js`, que falhou antes da correção.
- **Revisado e correto:**
  - CSP: só `img-src` ganhou o OSM; nenhum script inline novo; o CSS do Leaflet não usa `data:`; COEP desligado no helmet 8.
  - `/vendor/leaflet` serve só `dist/`, com os cabeçalhos de segurança; traversal (inclusive codificado) dá 404.
  - XSS: pinos com `createElement`, cor validada por regex, título via `textContent`, `data-lat`/`data-lng` escapados e só com `hasCoords`; sem popups.
  - `styles` no layout com nomes fixos e padrão `[]` em `renderPage` (páginas de erro incluídas).
  - `contact` fora do mapa e de `/api/mapa/:slug`; slug validado antes do `select`; links do Google Maps só com números ou o local codificado.
  - Migration 008: CHECK do par e da caixa de SP (recusa NaN/Infinity); `UPDATE` só nos demos sem ponto; compatível com o código antigo.
  - Tiles com `referrerPolicy: strict-origin-when-cross-origin`; cabeçalho global `same-origin`; falha do Leaflet volta ao SVG.
- **Riscos aceitos/pendentes:**
  - `/vendor/leaflet` com cache imutável de 1 ano em URL sem versão (como a spec pede): ao trocar a versão do Leaflet, versionar a URL.
  - O OSM recebe o IP do visitante e a área vista (informado no `/sobre`); política de uso do OSM (P3) vai para o `PENDENCIAS.md` no fim do ciclo.
  - Coordenadas dos demos aproximadas; tiles bloqueados na rede deste ambiente, então CA4, CA5, CA10 e CA14 ficam para verificação manual.

## QA (1ª rodada) — REPROVADO
Veredito em `docs/qa/024-mapa-real.md`. Volta para o **Coder** (volta 1 de 2).
- **Motivo (CA5):** em `/mapa` sem slug, o mapa abre em zoom 15 no 1º grupo (Cantareira Trail) em vez de enquadrar todos os pinos. O servidor já marca o 1º item com `aria-current="true"` (comportamento da spec 007), e `public/js/mapa-real.js` (`initial = markers.get(selectedSlug)`) trata isso como seleção inicial, então o `fitBounds` nunca roda. Confirmado lendo o código e o HTML; o zoom não foi medido no navegador.
- **Correção sugerida:** centralizar no grupo só quando a URL tiver slug (`/mapa/<slug>`); sem slug, `fitBounds`, mantendo o destaque do 1º item na lista. Se o produto preferir o comportamento atual, quem muda é a spec (Specifier).
- **Passou:** `npm test` 931/931 (58 arquivos) e lint; migrate e seed idempotentes; CHECKs de lat/lng; CSP (`img-src` com o OSM, `script-src 'self'`); `/vendor/leaflet` com cache longo e traversal 404; sem JS (`#mapReal` oculto, SVG como fallback); Chrome headless com 11 pinos, seleção em `/mapa/pace-da-oca` e atribuição do OSM, sem erros de console ou CSP; `contact` fora do mapa e da API; coordenadas dos demos plausíveis (Tietê em Movimento, Primeiro Km Ibira e Represa Run Club são aproximadas).
- **Verificação manual pendente** (tiles bloqueados neste ambiente): CA4, CA10, CA14 (scroll horizontal e dark mode), a largura de 1241 px do CA3, conferência visual dos 11 pinos e refazer o CA5 depois da correção.

## Coder (volta 1, após QA reprovado)
Correção do CA5. `npm test` (932 testes) e `npm run lint` verdes.
- `public/js/mapa-real.js`: `createRealMap` ganhou a opção `centerOnSelected`. Só com ela o mapa abre centrado no grupo selecionado (zoom 15); sem ela usa `fitBounds` de todos os pinos. O pino do 1º item continua destacado.
- `public/js/mapa.js`: passa `centerOnSelected: location.pathname.startsWith('/mapa/')`. Lista, seleção sem JS e esquema SVG não mudaram.
- Testes: `tests/client/mapa-real.test.js` cobre "com slug" (`setView` no grupo, sem `fitBounds`) e "sem slug" (`fitBounds` mesmo com o 1º item selecionado, sem `setView`, pino destacado); o stub de `location` em `tests/client/mapa.test.js` ganhou `pathname: '/mapa'`.
- Ambiente: sem Docker no sandbox; Postgres 16 local subido com `pg_ctlcluster`.
- Pendente manual para o QA: CA4, CA10, CA14, 1241 px do CA3, conferência dos 11 pinos.

## Cleaner (após a volta 1)
Refatoração sem mudar comportamento. `npm test` (932 testes) e `npm run lint` verdes.
- `public/js/mapa.js`: extraída `reduceMotion()`, que estava duplicada em `scrollToDetail` e no callback `reducedMotion`.
- `src/domain/map.js`: removido o JSDoc de `hasCoords` (contrato óbvio; CONVENTIONS pede JSDoc só quando não é).
- `tests/client/mapa-real.test.js`: `fakeLeaflet` monta `calls` de uma vez, sem atribuição tardia.
- `tests/http/mapa.test.js`: helper `tirarPontoDaOca()` no lugar de dois UPDATE idênticos.
- Ambiente: sem Docker no sandbox; Postgres local subido com `service postgresql start`.
- Pendente manual para o QA: CA4, CA10, CA14, 1241 px do CA3, conferência dos 11 pinos.

## Hardener (após a volta 1)
Revisão de segurança e bordas do diff não commitado. Nenhuma correção necessária; nenhum arquivo de código ou teste alterado. `npm test` (932 testes) e `npm run lint` verdes.
- **Verificado:** `/vendor/leaflet` serve só `dist/` (traversal 404, antes da sessão); CSP só ganhou `tile.openstreetmap.org` em `img-src`, sem `unsafe-inline` novo; tiles com `referrerPolicy: strict-origin-when-cross-origin`; lat/lng só vêm de seed/migration (`POST /grupos` não grava) e os CHECKs recusam par incompleto, fora da caixa de SP, NaN e ±Infinity (NaN/Infinity conferidos à mão no `psql`, sem teste automático); `UPDATE` da 008 restrito a `is_demo AND lat IS NULL`; cliente sem `innerHTML` com dado do banco (cor por regex, `title` por propriedade, slug por `SLUG_RE`); `styles` do layout com default `[]` (404/500/csrf intactos); links `gmaps*` só com números ou local codificado.
- **Riscos aceitos/pendentes:**
  - `/vendor/leaflet` com cache imutável de 1 ano sem versão na URL: ao atualizar o Leaflet, versionar o caminho.
  - O OSM vê o IP do visitante do `/mapa` (informado no `/sobre`).
  - OSM fora do ar: mapa sem ruas, pinos e lista seguem; sem fallback automático para o SVG.
  - Pendente manual para o QA: CA4, CA10, CA14, 1241 px do CA3, conferência dos 11 pinos.

## QA (2ª rodada) — REPROVADO
Veredito em `docs/qa/024-mapa-real.md`. Volta para o **Coder** (2ª e última volta permitida): bug funcional.
- **Bloqueante (CA4/CA14)**: `.map-box > svg{display:block}` em `public/css/app.css` (~linha 346) anula o atributo `hidden`; com JS o esquema SVG aparece junto com o mapa real, a 1280 e a 360 px. Os testes passam porque rodam em jsdom e só checam o atributo. Sugestão: `.map-box > svg[hidden]{display:none}` (e um teste que confira a regra no CSS).
- **Bloqueante (CA9)**: ao dar zoom ou selecionar um grupo, o Leaflet troca o `src` dos tiles por `data:image/gif;base64,…` (`L.Util.emptyImageUrl`) e o `img-src` bloqueia: dezenas de erros de CSP no console (nenhum no carregamento inicial). Opções: apontar `emptyImageUrl` para um arquivo próprio em `public/` ou, se o produto aceitar `data:` no `img-src`, mudar a spec (Specifier), que hoje limita o acréscimo ao OSM.
- **Passou:** `npm test` 932/932 e lint; migration 008 idempotente e CHECKs; CA3 a 1241 px sem quebra de linha; menu "Mapa" com `aria-current`; 11 pinos, atribuição, roda do mouse sem zoom, seleção sem recarregar (zoom 15), Referer só da origem (CA10, com tiles simulados); sem JS igual à spec 007 (CA8); `/vendor/leaflet` com cache e traversal 404 (CA11); `contact` fora de `/mapa` e da API (CA12); 360 px sem scroll horizontal e dark mode legível; regressão de home, `/grupos`, detalhe, `/sobre`, `/meus`.
- **Não verificado (proxy bloqueia o OSM):** tiles reais e conferência visual dos 11 pinos; CA6 só por teste; CA13 (reduced motion) inconclusivo no navegador.

## Coder (volta 2, após QA reprovado)
Corrige os dois bloqueios do QA. `npm test` (58 arquivos, 937 testes) e `npm run lint` verdes. Verificado no Chromium (tiles do OSM simulados por `route`).
- **SVG com JS (CA4/CA14):** a causa real era `svg.hidden = true`: `SVGElement` não tem `.hidden`, então o atributo nunca era posto (os fakes em jsdom escondiam isso). `public/js/mapa-real.js` e `public/js/mapa.js` usam `svg?.toggleAttribute('hidden', …)`; `public/css/app.css` ganhou `.map-box > svg[hidden]{display:none}` antes do marcador de Layout. No navegador, a 1280 e a 360 px, `getComputedStyle(svg).display` é `none` com o mapa real ativo.
- **CSP (CA9):** no build ESM do Leaflet, `emptyImageUrl` é `const` interna, então mudar `L.Util` não funciona. `mapa-real.js` ganhou `tileLayerSemDataUri` (subclasse de `L.TileLayer` que sobrescreve `_abortLoading`, `_removeTile` e `_tileReady`) usando o novo `public/img/vazio.gif` (GIF 1x1 transparente, `IMAGEM_VAZIA`). `img-src` sem `data:`. Zoom +/−, itens da lista e pino: 0 erros no console.
- **Testes:** fakes de SVG modelam o atributo; 3 casos novos de descarte/abort de tile com o GIF próprio; HTTP confere a regra de CSS, `/img/vazio.gif` servido e CSP sem `data:` no `img-src`.
- Pendente manual: tiles reais do OSM e conferência visual dos 11 pinos (precisa de internet); CA13 só por teste de cliente.

## QA (3ª rodada, após a volta 2) — APROVADO
Veredito em `docs/qa/024-mapa-real.md`. Etapas Cleaner e Hardener não foram repetidas após a volta 2 (decisão do usuário: ir direto ao QA).
- **CA4/CA14:** `display` calculado do SVG é `none` com o mapa real, a 1280, 1241, 1000 e 360 px.
- **CA9:** 0 erros de console/CSP a 1280 e 360 px (tiles do OSM simulados): 3 itens da lista, zoom +/−, clique em pino; a URL muda sem recarregar.
- **CA13:** com `reducedMotion=reduce` não sobra animação nem transform.
- **CA3:** header de 71 px a 1241, 1000 e 360 px; `aria-current` em "Mapa".
- **360 px e sem JS:** `scrollWidth` 360; sem JS o esquema SVG aparece.
- **Regressão:** `/`, `/grupos?zona=sul`, `/grupos/pace-da-oca`, `/mapa/pace-da-oca` 200. `npm test` 937/937 (58 arquivos), lint e prettier ok; migration 008 reexecutável; seed 0 de 11 novos.
- **Pendente manual (internet):** tiles reais do OSM e conferência visual dos 11 pinos.
