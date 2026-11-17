# 019 — Endurecimento para produção (proxy, helmet/CSP, rate limit, timeout, env, seed demo, favicon)
Marco: M8 · Status: pronta para Coder (aguarda OK do usuário em P1–P8)
Depende de: 018 (rota `GET /api/mapa/:slug`, em implementação). Implementar **depois do merge da 018**; esta spec não edita `pages.routes.js` nem `mapa.js`.

## Objetivo
Deixar o código pronto para rodar atrás do proxy do Render com o banco no Neon: IP e HTTPS corretos (`trust proxy`), cabeçalhos de segurança e CSP (helmet), rate limit nas rotas que consultam o banco ou escrevem, `statement_timeout` no pool da app, validação do ambiente de produção, seed demo liberado por flag explícita e favicon. Nenhuma mudança visual nem de texto de UI.

## Fora do escopo
- Infraestrutura e deploy (spec 020): `render.yaml`, `preDeployCommand`, healthcheck, plano do Render, projeto/branch no Neon, conexão direta × pooler, `citext` no Neon, `lock_timeout` do migrate, `ESCAPE '\'` × `standard_conforming_strings`, deploy automático.
- Trocar os `style="…"` do servidor por classes (decisão na **P3**: fica `style-src-attr 'unsafe-inline'`).
- Rate limit em `/`, `/zonas`, `/mapa`, `/mapa/:slug`, `/grupos/:slug`, `/sobre`, `/meus` (**P6**).
- Store de rate limit compartilhado (Redis/Postgres): continua em memória, uma instância.
- Texto próprio para 429 (**P2**) e para outros 4xx (pendência M5/M6 continua aberta).
- Mudar `/conta/criar` e `/conta/entrar`: os limitadores da 010/011 ficam como estão.

## Mudanças

### Dependência nova
- `helmet` (^8). Justificativa: já é a escolha do AGENTS §2 (“Segurança: helmet”) e §9; evita escrever à mão CSP, HSTS, `nosniff`, `X-Frame-Options` etc. Citar no PR.

### Banco
Nenhuma migration.

### Ambiente — `src/config/env.js`
1. **`TRUST_PROXY`** (novo): inteiro 0–10 (número de proxies na frente da app). `z.coerce` **não** serve (aceitaria `"true"`→NaN/`""`→0): aceitar só `^\d{1,2}$` até 10. Ausente ou vazio → **`1` em produção, `0` nos demais** (P4). Valor inválido → erro `Variáveis de ambiente inválidas: TRUST_PROXY`. Nunca `true` (express-rate-limit recusa e permite falsificar IP).
2. **`DATABASE_URL` em produção** precisa ter o parâmetro `sslmode` igual a `require`, `verify-ca` ou `verify-full` (P5). Sem ele, ou com `disable`/`allow`/`prefer`/outro → `invalid('DATABASE_URL')` (mesma mensagem de hoje, sem ecoar a URL). Dev e test não mudam.
3. **`SESSION_SECRET` em produção**: além do que já existe (≥ 32, não ser o de exemplo nem o de dev), exigir `value.trim().length >= 32` (hoje 32 espaços passam — risco aceito do 003, agora fechado).
4. Saída do `parseEnv` ganha `TRUST_PROXY` (número).
5. `.env.example`: acrescentar, comentadas, `# TRUST_PROXY=1` (com “número de proxies na frente da app; produção usa 1 por padrão”) e `# ALLOW_DEMO_SEED=1` (com “só para publicar os grupos demo em produção”).

### Pool — `src/db/pool.js`
- `createPool(connectionString, { statementTimeoutMs } = {})`: se informado, repassa `statement_timeout: statementTimeoutMs` à config do `pg.Pool` (parâmetro de conexão do node-postgres; o servidor cancela a consulta com `57014`).
- Constante `APP_STATEMENT_TIMEOUT_MS = 5000` (P7). **Só o pool da app** usa: `export const pool = createPool(connectionStringFor(env), { statementTimeoutMs: APP_STATEMENT_TIMEOUT_MS })`. `migrate.js`/`seed.js` continuam chamando `createPool(cs)` sem timeout (migration pode demorar).
- Comentário do porquê: lock longo em `groups` pendurava `/` e `/zonas` até o timeout do cliente.
- `57014` cai no `errorHandler` como erro do Postgres (500, log só com `code`), sem mudança lá.

