export function requireAuth(req, res, next) {
  if (req.user) return next();
  if (req.method === 'GET' || req.method === 'HEAD') {
    return res.redirect(302, `/conta/entrar?next=${encodeURIComponent(req.originalUrl)}`);
  }
  // Voltar para a URL de um POST daria 404 no GET: sem `next`.
  res.redirect(303, '/conta/entrar');
}
