# 010 — Criar conta (`/conta/criar`)
Marco: M5 · Status: aguardando OK do usuário (perguntas P4–P7 no fim), depois pronta para Coder
Depende de: 009 (sessão, CSRF, `currentUser`, `redirectIfAuthenticated`, `safeNext`, `/meus`)
Ordem do M5: 009 → **010** (esta) → 011 → 012

## Objetivo
Visitante cria conta com nome de exibição, e-mail e senha; a conta é gravada com `bcrypt` (cost 12), a sessão é regenerada e ele já sai logado, indo para `next` ou `/meus`. Funciona sem JS, com as regras de conta do AGENTS §6.

## Fora do escopo
- Entrar/sair e header logado (011); excluir conta (012).
- Confirmação de e-mail, recuperação de senha, login social (fora da v1).
- Contador de força de senha ou validação ao vivo em JS (M7, se pedirem).

## Mudanças

### Dependências (justificar no PR: AGENTS §2)
`bcrypt`, `express-rate-limit`.

### Banco
Nenhuma migration (`users` já existe: `email CITEXT UNIQUE`, `display_name` 2–40).

### Schemas — `src/modules/auth/auth.schemas.js` (novo, zod)
`parseSignup(body) → { values, errors, data }`
- Entrada: `nome`, `email`, `senha`, `next`. Valor array → primeiro elemento; não-string → `''`; nunca lança (mesma postura de `parseFilters`/`parseMatchForm`).
- `nome`: `trim()` + `normalize('NFC')`; tamanho em **code points** (`[...s].length`, igual ao `char_length` do CHECK) entre 2 e 40. O `trim` vem **antes** do tamanho (PENDENCIAS M5: só espaços passava no CHECK).
- `email`: `trim()` + `normalize('NFC')`; até 254 caracteres; formato `^[^\s@]+@[^\s@]+\.[^\s@]+$` (nome@domínio.extensão, qualquer provedor, acentos aceitos — `joão@x.com` válido). Gravado como digitado (o `CITEXT` garante unicidade sem diferenciar caixa).
- `senha`: **sem trim**; 8–72 caracteres **e** `Buffer.byteLength(senha, 'utf8') <= 72` (limite do bcrypt); pelo menos 1 caractere que case com `/[^\p{L}\p{N}]/u` (espaço, `_`, emoji contam; `ç`, `é`, dígitos não).
- `errors`: chaves `nome`, `email`, `senha` nesta ordem, só as que falharam; **uma** mensagem por campo (tamanho antes de caractere especial).
- `values` = `{ nome, email, next }` para reexibir — **a senha nunca volta** para o form.
- `data` = `{ displayName, email, password }` se sem erros, senão `null`.

### Repo — `src/modules/auth/users.repo.js`
- `create({ email, passwordHash, displayName }) → Promise<{ id }>` — `INSERT … RETURNING id`. Não captura erro: o service trata `23505`.

### Service — `src/modules/auth/auth.service.js`
- `signup(data) → { user } | { errors }`: `bcrypt.hash(password, 12)`; `usersRepo.create`; erro `23505` com `constraint === 'users_email_key'` → `{ errors: { email: 'Já existe uma conta com esse e-mail.' } }`; qualquer outro erro sobe. Não fazer `SELECT` prévio de e-mail (o `UNIQUE` já resolve a corrida).
- Nunca logar `password`, `passwordHash` nem o e-mail.

### Rotas (no mesmo arquivo de rotas de conta da 009)
- `GET /conta/criar` — `redirectIfAuthenticated` → `renderPage('conta-criar', { values: { nome:'', email:'', next: safeNext(req.query.next, '') }, errors: {} })`. `next` inválido vira `''` (o form não manda nada).
- `POST /conta/criar` — `signupLimiter` → `redirectIfAuthenticated` → `parseSignup(req.body)`:
  - com erros → `422` + form preenchido + erros;
  - `signup` devolve `errors` → `422` idem;
  - sucesso → `req.session.regenerate()` (evita fixação de sessão) → `req.session.userId = user.id` → `req.session.save()` → `303` para `safeNext(values.next)` (padrão `/meus`).
