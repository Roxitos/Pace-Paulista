# 019 — Endurecimento para produção

Spec: [`docs/specs/019-endurecimento-producao.md`](../specs/019-endurecimento-producao.md) · Marco: M8

## Specifier
Spec 019 escrita, primeira do M8 (só código; `render.yaml`, Neon e deploy ficam para a 020). Decisões prévias do usuário: Render + Neon; produção com demos via `ALLOW_DEMO_SEED=1` e aviso "Versão de demonstração". Espera o merge da 018 (o rate limit cobre `/api/mapa/:slug`).
- `trust proxy` por `TRUST_PROXY` (inteiro 0–10; 1 em produção, 0 fora).
- `helmet` (^8, dependência nova prevista no AGENTS §2/§9) com CSP: `self` + fonts.googleapis/gstatic, `script-src-attr 'none'`, `frame-ancestors 'none'`, `style-src-attr 'unsafe-inline'` (~45 `style="…"` das zonas); `Referrer-Policy: same-origin`; HSTS e `upgrade-insecure-requests` só em produção.
- Rate limit em `src/middlewares/rateLimits.js`, montado no `app.js`: `GET /grupos` e `/encontrar` 120/min por IP; `GET /api/grupos` e `/api/mapa/:slug` 300/min (JSON 429); `POST /grupos` 20/h por usuário; `participar`/`sair` 60/15 min por usuário. `/conta/*` não muda.
- `statement_timeout` 5 s só no pool da app. Env de produção: `DATABASE_URL` com `sslmode` require/verify-ca/verify-full; `SESSION_SECRET` ≥ 32 caracteres sem espaços.
- Seed em produção só com `ALLOW_DEMO_SEED=1`. Favicon SVG + `<link rel="icon">` + `/favicon.ico` 301.
- 15 critérios de aceite (CA1–CA15), incluindo verificação no navegador de que nenhuma página gera violação de CSP.

Perguntas em aberto (defaults na spec): P1 limites; P2 tela do 429 (genérica × mensagem da 011); P3 `style-src-attr 'unsafe-inline'` (atualiza AGENTS §9); P4 `TRUST_PROXY=1`; P5 SSL do banco sem exceção para localhost (recomenda `verify-full`); P6 outras rotas sem limite; P7 timeout 5 s; P8 favicon só SVG.
Para a 020: `-pooler` do Neon pode recusar `statement_timeout` na conexão; Safari < 15.4 não entende `style-src-attr`; rate limit em memória zera a cada deploy. Docs a atualizar com OK: AGENTS §3, §9 e §10.

Aprovação: usuário aceitou os defaults de P1–P8 (limites da tabela; 429 com a página genérica; `style-src-attr 'unsafe-inline'` com AGENTS §9 atualizado; `TRUST_PROXY=1` em produção; SSL do banco sem exceção para localhost; demais rotas sem limite; `statement_timeout` 5 s; favicon só SVG).

## Coder
Spec 019 implementada. `npm test` 851/851, `npm run lint` OK, `npm audit --omit=dev` sem vulnerabilidades. Dependência nova: `helmet` ^8.3.0.
- Novos: `src/middlewares/securityHeaders.js` (helmet/CSP), `src/middlewares/rateLimits.js` (`read`, `api`, `createGroup`, `membership`), `public/favicon.svg`, `tests/http/seguranca.test.js`, `tests/http/rate-limit.test.js`.
- Alterados: `src/app.js` (`trust proxy`, helmet antes do static, `/favicon.ico` 301, limites após CSRF), `src/config/env.js` (`TRUST_PROXY`, `sslmode` e segredo sem espaços em produção), `src/db/pool.js` (`statement_timeout` 5 s só na app), `scripts/seed.js` (`ALLOW_DEMO_SEED=1`), `src/views/layout.ejs` (link do ícone), `.env.example`, `tests/helpers/auth.js` e testes de env, pool e seed.
- CA1–CA3, CA6–CA14 cobertos por testes automatizados; CA4, CA5, "sem 404 de favicon" (CA14) e CA15 ficam para o QA no navegador.
- Alertas: 429 em `POST /grupos` perde o formulário preenchido (P2); rate limit em memória; a linha "Produção: grupos demo publicados…" do seed não tem teste; spec 020: o pooler do Neon pode recusar `statement_timeout` como parâmetro de conexão.
- Docs a atualizar com seu OK: AGENTS §3, §9 e §10.

