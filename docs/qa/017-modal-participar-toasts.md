# QA — 017 Modal "Entrar no grupo" e toasts
Veredito: APROVADO

Ambiente: Postgres local (5432), `npm run migrate` duas vezes (já em dia, 6 migrations), `npm run seed` idempotente. Navegador: Playwright/Chromium, desktop 1280×800 e 360×800, com e sem JavaScript.

| Critério | Resultado | Evidência |
|---|---|---|
| CA1 scripts e `#modalRoot` | ✅ | `/grupos/pace-da-oca` tem `participar.js`; `/` não; `#modalRoot` presente; `/js/participar.js` com `text/javascript`. Testes http (scaffold/participar) passam |
| CA2 HTML sem JS e `data-toast` | ✅ | Testes http da 014/015 e novos (`left`, `?conta=excluida`, `?criado=1` com nome escapado) passam |
| CA3 abrir modal | ✅ | Clique abre `.modal-bg`, URL inalterada, painel inline removido; título "Entrar no Pace da Oca"; foco em `#j-nome` com "Maria QA"; faixa `rgb(58,120,194)` (Zona Sul), chip branco com texto azul, `--z`/`--zon` corretos; `body.overflow=hidden`. Visual bate com o protótipo (screenshot 360 px) |
| CA4 foco, Esc, fundo, X | ✅ | Tab: j-ok → joinBtn → modal-x → j-nome; Shift+Tab inverso; Esc, X e clique no fundo fecham; clique interno não fecha; foco volta ao link "Entrar no grupo"; overflow restaurado; URL sem `#participar` |
| CA5 validação cliente | ✅ | "a" sem marcar: as duas mensagens exatas, foco em `#j-nome`, nenhum POST disparado; apelido válido sem checkbox: foco em `#j-ok` |
| CA6 envio válido | ✅ | Recarrega em `/grupos/<slug>#participar` com modal "Bem-vindo(a), Zé Corredor! … Primeiro treino…", foco em "Ver rota até o encontro"; ao fechar: "Você entrou como", badge do cabeçalho = 1, URL sem hash; recarregar não reabre |
| CA7 cards e login `?next=` | ✅ | Card de `/grupos` → `/grupos/cantareira-trail#participar` com modal aberto; recarregar após fechar não reabre. Visitante: `href=/conta/entrar?next=/grupos/pace-da-oca%23participar` |
| CA8 422 do servidor | ✅ | 41 caracteres sem `maxlength`: modal aberto, `#e-jnome` = "Use no máximo 40 caracteres.", foco em `#j-nome` |
| CA9 toasts | ✅ | Sair: toast "Você saiu do grupo." e sem aviso no topo nem `[data-toast]` residual; some em ~3,2 s. Excluir conta: toast "Sua conta foi excluída." na home. Cadastro: tela de sucesso + toast `Grupo “…” cadastrado.` |
| CA10 voltar pelo histórico | ✅ | Após envio, Voltar traz a página renderizada de novo pelo servidor (sem cache): sem botão preso. O `pageshow` fica como defesa extra (não exercitado) |
| CA11 360 px | ✅ | Grupo com nome de 50 caracteres sem espaço e apelido de 40 sem espaço: form, erro, sucesso e 422 com `docOver=0` e `modalOver=0`; tela de sucesso do cadastro sem scroll horizontal; toast em x=90–270 de 360 |
| CA12 sem JS e regressão | ✅ | Sem JS: painel inline por `#participar`, boas-vindas, sair com aviso no topo e sem toast. Menu mobile abre (`aria-expanded=true`); contador "3" funciona. `/meus` e `/grupos/novo` deslogado → 302 `/conta/entrar?next=…`. `/`, `/grupos`, `/grupos/pace-da-oca`, `/zonas`, `/mapa`, `/encontrar`, `/sobre` → 200; filtro `/grupos?zona=sul&nivel=avancado` retorna resultado |

Testes: 818 passaram / 0 falharam (52 arquivos) · Lint: ok (eslint + prettier)
Console do navegador: único erro é o 422 proposital do CA8; nenhum erro de JS.

## Problemas encontrados
Nenhum bloqueante.

## Sugestões não bloqueantes
- Sem JS, o link `#participar` leva a uma rolagem suave (pré-existente, 014); testes automatizados precisam esperar ~1,5 s antes de clicar. Não é bug.
- `rate limit` de `/conta/criar` (10/15 min por IP) é em memória e reinicia com o servidor; relevante só para quem rodar muitos cadastros na QA.
- Não verificado: flash do painel inline antes do módulo rodar (não perceptível em localhost); `inputmode` no iPhone (aparelho real, pendência M7).
- Pendências já registradas: CSP do M8 (`style="…"` do servidor), 018 (mapa), `[x]` da pendência M3 `[aria-pressed]` para o orquestrador.
