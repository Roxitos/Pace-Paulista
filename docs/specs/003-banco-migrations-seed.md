# 003 — Banco: Postgres local, pool, migrations 001–005 e seed dos grupos demo
Marco: M2 · Status: pronta para Coder
Depende de: 001-scaffold-base, 002-home-estatica

## Objetivo
Pôr o PostgreSQL 16 de pé com `docker compose`, criar o acesso ao banco (`src/db/pool.js` com `tx(fn)`), o executor de migrations (`scripts/migrate.js` + `schema_migrations`), as migrations 001–005 do `AGENTS.md` §4 e o seed idempotente dos 11 grupos demo, reaproveitando `db/seeds/demo-groups.js`. **Pronto quando** `migrate` e `seed` rodam duas vezes sem efeito na segunda e um teste lê os 11 grupos do banco.

## Fora do escopo
- Ler grupos do banco nas páginas: a home continua usando `DEMO_GROUPS` até o M3. Nenhum `*.repo.js` é criado nesta spec, e `src/` não importa `pool.js` ainda.
- `express-session`, `connect-pg-simple`, `bcrypt` (M5). Aqui só se cria a **tabela** `session`; as dependências não são instaladas.
- Migrations "down"/rollback, `CREATE INDEX CONCURRENTLY`, trigger de `updated_at`.
- SSL/conexão com Postgres gerenciado, deploy, CI (M8).
- Verificar conexão com o banco na subida do servidor ou endpoint de health.
- Conversão de tipos do `pg` (BIGINT e `COUNT` voltam como string): decidir no M3, quando houver leitura (ver Riscos).
- Formulário de cadastro de grupo e seu schema zod (M4/M6): **não muda**. Para grupos cadastrados por usuários, `contato` continua obrigatório com a regra do `AGENTS.md` §6 (≥ 3 caracteres, mensagem "Informe um contato público do grupo."). Só o banco aceita `contact` NULL (ver "Decisões de produto").
- Exibir o contato na página do grupo (M3), inclusive o que mostrar quando `contact` é NULL.

## Decisões de produto
- **`contact` opcional no banco** (decisão do usuário, 2026-11-11, resposta à pergunta sobre o contato dos grupos demo): em `003_groups.sql`, `contact` é `TEXT` **sem** `NOT NULL`. Os 11 grupos demo ficam com `contact = NULL`; `DEMO_GROUPS` não ganha o campo.
  - **Diverge do `AGENTS.md`/`CLAUDE.md` §4** (`contact TEXT NOT NULL`). Como as migrations ainda não foram commitadas, a mudança entra direto na 003, sem migration nova. **Orquestrador: atualizar o DDL do §4** para `contact TEXT,` com o mesmo comentário.
  - A obrigatoriedade para grupos reais fica na validação do formulário (M4/M6), não no banco.

## Mudanças

### Dependências
- Adicionar **`pg`** (`^8`) em `dependencies`. Justificativa no PR: driver oficial node-postgres exigido pelo `AGENTS.md` §2 (SQL à mão, sem ORM). Nenhuma outra dependência.

### Arquivos de raiz
- **`docker-compose.yml`** (novo; precisa passar no `prettier --check`):
  - Serviço `db`, imagem **`postgres:16`** (Debian; não usar `-alpine`: a collation do musl ordena nomes acentuados diferente do Postgres gerenciado, e o M3 ordena por nome).
  - `environment`: `POSTGRES_USER=pace`, `POSTGRES_PASSWORD=pace`, `POSTGRES_DB=pace_paulista` (iguais ao `.env.example`).
  - `ports`: `"5432:5432"`.
  - `volumes`: volume nomeado `pgdata` → `/var/lib/postgresql/data`; e `./db/docker-init:/docker-entrypoint-initdb.d:ro`.
  - `healthcheck`: `pg_isready -U pace -d pace_paulista`, `interval: 2s`, `timeout: 3s`, `retries: 15`.
- **`db/docker-init/001-create-test-db.sql`** (novo): `CREATE DATABASE pace_paulista_test;` — roda só na primeira criação do volume (comportamento da imagem oficial). Se o volume já existir, o helper de teste orienta a criar à mão (ver "Regras e mensagens").
- **`.env.example`**: manter as 5 variáveis e acrescentar ao final:
  ```
  DATABASE_URL_TEST=postgres://pace:pace@localhost:5432/pace_paulista_test
  ```
