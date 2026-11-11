import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// O Node resolve links no import.meta.url do script principal, mas não em process.argv[1];
// comparar os caminhos reais evita que o script termine sem fazer nada (e com código 0).
export function isMain(moduleUrl, entry = process.argv[1]) {
  if (entry === undefined) return false;
  try {
    return realpathSync.native(entry) === realpathSync.native(fileURLToPath(moduleUrl));
  } catch {
    return false;
  }
}

// Mensagens do pg-pool quando o connectionTimeoutMillis estoura. Comparação exata: erros
// do Postgres como "canceling statement due to lock timeout" não são falha de conexão.
const CONNECTION_TIMEOUT_MESSAGES = new Set([
  'Connection terminated due to connection timeout',
  'timeout exceeded when trying to connect',
]);

export function isConnectionFailure(err) {
  return err.code === 'ECONNREFUSED' || CONNECTION_TIMEOUT_MESSAGES.has(err.message);
}

// Mensagem para os scripts de linha de comando: só o alvo, nunca a URL completa (tem senha).
export function cliErrorMessage(err, target) {
  if (isConnectionFailure(err)) {
    return `Não foi possível conectar ao Postgres em ${target}. Ele está de pé? Rode npm run db:up.`;
  }
  return err.message;
}
