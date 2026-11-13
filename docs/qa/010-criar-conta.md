# QA — 010 Criar conta
Veredito: APROVADO

| Critério | Resultado | Evidência |
|---|---|---|
| CA1 GET deslogado 200 com form/_csrf/3 campos; logado 302 /meus | ✅ | curl: 200, `_csrf`, nome/email/senha; logado → 302 /meus |
| CA2 POST válido 303, hash `$2b$12$`, cookie muda, /meus mostra nome | ✅ | curl: 303; psql `$2b$12$`; `pp.sid` mudou; /meus contém o nome |
| CA3 next válido / `//evil.com` | ✅ | 303 para `/grupos/correria-do-carmo#participar`; `//evil.com` → `/meus` |
| CA4 nome inválido (422, aria-invalid, autofocus) | ✅ | curl (nome "A") + testes http/unit |
| CA5 e-mail formato e duplicado case-insensitive | ✅ | curl: ANA maiúsculo → 422 "Já existe uma conta com esse e-mail."; testes |
| CA6 senha (tamanho, especial, nunca no HTML) | ✅ | curl: senha não aparece no HTML; testes unit |
| CA7 "Corrija N campos" e ordem | ✅ | curl: "Corrija 2 campos para continuar."; testes cobrem 3 |
| CA8 sem _csrf → 403 | ✅ | curl: 403 |
| CA9 11º POST → 429, form preenchido sem senha | ✅ | curl: 429 após 10 do mesmo IP, mensagem certa, `value="Zed"`, sem senha |
| CA10 corrida de e-mail | ✅ | teste automatizado (suíte passa) |
| CA11 sem console.* com dados sensíveis | ✅ | teste automatizado; log do app sem e-mail/senha |
| CA12 sem JS, 360 px, escape | ✅ | form é POST normal; Playwright 360x800: scrollWidth 360, sem erros de console |
| CA13 npm test / lint | ✅ | ver abaixo |

Testes: 720 passaram / 0 falharam (37 arquivos) · Lint: ok (eslint + prettier)
Ambiente: Docker indisponível; usei o Postgres 16 local (pg_ctlcluster). Migration rodada 2x sem erro ("em dia, 5 migrations"); seed idempotente.
Regressão: `/`, `/grupos`, `/grupos?zona=sul`, `/grupos/correria-do-carmo`, `/sobre` respondem 200; `/meus` deslogado redireciona para `/conta/entrar?next=%2Fmeus`; sem scroll horizontal a 360 px em `/` e `/grupos`.

Problemas encontrados: nenhum bloqueante.
- `/conta/entrar` e `/grupos/novo` retornam 404 neste ponto (spec 011 / marco posterior, fora do escopo da 010); o redirect de /meus aponta para uma página ainda inexistente.

Sugestões não bloqueantes
- Pendências do Hardener (trust proxy no deploy M8, rate limit em memória, bidi/zero-width em display_name, npm audit) seguem em PENDENCIAS.
- Comparação visual com o protótipo foi só estrutural (classes/page-head iguais), a conta não existia no protótipo.
