# 013 — Cadastrar grupo (`/grupos/novo` + `POST /grupos`)
Marco: M6 · Status: aprovada pelo usuário (P1–P6 = defaults), pronta para Coder
Depende de: 009 (sessão, CSRF, `requireAuth`), 010/011 (conta e login)

Ordem do M6 (o marco não cabe num PR só):
- **013 — Cadastrar grupo** (esta)
- 014 — Participar / sair do grupo: `POST /grupos/:slug/participar` e `/sair`, form inline `#participar` sem JS, flash "Bem-vindo(a), {apelido}!", botão "Você já participa", `tx()` se houver mais de uma escrita
- 015 — `/meus`: "Grupos em que você entrou" + "Grupos que você cadastrou" (vazios do protótipo) e o teste HTTP do fluxo completo do marco (criar conta → cadastrar → participar → sair)

## Objetivo
Usuário logado cadastra um grupo pelo form do protótipo (`PageCadastrar`/`submitCad`), validado no servidor com zod e as mensagens literais do protótipo. O grupo nasce `published`, com `owner_id` do usuário, e aparece para todos na busca, no mapa e nas zonas. Funciona sem JS.

## Fora do escopo
- Participar/sair (014) e listagem em `/meus` (015).
- Toast "Grupo “X” cadastrado." e validação ao vivo em JS (M7). Nesta spec o JS só ganha o contador de caracteres da descrição.
- Edição/arquivamento pelo dono, moderação `pending` (roadmap/M9; ver P2, P5).
- Rate limit em `POST /grupos` (ver Riscos).
- Contato como link validado (pendência "Futuro").

## Mudanças

### Banco — `db/migrations/006_groups_start_time_check.sql`
Corrige o item do M2 "CHECKs garantem start_time": `TIME` aceita `24:00`, que derruba `/`, `/grupos`, `/grupos/:slug`, `/mapa` e `/encontrar` (`fmtHora`/`proximos`).
```sql
-- TIME aceita '24:00:00'; a agenda e o fmtHora só tratam 00:00–23:59.
ALTER TABLE groups
  ADD CONSTRAINT groups_start_time_check CHECK (start_time < '24:00');
```
Sem outros CHECKs novos (limites de tamanho de `meeting_point`, `distance` e `contact` ficam no zod; ver Riscos).

### Domínio — `src/domain/slug.js` (pura)
- `slugify(nome) → string` — porta o `slug` do protótipo: `normalize('NFD')`, remove marcas combinantes (U+0300–U+036F), minúsculas, `[^a-z0-9]+` → `-`, tira `-` das pontas, `slice(0, 40)` e tira de novo um `-` final que o corte deixar. Vazio → `'grupo'` (protótipo: `slug(nome)||'grupo'`).
- `RESERVED_SLUGS = ['novo', 'zona']` (colidem com `/grupos/novo` e `/grupos/zona/:zona`).
- `nextSlug(base, taken) → string` — `taken` é um array (ou `Set`) de slugs existentes. Se `base` não está em `taken` nem em `RESERVED_SLUGS`, devolve `base`; senão o primeiro livre de `base-2`, `base-3`, … (AGENTS §6; o protótipo fazia `-2-2`, não seguir).
- `isSlug` continua como está (`base-N` com base de 40 chars cabe nos 60).

### Schemas — `src/modules/groups/groups.schemas.js` (novo, zod)
`parseGroupForm(body) → { values, errors, data }` — mesma postura de `parseSignup`/`parseMatchForm`: nunca lança; campo de texto que vier array usa o 1º elemento; não-string → `''`.

Normalização (antes de validar): texto → `replaceAll('\0','')` → `trim()` → `normalize('NFC')` em `nome`, `local`, `ponto`, `distancia`, `descricao`, `contato` (pendências M6: trim antes do tamanho; NFC na escrita). Tamanhos em **code points** (`[...s].length`, igual ao `char_length`).

