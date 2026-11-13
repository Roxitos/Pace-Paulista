import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/app.js';
import { pool } from '../../src/db/pool.js';
import { createTestApp, getCsrf } from '../helpers/auth.js';
import { migrateTestDb, seedDemo } from '../helpers/db.js';

const app = createApp();
const testApp = createTestApp();
const XSS = '<script>alert(1)</script>';
const XSS_ESC = '&lt;script&gt;alert(1)&lt;/script&gt;';

const MSG = {
  zona: 'Escolha uma zona ou &#34;Qualquer zona&#34;.',
  paceVazio: 'Informe seu pace aproximado.',
  paceFormato: 'Use o formato 6:00, entre 3:00 e 12:00 min/km.',
  dias: 'Selecione pelo menos um dia.',
  nivel: 'Escolha seu nível.',
};

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

// Copia um grupo demo (mesma nota) com outro slug; colunas fixas, valores parametrizados.
async function cloneGroup(fromSlug, { slug, name, location, status = 'published' }) {
  await pool.query(
    `INSERT INTO groups (slug, name, zone, location, days, start_time, pace_min_s, pace_max_s,
                         level, description, status)
     SELECT $2, $3, zone, COALESCE($4, location), days, start_time, pace_min_s, pace_max_s,
            level, description, $5
       FROM groups WHERE slug = $1`,
    [fromSlug, slug, name, location ?? null, status],
  );
}

async function get(query, status = 200) {
  const res = await request(app).get(`/encontrar${query}`);
  expect(res.status).toBe(status);
  expect(res.headers['content-type']).toMatch(/text\/html/);
  return res.text;
}

function resultsOf(html) {
  const i = html.indexOf('<div id="matchResults"');
  return i === -1 ? null : html.slice(i);
}

// Cards na ordem da página: slug do link do nome, nome, N% e motivos.
function cards(html) {
  const section = resultsOf(html);
  return [...section.matchAll(/<article class="card"[\s\S]*?<\/article>/g)].map(([card]) => {
    const [, slug, name] = card.match(
      /<h3 style="margin-top:8px"><a href="\/grupos\/([^"]+)">([^<]*)<\/a><\/h3>/,
    );
    const [, p, pct] = card.match(
      /<span class="match-score" style="--p:(\d+)"><span>(\d+)%<\/span>/,
    );
    expect(p).toBe(pct);
    const ul = card.match(/<ul class="why">([\s\S]*?)<\/ul>/)[1];
    const why = [...ul.matchAll(/<li><svg[^>]*>[\s\S]*?<\/svg>([^<]*)<\/li>/g)].map((m) => m[1]);
    return { slug, name, pct: Number(pct), why };
  });
}

function secHead(html) {
  const m = resultsOf(html).match(
    /<span class="kicker">Resultado<\/span><h2 class="display">([^<]*)<\/h2><p>([^<]*)<\/p>/,
  );
  return { title: m[1], summary: m[2] };
}

function errSpan(html, id) {
  return html.match(new RegExp(`<span class="err" id="${id}">(.*?)</span>`))[1];
}

function errText(html, id) {
  return errSpan(html, id).replace(/<svg[\s\S]*?<\/svg>/, '');
}

const NA_FAIXA = 'Seu pace está na faixa do grupo';
const PERTO = 'Seu pace está a até 30 s/km da faixa';
const NIVEL = 'Mesmo nível que você';
const HORARIO = 'No horário que você prefere';
const CASO_A = '?zona=sul&pace=5%3A00&dias=seg&dias=qua&nivel=avancado';

