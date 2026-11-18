# 022 — Dono exclui o próprio grupo e não entra nele

Spec: [`docs/specs/022-dono-exclui-grupo.md`](../specs/022-dono-exclui-grupo.md) · Marco: correções pós-M8 (antes do M10)

## Specifier
Spec 022 escrita a partir de dois problemas achados pelo usuário testando a produção (decisões de 2026-11-17: apagar de verdade; dono não entra no próprio grupo). **Aguarda OK do usuário** e respostas de P1–P4 antes do Coder. Sem migration (007 fica reservada ao M10) nem dependência nova.
- **Excluir grupo**: `POST /grupos/:slug/excluir` com `requireAuth`, CSRF e o limite do cadastro de grupo (20/h por usuário). Autorização no próprio `DELETE … WHERE slug=$1 AND owner_id=$2 AND is_demo=false RETURNING name` (sem corrida). Não-dono, demo ou slug inexistente → 404 com a mensagem atual de grupo não encontrado. Sucesso → `/meus` com flash. Participações caem em cascata.
- Confirmação em 2 passos sem JS no molde da spec 012: na página do grupo `?excluir=1#excluir`; em `/meus` `?excluir-grupo=<slug>#excluir-<slug>`; partial novo `partials/group-delete.ejs`.
- **Contagem**: `LEFT JOIN memberships m ON m.group_id = g.id AND m.user_id IS DISTINCT FROM g.owner_id` (demos inalterados: `owner_id` NULL).
- **Dono não participa**: página do grupo mostra "Você organiza este grupo." no lugar de "Entrar no grupo"/"Sair do grupo" e não renderiza `#participar`; `POST /participar` do dono → 303 para o grupo, sem flash e sem gravar; o `INSERT` também recusa o dono (2ª defesa).
- Teste "fluxo do M6" em `tests/http/meus.test.js` faz o dono entrar no próprio grupo: reescrever com um segundo usuário (CA10). AGENTS §4/§5/§12 atualizado no mesmo PR (CA11).
- Perguntas abertas: **P1** participações do dono já gravadas ficam invisíveis em todas as telas (proposta); **P2** não apagá-las do banco nesta spec (proposta); **P3** card do dono só omite "Entrar no grupo" (proposta); **P4** textos propostos.

## OK do usuário (2026-11-18)
Spec aprovada. P1: participações antigas do dono ficam invisíveis em todas as telas (default). P2: não apagar do banco agora (default). P3: card do dono só omite "Entrar no grupo" (default). P4: textos aprovados como estão. Próxima etapa: Coder.

## Coder
Spec implementada conforme o OK (P1–P4 default). `npm test` (57 arquivos, 894 testes) e `npm run lint` verdes. Sem migration nem dependência nova.
- `groups.repo`: contagem de participantes ignora o dono (`IS DISTINCT FROM g.owner_id`); `listJoinedBy` ignora grupo próprio; novo `deleteOwned(slug, ownerId)` (um `DELETE … RETURNING name` com a autorização no `WHERE`).
- `memberships.repo`: `findPublishedGroupId` → `findPublishedGroup` (`{ id, ownerId }`); `INSERT`, `findNickname` e `listJoinedSlugs` ignoram o dono. `memberships.service.joinGroup` devolve `{ isOwner: true }` antes de validar e sem gravar.
- `groups.service.deleteOwnGroup`; `groups.routes`: `confirmDelete` na página do grupo, `participar` do dono → 303 sem flash, nova `POST /grupos/:slug/excluir`. `rateLimits`: `/excluir` no balde do cadastro de grupo. `account.routes`: `/meus` lê `?excluir-grupo=<slug>` (só slug válido entre os grupos do usuário).
- Views: `partials/group-delete.ejs` (novo), `grupo-detalhe`, `meus`, `group-card`, `match-card`. `app.css`: `.mine-item` e `.group-delete` antes do marcador de Layout (fora do bloco literal do protótipo, exigido pelo `scaffold.test.js`).
- Testes: `tests/http/grupo-excluir.test.js` (novo: CA2–CA6, CA9), `participar` (dono), `meus` (fluxo M6 reescrito com 2º usuário, CA10), `db/groups-repo` (CA1, CA8), `domain/memberships-service`. AGENTS §4/§5/§12 atualizado (CA11).
- Alertas: 360 px não verificado visualmente (QA: nome de 50 chars sem espaço no `.mine-item`); `grupo-excluir.test.js` loga por `/__test/login/:id` (limite de 10 cadastros/IP); dono não recebe token CSRF na página do grupo fora do 2º passo; participações antigas do dono seguem gravadas e invisíveis (P2); membros de grupo excluído não são avisados; `participar.js` ainda carrega para o dono (inofensivo, não há `#participar`). Ambiente sem Docker: Postgres temporário e `.env` (ignorado pelo git) criados pelo Coder.

