import { describe, expect, it } from 'vitest';
import { safeNext } from '../../src/domain/redirect.js';

describe('safeNext', () => {
  it.each(['/meus', '/grupos/x#participar', '/grupos?zona=sul'])('aceita %s', (path) => {
    expect(safeNext(path)).toBe(path);
  });

  it.each([
    ['//evil.com', '//evil.com'],
    ['barra invertida', '/\\evil.com'],
    ['URL absoluta', 'http://evil.com'],
    ['javascript:', 'javascript:alert(1)'],
    ['vazio', ''],
    ['undefined', undefined],
    ['array', ['/a']],
    ['espaço', '/a b'],
    ['controle', '/a\u0000'],
    ['513 caracteres', '/' + 'a'.repeat(512)],
  ])('recusa %s e devolve o fallback', (_caso, raw) => {
    expect(safeNext(raw)).toBe('/meus');
  });

  it('usa o fallback informado', () => {
    expect(safeNext('x', '/')).toBe('/');
  });

  it('aceita 512 caracteres', () => {
    const path = '/' + 'a'.repeat(511);
    expect(safeNext(path)).toBe(path);
  });
});
