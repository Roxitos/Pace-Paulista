# 015 — `/meus` e estado "Você participa"
Marco: M6 · Status: aguardando OK do usuário (P8–P10 no fim) e a 014 implementada; depois pronta para Coder
Depende de: 012 (painel "Conta e dados" + exclusão), 013 (`owner_id`), 014 (`memberships.repo`, participar/sair)
Última spec do M6.

## Objetivo
`/meus` lista "Grupos em que você entrou" e "Grupos que você cadastrou" (`PageMeus`), mantendo o painel "Conta e dados" da 012. Os cards do site passam a mostrar "Você participa" para o usuário logado e o ícone do cabeçalho ganha o contador de grupos. Fecha o M6 com o teste HTTP do fluxo completo.

## Fora do escopo
- Sair do grupo a partir de `/meus` (o protótipo só tem "Sair" na página do grupo).
- Edição/arquivamento do grupo pelo dono (roadmap).
- Atualizar o badge sem recarregar (M7).

## Mudanças

### Banco
Nenhuma migration.

### Repo — `groups.repo.js`
Reaproveitam `selectPublished` (mesmo contrato `Group`, com `participants`):
- `listJoinedBy(userId) → Promise<Group[]>` — `g.status = 'published' AND EXISTS (SELECT 1 FROM memberships mm WHERE mm.group_id = g.id AND mm.user_id = $1)`, `ORDER BY g.id` (ordem do `api.listGroups()` do protótipo).
- `listOwnedBy(userId) → Promise<Group[]>` — `g.status = 'published' AND g.owner_id = $1`, `ORDER BY g.id` (ordem do `state.custom`).

### Repo — `memberships.repo.js`
- `listJoinedSlugs(userId) → Promise<string[]>` — slugs dos grupos **publicados** em que o usuário está.

### Service / middleware
- `groups.service.listMyGroups(userId) → { joined, mine }`.
- `src/middlewares/joinedGroups.js` (novo), montado logo depois de `currentUser`: logado → `res.locals.joinedSlugs = new Set(await memberships.service.listJoinedSlugs(user.id))`; visitante → `new Set()` sem consultar. Uma consulta a mais por página só para logado; erro vai para `next(err)`.

### Rota — `GET /meus` (`account.routes.js`)
Passa a renderizar também `joined` e `mine` (`listMyGroups(req.user.id)`); `confirmDelete` como hoje.

### Views
- `pages/meus.ejs` — antes do painel "Conta e dados", dentro do `.wrap`, as duas seções do `PageMeus`:
  - `<section class="section" style="padding-top:32px"><div class="sec-head"><h2 class="display" style="font-size:34px">Grupos em que você entrou</h2></div>` + `grid-cards` com `group-card` ou o vazio: `<div class="empty">ic('users')<h3>Você ainda não entrou em nenhum grupo</h3><p>Encontre um grupo com o seu pace e a sua região e entre com um clique.</p><a class="btn btn-primary" href="/encontrar">Encontrar meu grupo</a></div>`.
  - `<section class="section" style="padding-top:0">…<h2 …>Grupos que você cadastrou</h2>` + cards ou o vazio: `<div class="empty">ic('plus')<h3>Nenhum grupo cadastrado</h3><p>Organiza treinos? Cadastre seu grupo para aparecer na busca.</p><a class="btn btn-outline" href="/grupos/novo">Cadastrar grupo</a></div>`.
  - Subtítulo do `page-head` continua `Grupos em que você entrou e grupos que você cadastrou.` (sem "neste navegador").
- `partials/group-card.ejs` (`GroupCard` do protótipo), com `j = locals.joinedSlugs?.has(g.slug)`:
  - `card-top`: `j` → `<span class="joined-pill">ic('check','ico-sm')Você participa</span>` no lugar do `demo-tag`.
  - ação principal: `j` → `<a class="btn btn-quiet" href="/grupos/<slug>">ic('check','ico-sm') No grupo · ver encontros</a>`; logado não participante → `<a class="btn btn-primary" href="/grupos/<slug>#participar">`; visitante → como hoje (`/conta/entrar?next=…%23participar`).
