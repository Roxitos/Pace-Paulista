import { activeChips, parseFilters } from '../../domain/filters.js';
import * as groupsRepo from './groups.repo.js';

export function listPublishedGroups(filters) {
  return groupsRepo.listPublished(filters);
}

export async function searchGroups(query) {
  const filters = parseFilters(query);
  return { filters, groups: await listPublishedGroups(filters), chips: activeChips(filters) };
}