const CASOS = [
  [
    'A',
    CASO_A,
    '5 grupos combinam com você',
    'Pace 5:00 min/km · Zona Sul · avançado',
    [
      [
        'pace-da-oca',
        'Pace da Oca',
        100,
        ['Fica na Zona Sul', NA_FAIXA, 'Treina segunda e quarta', NIVEL],
      ],
      ['minhocao-noturno', 'Minhocão Noturno', 61, [NA_FAIXA, 'Treina quarta']],
      ['represa-run-club', 'Represa Run Club', 56, ['Fica na Zona Sul', PERTO]],
      ['pelotao-paulista', 'Pelotão Paulista', 41, [NA_FAIXA]],
      ['villa-lobos-runners', 'Villa-Lobos Runners', 41, [NA_FAIXA]],
    ],
  ],
  [
    'B',
    '?zona=qualquer&pace=6%3A00&dias=ter&dias=qui&nivel=iniciante&periodo=noite',
    '6 grupos combinam com você',
    'Pace 6:00 min/km · qualquer zona · iniciante',
    [
      [
        'tiete-em-movimento',
        'Tietê em Movimento',
        100,
        [NA_FAIXA, 'Treina terça e quinta', NIVEL, HORARIO],
      ],
      [
        'juventude-em-pace',
        'Juventude em Pace',
        100,
        [NA_FAIXA, 'Treina terça e quinta', NIVEL, HORARIO],
      ],
      ['villa-lobos-runners', 'Villa-Lobos Runners', 83, [NA_FAIXA, 'Treina terça e quinta']],
      ['minhocao-noturno', 'Minhocão Noturno', 74, [NA_FAIXA, HORARIO]],
      ['correria-do-carmo', 'Correria do Carmo', 65, [NA_FAIXA]],
      ['represa-run-club', 'Represa Run Club', 65, [NA_FAIXA]],
    ],
  ],
  [
    'C',
    '?zona=leste&pace=6%3A00&dias=sab&dias=dom&nivel=intermediario',
    '6 grupos combinam com você',
    'Pace 6:00 min/km · Zona Leste · intermediário',
    [
      [
        'correria-do-carmo',
        'Correria do Carmo',
        100,
        ['Fica na Zona Leste', NA_FAIXA, 'Treina sábado', NIVEL],
      ],
      ['tiete-em-movimento', 'Tietê em Movimento', 71],
      ['represa-run-club', 'Represa Run Club', 70],
      ['pelotao-paulista', 'Pelotão Paulista', 55],
      ['cantareira-trail', 'Cantareira Trail', 55],
      ['minhocao-noturno', 'Minhocão Noturno', 50],
    ],
  ],
  [
    'D',
    '?zona=norte&pace=3%3A00&dias=seg&nivel=avancado',
    'Nenhum grupo compatível',
    'Pace 3:00 min/km · Zona Norte · avançado',
    [],
  ],
  [
    'H',
    '?zona=oeste&pace=4%3A30&dias=sab&nivel=avancado&periodo=cedo',
    '4 grupos combinam com você',
    'Pace 4:30 min/km · Zona Oeste · avançado',
    [
      ['raia-usp', 'Raia Olímpica', 91, ['Fica na Zona Oeste', NA_FAIXA, 'Treina sábado', NIVEL]],
      ['villa-lobos-runners', 'Villa-Lobos Runners', 60, ['Fica na Zona Oeste', PERTO, HORARIO]],
      ['pace-da-oca', 'Pace da Oca', 55, [NA_FAIXA, NIVEL, HORARIO]],
      ['correria-do-carmo', 'Correria do Carmo', 40, ['Treina sábado', HORARIO]],
    ],
  ],
  [
    'J',
    '?zona=norte&pace=3%3A00&dias=ter&nivel=iniciante',
    '1 grupo combina com você',
    'Pace 3:00 min/km · Zona Norte · iniciante',
    [['juventude-em-pace', 'Juventude em Pace', 65, ['Fica na Zona Norte', 'Treina terça', NIVEL]]],
  ],
];

