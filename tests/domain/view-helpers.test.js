import { describe, expect, it } from 'vitest';
import { currentNav, ic, P } from '../../src/views/helpers.js';

describe('currentNav', () => {
  it.each([
    ['/', 'inicio'],
    ['/grupos', 'grupos'],
    ['/grupos/pace-da-oca', 'grupos'],
    ['/zonas', 'zonas'],
    ['/sobre', 'sobre'],
    ['/encontrar', ''],
    ['/gruposx', ''],
  ])('mapeia %s para "%s"', (path, expected) => {
    expect(currentNav(path)).toBe(expected);
  });
});

describe('ic', () => {
  it('devolve o SVG do protótipo com a classe padrão', () => {
    expect(ic('menu')).toBe(
      '<svg class="ico " viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/></svg>',
    );
  });

  it('acrescenta a classe extra', () => {
    expect(ic('pin', 'ico-sm')).toContain('class="ico ico-sm"');
    expect(ic('pin', 'ico-sm')).toContain(P.pin);
  });

  it('lança erro para ícone desconhecido', () => {
    expect(() => ic('nao-existe')).toThrow('Ícone desconhecido: nao-existe');
  });

  it('não aceita propriedades herdadas como ícone', () => {
    expect(() => ic('toString')).toThrow('Ícone desconhecido');
  });

  it('recusa classe extra com caracteres que escapariam do atributo', () => {
    expect(() => ic('pin', '"><script>alert(1)</script>')).toThrow('Classe inválida');
  });
});
