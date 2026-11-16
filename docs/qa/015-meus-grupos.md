# QA — 015 `/meus` e estado "Você participa"
Veredito: APROVADO

| Critério | Resultado | Evidência |
|---|---|---|
| CA1 conta nova: dois vazios + "Conta e dados"; `?excluir=1` | ✅ | curl em `/meus` (textos e links exatos); `?excluir=1` mostra o form `POST /conta/excluir` |
| CA2 2 demo + 1 cadastrado, ordem por `g.id`, pill e botão | ✅ | carmo antes de oca; `Você participa` e `No grupo · ver encontros`; cadastrado na seção 2. `pending` coberto por `tests/http/meus.test.js` |
| CA3 `/`, `/grupos`, `/encontrar` (participante / logado / visitante) | ✅ | participante: pill e `Você já participa`; logado: `#participar`; visitante: `/conta/entrar?next=/grupos/<slug>%23participar`; `Cache-Control: private, no-store` para logado |
| CA4 badge no `#meusBtn` | ✅ | 2 participações → `badge-count">2`; 0 ou deslogado → sem badge; sobe para 3 ao entrar no próprio grupo e volta a 2 ao sair |
| CA5 fluxo completo | ✅ | curl: criar conta → cadastrar → participar → `/meus` nas duas seções, badge → sair → excluir conta (303 para `/?conta=excluida`) → grupo `published`, `owner_id` nulo, `/grupos/<slug>` 200 |
| CA6 sem JS, 360 px, sem SQL fora do repo | ✅ | Playwright 360×800 com e sem JS: `scrollWidth == clientWidth == 360` em `/meus` vazio, `/meus` com cards, `/grupos` e `/` com badge. Participar funciona com JS desligado. Screenshot de `/meus` conferido visualmente |
| CA7 testes e lint | ✅ | 49 arquivos / 809 testes passaram, 0 falhas · lint e prettier ok |

Testes: 809 passaram / 0 falharam · Lint: ok

Ambiente: sem Docker no sandbox, então subi o Postgres 16 local (`pg_ctlcluster`). O banco já tinha as 6 migrations; `migrate` rodou duas vezes sem erro e o `seed` é idempotente (0 de 11 inseridos). Não foi "ambiente limpo" de verdade.

Problemas encontrados: nenhum bloqueante.

Alertas do estado:
- M7: `joinedSlugs` só é usado em `src/middlewares/joinedGroups.js` e nas views; nada serializa `res.locals`. Sem risco hoje.
- Console: 1 erro 404, só com JS ligado, causado por `/favicon.ico` (404). Não vem da 015 e não aparece sem JS.

Sugestões não bloqueantes:
- Adicionar um favicon, ou um `<link rel="icon">`, para limpar o 404 no console.
- O banco de dev tem um grupo de teste com slug `script-alert-1-script`. O escape está correto, mas vale limpar a base de dev.
- Meus testes criaram usuários e um grupo `grupo-qa-*` no banco de dev, e o grupo ficou publicado sem dono.
