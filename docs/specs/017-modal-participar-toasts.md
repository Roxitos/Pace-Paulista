# 017 — Modal "Entrar no grupo" e toasts
Marco: M7 · Status: aguardando OK do usuário (P1–P5 no fim), depois pronta para Coder
Depende de: 014 (painel `#participar` sem JS, flash `joined`/`left`), 015 (badge no cabeçalho), 016 (`ui.js` com `ic`, `toast`, `isPlainClick`; `locals.scripts`)
Próxima proposta: 018 (`mapa.js` sem recarregar, rolagem suave do `/encontrar`, acessibilidade dos pins).

## Objetivo
Com JS, o "Entrar no grupo" da página do grupo abre o modal do protótipo (`openModal`/`openJoin`/`submitJoin`): trap de foco, `Esc`, clique no fundo, apelido pré-preenchido, validação no cliente, spinner "Entrando…" e boas-vindas dentro do modal. Os avisos de "saiu do grupo", "conta excluída" e "grupo cadastrado" viram toast, como no protótipo. Sem JS, nada muda (painel `#participar` e avisos das specs 012–014).

## Estado atual (não refazer)
- **Menu mobile**: pronto desde a 001 (`[data-act="menu"]` em `public/js/app.js`, alterna `#hdr.open`, `aria-expanded` e o ícone `menu`/`x`, como o protótipo). Só regressão no QA.
- **Contador de caracteres** da descrição do cadastro: pronto (`#c-desc` → `#descCount`, em code points como o servidor). Só regressão no QA.
- **`toast(msg)`**: pronto em `public/js/ui.js` (spec 016, 3200 ms, `textContent`).
- **Badge do cabeçalho**: renderizado no servidor a cada página (015). Como entrar/sair continua recarregando a página (P2), não precisa de atualização no cliente.

## Fora do escopo
- Abrir o modal **por cima da listagem** (cards de `/grupos`, `/encontrar`, home, `/meus`) sem sair da página: exigiria rota nova de fragmento + POST por `fetch` + atualizar cards e badge (P1). Aqui os cards seguem levando a `/grupos/<slug>#participar`, e o modal abre lá.
- Participar/sair por `fetch` sem recarregar (P2).
- Validação no cliente do cadastro de grupo (`submitCad`/`showErrors`): continua só no servidor (422 com os mesmos textos).
- Excluir conta em 2 passos sem recarregar (`reset-ask` do protótipo): continua com `?excluir=1` (012).
- `mapa.js`, rolagem suave do `/encontrar`, foco/alvo de toque dos pins, `aria-current` em `/encontrar`, deslocamento antes das webfontes (018 / pendências M7).
- Texto do botão de `/encontrar` em ≤ 375 px e teste de `inputmode="numeric"` em iPhone (pendências M7 abertas; ver Perguntas).

## Mudanças

### Banco
Nenhuma.

### Domínio / service / repo
Nenhuma mudança.

### Rotas — `groups.routes.js`
- `renderDetail(res, detail, join)` passa `scripts: ['participar']` (vale para `GET /grupos/:slug` e para o 422 de `POST /grupos/:slug/participar`). A tela de sucesso do cadastro (`?criado=1`, view `grupo-novo`) **não** carrega `participar.js`.
- Nada mais muda (status, redirects, flash).

### Views
- `layout.ejs`: `<div id="modalRoot"></div>` logo antes de `<div id="toastRoot" aria-live="polite"></div>` (linha 403 do protótipo).
- Avisos que viram toast com JS (o HTML sem JS continua igual; só ganha o atributo):
  - `grupo-detalhe.ejs`, flash `left`: `<div class="wrap notice-top" data-toast="Você saiu do grupo.">…` (conteúdo atual).
  - `home.ejs`, `accountDeleted`: `<div class="wrap notice-top" data-toast="Sua conta foi excluída.">…` (P4).
  - `grupo-novo.ejs`, tela de sucesso (`created`): dentro do `.success`, `<span hidden data-toast="Grupo “<%= created.name %>” cadastrado."></span>` (texto do `submitCad`, linha 947; aspas curvas literais; nome com `<%= %>`).
- `grupo-detalhe.ejs`: **sem mudança de HTML** além do `data-toast`. O JS reaproveita o painel `#participar` que já existe (form com `value` = `display_name`, ou erros do 422, ou o `.success` do flash `joined`).

