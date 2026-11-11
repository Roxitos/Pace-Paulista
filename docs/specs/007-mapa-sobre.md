# 007 — Mapa esquemático `/mapa` e `/mapa/:slug` sem JS, e `/sobre`
Marco: M3 · Status: pronta para Coder (P8–P10 respondidas em 2026-11-11: defaults aceitos; ver "Respostas" no fim)
Depende de: 004-leitura-banco-home-zonas
Ordem no M3: 004 → 005 → 006 → **007** (última do M3)

## Objetivo
Reproduzir `PageMapa` + `renderMapDetail` (prototipo.html linhas 779–830) no servidor: o grupo selecionado vem da URL (`/mapa/:slug`), pins e lista são links, e o painel de detalhe sai pronto no HTML — funciona sem JS. E publicar `/sobre` (`PageSobre`, linhas 968–981) com o "Status" atualizado.

## Fora do escopo
- Seleção sem recarregar a página (JS do M7, `public/js/mapa.js`); scroll suave até o detalhe no mobile via JS.
- Mapa real (Leaflet/OSM): fora da v1.
- Mudanças em header/rodapé (o rodapé já não diz "Nenhum dado é enviado a servidores" — AGENTS §9 atendido desde a 001).

## Mudanças

### Banco
Nenhuma migration.

### Domínio — `src/domain/map.js` (novo, puro)
- `ZPOLY`, `ZLABEL`, `ZCENTRO`: **copiados literalmente** das linhas 780–788.
- `pinPos(group): [number, number]` — porta da linha 811: se `group.map_pin` for array de 2 inteiros, devolve-o; senão calcula pela zona com o hash do protótipo sobre `group.slug` (no protótipo, `g.id` era o slug): `h = (h*31 + charCode) % 997`; `[cx + (h%40) - 20, cy + ((h>>3)%30) - 15]`.
- `gmapsBusca(location): string` → `'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(location + ', São Paulo, SP')` (linha 549).
- `gmapsRota(location): string` → `'https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent(location + ', São Paulo, SP')` (linha 550).

### Serviço — `src/modules/pages/pages.service.js`
- `getMapData(groups, selectedSlug)` (pura) → `{ groups: [...grupos com pin: pinPos(g)], selected }`, onde `selected` = grupo com `slug === selectedSlug`; sem `selectedSlug` → o **primeiro** da lista (ordem padrão da 004: Cantareira Trail; ver **P9**); lista vazia → `selected = null`.
- `loadMapData(selectedSlug)` → busca `listPublishedGroups()`; se `selectedSlug` foi dado e não existe entre os publicados → devolve `null` (a rota responde 404; ver **P8**).

### Rotas — `src/modules/pages/pages.routes.js`
| Método | Caminho | Auth | Resultado |
|---|---|---|---|
| GET | `/mapa` | — | 200, `renderPage('mapa', { title: 'Mapa e rotas · Pace Paulista', ...await loadMapData() })` |
| GET | `/mapa/:slug` | — | `slug` fora de `^[a-z0-9-]{1,60}$` → 404 sem consultar o banco; slug não publicado → 404 (P8); senão 200 com o grupo pré-selecionado |
| GET | `/sobre` | — | 200, `renderPage('sobre', { title: 'Sobre · Pace Paulista' })` (sem banco) |

### View — `src/views/pages/mapa.ejs` (nova)
`page-head` com kicker "Mapa e rotas", título "Pontos de encontro", texto "Selecione um grupo para ver onde ele se encontra e abrir a rota até lá no Google Maps." Depois, o HTML do protótipo com estas trocas:
| protótipo | aqui |
|---|---|
| polígonos, rótulos (`ZONAS[z].nome.toUpperCase()`, `font-size` 11 no centro e 13 nas demais) e as 2 linhas tracejadas | idênticos, a partir de `ZPOLY`/`ZLABEL` |
| `<g class="pin" tabindex="0" role="button" data-act="map-select" …>` | `<a class="pin" href="/mapa/<slug>#mapDetail" aria-label="<name>, <location>" data-act="map-select" data-id="<slug>" transform="translate(x y)">` com os mesmos 2 `circle` (`ring` `r` 14/0, `dot` `r` 8/6 conforme seleção). Link SVG nativo: focável e acionável por teclado sem `tabindex`/`role` |
| `<div class="map-list" role="list">` + `<button class="map-item" role="listitem" … aria-current>` | `<ul class="map-list">` + `<li><a class="map-item" href="/mapa/<slug>#mapDetail" style="<%= zstyle %>" data-act="map-select" data-id="<slug>" aria-current="<true\|false>">…</a></li>` (mesmo conteúdo: `.dotz`, `<b>nome</b><small>local</small>`, dias curtos) — link não pode ter `role="listitem"` sem perder o papel de link |
| `#mapDetail` preenchido por JS | `<div id="mapDetail" class="map-detail">` já com o painel do `selected` (linhas 814–823): `card-top` com `zone-chip` + `demo-tag` (regra da 004), `h2`, `dl.spec` (Local, Encontro = `meeting_point`, Quando = `fmtDiasCurto · fmtHora`, Pace), botões "Traçar rota" (`gmapsRota`) e "Abrir no Maps" (`gmapsBusca`) com `target="_blank" rel="noopener"`, e "Ver detalhes do grupo" → `/grupos/<slug>`. Sem `selected` → `#mapDetail` vazio |
| `.map-note` | literal: "Esquema ilustrativo das zonas, não um mapa real. As posições indicam apenas a zona do grupo. O endereço e a rota abrem no Google Maps. Mapa interativo previsto para a próxima versão." |
- Os links internos do mapa levam a `#mapDetail` para que, em telas estreitas (detalhe abaixo do mapa), o navegador role até o painel sem JS — substitui o `scrollIntoView` do protótipo.
- Todos os dados do banco com `<%= %>`; as URLs do Google Maps também (`&` vira `&amp;` no atributo, o que é correto).

