import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { pool } from '../../src/db/pool.js';
import { createTestApp, getCsrf, signedUp } from '../helpers/auth.js';
import { insertMembership, migrateTestDb, seedDemo } from '../helpers/db.js';

const app = createTestApp();
const SLUG = 'pace-da-oca';
const LOGIN = `/conta/entrar?next=/grupos/${SLUG}%23participar`;
const JOIN = `href="/grupos/${SLUG}#participar"`;
const userId = async (email) =>
  (await pool.query('SELECT id FROM users WHERE email = $1', [email])).rows[0].id;
const sectionOf = (html, title, next) =>
  html.slice(html.indexOf(title), next ? html.indexOf(next) : undefined);

beforeAll(() => migrateTestDb(pool));
beforeEach(() => seedDemo(pool));
afterAll(() => pool.end());

describe('/meus', () => {
  it('conta nova: dois vazios e o painel da conta (CA1)', async () => {
    const agent = await signedUp(app, 'Ana Souza', 'ana@exemplo.com');
    const { text } = await agent.get('/meus');
    expect(text).toContain('Você ainda não entrou em nenhum grupo');
    expect(text).toContain(
      'Encontre um grupo com o seu pace e a sua região e entre com um clique.',
    );
    expect(text).toContain('href="/encontrar">Encontrar meu grupo</a></div>');
    expect(text).toContain('Nenhum grupo cadastrado');
    expect(text).toContain('Organiza treinos? Cadastre seu grupo para aparecer na busca.');
    expect(text).toContain('href="/grupos/novo">Cadastrar grupo</a></div>');
    expect(text).toContain('<h2>Conta e dados</h2>');
    expect(text).not.toContain('badge-count');
    expect((await agent.get('/meus?excluir=1')).text).toContain('Excluir conta');
  });

  it('lista participações e grupos cadastrados; pending some (CA2, CA4)', async () => {
    const agent = await signedUp(app, 'Ana Souza', 'ana@exemplo.com');
    const id = await userId('ana@exemplo.com');
    await insertMembership(pool, id, 'pace-da-oca', 'Ana');
    await insertMembership(pool, id, 'correria-do-carmo', 'Ana');
    await pool.query(
      `INSERT INTO groups (slug, name, zone, location, days, start_time, pace_min_s, pace_max_s,
                           level, description, owner_id)
       VALUES ('meu-grupo', 'Meu Grupo', 'sul', 'Parque', ARRAY['seg'], '06:00', 300, 360,
               'iniciante', 'Descrição com mais de trinta caracteres aqui.', $1)`,
      [id],
    );

    const { text } = await agent.get('/meus');
    const joined = sectionOf(text, 'Grupos em que você entrou', 'Grupos que você cadastrou');
    const mine = sectionOf(text, 'Grupos que você cadastrou', 'Conta e dados');
    expect(joined.indexOf('Correria do Carmo')).toBeGreaterThan(-1); // id menor vem antes
    expect(joined.indexOf('Correria do Carmo')).toBeLessThan(joined.indexOf('Pace da Oca'));
    expect(joined.match(/Você participa/g)).toHaveLength(2);
    expect(joined.match(/No grupo · ver encontros/g)).toHaveLength(2);
    expect(mine).toContain('Meu Grupo');
    expect(mine).not.toContain('Você participa');
    expect(text).toMatch(/id="meusBtn"[^>]*>.*<span class="badge-count">2<\/span>/s);

    await pool.query("UPDATE groups SET status = 'pending' WHERE slug IN ('meu-grupo', $1)", [
      SLUG,
    ]);
    const after = (await agent.get('/meus')).text;
    expect(after).not.toContain('Meu Grupo');
    expect(after).not.toContain('Pace da Oca');
    expect(after).toContain('<span class="badge-count">1</span>');
  });
});

