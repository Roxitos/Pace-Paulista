import { isPlainClick } from './ui.js';

const detail = document.getElementById('mapDetail');
const pins = document.getElementById('pins');
const layout = document.querySelector('.map-layout');

// Mesmo formato do isSlug do servidor: '..' passaria pelo encodeURIComponent e o fetch sairia de /api/mapa/.
const SLUG_RE = /^[a-z0-9-]{1,60}$/;

if (detail && pins && layout) {
  const items = [...document.querySelectorAll('.map-item')];
  let selected = document.querySelector('.map-item[aria-current="true"]')?.getAttribute('data-id');
  const cache = new Map();
  if (selected) cache.set(selected, detail.innerHTML);
  let controller = null;

  function markSelected(slug) {
    for (const item of items) {
      item.setAttribute('aria-current', String(item.getAttribute('data-id') === slug));
    }
    for (const pin of pins.querySelectorAll('.pin')) {
      const on = pin.getAttribute('data-id') === slug;
      pin.querySelector('circle.ring')?.setAttribute('r', on ? 14 : 0);
      pin.querySelector('circle.dot')?.setAttribute('r', on ? 8 : 6);
    }
  }

  function scrollToDetail() {
    if (window.innerWidth >= 900) return;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    detail.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'nearest' });
  }

  async function select(slug, href) {
    if (slug === selected) {
      scrollToDetail();
      return;
    }
    controller?.abort();
    const mine = new AbortController();
    controller = mine;
    selected = slug;
    markSelected(slug);
    try {
      if (!cache.has(slug)) {
        detail.setAttribute('aria-busy', 'true');
        const res = await fetch(`/api/mapa/${encodeURIComponent(slug)}`, {
          headers: { Accept: 'application/json' },
          signal: mine.signal,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (typeof data.panel !== 'string') throw new Error('sem panel');
        cache.set(slug, data.panel);
      }
      if (controller !== mine) return;
      detail.innerHTML = cache.get(slug);
      detail.removeAttribute('aria-busy');
      history.replaceState(null, '', `/mapa/${encodeURIComponent(slug)}`);
      scrollToDetail();
    } catch {
      if (controller !== mine) return;
      location.assign(href);
    }
  }

  layout.addEventListener('click', (e) => {
    const link = e.target.closest('a[data-act="map-select"]');
    if (!link || !isPlainClick(e)) return;
    const slug = link.getAttribute('data-id');
    // Fora do formato, o link segue sem JS (navegação normal da spec 007).
    if (!SLUG_RE.test(slug ?? '')) return;
    e.preventDefault();
    select(slug, link.getAttribute('href'));
  });
}
