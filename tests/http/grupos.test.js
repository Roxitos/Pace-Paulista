import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { pool } from '../../src/db/pool.js';
import { migrateTestDb, seedDemo } from '../helpers/db.js';

const app = createApp();

// Nenhum teste aqui escreve no banco: o seed roda uma vez.
beforeAll(async () => {
  await migrateTestDb(pool);
  await seedDemo(pool);
});

afterAll(async () => {
  await pool.end();
});

async function getGrupos(query = '') {
  const res = await request(app).get(`/grupos${query}`);
  expect(res.status).toBe(200);
  expect(res.headers['content-type']).toMatch(/text\/html/);
  return res.text;
}

// Slugs dos cards na ordem em que aparecem (link "Ver detalhes").
function cardSlugs(html) {
  return [
    ...html.matchAll(/<a class="btn btn-outline btn-sm" href="\/grupos\/([^"]+)">Ver detalhes/g),
  ].map((m) => m[1]);
}

function chips(html) {
  return [...html.matchAll(/<a class="achip" href="([^"]*)" aria-label="([^"]*)">/g)].map((m) => ({
    href: m[1].replaceAll('&amp;', '&'),
    ariaLabel: m[2],
  }));
}

function zoneInput(html, zone) {
  return html.match(
    new RegExp(`<input class="sr-only" type="checkbox" name="zona" value="${zone}"[^>]*>`),
  )[0];
}

