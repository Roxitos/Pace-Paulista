// Geometria do mapa esquemático copiada literalmente do protótipo (docs/prototipo.html, PageMapa).
export const ZPOLY = {
  norte: 'M70 20 L330 20 L350 110 L250 135 L150 135 L60 110 Z',
  oeste: 'M60 110 L150 135 L165 210 L120 270 L30 240 L20 150 Z',
  centro: 'M150 135 L250 135 L255 200 L200 220 L165 210 Z',
  leste: 'M250 135 L350 110 L385 200 L360 280 L255 250 L255 200 Z',
  sul: 'M120 270 L165 210 L200 220 L255 200 L255 250 L240 365 L150 368 L110 320 Z',
};
export const ZLABEL = {
  norte: [200, 40],
  oeste: [62, 232],
  centro: [212, 205],
  leste: [345, 250],
  sul: [160, 292],
};
export const ZCENTRO = {
  norte: [200, 90],
  oeste: [90, 200],
  centro: [205, 180],
  leste: [320, 200],
  sul: [195, 300],
};

const VIEWBOX = [400, 380];

// map_pin não tem CHECK no banco: fora do viewBox o pin sumiria do desenho e o link seguiria no Tab.
function isPin(pin) {
  return (
    Array.isArray(pin) &&
    pin.length === 2 &&
    pin.every((v, i) => Number.isInteger(v) && v >= 0 && v <= VIEWBOX[i])
  );
}

/**
 * Posição [x, y] do pin no SVG (viewBox 400×380). Sem map_pin, espalha o grupo perto do centro
 * da zona com o hash do protótipo sobre o slug (lá `g.id` era o slug), para a posição ser estável.
 */
export function pinPos(group) {
  if (isPin(group.map_pin)) return [...group.map_pin];
  const [cx, cy] = ZCENTRO[group.zone];
  let h = 0;
  for (const c of group.slug) h = (h * 31 + c.charCodeAt(0)) % 997;
  return [cx + (h % 40) - 20, cy + ((h >> 3) % 30) - 15];
}

// O local é só o nome do parque/rua: sem a cidade, o Maps pode achar um homônimo em outro lugar.
function inSaoPaulo(location) {
  return encodeURIComponent(`${location}, São Paulo, SP`);
}

export function gmapsBusca(location) {
  return `https://www.google.com/maps/search/?api=1&query=${inSaoPaulo(location)}`;
}

export function gmapsRota(location) {
  return `https://www.google.com/maps/dir/?api=1&destination=${inSaoPaulo(location)}`;
}
