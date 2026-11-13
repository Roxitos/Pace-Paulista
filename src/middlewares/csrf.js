import { csrfSync } from 'csrf-sync';

const { csrfSynchronisedProtection, generateToken } = csrfSync({
  getTokenFromRequest: (req) => req.body?._csrf,
});

export const csrfProtection = csrfSynchronisedProtection;

// Preguiçoso: só a página que desenha um form POST grava token (e cria sessão) para o anônimo.
// HTML com token é da sessão: proxy/CDN não pode guardá-lo e entregá-lo a outro visitante.
export function csrfLocals(req, res, next) {
  res.locals.csrfToken = () => {
    res.set('Cache-Control', 'private, no-store');
    return generateToken(req);
  };
  next();
}
