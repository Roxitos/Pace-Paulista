# 024 — Mapa real (ruas, OpenStreetMap) na aba "Mapa"
Marco: M11 — Mapa real (pedido do usuário em 2026-11-25; **antes do M10**) · Status: **pronta para Coder** (OK do usuário em 2026-11-25: P1–P7 com as propostas)
Depende de: 007 (mapa esquemático), 018 (mapa sem recarregar), 019 (CSP)
Próxima: 025 — ponto no mapa no cadastro de grupo (ver "Fora do escopo")

Decisões do usuário em 2026-11-25 (não reabrir): o mapa deixa de ser o esquema das zonas e passa a ser **um mapa de verdade, "estilo Google Maps"**: visão de cima, ruas, zoom e arraste, com o **ponto de encontro** de cada grupo. **Sem Street View.** Vira uma **aba no menu principal**. Entra **antes do M10** (recuperar senha). Isso tira "Mapa real (Leaflet/OSM)" da lista "Fora do escopo" do AGENTS §1.

## Objetivo
1. `/mapa` mostra os grupos publicados num mapa geográfico de São Paulo (Leaflet + tiles do OpenStreetMap), um pino por grupo na cor da zona; tocar num pino ou num item da lista seleciona o grupo, centraliza o mapa nele e mostra o painel de detalhe (o mesmo de hoje).
2. "Mapa" vira aba do menu principal.
3. Os 11 grupos demo ganham coordenadas reais do ponto de encontro.

## Fora do escopo
- **Marcar o ponto no cadastro de grupo** (`/grupos/novo`): spec **025**. Até lá, grupo real novo fica sem coordenadas (aparece na lista, não no mapa — ver CA6).
- Street View, camadas de satélite/relevo, rota desenhada no próprio mapa (a rota continua abrindo no Google Maps).
- "Minha localização" / geolocalização do visitante.
- Busca de endereço (geocodificação) e qualquer chamada do **servidor** a serviço de mapas.
- Filtros de zona/dia/pace no mapa (a lista mostra todos os publicados, como hoje).
- Mini-mapa na página do grupo (`/grupos/:slug`) — pode virar spec depois (P7).
- Contornos geográficos reais das zonas.
- Remover `map_pin`, `pinPos`, `ZPOLY`/`ZLABEL`/`ZCENTRO`: continuam servindo o esquema **sem JS** (P2).

## Mudanças

### Banco — nova migration `db/migrations/008_groups_lat_lng.sql`
Numeração: o mapa entra antes do M10, então usa a **008**; `password_resets` do M10 passa para a **009** (a 008 do M10 era só proposta no AGENTS, sem arquivo). Compatível com o código antigo durante o build (só adiciona colunas anuláveis e preenche demos).

```sql
-- Mapa real (spec 024): ponto de encontro em graus decimais (WGS 84). NULL = grupo sem ponto no mapa.
ALTER TABLE groups
  ADD COLUMN lat DOUBLE PRECISION,
  ADD COLUMN lng DOUBLE PRECISION,
  -- Os dois juntos ou nenhum.
  ADD CONSTRAINT groups_lat_lng_pair_check CHECK ((lat IS NULL) = (lng IS NULL)),
  -- Caixa do município de São Paulo, com folga: pega lat/lng trocados e sinal esquecido.
  ADD CONSTRAINT groups_lat_lng_sp_check CHECK (
    lat IS NULL OR (lat BETWEEN -24.05 AND -23.30 AND lng BETWEEN -46.85 AND -46.35)
  );

-- Grupos demo já gravados em produção (o seed é ON CONFLICT DO NOTHING e não os atualiza).
-- Num banco novo, nada casa aqui: o seed insere os demos já com lat/lng.
UPDATE groups AS g SET lat = v.lat, lng = v.lng
FROM (VALUES
  ('correria-do-carmo',   -23.5790, -46.4740),
  ('tiete-em-movimento',  -23.4890, -46.5190),
  ('pelotao-paulista',    -23.5614, -46.6559),
  ('minhocao-noturno',    -23.5374, -46.6527),
  ('pace-da-oca',         -23.5858, -46.6556),
  ('primeiro-km-ibira',   -23.5880, -46.6620),
  ('represa-run-club',    -23.7100, -46.7260),
  ('villa-lobos-runners', -23.5466, -46.7238),
  ('raia-usp',            -23.5565, -46.7210),
  ('cantareira-trail',    -23.4600, -46.6355),
  ('juventude-em-pace',   -23.5051, -46.6248)
) AS v(slug, lat, lng)
WHERE g.slug = v.slug AND g.is_demo AND g.lat IS NULL;
```
⚠️ Coordenadas **aproximadas** (de memória; a geocodificação não pôde ser feita deste ambiente). Ver **P1**: o usuário confere cada uma no openstreetmap.org antes do OK; o Coder copia os valores finais para a migration e para o seed.

