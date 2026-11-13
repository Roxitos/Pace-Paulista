import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { pool } from '../../src/db/pool.js';
import { signup } from '../../src/modules/auth/auth.service.js';
import { createTestApp, getCsrf } from '../helpers/auth.js';
import { insertMembership, migrateTestDb, seedDemo, truncateAll } from '../helpers/db.js';

const SENHA = 'abcdefg!';
const ok = { email: 'ana@x.com', senha: SENHA };

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

async function criarUsuario() {
  const { user } = await signup({ displayName: 'Ana', email: 'ana@x.com', password: SENHA });
  return user.id;
}

async function logar(app) {
  const agent = request.agent(app);
  const csrf = await getCsrf(agent, '/conta/entrar');
  await agent
    .post('/conta/entrar')
    .type('form')
    .send({ _csrf: csrf, ...ok })
    .expect(303);
  return agent;
}

const countUsers = async () => (await pool.query('SELECT count(*)::int n FROM users')).rows[0].n;

describe('GET /meus (2 passos sem JS)', () => {
  it('1º passo mostra só o link; ?excluir=1 mostra o alerta e o form (CA1)', async () => {
    await criarUsuario();
    const agent = await logar(createTestApp());

    const um = await agent.get('/meus');
    expect(um.text).toContain('href="/meus?excluir=1#conta"');
    expect(um.text).not.toContain('action="/conta/excluir"');

    const dois = await agent.get('/meus?excluir=1');
    expect(dois.text).toContain('Tem certeza que deseja excluir?');
    expect(dois.text).toContain('action="/conta/excluir"');
    expect(dois.text).toMatch(/action="\/conta\/excluir"[^>]*>\s*<input[^>]*name="_csrf"/);
    expect(dois.text).toContain('Excluir conta');
    expect(dois.text).toContain('href="/meus#conta"');
  });
});

describe('POST /conta/excluir', () => {
  it('apaga usuário, participação e sessão, libera o e-mail; o grupo fica sem dono (CA2, CA3)', async () => {
    const userId = await criarUsuario();
    await insertMembership(pool, userId, 'pace-da-oca', 'Ana');
    await pool.query("UPDATE groups SET owner_id = $1 WHERE slug = 'raia-usp'", [userId]);
    const antes = (await pool.query('SELECT count(*)::int n FROM memberships')).rows[0].n;
    const app = createTestApp();
    const agent = await logar(app);
    const csrf = await getCsrf(agent, '/meus?excluir=1');

    const res = await agent.post('/conta/excluir').type('form').send({ _csrf: csrf });
    expect(res.status).toBe(303);
    expect(res.headers.location).toBe('/?conta=excluida');
    expect(res.headers['set-cookie'].join(';')).toMatch(/pp\.sid=;.*Expires=Thu, 01 Jan 1970/);

    expect(await countUsers()).toBe(0);
    const depois = (await pool.query('SELECT count(*)::int n FROM memberships')).rows[0].n;
    expect(antes - depois).toBe(1);
    const { rows } = await pool.query(
      "SELECT status, owner_id FROM groups WHERE slug = 'raia-usp'",
    );
    expect(rows[0]).toEqual({ status: 'published', owner_id: null });
    const sessoes = await pool.query(`SELECT 1 FROM "session" WHERE sess->>'userId' = $1`, [
      String(userId),
    ]);
    expect(sessoes.rowCount).toBe(0);

    await agent.get('/meus').expect(302);
    await expect(
      signup({ displayName: 'Ana', email: 'ana@x.com', password: SENHA }),
    ).resolves.toBeTruthy();
  });

  it('sessão de outro aparelho vira anônima (CA4)', async () => {
    await criarUsuario();
    const app = createTestApp();
    const a = await logar(app);
    const b = await logar(app);
    const csrf = await getCsrf(a, '/meus?excluir=1');
    await a.post('/conta/excluir').type('form').send({ _csrf: csrf }).expect(303);

    await b.get('/meus').expect(302);
    await b.get('/').expect(200);
  });

  it('sem _csrf dá 403 e deslogado vai ao login; nada é apagado (CA5)', async () => {
    await criarUsuario();
    const agent = await logar(createTestApp());
    await agent.post('/conta/excluir').type('form').send({}).expect(403);
    expect(await countUsers()).toBe(1);

    const anon = request.agent(createTestApp());
    const csrf = await getCsrf(anon, '/conta/entrar');
    const res = await anon.post('/conta/excluir').type('form').send({ _csrf: csrf });
    expect(res.status).toBe(303);
    expect(res.headers.location).toMatch(/^\/conta\/entrar/);
    expect(await countUsers()).toBe(1);
  });
});

describe('GET / com ?conta=excluida', () => {
  it('mostra o aviso só com o valor exato (CA6)', async () => {
    const app = createTestApp();
    const com = await request(app).get('/?conta=excluida');
    expect(com.text).toContain('role="status"');
    expect(com.text).toContain('Sua conta foi excluída.');
    for (const url of ['/', '/?conta=x']) {
      expect((await request(app).get(url)).text).not.toContain('Sua conta foi excluída.');
    }
  });

  it('não mostra o aviso a quem está logado (link forjado)', async () => {
    await criarUsuario();
    const agent = await logar(createTestApp());
    const res = await agent.get('/?conta=excluida').expect(200);
    expect(res.text).not.toContain('Sua conta foi excluída.');
  });
});