### App — `src/app.js`
Ordem final (só o que muda está marcado ★):
```
app.disable('x-powered-by')
★ app.set('trust proxy', trustProxy)                 // createApp({ trustProxy = env.TRUST_PROXY })
★ app.use(securityHeaders(env))                       // helmet, antes do static: arquivos também recebem os cabeçalhos
app.use(express.static(...))
★ app.get('/favicon.ico', (req, res) => res.redirect(301, '/favicon.svg'))
urlencoded → session → currentUser → joinedGroups → csrfLocals → locals → csrfProtection
★ mountRateLimits(app, rateLimits)                    // createApp({ rateLimits = createRateLimits() })
pagesRouter → groupsRouter → matchingRouter → accountRouter → notFound → errorHandler
```
- `createApp({ beforeErrorHandlers, trustProxy, rateLimits } = {})`: as duas opções novas existem para os testes (mesmo padrão de `beforeErrorHandlers`); `server.js` não passa nenhuma. Um `createRateLimits()` por app → cada app de teste tem a própria memória (como o `createAccountRouter`).
- Com `trust proxy`, `req.ip` vem do `X-Forwarded-For` (1 salto) e `req.secure` do `X-Forwarded-Proto`: é o que faz o `express-session` enviar o cookie `secure` atrás do proxy do Render (sem isso, login não funciona em produção) e o que separa os visitantes nos limitadores (inclusive os de `/conta/*`, que não mudam de código).

### Cabeçalhos — `src/middlewares/securityHeaders.js` (novo)
`export function securityHeaders(env)` → `helmet({...})` com:
| Opção | Valor |
|---|---|
| `contentSecurityPolicy.useDefaults` | `false` (lista explícita abaixo, para a política ser exatamente a documentada) |
| `default-src` | `'self'` |
| `base-uri` | `'self'` |
| `connect-src` | `'self'` |
| `font-src` | `'self' https://fonts.gstatic.com` |
| `form-action` | `'self'` |
| `frame-ancestors` | `'none'` |
| `img-src` | `'self'` |
| `object-src` | `'none'` |
| `script-src` | `'self'` |
| `script-src-attr` | `'none'` |
| `style-src` | `'self' https://fonts.googleapis.com` |
| `style-src-attr` | `'unsafe-inline'` (P3, justificativa abaixo) |
| `upgrade-insecure-requests` | só com `NODE_ENV=production` |
| `strictTransportSecurity` | só em produção (padrão do helmet: 365 dias, `includeSubDomains`, sem `preload`); fora dela `false` |
| `referrerPolicy` | `{ policy: 'same-origin' }` — **não** o `no-referrer` padrão do helmet: o `errorHandler` usa o `Referer` do mesmo host no botão “Atualizar e tentar de novo” da página de CSRF (spec 009) |
| `frameguard` | `{ action: 'deny' }` (navegadores sem `frame-ancestors`) |
| demais | padrão do helmet 8 (`nosniff`, `Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Resource-Policy: same-origin`, `X-DNS-Prefetch-Control: off`, `Origin-Agent-Cluster` etc.) |

**Justificativa de `style-src-attr 'unsafe-inline'`** (comentário curto no código + texto no PR):
- Há ~45 `style="…"` nas views (cor da zona `zstyle(z)`, `--p` do placar de compatibilidade, ajustes de espaçamento copiados do protótipo) e o HTML que o JS insere por `innerHTML` (`/api/grupos`, `/api/mapa/:slug`, esqueleto do `filtros.js`) também os traz. Trocar tudo por classes é um diff grande com risco de regressão visual, e `--p` (0–100) precisaria de 101 classes.
- Os valores vêm de constantes (`ZONAS`) ou números calculados no servidor, nunca de texto do usuário, e o EJS escapa atributos.
- O que a CSP precisa barrar continua barrado: `<script>` inline e handlers `on*` (`script-src 'self'`, `script-src-attr 'none'`), `<style>` injetado (`style-src` sem `unsafe-inline` vale para elementos), carregamento externo por `url()` em atributo (`img-src`/`font-src` restritos).
- `element.style.setProperty` do `participar.js` (CSSOM) não depende de CSP.

