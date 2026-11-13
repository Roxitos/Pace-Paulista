import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { pool } from '../../src/db/pool.js';
import { requireAuth } from '../../src/middlewares/requireAuth.js';
import { createTestApp, getCsrf } from '../helpers/auth.js';
import { insertUser, migrateTestDb, seedDemo, truncateAll } from '../helpers/db.js';

const app = createTestApp();

async function loggedAgent(userId) {
  const agent = request.agent(app);
  await agent.get(`/__test/login/${userId}`).expect(200);
  return agent;
}

async function sessionCount() {
  const { rows } = await pool.query('SELECT count(*)::int AS n FROM "session"');
  return rows[0].n;
}

beforeAll(async () => {
  await migrateTestDb(pool);
});
beforeEach(async () => {
  await seedDemo(pool);
});
afterAll(async () => {
  await truncateAll(pool);
  await pool.end();
});

describe('visitante anônimo', () => {
  it.each(['/', '/grupos', '/grupos/correria-do-carmo', '/encontrar', '/zonas', '/mapa', '/sobre'])(
    'GET %s não cria cookie nem sessão (CA1)',
    async (path) => {
      const res = await request(app).get(path);
      expect(res.status).toBe(200);
      expect(res.headers['set-cookie']).toBeUndefined();
      expect(await sessionCount()).toBe(0);
    },
  );
});

describe('cookie de sessão', () => {
  it('sai httpOnly, lax, 30 dias, sem Secure, com userId gravado (CA2)', async () => {
    const id = await insertUser(pool, 'Ana');
    const res = await request(app).get(`/__test/login/${id}`);
    const cookie = res.headers['set-cookie'][0];
    expect(cookie).toMatch(/^pp\.sid=/);
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/SameSite=Lax/);
    expect(cookie).toMatch(/Max-Age=2592000|Expires=/);
    expect(cookie).not.toMatch(/Secure/);
    const { rows } = await pool.query('SELECT sess FROM "session"');
    expect(rows).toHaveLength(1);
    expect(rows[0].sess.userId).toBe(String(id));
  });
});

describe('requireAuth', () => {
  it('GET /meus sem sessão redireciona com next (CA3)', async () => {
    const res = await request(app).get('/meus');
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/conta/entrar?next=%2Fmeus');
    const res2 = await request(app).get('/meus?x=1');
    expect(res2.headers.location).toBe('/conta/entrar?next=%2Fmeus%3Fx%3D1');
  });

  it('POST protegido sem sessão redireciona sem next (CA3)', () => {
    const redirects = [];
    requireAuth({ method: 'POST' }, { redirect: (...a) => redirects.push(a) }, () => {});
    expect(redirects).toEqual([[303, '/conta/entrar']]);
  });
});

describe('/meus logado', () => {
  it('mostra a conta com dados escapados e Cache-Control private (CA4)', async () => {
    const id = await insertUser(pool, '<b>x</b>', { email: 'ana@exemplo.com' });
    const agent = await loggedAgent(id);
    const res = await agent.get('/meus');
    expect(res.status).toBe(200);
    expect(res.text).toContain('Conta e dados');
    expect(res.text).toContain('&lt;b&gt;x&lt;/b&gt;');
    expect(res.text).not.toContain('<b><b>x</b></b>');
    expect(res.text).toContain('ana@exemplo.com');
    expect(res.headers['cache-control']).toBe('private, no-store');
    const pub = await agent.get('/grupos/correria-do-carmo');
    expect(pub.headers['cache-control']).toBe('private, no-store');
    const anon = await request(app).get('/grupos/correria-do-carmo');
    expect(anon.headers['cache-control']).toBeUndefined();
  });

  it('contato do grupo só aparece logado (CA5)', async () => {
    await pool.query(
      `UPDATE groups SET contact = '@correriadocarmo' WHERE slug = 'correria-do-carmo'`,
    );
    const id = await insertUser(pool, 'Ana');
    const agent = await loggedAgent(id);
    const logged = await agent.get('/grupos/correria-do-carmo');
    expect(logged.text).toContain('Contato');
    expect(logged.text).toContain('@correriadocarmo');
    const anon = await request(app).get('/grupos/correria-do-carmo');
    expect(anon.text).not.toContain('@correriadocarmo');
  });

  it('usuário apagado vira anônimo, sem erro (CA6)', async () => {
    const id = await insertUser(pool, 'Ana');
    const agent = await loggedAgent(id);
    await pool.query('DELETE FROM users WHERE id = $1', [id]);
    const res = await agent.get('/meus');
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/conta/entrar?next=%2Fmeus');
    expect((await agent.get('/')).status).toBe(200);
  });
});

describe('CSRF', () => {
  it('POST sem token, com token de outra sessão ou do mesmo agente (CA7)', async () => {
    const agent = request.agent(app);
    const noToken = await agent.post('/__test/eco').type('form').send({});
    expect(noToken.status).toBe(403);
    expect(noToken.text).toContain('Atualizar e tentar de novo');
    expect(noToken.text).toContain('Sua sessão expirou');

    const token = await getCsrf(agent);
    expect(await getCsrf(agent)).toBe(token);

    const other = request.agent(app);
    const otherToken = await getCsrf(other);
    const wrong = await agent.post('/__test/eco').type('form').send({ _csrf: otherToken });
    expect(wrong.status).toBe(403);

    const ok = await agent.post('/__test/eco').type('form').send({ _csrf: token });
    expect(ok.status).toBe(200);
    expect(ok.text).toBe('eco');
  });

  it('botão de retry volta ao Referer do mesmo host', async () => {
    const res = await request(app)
      .post('/__test/eco')
      .set('Host', 'localhost')
      .set('Referer', 'http://localhost/grupos?zona=sul')
      .type('form')
      .send({});
    expect(res.text).toContain('href="/grupos?zona=sul"');
  });
});

describe('limite do body', () => {
  it('urlencoded acima de 16 kB responde 413 com a página genérica (CA8)', async () => {
    const res = await request(app)
      .post('/__test/eco')
      .type('form')
      .send({ x: 'a'.repeat(20_000) });
    expect(res.status).toBe(413);
    expect(res.text).toContain('Algo deu errado');
  });
});
