const MAX_LENGTH = 512;
// Barra invertida e controles: alguns navegadores normalizam `/\host` para `//host` (open redirect).
// eslint-disable-next-line no-control-regex -- os controles são justamente o alvo
const UNSAFE = /[\\\u0000-\u001f\u007f\s]/;

/** Devolve um caminho interno seguro para redirecionar, ou `fallback`. */
export function safeNext(raw, fallback = '/meus') {
  if (typeof raw !== 'string' || raw.length > MAX_LENGTH) return fallback;
  if (!raw.startsWith('/') || raw.startsWith('//')) return fallback;
  if (UNSAFE.test(raw)) return fallback;
  return raw;
}
