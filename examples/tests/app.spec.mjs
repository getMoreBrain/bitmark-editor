// Each example app (the project name): it loads, the editor is ready and
// highlighted, and a typed edit reaches the session and the JSON pane.
import { expect, test } from '@playwright/test';

/** WCAG contrast ratio of two `rgb(r, g, b)` colours. */
const contrast = (a, b) => {
  const lum = (c) => {
    const [r, g, bl] = c
      .match(/\d+/g)
      .slice(0, 3)
      .map((v) => {
        const x = Number(v) / 255;
        return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
      });
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

/** The first pane's palette and Monaco's theme are both `base`, and a bit type reads well. */
const expectTheme = async (page, base) => {
  const first = page.locator('.panes > :nth-child(1)');
  await expect(first.locator('.bm-pane')).toHaveClass(new RegExp(`bm-theme-${base}`));
  await expect(first.locator('.monaco-editor').first()).toHaveClass(
    base === 'dark' ? /\bvs-dark\b/ : /\bvs\b(?!-)/,
  );
  const [fg, bg] = await first.evaluate((el) => {
    const style = (sel) => el.ownerDocument.defaultView.getComputedStyle(el.querySelector(sel));
    return [style('.bm-tok-bitType').color, style('.monaco-editor-background').backgroundColor];
  });
  expect(contrast(fg, bg), `bit type ${fg} on ${bg}`).toBeGreaterThanOrEqual(3);
};

const pane = (page, n) => page.locator(`.panes > :nth-child(${n}) .monaco-editor`).first();

test('loads, highlights, converts a typed edit, and resets', async ({ page }, testInfo) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

  await page.goto('/');
  // Highlighting comes from the parser's semantic tokens: the parser loaded.
  await expect(page.locator('.panes > :nth-child(1) .bm-tok-bitType').first()).toBeVisible({
    timeout: 30_000,
  });
  await expect(pane(page, 2)).toContainText('"type": "article"');

  const formValue = page.locator('#form-value');
  const before = testInfo.project.name === 'angular' ? await formValue.textContent() : undefined;

  await pane(page, 1).click();
  await page.keyboard.press('Control+End');
  await page.keyboard.type('\n\n[.note]\nTyped in the example');
  await expect(page.locator('#status')).toContainText('from the bitmark pane', { timeout: 10_000 });

  // The JSON pane follows: its end holds the new bit.
  await pane(page, 2).click();
  await page.keyboard.press('Control+End');
  await expect(pane(page, 2)).toContainText('Typed in the example', { timeout: 10_000 });

  if (testInfo.project.name === 'angular') {
    // bm-session is a form control: the FormControl's value follows too.
    await expect(formValue).not.toHaveText(before);
  }
  // No sticky scroll in the generated views: scrolled into the JSON's
  // nested objects, nothing is pinned at the top.
  await pane(page, 2).hover();
  await page.mouse.wheel(0, 400);
  await page.waitForTimeout(500);
  await expect(page.locator('.panes > :nth-child(2) .sticky-line-content')).toHaveCount(0);

  // Themes: the token palette and Monaco's own theme switch together, and
  // tokens stay readable on the editor background.
  const theme = page.getByLabel('Theme');
  await expectTheme(page, 'light'); // Auto, with the OS (emulated) on light
  await page.emulateMedia({ colorScheme: 'dark' });
  await expectTheme(page, 'dark'); // Auto follows the OS live
  await page.emulateMedia({ colorScheme: 'light' });
  await theme.selectOption('dark');
  await expectTheme(page, 'dark');
  await theme.selectOption('light');
  await expectTheme(page, 'light');

  // Reset sets the document from the app: the panes follow.
  await page.getByRole('button', { name: 'Reset' }).click();
  await expect(pane(page, 1)).not.toContainText('Typed in the example', { timeout: 10_000 });
  await expect(pane(page, 2)).not.toContainText('Typed in the example');
  await expect(pane(page, 1)).toContainText('Hello **World**!');
  expect(errors).toEqual([]);
});
