# 020 — Deploy em produção (Render + Neon)
Marco: M8 · Status: pronta para Coder (revisada para 100% gratuito; aguarda OK do usuário em P1–P11)
Depende de: 019 (aprovada no QA): `TRUST_PROXY`, `sslmode` obrigatório em produção, `statement_timeout` 5 s no pool da app, `ALLOW_DEMO_SEED=1`.

## Objetivo
Publicar o site a **custo zero** (decisão do usuário, 2026-11-17: nada de plano pago): `render.yaml` (Web Service Node no plano **Free** do Render), banco no **Neon Free** pela conexão **direta**, rota de healthcheck, pool do `pg` que sobrevive ao compute do Neon suspenso, desligamento gracioso no deploy, trava contra rodar o migrate pelo pooler, passo a passo de deploy (com hibernação e cold start documentados) e docs atualizadas (AGENTS §3/§9/§10, README). O M8 só termina com o QA no ambiente publicado (CA7–CA13, incluindo CA8b).

## Fora do escopo
- Serviço de staging no Render e preview environments (P8). Branch do Neon só sob demanda, para ensaiar migration.
- Domínio próprio (P7).
- Pooler do Neon (`-pooler`) para a app (P3). Store de rate limit compartilhado (segue em memória, 1 instância).
- `lock_timeout` no `pg_advisory_lock` do migrate: o Render serializa os deploys do serviço, então só um migrate manual concorreria. A pendência continua aberta em `PENDENCIAS.md` (M8).
- `ensureTestDb` com host remoto, `pg_isready -h` do docker-compose, scroll horizontal da home sem JS (`.hdr-actions`), texto do rodapé condicionado a `hasDemo`: seguem abertos.
- Mudar texto de UI. `/sobre` e rodapé já estão corretos (nenhum diz "Nenhum dado é enviado a servidores"; banco e login já estão como ATIVO): **nada muda neles**.
- Monitoramento/alertas externos e backups além do histórico do Neon. O ping externo gratuito (UptimeRobot etc.) é só **sugestão opcional** no `DEPLOY.md`: sem código e sem conta criada pelo pipeline.
- Qualquer serviço ou plano pago (Render Starter, Postgres do Render, Neon pago): fora, por decisão do usuário.
- Retentativa de consulta no código (retry com backoff) para o wake do Neon: só se o QA mostrar erro real (ver "Pool" em Mudanças).

## Mudanças

### Banco
Nenhuma migration. A tabela `session` vem da migration 005 (`createTableIfMissing: false`) e o `citext` da 001: o `npm run migrate` do build cria os dois no Neon. O CA9 confere.

### `render.yaml` (novo, raiz)
```yaml
# Blueprint do Render. Segredos ficam fora do git: DATABASE_URL é pedido no painel (sync: false).
services:
  - type: web
    name: pace-paulista
    runtime: node
    region: virginia          # P2: mesma região AWS do Neon (us-east-1)
    plan: free                # P1: custo zero; hiberna após ~15 min sem tráfego
    branch: main
    # Free não tem preDeployCommand: migrate e seed rodam no build. Se falharem, o build falha
    # e a versão anterior continua no ar. DATABASE_URL e os demais envs existem durante o build.
    buildCommand: npm ci && npm run migrate && npm run seed   # P4
    startCommand: npm start
    healthCheckPath: /healthz
    autoDeployTrigger: checksPass                       # P6: só depois do CI verde
    envVars:
      - key: NODE_ENV
        value: production
      - key: NODE_VERSION
        value: "22"           # engines ">=22" faria o Render escolher a versão mais nova
      - key: TZ_APP
        value: America/Sao_Paulo
      - key: TRUST_PROXY
        value: "1"
      - key: ALLOW_DEMO_SEED
        value: "1"            # P4: produção sobe com os demos (decisão de 2026-11-17)
      - key: SESSION_SECRET
        generateValue: true   # 256 bits em base64 (44 caracteres, sem espaços)
      - key: DATABASE_URL
        sync: false           # conexão DIRETA do Neon com ?sslmode=verify-full
```
- Comentários do arquivo em pt-BR, só o porquê (como acima).
- `npm ci` roda com `NODE_ENV=production` → o npm omite devDependencies; `migrate` e `seed` só usam dependências de produção (`pg`, `dotenv`, `zod`), então rodam no mesmo comando. Como `NODE_ENV=production` já vale no build, `env.js` valida `DATABASE_URL` (`sslmode`), `SESSION_SECRET` e `TRUST_PROXY` **durante o build**: um erro de configuração falha o build, sem tocar no banco.
- O build precisa enxergar `DATABASE_URL`, `ALLOW_DEMO_SEED` e `SESSION_SECRET` (variáveis de serviço ficam disponíveis no build; incerteza a confirmar no 1º deploy: se o Render não expuser alguma no build, o log mostra "Variáveis de ambiente inválidas: …" e o Coder/usuário registram no relatório; **não** criar workaround com segredo no repositório).
- Consequência do migrate no build (sem pre-deploy): a migration é aplicada **antes** de a nova versão subir, enquanto a versão antiga ainda atende. Migrations devem ser compatíveis com o código anterior (expand/contract) — regra registrada no `DEPLOY.md`.
- Se o schema do Blueprint não aceitar `autoDeployTrigger` no plano Free, usar `autoDeploy: true` e registrar no relatório (o Coder não decide outro comportamento). `healthCheckPath` também é conferido no 1º deploy (incerteza abaixo).

