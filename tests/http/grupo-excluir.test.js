import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { pool } from '../../src/db/pool.js';
import { createTestApp, getCsrf } from '../helpers/auth.js';
import { insertMembership, insertUser, migrateTestDb, seedDemo } from '../helpers/db.js';

const app = createTestApp();
const SLUG = 'meu-grupo';
const NOT_FOUND = 'Esse grupo não foi encontrado. Ele pode ter sido removido.';
const ALERT =
  'Tem certeza que deseja excluir o grupo? Isso apaga o grupo e as participações de todos os membros. Não dá para desfazer.';

const userId = async (email) =>
  (await pool.query('SELECT id FROM users WHERE email = $1', [email])).rows[0].id;
const groupCount = async (slug = SLUG) =>
  (await pool.query('SELECT count(*)::int AS n FROM groups WHERE slug = $1', [slug])).rows[0].n;

async function insertOwnedGroup(ownerId, slug = SLUG, name = 'Meu Grupo') {
  await pool.query(
    `INSERT INTO groups (slug, name, zone, location, days, start_time, pace_min_s, pace_max_s,
                         level, description, owner_id)
     VALUES ($1, $2, 'sul', 'Parque', ARRAY['seg'], '06:00', 300, 360,
             'iniciante', 'Descrição com mais de trinta caracteres aqui.', $3)`,
    [slug, name, ownerId],
  );
}

// Login direto (rota só de teste): o limite de cadastros por IP não comporta um signup por caso.
async function loginComo(nome, email) {
  const id = await insertUser(pool, nome, { email });
  const agent = request.agent(app);
  await agent.get(`/__test/login/${id}`).expect(200);
  return agent;
}

async function ownerAgent() {
  const agent = await loginComo('Ana', 'ana@exemplo.com');
  await insertOwnedGroup(await userId('ana@exemplo.com'));
  return agent;
}

async function postExcluir(agent, slug = SLUG) {
  const csrf = await getCsrf(agent, '/meus');
  return agent.post(`/grupos/${slug}/excluir`).type('form').send({ _csrf: csrf });
}

beforeAll(() => migrateTestDb(pool));
beforeEach(() => seedDemo(pool));
afterAll(() => pool.end());

describe('página do grupo para o dono (CA2, CA3)', () => {
  it('mostra o aviso e o link de excluir, sem entrar/sair/painel', async () => {
    const agent = await ownerAgent();
    await insertMembership(pool, await userId('ana@exemplo.com'), SLUG, 'Ana');
    const { text } = await agent.get(`/grupos/${SLUG}`);
    expect(text).toContain('Você organiza este grupo.');
    for (const s of [
      'Entrar no grupo',
      'id="participar"',
      `/grupos/${SLUG}/participar`,
      'Sair do grupo',
    ]) {
      expect(text).not.toContain(s);
    }
    expect(text).toContain(`href="/grupos/${SLUG}?excluir=1#excluir"`);
    expect(text).not.toContain(`action="/grupos/${SLUG}/excluir"`);
  });

  it('?excluir=1 mostra o 2º passo', async () => {
    const agent = await ownerAgent();
    const { text } = await agent.get(`/grupos/${SLUG}?excluir=1`);
    expect(text).toContain(`role="alert"><svg`);
    expect(text).toContain(ALERT);
    expect(text).toContain(`action="/grupos/${SLUG}/excluir"`);
    expect(text).toContain('name="_csrf"');
    expect(text).toContain(`href="/grupos/${SLUG}#excluir">Cancelar</a>`);
  });

  it('outro usuário e visitante não veem nada de dono; ?excluir=1 é ignorado', async () => {
    await ownerAgent();
    const outro = await loginComo('Bia', 'bia@exemplo.com');
    for (const agent of [outro, request(app)]) {
      const { text } = await agent.get(`/grupos/${SLUG}?excluir=1`);
      expect(text).not.toContain('Você organiza');
      expect(text).not.toContain('Excluir grupo');
      expect(text).toContain('Entrar no grupo');
    }
  });
});

