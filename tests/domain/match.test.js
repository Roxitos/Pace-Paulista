import { describe, expect, it } from 'vitest';
import { calcMatch, MATCH_LIMIT, MATCH_MIN_PCT, rankMatches } from '../../src/domain/match.js';

// Grupo sintético: Zona Sul, 5:00–6:00, seg/qua/sex às 06:00, intermediário.
const G = {
  slug: 'grupo-teste',
  zone: 'sul',
  pace_min_s: 300,
  pace_max_s: 360,
  days: ['seg', 'qua', 'sex'],
  level: 'intermediario',
  start_time: '06:00',
};

// Respostas base: zona e dias errados, pace na faixa (35) e mesmo nível (15) = 50%.
const Q = { zona: 'norte', pace: 330, dias: ['dom'], nivel: 'intermediario', periodo: '' };

const match = (q, g = G) => calcMatch(g, { ...Q, ...q });

describe('calcMatch — zona (30)', () => {
  it('zona igual soma 30 e dá o motivo "Fica na Zona Sul"', () => {
    expect(match({ zona: 'sul' })).toEqual({
      pct: 80,
      why: ['Fica na Zona Sul', 'Seu pace está na faixa do grupo', 'Mesmo nível que você'],
    });
  });

  it('zona diferente não soma', () => {
    const r = match({});
    expect(r.pct).toBe(50);
    expect(r.why).not.toContain('Fica na Zona Sul');
  });

  it('"qualquer" soma 30 sem motivo de zona', () => {
    const r = match({ zona: 'qualquer' });
    expect(r.pct).toBe(80);
    expect(r.why.some((w) => w.startsWith('Fica na'))).toBe(false);
  });

  it('usa o nome literal da zona: "Fica na Centro"', () => {
    expect(match({ zona: 'centro' }, { ...G, zone: 'centro' }).why[0]).toBe('Fica na Centro');
  });
});

describe('calcMatch — pace (35)', () => {
  const pace = (p) => match({ pace: p });
  it.each([300, 360, 330])('%i s está na faixa (bordas inclusivas): 35 e motivo', (p) => {
    expect(pace(p)).toEqual({
      pct: 50,
      why: ['Seu pace está na faixa do grupo', 'Mesmo nível que você'],
    });
  });

  it.each([270, 390])('a 30 s da borda (%i) soma 20 com motivo', (p) => {
    expect(pace(p)).toEqual({
      pct: 35,
      why: ['Seu pace está a até 30 s/km da faixa', 'Mesmo nível que você'],
    });
  });

  it.each([269, 391, 240, 420])('a 31–60 s da borda (%i) soma 8 sem motivo', (p) => {
    expect(pace(p)).toEqual({ pct: 23, why: ['Mesmo nível que você'] });
  });

  it.each([239, 421, 180, 720])('a mais de 60 s da borda (%i) não soma', (p) => {
    expect(pace(p)).toEqual({ pct: 15, why: ['Mesmo nível que você'] });
  });
});

describe('calcMatch — dias (20)', () => {
  it('lista os dias em comum em DIA_ORDEM, por extenso e em minúsculas', () => {
    const r = match({ dias: ['sex', 'seg', 'qua'] });
    expect(r.why).toContain('Treina segunda, quarta e sexta');
    expect(r.pct).toBe(70);
  });

  it('um dia em comum: "Treina sábado"', () => {
    expect(match({ dias: ['sab'] }, { ...G, days: ['sab'] }).why).toContain('Treina sábado');
  });

  it('nenhum dia em comum não soma nem dá motivo', () => {
    const r = match({ dias: ['ter', 'dom'] });
    expect(r.pct).toBe(50);
    expect(r.why.some((w) => w.startsWith('Treina'))).toBe(false);
  });
});

describe('calcMatch — nível (15)', () => {
  it('nível igual soma 15 com motivo', () => {
    expect(match({}).why).toContain('Mesmo nível que você');
  });

  it('diferença de 1 nível soma 6 sem motivo', () => {
    expect(match({ nivel: 'avancado' })).toEqual({
      pct: 41,
      why: ['Seu pace está na faixa do grupo'],
    });
  });

  it('diferença de 2 níveis não soma', () => {
    expect(match({ nivel: 'iniciante' }, { ...G, level: 'avancado' })).toEqual({
      pct: 35,
      why: ['Seu pace está na faixa do grupo'],
    });
  });
});