### Pool resiliente ao Neon Free — `src/db/pool.js`
O Neon Free **suspende o compute após ~5 min sem conexões ativas** e acorda na 1ª conexão (tipicamente 0,5–2 s, às vezes mais). Requisitos:
1. **`pool.on('error')`** já existe em `createPool` (conexão ociosa derrubada pelo servidor não mata o processo): **manter** e cobrir com teste. O `pg` remove do pool o cliente que emitiu `error`, então a próxima consulta abre conexão nova.
2. **`connectionTimeoutMillis` 5000 → 15000** em todos os pools (constante `CONNECTION_TIMEOUT_MS`), para cobrir o wake do Neon sem erro (o limite de 5 s dava margem curta; o do build também, porque o migrate acorda o banco). Fica acima do `statement_timeout` de propósito: este conta só a **execução** da consulta (começa depois da conexão), então um wake lento não o consome. `scripts/cli.js` não muda (identifica o timeout pela mensagem do pg-pool, independente do valor).
3. **`idleTimeoutMillis`**: manter o padrão do `pg` (10 s): conexões ociosas fecham antes de o Neon suspender, então raramente sobra conexão morta no pool. Sem `keepAlive` extra.
4. Sem retry no código (Fora do escopo): se a 1ª requisição após a suspensão falhar mesmo assim, ela cai no `errorHandler` (500 "Algo deu errado") e a seguinte funciona; o QA registra se acontecer (CA9).
5. Nenhuma mudança no `statement_timeout` de 5 s (continua só no pool da app; migrate/seed sem limite).

### Healthcheck — `src/app.js`
- `app.get('/healthz', (req, res) => res.type('text/plain').set('Cache-Control', 'no-store').send('ok'))`, registrado **logo depois do `securityHeaders` e antes do `express.static`** (antes de sessão, CSRF e rate limit: não cria cookie nem consulta o banco; `app.get` cobre `HEAD`).
- Não consulta o banco (P5): com o Neon hibernando, um `SELECT 1` a cada checagem do Render manteria o banco acordado 24 h; reiniciar a app também não conserta banco fora do ar. Comentário curto no código com esse porquê.

### Migrate só pela conexão direta — `scripts/migrate.js`
- `export function assertDirectConnection(connectionString)`: se o primeiro rótulo do host terminar em `-pooler` (ex.: `ep-x-123-pooler.us-east-1.aws.neon.tech`), lança `Error` com a mensagem da tabela abaixo. Não conecta, não ecoa a URL.
- O bloco `isMain` chama `assertDirectConnection(connectionString)` antes de `createPool`; o erro sai pelo mesmo caminho dos demais (stderr + `exitCode = 1`) → o build falha e o Render mantém a versão anterior.
- `runMigrations` não muda.

### Desligamento gracioso — `src/lifecycle.js` (novo) e `src/server.js`
O Render manda `SIGTERM` à instância antiga a cada deploy; hoje o Node morre na hora e corta requisições (inclusive POSTs) em andamento.
- `export function gracefulShutdown({ server, pool, log = console.log, exit = process.exit, timeoutMs = 10_000 })` → devolve a função que trata o sinal:
  1. `log('Encerrando: aguardando requisições em andamento.')`;
  2. `server.close()` (para de aceitar conexões; espera as abertas);
  3. depois do `close`, `await pool.end()` e `exit(0)`;
  4. se passar `timeoutMs`, `exit(1)` (timer com `.unref()`);
  5. chamada repetida (2º sinal) não faz nada.
