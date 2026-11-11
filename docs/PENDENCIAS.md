# Pendências por marco

Riscos aceitos, pendências e perguntas abertas levantadas pelo pipeline. **O Specifier lê este arquivo antes de cada spec** e incorpora (ou responde) os itens do marco. Ao resolver um item, marque `[x]` e cite a spec.

Origem: `001` = [relatório 001](reports/001-scaffold-base.md), `002` = [relatório 002](reports/002-home-estatica.md), `003` = [relatório 003](reports/003-banco-migrations-seed.md).

## Perguntas de produto em aberto
- [ ] **M3** — Home sem grupos: qual texto/layout de "sem grupos" e estado vazio dos destaques? Hoje: pace omitido, "0 grupos cadastrados", zonas "0 grupos", destaques vazios. (002)
- [ ] **M3+** — Corrigir "Selo da Centro" → "Selo do Centro"? (texto literal do protótipo) (002)
- [ ] **M5/M6** — 4xx que não são 404 (400/413) usam a página genérica "Algo deu errado" mantendo o status. Querem texto próprio? (001)
- [ ] **M6/M9** — Trazer "dono edita o próprio grupo" para a v1? Hoje está no roadmap (CLAUDE.md §12), mas sem isso os dados de grupos reais ficam desatualizados (horário/local mudam). (conteúdo)
- [ ] **M6/M9** — Moderação: grupo novo nasce `pending` já no lançamento (evita spam) ou continua `published` como na v1? (conteúdo)

## M2 — Banco
- [x] CHECKs garantem `zone`, `level`, `days` (`cardinality(days) >= 1`), `start_time` e pace 180–720 inteiro; hoje zona/nível desconhecido em destaque → 500 de propósito, `days` vazio → " · 6h". (002) — spec 003, CA7
- [x] Validar `DATABASE_URL` e exigir `SESSION_SECRET` forte em produção no `env.js`. (001) — spec 003, CA11
- [x] Seed reaproveita `db/seeds/demo-groups.js`. (002) — spec 003, CA4/CA5
- [x] Docker Desktop instalado mas ainda não inicializado na máquina (abrir o app, aceitar termos, talvez WSL2 + reinício). — `docker info` responde; spec 003, CA1

## M3 — Leitura
- [ ] SQL parametrizado; `ILIKE` com `%` e `_` escapados; tratar `23505`/`23514`; `tx()` em escritas múltiplas. (001)
- [ ] `src/` deixa de importar `db/seeds/demo-groups.js` e passa a ler do banco. (002)
- [ ] Formato de `PACE_FAIXAS` diverge: AGENTS.md `[min,max]` × protótipo `{nome,min,max}` — decidir na spec. (Specifier 001)
- [ ] Slugs continuam `[a-z0-9-]` (já há `encodeURIComponent` nos links). (002)
- [ ] `pg` devolve BIGINT como string (`id`) e `start_time` como `'06:30:00'` — tratar no repo/views (`fmtHora` já aceita `HH:MM:SS`). (003)
- [ ] A partir do M3, `npm run dev` passa a precisar do Postgres de pé; documentar no README. (003)
- [ ] Exibição do `contact` na página do grupo, inclusive quando NULL (demos). (003)

## M4 — Compatibilidade / cadastro
- [ ] zod no cadastro de grupo (`parsePace`, dias, horário) e `slug()` com geração/validação. (002)

## M5 — Contas
- [ ] CSRF, sessão, cookies (`httpOnly`, `sameSite=lax`, `secure`), `requireAuth`, `session.regenerate`. (001)
- [ ] `?next=` só caminhos internos (`/…`, nunca `//…`) — a home já gera `/conta/entrar?next=/grupos/<slug>%23participar`. (001, 002)
- [ ] Rate limit em `/conta/entrar` e `/conta/criar`. (001)
- [ ] Ao montar body-parser: `limit` explícito em `express.urlencoded` (o `errorHandler` já trata 400/413). (001)
- [ ] Excluir conta: cascata e sessão destruída. (001)
- [ ] `connect-pg-simple` com `createTableIfMissing: false` (tabela vem da migration 005). (003)
- [ ] `SESSION_SECRET=` vazio é aceito em dev/test; conferir quando o `express-session` entrar. (003)

## M8 — Produção
- [ ] helmet + CSP (`self`, fonts.googleapis.com, fonts.gstatic.com). `style="--z:…"`, `style="font-size:14px"` e o `extra` do 404/500 exigem `style-src-attr 'unsafe-inline'` ou classes CSS. (001, 002)
- [ ] Não publicar antes de M3/M5: links da home levam a 404. (002)
- [x] Seed dos grupos demo **não roda** com `NODE_ENV=production` (ou demos removidos/despublicados antes de abrir o site). O aviso "Versão de demonstração" some sozinho quando não houver demo publicado (`hasDemo`). (conteúdo) — spec 003, CA6
- [ ] **Pergunta**: ambiente publicado (staging/preview) com grupos demo antes do M9? Hoje o seed fica bloqueado com `NODE_ENV=production` sem flag. Opções: flag explícita (ex. `ALLOW_DEMO_SEED=1`) ou staging com outro `NODE_ENV`. (003)
- [ ] Release exige `DATABASE_URL` e `SESSION_SECRET` ≥ 32 caracteres; conferir extensão `citext` no Postgres gerenciado. (003)
- [ ] `pg_advisory_lock` do migrate espera sem limite se outro migrate travar segurando o lock — avaliar `lock_timeout` no release. (003)
- [ ] `ensureTestDb` não trava host remoto (um banco remoto `*_test` passaria); decidir junto com o CI (service container). (003)
- [ ] Healthcheck `pg_isready` sem `-h` pode responder "healthy" durante o init do volume; avaliar `-h 127.0.0.1`. (003, QA)
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