describe('GET /encontrar sem respostas', () => {
  it('mostra o form vazio do protótipo, sem resultados nem alerta', async () => {
    const html = await get('');
    expect(html).toContain('<title>Encontrar meu grupo · Pace Paulista</title>');
    expect(html).toContain('<span class="eyebrow">Encontrar meu grupo</span>');
    expect(html).toContain('<h1 class="display">Qual é o seu ritmo?</h1>');
    expect(html).toContain(
      '<p>Responda quatro perguntas e veja os grupos mais compatíveis com você. Nada é salvo.</p>',
    );
    expect(html).not.toContain('nem enviado');
    expect(html.match(/type="radio" name="zona"/g)).toHaveLength(6);
    expect(html).toContain(
      '<label class="choice"><input type="radio" name="zona" value="qualquer"><span>Qualquer zona</span></label>',
    );
    expect(html).toContain(
      '<label class="choice z" style="--z:#3A78C2;--zon:#FFFFFF"><input type="radio" name="zona" value="sul"><span>Zona Sul</span></label>',
    );
    expect(html).toContain(
      '<input class="input mono" id="m-pace" name="pace" inputmode="numeric" placeholder="6:00" aria-describedby="e-pace h-pace" value="">',
    );
    expect(html).toContain(
      '<span class="hint" id="h-pace">Formato minutos:segundos, entre 3:00 e 12:00.</span>',
    );
    expect(html).toContain(
      '<select class="select" id="m-periodo" name="periodo"><option value="">Qualquer horário</option><option value="cedo">Antes das 7h</option><option value="manha">Das 7h às 12h</option><option value="tarde">Das 12h às 18h</option><option value="noite">A partir das 18h</option></select>',
    );
    expect(html.match(/type="checkbox" name="dias"/g)).toHaveLength(7);
    expect(html).toContain(
      '<label class="choice"><input type="checkbox" name="dias" value="sab"><span>Sáb</span></label>',
    );
    expect(html.match(/type="radio" name="nivel"/g)).toHaveLength(3);
    for (const legend of [
      'Em qual zona você prefere correr? *',
      'Em quais dias você pode correr? *',
      'Seu nível de experiência *',
    ]) {
      expect(html).toContain(`<legend>${legend}</legend>`);
    }
    expect(html).toContain('<label for="m-pace">Seu pace aproximado (min/km) *</label>');
    expect(html).toContain('<label for="m-periodo">Horário preferido</label>');
    expect(html).toMatch(
      /<button class="btn btn-primary btn-lg" type="submit"><svg[^>]*>[\s\S]*?<\/svg> Mostrar grupos compatíveis<\/button>/,
    );
    expect(html).toContain(
      '<aside class="side-note"><h3>Como calculamos</h3><ul><li>Pace dentro da faixa do grupo pesa mais.</li><li>Zona, dias em comum e nível ajustam a nota.</li><li>Mostramos até 6 grupos com compatibilidade a partir de 40%.</li></ul><p style="color:var(--muted)">Não sabe seu pace? Divida o tempo de uma corrida pela distância. 30 min em 5 km dá 6:00 min/km.</p></aside>',
    );
    expect(resultsOf(html)).toBeNull();
    expect(html).toContain('<div id="matchAlert"></div>');
    expect(html).not.toContain('role="alert"');
    expect(html).not.toMatch(/ checked|autofocus|aria-invalid/);
    for (const id of ['e-zona', 'e-pace', 'e-dias', 'e-nivel']) expect(errSpan(html, id)).toBe('');
  });

  it('o form faz GET em /encontrar com a âncora #matchResults', async () => {
    const html = await get('');
    expect(html).toContain(
      '<form class="form" id="matchForm" method="get" action="/encontrar#matchResults" novalidate>',
    );
  });

  it('não consulta o banco (nem com parâmetros alheios ao form)', async () => {
    const spy = vi.spyOn(pool, 'query');
    await get('');
    const html = await get('?utm_source=x');
    expect(resultsOf(html)).toBeNull();
    expect(html).not.toContain('role="alert"');
    expect(spy).not.toHaveBeenCalled();
  });
});

