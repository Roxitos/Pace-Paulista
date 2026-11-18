import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { pool } from '../../src/db/pool.js';
import { insertUser, migrateTestDb, seedDemo } from '../helpers/db.js';
import { insertMembership } from '../../src/modules/memberships/memberships.repo.js';
import { createTestApp, getCsrf, signedUp } from '../helpers/auth.js';

const app = createTestApp();
const SLUG = 'pace-da-oca';
const NOT_FOUND = 'Esse grupo não foi encontrado. Ele pode ter sido removido.';

const count = async () =>
  (await pool.query('SELECT count(*)::int AS n FROM memberships')).rows[0].n;
const participants = (html) => /Participantes<\/dt><dd class="mono">(\d+)</.exec(html)[1];

async function join(agent, body, slug = SLUG) {
  const csrf = await getCsrf(agent, `/grupos/${SLUG}`);
  return agent
    .post(`/grupos/${slug}/participar`)
    .type('form')
    .send({ _csrf: csrf, ...body });
}

beforeAll(() => migrateTestDb(pool));
beforeEach(() => seedDemo(pool));
afterAll(() => pool.end());

describe('participar e sair: deslogado', () => {
  it('mantém o link de login, sem painel; POSTs vão ao login sem gravar; sem _csrf dá 403', async () => {
    const agent = request.agent(app);
    const page = await agent.get(`/grupos/${SLUG}`);
    expect(page.text).toContain(`/conta/entrar?next=/grupos/${SLUG}%23participar`);
    expect(page.text).not.toContain('id="participar"');
    const csrf = await getCsrf(agent);
    for (const acao of ['participar', 'sair']) {
      const res = await agent
        .post(`/grupos/${SLUG}/${acao}`)
        .type('form')
        .send({ _csrf: csrf, apelido: 'Ana', ok: 'on' });
      expect(res.status).toBe(303);
      expect(res.headers.location).toBe('/conta/entrar');
      await agent.post(`/grupos/${SLUG}/${acao}`).type('form').send({}).expect(403);
    }
    expect(await count()).toBe(0);
  });
});

