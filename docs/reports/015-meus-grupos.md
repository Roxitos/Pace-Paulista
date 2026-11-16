# 015 — `/meus` e estado "Você participa"

Spec: [`docs/specs/015-meus-grupos.md`](../specs/015-meus-grupos.md) · Marco: M6

## Specifier
Spec 015 escrita junto com a [014](../specs/014-participar-sair.md); fecha o M6. Aprovação: P8–P10 = defaults (usuário pediu para rodar a spec): P8 badge mantido (1 consulta por página só para logado), P9 só grupos `published`, P10 sem "Sair" em `/meus`.

## Coder
Spec 015 implementada. `npm test` (48 arquivos, 808 testes) e `npm run lint` passam.
- `src/middlewares/joinedGroups.js` novo, montado após `currentUser`: logado → `res.locals.joinedSlugs` (Set) com 1 consulta; visitante → Set vazio sem consultar.
- `groups.repo`: `listJoinedBy` e `listOwnedBy` (só `published`, `ORDER BY g.id`); `groups.service.listMyGroups`; `memberships.repo/service.listJoinedSlugs`.
- `GET /meus` passa `joined` e `mine`; `meus.ejs` com as duas seções e os vazios antes de "Conta e dados".
- `group-card` (pill "Você participa" + "No grupo · ver encontros"), `match-card` ("Você já participa") e `header` (`badge-count` em `#meusBtn`).
- `tests/http/meus.test.js` cobre CA1–CA5 (inclui o fluxo completo do M6).
- `docs/PENDENCIAS.md`: pendência M3 de `/sobre` marcada como resolvida.

Não verificado: CA6 (360 px, sem JS, em navegador) — fica para o QA. Rodou `prettier --write` em `src`.

## Cleaner
Refatoração mínima, sem mudança de comportamento. `npm test` (48 arquivos, 808 testes) e `npm run lint` passam.
- `src/views/partials/group-card.ejs`: "Ver detalhes", "Ver rota" e o `href` do título usam a variável `slug` já calculada no topo, em vez de repetir `encodeURIComponent(g.slug)`. Mesmo HTML gerado.
- Revisados sem necessidade de mudança: `joinedGroups.js`, `app.js`, `groups.repo`/`groups.service`, `memberships.repo`/`memberships.service`, `account.routes`, views `meus`/`match-card`/`header` e `tests/http/meus.test.js` (sem `console.log`, import morto ou SQL fora de `*.repo.js`).
- Alertas: 1 consulta extra por página só para logado (P8); CA6 (360 px, sem JS) segue para o QA/Hardener; nada commitado (013, 014 e 015 no working tree).

## Hardener
Um achado (média), corrigido com teste antes da correção. `npm test` 809 ok (49 arquivos), `npm run lint` ok.
- **Achado**: logado, se a consulta de `listJoinedSlugs` falhasse, o cabeçalho quebrava ao montar a página de erro (`joinedSlugs` indefinido) e o usuário recebia o texto puro "Erro interno." em vez da página "Algo deu errado". Nada vazava.
- **Correção**: `src/views/partials/header.ejs` usa `locals.joinedSlugs?.size ?? 0` e só mostra o contador se for maior que 0.
- **Teste**: `tests/http/joined-groups-falha.test.js` (novo) simula a queda só nessa consulta e espera 500 em HTML com "Algo deu errado", sem ECONNREFUSED nem porta 5432. Falhava antes, passa depois.
- Revisado sem problemas: `/meus` atrás de `requireAuth`; consultas parametrizadas com o id da sessão; grupos `pending`/`rejected` fora de /meus, cards e contador; `Cache-Control: private, no-store` para logado; visitante e estáticos sem consulta extra; slug e nome escapados.
- Riscos: 1 consulta extra por página para logado (P8); no M7, o JSON de `/api/grupos` deve vir do repo, não de `res.locals`, para não expor `joinedSlugs`; CA6 (360 px, sem JS) segue para o QA; nada commitado.

## QA
APROVADO (CA1–CA7). `npm test` 49 arquivos / 809 verdes; lint e prettier ok. Detalhes em `docs/qa/015-meus-grupos.md`.
- Fluxo completo por curl (criar conta → cadastrar → participar → `/meus` + badge → sair → excluir conta); após excluir, o grupo segue `published` com `owner_id` nulo.
- CA6: Playwright 360×800, com e sem JS, sem scroll horizontal em `/meus` (vazio e com cards), `/grupos` e `/` com badge; participar funciona sem JS.
- M7: `joinedSlugs` só no middleware e nas views; nada serializa `res.locals`.
- Ambiente: sem Docker, Postgres 16 local via `pg_ctlcluster`; banco já migrado (não foi "ambiente limpo").
- Sugestões: `/favicon.ico` 404 (erro de console só com JS; anterior à 015); limpar dados de teste do banco de dev (`grupo-qa-*`, `script-alert-1-script`).
