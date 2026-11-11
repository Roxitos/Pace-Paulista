# Pendências por marco

Riscos aceitos, pendências e perguntas abertas levantadas pelo pipeline. **O Specifier lê este arquivo antes de cada spec** e incorpora (ou responde) os itens do marco. Ao resolver um item, marque `[x]` e cite a spec.

Origem: `001` = [relatório 001](reports/001-scaffold-base.md), `002` = [relatório 002](reports/002-home-estatica.md), `003` = [relatório 003](reports/003-banco-migrations-seed.md), `004` = [relatório 004](reports/004-leitura-banco-home-zonas.md).

## Perguntas de produto em aberto
- [x] **M3** — Home sem grupos: qual texto/layout de "sem grupos" e estado vazio dos destaques? Hoje: pace omitido, "0 grupos cadastrados", zonas "0 grupos", destaques vazios. (002) — spec 004, P1: mantém o comportamento atual
- [ ] **M3 (005)** — P2: botão "Aplicar filtros" no form sem JS; manter "Os resultados atualizam na hora." antes do M7? (004)
- [ ] **M3 (006)** — P6: texto do 404 de grupo ("Esse grupo não foi encontrado. Ele pode ter sido removido."); P7: manter "Confirmações por encontro dependem do banco de dados."? (004)
- [ ] **M3 (007)** — P8: `/mapa/<slug inexistente>` → 404 (protótipo caía no padrão); P9: seleção padrão do mapa = primeiro da ordem (Cantareira Trail) ou fixar Correria do Carmo? (004)
- [ ] **M3+** — Rodapé diz sempre "Os grupos marcados como “Fictício · demo”…", mesmo sem demos publicados. Condicionar a `hasDemo` como o aviso da home? (004, QA)
- [ ] **M5** — `display_name` fica público ("Cadastrado por …"); avisar no cadastro de conta. Bloquear nomes que imitem a marca (ex.: "Equipe Pace Paulista")? (004, Hardener)
- [ ] **M6/M9** — Destaques (`DESTAQUES`) buscados só pelo slug: se os demos saírem, quem cadastrar "Pace da Oca" vai para a home. Restringir a `is_demo`/curadoria ou reservar os slugs? (004, Hardener)
- [ ] **M3+** — Corrigir "Selo da Centro" → "Selo do Centro"? (texto literal do protótipo; também "Outros grupos da Centro" — P11) (002, 004)
- [ ] **M5/M6** — 4xx que não são 404 (400/413) usam a página genérica "Algo deu errado" mantendo o status. Querem texto próprio? (001)
- [ ] **M6/M9** — Trazer "dono edita o próprio grupo" para a v1? Hoje está no roadmap (CLAUDE.md §12), mas sem isso os dados de grupos reais ficam desatualizados (horário/local mudam). (conteúdo)
- [ ] **M6/M9** — Moderação: grupo novo nasce `pending` já no lançamento (evita spam) ou continua `published` como na v1? (conteúdo)

## M2 — Banco
- [x] CHECKs garantem `zone`, `level`, `days` (`cardinality(days) >= 1`), `start_time` e pace 180–720 inteiro; hoje zona/nível desconhecido em destaque → 500 de propósito, `days` vazio → " · 6h". (002) — spec 003, CA7
- [x] Validar `DATABASE_URL` e exigir `SESSION_SECRET` forte em produção no `env.js`. (001) — spec 003, CA11
- [x] Seed reaproveita `db/seeds/demo-groups.js`. (002) — spec 003, CA4/CA5
- [x] Docker Desktop instalado mas ainda não inicializado na máquina (abrir o app, aceitar termos, talvez WSL2 + reinício). — `docker info` responde; spec 003, CA1

## M3 — Leitura
- [ ] SQL parametrizado; `ILIKE` com `%` e `_` escapados (005). `23505`/`23514` e `tx()` só existem com escrita → movidos para o M6 (spec 004). (001)
- [x] `src/` deixa de importar `db/seeds/demo-groups.js` e passa a ler do banco. (002) — spec 004, CA2
- [ ] Formato de `PACE_FAIXAS` diverge: AGENTS.md `[min,max]` × protótipo `{nome,min,max}` — spec 005 decide `{nome,min,max}`; atualizar CLAUDE.md §6 junto com a 005. (Specifier 001, 004)
- [ ] Slugs continuam `[a-z0-9-]` (já há `encodeURIComponent` nos links). Não há CHECK em `groups.slug`; 006 valida o formato na rota. (002, 004)
- [x] `pg` devolve BIGINT como string (`id`) e `start_time` como `'06:30:00'` — tratar no repo/views (`fmtHora` já aceita `HH:MM:SS`). (003) — spec 004, CA6: `id` não sai do repo; `to_char(…,'HH24:MI')`
- [x] A partir do M3, `npm run dev` passa a precisar do Postgres de pé; documentar no README. (003) — spec 004
- [ ] Exibição do `contact` na página do grupo, inclusive quando NULL (demos). (003) — decidido (P4, usuário): **deslogado não vê**; linha "Contato" no fim da "Ficha do treino", texto puro, oculta quando vazia. Ajustar spec 006; exibição para logado entra no M5.
- [ ] Spec 005: toggles de zona viram checkboxes com o mesmo visual (P3 aprovado pelo usuário); atualizar CLAUDE.md §8 (`aria-pressed`) e §3 (`domain/filters.js` normaliza a query; `WHERE` no repo) junto com a 005. (004)
- [ ] Spec 007: `/sobre` mantém o título "Status do protótipo" (P10, usuário); banco ATIVO, login PENDENTE, item "navegador" removido. (004)