describe('participar e sair: logado', () => {
  it('mostra o painel fechado com o apelido pré-preenchido', async () => {
    const agent = await signedUp(app, 'Ana Souza', 'ana@exemplo.com');
    const { text } = await agent.get(`/grupos/${SLUG}`);
    expect(text).toContain('href="#participar"');
    expect(text).toMatch(/class="panel join-panel" id="participar"/);
    expect(text).toContain('<h2>Entrar no Pace da Oca</h2>');
    expect(text).toMatch(/Próximo treino<\/dt><dd>\w{3}\., \d+ de \w+\. · 6h</);
    expect(text).toContain(`action="/grupos/${SLUG}/participar#participar"`);
    expect(text).toContain('name="apelido" maxlength="40"');
    expect(text).toContain('value="Ana Souza"');
    expect(text).toContain('Confirmar entrada');
    expect(text).not.toMatch(/name="ok"[^>]*checked/);
  });

  it('entra (idempotente), mostra boas-vindas uma vez e sai', async () => {
    const agent = await signedUp(app, 'Ana Souza', 'ana@exemplo.com');
    const before = participants((await agent.get(`/grupos/${SLUG}`)).text);

    const res = await join(agent, { apelido: '  Aninha  ', ok: 'on' });
    expect(res.status).toBe(303);
    expect(res.headers.location).toBe(`/grupos/${SLUG}#participar`);
    expect((await pool.query('SELECT nickname FROM memberships')).rows).toEqual([
      { nickname: 'Aninha' },
    ]);

    const page = await agent.get(`/grupos/${SLUG}`);
    expect(Number(participants(page.text))).toBe(Number(before) + 1);
    expect(page.text).toContain('Bem-vindo(a), Aninha!');
    expect(page.text).toContain('Você agora faz parte do');
    expect(page.text).toMatch(/Primeiro treino: <b[^>]*>\S+, \d+ de \S+, 6h<\/b>/);
    expect(page.text).toContain(`href="/mapa/${SLUG}"`);
    expect(page.text).toContain('class="panel join-panel open"');
    expect(page.text).toContain('Você entrou como <b>Aninha</b>');
    expect(page.text).toContain(`action="/grupos/${SLUG}/sair"`);
    const again = await agent.get(`/grupos/${SLUG}`);
    expect(again.text).not.toContain('Bem-vindo(a)');
    expect(again.text).not.toContain('id="participar"');

    const second = await join(agent, { apelido: 'Outro', ok: 'on' });
    expect(second.status).toBe(303);
    expect((await pool.query('SELECT nickname FROM memberships')).rows).toEqual([
      { nickname: 'Aninha' },
    ]);

    const csrf = await getCsrf(agent, `/grupos/${SLUG}`);
    const leave = await agent.post(`/grupos/${SLUG}/sair`).type('form').send({ _csrf: csrf });
    expect(leave.status).toBe(303);
    expect(leave.headers.location).toBe(`/grupos/${SLUG}`);
    expect(await count()).toBe(0);
    const left = await agent.get(`/grupos/${SLUG}`);
    expect(left.text).toMatch(/role="status"><[^]*Você saiu do grupo\./);
    expect(left.text).toContain('data-toast="Você saiu do grupo."');
    expect(left.text).toContain('<script type="module" src="/js/participar.js"></script>');
    expect(participants(left.text)).toBe(before);
    expect(left.text).toContain('href="#participar"');
    await agent.post(`/grupos/${SLUG}/sair`).type('form').send({ _csrf: csrf }).expect(303);
    expect((await agent.get(`/grupos/${SLUG}`)).text).not.toContain('Você saiu do grupo.');
  });

  it('devolve 422 com mensagens, apelido digitado e foco no 1º erro; nada é gravado', async () => {
    const agent = await signedUp(app, 'Ana Souza', 'ana@exemplo.com');
    const res = await join(agent, { apelido: ' a ' });
    expect(res.status).toBe(422);
    expect(res.text).toContain('class="panel join-panel open"');
    expect(res.text).toContain('src="/js/participar.js"');
    expect(res.text).toMatch(
      /id="e-jnome">[^]*Informe um nome ou apelido com pelo menos 2 letras\./,
    );
    expect(res.text).toMatch(/id="e-jok">[^]*Confirme que leu as orientações\./);
    expect(res.text).toMatch(/id="j-nome"[^>]*aria-invalid="true"[^>]*autofocus/);
    expect(res.text).toContain('value="a"');

    const onlyOk = await join(agent, { apelido: 'Ana' });
    expect(onlyOk.text).toMatch(/id="j-ok"[^>]*autofocus/);
    expect(onlyOk.text).not.toMatch(/id="j-nome"[^>]*aria-invalid/);
    expect(await count()).toBe(0);
  });

  it('responde 404 para grupo inexistente, não publicado ou slug fora do formato', async () => {
    const agent = await signedUp(app, 'Ana Souza', 'ana@exemplo.com');
    await pool.query(`UPDATE groups SET status = 'pending' WHERE slug = 'minhocao-noturno'`);
    for (const slug of ['nao-existe', 'minhocao-noturno', 'A_B']) {
      const res = await join(agent, { apelido: 'Ana', ok: 'on' }, slug);
      expect(res.status).toBe(404);
      expect(res.text).toContain(NOT_FOUND);
    }
    expect(await count()).toBe(0);
  });

  it('não vira 500 com campos repetidos ou NUL, e escapa HTML no apelido', async () => {
    const agent = await signedUp(app, 'Ana Souza', 'ana@exemplo.com');
    const csrf = await getCsrf(agent, `/grupos/${SLUG}`);
    const raw = await agent
      .post(`/grupos/${SLUG}/participar`)
      .type('form')
      .send(`_csrf=${csrf}&apelido=a&apelido=bb&ok=on`);
    expect(raw.status).toBe(422);
    const nul = await agent
      .post(`/grupos/${SLUG}/participar`)
      .type('form')
      .send(`_csrf=${csrf}&apelido=A%00na&ok=on`);
    expect(nul.status).toBe(303);

    await pool.query('TRUNCATE memberships');
    await join(agent, { apelido: '<script>x</script>', ok: 'on' });
    const page = await agent.get(`/grupos/${SLUG}`);
    expect(page.text).not.toContain('<script>x');
    expect(page.text).toContain('Bem-vindo(a), &lt;script&gt;x&lt;/script&gt;!');
    expect(page.text).toContain('Você entrou como <b>&lt;script&gt;x&lt;/script&gt;</b>');
  });

  it('não vaza o flash para outro grupo nem guarda o apelido na sessão', async () => {
    const agent = await signedUp(app, 'Ana Souza', 'ana@exemplo.com');
    await join(agent, { apelido: 'Apelido Secreto', ok: 'on' });
    const other = await agent.get('/grupos/correria-do-carmo');
    expect(other.text).not.toContain('Bem-vindo(a)');
    expect((await agent.get(`/grupos/${SLUG}`)).text).not.toContain('Bem-vindo(a)');
    const { rows } = await pool.query('SELECT sess::text AS sess FROM "session"');
    expect(rows.some((r) => r.sess.includes('Apelido Secreto'))).toBe(false);
  });
});

