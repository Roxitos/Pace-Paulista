# QA — 008 Encontrar meu grupo `/encontrar` com `calcMatch` no servidor
Veredito: APROVADO (volta 1)

Histórico:
- Volta 0: REPROVADO só pelo CA10 (scroll horizontal de 21 px a 360/375 px; o botão `.btn` nowrap media 334 px numa coluna de 268 px). Devolvido ao Coder.
- Volta 1: o Coder acrescentou `#matchForm .btn{white-space:normal;text-align:center}` ao bloco "Acréscimos do site" do `app.css`. O CA10 passa e não há regressão. Detalhes em "Reverificação (volta 1)" no fim. As seções abaixo são da volta 0; só a linha do CA10 e a contagem de testes foram atualizadas.

Data: 2026-11-12 · Branch `feat/m4-compatibilidade` (diff não commitado) · Linux, Node 22.23.4, Postgres 16 local em `localhost:5432`, Chromium headless do Playwright.

Escopo: o diff da 008 é o `git diff` mais os arquivos não rastreados (`src/domain/match.js`, `src/modules/matching/`, `encontrar.ejs`, `form-errors.ejs`, `match-card.ejs` e os testes novos). Decisões P1–P5 aplicadas com os defaults da spec.

## Ambiente
- `npm ci`: ok. `package.json` e `package-lock.json` sem diff, ou seja, nenhuma dependência nova.
- `npm run db:up`: não roda neste ambiente (sem Docker). O Postgres local já estava de pé.
- `npm run migrate` 2x: `já está em dia (5 migrations)` nas duas vezes. A spec não traz migration.
- `npm run seed`: `0 de 11 grupos demo inseridos (11 já existiam)`.
- Servidores:
  - O working tree rodou na porta 3000 (`npm start`).
  - O `HEAD` (`git archive`, sem a 008) rodou na 3001, com o mesmo banco, para a regressão.
  - O working tree rodou também na 3002 com `DATABASE_URL` para uma porta fechada (banco fora do ar).
- Dados temporários no banco de dev:
  - `qa008-empate`: publicado, igual ao Pace da Oca, nome "AAA Empate QA".
  - `qa008-pend`: igual ao anterior, mas `pending`.
  - `qa008-xss`: `<script>` no nome e no local (o local ainda leva `&`, aspas e `#`).
  - `qa008-longo`: nome de 50 caracteres e local de 80, ambos sem espaço.
  - **Tudo foi removido no fim**: 11 grupos `published`, `contact` NULL, 0 usuários e 0 memberships.

