# 021 — Remover o diagnóstico temporário `GET /diag/ip`
Marco: M8 · Status: **aprovada pelo usuário em 2026-11-17**; P1 respondida (`TRUST_PROXY=3`), pronta para o Coder

Depende de: 020 (na `main`): `GET /diag/ip`, `DIAG_IP` e a seção "Diagnóstico do IP (CA11)" do `docs/DEPLOY.md`.

## Objetivo
Apagar o endpoint temporário `GET /diag/ip` e a variável `DIAG_IP`, criados para descobrir o `TRUST_PROXY` do Render (extra do CA11 da spec 020). O `docs/DEPLOY.md` passa a registrar o valor descoberto e a explicar como conferi-lo sem a rota.

## Fora do escopo
- Mudar o valor padrão de `TRUST_PROXY` no `env.js` (continua 1 em produção, 0 fora) ou a validação dele.
- Mexer em rate limits, `securityHeaders`, `/healthz` ou qualquer outra rota.
- Editar o histórico: `docs/specs/020-*`, `docs/reports/*`, `docs/qa/*` ficam como estão (o CA11 da 020 continua citando a rota; é registro).
- Editar `docs/PENDENCIAS.md` (o orquestrador marca a pendência da 020 como resolvida).
- Fechar os demais pendentes do deploy real da 020 (CA7–CA10, CA12, CA13, cold start).

## Pré-condição (o Coder confere antes de começar)
O diagnóstico no Render já foi feito e o usuário informou o **valor de `TRUST_PROXY`** que ficou no painel (P1). Sem esse valor, o Coder **não começa**: devolve a spec ao usuário. Remover antes deixa o deploy sem ferramenta para achar o valor certo.

