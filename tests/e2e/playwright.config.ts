import { defineConfig } from '@playwright/test';

// Resolved relative to this file's directory. Spec files live alongside the config.
export default defineConfig({
  testDir: __dirname,
  testMatch: /.*\.spec\.ts$/,
  timeout: 30000,
  // Electron tests don't use a web baseURL; the existing todo-flow.spec.ts
  // pointed at http://localhost:5173 (Vite dev server) which is no longer
  // applicable. Per-spec, we either launch Electron or skip.
  use: {},
  reporter: [['list']],
});