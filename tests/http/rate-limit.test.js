import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { pool } from '../../src/db/pool.js';
import { createRateLimits } from '../../src/middlewares/rateLimits.js';
import { createTestApp, getCsrf, signedUp } from '../helpers/auth.js';
import { migrateTestDb, seedDemo } from '../helpers/db.js';

beforeAll(() => migrateTestDb(pool));
beforeEach(() => seedDemo(pool));
afterAll(() => pool.end());

const appWith = (overrides, options) =>
  createTestApp({ rateLimits: createRateLimits(overrides), ...options });
const SLUG = 'pace-da-oca';

describe('rate limit de leitura', () => {
  it('3ª GET /grupos dá 429 em HTML; /encontrar divide o balde; outras páginas seguem 200', async () => {
    const app = appWith({ read: { limit: 2 } });
    await request(app).get('/grupos').expect(200);
    await request(app).get('/encontrar').expect(200);
    const res = await request(app).get('/grupos');
    expect(res.status).toBe(429);
    expect(res.text).toContain('Algo deu errado');
    expect(res.headers['retry-after']).toBeDefined();
    await request(app).get('/zonas').expect(200);
    await request(app).get(`/grupos/${SLUG}`).expect(200);
  });
});

describe('rate limit da API', () => {
  it('3ª GET /api/grupos dá 429 JSON; /api/mapa divide o balde; /grupos não é afetado', async () => {
    const app = appWith({ api: { limit: 2 } });
    await request(app).get('/api/grupos').expect(200);
    await request(app).get(`/api/mapa/${SLUG}`).expect(200);
    const res = await request(app).get('/api/grupos');
    expect(res.status).toBe(429);
    expect(res.body).toEqual({ error: 'rate_limited' });
    expect(res.headers['cache-control']).toBe('private, no-store');
    expect(res.headers['retry-after']).toBeDefined();
    await request(app).get('/grupos').expect(200);
  });
});

describe('rate limit por usuário', () => {
  it('participar/sair: A estoura, B no mesmo IP não', async () => {
    const app = appWith({ membership: { limit: 2 } });
    const post = async (agent, acao) => {
      const csrf = await getCsrf(agent, `/grupos/${SLUG}`);
      return agent
        .post(`/grupos/${SLUG}/${acao}`)
        .type('form')
        .send({ _csrf: csrf, apelido: 'Ana', ok: 'on' });
    };
    const a = await signedUp(app, 'Ana Souza', 'ana@exemplo.com');
    const b = await signedUp(app, 'Beto Lima', 'beto@exemplo.com');
    expect((await post(a, 'participar')).status).toBe(303);
    expect((await post(a, 'sair')).status).toBe(303);
    expect((await post(a, 'participar')).status).toBe(429);
    expect((await post(b, 'participar')).status).toBe(303);
  });

  it('POST /grupos: o 2º do mesmo usuário dá 429; sem CSRF dá 403 e não consome o balde', async () => {
    const app = appWith({ createGroup: { limit: 1 } });
    const agent = await signedUp(app, 'Ana Souza', 'ana@exemplo.com');
    await agent.post('/grupos').type('form').send({}).expect(403);
    const csrf = await getCsrf(agent, '/grupos/novo');
    await agent.post('/grupos').type('form').send({ _csrf: csrf }).expect(422);
    await agent.post('/grupos').type('form').send({ _csrf: csrf }).expect(429);
  });

  it('POST /grupos/:slug/excluir divide o balde do cadastro: 429 e nada apagado', async () => {
    const app = appWith({ createGroup: { limit: 1 } });
    const agent = await signedUp(app, 'Ana Souza', 'ana@exemplo.com');
    const { rows } = await pool.query(`SELECT id FROM users WHERE email = 'ana@exemplo.com'`);
    await pool.query(
      `INSERT INTO groups (slug, name, zone, location, days, start_time, pace_min_s, pace_max_s,
                           level, description, owner_id)
       VALUES ('meu-grupo', 'Meu Grupo', 'sul', 'Parque', ARRAY['seg'], '06:00', 300, 360,
               'iniciante', 'Descrição com mais de trinta caracteres aqui.', $1)`,
      [rows[0].id],
    );
    const csrf = await getCsrf(agent, '/grupos/novo');
    await agent.post('/grupos').type('form').send({ _csrf: csrf }).expect(422);
    await agent.post('/grupos/meu-grupo/excluir').type('form').send({ _csrf: csrf }).expect(429);
    const { rows: left } = await pool.query(`SELECT 1 FROM groups WHERE slug = 'meu-grupo'`);
    expect(left).toHaveLength(1);
  });
});

describe('rate limit atrás do proxy', () => {
  const get = (app, ip) => request(app).get('/grupos').set('X-Forwarded-For', ip);

  it('IPs diferentes não compartilham o balde com trustProxy 1', async () => {
    const app = appWith({ read: { limit: 1 } }, { trustProxy: 1 });
    await get(app, '203.0.113.1').expect(200);
    await get(app, '203.0.113.2').expect(200);
    await get(app, '203.0.113.1').expect(429);
  });

  it('compartilham com trustProxy 0', async () => {
    const app = appWith({ read: { limit: 1 } }, { trustProxy: 0 });
    await get(app, '203.0.113.1').expect(200);
    await get(app, '203.0.113.2').expect(429);
  });
});