### Seed — `db/seeds/demo-groups.js` e `scripts/seed.js`
- Cada grupo de `DEMO_GROUPS` ganha `lat` e `lng` (mesmos valores da migration).
- `INSERT_GROUP` inclui `lat, lng` (`$18, $19`). Continua `ON CONFLICT (slug) DO NOTHING`.

### Repo — `src/modules/groups/groups.repo.js`
- As listagens de publicados (`listPublished`/`SELECT_LIST`) e `findPublishedBySlug` passam a devolver `lat` e `lng` (`DOUBLE PRECISION` chega como `number` no `pg`; `NULL` → `null`).

### Domínio — `src/domain/map.js`
- `SP_CENTRO = [-23.5505, -46.6333]` e `SP_ZOOM = 11` (vista inicial sem seleção/sem pinos).
- `hasCoords(group): boolean` — `true` só se `lat` e `lng` forem números finitos.
- `gmapsBusca(group)` e `gmapsRota(group)` passam a receber o **grupo**: com `hasCoords` → `query`/`destination` = `"<lat>,<lng>"` (ponto exato); sem → comportamento atual com `location + ', São Paulo, SP'`. Atualizar a única view que usa (`partials/map-detail.ejs`).

### Serviço — `src/modules/pages/pages.service.js`
- `toMapGroup` mantém `pin` (esquema sem JS) e repassa `lat`/`lng`; `contact` continua removido.
- Sem mudança em `getMapData`/`loadMapData`/`loadMapPanel` além disso.

### Leaflet (dependência nova, justificar no PR)
- `leaflet@1.9.4` (versão exata, `dependencies`). Por quê: único jeito razoável de mapa com ruas, zoom e arraste sem chave de API; ~40 kB gzip; sem build; licença BSD-2. Alternativas descartadas: Google Maps JS API (chave, cobrança, CSP ampla), MapLibre (pesado, precisa de tiles vetoriais/servidor de estilo).
- Servido **do próprio site** (CSP `script-src 'self'` continua igual): em `app.js`, antes do `express.static` de `public/`, `app.use('/vendor/leaflet', express.static(<node_modules/leaflet/dist>, { immutable: true, maxAge: '1y' }))`. Resolver o caminho com `createRequire(import.meta.url).resolve('leaflet/package.json')`, não com caminho fixo. Nada é copiado para `public/` nem commitado.
- Só a página `/mapa` carrega `/vendor/leaflet/leaflet.css` e o módulo `/vendor/leaflet/leaflet-src.esm.js` (importado pelo `public/js/mapa.js`).

### Tiles e CSP — `src/middlewares/securityHeaders.js`
- Tiles: `https://tile.openstreetmap.org/{z}/{x}/{y}.png`, `maxZoom: 19`, atribuição obrigatória `© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>` (controle de atribuição do Leaflet, sempre visível). Ver **P3** (política de uso do OSM).
- CSP: `img-src` passa a `["'self'", 'https://tile.openstreetmap.org']`. **Nada mais muda** (Leaflet posiciona via `element.style`, que a CSP não bloqueia; ícones são `divIcon`, sem imagens externas; o CSS vem de `'self'`).
- Referer: o site manda `Referrer-Policy: same-origin` e o OSM exige Referer nos tiles. Resolver **só nos tiles** com a opção `referrerPolicy: 'strict-origin-when-cross-origin'` do `L.tileLayer` (envia só a origem `https://pace-paulista.onrender.com/`). O cabeçalho global não muda.

