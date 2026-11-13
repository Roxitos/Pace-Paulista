# Relatório — 010 Criar conta (M5 Contas, spec 2 de 4)
Marco: M5 · Spec: [`docs/specs/010-criar-conta.md`](../specs/010-criar-conta.md) · QA: — (ainda não rodou)
Branch: `feat/m5-contas` (sem commit ainda) · Data: 2026-11-13

## Linha do tempo
| Etapa | Resultado |
|---|---|
| Specifier | Spec já existia (commit `4338fca`), P4 respondida. P5, P6 e P7 seguiram os defaults da spec após o "seguir" do usuário |
| Coder | Implementado e commitado (`88788c9`, já no remoto). `npm test` 714 ok (37 arquivos), `npm run lint` ok |
| Cleaner | Refatoração sem mudar comportamento (`989dfde`). `npm test` 716 ok, `npm run lint` ok |
| Coder (zod) | A pedido do usuário, `parseSignup` migrado para zod sem mudar comportamento. `npm test` 716 ok, `npm run lint` ok |

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
— (não rodou)

## QA
— (não rodou)
