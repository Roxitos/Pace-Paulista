import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
    env: { NODE_ENV: 'test' },
    // Os testes de banco compartilham um único banco de teste e fazem TRUNCATE.
    fileParallelism: false,
  },
});
