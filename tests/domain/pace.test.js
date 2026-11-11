import { describe, expect, it } from 'vitest';
import { fmtFaixa, fmtPace, parsePace } from '../../src/domain/pace.js';

describe('fmtPace', () => {
  it.each([
    [330, '5:30'],
    [240, '4:00'],
    [605, '10:05'],
  ])('formata %i segundos como "%s"', (s, expected) => {
    expect(fmtPace(s)).toBe(expected);
  });
});

describe('fmtFaixa', () => {
  it('formata a faixa com en dash e "min/km"', () => {
    expect(fmtFaixa(330, 390)).toBe('5:30–6:30 min/km');
  });
});

describe('parsePace', () => {
  it.each([
    ['5:30', 330],
    ['3:00', 180],
    ['12:00', 720],
    [' 5:30 ', 330],
  ])('aceita "%s" como %i segundos', (str, expected) => {
    expect(parsePace(str)).toBe(expected);
  });

  it.each(['2:59', '12:01', '5:60', '530', ''])('recusa "%s"', (str) => {
    expect(parsePace(str)).toBeNull();
  });
});

describe('fmtPace com valor inválido', () => {
  it.each([NaN, Infinity, -Infinity, -90, 330.5, '330', null, undefined])(
    'lança erro para %s em vez de renderizar lixo',
    (s) => {
      expect(() => fmtPace(s)).toThrow();
    },
  );

  it('formata zero e limites da faixa', () => {
    expect(fmtPace(0)).toBe('0:00');
    expect(fmtPace(180)).toBe('3:00');
    expect(fmtPace(720)).toBe('12:00');
    expect(fmtPace(179)).toBe('2:59');
  });

  it('fmtFaixa propaga o erro de pace inválido', () => {
    expect(() => fmtFaixa(NaN, 390)).toThrow();
    expect(() => fmtFaixa(330, Infinity)).toThrow();
  });

  it('fmtFaixa aceita min igual a max', () => {
    expect(fmtFaixa(330, 330)).toBe('5:30–5:30 min/km');
  });
});

describe('parsePace com entrada estranha', () => {
  it.each(['-5:30', '5:3', '5:300', '123:00', '5.30', '5:30:00', 'abc', '０5:30', '5: 30'])(
    'recusa "%s"',
    (str) => {
      expect(parsePace(str)).toBeNull();
    },
  );

  it.each([null, undefined, NaN, 330])('recusa %s que não é texto "m:ss"', (v) => {
    expect(parsePace(v)).toBeNull();
  });

  it('aceita zero à esquerda nos minutos', () => {
    expect(parsePace('05:30')).toBe(330);
  });
});
