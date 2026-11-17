import { describe, expect, it } from 'vitest';
import { demoSeedAllowed, runSeed } from '../../scripts/seed.js';

describe('runSeed em produção', () => {
  it('recusa com a mensagem de bloqueio sem tocar no banco', async () => {
    const calls = [];
    const fakePool = new Proxy(
      {},
      {
        get(_target, prop) {
          calls.push(prop);
          throw new Error(`pool usado: ${String(prop)}`);
        },
      },
    );
    await expect(runSeed({ pool: fakePool, nodeEnv: 'production' })).rejects.toThrow(
      'Seed de demonstração bloqueado em produção (NODE_ENV=production).',
    );
    expect(calls).toEqual([]);
  });

  it('demoSeedAllowed aceita só o texto exato 1', () => {
    expect(demoSeedAllowed('1')).toBe(true);
    for (const value of ['true', 'yes', '', undefined]) expect(demoSeedAllowed(value)).toBe(false);
  });
});