### Rotas
Sem rota nova. `/mapa`, `/mapa/:slug` e `/api/mapa/:slug` seguem as specs 007/018 (404, regex de slug, `no-store`).
- `renderMap` passa `styles: ['leaflet']`, espelhando o `scripts` que já existe: `locals.js` ganha o default `styles: []` e o `layout.ejs`, logo depois do `app.css`, um `<link rel="stylesheet" href="/vendor/<%= name %>/<%= name %>.css">` por item (nomes fixos do servidor, nunca da requisição).

### Menu — `partials/header.ejs` e `views/helpers.js`
- Novo item entre "Explorar zonas" e "Sobre": `<a href="/mapa" data-nav="mapa">Mapa</a>` (com `aria-current="page"` quando ativo; também aparece no menu mobile, que reaproveita o mesmo `<nav>`).
- `currentNav`: `/mapa` e `/mapa/...` → `'mapa'`.
- Rodapé: o link "Mapa de encontros" continua.

### View — `src/views/pages/mapa.ejs`
- `page-head`: kicker "Mapa", título "Pontos de encontro", texto "Veja onde cada grupo se encontra. Toque num pino ou na lista para ver os detalhes e abrir a rota no Google Maps."
- `.map-box` ganha `<div id="mapReal" class="map-real" hidden role="region" aria-label="Mapa de São Paulo com os pontos de encontro dos grupos"></div>` **antes** do SVG atual. O SVG esquemático e seus pinos-links ficam como estão (fallback sem JS).
- Cada `a.map-item` da lista ganha `data-lat`/`data-lng` quando o grupo tem coordenadas (valores numéricos do banco, com `<%= %>`). Grupo sem coordenadas: sem esses atributos e, dentro do item, `<small class="map-nopin">Sem ponto no mapa</small>` (P4).
- `.map-note` (texto novo, único para os dois modos): "Os pinos mostram o ponto de encontro aproximado de cada grupo; confirme o local exato no grupo. A rota abre no Google Maps. Sem JavaScript, o mapa aparece como esquema das zonas."

### JS do cliente — `public/js/mapa.js`
Mantém tudo da spec 018 (seleção sem recarregar, cache, `AbortController`, `replaceState`, fallback `location.assign`). Acrescenta:
1. `import * as L from '/vendor/leaflet/leaflet-src.esm.js'`. Se o import ou a criação do mapa falhar (ex.: tiles bloqueados não contam — só erro de JS), nada muda: o esquema continua (envolver a montagem em `try/catch`; o módulo de seleção da 018 funciona igual).
2. Montagem: mostra `#mapReal` (`hidden = false`), esconde o `<svg>` (`hidden`), cria o mapa com `scrollWheelZoom: false` (rolar a página não dá zoom sem querer; zoom por botões, pinça e duplo clique), tile layer acima, e **um marcador por item com `data-lat`/`data-lng`** (`L.marker([lat,lng], { icon: L.divIcon({...}), keyboard: false, title: nome })`). Coordenadas lidas com `Number(...)`, descartando não finitas.
3. Ícone: `divIcon` com `className: 'map-pin'` e um `<span>` com `style="--z:<cor>"` lida do `style` do próprio item da lista (já vem do `zstyle`); **sem `innerHTML` com texto do banco** — nome só via opção `title` (atributo) e `aria`. Selecionado: classe `is-selected` (pino maior + anel, mesmo espírito do esquema).
4. Vista inicial: com item selecionado que tem coordenadas → `setView([lat,lng], 15)`; senão, `fitBounds` de todos os marcadores com `padding` e `maxZoom: 15`; sem marcadores → `SP_CENTRO`/`SP_ZOOM` (valores duplicados no cliente como constantes, comentados como cópia do `domain/map.js`).
5. Clique no marcador → mesma `select(slug, '/mapa/<slug>#mapDetail')` da lista. Seleção (por pino ou lista) com coordenadas → `flyTo([lat,lng], max(zoomAtual, 15))`; com `prefers-reduced-motion: reduce` → `setView` sem animação. Sem coordenadas → o mapa não se move.
6. Teclado: marcadores **fora do Tab** (`keyboard: false`); a lista é o caminho acessível (cada item já é link focável). O contêiner do mapa continua com o teclado do Leaflet (setas/+/−) — ver P5.

