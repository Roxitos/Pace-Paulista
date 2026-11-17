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
