import { afterAll, describe, expect, it } from 'vitest';
import { env } from '../../src/config/env.js';
import { createPool, pool } from '../../src/db/pool.js';
import { ensureTestDb } from '../helpers/db.js';

const otherPools = [];

// Mesma porta do DATABASE_URL_TEST: na máquina de dev ela pode não ser a 5432 (DB_PORT).
const testUrl = new URL(env.DATABASE_URL_TEST);
const testHostPort = `${testUrl.hostname}:${testUrl.port || '5432'}`;

function poolFor(database, port) {
  const url = new URL(env.DATABASE_URL_TEST);
  url.pathname = `/${database}`;
  if (port !== undefined) url.port = String(port);
  const created = createPool(url.href);
  otherPools.push(created);
  return created;
}

afterAll(async () => {
  await Promise.all([pool.end(), ...otherPools.map((created) => created.end())]);
});

describe('banco de teste', () => {
  it('em NODE_ENV=test o pool padrão aponta para DATABASE_URL_TEST', async () => {
    expect(env.NODE_ENV).toBe('test');
    expect(pool.options.connectionString).toBe(env.DATABASE_URL_TEST);
    await ensureTestDb(pool);
    const { rows } = await pool.query('SELECT current_database() AS name');
    expect(rows[0].name).toMatch(/_test$/);
  });

  it('recusa banco cujo nome não termina em _test', async () => {
    await expect(ensureTestDb(poolFor('postgres'))).rejects.toThrow(
      'Recusado: o banco postgres não termina em _test, e os testes apagam dados.',
    );
  });

  it('orienta a criar o banco de teste quando ele não existe', async () => {
    await expect(ensureTestDb(poolFor('pace_inexistente_test'))).rejects.toThrow(
      `Banco de teste não existe em ${testHostPort}/pace_inexistente_test. Crie com: docker compose exec db createdb -U pace pace_paulista_test`,
    );
  });

  it('falha rápido com mensagem clara quando o Postgres não responde', async () => {
    await expect(ensureTestDb(poolFor('pace_paulista_test', 1))).rejects.toThrow(
      'Postgres de teste indisponível em localhost:1/pace_paulista_test. Rode npm run db:up e tente de novo (sem banco: npx vitest run tests/domain tests/scripts).',
    );
  });
});
