# 009 — Sessão no Postgres, CSRF, usuário na requisição e `requireAuth`
Marco: M5 · Status: aguardando OK do usuário (perguntas P1–P3 no fim), depois pronta para Coder
Depende de: 003 (migration 005 `session`, `env.js`), 004 (`res.renderPage`, `locals`)
Ordem do M5: **009** (esta) → 010 (criar conta) → 011 (entrar, sair, header) → 012 (excluir conta + fluxo completo)

## Objetivo
Montar a infraestrutura de conta sem nenhuma tela de login ainda: sessão em cookie guardada na tabela `session`, CSRF em todo POST, `res.locals.user` preenchido a partir da sessão, `requireAuth` e a página `/meus` mínima (protegida) para ter uma rota real atrás do `requireAuth`.

## Fora do escopo
- Telas e rotas de criar conta, entrar, sair e excluir (010, 011, 012). Nesta spec, os testes "logam" por uma rota de teste (ver Testes).
- `bcrypt` e `express-rate-limit` (entram na 010/011, onde são usados).
- Conteúdo de grupos em `/meus` ("Grupos em que você entrou", "Grupos que você cadastrou"): M6 (ver P1).
- `helmet`/CSP e `trust proxy` (M8).
- Flash messages em sessão: nenhuma tela do M5 precisa (AGENTS §3 cita `flash` em `locals.js`; entra no M6 com "Bem-vindo(a), {apelido}!").

## Mudanças

### Dependências (justificar no PR: todas listadas no AGENTS §2)
`express-session`, `connect-pg-simple`, `csrf-sync`.

### Banco
Nenhuma migration. A tabela `"session"` já existe (migration 005, schema oficial do `connect-pg-simple`).

### `src/config/env.js`
- `SESSION_SECRET` vazio (`SESSION_SECRET=`) passa a ser tratado como **ausente**: em dev/test cai no segredo de dev; em produção continua inválido. Hoje `''` passa em dev/test e o `express-session` lança "secret option required" (PENDENCIAS M5). Mesmo tratamento para `DATABASE_URL=` vazio, se já não for o caso (conferir; não mudar mais nada no schema).

### Domínio — `src/domain/redirect.js` (novo, puro)
```js
/** Devolve um caminho interno seguro para redirecionar, ou `fallback`. */
export function safeNext(raw, fallback = '/meus') → string
```
Aceita só `string` que: começa com `/`; **não** começa com `//` nem `/\`; não contém `\`, caracteres de controle (`\u0000-\u001f`, `\u007f`) nem espaço; tem até 512 caracteres. Qualquer outra coisa (array, `undefined`, `http://…`, `//evil.com`, `/\evil.com`, `javascript:…`, `''`) → `fallback`. Não decodifica nada (recebe o valor já decodificado pelo Express: `?next=/grupos/x%23participar` chega como `/grupos/x#participar`, que é aceito e mantém a âncora).

### Sessão — `src/middlewares/session.js` (novo)
`createSessionMiddleware({ pool, env }) → RequestHandler`:
- `express-session` com store `connect-pg-simple` (`pool` de `src/db/pool.js`, `tableName: 'session'`, **`createTableIfMissing: false`**, `pruneSessionInterval: false` quando `NODE_ENV === 'test'` — senão o timer segura o vitest —, padrão do pacote nos demais).
- `name: 'pp.sid'`, `secret: env.SESSION_SECRET`, `resave: false`, **`saveUninitialized: false`** (visitante anônimo que só navega não gera linha em `session` nem cookie).
- Cookie: `httpOnly: true`, `sameSite: 'lax'`, `secure: env.NODE_ENV === 'production'`, `maxAge: 30 dias` (2 592 000 000 ms).

### CSRF — `src/middlewares/csrf.js` (novo)
- `csrf-sync` com `getTokenFromRequest: (req) => req.body?._csrf` (campo oculto `_csrf` nos forms; sem header, não há fetch com POST na v1).
- Exporta `csrfProtection` (o `csrfSynchronisedProtection`; ignora GET/HEAD/OPTIONS) e `csrfLocals(req, res, next)`, que define **`res.locals.csrfToken = () => generateToken(req)`** — função **preguiçosa**: só a página que desenha um form POST chama, então só ela grava token (e cria sessão) para o visitante anônimo. AGENTS §3 cita `csrfToken` em `locals`; aqui ele vira função por esse motivo.
- Token inválido/ausente → o erro do `csrf-sync` (status 403) segue para o `errorHandler`, que responde 403 com a página própria: "Sua sessão expirou ou ocorreu um problema de segurança na atualização. Por favor, atualize a página e tente novamente." e o botão "Atualizar e tentar de novo" (link para a página anterior, sem JS; P2, resposta de 2026-11-12).
- Novo partial `src/views/partials/csrf.ejs`: `<input type="hidden" name="_csrf" value="<%= csrfToken() %>">`.

