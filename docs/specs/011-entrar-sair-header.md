# 011 — Entrar, sair e usuário no header
Marco: M5 · Status: aguardando OK do usuário (perguntas P8–P10 no fim), depois pronta para Coder
Depende de: 009 (sessão, CSRF, `requireAuth`, `/meus`), 010 (`users.repo`, `auth.schemas`, `bcrypt`, `express-rate-limit`, padrão de form)
Ordem do M5: 009 → 010 → **011** (esta) → 012

## Objetivo
Login por e-mail e senha em `/conta/entrar` (com `?next=` seguro e rate limit), logout por `POST /conta/sair`, header que mostra se há alguém logado e `/sobre` com "Login e conta de usuário" ATIVO.

## Fora do escopo
- Excluir conta (012).
- Modal "Entrar no grupo" e o form `#participar` (M6/M7). O link `/conta/entrar?next=/grupos/<slug>%23participar` dos cards passa a funcionar e devolve o usuário à página do grupo.
- "Lembrar de mim", bloqueio de conta por tentativas, recuperação de senha.

## Mudanças

### Banco
Nenhuma migration.

### Schemas — `auth.schemas.js`
`parseLogin(body) → { values, errors, data }`: `email` com `trim()` + `normalize('NFC')`, `senha` sem trim, `next`. Login **só exige campos preenchidos** (AGENTS §6): sem regra de formato/tamanho/caractere especial (quem tem senha antiga ou e-mail fora do regex não fica trancado). Arrays/objetos → `''`, nunca lança. Guarda: senha com mais de 1024 caracteres é tratada como credencial errada sem chamar o bcrypt (o bcrypt só olha 72 bytes; evita custo com corpo gigante).

### Repo — `users.repo.js`
- `findCredentialsByEmail(email) → Promise<{ id, password_hash } | null>` — **único** `SELECT` que lê `password_hash`. `WHERE email = $1` (citext).

### Service — `auth.service.js`
- `login({ email, password }) → { user } | null`:
  - acha o usuário → `bcrypt.compare(password, password_hash)`;
  - **não acha → `bcrypt.compare` contra um hash fixo de cost 12** gerado no carregamento do módulo (tempo de resposta igual; não revelar se o e-mail existe);
  - qualquer falha → `null`. Nunca logar e-mail nem senha.

### Rotas (arquivo de rotas de conta)
- `GET /conta/entrar` — `redirectIfAuthenticated` → `renderPage('conta-entrar', { values: { email:'', next: safeNext(req.query.next, '') }, errors: {} })`.
- `POST /conta/entrar` — `loginLimiter` → `redirectIfAuthenticated` → `parseLogin`:
  - campo vazio → `422` com erro no campo;
  - `login` devolve `null` → `401` + form com e-mail reexibido + alerta no topo `E-mail ou senha incorretos.` (sem marcar campo; não diz qual);
  - sucesso → `req.session.regenerate()` → `req.session.userId = id` → `save()` → `303` para `safeNext(values.next)` (padrão `/meus`).
- `loginLimiter`: janela 15 min, **10 tentativas por IP + e-mail** (AGENTS §5), chave `` `${ipKeyGenerator(req.ip)}|${email.trim().toLowerCase()}` ``, **`skipSuccessfulRequests: true`** (só contam as falhas: `401`/`422`/`429`), criado na fábrica do router como na 010. Estourou → `429` + form com e-mail + alerta `Muitas tentativas. Espere alguns minutos e tente de novo.` (P6 da 010).
- `POST /conta/sair` — `requireAuth` → `req.session.destroy()` → `res.clearCookie('pp.sid', <mesmas opções de path/sameSite/secure/httpOnly>)` → `303` para `/`. A linha some de `session`.

### View `src/views/pages/conta-entrar.ejs` (nova)
Mesmas classes da `conta-criar`:
- `page-head`: kicker `Conta`, título `Entrar`, texto `Entre para participar de grupos e cadastrar o seu.` (P8).
- `<form class="form" method="post" action="/conta/entrar" novalidate>` com `partials/csrf`, `next` oculto se houver; alerta de credenciais/rate limit `<div class="form-alert bad" role="alert">`; `partials/form-errors` para campos vazios.
  - `E-mail *` — `#l-email type="email" name="email" maxlength="254" autocomplete="username" inputmode="email"`, erro `#e-lemail`.
  - `Senha *` — `#l-senha type="password" name="senha" autocomplete="current-password"`, erro `#e-lsenha`. Senha nunca reexibida.
  - `aria-invalid`/`autofocus` como na 010; sem erro, `autofocus` no e-mail.
  - Botão `<button class="btn btn-primary btn-lg" type="submit">Entrar</button>`.
- `aside.side-note`: `<h3>Primeira vez aqui?</h3><p>Crie uma conta para entrar nos grupos e cadastrar o seu.</p><a class="btn btn-outline" href="/conta/criar[?next=…]">Criar conta</a>` (preserva `next`). (P8)

### `/meus` — painel "Conta e dados"
Abaixo do parágrafo da 009: `<form method="post" action="/conta/sair">` + `partials/csrf` + `<button class="btn btn-outline btn-sm" type="submit">Sair da conta</button>`.

