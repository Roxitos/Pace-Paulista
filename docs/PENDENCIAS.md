# Pendências por marco

Riscos aceitos, pendências e perguntas abertas levantadas pelo pipeline. **O Specifier lê este arquivo antes de cada spec** e incorpora (ou responde) os itens do marco. Ao resolver um item, marque `[x]` e cite a spec.

Origem: `001` = [relatório 001](reports/001-scaffold-base.md), `002` = [relatório 002](reports/002-home-estatica.md), `003` = [relatório 003](reports/003-banco-migrations-seed.md), `004` = [relatório 004](reports/004-leitura-banco-home-zonas.md), `005` = [relatório 005](reports/005-busca-filtros.md), `006` = [relatório 006](reports/006-detalhe-grupo.md), `007` = [relatório 007](reports/007-mapa-sobre.md), `008` = [relatório 008](reports/008-encontrar-compatibilidade.md).

## Perguntas de produto em aberto
- [x] **M3** — Home sem grupos: qual texto/layout de "sem grupos" e estado vazio dos destaques? Hoje: pace omitido, "0 grupos cadastrados", zonas "0 grupos", destaques vazios. (002) — spec 004, P1: mantém o comportamento atual
- [ ] **M3 (005)** — P2: botão "Aplicar filtros" no form sem JS; manter "Os resultados atualizam na hora." antes do M7? (004) — spec 005 seguiu o default (botão "Aplicar filtros", texto literal); confirmar o texto ou trocá-lo até o M7. (005)
- [ ] **M3+** — Sem JS, a URL após enviar o form leva campos vazios (`&local=&dia=…`). Redirecionar para a URL limpa? (005, QA)
- [x] **M3 (006)** — P6: texto do 404 de grupo ("Esse grupo não foi encontrado. Ele pode ter sido removido."); P7: manter "Confirmações por encontro dependem do banco de dados."? (004) — spec 006: defaults aceitos pelo usuário
- [ ] **Futuro** — Contato do grupo vira link (Instagram/site/e-mail) com validação de URL; hoje é texto puro (P4). (006, usuário)
- [ ] **M3+** — A 320 px todas as páginas têm 3 px de scroll horizontal (largura 323), já na HEAD; a meta do AGENTS é 360 px. Importa suportar 320 px? (006, QA) — causa: `button.menu-btn` do cabeçalho; em `/encontrar` o botão do form já cabe a 320. (008, QA)
- [ ] **M7** — `/encontrar` a ≤ 375 px: o botão "Mostrar grupos compatíveis" quebra em 2 linhas (lupa à esquerda, texto centralizado) para não estourar a largura (desvio do protótipo, que estourava). Preferem um rótulo mais curto em telas estreitas? (008, QA)
- [x] **M3 (007)** — P8: `/mapa/<slug inexistente>` → 404 (protótipo caía no padrão); P9: seleção padrão do mapa = primeiro da ordem (Cantareira Trail) ou fixar Correria do Carmo? (004) — spec 007: defaults aceitos pelo usuário (CA1, CA4)
- [ ] **M3+** — Rodapé diz sempre "Os grupos marcados como “Fictício · demo”…", mesmo sem demos publicados. Condicionar a `hasDemo` como o aviso da home? (004, QA)
- [ ] **M5** — `display_name` fica público ("Cadastrado por …"); avisar no cadastro de conta. Bloquear nomes que imitem a marca (ex.: "Equipe Pace Paulista")? (004, Hardener)
- [ ] **M6/M9** — Destaques (`DESTAQUES`) buscados só pelo slug: se os demos saírem, quem cadastrar "Pace da Oca" vai para a home. Restringir a `is_demo`/curadoria ou reservar os slugs? (004, Hardener)
- [ ] **M3+** — Corrigir "Selo da Centro" → "Selo do Centro"? (texto literal do protótipo; também "Outros grupos da Centro" — P11; e o motivo "Fica na Centro" do `/encontrar` — spec 008, P4) (002, 004, 008)
- [x] **M4 (008)** — P1: `/encontrar` só GET com query string (sem POST/CSRF); P2: subtítulo "…Nada é salvo."; P3: empate pela ordem de criação (`g.id`); P4/P5: textos e `inputmode` literais do protótipo. — spec 008: defaults aceitos pelo usuário; AGENTS §3/§5/§6 atualizados
- [ ] **M5/M6** — 4xx que não são 404 (400/413) usam a página genérica "Algo deu errado" mantendo o status. Querem texto próprio? (001)
- [ ] **M6/M9** — Trazer "dono edita o próprio grupo" para a v1? Hoje está no roadmap (CLAUDE.md §12), mas sem isso os dados de grupos reais ficam desatualizados (horário/local mudam). (conteúdo)
- [ ] **M6/M9** — Moderação: grupo novo nasce `pending` já no lançamento (evita spam) ou continua `published` como na v1? (conteúdo)

