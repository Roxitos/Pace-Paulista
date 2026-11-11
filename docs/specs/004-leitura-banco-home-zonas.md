# 004 — Leitura do banco: repo de grupos, home e /zonas
Marco: M3 · Status: pronta para Coder (P1 e P5 têm default; ver "Perguntas em aberto")
Depende de: 003-banco-migrations-seed
Ordem no M3: **004** → 005 → 006 → 007

## Objetivo
Criar o `groups.repo` (primeiro SQL do `src/`) e trocar a fonte da home de `DEMO_GROUPS` para o banco. Na mesma spec entra `/zonas` (`PageZonas`), que usa a mesma consulta. É a base das specs 005–007: o formato de grupo definido aqui é o que todas as views passam a receber.

## Fora do escopo
- Filtros de busca e `/grupos` (005), detalhe `/grupos/:slug` (006), `/mapa` e `/sobre` (007).
- Sessão/usuário logado: "Cadastrado por você", "Você participa" e o badge de "Meus grupos" ficam para M5/M6.
- Escrita no banco (nenhum INSERT/UPDATE/DELETE em `src/`). Por isso o tratamento de `23505`/`23514` e o uso de `tx()` (item do M3 em `PENDENCIAS.md`) **não se aplicam aqui**: ficam para o M6, quando houver escrita.
- `GET /api/grupos` (M7).

## Mudanças

### Banco
Nenhuma migration.

### Repo — `src/modules/groups/groups.repo.js` (novo)
Único arquivo do `src/` com SQL de grupos. Usa `pool` de `src/db/pool.js`. SQL parametrizado (`$1`), colunas listadas explicitamente (nada de `SELECT *`).

`listPublished(): Promise<Group[]>` — todos os grupos com `status = 'published'`.

Formato `Group` (contrato para as specs 004–007; nenhum outro campo sai do repo):
| campo | tipo JS | origem |
|---|---|---|
| `slug` | string | `g.slug` |
| `name` | string | `g.name` |
| `zone` | string | `g.zone` |
| `location` | string | `g.location` |
| `meeting_point` | string | `g.meeting_point` |
| `days` | string[] | `g.days` |
| `start_time` | string `'HH:MM'` | `to_char(g.start_time, 'HH24:MI')` |
| `pace_min_s`, `pace_max_s` | number | `g.pace_min_s`, `g.pace_max_s` |
| `distance` | string \| null | `g.distance` |
| `level` | string | `g.level` |
| `participants` | number | `(g.base_participants + COUNT(m.user_id))::int` (subquery ou `LEFT JOIN memberships … GROUP BY`) |
| `description` | string | `g.description` |
| `profile_tags` | string[] | `g.profile_tags` |
| `contact` | string \| null | `g.contact` (só exibido na 006) |
| `is_demo` | boolean | `g.is_demo` |
| `owner_name` | string \| null | `u.display_name` via `LEFT JOIN users u ON u.id = g.owner_id` |
| `map_pin` | number[] \| null | `g.map_pin` |

Decisões de tipo (pendência 003 "pg devolve BIGINT como string e TIME como 'HH:MM:SS'"):
- `id` **não** sai do repo nesta spec (as views usam `slug`). O M6, que precisa de `id` para memberships, decide o formato.
- Contagens sempre com `::int` na query (não usar `types.setTypeParser` global).
- `start_time` formatado na query com `to_char(…, 'HH24:MI')`, igual ao formato de `DEMO_GROUPS` (`fmtHora` aceita os dois, mas `'HH:MM'` simplifica testes e comparações).
- Nunca selecionar `users.email`, `users.password_hash` nem `users.role`.

Ordenação (AGENTS §6, "Ordenação padrão"): `ORDER BY array_position($1::text[], g.zone), g.name, g.slug`, com `$1 = ZONA_ORDEM` vindo de `constants.js` (sem repetir a lista no SQL). Resultado com os 11 demo:
`cantareira-trail, juventude-em-pace, raia-usp, villa-lobos-runners, minhocao-noturno, pelotao-paulista, correria-do-carmo, tiete-em-movimento, pace-da-oca, primeiro-km-ibira, represa-run-club`.