| Critério | Resultado | Evidência |
|---|---|---|
| CA1 — mesmos resultados do protótipo (pronto do M4) | ✅ | **(a) Grade completa e independente da cópia do Coder.** As funções foram extraídas do `prototipo.html` em execução no Chromium: `DEMO` via `api.listGroups()`, `calcMatch`, `listaPt`, `sortDias`, `periodoDe` e o pipeline do `submitMatch`. O lado do site é `rankMatches` sobre `listPublishedByCreation()` do **banco** de dev. A grade cobre 6 zonas × **os 127 subconjuntos de dias** × 3 níveis × 5 períodos × **todo pace de 180 a 720 s, segundo a segundo**: 6.183.630 combinações, **0 divergências** em slug, ordem, pct e motivos. A ordem do banco é igual à do `DEMO`. **(b) Página × protótipo de verdade.** Nos casos A–J, o protótipo foi preenchido e enviado pelo próprio form, e o site foi aberto sem JS. O `innerText` do `#matchResults` saiu **idêntico** nos 10 casos: título, resumo, nomes, `N%` e motivos. A=5 (Pace da Oca 100 … Villa-Lobos 41), B=6, C=6 com Minhocão 50 dentro e Villa-Lobos fora, D="Nenhum grupo compatível", H=4 com Correria 40, J="1 grupo combina com você". **(c) Respostas aleatórias.** Foram 400 respostas via HTTP, sem JS. O título, o resumo, os slugs, o `N%`, o `--p` e os motivos bateram com o pipeline do protótipo, com 0 divergências |
| CA2 — `GET /encontrar` | ✅ | 200 e `<title>Encontrar meu grupo · Pace Paulista</title>`. O form tem 6 radios de zona, `#m-pace` (`inputmode="numeric"`, `placeholder="6:00"`, `aria-describedby="e-pace h-pace"`), o select com 5 opções ("Qualquer horário" + 4), 7 dias, 3 níveis, o botão "Mostrar grupos compatíveis" e o side-note literal. Não há `id="matchResults"`, o `#matchAlert` está vazio e os 4 `.err` estão vazios, sem espaço. O subtítulo termina em "Nada é salvo.". Com o banco fora do ar (porta 3002), `/encontrar` dá 200 e `?pace=&periodo=` dá 422 com o form. Uma busca válida dá 500 "Algo deu errado", sem vazar `ECONNREFUSED` nem a URL |
| CA3 — GET, âncora, form preenchido, recarregar | ✅ | `<form … method="get" action="/encontrar#matchResults" novalidate>`. O envio real pelo botão, sem JS, foi para `/encontrar?zona=sul&pace=4%3A30&periodo=cedo&dias=seg&dias=qua&nivel=avancado#matchResults`. **A página abre nos resultados**: com as fontes carregadas, o topo do `#matchResults` fica em y=84, logo abaixo do cabeçalho fixo (que termina em 71). Isso vale a 360 e a 1280, com e sem resultados (caso D); veja `ancora-360-sul.png`. Os campos voltam marcados: `checked` em sul, seg, qua e avançado, `value="4:30"` no pace e `cedo` selecionado. Recarregar mostra a mesma lista |
| CA3b — sem `POST /encontrar` | ✅ | `curl -X POST /encontrar` dá 404 com "Página não encontrada · Pace Paulista" |
| CA4 — erros | ✅ | `?pace=&periodo=` dá 422 com `role="alert"` e "Corrija 4 campos para continuar.". As 4 mensagens exatas aparecem em `e-zona`, `e-pace`, `e-dias` e `e-nivel` (com `&#34;`), cada uma com o ícone de alerta, e o `autofocus` cai no radio "Zona Norte" (foco confirmado no Chromium). `zona=sul&pace=2:59&dias=seg&nivel=avancado` dá 422 com "Corrija 1 campo para continuar.". O `e-pace` mostra "Use o formato 6:00, entre 3:00 e 12:00 min/km.", e o `#m-pace` tem `value="2:59" aria-invalid="true" autofocus` (foco confirmado). Sul, seg e avançado continuam marcados, não há `#matchResults`, e os spans sem erro saem `<span …></span>`. A página não rola para longe das mensagens (`scrollY` 0) |
| CA5 — entradas fora do form | ✅ | Nenhuma entrada deu 500. `zona=marte` dá erro só de zona, `nivel=__proto__` só de nível e `dias=xyz` só de dias. `dias=seg&dias=xyz` vale como seg. `periodo=constructor` dá 200, sem "No horário…". `zona=sul&zona=norte` fica sul, e `pace=5:00&pace=9:00` fica 5:00. `pace[a]=1` dá 422 com pace ausente (`curl -g`). `utm_source=x` dá 200 com o form vazio. Também testei `zona=hasOwnProperty&pace=toString&dias=constructor&nivel=valueOf&periodo=__proto__` (422 com 4 erros), `pace=%E0%A4%A` (422), `__proto__[pace]=…&constructor=1` (200, form vazio), `pace=99999999999999999999:00` (422, erro de formato) e `pace=%2005:00%20` (200, `value="05:00"`) |
| CA6 — 0 resultados | ✅ | Caso D: "Nenhum grupo compatível", "Pace 3:00 min/km · Zona Norte · avançado", o ícone `run`, "Ainda não temos esse grupo", o texto literal e "Cadastrar grupo" apontando para `/grupos/novo` |
| CA7 — links dos cards | ✅ | Cada card tem o nome e "Ver detalhes" apontando para `/grupos/<slug>`, "Ver rota" para `/mapa/<slug>` e "Entrar no grupo" para `/conta/entrar?next=/grupos/<slug>%23participar`. Não há nenhum `href="#`, e o único `data-act` é o `menu` do cabeçalho. Com clique real e sem JS: nome → 200, detalhes → 200, rota → 200, entrar → 404 (aceito até o M5) |
| CA8 — `pending` e desempate | ✅ | `zona=sul&pace=4:30&dias=seg&nivel=avancado` deu Pace da Oca 100, **depois** AAA Empate QA 100 (que viria antes na ordem zona+nome), depois qa008-xss 100, qa008-longo 100, Raia 50 e Represa 44. `qa008-pend` não aparece (0 ocorrências) |
| CA9 — escape | ✅ | `pace=<script>…` sai como `value="&lt;script&gt;alert(1)&lt;/script&gt;"`. O nome sai `&lt;script&gt;alert(1)&lt;/script&gt;X` e o local `&lt;script&gt;alert(2)&lt;/script&gt; &amp; &#34;q&#34; #x`. O único `<script` cru é o `src="/js/app.js"`, e no Chromium com JS não houve diálogo |
| CA10 — sem JS e 360 px | ✅ (volta 1) | **Volta 1**: `scrollWidth` = 360 a 360 px e 375 a 375 px nas 5 páginas medidas (form vazio, erros `?pace=&periodo=`, erro `pace=2:59`, resultados e caso D). Valeu com e sem JS, claro e escuro, medindo depois de `document.fonts.ready`. A 360, o botão mede 266x76 (2 linhas) e vai de x=47 a 313, dentro da área útil do form (borda interna em 314). Nenhum filho do form passa disso. O envio real pelo botão, sem JS, abre os resultados com `scrollWidth` 360. Ver `v2-*-360-*-botao.png`. *Volta 0: `scrollWidth` 381 a 360/375 px (ver "Problemas encontrados")* |
| CA11 — camadas, testes, lint | ✅ | `grep` por `SELECT/INSERT/UPDATE/DELETE/pool.query` em `src` fora de `*.repo.js`/`pool.js` não achou nada. `match.js` só importa `constants.js` e `schedule.js`. Nenhuma dependência nova. Testes 642/0 e lint ok |