| Campo do form | Normalização extra | Regra |
|---|---|---|
| `nome` | — | 3–50 |
| `zona` | — | ∈ `ZONA_ORDEM` |
| `local` | — | 3–80 |
| `ponto` | vazio → `'Combinado no grupo'` | ≤ 100 (maxlength do protótipo) |
| `dias` | string ou array; mantém só valores de `DIA_ORDEM`, **sem repetição**, na ordem de `DIA_ORDEM` | ≥ 1 |
| `horario` | — | `^([01]\d|2[0-3]):[0-5]\d$` |
| `distancia` | vazio → `null` | ≤ 30 |
| `paceMin`, `paceMax` | `parsePace` | não-nulo; e `paceMin < paceMax` (só checa se os dois são válidos) |
| `nivel` | — | ∈ `Object.keys(NIVEIS)` |
| `participantes` | `^\d+$` e 1–999 → inteiro; qualquer outra coisa (inclusive vazio) → `1` | nunca dá erro (protótipo) |
| `descricao` | — | 30–400 |
| `contato` | — | 3–80 |
| `organizador` | presente e não vazio | obrigatório |

- `errors`: chaves na ordem do form — `nome, zona, local, ponto, dias, horario, distancia, paceMin, paceMax, nivel, descricao, contato, organizador` — só as que falharam, **uma** mensagem por campo (mínimo antes de máximo).
- `values` (reexibir o form): `{ nome, zona, local, ponto, dias: string[], horario, distancia, paceMin, paceMax, nivel, participantes, descricao, contato, organizador: boolean }` com o texto **como digitado após o trim** (pace como string, `ponto`/`distancia` vazios continuam vazios; `participantes` como digitado).
- `data` (só sem erros): `{ name, zone, location, meetingPoint, days, startTime, distance, paceMinS, paceMaxS, level, baseParticipants, description, contact }`.

### Repo — `src/modules/groups/groups.repo.js`
- `nameExists(name) → Promise<boolean>` — `SELECT EXISTS (SELECT 1 FROM groups WHERE name = $1)` (citext: sem diferença de caixa; considera **todos** os status).
- `findSlugsLike(base) → Promise<string[]>` — `SELECT slug FROM groups WHERE slug = $1 OR slug LIKE $2 ESCAPE '\'` com `$2 = base + '-%'` (base só tem `[a-z0-9-]`, mas vai parametrizado).
- `insertGroup(data, ownerId, slug) → Promise<{ slug }>` — `INSERT … RETURNING slug`, com `is_demo = false`, `status` e `profile_tags` pelo DEFAULT do banco (`published`, `{'Novo na plataforma'}`), `map_pin` NULL. Não captura erro.
- `SELECT_PUBLISHED` ganha `g.owner_id::text AS owner_id` (só para comparar com o usuário logado; nunca exibido). Ajustar o teste de contrato do repo.

### Service — `src/modules/groups/groups.service.js`
`createGroup(body, ownerId) → { values, errors } | { slug }`
1. `parseGroupForm(body)`.
2. Se `nome` passou nas regras dele, `nameExists` → erro `nome` "Já existe um grupo com esse nome." (o protótipo conta essa falha junto com as outras). Ao inserir esse erro, manter a ordem das chaves (`nome` primeiro).
3. Com erros → `{ values, errors }`.
4. `base = slugify(name)`; `slug = nextSlug(base, await findSlugsLike(base))`; `insertGroup`.
5. Erro `23505`:
   - `constraint === 'groups_name_key'` (corrida com outro cadastro) → `{ values, errors: { nome: 'Já existe um grupo com esse nome.' } }`;
   - `constraint === 'groups_slug_key'` (corrida no slug) → refaz o passo 4, no máximo 3 tentativas; depois sobe o erro.
   - Qualquer outro erro (inclusive `23514`) sobe: o zod é a barreira; CHECK violado é bug → 500, logado só com `code`/`constraint` pelo `errorHandler` (já existe).
6. Uma única escrita: **sem `tx()`** nesta spec.

`getGroupDetail` passa a devolver também `isOwner` (`Boolean(viewer) && group.owner_id === String(viewer.id)`).

### Rotas — `src/modules/groups/groups.routes.js`
Registrar **antes** de `GET /grupos/:slug`:
- `GET /grupos/novo` — `requireAuth` → `renderPage('grupo-novo', { title: 'Cadastrar grupo · Pace Paulista', values: valores vazios (dias `[]`, organizador `false`), errors: {} })`.
- `POST /grupos` — `requireAuth` (+ CSRF global) → `createGroup(req.body, req.user.id)`; com erros → **422** `grupo-novo` com `values`/`errors`; sucesso → **303** `/grupos/<slug>?criado=1`.

