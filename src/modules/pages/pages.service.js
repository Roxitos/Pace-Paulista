import { DESTAQUES, ZONA_ORDEM } from '../../domain/constants.js';
import { listPublishedGroups } from '../groups/groups.service.js';

// Puras: recebem a lista já lida do banco, para testar sem I/O.
export function getHomeData(groups) {
  const countsByZone = Object.fromEntries(ZONA_ORDEM.map((z) => [z, 0]));
  for (const g of groups) {
    if (Object.hasOwn(countsByZone, g.zone)) countsByZone[g.zone] += 1;
  }

  const featured = DESTAQUES.map((slug) => groups.find((g) => g.slug === slug)).filter(Boolean);

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

// Locais na ordem em que aparecem na lista (a do repo), sem repetir: igual ao Set do protótipo.
export function getZonesData(groups) {
  return ZONA_ORDEM.map((zone) => {
    const list = groups.filter((g) => g.zone === zone);
    return { zone, count: list.length, locations: [...new Set(list.map((g) => g.location))] };
  });
}

export async function loadHomeData() {
  return getHomeData(await listPublishedGroups());
}

export async function loadZonesData() {
  return getZonesData(await listPublishedGroups());
}