### Rate limit — `src/middlewares/rateLimits.js` (novo)
```js
export const RATE_LIMITS = {
  read:       { windowMs: 60_000,      limit: 120 }, // GET /grupos, GET /encontrar — chave: IP
  api:        { windowMs: 60_000,      limit: 300 }, // GET /api/grupos, GET /api/mapa/:slug — chave: IP
  createGroup:{ windowMs: 3_600_000,   limit: 20  }, // POST /grupos — chave: usuário (ou IP)
  membership: { windowMs: 900_000,     limit: 60  }, // POST /grupos/:slug/participar e /sair (mesmo balde) — chave: usuário (ou IP)
};
export function createRateLimits(overrides = {}) → { read, api, createGroup, membership } // middlewares
export function mountRateLimits(app, limits) // registra os app.get/app.post abaixo
```
- Cada um é um `rateLimit({ windowMs, limit, standardHeaders: 'draft-8', legacyHeaders: false, keyGenerator, handler })`; `overrides` mescla por chave (`{ read: { limit: 2 } }`) para os testes.
- `keyGenerator`: `read`/`api` → `ipKeyGenerator(req.ip)`; `createGroup`/`membership` → `req.user ? \`u:${req.user.id}\` : ipKeyGenerator(req.ip)` (logado não é afetado por outros no mesmo IP/CGNAT; deslogado é redirecionado pelo `requireAuth` logo depois).
- `handler`:
  - páginas e POSTs: `next(Object.assign(new Error('Muitas requisições.'), { status: 429 }))` → `errorHandler` renderiza a página genérica de erro com status **429** (P2), sem log (é 4xx).
  - `api`: `res.status(429).set('Cache-Control', 'private, no-store').json({ error: 'rate_limited' })`. O `filtros.js`/`mapa.js` já tratam não-2xx caindo na navegação normal (que usa o balde `read` ou nenhum).
- `mountRateLimits` (caminhos exatos; `app.get` cobre `HEAD`):
  - `app.get('/grupos', read)`, `app.get('/encontrar', read)`
  - `app.get('/api/grupos', api)`, `app.get('/api/mapa/:slug', api)`
  - `app.post('/grupos', createGroup)`
  - `app.post('/grupos/:slug/participar', membership)`, `app.post('/grupos/:slug/sair', membership)`
- Montado **depois** do `csrfProtection` (POST sem token dá 403 e não conta, como em `/conta/*`) e do `currentUser` (precisa de `req.user`). Não usar `app.use('/grupos', …)` (pegaria `/grupos/:slug` e `/grupos/novo`).
- `/conta/criar` e `/conta/entrar` não passam por nenhum limitador novo.

### Seed — `scripts/seed.js`
- `runSeed({ pool, nodeEnv, allowDemoSeed = false, groups })`: bloqueia só se `nodeEnv === 'production' && !allowDemoSeed`.
- `export function demoSeedAllowed(value)` → `value === '1'` (só o texto exato `1`; `true`, `yes`, vazio → não).
- `main()`: o bloqueio antes de validar o ambiente passa a ser `NODE_ENV === 'production' && !demoSeedAllowed(process.env.ALLOW_DEMO_SEED)`; repassa `allowDemoSeed` ao `runSeed`. Em produção liberado, depois da linha de sempre (`Seed: N de 11 grupos demo inseridos (…)`) imprime `Produção: grupos demo publicados por ALLOW_DEMO_SEED=1.`
- Mensagem de bloqueio (constante, mantém o início literal que o teste atual procura): `Seed de demonstração bloqueado em produção (NODE_ENV=production). Para publicar os grupos demo mesmo assim, rode com ALLOW_DEMO_SEED=1.`
- Nada muda nos grupos: continuam `is_demo = true`, `status = 'published'`, idempotente; o aviso “Versão de demonstração” (home, `hasDemo`) e a etiqueta “Fictício · demo” aparecem sozinhos.

### Favicon
- `public/favicon.svg` (novo): o SVG da marca do cabeçalho (`header.ejs`, linha 5) **copiado literalmente**, com `xmlns="http://www.w3.org/2000/svg"` e sem `aria-hidden`.
- `src/views/layout.ejs`: `<link rel="icon" href="/favicon.svg" type="image/svg+xml">` logo depois do `<title>`.
- `GET /favicon.ico` → 301 para `/favicon.svg` (em `app.js`, ver acima): navegadores/robôs que pedem o `.ico` sem ler o `<link>` deixam de gerar 404.

### Views e JS do cliente
Só o `<link rel="icon">` do layout. Nenhum `style=` muda; nenhum JS muda.

