import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { pool, tx } from '../../src/db/pool.js';
import { migrateTestDb } from '../helpers/db.js';

beforeAll(async () => {
  await migrateTestDb(pool);
  await pool.query('DROP TABLE IF EXISTS tx_probe');
  await pool.query('CREATE TABLE tx_probe (value TEXT NOT NULL)');
});

afterAll(async () => {
  await pool.query('DROP TABLE IF EXISTS tx_probe');
  await pool.end();
});

async function probeValues() {
  const { rows } = await pool.query('SELECT value FROM tx_probe ORDER BY value');
  return rows.map((row) => row.value);
}

describe('tx', () => {
  it('faz COMMIT e devolve o valor de fn quando fn resolve', async () => {
    const result = await tx(async (client) => {
      await client.query('INSERT INTO tx_probe (value) VALUES ($1)', ['commit']);
      return 'ok';
    });
    expect(result).toBe('ok');
    expect(await probeValues()).toContain('commit');
  });

  it('faz ROLLBACK e relança o mesmo objeto de erro quando fn lança', async () => {
    const error = Object.assign(new Error('falhou'), { code: '23505' });
    let caught;
    try {
      await tx(async (client) => {
        await client.query('INSERT INTO tx_probe (value) VALUES ($1)', ['rollback']);
        throw error;
      });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBe(error);
    expect(caught.code).toBe('23505');
    expect(await probeValues()).not.toContain('rollback');
  });

  it('faz ROLLBACK quando o próprio SQL falha, preservando o código do Postgres', async () => {
    await expect(
      tx(async (client) => {
        await client.query('INSERT INTO tx_probe (value) VALUES ($1)', ['parcial']);
        await client.query('INSERT INTO tx_probe (value) VALUES (NULL)');
      }),
    ).rejects.toMatchObject({ code: '23502' });
    expect(await probeValues()).not.toContain('parcial');
  });

  it('descarta a conexão quando o ROLLBACK também falha, relançando o erro original', async () => {
    const original = new Error('falha em fn');
    const rollbackError = new Error('Client was closed and is not queryable');
    const released = [];
    const client = {
      query: async (sql) => {
        if (sql === 'ROLLBACK') throw rollbackError;
      },
      release: (err) => released.push(err),
    };
    const fakePool = { connect: async () => client };

    await expect(
      tx(async () => {
        throw original;
      }, fakePool),
    ).rejects.toBe(original);
    expect(released).toEqual([rollbackError]);
  });

  it('devolve a conexão ao pool mesmo depois de 20 transações com erro', async () => {
    for (let i = 0; i < 20; i += 1) {
      await expect(
        tx(async () => {
          throw new Error(`erro ${i}`);
        }),
      ).rejects.toThrow(`erro ${i}`);
    }
    expect(pool.totalCount).toBeLessThanOrEqual(10);
    expect(pool.idleCount).toBe(pool.totalCount);
    const { rows } = await pool.query('SELECT 1 AS one');
    expect(rows[0].one).toBe(1);
  });
});
