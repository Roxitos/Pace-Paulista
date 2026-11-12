# 012 — Excluir conta (LGPD)
Marco: M5 · Status: aguardando OK do usuário (perguntas P11–P13 no fim), depois pronta para Coder
Depende de: 009, 010, 011
Ordem do M5: 009 → 010 → 011 → **012** (esta; última do M5)

Nota de escopo: o `MILESTONES.md` põe "excluir conta" no M6, mas o pedido do M5 o inclui "se couber". Cabe numa spec pequena e fecha o ciclo da conta (LGPD) antes da escrita. Se o usuário preferir manter no M6, esta spec só muda de marco, sem outra alteração.

## Objetivo
Substituir o "Apagar meus dados deste navegador" do protótipo por "Excluir minha conta" em `/meus`, com a mesma confirmação em 2 passos, funcionando sem JS. Excluir apaga o usuário de verdade: participações caem em cascata, grupos dele ficam com `owner_id = NULL`, a sessão é destruída.

## Fora do escopo
- Exportar dados, período de carência, "desativar" em vez de apagar.
- Versão com JS (troca do bloco sem recarregar, como o `reset-ask` do protótipo): M7.

## Mudanças

### Banco
Nenhuma migration (`memberships.user_id … ON DELETE CASCADE` e `groups.owner_id … ON DELETE SET NULL` já existem).

### Repo — `users.repo.js`
- `deleteById(id) → Promise<boolean>` — `DELETE FROM users WHERE id = $1` (retorna se apagou).

### Service — `auth.service.js`
- `deleteAccount(userId)` → `usersRepo.deleteById(userId)`. Um único `DELETE`; as FKs fazem o resto (não precisa de `tx()`).

### Rotas
- `GET /meus` passa a ler `req.query.excluir === '1'` → `confirmDelete: true` na view (2º passo sem JS).
- `POST /conta/excluir` — `requireAuth` (+ CSRF global) → `deleteAccount(req.user.id)` → `req.session.destroy()` → `clearCookie('pp.sid', …)` → `303` para `/?conta=excluida`.
- Sessões do mesmo usuário em outros aparelhos: ficam na tabela, mas o `currentUser` da 009 já as trata como anônimas (usuário não existe). Não apagar por `sess->>'userId'` (JSON sem índice).

### View `/meus` — painel "Conta e dados" (`<div class="panel" id="conta">`)
Texto do protótipo adaptado (P11). Depois do parágrafo e do botão "Sair da conta" (011), um `<div id="resetBox" style="margin-top:14px">`:
- **1º passo** (`confirmDelete` falso): `<a class="btn btn-outline btn-sm" href="/meus?excluir=1#conta">Excluir minha conta</a>`.
- **2º passo** (`confirmDelete` verdadeiro), mesma marcação do `reset-ask` do protótipo:
  - `<div class="form-alert bad" role="alert"><%- ic('alert') %><span>Isso apaga sua conta e suas participações nos grupos. Os grupos que você cadastrou continuam publicados, sem o seu nome. Não dá para desfazer.</span></div>`
  - `<form method="post" action="/conta/excluir" class="choice-row" style="margin-top:10px">` + `partials/csrf` + `<button class="btn btn-primary btn-sm" type="submit" style="background:var(--pista)">Excluir conta</button>` + `<a class="btn btn-outline btn-sm" href="/meus#conta">Cancelar</a>`.
  - O `style` inline é cópia literal do protótipo (o CSP disso é pendência do M8).

### Home — `home.ejs` + `pages.routes.js`
- `GET /` com `?conta=excluida` → `accountDeleted: true`. A home mostra, antes do `<section class="hero">`: `<div class="wrap notice-top"><div class="form-alert good" role="status"><%- ic('check') %><span>Sua conta foi excluída.</span></div></div>`.
- CSS novo mínimo em `app.css`: `.notice-top{padding-top:16px}` (sem cor solta). Qualquer outro valor de `conta` é ignorado.

