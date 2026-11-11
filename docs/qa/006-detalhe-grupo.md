# QA — 006 Detalhe do grupo `/grupos/:slug` com próximos encontros no fuso de SP
Veredito: APROVADO (na reverificação, no fim deste arquivo; o veredito original, REPROVADO, está mantido abaixo)

Data: 2026-11-11 · Branch `feat/m3-detalhe-mapa-sobre`, com o diff no working tree (nada commitado) · Windows 11, Node 24.19.0 (o AGENTS pede 22), Docker `postgres:16` em `127.0.0.1:5433`, Chrome headless via CDP.

Veredito original: REPROVADO. Motivo da reprovação: o problema 1. Em 360 px, a lista "Próximos encontros" quebra palavras no meio ("Segund|a-feira", "Ibirapuer|a", "President|e", "Minhocã|o") em **todos** os grupos demo. O protótipo não quebra essas palavras. A causa é a regra `overflow-wrap:anywhere` em `.sessions li > span`. Todos os critérios de aceite passam.

## Ambiente
- `npm run db:up`: não rodei. O container `pace-paulista-db-1` já estava saudável.
- `npm run migrate` 2x: `já está em dia (5 migrations)` nas duas vezes, com código 0. A spec não traz migration.
- `npm run seed`: `0 de 11 grupos demo inseridos (11 já existiam)`.
- `package.json` e `package-lock.json` sem diff, ou seja, nenhuma dependência nova.
- Servidores:
  - O diff rodou na porta 3100.
  - Uma cópia da HEAD (`git archive HEAD`) rodou na 3101, contra o mesmo banco, para a regressão.
  - Os dois logs ficaram sem erros. Os dois foram derrubados no fim.
- Dados temporários: para CA5, CA7 e CA8 inseri no banco de dev 3 grupos `qa-006-*` (um com nome de 50 caracteres sem espaço, local de 80 e `<script>` em todos os campos; um sem dono; um `pending`) e 1 usuário. **Apaguei tudo no fim**: voltaram a ser 11 grupos e 0 usuários.
- Relatórios das etapas: `docs/reports/006-detalhe-grupo.md` e o resumo do orquestrador.

| Critério | Resultado | Evidência |
|---|---|---|
| CA1 — `/grupos/pace-da-oca` completo | ✅ | `curl`: 200, `<title>Pace da Oca · Pace Paulista</title>`, chip "Zona Sul", "Grupo fictício · demonstração", "Segunda, Quarta e Sexta · 6h", "4:15–5:00 min/km". Descrição, tags, ponto ("Combinado no grupo, nas imediações da Oca") e "10 a 14 km" batem literalmente com o `DEMO` (prototipo.html:489–491). Nível "Avançado" (3 barras), participantes 56. Painel "Zona Sul" com selo, desc e `href="/grupos?zona=sul"`. O teste com membership (57) passa |
| CA2 — encontros no fuso de SP | ✅ | Testes com relógio fixo (`09:00Z` → 4 datas; `09:31Z` → 3) passam. No servidor real (qua 11/nov, 19h em SP), `/grupos/correria-do-carmo` lista 14, 21 e 28 nov e 5 dez, todos "Sábado, 6h30", com "Parque do Carmo · 8 a 12 km". `pace-da-oca` lista 13, 16, 18 e 20 nov (o treino das 6h de hoje já passou) |
| CA3 — 404 | ✅ | `curl`: `/grupos/nao-existe`, `/grupos/ABC`, `/grupos/a%20b`, 61×`a`, `pace_da_oca`, `PACE-DA-OCA`, `%00`, `pace-da-oca%0A`, `-` e `qa-006-pendente` (status `pending`) dão 404. Mostram "Página não encontrada" e "Esse grupo não foi encontrado. Ele pode ter sido removido." O 404 genérico (`/x404`) continua com "Esse endereço não existe.". O teste "sem consulta" (`vi.spyOn(pool,'query')`) passa, e no código o `SLUG_RE` vem antes do serviço |
| CA4 — contato só para logado (P4) | ✅ | No servidor real (deslogado), o grupo com `contact='<script>c</script>CCC…'` não tem "Contato" nem o valor, nem escapado (`grep -ci 'contato\|CCCCC'` = 0). O mesmo vale para `qa-006-sem-dono`, com `@qa_contato`. A barreira é dupla: o serviço zera `contact` sem `viewer`, e a view exige `locals.user && group.contact`. O caso logado só é testável pelo app de teste (não há login até o M5): os testes da linha no fim do `dl`, do grupo demo e do contato vazio passam |
| CA5 — etiqueta do cabeçalho | ✅ | Real com dono: `Cadastrado por &lt;script&gt;alert(1)&lt;/script&gt;`. Sem dono: nenhuma `demo-tag`. No card de `/grupos`, também nenhuma, como manda a P5 |
| CA6 — links | ✅ | "Voltar para os grupos" → `/grupos`. "Entrar no grupo" → `/conta/entrar?next=/grupos/pace-da-oca%23participar`. "Ver rota no mapa" → `/mapa/pace-da-oca`. Nenhum `href="#`. O único `data-act` é o `menu` do header |
| CA7 — escape | ✅ | `qa-006-longo`, com `<script>`, `<img onerror>`, `<b>` e `<i>` em nome, local, descrição, tags, ponto, distância e dono: nenhum `<script>` cru (só `<script src="/js/app.js" defer>`), e todos saem como `&lt;…&gt;`. Deslogado, o contato com `<script>` não aparece de jeito nenhum |
| CA8 — sem JS, 360 px, uma coluna, `aria-current` | ✅ (com o problema 1) | Chrome headless 360×800, JS ligado e desligado, claro e escuro, em `pace-da-oca`, `correria-do-carmo`, `qa-006-longo` (nome de 50 e local de 80 sem espaço), `qa-006-sem-dono`, `nao-existe` e `ABC`: `scrollWidth` = `innerWidth` = 360 e `scrollTo(500,0)` mantém `scrollX = 0`. `.detail-grid` com `grid-template-columns: 320px` e os 2 filhos em x=20. A 1280: `748px 360px`. `aria-current="page"` só em "Encontrar grupos". O conteúdo não vaza, mas a leitura piora: ver o problema 1 |
| CA9 — `proximos` independe do TZ do processo | ✅ | `TZ=UTC`, `TZ=Asia/Tokyo` e `TZ=America/Los_Angeles` com `npx vitest run tests/domain/schedule.test.js`: 62/62 em cada. A **suíte inteira** com `TZ=Asia/Tokyo` deu 447/447 |
| CA10 — SQL só no repo, parametrizado; testes e lint | ✅ | O único SQL novo é `findPublishedBySlug`, em `groups.repo.js`: `selectPublished("g.slug = $1 AND g.status = 'published'")`, com `[slug]`. O texto da condição é fixo. Rota e serviço não têm SQL. Testes 447/0, lint ok |

