import { expect, test } from '@playwright/test';
import { addMonths, formatMonth, formatMonthShort, monthOf, todayLocal } from '../src/domain/dates';
import { strings } from '../src/strings/en';
import { newAccount } from './support/account';
import { addTransaction } from './support/transactions';

// Base currency INR, locale en-US. Transactions are dated today, so "this month" is today's month.
const thisMonth = monthOf(todayLocal());
const thisMonthName = formatMonth(thisMonth);

test('budgets: set, warn at 80% and 100%, carry forward, show on Home', async ({ page }, testInfo) => {
  await newAccount(page, testInfo, 'INR');
  await addTransaction(page, { amount: '850', category: 'Food' });
  await addTransaction(page, { amount: '2000', category: 'Rent' });

  await page.getByRole('link', { name: strings.nav.budgets }).first().click();
  await expect(page.getByRole('heading', { name: strings.pages.budgets.title, level: 1 })).toBeVisible();
  await expect(page.getByText(strings.budgets.emptyTitle(thisMonthName))).toBeVisible();

  // Overall monthly budget.
  await page.getByRole('button', { name: strings.budgets.setOverall }).click();
  const overallDialog = page.getByRole('dialog', { name: strings.budgets.editor.overallTitle });
  await overallDialog.getByLabel(strings.budgets.editor.amount('INR')).fill('4000');
  await overallDialog.getByRole('button', { name: strings.budgets.editor.save }).click();
  await expect(overallDialog).toBeHidden();
  const overall = page.getByRole('meter', { name: thisMonthName });
  await expect(overall).toHaveAttribute('aria-valuetext', strings.budgets.meterText(71, '₹2,850.00', '₹4,000.00'));
  await expect(page.getByText(strings.budgets.left('₹1,150.00'))).toBeVisible();

  // A category budget that is already at 85%: nearing the limit (icon + label, not just color).
  await page.getByRole('button', { name: strings.budgets.addCategory }).click();
  const categoryDialog = page.getByRole('dialog', { name: strings.budgets.editor.categoryTitle });
  await categoryDialog.getByLabel(strings.budgets.editor.category).selectOption({ label: 'Food' });
  await categoryDialog.getByLabel(strings.budgets.editor.amount('INR')).fill('1000');
  await categoryDialog.getByRole('button', { name: strings.budgets.editor.save }).click();
  await expect(categoryDialog).toBeHidden();
  await expect(page.getByRole('meter', { name: 'Food' })).toHaveAttribute('aria-valuenow', '85');
  await expect(page.getByText(strings.budgets.states.near)).toBeVisible();

  // Spending past 100%: over budget.
  await addTransaction(page, { amount: '200', category: 'Food' });
  await expect(page.getByRole('meter', { name: 'Food' })).toHaveAttribute('aria-valuenow', '100');
  await expect(page.getByText(strings.budgets.states.over)).toBeVisible();
  await expect(page.getByText(strings.budgets.over('₹50.00'))).toBeVisible();

  // Budgets carry into the next month, where nothing is spent yet.
  await page.getByRole('button', { name: strings.month.next }).click();
  const nextMonthName = formatMonth(addMonths(thisMonth, 1));
  await expect(page.getByRole('meter', { name: nextMonthName })).toHaveAttribute('aria-valuenow', '0');
  await expect(page.getByText(strings.budgets.since(formatMonthShort(thisMonth)))).toBeVisible();
  await expect(page.getByRole('meter', { name: 'Food' })).toBeVisible();
  await page.getByRole('button', { name: strings.month.previous }).click();

  // Home's snapshot shows the same budgets.
  await page.getByRole('link', { name: strings.nav.home }).first().click();
  const snapshot = page.getByRole('region', { name: strings.budgets.snapshotTitle });
  await expect(snapshot.getByRole('meter', { name: thisMonthName })).toBeVisible();
  await expect(snapshot.getByText(strings.budgets.states.over)).toBeVisible();
});

test('reports: donut with ranked list, IOU switch, and the monthly bar chart', async ({ page }, testInfo) => {
  await newAccount(page, testInfo, 'INR');
  await addTransaction(page, { amount: '2000', category: 'Rent' });
  await addTransaction(page, { amount: '500', category: 'Food' });
  await addTransaction(page, { amount: '300', category: 'Transport' });
  await addTransaction(page, { kind: 'income', amount: '10000', category: 'Salary' });

  await page.getByRole('link', { name: strings.nav.reports }).first().click();
  await expect(page.getByRole('heading', { name: strings.pages.reports.title, level: 1 })).toBeVisible();

  await expect(page.getByRole('img', { name: strings.reports.donutLabel(thisMonthName, '₹2,800.00') })).toBeVisible();
  const shares = page.getByTestId('category-share');
  await expect(shares).toHaveCount(3);
  await expect(shares.nth(0)).toContainText('Rent');
  await expect(shares.nth(0)).toContainText('71%');
  await expect(shares.nth(0)).toContainText('₹2,000.00');
  await expect(shares.nth(2)).toContainText('Transport');

  const iouSwitch = page.getByRole('switch', { name: strings.reports.excludeIou });
  await expect(iouSwitch).toHaveAttribute('aria-checked', 'true');
  await iouSwitch.click();
  await expect(iouSwitch).toHaveAttribute('aria-checked', 'false');
  await expect(shares).toHaveCount(3);

  // Each month is a labelled button; the selected one is pressed.
  const current = page.getByRole('button', {
    name: strings.reports.monthBarLabel(thisMonthName, '₹10,000.00', '₹2,800.00'),
  });
  await expect(current).toHaveAttribute('aria-pressed', 'true');

  // Tapping an earlier month opens it everywhere.
  const previousName = formatMonth(addMonths(thisMonth, -1));
  await page.getByRole('button', { name: new RegExp(`^${previousName}:`) }).click();
  await expect(page.getByRole('group', { name: strings.month.label })).toContainText(previousName);
  await expect(page.getByText(strings.reports.emptyTitle(previousName))).toBeVisible();
});
