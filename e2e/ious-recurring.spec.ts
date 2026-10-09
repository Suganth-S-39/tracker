import { expect, test } from '@playwright/test';
import { addMonths, formatDate, monthOf, monthRange, todayLocal } from '../src/domain/dates';
import { strings } from '../src/strings/en';
import { newAccount } from './support/account';

const s = strings.ious;

test('IOUs: lend, see it on Home, repay partly, never overpay, settle', async ({ page }, testInfo) => {
  await newAccount(page, testInfo, 'INR');

  // Lend through the Add form's IOU tab.
  await page.getByRole('button', { name: strings.nav.addLong }).first().click();
  const dialog = page.getByRole('dialog', { name: strings.form.addTitle });
  await dialog.locator('label').filter({ hasText: new RegExp(`^${strings.form.kinds.iou}$`) }).click();
  await dialog.getByLabel(s.form.person).fill('Sam');
  await expect(dialog.getByRole('radio', { name: s.form.directions.lent })).toBeChecked();
  await dialog.getByLabel(strings.form.amount, { exact: true }).fill('1000');
  await dialog.getByRole('button', { name: s.form.save }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText(s.added)).toBeVisible();

  // Home: owed to me, and the balance ignores IOU movements.
  await expect(page.getByTestId('iou-owed')).toHaveText('₹1,000.00');
  await expect(page.getByTestId('iou-owe')).toHaveText('₹0.00');
  await expect(page.getByTestId('balance')).toHaveText('₹0.00');

  await page.getByRole('link', { name: s.summaryLabel }).click();
  await expect(page.getByRole('heading', { name: strings.pages.ious.title, level: 1 })).toBeVisible();
  await page.getByRole('region', { name: s.owedToYou }).getByRole('link', { name: s.openLabel('Sam', '₹1,000.00') }).click();
  await expect(page.getByTestId('iou-remaining')).toHaveText('₹1,000.00');

  // Partial repayment.
  await page.getByRole('button', { name: s.recordRepayment }).click();
  let repay = page.getByRole('dialog', { name: s.repayment.title });
  await repay.getByLabel(s.repayment.amount, { exact: true }).fill('400');
  await repay.getByRole('button', { name: s.repayment.save }).click();
  await expect(repay).toBeHidden();
  await expect(page.getByTestId('iou-remaining')).toHaveText('₹600.00');
  await expect(page.getByTestId('repayment')).toHaveCount(1);

  // More than what remains is refused.
  await page.getByRole('button', { name: s.recordRepayment }).click();
  repay = page.getByRole('dialog', { name: s.repayment.title });
  await repay.getByLabel(s.repayment.amount, { exact: true }).fill('700');
  await repay.getByRole('button', { name: s.repayment.save }).click();
  await expect(repay.getByText(s.repayment.errors.exceeds('₹600.00'))).toBeVisible();

  // "Repay the rest" fills in exactly what is owed and settles it.
  await repay.getByRole('button', { name: s.repayment.repayRest }).click();
  await expect(repay.getByLabel(s.repayment.amount, { exact: true })).toHaveValue('600.00');
  await repay.getByRole('button', { name: s.repayment.save }).click();
  await expect(repay).toBeHidden();
  await expect(page.getByTestId('iou-remaining')).toHaveText('₹0.00');
  await expect(page.getByText(s.settled, { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: s.recordRepayment })).toBeDisabled();

  // IOU-linked transactions are listed, marked, and open their IOU.
  await page.getByRole('link', { name: strings.nav.transactions }).first().click();
  const lentRow = page.getByRole('button', { name: /^Edit Sam, -₹1,000\.00/ });
  await expect(lentRow).toContainText(strings.transactions.iou);
  await lentRow.click();
  await expect(page).toHaveURL(/\/ious\/[0-9a-f-]+$/);
});

test('recurring: repeat when adding, then manage it in Settings', async ({ page }, testInfo) => {
  await newAccount(page, testInfo, 'INR');

  await page.getByRole('button', { name: strings.nav.addLong }).first().click();
  const dialog = page.getByRole('dialog', { name: strings.form.addTitle });
  await dialog.getByLabel(strings.form.amount, { exact: true }).fill('1200');
  await dialog.locator('label').filter({ hasText: /^Rent$/ }).click();
  await dialog.getByLabel(strings.form.payee.expense).fill('Landlord');
  await dialog.getByLabel(strings.recurring.repeat).selectOption('monthly');
  await dialog.getByRole('button', { name: strings.form.save.expense }).click();
  await expect(dialog).toBeHidden();

  // The first occurrence is in the list, marked as repeating.
  await expect(page.getByRole('button', { name: /^Edit Landlord/ }).getByRole('img', { name: strings.recurring.recurringLabel })).toBeVisible();

  // Next due: same day next month, clamped to the month's last day. (The browser runs in en-US.)
  const today = todayLocal();
  const nextMonth = addMonths(monthOf(today), 1);
  const lastDay = Number(monthRange(nextMonth).last.slice(8));
  const nextDue = `${nextMonth}-${String(Math.min(Number(today.slice(8)), lastDay)).padStart(2, '0')}`;

  await page.goto('/settings');
  await page.getByRole('link', { name: strings.settings.recurring }).click();
  await expect(page.getByRole('heading', { name: strings.recurring.title, level: 1 })).toBeVisible();
  const rule = page.getByTestId('recurring-rule');
  await expect(rule).toHaveCount(1);
  await expect(rule).toContainText('Landlord');
  await expect(rule).toContainText(`${strings.recurring.every.monthly} · ${strings.recurring.next(formatDate(nextDue, 'en-US'))}`);

  await page.getByRole('button', { name: strings.recurring.pauseLabel('Landlord') }).click();
  await expect(rule).toContainText(strings.recurring.paused);
  await page.getByRole('button', { name: strings.recurring.resumeLabel('Landlord') }).click();
  await expect(rule).toContainText(strings.recurring.next(formatDate(nextDue, 'en-US')));

  await page.getByRole('button', { name: strings.recurring.editLabel('Landlord') }).click();
  const edit = page.getByRole('dialog', { name: strings.recurring.form.title });
  await edit.getByLabel(strings.form.amount, { exact: true }).fill('1300');
  await edit.getByRole('button', { name: strings.recurring.form.save }).click();
  await expect(edit).toBeHidden();
  await expect(rule).toContainText('-₹1,300.00');

  await page.getByRole('button', { name: strings.recurring.deleteLabel('Landlord') }).click();
  await page.getByRole('dialog', { name: strings.recurring.confirmDelete.title }).getByRole('button', { name: strings.recurring.confirmDelete.confirm }).click();
  await expect(page.getByText(strings.recurring.emptyTitle)).toBeVisible();
});
