import { Router } from 'express';
import { rateLimit, ipKeyGenerator } from 'express-rate-limit';
import { requireAuth } from '../../middlewares/requireAuth.js';
import { redirectIfAuthenticated } from '../../middlewares/redirectIfAuthenticated.js';
import { safeNext } from '../../domain/redirect.js';
import { parseSignup } from '../auth/auth.schemas.js';
import * as authService from '../auth/auth.service.js';

const TITLE = 'Criar conta · Pace Paulista';

// Criado por router (e não no módulo) para cada app de teste ter a própria memória.
export function createAccountRouter() {
  const router = Router();

  const renderSignup = (res, status, values, errors, rateLimited = false) =>
    res.status(status).renderPage('conta-criar', { title: TITLE, values, errors, rateLimited });

  const signupLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    keyGenerator: (req) => ipKeyGenerator(req.ip),
    handler: (req, res) => {
      const { values } = parseSignup(req.body);
      return renderSignup(res, 429, values, {}, true);
    },
  });

  router.get('/meus', requireAuth, async (req, res) => {
    await res.renderPage('meus', { title: 'Meus grupos · Pace Paulista' });
  });

  router.get('/conta/criar', redirectIfAuthenticated, async (req, res) => {
    const values = { nome: '', email: '', next: safeNext(req.query.next, '') };
    await renderSignup(res, 200, values, {});
  });

  router.post('/conta/criar', signupLimiter, redirectIfAuthenticated, async (req, res, next) => {
    const { values, errors, data } = parseSignup(req.body);
    if (!data) return renderSignup(res, 422, values, errors);

    const result = await authService.signup(data);
    if (result.errors) return renderSignup(res, 422, values, result.errors);

    // regenerate: o id de sessão anterior (anônimo) não pode sobreviver ao login.
    req.session.regenerate((err) => {
      if (err) return next(err);
      req.session.userId = String(result.user.id);
      req.session.save((saveErr) => {
        if (saveErr) return next(saveErr);
        res.redirect(303, safeNext(values.next));
      });
    });
  });

  return router;
}
