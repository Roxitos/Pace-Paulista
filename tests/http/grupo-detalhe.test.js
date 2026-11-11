import express from 'express';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/app.js';
import { ic } from '../../src/views/helpers.js';
import { pool } from '../../src/db/pool.js';
import { getGroupDetail } from '../../src/modules/groups/groups.service.js';
import { insertMembership, insertUser, migrateTestDb, seedDemo } from '../helpers/db.js';

const app = createApp();

// Só para teste: simula o res.locals.user que a sessão do M5 vai preencher, sem tocar no app.
const loggedInApp = express();
loggedInApp.use((req, res, next) => {
  res.locals.user = { id: '1', display_name: 'Ana' };
  next();
});
loggedInApp.use(createApp());
const NOT_FOUND = 'Esse grupo não foi encontrado. Ele pode ter sido removido.';
const XSS = '<script>alert(1)</script>';
const XSS_ESC = '&lt;script&gt;alert(1)&lt;/script&gt;';

const BASE_GROUP = {
  slug: 'grupo-teste',
  name: 'Grupo Teste',
  zone: 'oeste',
  location: 'Parque da Água Branca',
  days: ['ter'],
  start_time: '19:00',
  pace_min_s: 330,
  pace_max_s: 390,
  level: 'iniciante',
  description: 'Grupo criado só para os testes da página de detalhe.',
  is_demo: false,
};

// Os nomes de coluna vêm só das chaves fixas deste arquivo; os valores vão parametrizados.
async function insertGroup(overrides = {}) {
  const group = { ...BASE_GROUP, ...overrides };
  const columns = Object.keys(group);
  const placeholders = columns.map((_, i) => `$${i + 1}`);
  await pool.query(
    `INSERT INTO groups (${columns.join(', ')}) VALUES (${placeholders.join(', ')})`,
    Object.values(group),
  );
  return group.slug;
}

beforeAll(async () => {
  await migrateTestDb(pool);
});

