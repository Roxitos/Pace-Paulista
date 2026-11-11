import { describe, expect, it } from 'vitest';
import { isSlug } from '../../src/domain/slug.js';

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
