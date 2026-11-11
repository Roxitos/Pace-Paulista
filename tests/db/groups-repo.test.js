import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { pool } from '../../src/db/pool.js';
import { listPublished } from '../../src/modules/groups/groups.repo.js';
import { insertUser, migrateTestDb, seedDemo } from '../helpers/db.js';

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
