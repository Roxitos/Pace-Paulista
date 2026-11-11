import { DIA_ORDEM, DIAS_CURTO } from './constants.js';

// Aceita 'HH:MM' (protótipo) e 'HH:MM:SS' (TIME do pg); usa só horas e minutos.
const HORA_RE = /^([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/;

function matchHora(hhmm) {
  const m = typeof hhmm === 'string' ? hhmm.match(HORA_RE) : null;
  if (!m) throw new RangeError(`Horário inválido: ${hhmm}`);
  return m;
}

export function fmtHora(hhmm) {
  const m = matchHora(hhmm);
  return `${Number(m[1])}h${m[2] === '00' ? '' : m[2]}`;
}

/** Período do dia pela hora de início ('HH:MM' ou 'HH:MM:SS'); os limites batem com periodRange. */
export function periodoDe(hhmm) {
  const h = Number(matchHora(hhmm)[1]);
  if (h < 7) return 'cedo';
  if (h < 12) return 'manha';
  if (h < 18) return 'tarde';
  return 'noite';
}

// Dia fora de DIA_ORDEM ordenaria em primeiro e viraria "" ou "function…" na view.
function assertDia(d) {
  if (!DIA_ORDEM.includes(d)) throw new RangeError(`Dia inválido: ${d}`);
}

export function sortDias(days) {
  days.forEach(assertDia);
  return [...days].sort((a, b) => DIA_ORDEM.indexOf(a) - DIA_ORDEM.indexOf(b));
}

export function fmtDiasCurto(days) {
  return sortDias(days)
    .map((d) => DIAS_CURTO[d])
    .join(', ');
}
