// Slugs são gerados só com [a-z0-9-]; fora disso a rota responde 404 sem ir ao banco.
const SLUG_RE = /^[a-z0-9-]{1,60}$/;

// Colidem com /grupos/novo e /grupos/zona/:zona.
export const RESERVED_SLUGS = ['novo', 'zona'];

export function isSlug(value) {
  return typeof value === 'string' && SLUG_RE.test(value);
}

export function slugify(nome) {
  const base = String(nome)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    // O corte pode deixar um '-' no fim.
    .replace(/-+$/, '');
  return base || 'grupo';
}

export function nextSlug(base, taken) {
  const used = new Set(taken);
  const free = (s) => !used.has(s) && !RESERVED_SLUGS.includes(s);
  if (free(base)) return base;
  for (let n = 2; ; n++) {
    if (free(`${base}-${n}`)) return `${base}-${n}`;
  }
}