## M4 — Compatibilidade / cadastro
- [ ] zod no cadastro de grupo (`parsePace`, dias, horário) e `slug()` com geração/validação. (002)

## M5 — Contas
- [ ] CSRF, sessão, cookies (`httpOnly`, `sameSite=lax`, `secure`), `requireAuth`, `session.regenerate`. (001)
- [ ] `?next=` só caminhos internos (`/…`, nunca `//…`) — a home já gera `/conta/entrar?next=/grupos/<slug>%23participar`. (001, 002)
- [ ] Rate limit em `/conta/entrar` e `/conta/criar`. (001)
- [ ] Ao montar body-parser: `limit` explícito em `express.urlencoded` (o `errorHandler` já trata 400/413). (001)
- [ ] Excluir conta: cascata e sessão destruída. (001)
- [ ] Mostrar o contato do grupo só para logado (P4). (004)
- [ ] `.trim()` no zod antes de `min()` em `display_name` (só espaços passa no CHECK). (004, Hardener)
- [ ] LGPD: nunca logar `err.detail` do pg (no `23505` vem `Key (email)=(…)`); registrar só `code`/`constraint`. (004, Hardener)
- [ ] `connect-pg-simple` com `createTableIfMissing: false` (tabela vem da migration 005). (003)
- [ ] `SESSION_SECRET=` vazio é aceito em dev/test; conferir quando o `express-session` entrar. (003)

## M6 — Escrita
- [ ] Tratar `23505`/`23514` e usar `tx()` em escritas múltiplas (movido do M3). (001, 004)
- [ ] `start_time = '24:00'` é aceito pelo Postgres e derruba `/` (e `/grupos`) via `fmtHora`: migration nova `CHECK (start_time < '24:00')` + zod `([01]\d|2[0-3]):[0-5]\d`. Corrige o item do M2 "CHECKs garantem start_time". (004, Hardener)
- [ ] Zod: deduplicar `days` ("Sáb, Sáb"); `.trim()` em `name`/`location`/`contact`/`apelido` antes do tamanho. (004, Hardener)
- [ ] Registrar `/grupos/novo` antes de `/grupos/:slug`; reservar slugs `novo` e `zona`. (004, Specifier)

## M8 — Produção
- [ ] helmet + CSP (`self`, fonts.googleapis.com, fonts.gstatic.com). `style="--z:…"`, `style="font-size:14px"` e o `extra` do 404/500 exigem `style-src-attr 'unsafe-inline'` ou classes CSS. (001, 002)
- [ ] Não publicar antes de M3/M5: links da home levam a 404. (002)
- [x] Seed dos grupos demo **não roda** com `NODE_ENV=production` (ou demos removidos/despublicados antes de abrir o site). O aviso "Versão de demonstração" some sozinho quando não houver demo publicado (`hasDemo`). (conteúdo) — spec 003, CA6
- [ ] **Pergunta**: ambiente publicado (staging/preview) com grupos demo antes do M9? Hoje o seed fica bloqueado com `NODE_ENV=production` sem flag. Opções: flag explícita (ex. `ALLOW_DEMO_SEED=1`) ou staging com outro `NODE_ENV`. (003)
- [ ] Release exige `DATABASE_URL` e `SESSION_SECRET` ≥ 32 caracteres; conferir extensão `citext` no Postgres gerenciado. (003)
- [ ] `pg_advisory_lock` do migrate espera sem limite se outro migrate travar segurando o lock — avaliar `lock_timeout` no release. (003)
- [ ] `ensureTestDb` não trava host remoto (um banco remoto `*_test` passaria); decidir junto com o CI (service container). (003)
- [ ] Healthcheck `pg_isready` sem `-h` pode responder "healthy" durante o init do volume; avaliar `-h 127.0.0.1`. (003, QA)
- [ ] Pool da app sem `statement_timeout`: lock longo em `groups` (ex.: migration travada) pendura `/` e `/zonas` até 300 s. Avaliar só no pool da app (`createPool` também serve migrate/seed). (004, Hardener)
- [ ] Favicon ausente → 404 no console (desde 001). (004, QA)
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
