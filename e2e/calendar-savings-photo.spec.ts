import { expect, test } from '@playwright/test';
import { formatMonth, monthOf, todayLocal } from '../src/domain/dates';
import { strings } from '../src/strings/en';
import { newAccount } from './support/account';
import { addTransaction } from './support/transactions';

// Owner requests, 2026-10-10. Base currency INR, locale en-US; transactions are dated today.
const today = todayLocal();
const thisMonthName = formatMonth(monthOf(today));
const ONE_PIXEL_PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

test('savings and investments: their own tiles and kinds, never counted as spending', async ({ page }, testInfo) => {
  await newAccount(page, testInfo, 'INR');
  await addTransaction(page, { amount: '300', category: 'Food' });
  await addTransaction(page, { kind: 'savings', amount: '5000', category: 'Emergency fund' });
  await addTransaction(page, { kind: 'investment', amount: '10000', category: 'Mutual funds', payee: 'Index fund SIP' });

  // Home: each total in its own tile; the balance is what's left after all of them.
  await expect(page.getByTestId('total-expense')).toHaveText('₹300.00');
  await expect(page.getByTestId('total-savings')).toHaveText('₹5,000.00');
  await expect(page.getByTestId('total-investment')).toHaveText('₹10,000.00');
  await expect(page.getByTestId('balance')).toHaveText('-₹15,300.00');

  // Rows carry a sign and a label, not just a color.
  await page.getByRole('link', { name: strings.nav.transactions }).first().click();
  const investment = page.getByRole('button', { name: /^Edit Index fund SIP/ });
  await expect(investment).toContainText('-₹10,000.00');
  await expect(investment).toContainText(strings.transactions.kindTag.investment);

  // Budgets count spending only.
  await page.getByRole('link', { name: strings.nav.budgets }).first().click();
  await page.getByRole('button', { name: strings.budgets.setOverall }).click();
  const overallDialog = page.getByRole('dialog', { name: strings.budgets.editor.overallTitle });
  await overallDialog.getByLabel(strings.budgets.editor.amount('INR')).fill('1000');
  await overallDialog.getByRole('button', { name: strings.budgets.editor.save }).click();
  await expect(page.getByRole('meter', { name: thisMonthName })).toHaveAttribute(
    'aria-valuetext',
    strings.budgets.meterText(30, '₹300.00', '₹1,000.00'),
  );
});

test('calendar: daily spending, the day\'s transactions, keyboard, and the view in the address', async ({ page }, testInfo) => {
  await newAccount(page, testInfo, 'INR');
  await addTransaction(page, { amount: '300', category: 'Food', payee: 'Corner Cafe' });
  await addTransaction(page, { kind: 'income', amount: '2000', category: 'Salary' });
  await addTransaction(page, { kind: 'savings', amount: '500', category: 'Savings account' });

  await page.getByRole('link', { name: strings.nav.transactions }).first().click();
  await page.locator('label').filter({ hasText: new RegExp(`^${strings.transactions.views.calendar}$`) }).click();
  await expect(page).toHaveURL(/view=calendar/);

  // Today is selected, with its totals in its spoken label (savings aren't spending).
  const todayButton = page.locator(`#day-${today}`);
  await expect(todayButton).toHaveAttribute('aria-pressed', 'true');
  await expect(todayButton).toHaveAccessibleName(/spent ₹300\.00, received ₹2,000\.00, 3 transactions$/);
  await expect(page.getByText(strings.transactions.calendar.monthSpent('₹300.00'))).toBeVisible();

  // The day's transactions, all kinds, below (beside on desktop).
  await expect(page.getByRole('button', { name: /^Edit Corner Cafe/ })).toBeVisible();
  await expect(page.getByText(strings.transactions.kindTag.savings, { exact: true })).toBeVisible();

  // Keyboard: Home moves to the first day of the month.
  await todayButton.focus();
  await page.keyboard.press('Home');
  const first = `${today.slice(0, 8)}01`;
  await expect(page.locator(`#day-${first}`)).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator(`#day-${first}`)).toBeFocused();

  // The view survives a reload.
  await page.reload();
  await expect(page.locator(`#day-${today}`)).toBeVisible();
});

test('profile photo: add in Settings, shown on Home, then removed', async ({ page }, testInfo) => {
  await newAccount(page, testInfo, 'INR');
  const settingsLink = page.getByRole('link', { name: strings.nav.openSettings });
  await expect(settingsLink).toContainText('A'); // initial of the name from setup (Alex)

  await page.goto('/settings');
  await page.locator('input[type="file"]').setInputFiles({ name: 'me.png', mimeType: 'image/png', buffer: ONE_PIXEL_PNG });
  await expect(page.getByText(strings.settings.photo.saved)).toBeVisible();

  await page.goto('/');
  await expect(page.getByRole('link', { name: strings.nav.openSettings }).locator('img')).toHaveAttribute('src', /^data:image\/(webp|jpeg);base64,/);

  await page.goto('/settings');
  await page.getByRole('button', { name: strings.settings.photo.remove }).click();
  await expect(page.getByText(strings.settings.photo.removed)).toBeVisible();
  await expect(page.getByRole('button', { name: strings.settings.photo.add })).toBeVisible();
});
