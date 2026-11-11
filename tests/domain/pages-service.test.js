import { describe, expect, it } from 'vitest';
import { DEMO_GROUPS } from '../../db/seeds/demo-groups.js';
import { getHomeData } from '../../src/modules/pages/pages.service.js';

describe('getHomeData', () => {
  it('resume os grupos demo para a home', () => {
    const data = getHomeData();
    expect(data.totalGroups).toBe(11);
    expect(data.paceMinS).toBe(240);
    expect(data.paceMaxS).toBe(510);
    expect(data.countsByZone).toEqual({ norte: 2, oeste: 2, centro: 2, leste: 2, sul: 3 });
    expect(data.hasDemo).toBe(true);
  });

  it('devolve os destaques na ordem de DESTAQUES com participants', () => {
    const { featured } = getHomeData();
    expect(featured.map((g) => g.slug)).toEqual([
      'correria-do-carmo',
      'pace-da-oca',
      'pelotao-paulista',
    ]);
    expect(featured.map((g) => g.participants)).toEqual([48, 56, 72]);
  });

  it('não marca demonstração quando nenhum grupo é demo', () => {
    const groups = DEMO_GROUPS.map((g) => ({ ...g, is_demo: false }));
    expect(getHomeData(groups).hasDemo).toBe(false);
  });

  it('ignora slug de destaque ausente e conta zona sem grupo como 0', () => {
    const groups = DEMO_GROUPS.filter((g) => g.slug !== 'pace-da-oca' && g.zone !== 'norte');
    const data = getHomeData(groups);
    expect(data.featured.map((g) => g.slug)).toEqual(['correria-do-carmo', 'pelotao-paulista']);
    expect(data.countsByZone.norte).toBe(0);
  });

  it('não altera os grupos recebidos', () => {
    getHomeData();
    expect(DEMO_GROUPS.some((g) => Object.hasOwn(g, 'participants'))).toBe(false);
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
      const groups = [{ ...DEMO_GROUPS[0], zone }, DEMO_GROUPS[1]];
      const { countsByZone } = getHomeData(groups);
      expect(countsByZone).toEqual({ norte: 0, oeste: 0, centro: 0, leste: 1, sul: 0 });
      expect(Object.keys(countsByZone)).toEqual(['norte', 'oeste', 'centro', 'leste', 'sul']);
    },
  );
});
