import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { pool } from '../../src/db/pool.js';
import { createTestApp, getCsrf } from '../helpers/auth.js';
import { migrateTestDb, seedDemo, truncateAll } from '../helpers/db.js';

beforeAll(async () => {
  await migrateTestDb(pool);
});
beforeEach(async () => {
  await truncateAll(pool);
});
afterAll(async () => {
  await truncateAll(pool);
  await pool.end();
});

describe('fluxo da conta (M5)', () => {
  it('criar conta, sair, entrar e ver o contato só enquanto logado (CA10)', async () => {
    await seedDemo(pool);
    await pool.query("UPDATE groups SET contact = '@correria' WHERE slug = 'correria-do-carmo'");
    const agent = request.agent(createTestApp());
    const form = (path, body) => agent.post(path).type('form').send(body);
    const pagina = () => agent.get('/grupos/correria-do-carmo');

    let csrf = await getCsrf(agent, '/conta/criar');
    await form('/conta/criar', {
      _csrf: csrf,
      nome: 'Ana',
      email: 'ana@x.com',
      senha: 'abcdefg!',
    }).expect(303);
    expect((await agent.get('/meus')).text).toContain('Ana');

    csrf = await getCsrf(agent, '/meus');
    await form('/conta/sair', { _csrf: csrf }).expect(303);
    await agent.get('/meus').expect(302);

    csrf = await getCsrf(agent, '/conta/entrar');
    await form('/conta/entrar', { _csrf: csrf, email: 'ana@x.com', senha: 'abcdefg!' }).expect(303);
    expect((await agent.get('/meus')).status).toBe(200);
    expect((await pagina()).text).toContain('Contato');

    csrf = await getCsrf(agent, '/meus');
    await form('/conta/sair', { _csrf: csrf }).expect(303);
    expect((await pagina()).text).not.toContain('Contato');
  });

  it('entrar, excluir a conta e não conseguir mais entrar (CA7)', async () => {
    const agent = request.agent(createTestApp());
    const form = (path, body) => agent.post(path).type('form').send(body);
    const dados = { nome: 'Ana', email: 'ana@x.com', senha: 'abcdefg!' };

    let csrf = await getCsrf(agent, '/conta/criar');
    await form('/conta/criar', { _csrf: csrf, ...dados }).expect(303);
    csrf = await getCsrf(agent, '/meus');
    await form('/conta/sair', { _csrf: csrf }).expect(303);
    csrf = await getCsrf(agent, '/conta/entrar');
    await form('/conta/entrar', { _csrf: csrf, ...dados }).expect(303);

    csrf = await getCsrf(agent, '/meus?excluir=1');
    await form('/conta/excluir', { _csrf: csrf })
      .expect(303)
      .expect('Location', '/?conta=excluida');

    csrf = await getCsrf(agent, '/conta/entrar');
    await form('/conta/entrar', { _csrf: csrf, ...dados }).expect(401);
  });
});
