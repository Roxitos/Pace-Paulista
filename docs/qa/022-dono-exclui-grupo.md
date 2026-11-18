# QA — 022 Dono exclui o próprio grupo e não entra nele
Veredito: APROVADO

| Critério | Resultado | Evidência |
|---|---|---|
| CA1 contagem sem o dono (demo conta tudo) | ✅ | SQL manual: base 5 + dono (inserido no banco) + 1 membro = 6; página do grupo mostra 6; testes db |
| CA2 página do dono | ✅ | curl: "Você organiza este grupo.", sem "Entrar no grupo", sem `id="participar"`, sem "Sair do grupo" (mesmo com participação antiga), link `?excluir=1#excluir`; membro e visitante sem nada disso. Obs.: resta `<script src="/js/participar.js">` (inerte sem o painel) |
| CA3 2º passo na página | ✅ | curl `?excluir=1`: alerta `role="alert"` com o texto, form POST `/excluir`, Cancelar `/grupos/<slug>#excluir` |
| CA4 excluir | ✅ | POST com CSRF: 303 `/meus`; grupo e memberships sumiram; detalhe 404; flash com `role="status"` e `data-toast`; 2ª visita sem aviso |
| CA5 recusas | ✅ | membro 404, demo 404, inexistente 404, slug inválido 404, sem csrf 403, deslogado com token válido 303 `/conta/entrar` (com token inválido, 403 vem antes: CSRF global) |
| CA6 `/meus` | ✅ | link `?excluir-grupo=<slug>#excluir-<slug>`; só o card do slug abre o 2º passo; demo/inexistente/inválido: 200 sem 2º passo |
| CA7 dono não entra | ✅ | participar válido e inválido: 303 `/grupos/<slug>`, nada gravado; membro entra normal ("Bem-vindo(a)") |
| CA8 participação antiga invisível | ✅ | inserida no banco: sem "Sair do grupo"/"Você participa" na página, em `/meus`, `/api/grupos`; `POST /sair` do dono 303 e apaga |
| CA9 cards sem "Entrar no grupo" do dono | ✅ | `/grupos` do dono: 11 botões (12 grupos, o próprio omitido) |
| CA10 fluxo M6 | ✅ | `tests/http/meus.test.js` passa |
| CA11 AGENTS §4/§5/§12 | ✅ | `git diff AGENTS.md` com as mudanças da spec |
| CA12 sem JS, 360 px, lint/testes | ✅ | tudo acima é curl/PRG sem JS; Chrome 360x800 com nome de 50 "W": scrollWidth 360 em detalhe `?excluir=1`, `/meus?excluir-grupo=`, `/grupos` e home; console sem erros/avisos |

Testes: 894 passaram / 0 falharam (57 arquivos) · Lint (eslint + prettier): ok
Ambiente: `npm ci`, migrate duas vezes (2ª "já está em dia"), seed ok.
Regressão: `/`, `/grupos?zona=sul&nivel=iniciante`, `/grupos/pace-da-oca`, `/zonas`, `/mapa`, `/encontrar`, `/sobre` = 200; `/meus` e `/grupos/novo` deslogado = 302 `/conta/entrar?next=…`.

Problemas encontrados: nenhum bloqueante.

Sugestões não bloqueantes
- Não carregar `participar.js` quando o dono vê a página (hoje o script é inerte).
- Riscos já aceitos: membros não são avisados da exclusão; participação antiga do dono segue gravada e invisível (P2); grupo de conta excluída fica sem quem possa excluí-lo até o M9.
- Observação de ambiente: senha do cadastro exige caractere especial (regra existente).