### `/sobre` e rodapé
Conferir que nenhum texto diz "Nenhum dado é enviado a servidores" (AGENTS §9). Hoje não dizem; só verificar.

## Regras e mensagens
| Situação | Regra | Texto exato |
|---|---|---|
| 1º passo | link | `Excluir minha conta` |
| 2º passo | alerta | `Isso apaga sua conta e suas participações nos grupos. Os grupos que você cadastrou continuam publicados, sem o seu nome. Não dá para desfazer.` (P11) |
| 2º passo | botões | `Excluir conta` / `Cancelar` |
| depois de excluir | home | `Sua conta foi excluída.` (adapta o toast "Dados locais apagados."; P12) |

## Critérios de aceite
- [ ] CA1 — `/meus` logado mostra o link `Excluir minha conta` e **não** mostra o form de exclusão; `/meus?excluir=1` mostra o alerta, o form `POST /conta/excluir` com `_csrf`, `Excluir conta` e `Cancelar` → `/meus#conta`.
- [ ] CA2 — Usuário com 1 participação (`insertMembership`) e 1 grupo com `owner_id` dele: `POST /conta/excluir` com `_csrf` → `303` `/?conta=excluida`; o `users` não tem mais a linha; `memberships` dele = 0; o grupo continua `published` com `owner_id IS NULL`; a contagem de participantes exibida do grupo caiu 1; a linha de `session` foi apagada e o `Set-Cookie` expira `pp.sid`.
- [ ] CA3 — Em seguida, `GET /meus` com o mesmo agent → `302` para o login; login com o e-mail/senha antigos → `401` `E-mail ou senha incorretos.`; criar conta de novo com o mesmo e-mail funciona.
- [ ] CA4 — Dois agents logados na mesma conta: o A exclui; o B, no próximo `GET /meus`, é redirecionado ao login e `/` responde 200.
- [ ] CA5 — `POST /conta/excluir` sem `_csrf` → `403` e nada é apagado; deslogado → `303` `/conta/entrar` e nada é apagado.
- [ ] CA6 — `GET /?conta=excluida` mostra `Sua conta foi excluída.` com `role="status"`; `GET /` e `GET /?conta=x` não mostram.
- [ ] CA7 — Fluxo HTTP completo (extende o da 011): criar conta → sair → entrar → excluir → login falha.
- [ ] CA8 — Funciona sem JS (2 passos por link + POST); 360 px sem scroll horizontal em `/meus?excluir=1` e na home com o aviso; nada de SQL fora de `*.repo.js`.
- [ ] CA9 — `npm test` e `npm run lint` passam.

## Testes esperados
- unit: nenhum novo de domínio (não há regra pura); opcional `auth.service.deleteAccount` com repo mocado.
- http: `tests/http/conta-excluir.test.js` (CA1–CA6) e o fluxo completo em `tests/http/fluxo-conta.test.js` (CA7).

## Riscos / perguntas em aberto
- **P11** — Texto do alerta do 2º passo e do painel (o do protótipo falava de "dados deste navegador"). Aprovar ou ajustar. Inclui avisar que os grupos cadastrados **continuam publicados sem o nome** (regra do AGENTS §4) — querem, em vez disso, despublicar/apagar os grupos do usuário junto? (Mudaria regra do AGENTS §4.)
- **P12** — Aviso pós-exclusão na home via `?conta=excluida` (**default**) ou redirecionar para `/` sem mensagem? (Sem flash em sessão, porque a sessão acabou de ser destruída.)
- **P13** — Pedir a senha de novo para confirmar a exclusão? **Default**: não (protótipo usa só os 2 passos; CSRF + sessão bastam). Com senha fica mais seguro contra sessão esquecida aberta num computador compartilhado.
- Risco: sessões de outros aparelhos ficam na tabela até expirar (no máximo 30 dias), sem efeito (viram anônimas). Aceitável.