- `server.js`: `const server = app.listen(...)`; `process.once('SIGTERM', handler)` e `process.once('SIGINT', handler)` com o mesmo `handler = gracefulShutdown({ server, pool })`. Importa `pool` de `db/pool.js`.
- Sem SQL; o `app.js` só ganha o healthcheck.

### `.env.example`
Acrescentar, comentada, depois de `DATABASE_URL`:
`# Produção (Neon): conexão direta (host sem -pooler) e ?sslmode=verify-full. Ver docs/DEPLOY.md.`

### Docs
- **`docs/DEPLOY.md` (novo)** — passo a passo para o usuário, curto:
  0. **Custo zero**: tudo no plano Free (Render Web Service Free + Neon Free); nenhum cartão necessário. Limites conhecidos: 1 serviço Free no Render (basta; 750 h/mês de instância cobrem um serviço 24 h, ~744 h), Neon Free com 0,5 GB e horas de compute limitadas.
  1. **Neon**: projeto `pace-paulista`, **Postgres 16** (igual a dev/CI), região **AWS US East (N. Virginia)**, plano Free (P9). Copiar a connection string com "Connection pooling" **desligado** (host sem `-pooler`) e trocar os parâmetros por `?sslmode=verify-full` (P10).
  2. **Render**: New → Blueprint → este repositório (`render.yaml`); colar a URL do passo 1 em `DATABASE_URL`. O 1º deploy roda `npm ci && npm run migrate && npm run seed` no **build** (Free não tem pre-deploy) e só troca a versão depois de `/healthz` responder.
  3. **Conferir no SQL Editor do Neon** (as consultas do CA9).
  4. **Hibernação e cold start (leia)**: no Free o Render **hiberna o serviço após ~15 min sem tráfego**; a 1ª visita depois disso espera ~50 s (o Render mostra uma tela de carregamento) e depois fica normal. O Neon também suspende o banco após ~5 min ocioso e acorda sozinho (1–2 s a mais na 1ª consulta). Efeitos: o limite de requisições (em memória) zera a cada hibernação; sessões de login **não** se perdem (ficam no Postgres). Para o site não hibernar em horário de uso, **opcional e sem código**: um monitor gratuito (ex.: UptimeRobot, plano free, intervalo de 5 min) apontando para `https://<seu-serviço>.onrender.com/healthz`. Cuidados: mantém a instância acordada 24 h (~744 h/mês, abaixo das 750 h do Free, **só com este serviço**) e não mantém o Neon acordado (o `/healthz` não consulta o banco); confirmar nos termos atuais do Render que ping externo é permitido.
  5. **Operação**: deploy automático após CI verde na `main`; migrate com erro faz o build falhar e a versão anterior continua no ar; como a migration roda **antes** de a nova versão subir, ela precisa ser compatível com o código antigo (adicionar coluna/tabela em um deploy e só remover/renomear no seguinte); *Rollback* do Render volta o código, **não** o schema (migrations são só para frente; o Neon tem restauração por horário dentro do histórico do plano Free); trocar `SESSION_SECRET` desloga todo mundo; ensaiar migration arriscada numa branch do Neon rodando `npm run migrate` local com `NODE_ENV=development` e `DATABASE_URL` da branch (conexão direta).
  6. **M9**: para tirar os demos, remover `ALLOW_DEMO_SEED` **e** o `&& npm run seed` do `buildCommand` no `render.yaml` no mesmo PR (sem a flag o seed sai com código 1 e o build falha), depois apagar os demos.