### CSS — `public/css/app.css` (só acréscimos)
```css
ul.map-list{list-style:none;margin:0;padding:0 4px 0 0}
a.map-item{text-decoration:none}
```

### View — `src/views/pages/sobre.ejs` (nova)
Literal de `PageSobre` (`page-head` "Sobre" / "O que é o Pace Paulista" / texto; painel "A ideia" com os 2 parágrafos e o botão "Explorar grupos" → `/grupos`; painel de status; nota final "Todos os grupos de demonstração são fictícios. Os locais citados são espaços públicos reais da cidade."), com a lista de status do **default de P10**:
| selo | texto |
|---|---|
| ATIVO | Busca com filtros, cards, páginas de detalhes, zonas, cálculo de compatibilidade, cadastro e entrada em grupos. |
| ATIVO | Banco de dados compartilhado para todos verem os mesmos grupos. |
| PENDENTE | Login e conta de usuário. |
| PENDENTE | Mapa interativo com coordenadas reais dos pontos de encontro. |
| PENDENTE | Notificações e confirmação de presença por encontro. |
(Removido: "Dados salvos no seu navegador (…)". Trocado: "(Supabase)" sai do item do banco. "Login" vira ATIVO na spec do M5, conforme AGENTS §5.)
- `currentNav('/sobre')` já marca "Sobre" no header.

## Regras e mensagens
| Elemento | Regra | Texto/valor exato |
|---|---|---|
| `/mapa` seleção padrão | 1º da ordem padrão (P9) | Cantareira Trail: `aria-current="true"` no item da lista; pin `translate(188 56)` com `r="14"` e `r="8"` |
| `/mapa/pace-da-oca` | pré-seleciona | pin `translate(200 246)` com `r="14"`/`r="8"`; demais pins `r="0"`/`r="6"` |
| Traçar rota | `gmapsRota(location)` | pace-da-oca: `https://www.google.com/maps/dir/?api=1&amp;destination=Parque%20Ibirapuera%2C%20S%C3%A3o%20Paulo%2C%20SP` |
| Abrir no Maps | `gmapsBusca(location)` | `https://www.google.com/maps/search/?api=1&amp;query=Parque%20Ibirapuera%2C%20S%C3%A3o%20Paulo%2C%20SP` |
| Pin sem `map_pin` | `pinPos` | `{slug:'abc', zone:'sul', map_pin:null}` → `[177, 305]` |
| Rótulos do mapa | `nome.toUpperCase()` | "ZONA NORTE", …, "CENTRO" (`font-size="11"`) |
| `/mapa/<slug inexistente>` | P8 | 404 "Página não encontrada" / "Esse endereço não existe." |

