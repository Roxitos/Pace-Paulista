import bcrypt from 'bcrypt';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/modules/auth/users.repo.js', () => ({
  findCredentialsByEmail: vi.fn(),
  findById: vi.fn(),
}));
const usersRepo = await import('../../src/modules/auth/users.repo.js');
const { login } = await import('../../src/modules/auth/auth.service.js');

afterEach(() => vi.restoreAllMocks());

describe('login (service)', () => {
  it('senha certa devolve o usuário; errada devolve null', async () => {
    const hash = await bcrypt.hash('segredo!1', 4);
    usersRepo.findCredentialsByEmail.mockResolvedValue({ id: '7', password_hash: hash });
    usersRepo.findById.mockResolvedValue({
      id: '7',
      email: 'a@x.com',
      display_name: 'Ana',
      role: 'user',
    });
    expect((await login({ email: 'a@x.com', password: 'segredo!1' })).user.displayName).toBe('Ana');
    expect(await login({ email: 'a@x.com', password: 'errada!!1' })).toBeNull();
  });

  it('e-mail inexistente ainda chama bcrypt.compare (tempo igual) e devolve null', async () => {
    usersRepo.findCredentialsByEmail.mockResolvedValue(null);
    const spy = vi.spyOn(bcrypt, 'compare');
    expect(await login({ email: 'x@x.com', password: 'qualquer1!' })).toBeNull();
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][1]).toMatch(/^\$2b\$12\$/);
  });

  it('senha com mais de 1024 caracteres é recusada sem bcrypt nem consulta', async () => {
    const spy = vi.spyOn(bcrypt, 'compare');
    usersRepo.findCredentialsByEmail.mockClear();
    expect(await login({ email: 'a@x.com', password: 'a'.repeat(1025) })).toBeNull();
    expect(spy).not.toHaveBeenCalled();
    expect(usersRepo.findCredentialsByEmail).not.toHaveBeenCalled();
  });
});
