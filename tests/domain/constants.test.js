import { describe, expect, it } from 'vitest';
import { DEMO_GROUPS } from '../../db/seeds/demo-groups.js';
import { DESTAQUES, ZONA_ORDEM, ZONAS } from '../../src/domain/constants.js';

describe('constantes', () => {
  it('mantém a ordem das zonas do protótipo', () => {
    expect(ZONA_ORDEM).toEqual(['norte', 'oeste', 'centro', 'leste', 'sul']);
    expect(Object.keys(ZONAS).sort()).toEqual([...ZONA_ORDEM].sort());
  });

  it.each([
    ['norte', '#5E9A22', '#FFFFFF', 'Serra da Cantareira'],
    ['oeste', '#7A3FA0', '#FFFFFF', 'Ponte Estaiada'],
    ['centro', '#E8892B', '#17171A', 'Avenida Paulista'],
    ['leste', '#C8402F', '#FFFFFF', 'Arena Corinthians'],
    ['sul', '#3A78C2', '#FFFFFF', 'Oca do Ibirapuera'],
  ])('zona %s usa cor %s, texto %s e marco %s', (z, cor, on, marco) => {
    expect(ZONAS[z]).toMatchObject({ cor, on, marco });
  });

  it('todo destaque existe nos grupos demo', () => {
    const slugs = DEMO_GROUPS.map((g) => g.slug);
    for (const slug of DESTAQUES) expect(slugs).toContain(slug);
  });
});