- `signupLimiter` (`express-rate-limit`), criado **dentro** da fábrica do router (`createAccountRouter()` chamada no `createApp`), para cada app de teste ter memória própria: janela 15 min, **10 requisições por IP** (contando sucesso e erro — ver P5), `standardHeaders: 'draft-8'`, `legacyHeaders: false`, chave com `ipKeyGenerator(req.ip)` (IPv6). Estourou → `429` + o mesmo form, valores mantidos (sem senha), alerta "Muitas tentativas. Espere alguns minutos e tente de novo." (P6).

### View `src/views/pages/conta-criar.ejs` (nova)
Mesmo esqueleto e classes de `PageCadastrar` (`page-head` + `.form-layout` com `.form` e `aside.side-note`):
- `page-head`: kicker `Conta`, título `Criar conta`, texto `Crie sua conta para entrar em grupos e cadastrar o seu.` (P4).
- `<form class="form" method="post" action="/conta/criar" novalidate>` com `partials/csrf`, `<input type="hidden" name="next">` só se `values.next`.
  - Topo: `partials/form-errors` com a contagem ("Corrija N campos para continuar.") quando houver erros; alerta do rate limit como `<div class="form-alert bad" role="alert">`.
  - `Nome de exibição *` — `input.input#a-nome name="nome" maxlength="40" autocomplete="nickname"`, hint `#h-anome`: `Aparece como “Cadastrado por …” nos grupos que você cadastrar.`, erro `span.err#e-anome`.
  - `E-mail *` — `#a-email type="email" name="email" maxlength="254" autocomplete="email" inputmode="email"`, erro `#e-aemail`.
  - `Senha *` — `#a-senha type="password" name="senha" maxlength="72" autocomplete="new-password"`, hint `#h-asenha`: `De 8 a 72 caracteres, com pelo menos 1 caractere especial (ex.: ! @ # $ %).`, erro `#e-asenha`.
  - Cada input com `aria-describedby` (hint + erro) e `aria-invalid="true"` quando tem erro; o **primeiro campo com erro recebe `autofocus`** (equivale ao foco do `showErrors` do protótipo, sem JS).
  - Erro com ícone: `<%- ic('alert','ico-sm') %><%= msg %>` dentro do `.err` (igual ao `showErrors`).
  - Botão `<button class="btn btn-primary btn-lg" type="submit">Criar conta</button>`.
  - Abaixo: `<p>Já tem conta? <a href="/conta/entrar[?next=…]">Entrar</a></p>` (preserva `next`, com `encodeURIComponent`).
- `aside.side-note`: `<h3>O que guardamos</h3>` e lista (P4; cobre a pendência "avisar que `display_name` fica público"):
  - `Seu e-mail e sua senha (guardada de forma protegida), só para você entrar.`
  - `Seu nome de exibição, que fica público nos grupos que você cadastrar.`
  - `O apelido que você escolher em cada grupo em que entrar.`
  - `Você pode excluir sua conta quando quiser, em Meus grupos.`

## Regras e mensagens
| Campo | Regra | Mensagem exata |
|---|---|---|
| nome | após `trim`, 2–40 code points | `Informe um nome com pelo menos 2 caracteres.` (vazio ou < 2) / `Use no máximo 40 caracteres.` (> 40) (P4) |
| email | após `trim`, formato `nome@domínio.extensão`, ≤ 254 | `Informe um e-mail válido.` |
| email | único (case-insensitive, `23505` em `users_email_key`) | `Já existe uma conta com esse e-mail.` |
| senha | 8–72 caracteres e ≤ 72 bytes UTF-8 | `A senha precisa ter de 8 a 72 caracteres.` (P4) |
| senha | ≥ 1 caractere não letra/não número | `A senha precisa de pelo menos 1 caractere especial (ex.: ! @ # $ %).` |
| topo | N erros | `Corrija 1 campo para continuar.` / `Corrija N campos para continuar.` |
| rate limit | > 10 POST / 15 min / IP | `Muitas tentativas. Espere alguns minutos e tente de novo.` (status 429) (P6) |

