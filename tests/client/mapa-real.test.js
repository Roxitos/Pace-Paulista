import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRealMap, IMAGEM_VAZIA, SP_CENTRO, SP_ZOOM } from '../../public/js/mapa-real.js';

// Leaflet falso: registra as chamadas que importam, sem DOM nem rede.
function fakeLeaflet() {
  const map = {
    getZoom: () => 12,
    setView: vi.fn(),
    flyTo: vi.fn(),
    fitBounds: vi.fn(),
  };
  const calls = { markers: [], map, mapOpts: null, tile: null };
  const L = {
    map: vi.fn((el, opts) => {
      calls.mapOpts = opts;
      return map;
    }),
    tileLayer: vi.fn((url, opts) => {
      calls.tile = { url, opts };
      return { addTo: () => {} };
    }),
    divIcon: vi.fn((o) => o),
    marker: vi.fn((coords, opts) => {
      const classes = new Set();
      const m = {
        coords,
        opts,
        handlers: {},
        classes,
        addTo() {
          return m;
        },
        on(type, fn) {
          m.handlers[type] = fn;
        },
        getElement: () => ({
          classList: { toggle: (c, on) => (on ? classes.add(c) : classes.delete(c)) },
        }),
      };
      calls.markers.push(m);
      return m;
    }),
  };
  return { L, calls };
}

function item(slug, lat, lng, cor = '#3A78C2') {
  const attrs = { 'data-id': slug, 'data-lat': lat, 'data-lng': lng };
  return {
    getAttribute: (n) => attrs[n] ?? null,
    style: { getPropertyValue: () => cor },
    querySelector: () => ({ textContent: `Grupo ${slug}` }),
  };
}

function setup(items, extra = {}) {
  vi.stubGlobal('document', {
    createElement: () => ({ style: { setProperty: vi.fn() } }),
  });
  const { L, calls } = fakeLeaflet();
  const el = { hidden: true };
  const svg = {
    hidden: false,
    toggleAttribute(n, on) {
      if (n === 'hidden') this.hidden = on;
    },
  };
  const onPick = vi.fn();
  const api = createRealMap(L, {
    el,
    svg,
    items,
    selectedSlug: null,
    onPick,
    reducedMotion: () => false,
    ...extra,
  });
  return { api, calls, el, svg, onPick };
}

describe('camada de tiles sem data: URI (CA9)', () => {
  afterEach(() => vi.unstubAllGlobals());

  // L.TileLayer falso: extend devolve uma classe que mistura os métodos sobrescritos.
  function leafletComExtend() {
    const grid = { _removeTile: vi.fn(), _tileReady: vi.fn() };
    const { L } = fakeLeaflet();
    L.GridLayer = { prototype: grid };
    L.TileLayer = {
      extend: (proto) =>
        class {
          constructor(url, options) {
            Object.assign(this, proto, { url, options });
            this._tiles = {};
          }
          addTo() {
            return this;
          }
        },
    };
    return { L, grid };
  }

  function montar(L) {
    vi.stubGlobal('document', { createElement: () => ({ style: { setProperty: vi.fn() } }) });
    let camada;
    L.TileLayer.extend = ((extend) => (proto) => {
      const C = extend(proto);
      return class extends C {
        constructor(...a) {
          super(...a);
          camada = this;
        }
      };
    })(L.TileLayer.extend);
    createRealMap(L, {
      el: { hidden: true },
      svg: null,
      items: [],
      selectedSlug: null,
      onPick: vi.fn(),
      reducedMotion: () => false,
    });
    return camada;
  }

  it('descarta tiles com o GIF próprio, nunca com data:', () => {
    const { L, grid } = leafletComExtend();
    const camada = montar(L);
    const el = { setAttribute: vi.fn() };
    camada._tiles = { k: { el } };
    camada._removeTile('k');
    expect(el.setAttribute).toHaveBeenCalledWith('src', IMAGEM_VAZIA);
    expect(IMAGEM_VAZIA).toBe('/img/vazio.gif');
    expect(grid._removeTile).toHaveBeenCalledWith('k');
  });

  it('ignora o evento de carga do tile já descartado', () => {
    const { L, grid } = leafletComExtend();
    const camada = montar(L);
    camada._map = {};
    camada._tileReady({}, null, { getAttribute: () => IMAGEM_VAZIA });
    expect(grid._tileReady).not.toHaveBeenCalled();
    camada._tileReady({}, null, { getAttribute: () => 'https://tile.openstreetmap.org/1.png' });
    expect(grid._tileReady).toHaveBeenCalledTimes(1);
  });

  it('aborta tiles de outro zoom que não terminaram, sem data:', () => {
    const { L } = leafletComExtend();
    const camada = montar(L);
    camada._tileZoom = 5;
    camada.fire = vi.fn();
    const velho = { complete: false, src: '', remove: vi.fn() };
    const atual = { complete: false, src: 'x', remove: vi.fn() };
    camada._tiles = { a: { coords: { z: 4 }, el: velho }, b: { coords: { z: 5 }, el: atual } };
    camada._abortLoading();
    expect(velho.src).toBe(IMAGEM_VAZIA);
    expect(velho.remove).toHaveBeenCalled();
    expect(atual.src).toBe('x');
    expect(Object.keys(camada._tiles)).toEqual(['b']);
  });
});