- **AGENTS.md** (o OK desta spec vale como OK destes textos; `.claude/CLAUDE.md` não muda):
  - §3: incluir `render.yaml`, `docs/DEPLOY.md`, `src/lifecycle.js`, `src/middlewares/securityHeaders.js` (helmet/CSP), `src/middlewares/rateLimits.js`, `public/favicon.svg`; migrations até `006_groups_start_time_check.sql`.
  - §9: CSP com `style-src-attr 'unsafe-inline'` (cores das zonas e `--p` em `style="…"`; scripts e handlers inline continuam proibidos); `trust proxy` por `TRUST_PROXY` (1 em produção, nunca `true`); `DATABASE_URL` de produção exige `sslmode` `require`/`verify-ca`/`verify-full` (usar `verify-full`); rate limits da 019 resumidos (leitura 120/min por IP, API 300/min por IP, `POST /grupos` 20/h por usuário, participar/sair 60/15 min por usuário).
  - §10: `.env.example` com `TRUST_PROXY` e `ALLOW_DEMO_SEED` comentados; `npm run seed` bloqueado em produção **salvo `ALLOW_DEMO_SEED=1`**; o parágrafo "Deploy sugerido" vira: "Deploy (v1): Render (Web Service, `render.yaml`) + Neon (Postgres 16, conexão direta, `sslmode=verify-full`); plano Free; `npm run migrate && npm run seed` no build; healthcheck `GET /healthz`; o serviço hiberna após ~15 min ocioso (cold start ~50 s). Passo a passo em `docs/DEPLOY.md`."
- **README.md**: linha do M8 → "em andamento (specs 019–020)"; aviso da linha 27 sem "Falta a preparação para produção (M8)."; tabela de comandos: seed "(idempotente; em produção só com `ALLOW_DEMO_SEED=1`)"; nova seção curta "Produção" com link para `docs/DEPLOY.md`; "Dados de demonstração": trocar "se recusa a rodar com `NODE_ENV=production`, para não irem parar no site publicado" por "só roda em produção com `ALLOW_DEMO_SEED=1`: o site publicado sobe com os demos e o aviso “Versão de demonstração” até o M9"; estrutura: migrations `(001–006)`.
- Não editar `MILESTONES.md`/`PENDENCIAS.md` (orquestrador).

## Regras e mensagens
| Item | Regra | Valor / mensagem exata |
|---|---|---|
| `GET /healthz` | sem sessão, sem banco, sem rate limit | `200`, `Content-Type: text/plain; charset=utf-8`, corpo `ok`, `Cache-Control: no-store` |
| Migrate pelo pooler | 1º rótulo do host termina em `-pooler` | `O migrate precisa da conexão direta do Neon (host sem -pooler): o pg_advisory_lock não funciona pelo pooler.` (código de saída 1) |
| Timeout de conexão do pool | todos os pools (app, migrate, seed) | `connectionTimeoutMillis` 15000 (cobre o wake do Neon Free); `statement_timeout` da app segue 5000 |
| SIGTERM/SIGINT | fecha servidor → `pool.end()` → saída 0; estoura 10 s → saída 1 | log `Encerrando: aguardando requisições em andamento.` |
| `DATABASE_URL` (Render) | conexão direta, `?sslmode=verify-full` | validação de produção da 019 (sem mudança) |
| `SESSION_SECRET` (Render) | `generateValue: true` | — |

## Critérios de aceite
Locais (Coder/QA antes do merge):
- [ ] CA1 — **render.yaml**: existe na raiz com exatamente os campos da seção Mudanças (`plan: free`, **sem** `preDeployCommand`, `buildCommand: npm ci && npm run migrate && npm run seed`); nenhum segredo no arquivo (`DATABASE_URL` com `sync: false`, `SESSION_SECRET` com `generateValue: true`); nenhum campo de plano pago.
- [ ] CA2 — **Healthcheck**: `GET /healthz` e `HEAD /healthz` → 200 `ok` `text/plain`, `Cache-Control: no-store`, sem `Set-Cookie`, com os cabeçalhos do helmet (CSP, `nosniff`); responde 200 com o banco indisponível; com `rateLimits` de teste `{ read: { limit: 1 } }` continua 200 após várias chamadas.
- [ ] CA3 — **Migrate x pooler**: `assertDirectConnection` lança a mensagem exata para `postgresql://u:p@ep-x-123-pooler.us-east-1.aws.neon.tech/neondb?sslmode=verify-full` (a mensagem não contém credenciais nem o host) e aceita o mesmo host sem `-pooler` e `localhost`. `npm run migrate` local continua igual.
- [ ] CA4 — **Desligamento gracioso**: com `server`/`pool` falsos, o handler chama `server.close`, depois `pool.end` e `exit(0)`; se o `close` não terminar em `timeoutMs`, `exit(1)`; 2ª chamada não repete nada. Por inspeção: `server.js` registra `SIGTERM` e `SIGINT`.
- [ ] CA5 — **Docs**: `docs/DEPLOY.md`, AGENTS §3/§9/§10, README e `.env.example` com os textos da seção Docs; `/sobre` e rodapé intactos.
- [ ] CA5b — **Pool resiliente**: `createPool` usa `connectionTimeoutMillis` 15000 e mantém o listener `error`; um `error` emitido numa conexão ociosa do pool **não** derruba o processo nem impede a consulta seguinte (que abre conexão nova); `statement_timeout` da app continua `5s`; migrate/seed continuam `0`.
- [ ] CA6 — **Regressão**: `npm test` e `npm run lint` passam; `npm audit --omit=dev` sem vulnerabilidade; nenhuma dependência nova; nada de SQL fora de `*.repo.js` (o migrate segue como está); sem mudança de texto de UI; funciona sem JS e em 360 px como antes.