Alterar:
- `GET /grupos/:slug` — se `req.query.criado === '1'` **e** `isOwner` → renderiza `grupo-novo` no modo sucesso (`created: group`, título `Grupo cadastrado · Pace Paulista`), status 200 (P1). Caso contrário, a página de detalhe normal (inclusive para outro usuário ou visitante com `?criado=1`).

### Helpers — `src/views/helpers.js`
- `currentNav('/grupos/novo') → ''` (o protótipo não marca menu na rota `cadastrar`). Demais `/grupos/...` continuam `'grupos'`.

### View — `src/views/pages/grupo-novo.ejs` (nova)
Cópia de `PageCadastrar` (`docs/prototipo.html` ~l. 890–923), com as mudanças:
- `page-head`: kicker `Cadastrar grupo`, título `Coloque seu grupo no mapa`, texto `Preencha as informações do treino. Campos com * são obrigatórios.`
- `<form class="form" id="cadForm" method="post" action="/grupos" novalidate>` + `partials/csrf`. Mesmos `id`, `name`, `maxlength`, `placeholder`, `inputmode`, `type="time"`, `type="number" min="1" max="999"` e classes (`choice z` com `zstyle`, `row2`, `check`, `btn btn-primary btn-lg` com `ic('plus')` "Cadastrar grupo").
- `<div id="cadAlert">` mostra `partials/form-errors` com a contagem.
- Cada campo reexibe `values` (radio/checkbox `checked`, `<option selected>`, textarea com conteúdo) e mostra o erro em `<span class="err" id="e-…">` com `ic('alert','ico-sm')` + `<%= msg %>` (ids do protótipo: `e-nome`, `e-czona`, `e-local`, `e-cdias`, `e-hora`, `e-pmin`, `e-pmax`, `e-cnivel`, `e-desc`, `e-contato`, `e-org`; novos só para os campos opcionais com limite: `e-ponto`, `e-dist`, ligados por `aria-describedby`).
- `aria-invalid="true"` nos inputs com erro; `autofocus` no 1º campo com erro (como `conta-criar.ejs`); para `zona`/`dias` o autofocus vai no 1º input do fieldset; para `organizador`, no checkbox.
- Contador: `<span id="descCount">` já sai do servidor com `[...values.descricao].length`.
- `<aside class="side-note">` "O que acontece depois" com o texto adaptado (P3).
- **Modo sucesso** (`created`): no lugar do form, o bloco do protótipo `<div class="form" style="<%= zstyle(zone) %>"><div class="success">…` com `ic('check')`, `Grupo cadastrado`, o parágrafo (P1) e `choice-row` com: `Ver página do grupo` → `/grupos/<slug>`, `Ver na busca` → `/grupos?zona=<zona>`, `Cadastrar outro` → `/grupos/novo` (link `btn btn-quiet`, no lugar do `button data-act="cad-novo"`). O `aside` continua ao lado.

### Views existentes
- `grupo-detalhe.ejs`: `headTag` usa `Cadastrado por você` quando `isOwner`.
- `partials/demo-tag.ejs`: `Cadastrado por você` quando `locals.user && g.owner_id === user.id` (strings); senão como hoje.

### JS — `public/js/app.js`
Contador do protótipo: no `input` de `#c-desc`, atualiza `#descCount` com o tamanho do valor. Sem script inline.

## Regras e mensagens
Mensagens literais de `submitCad`; as marcadas com (P4) são novas, para limites que o protótipo só impunha por `maxlength`.