Testes: 447 passaram / 0 falharam (23 arquivos, 10 s) · Lint: ok (ESLint sem erros; "All matched files use Prettier code style!")

## Fidelidade ao protótipo
- Abri `docs/prototipo.html#grupo-<id>` no mesmo Chrome (JS ligado) e o site (JS desligado), a 360 e a 1280 px.
- Comparei o `innerText` e a assinatura de 28 elementos (x, y, largura, altura, cor, fundo, fonte): `.detail-head`, `.detail-grid`, `.panel`, `.sessions li`, as linhas de `dl.spec`, `.btn`, `.demo-tag` e `.zchip`.
- `pace-da-oca` e `cantareira-trail`: texto idêntico e assinaturas **idênticas** nas duas larguras. O `<button>` que virou `<a>` não muda nada.
- `minhocao-noturno` a 360: texto idêntico, mas cada `li` de encontros fica 25 px mais alto (+99 px na página) por causa do problema 1.

## Console do navegador
Nenhum `console.*` nem exceção em nenhum carregamento. Só aparecem o `404 /favicon.ico` já conhecido e o próprio 404 do documento em `nao-existe`/`ABC`.

## Regressão
- Comparei a cópia da HEAD (3101) com o diff (3100), com o mesmo banco. Estas páginas dão **os mesmos bytes (md5)**: `/`, `/grupos`, `/grupos?zona=sul&nivel=avancado`, `/grupos?nome=pace`, `/zonas`, `/grupos/zona/leste` (301), `/sobre`, `/mapa`, `/x404` e `/js/app.js`.
- `/css/app.css` só muda pelas 2 linhas novas (comentário e regra `overflow-wrap`).
- `/grupos/novo` mudou de propósito: agora dá o 404 com a mensagem do grupo, o que já está previsto na spec (M6).
- Em 360 e 1280 px, `/`, `/grupos` e `/zonas` não têm scroll horizontal com o seed. Os elementos além da borda são os carrosséis e as `track-deco`, como antes.

