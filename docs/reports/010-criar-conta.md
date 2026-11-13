# Relatório — 010 Criar conta (M5 Contas, spec 2 de 4)
Marco: M5 · Spec: [`docs/specs/010-criar-conta.md`](../specs/010-criar-conta.md) · QA: **APROVADO** ([`docs/qa/010-criar-conta.md`](../qa/010-criar-conta.md))
Branch: `feat/m5-contas` (sem commit ainda) · Data: 2026-11-13

## Linha do tempo
| Etapa | Resultado |
|---|---|
| Specifier | Spec já existia (commit `4338fca`), P4 respondida. P5, P6 e P7 seguiram os defaults da spec após o "seguir" do usuário |
| Coder | Implementado e commitado (`88788c9`, já no remoto). `npm test` 714 ok (37 arquivos), `npm run lint` ok |
| Cleaner | Refatoração sem mudar comportamento (`989dfde`). `npm test` 716 ok, `npm run lint` ok |
| Coder (zod) | A pedido do usuário, `parseSignup` migrado para zod sem mudar comportamento. `npm test` 716 ok, `npm run lint` ok |
| Hardener | NUL em nome/e-mail gerava 500 (22021); corrigido com teste antes. `npm test` 720 ok, `npm run lint` ok (não commitado) |
| QA | **APROVADO**. CA1–CA13 ✅; `npm test` 720 ok, `npm run lint` ok; curl, Playwright a 360 px e regressão ok |

## Decisões de produto
- **P4**: textos aprovados como propostos. **P5**: 10 POST / 15 min por IP, contando sucesso e erro. **P6**: 429 + "Muitas tentativas. Espere alguns minutos e tente de novo.". **P7**: não bloquear nomes de marca na v1.

## Coder
- **Dependências novas** (justificar no PR): `bcrypt` ^6.0.0 (hash de senha, cost 12), `express-rate-limit` ^8.7.4 (limite de `/conta/criar`).
- **Criados**: `src/modules/auth/auth.schemas.js`, `src/views/pages/conta-criar.ejs`, `tests/domain/auth-schemas.test.js`, `tests/http/conta-criar.test.js`.
- **Alterados**: `src/modules/auth/users.repo.js` (`create`), `src/modules/auth/auth.service.js` (`signup`), `src/modules/account/account.routes.js`, `src/app.js` (usa `createAccountRouter()`), `package.json`, `package-lock.json`.
- `parseSignup` usa validações manuais (não zod) e nunca lança. `/meus` passou a viver dentro da fábrica `createAccountRouter()`.
- CA1–CA11 e CA13 cobertos por testes. **CA12** (sem JS, 360 px, `aside`) só verificado por leitura de código: o QA precisa conferir no navegador.
- Ambiente: o Postgres local estava parado; foi iniciado com `pg_ctlcluster 16 main start` (sem ele os testes de banco falham).

### Pendências e riscos
- **M8**: o limiter usa `req.ip` e não há `trust proxy`. A 011 deve reaproveitar o padrão, com chave IP+e-mail e a mesma mensagem 429.
- CSRF roda antes do limiter: POST sem token recebe 403 e não conta no limite.
- Hardener: e-mail duplicado revela que existe conta (risco aceito pelo AGENTS); `req.session.userId` é gravado como string (igual ao helper de teste da 009); `npm audit` reporta vulnerabilidades, não investigado.
- Limiter em memória: zera ao reiniciar e não vale entre instâncias (v1 com um processo).
- 429 e 422 sem campo com erro não aplicam `autofocus`.
- E-mail de boas-vindas segue como spec própria depois do M5 (já em PENDENCIAS).

## Cleaner
Sem mudança de comportamento. `npm test` 716 ok, `npm run lint` ok.
- `account.routes.js`: `renderSignup` perdeu o parâmetro booleano `rateLimited`; o handler do 429 renderiza direto com `rateLimited: true`.
- `auth.schemas.js`: chaves de `MSG` renomeadas para inglês (`nameTooShort`, `nameTooLong`, `passwordLength`, `passwordSpecial`); textos de UI inalterados.
- Testes: nomes corrigidos, dois testes mistos divididos, parâmetro não usado de `start()` removido.
- Markup repetido dos três campos em `conta-criar.ejs` mantido (atributos diferem por campo); não virou partial.

