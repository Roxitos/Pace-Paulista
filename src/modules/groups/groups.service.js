import { env } from '../../config/env.js';
import { activeChips, parseFilters } from '../../domain/filters.js';
import { fmtEncontro, proximos } from '../../domain/schedule.js';
import * as groupsRepo from './groups.repo.js';

export function listPublishedGroups(filters) {
  return groupsRepo.listPublished(filters);
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
  return { group, sessions };
}