## M2 — Banco
- [x] CHECKs garantem `zone`, `level`, `days` (`cardinality(days) >= 1`), `start_time` e pace 180–720 inteiro; hoje zona/nível desconhecido em destaque → 500 de propósito, `days` vazio → " · 6h". (002) — spec 003, CA7
- [x] Validar `DATABASE_URL` e exigir `SESSION_SECRET` forte em produção no `env.js`. (001) — spec 003, CA11
- [x] Seed reaproveita `db/seeds/demo-groups.js`. (002) — spec 003, CA4/CA5
- [x] Docker Desktop instalado mas ainda não inicializado na máquina (abrir o app, aceitar termos, talvez WSL2 + reinício). — `docker info` responde; spec 003, CA1

## M3 — Leitura
- [x] SQL parametrizado; `ILIKE` com `%` e `_` escapados (005). `23505`/`23514` e `tx()` só existem com escrita → movidos para o M6 (spec 004). (001) — spec 005, CA5/CA9
- [x] `src/` deixa de importar `db/seeds/demo-groups.js` e passa a ler do banco. (002) — spec 004, CA2
- [x] Formato de `PACE_FAIXAS` diverge: AGENTS.md `[min,max]` × protótipo `{nome,min,max}` — spec 005 decide `{nome,min,max}`. (Specifier 001, 004) — spec 005
- [x] Atualizar CLAUDE.md **e** AGENTS.md: §6 `PACE_FAIXAS` `{nome,min,max}`; §3 `filters.js` normaliza a query (o `WHERE` fica no repo) e novo partial `filter-options`; §8 checkboxes de zona no lugar de `aria-pressed` (P3). (005) — atualizados com OK do usuário
- [x] Slugs continuam `[a-z0-9-]` (já há `encodeURIComponent` nos links). Não há CHECK em `groups.slug`; 006 valida o formato na rota. (002, 004) — spec 006, CA3: `^[a-z0-9-]{1,60}$` na rota, 404 sem consultar o banco
- [x] `pg` devolve BIGINT como string (`id`) e `start_time` como `'06:30:00'` — tratar no repo/views (`fmtHora` já aceita `HH:MM:SS`). (003) — spec 004, CA6: `id` não sai do repo; `to_char(…,'HH24:MI')`
- [x] A partir do M3, `npm run dev` passa a precisar do Postgres de pé; documentar no README. (003) — spec 004
- [x] Exibição do `contact` na página do grupo, inclusive quando NULL (demos). (003) — decidido (P4, usuário): **deslogado não vê**; linha "Contato" no fim da "Ficha do treino", texto puro, oculta quando vazia. Ajustar spec 006; exibição para logado entra no M5. — spec 006, CA4: serviço zera `contact` sem `viewer` e a view exige `locals.user`; reconfirmado pelo usuário em 2026-11-11
- [x] Spec 005: toggles de zona viram checkboxes com o mesmo visual (P3 aprovado pelo usuário). (004) — spec 005, CA7
- [x] Sem JS, ≤ 900 px: "Filtros" rola até `#filters` e o título/"Limpar filtros" ficam ~70 px atrás do cabeçalho fixo (toque acerta `/meus`). (005, QA) — spec 005: `.filters{scroll-margin-top:84px}` (a safe-area já vem do `scroll-padding-top` do `html`), reverificado pelo QA
- [ ] Regras CSS `[aria-pressed]` dos toggles de zona ficaram órfãs em `app.css` (cópia literal do protótipo); remover ou reaproveitar no M7. (005)
- [x] Spec 007: `/sobre` mantém o título "Status do protótipo" (P10, usuário); banco ATIVO, login PENDENTE, item "navegador" removido. (004) — spec 007, CA7
- [ ] `/sobre`: atualizar a lista de status a cada marco (login vira ATIVO no M5; compatibilidade/cadastro, citados no 1º ATIVO, só existem no M4/M6). (007) — compatibilidade passou a existir com a spec 008; falta cadastro (M6) e login (M5). (008)

