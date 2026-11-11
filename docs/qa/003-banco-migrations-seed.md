# QA — 003 Banco: Postgres local, pool, migrations 001–005 e seed dos grupos demo
Veredito: APROVADO

Data: 2026-11-11 · `main` com o diff no working tree (nada commitado) · Windows 10, Node 22.23, Docker com `postgres:16` (16.15, Debian).

## Ambiente
- `npm ci`: ok. `npm audit --omit=dev`: 0 vulnerabilidades. `npm ls pg`: `pg@8.23.1`.
- Do zero, duas vezes: `docker compose down -v` → `npm run db:up` → `npm run migrate` 2x → `npm run seed` 2x → `NODE_ENV=production npm run seed` → `npm test` → `npm run lint`. Na segunda vez, `db:up && migrate` rodaram encadeados, logo um depois do outro, e não houve corrida.
- Também testei com o banco fora do ar, nos dois casos: volume removido (porta fechada) e container parado (`docker compose stop db`).
- Não existe `.env`, então valeram os defaults de dev do `env.js`.
- Não há relatórios 003 em `docs/reports/`. Usei o resumo das etapas Coder, Cleaner e Hardener que o orquestrador passou.
- Estado final: container `db` saudável em `127.0.0.1:5432`. `pace_paulista` está com 5 migrations e 11 grupos. `pace_paulista_test` também tem 5 migrations.

