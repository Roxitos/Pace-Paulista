import { csrfSync } from 'csrf-sync';

const { csrfSynchronisedProtection, generateToken } = csrfSync({
  getTokenFromRequest: (req) => req.body?._csrf,
});

export const csrfProtection = csrfSynchronisedProtection;

// Preguiçoso: só a página que desenha um form POST grava token (e cria sessão) para o anônimo.
export function csrfLocals(req, res, next) {
  res.locals.csrfToken = () => generateToken(req);
  next();
}
