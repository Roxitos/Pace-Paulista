import { findUserById } from '../modules/auth/auth.service.js';

export async function currentUser(req, res, next) {
  try {
    const id = req.session?.userId;
    if (id === undefined) return next();
    const user = await findUserById(id);
    if (!user) {
      // Conta excluída em outro aparelho.
      delete req.session.userId;
      return next();
    }
    req.user = res.locals.user = user;
    // A página do grupo mostra o contato só para logado: proxy/CDN não pode servir essa versão a anônimo.
    res.set('Cache-Control', 'private, no-store');
    next();
  } catch (err) {
    next(err);
  }
}
