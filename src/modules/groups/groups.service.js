import * as groupsRepo from './groups.repo.js';

export function listPublishedGroups() {
  return groupsRepo.listPublished();
}