## Regras e mensagens
| Item | Regra | Valor / mensagem exata |
|---|---|---|
| `TRUST_PROXY` | `^\d{1,2}$`, 0–10; ausente → 1 (produção) / 0 | `Variáveis de ambiente inválidas: TRUST_PROXY` |
| `DATABASE_URL` (produção) | `sslmode` ∈ `require`, `verify-ca`, `verify-full` | `Variáveis de ambiente inválidas: DATABASE_URL` |
| `SESSION_SECRET` (produção) | `trim().length >= 32`, ≠ exemplo/dev | `Variáveis de ambiente inválidas: SESSION_SECRET` |
| Seed em produção sem flag | `ALLOW_DEMO_SEED !== '1'` | `Seed de demonstração bloqueado em produção (NODE_ENV=production). Para publicar os grupos demo mesmo assim, rode com ALLOW_DEMO_SEED=1.` (código de saída 1) |
| Seed em produção com flag | `ALLOW_DEMO_SEED=1` | linha de sempre + `Produção: grupos demo publicados por ALLOW_DEMO_SEED=1.` |
| 429 em página/POST | `read`, `createGroup`, `membership` | página genérica de erro (“Ops” · “Algo deu errado” · “Tivemos um problema ao carregar esta página. Tente de novo em instantes.”), status 429, cabeçalho `Retry-After` |
| 429 na API | `api` | JSON `{"error":"rate_limited"}`, `Cache-Control: private, no-store`, `Retry-After` |
| `statement_timeout` | pool da app | 5000 ms; migrate/seed sem limite |
| CSP | todas as respostas | ver tabela de `securityHeaders` |

## Critérios de aceite
- [ ] CA1 — **trust proxy**: com `createApp({ trustProxy: 1 })`, requisição com `X-Forwarded-For: 203.0.113.7` e `X-Forwarded-Proto: https` tem `req.ip === '203.0.113.7'` e `req.secure === true`; com `trustProxy: 0` o cabeçalho é ignorado. `env.TRUST_PROXY` é 1 em produção e 0 em dev/test quando ausente; `true`, `-1`, `11` e `abc` são recusados.
- [ ] CA2 — **CSP**: `GET /` responde `Content-Security-Policy` com exatamente as diretivas da tabela (fora de produção sem `upgrade-insecure-requests`); `GET /css/app.css` e `GET /api/grupos` também trazem CSP e `X-Content-Type-Options: nosniff`.
- [ ] CA3 — **Demais cabeçalhos**: `X-Frame-Options: DENY`, `Referrer-Policy: same-origin`, sem `X-Powered-By`; `Strict-Transport-Security` ausente fora de produção e presente quando `securityHeaders({ NODE_ENV: 'production' })` (junto com `upgrade-insecure-requests`).
- [ ] CA4 — **Sem violação de CSP no navegador** (QA, Chromium com JS, console aberto): `/`, `/grupos` (filtro ao vivo, chips, limpar), `/grupos/<slug>` (modal “Entrar no grupo”, toasts), `/grupos/novo` (contador de caracteres, erro 422), `/mapa` (selecionar sem recarregar, 018), `/encontrar` com resultados, `/zonas`, `/sobre`, `/meus` (2º passo da exclusão), `/conta/entrar`, `/conta/criar`, 404 e a página de CSRF — nenhum erro de CSP, fontes Anton/Inter/JetBrains Mono carregadas, cores das zonas e placar `--p` iguais aos de antes.
- [ ] CA5 — **Referer preservado**: com o navegador, um POST com token vencido leva à página “Sessão expirada” cujo “Atualizar e tentar de novo” volta à página do formulário (não à home). Teste HTTP da 009 continua passando.
- [ ] CA6 — **Rate limit de leitura**: com `rateLimits` de teste `{ read: { limit: 2 } }`, a 3ª `GET /grupos` do mesmo IP responde 429 HTML com o título “Algo deu errado” e `Retry-After`; `GET /zonas` e `GET /grupos/<slug>` continuam 200; `/encontrar` usa o mesmo balde `read`.
- [ ] CA7 — **Rate limit da API**: com `{ api: { limit: 2 } }`, a 3ª `GET /api/grupos` responde 429 JSON `{"error":"rate_limited"}`; `/api/mapa/:slug` divide o mesmo balde; esgotar `api` não afeta `GET /grupos` (baldes separados).
- [ ] CA8 — **Rate limit por usuário**: com `{ membership: { limit: 2 } }`, o usuário A recebe 429 no 3º POST entre `participar`/`sair`; o usuário B, do mesmo IP, ainda recebe 303. Com `{ createGroup: { limit: 1 } }`, o 2º `POST /grupos` do mesmo usuário (com CSRF válido) responde 429. POST sem token CSRF continua 403 e não consome o balde.
- [ ] CA9 — **IPs separados atrás do proxy**: com `trustProxy: 1` e `{ read: { limit: 1 } }`, `X-Forwarded-For` diferentes não compartilham o balde; com `trustProxy: 0`, compartilham.
- [ ] CA10 — **`/conta/*` intactos**: os testes de limite de `/conta/criar` (10/15 min por IP) e `/conta/entrar` (10/15 min por IP+e-mail, só falhas) passam sem alteração.
- [ ] CA11 — **statement_timeout**: no pool da app `SHOW statement_timeout` → `5s`; um pool criado com `createPool(url, { statementTimeoutMs: 100 })` falha `SELECT pg_sleep(1)` com código `57014`; `createPool(url)` (migrate/seed) → `0`.
- [ ] CA12 — **Env de produção**: `parseEnv` em produção recusa `DATABASE_URL` sem `sslmode` e com `sslmode=disable`/`prefer`, aceita `?sslmode=require` e `?sslmode=verify-full&channel_binding=require`; recusa `SESSION_SECRET` de 32+ espaços. A mensagem de erro não contém a URL nem o segredo. Dev/test sem mudança (testes atuais passam).
- [ ] CA13 — **Seed**: `runSeed({ nodeEnv: 'production' })` continua recusando sem tocar no pool (teste atual); `runSeed({ nodeEnv: 'production', allowDemoSeed: true })` insere os 11 demos (idempotente na 2ª vez); `demoSeedAllowed('1')` → true, `'true'`/`''`/`undefined` → false. Depois do seed liberado, a home mostra “Versão de demonstração” e os cards “Fictício · demo”.
- [ ] CA14 — **Favicon**: layout tem `<link rel="icon" href="/favicon.svg" type="image/svg+xml">`; `GET /favicon.svg` → 200 `image/svg+xml`; `GET /favicon.ico` → 301 `Location: /favicon.svg`. No navegador, nenhum 404 de favicon no console.
- [ ] CA15 — Funciona **sem JS** (todas as páginas e forms como antes; 429 é página normal); responsivo em 360 px sem scroll horizontal novo; nenhum texto de UI muda; nada de SQL fora de `*.repo.js`; `npm test` e `npm run lint` passam; `npm audit --omit=dev` sem vulnerabilidade nova trazida pelo `helmet`.