## M4 — Compatibilidade
- O item "zod no cadastro de grupo" que estava aqui é do cadastro (`POST /grupos`) e foi para o M6 (spec 008).
- [x] `/encontrar` com `calcMatch` no servidor e mesmos resultados do protótipo para as mesmas respostas. — spec 008, CA1: QA comparou 6.183.630 combinações com o código extraído do protótipo, 0 divergências. **M4 concluído.**

## M5 — Contas
- [ ] **M5 (specs 009–012, aguardando OK para o Coder)** — respostas do usuário e perguntas abertas em `docs/reports/009-sessao-csrf-requireauth.md`: abertas **P4/P8** (textos de criar conta, entrar e sair) e **P11** (texto da confirmação de exclusão); **P2** pede ajustar a spec 009 (mensagem "Sua sessão expirou…" + botão "Atualizar e tentar de novo"). Exclusão de conta passa do M6 para o M5 (atualizar `MILESTONES.md`).
- [ ] CSRF, sessão, cookies (`httpOnly`, `sameSite=lax`, `secure`), `requireAuth`, `session.regenerate`. (001)
- [ ] `?next=` só caminhos internos (`/…`, nunca `//…`) — a home já gera `/conta/entrar?next=/grupos/<slug>%23participar`. (001, 002)
- [ ] Rate limit em `/conta/entrar` e `/conta/criar`. (001)
- [ ] Ao montar body-parser: `limit` explícito em `express.urlencoded` (o `errorHandler` já trata 400/413). (001)
- [ ] Excluir conta: cascata e sessão destruída. (001)
- [ ] Mostrar o contato do grupo só para logado (P4). (004) — a 006 já deixou pronto: a sessão só precisa preencher `res.locals.user`; o QA do M5 repete o CA4 da 006 com sessão real. (006)
- [ ] Página do grupo com contato para logado: responder com `Cache-Control: private` (ou `Vary: Cookie`) para um CDN/proxy não servir a versão com contato a deslogado. (006, Hardener)
- [ ] `.trim()` no zod antes de `min()` em `display_name` (só espaços passa no CHECK). (004, Hardener)
- [ ] LGPD: nunca logar `err.detail` do pg (no `23505` vem `Key (email)=(…)`); registrar só `code`/`constraint`. (004, Hardener)
- [ ] `connect-pg-simple` com `createTableIfMissing: false` (tabela vem da migration 005). (003)
- [ ] `SESSION_SECRET=` vazio é aceito em dev/test; conferir quando o `express-session` entrar. (003)

- [ ] **Pós-M5 (spec própria)** — E-mail de boas-vindas ao criar conta, com visual do site (HTML com CSS inline). Envio por SMTP/API de provedor configurável por env (`SMTP_*` ou chave da API), falha de envio não pode impedir o cadastro. Exige dependência nova justificada (ex.: `nodemailer`), atualizar AGENTS §1 (hoje "notificações/e-mail" é fora do escopo) e revisar LGPD (e-mail usado também para mensagem, não só login). Provedor ainda a escolher. (usuário, 2026-11-13)
- [x] P4/P8 textos de conta aprovados; P11 "Tem certeza que deseja excluir?" com grupos publicados; P2 página própria de CSRF. — specs 009/010/011/012

