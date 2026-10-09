import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { strings } from '../src/strings/en';
import { newAccount, PASSWORD } from './support/account';
import { latestAuthLink } from './support/mailpit';
import { addTransaction } from './support/transactions';

const s = strings.settings;

test('settings: name, password reset email, privacy policy, delete account', async ({ page }, testInfo) => {
  const email = await newAccount(page, testInfo, 'INR');
  await addTransaction(page, { amount: '250', category: 'Food' });

  await page.goto('/settings');
  await expect(page.getByRole('heading', { name: strings.pages.settings.title, level: 1 })).toBeVisible();
  await expect(page).toHaveTitle(`${strings.pages.settings.title} · ${strings.app.name}`);

  // Name
  await page.getByLabel(s.displayName).fill('Alex');
  await page.getByRole('button', { name: s.saveName }).click();
  await expect(page.getByText(s.nameSaved)).toBeVisible();

  // The base currency is shown with why it can't change.
  await expect(page.getByText(s.baseCurrencyHint)).toBeVisible();

  // Password changes go through Supabase's reset email.
  await page.getByRole('button', { name: s.changePassword }).click();
  await expect(page.getByText(s.passwordEmailSent(email))).toBeVisible();
  expect(await latestAuthLink(email)).toContain('type=recovery');

  // Privacy policy
  await page.getByRole('link', { name: s.privacy }).click();
  await expect(page.getByRole('heading', { name: strings.pages.privacy.title, level: 1 })).toBeVisible();
  await expect(page.getByRole('heading', { name: strings.privacy.sections[0].title, level: 2 })).toBeVisible();
  await page.goBack();

  // Delete account: guarded by typing the confirmation word.
  await page.getByRole('button', { name: s.deleteAccount.button }).click();
  const dialog = page.getByRole('dialog', { name: s.deleteAccount.dialogTitle });
  const confirm = dialog.getByRole('button', { name: s.deleteAccount.confirm });
  await expect(confirm).toBeDisabled();
  await dialog.getByLabel(s.deleteAccount.confirmLabel(s.deleteAccount.confirmWord)).fill('delete');
  await expect(confirm).toBeDisabled();
  await dialog.getByLabel(s.deleteAccount.confirmLabel(s.deleteAccount.confirmWord)).fill(s.deleteAccount.confirmWord);
  await confirm.click();

  await expect(page).toHaveURL(/\/sign-in\?deleted=1/);
  await expect(page.getByText(strings.auth.accountDeleted)).toBeVisible();

  // The account is really gone.
  await page.getByLabel(strings.auth.email).fill(email);
  await page.getByLabel(strings.auth.password).fill(PASSWORD);
  await page.getByRole('button', { name: strings.auth.signIn.submit }).click();
  await expect(page.getByText(strings.errors.byCode['invalid_credentials']!)).toBeVisible();
});

/** WCAG 2.1 A/AA rules; fails on serious or critical issues. */
async function expectNoSeriousViolations(page: Page, label: string) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(
    serious.map((v) => `${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(', ')})`),
    `axe on ${label}`,
  ).toEqual([]);
}

for (const scheme of ['light', 'dark'] as const) {
  test(`accessibility: no serious axe violations on the main screens (${scheme})`, async ({ page }, testInfo) => {
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });

    await page.goto('/sign-in');
    await expect(page.getByRole('heading', { name: strings.auth.signIn.title })).toBeVisible();
    await expectNoSeriousViolations(page, 'sign in');

    // Sign up links the privacy policy, readable before giving an email.
    await page.goto('/sign-up');
    await expect(page.getByRole('link', { name: strings.pages.privacy.title })).toHaveAttribute('href', '/privacy');
    await expectNoSeriousViolations(page, 'sign up');

    await newAccount(page, testInfo, 'INR');
    await addTransaction(page, { amount: '1200', category: 'Food', payee: 'Corner Cafe' });
    await addTransaction(page, { kind: 'income', amount: '50000', category: 'Salary' });

    const screens: Array<[string, string]> = [
      ['/', strings.pages.home.title],
      ['/transactions', strings.pages.transactions.title],
      ['/budgets', strings.pages.budgets.title],
      ['/reports', strings.pages.reports.title],
      ['/ious', strings.pages.ious.title],
      ['/settings', strings.pages.settings.title],
      ['/settings/categories', strings.pages.categories.title],
      ['/settings/recurring', strings.recurring.title],
      ['/privacy', strings.pages.privacy.title],
    ];
    for (const [path, title] of screens) {
      await page.goto(path);
      await expect(page.getByRole('heading', { name: title, level: 1 })).toBeAttached();
      await page.waitForLoadState('networkidle');
      await expectNoSeriousViolations(page, path);
    }

    // The Add dialog (bottom sheet / dialog) with its focus trap.
    await page.goto('/');
    await page.getByRole('button', { name: strings.nav.addLong }).first().click();
    await expect(page.getByRole('dialog', { name: strings.form.addTitle })).toBeVisible();
    await expectNoSeriousViolations(page, 'add dialog');
  });
}
