import { describe, expect, it } from 'vitest';
import { DEMO_GROUPS } from '../../db/seeds/demo-groups.js';
import { DESTAQUES, PACE_FAIXAS, PERIODOS, ZONA_ORDEM, ZONAS } from '../../src/domain/constants.js';

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

  it('PERIODOS são iguais ao protótipo, na mesma ordem', () => {
    expect(Object.entries(PERIODOS)).toEqual([
      ['cedo', 'Antes das 7h'],
      ['manha', 'Das 7h às 12h'],
      ['tarde', 'Das 12h às 18h'],
      ['noite', 'A partir das 18h'],
    ]);
  });

  it('PACE_FAIXAS são iguais ao protótipo, em segundos por km', () => {
    expect(Object.entries(PACE_FAIXAS)).toEqual([
      ['ate5', { nome: 'Até 5:00 min/km', min: 0, max: 300 }],
      ['5a6', { nome: '5:00 a 6:00 min/km', min: 300, max: 360 }],
      ['6a7', { nome: '6:00 a 7:00 min/km', min: 360, max: 420 }],
      ['mais7', { nome: 'Acima de 7:00 min/km', min: 420, max: 9999 }],
    ]);
  });
});
