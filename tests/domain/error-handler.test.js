import { describe, expect, it, vi } from 'vitest';
import { errorHandler } from '../../src/middlewares/errorHandler.js';

describe('errorHandler com erro do Postgres', () => {
  it('não loga e-mail do detail nem a message', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const err = {
      code: '23505',
      constraint: 'users_email_key',
      table: 'users',
      detail: 'Key (email)=(a@b.com) already exists.',
      message: 'duplicate key (a@b.com)',
    };
    const res = {
      headersSent: false,
      status: vi.fn().mockReturnThis(),
      renderPage: vi.fn(),
    };
    await errorHandler(err, { get: () => undefined }, res, vi.fn());
    const logged = JSON.stringify(spy.mock.calls);
    expect(logged).not.toContain('a@b.com');
    expect(logged).toContain('users_email_key');
    spy.mockRestore();
  });
});
