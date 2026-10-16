import { defineConfig } from 'vitest/config';

/** Security-rules tests. Run via `npm run test:rules`, which starts the Firestore emulator. */
export default defineConfig({
  test: {
    include: ['test/rules/**/*.test.ts'],
    fileParallelism: false,
    testTimeout: 20000,
    hookTimeout: 30000,
  },
});
