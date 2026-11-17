import pg from 'pg';
import { connectionStringFor, env } from '../config/env.js';

// Só o pool da app usa: um lock longo em `groups` pendurava `/` e `/zonas` até o timeout do cliente.
// migrate/seed criam o pool sem limite (uma migration pode demorar).
const APP_STATEMENT_TIMEOUT_MS = 5000;
// Cobre o wake do compute do Neon Free (suspenso após ~5 min ocioso). Fica acima do statement_timeout
// de propósito: este só conta a execução, que começa depois da conexão.
const CONNECTION_TIMEOUT_MS = 15000;

export function createPool(connectionString, { statementTimeoutMs } = {}) {
  const config = { connectionString, connectionTimeoutMillis: CONNECTION_TIMEOUT_MS };
  if (statementTimeoutMs) config.statement_timeout = statementTimeoutMs;
  const pool = new pg.Pool(config);
  // Sem este listener, uma conexão ociosa derrubada pelo servidor mata o processo.
  pool.on('error', (err) => {
    console.error('Erro inesperado em conexão ociosa do Postgres:', err.message);
  });
  return pool;
}

// pg.Pool só conecta na primeira query: importar este módulo não abre conexão.
export const pool = createPool(connectionStringFor(env), {
  statementTimeoutMs: APP_STATEMENT_TIMEOUT_MS,
});

export async function tx(fn, targetPool = pool) {
  const client = await targetPool.connect();
  let releaseError;
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      // Conexão em estado desconhecido: descarta em vez de devolver ao pool.
      releaseError = rollbackError;
    }
    throw err;
  } finally {
    client.release(releaseError);
  }
}
