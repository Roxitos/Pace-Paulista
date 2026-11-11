import { describe, expect, it } from 'vitest';
import {
  EMPTY_FILTERS,
  activeChips,
  escapeLike,
  filtersToQuery,
  parseFilters,
  periodRange,
  searchHref,
} from '../../src/domain/filters.js';
import { periodoDe } from '../../src/domain/schedule.js';

const ALL = {
  zonas: ['leste', 'sul'],
  nome: 'pace',
  local: 'ibirapuera',
  dia: 'sab',
  periodo: 'cedo',
  pace: '5a6',
  nivel: 'iniciante',
};

describe('EMPTY_FILTERS', () => {
  it('tem o formato de state.filters do protótipo e é congelado', () => {
    expect(EMPTY_FILTERS).toEqual({
      zonas: [],
      nome: '',
      local: '',
      dia: '',
      periodo: '',
      pace: '',
      nivel: '',
    });
    expect(Object.isFrozen(EMPTY_FILTERS)).toBe(true);
    expect(Object.isFrozen(EMPTY_FILTERS.zonas)).toBe(true);
  });
});

describe('parseFilters', () => {
  it('sem parâmetros devolve EMPTY_FILTERS', () => {
    expect(parseFilters({})).toEqual(EMPTY_FILTERS);
  });

  it.each([undefined, null, 'zona=sul', 42])('nunca lança com query %s', (q) => {
    expect(parseFilters(q)).toEqual(EMPTY_FILTERS);
  });

  it('aceita zona como string', () => {
    expect(parseFilters({ zona: 'sul' }).zonas).toEqual(['sul']);
  });

  it('ordena zonas por ZONA_ORDEM e remove repetidas', () => {
    expect(parseFilters({ zona: ['sul', 'leste', 'sul', 'norte'] }).zonas).toEqual([
      'norte',
      'leste',
      'sul',
    ]);
  });

  it('descarta zonas inválidas', () => {
    expect(parseFilters({ zona: ['marte', 'sul', 'constructor', ''] }).zonas).toEqual(['sul']);
    expect(parseFilters({ zona: 'Sul' }).zonas).toEqual([]);
  });

  it('remove espaços das pontas de nome e local', () => {
    const f = parseFilters({ nome: '  pace  ', local: '\tibirapuera ' });
    expect(f.nome).toBe('pace');
    expect(f.local).toBe('ibirapuera');
  });

  it('corta nome e local em 80 caracteres', () => {
    const f = parseFilters({ nome: 'a'.repeat(200), local: 'b'.repeat(81) });
    expect(f.nome).toBe('a'.repeat(80));
    expect(f.local).toBe('b'.repeat(80));
  });

  it('corta por caractere, sem partir emoji ao meio', () => {
    const f = parseFilters({ nome: '🏃'.repeat(100) });
    expect(Array.from(f.nome)).toHaveLength(80);
    expect(f.nome).toBe('🏃'.repeat(80));
  });

  it('normaliza nome e local para NFC: "pelotão" decomposto vira o mesmo termo do banco', () => {
    // "a" + til combinante (U+0303), como vem de texto colado de algumas fontes (macOS).
    const f = parseFilters({ nome: 'pelota\u0303o', local: 'Lo\u0308fgren' });
    expect(f.nome).toBe('pelotão');
    expect(f.local).toBe('Löfgren');
  });

  it('o corte em 80 não deixa espaço no fim: reler a query dos chips devolve os mesmos filtros', () => {
    const f = parseFilters({
      nome: `${'a'.repeat(79)} b`,
      local: `${'c'.repeat(79)}\u00a0d`,
      dia: 'sab',
    });
    expect(f.nome).toBe('a'.repeat(79));
    expect(f.local).toBe('c'.repeat(79));
    const reparsed = parseFilters(Object.fromEntries(new URLSearchParams(filtersToQuery(f))));
    expect(reparsed).toEqual(f);
  });

  it('remove o caractere NUL, que o Postgres recusa', () => {
    expect(parseFilters({ nome: 'pa\0ce', local: '\0' })).toMatchObject({
      nome: 'pace',
      local: '',
    });
  });

  it('usa o primeiro valor quando o parâmetro vem repetido', () => {
    const f = parseFilters({
      nome: ['pace', 'oca'],
      local: ['ibira', 'carmo'],
      dia: ['sab', 'dom'],
      nivel: ['xyz', 'iniciante'],
    });
    expect(f).toMatchObject({ nome: 'pace', local: 'ibira', dia: 'sab', nivel: '' });
  });

  it('ignora parâmetros em formato de objeto', () => {
    const f = parseFilters({
      nome: { a: '1' },
      local: [{}, 'x'],
      zona: { 0: 'sul' },
      pace: { toString: () => 'ate5' },
    });
    expect(f).toEqual(EMPTY_FILTERS);
  });

  it('ignora chaves desconhecidas', () => {
    expect(parseFilters({ 'zona[]': 'sul', 'nome[a]': '1', foo: 'bar' })).toEqual(EMPTY_FILTERS);
  });

  it.each([
    ['dia', 'toString'],
    ['dia', 'xyz'],
    ['periodo', 'hasOwnProperty'],
    ['pace', 'constructor'],
    ['pace', '__proto__'],
    ['nivel', '__proto__'],
    ['nivel', 'Iniciante'],
  ])('%s=%s vira vazio', (key, value) => {
    expect(parseFilters({ [key]: value })[key]).toBe('');
  });

  it('aceita os valores válidos de cada filtro', () => {
    expect(
      parseFilters({
        zona: ['sul', 'leste'],
        nome: 'pace',
        local: 'ibirapuera',
        dia: 'sab',
        periodo: 'cedo',
        pace: '5a6',
        nivel: 'iniciante',
      }),
    ).toEqual(ALL);
  });

  it('não lê chaves herdadas do protótipo de Object', () => {
    const q = Object.create({ nome: 'herdado', zona: 'sul' });
    expect(parseFilters(q)).toEqual(EMPTY_FILTERS);
  });
});

