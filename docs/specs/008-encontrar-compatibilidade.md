# 008 — Encontrar meu grupo `/encontrar` com `calcMatch` no servidor
Marco: M4 · Status: pronta para Coder (P1–P5 respondidas pelo usuário: defaults aceitos; ver "Decisões" no fim)
Depende de: 004 (repo/serviço de grupos), 005 (`periodoDe`, `filter-options`), 006 (`fmtDiasLongo`)
Única spec do M4.

## Objetivo
Reproduzir `PageEncontrar` + `calcMatch` + `submitMatch` (prototipo.html linhas 832–887) renderizados no servidor: o formulário de compatibilidade funciona **sem JS**, a nota é calculada em `src/domain/match.js` sobre os grupos publicados do banco, e — critério de pronto do M4 — **as mesmas respostas dão a mesma lista, ordem, porcentagens e motivos que o protótipo**.

## Fora do escopo
- "Você já participa" no card de resultado e o modal "Entrar no grupo" (sessão no M5/M6, modal no M7). O botão "Entrar no grupo" é **link** para `/conta/entrar?next=/grupos/<slug>%23participar`, igual ao `group-card` (404 até o M5, já aceito desde a 002).
- Rolagem suave até os resultados (`scrollIntoView`, M7). Aqui a âncora `#matchResults` faz isso sem JS.
- Guardar respostas ou resultados (o protótipo não guarda; AGENTS §5 "Nada é salvo").
- **Item do `PENDENCIAS.md` em "M4 — Compatibilidade / cadastro"** (zod no cadastro de grupo com `parsePace`/dias/horário e `slug()` com geração/validação): é do **formulário de cadastro**, que pelo `MILESTONES.md` é M6 (`POST /grupos`). O M4 não cria nem valida grupo, e `slug.js` hoje só tem `isSlug` (usado nas rotas). Fica para a spec do M6. Orquestrador: mover o item para "M6 — Escrita".
- `POST /encontrar` (decisão **P1**): não existe. As respostas vão na query string de `GET /encontrar`, como na `/grupos`. O orquestrador atualiza o AGENTS §5: sai a linha `POST /encontrar` e a linha `GET /encontrar` passa a dizer que recebe as respostas na query.

## Mudanças

### Banco
Nenhuma migration.

### Domínio — `src/domain/match.js` (novo, puro)
Porta **literal** das linhas 859–868 e 879, adaptada aos nomes de coluna do contrato `Group` (`zone`, `pace_min_s`, `pace_max_s`, `days`, `level`, `start_time`).

```js
export const MATCH_MIN_PCT = 40;
export const MATCH_LIMIT = 6;
/** q = { zona: 'qualquer'|zona, pace: segundos/km, dias: string[], nivel, periodo: ''|chave de PERIODOS } */
export function calcMatch(group, q) → { pct: number, why: string[] }
export function rankMatches(groups, q) → Array<{ group, pct, why }>
```
`calcMatch` (pontos `s`, máximo `max`; motivos em `why` **nesta ordem**):
| Critério | `max +=` | Pontos | Motivo (texto exato) |
|---|---|---|---|
| Zona | 30 | 30 se `q.zona === 'qualquer'` ou `q.zona === group.zone` | `Fica na ${ZONAS[group.zone].nome}` — **só** quando `q.zona !== 'qualquer'` |
| Pace | 35 | 35 se `pace_min_s <= q.pace <= pace_max_s` (**bordas inclusivas**); senão `d = min(|q.pace − pace_min_s|, |q.pace − pace_max_s|)`: `d <= 30` → 20; `d <= 60` → 8; senão 0 | 35: `Seu pace está na faixa do grupo`; 20: `Seu pace está a até 30 s/km da faixa`; 8: nenhum |
| Dias | 20 | 20 se `group.days` tem ≥ 1 dia em `q.dias` | `'Treina ' + fmtDiasLongo(comuns).toLowerCase()` (comuns ordenados por `DIA_ORDEM`: "Treina segunda, quarta e sexta") |
| Nível | 15 | `dn = |NIVEIS[group.level].n − NIVEIS[q.nivel].n|`: 0 → 15; 1 → 6; 2 → 0 | 15: `Mesmo nível que você`; 6: nenhum |
| Período | 10 **só se `q.periodo` não for vazio** | 10 se `periodoDe(group.start_time) === q.periodo` | `No horário que você prefere` |

