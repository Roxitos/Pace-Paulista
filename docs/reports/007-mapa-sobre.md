# Relatório — 007 Mapa `/mapa`, `/mapa/:slug` e `/sobre`
Marco: M3 · Spec: [`docs/specs/007-mapa-sobre.md`](../specs/007-mapa-sobre.md) · QA: [`docs/qa/007-mapa-sobre.md`](../qa/007-mapa-sobre.md)
Branch: `feat/m3-detalhe-mapa-sobre` (sem commit ainda) · Data: 2026-11-11

## Linha do tempo
| Etapa | Resultado |
|---|---|
| Specifier | Spec escrita junto com 004/005/006 (branch `claude/specs-006-007`, trazida por cherry-pick); P8–P10 respondidas pelo usuário em 2026-11-11 (defaults) |
| Coder | Implementado; CA1–CA10 cobertos (CA3 e CA9 também no Chrome headless); 512 testes (27 arquivos), lint ok |
| Cleaner | 4 limpezas pequenas (`inSaoPaulo`, `selectedSlug` na view, helper `selectedItems`, asserção redundante); sem mudança de comportamento |
| Hardener | 1 problema baixo corrigido (`map_pin` fora do viewBox deixava pin invisível focável) + regressão de escape malformado; 520 testes, lint ok |
| QA | **APROVADO** — 10/10 critérios; sem JS a 360/1280 px com cliques reais e teclado; idêntico ao protótipo (claro e escuro) exceto P9/P10; P4 sem vazamento; regressão byte a byte contra o stage |

## Decisões de produto
- **P8** (default): `/mapa/<slug inexistente ou não publicado>` → 404 "Esse endereço não existe." (o protótipo caía no grupo padrão).
- **P9** (default): `/mapa` sem slug seleciona o 1º da ordem padrão (Cantareira Trail).
- **P10** (default): `/sobre` com 2 ATIVO (busca/cards/detalhes/zonas/compatibilidade/cadastro; banco compartilhado sem "(Supabase)") e 3 PENDENTE (login, mapa interativo, notificações); item "navegador" removido; título "Status do protótipo" mantido.
- **P4** (usuário, vale também aqui): o `contact` do grupo não chega ao HTML do mapa para deslogado — `getMapData` remove o campo antes da view.

## Coder
**Novos**
- `src/domain/map.js`: `ZPOLY`, `ZLABEL`, `ZCENTRO` (literais do protótipo), `pinPos`, `gmapsBusca`, `gmapsRota`.
- `src/domain/slug.js`: `isSlug()` (`^[a-z0-9-]{1,60}$`), extraído de `groups.routes.js` por ser usado em dois lugares.
- `src/views/pages/mapa.ejs` (pins `<a>` SVG e itens da lista como links para `/mapa/<slug>#mapDetail`; painel `#mapDetail` renderizado no servidor) e `src/views/pages/sobre.ejs`.
- Testes: `tests/domain/map.test.js`, `tests/domain/slug.test.js`, `tests/http/mapa.test.js`, `tests/http/sobre.test.js`.

**Alterados**
- `src/modules/pages/pages.service.js`: `getMapData` (pura; remove `contact`) e `loadMapData` (`null` se o slug não está publicado).
- `src/modules/pages/pages.routes.js`: `GET /mapa`, `GET /mapa/:slug` (404 sem banco se `!isSlug`), `GET /sobre`.
- `src/modules/groups/groups.routes.js`: usa `isSlug`; `src/app.js`: `ZPOLY`, `ZLABEL`, `gmapsRota`, `gmapsBusca` em `app.locals`.
- `public/css/app.css`: 4 regras antes do marcador "Layout" — as 2 da spec (`ul.map-list`, `a.map-item`) e 2 a mais: `.map-detail{scroll-margin-top:84px}` (cabeçalho fixo cobria o painel ao seguir `#mapDetail`) e `overflow-wrap:anywhere` em `.map-item b`, `.map-item small`, `.map-detail h2` (nome/local sem espaço estouravam a 360 px).
- `tests/domain/pages-service.test.js`: bloco de `getMapData`.

