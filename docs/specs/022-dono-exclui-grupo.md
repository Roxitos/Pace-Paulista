# 022 — Dono exclui o próprio grupo e não entra nele
Marco: correção pós-M8 (antes do M10) · Status: **pronta para Coder** (OK do usuário e P1–P4 respondidas em 2026-11-18: todas as propostas aprovadas)
Depende de: 012 (confirmação em 2 passos), 013 (cadastro/dono), 014 (participar/sair), 015 (`/meus`)

Decisões do usuário em 2026-11-17 (não reabrir): o dono **exclui** (DELETE de verdade, sem migration) o grupo que cadastrou, com a mesma confirmação em 2 passos da exclusão de conta, na página do grupo e em `/meus`; grupos demo não são excluíveis; o dono **não entra** no próprio grupo ("Participantes hoje" do cadastro já o inclui), e a contagem ignora participações do dono que já existem no banco. Edição do grupo continua fora do escopo.

## Objetivo
1. O dono de um grupo real pode excluí-lo, com confirmação em 2 passos que funciona sem JS.
2. Acabar com a contagem dupla: o dono não pode entrar no próprio grupo e participações dele já gravadas não somam em "Participantes".

## Fora do escopo
- Editar/arquivar o grupo (continua v2, AGENTS §12).
- Excluir grupo demo (`owner_id IS NULL`) ou grupo de outro usuário, inclusive por admin (`role = 'admin'` não ganha poder novo).
- Versão com JS da confirmação (modal/troca sem recarregar); o toast vem de graça pelo `data-toast` já existente.
- Apagar do banco as participações do dono que já existem (ver P2).
- Avisar os membros de que o grupo foi excluído (notificações são fora da v1).

## Mudanças

### Banco
Nenhuma migration. `memberships.group_id … ON DELETE CASCADE` já existe (004). **Não usar o número 007**: está reservado para `password_resets` do M10.

### Repo — `groups.repo.js`
- `SELECT_PUBLISHED`: o JOIN de contagem passa a ignorar a participação do dono:
  `LEFT JOIN memberships m ON m.group_id = g.id AND m.user_id IS DISTINCT FROM g.owner_id`
  (`IS DISTINCT FROM`: nos demos `owner_id` é NULL e todas as participações contam). Vale para todas as telas que usam `participants` (home, `/grupos`, `/api/grupos`, detalhe, mapa, `/encontrar`, `/meus`).
- `listJoinedBy(userId)`: o `EXISTS` ganha `AND g.owner_id IS DISTINCT FROM mm.user_id` (grupo próprio não aparece em "Grupos em que você entrou"; ver P1).
- Novo `deleteOwned(slug, ownerId) → Promise<{ name } | null>`:
  ```sql
  DELETE FROM groups
   WHERE slug = $1 AND owner_id = $2 AND is_demo = false
  RETURNING name
  ```
  Um único comando: a autorização está no próprio `WHERE` (sem corrida entre "conferir dono" e "apagar"). Sem filtro de `status` (o dono pode apagar o próprio grupo em qualquer status; na v1 todos são `published`). Não usa `tx()`.

### Repo — `memberships.repo.js`
- `findPublishedGroupId(slug)` vira `findPublishedGroup(slug) → { id, ownerId } | null` (`id::text`, `owner_id::text`).
- `insertMembership`: o `SELECT` ganha `AND owner_id IS DISTINCT FROM $1` (defesa no próprio INSERT, como já se faz com o `status`).
- `findNickname(userId, slug)` e `listJoinedSlugs(userId)`: acrescentar `AND g.owner_id IS DISTINCT FROM m.user_id` (participação do dono fica invisível; ver P1).
- `deleteMembership`: **sem mudança** (sair continua apagando qualquer participação, inclusive a do dono).

### Service
- `memberships.service.joinGroup(slug, userId, body)`: depois de achar o grupo e **antes** de validar o form, se `group.ownerId === String(userId)` → `return { isOwner: true }` sem gravar.
- `groups.service.deleteOwnGroup(slug, userId) → Promise<{ name } | null>` → `groupsRepo.deleteOwned(slug, String(userId))`.
- `groups.service.getGroupDetail`: sem mudança de contrato (`isOwner` já existe; `membership` já vem `null` para o dono pelo `findNickname`).

