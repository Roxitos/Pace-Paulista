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
    try {
      await pool.end();
    } catch (err) {
      // Sem o catch, a rejeição solta derrubaria o processo com stack trace no log.
      log(`Erro ao fechar o pool do Postgres: ${err.message}`);
      exit(1);
      return;
    }
    exit(0);
  };
}
