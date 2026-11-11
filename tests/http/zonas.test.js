import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { pool } from '../../src/db/pool.js';
import { ZONA_ORDEM } from '../../src/domain/constants.js';
import { insertUser, migrateTestDb, seedDemo } from '../helpers/db.js';

const app = createApp();

beforeAll(async () => {
  await migrateTestDb(pool);
});

beforeEach(async () => {
  await seedDemo(pool);
});

afterAll(async () => {
  await pool.end();
});

async function getZonas() {
  const res = await request(app).get('/zonas');
  expect(res.status).toBe(200);
  expect(res.headers['content-type']).toMatch(/text\/html/);
  return res.text;
}

// Recorta o <article class="zrow"> de cada zona, na ordem em que aparecem.
function rows(html) {
  return [...html.matchAll(/<article class="zrow"[\s\S]*?<\/article>/g)].map((m) => m[0]);
}

function rowOf(html, zone) {
  return rows(html).find((row) => row.includes(`href="/grupos?zona=${zone}"`));
}

describe('GET /zonas', () => {
  it('renderiza o cabeçalho da página e marca "Explorar zonas" no menu', async () => {
    const html = await getZonas();
    expect(html).toContain('<title>Zonas · Pace Paulista</title>');
    expect(html).toContain('<span class="eyebrow">Explorar zonas</span>');
    expect(html).toContain('<h1 class="display">As cinco zonas de São Paulo</h1>');
    expect(html).toContain(
      '<p>Cada região tem uma cor e um selo inspirado em um marco da cidade. As cores identificam os grupos em todo o site.</p>',
    );
    expect(html).toContain('href="/zonas" data-nav="zonas" aria-current="page"');
    expect(html.match(/aria-current=/g)).toHaveLength(1);
  });

  it('lista as 5 zonas na ordem Norte, Oeste, Centro, Leste, Sul com selo de 120', async () => {
    const html = await getZonas();
    const zrows = rows(html);
    expect(zrows).toHaveLength(5);
    expect(html.match(/class="zrow"/g)).toHaveLength(5);
    expect(zrows.map((row) => row.match(/<h2>(.*?)<\/h2>/)[1])).toEqual([
      'Zona Norte',
      'Zona Oeste',
      'Centro',
      'Zona Leste',
      'Zona Sul',
    ]);
    zrows.forEach((row, i) => {
      expect(row).toContain(`href="/grupos?zona=${ZONA_ORDEM[i]}"`);
      expect(row).toContain('<svg class="seal" width="120" height="120"');
    });
    expect(rowOf(html, 'centro')).toContain(
      '<article class="zrow" style="--z:#E8892B;--zon:#17171A">',
    );
    expect(rowOf(html, 'sul')).toContain(
      '<span class="kicker" style="color:var(--muted)">Oca do Ibirapuera</span><h2>Zona Sul</h2>',
    );
    expect(rowOf(html, 'norte')).toContain(
      '<p>Trilhas, subidas e muito verde no pé da Cantareira. Treinos com altimetria para quem gosta de terreno variado.</p>',
    );
  });

  it('mostra contagem e locais distintos de cada zona', async () => {
    const html = await getZonas();
    const expected = {
      norte: [2, 'Parque Estadual Alberto Löfgren (Horto Florestal) · Parque da Juventude'],
      oeste: [2, 'Cidade Universitária (USP) · Parque Villa-Lobos'],
      centro: [2, 'Elevado Presidente João Goulart (Minhocão) · Avenida Paulista'],
      leste: [2, 'Parque do Carmo · Parque Ecológico do Tietê'],
      sul: [3, 'Parque Ibirapuera · Parque Guarapiranga'],
    };
    for (const [zone, [count, locations]] of Object.entries(expected)) {
      const row = rowOf(html, zone);
      expect(row).toContain(`<b>${count}</b>&nbsp;grupos</span>`);
      expect(row).toContain(`</svg>${locations}</span>`);
    }
  });

  it('cada CTA leva à busca filtrada pela zona', async () => {
    const html = await getZonas();
    for (const zone of ZONA_ORDEM) {
      expect(html).toContain(
        `<a class="btn btn-primary" href="/grupos?zona=${zone}">Explorar grupos <svg class="ico ico-sm"`,
      );
    }
  });

  it('funciona sem JS: só links reais, sem hash do protótipo', async () => {
    const html = await getZonas();
    expect(html).not.toContain('href="#');
    expect(html).not.toContain('data-act="entrar"');
  });

  it('grupo não publicado sai da contagem e dos locais', async () => {
    await pool.query("UPDATE groups SET status = 'pending' WHERE slug = 'pelotao-paulista'");
    const row = rowOf(await getZonas(), 'centro');
    expect(row).toContain('<b>1</b>&nbsp;grupo</span>');
    expect(row).toContain('</svg>Elevado Presidente João Goulart (Minhocão)</span>');
    expect(row).not.toContain(' · Avenida Paulista');
  });

  it('sem grupos publicados mostra as 5 zonas com 0 grupos e "Nenhum local ainda"', async () => {
    await pool.query("UPDATE groups SET status = 'pending'");
    const html = await getZonas();
    expect(rows(html)).toHaveLength(5);
    expect(html.match(/<b>0<\/b>&nbsp;grupos<\/span>/g)).toHaveLength(5);
    expect(html.match(/<\/svg>Nenhum local ainda<\/span>/g)).toHaveLength(5);
    expect(html).not.toMatch(/Infinity|NaN|undefined/);
  });

  it('escapa local, nome e dono vindos do banco', async () => {
    const xss = '<script>alert(1)</script>';
    const owner = await insertUser(pool, xss);
    await pool.query(
      `UPDATE groups SET name = $1, location = $2, is_demo = false, owner_id = $3
        WHERE slug = 'cantareira-trail'`,
      [xss, xss, owner],
    );
    const html = await getZonas();
    expect(html).not.toContain('<script>alert');
    // A posição do local na lista depende da collation (ordem por nome); só o escape importa aqui.
    expect(rowOf(html, 'norte')).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });
});