No ambiente publicado (QA depois que o usuário seguir `docs/DEPLOY.md`; ver Riscos):
- [ ] CA7 — **Deploy no Free**: o 1º deploy passa por build (o **log de build** mostra `6 migration(s) aplicada(s)`, `Seed: 11 de 11 grupos demo inseridos` e `Produção: grupos demo publicados por ALLOW_DEMO_SEED=1.`, ou seja, as variáveis estavam disponíveis no build) e healthcheck; um 2º deploy mostra `já está em dia (6 migrations)` e `0 de 11`. Os logs não mostram senha nem a URL completa do banco. Um build com `DATABASE_URL` sem `sslmode` (teste opcional) falha com `Variáveis de ambiente inválidas: DATABASE_URL` sem trocar a versão no ar. O painel não exibe nenhuma cobrança.
- [ ] CA8 — **HTTPS e cabeçalhos**: `http://…onrender.com/` redireciona para `https://`; a resposta traz `Strict-Transport-Security` e CSP com `upgrade-insecure-requests`; sem violação de CSP no console em `/`, `/grupos`, `/grupos/<slug>`, `/mapa`, `/encontrar` (com resultados).
- [ ] CA8b — **Hibernação e wake** (Render e Neon Free): deixar o serviço ocioso > 15 min; a 1ª requisição responde 200 (cold start de até ~1–2 min é aceito e anotado no relatório, com o tempo medido) e as seguintes em tempo normal; com o serviço acordado e o banco ocioso > 5 min (Neon suspenso), a 1ª página que consulta o banco responde 200 sem "Algo deu errado" (se der 500 uma vez, o QA registra como risco, não bloqueia: ver Riscos). `/healthz` não acorda o banco.
- [ ] CA9 — **Banco no Neon** (SQL Editor): `SELECT extname FROM pg_extension WHERE extname = 'citext'` → 1 linha; tabela `session` com `sid`/`sess`/`expire`; `SELECT count(*) FROM schema_migrations` → 6; `SHOW standard_conforming_strings` → `on` (o `ESCAPE '\'` da busca depende disso); `SELECT count(*) FROM groups WHERE is_demo` → 11; durante uma navegação, `SELECT ssl FROM pg_stat_ssl JOIN pg_stat_activity USING (pid) WHERE datname = current_database() AND pid <> pg_backend_pid()` → só `t`. Em `/grupos`, busca por nome `100%` responde 200 com 0 resultados (escape de `%` funcionando).
- [ ] CA10 — **Sessão atrás do proxy**: criar conta em produção → cookie `pp.sid` com `Secure`, `HttpOnly`, `SameSite=Lax`; sair e entrar de novo funciona; fluxo cadastrar grupo ("Teste QA <data>") → participar → sair → excluir conta funciona **sem JS** e com JS. Ao final o QA apaga o grupo de teste no SQL Editor (`DELETE FROM groups WHERE slug = '<slug>'`) e confirma que não sobrou usuário de teste.
- [ ] CA11 — **IP real do visitante** (P4 da 019): 121 `GET /grupos` seguidos do mesmo computador → a 121ª é 429; na mesma janela de 1 min, outra rede (ex.: celular no 4G) recebe 200; repetir com `X-Forwarded-For: 203.0.113.9` forjado continua 429. Se falhar, ajustar só `TRUST_PROXY` no painel (sem código) e registrar o valor no relatório.
- [ ] CA12 — **Demos e links**: home com "Versão de demonstração" e cards "Fictício · demo"; todos os links do cabeçalho, rodapé e home respondem 200 (deslogado, rotas protegidas → `/conta/entrar?next=…`); `/favicon.ico` → 301.
- [ ] CA13 — **Deploy automático**: um push na `main` com CI verde dispara deploy sozinho; durante a troca de versão, um loop de `curl /healthz` a cada 1 s é **observado e anotado** (o Free pode ter uma janela curta de indisponibilidade ou hibernação; não bloqueia o QA).

