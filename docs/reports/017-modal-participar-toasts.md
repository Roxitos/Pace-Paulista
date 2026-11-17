# 017 — Modal "Entrar no grupo" e toasts

Spec: [`docs/specs/017-modal-participar-toasts.md`](../specs/017-modal-participar-toasts.md) · Marco: M7

## Specifier
Spec 017 escrita, segunda do M7. Menu mobile, contador de caracteres e `toast()` já existiam (001/016): ficam só como regressão no QA. Sem mudança de banco, domínio ou repo.
- `public/js/participar.js` (novo), carregado só na página do grupo (GET e 422): monta o modal a partir do painel `#participar` renderizado no servidor; trap de foco (sem o `_csrf` oculto), `Esc`/Fechar/clique no fundo, foco devolvido, abre por `#participar` ou `.open`, `replaceState` ao fechar, validação cliente das 2 regras do `submitJoin` (code points como o servidor), spinner "Entrando…", POST normal, restauro do botão no `pageshow`.
- Toasts via atributo `data-toast` lido pelo `app.js`: "Você saiu do grupo.", "Sua conta foi excluída.", "Grupo “{nome}” cadastrado.".
- Menores: `#modalRoot` no layout, ícone `alert` no `ui.js`, 2 regras de CSS para 360 px. 12 critérios de aceite; modal verificado pelo QA no navegador.

Perguntas em aberto (defaults na spec), aguardando o usuário: P1 (modal só na página do grupo × por cima da listagem, que exigiria rota nova + fetch), P2 (POST normal em vez de fetch), P3 (validação também no cliente), P4 (três avisos viram toast com JS), P5 (fechar tira `#participar` da URL).
Pendências do M7 que seguem abertas: `inputmode="numeric"` no iPhone (aparelho real), rótulo do botão de `/encontrar` até 375 px, itens do mapa (spec 018).

Aprovação: usuário aceitou os defaults de P1–P5 (modal só na página do grupo; POST normal; validação no cliente; avisos viram toast; fechar tira #participar da URL).

## Coder
Spec 017 implementada. `npm test` (51 arquivos, 816 testes) e `npm run lint` passam.
- `public/js/participar.js` (novo): monta o modal a partir do painel `#participar` do servidor; foco inicial, `Esc`/fundo/Fechar, trap de Tab, validação no cliente em code points, spinner "Entrando…" com POST normal, restauro do botão no `pageshow`, `replaceState` ao fechar.
- `public/js/app.js`: cada `[data-toast]` vira toast e o elemento é removido (vale o último). `public/js/ui.js`: ícone `alert`. `public/css/app.css`: 2 regras novas.
- `groups.routes.js`: `renderDetail` passa `scripts: ['participar']` (GET e 422). `layout.ejs`: `#modalRoot` antes de `#toastRoot`. `grupo-detalhe.ejs`, `home.ejs` e `grupo-novo.ejs`: `data-toast` nos três avisos.
- Testes: `scaffold`, `participar`, `grupo-novo` e `conta-excluir` (CA1, CA2, CA12). CA3–CA11 (navegador) ficam para o QA; teste de escape com `<b>` no toast do cadastro não escrito.
- Alertas: `style="…"` do painel segue pendente para a CSP do M8; foco inicial no 422 vai ao campo `aria-invalid="true"` (ou `#j-ok`). Docker indisponível, Postgres local usado nos testes. Nada commitado.

## Cleaner
Sem mudança de comportamento. `npm test` 816/816 e `npm run lint` OK.
- Única alteração: em `public/js/participar.js`, o `grid` intermediário foi inlinado em `getComputedStyle(document.querySelector('.detail-grid'))`.
- Revisados e mantidos: `app.js` (toasts), `ui.js`, `groups.routes.js`, views com `data-toast`, 2 regras de CSS e testes novos (sem redundância).
- Alerta para o Hardener: `getComputedStyle(document.querySelector('.detail-grid'))` sem checagem de `null`; `style="…"` do painel segue pendente para a CSP do M8.

## Hardener
Um achado (média), corrigido com teste; uma lacuna de cobertura fechada. `npm test` (818 testes) e `npm run lint` passam.
- `public/js/participar.js` chamava `getComputedStyle(document.querySelector('.detail-grid'))` sem checar `null`; se o seletor sumisse da view, a montagem do modal lançava `TypeError`. Agora `--z`/`--zon` vêm de `getComputedStyle(panel)` antes de remover o painel (variáveis CSS herdam, mesmo valor). Teste novo: `tests/client/participar.test.js` (DOM falso, sem jsdom; falhou antes, passa depois).
- CA2: faltava teste de escape do nome no `data-toast` da tela `?criado=1`. Não era bug (o EJS escapa). Caso novo em `tests/http/grupo-novo.test.js`: "nome com aspas e tags sai escapado no data-toast da tela de sucesso".
- Revisado sem problema: toast, título do modal, apelido e erros entram por `textContent`; `innerHTML` só recebe SVG/spinner fixos; `replaceState` usa só `pathname + search`; sem script inline novo; rotas, auth e CSRF inalterados; `?criado=1` só mostra a tela ao dono.
- Riscos aceitos: `style="…"` vindo do servidor segue pendente para a CSP do M8; o teste do cliente cobre só a montagem do modal (não trap de foco nem submit).
- Alertas para o QA: CA3–CA11 só no navegador; conferir a cor da zona no modal (agora lida do painel). Nada commitado.

## QA
APROVADO (CA1–CA12). `npm test` 52 arquivos / 818 verdes; lint e prettier ok. Detalhes em `docs/qa/017-modal-participar-toasts.md`.
- Playwright 1280 px e 360 px, com e sem JS: modal abre sem mudar a URL, foco no apelido, cor da zona lida do painel (azul na Zona Sul), trap de Tab, `Esc`/Fechar/fundo fecham e devolvem o foco, `#participar` sai da URL. Validação no cliente com as mensagens do servidor, sem POST; envio válido mostra as boas-vindas; 422 reabre o modal com a mensagem do servidor.
- Toasts ao sair do grupo, excluir a conta e cadastrar grupo; o aviso fixo do topo some. Sem JS, painel inline e avisos no topo. Sem scroll horizontal a 360 px (nome de 50 e apelido de 40 caracteres).
- Regressão: páginas públicas 200; `/meus` e `/grupos/novo` deslogado redirecionam para `/conta/entrar`. Único erro de console: o 422 proposital do CA8.
- Não verificado: `inputmode` no iPhone (aparelho real) e o handler de `pageshow` (a página volta renderizada de novo).
- Ambiente: sem Docker, Postgres local já de pé. Incidente: o QA fez `git stash` + `stash apply` por engano; árvore idêntica, sem perda.