### JS do cliente
- `public/js/ui.js`: acrescentar `alert` ao `ICONS` (path literal do `P.alert` do protótipo, linha 458).
- `public/js/app.js` (global): ao carregar, para cada `[data-toast]` no documento → `toast(el.dataset.toast)` e `el.remove()` (se houver mais de um, vale o último, como no protótipo, onde um toast substitui o outro).
- `public/js/participar.js` (novo, módulo; só age se existir `#participar` **e** `.detail-head`):
  1. **Montagem (uma vez, ao carregar)**: tira o painel `#participar` do documento (`remove()`); descarta o `h2` dele, se houver; guarda os demais filhos (`dl.spec` + `form`, ou o `.success`). Monta, com API de DOM (sem `style="…"` em string, por causa da CSP do M8), o modal do `openModal` + `openJoin`:
     ```html
     <div class="modal-bg" data-act="modal-bg">
       <div class="modal" role="dialog" aria-modal="true" aria-labelledby="mTitle">  <!-- --z/--zon via style.setProperty -->
         <button class="modal-x" data-act="close-modal" aria-label="Fechar">{ic('x')}</button>
         <div class="modal-top">{clone de .detail-head .zchip, com style.background='var(--zon)' e style.color='var(--z)'}<h2 id="mTitle">Entrar no {nome}</h2></div>
         <div class="modal-body" id="joinBody">{filhos guardados do painel}</div>
       </div>
     </div>
     ```
     - `--z`/`--zon`: `getComputedStyle(document.querySelector('.detail-grid')).getPropertyValue(...)`.
     - `{nome}` = `textContent` do `.detail-head h1` (nunca `innerHTML`).
  2. **Abrir** (`openModal`): guarda `document.activeElement` (`lastFocus`); põe o `.modal-bg` em `#modalRoot`; `document.body.style.overflow = 'hidden'`; foco inicial:
     - form com erro do servidor (`[aria-invalid="true"]` ou `.err` não vazio) → 1º campo com erro (`#j-nome`, senão `#j-ok`);
     - form sem erro → `#j-nome` (já vem com o `display_name`; o protótipo focava o 1º input);
     - sucesso → 1º `.modal .btn` (`Ver rota até o encontro`), como o `submitJoin`.
  3. **Quando abre**:
     - clique simples (`isPlainClick`) em `a[href="#participar"]` → `preventDefault` + abrir;
     - ao carregar, se `location.hash === '#participar'` (vindo dos cards, do login com `?next=` ou do redirect do POST) **ou** o painel tinha a classe `open` (422 ou flash `joined`) → abrir.
  4. **Fechar** (`closeModal`): botão `.modal-x`, `Esc` (keydown no documento com modal aberto), clique em `.modal-bg` com `e.target === bg` (não em filho). Esvazia `#modalRoot`, `document.body.style.overflow = ''`, `history.replaceState(null, '', location.pathname + location.search)` (tira o `#participar`, para recarregar não reabrir; P5) e devolve o foco a `lastFocus` se ainda estiver no documento e não for o `body`, senão a `main#view`. Reabrir mostra os mesmos nós (com o que já foi digitado).
  5. **Trap de foco** (linha 1100 do protótipo): com modal aberto, `Tab`/`Shift+Tab` circulam entre `.modal a[href], .modal button:not([disabled]), .modal input:not([type=hidden]):not([disabled])` (o `_csrf` oculto fica de fora).
  6. **Enviar** (`submitJoin`, linhas 1015–1022), no `submit` do form do modal:
     - `apelido = form.apelido.value.trim()`; erro se `[...apelido].length < 2` (code points, como o servidor) → `Informe um nome ou apelido com pelo menos 2 letras.`; erro se `!form.ok.checked` → `Confirme que leu as orientações.`
     - Escreve em `#e-jnome`/`#e-jok`: `ic('alert','ico-sm')` + mensagem por `textContent` (ou vazio); `aria-invalid` `true`/`false` em `#j-nome`.
     - Com erro: `preventDefault`, foco no `#j-nome` se ele errou, senão no `#j-ok`. Sem alerta "Corrija N campos" (o `submitJoin` não tem).
     - Sem erro: **não** cancela o envio (POST normal, PRG da 014; P2). `#joinBtn.disabled = true` e conteúdo `<span class="spinner"></span> Entrando…`.
  7. **Voltar pelo histórico** (`pageshow` com `event.persisted`): reabilita `#joinBtn` e restaura `Confirmar entrada`.
  - Sem `<script>` inline, sem `eval`, sem `innerHTML` com dado do usuário/banco (nome, apelido, mensagens via `textContent`; o restante já vem escapado do servidor).