### Rotas — `groups.routes.js`
- `GET /grupos/:slug`: passa `confirmDelete: detail.isOwner && req.query.excluir === '1'` para a view (não-dono: parâmetro ignorado).
- `POST /grupos/:slug/participar`: `result.isOwner` → `303` para `/grupos/<slug>` **sem flash e sem gravar** (inclusive com form inválido: não vira 422). A página mostra "Você organiza este grupo." no lugar do botão.
- Nova `POST /grupos/:slug/excluir` — `requireAuth` + CSRF global:
  - `!isSlug(slug)` → 404 `GROUP_NOT_FOUND` (sem consultar o banco).
  - `deleteOwnGroup` devolve `null` (não existe, demo, ou de outro usuário) → **404** com `GROUP_NOT_FOUND` ("Esse grupo não foi encontrado. Ele pode ter sido removido."). Escolha de 404 (e não 403): mesma resposta para "não existe" e "não é seu", então a rota não revela nada além da página pública.
  - Sucesso → `req.session.flash = { kind: 'group-deleted', name }` → `303` para `/meus`.
  - Deslogado → `303` `/conta/entrar` (comportamento do `requireAuth` para POST).
- Rate limit (`rateLimits.js`): `app.post('/grupos/:slug/excluir', limits.createGroup)` — mesmo balde do cadastro (20/h por usuário), comentado como "escrita de grupo".

### Rotas — `account.routes.js` (`GET /meus`)
- Lê `req.query['excluir-grupo']`; `confirmGroup` = esse slug **só se** `isSlug` e estiver em `mine` (senão `null`, ignorado). Independe do `?excluir=1` da conta.

### Views
**Partial novo `partials/group-delete.ejs`** (um só HTML para as duas telas; marcação do 2º passo igual à da spec 012). Locals: `slug`, `confirm` (bool), `askHref`, `cancelHref`, `boxId`.
- Wrapper: `<div id="<%= boxId %>" class="group-delete">`.
- 1º passo: `<a class="btn btn-outline btn-sm" href="<%= askHref %>">Excluir grupo</a>`.
- 2º passo: `<div class="form-alert bad" role="alert"><%- ic('alert') %><span>{ALERTA}</span></div>` + `<form method="post" action="/grupos/<%= encodeURIComponent(slug) %>/excluir" class="choice-row" style="margin-top:10px">` + `partials/csrf` + `<button class="btn btn-primary btn-sm" type="submit" style="background:var(--pista)">Excluir grupo</button>` + `<a class="btn btn-outline btn-sm" href="<%= cancelHref %>">Cancelar</a></form>`.

**`grupo-detalhe.ejs`** (no `.stack` da "Ficha do treino"):
- Dono (`locals.isOwner`): no lugar dos botões "Entrar no grupo"/"Sair do grupo" → `<div class="form-alert good"><%- ic('check') %><span>Você organiza este grupo.</span></div>`; depois "Ver rota no mapa" (inalterado); depois o `group-delete` com `boxId: 'excluir'`, `askHref: /grupos/<slug>?excluir=1#excluir`, `cancelHref: /grupos/<slug>#excluir`, `confirm: confirmDelete`.
- `showPanel` passa a exigir `!locals.isOwner`: o painel `#participar` (e portanto o modal do `participar.js`, que só monta se o painel existir) não aparece para o dono.
- Ordem de prioridade: `isOwner` vence `membership` (P1).

**`group-card.ejs`** e **`match-card.ejs`**: para o dono (`locals.user && g.owner_id === String(user.id)`), **omitir** o botão primário "Entrar no grupo" (ficam "Ver detalhes" e "Ver rota"; o card de `group-card` já mostra "Cadastrado por você"). Ver P3.

**`meus.ejs`**:
- Antes do `page-head`: se `locals.flash?.kind === 'group-deleted'` → `<div class="wrap notice-top" data-toast="{FLASH}"><div class="form-alert good" role="status"><%- ic('check') %><span>{FLASH}</span></div></div>` (nome sempre com `<%= %>`).
- Em "Grupos que você cadastrou", cada item vira `<div class="mine-item">` com o `group-card` seguido do `group-delete` (`boxId: excluir-<slug>`, `askHref: /meus?excluir-grupo=<slug>#excluir-<slug>`, `cancelHref: /meus#excluir-<slug>`, `confirm: confirmGroup === g.slug`). O `.mine-item` é o filho do `.grid-cards` (o grid não muda).

**CSS** (`app.css`, mínimo, sem cor solta): `.group-delete{margin-top:12px}` e o que for preciso para o `.mine-item` não alargar a coluna (`min-width:0`). Nada mais.

### Docs (no mesmo PR; texto proposto para OK)
- **AGENTS §4 Regras derivadas**: "Participantes exibidos = `base_participants` + COUNT(memberships do grupo **exceto a do dono**)"; "Dono do grupo … Na v1 o dono **exclui** o próprio grupo pela UI (spec 022; participações caem em cascata) e **não edita** (v2). Grupos demo não são excluíveis. O dono **não entra** no próprio grupo: `base_participants` já o inclui."
- **AGENTS §5 Ações**: nova linha `POST /grupos/:slug/excluir` | ✅ | "Só o dono; grupo demo ou de outro → 404. Confirmação em 2 passos (`?excluir=1` na página do grupo, `?excluir-grupo=<slug>` em `/meus`). Sucesso → flash e redirect `/meus`". Linha de `participar`: "dono → 303 para a página do grupo, sem gravar".
- **AGENTS §5 Fluxo "Entrar no grupo"**: "Dono vê 'Você organiza este grupo.' no lugar do botão; sem painel/modal".
- **AGENTS §12**: "Dono edita/arquiva o próprio grupo" → "Dono edita/arquiva o próprio grupo (excluir já existe desde a spec 022)".

