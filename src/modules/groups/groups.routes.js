import { Router } from 'express';
import { ZONA_ORDEM } from '../../domain/constants.js';
import { countLabel } from '../../domain/filters.js';
import { isSlug } from '../../domain/slug.js';
import { renderNotFound } from '../../middlewares/notFound.js';
import { requireAuth } from '../../middlewares/requireAuth.js';
import { joinGroup, leaveGroup } from '../memberships/memberships.service.js';
import { createGroup, getGroupDetail, searchGroups } from './groups.service.js';

export const groupsRouter = Router();

const GROUP_NOT_FOUND = 'Esse grupo não foi encontrado. Ele pode ter sido removido.';

groupsRouter.get('/grupos', async (req, res) => {
  await res.renderPage('grupos', {
    title: 'Grupos de corrida em SP · Pace Paulista',
    scripts: ['filtros'],
    ...(await searchGroups(req.query)),
  });
});

// JSON só para o filtro ao vivo; o HTML vem dos mesmos partials da /grupos.
groupsRouter.get('/api/grupos', async (req, res) => {
  const { groups, chips, query } = await searchGroups(req.query);
  const [chipsHtml, results] = await Promise.all([
    res.renderPartial('search-chips', { chips }),
    res.renderPartial('search-results', { groups }),
  ]);
  res.set('Cache-Control', 'private, no-store').json({
    count: groups.length,
    countText: countLabel(groups.length),
    query,
    chips: chipsHtml,
    results,
  });
});

// Link antigo do protótipo (#grupos-<zona>): vira a busca com o filtro de zona.
groupsRouter.get('/grupos/zona/:zona', async (req, res) => {
  const { zona } = req.params;
  if (!ZONA_ORDEM.includes(zona)) return renderNotFound(res);
  res.redirect(301, `/grupos?zona=${zona}`);
});

const EMPTY_VALUES = {
  nome: '',
  zona: '',
  local: '',
  ponto: '',
  dias: [],
  horario: '',
  distancia: '',
  paceMin: '',
  paceMax: '',
  nivel: '',
  participantes: '',
  descricao: '',
  contato: '',
  organizador: false,
};
const FORM_TITLE = 'Cadastrar grupo · Pace Paulista';

// Antes de /grupos/:slug: "novo" não é um slug.
groupsRouter.get('/grupos/novo', requireAuth, async (req, res) => {
  await res.renderPage('grupo-novo', { title: FORM_TITLE, values: EMPTY_VALUES, errors: {} });
});

groupsRouter.post('/grupos', requireAuth, async (req, res) => {
  const result = await createGroup(req.body, req.user.id);
  if (result.errors) {
    res.status(422);
    return res.renderPage('grupo-novo', { title: FORM_TITLE, ...result });
  }
  res.redirect(303, `/grupos/${result.slug}?criado=1`);
});

// Mesma página para o GET e para o 422 do participar (mesmo título e dados).
async function renderDetail(res, detail, join) {
  const { user } = res.locals;
  await res.renderPage('grupo-detalhe', {
    title: `${detail.group.name} · Pace Paulista`,
    ...detail,
    join: join ?? (user ? { values: { apelido: user.displayName, ok: false }, errors: {} } : null),
  });
}

groupsRouter.get('/grupos/:slug', async (req, res) => {
  const { slug } = req.params;
  if (!isSlug(slug)) return renderNotFound(res, GROUP_NOT_FOUND);
  const detail = await getGroupDetail(slug, new Date(), { viewer: res.locals.user });
  if (!detail) return renderNotFound(res, GROUP_NOT_FOUND);
  if (req.query.criado === '1' && detail.isOwner) {
    return res.renderPage('grupo-novo', {
      title: 'Grupo cadastrado · Pace Paulista',
      created: detail.group,
      values: EMPTY_VALUES,
      errors: {},
    });
  }
  await renderDetail(res, detail);
});

groupsRouter.post('/grupos/:slug/participar', requireAuth, async (req, res) => {
  const { slug } = req.params;
  if (!isSlug(slug)) return renderNotFound(res, GROUP_NOT_FOUND);
  const result = await joinGroup(slug, req.user.id, req.body);
  if (result.notFound) return renderNotFound(res, GROUP_NOT_FOUND);
  if (result.errors) {
    const detail = await getGroupDetail(slug, new Date(), { viewer: req.user });
    if (!detail) return renderNotFound(res, GROUP_NOT_FOUND);
    res.status(422);
    return renderDetail(res, detail, { values: result.values, errors: result.errors });
  }
  req.session.flash = { kind: 'joined', slug };
  res.redirect(303, `/grupos/${slug}#participar`);
});

groupsRouter.post('/grupos/:slug/sair', requireAuth, async (req, res) => {
  const { slug } = req.params;
  if (!isSlug(slug)) return renderNotFound(res, GROUP_NOT_FOUND);
  if (await leaveGroup(slug, req.user.id)) req.session.flash = { kind: 'left', slug };
  res.redirect(303, `/grupos/${slug}`);
});