describe('GET /encontrar com respostas válidas', () => {
  it.each(CASOS)('caso %s', async (_nome, query, title, summary, expected) => {
    const html = await get(query);
    expect(secHead(html)).toEqual({ title, summary });
    const got = cards(html);
    expect(got.map((c) => [c.slug, c.name, c.pct])).toEqual(expected.map(([s, n, p]) => [s, n, p]));
    expected.forEach(([, , , why], i) => {
      if (why) expect(got[i].why).toEqual(why);
    });
  });

  it('caso B não tem nenhum motivo "Fica na …"', async () => {
    const html = await get(CASOS[1][1]);
    expect(resultsOf(html)).not.toContain('Fica na');
  });

  it('reexibe o form preenchido (checked, value como digitado, selected)', async () => {
    const html = await get(
      '?zona=oeste&pace=%2004%3A30%20&dias=sab&dias=seg&nivel=avancado&periodo=cedo',
    );
    expect(html).toContain('<input type="radio" name="zona" value="oeste" checked>');
    expect(html.match(/ checked/g)).toHaveLength(4);
    expect(html).toContain('<input type="checkbox" name="dias" value="seg" checked>');
    expect(html).toContain('<input type="checkbox" name="dias" value="sab" checked>');
    expect(html).toContain('<input type="radio" name="nivel" value="avancado" checked>');
    expect(html).toMatch(/id="m-pace"[^>]*value="04:30"/);
    expect(html).toContain('<option value="cedo" selected>Antes das 7h</option>');
    expect(html.match(/ selected/g)).toHaveLength(1);
    expect(html).not.toMatch(/autofocus|aria-invalid|role="alert"/);
    expect(secHead(html).summary).toBe('Pace 4:30 min/km · Zona Oeste · avançado');
  });

  it('a mesma URL dá o mesmo resultado (nada é guardado entre requisições)', async () => {
    const first = await get(CASO_A);
    await get('?zona=norte&pace=3%3A00&dias=seg&nivel=avancado');
    expect(await get(CASO_A)).toBe(first);
  });

  it('0 resultados → título, resumo e estado vazio literal', async () => {
    const html = await get('?zona=norte&pace=3%3A00&dias=seg&nivel=avancado');
    expect(resultsOf(html)).toMatch(
      /<div class="empty"><svg[^>]*>[\s\S]*?<\/svg><h3>Ainda não temos esse grupo<\/h3><p>Tente marcar mais dias ou escolher "Qualquer zona". Se você organiza treinos, pode ser o primeiro grupo desse perfil.<\/p><a class="btn btn-primary" href="\/grupos\/novo">Cadastrar grupo<\/a><\/div>/,
    );
    expect(resultsOf(html)).not.toContain('class="card"');
  });

  it('links de cada card: detalhe, rota e entrar (sem # nem data-act)', async () => {
    const html = await get(CASO_A);
    const section = resultsOf(html);
    for (const { slug } of cards(html)) {
      expect(section).toContain(`<a href="/grupos/${slug}">`);
      expect(section).toContain(
        `<a class="btn btn-outline btn-sm" href="/grupos/${slug}">Ver detalhes</a>`,
      );
      expect(section).toMatch(
        new RegExp(
          `<a class="btn btn-outline btn-sm" href="/mapa/${slug}"><svg[^>]*>[\\s\\S]*?</svg> Ver rota</a>`,
        ),
      );
      expect(section).toMatch(
        new RegExp(
          `<a class="btn btn-primary" href="/conta/entrar\\?next=/grupos/${slug}%23participar"><svg[^>]*>[\\s\\S]*?</svg> Entrar no grupo</a>`,
        ),
      );
    }
    expect(html).not.toContain('href="#');
    expect(html).not.toContain('data-act="entrar"');
    expect(section).not.toContain('demo-tag');
  });

  it('cada card tem os fatos do protótipo', async () => {
    const section = resultsOf(await get(CASO_A));
    expect(section).toMatch(/Local<\/dt><dd>Parque Ibirapuera<\/dd>/);
    expect(section).toMatch(/Quando<\/dt><dd>Seg, Qua, Sex · 6h<\/dd>/);
    expect(section).toMatch(/Pace<\/dt><dd class="mono">4:15–5:00 min\/km<\/dd>/);
    expect(section).toMatch(/Nível<\/dt><dd>Avançado<\/dd>/);
    expect(section).toContain('<article class="card" style="--z:#3A78C2;--zon:#FFFFFF">');
    expect(section).toContain('<span class="zchip">Zona Sul</span>');
  });
});

