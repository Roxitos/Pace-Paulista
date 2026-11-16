# 014 — Participar e sair de grupo (`POST /grupos/:slug/participar` e `/sair`)
Marco: M6 · Status: aguardando OK do usuário (P1–P7 no fim), depois pronta para Coder
Depende de: 009 (sessão, CSRF, `requireAuth`), 011 (login com `?next=`), 013 (`isOwner`, `owner_id` no repo)

Ordem do M6 (o pedido "participar + sair + `/meus`" passa de 400 linhas num PR só, então vira duas specs):
- 013 — Cadastrar grupo ✅
- **014 — Participar / sair** (esta): rotas POST, form inline `#participar` sem JS, estado "Você entrou como …" + "Sair do grupo" na página do grupo, flash de boas-vindas com o próximo treino, contador de participantes
- 015 — `/meus` + estado "Você participa" nos cards + contador no ícone do cabeçalho + fluxo HTTP completo do marco (`docs/specs/015-meus-grupos.md`)

## Objetivo
Usuário logado entra num grupo publicado pelo form do protótipo (`openJoin`/`submitJoin`), servido inline na página do grupo e funcionando sem JS, e sai dele com um botão. A participação vai para `memberships`, o contador de participantes passa a incluí-la e a página mostra as boas-vindas com o próximo treino.

## Fora do escopo
- Modal "Entrar no grupo" com JS, spinner "Entrando…" e toast (M7). Nesta spec **nenhum JS novo**.
- `/meus`, pill "Você participa" e ação "No grupo · ver encontros" nos cards, badge no ícone do cabeçalho, link direto dos cards para `#participar` quando logado (015). Até lá os cards continuam com `/conta/entrar?next=/grupos/<slug>%23participar`, que para logado já redireciona a `/grupos/<slug>#participar` (`redirectIfAuthenticated`).
- Trocar o apelido sem sair do grupo; lista de participantes visível para outros; presença por encontro (roadmap).

## Mudanças

### Banco
Nenhuma migration: `memberships` (004) já tem PK `(user_id, group_id)`, `nickname` 2–40 e FKs em cascata.

### Domínio — `src/domain/schedule.js`
Duas funções puras (formatos literais do protótipo, mas no fuso `timeZone`, não no do processo):
- `fmtDataCurta(date, timeZone = 'America/Sao_Paulo') → string` — `Intl.DateTimeFormat('pt-BR', { timeZone, weekday: 'short', day: 'numeric', month: 'short' })`. Ex.: sábado 21/11/2026 → `sáb., 21 de nov.` (`openJoin`, "Próximo treino").
- `fmtDataLonga(date, timeZone = 'America/Sao_Paulo') → string` — idem com `weekday: 'long', month: 'long'` → `sábado, 21 de novembro` (`submitJoin`, "Primeiro treino").
Sem pós-processamento (o protótipo não tira o ponto nem capitaliza aqui).

### Schemas — `src/modules/memberships/memberships.schemas.js` (novo, **zod**)
`parseJoinForm(body) → { values, errors, data }` — mesma postura de `parseSignup`: nunca lança; campo repetido usa o 1º; não-string → `''`.
- `apelido`: `replaceAll('\0','')` → `trim()` → `normalize('NFC')` (pendência M6: trim antes do tamanho); tamanho em code points: 2–40.
- `ok`: presente e não vazio.
- `errors` na ordem `apelido`, `ok`; uma mensagem por campo (mínimo antes do máximo).
- `values = { apelido, ok: boolean }` (apelido após o trim); `data = { nickname }` só sem erros.

### Repo — `src/modules/memberships/memberships.repo.js` (novo)
- `findPublishedGroupId(slug) → Promise<string|null>` — `SELECT id::text FROM groups WHERE slug = $1 AND status = 'published'`.
- `insertMembership(userId, groupId, nickname) → Promise<boolean>` — `INSERT … ON CONFLICT (user_id, group_id) DO NOTHING`; devolve `rowCount > 0`. Não captura erro.
- `deleteMembership(userId, slug) → Promise<boolean>` — `DELETE FROM memberships m USING groups g WHERE m.group_id = g.id AND g.slug = $2 AND m.user_id = $1` (sem filtro de `status`: sair sempre funciona); devolve `rowCount > 0`.
- `findNickname(userId, slug) → Promise<string|null>` — apelido do usuário naquele grupo.

### Service — `src/modules/memberships/memberships.service.js` (novo)
- `joinGroup(slug, userId, body)`:
  1. `findPublishedGroupId(slug)`; `null` → `{ notFound: true }` (404 vem antes da validação).
  2. `parseJoinForm(body)`; com erros → `{ values, errors }`.
  3. `insertMembership(userId, groupId, data.nickname)` → `{ joined: true }`. Já participava → mesmo resultado (idempotente; o apelido antigo fica, P6). Uma única escrita: **sem `tx()`**.
