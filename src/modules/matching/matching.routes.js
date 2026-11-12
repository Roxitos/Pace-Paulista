import { Router } from 'express';
import { hasMatchParams, parseMatchForm } from './matching.schemas.js';
import { findMatches } from './matching.service.js';

export const matchingRouter = Router();

const TITLE = 'Encontrar meu grupo · Pace Paulista';

// GET com as respostas na query (P1): só lê, dá para recarregar e compartilhar; nada é salvo.
matchingRouter.get('/encontrar', async (req, res) => {
  const { values, errors, q } = parseMatchForm(req.query);
  // Sem envio, o form vazio não depende do banco (e não mostra erros antes de responder).
  if (!hasMatchParams(req.query)) {
    return res.renderPage('encontrar', { title: TITLE, values, errors: {}, result: null });
  }
  if (!q) {
    res.status(422);
    return res.renderPage('encontrar', { title: TITLE, values, errors, result: null });
  }
  const matches = await findMatches(q);
  await res.renderPage('encontrar', { title: TITLE, values, errors, result: { q, matches } });
});