- `pct = Math.round((s / max) * 100)` (com `max` 100 ou 110 não existe empate em ,5; não trocar por `toFixed`).
- `fmtDiasLongo` (006) + `toLowerCase()` dá exatamente o `listaPt(sortDias(comuns).map(d => DIAS[d].toLowerCase()))` do protótipo; reaproveitar, não criar outro `listaPt`.
- Zona/nível desconhecidos em `group` ou `q` → `RangeError` (mesma postura de `schedule.js`; a entrada chega validada).

`rankMatches(groups, q)`: `groups.map(g => ({ group: g, ...calcMatch(g, q) }))`, mantém `pct >= MATCH_MIN_PCT`, ordena por `pct` decrescente com **sort estável** (empate mantém a ordem de entrada — é o que o `Array#sort` do protótipo fazia), corta em `MATCH_LIMIT`. Não muta `groups`.

### Repo — `src/modules/groups/groups.repo.js`
- `listPublishedByCreation(): Promise<Group[]>` — mesmo `SELECT`/contrato `Group` (reusar `selectPublished`), `WHERE g.status = 'published'`, **`ORDER BY g.id`** (ordem de cadastro). Motivo (decisão **P3**): o protótipo desempatava pela ordem de `api.listGroups()` = `[...DEMO, ...grupos cadastrados]`; o seed insere na ordem do `DEMO` (teste `demo-groups.test.js` garante), então `g.id` reproduz o desempate. A ordem padrão do site (zona, nome) muda resultados (ver casos C e E abaixo). `id` continua sem sair do repo (só no `ORDER BY`).

### Serviço — `src/modules/groups/groups.service.js`
- `listGroupsForMatching()` → `groupsRepo.listPublishedByCreation()`.

### Módulo `src/modules/matching/` (novo; AGENTS §3 já prevê a pasta)
**`matching.schemas.js`** (zod; AGENTS §2 "mesmo schema valida form e gera mensagens"):
- `MATCH_FIELDS = ['zona', 'pace', 'dias', 'nivel', 'periodo']`.
- `hasMatchParams(input): boolean` — `true` se `input` (objeto de `req.query`) tem pelo menos uma das chaves de `MATCH_FIELDS` (`Object.hasOwn`). O form enviado sempre manda `pace` e `periodo`, mesmo vazios.
- `parseMatchForm(input) → { values, errors, q }`:
  - Normalização (como `parseFilters` da 005): valor array → **primeiro** elemento (exceto `dias`); não-string → ausente; nunca lança; chave checada com `Object.hasOwn`/`includes` (`__proto__`, `constructor` são inválidos).
  - `values` (para reexibir o form): `zona` ∈ `ZONA_ORDEM ∪ {'qualquer'}` senão `''`; `pace` = string com `trim()` como digitada; `dias` = valores válidos de `DIA_ORDEM`, sem repetição, na ordem de `DIA_ORDEM` (string vira `[string]`); `nivel` ∈ chaves de `NIVEIS` senão `''`; `periodo` ∈ chaves de `PERIODOS` senão `''`.
  - `errors`: objeto com as chaves `zona`, `pace`, `dias`, `nivel` **nesta ordem de inserção** (ordem do `showErrors` do protótipo), só as que falharam. Mensagens na tabela "Regras e mensagens".
  - `q` = `{ zona, pace: parsePace(values.pace), dias, nivel, periodo }` quando `errors` vazio; senão `null`.

**`matching.service.js`**: `findMatches(q)` → `rankMatches(await listGroupsForMatching(), q)`.

**`matching.routes.js`** (montar no `app.js` depois de `groupsRouter`):
| Método | Caminho | Auth | Resultado |
|---|---|---|---|
| GET | `/encontrar` sem nenhuma chave de `MATCH_FIELDS` | — | 200, form vazio, sem resultados, **sem consultar o banco** |
| GET | `/encontrar?…` com erro de validação | — | **422**, form reexibido com `values`, mensagens, alerta e `autofocus`; sem resultados; sem consultar o banco |
| GET | `/encontrar?…` válido | — | 200, form reexibido com `values` + bloco de resultados (`findMatches(q)`) |
`renderPage('encontrar', { title: 'Encontrar meu grupo · Pace Paulista', values, errors, result })`, com `result = { q, matches } | null`.