## Testes esperados
- http (`tests/http/seguranca.test.js`): `GET /healthz` 200 `ok`, `no-store`, sem `Set-Cookie`, com CSP; `HEAD` 200; não esgota com `{ read: { limit: 1 } }` (CA2).
- http (`tests/http/banco-indisponivel.test.js`): `GET /healthz` 200 com o repo mockado fora do ar (CA2).
- unit (`tests/scripts/migrate-errors.test.js`): `assertDirectConnection` recusa host `-pooler` com a mensagem exata e sem credenciais; aceita host direto (CA3).
- db (`tests/db/pool.test.js`, acrescentar): `pool.options.connectionTimeoutMillis === 15000`; emitir `error` num cliente ocioso (`pool.emit('error', …)` ou `client.emit` num cliente obtido e liberado) com `console.error` mockado não lança e `pool.query('SELECT 1')` seguinte funciona; `terminate` da conexão ociosa pelo servidor (`pg_terminate_backend` de um backend ocioso do próprio pool) seguido de nova consulta funciona (CA5b). Os testes de `5s`/`0` existentes ficam.
- unit (`tests/server/lifecycle.test.js`, novo; fora de `tests/domain/` porque `lifecycle.js` não é domínio): ordem `close → pool.end → exit(0)`; timeout → `exit(1)` (timers falsos do vitest); 2ª chamada ignorada (CA4).
- Inspeção: CA1, CA5. QA no ambiente publicado: CA7–CA13 (inclui CA8b).

## Riscos / perguntas em aberto

### Perguntas em aberto (com defaults; aguardar OK antes do Coder)
- **P1 — Plano do Render (decidido pelo usuário, 2026-11-17: sem custo).** **Free**. Consequências aceitas: hiberna após ~15 min sem tráfego (cold start ~50 s na 1ª visita); sem `preDeployCommand`, então migrate e seed vão no `buildCommand` (a migration é aplicada antes da nova versão subir, mesmo que o start/healthcheck falhe depois; por isso migrations devem ser compatíveis com o código anterior); sem Shell no painel (o SQL Editor do Neon cobre as conferências). Ping externo gratuito para evitar a hibernação é opcional (DEPLOY.md, passo 4).
- **P2 — Região.** Default: Render **virginia** + Neon **AWS us-east-1**, lado a lado (cada página faz várias consultas; banco em São Paulo com app nos EUA somaria ~120 ms por consulta). O Render não tem região na América do Sul; o visitante paga ~120 ms uma vez por página.
- **P3 — Conexão da app.** Default: a app usa a **mesma conexão direta** do migrate (uma instância, pool de até 10 conexões, bem abaixo do limite do Neon). Assim `statement_timeout` (parâmetro de conexão, que o pooler pode recusar) e `pg_advisory_lock` funcionam sem `ALTER ROLE` nem segunda variável. Pooler só se houver várias instâncias (aí: `MIGRATE_DATABASE_URL` direta + `ALTER ROLE … SET statement_timeout`, em outra spec).
- **P4 — Seed dos demos.** Default: `buildCommand: npm ci && npm run migrate && npm run seed` com `ALLOW_DEMO_SEED=1` no `render.yaml` (idempotente; banco novo já sobe com demos; a URL do banco não sai do Render). Alternativa: rodar o seed uma única vez da máquina do usuário (`NODE_ENV=production ALLOW_DEMO_SEED=1 DATABASE_URL=… npm run seed`) e deixar só o migrate no build. Efeito do default: demo apagado à mão volta no próximo deploy enquanto a flag existir (DEPLOY.md, passo 5).
- **P5 — Healthcheck sem banco.** Default: `/healthz` responde `ok` sem consultar o banco (não impede o Neon de hibernar). Alternativa: `SELECT 1` (detecta banco fora, mas mantém o compute ligado o tempo todo e gasta as horas do plano Free).
- **P6 — Deploy automático.** Default: a cada push na `main`, **só depois do CI verde** (`checksPass`). Alternativas: a cada commit (`commit`) ou manual (`off`).
- **P7 — Domínio.** Default: só `https://pace-paulista.onrender.com` (ou o nome que o Render der, se ocupado). Domínio próprio depois, sem código.
- **P8 — Staging.** Default: sem serviço de staging; branch do Neon sob demanda para ensaiar migration.
- **P9 — Plano do Neon (sem custo).** **Free**, o único plano usado. Suspende o compute após ~5 min ocioso (não dá para desligar no Free): o pool tolera isso (requisitos do "Pool resiliente"). Risco: a limpeza de sessões do `connect-pg-simple` (a cada 15 min, enquanto o serviço está acordado) reacorda o banco; com o ping externo do P1 o serviço fica acordado o mês todo e isso pode consumir mais horas de compute do Free. Acompanhar o consumo na 1ª semana; se apertar, aumentar `pruneSessionInterval` em produção (spec futura) ou desligar o ping. Limites do Free (armazenamento ~0,5 GB, horas de compute) devem ser conferidos na página de planos do Neon no dia do deploy.
- **P10 — Parâmetros SSL da URL.** Default: só `?sslmode=verify-full` (o Neon entrega `sslmode=require&channel_binding=require`; o `channel_binding` só fica se o QA confirmar que o `pg` conecta com ele). Certificado do Neon é público, sem CA extra.
- **P11 — Docs.** Default: o OK desta spec vale como OK dos textos de AGENTS §3/§9/§10, README e `docs/DEPLOY.md` descritos acima.