describe('GET /grupos', () => {
  it('lista os 11 grupos com o cabeçalho e o formulário do protótipo', async () => {
    const html = await getGrupos();
    expect(html).toContain('<title>Grupos de corrida em SP · Pace Paulista</title>');
    expect(html).toContain('<span class="eyebrow">Encontrar grupos</span>');
    expect(html).toContain('<h1 class="display">Grupos de corrida em SP</h1>');
    expect(html).toContain(
      '<p>Filtre por zona, dia, horário, pace e nível. Os resultados atualizam na hora.</p>',
    );
    expect(html).toContain(
      '<span class="count" id="count" aria-live="polite">11 grupos encontrados</span>',
    );
    expect(html.match(/class="card"/g)).toHaveLength(11);
    expect(html).toContain(
      '<div class="active-chips" id="chips" style="margin-bottom:16px"></div>',
    );
  });

  it('marca "Encontrar grupos" no menu com aria-current', async () => {
    const html = await getGrupos();
    expect(html).toContain('href="/grupos" data-nav="grupos" aria-current="page"');
    expect(html.match(/aria-current=/g)).toHaveLength(1);
  });

  it('o formulário faz GET em /grupos e tem os 7 filtros com name', async () => {
    const html = await getGrupos();
    expect(html).toContain(
      '<form class="filters" id="filters" method="get" action="/grupos" role="search" aria-label="Filtros">',
    );
    expect(html.match(/type="checkbox" name="zona"/g)).toHaveLength(5);
    for (const [id, name] of [
      ['f-nome', 'nome'],
      ['f-local', 'local'],
    ]) {
      expect(html).toContain(
        `<input class="input" id="${id}" name="${name}" data-f="${name}" type="search"`,
      );
    }
    for (const name of ['dia', 'periodo', 'nivel']) {
      expect(html).toContain(
        `<select class="select" id="f-${name}" name="${name}" data-f="${name}">`,
      );
    }
    expect(html).toContain('<select class="select mono" id="f-pace" name="pace" data-f="pace">');
    expect(html).toMatch(
      /<button class="btn btn-primary" type="submit"><svg class="ico ico-sm"[^>]*>.*?<\/svg> Aplicar filtros<\/button>\s*<\/form>/,
    );
  });

  it('cada zona é um checkbox dentro de um rótulo visível com a cor da zona', async () => {
    const html = await getGrupos();
    expect(html).toContain(
      '<label class="ztog" style="--z:#3A78C2;--zon:#FFFFFF"><input class="sr-only" type="checkbox" name="zona" value="sul" data-z="sul">Sul</label>',
    );
    const labels = [...html.matchAll(/<label class="ztog"[^>]*><input[^>]*>([^<]+)<\/label>/g)];
    expect(labels.map((m) => m[1])).toEqual(['Norte', 'Oeste', 'Centro', 'Leste', 'Sul']);
    expect(html).not.toContain('aria-pressed');
  });

  it('mostra as opções e textos do protótipo', async () => {
    const html = await getGrupos();
    expect(html).toContain(
      '<option value="">Qualquer dia</option><option value="seg">Segunda</option><option value="ter">Terça</option><option value="qua">Quarta</option><option value="qui">Quinta</option><option value="sex">Sexta</option><option value="sab">Sábado</option><option value="dom">Domingo</option>',
    );
    expect(html).toContain(
      '<option value="">Qualquer horário</option><option value="cedo">Antes das 7h</option><option value="manha">Das 7h às 12h</option><option value="tarde">Das 12h às 18h</option><option value="noite">A partir das 18h</option>',
    );
    expect(html).toContain(
      '<option value="">Qualquer pace</option><option value="ate5">Até 5:00 min/km</option><option value="5a6">5:00 a 6:00 min/km</option><option value="6a7">6:00 a 7:00 min/km</option><option value="mais7">Acima de 7:00 min/km</option>',
    );
    expect(html).toContain(
      '<option value="">Todos os níveis</option><option value="iniciante">Iniciante</option><option value="intermediario">Intermediário</option><option value="avancado">Avançado</option>',
    );
    expect(html).toContain('<span class="hint">Mostra grupos cuja faixa cruza a escolhida.</span>');
    expect(html).toContain('placeholder="Ex.: Correria"');
    expect(html).toContain('placeholder="Ex.: Ibirapuera"');
    expect(html).toContain(
      '<h2>Filtros <a class="link" href="/grupos" style="font-family:var(--f-body);font-size:14px;text-transform:none">Limpar filtros</a></h2>',
    );
  });

  it('funciona sem JS: só o link "Filtros" usa hash e não há data-act="clear"', async () => {
    const html = await getGrupos('?zona=sul');
    expect(html.match(/href="#/g)).toEqual(['href="#']);
    expect(html).toContain(
      '<a class="btn btn-outline btn-sm filters-toggle" href="#filters" aria-controls="filters">',
    );
    expect(html).not.toContain('data-act="clear"');
    expect(html).not.toContain('data-act="rm-filter"');
    expect(html).not.toContain('aria-expanded="false" aria-controls="filters"');
  });
});

describe('GET /grupos com filtros', () => {
  it.each([
    ['?zona=sul', ['pace-da-oca', 'primeiro-km-ibira', 'represa-run-club']],
    [
      '?zona=leste&zona=sul',
      [
        'correria-do-carmo',
        'tiete-em-movimento',
        'pace-da-oca',
        'primeiro-km-ibira',
        'represa-run-club',
      ],
    ],
    [
      '?pace=5a6',
      [
        'villa-lobos-runners',
        'minhocao-noturno',
        'pelotao-paulista',
        'correria-do-carmo',
        'represa-run-club',
      ],
    ],
    ['?nome=pelot%C3%A3o', ['pelotao-paulista']],
    // Mesmo termo em NFD ("a" + til combinante): precisa achar o mesmo grupo.
    ['?nome=pelota%CC%83o', ['pelotao-paulista']],
    ['?nome=+pace+&local=', ['juventude-em-pace', 'pace-da-oca']],
    ['?dia=sab', ['raia-usp', 'correria-do-carmo', 'primeiro-km-ibira']],
  ])('%s mostra os grupos esperados', async (query, expected) => {
    const html = await getGrupos(query);
    expect(cardSlugs(html)).toEqual(expected);
    const n = expected.length;
    expect(html).toContain(`${n} ${n === 1 ? 'grupo encontrado' : 'grupos encontrados'}</span>`);
  });

  it('?zona=sul&nivel=avancado mostra "1 grupo encontrado"', async () => {
    const html = await getGrupos('?zona=sul&nivel=avancado');
    expect(cardSlugs(html)).toEqual(['pace-da-oca']);
    expect(html).toContain('aria-live="polite">1 grupo encontrado</span>');
  });

  it('?periodo=tarde mostra o estado vazio do protótipo', async () => {
    const html = await getGrupos('?periodo=tarde');
    expect(html).toContain('aria-live="polite">0 grupos encontrados</span>');
    expect(html).not.toContain('class="card"');
    expect(html).not.toContain('class="grid-cards"');
    expect(html).toMatch(
      /<div class="empty"><svg class="ico "[^>]*>.*?<\/svg><h3>Nenhum grupo nesse ritmo<\/h3><p>Nenhum grupo atende a todos os filtros\. Tente ampliar a faixa de pace, escolher outro dia ou incluir mais zonas\.<\/p><a class="btn btn-primary" href="\/grupos">Limpar filtros<\/a><\/div>/,
    );
  });

  it('volta com o formulário preenchido', async () => {
    const html = await getGrupos(
      '?zona=sul&zona=leste&nome=pace&local=ibira&dia=sab&periodo=cedo&pace=ate5&nivel=avancado',
    );
    expect(zoneInput(html, 'sul')).toContain(' checked');
    expect(zoneInput(html, 'leste')).toContain(' checked');
    expect(zoneInput(html, 'norte')).not.toContain('checked');
    expect(html).toContain(
      'id="f-nome" name="nome" data-f="nome" type="search" placeholder="Ex.: Correria" value="pace"',
    );
    expect(html).toContain(
      'id="f-local" name="local" data-f="local" type="search" placeholder="Ex.: Ibirapuera" value="ibira"',
    );
    for (const value of ['sab', 'cedo', 'ate5', 'avancado']) {
      expect(html).toContain(`<option value="${value}" selected>`);
    }
    expect(html.match(/ selected>/g)).toHaveLength(4);
  });

  it('mostra um chip por filtro, com rótulo e href que remove só aquele filtro', async () => {
    const html = await getGrupos('?zona=sul&nivel=avancado');
    expect(chips(html)).toEqual([
      { href: '/grupos?nivel=avancado', ariaLabel: 'Remover filtro Zona Sul' },
      { href: '/grupos?zona=sul', ariaLabel: 'Remover filtro Avançado' },
    ]);
    expect(html).toMatch(
      /<a class="achip" href="\/grupos\?nivel=avancado" aria-label="Remover filtro Zona Sul">Zona Sul <svg class="ico ico-sm"/,
    );
  });

  it('chips de todos os filtros saem na ordem e com os textos do protótipo', async () => {
    const html = await getGrupos(
      '?nivel=iniciante&pace=6a7&periodo=noite&dia=ter&local=parque&nome=juventude&zona=norte',
    );
    expect(chips(html).map((c) => c.ariaLabel)).toEqual([
      'Remover filtro Zona Norte',
      'Remover filtro Nome: juventude',
      'Remover filtro Local: parque',
      'Remover filtro Terça',
      'Remover filtro A partir das 18h',
      'Remover filtro 6:00 a 7:00 min/km',
      'Remover filtro Iniciante',
    ]);
    expect(cardSlugs(html)).toEqual(['juventude-em-pace']);
    expect(chips(html)[1].href).toBe(
      '/grupos?zona=norte&local=parque&dia=ter&periodo=noite&pace=6a7&nivel=iniciante',
    );
  });
});

describe('parâmetros inválidos (CA4)', () => {
  it.each([
    '?nome[a]=1',
    '?zona[]=sul',
    '?zona=marte&dia=xyz&pace=constructor&nivel=__proto__',
    '?periodo=toString&pace=__proto__&dia=hasOwnProperty',
    '?zona=sul&zona=sul&zona=SUL',
    '?nome=pace&nome=oca',
    '?nome=%00',
    '?local=%E0%A4%A',
    `?nome=${'a'.repeat(5000)}`,
  ])('%s responde 200 sem erro', async (query) => {
    const html = await getGrupos(query);
    expect(html).toMatch(/\d+ grupos? encontrados?<\/span>/);
  });

  it('ignora inválidos: mesmos 11 grupos e nenhum chip', async () => {
    const html = await getGrupos('?zona=marte&dia=xyz&pace=constructor&nivel=__proto__');
    expect(html).toContain('11 grupos encontrados</span>');
    expect(chips(html)).toEqual([]);
  });

  it('zona repetida conta uma vez', async () => {
    const html = await getGrupos('?zona=sul&zona=sul');
    expect(chips(html)).toEqual([{ href: '/grupos', ariaLabel: 'Remover filtro Zona Sul' }]);
  });
});

describe('escape e curingas (CA5)', () => {
  it.each(['%25', '_', '%5C'])('nome=%s não funciona como curinga', async (q) => {
    const html = await getGrupos(`?nome=${q}`);
    expect(html).toContain('0 grupos encontrados</span>');
    expect(html).toContain('Nenhum grupo nesse ritmo');
  });

  it('nome=<script> aparece escapado no value e no chip', async () => {
    const html = await getGrupos('?nome=%3Cscript%3Ealert(1)%3C%2Fscript%3E&local=%22%3E%3Cb%3E');
    expect(html).not.toContain('<script>alert');
    expect(html).not.toContain('"><b>');
    expect(html).toContain('value="&lt;script&gt;alert(1)&lt;/script&gt;"');
    expect(html).toContain(
      'aria-label="Remover filtro Nome: &lt;script&gt;alert(1)&lt;/script&gt;"',
    );
    expect(html).toContain('>Nome: &lt;script&gt;alert(1)&lt;/script&gt; <svg');
    expect(html).toContain('value="&#34;&gt;&lt;b&gt;"');
  });
});

describe('GET /grupos/zona/:zona (CA3)', () => {
  it.each(['norte', 'oeste', 'centro', 'leste', 'sul'])(
    '/grupos/zona/%s redireciona 301 para a busca',
    async (zona) => {
      const res = await request(app).get(`/grupos/zona/${zona}`);
      expect(res.status).toBe(301);
      expect(res.headers.location).toBe(`/grupos?zona=${zona}`);
    },
  );

  it.each(['marte', 'Sul', 'constructor', '__proto__', '%3Cscript%3E'])(
    '/grupos/zona/%s responde 404 com a página padrão',
    async (zona) => {
      const res = await request(app).get(`/grupos/zona/${zona}`);
      expect(res.status).toBe(404);
      expect(res.text).toContain('<h1 class="display">Página não encontrada</h1>');
      expect(res.headers.location).toBeUndefined();
    },
  );
});

describe('CSS da busca sem JS', () => {
  it('pinta a zona marcada, mostra foco no toggle e abre os filtros por #filters', async () => {
    const res = await request(app).get('/css/app.css');
    expect(res.text).toContain(
      '.ztog:has(input:checked){background:var(--z);border-color:var(--z);color:var(--zon)}',
    );
    expect(res.text).toContain(
      '.ztog:has(input:focus-visible){outline:3px solid var(--focus);outline-offset:2px}',
    );
    expect(res.text).toContain('@media (max-width:900px){ .filters:target{display:grid} }');
  });

  it('para o painel de filtros abaixo do cabeçalho fixo ao rolar até #filters', async () => {
    const res = await request(app).get('/css/app.css');
    // Cabeçalho: min-height 68px + borda de 3px; a safe-area vem do scroll-padding-top do html.
    expect(res.text).toContain('html{scroll-padding-top:env(safe-area-inset-top,0px)}');
    expect(res.text).toContain('.filters{scroll-margin-top:84px}');
    expect(res.text).toContain(
      '.hdr .wrap{display:flex;align-items:center;gap:20px;min-height:68px}',
    );
  });
});