### `src/app.js`
- `DIAS_CURTO` em `app.locals` (já exportado por `constants.js`).
- `app.use(matchingRouter)`.

### View — `src/views/pages/encontrar.ejs` (nova)
HTML e classes de `PageEncontrar`/`submitMatch`, com estas trocas:
| protótipo | aqui |
|---|---|
| `PageHead('Encontrar meu grupo','Qual é o seu ritmo?', '… Nada é salvo nem enviado.')` | `page-head` com kicker e título literais; texto (decisão **P2**): "Responda quatro perguntas e veja os grupos mais compatíveis com você. Nada é salvo." |
| `<form class="form" id="matchForm" novalidate>` | `<form class="form" id="matchForm" method="get" action="/encontrar#matchResults" novalidate>` |
| `<div id="matchAlert"></div>` preenchido por `showErrors` | `<div id="matchAlert">` com `partials/form-errors` quando há erro (vazio senão) |
| radios `zona` (`label.choice.z` com `zstyle` + "Qualquer zona"), `#m-pace`, `#m-periodo`, checkboxes `dias` (`DIAS_CURTO`), radios `nivel` | mesmos `id`, `name`, `value`, classes, `placeholder="6:00"`, `inputmode="numeric"` (literal, decisão **P5**), `aria-describedby="e-pace h-pace"`, hint "Formato minutos:segundos, entre 3:00 e 12:00."; `checked`/`value` a partir de `values`; `<select>` via `partials/filter-options` (`entries: Object.entries(PERIODOS)`, `todos: 'Qualquer horário'`) |
| `<span class="err" id="e-…"></span>` preenchido por JS | mesmo span, com `<%- ic('alert','ico-sm') %><%= mensagem %>` quando há erro; **sem nenhum espaço dentro quando vazio** (`.err:empty{display:none}`) |
| `aria-invalid` setado por JS (só `#m-pace`) | `aria-invalid="true"` em `#m-pace` quando há erro de pace |
| foco no 1º campo com erro (JS) | `autofocus` no 1º controle do 1º campo com erro, na ordem zona → pace → dias → nivel (zona: 1º radio "Zona Norte"; pace: `#m-pace`; dias: checkbox "Seg"; nivel: radio "Iniciante") |
| botão `${ic('search')} Mostrar grupos compatíveis` | igual (`btn btn-primary btn-lg`, `type="submit"`) |
| `aside.side-note` "Como calculamos" | literal (3 itens + parágrafo "Não sabe seu pace? …" com `style="color:var(--muted)"`) |
| `<div id="matchResults" style="margin-top:32px"></div>` preenchido por JS | **só quando `result` existe**: `<div id="matchResults" style="margin-top:32px">` com o `sec-head` + `grid-cards` de `partials/match-card` ou o estado vazio. Com erro ou sem envio, nada é renderizado (assim a âncora `#matchResults` não rola a página para longe das mensagens de erro) |
| `href="#grupo-<id>"` / `#mapa-<id>` / `#cadastrar` | `/grupos/<slug>` / `/mapa/<slug>` / `/grupos/novo` (slug com `encodeURIComponent`) |

`sec-head` do resultado (literal da linha 881): `<div class="sec-head"><div><span class="kicker">Resultado</span><h2 class="display">{título}</h2><p>Pace {fmtPace(q.pace)} min/km · {zona} · {nível}</p></div></div>`.

