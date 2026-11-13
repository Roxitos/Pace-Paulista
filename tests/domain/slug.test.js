import { describe, expect, it } from 'vitest';
import { isSlug, nextSlug, slugify } from '../../src/domain/slug.js';

describe('isSlug', () => {
  it.each(['pace-da-oca', 'a', '2-grupo', 'a'.repeat(60)])('aceita %s', (value) => {
    expect(isSlug(value)).toBe(true);
  });

  it.each(['', 'ABC', 'pace da oca', 'pace_da_oca', 'açaí', 'a'.repeat(61), '../x', null, 42])(
    'recusa %j',
    (value) => {
      expect(isSlug(value)).toBe(false);
    },
  );
});

describe('slugify', () => {
  it('tira acentos, minúsculas e troca símbolos por hífen', () => {
    expect(slugify('Pace da Oca!')).toBe('pace-da-oca');
    expect(slugify('  Tietê  em Movimento ')).toBe('tiete-em-movimento');
  });

  it('corta em 40 sem deixar hífen no fim', () => {
    const slug = slugify(`${'a'.repeat(39)} bbb`);
    expect(slug).toBe('a'.repeat(39));
    expect(slugify('x'.repeat(60))).toHaveLength(40);
  });

  it('sem letras nem números vira "grupo"', () => {
    expect(slugify('★★★')).toBe('grupo');
  });
});

describe('nextSlug', () => {
  it('devolve a base quando está livre', () => {
    expect(nextSlug('pace', ['outro'])).toBe('pace');
  });

  it('procura o primeiro sufixo livre', () => {
    expect(nextSlug('pace', ['pace'])).toBe('pace-2');
    expect(nextSlug('pace', new Set(['pace', 'pace-2']))).toBe('pace-3');
  });

  it('evita slugs reservados', () => {
    expect(nextSlug('novo', [])).toBe('novo-2');
    expect(nextSlug('zona', [])).toBe('zona-2');
  });
});
