import { expect, test, type Locator } from '@playwright/test';
import { strings } from '../src/strings/en';
import { newAccount } from './support/account';

// Phones: the on-screen keyboard shrinks the visual viewport, not the page, so a bottom sheet
// must rise above it (owner report, 2026-10-10). Playwright can't open a real keyboard, so the
// visual viewport is simulated: what a keyboard does to it is shrink its height.
type KeyboardWindow = Window & { setKeyboard: (height: number) => void };

const KEYBOARD = 320;

async function bottomOf(locator: Locator): Promise<number> {
  const box = await locator.boundingBox();
  return box ? Math.round(box.y + box.height) : Number.NaN;
}

test('bottom sheets rise above the on-screen keyboard and drop back when it closes', async ({ page, isMobile }, testInfo) => {
  test.skip(!isMobile, 'Phones only: wide screens use a centered dialog.');
  await page.addInitScript(() => {
    const fake = Object.assign(new EventTarget(), {
      width: window.innerWidth,
      height: window.innerHeight,
      offsetTop: 0,
      offsetLeft: 0,
      pageTop: 0,
      pageLeft: 0,
      scale: 1,
    });
    Object.defineProperty(window, 'visualViewport', { configurable: true, get: () => fake });
    (window as unknown as KeyboardWindow).setKeyboard = (height) => {
      fake.height = window.innerHeight - height;
      fake.dispatchEvent(new Event('resize'));
    };
  });

  await newAccount(page, testInfo, 'INR');
  await page.getByRole('button', { name: strings.nav.addLong }).first().click();
  const dialog = page.getByRole('dialog', { name: strings.form.addTitle });
  await expect(dialog).toBeVisible();
  const screenHeight = page.viewportSize()!.height;

  // Keyboard up: the sheet ends above it, still fits on screen, and the amount field is visible.
  await page.evaluate((height) => (window as unknown as KeyboardWindow).setKeyboard(height), KEYBOARD);
  await expect.poll(() => bottomOf(dialog)).toBeLessThanOrEqual(screenHeight - KEYBOARD + 1);
  expect((await dialog.boundingBox())!.y).toBeGreaterThanOrEqual(0);
  await expect.poll(() => bottomOf(dialog.getByLabel(strings.form.amount, { exact: true }))).toBeLessThanOrEqual(screenHeight - KEYBOARD);

  // Keyboard down: back at the bottom of the screen.
  await page.evaluate(() => (window as unknown as KeyboardWindow).setKeyboard(0));
  await expect.poll(() => bottomOf(dialog)).toBeGreaterThanOrEqual(screenHeight - 1);
});
