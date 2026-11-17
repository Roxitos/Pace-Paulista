// O Render manda SIGTERM à instância antiga a cada deploy: sem isto o Node morre na hora
// e corta requisições (inclusive POSTs) em andamento.
export function gracefulShutdown({
  server,
  pool,
  log = console.log,
  exit = process.exit,
  timeoutMs = 10_000,
}) {
  let started = false;
  return async function handle() {
    if (started) return;
    started = true;
    log('Encerrando: aguardando requisições em andamento.');
    setTimeout(() => exit(1), timeoutMs).unref();
    await new Promise((resolve) => server.close(resolve));
    await pool.end();
    exit(0);
  };
}
