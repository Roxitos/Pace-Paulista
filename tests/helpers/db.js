import { randomUUID } from 'node:crypto';
import { isConnectionFailure } from '../../scripts/cli.js';
import { runMigrations } from '../../scripts/migrate.js';
import { runSeed } from '../../scripts/seed.js';
import { describeDatabaseUrl } from '../../src/config/env.js';

// Trava antes de qualquer DROP/TRUNCATE: os testes apagam dados e só podem tocar num banco *_test.
export async function ensureTestDb(pool) {
  const target = describeDatabaseUrl(pool.options.connectionString);
  let rows;
  try {
    ({ rows } = await pool.query('SELECT current_database() AS name'));
  } catch (err) {
    if (err.code === '3D000') {
      throw new Error(
        `Banco de teste não existe em ${target}. Crie com: docker compose exec db createdb -U pace pace_paulista_test`,
        { cause: err },
      );
    }
    if (isConnectionFailure(err)) {
      throw new Error(
        `Postgres de teste indisponível em ${target}. Rode npm run db:up e tente de novo (sem banco: npx vitest run tests/domain tests/scripts).`,
        { cause: err },
      );
    }
    throw err;
  }
  const { name } = rows[0];
  if (!name.endsWith('_test')) {
    throw new Error(`Recusado: o banco ${name} não termina em _test, e os testes apagam dados.`);
  }
}

export async function migrateTestDb(pool) {
  await ensureTestDb(pool);
  await runMigrations({ pool });
}

export async function resetSchema(pool) {
  await ensureTestDb(pool);
  await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
}

export async function truncateAll(pool) {
  await ensureTestDb(pool);
  await pool.query('TRUNCATE memberships, groups, users, "session" RESTART IDENTITY CASCADE');
}

export async function seedDemo(pool) {
  await truncateAll(pool);
  await runSeed({ pool, nodeEnv: 'test' });
}

export async function insertUser(
  pool,
  displayName,
  { email = `${randomUUID()}@exemplo.com`, passwordHash = 'hash', role = 'user' } = {},
) {
  const { rows } = await pool.query(
    `INSERT INTO users (email, password_hash, display_name, role)
     VALUES ($1, $2, $3, $4) RETURNING id`,
    [email, passwordHash, displayName, role],
  );
  return rows[0].id;
}

export async function insertMembership(pool, userId, slug, nickname) {
  await pool.query(
    `INSERT INTO memberships (user_id, group_id, nickname)
     SELECT $1, id, $3 FROM groups WHERE slug = $2`,
    [userId, slug, nickname],
  );
}