describe('createRealMap', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('mostra o mapa, esconde o SVG e usa os tiles do OSM sem zoom pela roda', () => {
    const { calls, el, svg } = setup([item('a', '-23.5', '-46.6')]);
    expect(el.hidden).toBe(false);
    expect(svg.hidden).toBe(true);
    expect(calls.mapOpts).toEqual({ scrollWheelZoom: false });
    expect(calls.tile.url).toBe('https://tile.openstreetmap.org/{z}/{x}/{y}.png');
    expect(calls.tile.opts.referrerPolicy).toBe('strict-origin-when-cross-origin');
    expect(calls.tile.opts.attribution).toContain('openstreetmap.org/copyright');
  });

  it('cria marcador só para itens com coordenadas válidas, fora do Tab (CA6)', () => {
    const { calls } = setup([
      item('a', '-23.5', '-46.6'),
      item('sem', null, null),
      item('nan', 'abc', '-46.6'),
      // Number('') e Number(' ') são 0: atributo vazio não pode virar o ponto 0,0.
      item('vazio', '', ' '),
    ]);
    expect(calls.markers).toHaveLength(1);
    expect(calls.markers[0].coords).toEqual([-23.5, -46.6]);
    expect(calls.markers[0].opts).toMatchObject({ keyboard: false, title: 'Grupo a' });
  });

  it('sem marcadores centraliza em São Paulo com zoom 11; com marcadores enquadra todos', () => {
    const vazio = setup([item('sem', null, null)]);
    expect(vazio.calls.map.setView).toHaveBeenCalledWith(SP_CENTRO, SP_ZOOM);
    const cheio = setup([item('a', '-23.5', '-46.6'), item('b', '-23.6', '-46.7')]);
    expect(cheio.calls.map.fitBounds).toHaveBeenCalledWith(
      [
        [-23.5, -46.6],
        [-23.6, -46.7],
      ],
      expect.objectContaining({ maxZoom: 15 }),
    );
  });

  it('com slug na URL abre centrado no grupo, zoom 15 (CA5)', () => {
    const { calls } = setup([item('a', '-23.5', '-46.6'), item('b', '-23.6', '-46.7')], {
      selectedSlug: 'b',
      centerOnSelected: true,
    });
    expect(calls.map.setView).toHaveBeenCalledWith([-23.6, -46.7], 15);
    expect(calls.map.fitBounds).not.toHaveBeenCalled();
    expect(calls.markers[1].classes.has('is-selected')).toBe(true);
  });

  it('sem slug na URL enquadra todos os pinos mesmo com 1º item marcado (CA5)', () => {
    const { calls } = setup([item('a', '-23.5', '-46.6'), item('b', '-23.6', '-46.7')], {
      selectedSlug: 'a',
      centerOnSelected: false,
    });
    expect(calls.map.setView).not.toHaveBeenCalled();
    expect(calls.map.fitBounds).toHaveBeenCalled();
    expect(calls.markers[0].classes.has('is-selected')).toBe(true);
  });

  it('clique no marcador chama a seleção com o slug', () => {
    const { calls, onPick } = setup([item('a', '-23.5', '-46.6')]);
    calls.markers[0].handlers.click();
    expect(onPick).toHaveBeenCalledWith('a');
  });

  it('focus anima com flyTo (zoom ≥ 15) e destaca o pino', () => {
    const { api, calls } = setup([item('a', '-23.5', '-46.6'), item('b', '-23.6', '-46.7')]);
    api.focus('b');
    expect(calls.map.flyTo).toHaveBeenCalledWith([-23.6, -46.7], 15);
    expect(calls.markers[1].classes.has('is-selected')).toBe(true);
    expect(calls.markers[0].classes.has('is-selected')).toBe(false);
  });

  it('com prefers-reduced-motion usa setView sem animação (CA13)', () => {
    const { api, calls } = setup([item('a', '-23.5', '-46.6')], { reducedMotion: () => true });
    calls.map.setView.mockClear();
    api.focus('a');
    expect(calls.map.flyTo).not.toHaveBeenCalled();
    expect(calls.map.setView).toHaveBeenCalledWith([-23.5, -46.6], 15);
  });

  it('focus em grupo sem ponto não move o mapa', () => {
    const { api, calls } = setup([item('a', '-23.5', '-46.6'), item('sem', null, null)]);
    calls.map.setView.mockClear();
    api.focus('sem');
    expect(calls.map.flyTo).not.toHaveBeenCalled();
    expect(calls.map.setView).not.toHaveBeenCalled();
  });
});