## Cleaner
Três ajustes sem mudar comportamento observável. `npm test` (57 arquivos, 893 testes; −1 teste redundante) e `npm run lint` verdes.
- `account.routes` (GET `/meus`): saiu a validação de `?excluir-grupo` (`isSlug` + `mine.some`) e o import de `isSlug`; a view só abre o 2º passo no card cujo slug bate, então slug estranho continua sem efeito.
- `meus.ejs`: `boxId` dos cards usa o slug codificado (`excluir-${su}`), igual às âncoras `#excluir-…`.
- `tests/http/grupo-excluir.test.js`: helper `signedUp(_app, …)` → `loginComo(nome, email)`; `postExcluir` sem o parâmetro `from` morto; removido o teste "excluir pelo 2º passo de /meus" (mesmo POST já coberto por "dono exclui" e pelo fluxo de `meus.test`).
- Avaliado e mantido: flash em `meus.ejs` (padrão de `grupo-detalhe`); checagem `owner_id === String(user.id)` repetida em `group-card` e `match-card` (uma linha cada, sem helper).
- Alertas: nenhum novo. Seguem os do Coder (P2: participações antigas do dono invisíveis; membros não avisados ao excluir).

## Hardener
Nenhuma falha de segurança no diff. Única lacuna: o rate limit de `POST /grupos/:slug/excluir` (balde do cadastro de grupo, 20/h por usuário) não tinha teste; acrescentado em `tests/http/rate-limit.test.js` ("divide o balde do cadastro: 429 e nada apagado"; falha se a linha do mount sumir). Código de produção inalterado. `npm test` (57 arquivos, 894 testes) e `npm run lint` verdes.
- Revisado sem problema: autorização no próprio `WHERE` do `DELETE` (sem corrida; demo, sem dono e de outro → mesmo 404); CSRF (403), deslogado → login, slug inválido → 404 sem banco; `?excluir-grupo` repetido/alheio/inexistente sem efeito; nome do grupo escapado no flash e `textContent` no toast; páginas logadas com `Cache-Control: private, no-store`; corrida participar × excluir (FK → 404, nunca 500); dono recusado no service e no `INSERT`; nenhum log ou dado pessoal novo.
- Riscos aceitos: membros não são avisados da exclusão (sem notificações na v1); grupos de conta excluída ficam sem dono e só saem pelo `/admin` do M9; participações antigas do dono seguem no banco, invisíveis (P1/P2).

## QA
**APROVADO** ([`docs/qa/022-dono-exclui-grupo.md`](../qa/022-dono-exclui-grupo.md)). CA1–CA12 ok. `npm test` (57 arquivos, 894 testes) e `npm run lint` verdes; migrations rodadas 2x sem erro e seed ok.
- Sem JS (curl): dono exclui pelo 2º passo → 303 `/meus` com flash/`data-toast`; grupo e participações somem, detalhe 404. Membro, demo, inexistente e slug inválido → 404; sem `_csrf` → 403; deslogado com token válido → 303 `/conta/entrar`. Dono em `participar` (form válido ou inválido) → 303 sem gravar. Participação antiga do dono (inserida no banco) invisível na página, em `/meus` e `/api/grupos`; contagem 6 (base 5 + 1 membro); `POST /sair` apaga. `/grupos` do dono: 11 botões "Entrar no grupo" para 12 grupos. `/meus?excluir-grupo=` com slug demo/inexistente/inválido → 200 sem 2º passo.
- 360 px (Chrome 360×800, nome de 50 "W"): `scrollWidth` 360 no detalhe `?excluir=1`, em `/meus?excluir-grupo=`, `/grupos` e home; console sem erros nem avisos.
- Regressão: `/`, `/grupos` com filtro, `/grupos/pace-da-oca`, `/zonas`, `/mapa`, `/encontrar`, `/sobre` → 200; `/meus` e `/grupos/novo` deslogados → 302 `/conta/entrar?next=…`.
- Sugestões não bloqueantes: não carregar `participar.js` na página do dono (hoje inerte); deslogado com token CSRF inválido recebe 403 antes do `requireAuth` (CSRF global). Riscos aceitos seguem (membros não avisados; participação antiga do dono gravada e invisível; grupo de conta excluída sem quem o exclua até o M9).
