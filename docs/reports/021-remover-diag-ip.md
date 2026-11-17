# 021 — Remover o `GET /diag/ip` e a `DIAG_IP`

Spec: [`docs/specs/021-remover-diag-ip.md`](../specs/021-remover-diag-ip.md) · Marco: M8

## Specifier
Spec 021 escrita. **Bloqueada:** o Coder só começa depois do diagnóstico no Render (valor de `TRUST_PROXY` e data, pergunta P1). Sem migration nem dependência nova.
- Remove `src/middlewares/diagIp.js` e `tests/http/diag-ip.test.js`; tira de `src/app.js` o import, a opção `diagIp` e o registro da rota; tira `DIAG_IP` de `src/config/env.js` (com a variável no ambiente, ela passa a ser ignorada, sem erro).
- Testes: `env.test.js` ajustado (`DIAG_IP=1` ≡ `{}`) e novo teste em `seguranca.test.js` (`/diag/ip` → 404 em HTML, mesmo com a opção antiga).
- Limpa `.env.example` e o comentário do `render.yaml`; se o valor achado não for 1, atualiza o `TRUST_PROXY` do `render.yaml`. `docs/DEPLOY.md`: seção "Diagnóstico do IP (CA11)" vira "IP real do visitante (`TRUST_PROXY`)", com valor, data e como conferir sem a rota.
- CA1–CA8. Perguntas abertas: **P1** (valor e data do diagnóstico; bloqueia o Coder) e **P2** (se o diagnóstico não puder ser feito, remover mesmo assim, com "1 (padrão, ainda não conferido)"; decisão do usuário).
- Lembrete: apagar a `DIAG_IP` no painel do Render ao terminar o diagnóstico.

## Coder
Spec implementada com P1 = `TRUST_PROXY` 3 (conferido em 2026-11-17). `npm test` (56 arquivos, 868 testes) e `npm run lint` verdes.
- Apagados `src/middlewares/diagIp.js` e `tests/http/diag-ip.test.js`; `src/app.js` sem a opção `diagIp`; `src/config/env.js` sem `DIAG_IP`.
- Testes: `tests/domain/env.test.js` (padrão sem `DIAG_IP`; `DIAG_IP` no ambiente é ignorada) e +1 em `tests/http/seguranca.test.js` (`/diag/ip` → 404).
- `.env.example` limpo; `render.yaml` com `TRUST_PROXY: '3'`; `docs/DEPLOY.md` com a seção "IP real do visitante (`TRUST_PROXY`)".
- CA4: a busca por `DIAG_IP`/`diagIp` só acha os 2 testes novos (esperado) e `docs/PENDENCIAS.md`.
- Alertas: Docker indisponível no ambiente (Postgres subiu com `pg_ctlcluster`); `docs/reports/020-deploy-render-neon.md` já aparecia modificado antes do Coder.

## Cleaner
Só uma mudança: em `tests/http/seguranca.test.js`, o `describe` "GET /diag/ip (removida na spec 021)" virou "GET /diag/ip", porque o nome deve descrever o comportamento, não o histórico. O resto da remoção já estava limpo: sem código morto, imports sem uso ou referências soltas. `npm test` (56 arquivos, 868 testes) e `npm run lint` verdes.

## Hardener
Revisão sem achados: nenhuma correção nem teste novo. `npm test` (56 arquivos, 868 testes) e `npm run lint` verdes.
- Nada de diagnóstico de IP exposto: rota, import, opção `diagIp` e `DIAG_IP` removidos; a busca do CA4 fora dos docs históricos só acha os 2 testes de regressão.
- `GET /diag/ip` → 404 HTML pelo `notFound`, mesmo com `diagIp: true`; `DIAG_IP` no ambiente é descartada pelo zod.
- `TRUST_PROXY=3` coerente em `render.yaml`, `docs/DEPLOY.md` e `env.js` (faixa 0–10, `true` recusado, padrão 1 em produção). Com 3 saltos (Cloudflare → balanceador do Render → proxy local), um `X-Forwarded-For` forjado fica à esquerda e é ignorado; o procedimento do DEPLOY (429 em `/grupos`) bate com o limite de 120/min.
- Riscos aceitos: se o Render mudar o número de proxies, o 3 fica errado (só se percebe pelo procedimento do DEPLOY). O `AGENTS.md` §9/§10 e o `.env.example` falam em "1 em produção" (o padrão); a produção usa 3. Ajustar o texto fica fora da 021.

## QA
**APROVADO** ([`docs/qa/021-remover-diag-ip.md`](../qa/021-remover-diag-ip.md)). CA1–CA8 ok. `npm test` (56 arquivos, 868 testes) e `npm run lint` verdes; migrations rodadas 2x sem erro e seed idempotente.
- App real iniciado com `DIAG_IP=1`: `/diag/ip` → 404 HTML.
- Regressão: `/`, `/grupos`, `/grupos?zona=sul`, `/grupos/pace-da-oca` e `/healthz` → 200; `/meus` → 302 para `/conta/entrar?next=%2Fmeus`. Nenhuma view alterada (sem JS/360 px não se aplicam).
- Sugestões não bloqueantes: `docs/reports/020-deploy-render-neon.md` modificado fora da 021 (é o registro do deploy real, entra no mesmo commit); AGENTS §9 poderia citar que a produção usa `TRUST_PROXY=3`.
