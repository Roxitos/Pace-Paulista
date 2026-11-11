// Slugs são gerados só com [a-z0-9-]; fora disso a rota responde 404 sem ir ao banco.
const SLUG_RE = /^[a-z0-9-]{1,60}$/;

export function isSlug(value) {
  return typeof value === 'string' && SLUG_RE.test(value);
}