| Campo | Regra | Mensagem exata |
|---|---|---|
| nome | < 3 | `Informe um nome com pelo menos 3 caracteres.` |
| nome | > 50 | `Use no máximo 50 caracteres.` (P4) |
| nome | já existe (sem diferença de caixa) | `Já existe um grupo com esse nome.` |
| zona | ausente/inválida | `Escolha a zona do grupo.` |
| local | < 3 | `Informe o local de encontro.` |
| local | > 80 | `Use no máximo 80 caracteres.` (P4) |
| ponto | > 100 | `Use no máximo 100 caracteres.` (P4) |
| dias | nenhum dia válido | `Selecione pelo menos um dia.` |
| horario | fora de `HH:MM` 00:00–23:59 | `Informe o horário do treino.` |
| distancia | > 30 | `Use no máximo 30 caracteres.` (P4) |
| paceMin | inválido | `Use o formato 5:30, entre 3:00 e 12:00.` |
| paceMax | inválido | `Use o formato 6:30, entre 3:00 e 12:00.` (protótipo usa 6:30 aqui; o AGENTS resume as duas numa linha) |
| paceMax | ambos válidos e min ≥ max | `O pace mais lento precisa ser maior que o mais rápido.` |
| nivel | ausente/inválido | `Selecione o nível do grupo.` |
| descricao | < 30 | `A descrição precisa de pelo menos 30 caracteres (faltam N).` (N = 30 − tamanho) |
| descricao | > 400 | `Use no máximo 400 caracteres.` (P4) |
| contato | < 3 | `Informe um contato público do grupo.` |
| contato | > 80 | `Use no máximo 80 caracteres.` (P4) |
| organizador | desmarcado | `Confirme que você organiza o grupo.` |
| participantes | qualquer | sem mensagem; inválido vira 1 |
| topo | N erros | `Corrija 1 campo para continuar.` / `Corrija N campos para continuar.` (partial existente) |
| sucesso | título | `Grupo cadastrado` |
| sucesso | parágrafo | `<b>{nome}</b> já aparece na busca, no mapa e na {ZONAS[zona].nome}.` (P1) |

## Critérios de aceite
- [ ] CA1 — Deslogado: `GET /grupos/novo` → `302` `/conta/entrar?next=%2Fgrupos%2Fnovo`; `POST /grupos` com `_csrf` → `303` `/conta/entrar` e nada é gravado. `POST /grupos` sem `_csrf` → `403`.
- [ ] CA2 — Logado: `GET /grupos/novo` → 200 com o form do protótipo (`action="/grupos"`, `_csrf`, 5 radios de zona, 7 checkboxes de dia, campos e textos da seção Mudanças), sem `aria-current` no menu. `/grupos/novo` e `/grupos/zona` deixam de cair no 404 do grupo (rota registrada antes de `/:slug`).
- [ ] CA3 — POST válido → `303` `/grupos/<slug>?criado=1`; no banco: `owner_id` = usuário, `is_demo = false`, `status = 'published'`, `profile_tags = {'Novo na plataforma'}`, `days` deduplicados e na ordem de `DIA_ORDEM`, pace em segundos, `meeting_point` `Combinado no grupo` quando `ponto` vazio, `distance` NULL quando vazia, `base_participants` 1 quando `participantes` vazio/inválido.
- [ ] CA4 — Seguindo o redirect, o dono vê o bloco "Grupo cadastrado" com o nome e a zona e os 3 links; outro usuário logado ou visitante em `/grupos/<slug>?criado=1` vê a página de detalhe normal.
- [ ] CA5 — O grupo novo aparece em `/grupos` (e com `?zona=<zona>`), em `/zonas` na contagem, em `/mapa/<slug>` e em `/grupos/<slug>`; para o dono o selo diz `Cadastrado por você`, para outro usuário `Cadastrado por {display_name}`.
- [ ] CA6 — POST com o form vazio (só `_csrf`) → `422`, `Corrija 11 campos para continuar.`, uma mensagem por campo obrigatório (tabela), `aria-invalid="true"` nos inputs e `autofocus` só no `#c-nome`.
- [ ] CA7 — POST inválido reexibe os valores digitados (texto, zona marcada, dias marcados, nível selecionado, descrição, organizador marcado) e nada é gravado.
- [ ] CA8 — Nome já existente com outra caixa (`correria DO carmo`) → `422` `Já existe um grupo com esse nome.`, contado junto com os demais erros. Corrida: `23505` em `groups_name_key` devolve a mesma mensagem (teste do service com repo mocado).
- [ ] CA9 — Slug: nome `Pace da Oca!` (nome livre, slug `pace-da-oca` ocupado) → `pace-da-oca-2`; com `-2` também ocupado → `pace-da-oca-3`; nome `Novo` ou `Zona` (slug reservado) → `novo-2`/`zona-2`; nome `★★★` (slug vazio) → `grupo`.
- [ ] CA10 — Horário `24:00` → `Informe o horário do treino.`; a migration 006 recusa `UPDATE groups SET start_time = '24:00'` (`23514`). `npm run migrate` aplica a 006 sobre um banco com o seed.
- [ ] CA11 — Entradas hostis não viram 500: campo repetido (`nome=a&nome=b`), `dias=xyz`, `zona=marte`, `nivel=x`, NUL (`%00`) em texto, só espaços em `nome`/`descricao` (falham no mínimo), `<script>` no nome aparece escapado na página do grupo.
- [ ] CA12 — Funciona sem JS (form normal + PRG); com JS, o contador `descCount` acompanha a digitação. 360 px sem scroll horizontal em `/grupos/novo` (com e sem erros) e no modo sucesso. Nada de SQL fora de `*.repo.js`.
- [ ] CA13 — `npm test` e `npm run lint` passam.

