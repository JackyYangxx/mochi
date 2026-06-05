import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    exclude: ['tests/e2e/**', 'node_modules/**'],
    setupFiles: [],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/preload/**', 'src/main/**', 'src/renderer/**', 'dist/**', '**/*.d.ts'],
    },
  },
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, 'src/shared'),
      // Test-only shim: better-sqlite3@9.6.0 has no prebuilt for Node 24 and
      // cannot be built from source. Node 24 ships node:sqlite with a compatible
      // API for the surface used by our tests.
      'better-sqlite3': path.resolve(__dirname, 'tests/helpers/better-sqlite3-shim.mjs'),
    },
  },
});