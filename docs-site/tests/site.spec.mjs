// The docs site, built and served under /bitmark-editor/ (PLAN-027).
import { expect, test } from '@playwright/test';

const ORIGIN = 'http://localhost:4631';
const BASE = '/bitmark-editor/';

/** A pane's editor text, by its position in the page's first session. */
const paneText = (page, type) =>
  page.evaluate(
    (t) => document.querySelector(`bitmark-pane[type="${t}"]`)?.pane?.textEditor.getValue() ?? '',
    type,
  );

/** Whether a pane's Monaco editor has sticky scroll on (Monaco's default). */
const stickyScroll = (page, type) =>
  page.evaluate(
    (t) =>
      document.querySelector(`bitmark-pane[type="${t}"]`)?.pane?.textEditor.editor.getRawOptions()
        .stickyScroll?.enabled ?? true,
    type,
  );

const collectErrors = (page) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  return errors;
};

test('every internal link, script, stylesheet and image resolves', async ({ request }) => {
  const pages = new Set([BASE]);
  const queue = [BASE];
  const assets = new Set();
  const broken = [];
  while (queue.length) {
    const url = queue.shift();
    const res = await request.get(ORIGIN + url);
    if (res.status() !== 200) {
      broken.push(`${url} → ${res.status()}`);
      continue;
    }
    if (!(res.headers()['content-type'] ?? '').startsWith('text/html')) continue;
    // The API reference is typedoc's own: check its entry page, not its tree.
    if (url.startsWith(`${BASE}api/`)) continue;
    const html = await res.text();
    for (const [, attr, raw] of html.matchAll(/\s(href|src)="([^"]+)"/g)) {
      if (/^(https?:|mailto:|#|data:)/.test(raw)) continue;
      const target = new URL(raw, ORIGIN + url);
      if (target.origin !== ORIGIN) continue;
      const path = target.pathname;
      if (!path.startsWith(BASE)) {
        broken.push(`${url}: ${raw} is outside ${BASE}`);
        continue;
      }
      const isPage = attr === 'href' && (path.endsWith('/') || path.endsWith('.html'));
      if (isPage && !pages.has(path)) {
        pages.add(path);
        queue.push(path);
      } else if (!isPage) {
        assets.add(path);
      }
    }
  }
  for (const path of assets) {
    const res = await request.get(ORIGIN + path);
    if (res.status() !== 200) broken.push(`${path} → ${res.status()}`);
  }
  expect(broken).toEqual([]);
  expect(pages.size).toBeGreaterThan(15);
});

test('home: the live editor converts, under the sub-path', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('');
  await expect(page.locator('bitmark-session')).toHaveAttribute('data-state', 'ready', {
    timeout: 30_000,
  });
  await expect(page.locator('.bm-tok-bitType').first()).toBeVisible();
  await expect.poll(() => paneText(page, 'json')).toContain('"type": "cloze"');
  expect(await stickyScroll(page, 'json')).toBe(false);
  expect(errors).toEqual([]);
});

test('try it: the full editor completes, converts and shows the other views', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('demos/try-it/');
  const bitmark = page.locator('bitmark-pane[type="bitmark"] .monaco-editor').first();
  await expect(bitmark).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('.bm-tok-bitType').first()).toBeVisible({ timeout: 30_000 });
  await bitmark.click();
  await page.keyboard.press('Control+End');
  await page.keyboard.type('\n\n[.');
  await expect(page.locator('.suggest-widget.visible').first()).toBeVisible({ timeout: 10_000 });
  await page.keyboard.press('Escape');
  // The HTML view, once the full parser is in.
  await page.getByRole('tab', { name: 'html' }).click();
  await expect.poll(() => paneText(page, 'html'), { timeout: 30_000 }).toContain('<bitmark-bit');
  expect(await stickyScroll(page, 'html')).toBe(false);
  expect(await stickyScroll(page, 'bitmark')).toBe(true);
  // Monaco creates some editor features only once the page is idle: give
  // them time, so a missing service shows up here, not on a reader's page.
  await page.waitForTimeout(3000);
  expect(errors).toEqual([]);
});

test('injected parser: the page’s parser, then its full variant', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('demos/injected-parser/');
  await expect(page.locator('#injected-status')).toHaveText('ready: bitmark-json', {
    timeout: 30_000,
  });
  await expect(page.locator('bitmark-pane[type="html"]')).toContainText(
    'needs the full bitmark parser',
  );
  await page.locator('#load-full').click();
  await expect(page.locator('#injected-status')).toHaveText('ready: full', { timeout: 30_000 });
  await expect.poll(() => paneText(page, 'html'), { timeout: 10_000 }).toContain('Injected parser');
  expect(await stickyScroll(page, 'html')).toBe(false);
  expect(errors).toEqual([]);
});

test('search finds a guide', async ({ page }) => {
  await page.goto('');
  await page.locator('pagefind-modal-trigger').click();
  await page.keyboard.type('applyMonacoTheme');
  const result = page.locator('pagefind-modal a[href*="/guides/theming/"]').first();
  await expect(result).toBeVisible({ timeout: 10_000 });
});

test('the theme toggle cycles, is remembered, and the demos and Monaco follow', async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('');
  await expect(page.locator('bitmark-session')).toHaveAttribute('data-state', 'ready', {
    timeout: 30_000,
  });
  const toggle = page.locator('[data-theme-toggle]');
  const html = page.locator('html');
  await expect(toggle).toHaveAttribute('data-state', 'system');
  await toggle.click();
  await expect(html).toHaveAttribute('data-theme', 'light');
  await toggle.click();
  await expect(html).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('bitmark-session')).toHaveAttribute('theme', 'dark');
  await expect(page.locator('.monaco-editor').first()).toHaveClass(/\bvs-dark\b/);
  await page.reload();
  await expect(html).toHaveAttribute('data-theme', 'dark');
  await toggle.click();
  await expect(html).not.toHaveAttribute('data-theme', /./);
  await expect(page.locator('bitmark-session')).toHaveAttribute('theme', 'auto');
});
