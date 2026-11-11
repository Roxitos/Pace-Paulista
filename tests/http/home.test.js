import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { DEMO_GROUPS } from '../../db/seeds/demo-groups.js';
import { getHomeData } from '../../src/modules/pages/pages.service.js';

const app = createApp();
let html;

beforeAll(async () => {
  const res = await request(app).get('/');
  expect(res.status).toBe(200);
  html = res.text;
});

describe('GET / (home)', () => {
  it('mostra o hero com as estatísticas dos grupos demo', () => {
    expect(html).toContain('Encontre seu grupo.');
    expect(html).toContain('<strong>11</strong>grupos cadastrados');
    expect(html).toContain('<strong>5</strong>zonas da cidade');
    expect(html).toContain('<strong>4:00–8:30</strong>min/km de pace');
    expect(html).not.toContain('grupos no protótipo');
  });

  it('gera a arte da pista com os mesmos números do protótipo', () => {
    [1, 2, 3, 4, 5, 6].forEach((n, i) => {
      const r = 169 + i * 38;
      const a = Math.PI * 1.12;
      const x = 560 + r * Math.cos(a);
      const y = 480 + r * Math.sin(a);
      expect(html).toContain(`<text x="${x}" y="${y}"`);
      expect(html).toContain(`transform="rotate(-70 ${x} ${y})">${n}</text>`);
    });
    const tx = 560 + 245 * Math.cos(Math.PI * 1.32);
    const ty = 480 + 245 * Math.sin(Math.PI * 1.32);
    expect(html).toContain(`<g transform="translate(${tx} ${ty})">`);
    expect(html.match(/stroke="#F7F4EC" stroke-width="3"/g)).toHaveLength(2);
    expect(html.match(/stroke="#F7F4EC" stroke-width="1.8"/g)).toHaveLength(5);
  });

  it('mostra o aviso de demonstração e mantém a raia 1 literal', () => {
    expect(html).toContain('<strong>Versão de demonstração.</strong>');
    expect(html).toContain('Sem cadastro para começar.');
  });

  it('lista as 5 zonas com selo, link e contagem', () => {
    expect(html.match(/class="zcard"/g)).toHaveLength(5);
    expect(html).toContain('href="/grupos?zona=sul"');
    expect(html).toContain('<span>3 grupos</span>');
    expect(html.match(/<span>2 grupos<\/span>/g)).toHaveLength(4);
    expect(html).toContain('aria-label="Selo da Zona Sul, inspirado em Oca do Ibirapuera"');
    expect(html).toContain('aria-label="Selo da Centro, inspirado em Avenida Paulista"');
    expect(html.match(/class="seal"/g)).toHaveLength(5);
    expect(html).toContain('style="--z:#E8892B;--zon:#17171A" href="/grupos?zona=centro"');
  });

  it('mostra os destaques na ordem e com os fatos do protótipo', () => {
    const carmo = html.indexOf('>Correria do Carmo</a>');
    const oca = html.indexOf('>Pace da Oca</a>');
    const pelotao = html.indexOf('>Pelotão Paulista</a>');
    expect(carmo).toBeGreaterThan(-1);
    expect(oca).toBeGreaterThan(carmo);
    expect(pelotao).toBeGreaterThan(oca);
    const demoTag =
      '<span class="demo-tag" title="Grupo fictício para demonstração">Fictício · demo</span>';
    expect(html.split(demoTag)).toHaveLength(4);
    expect(html).toContain('<dd>Sáb · 6h30</dd>');
    expect(html).toContain('<dd>Seg, Qua, Sex · 6h</dd>');
    expect(html).toContain('<dd>Dom · 7h</dd>');
    expect(html).toContain('<dd class="mono">5:30–6:30 min/km</dd>');
    expect(html).toContain('<dd class="mono">4:15–5:00 min/km</dd>');
    expect(html).toContain('<dd class="mono">4:45–5:45 min/km</dd>');
    expect(html).toContain('<dd class="mono">48</dd>');
    expect(html).toContain('<dd class="mono">56</dd>');
    expect(html).toContain('<dd class="mono">72</dd>');
    expect(html).toContain('<span class="zchip">Zona Leste</span>');
    expect(html).toContain('<i class="on"></i><i class="on"></i><i class="on"></i></span>Avançado');
  });

  it('usa links reais em vez de hash e de botões de JS', () => {
    expect(html).toContain('href="/conta/entrar?next=/grupos/pace-da-oca%23participar"');
    expect(html).toContain('href="/grupos/correria-do-carmo"');
    expect(html).toContain('href="/mapa/pelotao-paulista"');
    expect(html).toContain('href="/grupos/novo"');
    expect(html).toContain('href="/zonas"');
    expect(html).toContain('href="/encontrar"');
    expect(html).not.toContain('href="#');
    expect(html).not.toContain('data-act="entrar"');
  });
});

function renderView(view, data) {
  return new Promise((resolve, reject) => {
    app.render(view, data, (err, out) => (err ? reject(err) : resolve(out)));
  });
}

describe('home com dados de borda', () => {
  it('sem grupos não mostra Infinity/NaN e omite a faixa de pace', async () => {
    const out = await renderView('pages/home', getHomeData([]));
    expect(out).toContain('<strong>0</strong>grupos cadastrados');
    expect(out).not.toMatch(/Infinity|NaN|undefined/);
    expect(out).not.toContain('min/km de pace');
    expect(out).toContain('<span>0 grupos</span>');
    expect(out).not.toContain('Versão de demonstração');
  });
});

describe('group-card', () => {
  it('codifica o slug como componente de URL nos links', async () => {
    const g = { ...DEMO_GROUPS[0], slug: 'a/../b?x=1#y "z', participants: 1 };
    const out = await renderView('partials/group-card', { g });
    const enc = encodeURIComponent(g.slug).replaceAll('"', '&#34;');
    expect(out).toContain(`href="/grupos/${enc}"`);
    expect(out).toContain(`href="/mapa/${enc}"`);
    expect(out).toContain(`href="/conta/entrar?next=/grupos/${enc}%23participar"`);
    expect(out).not.toContain('/grupos/a/../b');
  });

  it('escapa nome, descrição e local do grupo', async () => {
    const xss = '<script>alert(1)</script>';
    const g = { ...DEMO_GROUPS[0], name: xss, description: xss, location: xss, participants: 1 };
    const out = await renderView('partials/group-card', { g });
    expect(out).not.toContain('<script>');
    expect(out.match(/&lt;script&gt;/g)).toHaveLength(3);
  });
});