describe('GET /encontrar com erro de validação', () => {
  it('sem nada marcado → 422 com as 4 mensagens e o alerta', async () => {
    const spy = vi.spyOn(pool, 'query');
    const html = await get('?pace=&periodo=', 422);
    expect(spy).not.toHaveBeenCalled();
    expect(html).toMatch(
      /<div id="matchAlert"><div class="form-alert bad" role="alert"><svg[^>]*>[\s\S]*?<\/svg><span>Corrija 4 campos para continuar.<\/span><\/div>/,
    );
    expect(errText(html, 'e-zona')).toBe(MSG.zona);
    expect(errText(html, 'e-pace')).toBe(MSG.paceVazio);
    expect(errText(html, 'e-dias')).toBe(MSG.dias);
    expect(errText(html, 'e-nivel')).toBe(MSG.nivel);
    expect(errSpan(html, 'e-pace')).toMatch(/^<svg class="ico ico-sm"/);
    expect(html.match(/autofocus/g)).toHaveLength(1);
    expect(html).toContain('<input type="radio" name="zona" value="norte" autofocus>');
    expect(html).toMatch(/id="m-pace"[^>]*aria-invalid="true"/);
    expect(resultsOf(html)).toBeNull();
  });

  it('pace 2:59 → 422, "Corrija 1 campo", foco e aria-invalid no pace, demais mantidos', async () => {
    const html = await get('?zona=sul&pace=2%3A59&dias=seg&nivel=avancado', 422);
    expect(html).toContain('<span>Corrija 1 campo para continuar.</span>');
    expect(errText(html, 'e-pace')).toBe(MSG.paceFormato);
    for (const id of ['e-zona', 'e-dias', 'e-nivel']) expect(errSpan(html, id)).toBe('');
    expect(html).toContain(
      '<input class="input mono" id="m-pace" name="pace" inputmode="numeric" placeholder="6:00" aria-describedby="e-pace h-pace" value="2:59" aria-invalid="true" autofocus>',
    );
    expect(html.match(/autofocus/g)).toHaveLength(1);
    expect(html).toContain('value="sul" checked>');
    expect(html).toContain('value="seg" checked>');
    expect(html).toContain('value="avancado" checked>');
    expect(resultsOf(html)).toBeNull();
  });

  it('autofocus no 1º dia quando o 1º erro é de dias, e no 1º nível quando é de nível', async () => {
    let html = await get('?zona=sul&pace=5%3A00&nivel=avancado', 422);
    expect(html).toContain('<input type="checkbox" name="dias" value="seg" autofocus>');
    expect(html).not.toMatch(/aria-invalid/);
    html = await get('?zona=sul&pace=5%3A00&dias=seg', 422);
    expect(html).toContain('<input type="radio" name="nivel" value="iniciante" autofocus>');
    expect(html.match(/autofocus/g)).toHaveLength(1);
  });
});

