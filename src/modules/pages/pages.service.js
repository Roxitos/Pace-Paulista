import { DEMO_GROUPS } from '../../../db/seeds/demo-groups.js';
import { DESTAQUES, ZONA_ORDEM } from '../../domain/constants.js';

// Recebe a lista por parâmetro: no M3 a fonte vira o groups.repo e a view não muda.
export function getHomeData(groups = DEMO_GROUPS) {
  const countsByZone = Object.fromEntries(ZONA_ORDEM.map((z) => [z, 0]));
  for (const g of groups) {
    if (Object.hasOwn(countsByZone, g.zone)) countsByZone[g.zone] += 1;
  }

  const featured = DESTAQUES.map((slug) => groups.find((g) => g.slug === slug))
    .filter(Boolean)
    .map((g) => ({ ...g, participants: g.base_participants }));

  // Sem grupos, Math.min/max dariam ±Infinity; null deixa a view decidir o que omitir.
  const empty = groups.length === 0;
  return {
    totalGroups: groups.length,
    paceMinS: empty ? null : Math.min(...groups.map((g) => g.pace_min_s)),
    paceMaxS: empty ? null : Math.max(...groups.map((g) => g.pace_max_s)),
    countsByZone,
    featured,
    hasDemo: groups.some((g) => g.is_demo),
  };
}
