# Relatório — 005 Busca `/grupos` com filtros
Marco: M3 · Spec: [`docs/specs/005-busca-filtros.md`](../specs/005-busca-filtros.md) · QA: [`docs/qa/005-busca-filtros.md`](../qa/005-busca-filtros.md)
Branch: `claude/pipeline-m3-start-059610` (sem commit ainda) · Data: 2026-11-11

## Linha do tempo
| Etapa | Resultado |
|---|---|
| Specifier | Spec escrita junto com 004/006/007; P3 bloqueante (toggles de zona sem JS) respondida pelo usuário; P2 no default |
| Coder | Implementado; CA1–CA9 cobertos (tabela de 24 linhas da spec no repo); 386 testes (22 arquivos), lint ok |
| Cleaner | 4 limpezas pequenas (`contains()` no repo, `SCALAR_KEYS`, default duplicado, constante em teste); sem mudança de comportamento |
| Hardener | 2 problemas baixos corrigidos (NFC, `trimEnd` após corte); 389 testes, lint ok |
| QA | **APROVADO** — 9/9 critérios; sem JS a 360 px com cliques reais; regressão byte a byte nas outras páginas |
| Coder (ajuste) | Problema menor do QA corrigido a pedido do usuário: `.filters{scroll-margin-top:84px}` + teste; 390 testes |
| QA (reverificação) | Continua **APROVADO**; painel abaixo do cabeçalho a 360 px sem JS; ≥ 901 px inalterado |

## Decisões de produto
- **P3** (usuário, 2026-11-11): toggles de zona viram **checkboxes** com o mesmo visual (`label.ztog` + `:has(input:checked)`), em vez de botões `aria-pressed`. Diverge de CLAUDE.md/AGENTS.md §8 de propósito; CLAUDE.md e AGENTS.md atualizados com OK do usuário (§8).
- **P2** (sem resposta → default da spec): botão "Aplicar filtros" no form; "Os resultados atualizam na hora." mantido literal (só verdade com o JS do M7).
- **`PACE_FAIXAS` = `{nome,min,max}`** (formato do protótipo; `nome` é o texto do select e do chip). CLAUDE.md e AGENTS.md §6 atualizados com OK do usuário.
- **Ordem dos cards** = zona (`ZONA_ORDEM`) + nome, conforme AGENTS §6; o protótipo usava a ordem do array `DEMO`. Diferença intencional.

## Coder
**Novos**
- `src/domain/filters.js`: `EMPTY_FILTERS`, `parseFilters` (ignora inválidos, objetos, chaves herdadas; remove NUL; corta `nome`/`local` em 80 por code point), `filtersToQuery`, `searchHref`, `activeChips`, `escapeLike`, `periodRange`.
- `src/modules/groups/groups.routes.js`: `GET /grupos`; `GET /grupos/zona/:zona` → 301 `/grupos?zona=<z>` (404 se zona inválida).
- `src/views/pages/grupos.ejs` (`PageGrupos`, form GET com 7 filtros, chips removíveis como links, estado vazio) e `partials/filter-options.ejs`.
- Testes: `tests/domain/filters.test.js`, `tests/http/grupos.test.js`.

**Alterados**
- `src/domain/constants.js`: `PERIODOS`, `PACE_FAIXAS` `{nome,min,max}`.
- `src/domain/schedule.js`: `periodoDe`; `matchHora` extraído (usado por `fmtHora`).
- `groups.repo.js`: `listPublished(filters = EMPTY_FILTERS)` com `WHERE` dinâmico, todo valor como `$n`, `ILIKE … ESCAPE '\'`, revalida chaves de `PACE_FAIXAS`/`PERIODOS` com `Object.hasOwn`.
- `groups.service.js` (`searchGroups`), `src/app.js` (monta `groupsRouter`; expõe `DIAS`, `DIA_ORDEM`, `PERIODOS`, `PACE_FAIXAS` às views).
- `public/css/app.css`: 5 regras num bloco **antes** de `/* Layout: cabeçalho fixo` (o `scaffold.test.js` exige cópia literal do protótipo a partir dali); valem por especificidade maior. Regras `[aria-pressed]` antigas permanecem.
- Testes: `groups-repo`, `constants`, `schedule`.

