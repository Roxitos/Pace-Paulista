import { describe, expect, it } from 'vitest';
import {
  hasMatchParams,
  MATCH_FIELDS,
  parseMatchForm,
} from '../../src/modules/matching/matching.schemas.js';

const MSG = {
  zona: 'Escolha uma zona ou "Qualquer zona".',
  paceVazio: 'Informe seu pace aproximado.',
  paceFormato: 'Use o formato 6:00, entre 3:00 e 12:00 min/km.',
  dias: 'Selecione pelo menos um dia.',
  nivel: 'Escolha seu nível.',
};

const VALID = { zona: 'sul', pace: '5:00', dias: ['seg', 'qua'], nivel: 'avancado', periodo: '' };

describe('hasMatchParams', () => {
  it('é false sem nenhuma chave do form', () => {
    expect(hasMatchParams({})).toBe(false);
    expect(hasMatchParams({ utm_source: 'x' })).toBe(false);
    expect(hasMatchParams(null)).toBe(false);
    expect(hasMatchParams(Object.create({ pace: '6:00' }))).toBe(false);
  });

  it.each(MATCH_FIELDS)('é true com %s, mesmo vazio', (key) => {
    expect(hasMatchParams({ [key]: '' })).toBe(true);
  });
});

describe('parseMatchForm', () => {
  it('válido → q com pace em segundos e sem erros', () => {
    expect(parseMatchForm({ ...VALID, periodo: 'cedo' })).toEqual({
      values: {
        zona: 'sul',
        pace: '5:00',
        dias: ['seg', 'qua'],
        nivel: 'avancado',
        periodo: 'cedo',
      },
      errors: {},
      q: { zona: 'sul', pace: 300, dias: ['seg', 'qua'], nivel: 'avancado', periodo: 'cedo' },
    });
  });

  it('aceita "qualquer" como zona', () => {
    expect(parseMatchForm({ ...VALID, zona: 'qualquer' }).q.zona).toBe('qualquer');
  });

  it('vazio → 4 erros na ordem zona, pace, dias, nivel', () => {
    const { errors, q, values } = parseMatchForm({ pace: '', periodo: '' });
    expect(Object.entries(errors)).toEqual([
      ['zona', MSG.zona],
      ['pace', MSG.paceVazio],
      ['dias', MSG.dias],
      ['nivel', MSG.nivel],
    ]);
    expect(q).toBeNull();
    expect(values).toEqual({ zona: '', pace: '', dias: [], nivel: '', periodo: '' });
  });

  it('nunca lança com entrada que não é objeto', () => {
    expect(parseMatchForm(undefined).q).toBeNull();
    expect(Object.keys(parseMatchForm('x').errors)).toHaveLength(4);
  });

  it.each(['', '   '])('pace vazio (%j) → "Informe seu pace aproximado."', (pace) => {
    expect(parseMatchForm({ ...VALID, pace }).errors).toEqual({ pace: MSG.paceVazio });
  });

  it.each([
    '6',
    '6:60',
    '2:59',
    '12:01',
    'abc',
    '6:5',
    '\uff15:00',
    '\u0666:00',
    '-6:00',
    '6:00:00',
    '0012:00',
  ])('pace %j → erro de formato', (pace) => {
    const r = parseMatchForm({ ...VALID, pace });
    expect(r.errors).toEqual({ pace: MSG.paceFormato });
    expect(r.values.pace).toBe(pace);
  });

  it.each([
    ['3:00', 180],
    ['12:00', 720],
    [' 06:00 ', 360],
  ])('pace %j → %i s', (pace, s) => {
    const r = parseMatchForm({ ...VALID, pace });
    expect(r.q.pace).toBe(s);
    expect(r.values.pace).toBe(pace.trim());
  });

  it('zona inválida ou chave de protótipo → erro de zona', () => {
    for (const zona of ['marte', '__proto__', 'constructor', ['marte']]) {
      const r = parseMatchForm({ ...VALID, zona });
      expect(r.errors).toEqual({ zona: MSG.zona });
      expect(r.values.zona).toBe('');
    }
  });

  it('nível inválido ou chave de protótipo → erro de nível', () => {
    for (const nivel of ['__proto__', 'constructor', 'pro']) {
      expect(parseMatchForm({ ...VALID, nivel }).errors).toEqual({ nivel: MSG.nivel });
    }
  });

  it('dias inválidos são descartados; sem nenhum válido → erro', () => {
    expect(parseMatchForm({ ...VALID, dias: 'xyz' }).errors).toEqual({ dias: MSG.dias });
    expect(parseMatchForm({ ...VALID, dias: ['seg', 'xyz'] }).q.dias).toEqual(['seg']);
    expect(parseMatchForm({ ...VALID, dias: '__proto__' }).errors).toEqual({ dias: MSG.dias });
  });

  it('dias string vira lista; repetidos e fora de ordem viram únicos em DIA_ORDEM', () => {
    expect(parseMatchForm({ ...VALID, dias: 'sab' }).q.dias).toEqual(['sab']);
    expect(parseMatchForm({ ...VALID, dias: ['dom', 'seg', 'dom', 'qua'] }).q.dias).toEqual([
      'seg',
      'qua',
      'dom',
    ]);
  });

  it('periodo inválido vira "" (Qualquer horário), sem erro', () => {
    for (const periodo of ['constructor', '__proto__', 'madrugada', ['x']]) {
      const r = parseMatchForm({ ...VALID, periodo });
      expect(r.errors).toEqual({});
      expect(r.q.periodo).toBe('');
    }
  });

  it('valor repetido usa o primeiro (exceto dias)', () => {
    const r = parseMatchForm({
      ...VALID,
      zona: ['sul', 'norte'],
      nivel: ['iniciante', 'avancado'],
    });
    expect(r.q.zona).toBe('sul');
    expect(r.q.nivel).toBe('iniciante');
    expect(parseMatchForm({ ...VALID, pace: ['6:00', '7:00'] }).q.pace).toBe(360);
  });

  it('valor que não é string conta como ausente (pace[a]=1)', () => {
    expect(parseMatchForm({ ...VALID, pace: { a: '1' } }).errors).toEqual({ pace: MSG.paceVazio });
    expect(parseMatchForm({ ...VALID, zona: { a: 'sul' } }).errors).toEqual({ zona: MSG.zona });
  });

  it('ignora chaves herdadas do protótipo do objeto', () => {
    const input = Object.create({ zona: 'sul', pace: '5:00', dias: ['seg'], nivel: 'avancado' });
    expect(Object.keys(parseMatchForm(input).errors)).toHaveLength(4);
  });
});
