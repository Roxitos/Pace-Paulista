import { describe, expect, it } from 'vitest';
import { fmtDiasCurto, fmtHora, sortDias } from '../../src/domain/schedule.js';

describe('fmtHora', () => {
  it.each([
    ['06:30', '6h30'],
    ['07:00', '7h'],
    ['19:30', '19h30'],
  ])('formata "%s" como "%s"', (hhmm, expected) => {
    expect(fmtHora(hhmm)).toBe(expected);
  });
});

describe('fmtDiasCurto', () => {
  it('ordena de segunda a domingo e abrevia', () => {
    expect(fmtDiasCurto(['sex', 'seg', 'qua'])).toBe('Seg, Qua, Sex');
  });

  it('coloca domingo depois de sábado', () => {
    expect(fmtDiasCurto(['dom', 'sab'])).toBe('Sáb, Dom');
  });
});

describe('sortDias', () => {
  it('não muta a lista recebida', () => {
    const days = ['dom', 'seg'];
    expect(sortDias(days)).toEqual(['seg', 'dom']);
    expect(days).toEqual(['dom', 'seg']);
  });
});

describe('fmtHora com valor inválido', () => {
  it('aceita o formato TIME do pg com segundos', () => {
    expect(fmtHora('06:30:00')).toBe('6h30');
    expect(fmtHora('00:00')).toBe('0h');
  });

  it.each(['abc', '', '6:30', '24:00', '06:60', '06:30:99', 'x06:30', null, undefined, 630])(
    'lança erro para %s',
    (v) => {
      expect(() => fmtHora(v)).toThrow();
    },
  );
});

describe('dias inválidos', () => {
  it.each([['xxx'], ['toString'], ['Seg'], [undefined]])('sortDias lança erro para %s', (d) => {
    expect(() => sortDias(['seg', d])).toThrow();
  });

  it('fmtDiasCurto lança erro em vez de renderizar dia vazio', () => {
    expect(() => fmtDiasCurto(['xxx', 'seg'])).toThrow();
    expect(() => fmtDiasCurto(['toString'])).toThrow();
  });
});
