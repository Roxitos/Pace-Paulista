# QA — 019 Endurecimento para produção
Veredito: APROVADO

| Critério | Resultado | Evidência |
|---|---|---|
| CA1 trust proxy / TRUST_PROXY | ✅ | testes `seguranca.test.js` e `env.test.js` (852/852) |
| CA2 CSP | ✅ | `curl -i /`: CSP idêntica à tabela, sem `upgrade-insecure-requests` em dev; CSP também em `/css/app.css`, `/favicon.ico`, `/api/grupos` (testes) |
| CA3 demais cabeçalhos | ✅ | `X-Frame-Options: DENY`, `Referrer-Policy: same-origin`, sem `X-Powered-By`, sem HSTS em dev; HSTS em produção via teste |
| CA4 sem violação de CSP no navegador | ✅ | Chrome (Playwright, JS ligado): `/`, `/grupos` (filtro ao vivo, `?nome=pace`), `/grupos/pace-da-oca` (modal abre), `/grupos/novo` (422), `/mapa` (clique no pin leva a `/mapa/<slug>`), `/encontrar`, `/zonas`, `/sobre`, `/conta/*`, `/meus`, 404, página CSRF: nenhum erro de CSP; só os 4xx esperados. Fontes Anton, Inter e JetBrains Mono carregadas; `--z` = `#5E9A22` aplicado |
| CA5 Referer preservado | ✅ | POST com `_csrf` inválido: 403 e "Atualizar e tentar de novo" com href `/grupos/novo`; clicar volta a `/grupos/novo` |
| CA6 rate limit de leitura | ✅ | 125 `GET /grupos`: 120×200 e 5×429; página "Algo deu errado" com `Retry-After`; `/zonas` segue 200 |
| CA7 rate limit da API | ✅ | 301 `GET /api/grupos`: 300×200 e 1×429; corpo `{"error":"rate_limited"}`, `Cache-Control: private, no-store`; baldes separados |
| CA8 por usuário / CSRF | ✅ | testes `rate-limit.test.js` |
| CA9 IPs atrás do proxy | ✅ | testes |
| CA10 `/conta/*` intactos | ✅ | testes existentes sem alteração |
| CA11 statement_timeout | ✅ | `tests/db/pool.test.js` |
| CA12 env de produção | ✅ | `env.test.js` (inclui o caso `sslmode` duplicado do Hardener) |
| CA13 seed | ✅ | `seed.test.js`, `seed-guard.test.js`; seed local idempotente (0 de 11 inseridos, 11 já existiam) |
| CA14 favicon | ✅ | `<link rel="icon">` no HTML; `/favicon.svg` 200 `image/svg+xml`; `/favicon.ico` 301; nenhum 404 de favicon no console |
| CA15 sem JS, 360 px, regressão, lint, audit | ✅ | Todas as páginas respondem 200 com e sem JS; sem overflow em 360 px, exceto o da home sem JS (ver abaixo, anterior à spec); `/meus` e `/grupos/novo` redirecionam para `/conta/entrar?next=…` deslogado; `npm audit --omit=dev`: 0 vulnerabilidades |

Testes: 852 passaram / 0 falharam · Lint (ESLint + Prettier): ok
Migration rodada 2× sem erro ("já está em dia"). Observação: `npm run db:up` falhou porque o ambiente não tem Docker; usei o Postgres local que já estava de pé.

Problemas encontrados: nenhum bloqueante.

Sugestões não bloqueantes
- Home sem JS tem scroll horizontal (1280 px: +96 px; 360 px: +15 px) causado por `.hdr-actions` (menu mobile/ações do cabeçalho). É idêntico no HEAD sem as mudanças da 019 (conferido com worktree), portanto não é regressão; vale registrar nas pendências.
- Contador de caracteres do `/grupos/novo` não foi localizado pelos seletores genéricos do script; não é escopo da 019 e não apareceu erro de CSP, mas convém uma checagem manual.
- Riscos aceitos já listados no handoff: 429 em `POST /grupos` perde o form, rate limit em memória, `style-src-attr 'unsafe-inline'`; recomendar `sslmode=verify-full` na spec 020.