## Cleaner
Refatoração sem mudança de comportamento. `npm test` 851/851, `npm run lint` OK.
- `src/config/env.js`: `isStrongSecret` sem a checagem `length >= 32` redundante (o trim já implica); `parseTrustProxy` usa `!value`.
- `src/middlewares/rateLimits.js`: `RATE_LIMITS` deixou de ser exportado (uso interno).
- `src/db/pool.js`: `APP_STATEMENT_TIMEOUT_MS` deixou de ser exportado (uso interno).
- Resto do diff do Coder revisado: sem duplicação, código morto ou imports sobrando.

## Hardener
Um achado (baixa), corrigido com teste antes da correção. `npm test` 852/852, `npm run lint` OK.
- **Achado:** em produção, `DATABASE_URL` com `?sslmode=require&sslmode=disable` passava na validação (o `env.js` lia só o primeiro `sslmode`; o `pg-connection-string` 2.14.1 aplica o último → conexão sem TLS, anulando o CA12).
- **Correção:** `hasSecureSslmode` em `src/config/env.js` usa `searchParams.getAll('sslmode')` e exige exatamente um valor (`require`, `verify-ca` ou `verify-full`).
- **Teste:** caso "sslmode repetido (require e depois disable)" em `tests/domain/env.test.js` (falhou antes, passa depois).
- Revisado sem achado: `trust proxy` (só 0–10, nunca `true`), cabeçalhos/CSP, rate limits (após CSRF, por usuário/IP, sem bypass por caixa ou barra final), `statement_timeout` só no pool da app, seed com `ALLOW_DEMO_SEED=1` exato, favicon antes da sessão.
- Riscos aceitos: 429 em `POST /grupos` perde o formulário (P2); rate limit em memória; `style-src-attr 'unsafe-inline'` (P3); com `uselibpqcompat=true`, `sslmode=require` não verifica o certificado → usar `verify-full` no Neon (spec 020); pooler do Neon pode recusar `statement_timeout` (spec 020); `TRUST_PROXY=0` atrás de proxy gera aviso do `express-rate-limit`.
- Para o QA no navegador: CA4, CA5, CA14, CA15. Docs a atualizar com seu OK: AGENTS §3, §9, §10.

## QA
APROVADO (CA1–CA15). `npm test` 852/852 (55 arquivos); lint e prettier ok; `npm audit --omit=dev` sem vulnerabilidades; migrate duas vezes sem erro e seed idempotente. Detalhes em `docs/qa/019-endurecimento-producao.md`.
- Chrome com JS: páginas principais, filtro ao vivo, modal, 422 de `/grupos/novo`, pin do mapa e página de CSRF sem nenhuma violação de CSP; fontes e `--z` aplicados (CA4). 403 de CSRF: "Atualizar e tentar de novo" volta a `/grupos/novo`, não à home (CA5).
- Rate limit via `curl`: `GET /grupos` 120×200 + 5×429 (página genérica, `Retry-After`); `/api/grupos` 300×200 + 1×429 (JSON, `no-store`) (CA6, CA7).
- Favicon: `<link rel="icon">`, `/favicon.svg` 200 `image/svg+xml`, `/favicon.ico` 301, sem 404 no console (CA14). CSP e demais cabeçalhos idênticos à tabela da spec (CA2, CA3).
- Sem JS e 360 px: tudo 200; rotas protegidas redirecionam para `/conta/entrar?next=…` (CA15).
- Não bloqueante: home sem JS com scroll horizontal (+15 px a 360 px) por `.hdr-actions`, idêntico ao HEAD (não é regressão); contador de caracteres de `/grupos/novo` não localizado pelo script (checagem manual); 2º passo da exclusão em `/meus` não clicado (link `/meus?excluir=1`, sem JS).
- Ambiente sem Docker: usado o Postgres local.
