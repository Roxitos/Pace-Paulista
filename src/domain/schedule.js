import { DIA_ORDEM, DIAS_CURTO } from './constants.js';

// Aceita 'HH:MM' (protótipo) e 'HH:MM:SS' (TIME do pg); usa só horas e minutos.
const HORA_RE = /^([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/;

export function fmtHora(hhmm) {
  const m = typeof hhmm === 'string' ? hhmm.match(HORA_RE) : null;
  if (!m) throw new RangeError(`Horário inválido: ${hhmm}`);
  return `${Number(m[1])}h${m[2] === '00' ? '' : m[2]}`;
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
