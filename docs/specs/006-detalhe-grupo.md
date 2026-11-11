# 006 — Detalhe do grupo `/grupos/:slug` com próximos encontros no fuso de SP
Marco: M3 · Status: pronta para Coder após resposta a **P4** (P5–P7 têm default; ver "Perguntas em aberto")
Depende de: 004-leitura-banco-home-zonas (usa o router de grupos criado na 005; se a 005 ainda não tiver entrado, criar `groups.routes.js` aqui)
Ordem no M3: 004 → 005 → **006** → 007

## Objetivo
Reproduzir `PageDetalhe` (prototipo.html linhas 721–764) renderizada no servidor a partir do banco, com "Próximos encontros" calculados por `proximos()` **no fuso `America/Sao_Paulo`** (AGENTS §6) e exibindo o contato do grupo quando houver (pendência M3).

## Fora do escopo
- Entrar/sair do grupo, estado "Você entrou como…", form inline `#participar`, modal (M6/M7). O botão "Entrar no grupo" é **link** para `/conta/entrar?next=/grupos/<slug>%23participar` (como nos cards; 404 até o M5, já aceito na spec 002).
- "Cadastrado por você" (depende de sessão, M5/M6).
- `/grupos/novo` (M6): quando entrar, deve ser registrado **antes** de `/grupos/:slug` (ver Riscos).
- Mapa (007).

## Mudanças

### Banco
Nenhuma migration.

### Domínio — `src/domain/schedule.js`
- `fmtDiasLongo(days): string` — igual às linhas 543 e 545: `sortDias` + `DIAS[d]`, unidos por `", "` com `" e "` antes do último (`listaPt`). Ex.: `['sex','seg','qua']` → `"Segunda, Quarta e Sexta"`.
- `proximos(group, now, { n = 4, timeZone = 'America/Sao_Paulo' } = {}): Date[]` — porta da linha 551–555, mas no fuso informado:
  - para `i` de 0 a 27 (28 dias a partir de **hoje no fuso**), enquanto houver menos de `n`: a data local `hoje + i` cujo dia da semana esteja em `group.days`, às `group.start_time` (`'HH:MM'` ou `'HH:MM:SS'`) **naquele fuso**, convertida para instante (`Date`); entra se for **depois** de `now`.
  - Pura: recebe `now` (`Date`), não chama `Date.now()`. Sem dependências novas: usar `Intl.DateTimeFormat` (com `timeZone`) para obter data/dia da semana locais e o deslocamento do fuso naquela data (não fixar `-03:00`: se o horário de verão voltar, continua certo).
  - Comportamento do protótipo mantido: grupo de 1 dia por semana cujo treino de hoje já passou devolve **3** datas (a janela de 28 dias não alcança a 4ª).
- `fmtEncontro(date, timeZone = 'America/Sao_Paulo'): { dia: string, mes: string, semana: string }` — formatação `pt-BR` no fuso, igual ao protótipo (linha 737): `dia` = dia do mês sem zero à esquerda (`'5'`); `mes` = `month:'short'` sem o ponto (`'nov'`); `semana` = `weekday:'long'` com a 1ª letra maiúscula (`'Sábado'`, `'Segunda-feira'`).

### Repo — `src/modules/groups/groups.repo.js`
- `findPublishedBySlug(slug): Promise<Group | null>` — mesmo `SELECT`/formato `Group` da 004 (reaproveitar a lista de colunas/joins; não duplicar o SQL), `WHERE g.slug = $1 AND g.status = 'published'`.

### Serviço — `groups.service.js`
- `getGroupDetail(slug, now)` → `null` se o grupo não existir/publicado; senão `{ group, sessions }`, com `sessions = proximos(group, now, { timeZone: env.TZ_APP }).map(d => fmtEncontro(d, env.TZ_APP))`.

### Rotas — `src/modules/groups/groups.routes.js`
| Método | Caminho | Auth | Resultado |
|---|---|---|---|
| GET | `/grupos/:slug` | — | `slug` fora de `^[a-z0-9-]{1,60}$` → 404 **sem consultar o banco** (pendência M3: slugs `[a-z0-9-]`). Grupo inexistente ou não `published` → 404 com a mensagem da tabela. Senão 200, `renderPage('grupo-detalhe', { title: '<name> · Pace Paulista', group, sessions })` com `now = new Date()` |

- `src/middlewares/notFound.js`: `renderNotFound(res, message)` passa `message` opcional para a view `404` (que já aceita `message`).

