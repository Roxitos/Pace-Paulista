import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { pool } from '../../src/db/pool.js';
import { signup } from '../../src/modules/auth/auth.service.js';
import { createTestApp, getCsrf } from '../helpers/auth.js';
import { migrateTestDb, truncateAll } from '../helpers/db.js';

const SENHA = 'abcdefg!';

beforeAll(async () => {
  await migrateTestDb(pool);
});
beforeEach(async () => {
  await truncateAll(pool);
  await signup({ displayName: 'Ana <b>', email: 'ana@x.com', password: SENHA });
});
afterEach(() => vi.restoreAllMocks());
afterAll(async () => {
  await truncateAll(pool);
  await pool.end();
});

async function start() {
  const agent = request.agent(createTestApp());
  const csrf = await getCsrf(agent, '/conta/entrar');
  return { agent, csrf };
}
const entrar = (agent, csrf, body) =>
  agent
    .post('/conta/entrar')
    .type('form')
    .send({ _csrf: csrf, ...body });
const ok = { email: 'ana@x.com', senha: SENHA };

describe('GET /conta/entrar', () => {
  it('deslogado: form com _csrf; logado: redireciona para /meus ou next (CA1)', async () => {
    const { agent, csrf } = await start();
    const res = await agent.get('/conta/entrar');
    expect(res.status).toBe(200);
    expect(res.text).toContain('name="senha"');
    await entrar(agent, csrf, ok).expect(303);
    await agent.get('/conta/entrar').expect(302).expect('Location', '/meus');
    await agent
      .get('/conta/entrar?next=/grupos/pace-da-oca%23participar')
      .expect(302)
      .expect('Location', '/grupos/pace-da-oca#participar');
  });

  it('preserva next no form e no link de criar conta', async () => {
    const res = await request(createTestApp()).get('/conta/entrar?next=/grupos/x%23participar');
    expect(res.text).toContain('name="next" value="/grupos/x#participar"');
    expect(res.text).toContain('/conta/criar?next=%2Fgrupos%2Fx%23participar');
  });
});

