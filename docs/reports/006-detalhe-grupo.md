# Relatório — 006 Detalhe do grupo `/grupos/:slug`
Marco: M3 · Spec: [`docs/specs/006-detalhe-grupo.md`](../specs/006-detalhe-grupo.md) · QA: [`docs/qa/006-detalhe-grupo.md`](../qa/006-detalhe-grupo.md)
Branch: `feat/m3-detalhe-mapa-sobre` (sem commit ainda) · Data: 2026-11-11

## Linha do tempo
| Etapa | Resultado |
|---|---|
| Specifier | Spec escrita junto com 004/005/007 (branch `claude/specs-006-007`, trazida por cherry-pick); P4–P7 respondidas pelo usuário em 2026-11-11 |
| Coder | Implementado; CA1–CA10 cobertos; 442 testes (23 arquivos), lint ok. Apontou conflito do P4 com `PENDENCIAS.md` |
| Usuário | P4 reconfirmado: contato **só para logado** (regra antiga) |
| Coder (ajuste P4) | Serviço zera `contact` sem `viewer`; view exige `locals.user`; CA4/CA7 reescritos; 444 testes |
| Cleaner | 5 limpezas (`selectPublished`, `joinPtBr`, um só `demo-tag`, helper `insertMembership`); sem mudança de comportamento |
| Hardener | 1 problema baixo corrigido (scroll horizontal a 360 px com texto longo sem espaço) + 3 testes de reforço do P4; 447 testes, lint ok |
| QA | **REPROVADO** — CA1–CA10 ok, mas a 360 px "Próximos encontros" quebrava palavras no meio ("Segund/a-feira") por causa do `overflow-wrap:anywhere` numa coluna de 63 px |
| Usuário | Encontros em tela estreita: pace desce para baixo do texto (desvio do protótipo só no mobile) |
| Coder (ajuste) | `@media (max-width:560px)` em `ul.sessions li` (2 colunas, data ocupando 2 linhas); só CSS; 449 testes |
| QA (reverificação) | **APROVADO** — 0 palavras quebradas nos 11 grupos a 360 px, sem scroll (inclusive local de 80 caracteres no banco); 1280 px idêntico; regressão byte a byte nas outras páginas |

## Decisões de produto
- **P4** (usuário, 2026-11-11): linha "Contato" no fim da "Ficha do treino", texto puro, oculta quando vazia e **só para usuário logado**. Até o M5 ninguém a vê. Futuro: virar link (Instagram/site/e-mail) com validação de URL.
- **P5** (default): etiqueta do cabeçalho — demo → "Grupo fictício · demonstração"; com dono → "Cadastrado por {nome}"; sem dono → nenhuma.
- **P6** (default): 404 do grupo "Esse grupo não foi encontrado. Ele pode ter sido removido."
- **P7** (default): nota "Confirmações por encontro dependem do banco de dados." mantida literal.
- **Encontros em ≤ 560 px** (usuário, após o REPROVADO): faixa de pace desce para baixo do texto; acima de 560 px, igual ao protótipo.

## Coder
**Novos**
- `src/views/pages/grupo-detalhe.ejs` (`PageDetalhe`, linhas 726–763 do protótipo, com as trocas da spec).
- `tests/http/grupo-detalhe.test.js`.

**Alterados**
- `src/domain/schedule.js`: `fmtDiasLongo`, `proximos(group, now, { n, timeZone })` (puro, `Intl` para data local e deslocamento do fuso, sem `-03:00` fixo), `fmtEncontro`.
- `groups.repo.js`: `findPublishedBySlug(slug)`; `groups.service.js`: `getGroupDetail(slug, now, { viewer })`; `groups.routes.js`: `GET /grupos/:slug` (slug fora de `^[a-z0-9-]{1,60}$` → 404 sem banco), passa `{ viewer: res.locals.user }`.
- `src/middlewares/notFound.js`: `renderNotFound(res, message)`; `src/app.js`: expõe `fmtDiasLongo` às views.
- `public/css/app.css`: regra `overflow-wrap:anywhere` antes do marcador "Layout" (o bloco seguinte é cópia literal testada do protótipo).
- Testes: `tests/domain/schedule.test.js` (inclui CA9 com `vi.stubEnv('TZ', …)`), `tests/db/groups-repo.test.js`.

