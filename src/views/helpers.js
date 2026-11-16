import { ZONAS } from '../domain/constants.js';

// Ícones copiados literalmente do protótipo (docs/prototipo.html, objeto P).
export const P = {
  pin: '<path d="M9 11a3 3 0 1 0 6 0a3 3 0 0 0 -6 0"/><path d="M17.657 16.657l-4.243 4.243a2 2 0 0 1 -2.827 0l-4.244 -4.243a8 8 0 1 1 11.314 0z"/>',
  cal: '<path d="M4 7a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2z"/><path d="M16 3v4M8 3v4M4 11h16"/>',
  clock: '<path d="M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0"/><path d="M12 7v5l3 3"/>',
  users:
    '<path d="M5 7a4 4 0 1 0 8 0a4 4 0 1 0 -8 0"/><path d="M3 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/><path d="M21 21v-2a4 4 0 0 0 -3 -3.85"/>',
  run: '<path d="M12 4a1 1 0 1 0 2 0a1 1 0 1 0 -2 0"/><path d="M4 17l5 1l.75 -1.5"/><path d="M15 21l0 -4l-4 -3l1 -6"/><path d="M7 12l0 -3l5 -1l3 3l3 1"/>',
  search: '<path d="M3 10a7 7 0 1 0 14 0a7 7 0 1 0 -14 0"/><path d="M21 21l-6 -6"/>',
  x: '<path d="M18 6l-12 12M6 6l12 12"/>',
  route:
    '<path d="M3 19a2 2 0 1 0 4 0a2 2 0 0 0 -4 0"/><path d="M19 7a2 2 0 1 0 0 -4a2 2 0 0 0 0 4z"/><path d="M11 19h5.5a3.5 3.5 0 0 0 0 -7h-8a3.5 3.5 0 0 1 0 -7h4.5"/>',
  arrow: '<path d="M5 12h14M13 18l6 -6M13 6l6 6"/>',
  check: '<path d="M5 12l5 5l10 -10"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  filter: '<path d="M4 6h16M7 12h10M10 18h4"/>',
  user: '<path d="M8 7a4 4 0 1 0 8 0a4 4 0 0 0 -8 0"/><path d="M6 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2"/>',
  back: '<path d="M15 6l-6 6l6 6"/>',
  ext: '<path d="M12 6h-6a2 2 0 0 0 -2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-6"/><path d="M11 13l9 -9M15 4h5v5"/>',
  info: '<path d="M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0"/><path d="M12 9h.01M11 12h1v4h1"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  gauge:
    '<path d="M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0"/><path d="M13.41 10.59l2.59 -2.59"/><path d="M7 12a5 5 0 0 1 5 -5"/>',
  bars: '<path d="M4 20h16"/><path d="M5 16v4M10 12v8M15 8v12M20 4v16"/>',
  map: '<path d="M3 7l6 -3l6 3l6 -3v13l-6 3l-6 -3l-6 3v-13"/><path d="M9 4v13M15 7v13"/>',
  alert:
    '<path d="M12 9v4M12 17h.01"/><path d="M10.363 3.591l-8.106 13.534a1.914 1.914 0 0 0 1.636 2.871h16.214a1.914 1.914 0 0 0 1.636 -2.87l-8.106 -13.536a1.914 1.914 0 0 0 -3.274 0z"/>',
  ruler:
    '<path d="M5 4h14a1 1 0 0 1 1 1v5a1 1 0 0 1 -1 1h-7a1 1 0 0 0 -1 1v7a1 1 0 0 1 -1 1h-5a1 1 0 0 1 -1 -1v-14a1 1 0 0 1 1 -1"/><path d="M4 8h2M4 12h3M4 16h2M8 4v2M12 4v3M16 4v2"/>',
  door: '<path d="M14 8v-2a2 2 0 0 0 -2 -2h-7a2 2 0 0 0 -2 2v12a2 2 0 0 0 2 2h7a2 2 0 0 0 2 -2v-2"/><path d="M9 12h12l-3 -3M18 15l3 -3"/>',
  heart: '<path d="M19.5 12.572l-7.5 7.428l-7.5 -7.428a5 5 0 1 1 7.5 -6.566a5 5 0 1 1 7.5 6.572"/>',
};