describe('POST /conta/entrar', () => {
  it('entra, troca o cookie e mostra o nome em /meus (CA2)', async () => {
    const app = createTestApp();
    const anon = await request(app).get('/conta/entrar');
    const antes = anon.headers['set-cookie'][0].split(';')[0];
    const csrf = /name="_csrf" value="([^"]+)"/.exec(anon.text)[1];
    const res = await request(app)
      .post('/conta/entrar')
      .set('Cookie', antes)
      .type('form')
      .send({ _csrf: csrf, ...ok });
    expect(res.status).toBe(303);
    expect(res.headers.location).toBe('/meus');
    const depois = res.headers['set-cookie'][0].split(';')[0];
    expect(depois).not.toBe(antes);
    const meus = await request(app).get('/meus').set('Cookie', depois);
    expect(meus.text).toContain('Ana &lt;b&gt;');
  });

  it('respeita next interno e ignora externo (CA2)', async () => {
    const a = await start();
    const next = '/grupos/correria-do-carmo#participar';
    expect((await entrar(a.agent, a.csrf, { ...ok, next })).headers.location).toBe(next);
    for (const evil of ['//evil.com', 'https://evil.com']) {
      const b = await start();
      expect((await entrar(b.agent, b.csrf, { ...ok, next: evil })).headers.location).toBe('/meus');
    }
  });

  it('aceita outra caixa e espaços no e-mail (CA3)', async () => {
    const { agent, csrf } = await start();
    await entrar(agent, csrf, { ...ok, email: '  ANA@X.COM ' }).expect(303);
  });

  it('senha errada e e-mail inexistente: 401 com o mesmo alerta, e-mail sem senha (CA4)', async () => {
    const a = await start();
    const errada = await entrar(a.agent, a.csrf, { ...ok, senha: 'outra-senha!' });
    const b = await start();
    const inexistente = await entrar(b.agent, b.csrf, {
      email: 'nao@x.com',
      senha: 'outra-senha!',
    });
    for (const res of [errada, inexistente]) {
      expect(res.status).toBe(401);
      expect(res.text).toContain('E-mail ou senha incorretos.');
      expect(res.text).not.toContain('outra-senha!');
      expect(res.text).not.toContain('aria-invalid');
    }
    expect(errada.text).toContain('value="ana@x.com"');
    expect(inexistente.text).toContain('value="nao@x.com"');
  });

  it('campos vazios: 422 com contagem e mensagens (CA5)', async () => {
    const { agent, csrf } = await start();
    const res = await entrar(agent, csrf, { email: '', senha: '' });
    expect(res.status).toBe(422);
    expect(res.text).toContain('Corrija 2 campos para continuar.');
    expect(res.text).toContain('Informe seu e-mail.');
    expect(res.text).toContain('Informe sua senha.');
    expect(res.text).toMatch(/id="l-email"[^>]*aria-invalid="true"[^>]*autofocus/);
  });

  it('11ª falha do mesmo IP+e-mail: 429 mesmo com a senha certa; outro e-mail entra (CA6)', async () => {
    await signup({ displayName: 'Bia', email: 'bia@x.com', password: SENHA });
    const { agent, csrf } = await start();
    for (let i = 0; i < 10; i += 1) {
      await entrar(agent, csrf, { ...ok, senha: 'errada!!1' }).expect(401);
    }
    const res = await entrar(agent, csrf, ok);
    expect(res.status).toBe(429);
    expect(res.text).toContain('Muitas tentativas. Espere alguns minutos e tente de novo.');
    await entrar(agent, csrf, { email: 'bia@x.com', senha: SENHA }).expect(303);
  });

  it('variante Unicode que o citext casa com o mesmo e-mail não ganha cota nova', async () => {
    await signup({ displayName: 'Bia', email: 'bia@x.com', password: SENHA });
    const { agent, csrf } = await start();
    for (let i = 0; i < 10; i += 1) {
      await entrar(agent, csrf, { email: 'bia@x.com', senha: 'errada!!1' }).expect(401);
    }
    // No banco 'bİa@x.com' = 'bia@x.com' (citext), mas no JS o İ minúsculo vira i + U+0307.
    await entrar(agent, csrf, { email: 'bİa@x.com', senha: SENHA }).expect(429);
  });

  it('logins com sucesso não contam para o limite (CA6)', async () => {
    const app = createTestApp();
    for (let i = 0; i < 12; i += 1) {
      const agent = request.agent(app);
      const csrf = await getCsrf(agent, '/conta/entrar');
      await entrar(agent, csrf, ok).expect(303);
    }
  });

  it('sem _csrf: 403 (CA7)', async () => {
    const { agent } = await start();
    await agent.post('/conta/entrar').type('form').send(ok).expect(403);
  });

  it('não loga senha, hash nem e-mail (CA11)', async () => {
    const spies = ['log', 'info', 'warn', 'error'].map((m) =>
      vi.spyOn(console, m).mockImplementation(() => {}),
    );
    const { agent, csrf } = await start();
    await entrar(agent, csrf, { ...ok, senha: 'errada!!1' }).expect(401);
    await entrar(agent, csrf, ok).expect(303);
    const out = JSON.stringify(spies.flatMap((s) => s.mock.calls));
    for (const t of [SENHA, 'errada!!1', 'ana@x.com', '$2b$']) expect(out).not.toContain(t);
  });
});

describe('POST /conta/sair', () => {
  it('destrói a sessão, expira o cookie e volta a pedir login (CA7)', async () => {
    const { agent, csrf } = await start();
    await entrar(agent, csrf, ok).expect(303);
    const csrf2 = await getCsrf(agent, '/meus');
    expect((await pool.query('SELECT count(*)::int AS n FROM session')).rows[0].n).toBe(1);
    const res = await agent.post('/conta/sair').type('form').send({ _csrf: csrf2 });
    expect(res.status).toBe(303);
    expect(res.headers.location).toBe('/');
    expect(res.headers['set-cookie'].join(';')).toMatch(/pp\.sid=;.*Expires=Thu, 01 Jan 1970/);
    expect((await pool.query('SELECT count(*)::int AS n FROM session')).rows[0].n).toBe(0);
    await agent.get('/meus').expect(302);
  });

  it('sem _csrf: 403 e continua logado (CA7)', async () => {
    const { agent, csrf } = await start();
    await entrar(agent, csrf, ok).expect(303);
    await agent.post('/conta/sair').type('form').send({}).expect(403);
    await agent.get('/meus').expect(200);
  });
});

describe('header (CA8)', () => {
  it('deslogado aponta para entrar; logado para /meus com o nome escapado', async () => {
    const { agent, csrf } = await start();
    const anon = await agent.get('/');
    expect(anon.text).toMatch(
      /href="\/conta\/entrar" aria-label="Entrar" title="Entrar" id="meusBtn"/,
    );
    await entrar(agent, csrf, ok).expect(303);
    const logado = await agent.get('/');
    expect(logado.text).toMatch(
      /href="\/meus" aria-label="Meus grupos · Ana &lt;b&gt;" title="Meus grupos · Ana &lt;b&gt;" id="meusBtn"/,
    );
  });
});