Testes: 642 passaram / 0 falharam (31 arquivos, 14 s; mesmo número na volta 0 e na volta 1) · Lint: ok (ESLint sem erros; "All matched files use Prettier code style!")

## Checagens manuais
- **Sem JS**: o Chromium rodou com `javaScriptEnabled: false` a 360 e a 1280, claro e escuro. Testei o envio vazio pelo botão (422 + foco no 1º radio), o preenchimento com clique e teclado e o envio (resultados + âncora), o recarregar e o clique real em todos os links do card. Tudo funciona.
- **Claro/escuro**: com `colorScheme` light e dark, as cores do site e do protótipo são idênticas (ver abaixo). Os cards e os textos ficam legíveis nos dois.
- **Fidelidade ao protótipo**:
  - Comparei o caso A no protótipo (enviado de verdade) com o site sem JS, a 360 e a 1280, claro e escuro.
  - A assinatura (tag, classe, x, y, largura, altura, cor, fundo, fonte, tamanho e borda) de **363 elementos** cobre `.page-head`, `#matchForm`, `.side-note` e `#matchResults`.
  - **Diferem só 5**, nas 4 combinações: o "Entrar no grupo" é `<a>` aqui e `<button>` lá, como a spec manda. Até a posição e o tamanho desses 5 batem.
  - O form vazio também é igual, porque o HTML e as classes são os mesmos.
- **Console**: nenhuma exceção, nenhum `console.error` de script e nenhum diálogo, com ou sem JS. As únicas mensagens são o "Failed to load resource" que o Chromium registra para o próprio documento com status 422/404 (páginas de erro e o link "Entrar", que dá 404 até o M5).

## Regressão
- Comparei a 3000 (working tree) com a 3001 (`HEAD`), no mesmo banco, pelo md5 do corpo e dos cabeçalhos, sem `Date`/`ETag`.
- **Iguais**: `/`, `/grupos`, `/grupos?zona=sul&nivel=avancado`, `/grupos?zona=sul&zona=leste&pace=5a6&periodo=cedo`, `/grupos?nome=pace`, `/zonas`, `/grupos/pace-da-oca`, `/grupos/cantareira-trail`, `/grupos/zona/leste` (301), `/grupos/nao-existe` (404), `/grupos/novo` (404), `/mapa`, `/mapa/pace-da-oca`, `/sobre`, `/x404` e `/api/grupos` (404).
- `/js/app.js` só difere no `Last-Modified`, que é o mtime do `git archive`.
- `/css/app.css` só ganha as 4 linhas da spec.
- `/encontrar` passa de 404 para 200.

## Problemas encontrados

### 1. Scroll horizontal de 21 px em `/encontrar` a 360 px (CA10, AGENTS §8/§11.7) → **Coder** — *corrigido na volta 1*
Passos para reproduzir:
1. `npm start`.
2. Abra `http://localhost:3000/encontrar` com viewport de 360×800, com ou sem JS.
3. Espere as fontes carregarem e rode `document.documentElement.scrollWidth`. O resultado é `381`, e `window.scrollTo(400, scrollY)` deixa `scrollX = 21`.
4. O mesmo acontece em `?pace=&periodo=`, com resultados e no caso D. A 375 também, e a partir de 390 não.