### Riscos / decisões técnicas
- **Ordem do QA**: CA1–CA6 antes do merge; CA7–CA13 exigem contas no Render/Neon (só o usuário cria) e o `render.yaml` na `main` → o QA do ambiente publicado roda **depois do merge e do passo a passo**, e é ele que fecha o M8 ("QA aprova em ambiente publicado"). Meta: quarta 25/11.
- Rate limit em memória zera a cada deploy **e a cada hibernação do Free**: aceito (010/011/019).
- Neon Free suspende após ~5 min: a 1ª consulta depois disso leva ~0,5–2 s (às vezes mais) e fica dentro do `connectionTimeoutMillis` de 15 s; o `statement_timeout` de 5 s não conta a conexão. Se mesmo assim a 1ª requisição der 500, é risco registrado (retry no código fica para outra spec).
- Render Free: hibernação após ~15 min e cold start ~50 s (documentado, sem código). 750 h/mês de instância por workspace: um serviço 24 h (~744 h) cabe; um **segundo** serviço Free (ex.: staging) não caberia com folga, por isso P8 = sem staging.
- Uma migration que trave esperando lock segura o build sem limite até o timeout do Render. `lock_timeout` segue pendente (Fora do escopo).
- **Incertezas do plano Free do Render a confirmar no 1º deploy (não testadas aqui; registrar no relatório):** (a) o `healthCheckPath` e o `autoDeployTrigger` são aceitos no Free; (b) as variáveis de ambiente (inclusive `sync: false` e `generateValue`) ficam disponíveis durante o **build**; (c) a troca de versão do Free não promete zero downtime (por isso o CA13 só observa); (d) o `region: virginia` está disponível para serviço Free; (e) limites e regras de ping externo contra a hibernação, nos termos atuais do Render.
- Seed com `ON CONFLICT (slug)`: se um demo for apagado e alguém cadastrar um grupo com o mesmo **nome**, o seed do próximo deploy dá `23505` e o deploy falha. Só acontece no M9 (tirar a flag junto com os demos evita).
- `npm audit` dos devDependencies (eslint/minimatch) segue aceito; não vão para produção.
- Pendências que esta spec resolve após o QA: M8 Neon (sslmode/direta/pooler/citext/`session`/branch), `render.yaml`/plano, "release exige `DATABASE_URL`/`SESSION_SECRET`/`citext`" (003), `ESCAPE '\'` × `standard_conforming_strings` (005), deploy automático, "não publicar antes de M3/M5" (CA12), docs AGENTS §3/§9/§10 (019).