## Testes esperados
- unit (`tests/domain/env.test.js`, acrescentar): `TRUST_PROXY` padrão por ambiente + 1 valor válido + recusa de `true`; produção sem `sslmode` / `sslmode=disable` recusados, `require` aceito; segredo só de espaços recusado (CA1, CA12).
- unit (`tests/scripts/seed-guard.test.js`): `demoSeedAllowed` (`'1'` × `'true'`) (CA13). O teste de bloqueio atual fica.
- db (`tests/db/pool.test.js`): `SHOW statement_timeout` no pool da app = `5s`; pool com 100 ms → `57014`; `createPool` sem opção → `0` (CA11).
- db (`tests/db/seed.test.js`): produção com `allowDemoSeed: true` insere 11 (CA13).
- http (`tests/http/seguranca.test.js`, novo): cabeçalhos de `/` (CSP diretiva a diretiva, `X-Frame-Options`, `Referrer-Policy`, sem HSTS), CSP + `nosniff` em `/css/app.css` e `/api/grupos` (CA2, CA3); `securityHeaders({ NODE_ENV: 'production' })` montado num app mínimo traz HSTS e `upgrade-insecure-requests` (CA3); `trustProxy` 1 × 0 com rota de teste via `beforeErrorHandlers` devolvendo `req.ip`/`req.secure` (CA1); favicon (CA14).
- http (`tests/http/rate-limit.test.js`, novo): um teste por CA6, CA7, CA8 (usuário A × B; `createGroup`; 403 sem CSRF não conta) e CA9, sempre com `createRateLimits` de limites baixos.
- QA no navegador (Chromium, com e sem JS, 360 e 1280 px): CA4, CA5, CA14, CA15.

## Riscos / perguntas em aberto

