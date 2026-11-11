import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['shared/**/*.test.ts', 'backend/src/**/*.test.ts'],
    environment: 'node',
  },
});