beforeEach(async () => {
  await seedDemo(pool);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

afterAll(async () => {
  await pool.end();
});

async function getDetail(slug, { app: target = app } = {}) {
  const res = await request(target).get(`/grupos/${slug}`);
  expect(res.status).toBe(200);
  expect(res.headers['content-type']).toMatch(/text\/html/);
  return res.text;
}

function sessions(html) {
  return [
    ...html.matchAll(
      /<span class="date-box"><b>(\d+)<\/b><small>([^<]+)<\/small><\/span><span><b>([^<]+)<\/b>/g,
    ),
  ].map((m) => `${m[1]} ${m[2]} ${m[3]}`);
}

describe('GET /grupos/:slug (CA1)', () => {
  it('mostra a página do Pace da Oca com os dados do seed', async () => {
    const html = await getDetail('pace-da-oca');
    expect(html).toContain('<title>Pace da Oca · Pace Paulista</title>');
    expect(html).toContain('<h1 class="display">Pace da Oca</h1>');
    expect(html).toContain('<span class="zchip">Zona Sul</span>');
    expect(html).toContain(
      '<span class="demo-tag" style="color:inherit;border-color:currentColor">Grupo fictício · demonstração</span>',
    );
    expect(html).toContain('Segunda, Quarta e Sexta · 6h</span>');
    expect(html).toContain('<dd>Segunda, Quarta e Sexta</dd>');
    expect(html).toContain('<dd class="mono">6h</dd>');
    expect(html).toContain('<dd class="mono">4:15–5:00 min/km</dd>');
    expect(html).toContain(
      '<p>Treinos estruturados três vezes por semana: tiros às segundas, fartlek às quartas e rodagem às sextas. Para quem já corre provas e quer baixar tempo.</p>',
    );
    for (const tag of ['Planilha de treino', 'Tiros e fartlek', 'Foco em provas']) {
      expect(html).toContain(`<span class="tag">${tag}</span>`);
    }
    expect(html).toContain(
      '<dd style="font-weight:500">Combinado no grupo, nas imediações da Oca</dd>',
    );
    expect(html).toContain('<dd class="mono">10 a 14 km</dd>');
    expect(html).toContain('</span>Avançado</span></dd>');
    expect(html).toContain('Participantes</dt><dd class="mono">56</dd>');
  });

  it('mostra o painel da zona com selo, descrição e link para os outros grupos', async () => {
    const html = await getDetail('pace-da-oca');
    expect(html).toContain('<h2>Zona Sul</h2>');
    expect(html).toContain('aria-label="Selo da Zona Sul, inspirado em Oca do Ibirapuera"');
    expect(html).toContain('width="56" height="56"');
    expect(html).toContain('O Ibirapuera é o ponto mais movimentado da corrida paulistana');
    expect(html).toContain(
      '<a class="link" href="/grupos?zona=sul" style="display:inline-block;margin-top:12px">Outros grupos da Zona Sul</a>',
    );
  });

  it('conta as participações nos participantes', async () => {
    await insertMembership(pool, await insertUser(pool, 'Ana'), 'pace-da-oca', 'Ana');
    const html = await getDetail('pace-da-oca');
    expect(html).toContain('Participantes</dt><dd class="mono">57</dd>');
  });

  it('mostra a nota das datas e as 4 regras do primeiro treino', async () => {
    const html = await getDetail('pace-da-oca');
    expect(html).toContain(
      'Datas calculadas a partir da agenda fixa do grupo. Confirmações por encontro dependem do banco de dados.',
    );
    expect(html).toContain(
      '<ul class="rules"><li>Chegue 10 minutos antes para o aquecimento.</li><li>Leve água; nos treinos longos, combine hidratação com o grupo.</li><li>Corra sempre pela calçada ou área de pedestres e respeite quem caminha.</li><li>Se o pace estiver puxado, avise: o grupo ajusta.</li></ul>',
    );
  });

  it('dias por extenso de outros grupos', async () => {
    expect(await getDetail('tiete-em-movimento')).toContain('<dd>Terça e Quinta</dd>');
    expect(await getDetail('correria-do-carmo')).toContain('<dd>Sábado</dd>');
  });
});

describe('Próximos encontros no fuso de SP (CA2)', () => {
  it('sábado 6h00 em SP: lista o treino de hoje e mais 3', async () => {
    vi.useFakeTimers({ now: new Date('2026-11-14T09:00:00Z'), toFake: ['Date'] });
    const html = await getDetail('correria-do-carmo');
    expect(sessions(html)).toEqual([
      '14 nov Sábado, 6h30',
      '21 nov Sábado, 6h30',
      '28 nov Sábado, 6h30',
      '5 dez Sábado, 6h30',
    ]);
    expect(html).toContain(
      '<small style="color:var(--muted)">Parque do Carmo · 8 a 12 km</small></span><span class="mono" style="font-size:13px;color:var(--muted)">5:30–6:30 min/km</span>',
    );
  });

  it('depois das 6h30 o treino de hoje sai e restam 3', async () => {
    vi.useFakeTimers({ now: new Date('2026-11-14T09:31:00Z'), toFake: ['Date'] });
    const html = await getDetail('correria-do-carmo');
    expect(sessions(html)).toEqual([
      '21 nov Sábado, 6h30',
      '28 nov Sábado, 6h30',
      '5 dez Sábado, 6h30',
    ]);
  });
});

describe('404 do grupo (CA3)', () => {
  async function expectGroupNotFound(path) {
    const res = await request(app).get(path);
    expect(res.status).toBe(404);
    expect(res.text).toContain('<h1 class="display">Página não encontrada</h1>');
    expect(res.text).toContain(`<p>${NOT_FOUND}</p>`);
    return res;
  }

  it('slug inexistente', async () => {
    await expectGroupNotFound('/grupos/nao-existe');
  });

  it.each(['pending', 'rejected'])('grupo com status %s', async (status) => {
    await pool.query("UPDATE groups SET status = $1 WHERE slug = 'pace-da-oca'", [status]);
    await expectGroupNotFound('/grupos/pace-da-oca');
  });

  it.each(['/grupos/ABC', '/grupos/a%20b', `/grupos/${'a'.repeat(61)}`, '/grupos/pace_da_oca'])(
    '%s dá 404 sem consultar o banco',
    async (path) => {
      const spy = vi.spyOn(pool, 'query');
      await expectGroupNotFound(path);
      expect(spy).not.toHaveBeenCalled();
    },
  );

  it('slug válido de 60 caracteres consulta o banco', async () => {
    const spy = vi.spyOn(pool, 'query');
    await expectGroupNotFound(`/grupos/${'a'.repeat(60)}`);
    expect(spy).toHaveBeenCalledTimes(1);
  });
});

describe('Contato (CA4): só para usuário logado', () => {
  const CONTACT = '@grupo_teste';

  it('visitante deslogado não vê a linha nem o texto do contato, mesmo preenchido', async () => {
    const html = await getDetail(await insertGroup({ contact: CONTACT }));
    expect(html).not.toContain('Contato');
    expect(html).not.toContain(CONTACT);
    expect(html).not.toContain('grupo_teste');
  });

  it('logado vê a linha "Contato" no fim da ficha', async () => {
    const slug = await insertGroup({ contact: CONTACT });
    const html = await getDetail(slug, { app: loggedInApp });
    // Última linha da ficha, com o ícone ext e o texto puro (sem link).
    const row = `<div><dt>${ic('ext', 'ico-sm')}Contato</dt><dd>${CONTACT}</dd></div>`;
    expect(html).toContain(row);
    expect(html.slice(html.indexOf(row) + row.length).trimStart()).toMatch(/^<\/dl>/);
  });

  it('logado não vê a linha quando o grupo é demo (contact NULL)', async () => {
    const html = await getDetail('pace-da-oca', { app: loggedInApp });
    expect(html).not.toContain('Contato</dt>');
  });

  it('logado não vê a linha quando o contato está vazio', async () => {
    const html = await getDetail(await insertGroup({ contact: '' }), { app: loggedInApp });
    expect(html).not.toContain('Contato</dt>');
  });
});

describe('Etiqueta do cabeçalho (CA5)', () => {
  it('grupo não demo com dono mostra "Cadastrado por {nome}"', async () => {
    const ana = await insertUser(pool, 'Ana');
    const html = await getDetail(await insertGroup({ owner_id: ana }));
    expect(html).toContain(
      '<span class="demo-tag" style="color:inherit;border-color:currentColor">Cadastrado por Ana</span>',
    );
    expect(html).not.toContain('Grupo fictício');
  });

  it('grupo não demo sem dono não tem etiqueta', async () => {
    const html = await getDetail(await insertGroup());
    expect(html).not.toContain('class="demo-tag"');
  });
});

describe('Links (CA6)', () => {
  it('aponta para rotas reais e não usa âncoras nem data-act do protótipo', async () => {
    const html = await getDetail('pace-da-oca');
    expect(html).toContain('<a class="back" href="/grupos">');
    expect(html).toContain('Voltar para os grupos</a>');
    expect(html).toContain(
      '<a class="btn btn-primary btn-lg" href="/conta/entrar?next=/grupos/pace-da-oca%23participar">',
    );
    expect(html).toContain('Entrar no grupo</a>');
    expect(html).toContain('<a class="btn btn-outline" href="/mapa/pace-da-oca">');
    expect(html).toContain('Ver rota no mapa</a>');
    expect(html).not.toContain('href="#');
    expect(html).not.toMatch(/data-act="(entrar|sair)"/);
  });
});

describe('Escape (CA7)', () => {
  it('logado: nome, local, descrição, tags, ponto, distância, contato e dono aparecem escapados', async () => {
    const owner = await insertUser(pool, XSS);
    const slug = await insertGroup({
      name: XSS,
      location: XSS,
      description: `${XSS} descrição longa o bastante`,
      profile_tags: [XSS],
      meeting_point: XSS,
      distance: XSS,
      contact: XSS,
      owner_id: owner,
    });
    const html = await getDetail(slug, { app: loggedInApp });
    expect(html).not.toContain('<script>alert');
    expect(html).toContain(`<title>${XSS_ESC} · Pace Paulista</title>`);
    expect(html).toContain(`<h1 class="display">${XSS_ESC}</h1>`);
    expect(html).toContain(`Cadastrado por ${XSS_ESC}</span>`);
    expect(html).toContain(`<p>${XSS_ESC} descrição longa o bastante</p>`);
    expect(html).toContain(`<span class="tag">${XSS_ESC}</span>`);
    expect(html).toContain(`<dd style="font-weight:500">${XSS_ESC}</dd>`);
    expect(html).toContain(`Distância</dt><dd class="mono">${XSS_ESC}</dd>`);
    expect(html).toContain(`Contato</dt><dd>${XSS_ESC}</dd>`);
    expect(html).toContain(`Local</dt><dd>${XSS_ESC}</dd>`);
  });
});

describe('Escape (CA7) deslogado', () => {
  it('o contato com <script> não aparece de forma nenhuma', async () => {
    const html = await getDetail(await insertGroup({ contact: `${XSS} contato` }));
    expect(html).not.toContain('<script>alert');
    expect(html).not.toContain(XSS_ESC);
    expect(html).not.toContain('contato<');
    expect(html).not.toContain('Contato');
  });
});

describe('Navegação (CA8)', () => {
  it('marca "Encontrar grupos" com aria-current', async () => {
    const html = await getDetail('pace-da-oca');
    expect(html).toContain('href="/grupos" data-nav="grupos" aria-current="page"');
    expect(html.match(/aria-current=/g)).toHaveLength(1);
  });
});

describe('Texto longo sem espaço em 360 px (CA8)', () => {
  it('quebra local do cabeçalho, descrição e tags, não só o nome e os encontros', async () => {
    // Local (80), descrição (400) e tags vêm do organizador: uma URL colada sem espaço
    // abriria scroll horizontal no celular.
    const res = await request(app).get('/css/app.css');
    expect(res.text).toContain(
      '.detail-head h1,.detail-head .sub span,.sessions li > span,.detail-grid .panel p,.detail-grid .tag{overflow-wrap:anywhere}',
    );
  });

  it('abaixo de 560 px o pace desce para baixo do texto do encontro, sem mexer no layout largo', async () => {
    // Com 3 colunas sobram ~63 px para o texto a 360 px e "Segunda-feira" quebrava no meio (QA 006).
    const css = (await request(app).get('/css/app.css')).text;
    const rule =
      '@media (max-width:560px){ul.sessions li{grid-template-columns:auto minmax(0,1fr);row-gap:4px}ul.sessions li > .date-box{grid-row:span 2}ul.sessions li > .mono{grid-column:2}}';
    expect(css).toContain(rule);
    // Fora do bloco literal do protótipo e com especificidade maior que `.sessions li` (0,1,1),
    // senão a regra do protótipo, que vem depois, ganharia.
    expect(css.indexOf(rule)).toBeLessThan(css.indexOf('/* Layout: cabeçalho fixo'));
    expect(css).toContain(
      '.sessions li{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:14px;',
    );
  });

  it('a pace de cada encontro continua sendo o último filho com class mono', async () => {
    const html = await getDetail('pace-da-oca');
    expect(html).toMatch(
      /<li><span class="date-box">.*?<\/span><span><b>.*?<\/small><\/span><span class="mono" [^>]*>4:15–5:00 min\/km<\/span><\/li>/,
    );
  });
});

describe('Contato (P4): cada camada barra o visitante sozinha', () => {
  const CONTACT = '@grupo_teste';
  const NOW = new Date('2026-11-14T09:00:00Z');

  it('o serviço não entrega o contato sem viewer', async () => {
    const slug = await insertGroup({ contact: CONTACT });
    expect((await getGroupDetail(slug, NOW)).group.contact).toBeNull();
    expect((await getGroupDetail(slug, NOW, { viewer: null })).group.contact).toBeNull();
    expect((await getGroupDetail(slug, NOW, { viewer: { id: '1' } })).group.contact).toBe(CONTACT);
  });

  it('a view não mostra o contato sem locals.user, mesmo se ele chegar preenchido', async () => {
    const slug = await insertGroup({ contact: CONTACT });
    const { group } = await getGroupDetail(slug, NOW, { viewer: { id: '1' } });
    const html = await new Promise((resolve, reject) => {
      app.render('pages/grupo-detalhe', { group, sessions: [] }, (err, out) =>
        err ? reject(err) : resolve(out),
      );
    });
    expect(html).toContain('Ficha do treino');
    expect(html).not.toContain('Contato');
    expect(html).not.toContain(CONTACT);
  });
});