### Serviço — `src/modules/groups/groups.service.js` (novo)
- `listPublishedGroups()` → `groupsRepo.listPublished()`. (Camada fina agora; a 005 acrescenta os filtros.)

### Serviço — `src/modules/pages/pages.service.js`
- **Remove** o import de `db/seeds/demo-groups.js` (pendência M3 "src/ deixa de importar demo-groups"). Nada em `src/` importa `db/seeds/` depois desta spec.
- `getHomeData(groups)` continua **pura**, agora com `groups` obrigatório (sem default). Mudança: `featured` usa o `participants` que já vem no grupo (não recalcula a partir de `base_participants`).
- `getZonesData(groups)` (nova, pura) → array na ordem de `ZONA_ORDEM`:
  `[{ zone, count, locations }]`, onde `locations` = locais distintos dos grupos da zona, na ordem em que aparecem em `groups` (protótipo: `[...new Set(list.map(g=>g.local))]`). Grupo com zona fora de `ZONAS` é ignorado (mesma defesa de `getHomeData`).
- `loadHomeData()` (async) → `getHomeData(await listPublishedGroups())`.
- `loadZonesData()` (async) → `getZonesData(await listPublishedGroups())`.

### Rotas — `src/modules/pages/pages.routes.js`
| Método | Caminho | Auth | Resultado |
|---|---|---|---|
| GET | `/` | — | 200, `renderPage('home', { title: 'Pace Paulista', ...await loadHomeData() })` |
| GET | `/zonas` | — | 200, `renderPage('zonas', { title: 'Zonas · Pace Paulista', zones: await loadZonesData() })` |

Banco fora do ar → o erro chega ao `errorHandler` → 500 com a página "Algo deu errado" (comportamento atual; sem tratamento novo).

### Views
- `partials/demo-tag.ejs` passa a receber `g` (`include('demo-tag', { g })`) e decide a etiqueta do card (**P5**, default):
  - `g.is_demo` → `<span class="demo-tag" title="Grupo fictício para demonstração">Fictício · demo</span>` (igual hoje);
  - senão, `g.owner_name` → `<span class="demo-tag">Cadastrado por <%= g.owner_name %></span>` (AGENTS §7);
  - senão (não demo e sem dono) → nada.
- `partials/group-card.ejs`: só troca o include para passar `g`. Resto igual.
- `pages/zonas.ejs` (nova) ← `PageZonas` (prototipo.html linhas 767–777), HTML e classes idênticos:
  - `page-head` com kicker "Explorar zonas", título "As cinco zonas de São Paulo", texto "Cada região tem uma cor e um selo inspirado em um marco da cidade. As cores identificam os grupos em todo o site."
  - Para cada item de `zones`: `<article class="zrow" style="<%= zstyle(z) %>">`, `seal(z, 120)`, kicker com `ZONAS[z].marco` (`style="color:var(--muted)"` como no protótipo), `h2` com o nome, `p` com `desc`, `zrow-meta` com `ic('users','ico-sm')<b>{count}</b>&nbsp;{grupo|grupos}` e `ic('pin','ico-sm')` + `locations.join(' · ')` ou "Nenhum local ainda" (escapado com `<%= %>`).
  - CTA: `<a class="btn btn-primary" href="/grupos?zona=<z>">Explorar grupos <%- ic('arrow','ico-sm') %></a>` (troca `#grupos-<z>`).
- `pages/home.ejs`: sem mudança de HTML.