| Critério | Resultado | Evidência |
|---|---|---|
| CA1 — `db:up` em volume limpo espera o healthy; existem os 2 bancos | ✅ | `npm run db:up` saiu com código 0 em 8,3 s, depois de `Container … Healthy`. `pg_database` tem `pace_paulista` e `pace_paulista_test`. Imagem `postgres:16` (Debian 16.15) |
| CA2 — `migrate` aplica 001…005 em ordem; 2ª vez não muda nada | ✅ | Saída literal: `Aplicada 001_extensions.sql` … `Aplicada 005_sessions.sql`, depois `Banco localhost:5432/pace_paulista: 5 migration(s) aplicada(s).`. Na 2ª execução: `Banco localhost:5432/pace_paulista já está em dia (5 migrations).`, código 0 |
| CA3 — tabelas, `schema_migrations` com checksum, citext, índices | ✅ | O `psql` mostra as tabelas `groups`, `memberships`, `schema_migrations`, `session` e `users`. `schema_migrations` tem 5 linhas com checksum de 64 hex, igual ao `sha256sum` de cada arquivo. Extensão `citext` 1.6. Índices `groups_zone_idx`, `groups_days_idx`, `memberships_group_idx` e `IDX_session_expire` presentes. Comparei por script os 5 `.sql` com os blocos da spec: **idênticos** byte a byte, inclusive `contact TEXT` sem `NOT NULL` (no banco, `is_nullable = YES`) |
| CA4 — seed 11/0, continuam 11 linhas | ✅ | `Seed: 11 de 11 grupos demo inseridos (0 já existiam).`, depois `Seed: 0 de 11 grupos demo inseridos (11 já existiam).`. `count(*)` = 11, e continua 11 depois do `npm test`, ou seja, os testes não tocam o banco de dev |
| CA5 — dados iguais a `DEMO_GROUPS`/§7; demo, publicados, sem dono e sem contato | ✅ | Script compara as 11 linhas do banco com o array `DEMO` de `docs/prototipo.html`, em 19 colunas (slug…map_pin, is_demo, status, owner_id, contact): **0 diferenças**. Paces, dias, horários e participantes conferidos também contra a tabela da §7. `pace-da-oca`: descrição, `meeting_point`, `profile_tags`, `10 a 14 km` e `{200,246}` literais. Os 11 com `is_demo AND status='published' AND owner_id IS NULL AND contact IS NULL` |
| CA6 — seed em produção bloqueado, código ≠ 0, sem query | ✅ | `NODE_ENV=production npm run seed` mostra `Seed de demonstração bloqueado em produção (NODE_ENV=production).`, código 1. A mesma mensagem aparece com o Postgres fora do ar e com `DATABASE_URL` apontando para a porta 1. Se houvesse tentativa de conexão, a mensagem seria a de conexão. `main()` retorna antes de importar `env.js`/`pool.js`, por causa dos imports dinâmicos (desvio intencional). `seed-guard.test.js`: o Proxy do pool não é tocado |
| CA7 — CHECKs, tipos, nome repetido; aceita sem `contact` | ✅ | `schema.test.js` tem 17 casos verdes (10× `23514`, `22P02`, `25:00` → `22008`, `23505` em `PACE DA OCA`, limites 30/400 aceitos, `contact` omitido e `NULL` aceitos com `IS NULL`). Confirmei à mão no `psql` (transação com ROLLBACK no banco de teste): `groups_zone_check`/`groups_days_check` → 23514, `"330.5"` → 22P02, `"25:00"` → 22008, `groups_name_key` → 23505 |
| CA8 — excluir usuário: cascata nas memberships e `owner_id` NULL | ✅ | Teste verde. No `psql`, `DELETE FROM users` deixou `owner=NULL`, `members=0` |
| CA9 — migration alterada falha sem aplicar nada; 2 execuções simultâneas → 5 linhas | ✅ | Testes verdes: imutabilidade com uma `006` pendente que não é criada, arquivo ausente, nome inválido, número repetido, falha parcial com ROLLBACK, `Promise.all` de 2 `runMigrations`. Pela CLI: adulterei o checksum de `005` em `schema_migrations`, e `npm run migrate` respondeu `A migration 005_sessions.sql foi alterada depois de aplicada. Migrations são imutáveis: crie uma nova.`, código 1. Depois restaurei o valor, e o migrate seguinte voltou a dizer "já está em dia" |
| CA10 — `tx`: COMMIT/ROLLBACK, mesmo erro, conexão volta | ✅ | `pool.test.js` tem 5 testes verdes: commit visível de outra conexão, rollback com `toBe(error)` e `code` preservado, `23502` do próprio SQL, ROLLBACK que falha e descarta a conexão (`release(rollbackError)`, novo teste do Hardener), e 20 transações com erro deixando `idleCount === totalCount` com `SELECT 1` ok |
| CA11 — `parseEnv` em produção | ✅ | `env.test.js` verde. À mão: prod válido passa. Sem `DATABASE_URL` e com `mysql:` → `DATABASE_URL`. Segredo ausente, com 31 caracteres, igual ao placeholder ou igual ao default de dev → `SESSION_SECRET`. URL sem banco → `DATABASE_URL`. Nenhuma mensagem contém a senha (`SENHA_X`) nem o segredo |
| CA12 — pool padrão = `DATABASE_URL_TEST`; recusa banco sem `_test` | ✅ | `helpers.test.js` verde: `pool.options.connectionString === env.DATABASE_URL_TEST` e `current_database()` termina em `_test`. Contra o banco `postgres`: `Recusado: o banco postgres não termina em _test, e os testes apagam dados.`. `3D000`: mensagem com o `createdb`. `env.js` também recusa `DATABASE_URL_TEST` com o mesmo `host:porta/banco` da `DATABASE_URL`, mesmo com outra credencial ou protocolo (`postgresql://x:y@localhost/pace_paulista`) |
| CA13 — Postgres parado: `npm test` falha rápido com a mensagem; subconjunto sem banco passa | ✅ | Testei com o volume removido e com o container parado. A suíte inteira levou 8,1 s (10,5 s de relógio); só `tests/db`, 2,3 s. Os 5 arquivos de banco falham com `Postgres de teste indisponível em localhost:5432/pace_paulista_test. Rode npm run db:up e tente de novo (sem banco: npx vitest run tests/domain tests/http tests/scripts).` e nenhum é pulado em silêncio. `npx vitest run tests/domain tests/http tests/scripts`: 12 arquivos, 177/0. `migrate` e `seed`: `Não foi possível conectar ao Postgres em localhost:5432/pace_paulista. Ele está de pé? Rode npm run db:up.`, código 1. Timeout real (`10.255.255.1`): mesma mensagem em 5,3 s |
| CA14 — sem mudança visível no site | ✅ | Nenhuma mudança em `src/views`, `public/`, `src/modules`, `src/middlewares`, `app.js`, `server.js` nem `tests/http` (`git diff HEAD` vazio). Com o Postgres **parado**, subi `PORT=3311 npm run dev` e, ao lado, uma cópia de `HEAD` (via `git archive`) na porta 3312. `GET /` (200, 21551 bytes) e `GET /x404` (404, 4708 bytes) são **byte a byte idênticos** entre as duas versões. O 404 tem o título "Página não encontrada · Pace Paulista", "Esse endereço não existe." e "Voltar ao início". Hero `11 / 5 / 4:00–8:30`. `app.css`/`app.js` 200. Como o HTML não mudou, sem JS e 360 px continuam como no QA 002 |
| CA15 — sem SQL em `src/`; SQL parametrizado; sem URL/segredo em log | ✅ | `grep -rnE "SELECT\|INSERT\|UPDATE\|DELETE\|BEGIN\|COMMIT\|ROLLBACK" src/` só encontra `src/db/pool.js` (BEGIN/COMMIT/ROLLBACK). Nada em `src/` importa `pool.js` ou `pg`. Em `scripts/` e `tests/`, todo dado vai em `$n`. O único SQL montado em `schema.test.js` usa nomes de coluna das chaves fixas do próprio teste. Os logs da CLI só mostram `<alvo>` ou a mensagem do Postgres. Com senha errada, a saída é `password authentication failed for user "pace"`, sem a senha. `docker compose logs db` não traz senha |
| CA16 — `npm test` e `npm run lint` passam; só `pg` novo | ✅ | 215/0 em 17 arquivos, com o banco de pé, nas duas rodadas do zero. Lint: ESLint sem erros e "All matched files use Prettier code style!" (o `docker-compose.yml` está incluído). A única dependência nova em `package.json` é `pg ^8.23.1` |

