import pg from 'pg';
import { connectionStringFor, env } from '../config/env.js';

export function createPool(connectionString) {
  const pool = new pg.Pool({ connectionString, connectionTimeoutMillis: 5000 });
  // Sem este listener, uma conexão ociosa derrubada pelo servidor mata o processo.
  pool.on('error', (err) => {
    console.error('Erro inesperado em conexão ociosa do Postgres:', err.message);
  });
  return pool;
}

// pg.Pool só conecta na primeira query: importar este módulo não abre conexão.
export const pool = createPool(connectionStringFor(env));

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
