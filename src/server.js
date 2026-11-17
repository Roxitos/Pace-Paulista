import { createApp } from './app.js';
import { env } from './config/env.js';
import { pool } from './db/pool.js';
import { gracefulShutdown } from './lifecycle.js';

const app = createApp();
const server = app.listen(env.PORT, () => {
  console.log(`Pace Paulista em http://localhost:${env.PORT}`);
});

const handler = gracefulShutdown({ server, pool });
process.once('SIGTERM', handler);
process.once('SIGINT', handler);
