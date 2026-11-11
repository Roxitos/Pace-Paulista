import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { pool } from '../../src/db/pool.js';
import { parseFilters } from '../../src/domain/filters.js';
import { findPublishedBySlug, listPublished } from '../../src/modules/groups/groups.repo.js';
import { insertMembership, insertUser, migrateTestDb, seedDemo } from '../helpers/db.js';

const GROUP_KEYS = [
  'slug',
  'name',
  'zone',
  'location',
  'meeting_point',
  'days',
  'start_time',
  'pace_min_s',
  'pace_max_s',
  'distance',
  'level',
  'participants',
  'description',
  'profile_tags',
  'contact',
  'is_demo',
  'owner_name',
  'map_pin',
];

const REPO_ORDER = [
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

afterAll(async () => {
  await pool.end();
});

// Hash, e-mail e role reconhecíveis para provar que nada disso sai do repo.
function createUser(displayName) {
  return insertUser(pool, displayName, {
    email: `${displayName.toLowerCase()}@exemplo.com`,
    passwordHash: 'hash-secreto',
    role: 'admin',
  });
}

async function bySlug(slug) {
  return (await listPublished()).find((g) => g.slug === slug);
}

describe('groupsRepo.listPublished', () => {
  it('devolve exatamente as chaves do contrato Group, com os tipos certos', async () => {
    const groups = await listPublished();
    expect(groups).toHaveLength(11);
    for (const g of groups) {
      expect(Object.keys(g).sort()).toEqual([...GROUP_KEYS].sort());
      expect(g.start_time).toMatch(/^\d{2}:\d{2}$/);
      expect(typeof g.participants).toBe('number');
      expect(typeof g.pace_min_s).toBe('number');
      expect(typeof g.pace_max_s).toBe('number');
      expect(typeof g.name).toBe('string');
      expect(Array.isArray(g.days)).toBe(true);
      expect(Array.isArray(g.profile_tags)).toBe(true);
      expect(typeof g.is_demo).toBe('boolean');
    }
  });

  it('não expõe id, dados do usuário nem colunas internas', async () => {
    await pool.query("UPDATE groups SET owner_id = $1 WHERE slug = 'pace-da-oca'", [
      await createUser('Ana'),
    ]);
    const g = await bySlug('pace-da-oca');
    for (const key of [
      'id',
      'owner_id',
      'email',
      'password_hash',
      'role',
      'base_participants',
      'status',
    ]) {
      expect(g).not.toHaveProperty(key);
    }
    expect(JSON.stringify(g)).not.toMatch(/hash-secreto|ana@exemplo\.com/);
  });

  it('formata o horário como HH:MM e mantém os campos do seed', async () => {
    const g = await bySlug('correria-do-carmo');
    expect(g).toMatchObject({
      name: 'Correria do Carmo',
      zone: 'leste',
      start_time: '06:30',
      days: ['sab'],
      pace_min_s: 330,
      pace_max_s: 390,
      level: 'intermediario',
      participants: 48,
      is_demo: true,
      owner_name: null,
      contact: null,
    });
    expect((await bySlug('pace-da-oca')).map_pin).toEqual([200, 246]);
  });

  it('ordena por zona (ZONA_ORDEM), nome e slug', async () => {
    const groups = await listPublished();
    expect(groups.map((g) => g.slug)).toEqual(REPO_ORDER);
  });

  it('soma as participações ao base_participants', async () => {
    const ana = await createUser('Ana');
    const bia = await createUser('Bia');
    const { rows } = await pool.query("SELECT id FROM groups WHERE slug = 'pace-da-oca'");
    await pool.query('INSERT INTO memberships (user_id, group_id, nickname) VALUES ($1, $2, $3)', [
      ana,
      rows[0].id,
      'Ana',
    ]);
    expect((await bySlug('pace-da-oca')).participants).toBe(57);

    await pool.query('INSERT INTO memberships (user_id, group_id, nickname) VALUES ($1, $2, $3)', [
      bia,
      rows[0].id,
      'Bia',
    ]);
    expect((await bySlug('pace-da-oca')).participants).toBe(58);
    expect((await bySlug('correria-do-carmo')).participants).toBe(48);
  });

  it.each(['pending', 'rejected'])('deixa de fora grupos com status %s', async (status) => {
    await pool.query("UPDATE groups SET status = $1 WHERE slug = 'pelotao-paulista'", [status]);
    const slugs = (await listPublished()).map((g) => g.slug);
    expect(slugs).toHaveLength(10);
    expect(slugs).not.toContain('pelotao-paulista');
  });

  it('preenche owner_name pelo join com users e deixa null sem dono', async () => {
    const ana = await createUser('Ana');
    await pool.query("UPDATE groups SET owner_id = $1 WHERE slug = 'raia-usp'", [ana]);
    expect((await bySlug('raia-usp')).owner_name).toBe('Ana');
    expect((await bySlug('cantareira-trail')).owner_name).toBeNull();
  });

  it('devolve lista vazia quando não há grupos publicados', async () => {
    await pool.query("UPDATE groups SET status = 'pending'");
    expect(await listPublished()).toEqual([]);
  });
});

const LESTE_E_SUL = [
  'correria-do-carmo',
  'tiete-em-movimento',
  'pace-da-oca',
  'primeiro-km-ibira',
  'represa-run-club',
];

// Tabela "Resultados esperados" da spec 005, com a query como o Express 5 a entrega.
const SEARCH_CASES = [
  ['(nenhum)', {}, REPO_ORDER],
  ['zona=sul', { zona: 'sul' }, ['pace-da-oca', 'primeiro-km-ibira', 'represa-run-club']],
  ['zona=leste&zona=sul', { zona: ['leste', 'sul'] }, LESTE_E_SUL],
  ['zona=sul&zona=leste', { zona: ['sul', 'leste'] }, LESTE_E_SUL],
  ['nome=pace', { nome: 'pace' }, ['juventude-em-pace', 'pace-da-oca']],
  ['nome=PACE', { nome: 'PACE' }, ['juventude-em-pace', 'pace-da-oca']],
  ['nome=%20pace%20', { nome: ' pace ' }, ['juventude-em-pace', 'pace-da-oca']],
  ['nome=pelotão', { nome: 'pelotão' }, ['pelotao-paulista']],
  ['nome=%25', { nome: '%' }, []],
  ['nome=_', { nome: '_' }, []],
  ['nome=%5C', { nome: '\\' }, []],
  ['local=ibirapuera', { local: 'ibirapuera' }, ['pace-da-oca', 'primeiro-km-ibira']],
  ['dia=sab', { dia: 'sab' }, ['raia-usp', 'correria-do-carmo', 'primeiro-km-ibira']],
  [
    'periodo=cedo',
    { periodo: 'cedo' },
    ['villa-lobos-runners', 'correria-do-carmo', 'pace-da-oca'],
  ],
  [
    'periodo=manha',
    { periodo: 'manha' },
    ['cantareira-trail', 'raia-usp', 'pelotao-paulista', 'primeiro-km-ibira', 'represa-run-club'],
  ],
  ['periodo=tarde', { periodo: 'tarde' }, []],
  [
    'periodo=noite',
    { periodo: 'noite' },
    ['juventude-em-pace', 'minhocao-noturno', 'tiete-em-movimento'],
  ],
  ['pace=ate5', { pace: 'ate5' }, ['raia-usp', 'pelotao-paulista', 'pace-da-oca']],
  [
    'pace=5a6',
    { pace: '5a6' },
    [
      'villa-lobos-runners',
      'minhocao-noturno',
      'pelotao-paulista',
      'correria-do-carmo',
      'represa-run-club',
    ],
  ],
  [
    'pace=6a7',
    { pace: '6a7' },
    [
      'cantareira-trail',
      'juventude-em-pace',
      'correria-do-carmo',
      'tiete-em-movimento',
      'represa-run-club',
    ],
  ],
  [
    'pace=mais7',
    { pace: 'mais7' },
    ['cantareira-trail', 'tiete-em-movimento', 'primeiro-km-ibira'],
  ],
  [
    'nivel=iniciante',
    { nivel: 'iniciante' },
    ['juventude-em-pace', 'tiete-em-movimento', 'primeiro-km-ibira'],
  ],
  ['zona=sul&nivel=avancado', { zona: 'sul', nivel: 'avancado' }, ['pace-da-oca']],
  [
    'zona=marte&dia=xyz&pace=constructor&nivel=__proto__',
    { zona: 'marte', dia: 'xyz', pace: 'constructor', nivel: '__proto__' },
    REPO_ORDER,
  ],
];

describe('groupsRepo.listPublished com filtros', () => {
  it.each(SEARCH_CASES)('%s', async (_label, query, expected) => {
    const groups = await listPublished(parseFilters(query));
    expect(groups.map((g) => g.slug)).toEqual(expected);
  });

  it('pace exige cruzar a faixa: encostar na borda não basta', async () => {
    const slugsOf = async (pace) =>
      (await listPublished(parseFilters({ pace }))).map((g) => g.slug);
    expect(await slugsOf('ate5')).not.toContain('minhocao-noturno');
    expect(await slugsOf('6a7')).not.toContain('minhocao-noturno');
    expect(await slugsOf('6a7')).not.toContain('primeiro-km-ibira');
    expect(await slugsOf('mais7')).not.toContain('juventude-em-pace');
  });

  it('combina filtros com E e continua ignorando grupos não publicados', async () => {
    await pool.query("UPDATE groups SET status = 'pending' WHERE slug = 'primeiro-km-ibira'");
    const groups = await listPublished(parseFilters({ zona: 'sul', local: 'ibirapuera' }));
    expect(groups.map((g) => g.slug)).toEqual(['pace-da-oca']);
  });

  it('trata %, _ e \\ do termo como literais', async () => {
    await pool.query("UPDATE groups SET name = $1 WHERE slug = 'pace-da-oca'", [
      'Pace 100% _Oca\\',
    ]);
    for (const nome of ['100%', '% _', '_Oca', 'Oca\\']) {
      const groups = await listPublished(parseFilters({ nome }));
      expect(groups.map((g) => g.slug)).toEqual(['pace-da-oca']);
    }
  });

  it('não depende de parseFilters para chaves perigosas de pace e período', async () => {
    const filters = { ...parseFilters({}), pace: 'constructor', periodo: '__proto__' };
    expect(await listPublished(filters)).toHaveLength(11);
  });

  it('envia todo valor de filtro como parâmetro, nunca no texto do SQL', async () => {
    const spy = vi.spyOn(pool, 'query');
    try {
      await listPublished(
        parseFilters({
          zona: 'sul',
          nome: "x' OR 1=1 --",
          local: 'ibirapuera',
          dia: 'sab',
          periodo: 'manha',
          pace: 'mais7',
          nivel: 'iniciante',
        }),
      );
      const [sql, params] = spy.mock.calls[0];
      for (const value of [
        "x' OR 1=1",
        'ibirapuera',
        'sab',
        '07:00',
        '12:00',
        '420',
        '9999',
        'iniciante',
      ]) {
        expect(sql).not.toContain(value);
      }
      expect(sql).not.toMatch(/'sul'/);
      expect(params).toEqual([
        expect.any(Array),
        ['sul'],
        "%x' OR 1=1 --%",
        '%ibirapuera%',
        'sab',
        '07:00',
        '12:00',
        9999,
        420,
        'iniciante',
      ]);
    } finally {
      spy.mockRestore();
    }
  });
});

describe('groupsRepo.findPublishedBySlug', () => {
  it('devolve o grupo com as mesmas chaves do contrato Group', async () => {
    const g = await findPublishedBySlug('pace-da-oca');
    expect(Object.keys(g).sort()).toEqual([...GROUP_KEYS].sort());
    expect(g).toEqual(await bySlug('pace-da-oca'));
    expect(g).toMatchObject({
      name: 'Pace da Oca',
      start_time: '06:00',
      days: ['seg', 'qua', 'sex'],
      participants: 56,
      distance: '10 a 14 km',
    });
  });

  it('soma as participações como listPublished', async () => {
    await insertMembership(pool, await createUser('Ana'), 'pace-da-oca', 'Ana');
    expect((await findPublishedBySlug('pace-da-oca')).participants).toBe(57);
  });

  it.each(['pending', 'rejected'])('devolve null para grupo com status %s', async (status) => {
    await pool.query("UPDATE groups SET status = $1 WHERE slug = 'pace-da-oca'", [status]);
    expect(await findPublishedBySlug('pace-da-oca')).toBeNull();
  });

  it('devolve null para slug inexistente', async () => {
    expect(await findPublishedBySlug('nao-existe')).toBeNull();
  });

  it('envia o slug como parâmetro, nunca no texto do SQL', async () => {
    const spy = vi.spyOn(pool, 'query');
    try {
      await findPublishedBySlug("x' OR 1=1 --");
      const [sql, params] = spy.mock.calls[0];
      expect(sql).not.toContain("x' OR 1=1");
      expect(params).toEqual(["x' OR 1=1 --"]);
    } finally {
      spy.mockRestore();
    }
  });
});
