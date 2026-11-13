# Relatório — 011 Entrar, sair e usuário no header (M5 Contas, spec 3 de 4)
Marco: M5 · Spec: [`docs/specs/011-entrar-sair-header.md`](../specs/011-entrar-sair-header.md) · QA: APROVADO
Branch: `feat/m5-contas` (sem commit ainda) · Data: 2026-11-13

## Linha do tempo
| Etapa | Resultado |
|---|---|
| Specifier | Spec já existia; P8 aprovada. P9 e P10 seguiram os defaults da spec após o "pode fazer" do usuário |
| Coder | Implementado, sem commit. `npm test` 740 ok (40 arquivos), `npm run lint` ok |
| Cleaner | Extraído `loginValues(req)`; `npm test` 740 ok, `npm run lint` ok |
| Hardener | 1 problema (média) corrigido: rate limit do login contornável por variante Unicode do e-mail. `npm test` 741 ok, lint ok |

## Decisões de produto
- **P8**: textos aprovados. **P9**: mesmo ícone no header, com destino e rótulo trocados. **P10**: sair vai para `/` sem mensagem.

## Coder
- **Criados**: `src/views/pages/conta-entrar.ejs`, `tests/domain/auth-service.test.js`, `tests/http/conta-entrar.test.js`, `tests/http/fluxo-conta.test.js`.
- **Alterados**: `auth.schemas.js` (`parseLogin`), `users.repo.js` (`findCredentialsByEmail`, único SELECT de `password_hash`), `auth.service.js` (`login`, hash falso cost 12; senha > 1024 → `null`), `account.routes.js` (GET/POST `/conta/entrar`, `loginLimiter`, `POST /conta/sair`), `meus.ejs` (botão "Sair da conta"), `header.ejs`, `sobre.ejs` (ATIVO), `tests/http/sobre.test.js`, `tests/domain/auth-schemas.test.js`.
- `parseLogin` remove NUL do e-mail (evita 22021, como no cadastro).
- CA1–CA11 e CA13 cobertos por testes. **CA12** (360 px sem scroll em `/conta/entrar` e `/meus`) não medido: fica para o QA.
- Depois do último ajuste de lint só `conta-entrar.test.js` foi reexecutado (14 ok).

### Pendências e riscos
- `bcrypt.hashSync` cost 12 no carregamento de `auth.service` soma ~250 ms ao boot e a cada arquivo de teste que o importa.
- Limiter em memória por processo (risco desde a 010); sem trust proxy (M8).
- `parseLogin` roda duas vezes por requisição (chave do limiter e rota): dá para unificar.
- `clearCookie` usa `httpOnly`/`sameSite`/`secure` de `sessionCookieOptions`, sem `maxAge`.
- `/grupos/novo` segue 404 (spec 012+).

## Cleaner
- **Alterado**: `account.routes.js` — `loginValues(req)` alimenta o `keyGenerator` e o `handler` do `loginLimiter`, que antes chamavam `parseLogin(req.body)` duas vezes (resolve a pendência do Coder). Comportamento idêntico.
- **Revisado sem mudança**: `auth.schemas/service`, `users.repo`, `header.ejs`, `meus.ejs`, `sobre.ejs`, `conta-entrar.ejs` e os testes novos (sem código morto, comentários só de decisão/armadilha).
- `npm test` 740 ok e lint ok (Postgres local iniciado com `service postgresql start`; sem Docker no sandbox).
- Seguem para o Hardener: `hashSync` cost 12 no boot, limiter em memória, `clearCookie` sem `maxAge`, `/grupos/novo` 404.

## Hardener
`npm test` 741 ok, `npm run lint` ok. Um problema achado e corrigido; a 11ª tentativa com a variante voltava 303 em vez de 429 antes da correção.

| Problema | Severidade | Correção | Teste |
|---|---|---|---|
| Contorno do limite de 10 falhas por IP+e-mail: a chave usava `email.toLowerCase()`, mas o citext do banco (C.UTF-8) trata `bİa@x.com` como igual a `bia@x.com`; cada variante Unicode abria uma cota nova contra a mesma conta | média | `loginLimitKey(email)` em `auth.schemas.js` (minúsculas, NFKD, sem marcas diacríticas, corte em 254 caracteres, o que também limita a memória do limiter); `keyGenerator` em `account.routes.js` passou a usá-la. E-mails que só diferem por acento caem no mesmo balde (limite mais rígido) | `tests/http/conta-entrar.test.js` ("variante Unicode que o citext casa com o mesmo e-mail não ganha cota nova") |

- **Alterados**: `src/modules/auth/auth.schemas.js`, `src/modules/account/account.routes.js`, `tests/http/conta-entrar.test.js`.
- **Conferido e correto**: `safeNext` (recusa `//`, `\`, controles, URL absoluta; também no `redirectIfAuthenticated`); `session.regenerate()` no login; logout POST com `requireAuth`, CSRF, `destroy` e `clearCookie` com as opções do cookie de sessão; e-mail inexistente paga `bcrypt.compare` contra hash fixo cost 12; senha > 1024 recusada antes do banco; `password_hash` só em `findCredentialsByEmail`; sem log de e-mail/senha; escape `<%= %>` no header, no e-mail reexibido e no `next` oculto; NUL removido; arrays no body inofensivos; body limitado a 16kb; falha de CSRF não chega ao limiter.

### Riscos aceitos e pendências
- **Alta no deploy (M8)**: sem `trust proxy`, atrás de proxy todos compartilham o IP; o limite vira global e permite travar o login de uma vítima.
- Limiter em memória por processo; chave IP+e-mail (decisão da spec) não segura muitos e-mails a partir de um IP nem ataque distribuído.
- Senha de exatamente 72 bytes aceita sufixo extra (truncamento do bcrypt); sem impacto prático, e a spec manda o login não impor tamanho.
- `bcrypt.hashSync` no carregamento do módulo (~250 ms no boot).

## QA
Veredito: **APROVADO** (sem volta). Detalhes em [`docs/qa/011-entrar-sair-header.md`](../qa/011-entrar-sair-header.md).
- `npm test` 741 ok (40 arquivos), `npm run lint` ok; migration 2x sem erro, seed idempotente. Docker indisponível: usado o Postgres local.
- CA1–CA13 ✅ (curl + Playwright). Rate limit: 429 na 11ª falha, outro e-mail do mesmo IP ainda entra. Logout sem `_csrf` → 403; com `_csrf` o cookie `pp.sid` expira e `/meus` volta a redirecionar. CA10 (fluxo completo) só pela suíte automatizada (demos não têm contato).
- Sem JS e a 360×800: criar conta, login com erro e sair funcionam; sem scroll horizontal em `/conta/entrar`, `/conta/criar`, `/meus`, `/grupos`, `/`.
- Observações não bloqueantes: uma medição de 375 px sem JS em `/conta/entrar` não reproduziu (4 repetições em 360); um 404 de recurso no console (provável favicon) não reproduziu. Pendência do M8: `trust proxy`.
