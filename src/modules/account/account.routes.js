import { Router } from 'express';
import { rateLimit, ipKeyGenerator } from 'express-rate-limit';
import { requireAuth } from '../../middlewares/requireAuth.js';
import { redirectIfAuthenticated } from '../../middlewares/redirectIfAuthenticated.js';
import { safeNext } from '../../domain/redirect.js';
import { sessionCookieOptions } from '../../middlewares/session.js';
import { env } from '../../config/env.js';
import { parseSignup, parseLogin, loginLimitKey } from '../auth/auth.schemas.js';
import * as authService from '../auth/auth.service.js';

const TITLE = 'Criar conta · Pace Paulista';
const LOGIN_TITLE = 'Entrar · Pace Paulista';
const LOGIN_FAIL = 'E-mail ou senha incorretos.';
const RATE_LIMIT_MSG = 'Muitas tentativas. Espere alguns minutos e tente de novo.';

// Destrói a sessão e expira o cookie. Mesmas opções do cookie de sessão (sem maxAge),
// senão o navegador não o expira.
const endSession = (req, res, next, to) =>
  req.session.destroy((err) => {
    if (err) return next(err);
    const { httpOnly, sameSite, secure } = sessionCookieOptions(env);
    res.clearCookie('pp.sid', { path: '/', httpOnly, sameSite, secure });
    res.redirect(303, to);
  });

// Criado por router (e não no módulo) para cada app de teste ter a própria memória.
export function createAccountRouter() {
  const router = Router();

  const renderSignup = (res, status, values, errors) =>
    res
      .status(status)
      .renderPage('conta-criar', { title: TITLE, values, errors, rateLimited: false });

  const signupLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    keyGenerator: (req) => ipKeyGenerator(req.ip),
    handler: (req, res) => {
      const { values } = parseSignup(req.body);
      return res
        .status(429)
        .renderPage('conta-criar', { title: TITLE, values, errors: {}, rateLimited: true });
    },
  });

  const renderLogin = (res, status, values, errors, alert = '') =>
    res.status(status).renderPage('conta-entrar', { title: LOGIN_TITLE, values, errors, alert });

  const loginValues = (req) => parseLogin(req.body).values;

  // Só as falhas contam (skipSuccessfulRequests): quem acerta a senha não se bloqueia.
  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    keyGenerator: (req) => `${ipKeyGenerator(req.ip)}|${loginLimitKey(loginValues(req).email)}`,
    handler: (req, res) => renderLogin(res, 429, loginValues(req), {}, RATE_LIMIT_MSG),
  });

  router.get('/meus', requireAuth, async (req, res) => {
    await res.renderPage('meus', {
      title: 'Meus grupos · Pace Paulista',
      confirmDelete: req.query.excluir === '1',
    });
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

  router.get('/conta/entrar', redirectIfAuthenticated, async (req, res) => {
    await renderLogin(res, 200, { email: '', next: safeNext(req.query.next, '') }, {});
  });

  router.post('/conta/entrar', loginLimiter, redirectIfAuthenticated, async (req, res, next) => {
    const { values, errors, data } = parseLogin(req.body);
    if (!data) return renderLogin(res, 422, values, errors);

    const result = await authService.login(data);
    if (!result) return renderLogin(res, 401, values, {}, LOGIN_FAIL);

    req.session.regenerate((err) => {
      if (err) return next(err);
      req.session.userId = String(result.user.id);
      req.session.save((saveErr) => {
        if (saveErr) return next(saveErr);
        res.redirect(303, safeNext(values.next));
      });
    });
  });

  router.post('/conta/sair', requireAuth, (req, res, next) => endSession(req, res, next, '/'));

  // Sem flash: a sessão acaba de morrer, então o aviso viaja na query da home.
  router.post('/conta/excluir', requireAuth, async (req, res, next) => {
    await authService.deleteAccount(req.user.id);
    endSession(req, res, next, '/?conta=excluida');
  });

  return router;
}
