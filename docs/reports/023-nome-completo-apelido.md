# 023 — Nome completo e apelido opcional do participante

Spec: [`docs/specs/023-nome-completo-apelido.md`](../specs/023-nome-completo-apelido.md) · Marco: correções pós-M8 (antes do M10)

## Specifier
Spec 023 escrita a partir do pedido do usuário (2026-11-17, ver PENDENCIAS "Spec 023"). **Aguarda OK do usuário** e respostas de P1–P8 antes do Coder.
- **Migration nova `008_full_name_optional_nickname.sql`** (007 reservada ao M10; `scripts/migrate.js` aplica pendentes por ordem de nome e aceita a lacuna): `users.display_name` 2–80 (hoje 40); `memberships.nickname` passa a aceitar `NULL` (CHECK 2–40 mantido, string vazia segue recusada).
- **Cadastro da conta**: rótulo "Nome completo *", `maxlength="80"`, `autocomplete="name"`, mensagem "Use no máximo 80 caracteres."; identificadores seguem `display_name`/`displayName`.
- **Entrar no grupo**: rótulo "Como gostaria de ser chamado?" (sem `*`), campo começa **vazio**, hint com o nome da conta, `autocomplete="nickname"`. Vazio → grava `NULL`; `findNickname` devolve `COALESCE(m.nickname, u.display_name)`. 1 caractere → "Use pelo menos 2 letras ou deixe em branco." (servidor e `participar.js`).
- Textos LGPD nas side-notes (criar conta, cadastrar grupo) e AGENTS §3/§4/§6/§7/§9 no mesmo PR; `/sobre` e rodapé não mudam.
- 11 critérios de aceite (inclui 360 px com nome de 80 caracteres sem espaço). Testes atuais a ajustar: `participar.test` (`value="Ana Souza"`), casos de 41 chars em `auth-schemas`/`memberships-schemas`, lista de arquivos em `db/migrate.test`.
- Propostas com default: **P1** `display_name` atual vale como nome completo, sem tela de edição; **P2** limite 80 com migration 008; **P3** sem exigir sobrenome; **P6** apelido vazio = `NULL` resolvido na leitura; **P7** só textos dos forms + AGENTS §9; **P8** textos propostos.
- Perguntas reais: **P4** "Cadastrado por" mostra o nome completo (default) ou só o primeiro nome; **P5** lista de participantes fora da 023 (default) ou spec própria.
- Riscos: em produção a 008 roda antes da 007; nome de 80 chars em "Cadastrado por" (layout a 360 px, personificação já aceita na spec 010).

## OK do usuário (2026-11-18)
Spec aprovada com ajuste. **P3 mudou**: nome completo exige sobrenome. P4: "Cadastrado por" mostra o nome completo (default). P5: sem lista de participantes; ninguém vê os integrantes (default). P1, P2, P6, P7, P8: default.
- Specifier atualizou a spec (CA1–CA13): nome normalizado (sem NUL, trim, NFC, espaços colapsados) e validado só no zod do cadastro — 2–80 caracteres e ≥ 2 palavras com ≥ 1 letra cada → "Informe nome e sobrenome.". Sem CHECK no banco: contas antigas de uma palavra seguem válidas (CA5). Hint: "Nome e sobrenome. Aparece como “Cadastrado por …” nos grupos que você cadastrar."
- Riscos novos: regra fácil de burlar (`Ana Ana`); recusa quem tem nome de uma palavra; regras diferentes para contas novas e antigas. Fixtures de teste com nome de uma palavra precisarão de ajuste.
- Em aberto: numeração da migration (008 desta spec antes da 007 do M10, ou trocar: 023 = 007, M10 = 008).
- Numeração (usuário, 2026-11-18): **trocada** — a 023 usa `007_full_name_optional_nickname.sql` e o M10 (`password_resets`) passa para a 008. Spec e estado ajustados pelo orquestrador; o Coder atualiza AGENTS §3/§4 e MILESTONES (M10 → migration 008).

## Coder
Spec implementada conforme o OK (P3: sobrenome obrigatório; migration 007). `npm test` (57 arquivos, 905 testes) e `npm run lint` verdes. Sem dependência nova.
- Migration `007_full_name_optional_nickname.sql`: `users.display_name` 2–80; `memberships.nickname` aceita `NULL` (CHECK 2–40 mantido).
- `auth.schemas`: nome normalizado (espaços colapsados), ≤ 80, regra de nome e sobrenome só no zod. `memberships.schemas`: apelido vazio → `null`; 1 caractere → "Use pelo menos 2 letras ou deixe em branco.". `memberships.repo.findNickname` com `COALESCE(m.nickname, u.display_name)`. `groups.routes`: campo de apelido não vem mais pré-preenchido.
- Views `conta-criar`, `grupo-novo`, `grupo-detalhe` com os textos da spec; `public/js/participar.js` aceita vazio; `app.css`: `.field .hint{overflow-wrap:anywhere}` antes do marcador de Layout (exigência do `scaffold.test.js`).
- Docs: AGENTS §3/§4/§6/§7/§9; MILESTONES (M10 → migration 008).
- Testes: novos casos em `db/schema`, `db/groups-repo`, `http/conta-criar`, `http/participar`; ajustados `db/migrate` (7 migrations; falsas → 008_*), `domain/auth-schemas`, `domain/memberships-schemas` e fixtures de nome de uma palavra nos testes HTTP.
- Alertas: CA5 sem teste específico (coberto pelo CHECK aceitar uma palavra); CA9 (cliente) e CA10 (360 px com nome de 80 sem espaço) só verificáveis pelo QA no navegador; `Ana Ana` passa na regra de sobrenome (risco aceito); sem validação de sobrenome no cliente (como a spec manda). Ambiente sem Docker: Postgres local via `pg_ctlcluster`.

