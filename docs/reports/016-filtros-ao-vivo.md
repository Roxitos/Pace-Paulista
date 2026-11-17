# 016 — Filtros ao vivo na `/grupos`

Spec: [`docs/specs/016-filtros-ao-vivo.md`](../specs/016-filtros-ao-vivo.md) · Marco: M7

## Specifier
Spec 016 escrita, a primeira do M7. O menu mobile já existia desde a spec 001, então o M7 foi dividido em três specs: 016 (filtros ao vivo), 017 (modal "Entrar no grupo", toasts de participar/sair/cadastrar e contador no cabeçalho, proposta) e 018 (mapa sem recarregar e rolagem do `/encontrar`, proposta).
- `GET /api/grupos` devolve `{count, countText, query, chips, results}`. `chips` e `results` são HTML gerado pelos mesmos partials da `/grupos` (`search-chips`, `search-results`) via `res.renderPartial`. Nenhum dado cru de grupo vai ao cliente; `Cache-Control: private, no-store`.
- `countLabel(n)` em `domain/filters.js`; `searchGroups` devolve a query canônica.
- JS do cliente vira módulo ES: `public/js/ui.js` (`ic`, `toast`), `app.js` importa dele, `filtros.js` novo (debounce 220 ms, esqueleto ≥ 260 ms, chips, limpar com toast, botão Filtros/Ocultar, `replaceState`, fallback para navegação normal se a API falhar).
- HTML da `/grupos` sem JS não muda. `tests/http/scaffold.test.js` precisa trocar a asserção do `<script>` para `type="module"`.

Perguntas em aberto (defaults na spec), aguardando o usuário: P1 (JSON com HTML pronto × objetos montados no cliente), P2 (esqueleto mínimo de 260 ms), P3 (manter "Os resultados atualizam na hora."), P4 (foco em `#count` ao remover chip ou limpar).

Aprovação: usuário aceitou os defaults de P1–P4 (JSON com HTML pronto; esqueleto ≥ 260 ms; subtítulo mantido; foco em `#count`).

## Coder
Spec 016 implementada. `npm test` (815 testes) e `npm run lint` (eslint e prettier) passam.
- `GET /api/grupos` em `groups.routes.js`/`groups.service.js`: JSON `{count, countText, query, chips, results}`, HTML dos novos partials `search-chips` e `search-results` (mesmos da `/grupos`) via `res.renderPartial`; `Cache-Control: private, no-store`; query canônica.
- `countLabel(n)` em `src/domain/filters.js`.
- JS do cliente: `public/js/ui.js` (`ic`, `toast`) e `public/js/filtros.js` novos; `app.js` importa de `ui.js`; layout carrega `locals.scripts` e o `<script>` passa a `type="module"`. "Limpar filtros" é delegado no `document`.
- Testes: `tests/http/api-grupos.test.js` (novo, CA1–CA5), `grupos.test.js`, `scaffold.test.js` e `filters.test.js` ajustados (CA6, CA12).
- Não verificado: CA7–CA11 (comportamento em navegador, sem DOM de teste) — ficam para o QA.
- Alertas: helper `innerOf` em `api-grupos.test.js` pode ir para `tests/helpers` se reaproveitado. Ambiente local (Postgres, `.env` gitignored) montado só para rodar os testes. Nada commitado.

## Cleaner
Refatoração mínima, sem mudança de comportamento. `npm test` (50 arquivos, 815 testes) e `npm run lint` passam.
- `src/views/pages/grupos.ejs`: removida a variável `n` usada uma só vez; a contagem chama `countLabel(groups.length)`.
- `src/middlewares/locals.js`: `renderPage` define `scripts: []` por padrão; o layout não precisa mais de `typeof scripts`.
- `src/views/layout.ejs`: o loop de scripts itera `scripts` direto, um `<script type="module">` por linha.
- `tests/http/api-grupos.test.js`: o CA1 compara `countText` com `countLabel` do domínio, em vez de recalcular o plural.
- Alertas: CA7–CA11 (navegador) seguem sem verificação automatizada, ficam para o QA; nada commitado.

## Hardener
Um achado (baixa), corrigido com teste. `npm test` (816 testes) e `npm run lint` passam.
- `public/js/filtros.js` chamava `preventDefault()` em qualquer clique nos chips e nos links "Limpar filtros", inclusive Ctrl/Cmd/Shift/Alt+clique, o que impedia abrir o filtro em nova aba. Nova função pura `isPlainClick(e)` em `public/js/ui.js`; os dois handlers retornam cedo nos outros cliques. Teste novo: `tests/client/ui.test.js` (falhou antes, passa depois).
- Revisado sem problema: entrada de `/api/grupos` (curingas, UTF-8 inválido, `__proto__`, `zona[]`, parâmetros repetidos, `nome` de 5000 caracteres; query parametrizada); resposta sem contato, `owner_id` ou e-mail; `Cache-Control: private, no-store` para visitante e logado, sem sessão nem cookie para visitante; `POST /api/grupos` recebe 403 do CSRF; corrida de requisições resolvida com `AbortController`; HTML injetado só vem da API (escapado pelo EJS), toast por `textContent`.
- Riscos aceitos: sem helmet/CSP/`nosniff` nem rate limit em `/api/grupos` (previstos no M8, `docs/PENDENCIAS.md`); 500 da API volta em HTML pelo `errorHandler` e consome flash pendente (raro); o `change` ao sair de "Nome"/"Local" repete a busca depois do debounce e o esqueleto pisca de novo (UX, para o QA avaliar).
- Alertas para o QA: CA7–CA11 (navegador) seguem não verificados; incluir Ctrl+clique num chip abrindo nova aba. Nada commitado.

## QA
APROVADO (CA1–CA12). `npm test` 51 arquivos / 816 verdes; lint e prettier ok. Detalhes em `docs/qa/016-filtros-ao-vivo.md`.
- API: 200 JSON com 5 chaves, `Cache-Control: private, no-store`, query canônica; parâmetros inválidos ignorados. `/grupos` carrega `filtros.js`, `/` não; sem script inline.
- Playwright 360×800: skeleton, contagem, chips, cards e URL atualizam; debounce de "Nome" em ~222 ms; chip remove só o seu filtro (foco em `#count`); "Limpar filtros" com toast de ~3,2 s; botão `Filtros`/`Ocultar filtros`; sem scroll horizontal; API em 500 ou abortada cai na navegação normal.
- Sem JS: "Aplicar filtros" visível, submit GET normal. Ctrl+clique num chip abre nova aba sem alterar a original.
- Regressão: páginas públicas 200; `/meus` e `/grupos/novo` deslogado redirecionam para `/conta/entrar?next=...`.
- Ambiente: sem Docker (`db:up` falhou), Postgres local já de pé. Sem comparação visual por screenshot com o protótipo.