### CSS — `public/css/app.css` (área de acréscimos, acima do marcador "Layout")
```css
/* Modal "Entrar no grupo" (spec 017): nome (50) e apelido (40) sem espaço não podem alargar o modal em 360 px. */
.modal .stack{grid-template-columns:minmax(0,1fr)}
.modal-top h2{overflow-wrap:anywhere}
```
(`.success`, `.form-alert > span` e `.modal`/`.modal-*`/`.spinner`/`.toast` já existem.)

## Regras e mensagens
| Situação | Regra | Texto exato |
|---|---|---|
| título do modal | sempre | `Entrar no {nome}` |
| apelido (cliente) | `< 2` code points após `trim` | `Informe um nome ou apelido com pelo menos 2 letras.` |
| orientações (cliente) | checkbox desmarcado | `Confirme que leu as orientações.` |
| enviando | botão desabilitado | `Entrando…` (com `.spinner`) |
| fechar | botão do modal | `aria-label="Fechar"` |
| saiu do grupo (JS) | toast 3200 ms | `Você saiu do grupo.` |
| conta excluída (JS) | toast 3200 ms | `Sua conta foi excluída.` |
| grupo cadastrado (JS) | toast 3200 ms | `Grupo “{nome}” cadastrado.` |
| apelido > 40 | só servidor (o `maxlength` impede no cliente) | `Use no máximo 40 caracteres.` (014) |

## Critérios de aceite
- [ ] CA1 — `GET /grupos/<slug>` (visitante e logado) e o 422 de `POST …/participar` incluem `<script type="module" src="/js/participar.js"></script>`; `/`, `/grupos` e a tela `?criado=1` não incluem. Todas as páginas têm `<div id="modalRoot"></div>` antes de `#toastRoot`. `/js/participar.js` é servido com `content-type` JavaScript.
- [ ] CA2 — HTML sem JS inalterado: os testes da 014/015 passam sem alteração; o aviso `Você saiu do grupo.` tem `data-toast="Você saiu do grupo."`; a home com `?conta=excluida` tem `data-toast="Sua conta foi excluída."`; a tela de sucesso do cadastro tem `data-toast="Grupo “{nome}” cadastrado."` com o nome escapado (teste com `<b>` no nome: sai `&lt;b&gt;`).
- [ ] CA3 — Com JS, logado não participante: clicar "Entrar no grupo" na Ficha do treino abre o modal (fundo escuro, faixa da cor da zona com o chip da zona e `Entrar no {nome}`), sem mudar a URL e sem mostrar o painel inline; foco no apelido, que vem preenchido com o `display_name`.
- [ ] CA4 — Com JS: `Tab`/`Shift+Tab` não saem do modal (passam por Fechar, apelido, checkbox, Confirmar entrada); `Esc`, o botão Fechar e o clique no fundo fecham; clicar dentro do modal não fecha; ao fechar, o foco volta ao "Entrar no grupo" e a página volta a rolar.
- [ ] CA5 — Com JS: enviar com apelido vazio/1 letra ou sem marcar as orientações mostra as mensagens da tabela no modal, sem requisição ao servidor (aba Rede) e com foco no 1º campo com erro.
- [ ] CA6 — Com JS: envio válido mostra `Entrando…` com spinner e botão desabilitado; a página recarrega em `/grupos/<slug>#participar` com o modal aberto mostrando `Bem-vindo(a), {apelido}!` e foco em `Ver rota até o encontro`; ao fechar, a página mostra "Você entrou como …", o badge do cabeçalho já contado e a URL sem `#participar`.
- [ ] CA7 — Com JS: clicar "Entrar no grupo" num card de `/grupos` (logado) leva a `/grupos/<slug>#participar` com o modal já aberto; idem após o login vindo de `?next=/grupos/<slug>%23participar`. Recarregar depois de fechar não reabre.
- [ ] CA8 — Com JS: um 422 do servidor (ex.: apelido de 41 caracteres depois de remover o `maxlength` pelo DevTools) recarrega a página com o modal aberto, a mensagem do servidor em `#e-jnome` e foco no campo com erro.
- [ ] CA9 — Com JS: "Sair do grupo" recarrega a página e mostra o toast `Você saiu do grupo.` (~3,2 s), sem o aviso no topo; excluir a conta mostra o toast `Sua conta foi excluída.` na home; cadastrar grupo mostra a tela de sucesso e o toast `Grupo “{nome}” cadastrado.`
- [ ] CA10 — Com JS: voltar (botão Voltar do navegador) para a página do grupo após um envio não deixa o botão preso em `Entrando…`.
- [ ] CA11 — 360 px com JS: modal com nome de 50 caracteres sem espaço e apelido de 40 sem espaço (form, erro e sucesso) sem scroll horizontal da página nem do modal; toast cabe na tela.
- [ ] CA12 — Sem JS: tudo como nas specs 012–015 (painel inline por `#participar`, avisos no topo, tela de sucesso sem toast). Menu mobile e contador de caracteres continuam funcionando com JS. Nenhum script inline; nada de SQL fora de `*.repo.js`; `npm test` e `npm run lint` passam.