### Partials
- `src/views/partials/match-card.ejs` (novo) — literal da linha 882–884: `article.card` com `zstyle(zone)`; `div.match` > `span.match-score style="--p:<pct>"` > `<span><pct>%</span>`; `div style="min-width:0"` com `zone-chip`, `<h3 style="margin-top:8px"><a href="/grupos/<slug>">nome</a></h3>`, `ul.why` com um `<li><%- ic('check','ico-sm') %><%= motivo %></li>` por motivo (`ul` vazio se não houver motivo); `dl.facts` com Local (`pin`), Quando (`cal`, `fmtDiasCurto · fmtHora`), Pace (`gauge`, `dd.mono`, `fmtFaixa`), Nível (`bars`, `NIVEIS[level].nome`); `card-actions` com "Entrar no grupo" (link, ver Fora do escopo), "Ver detalhes" → `/grupos/<slug>` e "Ver rota" → `/mapa/<slug>` (mesmas classes do `group-card`). **Sem** `demo-tag` (o protótipo não mostra).
- `src/views/partials/form-errors.ejs` (novo; AGENTS §3 já prevê; reaproveitado no M5/M6) — recebe `count`: `<div class="form-alert bad" role="alert"><%- ic('alert') %><span>{texto}</span></div>`.

### CSS — `public/css/app.css` (só acréscimos, no bloco "Acréscimos do site")
```css
/* Encontrar (spec 008): a âncora #matchResults para abaixo do cabeçalho fixo, como .filters. */
#matchResults{scroll-margin-top:84px}
/* Nome do grupo (até 50) sem espaço não pode abrir scroll horizontal em 360 px. */
.match h3{overflow-wrap:anywhere}
```

### JS do cliente
Nenhum. (O `public/js/app.js` não intercepta o form.)

## Regras e mensagens
| Campo | Regra | Mensagem exata (pt-BR) |
|---|---|---|
| zona | obrigatório; `ZONA_ORDEM` ou `qualquer` | `Escolha uma zona ou "Qualquer zona".` (no HTML as aspas saem como `&#34;`) |
| pace | vazio após `trim()` | `Informe seu pace aproximado.` |
| pace | `parsePace` devolve `null` (fora de `^\d{1,2}:[0-5]\d$` ou de 3:00–12:00) | `Use o formato 6:00, entre 3:00 e 12:00 min/km.` |
| dias | ≥ 1 valor válido de `DIA_ORDEM` (inválidos são descartados sem erro) | `Selecione pelo menos um dia.` |
| nivel | obrigatório; chave de `NIVEIS` | `Escolha seu nível.` |
| periodo | opcional; inválido vira `''` (Qualquer horário), sem erro | — |
| alerta | N = nº de campos com erro | `Corrija 1 campo para continuar.` / `Corrija N campos para continuar.` |
| título do resultado | N resultados | `N grupos combinam com você` / `1 grupo combina com você` / `Nenhum grupo compatível` |
| resumo | `fmtPace(q.pace)`; zona; `NIVEIS[nivel].nome.toLowerCase()` | `Pace 5:00 min/km · Zona Sul · avançado`, `Pace 6:00 min/km · qualquer zona · iniciante` |
| vazio | 0 resultados ≥ 40% | `ic('run')`, `<h3>Ainda não temos esse grupo</h3>`, `<p>Tente marcar mais dias ou escolher "Qualquer zona". Se você organiza treinos, pode ser o primeiro grupo desse perfil.</p>`, botão `btn btn-primary` "Cadastrar grupo" → `/grupos/novo` |
| side-note | literal | "Como calculamos" · "Pace dentro da faixa do grupo pesa mais." · "Zona, dias em comum e nível ajustam a nota." · "Mostramos até 6 grupos com compatibilidade a partir de 40%." · "Não sabe seu pace? Divida o tempo de uma corrida pela distância. 30 min em 5 km dá 6:00 min/km." |
| legendas/rótulos | literal | "Em qual zona você prefere correr? \*", "Seu pace aproximado (min/km) \*", "Horário preferido", "Em quais dias você pode correr? \*", "Seu nível de experiência \*" |

### Bateria de equivalência com o protótipo (11 grupos demo)
Calculada rodando o `calcMatch` + pipeline da linha 879 do protótipo, copiados literalmente, sobre `db/seeds/demo-groups.js` na ordem do `DEMO`. Formato: posição. slug pct% — motivos.

**Caso A** — `zona=sul&pace=5:00&dias=seg&dias=qua&nivel=avancado` (sem período, máx. 100) → "5 grupos combinam com você", resumo "Pace 5:00 min/km · Zona Sul · avançado":
1. pace-da-oca 100% — Fica na Zona Sul · Seu pace está na faixa do grupo · Treina segunda e quarta · Mesmo nível que você
2. minhocao-noturno 61% — Seu pace está na faixa do grupo · Treina quarta
3. represa-run-club 56% — Fica na Zona Sul · Seu pace está a até 30 s/km da faixa
4. pelotao-paulista 41% — Seu pace está na faixa do grupo
5. villa-lobos-runners 41% — Seu pace está na faixa do grupo

