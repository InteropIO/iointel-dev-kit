import { defineConfig } from 'vitest/config';

// Opt-in tests against the real agent tools and judge. Need API keys in .env.
export default defineConfig({
  test: {
    include: ['test/contract/**/*.test.ts'],
    testTimeout: 600_000,
    setupFiles: ['dotenv/config'],
  },
});
