const PACE_RE = /^(\d{1,2}):([0-5]\d)$/;
const PACE_MIN_S = 180;
const PACE_MAX_S = 720;

// Lança em vez de devolver "NaN:NaN": valor fora disso é bug a montante, não dado para exibir.
export function fmtPace(s) {
  if (!Number.isInteger(s) || s < 0) throw new RangeError(`Pace inválido: ${s}`);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function fmtFaixa(minS, maxS) {
  return `${fmtPace(minS)}–${fmtPace(maxS)} min/km`;
}

/** Converte "m:ss" em segundos por km; devolve null fora do formato ou de 3:00–12:00. */
export function parsePace(str) {
  if (typeof str !== 'string') return null;
  const m = str.trim().match(PACE_RE);
  if (!m) return null;
  const s = Number(m[1]) * 60 + Number(m[2]);
  return s < PACE_MIN_S || s > PACE_MAX_S ? null : s;
}
