import { Router } from 'express';

export const pagesRouter = Router();

pagesRouter.get('/', async (req, res) => {
  await res.renderPage('home', { title: 'Pace Paulista' });
});