describe('memberships.repo.insertMembership', () => {
  // Grupo despublicado entre o findPublishedGroup e o INSERT: o INSERT confere o status de novo.
  it('não grava participação em grupo que deixou de estar publicado', async () => {
    const userId = await insertUser(pool, 'Ana Souza');
    const { rows } = await pool.query(
      `UPDATE groups SET status = 'pending' WHERE slug = $1 RETURNING id::text AS id`,
      [SLUG],
    );
    expect(await insertMembership(userId, rows[0].id, 'Ana')).toBe(false);
    expect(await count()).toBe(0);
  });
});

describe('Apelido longo sem espaço em 360 px (CA11)', () => {
  it('deixa a coluna do painel encolher e quebra o texto do aviso e dos botões', async () => {
    // Apelido de 40 "W" estourava 360 px no aviso "Você entrou como…" e nos botões do painel.
    const css = (await request(app).get('/css/app.css')).text;
    expect(css).toContain(
      '.detail-grid .stack,.join-panel .stack{grid-template-columns:minmax(0,1fr)}',
    );
    expect(css).toContain(
      '.form-alert > span,.detail-grid .btn{min-width:0;overflow-wrap:anywhere}',
    );
    // Fora do bloco literal do protótipo, senão o teste de cópia literal falharia.
    expect(css.indexOf('.form-alert > span')).toBeLessThan(
      css.indexOf('/* Layout: cabeçalho fixo'),
    );
  });
});

describe('dono do grupo (spec 022)', () => {
  async function ownerOf() {
    const agent = await signedUp(app, 'Ana', 'ana@exemplo.com');
    const { rows } = await pool.query("SELECT id FROM users WHERE email = 'ana@exemplo.com'");
    await pool.query('UPDATE groups SET owner_id = $1, is_demo = false WHERE slug = $2', [
      rows[0].id,
      SLUG,
    ]);
    return { agent, id: rows[0].id };
  }

  it('participar: 303 para a página, sem gravar, mesmo com form inválido', async () => {
    const { agent } = await ownerOf();
    const csrf = await getCsrf(agent, '/meus');
    for (const body of [{ apelido: 'Ana', ok: 'on' }, {}]) {
      const res = await agent
        .post(`/grupos/${SLUG}/participar`)
        .type('form')
        .send({ _csrf: csrf, ...body });
      expect(res.status).toBe(303);
      expect(res.headers.location).toBe(`/grupos/${SLUG}`);
    }
    expect(await count()).toBe(0);
  });

  it('participação antiga fica invisível; sair ainda apaga a linha', async () => {
    const { agent, id } = await ownerOf();
    await pool.query(
      'INSERT INTO memberships (user_id, group_id, nickname) SELECT $1, id, $3 FROM groups WHERE slug = $2',
      [id, SLUG, 'Ana'],
    );
    const meus = (await agent.get('/meus')).text;
    expect(meus).toContain('Você ainda não entrou em nenhum grupo');
    expect(meus).not.toContain('badge-count');
    const grupos = (await agent.get('/grupos')).text;
    expect(grupos).not.toContain('Você participa');
    expect(grupos).not.toContain('No grupo · ver encontros');

    const csrf = await getCsrf(agent, '/meus');
    const res = await agent.post(`/grupos/${SLUG}/sair`).type('form').send({ _csrf: csrf });
    expect(res.status).toBe(303);
    expect(await count()).toBe(0);
  });
});
