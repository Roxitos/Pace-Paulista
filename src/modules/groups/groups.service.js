import { env } from '../../config/env.js';
import { activeChips, filtersToQuery, parseFilters } from '../../domain/filters.js';
import { fmtDataCurta, fmtDataLonga, fmtEncontro, proximos } from '../../domain/schedule.js';
import { slugify, nextSlug } from '../../domain/slug.js';
import { parseGroupForm } from './groups.schemas.js';
import * as groupsRepo from './groups.repo.js';
import * as membershipsRepo from '../memberships/memberships.repo.js';

export function listPublishedGroups(filters) {
  return groupsRepo.listPublished(filters);
}

export function listGroupsForMatching() {
  return groupsRepo.listPublishedByCreation();
}

export async function searchGroups(query) {
  const filters = parseFilters(query);
  return {
    filters,
    groups: await listPublishedGroups(filters),
    chips: activeChips(filters),
    query: filtersToQuery(filters),
  };
}

// O contato só é exibido para quem está logado (P4): para visitante ele nem chega à view,
// então não tem como vazar em HTML escondido, comentário ou atributo.
export async function getGroupDetail(slug, now, { viewer = null } = {}) {
  const found = await groupsRepo.findPublishedBySlug(slug);
  if (!found) return null;
  const group = viewer ? found : { ...found, contact: null };
  const dates = proximos(group, now, { timeZone: env.TZ_APP });
  const sessions = dates.map((d) => fmtEncontro(d, env.TZ_APP));
  const nextSession = dates.length
    ? { curta: fmtDataCurta(dates[0], env.TZ_APP), longa: fmtDataLonga(dates[0], env.TZ_APP) }
    : null;
  const isOwner = Boolean(viewer) && group.owner_id === String(viewer.id);
  const nickname = viewer ? await membershipsRepo.findNickname(viewer.id, slug) : null;
  const membership = nickname === null ? null : { nickname };
  return { group, sessions, isOwner, membership, nextSession };
}

export async function listMyGroups(userId) {
  const [joined, mine] = await Promise.all([
    groupsRepo.listJoinedBy(userId),
    groupsRepo.listOwnedBy(userId),
  ]);
  return { joined, mine };
}

const NAME_TAKEN = 'Já existe um grupo com esse nome.';
const SLUG_ATTEMPTS = 3;

export async function createGroup(body, ownerId) {
  const { values, errors, data } = parseGroupForm(body);
  // 'nome' vem primeiro para manter a ordem do form (o 1º erro recebe o foco).
  const nameTaken = !errors.nome && (await groupsRepo.nameExists(values.nome));
  if (nameTaken) return { values, errors: { nome: NAME_TAKEN, ...errors } };
  if (!data) return { values, errors };

  for (let attempt = 1; ; attempt++) {
    const base = slugify(data.name);
    const slug = nextSlug(base, await groupsRepo.findSlugsLike(base));
    try {
      return await groupsRepo.insertGroup(data, ownerId, slug);
    } catch (err) {
      if (err.code !== '23505') throw err;
      // Corrida com outro cadastro: o nome ou o slug acabou de ser ocupado.
      if (err.constraint === 'groups_name_key') return { values, errors: { nome: NAME_TAKEN } };
      if (err.constraint !== 'groups_slug_key' || attempt >= SLUG_ATTEMPTS) throw err;
    }
  }
}
