# QA — 011 Entrar, sair e usuário no header
Veredito: APROVADO

| Critério | Resultado | Evidência |
|---|---|---|
| CA1 GET /conta/entrar (200 + _csrf; logado 302 /meus; next preservado) | ✅ | curl: 200, csrf presente; logado com `next=/grupos/pace-da-oca%23participar` → 302 `/grupos/pace-da-oca#participar` |
| CA2 login → 303 /meus, pp.sid novo, nome em /meus; next interno ok, `//evil.com` e `https://evil.com` → /meus | ✅ | curl: 303 para `/grupos/correria-do-carmo#participar`; sid mudou; nome escapado em /meus; externos → `/meus` |
| CA3 caixa diferente e espaços | ✅ | `"  QA123@X.COM  "` entrou |
| CA4 401 igual p/ senha errada e e-mail inexistente; e-mail reexibido, senha não | ✅ | curl: ambos 401 com `E-mail ou senha incorretos.`; senha ausente do HTML; `bcrypt.compare` com DUMMY_HASH em auth.service.js:33 |
| CA5 campos vazios → 422 | ✅ | `Corrija 2 campos para continuar.`, `Informe seu e-mail.`, `Informe sua senha.` |
| CA6 rate limit | ✅ | 10×401, 11ª → 429 com mensagem; outro e-mail do mesmo IP → 303 |
| CA7 logout | ✅ | sem _csrf → 403 e segue logado; com _csrf → 303 `/`, `Set-Cookie: pp.sid=; Expires=1970`; /meus → 302 login |
| CA8 header | ✅ | deslogado `href="/conta/entrar" aria-label="Entrar"`; logado `href="/meus" aria-label="Meus grupos · Ana &lt;QA&gt;"` |
| CA9 /sobre ATIVO | ✅ | `<span class="st on">ATIVO</span>` em "Login e conta de usuário." |
| CA10 fluxo M5 completo | ✅ | coberto por tests/http/fluxo-conta.test.js (Contato aparece logado, some deslogado); curl manual de criar→sair→entrar→sair ok (grupos demo não têm contato, por design) |
| CA11 sem console.* com dados sensíveis; password_hash só em findCredentialsByEmail | ✅ | grep em src: console só em errorHandler/server/pool (sem senha/e-mail); password_hash só no repo |
| CA12 sem JS; 360 px; SQL só em repo | ✅ | Playwright 360×800, JS ligado e desligado: criar conta, login errado, sair funcionam; scrollWidth = 360 em /conta/entrar, /conta/criar, /meus, /grupos, / |
| CA13 npm test e lint | ✅ | ver abaixo |

Testes: 741 passaram / 0 falharam (40 arquivos) · Lint: ok (eslint + prettier)
Ambiente: `npm ci` ok; `db:up` (Docker) indisponível neste sandbox, usado Postgres local; migrate rodado 2× (idempotente, 5 migrations); seed idempotente.

Problemas encontrados: nenhum bloqueante.
- Observação: uma medição única mostrou scrollWidth 375 sem JS em /conta/entrar logo após carregar; em 4 repetições ficou em 360 (SVG decorativo é cortado). Não reproduzido.
- Um 404 de recurso ocorreu uma vez no console (com JS), não reproduzido nas reexecuções; o 401 do console é a resposta esperada do login errado.

Sugestões não bloqueantes
- Antes do deploy (M8): configurar `trust proxy`, senão o limiter vira global (já registrado pelo Hardener).
- Limiter em memória por processo; considerar store compartilhado se houver mais de uma instância.
- Conferir o 404 ocasional (provável favicon) no console.