Fora: raia-usp 35, primeiro-km-ibira 30, correria-do-carmo 26, tiete-em-movimento 8, juventude-em-pace 8, cantareira-trail 6. (5:00 está "na faixa" de Pace da Oca 4:15–5:00 **e** de Minhocão 5:00–6:00: bordas inclusivas, diferente do filtro da `/grupos`.)

**Caso B** — `zona=qualquer&pace=6:00&dias=ter&dias=qui&nivel=iniciante&periodo=noite` (máx. 110) → "6 grupos combinam com você", resumo "Pace 6:00 min/km · qualquer zona · iniciante", nenhum "Fica na …":
1. tiete-em-movimento 100% — Seu pace está na faixa do grupo · Treina terça e quinta · Mesmo nível que você · No horário que você prefere
2. juventude-em-pace 100% — (mesmos 4 motivos)
3. villa-lobos-runners 83% — Seu pace está na faixa do grupo · Treina terça e quinta
4. minhocao-noturno 74% — Seu pace está na faixa do grupo · No horário que você prefere
5. correria-do-carmo 65% — Seu pace está na faixa do grupo
6. represa-run-club 65% — Seu pace está na faixa do grupo

Cortados pelo limite de 6 (≥ 40%): pelotao-paulista 51, cantareira-trail 51, primeiro-km-ibira 48. Abaixo de 40: pace-da-oca 35, raia-usp 27.

**Caso C** — `zona=leste&pace=6:00&dias=sab&dias=dom&nivel=intermediario` → 6 grupos:
correria-do-carmo 100 (Fica na Zona Leste · Seu pace está na faixa do grupo · Treina sábado · Mesmo nível que você), tiete-em-movimento 71, represa-run-club 70, pelotao-paulista 55, cantareira-trail 55, **minhocao-noturno 50**. villa-lobos-runners também tem 50 e fica **fora** (empate no corte; no protótipo Minhocão vem antes no `DEMO`). Com a ordem zona+nome entraria Villa-Lobos no lugar; por isso a decisão P3.

**Caso D** — `zona=norte&pace=3:00&dias=seg&nivel=avancado` → "Nenhum grupo compatível", resumo "Pace 3:00 min/km · Zona Norte · avançado", estado vazio "Ainda não temos esse grupo". (Maior nota: cantareira-trail 36.)

**Caso H** — `zona=oeste&pace=4:30&dias=sab&nivel=avancado&periodo=cedo` → 4 grupos (40% exato entra):
raia-usp 91 (Fica na Zona Oeste · Seu pace está na faixa do grupo · Treina sábado · Mesmo nível que você), villa-lobos-runners 60 (Fica na Zona Oeste · Seu pace está a até 30 s/km da faixa · No horário que você prefere), pace-da-oca 55 (Seu pace está na faixa do grupo · Mesmo nível que você · No horário que você prefere), correria-do-carmo 40 (Treina sábado · No horário que você prefere).

**Caso J** — `zona=norte&pace=3:00&dias=ter&nivel=iniciante` → "1 grupo combina com você": juventude-em-pace 65 (Fica na Zona Norte · Treina terça · Mesmo nível que você).

Outros (slug:pct, na ordem):
- E `zona=qualquer&pace=5:30&dias=dom&nivel=intermediario&periodo=manha` → pelotao-paulista 100, represa-run-club 100, cantareira-trail 75, correria-do-carmo 73, minhocao-noturno 73, villa-lobos-runners 73.
- F `zona=centro&pace=5:15&dias=qua&dias=dom&nivel=intermediario` → pelotao-paulista 100 (Fica na Centro · … · Treina domingo · …), minhocao-noturno 100 (Fica na Centro · … · Treina quarta · …), represa-run-club 55, villa-lobos-runners 50, pace-da-oca 46.
- G `zona=qualquer&pace=6:00&dias=seg…dom (7)&nivel=intermediario` → correria-do-carmo 100, minhocao-noturno 100, represa-run-club 100, villa-lobos-runners 100, tiete-em-movimento 91, juventude-em-pace 91 (cortados: pelotao-paulista 85, cantareira-trail 85).
- I `zona=leste&pace=6:30&dias=ter&nivel=iniciante` → tiete-em-movimento 100, correria-do-carmo 71, juventude-em-pace 70, villa-lobos-runners 46, represa-run-club 41, cantareira-trail 41.

