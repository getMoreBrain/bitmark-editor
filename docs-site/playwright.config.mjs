// The docs site's smoke tests (PLAN-027), on the production build served
// under /bitmark-editor/ as on GitHub Pages. Build it first: npm run build:site.
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  outputDir: './test-results',
  timeout: 60_000,
  workers: 1,
  reporter: [['list']],
  // The demos load the parser from the live jsDelivr CDN: one retry in CI
  // absorbs a slow fetch; a real failure still fails twice.
  retries: process.env.CI ? 1 : 0,
  use: {
    browserName: 'chromium',
    headless: true,
    baseURL: 'http://localhost:4631/bitmark-editor/',
  },
  webServer: {
    command: 'node serve.mjs 4631',
    url: 'http://localhost:4631/bitmark-editor/',
    reuseExistingServer: false,
  },
});
