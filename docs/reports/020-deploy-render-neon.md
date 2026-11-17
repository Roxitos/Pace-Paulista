# 020 — Deploy no Render + Neon (100% gratuito)

Spec: [`docs/specs/020-deploy-render-neon.md`](../specs/020-deploy-render-neon.md) · Marco: M8

## Specifier
Spec 020 escrita, segunda do M8 (deploy). Sem migration nem dependência nova. **Revisada em 2026-11-17:** o usuário decidiu não pagar nada, então Render **Free** + Neon **Free**.
- `render.yaml`: `plan: free`, virginia, branch main; **sem `preDeployCommand`** (não existe no Free): `buildCommand: npm ci && npm run migrate && npm run seed`; start `npm start`, healthcheck `/healthz`, `autoDeployTrigger: checksPass`; env `NODE_ENV=production`, `NODE_VERSION=22`, `TZ_APP`, `TRUST_PROXY=1`, `ALLOW_DEMO_SEED=1`, `SESSION_SECRET` gerado, `DATABASE_URL` com `sync: false`. `env.js` valida o ambiente já no build (erro de config falha o build antes de tocar no banco).
- Migrate no build: a migration roda antes da nova versão subir, enquanto a antiga atende; migrations precisam ser compatíveis com o código anterior (regra no `DEPLOY.md`).
- Pool resiliente ao Neon Free (suspende após ~5 min): manter o listener `error`; `connectionTimeoutMillis` 5000 → 15000 em todos os pools; `idleTimeoutMillis` padrão; `statement_timeout` de 5 s só na app (não conta a conexão); sem retry no código. Novo CA5b + testes em `tests/db/pool.test.js`.
- `GET /healthz` sem banco (não acorda o Neon), `assertDirectConnection` no migrate (recusa `-pooler`), `gracefulShutdown` em SIGTERM/SIGINT.
- Docs: `docs/DEPLOY.md` (passo 0 custo zero; passo 4 hibernação ~15 min e cold start ~50 s; ping externo gratuito como **sugestão opcional**, sem código), AGENTS §3/§9/§10, README, `.env.example`.
- Critérios: CA1–CA6 locais (+CA5b); CA7–CA13 no ambiente publicado; novo CA8b (hibernação/wake); CA7 confere o log de **build**; CA13 passa a só observar (Free sem promessa de zero downtime).
- 750 h/mês do Free: um serviço 24 h (~744 h) cabe; um segundo serviço (staging) não, por isso sem staging (P8).
- Perguntas com defaults: P1 **Free (decidido)**; P2 virginia + us-east-1; P3 conexão direta; P4 seed no build; P5 healthcheck sem banco; P6 deploy após CI verde; P7 só `*.onrender.com`; P8 sem staging; P9 Neon Free (sessões a cada 15 min reacordam o banco; ping externo aumenta o consumo); P10 só `verify-full`; P11 OK na spec vale para os textos de docs.
- Incertezas a confirmar no 1º deploy (não testadas): `healthCheckPath`/`autoDeployTrigger` aceitos no Free; env vars disponíveis no build; região `virginia` no Free; sem zero downtime garantido; regras de ping externo contra a hibernação.
- Alertas: seed só ignora conflito de slug (no M9, tirar a flag e `&& npm run seed` do `buildCommand` no mesmo PR); `lock_timeout` do migrate segue fora; rate limit em memória zera a cada hibernação.
