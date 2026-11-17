import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { countLabel } from '../../src/domain/filters.js';
import { pool } from '../../src/db/pool.js';
import { createTestApp, signedUp } from '../helpers/auth.js';
import { insertMembership, migrateTestDb, seedDemo } from '../helpers/db.js';
import request from 'supertest';

const app = createTestApp();

beforeAll(() => migrateTestDb(pool));
beforeEach(() => seedDemo(pool));
afterAll(() => pool.end());

const innerOf = (html, id) => {
  const start = html.indexOf(`id="${id}"`);
  const open = html.indexOf('>', start) + 1;
  const end = id === 'chips' ? html.indexOf('</div>', open) : html.indexOf('</section>', open);
  const inner = html.slice(open, end);
  // #results fecha com </div> logo antes de </section>.
  return id === 'results' ? inner.replace(/<\/div>\s*$/, '') : inner;
};

describe('GET /api/grupos', () => {
  it('devolve só as 5 chaves com contagem, texto e query canônica (CA1)', async () => {
    const res = await request(app).get('/api/grupos?zona=sul&nivel=iniciante');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(Object.keys(res.body).sort()).toEqual(
      ['chips', 'count', 'countText', 'query', 'results'].sort(),
    );
    expect(res.body.count).toBe(res.body.results.match(/class="card"/g).length);
    expect(res.body.countText).toBe(countLabel(res.body.count));
    expect(res.body.query).toBe('zona=sul&nivel=iniciante');
  });

  it('results e chips iguais aos da página: sem filtro, sem resultado e participante (CA2)', async () => {
    for (const query of ['', '?zona=sul&nome=zzzz']) {
      const [page, api] = await Promise.all([
        request(app).get(`/grupos${query}`),
        request(app).get(`/api/grupos${query}`),
      ]);
      expect(api.body.results).toBe(innerOf(page.text, 'results'));
      expect(api.body.chips).toBe(innerOf(page.text, 'chips'));
    }

    const agent = await signedUp(app, 'Ana', 'ana@exemplo.com');
    const { rows } = await pool.query('SELECT id FROM users WHERE email = $1', ['ana@exemplo.com']);
    await insertMembership(pool, rows[0].id, 'pace-da-oca', 'Ana');
    const [page, api] = await Promise.all([
      agent.get('/grupos?zona=sul'),
      agent.get('/api/grupos?zona=sul'),
    ]);
    expect(api.body.results).toContain('Você participa');
    expect(api.body.results).toBe(innerOf(page.text, 'results'));
    expect(api.body.chips).toBe(innerOf(page.text, 'chips'));
  });

  it('não vaza contato, dono nem dados de conta, logado ou não (CA3)', async () => {
    const agent = await signedUp(app, 'Ana', 'ana@exemplo.com');
    await pool.query(
      `INSERT INTO groups (slug, name, zone, location, days, start_time, pace_min_s, pace_max_s,
                           level, description, contact, owner_id)
       VALUES ('meu-grupo', 'Meu Grupo', 'sul', 'Parque', ARRAY['seg'], '06:00', 300, 360,
               'iniciante', 'Descrição com mais de trinta caracteres aqui.', 'contato-secreto-123',
               (SELECT id FROM users LIMIT 1))`,
    );
    for (const who of [request(app), agent]) {
      const res = await who.get('/api/grupos');
      expect(res.body.results).toContain('Meu Grupo');
      for (const forbidden of [
        'contact',
        'owner_id',
        'password_hash',
        'ana@exemplo.com',
        'contato-secreto-123',
      ]) {
        expect(res.text).not.toContain(forbidden);
      }
    }
  });

  it('não é cacheável e ignora parâmetros inválidos e vazios (CA4, CA5)', async () => {
    const res = await request(app).get('/api/grupos?zona=marte&pace=xyz&nome=%00');
    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBe('private, no-store');
    expect(res.body.query).toBe('');
    expect(res.body.count).toBe(11);

    const canon = await request(app).get('/api/grupos?nome=&dia=sab&zona=sul&local=');
    expect(canon.body.query).toBe('zona=sul&dia=sab');
  });
});