describe('cards conforme quem vê (CA3)', () => {
  it('visitante, logado e participante em /grupos', async () => {
    const visitante = (await request(app).get('/grupos')).text;
    expect(visitante).toContain(LOGIN);
    expect(visitante).not.toContain('Você participa');
    expect(visitante).not.toContain('badge-count');

    const agent = await signedUp(app, 'Ana Souza', 'ana@exemplo.com');
    const logado = (await agent.get('/grupos')).text;
    expect(logado).toContain(JOIN);
    expect(logado).not.toContain(LOGIN);

    await insertMembership(pool, await userId('ana@exemplo.com'), SLUG, 'Ana');
    const part = (await agent.get('/grupos')).text;
    expect(part).toContain('Você participa');
    expect(part).not.toContain(JOIN);
    const home = (await agent.get('/')).text;
    expect(home).toContain('Você participa');
  });

  it('/encontrar: participante vê "Você já participa"', async () => {
    const q = '/encontrar?zona=sul&pace=4%3A30&dias=seg&nivel=avancado';
    expect((await request(app).get(q)).text).toContain(LOGIN);
    const agent = await signedUp(app, 'Ana Souza', 'ana@exemplo.com');
    expect((await agent.get(q)).text).toContain(JOIN);
    await insertMembership(pool, await userId('ana@exemplo.com'), SLUG, 'Ana');
    const { text } = await agent.get(q);
    expect(text).toContain('Você já participa');
    expect(text).not.toContain(JOIN);
  });
});

describe('fluxo do M6 (CA5, CA10)', () => {
  it('conta, grupo, outro usuário participa e sai, dono exclui o grupo', async () => {
    const agent = await signedUp(app, 'Ana Souza', 'ana@exemplo.com');
    let csrf = await getCsrf(agent, '/grupos/novo');
    await agent
      .post('/grupos')
      .type('form')
      .send({
        _csrf: csrf,
        nome: 'Corredores do Sul',
        zona: 'sul',
        local: 'Parque Ibirapuera',
        dias: ['qua'],
        horario: '06:30',
        paceMin: '5:30',
        paceMax: '6:30',
        nivel: 'intermediario',
        descricao: 'Treino em grupo com aquecimento e alongamento.',
        contato: '@sul',
        organizador: 'on',
      })
      .expect(303);
    const slug = 'corredores-do-sul';
    let { text } = await agent.get('/meus');
    expect(sectionOf(text, 'Grupos que você cadastrou', 'Conta e dados')).toContain(
      'Corredores do Sul',
    );
    expect((await agent.get(`/grupos/${slug}`)).text).toContain('Você organiza este grupo.');

    const bia = await signedUp(app, 'Bia Costa', 'bia@exemplo.com');
    csrf = await getCsrf(bia, `/grupos/${slug}`);
    await bia
      .post(`/grupos/${slug}/participar`)
      .type('form')
      .send({ _csrf: csrf, apelido: 'Bia', ok: 'on' })
      .expect(303);
    text = (await bia.get('/meus')).text;
    expect(sectionOf(text, 'Grupos em que você entrou', 'Grupos que você cadastrou')).toContain(
      'Corredores do Sul',
    );
    expect(text).toContain('<span class="badge-count">1</span>');
    csrf = await getCsrf(bia, `/grupos/${slug}`);
    await bia.post(`/grupos/${slug}/sair`).type('form').send({ _csrf: csrf }).expect(303);
    text = (await bia.get('/meus')).text;
    expect(sectionOf(text, 'Grupos em que você entrou', 'Grupos que você cadastrou')).toContain(
      'Você ainda não entrou em nenhum grupo',
    );
    csrf = await getCsrf(bia, `/grupos/${slug}`);
    await bia
      .post(`/grupos/${slug}/participar`)
      .type('form')
      .send({ _csrf: csrf, apelido: 'Bia', ok: 'on' })
      .expect(303);

    csrf = await getCsrf(agent, `/grupos/${slug}?excluir=1`);
    await agent.post(`/grupos/${slug}/excluir`).type('form').send({ _csrf: csrf }).expect(303);
    expect((await pool.query('SELECT 1 FROM groups WHERE slug = $1', [slug])).rowCount).toBe(0);
    expect((await pool.query('SELECT 1 FROM memberships')).rowCount).toBe(0);
  });
});

describe('Nome completo longo em 360 px (spec 023, CA10)', () => {
  it('a linha "Você entrou como" quebra o nome e fica fora do bloco literal do protótipo', async () => {
    const css = (await request(app).get('/css/app.css')).text;
    expect(css).toContain('.account-line{overflow-wrap:anywhere}');
    expect(css.indexOf('.account-line')).toBeLessThan(css.indexOf('/* Layout: cabeçalho fixo'));
    const nome = `${'W'.repeat(40)} ${'W'.repeat(39)}`;
    const agent = await signedUp(app, nome, 'longo@exemplo.com');
    expect((await agent.get('/meus')).text).toContain('<p class="account-line"');
  });
});
