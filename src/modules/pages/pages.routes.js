import { Router } from 'express';
import { isSlug } from '../../domain/slug.js';
import { renderNotFound } from '../../middlewares/notFound.js';
import { loadHomeData, loadMapData, loadZonesData } from './pages.service.js';

export const pagesRouter = Router();

const MAP_TITLE = 'Mapa e rotas · Pace Paulista';

pagesRouter.get('/', async (req, res) => {
  await res.renderPage('home', { title: 'Pace Paulista', ...(await loadHomeData()) });
});

pagesRouter.get('/zonas', async (req, res) => {
  await res.renderPage('zonas', { title: 'Zonas · Pace Paulista', zones: await loadZonesData() });
});

pagesRouter.get('/mapa', async (req, res) => {
  await res.renderPage('mapa', { title: MAP_TITLE, ...(await loadMapData()) });
});

// Slug inexistente responde 404 (P8), em vez de cair no grupo padrão como no protótipo.
pagesRouter.get('/mapa/:slug', async (req, res) => {
  const { slug } = req.params;
  if (!isSlug(slug)) return renderNotFound(res);
  const data = await loadMapData(slug);
  if (!data) return renderNotFound(res);
  await res.renderPage('mapa', { title: MAP_TITLE, ...data });
});

pagesRouter.get('/sobre', async (req, res) => {
  await res.renderPage('sobre', { title: 'Sobre · Pace Paulista' });
});
