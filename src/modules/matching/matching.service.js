import { rankMatches } from '../../domain/match.js';
import { listGroupsForMatching } from '../groups/groups.service.js';

export async function findMatches(q) {
  return rankMatches(await listGroupsForMatching(), q);
}
