import { env } from '../../config/env.js';
import { activeChips, parseFilters } from '../../domain/filters.js';
import { fmtEncontro, proximos } from '../../domain/schedule.js';
import { slugify, nextSlug } from '../../domain/slug.js';
import { parseGroupForm } from './groups.schemas.js';
import * as groupsRepo from './groups.repo.js';

export function listPublishedGroups(filters) {
  return groupsRepo.listPublished(filters);
}

export function listGroupsForMatching() {
  return groupsRepo.listPublishedByCreation();
}

export async function searchGroups(query) {
  const filters = parseFilters(query);
  return { filters, groups: await listPublishedGroups(filters), chips: activeChips(filters) };
}

// O contato só é exibido para quem está logado (P4): para visitante ele nem chega à view,
// então não tem como vazar em HTML escondido, comentário ou atributo.
export async function getGroupDetail(slug, now, { viewer = null } = {}) {
  const found = await groupsRepo.findPublishedBySlug(slug);
  if (!found) return null;
  const group = viewer ? found : { ...found, contact: null };
  const sessions = proximos(group, now, { timeZone: env.TZ_APP }).map((d) =>
    fmtEncontro(d, env.TZ_APP),
  );
  const isOwner = Boolean(viewer) && group.owner_id === String(viewer.id);
  return { group, sessions, isOwner };
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
