// Each example app (the project name): it loads, the editor is ready and
// highlighted, and a typed edit reaches the session and the JSON pane.
import { expect, test } from '@playwright/test';

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
  // Reset sets the document from the app: the panes follow.
  await page.getByRole('button', { name: 'Reset' }).click();
  await expect(pane(page, 1)).not.toContainText('Typed in the example', { timeout: 10_000 });
  await expect(pane(page, 2)).not.toContainText('Typed in the example');
  await expect(pane(page, 1)).toContainText('Hello **World**!');
  expect(errors).toEqual([]);
});