// cls entra cru no atributo class; só aceitamos nomes de classe para não abrir brecha de HTML.
const CLASS_LIST = /^[\w -]*$/;

export function ic(name, cls = '') {
  if (!Object.hasOwn(P, name)) throw new Error(`Ícone desconhecido: ${name}`);
  if (typeof cls !== 'string' || !CLASS_LIST.test(cls)) throw new Error(`Classe inválida: ${cls}`);
  return `<svg class="ico ${cls}" viewBox="0 0 24 24" aria-hidden="true">${P[name]}</svg>`;
}

export function currentNav(path) {
  if (path === '/') return 'inicio';
  if (path === '/grupos/novo') return '';
  if (path === '/grupos' || path.startsWith('/grupos/')) return 'grupos';
  if (path === '/zonas') return 'zonas';
  if (path === '/sobre') return 'sobre';
  return '';
}

// Selos das zonas copiados literalmente do protótipo (docs/prototipo.html, objeto SEAL).
export const SEAL = {
  norte:
    '<path d="M6 46 L22 20 L31 33 L39 23 L58 46 Z"/><path d="M16 46v-6l-3 0 3-5-2 0 3-5 3 5-2 0 3 5-3 0v6"/><path d="M47 46v-5h-3l3-5h-2l3-5 3 5h-2l3 5h-3v5"/><path d="M4 50h56" stroke-dasharray="3 3"/>',
  oeste:
    '<path d="M32 8 L26 44 M32 8 L38 44"/><path d="M28.5 30h7"/><path d="M4 44h56"/><path d="M31 14 L8 44M31 18 L16 44M33 14 L56 44M33 18 L48 44"/><path d="M4 50h56" stroke-dasharray="3 3"/>',
  centro:
    '<path d="M8 50V30h8v20M18 50V20h9v30M29 50V26h8v24M39 50V14h9v36M50 50V32h7v18"/><path d="M43.5 14V6M41 9h5"/><path d="M4 50h56"/><path d="M21 25h3M21 31h3M21 37h3M42 20h3M42 26h3M42 32h3"/>',
  leste:
    '<path d="M6 44c4-14 14-22 26-22s22 8 26 22"/><path d="M6 44h52"/><path d="M12 44c3-9 10-15 20-15s17 6 20 15"/><path d="M18 31v13M26 26v18M38 26v18M46 31v13"/><path d="M4 50h56" stroke-dasharray="3 3"/>',
  sul: '<path d="M8 46a24 24 0 0 1 48 0"/><path d="M4 46h56"/><circle cx="20" cy="38" r="2.2"/><circle cx="28" cy="31" r="2.2"/><circle cx="36" cy="31" r="2.2"/><circle cx="44" cy="38" r="2.2"/><circle cx="32" cy="40" r="2.2"/><path d="M4 52h56" stroke-dasharray="3 3"/>',
};

function zoneOf(z) {
  if (!Object.hasOwn(ZONAS, z)) throw new Error(`Zona desconhecida: ${z}`);
  return ZONAS[z];
}

// O retorno entra com <%- %>; por isso a zona é validada e o tamanho precisa ser inteiro.
export function seal(z, size = 64) {
  const { nome, marco } = zoneOf(z);
  if (!Number.isInteger(size)) throw new Error(`Tamanho inválido: ${size}`);
  return `<svg class="seal" width="${size}" height="${size}" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" role="img" aria-label="Selo da ${nome}, inspirado em ${marco}"><circle cx="32" cy="32" r="31" stroke-width="1.6" opacity=".55"/>${SEAL[z]}</svg>`;
}

export function zstyle(z) {
  const { cor, on } = zoneOf(z);
  return `--z:${cor};--zon:${on}`;
}
