import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { pool } from '../../src/db/pool.js';
import { createTestApp, getCsrf, signedUp } from '../helpers/auth.js';
import { migrateTestDb, seedDemo } from '../helpers/db.js';

beforeAll(async () => {
  await migrateTestDb(pool);
});
beforeEach(async () => {
  await seedDemo(pool);
});
afterAll(async () => {
  await pool.end();
});

const valido = {
  nome: 'Corredores do Sul',
  zona: 'sul',
  local: 'Parque Ibirapuera',
  dias: ['qua', 'seg', 'qua'],
  horario: '06:30',
  paceMin: '5:30',
  paceMax: '6:30',
  nivel: 'intermediario',
  descricao: 'Treino em grupo com aquecimento e alongamento.',
  contato: '@sul',
  organizador: 'on',
};

async function postGroup(agent, body) {
  const csrf = await getCsrf(agent, '/grupos/novo');
  return agent
    .post('/grupos')
    .type('form')
    .send({ _csrf: csrf, ...body });
}
const countGroups = async () => (await pool.query('SELECT count(*)::int n FROM groups')).rows[0].n;

describe('visitante', () => {
  it('é mandado para entrar e nada é gravado (CA1)', async () => {
    const app = createTestApp();
    await request(app)
      .get('/grupos/novo')
      .expect(302)
      .expect('Location', '/conta/entrar?next=%2Fgrupos%2Fnovo');
    const agent = request.agent(app);
    const csrf = await getCsrf(agent, '/conta/criar');
    await agent
      .post('/grupos')
      .type('form')
      .send({ _csrf: csrf, ...valido })
      .expect(303)
      .expect('Location', '/conta/entrar');
    await agent.post('/grupos').type('form').send(valido).expect(403);
    expect(await countGroups()).toBe(11);
  });
});

describe('GET /grupos/novo', () => {
  it('mostra o form do protótipo sem item de menu ativo (CA2)', async () => {
    const agent = await signedUp(createTestApp(), 'Ana', 'ana@x.com');
    const res = await agent.get('/grupos/novo');
    expect(res.status).toBe(200);
    expect(res.text).toContain('action="/grupos"');
    expect(res.text).toMatch(/name="_csrf"/);
    expect(res.text.match(/type="radio" name="zona"/g)).toHaveLength(5);
    expect(res.text.match(/type="checkbox" name="dias"/g)).toHaveLength(7);
    expect(res.text).not.toContain('aria-current');
  });
});

