import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { locals } from './middlewares/locals.js';
import { notFound } from './middlewares/notFound.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { pagesRouter } from './modules/pages/pages.routes.js';
import { ic } from './views/helpers.js';

const root = path.dirname(fileURLToPath(import.meta.url));

// beforeErrorHandlers existe só para os testes registrarem rotas que lançam erro;
// o server.js nunca passa essa opção, então nada é exposto em produção.
export function createApp({ beforeErrorHandlers } = {}) {
  const app = express();

  app.set('view engine', 'ejs');
  app.set('views', path.join(root, 'views'));
  app.disable('x-powered-by');
  app.locals.ic = ic;

  app.use(express.static(path.join(root, '..', 'public')));
  app.use(locals);
  app.use(pagesRouter);
  if (beforeErrorHandlers) beforeErrorHandlers(app);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