## Critérios de aceite
- [ ] CA1 — `GET /mapa` → 200, título "Mapa e rotas · Pace Paulista", 5 polígonos e 5 rótulos de zona, 11 `class="pin"` e 11 `class="map-item"` na ordem padrão, exatamente 1 `aria-current="true"` (Cantareira Trail) e o painel `#mapDetail` com "Cantareira Trail", Local, Encontro, Quando "Dom · 7h", Pace "6:30–8:00 min/km".
- [ ] CA2 — `GET /mapa/pace-da-oca` → 200 com Pace da Oca selecionado (lista, pin e painel), links do Google Maps da tabela com `target="_blank" rel="noopener"` e "Ver detalhes do grupo" → `/grupos/pace-da-oca`.
- [ ] CA3 — **Sem JS**: clicar num pin ou num item da lista navega para `/mapa/<slug>#mapDetail` e mostra aquele grupo selecionado; pins são alcançáveis por Tab e acionáveis por Enter (links SVG).
- [ ] CA4 — `GET /mapa/nao-existe`, `/mapa/ABC` e grupo `pending` → 404.
- [ ] CA5 — Com nenhum grupo publicado, `GET /mapa` → 200 com o mapa das zonas, sem pins, lista vazia e `#mapDetail` vazio (sem erro — o protótipo quebrava aqui).
- [ ] CA6 — `pinPos` usa `map_pin` quando existe e o hash do protótipo quando é NULL (valor da tabela).
- [ ] CA7 — `GET /sobre` → 200, título "Sobre · Pace Paulista", `aria-current="page"` em "Sobre", textos literais do protótipo, a lista de status do default de P10 (2 ATIVO, 3 PENDENTE), sem "Supabase" e sem "navegador".
- [ ] CA8 — Nome e local com `<script>` aparecem escapados no `aria-label` do pin, na lista e no painel.
- [ ] CA9 — Responsivo em 360 px: `.map-layout` em uma coluna, SVG do mapa com largura total sem scroll horizontal, itens da lista sem estourar com nome longo; `/sobre` sem scroll horizontal.
- [ ] CA10 — Nada de SQL fora de `*.repo.js` (o mapa usa `listPublishedGroups` da 004); `npm test` e `npm run lint` passam.

## Testes esperados
- unit (`tests/domain/map.test.js`, novo): `ZPOLY`/`ZLABEL`/`ZCENTRO` iguais ao protótipo; `pinPos` com `map_pin` → o próprio; `{slug:'abc', zone:'sul', map_pin:null}` → `[177, 305]`; `map_pin` inválido (`[1]`, `null`) → cálculo pela zona; `gmapsRota('Parque Ibirapuera')` e `gmapsBusca('Parque Ibirapuera')` → URLs da tabela (sem `&amp;`); local com `&` e `#` fica codificado.
- unit (`tests/domain/pages-service.test.js`): `getMapData` — sem slug seleciona o 1º; com slug seleciona aquele; lista vazia → `selected: null`; cada grupo ganha `pin`.
- http (`tests/http/mapa.test.js`, novo, com `seedDemo`): CA1, CA2, CA4, CA5 (após `truncateAll`), CA8 (grupo inserido no teste); nenhum `href="#` (os links internos são `/mapa/<slug>#mapDetail`); nenhum `role="button"` nos pins.
- http (`tests/http/sobre.test.js`, novo): CA7.

## Riscos / perguntas em aberto
### Perguntas em aberto
- **P8** — `/mapa/<slug inexistente>`: o protótipo ignorava o slug e mostrava o grupo padrão. **Default desta spec**: 404 (endereço que não existe não responde 200). Confirmar ou manter o comportamento do protótipo.
- **P9** — Grupo selecionado em `/mapa` sem slug: o protótipo selecionava o 1º do array `DEMO` (Correria do Carmo); com a ordenação padrão do AGENTS §6 o 1º é Cantareira Trail. **Default**: 1º da ordem padrão. Preferem fixar outro (ex.: 1º de `DESTAQUES`)?
- **P10** — Texto do "Status do protótipo" em `/sobre` no M3. O AGENTS §5 diz "banco e login viram ATIVO", mas login só existe no M5, e compatibilidade/cadastro/entrada (citados no 1º item ATIVO) só no M4/M6. **Default**: tabela acima (banco ATIVO sem "(Supabase)", item do navegador removido, login PENDENTE até o M5, 1º item literal). Confirmar os textos e se o título "Status do protótipo" continua assim.

### Riscos / decisões técnicas
- Links dentro do `<svg>` (`<a href>` SVG 2) funcionam em todos os navegadores atuais; o estilo `.pin` existente vale para `a.pin` (seletor de classe), incluindo `:focus-visible`.
- Até o M7, selecionar outro grupo no mapa recarrega a página (custo: uma consulta de lista por clique). Aceitável para o tamanho do dataset.
- `inline style` (`style="--z:…"`, `font-size`) continua no HTML como no protótipo; a CSP do M8 já registra essa pendência.
- Após esta spec, o orquestrador pode marcar no `PENDENCIAS.md` (M8) que nenhum link da home leva mais a 404 **exceto** `/encontrar` (M4), `/grupos/novo`, `/meus` e `/conta/entrar` (M5/M6).

### Respostas (2026-11-11)
- **P8, P9, P10**: defaults aceitos (título "Status do protótipo" mantido).
