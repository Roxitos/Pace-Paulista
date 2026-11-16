# 014 — Participar e sair do grupo

Spec: [`docs/specs/014-participar-sair.md`](../specs/014-participar-sair.md) · Marco: M6

## Specifier
Spec 014 escrita junto com a [015](../specs/015-meus-grupos.md) (`/meus`). O restante do M6 foi dividido em duas para não passar de 400 linhas por PR, como a 013 previa. O modal com JS fica no M7.
- Rotas `POST /grupos/:slug/participar` (login + CSRF, idempotente; reentrada mantém o apelido antigo; erro → 422 na página do grupo; sucesso → 303 `/grupos/<slug>#participar`) e `POST /grupos/:slug/sair` (303 `/grupos/<slug>`). Slug inexistente ou não publicado → 404; slug fora do formato → 404 sem consultar o banco.
- Módulo novo `memberships` (schemas zod com apelido `trim` 2–40 e `ok` obrigatório, repo, service). Uma escrita por ação, sem `tx()`.
- Página do grupo com três estados (visitante, logado fora do grupo, participante: "Você entrou como …" + "Sair do grupo"); painel `#participar` sem JS, aberto por `:target` ou por erro/sucesso; textos do `openJoin`/`submitJoin` do protótipo.
- Flash em sessão só com `{kind, slug}`, consumido ao renderizar: "Bem-vindo(a), {apelido}!" com o próximo treino; "Você saiu do grupo." ao sair.
- `schedule.js` ganha `fmtDataCurta` e `fmtDataLonga` (fuso de São Paulo). Contagem de participantes já soma memberships na query.
- Sem migration e sem JS novo. 12 critérios de aceite.
- Perguntas abertas P1–P7 (defaults na spec): P1 form só via `#participar`; P2 nota do apelido; P3 "Você saiu do grupo." no topo; P4 "Use no máximo 40 caracteres."; P5 sem "Ver página do grupo" no sucesso; P6 apelido antigo mantido na reentrada; P7 dono pode entrar. (P8–P10 são da 015.)
- Aprovação: P1–P7 = defaults (usuário). P8–P10 (015) ficam para o ciclo da 015.

## Coder
Spec 014 implementada. `npm test` (47 arquivos, 800 testes) e `npm run lint` passam.
- Módulo `memberships` novo (schemas zod, repo, service) + rotas `POST /grupos/:slug/participar` e `/sair` em `groups.routes.js` (helper `renderDetail` compartilhado com o GET e o 422).
- `getGroupDetail` devolve `membership` e `nextSession`; `grupo-detalhe.ejs` com três estados e painel `#participar` sem JS; aviso "Você saiu do grupo.".
- `schedule.js`: `fmtDataCurta` e `fmtDataLonga`. `locals.js`: `renderPage` consome o flash da sessão (`{kind, slug}`), que some ao abrir outro grupo.
- `.join-panel` fica antes do marcador de layout em `app.css` (o `scaffold.test.js` exige o fim do arquivo idêntico ao protótipo).
- Testes novos: `participar.test.js`, `memberships-schemas.test.js`, `memberships-service.test.js`, mais `schedule.test.js`.

Não verificado: CA11 (360 px, sem JS, em navegador); CA8 (`nextSession = null`) só por inspeção do template; CA6 não prova que slug inválido evita consulta ao banco.
Observações: sem docker no ambiente (Postgres local via `pg_ctlcluster`); o fake `loggedInApp` de `grupo-detalhe.test.js` usa `display_name` em vez de `displayName` (inofensivo); `participar`/`sair` sem rate limit (Hardener ou M8).

## Cleaner
Refatoração sem mudar comportamento. `npm test` (47 arquivos, 800 testes) e `npm run lint` passam.
- `groups.routes.js`: `renderDetail` deixou de receber `req`, que não era usado (3 chamadas ajustadas).
- `grupo-detalhe.ejs`: `joinedNow` virou booleano (`Boolean(locals.membership)`) em vez de devolver o objeto.
- Revisado e mantido: comentários restantes explicam decisões (sem filtro de status no delete, idempotência, NUL no INSERT). Sem `console.log`, código morto ou import sem uso.
- Não tocado: `joinGroup` devolve `{ joined: true }`, que a rota não usa; fica porque o teste de service o verifica.

