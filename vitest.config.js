import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
    env: { NODE_ENV: 'test' },
    // Os testes de banco compartilham um único banco de teste e fazem TRUNCATE.
    fileParallelism: false,
    // Postgres em Docker no Windows às vezes leva mais que os 5 s/10 s padrão (migrate, TRUNCATE).
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