## Mudanças
- Banco: nenhuma.
- Rotas: `GET /diag/ip` deixa de existir em qualquer configuração; passa a cair no `notFound` (404 HTML normal), como qualquer rota inexistente.
- Domínio: nenhuma função pura alterada.
- Arquivos:
  - `src/middlewares/diagIp.js`: **apagar**.
  - `src/app.js`: remover o `import { createDiagIpRouter }`, a opção `diagIp = env.DIAG_IP` do `createApp` e o bloco comentado `if (diagIp) app.use(createDiagIpRouter(...))` (linhas do comentário "Temporário (CA11 da spec 020)…"). O comentário acima do `createApp` sobre `trustProxy`/`rateLimits` continua igual. Ordem dos demais middlewares inalterada.
  - `src/config/env.js`: remover `DIAG_IP` do schema (e o comentário "Temporária (spec 020, CA11)…") e do objeto devolvido pelo `transform` (o `return` volta a ser `{ ...data, DATABASE_URL, SESSION_SECRET, TRUST_PROXY }`). Como o zod descarta chaves desconhecidas, `DIAG_IP` presente no ambiente passa a ser ignorada, sem erro.
  - `tests/http/diag-ip.test.js`: **apagar**.
  - `tests/domain/env.test.js`: tirar `DIAG_IP: false` do objeto esperado em "aplica os valores padrão"; trocar o teste "DIAG_IP: só "1" liga o diagnóstico" pelo teste de "ignorada" (ver Testes).
  - `tests/http/seguranca.test.js`: acrescentar 1 teste de 404 (ver Testes).
  - `.env.example`: apagar a linha `# DIAG_IP=1 …`.
  - `render.yaml`: apagar as 2 linhas de comentário sobre `DIAG_IP`. Se o valor de P1 for **diferente de 1**, trocar também `TRUST_PROXY` → `value: '<N>'` (o Blueprint sincronizado sobrescreveria o painel). Se for 1, nada mais muda no arquivo.
  - `docs/DEPLOY.md`: substituir a seção "## Diagnóstico do IP (CA11)" inteira por:

    ```markdown
    ## IP real do visitante (`TRUST_PROXY`)
    Valor em produção: **`TRUST_PROXY=<N>`** (conferido em <AAAA-MM-DD>). É o número de proxies na frente da app; os rate limits por IP dependem dele.
    Para conferir de novo (ex.: o Render mudou a rede), sem código:
    1. Do mesmo computador, faça 121 `GET /grupos` seguidos em menos de 1 min:
       `for i in $(seq 121); do curl -s -o /dev/null -w '%{http_code}\n' https://<seu-serviço>.onrender.com/grupos; done | sort | uniq -c`
       → 120 respostas `200` e 1 `429`.
    2. Na mesma janela de 1 min, abra `/grupos` de outra rede (ex.: celular no 4G) → `200`.
    3. Repita o passo 1 com `-H 'X-Forwarded-For: 203.0.113.9'` → continua `429`.
    - Outra rede também recebe `429` → todo mundo divide o IP do proxy: o valor está **baixo**, aumente 1.
    - Com o `X-Forwarded-For` forjado volta `200` → o IP é falsificável: o valor está **alto**, diminua 1.
    Ajuste só `TRUST_PROXY` no painel (e no `render.yaml`, para o Blueprint não desfazer) e repita. O limite fica em memória e zera quando o serviço hiberna ou é reimplantado.
    ```

    `<N>` e a data vêm de P1. Nenhuma outra seção do `DEPLOY.md` muda.

## Regras e mensagens
Sem texto de UI novo. O 404 de `/diag/ip` é a página 404 já existente.

| Item | Regra | Mensagem |
|---|---|---|
| `GET /diag/ip` | não registrada; cai no `notFound` | página 404 atual (sem mudança) |
| `DIAG_IP` no ambiente | ignorada pelo `parseEnv` (não aparece no objeto, não dá erro) | — |

## Critérios de aceite
- [ ] CA1 — Dado `createApp({ diagIp: true })` (opção antiga, agora ignorada), quando `GET /diag/ip`, então 404 HTML (mesmo `notFound` das outras rotas), sem JSON.
- [ ] CA2 — Dado `DIAG_IP=1` no ambiente, quando `parseEnv` roda, então o resultado é igual ao de sem a variável (sem chave `DIAG_IP`, sem erro). Logo, com `DIAG_IP=1` no `.env`, `GET /diag/ip` também dá 404.
- [ ] CA3 — `src/middlewares/diagIp.js` e `tests/http/diag-ip.test.js` não existem mais.
- [ ] CA4 — Busca `diagIp|DIAG_IP|diag/ip|createDiagIpRouter` (sem diferenciar caixa) no repositório, **excluindo** `docs/specs/`, `docs/reports/`, `docs/qa/` e `docs/PENDENCIAS.md`, não encontra nada (inclui `src/`, `tests/`, `.env.example`, `render.yaml`, `docs/DEPLOY.md`, `AGENTS.md`, `.claude/`).
- [ ] CA5 — `docs/DEPLOY.md` tem a seção "IP real do visitante (`TRUST_PROXY`)" com o valor de P1 e a data, e o procedimento de conferência sem rota (passos 1–3 e como ajustar). Se `<N>` ≠ 1, `render.yaml` tem `TRUST_PROXY: '<N>'`; se = 1, o `render.yaml` só perdeu as 2 linhas de comentário.
- [ ] CA6 — Nenhum outro comportamento muda: `/healthz`, cabeçalhos de segurança, trust proxy e rate limits seguem com os testes atuais verdes sem alteração (`seguranca.test.js` e `rate-limit.test.js` só ganham/perdem o que esta spec diz); `git diff --stat` toca só os arquivos listados em Mudanças.
- [ ] CA7 — `npm test` e `npm run lint` verdes.
- [ ] CA8 — Funciona sem JS e responsivo em 360 px (nenhuma view tocada; conferir que a home e `/grupos` seguem 200). Nada de SQL fora de `*.repo.js` (nenhum SQL tocado).

## Testes esperados
- unit (`tests/domain/env.test.js`):
  - "aplica os valores padrão": objeto esperado sem `DIAG_IP` (CA2).
  - "ignora DIAG_IP": `expect(parseEnv({ DIAG_IP: '1' })).toEqual(parseEnv({}))` (CA2; substitui o teste antigo de `DIAG_IP`).
- http (`tests/http/seguranca.test.js`, novo `it` perto de `GET /healthz`):
  - `GET /diag/ip` com `createTestApp({ diagIp: true, trustProxy: 1 })` → 404, `content-type` HTML (CA1).
- Os testes de `diag-ip.test.js` saem junto com a rota (CA3); nenhum outro teste é alterado (CA6).

## Riscos / perguntas em aberto
- **P1 (bloqueante, operação):** qual valor de `TRUST_PROXY` o diagnóstico no Render mostrou, e em que data? A remoção **só deve ser executada pelo Coder depois** de o usuário rodar o diagnóstico com `DIAG_IP=1` (seção atual do `DEPLOY.md`), ajustar o painel e informar `<N>` e a data. Até lá, a rota continua na `main` desligada por padrão.
- **Resposta P1 (usuário, 2026-11-17):** `TRUST_PROXY = 3` (cadeia: visitante → Cloudflare → balanceador interno do Render `10.x` → proxy local `::1`). Conferido com `DIAG_IP=1`: `ip` igual a `cfConnectingIp`, `X-Forwarded-For` forjado ignorado, Wi-Fi e 4G com IPs diferentes. Painel já está com 3 e `DIAG_IP` já foi apagada (`/diag/ip` → 404). Como 3 ≠ 1, o `render.yaml` passa a `TRUST_PROXY: '3'`.
- **P2:** prejudicada (o diagnóstico foi feito). Se o diagnóstico não puder ser feito (ex.: o deploy real ainda não existe), remover mesmo assim? Nesse caso o `DEPLOY.md` diria "Valor em produção: 1 (padrão, ainda não conferido)" e o procedimento sem rota passaria a ser o único caminho. Decisão do usuário; o Coder não decide.
- Lembrete ao usuário: apagar `DIAG_IP` do painel do Render ao terminar o diagnóstico (depois desta spec ela fica inerte, mas não deve ficar esquecida).
- Risco aceito: o procedimento sem rota (121 requisições) só detecta valor errado pelos sintomas; não mostra a cadeia de `X-Forwarded-For`. Se precisar de novo do detalhe, a rota pode ser recriada a partir da spec 020 / histórico do git.
