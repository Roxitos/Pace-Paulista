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

## Coder
Spec 020 implementada. `npm test` 863/863 (56 arquivos), `npm run lint` e `npm audit --omit=dev` (0 vulnerabilidades) passam. Sem dependência nova, sem migration. Sem commit/push.
- Criados: `render.yaml`, `docs/DEPLOY.md`, `src/lifecycle.js`, `tests/server/lifecycle.test.js`.
- Alterados: `src/app.js` (`/healthz` sem banco, após `securityHeaders`, antes do `express.static`), `src/server.js` (SIGTERM/SIGINT → `gracefulShutdown`), `src/db/pool.js` (`CONNECTION_TIMEOUT_MS = 15000`), `scripts/migrate.js` (`assertDirectConnection` antes de `createPool`, `pool?.end()` no `finally`), `.env.example`, `AGENTS.md` (§3/§9/§10), `README.md`, testes de pool, segurança, banco-indisponível e migrate-errors.
- CA1 e CA5 por inspeção; CA2, CA3, CA4, CA5b e CA6 cobertos por testes; CA7–CA13 só no ambiente publicado (ficam para o QA, após o deploy).
- Base: a 019 (c404e17) não estava na branch; por decisão do usuário, `main` local foi avançada (fast-forward) para a 019 e a branch da 020 foi rebaseada sobre ela. Nada foi enviado ao remoto.
- Incertezas do Free a confirmar no 1º deploy: `healthCheckPath`/`autoDeployTrigger` (senão `autoDeploy: true`), env no build, região `virginia`, troca de versão.

## Cleaner
Dois ajustes, sem mudar comportamento (`npm test` 864 verdes, lint ok):
- `src/db/pool.js`: `CONNECTION_TIMEOUT_MS` deixou de ser exportada (só o próprio arquivo usa).
- `tests/http/seguranca.test.js`: o `for` com `if (method === 'get')` no teste do `/healthz` virou `it.each(['get', 'head'])`; a checagem do corpo `ok` ficou só em `banco-indisponivel.test.js`, que já a cobre. Status e cabeçalhos seguem checados para GET e HEAD (+1 teste).
- Restante do diff já estava limpo (sem `console.log`, sem imports sem uso, camadas respeitadas).

## Hardener
Revisou os commits do Coder (ffb226f) e do Cleaner (a5f0ab8). Três achados de baixa severidade, cada um com teste escrito antes (visto falhar) e depois corrigido. `npm test` 866 verdes, `npm run lint` ok, `npm audit --omit=dev` 0 vulnerabilidades. Sem commit/push.
- **Trava do migrate contra o pooler** (`scripts/migrate.js`): `assertDirectConnection` olhava só o host da URL, e o `pg` deixa `?host=` na query sobrescrevê-lo, então o `-pooler` passava e o `pg_advisory_lock` não funcionaria. Agora confere o host da URL e todos os `host` da query, sem diferenciar maiúsculas. Teste em `tests/scripts/migrate-errors.test.js`.
- **Desligamento** (`src/lifecycle.js`): se `pool.end()` falhasse, o erro ficava solto (stack trace e saída fora do caminho previsto). Agora loga `Erro ao fechar o pool do Postgres: <mensagem>` e sai com código 1. Teste em `tests/server/lifecycle.test.js`.
- **Documentação** (`docs/DEPLOY.md` §5): o ensaio de migration local com `NODE_ENV=development` agora lembra `?sslmode=verify-full` (fora de produção o `env.js` não exige).
- Sem achado: `/healthz` (antes de sessão/CSRF/rate limit, sem cookie, sem banco, `no-store`, helmet), `render.yaml` (sem segredos; `SESSION_SECRET` gerado com 44 caracteres), pool/SSL com `verify-full`, logs do migrate/seed sem URL nem senha, prazo de desligamento (10 s) coerente com `statement_timeout` (5 s) e os 30 s do Render.
- Riscos aceitos: (1) produção aceita `sslmode=require` por regra da 019/AGENTS §9; com `uselibpqcompat=true` o `pg` não verifica o certificado, e o `DEPLOY.md` manda usar `verify-full`; (2) **CA11 é o ponto crítico do deploy real**: se houver mais de um proxy na frente (ex.: Cloudflare), `TRUST_PROXY=1` faz todos dividirem o IP do proxy nos rate limits; a correção é só trocar `TRUST_PROXY` no painel.
- Pendente de deploy real: CA7–CA13 (inclusive CA8b), e `healthCheckPath`/`autoDeployTrigger`/região/env no build do plano Free.

