import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { pool } from '../../src/db/pool.js';
import { migrateTestDb, truncateAll } from '../helpers/db.js';

const VALID_GROUP = {
  slug: 'pace-da-oca',
  name: 'Pace da Oca',
  zone: 'sul',
  location: 'Parque Ibirapuera',
  days: ['seg', 'qua'],
  start_time: '06:00',
  pace_min_s: 255,
  pace_max_s: 300,
  level: 'avancado',
  description: 'Treinos estruturados para quem já corre provas.',
  contact: '@pacedaoca',
};

// Os nomes de coluna vêm só das chaves fixas deste arquivo; os valores vão parametrizados.
async function insertGroup(overrides = {}, base = VALID_GROUP) {
  const group = { ...base, ...overrides };
  const columns = Object.keys(group);
  const placeholders = columns.map((_, i) => `$${i + 1}`);
  const { rows } = await pool.query(
    `INSERT INTO groups (${columns.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`,
    Object.values(group),
  );
  return rows[0];
}

async function insertUser(email) {
  const { rows } = await pool.query(
    'INSERT INTO users (email, password_hash, display_name) VALUES ($1, $2, $3) RETURNING id',
    [email, 'hash', 'Ana'],
  );
  return rows[0].id;
}

beforeAll(async () => {
  await migrateTestDb(pool);
});

beforeEach(async () => {
  await truncateAll(pool);
});

afterAll(async () => {
  await pool.end();
});

describe('CHECKs de groups', () => {
  it.each([
    ['zona fora da lista', { zone: 'litoral' }],
    ['nível fora da lista', { level: 'elite' }],
    ['days vazio', { days: [] }],
    ['days com dia desconhecido', { days: ['seg', 'feriado'] }],
    ['pace abaixo de 180', { pace_min_s: 179 }],
    ['pace acima de 720', { pace_max_s: 721 }],
    ['pace mínimo igual ao máximo', { pace_min_s: 300, pace_max_s: 300 }],
    ['pace mínimo maior que o máximo', { pace_min_s: 400, pace_max_s: 300 }],
    ['descrição com 29 caracteres', { description: 'a'.repeat(29) }],
    ['descrição com 401 caracteres', { description: 'a'.repeat(401) }],
  ])('recusa %s com 23514', async (_caso, overrides) => {
    await expect(insertGroup(overrides)).rejects.toMatchObject({ code: '23514' });
  });

  it('recusa pace não inteiro pelo tipo (22P02)', async () => {
    await expect(insertGroup({ pace_min_s: '330.5' })).rejects.toMatchObject({ code: '22P02' });
  });

  it('recusa start_time 24:00 pelo CHECK da migration 006', async () => {
    await expect(insertGroup({ start_time: '24:00' })).rejects.toMatchObject({ code: '23514' });
  });

  it('recusa start_time 25:00 pelo tipo', async () => {
    await expect(insertGroup({ start_time: '25:00' })).rejects.toMatchObject({ code: '22008' });
  });

  it('recusa nome repetido com outra caixa (23505)', async () => {
    await insertGroup();
    await expect(insertGroup({ slug: 'outro-slug', name: 'PACE DA OCA' })).rejects.toMatchObject({
      code: '23505',
    });
  });

  it('aceita descrição nos limites de 30 e 400 caracteres', async () => {
    await insertGroup({ description: 'a'.repeat(30) });
    await insertGroup({ slug: 'outro', name: 'Outro Grupo', description: 'a'.repeat(400) });
  });

  it('aceita grupo sem contato (coluna omitida) e grava NULL', async () => {
    const withoutContact = { ...VALID_GROUP };
    delete withoutContact.contact;
    const group = await insertGroup({}, withoutContact);
    expect(group.contact).toBeNull();
  });

  it('aceita grupo com contato NULL explícito', async () => {
    const group = await insertGroup({ contact: null });
    expect(group.contact).toBeNull();
  });
});

describe('exclusão de usuário', () => {
  it('apaga as memberships e deixa owner_id NULL nos grupos dele', async () => {
    const ownerId = await insertUser('dona@exemplo.com');
    const memberId = await insertUser('membro@exemplo.com');
    const group = await insertGroup({ owner_id: ownerId });
    const join = 'INSERT INTO memberships (user_id, group_id, nickname) VALUES ($1, $2, $3)';
    await pool.query(join, [ownerId, group.id, 'Dona']);
    await pool.query(join, [memberId, group.id, 'Membro']);

    await pool.query('DELETE FROM users WHERE id = $1', [ownerId]);

    const memberships = await pool.query('SELECT user_id FROM memberships WHERE group_id = $1', [
      group.id,
    ]);
    expect(memberships.rows.map((row) => row.user_id)).toEqual([memberId]);
    const after = await pool.query('SELECT owner_id FROM groups WHERE id = $1', [group.id]);
    expect(after.rows[0].owner_id).toBeNull();
  });
});
