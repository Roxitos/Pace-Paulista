import { rateLimit, ipKeyGenerator } from 'express-rate-limit';

// Generosos de propósito: operadoras móveis usam CGNAT (muitos visitantes no mesmo IP).
const RATE_LIMITS = {
  read: { windowMs: 60_000, limit: 120 }, // GET /grupos, GET /encontrar — chave: IP
  api: { windowMs: 60_000, limit: 300 }, // GET /api/grupos, GET /api/mapa/:slug — chave: IP
  createGroup: { windowMs: 3_600_000, limit: 20 }, // POST /grupos — chave: usuário (ou IP)
  membership: { windowMs: 900_000, limit: 60 }, // participar e sair (mesmo balde) — usuário (ou IP)
};

const byIp = (req) => ipKeyGenerator(req.ip);
const byUser = (req) => (req.user ? `u:${req.user.id}` : ipKeyGenerator(req.ip));

const pageHandler = (req, res, next) =>
  next(Object.assign(new Error('Muitas requisições.'), { status: 429 }));

const apiHandler = (req, res) =>
  res.status(429).set('Cache-Control', 'private, no-store').json({ error: 'rate_limited' });

const KINDS = {
  read: { keyGenerator: byIp, handler: pageHandler },
  api: { keyGenerator: byIp, handler: apiHandler },
  createGroup: { keyGenerator: byUser, handler: pageHandler },
  membership: { keyGenerator: byUser, handler: pageHandler },
};

// Um conjunto por app: cada app de teste tem a própria memória.
export function createRateLimits(overrides = {}) {
  return Object.fromEntries(
    Object.entries(KINDS).map(([name, kind]) => [
      name,
      rateLimit({
        ...RATE_LIMITS[name],
        ...overrides[name],
        standardHeaders: 'draft-8',
        legacyHeaders: false,
        ...kind,
      }),
    ]),
  );
}

// Caminhos exatos: `app.use('/grupos', …)` pegaria também `/grupos/:slug` e `/grupos/novo`.
export function mountRateLimits(app, limits) {
  app.get('/grupos', limits.read);
  app.get('/encontrar', limits.read);
  app.get('/api/grupos', limits.api);
  app.get('/api/mapa/:slug', limits.api);
  app.post('/grupos', limits.createGroup);
  app.post('/grupos/:slug/excluir', limits.createGroup); // escrita de grupo: mesmo balde
  app.post('/grupos/:slug/participar', limits.membership);
  app.post('/grupos/:slug/sair', limits.membership);
}