## Testes esperados
- http `tests/http/participar.test.js`: um caso para o `<script … participar.js>` no GET e no 422 (CA1) e o `data-toast` do flash `left` (CA2).
- http `tests/http/scaffold.test.js`: `#modalRoot` antes de `#toastRoot` no layout; `/js/participar.js` com `content-type` JavaScript; `/` sem `participar.js`.
- http (arquivo do cadastro de grupo): `data-toast` na tela `?criado=1` com nome escapado e sem `participar.js` (CA1/CA2).
- http (arquivo da exclusão de conta): `data-toast="Sua conta foi excluída."` na home com `?conta=excluida`.
- CA3–CA11: inspeção no navegador pelo QA (sem jsdom, como na 016).

## Riscos / perguntas em aberto
- **P1 — Onde o modal abre.** Default: **só na página do grupo**; os cards (`/grupos`, `/encontrar`, home) levam a `/grupos/<slug>#participar` e o modal abre lá, por cima da página do grupo. Diferença do protótipo: lá o modal abria por cima da própria listagem. A alternativa (modal por cima da listagem) precisa de rota nova de fragmento (`GET /grupos/:slug/participar` ou JSON), POST por `fetch` e atualização de card/badge sem recarregar: proponho spec própria, se quiserem.
- **P2 — Envio por POST normal (default)** em vez de `fetch`: a página recarrega e o modal reabre com o sucesso ou com os erros do servidor. Sem duplicar o render do sucesso no cliente e com badge/contagem/"Você entrou como" sempre certos. Custo: recarga visível entre o envio e o modal de boas-vindas.
- **P3 — Validação no cliente** com as 2 regras do `submitJoin` (default sim, contando code points como o servidor). Duplica a regra do schema; o servidor continua a autoridade.
- **P4 — Toasts no lugar dos avisos com JS**: `Você saiu do grupo.` (literal do protótipo), `Grupo “{nome}” cadastrado.` (literal, somado à tela de sucesso) e `Sua conta foi excluída.` (o protótipo tinha `Dados locais apagados.` como toast; o texto da 012 fica). Default: os três viram toast e o aviso no topo some com JS. Alternativa: manter os avisos fixos e não usar toast.
- **P5 — Fechar o modal tira `#participar` da URL** (`replaceState`), para recarregar/compartilhar não reabrir o modal. Default sim.
- Risco: com o `#participar` na URL, o painel inline pode aparecer por um instante antes do módulo rodar (módulos são diferidos). Aceitável; o QA confirma se é perceptível.
- Risco: `body.style.overflow` e `style.setProperty` são CSSOM (permitidos por CSP); nenhum atributo `style` novo em string. Os `style="…"` que já vêm do servidor no painel (nota, sucesso) seguem no caso já registrado para a CSP do M8.
- Risco: o toast entra numa região `aria-live` logo após o carregamento; alguns leitores de tela podem não anunciar. Sem JS o aviso fixo tem `role="status"`.
- Pendências M7 que **continuam abertas** (não cabem aqui): `inputmode="numeric"` no iPhone (exige aparelho real; o QA não consegue verificar); rótulo do botão de `/encontrar` em ≤ 375 px; `mapa.js`, foco/alvo dos pins, `aria-current` em `/encontrar`, deslocamento das webfontes (018).
- Pendência M3 "regras CSS `[aria-pressed]` órfãs": a 016 decidiu mantê-las (bloco literal testado byte a byte); falta marcar `[x]` em `docs/PENDENCIAS.md` (orquestrador).