Causa medida:
- O botão `button.btn.btn-primary.btn-lg` "MOSTRAR GRUPOS COMPATÍVEIS" tem `.btn{white-space:nowrap}` e `.btn-lg{font-size:20px;padding:16px 24px}` em Anton. Ele mede **334 px** (x de 47 a 381).
- A área útil do `.form` a 360 é de 268 px: 320 de card menos 2×26 de padding.
- O `.form` é `display:grid` sem `grid-template-columns`, então a trilha implícita `auto` cresce até o min-content do botão (334 px). Com isso, **todos** os filhos do form ficam com 334 px e passam da borda do card: o `#matchAlert`, os fieldsets, o `.choice-row`, o `.row2`, o `#m-pace`, o `#m-periodo` e o próprio botão.
- O card termina em x=340 e o conteúdo vai até 381. Em `botao-360.png` dá para ver o campo de pace, o select e o chip "Zona Sul" cortados pela borda direita.

Contexto:
- **O protótipo tem exatamente o mesmo defeito** (`prototipo.html#encontrar` com JS: `scrollWidth` 381, o mesmo botão de 334 px). Então ele vem da extração literal do CSS e do HTML.
- Mesmo assim, o CA10 desta spec e a definição de pronto do AGENTS (§8 "Mobile first: testar em 360 px … sem scroll horizontal", §11.7) exigem 360 px sem scroll.
- A spec previu só as duas linhas de CSS do `#matchResults`/`.match h3`, e a correção é mais um acréscimo no bloco "Acréscimos do site", sem redesenho. Por exemplo, deixar o botão do form quebrar linha ou encolher abaixo de ~420 px, ou dar `min-width:0` à trilha do `.form`. A escolha é do Coder.
- Depois da correção, reconferir: `scrollWidth` = 360 a 360 e a 375 nas 4 variantes (vazio, erros, resultados, sem resultados), e o botão inteiro visível dentro do card.

## Sugestões não bloqueantes
1. **`/grupos` com nome de 50 caracteres sem espaço (anterior à 008, fora do diff):**
   - Com o grupo temporário `qa008-longo` publicado, `/grupos` a 360 ficou com `scrollWidth` 1038 com JS (1362 sem JS, medido ainda com a fonte de fallback): o `h3 a` do `group-card` não quebra.
   - A 008 resolveu isso para o `match-card` (`.match h3{overflow-wrap:anywhere}`), mas o `group-card` não tem regra equivalente.
   - Hoje esse nome só existe por inserção direta no banco. Vale entrar na spec do M6 (cadastro de grupo) ou ser corrigido junto com o problema 1.
2. **Primeiro carregamento, antes das webfonts:**
   - Sem cache de fontes, nos primeiros ~300 ms a página usa a fonte de fallback. Nesse intervalo, o cabeçalho sem JS chega a 375 px (botão de menu) em todas as páginas, e a âncora `#matchResults` aparece fora do lugar (topo em y=330 a 360 px).
   - Depois que as fontes carregam, o Chromium reposiciona o topo em 84 e o cabeçalho volta a 360.
   - É transitório e anterior à 008 (`display=swap`). Fica só para registro no M7/M8.
3. Continuam valendo as sugestões dos QAs 006/007: `/favicon.ico` 404, CSP/`helmet` no M8 e escape malformado dando 400 genérico. Também segue valendo o P5 (`inputmode="numeric"` sem a tecla `:` no iPhone), já registrado no `PENDENCIAS.md`.

## Limpeza
- Servidores das portas 3000, 3001 e 3002 derrubados. Nenhum Chromium restante.
- A cópia do `HEAD` foi removida do scratchpad.
- Os 4 grupos `qa008-*` foram apagados. O banco ficou com 11 grupos `published`, `contact` NULL, 0 usuários e 0 memberships.
- O git não foi tocado: nenhum `add`, `commit`, `stash` ou `push`. O único arquivo novo no repo é este veredito. Um `proto-src.txt` criado por engano na raiz por um script do QA foi movido para o scratchpad.
- Scripts e screenshots ficaram em `/tmp/claude-0/-home-user-Pace-Paulista/197ff768-6ccf-5dfb-9da3-4f5a9a88dbe9/scratchpad/qa8/`: `grid.mjs`, `http.mjs`, `nojs.mjs`, `sw.mjs`, `fid.mjs`, `botao-360.png`, `ancora-360-sul.png`, `sw-*-360.png`, `fid-site-360.png` e `fid-proto-360.png`.