- **`package.json`** — scripts novos:
  | script | comando |
  |---|---|
  | `db:up` | `docker compose up -d --wait db` (o `--wait` espera o healthcheck; evita `migrate` antes do Postgres aceitar conexão) |
  | `migrate` | `node scripts/migrate.js` |
  | `seed` | `node scripts/seed.js` |
- **`vitest.config.js`**: acrescentar `env: { NODE_ENV: 'test' }` e `fileParallelism: false` (os testes de banco compartilham um único banco de teste e fazem `TRUNCATE`; em paralelo, um arquivo apagaria os dados do outro).
- **`README.md`**: em "Como rodar", trocar o bloco por `npm install`, `cp .env.example .env`, `npm run db:up`, `npm run migrate`, `npm run seed`, `npm run dev`; acrescentar `db:up`, `migrate`, `seed` na tabela de comandos; dizer que `npm test` precisa do Postgres de pé (`npm run db:up`) e que `docker compose down -v` apaga o banco local para recomeçar do zero. Não mudar a tabela de status (isso é do orquestrador).

### Configuração — `src/config/env.js`
Continua exportando `parseEnv(source)` (pura) e `env`. Mesmo formato de erro atual: `Variáveis de ambiente inválidas: <NOMES>` — **nunca** incluir o valor (URL tem senha; segredo é segredo).

| Variável | development / test | production |
|---|---|---|
| `DATABASE_URL` | opcional, default `postgres://pace:pace@localhost:5432/pace_paulista` | **obrigatória** |
| `DATABASE_URL_TEST` | opcional, default `postgres://pace:pace@localhost:5432/pace_paulista_test` | opcional, mesmo default |
| `SESSION_SECRET` | opcional, default `dev-inseguro-nao-usar-em-producao` | **obrigatória e forte** (abaixo) |

- URL de banco válida = `new URL(v)` não lança, protocolo `postgres:` ou `postgresql:`, `hostname` não vazio e nome do banco (`pathname` sem a `/`) não vazio. Vale para as duas URLs.
- `DATABASE_URL_TEST` igual a `DATABASE_URL` → inválida (lista `DATABASE_URL_TEST`): impede os testes de apagarem o banco de desenvolvimento.
- `SESSION_SECRET` forte (só em production): ≥ 32 caracteres, diferente de `troque-por-uma-string-longa-e-aleatoria` (placeholder do `.env.example`) e diferente do default de desenvolvimento.
- Funções puras novas, exportadas:
  - `connectionStringFor(env)` → `env.NODE_ENV === 'test' ? env.DATABASE_URL_TEST : env.DATABASE_URL`.
  - `describeDatabaseUrl(url)` → `"host:porta/banco"` sem usuário/senha (porta omitida na URL → `5432`). Ex.: `postgres://pace:pace@localhost:5432/pace_paulista` → `localhost:5432/pace_paulista`. Usado em todo log/mensagem que precise dizer qual banco é o alvo.

### Banco — `src/db/pool.js` (novo)
- `createPool(connectionString)` → `new pg.Pool({ connectionString, connectionTimeoutMillis: 5000 })` e registra `pool.on('error', …)` que faz `console.error('Erro inesperado em conexão ociosa do Postgres:', err.message)` (sem isso, uma conexão ociosa derrubada mata o processo).
- `pool` → `createPool(connectionStringFor(env))`. É preguiçoso: importar o módulo não abre conexão.
- `tx(fn, targetPool = pool)`:
  1. `client = await targetPool.connect()`; `BEGIN`.
  2. `result = await fn(client)`; `COMMIT`; devolve `result`.
  3. Se `fn` ou o `COMMIT` lançar: `ROLLBACK` e relança **o mesmo erro** (preserva `err.code`, ex. `23505`, para o service traduzir). Se o `ROLLBACK` também falhar, a conexão é descartada (`client.release(err)`), não devolvida ao pool.
  4. `finally`: `client.release()` (uma única vez).

### Migrations — `db/migrations/` (novas; DDL **idêntico** ao `AGENTS.md` §4, exceto `contact` opcional — ver "Decisões de produto")
Nenhum arquivo tem `BEGIN`/`COMMIT` próprio: o executor envolve cada um numa transação.

`001_extensions.sql`
```sql
CREATE EXTENSION IF NOT EXISTS citext;
```