## Hardener
`npm test` 802 ok (eram 800), `npm run lint` ok. Dois achados de baixa severidade, cada um com teste escrito antes da correção.
- **Corrida: grupo deixa de ser `published` entre a checagem e o INSERT (baixa)**: a participação era gravada num grupo não publicado. Correção em `memberships.repo.js`: `insertMembership` virou `INSERT … SELECT $1, id, $3 FROM groups WHERE id = $2 AND status = 'published' ON CONFLICT (user_id, group_id) DO NOTHING`. Teste: `participar.test.js` ("memberships.repo.insertMembership": grupo `pending` dá `false` e nada é gravado).
- **Corrida: conta ou grupo apagado entre a leitura e o INSERT (baixa)**: a FK dava `23503` e a página virava 500. Correção em `memberships.service.js`: `joinGroup` captura `23503` e devolve `{ notFound: true }` (404); outros erros continuam sendo relançados. Teste: `memberships-service.test.js` ("trata violação de FK (23503) na corrida como notFound"). A spec listava isso como risco aceito; corrigido sem mudar regra de produto.
- **Verificado sem problema**: CSRF global nos dois POSTs (sem `_csrf` → 403); `requireAuth` → 303 para `/conta/entrar`; `userId` só da sessão; `isSlug` antes do banco e slug do redirect sempre validado (sem open redirect); apelido escapado com `<%= %>`; NUL e campo repetido não derrubam a rota; queries parametrizadas; participar idempotente (mantém o apelido antigo); sair sem participar → 303 sem aviso; grupo `pending` ou inexistente → 404; flash só com `{kind, slug}`; `Cache-Control: private, no-store` para logado; exclusão de conta apaga participações em cascata (já coberto em `conta-excluir.test.js`).
- **Riscos aceitos/pendentes**: (1) sem rate limit em participar/sair (M8); (2) quem já participa e envia o form inválido (aba antiga) recebe 422 sem erro visível, porque o painel não aparece para membro, decisão de produto; (3) apelido só com caracteres invisíveis (U+200B) ou de controle bidi passa na validação, na v1 só o próprio usuário vê; (4) QA: CA8 só por inspeção do template e CA11 (360 px, sem JS) não verificado em navegador.
- **Arquivos alterados**: `src/modules/memberships/{memberships.repo,memberships.service}.js`, `tests/domain/memberships-service.test.js`, `tests/http/participar.test.js`.

## QA (1ª volta) — REPROVADO
Veredito completo em `docs/qa/014-participar-sair.md`. `npm test` 802 ok, lint e migrate (2x) ok; CA1–CA10 e CA12 ok (curl e Playwright sem JS).
- **Reprovado em CA11 (bug de CSS)**: apelido de 40 caracteres sem espaço (ex.: 40 "W") estoura 360 px (scrollWidth 700) no sucesso e no estado participante. Estouram `.form-alert.good` ("Você entrou como <b>…</b>"), o form/botão "Sair do grupo" e o botão "Ver rota". Mesma classe do bug da spec 013.
- Correção sugerida: `overflow-wrap:anywhere` e `min-width:0` no `.form-alert` e no `<b>`, fora do bloco literal do protótipo em `app.css`, mais teste.
- Observações: CA4 só por testes automatizados; CA8 só por inspeção (`locals.nextSession || null`, sem teste com `nextSession: null`); uma medição isolada de 375 px em `/` na primeira carga, não repetida e fora da spec 014.
- Retorno: **Coder** (volta 1 de 2); depois repetir o QA só de CA11.

## Coder (volta 1 de 2)
`npm test` 803 ok (eram 802), `npm run lint` ok. Corrige o bloqueante de CA11 do QA.
- **Causa**: o `.stack` (grid de coluna `auto`) do painel lateral crescia até o min-content do apelido de 40 caracteres sem espaço, esticando o aviso "Você entrou como…" e os botões.
- **Correção** (`public/css/app.css`, fora do bloco literal do protótipo): `.detail-grid .stack,.join-panel .stack{grid-template-columns:minmax(0,1fr)}`, `.form-alert > span,.detail-grid .btn{min-width:0;overflow-wrap:anywhere}` e `.detail-grid .btn{white-space:normal;text-align:center}`.
- **Teste**: `tests/http/participar.test.js` ("Apelido longo sem espaço em 360 px") confere as regras e que ficam antes do bloco literal.
- **Verificação**: Playwright 360×800, sem JS, apelido de 40 "W": scrollWidth 360 antes, no sucesso e no estado participante (era 700).
- **Arquivos alterados**: `public/css/app.css`, `tests/http/participar.test.js`.
- Próximo: Cleaner, depois Hardener e repetir o QA de CA11.

## Cleaner (volta 1 de 2)
`npm test` 803 ok, `npm run lint` ok. Refatoração sem mudança de comportamento.
- `public/css/app.css`: dois comentários de bloco sobre o CA11 unidos em um só (explica o porquê: painel sem JS e overflow em 360 px). Regras CSS idênticas, ainda fora do bloco literal do protótipo.
- `tests/http/participar.test.js`: removida a referência histórica "(QA 014)" do comentário do teste "Apelido longo sem espaço em 360 px (CA11)". Asserts e nome inalterados.
- Revisado sem mudança: imports, helpers, nomes e estrutura do teste.
- Atenção para o QA: os asserts do teste são de string no CSS; o CA11 ainda precisa de checagem visual (apelido de 40 "W", sucesso e participante, 360 px, sem JS).
- Próximo: QA (só CA11), conforme o estado.

## QA (2ª volta, só CA11) — APROVADO
Veredito completo em `docs/qa/014-participar-sair.md`. `npm test` 803 ok (47 arquivos), `npm run lint` e prettier ok.
- **CA11**: Chromium/Playwright 360×800, sem JS, apelido de 40 "W": `scrollWidth` 360 em visitante, logado com painel aberto, erro 422, sucesso, participante e "saiu" (era 700 no sucesso e no participante).
- Sem SQL fora de `*.repo.js` (só um comentário em `auth.service.js`); nenhum JS novo (só `public/css/app.css` mudou).
- Observação não bloqueante: 375 px na 1ª carga fria do Chromium em `/grupos/pace-da-oca`, não reproduzido em 3 recargas (mesmo efeito da 1ª volta).
- Sobra no banco local: usuário 14 com participação "W"×40 no grupo 5, criada antes desta volta; limpar quando quiser.
- Pendências que seguem: sem rate limit em participar/sair (M8); form inválido de aba antiga recebe 422 sem erro visível; apelido só com caracteres invisíveis passa; CA8 só por inspeção.
