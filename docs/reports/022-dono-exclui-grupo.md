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