### Pendências para o Hardener e o usuário
- **Divergência de spec (resolvida)**: o `parseSignup` foi escrito sem zod; o usuário pediu a migração e o Coder a fez só em `auth.schemas.js` (`signupSchema` sobre valores já normalizados, no padrão de `parseMatchForm`; mensagens e ordem de erros iguais).
- Itens já listados no Coder (`trust proxy` no M8, CSRF antes do limiter, enumeração de e-mail, `userId` como string, `npm audit`).

## Hardener
`npm test` 720 ok (37 arquivos), `npm run lint` ok. Um problema achado e corrigido, com o teste escrito antes da correção.

| Problema | Severidade | Correção | Teste |
|---|---|---|---|
| Byte NUL (`%00`) em `nome` ou `email` no `POST /conta/criar` passava pelo zod; o Postgres recusava o INSERT (22021) e a página respondia 500 | média | `parseSignup` remove `\0` do `nome` antes do trim (como `filters.js`); `EMAIL_RE` recusa caracteres de controle (`\p{Cc}`, flag `u`) → 422 "Informe um e-mail válido." | `tests/http/conta-criar.test.js` ("NUL no nome ou no e-mail não vira 500"); `tests/domain/auth-schemas.test.js` ("remove NUL", `a\0b@x.com`, `a\u0007@x.com`) |

- **Alterados**: `src/modules/auth/auth.schemas.js`, `tests/domain/auth-schemas.test.js`, `tests/http/conta-criar.test.js`.
- **Conferido e correto**: queries parametrizadas; 23505 em `users_email_key` vira mensagem amigável; bcrypt cost 12 antes do INSERT (mesmo tempo para e-mail duplicado); bcrypt 6 não trunca em NUL; sessão regenerada e salva; `next` protegido (array, `//evil.com`, controle, `?next` na query do POST); senha nunca volta no HTML; CSRF ativo; saída só com `<%= %>`, sem script inline; logs do Postgres só com code e constraint.

### Riscos aceitos e pendências
- **Alta no deploy (M8)**: sem `trust proxy`, atrás de Render/Railway todos os visitantes têm o mesmo IP e o limite de 10 cadastros/15 min vira global; valor mal configurado permite falsificar IP via `X-Forwarded-For`.
- Limiter em memória (zera ao reiniciar, não vale entre instâncias); CSRF antes do limiter (403 sem token não conta); e-mail duplicado revela conta (aceito no AGENTS).
- `display_name` aceita caracteres bidi/zero-width/controle (exceto NUL) e nomes que imitam marca (P7: não bloquear na v1): risco de personificação em "Cadastrado por …".
- Senha de 8 espaços é aceita (espaço conta como especial, regra da spec).
- `npm audit` não investigado.

## QA
Veredito: **APROVADO** (sem volta). Detalhes em [`docs/qa/010-criar-conta.md`](../qa/010-criar-conta.md).
- `npm test` 720 ok (37 arquivos), `npm run lint` ok; migration 2x sem erro, seed idempotente. Docker indisponível: usado o Postgres 16 local.
- CA1–CA13 ✅ (curl contra o app: GET/POST, `$2b$12$`, cookie novo, `next`, e-mail duplicado em maiúsculas, "Corrija N campos", 403 sem `_csrf`, 429 no 11º POST). CA10 (corrida) e a contagem de 3 campos só pela suíte automatizada.
- Sem JS: form POST normal. 360×800 em `/conta/criar`, `/` e `/grupos`: sem scroll horizontal nem erro de console. Regressão: `/`, `/grupos`, `/grupos/<slug>`, `/sobre` 200.
- Observação: `/conta/entrar` e `/grupos/novo` ainda dão 404 (spec 011 em diante); o redirect de `/meus` aponta para uma página inexistente até a 011.
