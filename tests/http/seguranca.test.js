import express from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { pool } from '../../src/db/pool.js';
import { createRateLimits } from '../../src/middlewares/rateLimits.js';
import { securityHeaders } from '../../src/middlewares/securityHeaders.js';
import { createTestApp } from '../helpers/auth.js';
import { migrateTestDb } from '../helpers/db.js';

beforeAll(() => migrateTestDb(pool));
afterAll(() => pool.end());

const EXPECTED_CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "connect-src 'self'",
  "font-src 'self' https://fonts.gstatic.com",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "img-src 'self'",
  "object-src 'none'",
  "script-src 'self'",
  "script-src-attr 'none'",
  "style-src 'self' https://fonts.googleapis.com",
  "style-src-attr 'unsafe-inline'",
];

const withProbe = (options) =>
  createTestApp({
    ...options,
    beforeErrorHandlers(app) {
      app.get('/__test/ip', (req, res) => res.json({ ip: req.ip, secure: req.secure }));
    },
  });

describe('cabeçalhos de segurança', () => {
  it('GET / traz a CSP exata e os demais cabeçalhos, sem HSTS nem X-Powered-By', async () => {
    const res = await request(createTestApp()).get('/');
    expect(res.headers['content-security-policy'].split(';')).toEqual(EXPECTED_CSP);
    expect(res.headers['x-frame-options']).toBe('DENY');
    expect(res.headers['referrer-policy']).toBe('same-origin');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['strict-transport-security']).toBeUndefined();
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('arquivos estáticos e a API também trazem CSP e nosniff', async () => {
    const app = createTestApp();
    for (const path of ['/css/app.css', '/api/grupos']) {
      const res = await request(app).get(path);
      expect(res.headers['content-security-policy']).toContain("default-src 'self'");
      expect(res.headers['x-content-type-options']).toBe('nosniff');
    }
  });

  it('em produção acrescenta HSTS e upgrade-insecure-requests', async () => {
    const app = express();
    app.use(securityHeaders({ NODE_ENV: 'production' }));
    app.get('/', (req, res) => res.send('ok'));
    const res = await request(app).get('/');
    expect(res.headers['strict-transport-security']).toContain('max-age=');
    expect(res.headers['content-security-policy'].split(';')).toEqual([
      ...EXPECTED_CSP,
      'upgrade-insecure-requests',
    ]);
  });
});

describe('GET /healthz', () => {
  it('responde ok em texto, sem cookie, com no-store e cabeçalhos de segurança', async () => {
    const app = createTestApp();
    for (const method of ['get', 'head']) {
      const res = await request(app)[method]('/healthz');
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toBe('text/plain; charset=utf-8');
      expect(res.headers['cache-control']).toBe('no-store');
      expect(res.headers['set-cookie']).toBeUndefined();
      expect(res.headers['content-security-policy']).toContain("default-src 'self'");
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      if (method === 'get') expect(res.text).toBe('ok');
    }
  });

  it('não entra no rate limit de leitura', async () => {
    const app = createTestApp({ rateLimits: createRateLimits({ read: { limit: 1 } }) });
    for (let i = 0; i < 4; i += 1) {
      expect((await request(app).get('/healthz')).status).toBe(200);
    }
  });
});

describe('trust proxy', () => {
  const headers = { 'X-Forwarded-For': '203.0.113.7', 'X-Forwarded-Proto': 'https' };

  it('com 1 salto usa o IP e o protocolo do proxy', async () => {
    const res = await request(withProbe({ trustProxy: 1 }))
      .get('/__test/ip')
      .set(headers);
    expect(res.body).toEqual({ ip: '203.0.113.7', secure: true });
  });

  it('com 0 ignora os cabeçalhos', async () => {
    const res = await request(withProbe({ trustProxy: 0 }))
      .get('/__test/ip')
      .set(headers);
    expect(res.body.ip).not.toBe('203.0.113.7');
    expect(res.body.secure).toBe(false);
  });
});

describe('favicon', () => {
  it('serve o SVG, linka no layout e redireciona o .ico', async () => {
    const app = createTestApp();
    const svg = await request(app).get('/favicon.svg');
    expect(svg.status).toBe(200);
    expect(svg.headers['content-type']).toMatch(/image\/svg\+xml/);
    const ico = await request(app).get('/favicon.ico');
    expect(ico.status).toBe(301);
    expect(ico.headers.location).toBe('/favicon.svg');
    const home = await request(app).get('/');
    expect(home.text).toContain('<link rel="icon" href="/favicon.svg" type="image/svg+xml">');
  });
});