**Observações**
- `listPublishedGroups` segue devolvendo `contact` para home, zonas e busca (as views não o exibem); a proteção depende de cada service.
- Em `/sobre`, o painel de status fica 18 px abaixo do de "A ideia" (`.panel + .panel{margin-top:18px}` no grid `.about`) — igual ao protótipo; mantido.
- `currentNav('/mapa')` → `''`: o header não tem item de mapa (igual ao protótipo; o mapa está no rodapé).

## Cleaner
- `map.js`: `encodeURIComponent(location + SP)` duplicado virou `inSaoPaulo(location)`; `pinPos` devolve `[...map_pin]`.
- `mapa.ejs`: `selectedSlug` calculado uma vez no topo (antes a comparação aparecia duas vezes, uma com `Boolean(...)`); HTML idêntico.
- `tests/http/mapa.test.js`: helper `selectedItems(html)`; `tests/http/sobre.test.js`: removida asserção redundante.
- Mantidos de propósito: remoção de `contact` (P4); CSS extra; `isSlug`; estilos inline do protótipo. `XSS`/`XSS_ESC` duplicados em `mapa.test.js` e `grupo-detalhe.test.js` (unificar mexeria na 006).

## Hardener
| Problema | Severidade | Correção | Teste |
|---|---|---|---|
| `map_pin` sem CHECK no banco: coordenada fora do viewBox (ex.: `{99999,-5}`) gerava pin invisível mas focável por Tab (foco some da tela) | baixa | `isPin` em `map.js` exige inteiros com x 0–400 e y 0–380; fora disso, cálculo pela zona | `map.test.js`: `[99999,-5]`, `[-1,100]`, `[401,100]`, `[100,381]` → zona; bordas `[0,0]`, `[400,380]` aceitas |
| Regressão (sem bug): `/mapa/%` e `/mapa/%E0%A4%A` → 400 sem stack, sem banco, sem `console.error` | — | — | `mapa.test.js` › bloco CA4 |

Conferidos sem mudança: P4 no mapa (`toMapGroup` remove `contact` de todos, inclusive do `selected`; `data-*` só com slug; 404 não renderiza grupo; `renderPage` não serializa locals); slug (`ABC`, `_`, 61 caracteres, `%00`, `a%2F..`, `-` → 404 sem banco; `pending` → 404; `/mapa/x/y` → 404); escape de `"`, `&`, `'`, `<x> onmouseover=` no `aria-label` e na URL do Maps (sempre `https://www.google.com`, `target="_blank" rel="noopener"`); lone surrogate não chega do Postgres; `/sobre` estático; sem SQL novo; CSS com tokens.

Riscos aceitos e pendências geradas: ver [`docs/PENDENCIAS.md`](../PENDENCIAS.md).

## QA
Veredito em [`docs/qa/007-mapa-sobre.md`](../qa/007-mapa-sobre.md): **APROVADO**, sem problemas.
- 520 testes (27 arquivos), lint ok.
- CA3: com scripts desligados, cliques reais em pin e item levam a `/mapa/<slug>#mapDetail` com o grupo certo; Tab percorre os pins em ordem; Enter navega; painel para em y=84 (abaixo do cabeçalho fixo).
- CA5 com todos os grupos despublicados temporariamente: 200, mapa vazio, sem NaN/undefined (status restaurados).
- CA6: hash de `pinPos` igual ao do protótipo em 2.500 slugs.
- P4: contatos falsos em 4 grupos não aparecem em nenhuma das 4 páginas do mapa verificadas.
- Comparação elemento a elemento com o protótipo (360/1280 px, claro/escuro): idêntico, exceto a ordem da lista (P9) e o painel de status do `/sobre` (P10).
- Regressão contra o stage (006): bytes iguais em `/`, `/grupos`, `/zonas`, `/grupos/:slug`, 404, 301, `/x404`, `/js/app.js`; `app.css` só ganha o bloco do mapa.
- Não bloqueantes registrados em `PENDENCIAS.md`: foco discreto nos pins não selecionados e alvo de toque de ~9 px a 360 px (ambos do protótipo).
