import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export function sessionCookieOptions(env) {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.NODE_ENV === 'production',
    maxAge: THIRTY_DAYS_MS,
  };
}

export function createSessionMiddleware({ pool, env }) {
  const PgStore = connectPgSimple(session);
  return session({
    name: 'pp.sid',
    secret: env.SESSION_SECRET,
    resave: false,
    // Visitante anônimo que só navega não gera cookie nem linha em "session".
    saveUninitialized: false,
    cookie: sessionCookieOptions(env),
    store: new PgStore({
      pool,
      tableName: 'session',
      createTableIfMissing: false,
      // O timer de limpeza seguraria o processo do vitest.
      ...(env.NODE_ENV === 'test' ? { pruneSessionInterval: false } : {}),
    }),
  });
}