### Usuário na requisição — `src/middlewares/currentUser.js` (novo)
- Se `req.session.userId` existe → `usersRepo.findById(id)`.
  - Achou → `req.user = res.locals.user = { id, email, displayName, role }` (nunca `password_hash`).
  - Não achou (conta excluída em outro aparelho) → `delete req.session.userId` e segue anônimo.
- Com usuário logado: `res.set('Cache-Control', 'private, no-store')` (PENDENCIAS M5: a página do grupo mostra o contato só para logado; um CDN/proxy não pode servir essa versão a deslogado).
- Sem `userId` na sessão: **nenhuma query**.

### Repo — `src/modules/auth/users.repo.js` (novo)
- `findById(id) → Promise<{ id, email, display_name, role } | null>` — `SELECT id, email, display_name, role FROM users WHERE id = $1`. A lista de colunas é explícita (nunca `SELECT *`) para `password_hash` não sair do repo. O mapeamento `display_name → displayName` fica no middleware ou num service fino (`auth.service.js`), não na view.

### `src/middlewares/requireAuth.js` (novo)
- Com `req.user` → `next()`.
- Sem: **GET/HEAD** → `302` para `/conta/entrar?next=<encodeURIComponent(req.originalUrl)>`; **outros métodos** → `303` para `/conta/entrar` (sem `next`: voltar para a URL de um POST daria 404 no GET).

### `src/middlewares/redirectIfAuthenticated.js` (novo; usado na 010/011)
- Com `req.user` → `303` (POST) / `302` (GET) para `safeNext(req.query.next ?? req.body?.next)`; sem → `next()`.

### `src/app.js` — ordem dos middlewares
```
express.static
express.urlencoded({ extended: false, limit: '16kb', parameterLimit: 200 })   ← PENDENCIAS M5: limite explícito
session        (createSessionMiddleware)
currentUser
csrfLocals
locals
csrfProtection
routers (pages, groups, matching, account)  → beforeErrorHandlers → notFound → errorHandler
```
O `static` fica antes da sessão para CSS/JS não consultarem o store. `errorHandler` já trata 400/413 do body-parser.

### `src/middlewares/errorHandler.js` — LGPD (PENDENCIAS M5)
- Erro do Postgres (tem `code` string de 5 caracteres, ex.: `23505`): logar **só** `{ code, constraint, table }` — nunca `err.detail` (no `23505` vem `Key (email)=(fulano@…)`) nem `err.message` (algumas mensagens do pg ecoam o valor de entrada). Demais erros: comportamento atual.

### Rotas — `src/modules/account/account.routes.js` (novo)
Pasta `account` para as **páginas** de conta (`/meus` e, na 010–012, `/conta/*`); `auth/` fica com repo/service/schemas, como no AGENTS §3. Se o Coder preferir pôr as rotas em `auth/auth.routes.js` (nome do AGENTS §3), pode — manter **um** só lugar.
- `GET /meus` — `requireAuth` → `renderPage('meus', { title: 'Meus grupos · Pace Paulista' })`.

### View `src/views/pages/meus.ejs` (nova, mínima — ver P1)
- `page-head`: kicker `Meus grupos`, título `Seus treinos`, texto `Grupos em que você entrou e grupos que você cadastrou.` (protótipo `PageMeus` sem o "neste navegador").
- Dentro de `<div class="wrap">`, `<div class="panel" id="conta">` com `<h2>Conta e dados</h2>` e `<p style="color:var(--muted)">Você entrou como <b><%= user.displayName %></b> (<%= user.email %>).</p>`. Os botões "Sair" (011) e "Excluir minha conta" (012) entram depois neste painel.
- Classes existentes (`panel`, `wrap`); nenhum CSS novo.

## Regras e mensagens
| Situação | Regra | Resposta |
|---|---|---|
| `?next=` | `safeNext` (acima) | inválido → `/meus` |
| POST sem `_csrf` ou com token errado | `csrf-sync` | 403, página própria de sessão expirada com o botão "Atualizar e tentar de novo" (P2) |
| Página protegida sem sessão | `requireAuth` | 302 `/conta/entrar?next=…` |
| Sessão aponta para usuário apagado | `currentUser` | anônimo; `userId` removido da sessão |

Nenhuma mensagem nova de UI nesta spec além do parágrafo do painel "Conta e dados".

