import { describe, expect, it } from 'vitest';
import { sessionCookieOptions } from '../../src/middlewares/session.js';

// O resto da configuração do cookie (httpOnly, lax, 30 dias) é provado em tests/http/sessao.test.js.
describe('cookie de sessão em produção', () => {
  it('é secure só em produção', () => {
    expect(sessionCookieOptions({ NODE_ENV: 'production' }).secure).toBe(true);
    expect(sessionCookieOptions({ NODE_ENV: 'development' }).secure).toBe(false);
  });
});
