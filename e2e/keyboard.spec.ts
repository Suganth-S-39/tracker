import { expect, test, type Locator } from '@playwright/test';
import { strings } from '../src/strings/en';
import { newAccount } from './support/account';

// Phones: with interactive-widget=resizes-content (index.html), Android's on-screen keyboard
// shrinks the page, so a bottom sheet fixed to the page's bottom sits above it (owner reports,
// 2026-10-10). Playwright can't open a real keyboard; shrinking the viewport is what the keyboard
// does to the page under this setting.
const KEYBOARD = 320;

async function bottomOf(locator: Locator): Promise<number> {
  const box = await locator.boundingBox();
  return box ? Math.round(box.y + box.height) : Number.NaN;
}

test('phones: sheets sit above the keyboard; the bottom bar steps aside while typing', async ({ page, isMobile }, testInfo) => {
  test.skip(!isMobile, 'Phones only: wide screens use a centered dialog and have no on-screen keyboard.');
  await newAccount(page, testInfo, 'INR');
  const screen = page.viewportSize()!;
  const nav = page.getByRole('navigation', { name: strings.nav.label });

  // Opening a sheet doesn't pop the keyboard up: the dialog itself has focus.
  await page.getByRole('button', { name: strings.nav.addLong }).first().click();
  const dialog = page.getByRole('dialog', { name: strings.form.addTitle });
  await expect(dialog).toBeFocused();

  // Tapping the amount field brings the keyboard up: the page shrinks, and the sheet stays above it.
  const amount = dialog.getByLabel(strings.form.amount, { exact: true });
  await amount.click();
  await page.setViewportSize({ width: screen.width, height: screen.height - KEYBOARD });
  await expect.poll(() => bottomOf(dialog)).toBeLessThanOrEqual(screen.height - KEYBOARD);
  expect((await dialog.boundingBox())!.y).toBeGreaterThanOrEqual(0);
  expect(await bottomOf(amount)).toBeLessThanOrEqual(screen.height - KEYBOARD);

  // Keyboard down: back at the bottom of the screen.
  await page.setViewportSize(screen);
  await expect.poll(() => bottomOf(dialog)).toBeGreaterThanOrEqual(screen.height - 1);
  await page.keyboard.press('Escape');

  // Typing in the page (search) hides the bottom bar; leaving the field brings it back.
  await page.getByRole('link', { name: strings.nav.transactions }).first().click();
  await expect(nav).toBeVisible();
  await page.getByRole('searchbox', { name: strings.transactions.searchLabel }).click();
  await expect(nav).toBeHidden();
  await page.getByRole('heading', { name: strings.pages.transactions.title, level: 1 }).click();
  await expect(nav).toBeVisible();
});
