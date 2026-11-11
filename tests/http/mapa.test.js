import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/app.js';
import { pool } from '../../src/db/pool.js';
import { insertUser, migrateTestDb, seedDemo, truncateAll } from '../helpers/db.js';

const app = createApp();

const XSS = '<script>alert(1)</script>';
const XSS_ESC = '&lt;script&gt;alert(1)&lt;/script&gt;';

// Ordem padrão do repo: zona (ZONA_ORDEM), depois nome.
const ORDEM_PADRAO = [
  'cantareira-trail',
  'juventude-em-pace',
  'raia-usp',
  'villa-lobos-runners',
  'minhocao-noturno',
  'pelotao-paulista',
  'correria-do-carmo',
  'tiete-em-movimento',
  'pace-da-oca',
  'primeiro-km-ibira',
  'represa-run-club',
];

beforeAll(async () => {
  await migrateTestDb(pool);
});

beforeEach(async () => {
  await seedDemo(pool);
});

afterEach(() => {
  vi.restoreAllMocks();
});

afterAll(async () => {
  await pool.end();
});

async function getMapa(path = '/mapa') {
  const res = await request(app).get(path);
  expect(res.status).toBe(200);
  expect(res.headers['content-type']).toMatch(/text\/html/);
  return res.text;
}

function pins(html) {
  return [...html.matchAll(/<a class="pin"[\s\S]*?<\/a>/g)].map((m) => m[0]);
}

function items(html) {
  return [...html.matchAll(/<a class="map-item"[\s\S]*?<\/a>/g)].map((m) => m[0]);
}

function detail(html) {
  return html.match(/<div id="mapDetail" class="map-detail">([\s\S]*?)<ul class="map-list">/)[1];
}

const dataId = (el) => el.match(/data-id="([^"]*)"/)[1];

function selectedItems(html) {
  return items(html)
    .filter((i) => i.includes('aria-current="true"'))
    .map(dataId);
}

function pinOf(html, slug) {
  return pins(html).find((p) => dataId(p) === slug);
}

function expectSelected(html, slug, [x, y]) {
  expect(selectedItems(html)).toEqual([slug]);
  expect(html.match(/aria-current="true"/g)).toHaveLength(1);
  for (const p of pins(html)) {
    const sel = dataId(p) === slug;
    expect(p).toContain(`<circle class="ring" r="${sel ? 14 : 0}"`);
    expect(p).toContain(`<circle class="dot" r="${sel ? 8 : 6}"`);
  }
  expect(pinOf(html, slug)).toContain(`transform="translate(${x} ${y})"`);
}