**Observações**
- Teste de "sem consulta" espiona `pool.query` (ESM não permite espionar export do repo).
- View usa `||` para tratar string vazia como NULL (distância e contato).
- `/grupos/novo` e `/grupos/zona` hoje caem no 404 com a mensagem do grupo; resolve-se no M6.
- Contrato com o M5: a sessão precisa preencher `res.locals.user`.

## Cleaner
- `groups.repo.js`: helper privado `selectPublished(where)` junta `SELECT_PUBLISHED` + `WHERE` + `GROUP BY` (antes repetido); SQL gerado idêntico.
- `schedule.js`: `listaPt` → `joinPtBr` (identificador interno em inglês, CONVENTIONS).
- `grupo-detalhe.ejs`: um só `<span class="demo-tag">` com texto de `headTag`; bloco de variáveis em várias linhas.
- `tests/helpers/db.js`: `insertMembership(pool, userId, slug, nickname)`, usado nos testes de participantes.
- Sugestão não feita: unificar o `insertGroup` dos testes http com o de `tests/db/schema.test.js`.

## Hardener
| Problema | Severidade | Correção | Teste |
|---|---|---|---|
| Texto longo sem espaço (local, descrição, tags) abria scroll horizontal a 360 px (683 px medidos no Chrome headless) | baixa | `overflow-wrap:anywhere` também em `.detail-head .sub span`, `.detail-grid .panel p`, `.detail-grid .tag` | `grupo-detalhe.test.js` › "Texto longo sem espaço em 360 px (CA8)" |
| Reforço P4: cada camada (serviço e view) barra o contato sozinha | — | sem mudança de código | "Contato (P4): cada camada barra o visitante sozinha" (2 testes) |

Conferidos sem mudança: contato não vaza para deslogado (nada serializa grupos; 404/500 sem dados do grupo); slug validado antes do banco (`%2F`, `%00`, `_`); percent-encoding malformado → 400 genérico do Express; SQL parametrizado; escape `<%= %>`; `proximos`/`fmtEncontro` em virada de ano, meia-noite, todos os dias, fuso +14, horário de verão de NY e de SP 2018/19; `TZ_APP` validado no `env.js`.

Riscos aceitos e pendências geradas: ver [`docs/PENDENCIAS.md`](../PENDENCIAS.md).

## Coder (ajuste do QA)
- `public/css/app.css`: `@media (max-width:560px){ul.sessions li{grid-template-columns:auto minmax(0,1fr);row-gap:4px}ul.sessions li > .date-box{grid-row:span 2}ul.sessions li > .mono{grid-column:2}}` antes do marcador "Layout" (560 px já é breakpoint do CSS; `ul.` vence a regra do protótipo que vem depois).
- `tests/http/grupo-detalhe.test.js`: 2 testes (regra servida antes do marcador; pace é o último `span.mono` de cada encontro).
- Medido no Chrome headless sem JS: a 360 px colunas `58px 202px`, encontro de 199 → 99 px de altura, `scrollWidth` 360; a 1280 px colunas, posições e alturas idênticas às de antes.

## QA
Veredito em [`docs/qa/006-detalhe-grupo.md`](../qa/006-detalhe-grupo.md).
- **1ª rodada — REPROVADO**: 10/10 critérios ok; problema médio de palavras quebradas a 360 px (volta ao Coder; mudança visual exigiu decisão do usuário).
- **Reverificação — APROVADO**: 449 testes, lint ok; 0 palavras quebradas nos 11 grupos a 360 px (claro e escuro), também a 414/561/768 px; local de 80 caracteres sem espaço gravado no banco sem scroll de 320 a 768 px; 1280 px igual ao protótipo (44 elementos por página com mesma posição/tamanho/cor; só "Entrar no grupo" vira link, como pede a spec); regressão byte a byte em `/`, `/grupos`, `/zonas`, `/sobre`, `/mapa`, `/x404`; só `/grupos/novo` muda (previsto, M6).
- Não bloqueantes registrados em `PENDENCIAS.md`: 3 px de scroll a 320 px em todas as páginas; cards de `/grupos` com nome longo sem espaço; CA4 com sessão real no M5; Node 24 local.