## Testes esperados
- unit `tests/domain/slug.test.js`: `slugify` (acentos/maiúsculas/símbolos, corte em 40 sem `-` final, vazio → `grupo`); `nextSlug` (livre, `-2`, `-3`, reservado).
- unit `tests/domain/groups-schemas.test.js`: um válido completo (com `data` esperado); um caso por mensagem da tabela (incluindo `faltam N`, pace min ≥ max, mínimo antes de máximo); dedupe/ordem de `dias`; `participantes` inválido → 1; ordem das chaves de `errors`; trim/NFC/NUL.
- unit `tests/domain/groups-service.test.js` (repo mocado): nome duplicado somado aos erros; `23505` em `groups_name_key`; retry em `groups_slug_key`; outro erro sobe.
- unit `view-helpers.test.js`: `currentNav('/grupos/novo') === ''`.
- db: migration 006 recusa `24:00`.
- http `tests/http/grupo-novo.test.js`: CA1, CA2, CA3+CA4+CA5 num fluxo (criar conta → cadastrar → ver sucesso → ver na busca/detalhe → outro usuário vê "Cadastrado por …"), CA6, CA7, CA8, CA10 (só a mensagem), CA11 (um teste com os casos hostis).

## Riscos / perguntas em aberto
- **P1** — Tela de sucesso: em `/grupos/<slug>?criado=1` mostrar a "tela de sucesso do protótipo" (form trocado pelo bloco "Grupo cadastrado", só para o dono) — **default** — ou mostrar a página de detalhe com um aviso no topo? Texto: o protótipo dizia "…na {zona} deste navegador."; default remove "deste navegador". Herda "na Centro" (pendência M3+ "Selo da Centro").
- **P2** — Moderação: grupo novo nasce `published` (**default**, AGENTS v1) ou `pending`? Se `pending`, a spec muda (sucesso diz "em revisão", o grupo não aparece na busca, falta `/admin`). Pergunta aberta em PENDENCIAS (M6/M9).
- **P3** — Texto do `aside` "O que acontece depois" (o do protótipo fala de "neste navegador" e "revisão"). **Default**: `O grupo aparece na hora na busca, no mapa e nas zonas, para todos os visitantes.` / `Seu nome de exibição aparece como “Cadastrado por …” na página do grupo.` / `Só pedimos dados do grupo. Use contatos públicos do grupo, nunca um telefone pessoal.`
- **P4** — Mensagens novas para os máximos (`Use no máximo N caracteres.`, mesmo padrão do cadastro de conta). Aprovar.
- **P5** — "Dono edita o próprio grupo" na v1? Fora desta spec (default: continua no roadmap); sem isso, erro de digitação no cadastro só se corrige pelo banco.
- **P6** — Destaques da home por slug fixo (PENDENCIAS M6/M9): o `UNIQUE` do nome impede recadastrar "Pace da Oca" enquanto o demo existir; o risco só aparece quando os demos saírem. **Default**: não tratar nesta spec (fica para o M9).
- Risco: sem rate limit em `POST /grupos`, uma conta pode criar muitos grupos publicados de imediato (spam). Mitigação depende de P2; avaliar com o Hardener/M8.
- Risco: limites de `ponto`/`distancia`/`contato` só no zod (sem CHECK no banco); aceitável enquanto o único caminho de escrita for este form.
- Risco: `owner_id` passa a sair do repo nas listagens; o `GET /api/grupos` do M7 precisa removê-lo junto com `contact` (pendência M7 já aberta).
- Pendências do M6 cobertas aqui: zod do cadastro + `slug()`; `23505`/`23514`; `start_time < 24:00` (todos os itens 24:00); dedupe de `days` + trim; NFC na escrita; `/grupos/novo` antes de `/:slug` e slugs reservados. Ficam para 014: `tx()` e trim do `apelido`. Ficam abertas: `map_pin` sem CHECK (não editável aqui) e nome de 50 chars sem espaço em card a 360 px (avaliar no QA desta spec; corrigir com `overflow-wrap` se reproduzir).
