import { afterEach, describe, expect, it, vi } from 'vitest';

// DOM mínimo (sem jsdom): só o que mapa.js usa ao montar e ao clicar.
function setup(id = 'pace-da-oca') {
  const attrs = { 'data-id': id, href: `/mapa/${id}#mapDetail` };
  const link = { getAttribute: (n) => attrs[n] };
  const detail = {
    innerHTML: '<div>inicial</div>',
    setAttribute() {},
    removeAttribute() {},
    scrollIntoView() {},
  };
  const pins = { querySelectorAll: () => [] };
  let onClick;
  const layout = {
    addEventListener: (type, fn) => {
      if (type === 'click') onClick = fn;
    },
  };
  const mapEl = { hidden: true };
  const svg = {
    hidden: false,
    toggleAttribute(n, on) {
      if (n === 'hidden') this.hidden = on;
    },
  };
  vi.stubGlobal('document', {
    getElementById: (id) => ({ mapDetail: detail, pins, mapReal: mapEl })[id] ?? null,
    querySelector: (sel) => ({ '.map-layout': layout, '.map-box > svg': svg })[sel] ?? null,
    querySelectorAll: () => [],
  });
  vi.stubGlobal('window', { innerWidth: 1280 });
  vi.stubGlobal('matchMedia', () => ({ matches: false }));
  const replaceState = vi.fn();
  vi.stubGlobal('history', { replaceState });
  vi.stubGlobal('location', { assign: vi.fn(), pathname: '/mapa' });
  const fetchMock = vi.fn(async () => ({
    ok: true,
    json: async () => ({ slug: 'pace-da-oca', panel: '<div>pace</div>' }),
  }));
  vi.stubGlobal('fetch', fetchMock);
  const click = (extra = {}) => {
    const e = {
      target: { closest: () => link },
      defaultPrevented: false,
      button: 0,
      preventDefault: vi.fn(),
      ...extra,
    };
    onClick(e);
    return e;
  };
  return { click, fetchMock, replaceState, detail, mapEl, svg };
}

describe('mapa.js', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('clique simples busca o painel e troca a URL com replaceState', async () => {
    const { click, fetchMock, replaceState, detail } = setup();
    await import('../../public/js/mapa.js');
    const e = click();
    expect(e.preventDefault).toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledWith('/api/mapa/pace-da-oca', expect.any(Object));
    await vi.waitFor(() =>
      expect(replaceState).toHaveBeenCalledWith(null, '', '/mapa/pace-da-oca'),
    );
    expect(detail.innerHTML).toBe('<div>pace</div>');
  });

  it('Ctrl+clique fica com o navegador: sem preventDefault nem fetch', async () => {
    const { click, fetchMock } = setup();
    await import('../../public/js/mapa.js');
    const e = click({ ctrlKey: true });
    expect(e.preventDefault).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  // Hardener: '..' sobreviveria ao encodeURIComponent e o fetch iria para /api/ (outro endpoint).
  it('data-id fora do formato de slug fica com o navegador: sem preventDefault nem fetch', async () => {
    const { click, fetchMock } = setup('..');
    await import('../../public/js/mapa.js');
    const e = click();
    expect(e.preventDefault).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('se o Leaflet não carrega, o esquema SVG continua visível (CA4)', async () => {
    const { mapEl, svg } = setup();
    // Em teste não existe /vendor/leaflet: o import falha, como numa falha de rede.
    await import('../../public/js/mapa.js');
    expect(mapEl.hidden).toBe(true);
    expect(svg.hidden).toBe(false);
  });
});
