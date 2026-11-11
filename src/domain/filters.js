import { DIA_ORDEM, DIAS, NIVEIS, PACE_FAIXAS, PERIODOS, ZONA_ORDEM, ZONAS } from './constants.js';

// 80 = maior coluna buscável (location); limita o parâmetro sem mudar resultado prático.
const TEXT_MAX = 80;

const TEXT_KEYS = ['nome', 'local'];
const ENUM_KEYS = {
  dia: DIA_ORDEM,
  periodo: Object.keys(PERIODOS),
  pace: Object.keys(PACE_FAIXAS),
  nivel: Object.keys(NIVEIS),
};
// Ordem canônica da query string, depois das zonas.
const SCALAR_KEYS = [...TEXT_KEYS, ...Object.keys(ENUM_KEYS)];

// Os limites precisam concordar com periodoDe (teste cruzado em tests/domain/filters.test.js).
const PERIOD_RANGES = Object.freeze({
  cedo: Object.freeze({ from: '00:00', to: '07:00' }),
  manha: Object.freeze({ from: '07:00', to: '12:00' }),
  tarde: Object.freeze({ from: '12:00', to: '18:00' }),
  noite: Object.freeze({ from: '18:00', to: null }),
});

export const EMPTY_FILTERS = Object.freeze({
  zonas: Object.freeze([]),
  nome: '',
  local: '',
  dia: '',
  periodo: '',
  pace: '',
  nivel: '',
});

function first(value) {
  return Array.isArray(value) ? value[0] : value;
}

// O Postgres recusa texto com NUL (erro 22021); sem isso, ?nome=%00 virava 500.
// NFC: "ã" pode chegar decomposto (a + til combinante) e o ILIKE não acharia "Pelotão".
function text(value) {
  const s = first(value);
  if (typeof s !== 'string') return '';
  const clean = s.replaceAll('\0', '').normalize('NFC').trim();
  // Corta por code point para não deixar meio par substituto no fim; o trimEnd final evita
  // que o corte termine em espaço, que sumiria ao reler o href dos chips.
  return Array.from(clean).slice(0, TEXT_MAX).join('').trimEnd();
}

function oneOf(value, allowed) {
  const s = first(value);
  return typeof s === 'string' && allowed.includes(s) ? s : '';
}

/**
 * Normaliza req.query (cada chave: string, string[] ou ausente) para o formato de EMPTY_FILTERS.
 * Valor desconhecido vira '' e zona inválida é descartada; nunca lança.
 */
export function parseFilters(query) {
  const q = query !== null && typeof query === 'object' ? query : {};
  const get = (key) => (Object.hasOwn(q, key) ? q[key] : undefined);

  const zonaParam = get('zona');
  const zonaList = Array.isArray(zonaParam) ? zonaParam : [zonaParam];
  const filters = { zonas: ZONA_ORDEM.filter((z) => zonaList.includes(z)) };
  for (const key of TEXT_KEYS) filters[key] = text(get(key));
  for (const [key, allowed] of Object.entries(ENUM_KEYS)) filters[key] = oneOf(get(key), allowed);
  return filters;
}

export function filtersToQuery(f) {
  const params = new URLSearchParams();
  for (const z of f.zonas) params.append('zona', z);
  for (const key of SCALAR_KEYS) {
    if (f[key]) params.append(key, f[key]);
  }
  return params.toString();
}

export function searchHref(f) {
  const query = filtersToQuery(f);
  return query ? `/grupos?${query}` : '/grupos';
}

/** Chips dos filtros ativos, na ordem do protótipo; cada href remove só aquele filtro. */
export function activeChips(f) {
  const chip = (label, without) => ({ label, href: searchHref({ ...f, ...without }) });
  const chips = f.zonas.map((z) =>
    chip(ZONAS[z].nome, { zonas: f.zonas.filter((other) => other !== z) }),
  );
  if (f.nome) chips.push(chip(`Nome: ${f.nome}`, { nome: '' }));
  if (f.local) chips.push(chip(`Local: ${f.local}`, { local: '' }));
  if (f.dia) chips.push(chip(DIAS[f.dia], { dia: '' }));
  if (f.periodo) chips.push(chip(PERIODOS[f.periodo], { periodo: '' }));
  if (f.pace) chips.push(chip(PACE_FAIXAS[f.pace].nome, { pace: '' }));
  if (f.nivel) chips.push(chip(NIVEIS[f.nivel].nome, { nivel: '' }));
  return chips;
}

// Para ILIKE ... ESCAPE '\': sem isso, % e _ digitados virariam curingas.
export function escapeLike(s) {
  return s.replace(/[\\%_]/g, '\\$&');
}

/** Faixa [from, to) de start_time do período; to = null significa "até o fim do dia". */
export function periodRange(periodo) {
  if (!Object.hasOwn(PERIOD_RANGES, periodo)) throw new RangeError(`Período inválido: ${periodo}`);
  return PERIOD_RANGES[periodo];
}
