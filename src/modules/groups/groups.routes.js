import { Router } from 'express';
import { ZONA_ORDEM } from '../../domain/constants.js';
import { renderNotFound } from '../../middlewares/notFound.js';
import { searchGroups } from './groups.service.js';

export const groupsRouter = Router();

groupsRouter.get('/grupos', async (req, res) => {
  await res.renderPage('grupos', {
    title: 'Grupos de corrida em SP · Pace Paulista',
    ...(await searchGroups(req.query)),
  });
});

// Link antigo do protótipo (#grupos-<zona>): vira a busca com o filtro de zona.
groupsRouter.get('/grupos/zona/:zona', async (req, res) => {
  const { zona } = req.params;
  if (!ZONA_ORDEM.includes(zona)) return renderNotFound(res);
  res.redirect(301, `/grupos?zona=${zona}`);
});