### Divergências AGENTS §6 × protótipo (o protótipo manda)
1. AGENTS cita só os motivos de zona e dias; o protótipo tem 5 (tabela acima). Pace a ≤ 60 s (8 pts) e nível ±1 (6 pts) somam pontos **sem** motivo.
2. AGENTS não diz se "dentro da faixa" inclui as bordas; no protótipo inclui (`>=`/`<=`), ao contrário do filtro de pace da `/grupos` (que exige cruzar).
3. AGENTS não define desempate; no protótipo é a ordem da lista (`DEMO` + cadastrados) → decisão P3 (ordem de cadastro).
4. AGENTS §5 prevê `POST /encontrar`; pela decisão P1 fica só `GET /encontrar` com as respostas na query. O orquestrador atualiza o §5.
5. AGENTS §3 lista só `matching.routes.js`; esta spec acrescenta `matching.schemas.js` e `matching.service.js` (padrão do CONVENTIONS) e o partial `match-card`. Orquestrador: atualizar o §3.

## Critérios de aceite
- [ ] CA1 — **(pronto do M4)** Para toda combinação da grade do teste de equivalência, `rankMatches(DEMO_GROUPS, q)` devolve os mesmos slugs, na mesma ordem, com os mesmos `pct` e `why` que a cópia literal do protótipo. Os casos A, B, C, D, H e J aparecem iguais na página (slugs/nomes na ordem, `N%` em cada `.match-score`, motivos em cada `ul.why`, título e resumo do `sec-head`).
- [ ] CA2 — `GET /encontrar` → 200, título "Encontrar meu grupo · Pace Paulista", form com as 6 opções de zona, campo de pace, select de horário (5 opções), 7 dias, 3 níveis, botão "Mostrar grupos compatíveis" e o side-note literal; sem `#matchResults`, sem alerta; responde mesmo com o banco fora do ar.
- [ ] CA3 — O form é `method="get"` com `action="/encontrar#matchResults"`: ao enviar, a URL fica `/encontrar?zona=…&pace=…&periodo=…&dias=…&nivel=…#matchResults`, e sem JS a página abre já nos resultados. Com dados válidos, a página volta com o form preenchido (`checked` na zona, nos dias e no nível; `value` do pace como digitado; `selected` no horário) e o bloco `#matchResults`. Recarregar a página ou abrir a mesma URL em outra aba mostra o mesmo resultado.
- [ ] CA3b — Não existe `POST /encontrar`: `POST /encontrar` → 404 (página padrão).
- [ ] CA4 — Erros: `GET /encontrar?pace=&periodo=` → 422, "Corrija 4 campos para continuar." (`role="alert"`) e as 4 mensagens exatas nos spans `e-zona`, `e-pace`, `e-dias`, `e-nivel`; `zona=sul&pace=2:59&dias=seg&nivel=avancado` → 422, "Corrija 1 campo para continuar.", mensagem de formato no `e-pace`, `aria-invalid="true"` e `autofocus` em `#m-pace`, demais valores mantidos, sem `#matchResults`; spans sem erro ficam vazios (sem espaço).
- [ ] CA5 — Entradas fora do form nunca dão 500: `zona=marte` → erro de zona; `nivel=__proto__` → erro de nível; `dias=xyz` → erro de dias; `dias=seg&dias=xyz` → só seg; `periodo=constructor` → tratado como "Qualquer horário" (máx. 100); `zona=sul&zona=norte` → sul; `pace[a]=1` → pace ausente. `/encontrar?utm_source=x` → form vazio (200).
- [ ] CA6 — 0 resultados → título "Nenhum grupo compatível", resumo e o estado vazio literal com "Cadastrar grupo" → `/grupos/novo`.
- [ ] CA7 — Cada card de resultado: link do nome e "Ver detalhes" → `/grupos/<slug>`, "Ver rota" → `/mapa/<slug>`, "Entrar no grupo" → `/conta/entrar?next=/grupos/<slug>%23participar`; nenhum `href="#` nem `data-act="entrar"` na página.
- [ ] CA8 — Grupo `pending` nunca aparece nos resultados; grupo publicado inserido depois do seed, com nota empatada com um demo, aparece **depois** dele (ordem de cadastro, decisão P3).
- [ ] CA9 — Escape: `pace=<script>` aparece escapado no `value`; nome e local de grupo com `<script>` saem escapados no card.
- [ ] CA10 — **Funciona sem JS** (enviar, ver erros, ver resultados, navegar pelos links); **responsivo em 360 px**: form em uma coluna, `.row2` empilhado, cards em uma coluna, sem scroll horizontal (inclusive com nome de 50 caracteres sem espaço).
- [ ] CA11 — **Nada de SQL fora de `*.repo.js`**; `match.js` sem I/O; nenhuma dependência nova; `npm test` e `npm run lint` passam.