- `partials/match-card.ejs` (`/encontrar`): `j` → `<a class="btn btn-quiet" href="/grupos/<slug>">ic('check','ico-sm') Você já participa</a>`; logado não participante → `/grupos/<slug>#participar`; visitante como hoje.
- `partials/header.ejs`: dentro de `#meusBtn`, depois do ícone, `<span class="badge-count"><%= n %></span>` quando logado e `n = joinedSlugs.size > 0` (`updateMeusBadge`).
- `pages/sobre.ejs`: nenhuma mudança de texto (o 1º "ATIVO" já cita cadastro e entrada em grupos, que passam a existir); marcar a pendência M3 de `/sobre` como resolvida.

## Regras e mensagens
| Situação | Texto exato |
|---|---|
| seção 1 | `Grupos em que você entrou` |
| seção 1 vazia | `Você ainda não entrou em nenhum grupo` / `Encontre um grupo com o seu pace e a sua região e entre com um clique.` / `Encontrar meu grupo` |
| seção 2 | `Grupos que você cadastrou` |
| seção 2 vazia | `Nenhum grupo cadastrado` / `Organiza treinos? Cadastre seu grupo para aparecer na busca.` / `Cadastrar grupo` |
| card participante | pill `Você participa`; botão `No grupo · ver encontros` |
| card de compatibilidade participante | `Você já participa` |

## Critérios de aceite
- [ ] CA1 — Conta nova: `/meus` mostra os dois vazios com os textos e links da tabela e o painel "Conta e dados" da 012 inalterado (`?excluir=1` continua funcionando).
- [ ] CA2 — Usuário que participa de 2 grupos demo e cadastrou 1 grupo: seção 1 com os 2 cards em ordem de criação (`g.id`), cada um com `Você participa` e `No grupo · ver encontros`; seção 2 com o grupo cadastrado. Grupo `pending` (UPDATE no teste) some das duas seções.
- [ ] CA3 — Em `/`, `/grupos` e `/encontrar` (com resultado que inclui o grupo): participante vê pill/`Você já participa`; logado não participante vê o link `/grupos/<slug>#participar`; visitante vê `/conta/entrar?next=/grupos/<slug>%23participar`.
- [ ] CA4 — Cabeçalho: logado com 2 participações → `<span class="badge-count">2</span>` em `#meusBtn`; com 0 ou deslogado → sem `badge-count`.
- [ ] CA5 — Fluxo HTTP completo do M6 (`tests/http/fluxo-m6.test.js` ou extensão do `fluxo-conta`): criar conta → cadastrar grupo → participar dele → `/meus` mostra o grupo nas duas seções e badge 1 → sair → `/meus` sem o grupo na seção 1 → excluir conta → o grupo continua publicado com `owner_id IS NULL`.
- [ ] CA6 — Funciona sem JS; 360 px sem scroll horizontal em `/meus` (vazio e com cards) e no cabeçalho com badge; nada de SQL fora de `*.repo.js`.
- [ ] CA7 — `npm test` e `npm run lint` passam.

## Testes esperados
- http `tests/http/meus.test.js`: CA1, CA2, CA4.
- http: um teste para CA3 (as três variantes num card de `/grupos`; um caso em `/encontrar`).
- http: CA5 (fluxo).
- Sem teste de domínio novo (não há regra pura).

## Riscos / perguntas em aberto
- **P8** — Badge com o número de grupos no ícone do cabeçalho (protótipo `updateMeusBadge`) custa 1 consulta por página para logado. **Default**: manter (consulta por PK/índice, barata).
- **P9** — Seção "Grupos que você cadastrou" só com grupos `published` (**default**; na v1 todos são). Com moderação (M9), mostrar também `pending` com selo "em revisão"?
- **P10** — Sem "Sair do grupo" em `/meus` (fiel ao protótipo, **default**); o card leva à página do grupo, onde está o botão.
- Risco: `joinedSlugs` em `res.locals` também aparece no JSON de `/api/grupos` só se alguém o serializar; o M7 deve montar o JSON a partir do repo, não de `res.locals`.