## Coder (extra: diagnóstico do IP para o CA11)
Pedido do usuário para reduzir o risco do CA11 (quantos proxies o Render põe na frente; valor certo de `TRUST_PROXY`). `npm test` 872 verdes (57 arquivos), lint ok. Sem dependência nova, sem migration, sem commit/push.
- `GET /diag/ip` (`src/middlewares/diagIp.js`): só existe com `DIAG_IP=1` (desligada por padrão; sem ela a rota nem é registrada e dá o 404 normal). Registrada após `securityHeaders` e antes de static/sessão/CSRF (sem cookie, fora do rate limit de leitura). Limite próprio de 30/min por IP (429 em JSON, `no-store`).
- Resposta JSON `no-store` só com: `ip`, `ips`, `trustProxy`, `xForwardedFor`, `socketRemoteAddress`, `cfConnectingIp`, `trueClientIp`. Sem dump de `req.headers`, env ou URL do banco.
- `env.js`: `DIAG_IP` (só `'1'` liga). `createApp` ganhou a opção `diagIp` (default `env.DIAG_IP`).
- Testes: `tests/http/diag-ip.test.js` (404 sem a flag; campos, `no-store`, sem `Set-Cookie`; `X-Forwarded-For` forjado com trust proxy 1 e 2; sem vazar Cookie/Authorization; 31º pedido → 429) e `tests/domain/env.test.js`.
- Docs: `.env.example`, comentário no `render.yaml` (não ligada), `docs/DEPLOY.md` nova seção "Diagnóstico do IP (CA11)" (ligar no painel, abrir de duas redes, ler `ips`, desligar ao terminar). A spec 020 não foi alterada: o CA11 deve passar a apontar para essa seção.
- Próximo: Hardener antes do QA. Depois do diagnóstico, apagar `DIAG_IP` no painel (ou remover o router).

## Hardener (extra: `/diag/ip`)
Sem achado que exigisse correção; nenhum código alterado, nenhum teste novo. Testes de `diag-ip` e `env` (43) verdes e lint ok. Sondagem com teste temporário (já apagado):
- `xForwardedFor` cru ecoado (testado com `<script>`): JSON com `nosniff` e CSP, sem XSS; o valor só volta a quem enviou.
- GET/HEAD sem cookie; POST cai no CSRF (403) sem cookie; sem `DIAG_IP` → 404; `no-store` no 200 e no 429; só os 7 campos saem; ordem em `app.js` correta.
- Riscos aceitos: (1) o limite de 30/min usa `req.ip`, então girar `X-Forwarded-For` o contorna quando `TRUST_PROXY` está acima do nº real de proxies (justamente o cenário investigado; a rota não toca no banco e custa como o `/healthz`); (2) o teste "sem DIAG_IP" depende do env (falha se `DIAG_IP=1` no `.env` local); (3) remover a rota e a variável depois do diagnóstico.

## QA
**APROVADO** para CA1–CA6 e a parte local do CA11 (`docs/qa/020-deploy-render-neon.md`). `npm test` 872/872 (57 arquivos), lint ok, `npm audit --omit=dev` sem vulnerabilidades, `package.json` intacto. Migrate idempotente (6 migrations em dia) e seed idempotente (0 de 11). Páginas principais 200; `/meus` e `/grupos/novo` redirecionam para o login.
- Pendentes de verificação manual no deploy real: CA7–CA10, o 429 da 121ª chamada em `/grupos` (CA11), CA12 e CA13. Também registrar cold start e se o 1º acesso após o Neon suspender dá 500.
- Não rodados: Playwright/360 px (spec sem mudança de UI).
- Sugestão: remover `/diag/ip` e `DIAG_IP` após descobrir o `TRUST_PROXY`.

## Deploy real (2026-11-17)
Feito pelo usuário com o orquestrador guiando; verificações HTTP feitas do ambiente do chat.
- Neon: projeto recriado com **Postgres 16** (o padrão veio 18), AWS us-east-1, conexão direta com `sslmode=verify-full`. Render: Blueprint aplicado, plano Free, Virginia, build com migrate + seed ok; `healthCheckPath` e `autoDeployTrigger` aceitos.
- URL: `https://pace-paulista.onrender.com`. Páginas públicas 200; `/grupos/zona/sul` 301; `/meus` e `/grupos/novo` 302 para o login; 404 ok; 11 grupos demo e aviso "Versão de demonstração".
- Cabeçalhos: cookie `pp.sid` `HttpOnly; Secure; SameSite=Lax` (30 dias), CSP conforme a spec, HSTS, `nosniff`, `X-Frame-Options: DENY`, `no-store` nas páginas de conta; `/healthz` 200 `ok`, `no-store`, sem cookie.
- **CA11:** `/diag/ip` mostrou 3 saltos (Cloudflare → LB `10.x` → proxy local `::1`). Com `TRUST_PROXY=1` todo visitante virava `10.x` (limite compartilhado). Painel ajustado para **3**: `ip` = `cfConnectingIp`, `X-Forwarded-For` forjado ignorado, Wi-Fi e 4G com IPs diferentes. `DIAG_IP` apagada, `/diag/ip` → 404.
- Fluxo completo no navegador (criar conta → participar → Meus grupos → sair do grupo → sair → entrar → excluir conta): ok, segundo o usuário.
- Não verificado: 429 na 121ª chamada de `/grupos` (a saída do chat troca de IP a cada requisição); cold start medido; 1º acesso após o Neon suspender.
- Observação do usuário: nenhum e-mail na criação de conta. Esperado (e-mail fora da v1, AGENTS §1).