## Testes esperados
- unit `tests/domain/match.test.js` (novo), com grupo sintético:
  - zona igual (+30, motivo "Fica na Zona Sul"), diferente (0), `qualquer` (+30, sem motivo); "Fica na Centro" literal.
  - pace: igual a `pace_min_s` e a `pace_max_s` → 35 e motivo; `d = 30` → 20 e motivo "a até 30 s/km"; `d = 31` → 8 sem motivo; `d = 60` → 8; `d = 61` → 0; abaixo e acima da faixa.
  - dias: `q.dias = ['sex','seg','qua']` com grupo seg/qua/sex → "Treina segunda, quarta e sexta"; um dia → "Treina sábado"; nenhum em comum → 0 sem motivo.
  - nível: igual 15 + motivo; diferença 1 → 6 sem motivo; diferença 2 → 0.
  - período: `''` → máximo 100; informado e igual → +10 e motivo; diferente → máximo 110 (ex.: 100/110 → 91; 44/110 → 40; 60/110 → 55).
  - ordem dos motivos: zona, pace, dias, nível, período.
  - `rankMatches`: 40 entra e 39 sai; empate mantém a ordem de entrada; no máximo 6; `[]` → `[]`; não muta a entrada.
- unit `tests/domain/match-prototipo.test.js` (novo, o **teste do critério do M4**): contém a cópia **literal** de `calcMatch`, `listaPt`, `sortDias`, `periodoDe` e do pipeline da linha 879 do protótipo (comentário "cópia literal; não editar"), alimentada por `DEMO_GROUPS` convertido para o formato do protótipo (`zona`, `paceMin`, `paceMax`, `dias`, `nivel`, `horario`, `id` = slug). Compara com `rankMatches(DEMO_GROUPS, q)` em grade determinística: zona ∈ 5 zonas + `qualquer`; os 127 subconjuntos não vazios de dias; 3 níveis; 5 períodos (`''` + 4); paces de 3:00 a 12:00 de 15 em 15 s **mais** as bordas `min/max ± {0, 1, 30, 31, 60, 61}` de cada grupo demo (limitadas a 180–720). Se a grade completa passar de ~5 s, reduzir os dias a todos os subconjuntos de tamanho 1, 2 e 7 (mantendo todas as bordas de pace). Inclui também os casos A–J como asserções explícitas.
- unit `tests/domain/matching-schemas.test.js` (novo): `hasMatchParams` (`{}` → false; `{pace:''}` → true; `{utm_source:'x'}` → false); `parseMatchForm` — válido → `q` com pace em segundos e `errors` `{}`; vazio → 4 erros na ordem zona, pace, dias, nivel com as mensagens exatas; pace vazio × inválido (`'6'`, `'6:60'`, `'2:59'`, `'12:01'`) × válido (`'3:00'`, `'12:00'`, `' 06:00 '` → 360); arrays e chaves de protótipo como em CA5; `dias` repetidos/fora de ordem → únicos em `DIA_ORDEM`.
- db `tests/db/groups-repo.test.js`: `listPublishedByCreation` com `seedDemo` → slugs na ordem de `DEMO_GROUPS`; grupo `pending` fora; grupo inserido depois vem por último.
- http `tests/http/encontrar.test.js` (novo, com `seedDemo`; todas as consultas por `GET` com query string, ex.: `.get('/encontrar?zona=sul&pace=5%3A00&dias=seg&dias=qua&nivel=avancado')`): CA2 (incluindo banco indisponível no `banco-indisponivel.test.js`), CA3 (`method="get"`, `action="/encontrar#matchResults"`, form preenchido), CA3b (`POST /encontrar` → 404), casos A, B, C, D, H e J pela URL (ordem dos `<h3>`, `N%` e motivos), CA4, CA5, CA6, CA7, CA8, CA9; subtítulo termina em "Nada é salvo." e não contém "nem enviado"; `#m-pace` tem `inputmode="numeric"`.