## Cleaner
Refatoração sem mudança de comportamento; nenhum código de produção alterado. `npm test` (904 testes) e `npm run lint` verdes.
- `AGENTS.md`: árvore de pastas com a ramificação correta para 006 (`├──`) e 007 (`└──`).
- `tests/http/conta-criar.test.js`: removidos 2 casos redundantes (nome de 81 caracteres e colapso de espaços, já provados em `tests/domain/auth-schemas`; o caso NUL já confere o valor gravado). Mantido o caso "só um nome" (422, `aria-invalid`, valor reexibido). 905 → 904 testes.
- Revisado sem achados: migration 007, schemas, `memberships.repo`, `groups.routes`, views, `participar.js`, CSS (regra `.field .hint` fica onde está, exigência do `scaffold.test.js`), imports e `console.log`.
- Alertas para Hardener/QA: CA9 (`participar.js`) e CA10 (360 px com nome longo sem espaço) só verificáveis no navegador.

## Hardener
Nenhum problema que desse para corrigir sem mudar regra de produto. Nenhuma mudança de código e nenhum teste novo. `npm test` (57 arquivos, 904 testes) e `npm run lint` verdes.
- Revisado sem problema: queries parametrizadas (`nickname = NULL` em `insertMembership`; `COALESCE(m.nickname, u.display_name)` nunca nulo para quem participa); limites contados em code points depois de NUL/NFC/colapso, iguais ao `char_length` (sem caminho para `23514`); migration 007 só afrouxa restrições (compatível com o código antigo no build); dica `<%= user.displayName %>` escapada e só para logado; CSRF, `requireAuth`, rate limits, `session.regenerate` e `?next=` inalterados; `participar.js` alinhado com o servidor; apelido vazio, só espaços, `\t\n` e de 1 caractere conforme a spec.
- Riscos aceitos ou pendentes (decisão de produto): nome completo aceita caracteres invisíveis ou de formatação (`U+3164` conta como letra; `U+202E` e `U+200B` aparecem em "Cadastrado por …" e permitem falsificar visualmente o texto). A P3 diz "sem lista de caracteres proibidos" e o item da spec 014 segue aberto. Apelido invisível (só o próprio usuário vê). Reverter o deploy para antes da 023 com apelidos `NULL` já gravados faz a pessoa aparecer como não participante: exige `UPDATE` com o `display_name` (cortado em 40) ou não reverter.
- Para o QA: CA9 (`participar.js` no navegador) e CA10 (360 px com nome de 80 caracteres, inclusive "Meus grupos · {nome}" no cabeçalho).

## QA (1ª rodada) — REPROVADO
Veredito em `docs/qa/023-nome-completo-apelido.md`. Volta para o **Coder** (1ª de no máximo 2 voltas): bug de layout, sem problema de segurança nem de spec.
- **Bloqueante (CA10)**: em `/meus`, "Conta e dados", o texto "Você entrou como <b>{nome}</b>" com nome de 80 caracteres (40 + espaço + 39) estoura a 360 px (`scrollWidth` 530), com e sem JS. A correção da 023 em `app.css` cobriu só `.field .hint`. Sugestão: `overflow-wrap:anywhere` no parágrafo ou no `b` de `src/views/pages/meus.ejs` (~linha 28).
- Passou: `npm test` 904/904 (57 arquivos) e `npm run lint`; migration 007 aplicada e reexecução "já em dia"; seed idempotente; CA1–CA9 e CA11–CA13 (inclusive CA9 no modal do `participar.js`); CA10 em `/grupos`, no detalhe do grupo e no hint de `#participar` sem JS; "Meus grupos · {nome}" fica só em `aria-label`/`title`; regressão das páginas públicas e redirecionamentos de login ok; nenhum erro de console além do 422 esperado.

## Coder (volta 1) — correção do CA10
Corrige o único bloqueio do QA. `npm test` (57 arquivos, 905 testes) e `npm run lint` verdes. Sem dependência nova.
- `src/views/pages/meus.ejs`: o parágrafo "Você entrou como <b>{nome}</b> ({email})" ganhou a classe `account-line`.
- `public/css/app.css`: `.account-line{overflow-wrap:anywhere}` na seção "Nome completo longo (spec 023)", antes do marcador de Layout (exigência do `scaffold.test.js`). Vale também para o e-mail da mesma linha.
- `tests/http/meus.test.js`: caso "Nome completo longo em 360 px" (regra no CSS antes do marcador; `/meus` com nome de 80 caracteres traz `<p class="account-line"`).
- Outros trechos com o nome completo: cabeçalho só em `aria-label`/`title`; `grupo-detalhe.ejs` mostra o apelido (CA11) e o "Cadastrado por" já estava coberto. Nada mais alterado.
- Alerta para o QA: a correção por CSS não foi medida em 360 px num navegador (o teste só confere a regra e a classe). Reexecutar a medição de `scrollWidth` em `/meus` com nome de 80 caracteres.

## QA (2ª rodada) — APROVADO
Veredito em `docs/qa/023-nome-completo-apelido.md`. CA10 medido no Chromium a 360 × 800, com e sem JS: `scrollWidth` 360 em `/meus`, `/grupos`, detalhe do grupo, `#participar`, `/`, `/zonas` e `/sobre`, com nome de 80 caracteres (40+espaço+39) e com 80 sem espaço (conta de uma palavra inserida direto no banco, já removida). `npm test` 905/905 e `npm run lint` verdes; migration 007 reexecutável; seed idempotente; sem erros de console além do 422 esperado. CA1–CA9 e CA11–CA13 mantidos da 1ª rodada (só os testes automatizados foram rerodados).
