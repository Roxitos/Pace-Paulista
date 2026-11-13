import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/modules/groups/groups.repo.js', () => ({
  nameExists: vi.fn(),
  findSlugsLike: vi.fn(),
  insertGroup: vi.fn(),
}));
const repo = await import('../../src/modules/groups/groups.repo.js');
const { createGroup } = await import('../../src/modules/groups/groups.service.js');

const body = {
  nome: 'Corredores do Sul',
  zona: 'sul',
  local: 'Parque Ibirapuera',
  dias: 'seg',
  horario: '06:30',
  paceMin: '5:30',
  paceMax: '6:30',
  nivel: 'iniciante',
  descricao: 'Treino em grupo com aquecimento e alongamento.',
  contato: '@sul',
  organizador: 'on',
};
const dup = (constraint) => Object.assign(new Error('dup'), { code: '23505', constraint });

afterEach(() => vi.resetAllMocks());

describe('createGroup', () => {
  it('soma "nome já existe" aos demais erros, com nome primeiro', async () => {
    repo.nameExists.mockResolvedValue(true);
    const result = await createGroup({ ...body, zona: '' }, '1');
    expect(Object.keys(result.errors)).toEqual(['nome', 'zona']);
    expect(result.errors.nome).toBe('Já existe um grupo com esse nome.');
    expect(repo.insertGroup).not.toHaveBeenCalled();
  });

  it('insere com o próximo slug livre', async () => {
    repo.nameExists.mockResolvedValue(false);
    repo.findSlugsLike.mockResolvedValue(['corredores-do-sul']);
    repo.insertGroup.mockResolvedValue({ slug: 'corredores-do-sul-2' });
    expect(await createGroup(body, '1')).toEqual({ slug: 'corredores-do-sul-2' });
    expect(repo.insertGroup.mock.calls[0][1]).toBe('1');
    expect(repo.insertGroup.mock.calls[0][2]).toBe('corredores-do-sul-2');
  });

  it('23505 em groups_name_key vira erro no nome', async () => {
    repo.nameExists.mockResolvedValue(false);
    repo.findSlugsLike.mockResolvedValue([]);
    repo.insertGroup.mockRejectedValue(dup('groups_name_key'));
    const result = await createGroup(body, '1');
    expect(result.errors).toEqual({ nome: 'Já existe um grupo com esse nome.' });
  });

  it('refaz o slug quando groups_slug_key colide numa corrida', async () => {
    repo.nameExists.mockResolvedValue(false);
    repo.findSlugsLike.mockResolvedValue([]);
    repo.insertGroup.mockRejectedValueOnce(dup('groups_slug_key'));
    repo.insertGroup.mockResolvedValueOnce({ slug: 'x' });
    expect(await createGroup(body, '1')).toEqual({ slug: 'x' });
  });

  it('desiste depois de 3 colisões de slug', async () => {
    repo.nameExists.mockResolvedValue(false);
    repo.findSlugsLike.mockResolvedValue([]);
    repo.insertGroup.mockRejectedValue(dup('groups_slug_key'));
    await expect(createGroup(body, '1')).rejects.toMatchObject({ code: '23505' });
    expect(repo.insertGroup).toHaveBeenCalledTimes(3);
  });

  it('outro erro sobe', async () => {
    repo.nameExists.mockResolvedValue(false);
    repo.findSlugsLike.mockResolvedValue([]);
    repo.insertGroup.mockRejectedValue(Object.assign(new Error('x'), { code: '23514' }));
    await expect(createGroup(body, '1')).rejects.toMatchObject({ code: '23514' });
  });
});
