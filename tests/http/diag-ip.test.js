import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { pool } from '../../src/db/pool.js';
import { createApp } from '../../src/app.js';
import { migrateTestDb } from '../helpers/db.js';

beforeAll(() => migrateTestDb(pool));
afterAll(() => pool.end());

describe('GET /diag/ip (temporário, CA11 da spec 020)', () => {
  it('sem DIAG_IP responde 404 como qualquer rota inexistente', async () => {
    const res = await request(createApp()).get('/diag/ip');
    expect(res.status).toBe(404);
    expect(res.body.ip).toBeUndefined();
  });

  it('ligada: devolve os campos, no-store e sem cookie', async () => {
    const res = await request(createApp({ diagIp: true, trustProxy: 1 }))
      .get('/diag/ip')
      .set('X-Forwarded-For', '203.0.113.7')
      .set('CF-Connecting-IP', '198.51.100.1');
    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.headers['set-cookie']).toBeUndefined();
    expect(res.body).toEqual({
      ip: '203.0.113.7',
      ips: ['203.0.113.7'],
      trustProxy: 1,
      xForwardedFor: '203.0.113.7',
      socketRemoteAddress: expect.any(String),
      cfConnectingIp: '198.51.100.1',
      trueClientIp: null,
    });
  });

  it('reflete o X-Forwarded-For conforme o trust proxy (1 vs 2)', async () => {
    const xff = '203.0.113.7, 198.51.100.2';
    const one = await request(createApp({ diagIp: true, trustProxy: 1 }))
      .get('/diag/ip')
      .set('X-Forwarded-For', xff);
    const two = await request(createApp({ diagIp: true, trustProxy: 2 }))
      .get('/diag/ip')
      .set('X-Forwarded-For', xff);
    expect(one.body.ip).toBe('198.51.100.2');
    expect(one.body.ips).toHaveLength(1);
    expect(two.body.ip).toBe('203.0.113.7');
    expect(two.body.ips).toHaveLength(2);
    expect(two.body.trustProxy).toBe(2);
  });

  it('não vaza outros cabeçalhos nem segredos', async () => {
    const res = await request(createApp({ diagIp: true }))
      .get('/diag/ip')
      .set('Cookie', 'sid=segredo-de-sessao')
      .set('Authorization', 'Bearer token-secreto')
      .set('X-Outro', 'valor-qualquer');
    expect(res.status).toBe(200);
    expect(Object.keys(res.body).sort()).toEqual(
      [
        'cfConnectingIp',
        'ip',
        'ips',
        'socketRemoteAddress',
        'trueClientIp',
        'trustProxy',
        'xForwardedFor',
      ].sort(),
    );
    expect(res.text).not.toMatch(/segredo|token-secreto|valor-qualquer/);
  });

  it('tem limite próprio de 30/min por IP', async () => {
    const app = createApp({ diagIp: true });
    let last;
    for (let i = 0; i < 31; i += 1) last = await request(app).get('/diag/ip');
    expect(last.status).toBe(429);
    expect(last.headers['cache-control']).toBe('no-store');
  });
});
