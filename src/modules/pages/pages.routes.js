import { Router } from 'express';
import { getHomeData } from './pages.service.js';

export const pagesRouter = Router();

pagesRouter.get('/', async (req, res) => {
  await res.renderPage('home', { title: 'Pace Paulista', ...getHomeData() });
});
