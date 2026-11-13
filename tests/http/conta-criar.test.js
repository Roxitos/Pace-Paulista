import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { pool } from '../../src/db/pool.js';
import { signup } from '../../src/modules/auth/auth.service.js';
import { createTestApp, getCsrf } from '../helpers/auth.js';
import { migrateTestDb, truncateAll } from '../helpers/db.js';

const SENHA = 'abcdefg!';
const valido = { nome: 'Ana', email: 'ana@x.com', senha: SENHA };

beforeAll(async () => {
  await migrateTestDb(pool);
});
beforeEach(async () => {
  await truncateAll(pool);
});
afterEach(() => {
  vi.restoreAllMocks();
});
afterAll(async () => {
  await truncateAll(pool);
  await pool.end();
});

// App novo por teste: o rate limit tem memória própria por createApp.
async function start() {
  const agent = request.agent(createTestApp());
  const csrf = await getCsrf(agent, '/conta/criar');
  return { agent, csrf };
}

const post = (agent, csrf, body) =>
  agent
    .post('/conta/criar')
    .type('form')
    .send({ _csrf: csrf, ...body });
const countUsers = async () => (await pool.query('SELECT count(*)::int AS n FROM users')).rows[0].n;

describe('GET /conta/criar', () => {
  it('mostra o form com _csrf e os três campos (CA1)', async () => {
    const res = await request(createTestApp()).get('/conta/criar');
    expect(res.status).toBe(200);
    expect(res.text).toMatch(/name="_csrf"/);
    for (const name of ['nome', 'email', 'senha']) expect(res.text).toContain(`name="${name}"`);
  });

  it('logado redireciona para /meus ou next válido (CA1)', async () => {
    const { agent, csrf } = await start();
    await post(agent, csrf, valido).expect(303);
    await agent.get('/conta/criar').expect(302).expect('Location', '/meus');
    await agent.get('/conta/criar?next=/grupos').expect(302).expect('Location', '/grupos');
  });

  it('preserva next válido no form e no link de entrar, descarta inválido', async () => {
    const app = createTestApp();
    const a = await request(app).get('/conta/criar?next=/grupos/x%23participar');
    expect(a.text).toContain('name="next" value="/grupos/x#participar"');
    expect(a.text).toContain('/conta/entrar?next=%2Fgrupos%2Fx%23participar');
    const b = await request(app).get('/conta/criar?next=//evil.com');
    expect(b.text).not.toContain('name="next"');
  });
});