### Testes — infraestrutura
- `tests/helpers/db.js`: nova `seedDemo(pool)` → `truncateAll(pool)` + `runSeed({ pool, nodeEnv: 'test' })`.
- A partir desta spec, testes HTTP que leem grupos precisam do banco de teste: `beforeAll` → `migrateTestDb(pool)` + `seedDemo(pool)`; `afterAll` → `pool.end()`.
- Mensagem de Postgres indisponível em `ensureTestDb` (e o teste que a confere, e o README): o subconjunto sem banco passa a ser `npx vitest run tests/domain tests/scripts` (testes de `tests/http` que leem grupos deixam de rodar sem banco).

### README
- "Como rodar": deixar explícito que `npm run dev` agora **precisa do Postgres de pé** (`npm run db:up`, `migrate`, `seed`) — pendência M3 do relatório 003.

## Regras e mensagens
| Elemento | Regra | Texto/valor exato (11 demo, sem memberships) |
|---|---|---|
| Home — tudo | igual à spec 002 | 11 "grupos cadastrados"; 4:00–8:30; 2/2/2/2/3 grupos; destaques Correria do Carmo, Pace da Oca, Pelotão Paulista com 48/56/72 |
| Participantes | `base_participants + nº de memberships` | Pace da Oca com 1 membership → **57** |
| Grupo não publicado | fora de tudo | `status` `pending`/`rejected` não conta no total, nas zonas nem em destaques |
| `/zonas` contagem | `count === 1 ? 'grupo' : 'grupos'` | `<b>2</b>&nbsp;grupos`; Sul `<b>3</b>&nbsp;grupos`; zona vazia `<b>0</b>&nbsp;grupos` |
| `/zonas` locais (Norte) | distintos, ordem da listagem | "Parque Estadual Alberto Löfgren (Horto Florestal) · Parque da Juventude" |
| `/zonas` locais (Oeste) | idem | "Cidade Universitária (USP) · Parque Villa-Lobos" |
| `/zonas` locais (Centro) | idem | "Elevado Presidente João Goulart (Minhocão) · Avenida Paulista" |
| `/zonas` locais (Leste) | idem | "Parque do Carmo · Parque Ecológico do Tietê" |
| `/zonas` locais (Sul) | idem, sem repetir Ibirapuera | "Parque Ibirapuera · Parque Guarapiranga" |
| `/zonas` zona sem grupo | — | "Nenhum local ainda" |
| Etiqueta do card | ver P5 | demo: "Fictício · demo"; real com dono: "Cadastrado por {display_name}"; real sem dono: nenhuma |

## Critérios de aceite
- [ ] CA1 — Dado o banco de dev com `migrate` + `seed`, quando abro `/`, então o HTML é idêntico ao gerado antes desta spec (mesmos números, destaques, links e notice da spec 002).
- [ ] CA2 — Nada em `src/` importa `db/seeds/` (`grep -r "db/seeds" src/` vazio).
- [ ] CA3 — Dado um usuário com membership no `pace-da-oca`, quando abro `/`, então o card do Pace da Oca mostra `57`.
- [ ] CA4 — Dado o `pelotao-paulista` com `status = 'pending'`, então `/` mostra 10 "grupos cadastrados", Centro "1 grupo" e só 2 destaques; `/zonas` mostra Centro com `<b>1</b>&nbsp;grupo` e só "Elevado Presidente João Goulart (Minhocão)".
- [ ] CA5 — Dado todos os grupos com `is_demo = false`, então `/` não mostra "Versão de demonstração" nem "Fictício · demo"; um grupo com `owner_id` de um usuário "Ana" mostra "Cadastrado por Ana"; sem dono, nenhuma etiqueta.
- [ ] CA6 — `listPublished()` devolve objetos com **exatamente** as chaves da tabela `Group` (nenhum `id`, `email`, `password_hash`, `base_participants`, `status`), `start_time` no formato `'HH:MM'` e `participants` do tipo `number`; a ordem dos slugs é a da seção "Repo".
- [ ] CA7 — `GET /zonas` → 200, título "Zonas · Pace Paulista", `aria-current="page"` no link "Explorar zonas" do header, 5 `class="zrow"` na ordem Norte, Oeste, Centro, Leste, Sul, selos com `width="120"`, contagens e locais da tabela, e cada CTA com `href="/grupos?zona=<zona>"`.
- [ ] CA8 — Dado nenhum grupo publicado, `/zonas` mostra as 5 zonas com `<b>0</b>&nbsp;grupos` e "Nenhum local ainda"; `/` continua como no teste de borda da 002 (sem `Infinity`/`NaN`).
- [ ] CA9 — Nome, local e `owner_name` com `<script>` aparecem escapados em `/` e `/zonas`.
- [ ] CA10 — Com o banco indisponível (repo rejeita), `GET /` responde 500 com a página "Algo deu errado", sem stack nem URL do banco no HTML.
- [ ] CA11 — Funciona sem JS (HTML completo, links reais, nenhum `href="#`); responsivo em 360 px sem scroll horizontal em `/zonas`.
- [ ] CA12 — SQL só em `src/modules/groups/groups.repo.js` (além do BEGIN/COMMIT de `pool.js`), parametrizado; `npm test` (com banco) e `npm run lint` passam.