`002_users.sql`
```sql
CREATE TABLE users (
  id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email          CITEXT NOT NULL UNIQUE,
  password_hash  TEXT   NOT NULL,
  display_name   TEXT   NOT NULL CHECK (char_length(display_name) BETWEEN 2 AND 40),
  role           TEXT   NOT NULL DEFAULT 'user' CHECK (role IN ('user','admin')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

`003_groups.sql`
```sql
CREATE TABLE groups (
  id                 BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  slug               TEXT    NOT NULL UNIQUE,
  name               CITEXT  NOT NULL UNIQUE CHECK (char_length(name) BETWEEN 3 AND 50),
  zone               TEXT    NOT NULL CHECK (zone IN ('norte','oeste','centro','leste','sul')),
  location           TEXT    NOT NULL CHECK (char_length(location) BETWEEN 3 AND 80),
  meeting_point      TEXT    NOT NULL DEFAULT 'Combinado no grupo',
  days               TEXT[]  NOT NULL CHECK (cardinality(days) >= 1
                       AND days <@ ARRAY['seg','ter','qua','qui','sex','sab','dom']),
  start_time         TIME    NOT NULL,
  pace_min_s         INT     NOT NULL CHECK (pace_min_s BETWEEN 180 AND 720),
  pace_max_s         INT     NOT NULL CHECK (pace_max_s BETWEEN 180 AND 720),
  distance           TEXT,
  level              TEXT    NOT NULL CHECK (level IN ('iniciante','intermediario','avancado')),
  base_participants  INT     NOT NULL DEFAULT 1 CHECK (base_participants BETWEEN 1 AND 999),
  description        TEXT    NOT NULL CHECK (char_length(description) BETWEEN 30 AND 400),
  profile_tags       TEXT[]  NOT NULL DEFAULT ARRAY['Novo na plataforma'],
  contact            TEXT,   -- opcional: NULL nos grupos demo; o form de cadastro continua exigindo
  is_demo            BOOLEAN NOT NULL DEFAULT false,
  status             TEXT    NOT NULL DEFAULT 'published'
                       CHECK (status IN ('pending','published','rejected')), -- moderação: v2
  owner_id           BIGINT  REFERENCES users(id) ON DELETE SET NULL,     -- NULL nos grupos demo
  map_pin            INT[],  -- [x,y] no SVG esquemático; NULL = calcular pela zona
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (pace_min_s < pace_max_s)
);
CREATE INDEX groups_zone_idx  ON groups (zone)  WHERE status = 'published';
CREATE INDEX groups_days_idx  ON groups USING GIN (days);
```

`004_memberships.sql`
```sql
CREATE TABLE memberships (
  user_id    BIGINT NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
  group_id   BIGINT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  nickname   TEXT   NOT NULL CHECK (char_length(nickname) BETWEEN 2 AND 40),
  joined_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, group_id)
);
CREATE INDEX memberships_group_idx ON memberships (group_id);
```

`005_sessions.sql` — schema oficial do `connect-pg-simple` (`table.sql` do pacote), sem a cláusula obsoleta `WITH (OIDS=FALSE)` (sem efeito desde o PG 12):
```sql
CREATE TABLE "session" (
  "sid" varchar NOT NULL COLLATE "default",
  "sess" json NOT NULL,
  "expire" timestamp(6) NOT NULL
);
ALTER TABLE "session" ADD CONSTRAINT "session_pkey" PRIMARY KEY ("sid") NOT DEFERRABLE INITIALLY IMMEDIATE;
CREATE INDEX "IDX_session_expire" ON "session" ("expire");
```
(No M5, o `connect-pg-simple` deve usar `createTableIfMissing: false`: a tabela é da migration.)

**Pendência M2 "CHECKs garantem zone, level, days, start_time e pace inteiro 180–720"**: o DDL acima já cobre — `zone`/`level` por `IN`, `days` por `cardinality >= 1` e `<@`, `start_time` pelo tipo `TIME`, pace pelo tipo `INT` + `BETWEEN` + `pace_min_s < pace_max_s`. Nada é acrescentado ao DDL; os testes de esquema abaixo provam cada um.

### Executor — `scripts/migrate.js` (novo)
- Exporta `runMigrations({ pool, dir = <raiz>/db/migrations, log = () => {} })` → `Promise<{ applied: string[], total: number }>` (`applied` = arquivos aplicados nesta execução, em ordem; `total` = migrations no diretório).
- Passos (tudo numa única conexão dedicada do `pool`):
  1. `SELECT pg_advisory_lock(<constante inteira fixa>)` — duas execuções simultâneas (dois deploys, dois arquivos de teste) não aplicam a mesma migration duas vezes. `pg_advisory_unlock` + `release` no `finally`.
  2. `CREATE TABLE IF NOT EXISTS schema_migrations (filename TEXT PRIMARY KEY, checksum TEXT NOT NULL, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())`.
  3. Lê `dir`: considera só arquivos `.sql`; todo `.sql` precisa casar `^\d{3}_[a-z0-9_]+\.sql$`, senão erro; número `NNN` repetido → erro. Ordena por nome.
  4. `checksum` = SHA-256 (hex) do conteúdo do arquivo (o `.gitattributes` garante LF, então o hash é o mesmo em Windows e Linux).
  5. Para cada migration já registrada: arquivo ausente → erro; checksum diferente → erro (garante a regra "migrations são imutáveis"). Essas verificações acontecem **antes** de aplicar qualquer pendente.
  6. Para cada pendente, em ordem: `BEGIN`; executa o SQL do arquivo (query sem parâmetros, permite vários comandos); `INSERT INTO schema_migrations (filename, checksum) VALUES ($1, $2)`; `COMMIT`; `log('Aplicada <arquivo>')`. Falha → `ROLLBACK` dessa migration, para, e lança erro (as anteriores continuam aplicadas).
- Bloco CLI (só quando executado direto: `import.meta.url === pathToFileURL(process.argv[1]).href`): cria pool com `createPool(connectionStringFor(env))`, chama `runMigrations` com `log = console.log`, imprime o resumo, `pool.end()`. Erro → imprime só a mensagem (sem stack) em `stderr`, `pool.end()`, `process.exitCode = 1`.

### Seed — `scripts/seed.js` (novo)
- Exporta `runSeed({ pool, nodeEnv, groups = DEMO_GROUPS })` → `Promise<{ inserted: number, total: number }>`.
  - **Primeira linha**: se `nodeEnv === 'production'`, lança o erro de bloqueio **sem tocar no banco**.
  - Dentro de um único `tx(…, pool)`: para cada grupo, `INSERT INTO groups (slug, name, zone, location, meeting_point, days, start_time, pace_min_s, pace_max_s, distance, level, base_participants, description, profile_tags, map_pin, is_demo, status) VALUES ($1 … $17) ON CONFLICT (slug) DO NOTHING`, com `status = 'published'`, `owner_id` e `contact` omitidos (ficam NULL). `inserted` = soma dos `rowCount`.
  - Dados **só** de `db/seeds/demo-groups.js` (`DEMO_GROUPS`); nada de array duplicado.
- **`contact`** dos 11 demo fica **NULL** (ver "Decisões de produto"). Não acrescentar `contact` a `DEMO_GROUPS` nem ao `demo-groups.test.js`.
- Bloco CLI (mesmo padrão do migrate): `runSeed({ pool, nodeEnv: env.NODE_ENV })`, imprime o resumo. Erro `42P01` (tabela inexistente) → mensagem pedindo `npm run migrate`; demais → mensagem do erro; `exitCode = 1`.
- **Bloqueio em produção já no M2** (item do M8 em `PENDENCIAS.md`): custa uma linha, e o próprio M2 cria o script que poderia ser incluído por engano no comando de release (`npm run migrate && npm run seed`) no primeiro deploy. Sem flag para contornar (ver Pergunta em aberto 1).

### SQL fora de `*.repo.js`
A regra "SQL só em `*.repo.js`" vale para `src/`. `scripts/` (migrate, seed) e `tests/` são infraestrutura e podem ter SQL — sempre parametrizado quando houver dado.

### Helper de testes — `tests/helpers/db.js` (novo; não casa `*.test.js`, então não é coletado como teste)
- `ensureTestDb(pool)`: `SELECT current_database()` com o pool padrão (que em `NODE_ENV=test` aponta para `DATABASE_URL_TEST`).
  - Conexão recusada/timeout → lança a mensagem "Postgres de teste indisponível…".
  - Código `3D000` (banco não existe) → lança a mensagem "Banco de teste não existe…".
  - Nome do banco não termina em `_test` → lança "Recusado…" (trava contra apagar dados reais).
- `resetSchema(pool)`: `ensureTestDb` + `DROP SCHEMA public CASCADE; CREATE SCHEMA public;`.
- `truncateAll(pool)`: `ensureTestDb` + `TRUNCATE memberships, groups, users, "session" RESTART IDENTITY CASCADE`.
- Cada arquivo de teste de banco: `beforeAll` → `ensureTestDb` + `runMigrations({ pool })` (idempotente, então não precisa de `migrate` manual no banco de teste); `afterAll` → `pool.end()`.
- **Postgres fora do ar**: os testes de banco **falham** (não são pulados) com a mensagem acima. Motivo: a definição de pronto exige `npm test` verde com o banco; pular em silêncio daria falso verde. Quem estiver sem Docker roda o subconjunto sem banco com `npx vitest run tests/domain tests/http tests/scripts`. Graças ao `connectionTimeoutMillis: 5000`, a falha é rápida (não trava a suíte).

## Regras e mensagens

| Onde | Situação | Mensagem exata (pt-BR) |
|---|---|---|
| `env.js` | qualquer variável inválida | `Variáveis de ambiente inválidas: <NOME1>, <NOME2>` (formato atual; nunca o valor) |
| `env.js` | production sem `DATABASE_URL` / URL inválida / `SESSION_SECRET` fraco | idem, listando `DATABASE_URL` e/ou `SESSION_SECRET` |
| `env.js` | `DATABASE_URL_TEST` igual a `DATABASE_URL` | idem, listando `DATABASE_URL_TEST` |
| migrate | migration aplicada | `Aplicada <arquivo>` |
| migrate | fim, com aplicadas | `Banco <alvo>: <n> migration(s) aplicada(s).` |
| migrate | fim, nada pendente | `Banco <alvo> já está em dia (<total> migrations).` |
| migrate | nome fora do padrão | `Nome de migration inválido: <arquivo> (use NNN_nome.sql).` |
| migrate | número repetido | `Número de migration repetido: <NNN>.` |
| migrate | arquivo aplicado sumiu | `A migration <arquivo> consta como aplicada, mas não existe em db/migrations.` |
| migrate | checksum diferente | `A migration <arquivo> foi alterada depois de aplicada. Migrations são imutáveis: crie uma nova.` |
| migrate | SQL falhou | `Falha na migration <arquivo>: <mensagem do Postgres>` |
| seed | fim | `Seed: <inserted> de <total> grupos demo inseridos (<total-inserted> já existiam).` |
| seed | `NODE_ENV=production` | `Seed de demonstração bloqueado em produção (NODE_ENV=production).` |
| seed | `42P01` | `Tabela groups não encontrada. Rode npm run migrate antes do seed.` |
| migrate/seed | conexão recusada (`ECONNREFUSED`) | `Não foi possível conectar ao Postgres em <alvo>. Ele está de pé? Rode npm run db:up.` |
| testes | Postgres fora do ar | `Postgres de teste indisponível em <alvo>. Rode npm run db:up e tente de novo (sem banco: npx vitest run tests/domain tests/http tests/scripts).` |
| testes | `3D000` | `Banco de teste não existe em <alvo>. Crie com: docker compose exec db createdb -U pace pace_paulista_test` |
| testes | banco sem sufixo `_test` | `Recusado: o banco <nome> não termina em _test, e os testes apagam dados.` |

`<alvo>` = `describeDatabaseUrl(url)` (ex.: `localhost:5432/pace_paulista`); nunca a URL completa.

## Critérios de aceite
- [ ] CA1 — Dado um volume limpo (`docker compose down -v`), quando rodo `npm run db:up`, então o comando só termina com o container `db` saudável, e existem os bancos `pace_paulista` e `pace_paulista_test`.
- [ ] CA2 — Dado CA1, quando rodo `npm run migrate`, então aparecem `Aplicada 001_extensions.sql` … `Aplicada 005_sessions.sql` em ordem e `Banco localhost:5432/pace_paulista: 5 migration(s) aplicada(s).`; rodando de novo, `Banco localhost:5432/pace_paulista já está em dia (5 migrations).` e nada muda.
- [ ] CA3 — Após CA2, existem as tabelas `users`, `groups`, `memberships`, `session`, `schema_migrations` (5 linhas com `checksum`), a extensão `citext` e os índices `groups_zone_idx`, `groups_days_idx`, `memberships_group_idx`, `IDX_session_expire`.
- [ ] CA4 — Dado CA2, quando rodo `npm run seed`, então `Seed: 11 de 11 grupos demo inseridos (0 já existiam).`; rodando de novo, `Seed: 0 de 11 grupos demo inseridos (11 já existiam).` e continuam 11 linhas em `groups`.
- [ ] CA5 — Os 11 grupos lidos do banco têm os mesmos `slug`, `name`, `zone`, `location`, `days`, `start_time`, `pace_min_s`, `pace_max_s`, `level`, `base_participants` de `DEMO_GROUPS` (`AGENTS.md` §7), com `is_demo = true`, `status = 'published'`, `owner_id IS NULL` e `contact IS NULL` (os 11); `pace-da-oca` mantém `description`, `meeting_point`, `profile_tags`, `distance` e `map_pin = {200,246}` literais.
- [ ] CA6 — `NODE_ENV=production npm run seed` sai com código ≠ 0, mostra `Seed de demonstração bloqueado em produção (NODE_ENV=production).` e não executa nenhuma query.
- [ ] CA7 — Os CHECKs recusam (código `23514`) zona/nível fora da lista, `days` vazio ou com dia desconhecido, pace < 180 ou > 720, `pace_min_s >= pace_max_s`, descrição com 29 ou 401 caracteres; pace não inteiro (`'330.5'`) é recusado pelo tipo (`22P02`); `start_time '25:00'` é recusado pelo tipo; nome repetido com outra caixa (`'PACE DA OCA'`) dá `23505`. Um grupo válido inserido **sem** `contact` (coluna omitida ou `NULL`) é **aceito** e fica com `contact IS NULL`.
- [ ] CA8 — Excluir um usuário apaga suas `memberships` e deixa `owner_id = NULL` nos grupos dele.
- [ ] CA9 — Alterar uma migration já aplicada faz o `migrate` falhar com a mensagem de imutabilidade, sem aplicar nada; duas execuções simultâneas de `runMigrations` num esquema vazio terminam com exatamente 5 linhas em `schema_migrations`.
- [ ] CA10 — `tx(fn)` faz `COMMIT` quando `fn` resolve (devolvendo o valor de `fn`) e `ROLLBACK` quando `fn` lança, relançando o **mesmo** objeto de erro; em ambos os casos a conexão volta ao pool (o pool continua atendendo queries depois de 20 transações com erro).
- [ ] CA11 — `parseEnv` em production recusa: sem `DATABASE_URL`, `DATABASE_URL` com protocolo `mysql:`, `SESSION_SECRET` ausente, com 31 caracteres, igual ao placeholder do `.env.example` ou igual ao default de dev; aceita um segredo aleatório de 32+ caracteres. A mensagem de erro não contém a senha da URL nem o segredo.
- [ ] CA12 — Com `NODE_ENV=test`, o pool padrão aponta para `DATABASE_URL_TEST`; os helpers de teste recusam banco cujo nome não termina em `_test`.
- [ ] CA13 — Com o Postgres parado, `npm test` falha em até ~10 s por arquivo de banco com a mensagem "Postgres de teste indisponível…"; `npx vitest run tests/domain tests/http tests/scripts` passa sem banco.
- [ ] CA14 — Sem mudança visível no site: `GET /` igual ao da spec 002 (os testes HTTP existentes passam sem alteração). Funciona sem JS e em 360 px como antes (nenhuma view/CSS alterada).
- [ ] CA15 — Nada de SQL em `src/` (`grep` por `SELECT|INSERT|UPDATE|DELETE` em `src/` só acha `src/db/pool.js` com `BEGIN/COMMIT/ROLLBACK`); todo SQL com dados em `scripts/`/`tests/` é parametrizado; nenhuma URL completa de banco ou `SESSION_SECRET` aparece em log.
- [ ] CA16 — `npm test` (com `npm run db:up`) e `npm run lint` passam; `package.json` tem só `pg` de dependência nova.

## Testes esperados
- unit (sem banco):
  - `tests/domain/env.test.js` (atualizar): `parseEnv({})` passa a devolver também `DATABASE_URL`, `DATABASE_URL_TEST` e `SESSION_SECRET` com os defaults de dev; casos do CA11; `DATABASE_URL_TEST === DATABASE_URL` recusado; `connectionStringFor` (test → URL de teste; development/production → `DATABASE_URL`); `describeDatabaseUrl` com e sem porta, sem credenciais na saída.
  - `tests/scripts/seed-guard.test.js`: `runSeed({ pool: <falso que lança se usado>, nodeEnv: 'production' })` rejeita com a mensagem exata e o pool falso nunca é chamado.
- banco (`tests/db/`, banco de teste, `beforeAll` com `ensureTestDb` + `runMigrations`):
  - `migrate.test.js`: em esquema zerado (`resetSchema`), aplica as 5 em ordem e a 2ª execução devolve `applied: []`; objetos do CA3; checksum alterado (cópia de `db/migrations` num diretório temporário com um arquivo editado) → erro de imutabilidade; nome inválido e número repetido → erro; arquivo aplicado ausente → erro; duas execuções simultâneas → 5 linhas.
  - `schema.test.js` (`truncateAll` no `beforeEach`): CA7 e CA8, conferindo `err.code`; inclui o caso positivo "aceita grupo sem contato" (insert sem `contact` → sucesso, `contact IS NULL`).
  - `pool.test.js`: CA10 (cria e remove uma tabela própria do teste para verificar visibilidade do commit/rollback a partir de outra conexão).
  - `seed.test.js`: CA4 (`inserted` 11 e depois 0, `count` 11) e CA5 (lê os 11 grupos do banco e compara com `DEMO_GROUPS`; `start_time` volta como `'06:30:00'`; `contact` é `null` nos 11); seed não sobrescreve linha existente alterada (muda `description` de um demo, roda o seed, a alteração continua).
- http: nenhum novo; os existentes devem passar inalterados (CA14).

## Riscos / perguntas em aberto

### Perguntas em aberto
1. **Ambiente publicado com grupos demo antes do M9?** (não bloqueia o M2): o seed fica bloqueado com `NODE_ENV=production`, sem flag para contornar. Se quiserem um preview/staging público com os demo (que também roda com `NODE_ENV=production`), o M8 precisa decidir como (flag explícita, ex. `ALLOW_DEMO_SEED=1`, ou staging com outro `NODE_ENV`).

### Riscos / decisões técnicas tomadas
- **Tamanho**: diff estimado em ~500 linhas, mas ~130 são DDL copiado e ~200 são testes. Se o revisor preferir, dá para quebrar em 003a (compose, env, pool, migrate, migrations + testes) e 003b (seed + testes de leitura).
- `DATABASE_URL`/`SESSION_SECRET` com default em dev/test: não existe `.env` no repositório e os testes HTTP importam `env.js`; exigir as variáveis sempre quebraria `npm test` e `npm run dev` sem `.env`. Em produção ambas são obrigatórias.
- `fileParallelism: false` deixa a suíte inteira serial. Hoje é pequena; se ficar lenta, separar em `projects` do vitest (unit em paralelo, banco em série).
- `ON CONFLICT (slug) DO NOTHING` (como manda o `AGENTS.md` §7): se já existir um grupo real com o mesmo **nome** de um demo, o seed falha com `23505` no `name`. Aceitável em dev; o seed não roda em produção.
- O seed não atualiza demos já inseridos: mudanças futuras em `DEMO_GROUPS` só chegam ao banco após `docker compose down -v` (ou `TRUNCATE`).
- `days` aceita dias repetidos (`{sab,sab}`); o DDL do `AGENTS.md` não proíbe e o form do protótipo usa checkboxes (não gera repetição). Não acrescentei CHECK para não divergir do §4.
- Tipos do `pg`: `BIGINT`/`COUNT(*)` voltam como **string** e `TIME` como `'HH:MM:SS'`. O M3 precisa decidir (`::int` na query ou `types.setTypeParser`) e testar `fmtHora('06:30:00')`.
- Porta 5432 ocupada no host (outro Postgres) faz o `db:up` falhar; hoje não há Postgres no host (sem `psql`). Se ocorrer, mudar a porta no compose e nas URLs do `.env`.
- `CREATE EXTENSION citext` exige dono do banco/superusuário (citext é "trusted" desde o PG 13); em Postgres gerenciado, conferir no M8. O `005` cria a tabela `session` antes de existir `connect-pg-simple`: no M5, usar `createTableIfMissing: false`.
- `.env.example` ganha `DATABASE_URL_TEST`: o orquestrador deve refletir isso no bloco da §10 do `AGENTS.md`/`CLAUDE.md` (o Specifier não edita esses arquivos).
- Item "Docker Desktop não inicializado" do `PENDENCIAS.md` (M2): resolvido fora da spec (`docker info` responde 29.9.3); o CA1 confirma na prática.