describe('GET /encontrar com entradas fora do form (nunca 500)', () => {
  const OK = 'pace=5%3A00&dias=seg&nivel=avancado';
  it('zona=marte → erro de zona', async () => {
    const html = await get(`?zona=marte&${OK}`, 422);
    expect(errText(html, 'e-zona')).toBe(MSG.zona);
  });

  it('nivel=__proto__ → erro de nível', async () => {
    const html = await get('?zona=sul&pace=5%3A00&dias=seg&nivel=__proto__', 422);
    expect(errText(html, 'e-nivel')).toBe(MSG.nivel);
  });

  it('dias=xyz → erro de dias; dias=seg&dias=xyz → só seg', async () => {
    let html = await get('?zona=sul&pace=5%3A00&dias=xyz&nivel=avancado', 422);
    expect(errText(html, 'e-dias')).toBe(MSG.dias);
    html = await get('?zona=sul&pace=5%3A00&dias=seg&dias=xyz&nivel=avancado');
    expect(html.match(/name="dias" value="[a-z]+" checked/g)).toEqual([
      'name="dias" value="seg" checked',
    ]);
  });

  it('periodo=constructor → "Qualquer horário" (máximo 100)', async () => {
    const html = await get(`${CASO_A}&periodo=constructor`);
    expect(cards(html).map((c) => c.pct)).toEqual([100, 61, 56, 41, 41]);
    expect(html).not.toContain(' selected');
  });

  it('zona=sul&zona=norte → sul', async () => {
    const html = await get(`?zona=sul&zona=norte&${OK}&dias=qua`);
    expect(secHead(html).summary).toBe('Pace 5:00 min/km · Zona Sul · avançado');
    expect(cards(html)[0].slug).toBe('pace-da-oca');
  });

  it('pace[a]=1 → pace ausente', async () => {
    const html = await get('?zona=sul&pace[a]=1&dias=seg&nivel=avancado', 422);
    expect(errText(html, 'e-pace')).toBe(MSG.paceVazio);
  });

  it('?utm_source=x → form vazio (200)', async () => {
    const html = await get('?utm_source=x');
    expect(html).not.toContain('role="alert"');
  });

  it('pace com aspas não fecha o atributo value (contexto de atributo)', async () => {
    const evil = `" autofocus onfocus="alert(1)`;
    const html = await get(
      `?zona=sul&pace=${encodeURIComponent(evil)}&dias=seg&nivel=avancado`,
      422,
    );
    expect(html).not.toContain('onfocus="alert(1)"');
    expect(html).toContain('value="&#34; autofocus onfocus=&#34;alert(1)"');
  });

  it.each(['%E0%A4%A', '%', '%00', '%EF%BC%95%3A00', '0012%3A00'])(
    'pace=%s (codificação quebrada, dígito não ASCII, zeros à esquerda) → 422 de formato',
    async (pace) => {
      const html = await get(`?zona=sul&pace=${pace}&dias=seg&nivel=avancado`, 422);
      expect(errText(html, 'e-pace')).toBe(MSG.paceFormato);
    },
  );

  it('enxurrada de parâmetros (acima do limite de 1000 pares) não vira 500', async () => {
    const res = await request(app).get(
      `/encontrar?${'dias=seg&'.repeat(1500)}zona=sul&pace=5%3A00&nivel=avancado`,
    );
    expect(res.status).toBeLessThan(500);
  });
});

describe('POST /encontrar', () => {
  it('não existe: 404 com a página padrão', async () => {
    // Com token válido, para chegar ao 404 (o CSRF roda antes das rotas).
    const agent = request.agent(testApp);
    const _csrf = await getCsrf(agent);
    const res = await agent.post('/encontrar').type('form').send({ _csrf, zona: 'sul' });
    expect(res.status).toBe(404);
    expect(res.text).toContain('<title>Página não encontrada · Pace Paulista</title>');
  });
});

describe('grupos fora do seed', () => {
  it('grupo pending nunca aparece', async () => {
    await cloneGroup('pace-da-oca', {
      slug: 'oca-pendente',
      name: 'Oca Pendente',
      status: 'pending',
    });
    const html = await get(CASO_A);
    expect(html).not.toContain('oca-pendente');
  });

  it('grupo publicado depois do seed, com nota empatada, vem depois do demo', async () => {
    await cloneGroup('minhocao-noturno', { slug: 'aaa-clone', name: 'AAA Clone' });
    const got = cards(await get(CASO_A));
    expect(got.map((c) => [c.slug, c.pct])).toEqual([
      ['pace-da-oca', 100],
      ['minhocao-noturno', 61],
      ['aaa-clone', 61],
      ['represa-run-club', 56],
      ['pelotao-paulista', 41],
      ['villa-lobos-runners', 41],
    ]);
  });

  it('escapa nome e local do grupo e o pace digitado', async () => {
    await cloneGroup('pace-da-oca', { slug: 'grupo-xss', name: XSS, location: XSS });
    const html = await get(CASO_A);
    expect(html).not.toContain(XSS);
    expect(resultsOf(html)).toContain(`<a href="/grupos/grupo-xss">${XSS_ESC}</a>`);
    expect(resultsOf(html)).toContain(`<dd>${XSS_ESC}</dd>`);

    const bad = await get('?zona=sul&pace=%3Cscript%3E&dias=seg&nivel=avancado', 422);
    expect(bad).not.toContain('<script>');
    expect(bad).toContain('value="&lt;script&gt;"');
  });
});
