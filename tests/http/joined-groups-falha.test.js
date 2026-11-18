import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { pool } from '../../src/db/pool.js';
import { createTestApp, signedUp } from '../helpers/auth.js';
import { migrateTestDb, seedDemo } from '../helpers/db.js';

// Banco cai depois do currentUser: só a consulta do badge (listJoinedSlugs) falha.
const falha = vi.hoisted(() => ({ on: false }));
vi.mock('../../src/modules/memberships/memberships.repo.js', async (importOriginal) => {
  const real = await importOriginal();
  return {
    ...real,
    listJoinedSlugs: async (userId) => {
      if (falha.on) throw new Error('connect ECONNREFUSED 127.0.0.1:5432');
      return real.listJoinedSlugs(userId);
    },
  };
});

const app = createTestApp();

beforeAll(async () => {
  await migrateTestDb(pool);
  await seedDemo(pool);
});
afterAll(() => pool.end());

describe('falha ao carregar os grupos do usuário logado', () => {
  it('responde a página 500 completa, sem vazar o erro', async () => {
    const agent = await signedUp(app, 'Ana Souza', 'falha-badge@exemplo.com');
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    falha.on = true;
    try {
      const res = await agent.get('/grupos');
      expect(res.status).toBe(500);
      expect(res.headers['content-type']).toMatch(/text\/html/);
      expect(res.text).toContain('Algo deu errado');
      expect(res.text).not.toMatch(/ECONNREFUSED|5432/);
    } finally {
      falha.on = false;
      spy.mockRestore();
    }
  });
});