## M6 — Escrita
- [ ] zod no cadastro de grupo (`parsePace`, dias, horário) e `slug()` com geração/validação. (002; movido do M4 pela spec 008)
- [ ] Tratar `23505`/`23514` e usar `tx()` em escritas múltiplas (movido do M3). (001, 004)
- [ ] `start_time = '24:00'` é aceito pelo Postgres e derruba `/` (e `/grupos`) via `fmtHora`: migration nova `CHECK (start_time < '24:00')` + zod `([01]\d|2[0-3]):[0-5]\d`. Corrige o item do M2 "CHECKs garantem start_time". (004, Hardener)
- [ ] Zod: deduplicar `days` ("Sáb, Sáb"); `.trim()` em `name`/`location`/`contact`/`apelido` antes do tamanho. (004, Hardener) — no `/encontrar`, `days = {seg,seg}` viraria "Treina segunda e segunda". (008, Hardener)
- [ ] Normalizar para NFC também na escrita (`name`, `location`): a busca normaliza a entrada, mas um nome gravado em NFD não seria achado. (005, Hardener)
- [ ] `start_time = '24:00'` também derruba `/grupos` (cai em `periodo=noite` e em `fmtHora`), com ou sem filtro — mesma correção do item acima. (005, Hardener)
- [ ] Registrar `/grupos/novo` antes de `/grupos/:slug`; reservar slugs `novo` e `zona`. (004, Specifier) — hoje `/grupos/novo` e `/grupos/zona` dão o 404 com a mensagem do grupo. (006)
- [ ] `start_time = '24:00'` também derruba `/grupos/:slug` (`proximos`/`fmtHora`) — mesma correção dos itens acima. (006, Hardener) — e `/mapa/<slug>` desse grupo (e `/mapa` se ele for o 1º da lista) responde 500 pelo `fmtHora` do painel. (007, Hardener) — e `/encontrar` (`fmtHora` do card sempre; `periodoDe` do `calcMatch` quando há período). (008, Hardener)
- [ ] `groups.map_pin` sem CHECK: a view já ignora coordenadas fora do viewBox (0–400 × 0–380); se o pin passar a ser editável, criar migration com CHECK. (007, Hardener)
- [ ] Cards de `/grupos` com nome de 50 caracteres sem espaço abrem scroll horizontal a 360 px (já na HEAD da 005): `overflow-wrap` no card ou limite no zod. (006, QA)

## M7 — Melhorias de JS
- [ ] Testar em aparelho real (iPhone) o campo de pace com `inputmode="numeric"` (literal do protótipo): o teclado numérico pode não ter `:`, impedindo digitar "5:30". Vale para `/encontrar` (spec 008, P5) e para o cadastro do M6. (008)
- [ ] `listPublished` devolve `contact` de todos os grupos (contrato `Group`): `GET /api/grupos` (e qualquer JSON enviado ao cliente) precisa remover `contact` para deslogado, senão o P4 vaza. (006, Hardener) — recomendação: separar `SELECT_LIST` sem `contact` (listagens) de `findPublishedBySlug` (mantém o campo) e ajustar o teste de contrato; o mapa já remove o campo no service. (007, Hardener)
- [ ] `public/js/mapa.js`: selecionar no mapa sem recarregar (hoje cada clique recarrega `/mapa/<slug>`). (007)
- [ ] Sem `aria-current` no menu em `/encontrar` (`currentNav('/encontrar')` → `''`, como no protótipo, que não tem item de menu para a página). (008, Coder)
- [ ] No 1º carregamento, antes das webfontes chegarem, o cabeçalho e a âncora `#matchResults` ficam deslocados por um instante (fonte de fallback com outra métrica); vale para todas as âncoras do site. (008, QA)
- [ ] Acessibilidade do mapa (vêm do protótipo): foco de teclado discreto nos pins não selecionados (anel `r=0`, só o ponto cresce) e alvo de toque de ~9 px a 360 px (WCAG 2.5.8 pede 24 px). (007, QA)

