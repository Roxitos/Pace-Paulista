import { safeNext } from '../domain/redirect.js';

export function redirectIfAuthenticated(req, res, next) {
  if (!req.user) return next();
  const status = req.method === 'GET' || req.method === 'HEAD' ? 302 : 303;
  res.redirect(status, safeNext(req.query.next ?? req.body?.next));
}
