import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/modules/memberships/memberships.repo.js', () => ({
  findPublishedGroupId: vi.fn(),
  insertMembership: vi.fn(),
  deleteMembership: vi.fn(),
}));
const repo = await import('../../src/modules/memberships/memberships.repo.js');
const { joinGroup } = await import('../../src/modules/memberships/memberships.service.js');

afterEach(() => vi.resetAllMocks());

describe('joinGroup', () => {
  it('responde notFound antes de validar o body', async () => {
    repo.findPublishedGroupId.mockResolvedValue(null);
    expect(await joinGroup('x', '1', {})).toEqual({ notFound: true });
  });

  it('com erros de validação não grava', async () => {
    repo.findPublishedGroupId.mockResolvedValue('7');
    const result = await joinGroup('x', '1', { apelido: 'a' });
    expect(result.errors.apelido).toBeDefined();
    expect(repo.insertMembership).not.toHaveBeenCalled();
  });

  it('grava com o apelido trimado', async () => {
    repo.findPublishedGroupId.mockResolvedValue('7');
    expect(await joinGroup('x', '1', { apelido: ' Ana ', ok: 'on' })).toEqual({ joined: true });
    expect(repo.insertMembership).toHaveBeenCalledWith('1', '7', 'Ana');
  });

  // Conta ou grupo apagado entre a leitura e o INSERT: FK 23503 não pode virar 500.
  it('trata violação de FK (23503) na corrida como notFound', async () => {
    repo.findPublishedGroupId.mockResolvedValue('7');
    repo.insertMembership.mockRejectedValue(Object.assign(new Error('fk'), { code: '23503' }));
    expect(await joinGroup('x', '1', { apelido: 'Ana', ok: 'on' })).toEqual({ notFound: true });
  });
});