## M8 — Produção
- [ ] helmet + CSP (`self`, fonts.googleapis.com, fonts.gstatic.com). `style="--z:…"`, `style="font-size:14px"` e o `extra` do 404/500 exigem `style-src-attr 'unsafe-inline'` ou classes CSS. (001, 002)
- [ ] Não publicar antes de M3/M5: links da home levam a 404. (002) — `/encontrar` deixou de ser um deles (spec 008); "Entrar no grupo" dos cards de `/encontrar` leva a `/conta/entrar` (404 até o M5). (008, QA)
- [x] Seed dos grupos demo **não roda** com `NODE_ENV=production` (ou demos removidos/despublicados antes de abrir o site). O aviso "Versão de demonstração" some sozinho quando não houver demo publicado (`hasDemo`). (conteúdo) — spec 003, CA6
- [ ] **Pergunta**: ambiente publicado (staging/preview) com grupos demo antes do M9? Hoje o seed fica bloqueado com `NODE_ENV=production` sem flag. Opções: flag explícita (ex. `ALLOW_DEMO_SEED=1`) ou staging com outro `NODE_ENV`. (003)
- [ ] Release exige `DATABASE_URL` e `SESSION_SECRET` ≥ 32 caracteres; conferir extensão `citext` no Postgres gerenciado. (003)
- [ ] `pg_advisory_lock` do migrate espera sem limite se outro migrate travar segurando o lock — avaliar `lock_timeout` no release. (003)
- [ ] `ensureTestDb` não trava host remoto (um banco remoto `*_test` passaria); decidir junto com o CI (service container). (003) — CI criado em `.github/workflows/ci.yml` com service container em `localhost`; a trava de host continua em aberto.
- [ ] Healthcheck `pg_isready` sem `-h` pode responder "healthy" durante o init do volume; avaliar `-h 127.0.0.1`. (003, QA)
- [ ] Pool da app sem `statement_timeout`: lock longo em `groups` (ex.: migration travada) pendura `/` e `/zonas` até 300 s. Avaliar só no pool da app (`createPool` também serve migrate/seed). (004, Hardener)
- [ ] Favicon ausente → 404 no console (desde 001). (004, QA)
- [ ] `/grupos` sem rate limit nem cache: cada GET faz consulta completa (entrada limitada pelo Node, 431, e pelos 1000 pares do querystring). Agrava o pool sem `statement_timeout`. (005, Hardener) — idem `/encontrar`: cada busca válida carrega todos os grupos publicados com `COUNT` das participações (aceito pela spec 008). (008, Hardener)
- [ ] `ESCAPE '\'` depende de `standard_conforming_strings=on` (padrão desde PG 9.1); conferir no Postgres de produção ou trocar por `ESCAPE E'\\'`. (005, Hardener)
- [ ] Deploy automático a cada push na `main` com `npm run migrate` no release. Dados não exigem deploy: SSR lê o banco a cada request. (conteúdo)

## M9 — Conteúdo real (manter os grupos atualizados)
Estratégia para trocar os grupos fictícios por reais e mantê-los em dia depois do lançamento. Itens que tocam o escopo da v1 dependem das perguntas de produto acima.
- [ ] **Curadoria inicial**: levantar grupos reais de SP (Instagram, assessorias, clubes Strava), pedir autorização aos organizadores e cadastrar com `is_demo = false` (seed próprio, ex.: `db/seeds/real-groups.js`, ou cadastro via admin). Sem scraping (viola termos das plataformas).
- [ ] **Cadastro pelo organizador** (`/grupos/novo`, M6) como principal fonte de crescimento.
- [ ] **Reivindicar grupo** ("Sou o organizador"): organizador assume um grupo curado (`owner_id = NULL`) e vira dono. Definir como validar (ex.: contato pelo canal público do grupo + aprovação admin).
- [ ] **Edição pelo dono** (ver pergunta de produto).
- [ ] **Validade dos dados**: nova migration com `last_confirmed_at TIMESTAMPTZ`; job periódico (cron do provedor ou `node-cron`) — 90 dias sem confirmação → pedir ao dono para confirmar; 120 dias → selo "não confirmado recentemente" ou sair da busca. Exige canal de aviso ao dono (e-mail está fora da v1 — decidir).
- [ ] **"Informar problema"** na página do grupo (grupo acabou, horário mudou), com fila para admin.
- [ ] **Moderação** usando a coluna `status` já existente + página `/admin` (ver pergunta de produto).

