import { Router } from 'express';
import { loadHomeData, loadZonesData } from './pages.service.js';

export const pagesRouter = Router();

pagesRouter.get('/', async (req, res) => {
  await res.renderPage('home', { title: 'Pace Paulista', ...(await loadHomeData()) });
});

pagesRouter.get('/zonas', async (req, res) => {
  await res.renderPage('zonas', { title: 'Zonas · Pace Paulista', zones: await loadZonesData() });
});