### View — `src/views/pages/grupo-detalhe.ejs` (nova)
HTML e classes de `PageDetalhe` (linhas 726–763), com `<%= %>` em todo dado do banco e estas trocas:
| protótipo | aqui |
|---|---|
| `<a class="back" href="#grupos">` | `href="/grupos"` (texto "Voltar para os grupos") |
| etiqueta do cabeçalho (`style="color:inherit;border-color:currentColor"`) | demo → "Grupo fictício · demonstração"; não demo com `owner_name` → "Cadastrado por {owner_name}"; não demo sem dono → sem etiqueta (**P5**, mesma regra do card na 004) |
| `fmtDiasLongo(g.dias) · fmtHora(g.horario)` | `fmtDiasLongo(group.days) · fmtHora(group.start_time)` |
| `g.perfil` | `group.profile_tags` (cada um em `<span class="tag">`) |
| `proximos(g)` + `toLocaleDateString` | `sessions`: `<span class="date-box"><b>{dia}</b><small>{mes}</small></span><span><b>{semana}, {fmtHora}</b><br><small style="color:var(--muted)">{location} · {distance ou 'distância combinada no grupo'}</small></span><span class="mono" …>{fmtFaixa}</span>` |
| `g.ponto\|\|'Combinado no grupo'` | `group.meeting_point` (o banco já tem default `'Combinado no grupo'`) |
| `g.distancia\|\|'—'` | `group.distance ?? '—'` |
| `participantes(g)` | `group.participants` |
| `<button … data-act="entrar">` | `<a class="btn btn-primary btn-lg" href="/conta/entrar?next=/grupos/<%= encodeURIComponent(slug) %>%23participar"><%- ic('plus') %> Entrar no grupo</a>` |
| `href="#mapa-<id>"` | `href="/mapa/<%= encodeURIComponent(slug) %>"` ("Ver rota no mapa") |
| `href="#grupos-<zona>"` | `href="/grupos?zona=<zona>"` ("Outros grupos da {ZONAS[z].nome}", literal; ver P11 da 004) |
| `LevelMeter`, `ZoneChip`, `seal(g.zona,56)` | partials `level-meter`, `zone-chip` e helper `seal(zone, 56)` |
- **Contato (P4, default)**: na "Ficha do treino" (`dl.spec`), nova última linha **só quando `group.contact` não é `null`/vazio**: `<div><dt><%- ic('ext','ico-sm') %>Contato</dt><dd><%= group.contact %></dd></div>`. Texto puro, **sem** link (o contato é texto livre do organizador; transformar em link exige validar URL — fica para quando houver regra). Grupos demo (`contact` NULL) não mostram a linha.
- Nota abaixo dos encontros: literal "Datas calculadas a partir da agenda fixa do grupo. Confirmações por encontro dependem do banco de dados." (**P7**).
- "Antes do primeiro treino": as 4 regras literais.

## Regras e mensagens
| Elemento | Regra | Texto/valor exato |
|---|---|---|
| 404 do grupo | slug inválido, inexistente ou não publicado | título "Página não encontrada"; texto (**P6**, default) "Esse grupo não foi encontrado. Ele pode ter sido removido." |
| Dias (cabeçalho e ficha) | `fmtDiasLongo` | pace-da-oca: "Segunda, Quarta e Sexta"; tiete: "Terça e Quinta"; correria: "Sábado" |
| Cabeçalho | `dias · hora` | pace-da-oca: "Segunda, Quarta e Sexta · 6h" |
| Pace | `fmtFaixa` | pace-da-oca: "4:15–5:00 min/km" |
| Distância vazia | `distance` NULL | ficha "—"; encontros "distância combinada no grupo" |
| Etiqueta | P5 | demo: "Grupo fictício · demonstração" |
| Contato | P4 | linha "Contato" só se houver |
| Encontro | `fmtEncontro` + `fmtHora` | ex.: `<b>14</b><small>nov</small>` e "Sábado, 6h30" |

## Critérios de aceite
- [ ] CA1 — `GET /grupos/pace-da-oca` → 200, título "Pace da Oca · Pace Paulista", com nome, chip "Zona Sul", etiqueta "Grupo fictício · demonstração", "Segunda, Quarta e Sexta · 6h", "4:15–5:00 min/km", descrição, tags de perfil, ponto de encontro e distância "10 a 14 km" literais do `DEMO`, nível "Avançado", participantes 56 (57 com uma membership) e o painel da Zona Sul com selo e "Outros grupos da Zona Sul" → `/grupos?zona=sul`.
- [ ] CA2 — Com o relógio fixado em **2026-11-14T09:00:00Z** (sábado 6h00 em SP), `/grupos/correria-do-carmo` (sáb 6h30) lista 4 encontros: 14, 21 e 28 de nov e 5 de dez, todos "Sábado, 6h30"; com **2026-11-14T09:31:00Z** lista 3 (21/nov, 28/nov, 5/dez).
- [ ] CA3 — `/grupos/nao-existe` e um grupo com `status='pending'` → 404 com "Esse grupo não foi encontrado. Ele pode ter sido removido."; `/grupos/ABC`, `/grupos/a%20b`, `/grupos/<61 caracteres>` → 404 sem consulta ao banco.
- [ ] CA4 — Grupo com `contact = '@grupo_teste'` mostra a linha "Contato" com esse texto (escapado); grupo demo (`contact` NULL) não tem a linha "Contato".
- [ ] CA5 — Grupo não demo com dono "Ana" mostra "Cadastrado por Ana" no cabeçalho; sem dono, nenhuma etiqueta.
- [ ] CA6 — Links: "Voltar para os grupos" → `/grupos`; "Entrar no grupo" → `/conta/entrar?next=/grupos/<slug>%23participar`; "Ver rota no mapa" → `/mapa/<slug>`; nenhum `href="#`, nenhum `data-act="entrar"`/`"sair"`.
- [ ] CA7 — Nome, local, descrição, tags, ponto, distância, contato e `owner_name` com `<script>` aparecem escapados.
- [ ] CA8 — Funciona sem JS; em 360 px o `.detail-grid` vira uma coluna, sem scroll horizontal (inclusive com nome longo de 50 caracteres e contato de 80); `aria-current="page"` em "Encontrar grupos" no header.
- [ ] CA9 — `proximos` não depende do fuso do processo: os testes unitários passam com `TZ=UTC` e com `TZ=Asia/Tokyo`.
- [ ] CA10 — SQL só no repo, parametrizado; `npm test` e `npm run lint` passam.