## Critérios de aceite
- [ ] CA1 — `GET /conta/criar` deslogado → `200` com o form, `_csrf` e os três campos; logado → `302` para `/meus` (ou `next` válido).
- [ ] CA2 — `POST` válido → `303` para `/meus`; existe 1 linha em `users` com `password_hash` começando com `$2b$12$` e diferente da senha; o cookie `pp.sid` **mudou** em relação ao do GET (regenerate); `GET /meus` em seguida mostra o nome.
- [ ] CA3 — Com `next=/grupos/correria-do-carmo#participar` no form → `303` para esse caminho; com `next=//evil.com` → `303` para `/meus`.
- [ ] CA4 — Nome só com espaços, nome de 1 caractere, 41 caracteres → `422`, mensagem certa, valor reexibido (trimado), `aria-invalid="true"` e `autofocus` no campo; 40 caracteres com acento/emoji passa (`[...s].length`).
- [ ] CA5 — E-mail: `joão@x.com` e `Ana@Clube.com.br` aceitos; `ana`, `ana@x`, `a b@x.com`, 255 caracteres recusados com `Informe um e-mail válido.`. Criar `ANA@x.com` depois de `ana@x.com` → `422` `Já existe uma conta com esse e-mail.` e nenhuma linha nova.
- [ ] CA6 — Senha: `abcdefg!` (8) passa; `abcdef!` (7) e 73 caracteres → mensagem de tamanho; 30 emojis (≤ 72 caracteres, > 72 bytes) → mensagem de tamanho; `abcdefgh1` e `açúcarél` → mensagem de caractere especial; `senha com espaço` e `abc_defgh` passam. A senha **nunca** aparece no HTML de resposta (nem em `value=`).
- [ ] CA7 — 3 campos inválidos → topo `Corrija 3 campos para continuar.` e a ordem dos erros é nome, e-mail, senha.
- [ ] CA8 — `POST` sem `_csrf` → `403` e nenhuma conta criada.
- [ ] CA9 — 11º `POST /conta/criar` do mesmo IP em 15 min → `429` com a mensagem e o form preenchido (sem senha); um app novo (`createApp()`) começa zerado.
- [ ] CA10 — Corrida: dois `signup` simultâneos com o mesmo e-mail → um cria, o outro recebe o erro de e-mail duplicado (não 500).
- [ ] CA11 — Nenhum `console.*` com a senha, o hash ou o e-mail durante os testes (espiar o console).
- [ ] CA12 — Funciona sem JS; a 360 px sem scroll horizontal (o `.form-layout` já empilha em telas estreitas; conferir o `aside`); nada de SQL fora de `*.repo.js`; texto do usuário sempre com `<%= %>`.
- [ ] CA13 — `npm test` e `npm run lint` passam.

## Testes esperados
- unit (`tests/domain/auth-schemas.test.js`): todas as linhas da tabela de regras, ordem das chaves de `errors`, `values` sem senha, entrada com arrays/objetos/`undefined` não lança.
- http (`tests/http/conta-criar.test.js`, `supertest.agent` + `getCsrf` da 009): CA1–CA10. Para CA2, ler `users` com o pool de teste.

## Riscos / perguntas em aberto
- **P4** — Textos novos (não existem no protótipo, que não tinha conta): título/texto do `page-head`, rótulos, hints, a lista "O que guardamos", `Informe um nome com pelo menos 2 caracteres.`, `Use no máximo 40 caracteres.`, `A senha precisa ter de 8 a 72 caracteres.`. As mensagens de e-mail, e-mail duplicado e caractere especial são as do AGENTS §6. Aprovar ou ajustar.
- **P5** — Limite do `/conta/criar`: o AGENTS só define o do login (10 / 15 min por IP+e-mail). **Default**: 10 / 15 min **por IP**, contando sucesso e erro. Querem outro número?
- **P6** — Mensagem e status do rate limit (`429` + `Muitas tentativas. Espere alguns minutos e tente de novo.`), mesma para criar e entrar.
- **P7** — Bloquear nomes de exibição que imitem a marca (ex.: "Equipe Pace Paulista")? (PENDENCIAS M5, Hardener.) **Default**: não bloquear na v1; só o aviso de que o nome é público. Se sim, definir a regra e a mensagem.
- Risco aceito pelo AGENTS: a mensagem "Já existe uma conta com esse e-mail." revela que o e-mail tem conta (enumeração); o rate limit mitiga.
- Risco: o `express-rate-limit` usa memória do processo (some ao reiniciar, não vale entre instâncias). Ok para um processo só (v1). Atrás de proxy, `req.ip` depende do `trust proxy` (M8).
