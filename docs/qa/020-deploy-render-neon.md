# QA — 020 Deploy em produção (Render + Neon)
Veredito: APROVADO (CA1–CA6 locais; CA7–CA13 pendentes de verificação manual no ambiente publicado)

| Critério | Resultado | Evidência |
|---|---|---|
| CA1 render.yaml | ✅ | Lido: `plan: free`, sem `preDeployCommand`, `buildCommand: npm ci && npm run migrate && npm run seed`, `DATABASE_URL` com `sync: false`, `SESSION_SECRET` com `generateValue: true`, sem segredo; `DIAG_IP` só em comentário |
| CA2 Healthcheck | ✅ | curl: `GET`/`HEAD /healthz` 200 `text/plain`, `Cache-Control: no-store`, sem `Set-Cookie`, CSP e `nosniff` presentes; testes http cobrem banco fora e rate limit |
| CA3 Migrate x pooler | ✅ | Testes `tests/scripts/migrate-errors.test.js` verdes; `npm run migrate` duas vezes: "já está em dia (6 migrations)" |
| CA4 Desligamento gracioso | ✅ | `tests/server/lifecycle.test.js` verde; `server.js` registra SIGTERM e SIGINT; log exato presente |
| CA5 Docs | ✅ | `docs/DEPLOY.md` existe; AGENTS tem "Deploy (v1)"; README linka DEPLOY.md; `/sobre` responde 200 |
| CA5b Pool resiliente | ✅ | `tests/db/pool.test.js` verde (suíte completa) |
| CA6 Regressão | ✅ | `npm audit --omit=dev`: 0 vulnerabilidades; `package.json` sem mudança; home, `/grupos`, `/grupos?nome=100%`, detalhe do grupo demo, `/zonas`, `/mapa`, `/encontrar`, `/conta/entrar` respondem 200; `/meus` e `/grupos/novo` redirecionam para `/conta/entrar?next=…`; `/favicon.ico` 301 |
| CA11 `/diag/ip` (parte local) | ✅ | Com `DIAG_IP=1`: 200 com JSON (`ip`, `ips`, `trustProxy`, `xForwardedFor`, `socketRemoteAddress`, etc.); a 29ª chamada seguida já dá 429 (limite 30/min, somado às chamadas anteriores); sem a env: 404 |
| CA7–CA10, CA11 (429 na 121ª, outra rede, XFF forjado), CA12, CA13 | ⏳ | Pendentes de verificação manual no deploy real (Render/Neon) |

Testes: 872 passaram / 0 falharam (57 arquivos) · Lint: ok (eslint + prettier)

Ambiente: `npm ci` ok; `npm run db:up` falhou porque não há daemon Docker no sandbox, mas o Postgres local já estava de pé; migrate (2x) e seed idempotentes ok.

Não verificados: sem JS e 360 px não foram rodados com Playwright. Esta spec não altera UI nem textos, e os formulários e views não foram tocados. Testes de `diag-ip` passaram na 1ª execução, sem intermitência (o Hardener trabalha nesse arquivo em paralelo; a execução foi feita com o estado do disco no momento).

Problemas encontrados: nenhum.

Sugestões não bloqueantes
- Remover `/diag/ip` e `DIAG_IP` depois do diagnóstico do `TRUST_PROXY` (e referenciar no CA11).
- Rodar o QA do ambiente publicado (CA7–CA13) após o usuário seguir `docs/DEPLOY.md`, registrando o tempo de cold start (CA8b) e se o 1º acesso após o Neon suspender gera 500.
- Reexecutar este QA se o Hardener alterar `diagIp.js` ou `diag-ip.test.js` após esta rodada.
