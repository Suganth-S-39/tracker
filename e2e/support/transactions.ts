import { expect, type Page } from '@playwright/test';
import { strings } from '../../src/strings/en';

/** Adds a transaction in the base currency through the Add form. */
export async function addTransaction(
  page: Page,
  { kind = 'expense', amount, category, payee }: { kind?: 'expense' | 'income'; amount: string; category: string; payee?: string },
): Promise<void> {
  await page.getByRole('button', { name: strings.nav.addLong }).first().click();
  const dialog = page.getByRole('dialog', { name: strings.form.addTitle });
  await expect(dialog).toBeVisible();
  if (kind === 'income') {
    await dialog.locator('label').filter({ hasText: new RegExp(`^${strings.form.kinds.income}$`) }).click();
  }
  await dialog.getByLabel(strings.form.amount, { exact: true }).fill(amount);
  await dialog.locator('label').filter({ hasText: new RegExp(`^${category}$`) }).click();
  if (payee) await dialog.getByLabel(strings.form.payee[kind]).fill(payee);
  await dialog.getByRole('button', { name: strings.form.save[kind] }).click();
  await expect(dialog).toBeHidden();
}
