import { Router } from 'express';
import { rateLimit, ipKeyGenerator } from 'express-rate-limit';

// TEMPORÁRIO (spec 020, CA11): descobre quantos proxies há na frente da app no Render.
// Só ecoa dados da requisição de quem chama; nunca dump de cabeçalhos, env ou banco.
// Remover depois do 1º deploy (ver docs/DEPLOY.md, "Diagnóstico do IP").
export function createDiagIpRouter({ trustProxy }) {
  const router = Router();
  const limit = rateLimit({
    windowMs: 60_000,
    limit: 30,
    standardHeaders: false,
    legacyHeaders: false,
    keyGenerator: (req) => ipKeyGenerator(req.ip),
    // O diagnóstico existe justamente para olhar o X-Forwarded-For; o aviso do pacote só poluiria o log.
    validate: false,
    handler: (req, res) =>
      res.status(429).set('Cache-Control', 'no-store').json({ error: 'rate_limited' }),
  });

  router.get('/diag/ip', limit, (req, res) => {
    res.set('Cache-Control', 'no-store').json({
      ip: req.ip,
      ips: req.ips,
      trustProxy,
      xForwardedFor: req.get('x-forwarded-for') ?? null,
      socketRemoteAddress: req.socket.remoteAddress ?? null,
      cfConnectingIp: req.get('cf-connecting-ip') ?? null,
      trueClientIp: req.get('true-client-ip') ?? null,
    });
  });

  return router;
}
