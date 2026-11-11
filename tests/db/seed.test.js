import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { DEMO_GROUPS } from '../../db/seeds/demo-groups.js';
import { runSeed } from '../../scripts/seed.js';
import { pool } from '../../src/db/pool.js';
import { migrateTestDb, truncateAll } from '../helpers/db.js';

beforeAll(async () => {
  await migrateTestDb(pool);
});

beforeEach(async () => {
  await truncateAll(pool);
});

afterAll(async () => {
  await pool.end();
});

async function countGroups() {
  const { rows } = await pool.query('SELECT count(*)::int AS n FROM groups');
  return rows[0].n;
}

describe('runSeed', () => {
  it('insere os 11 grupos demo e não insere de novo na 2ª execução', async () => {
    expect(await runSeed({ pool, nodeEnv: 'test' })).toEqual({ inserted: 11, total: 11 });
    expect(await countGroups()).toBe(11);
    expect(await runSeed({ pool, nodeEnv: 'test' })).toEqual({ inserted: 0, total: 11 });
    expect(await countGroups()).toBe(11);
  });

  it('grava os mesmos dados de DEMO_GROUPS, demo, publicados, sem dono e sem contato', async () => {
    await runSeed({ pool, nodeEnv: 'test' });
    const { rows } = await pool.query(
      `SELECT slug, name, zone, location, days, start_time, pace_min_s, pace_max_s, level,
              base_participants, is_demo, status, owner_id, contact
         FROM groups ORDER BY id`,
    );
    expect(rows).toHaveLength(DEMO_GROUPS.length);
    rows.forEach((row, i) => {
      const demo = DEMO_GROUPS[i];
      expect(row).toEqual({
        slug: demo.slug,
        name: demo.name,
        zone: demo.zone,
        location: demo.location,
        days: demo.days,
        start_time: `${demo.start_time}:00`,
        pace_min_s: demo.pace_min_s,
        pace_max_s: demo.pace_max_s,
        level: demo.level,
        base_participants: demo.base_participants,
        is_demo: true,
        status: 'published',
        owner_id: null,
        contact: null,
      });
    });
    expect(rows.find((row) => row.slug === 'correria-do-carmo').start_time).toBe('06:30:00');
  });

  it('mantém literais os textos e o map_pin do pace-da-oca', async () => {
    await runSeed({ pool, nodeEnv: 'test' });
    const demo = DEMO_GROUPS.find((group) => group.slug === 'pace-da-oca');
    const { rows } = await pool.query(
      `SELECT description, meeting_point, profile_tags, distance, map_pin
         FROM groups WHERE slug = $1`,
      ['pace-da-oca'],
    );
    expect(rows[0]).toEqual({
      description: demo.description,
      meeting_point: demo.meeting_point,
      profile_tags: demo.profile_tags,
      distance: demo.distance,
      map_pin: [200, 246],
    });
  });

  it('não sobrescreve um grupo demo já existente que foi alterado', async () => {
    await runSeed({ pool, nodeEnv: 'test' });
    const changed = 'Descrição alterada à mão depois do seed, para testar idempotência.';
    await pool.query('UPDATE groups SET description = $1 WHERE slug = $2', [
      changed,
      'pace-da-oca',
    ]);

    await runSeed({ pool, nodeEnv: 'test' });

    const { rows } = await pool.query('SELECT description FROM groups WHERE slug = $1', [
      'pace-da-oca',
    ]);
    expect(rows[0].description).toBe(changed);
  });
});
