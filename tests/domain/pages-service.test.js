import { describe, expect, it } from 'vitest';
import { DEMO_GROUPS } from '../../db/seeds/demo-groups.js';
import { ZONA_ORDEM } from '../../src/domain/constants.js';
import { getHomeData, getZonesData } from '../../src/modules/pages/pages.service.js';

// Mesmo formato que o groups.repo devolve: participants já calculado.
const GROUPS = DEMO_GROUPS.map((g) => ({ ...g, participants: g.base_participants }));

// Ordem do repo (zona em ZONA_ORDEM, depois nome), como chega em produção.
const REPO_ORDER = [...GROUPS].sort(
  (a, b) =>
    ZONA_ORDEM.indexOf(a.zone) - ZONA_ORDEM.indexOf(b.zone) || a.name.localeCompare(b.name, 'pt'),
);

describe('getHomeData', () => {
  it('resume os grupos demo para a home', () => {
    const data = getHomeData(GROUPS);
    expect(data.totalGroups).toBe(11);
    expect(data.paceMinS).toBe(240);
    expect(data.paceMaxS).toBe(510);
    expect(data.countsByZone).toEqual({ norte: 2, oeste: 2, centro: 2, leste: 2, sul: 3 });
    expect(data.hasDemo).toBe(true);
  });

  it('devolve os destaques na ordem de DESTAQUES com participants', () => {
    const { featured } = getHomeData(GROUPS);
    expect(featured.map((g) => g.slug)).toEqual([
      'correria-do-carmo',
      'pace-da-oca',
      'pelotao-paulista',
    ]);
    expect(featured.map((g) => g.participants)).toEqual([48, 56, 72]);
  });

  it('usa o participants recebido em vez de recalcular por base_participants', () => {
    const groups = GROUPS.map((g) => (g.slug === 'pace-da-oca' ? { ...g, participants: 99 } : g));
    const oca = getHomeData(groups).featured.find((g) => g.slug === 'pace-da-oca');
    expect(oca.participants).toBe(99);
  });

  it('não marca demonstração quando nenhum grupo é demo', () => {
    const groups = GROUPS.map((g) => ({ ...g, is_demo: false }));
    expect(getHomeData(groups).hasDemo).toBe(false);
  });

  it('ignora slug de destaque ausente e conta zona sem grupo como 0', () => {
    const groups = GROUPS.filter((g) => g.slug !== 'pace-da-oca' && g.zone !== 'norte');
    const data = getHomeData(groups);
    expect(data.featured.map((g) => g.slug)).toEqual(['correria-do-carmo', 'pelotao-paulista']);
    expect(data.countsByZone.norte).toBe(0);
  });

  it('não altera os grupos recebidos', () => {
    const snapshot = structuredClone(GROUPS);
    getHomeData(GROUPS);
    expect(GROUPS).toEqual(snapshot);
  });
});

describe('getHomeData com dados de borda', () => {
  it('lista vazia não gera Infinity: faixa de pace vira null', () => {
    expect(getHomeData([])).toEqual({
      totalGroups: 0,
      paceMinS: null,
      paceMaxS: null,
      countsByZone: { norte: 0, oeste: 0, centro: 0, leste: 0, sul: 0 },
      featured: [],
      hasDemo: false,
    });
  });

  it.each(['marte', 'toString', '__proto__', undefined])(
    'ignora zona desconhecida (%s) na contagem',
    (zone) => {
      const groups = [{ ...GROUPS[0], zone }, GROUPS[1]];
      const { countsByZone } = getHomeData(groups);
      expect(countsByZone).toEqual({ norte: 0, oeste: 0, centro: 0, leste: 1, sul: 0 });
      expect(Object.keys(countsByZone)).toEqual(['norte', 'oeste', 'centro', 'leste', 'sul']);
    },
  );
});

describe('getZonesData', () => {
  it('devolve as 5 zonas na ordem de ZONA_ORDEM com contagem', () => {
    const zones = getZonesData(REPO_ORDER);
    expect(zones.map((z) => z.zone)).toEqual(ZONA_ORDEM);
    expect(zones.map((z) => z.count)).toEqual([2, 2, 2, 2, 3]);
  });

  it('lista os locais distintos na ordem da lista recebida', () => {
    const zones = Object.fromEntries(getZonesData(REPO_ORDER).map((z) => [z.zone, z]));
    expect(zones.sul).toEqual({
      zone: 'sul',
      count: 3,
      locations: ['Parque Ibirapuera', 'Parque Guarapiranga'],
    });
    expect(zones.norte.locations).toEqual([
      'Parque Estadual Alberto Löfgren (Horto Florestal)',
      'Parque da Juventude',
    ]);
    expect(zones.oeste.locations).toEqual(['Cidade Universitária (USP)', 'Parque Villa-Lobos']);
    expect(zones.centro.locations).toEqual([
      'Elevado Presidente João Goulart (Minhocão)',
      'Avenida Paulista',
    ]);
    expect(zones.leste.locations).toEqual(['Parque do Carmo', 'Parque Ecológico do Tietê']);
  });

  it('lista vazia devolve as 5 zonas com 0 e sem locais', () => {
    expect(getZonesData([])).toEqual(ZONA_ORDEM.map((zone) => ({ zone, count: 0, locations: [] })));
  });

  it.each(['marte', 'toString', '__proto__', undefined])(
    'ignora zona desconhecida (%s)',
    (zone) => {
      const zones = getZonesData([{ ...GROUPS[0], zone, location: 'Lugar X' }, GROUPS[1]]);
      expect(zones).toHaveLength(5);
      expect(zones.map((z) => z.count)).toEqual([0, 0, 0, 1, 0]);
      expect(zones.flatMap((z) => z.locations)).toEqual(['Parque Ecológico do Tietê']);
    },
  );
});
