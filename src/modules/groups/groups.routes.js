import { Router } from 'express';
import { ZONA_ORDEM } from '../../domain/constants.js';
import { isSlug } from '../../domain/slug.js';
import { renderNotFound } from '../../middlewares/notFound.js';
import { getGroupDetail, searchGroups } from './groups.service.js';

export const groupsRouter = Router();

const GROUP_NOT_FOUND = 'Esse grupo não foi encontrado. Ele pode ter sido removido.';

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

groupsRouter.get('/grupos/:slug', async (req, res) => {
  const { slug } = req.params;
  if (!isSlug(slug)) return renderNotFound(res, GROUP_NOT_FOUND);
  // res.locals.user é preenchido pela sessão a partir do M5; até lá fica ausente.
  const detail = await getGroupDetail(slug, new Date(), { viewer: res.locals.user });
  if (!detail) return renderNotFound(res, GROUP_NOT_FOUND);
  await res.renderPage('grupo-detalhe', {
    title: `${detail.group.name} · Pace Paulista`,
    ...detail,
  });
});
