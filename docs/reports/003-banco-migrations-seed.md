# Relatório — 003 Banco, migrations e seed
Marco: M2 · Spec: [`docs/specs/003-banco-migrations-seed.md`](../specs/003-banco-migrations-seed.md) · QA: [`docs/qa/003-banco-migrations-seed.md`](../qa/003-banco-migrations-seed.md)
Branch: `main` (sem commit ainda) · Data: 2026-11-11

## Linha do tempo
| Etapa | Resultado |
|---|---|
| Specifier | Spec escrita; 1 pergunta bloqueante (`contact` dos demos) respondida pelo usuário; spec revisada |
| Coder | Implementado; CA1–CA16 verificados com Postgres real; 197 testes (15 arquivos), lint ok |
| Cleaner | Limpeza pequena em testes e remoção de duplicação; sem mudança de comportamento |
| Hardener | 5 problemas corrigidos + 1 teste de cobertura; 215 testes (17 arquivos), lint ok |
| QA | **APROVADO** — 16/16 critérios, do zero, sem regressão |

## Decisões de produto
- **`contact` opcional** (usuário, 2026-11-11): `groups.contact` é `TEXT` sem `NOT NULL`; os 11 demos ficam com `contact` NULL; `DEMO_GROUPS` não muda. O formulário de cadastro (M4/M6) continua exigindo contato (≥ 3, "Informe um contato público do grupo."). `CLAUDE.md`/`AGENTS.md` §4 atualizados.
- **Seed bloqueado em produção** já no M2 (item trazido do M8): `NODE_ENV=production` → sai com código 1 antes de qualquer conexão, sem flag de contorno.

## Coder
**Novos**
- `docker-compose.yml` (`postgres:16` Debian, healthcheck, volume) e `db/docker-init/001-create-test-db.sql` (cria `pace_paulista_test`).
- `db/migrations/001_extensions.sql` … `005_sessions.sql`: DDL do §4 (exceto `contact` opcional); 005 = schema oficial do `connect-pg-simple`.
- `src/db/pool.js`: `createPool`, `pool` preguiçoso, `tx(fn, pool)`.
- `scripts/migrate.js`: `runMigrations` com `schema_migrations`, advisory lock, uma transação por migration, nome `NNN_nome.sql`, checksum SHA-256 (migration aplicada alterada/apagada → falha).
- `scripts/seed.js`: `runSeed`, `INSERT … ON CONFLICT (slug) DO NOTHING` em transação, bloqueio em produção.
- `scripts/cli.js`: `isMain`, `cliErrorMessage`, `isConnectionFailure` (fora da spec; ver Observações).
- Testes: `tests/helpers/db.js`, `tests/scripts/seed-guard.test.js`, `tests/db/{migrate,schema,pool,seed,helpers}.test.js`.

**Alterados**
- `src/config/env.js`: valida `DATABASE_URL`/`DATABASE_URL_TEST` (`postgres:`/`postgresql:`), `SESSION_SECRET` forte em produção (≥ 32, ≠ placeholder/default), recusa banco de teste = banco de dev; mensagens nunca mostram valores. `connectionStringFor`, `describeDatabaseUrl`.
- `package.json` (só `pg ^8.23.1` novo; scripts `db:up`, `migrate`, `seed`), `vitest.config.js` (`NODE_ENV=test`, `fileParallelism: false`), `.env.example`, `README.md`, `tests/domain/env.test.js`.

**Observações**
- `seed.js` não importa `env.js`/`pool.js` estaticamente: em produção sem variáveis, importar `env.js` lançaria antes da mensagem de bloqueio (CA6). Por isso os helpers de CLI ficam em `scripts/cli.js`.
- Testes de banco recusam rodar se o banco não terminar em `_test`; com o Postgres parado falham rápido (5 s) com mensagem clara, em vez de serem pulados.

## Cleaner
- `scripts/cli.js`: `isConnectionFailure` exportada; `tests/helpers/db.js` deixou de ter cópia idêntica.
- `tests/helpers/db.js`: novo `migrateTestDb(pool)`; `beforeAll` de `schema`, `seed` e `pool` usam ele.
- Mantidos de propósito: imports dinâmicos do seed (CA6), `main()` de migrate/seed sem helper comum (importaria `env.js`).

## Hardener
| Problema | Severidade | Correção | Teste |
|---|---|---|---|
| `migrate`/`seed` não faziam nada (exit 0, silêncio) quando chamados por caminho com symlink/junction — deploy subiria sem migrations | média | `isMain` compara `realpathSync.native` dos dois caminhos | `tests/scripts/cli.test.js` |
| Regex `/timeout/i` mascarava erros reais (lock/statement timeout) como "Não foi possível conectar" | média | Só `ECONNREFUSED` ou as 2 mensagens exatas do pg-pool | `tests/scripts/cli.test.js` |
| No migrate, falha do ROLLBACK/unlock substituía o erro da migration; conexão possivelmente com lock voltava ao pool | média | Erro original preservado ("Falha na migration X: …"); unlock pulado se a conexão quebrou; `release(err)` descarta | `tests/scripts/migrate-errors.test.js` |
| Postgres de dev publicado em `0.0.0.0`/`[::]` com `pace`/`pace` | média | `127.0.0.1:5432:5432` (diverge do texto da spec; mesma porta, CA1 intacto) | `docker ps` + suíte verde |
| `DATABASE_URL_TEST === DATABASE_URL` comparava texto (bastava `postgresql:` ou `?a=1`) | baixa | Compara `host:porta/banco` | `tests/domain/env.test.js` (+3) |
| `tx` com ROLLBACK que falha sem teste | — | Só cobertura | `tests/db/pool.test.js` (+1) |

Riscos aceitos e pendências geradas: ver [`docs/PENDENCIAS.md`](../PENDENCIAS.md).

## QA
APROVADO. Rodado do zero duas vezes (`down -v`, `npm ci`, `db:up`, migrate 2x, seed 2x, seed em produção, test, lint), com Postgres fora do ar, volume removido e host sem resposta. As 11 linhas conferidas contra o `DEMO` do protótipo em 19 colunas (0 diferenças). `GET /` e 404 byte a byte iguais ao HEAD com o Postgres parado. 215 testes, lint ok. Detalhes em [`docs/qa/003-banco-migrations-seed.md`](../qa/003-banco-migrations-seed.md).

**Sugestões não bloqueantes**: `afterAll` de `pool`/`migrate` acrescenta `ECONNREFUSED` cru com o banco parado; healthcheck `pg_isready` sem `-h` pode dar "healthy" cedo no init (não reproduzido); `migrate` em produção com env inválido mostra stack (sem valores); erros de senha/banco inexistente na CLI não citam o alvo; `localhost` × `127.0.0.1` contam como bancos diferentes na comparação do `env.js`.