**Observações**
- Remoção de NUL fora da spec: o Postgres recusa NUL em parâmetro (22021) → `?nome=%00` daria 500.
- `:has()` exige navegador ≥ 2023; sem ele o filtro funciona, só some o destaque da zona marcada.
- Busca não ignora acentos (`pelotao` ≠ "Pelotão"), igual ao protótipo.
- Em ≤ 900 px o painel de filtros volta fechado depois de "Aplicar filtros".

## Cleaner
- `groups.repo.js`: helper local `contains(column, term)` junta as duas condições ILIKE; ordem de `add` e `$n` inalterada.
- `filters.js`: ordem canônica da query numa constante `SCALAR_KEYS`.
- `groups.service.js`: removido default duplicado de `filters` (o repo já tem).
- `tests/db/groups-repo.test.js`: constante `LESTE_E_SUL`.
- Mantidos de propósito: revalidação de chaves no repo; limites de período em `PERIOD_RANGES` e em `periodoDe` (teste compara os dois em todos os minutos do dia); HTML/`style` inline literais do protótipo em `grupos.ejs`.

## Hardener
| Problema | Severidade | Correção | Teste |
|---|---|---|---|
| Termo em NFD (ex.: texto colado do macOS) não achava "Pelotão" | baixa | `text()` normaliza NFC antes de trim/corte | `filters.test.js` › "normaliza nome e local para NFC…"; `grupos.test.js` linha `?nome=pelota%CC%83o` |
| Corte em 80 podia terminar em espaço → `href` dos chips relia outro termo (`parseFilters` não idempotente) | baixa | `trimEnd()` após o corte | `filters.test.js` › "o corte em 80 não deixa espaço no fim…" |

Conferidos sem mudança: NUL; chips só com valores validados; `href` sempre começando em `/grupos` e escapados; `Location` do 301 só após validar a zona; `$n` em todo valor e `ESCAPE '\'` correto com `standard_conforming_strings=on`; parser `simple` do Express 5 (sem protótipo, máx. 1000 pares; URL > ~16 KB → 431 do Node); XSS via `<%= %>`; só `display_name` exposto de `users`; termos de busca não logados.

Riscos aceitos e pendências geradas: ver [`docs/PENDENCIAS.md`](../PENDENCIAS.md).

## QA
APROVADO. `npm ci`, migrate 2x, seed (0/11), 389 testes, lint ok; Postgres do checkout principal. Sem JS a 360 px com cliques reais (Enter no campo de texto envia o form sem marcar outra zona); as 24 linhas da tabela da spec conferidas via `curl`; chips removem só o próprio filtro; 360 px claro/escuro sem scroll; foco visível em checkboxes, chips e botão; textos batem com `PageGrupos`/`renderChips`. `/`, `/zonas`, `/sobre`, `/mapa`, 404 e `app.js` byte a byte iguais à HEAD. Detalhes em [`docs/qa/005-busca-filtros.md`](../qa/005-busca-filtros.md).

**Problema menor (resolvido)**: sem JS, ≤ 900 px, o link "Filtros" rolava até `#filters` com o título e "Limpar filtros" ~70 px atrás do cabeçalho fixo (um toque acertava `/meus`). A pedido do usuário, o Coder acrescentou `.filters{scroll-margin-top:84px}` no bloco de acréscimos do `app.css` (sem `env()`: o `html` já tem `scroll-padding-top:env(safe-area-inset-top,0px)` e os dois se somam; 84 = cabeçalho de 71 px + 13 px de folga, igual ao `top` do sticky no desktop) e um teste em `grupos.test.js` que trava os valores do cabeçalho. Reverificação do QA: a 360×800 sem JS (claro/escuro) o painel começa em y=84, abaixo do cabeçalho (y=71), e o link "Limpar filtros" recebe o clique; ≥ 901 px idêntico com e sem a regra; 390 testes, lint ok.

**Sugestões não bloqueantes**: URL com campos vazios após enviar (`&local=&dia=…`) — redirect para URL limpa é decisão do Specifier; "Os resultados atualizam na hora." só vale no M7; ordem dos cards diferente do protótipo de propósito; favicon e CSP seguem pendentes; atualizar AGENTS/CLAUDE §3, §6, §8.
