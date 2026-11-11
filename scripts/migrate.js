import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { connectionStringFor, describeDatabaseUrl, env } from '../src/config/env.js';
import { createPool } from '../src/db/pool.js';
import { cliErrorMessage, isMain } from './cli.js';

const DEFAULT_DIR = fileURLToPath(new URL('../db/migrations/', import.meta.url));
const MIGRATION_NAME = /^\d{3}_[a-z0-9_]+\.sql$/;
// Chave fixa do advisory lock: dois migrates simultâneos (dois deploys, dois arquivos de
// teste) esperam um ao outro em vez de aplicar a mesma migration duas vezes.
const LOCK_KEY = 20261111;

async function readMigrations(dir) {
  const files = (await readdir(dir)).filter((file) => file.endsWith('.sql')).sort();
  const seenNumbers = new Set();
  const migrations = [];
  for (const filename of files) {
    if (!MIGRATION_NAME.test(filename)) {
      throw new Error(`Nome de migration inválido: ${filename} (use NNN_nome.sql).`);
    }
    const number = filename.slice(0, 3);
    if (seenNumbers.has(number)) throw new Error(`Número de migration repetido: ${number}.`);
    seenNumbers.add(number);
    const sql = await readFile(path.join(dir, filename), 'utf8');
    // O .gitattributes força LF, então o hash é o mesmo em Windows e Linux.
    const checksum = createHash('sha256').update(sql).digest('hex');
    migrations.push({ filename, sql, checksum });
  }
  return migrations;
}

function verifyApplied(applied, migrations) {
  const byName = new Map(migrations.map((migration) => [migration.filename, migration]));
  for (const row of applied) {
    const migration = byName.get(row.filename);
    if (!migration) {
      throw new Error(
        `A migration ${row.filename} consta como aplicada, mas não existe em db/migrations.`,
      );
    }
    if (migration.checksum !== row.checksum) {
      throw new Error(
        `A migration ${row.filename} foi alterada depois de aplicada. Migrations são imutáveis: crie uma nova.`,
      );
    }
  }
}

export async function runMigrations({ pool, dir = DEFAULT_DIR, log = () => {} }) {
  const client = await pool.connect();
  let locked = false;
  // Erro que deixou a conexão em estado desconhecido (talvez ainda segurando o lock).
  let brokenConnection;
  try {
    await client.query('SELECT pg_advisory_lock($1)', [LOCK_KEY]);
    locked = true;
    await client.query(
      `CREATE TABLE IF NOT EXISTS schema_migrations (
         filename   TEXT PRIMARY KEY,
         checksum   TEXT NOT NULL,
         applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
       )`,
    );

    const migrations = await readMigrations(dir);
    const { rows } = await client.query(
      'SELECT filename, checksum FROM schema_migrations ORDER BY filename',
    );
    verifyApplied(rows, migrations);

    const appliedNames = new Set(rows.map((row) => row.filename));
    const applied = [];
    for (const migration of migrations) {
      if (appliedNames.has(migration.filename)) continue;
      try {
        await client.query('BEGIN');
        await client.query(migration.sql);
        await client.query('INSERT INTO schema_migrations (filename, checksum) VALUES ($1, $2)', [
          migration.filename,
          migration.checksum,
        ]);
        await client.query('COMMIT');
      } catch (err) {
        try {
          await client.query('ROLLBACK');
        } catch (rollbackError) {
          // O erro útil é o da migration; o do ROLLBACK só diz que a conexão caiu.
          brokenConnection = rollbackError;
        }
        throw new Error(`Falha na migration ${migration.filename}: ${err.message}`, {
          cause: err,
        });
      }
      applied.push(migration.filename);
      log(`Aplicada ${migration.filename}`);
    }
    return { applied, total: migrations.length };
  } finally {
    if (locked && !brokenConnection) {
      try {
        await client.query('SELECT pg_advisory_unlock($1)', [LOCK_KEY]);
      } catch (unlockError) {
        brokenConnection = unlockError;
      }
    }
    // Descartar a conexão encerra a sessão no Postgres, o que libera o lock; devolvê-la ao
    // pool segurando o lock travaria o próximo runMigrations do mesmo processo.
    client.release(brokenConnection);
  }
}

if (isMain(import.meta.url)) {
  const connectionString = connectionStringFor(env);
  const target = describeDatabaseUrl(connectionString);
  const pool = createPool(connectionString);
  try {
    const { applied, total } = await runMigrations({ pool, log: console.log });
    console.log(
      applied.length > 0
        ? `Banco ${target}: ${applied.length} migration(s) aplicada(s).`
        : `Banco ${target} já está em dia (${total} migrations).`,
    );
  } catch (err) {
    console.error(cliErrorMessage(err, target));
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}