## Critérios de aceite
- [ ] CA1 — Dado um visitante sem cookie, quando faz `GET /`, `/grupos`, `/grupos/<slug>`, `/encontrar`, `/zonas`, `/mapa`, `/sobre`, então a resposta **não** tem `Set-Cookie` e a tabela `session` continua vazia.
- [ ] CA2 — Dado um usuário logado (rota de teste), então o cookie `pp.sid` sai com `HttpOnly`, `SameSite=Lax`, `Max-Age=2592000` (ou `Expires` equivalente) e **sem** `Secure` fora de produção; e existe 1 linha em `session` cujo `sess` tem `userId`. Com `NODE_ENV=production` a opção `cookie.secure` é `true` (teste unitário de `createSessionMiddleware` ou da config).
- [ ] CA3 — `GET /meus` sem sessão → `302` com `Location: /conta/entrar?next=%2Fmeus`. `GET /meus?x=1` → `next=%2Fmeus%3Fx%3D1`. Um POST protegido sem sessão → `303` para `/conta/entrar`.
- [ ] CA4 — `GET /meus` logado → `200`, mostra `Conta e dados`, o `display_name` e o e-mail escapados (usuário com nome `<b>x</b>` aparece como texto), e a resposta tem `Cache-Control: private, no-store`. Página pública logada (`/grupos/correria-do-carmo`) também tem esse header; deslogada, não.
- [ ] CA5 — Página do grupo com sessão real: grupo com `contact` preenchido mostra a linha "Contato" logado e não mostra deslogado (repete o CA4 da 006 com sessão de verdade; PENDENCIAS M5).
- [ ] CA6 — Usuário logado é apagado direto no banco; o próximo `GET /meus` com o mesmo cookie → `302` para o login, e `/` responde `200` sem erro.
- [ ] CA7 — Qualquer POST (rota de teste `POST /__test/eco`) sem `_csrf` → `403`; com `_csrf` de outra sessão → `403`; com o token obtido de um form da mesma sessão → passa. `res.locals.csrfToken()` chamado duas vezes na mesma sessão devolve o mesmo token.
- [ ] CA8 — Body urlencoded acima de 16 kB → `413` com a página genérica (não 500).
- [ ] CA9 — `safeNext`: aceita `/meus`, `/grupos/x#participar`, `/grupos?zona=sul`; recusa `//evil.com`, `/\evil.com`, `http://evil.com`, `javascript:alert(1)`, `''`, `undefined`, `['/a']`, `/a b`, `/a\u0000`, string de 513 caracteres.
- [ ] CA10 — `parseEnv`: `SESSION_SECRET=''` em dev/test vira o segredo de dev; em produção, inválido.
- [ ] CA11 — `errorHandler` com um erro `{ code: '23505', constraint: 'users_email_key', detail: 'Key (email)=(a@b.com) …' }` não escreve `a@b.com` no `console.error` (espiar o console no teste).
- [ ] CA12 — Funciona sem JS (nada aqui depende de JS); `/meus` sem scroll horizontal a 360 px; nada de SQL fora de `*.repo.js`; `password_hash` não aparece em nenhum `SELECT` fora do que a 011 usar para login.
- [ ] CA13 — `npm test` e `npm run lint` passam; os testes existentes continuam verdes (inclusive `banco-indisponivel.test.js`: sem cookie, a sessão não consulta o banco).

## Testes esperados
- unit: `tests/domain/redirect.test.js` (CA9); `tests/domain/env.test.js` (CA10); config da sessão (CA2, `secure` em produção); `errorHandler` (CA11).
- http (supertest, `tests/http/sessao.test.js`): helper `tests/helpers/auth.js` com
  - `createTestApp()` = `createApp({ beforeErrorHandlers })` registrando **só no teste** `GET /__test/login/:id` (faz `req.session.regenerate` + `req.session.userId = id`), `GET /__test/form` (renderiza um form com `csrfToken()`) e `POST /__test/eco`;
  - `getCsrf(agent, path)` que extrai o `value` de `name="_csrf"` do HTML.
  Cobrir CA1–CA8. `truncateAll` já limpa `"session"`.

## Riscos / perguntas em aberto
- **P1** — `/meus` no M5 só com o painel "Conta e dados" (nome, e-mail; depois Sair e Excluir). As seções de grupos do protótipo entram no M6, quando existirem participar/cadastrar. **Default proposto**: assim. Alternativa: já listar as duas seções (com os estados vazios do protótipo) nesta spec.
- **P2** — (respondida: texto próprio + botão "Atualizar e tentar de novo"; renovar o token via AJAX fica para o M7)  CSRF inválido (ex.: form aberto há mais de 30 dias, sessão expirada) cai na página genérica "Algo deu errado" com 403. Querem texto próprio (ex.: "Sua sessão expirou. Volte, recarregue a página e tente de novo.")? Junta-se à pendência M5/M6 sobre 4xx que não são 404. **Default**: página genérica.
- **P3** — Pasta das rotas: `src/modules/account/` (proposto) ou `src/modules/auth/auth.routes.js` (AGENTS §3)? Não muda comportamento; se escolherem `account/`, o orquestrador atualiza o AGENTS §3.
- Risco: com `saveUninitialized: false` e token preguiçoso, só `/conta/entrar` e `/conta/criar` criam sessão anônima (uma linha por visitante que abre o form). O `connect-pg-simple` limpa as expiradas; aceitável.
- Risco (M8): atrás de proxy (Render/Railway), `secure: true` exige `app.set('trust proxy', 1)`, senão o cookie não é enviado. Registrar no PENDENCIAS M8.
