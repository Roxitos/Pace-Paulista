import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { createSessionMiddleware } from './middlewares/session.js';
import { currentUser } from './middlewares/currentUser.js';
import { joinedGroups } from './middlewares/joinedGroups.js';
import { csrfLocals, csrfProtection } from './middlewares/csrf.js';
import { pool } from './db/pool.js';
import { env } from './config/env.js';
import { locals } from './middlewares/locals.js';
import { notFound } from './middlewares/notFound.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { securityHeaders } from './middlewares/securityHeaders.js';
import { createRateLimits, mountRateLimits } from './middlewares/rateLimits.js';
import { pagesRouter } from './modules/pages/pages.routes.js';
import { groupsRouter } from './modules/groups/groups.routes.js';
import { matchingRouter } from './modules/matching/matching.routes.js';
import { createAccountRouter } from './modules/account/account.routes.js';
import { ic, seal, zstyle } from './views/helpers.js';
import {
  DIA_ORDEM,
  DIAS,
  DIAS_CURTO,
  NIVEIS,
  PACE_FAIXAS,
  PERIODOS,
  ZONA_ORDEM,
  ZONAS,
} from './domain/constants.js';
import { gmapsBusca, gmapsRota, ZLABEL, ZPOLY } from './domain/map.js';
import { countLabel } from './domain/filters.js';
import { fmtFaixa, fmtPace } from './domain/pace.js';
import { fmtDiasCurto, fmtDiasLongo, fmtHora } from './domain/schedule.js';

const root = path.dirname(fileURLToPath(import.meta.url));

// beforeErrorHandlers existe só para os testes registrarem rotas que lançam erro;
// o server.js nunca passa essa opção, então nada é exposto em produção.
// trustProxy e rateLimits também existem para os testes; o server.js usa os padrões.
export function createApp({
  beforeErrorHandlers,
  trustProxy = env.TRUST_PROXY,
  rateLimits = createRateLimits(),
} = {}) {
  const app = express();

  app.set('view engine', 'ejs');
  app.set('views', path.join(root, 'views'));
  app.disable('x-powered-by');
  // Atrás do proxy do Render: req.ip e req.secure (cookie de sessão secure) vêm dos X-Forwarded-*.
  app.set('trust proxy', trustProxy);
  Object.assign(app.locals, {
    ic,
    seal,
    zstyle,
    ZONAS,
    ZONA_ORDEM,
    NIVEIS,
    DIAS,
    DIAS_CURTO,
    DIA_ORDEM,
    PERIODOS,
    PACE_FAIXAS,
    countLabel,
    fmtPace,
    fmtFaixa,
    fmtHora,
    fmtDiasCurto,
    fmtDiasLongo,
    ZPOLY,
    ZLABEL,
    gmapsRota,
    gmapsBusca,
  });

  // Antes do static: os arquivos estáticos também recebem os cabeçalhos.
  app.use(securityHeaders(env));
  app.use(express.static(path.join(root, '..', 'public')));
  app.get('/favicon.ico', (req, res) => res.redirect(301, '/favicon.svg'));
  app.use(express.urlencoded({ extended: false, limit: '16kb', parameterLimit: 200 }));
  app.use(createSessionMiddleware({ pool, env }));
  app.use(currentUser);
  app.use(joinedGroups);
  app.use(csrfLocals);
  app.use(locals);
  app.use(csrfProtection);
  mountRateLimits(app, rateLimits);
  app.use(pagesRouter);
  app.use(groupsRouter);
  app.use(matchingRouter);
  app.use(createAccountRouter());
  if (beforeErrorHandlers) beforeErrorHandlers(app);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