Testes: 215 passaram / 0 falharam (17 arquivos) · Lint: ok

## Mudanças pós-Coder conferidas
- **`isMain` por realpath**: criei uma junction para a raiz do projeto no scratchpad e rodei `node <junction>/scripts/migrate.js` e `seed.js`. Os dois executam e imprimem o resumo; não terminam em silêncio. Há teste com junction em `cli.test.js`.
- **Falha de conexão**: só `ECONNREFUSED` (inclusive o `AggregateError` do `::1` + `127.0.0.1`, que traz `code` no agregado) ou as 2 mensagens exatas do pg-pool. Lock/statement timeout não são confundidos com banco fora do ar (testes verdes).
- **migrate com ROLLBACK que falha**: preserva `Falha na migration <arquivo>: <erro original>` e descarta a conexão (`migrate-errors.test.js`).
- **`127.0.0.1:5432:5432`** em vez de `"5432:5432"`: diverge do texto literal da spec, mas **não afeta nenhum CA**. A porta no host é a mesma. `localhost` nas URLs funciona porque o Node 22 tenta `::1` (recusado) e cai em `127.0.0.1`. `docker compose exec` não depende da porta. Foi verificado nos CA1–CA16. A divergência deixa o ambiente mais seguro, porque a senha `pace/pace` não fica exposta na rede.
- **`env.js` por host:porta/banco**: confirmado no CA12.

## Regressão
- Home e 404 idênticos byte a byte ao `HEAD`, com o banco fora do ar (CA14). Os testes HTTP existentes passam sem alteração.
- `/grupos` com filtro e detalhe de grupo: não se aplica (M3).

## Problemas encontrados
Nenhum bloqueante.

## Sugestões não bloqueantes
1. **Ruído no CA13**: com o banco fora do ar, os `afterAll` de `pool.test.js` (`DROP TABLE tx_probe`) e de `migrate.test.js` (`runMigrations`) acrescentam um `connect ECONNREFUSED` cru depois da mensagem boa. A mensagem certa aparece em todos os arquivos, mas o relatório fica poluído. Dá para pular o hook quando o `beforeAll` falhou.
2. **Healthcheck durante o init**: `pg_isready` sem `-h` usa o socket Unix, e o servidor temporário do entrypoint (o que roda o `docker-init`) também atende nesse socket. Em máquina lenta, o `db:up` pode ficar "healthy" antes do restart final, e um `migrate` imediato receberia `ECONNREFUSED`. Não reproduzi em 2 rodadas do zero. Se acontecer, usar `pg_isready -h 127.0.0.1 …`, o que exige mudar a spec.
3. Com `NODE_ENV=production` e ambiente inválido, `node scripts/migrate.js` mostra o stack do `parseEnv`, não só a mensagem. Não vaza valores, e o comportamento vem do `env.js` da 001.
4. Erros de autenticação e de banco inexistente na CLI (`password authentication failed…`, `database "nao_existe" does not exist`) não dizem o `<alvo>`. Seria útil prefixar com `Banco <alvo>:`.
5. `sameDatabase` compara o host como texto: `localhost` e `127.0.0.1` passam como bancos diferentes. A trava `_test` do helper cobre esse caso nos testes.

## Pendências para os próximos marcos
- **Orquestrador (docs)**: `CLAUDE.md` §4 ainda diz `contact TEXT NOT NULL` (decisão de produto: `contact TEXT,`). A §10 precisa de `DATABASE_URL_TEST` no `.env.example` e de `db:up` com `--wait`. Vale registrar também a publicação em `127.0.0.1` do compose, que diverge do texto da spec 003.
- **M3**: `id` (BIGINT) volta como string (confirmado: `typeof id === 'string'`) e `start_time` volta como `'06:30:00'`. Decidir `::int`/`setTypeParser` e testar `fmtHora('06:30:00')`. A home passa a ler do banco e, a partir daí, o `npm run dev` precisa do Postgres.
- **M5**: `connect-pg-simple` com `createTableIfMissing: false`. A tabela `session` já existe pela 005.
- **M8**: em produção, `npm start` **e** `npm run migrate` exigem `DATABASE_URL` e `SESSION_SECRET` forte (≥ 32 caracteres), porque ambos importam `env.js`. O ambiente de release precisa das duas. Continua em aberto a pergunta 1 da spec (seed de demo em staging com `NODE_ENV=production`). Conferir `CREATE EXTENSION citext` no Postgres gerenciado.
