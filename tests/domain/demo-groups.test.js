import { describe, expect, it } from 'vitest';
import { DEMO_GROUPS } from '../../db/seeds/demo-groups.js';
import { DIA_ORDEM, NIVEIS, ZONA_ORDEM } from '../../src/domain/constants.js';

// Tabela do AGENTS.md §7: [slug, nome, zona, local, dias, hora, paceMin, paceMax, nível, part.].
const ESPERADO = [
  [
    'correria-do-carmo',
    'Correria do Carmo',
    'leste',
    'Parque do Carmo',
    ['sab'],
    '06:30',
    330,
    390,
    'intermediario',
    48,
  ],
  [
    'tiete-em-movimento',
    'Tietê em Movimento',
    'leste',
    'Parque Ecológico do Tietê',
    ['ter', 'qui'],
    '19:00',
    360,
    450,
    'iniciante',
    31,
  ],
  [
    'pelotao-paulista',
    'Pelotão Paulista',
    'centro',
    'Avenida Paulista',
    ['dom'],
    '07:00',
    285,
    345,
    'intermediario',
    72,
  ],
  [
    'minhocao-noturno',
    'Minhocão Noturno',
    'centro',
    'Elevado Presidente João Goulart (Minhocão)',
    ['qua'],
    '20:30',
    300,
    360,
    'intermediario',
    39,
  ],
  [
    'pace-da-oca',
    'Pace da Oca',
    'sul',
    'Parque Ibirapuera',
    ['seg', 'qua', 'sex'],
    '06:00',
    255,
    300,
    'avancado',
    56,
  ],
  [
    'primeiro-km-ibira',
    'Primeiro Km Ibira',
    'sul',
    'Parque Ibirapuera',
    ['sab'],
    '08:00',
    420,
    510,
    'iniciante',
    64,
  ],
  [
    'represa-run-club',
    'Represa Run Club',
    'sul',
    'Parque Guarapiranga',
    ['dom'],
    '07:30',
    330,
    405,
    'intermediario',
    22,
  ],
  [
    'villa-lobos-runners',
    'Villa-Lobos Runners',
    'oeste',
    'Parque Villa-Lobos',
    ['ter', 'qui'],
    '06:15',
    300,
    360,
    'intermediario',
    45,
  ],
  [
    'raia-usp',
    'Raia Olímpica',
    'oeste',
    'Cidade Universitária (USP)',
    ['sab'],
    '07:00',
    240,
    285,
    'avancado',
    27,
  ],
  [
    'cantareira-trail',
    'Cantareira Trail',
    'norte',
    'Parque Estadual Alberto Löfgren (Horto Florestal)',
    ['dom'],
    '07:00',
    390,
    480,
    'intermediario',
    33,
  ],
  [
    'juventude-em-pace',
    'Juventude em Pace',
    'norte',
    'Parque da Juventude',
    ['ter', 'qui'],
    '19:30',
    360,
    420,
    'iniciante',
    41,
  ],
];

describe('DEMO_GROUPS', () => {
  it('tem os 11 grupos do AGENTS.md §7, na ordem do protótipo', () => {
    const resumo = DEMO_GROUPS.map((g) => [
      g.slug,
      g.name,
      g.zone,
      g.location,
      g.days,
      g.start_time,
      g.pace_min_s,
      g.pace_max_s,
      g.level,
      g.base_participants,
    ]);
    expect(resumo).toEqual(ESPERADO);
  });

  it('tem slugs únicos', () => {
    expect(new Set(DEMO_GROUPS.map((g) => g.slug)).size).toBe(DEMO_GROUPS.length);
  });

  it.each(DEMO_GROUPS.map((g) => [g.slug, g]))('%s respeita as regras do banco', (_, g) => {
    expect(g.is_demo).toBe(true);
    expect(g.pace_min_s).toBeLessThan(g.pace_max_s);
    expect(g.pace_min_s).toBeGreaterThanOrEqual(180);
    expect(g.pace_max_s).toBeLessThanOrEqual(720);
    expect(g.days.length).toBeGreaterThan(0);
    for (const d of g.days) expect(DIA_ORDEM).toContain(d);
    expect(Object.keys(NIVEIS)).toContain(g.level);
    expect(ZONA_ORDEM).toContain(g.zone);
    expect(g.description.length).toBeGreaterThanOrEqual(30);
    expect(g.description.length).toBeLessThanOrEqual(400);
  });

  it('copia os textos do protótipo literalmente', () => {
    const g = DEMO_GROUPS.find((x) => x.slug === 'pace-da-oca');
    expect(g.description).toBe(
      'Treinos estruturados três vezes por semana: tiros às segundas, fartlek às quartas e rodagem às sextas. Para quem já corre provas e quer baixar tempo.',
    );
    expect(g.meeting_point).toBe('Combinado no grupo, nas imediações da Oca');
    expect(g.profile_tags).toEqual(['Planilha de treino', 'Tiros e fartlek', 'Foco em provas']);
    expect(g.map_pin).toEqual([200, 246]);
    expect(g.distance).toBe('10 a 14 km');
  });
});
