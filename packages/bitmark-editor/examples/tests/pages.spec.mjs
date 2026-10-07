// The GitHub Pages site (PLAN-024 Phase 6), as pages/build.mjs builds it and
// served under the /bitmark-editor/ sub-path, as on Pages. The parser comes
// from jsDelivr at the package's pinned version, so this needs the network.
import { expect, test } from '@playwright/test';

const SITE = 'http://localhost:4613/bitmark-editor/';
const paneValue = (page, type) =>
  page.evaluate((t) => document.querySelector(`bitmark-pane[type="${t}"]`).pane?.textEditor.getValue() ?? '', type);

test('the landing page links resolve under the sub-path', async ({ page, request }) => {
  await page.goto(SITE);
  await expect(page.locator('h1')).toHaveText('bitmark editor');
  const hrefs = await page.locator('a[href]').evaluateAll((as) => as.map((a) => a.href).filter((h) => h.startsWith('http://localhost')));
  expect(hrefs.length).toBeGreaterThanOrEqual(3);
  for (const href of hrefs) expect((await request.get(href)).status(), href).toBe(200);
});

test('try it: the bundled editor and the CDN parser work from the sub-path', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`${SITE}try-it.html`);
  await page.waitForFunction(() => window.__example.ready || window.__example.error, null, { timeout: 30_000 });
  expect(await page.evaluate(() => window.__example.error)).toBeUndefined();
  await expect.poll(() => paneValue(page, 'json')).toContain('"type": "cloze"');

  // The workers (same origin, beside bundled.js): completion and the JSON schema.
  await page.locator('bitmark-pane[type="bitmark"] .monaco-editor').first().click();
  await page.keyboard.press('Control+End');
  await page.keyboard.type('\n\n[.');
  await expect(page.locator('.suggest-widget.visible').first()).toBeVisible({ timeout: 10_000 });
  await page.keyboard.press('Escape');
  await page.evaluate(() => document.querySelector('bitmark-pane[type="json"]').pane.textEditor.model.setValue('[{"bit": {"type": 42}}]'));
  await expect
    .poll(() => page.evaluate(() => {
      const m = document.querySelector('bitmark-pane[type="json"]').pane.textEditor.model;
      return window.__bundle.loadBundledMonaco().then((monaco) => monaco.editor.getModelMarkers({ resource: m.uri }).length);
    }), { timeout: 10_000 })
    .toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

test('injected parser: the page loads the CDN parser and hands it over', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`${SITE}inject.html`);
  await page.waitForFunction(() => window.__example.ready, null, { timeout: 30_000 });
  await expect.poll(() => paneValue(page, 'json')).toContain('Injected parser');
  expect(errors).toEqual([]);
});