describe('calcMatch — período (10, só se informado)', () => {
  const full = { zona: 'sul', dias: ['seg'] };

  it('período vazio: máximo 100', () => {
    expect(match(full).pct).toBe(100);
  });

  it('período igual soma 10 com motivo (100/110 → 100)', () => {
    const r = match({ ...full, periodo: 'cedo' });
    expect(r.pct).toBe(100);
    expect(r.why.at(-1)).toBe('No horário que você prefere');
  });

  it('período diferente: máximo 110 (100/110 → 91)', () => {
    const r = match({ ...full, periodo: 'noite' });
    expect(r.pct).toBe(91);
    expect(r.why).not.toContain('No horário que você prefere');
  });

  it('44/110 → 40 e 60/110 → 55', () => {
    // 30 zona + 8 pace + 6 nível = 44; 30 + 20 + 0 + 10 = 60.
    expect(match({ zona: 'sul', pace: 240, nivel: 'avancado', periodo: 'noite' }).pct).toBe(40);
    const avancado = { ...G, level: 'avancado', pace_max_s: 400 };
    const q = { zona: 'sul', pace: 420, nivel: 'iniciante', periodo: 'cedo' };
    expect(match(q, avancado).pct).toBe(55);
  });
});

describe('calcMatch — geral', () => {
  it('motivos na ordem zona, pace, dias, nível, período', () => {
    expect(match({ zona: 'sul', dias: ['qua', 'seg'], periodo: 'cedo' }).why).toEqual([
      'Fica na Zona Sul',
      'Seu pace está na faixa do grupo',
      'Treina segunda e quarta',
      'Mesmo nível que você',
      'No horário que você prefere',
    ]);
  });

  it('lança RangeError para zona ou nível desconhecidos', () => {
    expect(() => match({}, { ...G, zone: 'marte' })).toThrow(RangeError);
    expect(() => match({ zona: '__proto__' })).toThrow(RangeError);
    expect(() => match({}, { ...G, level: 'pro' })).toThrow(RangeError);
    expect(() => match({ nivel: 'constructor' })).toThrow(RangeError);
  });
});

describe('rankMatches', () => {
  // Período informado e nunca batido (grupos às 06:00): máximo 110, o que permite 39%.
  const q = { zona: 'sul', pace: 330, dias: ['seg'], nivel: 'intermediario', periodo: 'noite' };
  const g = (slug, over = {}) => ({ ...G, slug, ...over });
  // 30 zona + 8 pace (40 s da borda) + 0 dias + 6 nível = 44/110 → 40%.
  const g40 = g('quarenta', { days: ['ter'], level: 'avancado', pace_min_s: 370, pace_max_s: 400 });
  // 0 zona + 8 pace + 20 dias + 15 nível = 43/110 → 39%.
  const g39 = g('trinta-e-nove', { zone: 'norte', pace_min_s: 370, pace_max_s: 400 });
  // 30 + 35 + 20 + 15 = 100/110 → 91%.
  const top = (slug) => g(slug);

  it(`entra com ${MATCH_MIN_PCT}% e sai com 39%`, () => {
    expect(calcMatch(g40, q).pct).toBe(40);
    expect(calcMatch(g39, q).pct).toBe(39);
    expect(rankMatches([g39, g40], q).map((r) => r.group.slug)).toEqual(['quarenta']);
  });

  it('ordena por pct decrescente e devolve group, pct e why', () => {
    const a = top('a');
    const out = rankMatches([g40, a], q);
    expect(out.map((r) => [r.group.slug, r.pct])).toEqual([
      ['a', 91],
      ['quarenta', 40],
    ]);
    expect(out[0].group).toBe(a);
    expect(out[0].why).toEqual(calcMatch(a, q).why);
  });

  it('empate mantém a ordem de entrada', () => {
    const slugs = (list) => rankMatches(list, q).map((r) => r.group.slug);
    expect(slugs([top('b'), g40, top('a')])).toEqual(['b', 'a', 'quarenta']);
    expect(slugs([top('a'), top('b')])).toEqual(['a', 'b']);
  });

  it(`devolve no máximo ${MATCH_LIMIT}`, () => {
    const list = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map(top);
    expect(rankMatches(list, q).map((r) => r.group.slug)).toEqual(['a', 'b', 'c', 'd', 'e', 'f']);
  });

  it('lista vazia → []', () => {
    expect(rankMatches([], q)).toEqual([]);
  });

  it('não muta a entrada', () => {
    const list = [g40, top('a'), g39];
    const copy = structuredClone(list);
    rankMatches(list, q);
    expect(list).toEqual(copy);
    expect(list[0]).toBe(g40);
  });
});