describe('POST /grupos', () => {
  it('cria o grupo e mostra o sucesso só para o dono (CA3, CA4, CA5)', async () => {
    const app = createTestApp();
    const ana = await signedUp(app, 'Ana', 'ana@x.com');
    const res = await postGroup(ana, valido);
    expect(res.status).toBe(303);
    expect(res.headers.location).toBe('/grupos/corredores-do-sul?criado=1');

    const { rows } = await pool.query(
      `SELECT g.*, u.display_name FROM groups g JOIN users u ON u.id = g.owner_id WHERE slug = $1`,
      ['corredores-do-sul'],
    );
    expect(rows[0]).toMatchObject({
      is_demo: false,
      status: 'published',
      profile_tags: ['Novo na plataforma'],
      days: ['seg', 'qua'],
      pace_min_s: 330,
      pace_max_s: 390,
      meeting_point: 'Combinado no grupo',
      distance: null,
      base_participants: 1,
      display_name: 'Ana',
    });

    const sucesso = await ana.get(res.headers.location);
    expect(sucesso.text).toContain('Grupo cadastrado');
    expect(sucesso.text).toContain('/grupos?zona=sul');
    expect(sucesso.text).toContain('/grupos/novo');

    const bruna = await signedUp(app, 'Bruna', 'bruna@x.com');
    const outro = await bruna.get('/grupos/corredores-do-sul?criado=1');
    expect(outro.text).not.toContain('Ver página do grupo');
    expect(outro.text).toContain('Cadastrado por Ana');
    expect((await ana.get('/grupos/corredores-do-sul')).text).toContain('Cadastrado por você');
    expect((await request(app).get('/grupos/corredores-do-sul?criado=1')).text).not.toContain(
      'Ver página do grupo',
    );

    expect((await ana.get('/grupos?zona=sul')).text).toContain('Corredores do Sul');
    expect((await ana.get('/mapa/corredores-do-sul')).status).toBe(200);
  });

  it('form vazio: 422 com os 11 erros e foco só no nome (CA6)', async () => {
    const ana = await signedUp(createTestApp(), 'Ana', 'ana@x.com');
    const res = await postGroup(ana, {});
    expect(res.status).toBe(422);
    expect(res.text).toContain('Corrija 11 campos para continuar.');
    expect(res.text).toContain('Escolha a zona do grupo.');
    expect(res.text).toContain('Confirme que você organiza o grupo.');
    expect(res.text.match(/autofocus/g)).toHaveLength(1);
    expect(res.text).toMatch(/id="c-nome"[^>]*aria-invalid="true"[^>]*autofocus/);
  });

  it('reexibe os valores digitados e não grava nada (CA7)', async () => {
    const ana = await signedUp(createTestApp(), 'Ana', 'ana@x.com');
    const res = await postGroup(ana, { ...valido, paceMax: '', zona: 'leste' });
    expect(res.status).toBe(422);
    expect(res.text).toContain('value="Corredores do Sul"');
    expect(res.text).toMatch(/value="leste" checked/);
    expect(res.text).toMatch(/value="seg" checked/);
    expect(res.text).toContain('value="intermediario" selected');
    expect(res.text).toContain('Treino em grupo com aquecimento');
    expect(res.text).toMatch(/name="organizador"[^>]* checked/);
    expect(await countGroups()).toBe(11);
  });

  it('nome repetido com outra caixa entra na contagem de erros (CA8)', async () => {
    const ana = await signedUp(createTestApp(), 'Ana', 'ana@x.com');
    const res = await postGroup(ana, { ...valido, nome: 'correria DO carmo', zona: '' });
    expect(res.status).toBe(422);
    expect(res.text).toContain('Já existe um grupo com esse nome.');
    expect(res.text).toContain('Corrija 2 campos');
  });

  it('gera slug livre quando o ocupado é o da base (CA9)', async () => {
    const ana = await signedUp(createTestApp(), 'Ana', 'ana@x.com');
    const res = await postGroup(ana, { ...valido, nome: 'Pace da Oca!' });
    expect(res.headers.location).toBe('/grupos/pace-da-oca-2?criado=1');
    const novo = await postGroup(ana, { ...valido, nome: 'Novo' });
    expect(novo.headers.location).toBe('/grupos/novo-2?criado=1');
  });

  it('horário 24:00 é recusado (CA10)', async () => {
    const ana = await signedUp(createTestApp(), 'Ana', 'ana@x.com');
    const res = await postGroup(ana, { ...valido, horario: '24:00' });
    expect(res.status).toBe(422);
    expect(res.text).toContain('Informe o horário do treino.');
  });

  it('entradas hostis não viram 500 e o HTML sai escapado (CA11)', async () => {
    const app = createTestApp();
    const ana = await signedUp(app, 'Ana', 'ana@x.com');
    const csrf = await getCsrf(ana, '/grupos/novo');
    const hostil = await ana
      .post('/grupos')
      .type('form')
      .send(
        `_csrf=${csrf}&nome=a&nome=b&dias=xyz&zona=marte&nivel=x&local=%00%00%00&descricao=%20%20%20`,
      );
    expect(hostil.status).toBe(422);

    const xss = await postGroup(ana, { ...valido, nome: '<script>alert(1)</script>' });
    expect(xss.status).toBe(303);
    const page = await ana.get(xss.headers.location);
    expect(page.status).toBe(200);
    expect(page.text).not.toContain('<script>alert(1)</script>');
    expect(page.text).toContain('&lt;script&gt;');
  });

  // Hardener: nome visualmente igual ao de outro grupo (espaço duplo, ZWSP) não pode passar.
  it('nome igual com espaço duplo ou caractere invisível é recusado', async () => {
    const ana = await signedUp(createTestApp(), 'Ana', 'ana@x.com');
    const res = await postGroup(ana, { ...valido, nome: 'Correria  do​ Carmo' });
    expect(res.status).toBe(422);
    expect(res.text).toContain('Já existe um grupo com esse nome.');
    expect(await countGroups()).toBe(11);
  });
});

// CA12: verificado no navegador a 360 px (Playwright, nome de 50 "A"): scrollWidth 360 no modo sucesso e no card da busca.
describe('CSS do nome longo a 360 px (CA12)', () => {
  it.each([
    '.card{min-width:0}',
    '.card h3,.success{overflow-wrap:anywhere}',
    '.success{min-width:0}',
  ])('tem %s fora do bloco literal do protótipo', async (rule) => {
    const css = (await request(createTestApp()).get('/css/app.css')).text;
    expect(css).toContain(rule);
    expect(css.indexOf(rule)).toBeLessThan(css.indexOf('/* Layout: cabeçalho fixo'));
  });
});
