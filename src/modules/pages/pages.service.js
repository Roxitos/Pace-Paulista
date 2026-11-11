import { DESTAQUES, ZONA_ORDEM } from '../../domain/constants.js';
import { pinPos } from '../../domain/map.js';
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

// O contato só pode chegar a quem está logado (P4) e o mapa nem o exibe: sai aqui, antes da view,
// para não ter como vazar em data-*, JSON ou comentário.
function toMapGroup(group) {
  const g = { ...group, pin: pinPos(group) };
  delete g.contact;
  return g;
}

export function getMapData(groups, selectedSlug) {
  const list = groups.map(toMapGroup);
  const selected = selectedSlug ? list.find((g) => g.slug === selectedSlug) : list[0];
  return { groups: list, selected: selected ?? null };
}

export async function loadHomeData() {
  return getHomeData(await listPublishedGroups());
}

export async function loadZonesData() {
  return getZonesData(await listPublishedGroups());
}

// null = o slug pedido não está entre os publicados (a rota responde 404).
export async function loadMapData(selectedSlug) {
  const data = getMapData(await listPublishedGroups(), selectedSlug);
  if (selectedSlug && !data.selected) return null;
  return data;
}
