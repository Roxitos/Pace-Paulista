import { afterEach, describe, expect, it, vi } from 'vitest';
import { gracefulShutdown } from '../../src/lifecycle.js';

afterEach(() => vi.useRealTimers());

function setup({ closes = true } = {}) {
  const calls = [];
  const server = {
    close: vi.fn((callback) => {
      calls.push('close');
      if (closes) callback();
    }),
  };
  const pool = {
    end: vi.fn(async () => {
      calls.push('pool.end');
    }),
  };
  const exit = vi.fn((code) => calls.push(`exit(${code})`));
  const log = vi.fn();
  const handler = gracefulShutdown({ server, pool, exit, log, timeoutMs: 1000 });
  return { calls, server, pool, exit, log, handler };
}

describe('gracefulShutdown', () => {
  it('fecha o servidor, depois o pool, e sai com 0', async () => {
    const { calls, log, handler } = setup();
    await handler();
    expect(log).toHaveBeenCalledWith('Encerrando: aguardando requisições em andamento.');
    expect(calls).toEqual(['close', 'pool.end', 'exit(0)']);
  });

  it('sai com 1 se o servidor não fechar dentro do prazo', async () => {
    vi.useFakeTimers();
    const { exit, pool, handler } = setup({ closes: false });
    handler();
    await vi.advanceTimersByTimeAsync(1000);
    expect(exit).toHaveBeenCalledWith(1);
    expect(pool.end).not.toHaveBeenCalled();
  });

  it('sai com 1, sem rejeição solta, se o pool.end falhar', async () => {
    const { pool, exit, log, handler } = setup();
    pool.end.mockRejectedValueOnce(new Error('Connection terminated unexpectedly'));
    await expect(handler()).resolves.toBeUndefined();
    expect(exit).toHaveBeenCalledWith(1);
    expect(exit).not.toHaveBeenCalledWith(0);
    expect(log).toHaveBeenCalledWith(
      'Erro ao fechar o pool do Postgres: Connection terminated unexpectedly',
    );
  });

  it('ignora a segunda chamada', async () => {
    const { server, pool, exit, handler } = setup();
    await handler();
    await handler();
    expect(server.close).toHaveBeenCalledTimes(1);
    expect(pool.end).toHaveBeenCalledTimes(1);
    expect(exit).toHaveBeenCalledTimes(1);
  });
});
