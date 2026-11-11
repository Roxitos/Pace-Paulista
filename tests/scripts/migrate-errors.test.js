import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { runMigrations } from '../../scripts/migrate.js';

// Cliente falso: responde às queries do executor e falha nas que `failures` mandar.
function fakePool(failures) {
  const released = [];
  const client = {
    async query(sql) {
      const failure = failures(sql);
      if (failure) throw failure;
      return { rows: [], rowCount: 0 };
    },
    release(err) {
      released.push(err);
    },
  };
  return { pool: { connect: async () => client }, released };
}

describe('runMigrations com a conexão caindo no meio', () => {
  let dir;

  beforeAll(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), 'pace-migrate-'));
    await writeFile(path.join(dir, '001_tabela.sql'), 'CREATE TABLE t (id INT);\n');
  });

  afterAll(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('informa a migration que falhou mesmo se o ROLLBACK também falhar, e descarta a conexão', async () => {
    const dropped = new Error('Connection terminated unexpectedly');
    const closed = new Error('Client was closed and is not queryable');
    let broken = false;
    const { pool, released } = fakePool((sql) => {
      if (broken) return closed;
      if (sql.startsWith('CREATE TABLE t')) {
        broken = true;
        return dropped;
      }
      return null;
    });

    await expect(runMigrations({ pool, dir })).rejects.toThrow(
      'Falha na migration 001_tabela.sql: Connection terminated unexpectedly',
    );
    // A conexão pode ainda segurar o advisory lock: não pode voltar ao pool.
    expect(released).toHaveLength(1);
    expect(released[0]).toBeInstanceOf(Error);
  });

  it('não esconde o sucesso se só o unlock falhar, e descarta a conexão', async () => {
    const { pool, released } = fakePool((sql) =>
      sql.includes('pg_advisory_unlock') ? new Error('Connection terminated unexpectedly') : null,
    );

    await expect(runMigrations({ pool, dir })).resolves.toEqual({
      applied: ['001_tabela.sql'],
      total: 1,
    });
    expect(released).toHaveLength(1);
    expect(released[0]).toBeInstanceOf(Error);
  });

  it('devolve a conexão ao pool normalmente quando tudo dá certo', async () => {
    const { pool, released } = fakePool(() => null);
    await runMigrations({ pool, dir });
    expect(released).toEqual([undefined]);
  });
});