## Testes esperados
- unit (`tests/domain/schedule.test.js`):
  - `fmtDiasLongo`: `['sex','seg','qua']` → "Segunda, Quarta e Sexta"; `['qui','ter']` → "Terça e Quinta"; `['sab']` → "Sábado"; não muta a entrada.
  - `proximos` (fuso padrão SP):
    - `{days:['sab'], start_time:'06:30'}`, now `2026-11-14T09:00:00Z` → `['2026-11-14T09:30:00.000Z','2026-11-21T09:30:00.000Z','2026-11-28T09:30:00.000Z','2026-12-05T09:30:00.000Z']`.
    - mesmo grupo, now `2026-11-14T09:31:00Z` → 3 datas (21/11, 28/11, 05/12).
    - virada do dia UTC: `{days:['sab'], start_time:'23:00'}`, now `2026-11-15T01:00:00Z` (sábado 22h em SP) → 1ª data `2026-11-15T02:00:00.000Z`.
    - vários dias: `{days:['seg','qua','sex'], start_time:'06:00'}`, now `2026-11-12T12:00:00Z` (quinta) → 13/11, 16/11, 18/11, 20/11 às `09:00:00.000Z`.
    - `n: 1` devolve só a próxima; `start_time` `'06:30:00'` funciona igual a `'06:30'`.
    - rodar o arquivo também com `process.env.TZ` diferente não muda resultado (CA9; ex.: script de teste `TZ=Asia/Tokyo npx vitest run tests/domain/schedule.test.js` documentado no PR, ou teste que compara com o mesmo cálculo em `TZ` alterado via `vi.stubEnv` + import dinâmico).
  - `fmtEncontro(new Date('2026-11-15T02:00:00Z'))` → `{ dia:'14', mes:'nov', semana:'Sábado' }`; `fmtEncontro(new Date('2026-11-16T09:00:00Z'))` → `semana: 'Segunda-feira'`.
- db (`tests/db/groups-repo.test.js`): `findPublishedBySlug('pace-da-oca')` com as mesmas chaves do `Group`; `pending` → `null`; inexistente → `null`.
- http (`tests/http/grupo-detalhe.test.js`, novo, com `seedDemo`): CA1; CA2 com `vi.useFakeTimers({ now: …, toFake: ['Date'] })` (só `Date`, para não travar o `pg`); CA3 (incluindo a garantia de "sem consulta" via `vi.spyOn` no repo); CA4 e CA5 com grupo inserido no teste; CA6; CA7.

## Riscos / perguntas em aberto
### Perguntas em aberto
- **P4** (PENDENCIAS, M3) — Exibição do `contact` na página do grupo. O protótipo **não** mostra o contato em lugar nenhum. **Default desta spec**: linha "Contato" (ícone `ext`) no fim da "Ficha do treino", texto puro sem link, omitida quando `contact` é NULL (todos os demo). Confirmar local, rótulo, se vira link (Instagram/site/e-mail) e se deve aparecer para visitante deslogado.
- **P5** — mesma da 004 (etiqueta de grupo não demo sem dono).
- **P6** — Mensagem do 404 de grupo: o protótipo diz "…Ele pode ter sido removido deste navegador." (não faz mais sentido com banco). **Default**: "Esse grupo não foi encontrado. Ele pode ter sido removido."
- **P7** — Nota "Confirmações por encontro dependem do banco de dados." agora que o banco existe (a confirmação por encontro continua fora da v1). **Default**: manter literal.

### Riscos / decisões técnicas
- `/grupos/novo` (M6) precisa ser registrado antes de `/grupos/:slug`; e o gerador de slug do M6 deve impedir slugs reservados (`novo`, `zona`), senão um grupo chamado "Novo" ficaria inacessível. Registrar no `PENDENCIAS.md` (M6).
- O cálculo de fuso com `Intl` depende do ICU completo do Node (padrão no Node 22). Imagens "small-icu" dariam nomes de mês/dia em inglês; o teste de `fmtEncontro` pega isso.
- A página faz 1 consulta por request (`findPublishedBySlug`); `proximos` é calculado a cada request (sem cache), o que mantém as datas corretas sem job.