### CSS — `public/css/app.css` (só acréscimos, comentados com "spec 024")
- `.map-real{height:clamp(320px,60vh,560px);border-radius:calc(var(--r) - 4px);overflow:hidden;z-index:0}` (o `z-index` impede os painéis do Leaflet de cobrir o cabeçalho/menu mobile).
- `.map-pin span` (ponto 16 px na `--z`, borda 3 px `var(--surface)`, sombra leve) e `.map-pin.is-selected span` (22 px + anel tracejado na `--z`); foco/hover coerentes com o tema; respeitar dark mode (tiles ficam claros — aceito, P6).
- `.map-nopin{display:block;font-size:12px;color:var(--muted)}`.

## Regras e mensagens
| Onde | Regra | Texto exato |
|---|---|---|
| Menu | item novo, entre "Explorar zonas" e "Sobre" | "Mapa" |
| `page-head` | kicker / título / texto | "Mapa" / "Pontos de encontro" / "Veja onde cada grupo se encontra. Toque num pino ou na lista para ver os detalhes e abrir a rota no Google Maps." |
| Contêiner do mapa | `aria-label` | "Mapa de São Paulo com os pontos de encontro dos grupos" |
| Item da lista sem coordenadas | aviso | "Sem ponto no mapa" |
| `.map-note` | texto | "Os pinos mostram o ponto de encontro aproximado de cada grupo; confirme o local exato no grupo. A rota abre no Google Maps. Sem JavaScript, o mapa aparece como esquema das zonas." |
| Atribuição (Leaflet) | sempre visível | "© OpenStreetMap" com link para `https://www.openstreetmap.org/copyright` |
| Banco | `lat`/`lng` juntos; dentro da caixa de SP | (CHECK; sem mensagem de UI nesta spec — o form vem na 025) |

