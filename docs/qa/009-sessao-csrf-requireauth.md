# QA — 009 Sessão no Postgres, CSRF, usuário na requisição e requireAuth
Veredito: APROVADO

| Critério | Resultado | Evidência |
|---|---|---|
| CA1 sem cookie/sessão em páginas públicas | ✅ | curl em 8 URLs: 200, 0 Set-Cookie; `select count(*) from session` = 0; teste CA1 |
| CA2 cookie httpOnly/Lax/30d, sem Secure; secure em produção | ✅ | tests/http/sessao.test.js (CA2) + teste unitário da config |
| CA3 redirects de requireAuth | ✅ | curl `/meus` → 302 `/conta/entrar?next=%2Fmeus`; `?x=1` → `next=%2Fmeus%3Fx%3D1`; POST → 303 (teste) |
| CA4 /meus logado, escape, Cache-Control | ✅ | teste CA4 |
| CA5 contato só logado | ✅ | teste CA5 |
| CA6 usuário apagado vira anônimo | ✅ | teste CA6 |
| CA7 CSRF (sem token, outra sessão, mesma sessão, token estável) | ✅ | teste CA7; curl POST sem token → 403 com texto "sessão expirou ou ocorreu um problema de segurança…" |
| CA8 body > 16 kB → 413 | ✅ | curl 20 kB → 413; teste CA8 |
| CA9 safeNext | ✅ | tests/domain/redirect.test.js |
| CA10 SESSION_SECRET vazio | ✅ | tests/domain/env.test.js |
| CA11 log do Postgres sem detail | ✅ | tests/domain/error-handler.test.js |
| CA12 sem JS, SQL só em repo, sem password_hash vazando | ✅ (360 px parcial) | grep: `password_hash` só em comentários; `/meus` usa só `panel`/`wrap`/`page-head` existentes. Screenshot 360 px de `/meus` não feito: a rota de login de teste só existe nos testes e não há tela de login ainda (010/011) |
| CA13 testes e lint | ✅ | abaixo |

Ambiente: `npm ci`, migrate x2 (idempotente, "já está em dia"), seed idempotente. `db:up` indisponível (sem Docker); Postgres local já estava de pé em 127.0.0.1:5432.
Testes: 679 passaram / 0 falharam (35 arquivos) · Lint (eslint + prettier): ok
Regressão: home, /grupos, /grupos?zona=sul, detalhe de grupo demo, /encontrar, /zonas, /mapa, /sobre respondem 200.

Problemas encontrados: nenhum.

Sugestões não bloqueantes
- Verificar `/meus` a 360 px e sem JS quando a 011 trouxer o login real.
- Riscos aceitos do Hardener (state.md): POST em rota inexistente sem token = 403; `trust proxy` no M8; token CSRF no errorHandler quando o header ganhar form de "Sair" (011).
