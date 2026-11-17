import { afterEach, describe, expect, it, vi } from 'vitest';

// DOM mínimo (sem jsdom): só o que participar.js usa ao montar o modal.
function fakeEl(extra = {}) {
  return {
    classList: { contains: () => false },
    dataset: {},
    style: { setProperty() {} },
    childNodes: [],
    isConnected: false,
    setAttribute() {},
    append() {},
    remove() {},
    addEventListener() {},
    cloneNode() {
      return fakeEl();
    },
    querySelector: () => null,
    querySelectorAll: () => [],
    ...extra,
  };
}

describe('participar.js', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('monta o modal mesmo sem .detail-grid na página (cor da zona vem do próprio painel)', async () => {
    const panel = fakeEl();
    const h1 = fakeEl({ textContent: 'Grupo X' });
    const head = fakeEl({ querySelector: (sel) => (sel === 'h1' ? h1 : null) });
    const byId = { participar: panel, modalRoot: fakeEl() };
    const seen = [];
    vi.stubGlobal('document', {
      getElementById: (id) => byId[id] ?? null,
      querySelector: (sel) => (sel === '.detail-head' ? head : null),
      createElement: () => fakeEl(),
      addEventListener() {},
    });
    vi.stubGlobal('window', { addEventListener() {} });
    vi.stubGlobal('location', { hash: '', pathname: '/grupos/x', search: '' });
    vi.stubGlobal('getComputedStyle', (el) => {
      if (!el) throw new TypeError('getComputedStyle: argumento não é Element');
      seen.push(el);
      return { getPropertyValue: () => '' };
    });

    await expect(import('../../public/js/participar.js')).resolves.toBeDefined();
    expect(seen).toEqual([panel]);
  });
});
