import { expect, test } from '@playwright/test';
import { strings } from '../src/strings/en';
import { newAccount } from './support/account';
import { addTransaction } from './support/transactions';

// Spec section 5: online-only. Offline, show a clear state and disable writes; never queue them.
test('offline: banner, cached data stays, every write is disabled until reconnecting', async ({ page, context, isMobile }, testInfo) => {
  await newAccount(page, testInfo, 'INR');
  await addTransaction(page, { amount: '300', category: 'Food', payee: 'Corner Cafe' });
  await page.getByRole('link', { name: strings.nav.transactions }).first().click();
  // Wait for the Transactions page itself (Home shows the same row until the page has loaded).
  await expect(page.getByRole('heading', { name: strings.pages.transactions.title, level: 1 })).toBeVisible();
  await expect(page.getByRole('heading', { name: strings.transactions.today, level: 2 })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Edit Corner Cafe/ })).toBeVisible();

  await context.setOffline(true);
  await expect(page.getByText(strings.offline.banner)).toBeVisible();

  // Cached data stays readable; writes are disabled.
  await expect(page.getByRole('button', { name: /^Edit Corner Cafe/ })).toBeVisible();
  await expect(page.getByRole('button', { name: strings.nav.addLong }).first()).toBeDisabled();
  if (!isMobile) await expect(page.getByRole('button', { name: /^Delete Corner Cafe/ })).toHaveCount(0);

  // An already-open form can't save either.
  await page.getByRole('button', { name: /^Edit Corner Cafe/ }).click();
  const dialog = page.getByRole('dialog', { name: strings.form.editTitle.expense });
  await expect(dialog.getByText(strings.offline.cantSave)).toBeVisible();
  await expect(dialog.getByRole('button', { name: strings.form.saveChanges })).toBeDisabled();
  await page.keyboard.press('Escape');

  await context.setOffline(false);
  await expect(page.getByText(strings.offline.banner)).toBeHidden();
  await expect(page.getByRole('button', { name: strings.nav.addLong }).first()).toBeEnabled();
});