- `leaveGroup(slug, userId) → Promise<boolean>` — `deleteMembership`.

### Service — `groups.service.js` (`getGroupDetail`)
Passa a devolver também:
- `membership: { nickname } | null` — só com `viewer` (`memberships.repo.findNickname(viewer.id, slug)`); visitante → `null` sem consultar.
- `nextSession: { curta, longa } | null` — a 1ª data de `proximos(...)` (já calculada para `sessions`), formatada com `fmtDataCurta`/`fmtDataLonga` no `env.TZ_APP`; lista vazia → `null`.

### Flash — `src/middlewares/locals.js`
Flash mínimo em sessão, sem dependência nova:
- A rota grava `req.session.flash = { kind, slug }` antes do redirect (`kind` ∈ `'joined' | 'left'`).
- `res.renderPage` lê `req.session?.flash`, apaga da sessão e passa `flash` à view (`null` se não houver). Só página renderizada consome o flash: redirect, 404 de favicon ou POST não o perdem.
- Guarda só `kind` e `slug` (nada de apelido na tabela `session`).

### Rotas — `groups.routes.js` (ou `memberships.routes.js` montado antes do 404; escolha do Coder)
- `POST /grupos/:slug/participar` — `requireAuth` (+ CSRF global).
  - `!isSlug(slug)` → 404 `Esse grupo não foi encontrado. Ele pode ter sido removido.` sem consultar o banco; `notFound` → mesmo 404.
  - `errors` → **422** `grupo-detalhe` (mesmo título e dados de `GET /grupos/:slug`) com `join: { values, errors }`.
  - sucesso → `req.session.flash = { kind: 'joined', slug }` → **303** `/grupos/<slug>#participar`.
- `POST /grupos/:slug/sair` — `requireAuth` (+ CSRF global).
  - `!isSlug(slug)` → 404 como acima.
  - `leaveGroup` removeu → `req.session.flash = { kind: 'left', slug }`; em todo caso **303** `/grupos/<slug>` (idempotente; quem não participava volta sem aviso).
- `GET /grupos/:slug` — mesmo fluxo; a view recebe `membership`, `nextSession`, `flash` e, para logado, `join: { values: { apelido: user.displayName, ok: false }, errors: {} }` (AGENTS §5: apelido pré-preenchido com o `display_name`).
- Deslogado: `requireAuth` já responde **303** `/conta/entrar` nos dois POSTs.

### View — `grupo-detalhe.ejs`
Ações do painel "Ficha do treino" (`<div class="stack" style="margin-top:16px">`), por estado (literal do `PageDetalhe`):
| Estado | Conteúdo |
|---|---|
| visitante | como hoje: `<a class="btn btn-primary btn-lg" href="/conta/entrar?next=/grupos/<slug>%23participar">` `ic('plus')` `Entrar no grupo` |
| logado sem participação | `<a class="btn btn-primary btn-lg" href="#participar">` `ic('plus')` `Entrar no grupo` |
| logado participante | `<div class="form-alert good">` `ic('check')` `<span>Você entrou como <b>{nickname}</b>. Te esperamos no próximo encontro.</span></div>` + `<form method="post" action="/grupos/<slug>/sair" class="stack">` + `partials/csrf` + `<button class="btn btn-outline" type="submit">Sair do grupo</button></form>` |

"Ver rota no mapa" continua depois, nos três estados.

Painel novo, logo após "Ficha do treino", **só para logado**: `<div class="panel join-panel[ open]" id="participar">` (`open` = há `join.errors` ou flash `joined` deste grupo).
- **Logado sem participação** — corpo do modal `openJoin`, sem o botão de fechar:
  - `<h2>Entrar no {nome}</h2>` (o `zchip` do `modal-top` fica de fora: o painel já está abaixo do cabeçalho colorido).
  - `<dl class="spec">` com `Local`, `Próximo treino` (`{nextSession.curta} · {fmtHora}` ou `—`) e `Pace` (`fmtFaixa`); ícones `pin`, `cal`, `gauge`.
  - `<form method="post" action="/grupos/<slug>/participar#participar" class="stack" novalidate>` + `partials/csrf`:
    - `<div class="field"><label for="j-nome">Como o grupo pode te chamar? *</label><input class="input" id="j-nome" name="apelido" maxlength="40" placeholder="Seu primeiro nome ou apelido" autocomplete="given-name" aria-describedby="e-jnome" value="{values.apelido}"><span class="err" id="e-jnome">{erro}</span></div>`
    - `<label class="check"><input type="checkbox" name="ok" id="j-ok" aria-describedby="e-jok"{checked}><span>Li as orientações: chegar no horário, levar água e respeitar o ritmo do grupo. *</span></label><span class="err" id="e-jok">{erro}</span>`
    - `<button class="btn btn-primary btn-lg btn-block" type="submit" id="joinBtn">Confirmar entrada</button>`
    - `<p style="font-size:12.5px;color:var(--muted)">` + texto da P2.
  - Erros como no protótipo: `ic('alert','ico-sm')` + mensagem; `aria-invalid="true"` no `#j-nome` com erro; `autofocus` no `#j-nome` se ele tem erro, senão no `#j-ok`. Sem alerta "Corrija N campos" (o `submitJoin` não tem).