## Critérios de aceite
- [ ] CA1 — Migration 008 aplica num banco com os demos já gravados e preenche `lat`/`lng` dos 11; num banco vazio aplica sem erro e o seed em seguida insere os 11 já com coordenadas. Rodar de novo o seed não muda nada.
- [ ] CA2 — O banco recusa só `lat` sem `lng` (e vice-versa) e coordenadas fora da caixa de SP (ex.: `lat = -46.6, lng = -23.5`, trocadas) com erro de CHECK.
- [ ] CA3 — O menu principal tem "Mapa" → `/mapa`, com `aria-current="page"` em `/mapa` e em `/mapa/<slug>`; nas demais páginas, sem `aria-current` nele. Aparece também no menu mobile. A 1241 px (menor largura com menu aberto) o cabeçalho não quebra linha.
- [ ] CA4 — Com JS: `/mapa` mostra o mapa com ruas (tiles do OSM), um pino na cor da zona para cada grupo com coordenadas, atribuição do OSM visível, e o esquema SVG escondido. Arrastar e dar zoom (botões, pinça, duplo clique) funcionam; a roda do mouse **não** dá zoom.
- [ ] CA5 — Com JS: clicar num pino ou num item da lista seleciona o grupo sem recarregar (comportamento da 018: painel, `aria-current` na lista, URL `/mapa/<slug>`), destaca o pino e centraliza o mapa nele (zoom ≥ 15). `/mapa/<slug>` abre já centrado no grupo; `/mapa` sem slug enquadra todos os pinos.
- [ ] CA6 — Grupo publicado **sem** coordenadas: aparece na lista com "Sem ponto no mapa", não tem pino, e selecioná-lo mostra o painel sem mover o mapa. A página não quebra se **nenhum** grupo tiver coordenadas (mapa no centro de SP, zoom 11).
- [ ] CA7 — "Traçar rota" e "Abrir no Maps" usam `lat,lng` quando o grupo tem coordenadas e o texto do local quando não tem.
- [ ] CA8 — Sem JS: `/mapa` e `/mapa/<slug>` funcionam exatamente como na 007 (esquema SVG, pinos e lista como links, painel pronto do servidor); o `#mapReal` fica `hidden`. Testes HTTP da 007/018 continuam passando (ajustados só onde o texto mudou).
- [ ] CA9 — CSP: o único acréscimo é `https://tile.openstreetmap.org` em `img-src`; `script-src` continua `'self'`; nenhum `<script>` inline novo. Console do navegador sem erro de CSP em `/mapa`.
- [ ] CA10 — Os pedidos de tile saem com `Referer: https://<host>/` (só a origem); o resto do site continua com `Referrer-Policy: same-origin`.
- [ ] CA11 — `/vendor/leaflet/leaflet-src.esm.js` e `/vendor/leaflet/leaflet.css` respondem 200 com os cabeçalhos de segurança e cache longo; `/vendor/leaflet/../package.json` (e variações codificadas) **não** serve arquivo fora de `dist/`.
- [ ] CA12 — Nenhum dado do banco entra em HTML do cliente por `innerHTML`/`<%- %>`; `contact` continua fora de `/mapa`, dos `data-*` e de `/api/mapa/:slug`.
- [ ] CA13 — Com `prefers-reduced-motion: reduce`, a seleção não anima (`setView`).
- [ ] CA14 — Responsivo em 360 px: mapa ocupa a largura sem scroll horizontal, controles de zoom tocáveis, painel e lista abaixo (layout de 1 coluna da 007). Dark mode sem texto ilegível nos pinos/atribuição.
- [ ] CA15 — Nada de SQL fora de `*.repo.js`; `npm test` e `npm run lint` passam.

## Testes esperados
- db: migration 008 — preenche os demos já existentes; CHECKs do par e da caixa de SP (CA1, CA2); seed insere com `lat`/`lng` e continua idempotente.
- unit (`tests/domain/map.test.js`): `hasCoords` (número, `null`, `NaN`); `gmapsRota`/`gmapsBusca` com e sem coordenadas (CA7). `currentNav('/mapa')` e `('/mapa/pace-da-oca')` → `'mapa'` (CA3). `demo-groups.test.js`: os 11 têm `lat`/`lng` dentro da caixa de SP.
- unit (`pages-service.test.js`): `getMapData` repassa `lat`/`lng` e continua sem `contact`.
- http (`mapa.test.js`): `/mapa` tem `#mapReal[hidden]`, o SVG, `data-lat`/`data-lng` nos itens com coordenadas e "Sem ponto no mapa" num grupo sem (CA6, CA8); `<link>` do `leaflet.css`; CSP com `img-src 'self' https://tile.openstreetmap.org` (CA9); header com "Mapa" e `aria-current` (CA3).
- http (`seguranca.test.js` ou novo): `/vendor/leaflet/...` 200 + cache; tentativa de sair de `dist/` → 404 (CA11).
- client (`tests/client/mapa.test.js`, com Leaflet falso injetado/mocado): monta marcadores só para itens com coordenadas válidas; clique no marcador chama a seleção da 018; seleção chama `flyTo` (ou `setView` com reduced motion); falha ao importar o Leaflet mantém o SVG visível (CA4, CA5, CA13).
- manual (QA, navegador real com rede liberada para `tile.openstreetmap.org`): CA4, CA5, CA10, CA14 e conferência visual dos 11 pinos sobre os locais certos.

