import { expect, test } from '@playwright/test';
import { strings } from '../src/strings/en';
import { newAccount, signUpAndConfirm, uniqueEmail } from './support/account';
import { pickFromList } from './support/select';

test('new user signs up, confirms email, picks a base currency and lands in the app', async ({ page }, testInfo) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/sign-in/);
  await expect(page.getByRole('heading', { name: strings.auth.signIn.title })).toBeVisible();

  await signUpAndConfirm(page, uniqueEmail('signup', testInfo));

  // First run: base currency defaults from the browser locale (en-US -> USD).
  await expect(page.getByRole('combobox', { name: strings.onboarding.currencyLabel })).toContainText('USD');
  await pickFromList(page, strings.onboarding.currencyLabel, /^INR ·/);
  // The name is required.
  await page.getByRole('button', { name: strings.onboarding.submit }).click();
  await expect(page.getByText(strings.onboarding.nameRequired)).toBeVisible();
  await expect(page.getByLabel(strings.onboarding.nameLabel)).toBeFocused();
  await page.getByLabel(strings.onboarding.nameLabel).fill('Sam Rivera');
  await page.getByRole('button', { name: strings.onboarding.submit }).click();

  await expect(page).toHaveURL(/\/$/);
  // A brand-new account is greeted and guided to its first transaction.
  await expect(page.getByRole('heading', { name: strings.home.welcomeTitle })).toBeVisible();
  await expect(page.getByRole('button', { name: strings.home.addFirst })).toBeVisible();
  // ...and the name from setup shows as the initial in the Settings link.
  await expect(page.getByRole('link', { name: strings.nav.openSettings })).toContainText('S');
});

test('responsive shell, add dialog, theme and sign out', async ({ page, isMobile }, testInfo) => {
  await newAccount(page, testInfo);

  // Exactly one navigation is visible: bottom bar on phones, sidebar on desktop.
  const nav = page.getByRole('navigation', { name: strings.nav.label });
  await expect(nav).toHaveCount(1);
  const navBox = (await nav.boundingBox())!;
  const viewport = page.viewportSize()!;
  if (isMobile) {
    expect(navBox.y + navBox.height).toBeGreaterThan(viewport.height - 2);
  } else {
    expect(navBox.x).toBeLessThan(260);
    expect(navBox.height).toBeGreaterThan(200);
  }

  // Add opens as a bottom sheet on phones and a centered dialog on desktop; Escape closes it.
  // "Centered" means over the page's layout area: the page always reserves the scrollbar's width
  // (scrollbar-gutter), and the <html> box excludes it even where scrollbars are hidden.
  const visibleWidth = await page.evaluate(() => document.documentElement.getBoundingClientRect().width);
  await page.getByRole('button', { name: strings.nav.addLong }).first().click();
  const dialog = page.getByRole('dialog', { name: strings.form.addTitle });
  await expect(dialog).toBeVisible();
  await page.waitForTimeout(400); // let the open animation settle before measuring
  const box = (await dialog.boundingBox())!;
  if (isMobile) {
    expect(Math.round(box.y + box.height)).toBeGreaterThanOrEqual(viewport.height - 2);
    expect(box.width).toBeGreaterThan(viewport.width - 2);
  } else {
    const centerX = box.x + box.width / 2;
    expect(Math.abs(centerX - visibleWidth / 2)).toBeLessThan(4);
    expect(box.width).toBeLessThan(600);
  }
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();

  // Navigation works from the shell.
  await nav.getByRole('link', { name: strings.nav.transactions }).click();
  await expect(page.getByRole('heading', { name: strings.pages.transactions.title, level: 1 })).toBeVisible();

  // Settings: from the Home profile icon on phones, from the sidebar on desktop.
  if (isMobile) {
    await nav.getByRole('link', { name: strings.nav.home }).click();
    await page.getByRole('link', { name: strings.nav.openSettings }).click();
  } else {
    await page.getByRole('link', { name: strings.nav.settings }).click();
  }
  await expect(page.getByRole('heading', { name: strings.pages.settings.title, level: 1 })).toBeVisible();

  // Theme changes apply immediately and survive a reload without a flash of the old theme.
  await page.getByText(strings.settings.modes.dark, { exact: true }).click();
  await page.getByRole('radio', { name: strings.settings.accents.teal }).check({ force: true });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('html')).toHaveAttribute('data-accent', 'teal');

  await page.reload({ waitUntil: 'commit' });
  const themeAtFirstPaint = await page.evaluate(() => [
    document.documentElement.dataset.theme,
    document.documentElement.dataset.accent,
  ]);
  expect(themeAtFirstPaint).toEqual(['dark', 'teal']);

  await page.getByRole('button', { name: strings.auth.signOut }).click();
  await expect(page).toHaveURL(/\/sign-in/);
});
