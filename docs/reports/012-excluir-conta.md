# 012 — Excluir conta (LGPD)

Spec: [`docs/specs/012-excluir-conta.md`](../specs/012-excluir-conta.md) · Marco: M5

## Coder
`npm test` 747 ok, `npm run lint` ok. P11 conforme a spec; P12 (`?conta=excluida`) e P13 (sem pedir senha) = defaults.
- **Alterados**: `users.repo.js` (`deleteById`), `auth.service.js` (`deleteAccount`), `account.routes.js` (`POST /conta/excluir`, `endSession` compartilhado com `/conta/sair`, `/meus` com `confirmDelete`), `pages.routes.js` (`accountDeleted`), `meus.ejs` (2 passos), `home.ejs` (aviso), `app.css` (`.notice-top`, antes do marcador "Layout" por causa do `scaffold.test`).
- **Testes**: `tests/http/conta-excluir.test.js` (novo; CA1–CA6) e `fluxo-conta.test.js` (CA7).
- A home usa `locals.accountDeleted` porque testes existentes renderizam a view sem esse dado.
- `/sobre` e rodapé não têm "Nenhum dado é enviado a servidores" (grep).
- Sessões de outros aparelhos ficam na tabela e viram anônimas (CA4 testado). Style inline do `resetBox` é cópia do protótipo (CSP: M8).
- CA8 (360 px, navegador) não verificado: fica para o QA.

## Cleaner
`npm test` 747 ok, `npm run lint` ok. Sem mudança de comportamento.
- `account.routes.js`: `endSession` saiu de dentro de `createAccountRouter` para o escopo do módulo (não depende do router); usada por `/conta/sair` e `/conta/excluir`.
- `conta-excluir.test.js`: removida a checagem de login após exclusão (duplicava o CA7 de `fluxo-conta.test.js`); no lugar, novo `signup` com o mesmo e-mail prova que o e-mail fica livre.
- Sem `console.log`, imports sem uso ou código morto no diff.
- CA8 (360 px, navegador) continua para o QA.

## Hardener
`npm test` 748 ok (eram 747), `npm run lint` ok. Um achado, severidade baixa.
- **Aviso forjado**: `/?conta=excluida` mostrava "Sua conta foi excluída." também a quem estava logado (link forjado). Correção: `accountDeleted: req.query.conta === 'excluida' && !req.user` em `pages.routes.js`. Sem efeito no fluxo real (quem excluiu já está deslogado). Teste escrito antes da correção em `conta-excluir.test.js` ("não mostra o aviso a quem está logado"). A spec não falava de usuário logado; o QA pode reverter se discordar.
- **Verificado sem problema**: CSRF checado antes do `requireAuth`; SQL parametrizado só no repo; cascata em `memberships` e `owner_id` nulo; sessão destruída e cookie `pp.sid` expirado com as mesmas opções; sessões de outros aparelhos viram anônimas; duplo clique inofensivo; sessão guarda só `userId` e token CSRF; `meus.ejs` escapa com `<%= %>`; `?excluir=1` só com valor exato.
- **Riscos aceitos/pendentes**: sem helmet/`frame-ancestors` (M8; `sameSite=lax` mitiga); `style` inline do botão depende da CSP do M8; sem reconfirmação de senha (P13); sessões de outros aparelhos ficam até 30 dias na tabela `session`; se `session.destroy` falhar após o DELETE, o 500 ainda mostra o nome no cabeçalho naquele navegador (severidade muito baixa, não corrigido).
- CA8 (360 px, navegador) continua para o QA.

## QA
**APROVADO** (veredito completo em [`docs/qa/012-excluir-conta.md`](../qa/012-excluir-conta.md)). `npm test` 748 ok, `npm run lint` ok, sem problemas encontrados.
- CA8 verificado no Chromium, sem JS, 360×800: `scrollWidth` 360 em `/meus?excluir=1` e `/?conta=excluida`, sem erros de console. O fluxo sem JS termina em `/?conta=excluida`, e `/meus` depois redireciona para o login.
- Regressão: `/`, `/grupos`, `/grupos/correria-do-carmo` e `/sobre` respondem 200. Nenhuma view diz "Nenhum dado é enviado a servidores".
- Docker indisponível no ambiente; usado o Postgres local já ativo.
- Sugestão não bloqueante: a senha exige caractere especial, mas o AGENTS §6 pede só mínimo de 8 caracteres. É anterior a esta spec.
