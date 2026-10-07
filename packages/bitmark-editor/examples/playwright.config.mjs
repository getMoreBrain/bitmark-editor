import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  outputDir: './tests/results',
  timeout: 60_000,
  workers: 1,
  reporter: [['list']],
  // Some checks reach the live jsDelivr CDN (the parser, the schema): one
  // retry in CI absorbs a slow fetch; a real failure still fails twice.
  retries: process.env.CI ? 1 : 0,
  use: { browserName: 'chromium', headless: true },
  webServer: { command: 'node serve.mjs', url: 'http://localhost:4612/pkg/bundled/bundled.js', reuseExistingServer: true },
});
