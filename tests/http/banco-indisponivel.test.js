import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/app.js';

// Simula o Postgres fora do ar sem depender do banco: o repo rejeita como o pg rejeitaria.
vi.mock('../../src/modules/groups/groups.repo.js', () => {
  const down = vi.fn(async () => {
    throw new Error(
      'connect ECONNREFUSED 127.0.0.1:5432 postgres://pace:pace@localhost:5432/pace_paulista',
    );
  });
  return { listPublished: down, listPublishedByCreation: down };
});

const app = createApp();

afterEach(() => {
  vi.restoreAllMocks();
});

describe('banco indisponível', () => {
  it.each(['/', '/zonas', '/encontrar?zona=sul&pace=5%3A00&dias=seg&nivel=avancado'])(
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

describe('banco indisponível: o que não depende dele continua no ar', () => {
  it.each([
    ['/encontrar', 200],
    ['/encontrar?pace=&periodo=', 422],
  ])('GET %s responde %i sem o banco', async (path, status) => {
    const res = await request(app).get(path);
    expect(res.status).toBe(status);
    expect(res.text).toContain('<title>Encontrar meu grupo · Pace Paulista</title>');
    expect(res.text).toContain('id="matchForm"');
  });
});
