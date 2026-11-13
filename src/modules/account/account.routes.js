import { Router } from 'express';
import { requireAuth } from '../../middlewares/requireAuth.js';

export const accountRouter = Router();

accountRouter.get('/meus', requireAuth, async (req, res) => {
  await res.renderPage('meus', { title: 'Meus grupos · Pace Paulista' });
});
