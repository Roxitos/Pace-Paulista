# Relatório — 002 Home estática
Marco: M1 · Spec: [`docs/specs/002-home-estatica.md`](../specs/002-home-estatica.md) · QA: [`docs/qa/002-home-estatica.md`](../qa/002-home-estatica.md)
Branch: `feat/002-home-estatica` (a partir de `feat/001-scaffold-base`) · Data: 2026-11-11

## Linha do tempo
| Etapa | Resultado |
|---|---|
| Specifier | Spec escrita junto com a 001; perguntas 3–5 respondidas pelo usuário (ver relatório da 001) |
| Coder | Implementado; 94 testes (9 arquivos), lint ok |
| Cleaner | 2 limpezas pequenas, sem mudança de comportamento |
| Hardener | 7 problemas corrigidos; 143 testes, lint ok |
| QA | **APROVADO** — 10/10 critérios, incluindo visuais |

## Coder
**Novos**
- `db/seeds/demo-groups.js`: `DEMO_GROUPS` com os 11 grupos, nomes de coluna do banco e `is_demo: true`. Gerado por script a partir do `DEMO` do protótipo (textos literais). Será reaproveitado pelo seed do M2.
- `src/domain/constants.js` (`ZONAS`, `ZONA_ORDEM`, `DIAS`, `DIAS_CURTO`, `DIA_ORDEM`, `NIVEIS`, `DESTAQUES`), `src/domain/pace.js` (`fmtPace`, `fmtFaixa`, `parsePace`), `src/domain/schedule.js` (`fmtHora`, `sortDias`, `fmtDiasCurto`).
- `src/modules/pages/pages.service.js`: `getHomeData(groups = DEMO_GROUPS)`.
- Partials: `zone-chip.ejs`, `level-meter.ejs`, `demo-tag.ejs`, `group-card.ejs`.
- Testes: `tests/domain/{pace,schedule,constants,demo-groups,pages-service}.test.js`, `tests/http/home.test.js`.

**Alterados**
- `src/views/helpers.js`: `SEAL` literal, `seal(z, size)`, `zstyle(z)` (validam a zona; `seal` exige `size` inteiro).
- `src/app.js`: `app.locals` expõe `ic`, `seal`, `zstyle`, `ZONAS`, `ZONA_ORDEM`, `NIVEIS`, `fmtPace`, `fmtFaixa`, `fmtHora`, `fmtDiasCurto`.
- `src/modules/pages/pages.routes.js`: `/` renderiza `home` com `getHomeData()`.
- `src/views/pages/home.ejs`: reproduz `PageHome` (hero com arte da pista calculada com as fórmulas do protótipo, "Como funciona", destaques, zonas).

**Observações**
- `src/` importa de `db/seeds/demo-groups.js` até o M3, como a spec prevê.
- Links "Entrar no grupo", "Ver detalhes", "Ver rota", `/grupos`, `/zonas`, `/encontrar`, `/grupos/novo` dão 404 até os próximos marcos (aceito).

## Cleaner
- `src/views/helpers.js`: função interna `zona(z)` → `zoneOf(z)` (código em inglês; nomes exigidos por AGENTS.md/spec mantidos).
- `src/views/partials/level-meter.ejs`: desestruturação de `NIVEIS[level]`; HTML idêntico.

## Hardener
| Problema | Severidade | Correção | Teste |
|---|---|---|---|
| `getHomeData([])` gerava `Infinity`/`-Infinity` → "Infinity:NaN" na home | média | `paceMinS`/`paceMaxS` = `null` com lista vazia; `home.ejs` omite o número | `pages-service.test.js`, `home.test.js` |
| Zona desconhecida gerava `NaN` (e `toString` virava texto de função) em `countsByZone` | baixa | Conta só zonas que são chave própria (`Object.hasOwn`) | `pages-service.test.js` › "ignora zona desconhecida" |
| Slug em `href` sem codificação de URL | baixa | `encodeURIComponent(g.slug)` nos 4 links do card | `home.test.js` › "codifica o slug" |
| `fmtPace`/`fmtFaixa` mostravam lixo com NaN, negativos, decimais | média | `RangeError` se não for inteiro ≥ 0 | `pace.test.js` |
| `parsePace` aceitava não-strings (`['5:30']`) | baixa | Retorna `null` se não for string | `pace.test.js` |
| `fmtHora` mostrava "NaNhundefined" / TypeError | baixa | Regex `HH:MM` ou `HH:MM:SS` (TIME do pg), hora 00–23; senão `RangeError` | `schedule.test.js` |
| Dia inválido em `sortDias`/`fmtDiasCurto` | baixa | `RangeError` se fora de `DIA_ORDEM` | `schedule.test.js` |
| Escape de dados do grupo | — | Já correto (`<%= %>`); teste de XSS adicionado | `home.test.js` › "escapa nome, descrição e local" |

Pendências e perguntas geradas: ver [`docs/PENDENCIAS.md`](../PENDENCIAS.md).

## QA
APROVADO. 323 elementos do `<main>` comparados com o protótipo (1280/360 px, claro/escuro); diferenças só esperadas ("grupos cadastrados" 8 px mais estreito; "Entrar no grupo" agora é `<a>` com o mesmo estilo). Regressão da 001 ok. Detalhes em [`docs/qa/002-home-estatica.md`](../qa/002-home-estatica.md).

**Sugestões não bloqueantes**: selo do Centro diz "Selo da Centro" (texto literal do protótipo); não publicar o M1 sozinho (links levam a 404).