describe('POST /grupos/:slug/excluir', () => {
  it('dono exclui: 303 /meus, cascata, 404 na página e aviso uma vez só (CA4)', async () => {
    const agent = await ownerAgent();
    const bia = await loginComo('Bia', 'bia@exemplo.com');
    await insertMembership(pool, await userId('bia@exemplo.com'), SLUG, 'Bia');

    const res = await postExcluir(agent);
    expect(res.status).toBe(303);
    expect(res.headers.location).toBe('/meus');
    expect(await groupCount()).toBe(0);
    expect((await pool.query('SELECT 1 FROM memberships')).rowCount).toBe(0);
    expect((await bia.get(`/grupos/${SLUG}`)).status).toBe(404);

    const { text } = await agent.get('/meus');
    expect(text).toContain('O grupo “Meu Grupo” foi excluído.');
    expect(text).toContain('role="status"');
    expect(text).toContain('data-toast="O grupo “Meu Grupo” foi excluído."');
    expect(text).not.toContain('Nenhum grupo cadastrado</h3><p>O grupo');
    expect((await agent.get('/meus')).text).not.toContain('foi excluído');
  });

  it('outro usuário: 404 e nada apagado', async () => {
    await ownerAgent();
    const outro = await loginComo('Bia', 'bia@exemplo.com');
    const res = await postExcluir(outro);
    expect(res.status).toBe(404);
    expect(res.text).toContain(NOT_FOUND);
    expect(await groupCount()).toBe(1);
  });

  it('membro do grupo também recebe 404', async () => {
    await ownerAgent();
    const bia = await loginComo('Bia', 'bia@exemplo.com');
    await insertMembership(pool, await userId('bia@exemplo.com'), SLUG, 'Bia');
    expect((await postExcluir(bia)).status).toBe(404);
    expect(await groupCount()).toBe(1);
  });

  it('grupo demo: 404 e nada apagado', async () => {
    const agent = await loginComo('Ana', 'ana@exemplo.com');
    expect((await postExcluir(agent, 'pace-da-oca')).status).toBe(404);
    expect(await groupCount('pace-da-oca')).toBe(1);
  });

  it.each(['nao-existe', 'Slug_Invalido'])('slug %s: 404', async (slug) => {
    const agent = await loginComo('Ana', 'ana@exemplo.com');
    expect((await postExcluir(agent, slug)).status).toBe(404);
  });

  it('sem _csrf: 403, nada apagado', async () => {
    const agent = await ownerAgent();
    await agent.post(`/grupos/${SLUG}/excluir`).type('form').send({}).expect(403);
    expect(await groupCount()).toBe(1);
  });

  it('deslogado: 303 /conta/entrar, nada apagado', async () => {
    await ownerAgent();
    const anon = request.agent(app);
    const csrf = await getCsrf(anon);
    const res = await anon.post(`/grupos/${SLUG}/excluir`).type('form').send({ _csrf: csrf });
    expect(res.status).toBe(303);
    expect(res.headers.location).toBe('/conta/entrar');
    expect(await groupCount()).toBe(1);
  });
});

describe('/meus: excluir pelo card (CA6)', () => {
  it('1º passo em cada card e 2º passo só do slug pedido', async () => {
    const agent = await ownerAgent();
    await insertOwnedGroup(await userId('ana@exemplo.com'), 'outro-grupo', 'Outro Grupo');
    const first = (await agent.get('/meus')).text;
    expect(first).toContain(`href="/meus?excluir-grupo=${SLUG}#excluir-${SLUG}"`);
    expect(first).toContain('href="/meus?excluir-grupo=outro-grupo#excluir-outro-grupo"');
    expect(first).not.toContain(ALERT);

    const { text } = await agent.get(`/meus?excluir-grupo=${SLUG}`);
    expect(text.split(ALERT)).toHaveLength(2);
    expect(text).toContain(`action="/grupos/${SLUG}/excluir"`);
    expect(text).not.toContain('action="/grupos/outro-grupo/excluir"');
    expect(text).toContain(`href="/meus#excluir-${SLUG}">Cancelar</a>`);
  });

  it.each(['pace-da-oca', 'nao-existe', 'Invalido_!'])(
    '?excluir-grupo=%s não mostra 2º passo',
    async (slug) => {
      const agent = await ownerAgent();
      const res = await agent.get(`/meus?excluir-grupo=${slug}`);
      expect(res.status).toBe(200);
      expect(res.text).not.toContain(ALERT);
    },
  );

  it('?excluir=1 da conta segue independente', async () => {
    const agent = await ownerAgent();
    const { text } = await agent.get('/meus?excluir=1');
    expect(text).toContain('Excluir conta');
    expect(text).not.toContain(ALERT);
  });
});

describe('cards para o dono (CA9)', () => {
  it('/grupos não oferece "Entrar no grupo" do próprio grupo', async () => {
    const agent = await ownerAgent();
    const { text } = await agent.get('/grupos');
    expect(text).not.toContain(`href="/grupos/${SLUG}#participar"`);
    expect(text).toContain('href="/grupos/pace-da-oca#participar"');
  });

  it('/encontrar não oferece "Entrar no grupo" do próprio grupo', async () => {
    const agent = await ownerAgent();
    const { text } = await agent.get('/encontrar?zona=sul&pace=5%3A30&dias=seg&nivel=iniciante');
    expect(text).toContain('Meu Grupo');
    expect(text).not.toContain(`href="/grupos/${SLUG}#participar"`);
  });
});
