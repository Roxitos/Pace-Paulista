import { listJoinedSlugs } from '../modules/memberships/memberships.service.js';

// Slugs dos grupos em que o usuário participa, para os cards e o badge do cabeçalho.
// Visitante não gera consulta.
export async function joinedGroups(req, res, next) {
  try {
    res.locals.joinedSlugs = req.user ? new Set(await listJoinedSlugs(req.user.id)) : new Set();
    next();
  } catch (err) {
    next(err);
  }
}