## Riscos / perguntas em aberto
- **P1 — Coordenadas dos demos.** Os 11 valores acima são aproximações (não deu para geocodificar daqui). **Proposta:** antes do OK, você confere cada um no openstreetmap.org (clique com o botão direito → "Mostrar endereço" dá lat/lng) e me passa as correções; o resto segue. Pontos de encontro: usei a entrada principal/ponto citado no `meeting_point` (ex.: a Oca para "Pace da Oca"; portão 3 do Ibirapuera para "Primeiro Km Ibira" ficou num ponto genérico do parque).
- **P2 — Sem JS.** **Proposta:** manter o esquema SVG atual como fallback (zero código novo, testes da 007 seguem). Alternativa: sem JS, só lista + painel + aviso "Ative o JavaScript para ver o mapa".
- **P3 — Tiles do OSM.** O servidor oficial `tile.openstreetmap.org` é gratuito, sem chave, mas a política de uso proíbe "uso pesado" e exige atribuição e Referer. Para o tráfego atual é aceitável. **Proposta:** usar o OSM agora e registrar em PENDENCIAS a troca por um provedor com chave grátis (ex.: MapTiler/Stadia) se o tráfego crescer. Alternativa já agora: CARTO "Voyager" (visual mais limpo, também sem chave, uso grátis limitado a projetos não comerciais).
- **P4 — Grupos reais sem ponto (até a 025).** **Proposta:** listar com "Sem ponto no mapa", sem pino. Alternativa: pino aproximado no "centro" da zona (pode enganar quem vai ao local).
- **P5 — Acessibilidade dos pinos.** **Proposta:** pinos fora do Tab (`keyboard: false`); a lista ao lado é o caminho por teclado/leitor de tela (11+ paradas de Tab no mapa repetiriam a lista). Alternativa: pinos focáveis com `aria-label`.
- **P6 — Dark mode.** Os tiles do OSM são sempre claros. **Proposta:** aceitar (filtro CSS de inversão deixa ruas/rótulos estranhos). Alternativa: escurecer com `filter` só no dark mode.
- **P7 — Privacidade (LGPD).** Ao abrir `/mapa`, o navegador do visitante busca tiles no OSM (o OSM vê IP e a área vista). **Proposta:** mencionar no `/sobre` numa frase ("O mapa usa o OpenStreetMap; ao abri-lo, seu navegador carrega as imagens do mapa de lá.") — confirma o texto? Mini-mapa no detalhe do grupo fica para depois.
- Risco: neste ambiente de desenvolvimento os tiles podem estar bloqueados pela rede; testes automáticos não dependem deles (Leaflet mocado no teste de cliente, HTML/CSP nos testes HTTP). A conferência visual é manual (QA) em navegador com internet.
- Risco: `leaflet@1.9.4` — conferir no `npm view leaflet` se há 1.9.x mais nova sem mudança de API; **não** usar 2.x (API diferente, ESM-only) sem nova spec.
- Docs a atualizar no mesmo PR (orquestrador/Coder): AGENTS §1 (mapa real sai do "Fora do escopo"; fase atual), §3 (`008_groups_lat_lng.sql`, próxima livre 009), §4 (colunas `lat`/`lng`; `password_resets` vira 009), §5 (menu "Mapa"), §8 (mapa esquemático vira fallback sem JS), §9 (CSP `img-src` com OSM), §12; `docs/MILESTONES.md` (M11) e `.env.example`/`render.yaml` (nada muda — sem env novo).

## Respostas (2026-11-25)
OK do usuário a todas as propostas (P1–P7). P1: o usuário não enviou correções; ficam os valores aproximados desta spec, e a conferência visual dos 11 pinos fica para o QA (navegador com internet). Se algum ponto estiver errado, corrige-se com nova migration (a 008 é imutável depois do commit). P7: o texto proposto para o `/sobre` está aprovado: "O mapa usa o OpenStreetMap; ao abri-lo, seu navegador carrega as imagens do mapa de lá."