## Regras e mensagens
| Situação | Regra | Texto exato |
|---|---|---|
| Página do grupo, dono | no lugar de "Entrar no grupo"/"Sair do grupo" | `Você organiza este grupo.` (**proposta**; frase do pedido + ponto final) |
| 1º passo (página e `/meus`) | link | `Excluir grupo` (**proposta**) |
| 2º passo, alerta {ALERTA} | `role="alert"` | `Tem certeza que deseja excluir o grupo? Isso apaga o grupo e as participações de todos os membros. Não dá para desfazer.` (**proposta**, no molde do P11 da 012) |
| 2º passo, botões | — | `Excluir grupo` / `Cancelar` (**proposta**) |
| Depois de excluir {FLASH} | `/meus`, `role="status"` + `data-toast` | `O grupo “{nome}” foi excluído.` (**proposta**; aspas como no toast "Grupo “{nome}” cadastrado.") |
| Excluir: não existe, demo, de outro usuário, slug inválido | 404 | `Esse grupo não foi encontrado. Ele pode ter sido removido.` (já existe) |
| Participar sendo dono | 303 → `/grupos/<slug>`, nada gravado | — (a página mostra o texto do dono) |

## Critérios de aceite
- [ ] CA1 — Contagem: grupo real com `base_participants = 5`, participação do dono (inserida direto no banco, como em produção) e de 1 outro usuário → `participants = 6` em `findPublishedBySlug`, `listPublished` e na página do grupo. Grupo demo (`owner_id NULL`) com 1 participação → `base + 1` (nada muda para demos).
- [ ] CA2 — Página do grupo para o dono: mostra `Você organiza este grupo.`; **não** contém `Entrar no grupo`, `id="participar"`, `/participar`, nem `Sair do grupo` (mesmo com participação antiga do dono no banco); mostra o link `Excluir grupo` → `/grupos/<slug>?excluir=1#excluir` e **não** o form `/excluir`. Para outro usuário logado e para visitante: sem `Você organiza`, sem `Excluir grupo`, botão "Entrar no grupo" como hoje; `?excluir=1` não muda nada para eles.
- [ ] CA3 — `GET /grupos/<slug>?excluir=1` do dono: alerta `role="alert"` com o texto da tabela, form `POST /grupos/<slug>/excluir` com `_csrf`, botão `Excluir grupo` e `Cancelar` → `/grupos/<slug>#excluir`.
- [ ] CA4 — `POST /grupos/<slug>/excluir` do dono com `_csrf` → `303` `/meus`; a linha de `groups` sumiu; as `memberships` do grupo (de outros usuários) = 0; `GET /grupos/<slug>` → 404; o `GET /meus` seguinte mostra `O grupo “{nome}” foi excluído.` com `role="status"` e `data-toast`, e o grupo não está em nenhuma lista; um 2º `GET /meus` não mostra mais o aviso.
- [ ] CA5 — Recusas, sempre sem apagar nada: outro usuário logado → `404` com a mensagem de grupo não encontrado; grupo demo (qualquer usuário) → `404`; slug inexistente ou fora do formato → `404`; sem `_csrf` → `403`; deslogado → `303` `/conta/entrar`. Um membro do grupo que tenta excluir também recebe 404.
- [ ] CA6 — `/meus` do dono: cada card de "Grupos que você cadastrou" tem `Excluir grupo` → `/meus?excluir-grupo=<slug>#excluir-<slug>`; com esse parâmetro, só o card daquele slug mostra o 2º passo (CA3, com `Cancelar` → `/meus#excluir-<slug>`); `?excluir-grupo=` com slug de outro usuário, demo, inexistente ou inválido não mostra 2º passo em lugar nenhum (200); `?excluir=1` da conta continua funcionando independente. O fluxo pelo 2º passo de `/meus` exclui como no CA4.
- [ ] CA7 — Dono não entra: `POST /grupos/<slug>/participar` do dono com form válido → `303` `/grupos/<slug>` e nenhuma linha em `memberships`; com form inválido (sem apelido) → também `303` (não 422). Outro usuário continua entrando normalmente (regressão da 014).
- [ ] CA8 — Participação antiga do dono (inserida direto no banco) fica invisível: não aparece em "Grupos em que você entrou" de `/meus`, não conta no badge do cabeçalho, os cards do grupo não mostram `Você participa`/`No grupo · ver encontros`/`Você já participa`; `POST /grupos/<slug>/sair` do dono continua respondendo `303` e apaga a linha. (Depende de P1.)
- [ ] CA9 — Cards (`/grupos`, `/api/grupos`, home, `/meus`, `/encontrar`) para o dono não têm o botão `Entrar no grupo` daquele grupo; para os demais grupos e para outros usuários, nada muda. (Depende de P3.)
- [ ] CA10 — Fluxo HTTP do M6 (`tests/http/meus.test.js`, "fluxo do M6") ajustado: quem participa e sai é um **2º usuário**; o dono cadastra, vê `Você organiza este grupo.`, exclui o grupo pela página e a participação do 2º usuário cai em cascata.
- [ ] CA11 — AGENTS §4, §5 e §12 atualizados conforme "Docs" (o `.claude/CLAUDE.md` só importa, não editar).
- [ ] CA12 — Funciona sem JS (2 passos por link + POST, PRG); 360 px sem scroll horizontal em `/grupos/<slug>?excluir=1` (dono) e `/meus?excluir-grupo=<slug>` com nome de 50 caracteres sem espaço; nada de SQL fora de `*.repo.js`; `npm test` e `npm run lint` passam.

