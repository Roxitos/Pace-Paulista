// Mapa real (spec 024): monta o Leaflet sobre a lista de grupos. Recebe o Leaflet por parâmetro
// (mapa.js o importa de /vendor/leaflet), o que também deixa o módulo testável sem rede.

// Vista inicial sem seleção nem pinos. Fica aqui (e não em src/domain) porque o navegador não importa src/.
export const SP_CENTRO = [-23.5505, -46.6333];
export const SP_ZOOM = 11;
const ZOOM_SELECIONADO = 15;
const COR = /^#[0-9a-fA-F]{3,8}$/;

function readCoords(item) {
  const rawLat = item.getAttribute('data-lat');
  const rawLng = item.getAttribute('data-lng');
  // Number(null), Number('') e Number(' ') são 0: atributo ausente ou vazio cairia no ponto 0,0.
  if (!rawLat?.trim() || !rawLng?.trim()) return null;
  const lat = Number(rawLat);
  const lng = Number(rawLng);
  return Number.isFinite(lat) && Number.isFinite(lng) ? [lat, lng] : null;
}

// Pino sem innerHTML: elemento criado pelo DOM; a cor vem do style do item (zstyle do servidor).
function pinElement(item) {
  const el = document.createElement('span');
  const cor = (item.style?.getPropertyValue('--z') ?? '').trim();
  if (COR.test(cor)) el.style.setProperty('--z', cor);
  return el;
}

// O Leaflet troca o src de tiles descartados por um data:image/gif (constante interna, não
// configurável), e o CSP não permite data: em img-src. Esta camada usa um GIF próprio no lugar.
export const IMAGEM_VAZIA = '/img/vazio.gif';

function tileLayerSemDataUri(L, url, options) {
  if (!L.TileLayer?.extend) return L.tileLayer(url, options);
  const Camada = L.TileLayer.extend({
    _abortLoading() {
      for (const key of Object.keys(this._tiles)) {
        const tile = this._tiles[key];
        if (tile.coords.z === this._tileZoom) continue;
        const img = tile.el;
        img.onload = () => false;
        img.onerror = () => false;
        if (!img.complete) {
          img.src = IMAGEM_VAZIA;
          img.remove();
          delete this._tiles[key];
          this.fire('tileabort', { tile: img, coords: tile.coords });
        }
      }
    },
    _removeTile(key) {
      const tile = this._tiles[key];
      if (!tile) return;
      tile.el.setAttribute('src', IMAGEM_VAZIA);
      return L.GridLayer.prototype._removeTile.call(this, key);
    },
    _tileReady(coords, err, tile) {
      if (!this._map || tile?.getAttribute('src') === IMAGEM_VAZIA) return;
      return L.GridLayer.prototype._tileReady.call(this, coords, err, tile);
    },
  });
  return new Camada(url, options);
}

export function createRealMap(
  L,
  { el, svg, items, selectedSlug, centerOnSelected, onPick, reducedMotion },
) {
  el.hidden = false;
  // toggleAttribute: SVGElement não tem a propriedade .hidden (só o atributo, que o CSS lê).
  svg?.toggleAttribute('hidden', true);

  const map = L.map(el, { scrollWheelZoom: false });
  tileLayerSemDataUri(L, 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    // O site manda Referrer-Policy: same-origin e o OSM exige Referer nos tiles: só a origem.
    referrerPolicy: 'strict-origin-when-cross-origin',
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(map);

  const markers = new Map();
  for (const item of items) {
    const slug = item.getAttribute('data-id');
    const coords = readCoords(item);
    if (!slug || !coords) continue;
    const icon = L.divIcon({
      className: 'map-pin',
      html: pinElement(item),
      iconSize: [22, 22],
      iconAnchor: [11, 11],
    });
    const name = item.querySelector?.('b')?.textContent ?? '';
    const marker = L.marker(coords, { icon, keyboard: false, title: name }).addTo(map);
    marker.on('click', () => onPick(slug));
    markers.set(slug, { marker, coords });
  }

  function mark(slug) {
    for (const [id, { marker }] of markers) {
      marker.getElement?.()?.classList.toggle('is-selected', id === slug);
    }
  }

  // Sem slug na URL o servidor marca o 1º item só como padrão da lista: aí enquadra todos os pinos.
  const initial = centerOnSelected ? markers.get(selectedSlug) : null;
  if (initial) {
    map.setView(initial.coords, ZOOM_SELECIONADO);
  } else if (markers.size > 0) {
    map.fitBounds(
      [...markers.values()].map((m) => m.coords),
      { padding: [30, 30], maxZoom: ZOOM_SELECIONADO },
    );
  } else {
    map.setView(SP_CENTRO, SP_ZOOM);
  }
  mark(selectedSlug);

  return {
    // Grupo sem ponto: o pino some da seleção, mas o mapa não se move.
    focus(slug) {
      mark(slug);
      const target = markers.get(slug);
      if (!target) return;
      const zoom = Math.max(map.getZoom(), ZOOM_SELECIONADO);
      if (reducedMotion()) map.setView(target.coords, zoom);
      else map.flyTo(target.coords, zoom);
    },
  };
}