## Riscos / decisões
### Decisões (respondidas pelo usuário; todas no default proposto)
- **P1 — GET ou POST → só GET.** As respostas vão na query string (`/encontrar?zona=…&pace=…&dias=…&nivel=…&periodo=…#matchResults`), como na `/grupos`. A operação só lê e não grava nada; dá para recarregar, voltar e compartilhar o resultado. Não existe `POST /encontrar`. As respostas (pace, nível, dias) ficam na URL e no histórico, o que foi aceito por serem pouco sensíveis. O orquestrador atualiza o AGENTS §5: sai `POST /encontrar` e `GET /encontrar` passa a receber as respostas na query.
- **P2 — Subtítulo → "Responda quatro perguntas e veja os grupos mais compatíveis com você. Nada é salvo."** Sai "nem enviado", porque agora as respostas vão ao servidor. "quatro perguntas" fica literal (o horário é opcional).
- **P3 — Desempate → ordem de cadastro (`ORDER BY g.id`).** Reproduz o protótipo com os 11 demos (o seed insere na ordem do `DEMO`) e põe grupos novos depois. A ordem padrão do site (zona, nome) mudaria a ordem nos casos A, B, E, F, G e I e **quais grupos entram** no caso C.
- **P4 — "Fica na Centro" → literal.** É o mesmo problema de "Selo da Centro"/"Outros grupos da Centro" (P11 no `PENDENCIAS.md`); corrige-se junto com ele. O orquestrador acrescenta "Fica na Centro" ao item do P11.
- **P5 — `inputmode="numeric"` no pace → literal.** No iPhone esse teclado provavelmente não tem a tecla `:` (não confirmado em aparelho). O orquestrador registra no `PENDENCIAS.md` um item para testar num aparelho real no M7/M8; o cadastro do M6 (`paceMin`/`paceMax`) tem o mesmo ponto.

### Riscos / decisões técnicas
- Status 422 num GET com erro de validação segue a convenção de formulário do AGENTS (`POST /grupos` → 422); o navegador mostra a página normalmente.
- A âncora no `action` do form (`/encontrar#matchResults`) é mantida pelos navegadores atuais na submissão. Se algum não mantiver, o resultado continua abaixo do form, como no desktop. O QA confere em 360 px.
- Diferenças do protótipo que esta spec aceita: (a) com erro, os resultados anteriores somem (no protótipo continuavam na tela, porque eram estado do JS); (b) entram os grupos publicados de todos os usuários, e não só os "deste navegador"; (c) o foco no erro vem de `autofocus`, não de JS.
- Toda busca válida faz uma consulta da lista completa (sem cache), aceitável para o tamanho do dataset. Isso soma à pendência M8 "`/grupos` sem rate limit nem cache".
- O resultado usa o contrato `Group`, que inclui `contact`. A view não exibe o campo; a pendência do M7 (JSON sem `contact` para deslogado) vale também se um dia houver `/api/encontrar`.
- Estimativa: cerca de 250 linhas de código e 350 de testes. A bateria de equivalência é grande, mas é ela que prova o critério do marco, então não convém dividir a spec.
- Para o orquestrador, depois desta spec: (1) no `PENDENCIAS.md` M8, "links da home levam a 404" deixa de valer para `/encontrar`; (2) o item "M4 — Compatibilidade / cadastro" vai para o M6; (3) o `/sobre` não muda (o 1º item ATIVO já cita "cálculo de compatibilidade"; cadastro e entrada continuam pendentes até o M6, como aceito no P10).