### Perguntas em aberto (com defaults; aguardar OK antes do Coder)
- **P1 — Limites.** Default: leitura (`/grupos`, `/encontrar`) **120/min por IP**; API (`/api/grupos`, `/api/mapa/:slug`) **300/min por IP** (o filtro ao vivo dispara uma requisição a cada pausa de digitação); `POST /grupos` **20/h por usuário** (contando também os 422 de form com erro); participar/sair **60/15 min por usuário**. Generosos de propósito: operadoras móveis no Brasil usam CGNAT (muitos visitantes no mesmo IP). Ajustar algum número?
- **P2 — Tela do 429.** Default: página genérica de erro já existente (“Algo deu errado… Tente de novo em instantes.”) com status 429, sem copy nova. Alternativa: reaproveitar o texto aprovado na 011, “Muitas tentativas. Espere alguns minutos e tente de novo.”, na mesma página (o 500.ejs passaria a aceitar texto). No `POST /grupos` o form preenchido se perde no 429 (raro com 20/h).
- **P3 — CSP e `style="…"`.** Default: `style-src-attr 'unsafe-inline'` (justificativa em Mudanças) e **atualizar o AGENTS §9** (hoje diz “CSP permitindo apenas self, fonts.googleapis.com e fonts.gstatic.com”). Alternativa: spec própria convertendo os `style=` em classes (cor da zona via classes `.z-norte`… e `--p` em 101 classes ou `<meter>`), depois do lançamento.
- **P4 — `TRUST_PROXY`.** Default: configurável por env, **1 em produção** se ausente (Render coloca um proxy na frente). A spec 020 deve conferir no Render, com um acesso real, que `req.ip` é o IP do visitante (se houver mais de um salto, ajusta-se só a env, sem código).
- **P5 — SSL do banco.** Default: produção exige `sslmode` `require`, `verify-ca` ou `verify-full`, sem exceção para `localhost` (para testar local use `NODE_ENV=development`). Recomendação para a 020: usar `sslmode=verify-full` na URL do Neon (o `pg` atual trata `require` como `verify-full` e pode imprimir aviso de depreciação; o Neon tem certificado público válido).
- **P6 — Outras rotas sem limite.** Default: `/`, `/zonas`, `/mapa`, `/mapa/:slug`, `/grupos/:slug`, `/sobre` ficam sem rate limit nesta spec (pedido limitou às rotas listadas; o `statement_timeout` cobre travas). `/` e `/zonas` também leem todos os grupos publicados a cada GET. Querem um limite global generoso (ex.: 300/min por IP em todo GET)?
- **P7 — `statement_timeout`.** Default: **5 s** no pool da app (consultas atuais levam milissegundos).
- **P8 — Favicon.** Default: só SVG (marca do cabeçalho) + redirect do `/favicon.ico`; sem PNG, `apple-touch-icon` nem manifest. Safari antigo (< 2023) fica sem ícone na aba.

### Riscos / decisões técnicas
- **Neon com pooler** (spec 020): `statement_timeout` vai como parâmetro de conexão; o PgBouncer do endereço `-pooler` pode recusar parâmetros de inicialização desconhecidos. Se recusar, a 020 escolhe entre a conexão direta para a app ou `ALTER ROLE … SET statement_timeout = '5s'` (vale também com pooler), sem mudar o código desta spec.
- Rate limit em memória: zera a cada deploy/reinício e não vale entre instâncias (Render com 1 instância). Já aceito para `/conta/*` (010/011).
- `style-src-attr` exige navegador com CSP 3 (Safari ≥ 15.4); em navegador mais velho as cores de zona sumiriam. Aceitável.
- `form-action 'self'` vale também para o redirect depois do POST: todos são internos (`safeNext` garante); um `next` externo já era recusado.
- `upgrade-insecure-requests` e HSTS só em produção: em `http://localhost` quebrariam o dev.
- A 019 mexe em `app.js`, `layout.ejs`, `env.js`, `pool.js`, `seed.js`; não toca `pages.routes.js`/`groups.routes.js`/`mapa.js`, para não conflitar com a 018 em andamento.
- Atualizações de documentação para o orquestrador (com OK do usuário): AGENTS §9 (CSP com `style-src-attr`, `trust proxy`), §10 (`npm run seed` bloqueado em produção **salvo `ALLOW_DEMO_SEED=1`**; `TRUST_PROXY` no `.env.example`), §3 (`middlewares/securityHeaders.js`, `middlewares/rateLimits.js`, `public/favicon.svg`).
- Pendências resolvidas por esta spec após o QA: M8 `trust proxy` (010/009, ALTA), helmet+CSP (001/002), `statement_timeout` (004), favicon (004/015), `/grupos`/`/encontrar` sem limite (005/008), M6 rate limit em participar/sair (014) e em `POST /grupos` (013), `/api/grupos` sem helmet/`nosniff` (016), `frame-ancestors` da exclusão de conta (012), “32 espaços passam como segredo” (003), parte de “release exige `DATABASE_URL`/`SESSION_SECRET`” (o `citext` fica para a 020).