## Reverificação (volta 1)
Data: 2026-11-12, mesmo ambiente. O working tree rodou na porta 3010 e o `HEAD` (`git archive`) na 3011, no banco de dev. Não criei dados temporários no banco.

- **O que mudou**: depois do veredito da volta 0, só o `public/css/app.css` mudou entre `src`, `public`, `tests`, `db`, `scripts` e `package.json` (conferido por mtime). O diff do CSS contra o `HEAD` são as 4 linhas da volta 0 mais a regra nova com o comentário dela. O id `matchForm` só existe em `src/views/pages/encontrar.ejs`. Como nenhum JS ou EJS mudou, a grade do CA1 e os CAs 2–9 não foram refeitos.
- **CA10 (`v2-sw.mjs`)**:
  - Medições nas 5 páginas do `/encontrar` (vazio, `?pace=&periodo=`, `pace=2:59`, resultados e caso D), com JS ligado e desligado.

    | Largura | `scrollWidth` | Botão | Observação |
    |---|---|---|---|
    | 360 | 360 | 266x76, 2 linhas | claro e escuro |
    | 375 | 375 | 281x76 | claro e escuro |
    | 390 | 390 | 296x76 | |
    | 768 | 768 | 674x56, 1 linha | igual à volta 0 |
    | 1280 | 1280 | 714x56, 1 linha | igual à volta 0 |

  - Em todas as larguras, a borda direita do botão fica 1 px antes da borda interna do form.
  - O envio real pelo botão a 360 px, sem JS, leva a `…#matchResults`, mostra "3 grupos combinam com você" e mantém `scrollWidth` 360.
  - Console: nenhum `pageerror` e nenhum `console.error` de script.
- **Visual do botão**:
  - Conferi as capturas a 360 px com e sem JS, em claro e escuro. Os arquivos são `v2-{nojs,js}-{light,dark}-360-{vazio,erros,result}-botao.png` e `v2-{nojs,js}-{light,dark}-360-full.png`.
  - "MOSTRAR GRUPOS / COMPATÍVEIS" aparece em 2 linhas centralizadas, com a lupa à esquerda, sem corte. O campo de pace, o select e os chips de zona ficam inteiros dentro do card.
  - Nos dois temas, o contraste e a cor são os do `.btn-primary`.
  - *Nota*: o cabeçalho que aparece no meio do `v2-*-full.png` é um artefato da captura de página inteira tirada depois de rolar. Não é defeito.
- **Regressão contra o `HEAD`**:
  - Comparei o md5 do corpo e dos cabeçalhos, sem `Date`/`ETag`/`Last-Modified`.
  - **Iguais**: `/`, `/grupos`, os 3 filtros da volta 0, `/zonas`, `/grupos/pace-da-oca`, `/grupos/cantareira-trail`, `/grupos/zona/leste` (301), `/grupos/nao-existe` (404), `/grupos/novo` (404), `/mapa`, `/mapa/pace-da-oca`, `/sobre`, `/x404`, `/api/grupos` (404) e `/js/app.js`.
  - `/encontrar` continua passando de 404 para 200.
  - A 360 px, `/` e `/grupos` medem 360 nos dois servidores.
- **Testes e lint**: 642 passaram / 0 falharam, 31 arquivos. Lint ok (ESLint + Prettier).
- **Limpeza**: as portas 3010 e 3011 foram derrubadas, e a cópia do `HEAD` foi removida do scratchpad. O git não foi tocado.

### Sugestões não bloqueantes (volta 1)
1. **320 px, anterior à 008**: a 320 px todas as páginas medem `scrollWidth` 323, no `HEAD` também (`/`, `/grupos`, `/zonas`, `/sobre`, `/mapa`). A causa é o `button.menu-btn` do cabeçalho. No `/encontrar` o botão do form já cabe (226x76). A meta do projeto é 360 px, então fica só como registro para o M7/M8.
2. **Ícone com texto em 2 linhas**: com o texto quebrado, a lupa fica alinhada à esquerda e o texto centralizado. Está legível e coerente. Se o design preferir, um rótulo mais curto só abaixo de ~420 px seria outra opção, mas isso é decisão de produto e não precisa mudar.
3. As sugestões 1–3 da volta 0 continuam valendo (`group-card` com nome longo sem espaço, FOUT, favicon/CSP/escape malformado/P5).
