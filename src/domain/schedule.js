import { DIA_ORDEM, DIAS, DIAS_CURTO } from './constants.js';

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

function joinPtBr(items) {
  if (items.length < 2) return items.join('');
  return `${items.slice(0, -1).join(', ')} e ${items[items.length - 1]}`;
}

export function fmtDiasLongo(days) {
  return joinPtBr(sortDias(days).map((d) => DIAS[d]));
}

// Índice de Date#getUTCDay (0 = domingo) para cada dia do banco.
const DIA_IDX = { dom: 0, seg: 1, ter: 2, qua: 3, qui: 4, sex: 5, sab: 6 };

function partsIn(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
  }).formatToParts(date);
  const get = (type) => Number(parts.find((p) => p.type === type).value);
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour'),
    minute: get('minute'),
    second: get('second'),
  };
}

// Quanto o relógio do fuso está adiantado em relação ao UTC naquele instante (ms).
function offsetAt(ms, timeZone) {
  const p = partsIn(new Date(ms), timeZone);
  const local = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return local - Math.floor(ms / 1000) * 1000;
}

// Instante em que o relógio do fuso marca a data/hora dadas. O deslocamento é lido
// naquela data (não fixo em -03:00), então continua certo se o horário de verão voltar.
function zonedToInstant(year, month, day, hour, minute, timeZone) {
  const wall = Date.UTC(year, month - 1, day, hour, minute);
  const guess = wall - offsetAt(wall, timeZone);
  return new Date(wall - offsetAt(guess, timeZone));
}

/**
 * Próximas `n` datas de treino nos 28 dias a partir de hoje, no fuso `timeZone`
 * (não no fuso do processo: o servidor costuma rodar em UTC e "sábado 6h30" mudaria de dia).
 * Só entram instantes depois de `now`. Devolve `Date[]` em ordem crescente.
 */
export function proximos(group, now, { n = 4, timeZone = 'America/Sao_Paulo' } = {}) {
  const m = matchHora(group.start_time);
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  group.days.forEach(assertDia);
  const weekdays = new Set(group.days.map((d) => DIA_IDX[d]));
  const today = partsIn(now, timeZone);

  const out = [];
  for (let i = 0; i < 28 && out.length < n; i++) {
    // Date.UTC só como calendário: normaliza "dia 32" e dá o dia da semana da data local.
    const cal = new Date(Date.UTC(today.year, today.month - 1, today.day + i));
    if (!weekdays.has(cal.getUTCDay())) continue;
    const at = zonedToInstant(
      cal.getUTCFullYear(),
      cal.getUTCMonth() + 1,
      cal.getUTCDate(),
      hour,
      minute,
      timeZone,
    );
    if (at > now) out.push(at);
  }
  return out;
}

/** Dia, mês curto e dia da semana de um encontro, em pt-BR e no fuso `timeZone`. */
export function fmtEncontro(date, timeZone = 'America/Sao_Paulo') {
  const fmt = (opts) => new Intl.DateTimeFormat('pt-BR', { timeZone, ...opts }).format(date);
  return {
    dia: fmt({ day: 'numeric' }),
    mes: fmt({ month: 'short' }).replace('.', ''),
    semana: fmt({ weekday: 'long' }).replace(/^./, (c) => c.toUpperCase()),
  };
}
