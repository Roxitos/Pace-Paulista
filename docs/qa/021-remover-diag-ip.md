# QA — 021 Remover diagnóstico `GET /diag/ip`
Veredito: APROVADO

| Critério | Resultado | Evidência |
|---|---|---|
| CA1 `diagIp:true` → 404 HTML | ✅ | teste em `seguranca.test.js`; app real: `/diag/ip` 404 `text/html` |
| CA2 `DIAG_IP` ignorada | ✅ | teste `ignora DIAG_IP`; app iniciado com `DIAG_IP=1` → `/diag/ip` 404 |
| CA3 arquivos apagados | ✅ | `ls` não encontra `diagIp.js` nem `diag-ip.test.js` |
| CA4 busca limpa | ✅ | grep fora de specs/reports/qa/PENDENCIAS só acha os 2 testes de regressão da spec |
| CA5 DEPLOY.md + render.yaml | ✅ | seção com `TRUST_PROXY=3` e 2026-11-17, passos 1–3; `render.yaml` `value: '3'`, sem comentários DIAG_IP |
| CA6 nada mais muda | ✅ (nota) | testes de rate limit/seguranca verdes; `git diff --stat` inclui também `docs/reports/020-deploy-render-neon.md` (fora da lista, só doc histórico) |
| CA7 test/lint | ✅ | ver abaixo |
| CA8 home e /grupos 200 | ✅ | `/`, `/grupos`, `/grupos?zona=sul`, `/grupos/pace-da-oca`, `/healthz` 200; `/meus` 302 → `/conta/entrar?next=%2Fmeus`. Nenhuma view tocada (360 px/sem JS não aplicável) |

Migrations rodadas 2x sem erro; seed idempotente.
Testes: 868 passaram / 0 falharam (56 arquivos) · Lint: ok (eslint + prettier)
Problemas encontrados: nenhum.
Sugestões não bloqueantes: `docs/reports/020-deploy-render-neon.md` aparece modificado (fora da 021; conferir ao commitar). AGENTS §9 poderia citar que produção usa 3.
