# Relatório — 010 Criar conta (M5 Contas, spec 2 de 4)
Marco: M5 · Spec: [`docs/specs/010-criar-conta.md`](../specs/010-criar-conta.md) · QA: — (ainda não rodou)
Branch: `feat/m5-contas` (sem commit ainda) · Data: 2026-11-13

## Linha do tempo
| Etapa | Resultado |
|---|---|
| Specifier | Spec já existia (commit `4338fca`), P4 respondida. P5, P6 e P7 seguiram os defaults da spec após o "seguir" do usuário |
| Coder | Implementado. `npm test` 714 ok (37 arquivos), `npm run lint` ok |

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
— (não rodou)

## Hardener
— (não rodou)

## QA
— (não rodou)