## Testes esperados
- unit (`tests/domain/pages-service.test.js`, atualizar): passar a lista explicitamente — `DEMO_GROUPS.map(g => ({ ...g, participants: g.base_participants }))`; casos atuais mantidos; `featured` usa o `participants` recebido (grupo com `participants: 99` → 99). `getZonesData`: 5 itens em `ZONA_ORDEM`; Sul com `count` 3 e `locations` `['Parque Ibirapuera','Parque Guarapiranga']` (com a lista na ordem do repo); lista vazia → 5 zonas com 0 e `[]`; zona desconhecida ignorada.
- db (`tests/db/groups-repo.test.js`, novo): CA6 (chaves, tipos, ordem); participantes com membership (CA3); `pending` e `rejected` excluídos; `owner_name` preenchido via join e `null` sem dono.
- http:
  - `tests/http/home.test.js` (atualizar o `beforeAll` para migrar + `seedDemo`; as asserções atuais continuam iguais) + CA3, CA4, CA5.
  - `tests/http/zonas.test.js` (novo): CA7, CA8, CA9.
  - CA10: app com o `groups.repo` mockado (`vi.mock`) rejeitando → 500 e "Algo deu errado".

## Riscos / perguntas em aberto
### Perguntas em aberto
- **P1** (PENDENCIAS, M3) — Home sem grupos: qual texto/layout de "sem grupos" e do estado vazio dos destaques? **Default desta spec**: manter o comportamento atual (faixa de pace omitida, "0 grupos cadastrados", zonas "0 grupos", grade de destaques vazia).
- **P5** — Etiqueta de grupos não demo: "Cadastrado por {display_name}" (AGENTS §7) para grupo com dono; e para grupo **não demo sem dono** (dono excluiu a conta, ou curadoria do M9)? **Default**: nenhuma etiqueta.
- **P11** (M3+, PENDENCIAS) — "Selo da Centro" → "Selo do Centro"? Esta spec mantém o texto literal do protótipo.

### Riscos / decisões técnicas
- A ordem dos locais em `/zonas` segue a ordenação padrão do AGENTS §6 (zona, nome), não a ordem do array `DEMO` do protótipo; por isso Centro e Oeste listam os locais em ordem inversa à do protótipo.
- `ORDER BY g.name` sobre `citext` depende da collation do banco (por isso o compose usa `postgres:16` Debian). Desempate por `slug` deixa a ordem determinística.
- `npm test` sem Postgres passa a falhar também em `tests/http` (home, zonas); o subconjunto sem banco muda para `tests/domain tests/scripts`.
- Formato de `PACE_FAIXAS` (AGENTS `[min,max]` × protótipo `{nome,min,max}`): decidido na 005.
