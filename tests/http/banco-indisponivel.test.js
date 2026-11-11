import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/app.js';

// Simula o Postgres fora do ar sem depender do banco: o repo rejeita como o pg rejeitaria.
vi.mock('../../src/modules/groups/groups.repo.js', () => ({
  listPublished: vi.fn(async () => {
    throw new Error(
      'connect ECONNREFUSED 127.0.0.1:5432 postgres://pace:pace@localhost:5432/pace_paulista',
    );
  }),
}));

const app = createApp();

afterEach(() => {
  vi.restoreAllMocks();
});

describe('banco indisponível', () => {
  it.each(['/', '/zonas'])(
    'GET %s responde 500 com "Algo deu errado", sem vazar o erro',
    async (path) => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const res = await request(app).get(path);
      expect(res.status).toBe(500);
      expect(res.headers['content-type']).toMatch(/text\/html/);
      expect(res.text).toContain('<title>Erro · Pace Paulista</title>');
      expect(res.text).toContain('Algo deu errado');
      expect(res.text).not.toMatch(/ECONNREFUSED|postgres:\/\/|pace_paulista|5432/);
      expect(res.text).not.toMatch(/at .*\.js:\d+/);
      expect(spy).toHaveBeenCalled();
    },
  );
});
