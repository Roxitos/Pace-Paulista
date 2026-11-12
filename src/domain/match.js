import { NIVEIS, ZONAS } from './constants.js';
import { fmtDiasLongo, periodoDe } from './schedule.js';

export const MATCH_MIN_PCT = 40;
export const MATCH_LIMIT = 6;

function zonaNome(zona) {
  if (!Object.hasOwn(ZONAS, zona)) throw new RangeError(`Zona inválida: ${zona}`);
  return ZONAS[zona].nome;
}

function nivelN(nivel) {
  if (!Object.hasOwn(NIVEIS, nivel)) throw new RangeError(`Nível inválido: ${nivel}`);
  return NIVEIS[nivel].n;
}

/**
 * Compatibilidade de um grupo (contrato Group) com as respostas do /encontrar, portada do
 * calcMatch do protótipo. q = { zona: 'qualquer'|zona, pace: segundos/km, dias: string[],
 * nivel, periodo: ''|chave de PERIODOS }. Devolve { pct, why } com os motivos na ordem
 * zona, pace, dias, nível, período.
 */
export function calcMatch(group, q) {
  let s = 0;
  let max = 0;
  const why = [];

  const zona = zonaNome(group.zone);
  if (q.zona !== 'qualquer') zonaNome(q.zona);
  max += 30;
  if (q.zona === 'qualquer' || q.zona === group.zone) {
    s += 30;
    if (q.zona !== 'qualquer') why.push(`Fica na ${zona}`);
  }

  // Bordas inclusivas, como no protótipo (o filtro de pace da /grupos exige cruzar a faixa).
  max += 35;
  if (q.pace >= group.pace_min_s && q.pace <= group.pace_max_s) {
    s += 35;
    why.push('Seu pace está na faixa do grupo');
  } else {
    const d = Math.min(Math.abs(q.pace - group.pace_min_s), Math.abs(q.pace - group.pace_max_s));
    if (d <= 30) {
      s += 20;
      why.push('Seu pace está a até 30 s/km da faixa');
    } else if (d <= 60) {
      s += 8;
    }
  }

  max += 20;
  const comuns = group.days.filter((d) => q.dias.includes(d));
  if (comuns.length > 0) {
    s += 20;
    why.push(`Treina ${fmtDiasLongo(comuns).toLowerCase()}`);
  }

  max += 15;
  const dn = Math.abs(nivelN(group.level) - nivelN(q.nivel));
  if (dn === 0) {
    s += 15;
    why.push('Mesmo nível que você');
  } else if (dn === 1) {
    s += 6;
  }

  if (q.periodo) {
    max += 10;
    if (periodoDe(group.start_time) === q.periodo) {
      s += 10;
      why.push('No horário que você prefere');
    }
  }

  return { pct: Math.round((s / max) * 100), why };
}

/**
 * Grupos com pct >= MATCH_MIN_PCT, do mais para o menos compatível, no máximo MATCH_LIMIT.
 * O sort é estável: no empate vale a ordem de `groups` (ordem de cadastro, como no protótipo).
 */
export function rankMatches(groups, q) {
  return groups
    .map((group) => ({ group, ...calcMatch(group, q) }))
    .filter((r) => r.pct >= MATCH_MIN_PCT)
    .sort((a, b) => b.pct - a.pct)
    .slice(0, MATCH_LIMIT);
}
