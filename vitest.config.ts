import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts', 'tests/integration/**/*.test.ts', 'tests/api/**/*.test.ts'],
    setupFiles: ['tests/setup.ts'],
    testTimeout: 45_000,
    hookTimeout: 45_000,
    pool: 'forks',
    fileParallelism: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});