## Problemas encontrados
1. **[RESOLVIDO na reverificação abaixo] [média · visual 360 px · volta ao Coder]** A regra `overflow-wrap:anywhere` em `.sessions li > span` quebra palavras no meio em todos os grupos.
   - **Passos:**
     1. Abra `/grupos/pace-da-oca` em 360×800, com ou sem JS.
     2. Vá até "Próximos encontros".
   - **Resultado:**
     - `pace-da-oca` mostra "Segund / a-feira, / 6h" e "Parque / Ibirapuer / a · 10 a 14 km".
     - Em `minhocao-noturno`, aparecem "President / e João" e "(Minhocã / o)".
     - No protótipo, as mesmas linhas saem "Segunda- / feira," e "Ibirapuera", sem quebra no meio da palavra.
     - Screenshots temporários: `C:\Users\Xitos\AppData\Local\Temp\claude\9519414f725d5b3e\d37d8a38-e6a7-47b3-8d4c-5c8f264d1ee0\scratchpad\shots\sess-atual.png` e `sess-prototipo.png`, na mesma pasta.
   - **Causa:** o grid do protótipo (`auto minmax(0,1fr) auto`) deixa a coluna do meio com só **63 px** a 360 px. O protótipo também tem esses 63 px, mas deixa a palavra transbordar um pouco para o vão. Com `anywhere`, a palavra quebra em qualquer letra.
   - **Alternativa testada:** `overflow-wrap:break-word` dá o mesmo resultado, porque a coluna é fixa. Sem regra nenhuma, um local de 80 caracteres sem espaço volta a abrir scroll, que foi o motivo da regra.
   - **Onde corrigir:** a regra entrou no Coder (`.detail-head h1, .sessions li > span`). O Hardener ampliou para outros seletores, e esses não pioraram nada: `.sub span`, `.panel p` e `.tag` têm a assinatura idêntica à do protótipo.
   - **Correção esperada:** com o seed, nenhuma palavra quebrada a 360 px, e mesmo assim sem scroll com o grupo de texto longo.
   - **Caminho provável:** um ajuste de layout só nas larguras estreitas. Por exemplo, a faixa de pace desce para baixo do texto, ou a coluna do meio ganha um mínimo, e o `anywhere` fica só como rede de segurança.
   - Isso altera o visual do protótipo, então, se o Coder optar por mexer no grid, vale o OK do usuário (via Specifier). O protótipo já é imperfeito aí: "Presidente" quase encosta em "5:00–6:00 min/km".

## Sugestões não bloqueantes
1. **Cards de `/grupos` com nome longo sem espaço (já existe desde 004/005, não é desta spec):** um nome de 50 caracteres sem espaço abre scroll horizontal no card. A 1280 px, `scrollWidth` 1385, e o `a` do `h3` termina em x=1385. A 360 px, a viewport mobile alarga para 1025. A HEAD gera os mesmos bytes. Hoje só os 11 demo existem, mas o cadastro do M6 permite esse nome. Sugiro registrar em `PENDENCIAS.md` para o M6.
2. Com texto extremo (local de 80 sem espaço), a linha do encontro fica "Sábado / , 23h", com a vírgula órfã. O problema 1 deve resolver isso junto.
3. O caso logado do CA4 só foi verificado pelo app de teste. O QA do M5 deve repetir com sessão real: o contrato é a sessão preencher `res.locals.user`.
4. Percent-encoding malformado (`/grupos/%E0%A4%A`) dá 400 com a página "Algo deu errado". O comportamento é anterior a esta spec e já foi notado pelo Hardener.
5. Na máquina local roda o Node 24.19, mas o AGENTS pede 22 LTS. Os testes passam, mas vale alinhar, por exemplo com `engines` ou `.nvmrc`, se ainda não existir.
6. Continuam pendentes do QA 004/005: `/favicon.ico` 404 e CSP/`helmet`.

## Resolvidos
- Problema 1 (palavras quebradas no meio em "Próximos encontros" a 360 px): o usuário decidiu que, em telas estreitas, a faixa de pace desce para baixo do texto do encontro (spec 006, "Respostas"). O Coder implementou só em CSS. Ver "Reverificação — encontros em tela estreita".

## Reverificação — encontros em tela estreita
Veredito final: **APROVADO**. O problema 1 está resolvido.

Data: 2026-11-11 · mesmo working tree, sem commit · Chrome headless via CDP, sem JS no site. Servidores: o diff na porta 3100 e a cópia da HEAD na 3101, os dois com o banco de dev.

### Mudança verificada
`public/css/app.css`, no bloco de acréscimos, antes do marcador "Layout":

```css
@media (max-width:560px){ul.sessions li{grid-template-columns:auto minmax(0,1fr);row-gap:4px}ul.sessions li > .date-box{grid-row:span 2}ul.sessions li > .mono{grid-column:2}}
```

O HTML não mudou. A regra `overflow-wrap:anywhere` anterior continua valendo como rede de segurança.

### Testes e lint
- Testes: **449 passaram / 0 falharam** (23 arquivos; eram 447, mais os 2 testes novos do Coder).
- Lint: ok (ESLint sem erros; "All matched files use Prettier code style!").