describe('GET /mapa (CA1)', () => {
  it('renderiza o cabeçalho, as 5 zonas e a nota do esquema', async () => {
    const html = await getMapa();
    expect(html).toContain('<title>Mapa e rotas · Pace Paulista</title>');
    expect(html).toContain('<span class="eyebrow">Mapa e rotas</span>');
    expect(html).toContain('<h1 class="display">Pontos de encontro</h1>');
    expect(html).toContain(
      '<p>Selecione um grupo para ver onde ele se encontra e abrir a rota até lá no Google Maps.</p>',
    );
    expect(html).toContain(
      '<svg viewBox="0 0 400 380" role="group" aria-label="Esquema das zonas de São Paulo com os grupos">',
    );
    expect(html.match(/<path d="M[^"]*Z" fill="#/g)).toHaveLength(5);
    expect(html).toContain(
      '<path d="M70 20 L330 20 L350 110 L250 135 L150 135 L60 110 Z" fill="#5E9A22" fill-opacity=".14" stroke="#5E9A22" stroke-width="1.6"/>',
    );
    const labels = [
      ...html.matchAll(/font-size="(\d+)" letter-spacing=".6" fill="#\w+">([^<]+)<\/text>/g),
    ];
    expect(labels.map((m) => [m[2], m[1]])).toEqual([
      ['ZONA NORTE', '13'],
      ['ZONA OESTE', '13'],
      ['CENTRO', '11'],
      ['ZONA LESTE', '13'],
      ['ZONA SUL', '13'],
    ]);
    expect(html).toContain('<text x="200" y="40" text-anchor="middle"');
    expect(html.match(/stroke-dasharray="5 5" opacity=".6"\/>/g)).toHaveLength(2);
    expect(html).toContain(
      '<span>Esquema ilustrativo das zonas, não um mapa real. As posições indicam apenas a zona do grupo. O endereço e a rota abrem no Google Maps. Mapa interativo previsto para a próxima versão.</span></p>',
    );
  });

  it('lista 11 pins e 11 itens na ordem padrão, com Cantareira Trail selecionado', async () => {
    const html = await getMapa();
    expect(html.match(/class="pin"/g)).toHaveLength(11);
    expect(html.match(/class="map-item"/g)).toHaveLength(11);
    expect(pins(html).map(dataId)).toEqual(ORDEM_PADRAO);
    expect(items(html).map(dataId)).toEqual(ORDEM_PADRAO);
    expectSelected(html, 'cantareira-trail', [188, 56]);
  });

  it('mostra o painel do grupo selecionado', async () => {
    const panel = detail(await getMapa());
    expect(panel).toContain(
      '<div class="panel" style="--z:#5E9A22;--zon:#FFFFFF;border-color:var(--z)">',
    );
    expect(panel).toContain(
      '<div class="card-top"><span class="zchip">Zona Norte</span><span class="demo-tag" title="Grupo fictício para demonstração">Fictício · demo</span></div>',
    );
    expect(panel).toContain('<h2 style="margin:10px 0 6px;font-size:28px">Cantareira Trail</h2>');
    expect(panel).toContain('Local</dt><dd>Parque Estadual Alberto Löfgren (Horto Florestal)</dd>');
    expect(panel).toContain(
      'Encontro</dt><dd style="font-weight:500">Combinado no grupo, na entrada do Horto</dd>',
    );
    expect(panel).toContain('Quando</dt><dd>Dom · 7h</dd>');
    expect(panel).toContain('Pace</dt><dd class="mono">6:30–8:00 min/km</dd>');
    expect(panel).toContain('href="/grupos/cantareira-trail"');
  });

  it('cada item da lista traz cor da zona, nome, local e dias curtos', async () => {
    const html = await getMapa();
    const tiete = items(html).find((i) => dataId(i) === 'tiete-em-movimento');
    expect(tiete).toBe(
      '<a class="map-item" href="/mapa/tiete-em-movimento#mapDetail" style="--z:#C8402F;--zon:#FFFFFF" data-act="map-select" data-id="tiete-em-movimento" aria-current="false"><span class="dotz"></span><span><b>Tietê em Movimento</b><small>Parque Ecológico do Tietê</small></span><span class="mono" style="font-size:12px;color:var(--muted)">Ter, Qui</span></a>',
    );
    expect(html).toContain('<ul class="map-list"><li><a class="map-item"');
  });
});

describe('GET /mapa/:slug (CA2)', () => {
  it('pré-seleciona o Pace da Oca na lista, no pin e no painel', async () => {
    const html = await getMapa('/mapa/pace-da-oca');
    expect(html).toContain('<title>Mapa e rotas · Pace Paulista</title>');
    expectSelected(html, 'pace-da-oca', [200, 246]);
    expect(detail(html)).toContain('font-size:28px">Pace da Oca</h2>');
    expect(detail(html)).toContain('Quando</dt><dd>Seg, Qua, Sex · 6h</dd>');
  });

  it('abre a rota e a busca no Google Maps em nova aba e liga aos detalhes do grupo', async () => {
    const panel = detail(await getMapa('/mapa/pace-da-oca'));
    expect(panel).toContain(
      '<a class="btn btn-primary btn-sm" href="https://www.google.com/maps/dir/?api=1&amp;destination=Parque%20Ibirapuera%2C%20S%C3%A3o%20Paulo%2C%20SP" target="_blank" rel="noopener">',
    );
    expect(panel).toContain(
      '<a class="btn btn-outline btn-sm" href="https://www.google.com/maps/search/?api=1&amp;query=Parque%20Ibirapuera%2C%20S%C3%A3o%20Paulo%2C%20SP" target="_blank" rel="noopener">',
    );
    expect(panel).toMatch(/<\/svg> Traçar rota<\/a>/);
    expect(panel).toMatch(/<\/svg> Abrir no Maps<\/a>/);
    expect(panel).toContain(
      '<a class="link" href="/grupos/pace-da-oca" style="display:inline-block;margin-top:12px">Ver detalhes do grupo</a>',
    );
  });
});

describe('Sem JS (CA3)', () => {
  it('pins e itens são links para /mapa/<slug>#mapDetail, sem tabindex nem role de botão', async () => {
    const html = await getMapa();
    for (const el of [...pins(html), ...items(html)]) {
      expect(el).toContain(`href="/mapa/${dataId(el)}#mapDetail"`);
      expect(el).not.toContain('tabindex');
      expect(el).not.toContain('role=');
    }
    expect(pinOf(html, 'pace-da-oca')).toContain(
      '<a class="pin" href="/mapa/pace-da-oca#mapDetail" aria-label="Pace da Oca, Parque Ibirapuera" data-act="map-select" data-id="pace-da-oca" transform="translate(200 246)">',
    );
    expect(html).not.toContain('role="button"');
    expect(html).not.toContain('role="listitem"');
    expect(html).not.toContain('href="#');
  });

  it('cada link do mapa abre uma página com aquele grupo selecionado', async () => {
    const html = await getMapa();
    for (const slug of ORDEM_PADRAO) {
      expect(html).toContain(`href="/mapa/${slug}#mapDetail"`);
      expect(selectedItems(await getMapa(`/mapa/${slug}`))).toEqual([slug]);
    }
  });
});

describe('404 (CA4)', () => {
  it.each(['/mapa/nao-existe', '/mapa/ABC', '/mapa/pace%20da%20oca', `/mapa/${'a'.repeat(61)}`])(
    '%s responde 404',
    async (path) => {
      const res = await request(app).get(path);
      expect(res.status).toBe(404);
      expect(res.text).toContain('<h1 class="display">Página não encontrada</h1>');
      expect(res.text).toContain('<p>Esse endereço não existe.</p>');
    },
  );

  it.each(['/mapa/ABC', '/mapa/pace_da_oca', `/mapa/${'a'.repeat(61)}`])(
    '%s fora do formato de slug responde 404 sem consultar o banco',
    async (path) => {
      const spy = vi.spyOn(pool, 'query');
      expect((await request(app).get(path)).status).toBe(404);
      expect(spy).not.toHaveBeenCalled();
    },
  );

  it.each(['/mapa/%', '/mapa/%E0%A4%A'])(
    '%s com escape malformado responde 400 sem stack nem consulta ao banco',
    async (path) => {
      const spy = vi.spyOn(pool, 'query');
      const err = vi.spyOn(console, 'error').mockImplementation(() => {});
      const res = await request(app).get(path);
      expect(res.status).toBe(400);
      expect(res.text).not.toMatch(/URIError|at decode|node_modules/);
      expect(spy).not.toHaveBeenCalled();
      expect(err).not.toHaveBeenCalled();
    },
  );

  it('slug válido de 60 caracteres consulta o banco antes do 404', async () => {
    const spy = vi.spyOn(pool, 'query');
    expect((await request(app).get(`/mapa/${'a'.repeat(60)}`)).status).toBe(404);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('grupo pending responde 404 e some do mapa', async () => {
    await pool.query("UPDATE groups SET status = 'pending' WHERE slug = 'pace-da-oca'");
    const res = await request(app).get('/mapa/pace-da-oca');
    expect(res.status).toBe(404);
    const html = await getMapa();
    expect(pins(html)).toHaveLength(10);
    expect(html).not.toContain('pace-da-oca');
  });
});

describe('Sem grupos publicados (CA5)', () => {
  it('mostra só as zonas, sem pins, com lista e painel vazios', async () => {
    await truncateAll(pool);
    const html = await getMapa();
    expect(html.match(/<path d="M[^"]*Z" fill="#/g)).toHaveLength(5);
    expect(html).toContain('<g id="pins"></g>');
    expect(html).toContain('<ul class="map-list"></ul>');
    expect(html).toContain('<div id="mapDetail" class="map-detail"></div>');
    expect(html).not.toMatch(/Infinity|NaN|undefined/);
  });
});

describe('Escape (CA8)', () => {
  it('nome e local com <script> saem escapados no pin, na lista e no painel', async () => {
    const owner = await insertUser(pool, XSS);
    await pool.query(
      `UPDATE groups SET name = $1, location = $2, meeting_point = $3, is_demo = false, owner_id = $4
        WHERE slug = 'pace-da-oca'`,
      [XSS, XSS, XSS, owner],
    );
    const html = await getMapa('/mapa/pace-da-oca');
    expect(html).not.toContain('<script>alert');
    expect(pinOf(html, 'pace-da-oca')).toContain(`aria-label="${XSS_ESC}, ${XSS_ESC}"`);
    const item = items(html).find((i) => dataId(i) === 'pace-da-oca');
    expect(item).toContain(`<b>${XSS_ESC}</b><small>${XSS_ESC}</small>`);
    const panel = detail(html);
    expect(panel).toContain(`font-size:28px">${XSS_ESC}</h2>`);
    expect(panel).toContain(`Local</dt><dd>${XSS_ESC}</dd>`);
    expect(panel).toContain(`<dd style="font-weight:500">${XSS_ESC}</dd>`);
    expect(panel).toContain(`<span class="demo-tag">Cadastrado por ${XSS_ESC}</span>`);
    // O local entra codificado na URL do Maps, não cru.
    expect(panel).toContain(
      'destination=%3Cscript%3Ealert(1)%3C%2Fscript%3E%2C%20S%C3%A3o%20Paulo',
    );
  });
});

describe('Contato do grupo não aparece no mapa (P4)', () => {
  it.each(['/mapa', '/mapa/pace-da-oca'])('%s não traz o contato em lugar nenhum', async (path) => {
    const contact = 'https://chat.whatsapp.com/SegredoDoGrupo123';
    await pool.query('UPDATE groups SET contact = $1', [contact]);
    const html = await getMapa(path);
    expect(html).toContain('Pace da Oca');
    expect(html).not.toContain('SegredoDoGrupo123');
    expect(html).not.toContain('chat.whatsapp.com');
    expect(html).not.toContain(encodeURIComponent(contact));
  });
});

describe('CSS do mapa sem JS (CA3, CA9)', () => {
  it.each([
    // A lista em <ul> não ganha marcador nem recuo, e o item-link não fica sublinhado.
    'ul.map-list{list-style:none;margin:0;padding:0 4px 0 0}',
    'a.map-item{text-decoration:none}',
    // Ao seguir o link para #mapDetail, o painel para abaixo do cabeçalho fixo (68px + 3px de borda).
    '.map-detail{scroll-margin-top:84px}',
    // Nome e local sem espaço não abrem scroll horizontal em 360 px.
    '.map-item b,.map-item small,.map-detail h2{overflow-wrap:anywhere}',
  ])('tem %s fora do bloco literal do protótipo', async (rule) => {
    const css = (await request(app).get('/css/app.css')).text;
    expect(css).toContain(rule);
    expect(css.indexOf(rule)).toBeLessThan(css.indexOf('/* Layout: cabeçalho fixo'));
  });
});