### Header — `src/views/partials/header.ejs` (P9)
- **Deslogado**: o `a.icon-btn#meusBtn` passa a `href="/conta/entrar"`, `aria-label="Entrar"`, `title="Entrar"` (ícone `user` igual).
- **Logado**: `href="/meus"`, `aria-label` e `title` = `Meus grupos · <display_name>` (escapado com `<%= %>`).
- Nada novo na largura do header (já tem 3 px de sobra a 320 px; não piorar a 360 px).

### `/sobre` — `sobre.ejs`
- "Login e conta de usuário." passa de `<span class="st off">PENDENTE</span>` para `<span class="st on">ATIVO</span>`, logo abaixo do item do banco (PENDENCIAS M3 "atualizar a lista a cada marco"). Ajustar `tests/http/sobre.test.js`.

## Regras e mensagens
| Campo | Regra | Mensagem exata |
|---|---|---|
| email | preenchido após `trim` | `Informe seu e-mail.` (P8) |
| senha | preenchida (sem trim; só espaços conta como preenchida) | `Informe sua senha.` (P8) |
| credenciais | e-mail inexistente ou senha errada | `E-mail ou senha incorretos.` (AGENTS §6; alerta no topo, status 401) |
| rate limit | > 10 falhas / 15 min / IP+e-mail | `Muitas tentativas. Espere alguns minutos e tente de novo.` (429) |
| topo | N campos vazios | `Corrija 1 campo para continuar.` / `Corrija 2 campos para continuar.` |

## Critérios de aceite
- [ ] CA1 — `GET /conta/entrar` deslogado → `200` com form e `_csrf`; logado → `302` `/meus`; `GET /conta/entrar?next=/grupos/pace-da-oca%23participar` logado → `302` para `/grupos/pace-da-oca#participar`.
- [ ] CA2 — Login certo → `303` para `/meus`; cookie `pp.sid` **diferente** do anterior ao login; `GET /meus` mostra o nome. Com `next=/grupos/correria-do-carmo#participar` → `303` para lá; com `next=//evil.com` ou `next=https://evil.com` → `/meus`.
- [ ] CA3 — E-mail com outra caixa (`ANA@X.COM` para conta `ana@x.com`) e com espaços em volta entra.
- [ ] CA4 — Senha errada e e-mail inexistente → ambos `401` com **o mesmo HTML** do alerta `E-mail ou senha incorretos.`, e-mail reexibido, senha não; o tempo do e-mail inexistente usa `bcrypt.compare` (espiar/mocar no unit do service).
- [ ] CA5 — Campos vazios → `422`, `Corrija 2 campos para continuar.`, mensagens nos campos.
- [ ] CA6 — 10 falhas para o mesmo IP+e-mail → a 11ª responde `429` mesmo com a senha certa; outro e-mail do mesmo IP ainda entra; logins com sucesso não contam.
- [ ] CA7 — `POST /conta/sair` logado com `_csrf` → `303` `/`, a linha de `session` foi apagada, o `Set-Cookie` expira `pp.sid`, e `GET /meus` volta a redirecionar ao login. Sem `_csrf` → `403` e continua logado.
- [ ] CA8 — Header: deslogado, `#meusBtn` aponta para `/conta/entrar` com `aria-label="Entrar"`; logado, aponta para `/meus` com `aria-label="Meus grupos · <nome>"` escapado.
- [ ] CA9 — `/sobre`: "Login e conta de usuário." com `ATIVO`.
- [ ] CA10 — Fluxo HTTP do M5 (critério de pronto do marco): criar conta → `/meus` → sair → entrar → `/meus` → página do grupo mostra "Contato" → sair → página do grupo não mostra.
- [ ] CA11 — Nenhum `console.*` com senha, hash ou e-mail; `password_hash` só é lido em `findCredentialsByEmail`.
- [ ] CA12 — Funciona sem JS; 360 px sem scroll horizontal em `/conta/entrar` e `/meus`; nada de SQL fora de `*.repo.js`.
- [ ] CA13 — `npm test` e `npm run lint` passam.

## Testes esperados
- unit: `parseLogin` (vazios, arrays, senha só com espaços conta como preenchida, > 1024); `auth.service.login` com repo mocado (inexistente chama `bcrypt.compare` com o hash fixo; senha certa/errada).
- http: `tests/http/conta-entrar.test.js` (CA1–CA8), `tests/http/sobre.test.js` (CA9), `tests/http/fluxo-conta.test.js` (CA10).

## Riscos / perguntas em aberto
- **P8** — Textos novos: `page-head` do login, aside "Primeira vez aqui?", `Informe seu e-mail.`, `Informe sua senha.`, botão `Sair da conta`. Aprovar ou ajustar.
- **P9** — "Usuário no header": **default** = mesmo ícone, com destino e rótulo trocados (deslogado → "Entrar"; logado → "Meus grupos · {nome}"); "Sair" só em `/meus`. Alternativas: mostrar o nome/inicial visível no botão, ou um botão "Sair" no header/menu mobile (aperta o header a 360 px).
- **P10** — Depois de sair, ir para `/` sem mensagem (**default**) ou mostrar algo como o toast do protótipo ("Você saiu da conta.")? Sem flash em sessão no M5, a mensagem iria por query string (como a 012 propõe para "Conta excluída").
- Risco: rate limit em memória por processo (ver 010). Sem bloqueio de conta: um atacante distribuído por muitos IPs não é contido (aceitável na v1).