describe('POST /conta/criar', () => {
  it('cria a conta com bcrypt cost 12, troca o cookie e loga (CA2)', async () => {
    const { agent, csrf } = await start();
    const res = await post(agent, csrf, valido);
    expect(res.status).toBe(303);
    expect(res.headers.location).toBe('/meus');
    expect(res.headers['set-cookie'][0]).toMatch(/^pp\.sid=/);
    const { rows } = await pool.query('SELECT * FROM users');
    expect(rows).toHaveLength(1);
    expect(rows[0].password_hash).toMatch(/^\$2b\$12\$/);
    expect(rows[0].password_hash).not.toBe(SENHA);
    const meus = await agent.get('/meus');
    expect(meus.status).toBe(200);
    expect(meus.text).toContain('Ana');
  });

  it('regenera a sessão: o id do cookie muda (CA2)', async () => {
    const app = createTestApp();
    const anon = await request(app).get('/conta/criar');
    const cookieAntes = anon.headers['set-cookie'][0].split(';')[0];
    const csrf = /name="_csrf" value="([^"]+)"/.exec(anon.text)[1];
    const res = await request(app)
      .post('/conta/criar')
      .set('Cookie', cookieAntes)
      .type('form')
      .send({ _csrf: csrf, ...valido });
    expect(res.status).toBe(303);
    expect(res.headers['set-cookie'][0].split(';')[0]).not.toBe(cookieAntes);
  });

  it('redireciona para o next interno (CA3)', async () => {
    const { agent, csrf } = await start();
    const next = '/grupos/correria-do-carmo#participar';
    const res = await post(agent, csrf, { ...valido, next });
    expect(res.headers.location).toBe(next);
  });

  it('ignora next externo e vai para /meus (CA3)', async () => {
    const { agent, csrf } = await start();
    const res = await post(agent, csrf, { ...valido, next: '//evil.com' });
    expect(res.headers.location).toBe('/meus');
  });

  it('nome inválido: 422, valor trimado, aria-invalid e autofocus (CA4)', async () => {
    const { agent, csrf } = await start();
    const res = await post(agent, csrf, { ...valido, nome: ' a ', email: 'ana@x.com' });
    expect(res.status).toBe(422);
    expect(res.text).toContain('Informe um nome com pelo menos 2 caracteres.');
    expect(res.text).toContain('value="a"');
    expect(res.text).toMatch(/id="a-nome"[^>]*aria-invalid="true"[^>]*autofocus/);
    expect(res.text).toContain('Corrija 1 campo para continuar.');
    expect(await countUsers()).toBe(0);
  });

  it('NUL no nome ou no e-mail não vira 500 (22021 do Postgres)', async () => {
    const { agent, csrf } = await start();
    const ruim = await post(agent, csrf, { ...valido, email: 'a\0na@x.com' });
    expect(ruim.status).toBe(422);
    expect(ruim.text).toContain('Informe um e-mail válido.');
    await post(agent, csrf, { ...valido, nome: 'A\0na' }).expect(303);
    const { rows } = await pool.query('SELECT display_name FROM users');
    expect(rows).toEqual([{ display_name: 'Ana' }]);
  });

  it('três campos inválidos: topo com a contagem (CA7)', async () => {
    const { agent, csrf } = await start();
    const res = await post(agent, csrf, { nome: '', email: 'x', senha: 'curta' });
    expect(res.status).toBe(422);
    expect(res.text).toContain('Corrija 3 campos para continuar.');
  });

  it('e-mail duplicado sem diferenciar caixa: 422 e nenhuma linha nova (CA5)', async () => {
    const { agent, csrf } = await start();
    await post(agent, csrf, { ...valido, email: 'ana@x.com' }).expect(303);
    const outro = await start();
    const res = await post(outro.agent, outro.csrf, { ...valido, email: 'ANA@x.com' });
    expect(res.status).toBe(422);
    expect(res.text).toContain('Já existe uma conta com esse e-mail.');
    expect(await countUsers()).toBe(1);
  });

  it('a senha nunca volta no HTML (CA6)', async () => {
    const { agent, csrf } = await start();
    const res = await post(agent, csrf, { ...valido, nome: '' });
    expect(res.status).toBe(422);
    expect(res.text).not.toContain(SENHA);
  });

  it('sem _csrf: 403 e nenhuma conta (CA8)', async () => {
    const { agent } = await start();
    const res = await agent.post('/conta/criar').type('form').send(valido);
    expect(res.status).toBe(403);
    expect(await countUsers()).toBe(0);
  });

  it('11º POST do mesmo IP: 429 com form preenchido e sem senha (CA9)', async () => {
    const { agent, csrf } = await start();
    for (let i = 0; i < 10; i += 1) {
      await post(agent, csrf, { nome: '', email: '', senha: '' }).expect(422);
    }
    const res = await post(agent, csrf, { ...valido, nome: 'Bia' });
    expect(res.status).toBe(429);
    expect(res.text).toContain('Muitas tentativas. Espere alguns minutos e tente de novo.');
    expect(res.text).toContain('value="Bia"');
    expect(res.text).not.toContain(SENHA);
    expect(await countUsers()).toBe(0);

    const novo = await start();
    await post(novo.agent, novo.csrf, valido).expect(303);
  });

  it('não loga senha, hash nem e-mail (CA11)', async () => {
    const spies = ['log', 'info', 'warn', 'error'].map((m) =>
      vi.spyOn(console, m).mockImplementation(() => {}),
    );
    const { agent, csrf } = await start();
    await post(agent, csrf, valido).expect(303);
    await post(agent, csrf, { ...valido, nome: '' });
    const out = JSON.stringify(spies.flatMap((s) => s.mock.calls));
    expect(out).not.toContain(SENHA);
    expect(out).not.toContain('ana@x.com');
    expect(out).not.toContain('$2b$');
  });
});

describe('signup (service)', () => {
  it('dois cadastros simultâneos com o mesmo e-mail: um cria, o outro recebe erro (CA10)', async () => {
    const data = { displayName: 'Ana', email: 'corrida@x.com', password: SENHA };
    const results = await Promise.all([signup(data), signup(data)]);
    expect(results.filter((r) => r.user)).toHaveLength(1);
    expect(
      results.filter((r) => r.errors?.email === 'Já existe uma conta com esse e-mail.'),
    ).toHaveLength(1);
    expect(await countUsers()).toBe(1);
  });
});