describe('filtersToQuery e searchHref', () => {
  it('sem filtros devolve string vazia e /grupos', () => {
    expect(filtersToQuery(EMPTY_FILTERS)).toBe('');
    expect(searchHref(EMPTY_FILTERS)).toBe('/grupos');
  });

  it('segue a ordem canônica: zona (uma por zona), nome, local, dia, periodo, pace, nivel', () => {
    expect(filtersToQuery(ALL)).toBe(
      'zona=leste&zona=sul&nome=pace&local=ibirapuera&dia=sab&periodo=cedo&pace=5a6&nivel=iniciante',
    );
  });

  it('omite filtros vazios', () => {
    expect(filtersToQuery({ ...EMPTY_FILTERS, zonas: ['sul'], nivel: 'avancado' })).toBe(
      'zona=sul&nivel=avancado',
    );
  });

  it('codifica espaço e caracteres especiais', () => {
    const q = filtersToQuery({ ...EMPTY_FILTERS, nome: 'pace da oca', local: 'a&b=c%' });
    expect(q).toBe('nome=pace+da+oca&local=a%26b%3Dc%25');
    expect(new URLSearchParams(q).get('local')).toBe('a&b=c%');
  });

  it('searchHref monta /grupos?query', () => {
    expect(searchHref({ ...EMPTY_FILTERS, zonas: ['sul'] })).toBe('/grupos?zona=sul');
  });
});

describe('activeChips', () => {
  it('sem filtros não tem chips', () => {
    expect(activeChips(EMPTY_FILTERS)).toEqual([]);
  });

  it('usa os rótulos e a ordem do protótipo', () => {
    expect(activeChips(ALL).map((c) => c.label)).toEqual([
      'Zona Leste',
      'Zona Sul',
      'Nome: pace',
      'Local: ibirapuera',
      'Sábado',
      'Antes das 7h',
      '5:00 a 6:00 min/km',
      'Iniciante',
    ]);
  });

  it('cada href remove só aquele filtro', () => {
    const base = 'zona=leste&zona=sul&nome=pace&local=ibirapuera&dia=sab&periodo=cedo&pace=5a6';
    expect(activeChips(ALL).map((c) => c.href)).toEqual([
      '/grupos?zona=sul&nome=pace&local=ibirapuera&dia=sab&periodo=cedo&pace=5a6&nivel=iniciante',
      '/grupos?zona=leste&nome=pace&local=ibirapuera&dia=sab&periodo=cedo&pace=5a6&nivel=iniciante',
      '/grupos?zona=leste&zona=sul&local=ibirapuera&dia=sab&periodo=cedo&pace=5a6&nivel=iniciante',
      '/grupos?zona=leste&zona=sul&nome=pace&dia=sab&periodo=cedo&pace=5a6&nivel=iniciante',
      '/grupos?zona=leste&zona=sul&nome=pace&local=ibirapuera&periodo=cedo&pace=5a6&nivel=iniciante',
      '/grupos?zona=leste&zona=sul&nome=pace&local=ibirapuera&dia=sab&pace=5a6&nivel=iniciante',
      '/grupos?zona=leste&zona=sul&nome=pace&local=ibirapuera&dia=sab&periodo=cedo&nivel=iniciante',
      `/grupos?${base}`,
    ]);
  });

  it('o último chip removido leva a /grupos', () => {
    expect(activeChips({ ...EMPTY_FILTERS, zonas: ['sul'] })).toEqual([
      { label: 'Zona Sul', href: '/grupos' },
    ]);
  });

  it('não muta os filtros recebidos', () => {
    const f = { ...ALL, zonas: [...ALL.zonas] };
    activeChips(f);
    expect(f).toEqual(ALL);
  });
});

describe('escapeLike', () => {
  it('escapa barra invertida, % e _', () => {
    expect(escapeLike('50%_a\\b')).toBe('50\\%\\_a\\\\b');
  });

  it('não mexe em texto comum', () => {
    expect(escapeLike('Pelotão Paulista')).toBe('Pelotão Paulista');
  });
});

describe('periodRange', () => {
  it.each([
    ['cedo', { from: '00:00', to: '07:00' }],
    ['manha', { from: '07:00', to: '12:00' }],
    ['tarde', { from: '12:00', to: '18:00' }],
    ['noite', { from: '18:00', to: null }],
  ])('%s vai de %o', (p, range) => {
    expect(periodRange(p)).toEqual(range);
  });

  it.each(['', 'madrugada', 'constructor', '__proto__'])('lança RangeError para %s', (p) => {
    expect(() => periodRange(p)).toThrow(RangeError);
  });

  it('concorda com periodoDe em todos os minutos do dia', () => {
    const inRange = (h, { from, to }) => h >= from && (to === null || h < to);
    for (let min = 0; min < 24 * 60; min += 1) {
      const h = `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
      for (const p of ['cedo', 'manha', 'tarde', 'noite']) {
        expect(periodoDe(h) === p).toBe(inRange(h, periodRange(p)));
      }
    }
  });
});
