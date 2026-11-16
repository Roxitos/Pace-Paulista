import { appendFile, cp, mkdtemp, rm, unlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { runMigrations } from '../../scripts/migrate.js';
import { pool } from '../../src/db/pool.js';
import { ensureTestDb, resetSchema } from '../helpers/db.js';

const MIGRATIONS_DIR = fileURLToPath(new URL('../../db/migrations/', import.meta.url));
const ALL = [
  '001_extensions.sql',
  '002_users.sql',
  '003_groups.sql',
  '004_memberships.sql',
  '005_sessions.sql',
  '006_groups_start_time_check.sql',
];
const tempDirs = [];

async function copyMigrations() {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'pace-migrations-'));
  tempDirs.push(dir);
  await cp(MIGRATIONS_DIR, dir, { recursive: true });
  return dir;
}

async function appliedRows() {
  const { rows } = await pool.query(
    'SELECT filename, checksum FROM schema_migrations ORDER BY filename',
  );
  return rows;
}

beforeAll(async () => {
  await ensureTestDb(pool);
});

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

afterAll(async () => {
  // Deixa o banco de teste migrado para os próximos arquivos.
  await runMigrations({ pool });
  await pool.end();
});

describe('runMigrations', () => {
  it('aplica as 6 migrations em ordem num esquema zerado e não reaplica na 2ª execução', async () => {
    await resetSchema(pool);
    const logs = [];
    const first = await runMigrations({ pool, log: (line) => logs.push(line) });
    expect(first).toEqual({ applied: ALL, total: 6 });
    expect(logs).toEqual(ALL.map((file) => `Aplicada ${file}`));

    const second = await runMigrations({ pool });
    expect(second).toEqual({ applied: [], total: 6 });

    const rows = await appliedRows();
    expect(rows.map((row) => row.filename)).toEqual(ALL);
    for (const row of rows) expect(row.checksum).toMatch(/^[0-9a-f]{64}$/);
  });

  it('cria tabelas, extensão citext e índices esperados', async () => {
    const tables = await pool.query(
      `SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public' ORDER BY table_name`,
    );
    expect(tables.rows.map((row) => row.table_name)).toEqual(
      expect.arrayContaining(['groups', 'memberships', 'schema_migrations', 'session', 'users']),
    );

    const ext = await pool.query("SELECT 1 FROM pg_extension WHERE extname = 'citext'");
    expect(ext.rowCount).toBe(1);

    const indexes = await pool.query(
      "SELECT indexname FROM pg_indexes WHERE schemaname = 'public' AND indexname = ANY($1)",
      [['groups_zone_idx', 'groups_days_idx', 'memberships_group_idx', 'IDX_session_expire']],
    );
    expect(indexes.rows.map((row) => row.indexname).sort()).toEqual(
      ['IDX_session_expire', 'groups_days_idx', 'groups_zone_idx', 'memberships_group_idx'].sort(),
    );
  });

  it('falha com a mensagem de imutabilidade se uma migration aplicada foi alterada, sem aplicar nada', async () => {
    const dir = await copyMigrations();
    await appendFile(path.join(dir, '005_sessions.sql'), '-- editada\n');
    await writeFile(path.join(dir, '007_nova.sql'), 'CREATE TABLE nao_deveria_existir (id INT);\n');

    await expect(runMigrations({ pool, dir })).rejects.toThrow(
      'A migration 005_sessions.sql foi alterada depois de aplicada. Migrations são imutáveis: crie uma nova.',
    );
    expect(await appliedRows()).toHaveLength(6);
    const { rows } = await pool.query("SELECT to_regclass('nao_deveria_existir') AS t");
    expect(rows[0].t).toBeNull();
  });

  it('falha se uma migration aplicada não existe mais no diretório', async () => {
    const dir = await copyMigrations();
    await unlink(path.join(dir, '005_sessions.sql'));
    await expect(runMigrations({ pool, dir })).rejects.toThrow(
      'A migration 005_sessions.sql consta como aplicada, mas não existe em db/migrations.',
    );
  });

  it('recusa nome de migration fora do padrão', async () => {
    const dir = await copyMigrations();
    await writeFile(path.join(dir, '6_Nova-Tabela.sql'), 'SELECT 1;\n');
    await expect(runMigrations({ pool, dir })).rejects.toThrow(
      'Nome de migration inválido: 6_Nova-Tabela.sql (use NNN_nome.sql).',
    );
  });

  it('recusa número de migration repetido', async () => {
    const dir = await copyMigrations();
    await writeFile(path.join(dir, '003_outra.sql'), 'SELECT 1;\n');
    await expect(runMigrations({ pool, dir })).rejects.toThrow(
      'Número de migration repetido: 003.',
    );
  });

  it('desfaz só a migration que falhou e informa o arquivo', async () => {
    const dir = await copyMigrations();
    await writeFile(
      path.join(dir, '007_quebrada.sql'),
      'CREATE TABLE parcial (id INT);\nSELECT * FROM tabela_que_nao_existe;\n',
    );
    await expect(runMigrations({ pool, dir })).rejects.toThrow(
      /^Falha na migration 007_quebrada\.sql: /,
    );
    expect(await appliedRows()).toHaveLength(6);
    const { rows } = await pool.query("SELECT to_regclass('parcial') AS t");
    expect(rows[0].t).toBeNull();
  });

  it('duas execuções simultâneas num esquema vazio aplicam cada migration uma vez', async () => {
    await resetSchema(pool);
    const results = await Promise.all([runMigrations({ pool }), runMigrations({ pool })]);
    expect(results.flatMap((result) => result.applied).sort()).toEqual(ALL);
    expect(await appliedRows()).toHaveLength(6);
  });
});