### Verificações
| Cenário | Resultado | Evidência |
|---|---|---|
| Os 11 grupos do seed a 360×800, sem JS, claro e escuro | ✅ | Script que percorre caractere por caractere o texto de `.detail-head` e `.detail-grid` com `Range.getClientRects()`. Ele acusa quando dois caracteres vizinhos da mesma palavra caem em linhas diferentes (quebra depois de hífen, travessão ou barra é legítima). Resultado: **0 palavras quebradas** nos 11 grupos e nos 2 esquemas de cor. Os encontros ficam em 2 colunas (`58px 202px`), e o texto ganha 202 px em vez de 63. `scrollWidth` 360 e `scrollX` 0 depois de `scrollTo(500,0)`. Screenshots: "Quarta-feira, 20h30 / Elevado Presidente João / Goulart (Minhocão) · 6 a 8 km / 5:00–6:00 min/km", com a data ocupando as duas linhas à esquerda |
| Outras larguras estreitas (414 e 561 px) e 768 px, os 11 grupos | ✅ | 414 px: 2 colunas (`58px 256px`). 561 e 768 px: voltam as 3 colunas do protótipo (`58px 264px 125px` e `58px 456px 125px`). Nas três larguras, 0 palavras quebradas e nenhum scroll |
| Local de 80 caracteres sem espaço **gravado no banco** | ✅ | Grupo temporário `qa-006-local-longo`, inserido com `psql`. O SELECT confirmou `char_length(location)=80` e `char_length(name)=50`; os mesmos 80/50 caracteres sem espaço valem para ponto, distância, descrição, tags e contato. A 320, 360, 414, 561 e 768 px, `scrollWidth` = `innerWidth`, sem scroll. As únicas "quebras" acusadas são dentro das próprias sequências sem espaço (WWW…, LLL…, DDD…), que é justamente o que precisa acontecer. "Segunda-feira, 23h" e "Sábado, 23h" ficam inteiros, e a vírgula órfã ("Sábado / , 23h") da sugestão 2 sumiu. O grupo foi **apagado** no fim |
| 1280 px sem mudança, os 11 grupos | ✅ | Comparei o protótipo (`prototipo.html#grupo-<id>`, JS ligado) com o site: `innerText` igual e 44 elementos por página (x, y, largura, altura, cor, fundo e fonte de `.detail-head`, `h1`, `.sub span`, `.detail-grid`, `.panel`, `.sessions li`, cada span do `li`, linhas da ficha, `.btn`, `.demo-tag` e `.zchip`). A **única** diferença é a tag `BUTTON`→`A` do "Entrar no grupo", pedida pela spec: mesma caixa e mesmas cores. A media query não age acima de 560 px |
| 360 px contra o protótipo, os 11 grupos | ✅ (desvio intencional) | Texto igual. As diferenças estão só em `.sessions li` e nos spans dele (cada `li` passa de 199 para 99 px de altura, com o pace em x=115 e abaixo do texto). O resto da página só sobe junto: o painel de encontros fica 399 px mais curto em `pace-da-oca` |
| Console | ✅ | Nenhum `console.*`, exceção ou resposta ≥ 400 nas páginas de detalhe (o `favicon.ico` foi filtrado, é o já conhecido) |
| Regressão | ✅ | HEAD (3101) × diff (3100), com md5 do HTML. **Iguais**: `/`, `/grupos`, `/grupos?zona=sul&nivel=avancado`, `/grupos?nome=pace`, `/zonas`, `/grupos/zona/leste`, `/sobre`, `/mapa`, `/x404` e `/js/app.js`. Diferente só `/grupos/novo` (404 com a mensagem do grupo, como antes). O `app.css` só ganha as 5 linhas do bloco de acréscimos (duas regras e dois comentários). `/`, `/zonas` e `/x404` a 360 e 1280 px: mesmos `scrollWidth` na HEAD e no diff |

### Limpeza
- Servidores das portas 3100 e 3101 derrubados.
- Todos os Chrome headless do QA encerrados (nenhum processo com o perfil temporário).
- Grupo `qa-006-local-longo` apagado: o banco voltou a 11 grupos e 0 usuários.

### Sugestões não bloqueantes (novas)
7. A **320 px**, todas as páginas (`/`, `/zonas`, `/x404` e o detalhe) têm `scrollWidth` 323, ou seja, 3 px de scroll horizontal. Já acontece na HEAD com os mesmos números, então não vem desta spec. A meta do AGENTS é 360 px. Se 320 px importar (celulares antigos e pequenos), vale registrar em `PENDENCIAS.md`.
8. As sugestões 1 e 3 a 6 continuam valendo. A 2 foi resolvida junto com o problema 1.