## Testes esperados
- db (`tests/db/groups-repo.test.js`): CA1 (dono não conta, demo conta tudo); `deleteOwned` devolve `{ name }` e cascateia para o dono, `null` para outro usuário e para demo; `listJoinedBy` ignora o grupo próprio.
- db (memberships repo, no arquivo de repo que já existir ou junto do acima): `insertMembership` do dono não grava; `listJoinedSlugs`/`findNickname` ignoram a participação do dono.
- unit (`tests/domain/memberships-service.test.js`, repo mocado): `joinGroup` do dono devolve `{ isOwner: true }` sem chamar `insertMembership` nem validar o form.
- http (`tests/http/grupo-excluir.test.js`, novo): CA2–CA6 (um caso por linha de recusa do CA5, sem combinar).
- http (`tests/http/participar.test.js`): CA7 e CA8 (`sair` do dono).
- http (`tests/http/meus.test.js`): CA8 (lista e badge), CA9 (um card em `/grupos` e um em `/encontrar`) e CA10.

## Riscos / perguntas em aberto
> **Respondidas pelo usuário em 2026-11-18**: P1 esconder tudo (default), P2 não apagar agora (default), P3 só omitir o botão (default), P4 textos aprovados como estão. Os textos marcados **proposta** abaixo valem como finais.

- **P1 — Participações antigas do dono nas outras telas** (produção já tem esse caso). **Proposta (default)**: tratá-las como inexistentes em todo lugar (CA8): fora de "Grupos em que você entrou", fora do badge, sem `Você participa` nos cards, sem "Sair do grupo" na página (o dono vê `Você organiza este grupo.`); `POST /sair` continua funcionando, mas sem botão. Alternativa: manter "Sair do grupo" visível para o dono que tem participação antiga, para ele mesmo limpar. Confirmar.
- **P2 — Apagar essas participações do banco?** Com o default do P1, o apelido do dono fica gravado e invisível até ele excluir o grupo ou a conta (o texto do painel diz "é apagado quando você sai do grupo ou exclui a conta"). **Proposta (default)**: não apagar nesta spec. Alternativas: (a) `DELETE` único, feito à mão no Neon e registrado em `docs/DEPLOY.md`; (b) migration de dados (seria a 007, que o M10 reservou — exigiria renumerar o M10). Confirmar.
- **P3 — Cards para o dono.** **Proposta (default)**: só omitir "Entrar no grupo" (sem texto novo; o card já diz "Cadastrado por você"). Alternativa: botão `btn-quiet` com texto novo (ex.: "Você organiza · ver grupo"). Confirmar.
- **P4 — Textos propostos** da tabela "Regras e mensagens" (`Você organiza este grupo.`, `Excluir grupo`, alerta do 2º passo, `O grupo “{nome}” foi excluído.`). Aprovar ou ajustar.
- Decisões técnicas desta spec (não de produto): 404 (não 403) para não-dono; rate limit no balde do cadastro (20/h por usuário); dono que tenta participar recebe 303 silencioso.
- Risco: os membros de um grupo excluído perdem a participação sem aviso (sem notificações na v1); o grupo some da busca na hora.
- Risco: o `style="background:var(--pista)"` do 2º passo é cópia literal (spec 012); já coberto pelo `style-src-attr 'unsafe-inline'` da spec 019.
- PENDENCIAS: o item "M6/M9 — Trazer 'dono edita'" segue aberto (edição continua v2); o orquestrador registra esta spec como correção antes do M10.
