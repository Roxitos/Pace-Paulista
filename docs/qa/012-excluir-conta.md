# QA — 012 Excluir conta (LGPD)
Veredito: APROVADO

| Critério | Resultado | Evidência |
|---|---|---|
| CA1 link e 2º passo em /meus | ✅ | Playwright sem JS: `/meus` tem link e 0 forms de exclusão; `/meus?excluir=1` tem form com `_csrf`, alerta "Tem certeza…" e Cancelar → `/meus#conta`; testes http |
| CA2 exclusão (DB, 303, sessão, cookie) | ✅ | `tests/http/conta-excluir.test.js`; navegador sem JS terminou em `/?conta=excluida` |
| CA3 pós-exclusão (meus → login, login 401, recriar) | ✅ | testes http; navegador: `/meus` depois → `/conta/entrar?next=%2Fmeus` |
| CA4 duas sessões | ✅ | testes http |
| CA5 sem CSRF 403 / deslogado | ✅ | testes; curl POST sem token → 403 |
| CA6 aviso na home | ✅ | navegador: `role="status"` com "Sua conta foi excluída."; recarregar `/` sem query não mostra; hardener restringiu a anônimo |
| CA7 fluxo completo | ✅ | `tests/http/fluxo-conta.test.js` |
| CA8 sem JS, 360 px, console | ✅ | Chromium 360×800: scrollWidth=360 em `/meus?excluir=1` e `/?conta=excluida`; 0 erros de console; sem JS fluxo completo OK; sem "Nenhum dado…" nas views |
| CA9 testes e lint | ✅ | ver abaixo |

Testes: 748 passaram / 0 falharam (41 arquivos) · Lint (eslint + prettier): ok
Migration rodada 2x: ok (já em dia). Seed idempotente: ok.
Regressão: `/`, `/grupos`, `/grupos?zona=sul`, `/grupos/correria-do-carmo`, `/sobre` = 200; `/meus` deslogado = 302 `/conta/entrar?next=%2Fmeus`.

Problemas encontrados: nenhum.

Sugestões não bloqueantes
- A senha exige caractere especial (hint do form diz), diferente do AGENTS §6 (mín. 8); fora desta spec.
- Pendências do Hardener (CSP/helmet no M8, sem reautenticação por senha P13) seguem aceitas.
- Docker indisponível no ambiente; usado o Postgres local já ativo (`db:up` falhou só por falta do daemon).
- Screenshots em scratchpad (não versionados).
