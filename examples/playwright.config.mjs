// The example apps' smoke tests (PLAN-026), each on its production build.
// Build them first: npm run build:examples at the repo root.
import { defineConfig } from '@playwright/test';

export const APPS = [
  { name: 'vanilla-ts', port: 4701, dist: 'vanilla-ts/dist' },
  { name: 'react', port: 4702, dist: 'react/dist' },
  { name: 'angular', port: 4703, dist: 'angular/dist/angular/browser' },
];

export default defineConfig({
  testDir: './tests',
  outputDir: './test-results',
  timeout: 60_000,
  workers: 1,
  reporter: [['list']],
  // Some checks reach the live jsDelivr CDN (the parser, the schema): one
  // retry in CI absorbs a slow fetch; a real failure still fails twice.
  retries: process.env.CI ? 1 : 0,
  use: { browserName: 'chromium', headless: true },
  projects: APPS.map(({ name, port }) => ({ name, use: { baseURL: `http://localhost:${port}/` } })),
  webServer: APPS.map(({ port, dist }) => ({
    command: `node serve-static.mjs ${dist} ${port}`,
    url: `http://localhost:${port}/`,
    reuseExistingServer: false,
  })),
});