- **Flash `joined` deste grupo e participante** — no lugar do form, o sucesso do `submitJoin`: `<div class="success" role="status"><span class="success-ico">ic('check')</span><h3>Bem-vindo(a), {nickname}!</h3><p style="color:var(--muted)">Você agora faz parte do <b style="color:var(--ink)">{nome}</b>.[ Primeiro treino: <b style="color:var(--ink)">{nextSession.longa}, {fmtHora}</b>.]</p><div class="stack" style="width:100%"><a class="btn btn-primary btn-block" href="/mapa/<slug>">ic('route','ico-sm') Ver rota até o encontro</a></div></div>` (frase entre colchetes só com `nextSession`; sem "Ver página do grupo", P5).
- **Participante sem flash** — o painel não é renderizado.

Flash `left` deste grupo: antes do `<section class="detail-head">`, o mesmo aviso da home: `<div class="wrap notice-top"><div class="form-alert good" role="status">ic('check')<span>Você saiu do grupo.</span></div></div>` (P3).

Nome e apelido sempre com `<%= %>`.

### CSS — `public/css/app.css`
Sem cor nova:
```css
/* Form de participar sem JS: aparece pelo link #participar, após erro ou após sucesso (spec 014). */
.join-panel{scroll-margin-top:84px}
.join-panel:not(:target):not(.open){display:none}
```

## Regras e mensagens
| Campo / situação | Regra | Mensagem exata |
|---|---|---|
| apelido | < 2 code points após trim | `Informe um nome ou apelido com pelo menos 2 letras.` |
| apelido | > 40 | `Use no máximo 40 caracteres.` (P4) |
| ok | desmarcado | `Confirme que leu as orientações.` |
| participante | ficha do treino | `Você entrou como <b>{apelido}</b>. Te esperamos no próximo encontro.` / botão `Sair do grupo` |
| sucesso | título | `Bem-vindo(a), {apelido}!` |
| sucesso | parágrafo | `Você agora faz parte do <b>{nome}</b>. Primeiro treino: <b>{sábado, 21 de novembro}, {6h30}</b>.` (2ª frase só com `nextSession`) |
| sucesso | botão | `Ver rota até o encontro` → `/mapa/<slug>` |
| saiu | aviso no topo | `Você saiu do grupo.` |
| slug inexistente / não publicado | 404 | `Esse grupo não foi encontrado. Ele pode ter sido removido.` |