## Riscos aceitos
- `npm audit`: 4 moderados (GHSA-g3hv-75wg-m249, minimatch via eslint 10), só devDependencies; `--omit=dev` = 0. Reavaliar quando sair eslint 10.x corrigido. (001)
- `throw null` / `next(null)` → Express trata como "sem erro" e responde 404. (001)
- `.prettierignore` com `*.md` e `.claude/` além da spec. (001)
- Postgres de dev publicado em `127.0.0.1:5432` em vez do `5432:5432` literal da spec (mais seguro; mesma porta). (003, Hardener)
- Advisory lock do migrate com chave fixa `20261111` (só colide com outro software usando a mesma chave no mesmo banco). (003)
- Migration nova com número menor que uma já aplicada é aplicada fora de ordem, sem erro. (003)
- Com `PORT`/`NODE_ENV` inválidos, erros de banco/segredo só aparecem na execução seguinte; em produção, 32 espaços passam como segredo. (003)
- Com o Postgres parado, `afterAll` de `pool.test.js`/`migrate.test.js` acrescenta `ECONNREFUSED` cru após a mensagem certa; `migrate` em produção com env inválido mostra stack (sem valores); erros de senha/banco inexistente na CLI não citam o alvo. (003, QA)
- `listPublished` sem LIMIT nem cache: consulta completa a cada GET em `/` e `/zonas`; rever com paginação (005) ou M8/M9 (consulta agregada para `/zonas`). (004)
- `errorHandler` faz `console.error(err)` bruto (host/porta do banco, nunca senha); só log. (004)
- Ordem dos locais em `/zonas` depende da collation de `citext` (desempate por slug). (004)
- `tests/http` exige Postgres (exceto `banco-indisponivel.test.js`); `testTimeout`/`hookTimeout` 30 s por causa do Docker no Windows. (004)
- QA em worktree usa o Postgres do checkout principal; `db:up` no worktree disputaria a porta 5432 — fixar `name:` no `docker-compose.yml`? (004, QA)
- Busca não ignora acentos (`pelotao` não acha "Pelotão"), igual ao protótipo; caracteres invisíveis (U+200B) não são removidos pelo `trim()` — só geram 0 resultados e chip "Nome: " aparentemente vazio. (005)
- `activeChips` e `buildWhere` assumem a saída de `parseFilters`; um chamador interno com `null` ou zona fora de `ZONAS` derruba a requisição (hoje o único chamador é `searchGroups`). (005)
- Valor repetido usa o primeiro (`?dia=xyz&dia=sab` fica sem filtro de dia), conforme a spec. (005)
- `:has()` exige navegador ≥ 2023; sem ele o filtro funciona, só some o destaque da zona marcada. Em ≤ 900 px o painel de filtros volta fechado após "Aplicar filtros". (005)
- Ordem dos cards em `/grupos` = zona + nome (AGENTS §6), diferente do array `DEMO` do protótipo — intencional, não "corrigir". (005, QA)
- `proximos` num horário que o relógio pula (se o horário de verão voltar, 0h–1h em SP) cai no dia anterior; `fmtEncontro` exige ICU completo (padrão no Node 22; teste pega small-icu). (006, Hardener)
- Encontros da página do grupo em ≤ 560 px: pace desce para baixo do texto (2 colunas) — desvio intencional do protótipo aprovado pelo usuário; acima disso igual ao protótipo. (006, QA)
- Ambiente local roda Node 24; AGENTS pede 22 (CI usa 22). (006, QA)
- Em 404 sob `/grupos/...` (ex.: `/grupos/zona/marte`) o header marca "Encontrar grupos" com `aria-current` (`currentNav` usa `startsWith('/grupos/')`). Cosmético. (005, Hardener)
- `/encontrar` ecoa o pace como digitado (escapado), sem limite próprio de tamanho; o teto é o limite de cabeçalho do Node (431). (008, Hardener)
- Com mais de 1000 pares na query, o excedente é descartado e respostas podem "sumir" (422 ou form vazio), como na `/grupos`. (008, Hardener)
- `tests/domain/match-prototipo.test.js` usa grade reduzida (subconjuntos de dias de tamanho 1, 2 e 7) por tempo; a grade completa foi rodada uma vez pelo QA da 008 (0 divergências). (008)
- Com erro de validação, `/encontrar` responde 422 mesmo com o banco fora (não consulta). (008, Coder)
