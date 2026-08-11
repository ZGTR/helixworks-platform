import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: { provider: 'v8' },
    include: ['**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@helixworks/contracts': new URL('./packages/contracts/src/index.ts', import.meta.url)
        .pathname,
      '@helixworks/service-kit': new URL('./packages/service-kit/src/index.ts', import.meta.url)
        .pathname,
    },
  },
});