## Critérios de aceite
- [ ] CA1 — Deslogado: a página do grupo mantém o link `/conta/entrar?next=/grupos/<slug>%23participar` e **não** tem `id="participar"`; `POST /grupos/<slug>/participar` e `/sair` com `_csrf` → `303` `/conta/entrar`, nada gravado; sem `_csrf` → `403`.
- [ ] CA2 — Logado e não participante: `GET /grupos/<slug>` tem `href="#participar"` e o painel `#participar` (sem classe `open`) com h2 `Entrar no {nome}`, "Próximo treino" no formato curto, `_csrf`, `action="/grupos/<slug>/participar#participar"`, `#j-nome` com `value` = `display_name` e `maxlength="40"`, `#j-ok` desmarcado e `Confirmar entrada`.
- [ ] CA3 — `POST …/participar` válido → `303` `/grupos/<slug>#participar`; `memberships` tem a linha com o apelido trimado; seguindo o redirect: participantes exibidos = antes + 1, `Bem-vindo(a), {apelido}!` com `Você agora faz parte do` e `Primeiro treino:` (data longa), link `/mapa/<slug>`, painel com `open`, e na ficha `Você entrou como {apelido}` + form `/grupos/<slug>/sair`. Um novo GET não mostra mais as boas-vindas nem o painel.
- [ ] CA4 — Idempotente: 2º POST válido com outro apelido → `303`; continua 1 linha, com o apelido **original**, e a contagem não muda.
- [ ] CA5 — Inválido (apelido vazio, 1 letra, só espaços, 41 code points; `ok` ausente) → `422` na página do grupo com as mensagens da tabela em `#e-jnome`/`#e-jok`, `aria-invalid="true"` no `#j-nome` quando ele erra, `autofocus` no 1º campo com erro, apelido digitado reexibido, painel com `open`; nada gravado.
- [ ] CA6 — `POST /grupos/nao-existe/participar` e um grupo com `status = 'pending'` (UPDATE no teste) → `404` com a mensagem do grupo; `POST /grupos/A_B/participar` (slug fora do formato) → `404` sem consultar o banco.
- [ ] CA7 — `POST …/sair` de participante → `303` `/grupos/<slug>`; linha apagada; seguindo: `Você saiu do grupo.` com `role="status"`, contagem de volta ao valor inicial, link `#participar` de volta. Repetir o `sair` → `303`, e a página seguinte não tem o aviso.
- [ ] CA8 — Sem próximo encontro (`nextSession = null`, só com dado inconsistente): "Próximo treino" mostra `—` e o sucesso omite a frase do primeiro treino. Verificável renderizando `grupo-detalhe` com `nextSession: null` ou por inspeção.
- [ ] CA9 — Entradas hostis não viram 500: `apelido` repetido (`apelido=a&apelido=bb`), NUL (`%00`); `<script>` no apelido sai escapado em `Você entrou como` e em `Bem-vindo(a)`.
- [ ] CA10 — O flash não vaza: o `joined` de um grupo não aparece na página de outro grupo (e é consumido por ela); a linha da tabela `session` nunca contém o apelido.
- [ ] CA11 — Funciona sem JS (âncora + form + PRG; nenhum JS novo); 360 px sem scroll horizontal na página do grupo com o painel aberto (com erro e com sucesso) e no estado participante; nada de SQL fora de `*.repo.js`.
- [ ] CA12 — `npm test` e `npm run lint` passam.

## Testes esperados
- unit `tests/domain/schedule.test.js`: `fmtDataCurta`/`fmtDataLonga` com uma data perto da meia-noite UTC (`2026-11-22T02:30Z` → `sáb., 21 de nov.` / `sábado, 21 de novembro` em SP).
- unit `tests/domain/memberships-schemas.test.js`: válido (trim/NFC); cada mensagem da tabela; 40 aceito / 41 recusado; ordem `apelido`, `ok`; campo repetido e não-string.
- unit `tests/domain/memberships-service.test.js` (repo mocado): `notFound` antes da validação; com erros não chama `insertMembership`.
- http `tests/http/participar.test.js`: CA1, CA2, CA3+CA4+CA7 num fluxo, CA5 (um teste com os erros), CA6, CA9, CA10.

## Riscos / perguntas em aberto
- **P1** — Form sem JS: painel `#participar` escondido e aberto pelo link âncora (`:target`), após erro ou após sucesso — **default** — ou sempre visível para logado não participante? (O default deixa a página igual ao protótipo para quem só olha.)
- **P2** — Nota sob o botão (o protótipo diz "Neste protótipo ele fica salvo apenas no seu navegador."). **Default**: `Pedimos só um apelido. Ele fica na sua conta e é apagado quando você sai do grupo ou exclui a conta.`
- **P3** — O toast "Você saiu do grupo." vira aviso no topo da página do grupo (mesmo `notice-top` da home) — **default** — ou nenhum aviso sem JS?
- **P4** — Mensagem nova para o máximo do apelido (`Use no máximo 40 caracteres.`, mesmo padrão aprovado na 013). Aprovar.
- **P5** — No sucesso, tirar "Ver página do grupo" (o usuário já está nela) e manter só "Ver rota até o encontro" — **default**.
- **P6** — Entrar de novo mantém o apelido antigo (`ON CONFLICT DO NOTHING`, AGENTS §5); trocar o apelido exige sair e entrar. Aprovar.
- **P7** — O dono pode entrar no próprio grupo (o protótipo não impede; conta +1). **Default**: pode.
- Risco: "pelo menos 2 letras" conta caracteres, como o `submitJoin` (`12` passa).
- Risco: conta excluída ou grupo apagado entre a leitura e o INSERT → FK `23503` → 500 (corrida improvável; mesmo risco aceito na 013).
- Risco: sem rate limit em `participar`/`sair` (escrita barata, idempotente, CSRF + sessão). Avaliar no M8.
- Pendências do M6 cobertas: trim do `apelido`; `tx()` não se aplica (uma escrita por ação). Continuam abertas, fora desta spec (M9/produto): destaques por slug fixo, "dono edita o próprio grupo", moderação `pending`, texto próprio para 400/413.
