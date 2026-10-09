import { expect, test, type Locator, type Page } from '@playwright/test';
import { strings } from '../src/strings/en';
import { newAccount } from './support/account';

// Base currency INR, browser locale en-US: amounts look like "₹120.50".

const addDialog = (page: Page) => page.getByRole('dialog', { name: strings.form.addTitle });

async function openAdd(page: Page) {
  await page.getByRole('button', { name: strings.nav.addLong }).first().click();
  await expect(addDialog(page)).toBeVisible();
}

/** Clicks the visible chip, as a user would (Playwright waits for the sheet to stop moving). */
async function chooseOption(dialog: Locator, name: string) {
  await dialog.locator('label').filter({ hasText: new RegExp(`^${name}$`) }).click();
  await expect(dialog.getByRole('radio', { name, exact: true })).toBeChecked();
}

test('add, convert, edit and see it on Home', async ({ page }, testInfo) => {
  await newAccount(page, testInfo, 'INR');

  // The friendly empty state guides the first action.
  await page.getByRole('button', { name: strings.home.addFirst }).click();
  const dialog = addDialog(page);
  await expect(dialog).toBeVisible();

  // The amount field is focused on open, with a decimal keypad.
  const amount = dialog.getByLabel(strings.form.amount, { exact: true });
  await expect(amount).toBeFocused();
  await expect(amount).toHaveAttribute('inputmode', 'decimal');

  // Validation: nothing saves without an amount and a category.
  await dialog.getByRole('button', { name: strings.form.save.expense }).click();
  await expect(dialog.getByText(strings.form.errors.amount)).toBeVisible();
  await expect(dialog.getByText(strings.form.errors.category)).toBeVisible();

  // An expense in the base currency.
  await amount.fill('120.50');
  await chooseOption(dialog, 'Food');
  await dialog.getByLabel(strings.form.payee.expense).fill('Corner Cafe');
  await dialog.getByLabel(strings.form.note).fill('Lunch');
  await dialog.getByRole('button', { name: strings.form.save.expense }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText(strings.transactions.added.expense)).toBeVisible();

  await expect(page.getByTestId('total-expense')).toHaveText('₹120.50');
  await expect(page.getByTestId('balance')).toHaveText('-₹120.50');
  await expect(page.getByRole('button', { name: /Corner Cafe, -₹120\.50/ })).toBeVisible();

  // Income in a foreign currency: edit the converted amount and the rate follows.
  await openAdd(page);
  await chooseOption(dialog, strings.form.kinds.income);
  await dialog.getByLabel(strings.form.amount, { exact: true }).fill('100');
  await dialog.getByLabel(strings.form.currency).selectOption('USD');
  const converted = dialog.getByLabel(strings.form.conversion.converted('INR'));
  await converted.fill('8300');
  await expect(dialog.getByLabel(strings.form.conversion.rate('USD', 'INR'))).toHaveValue('83');
  // Editing the rate recalculates the converted amount.
  await dialog.getByLabel(strings.form.conversion.rate('USD', 'INR')).fill('84.5');
  await expect(converted).toHaveValue('8450.00');
  await converted.fill('8300');
  await chooseOption(dialog, 'Salary');
  await dialog.getByLabel(strings.form.payee.income).fill('Acme Corp');
  await dialog.getByRole('button', { name: strings.form.save.income }).click();
  await expect(dialog).toBeHidden();

  await expect(page.getByTestId('total-income')).toHaveText('₹8,300.00');
  await expect(page.getByTestId('balance')).toHaveText('+₹8,179.50');
  // Foreign amounts show the original and the converted base amount.
  const incomeRow = page.getByRole('button', { name: /Acme Corp, \+\$100\.00/ });
  await expect(incomeRow).toContainText('≈ ₹8,300.00');

  // Edit: tap the row, change the amount, save.
  await page.getByRole('button', { name: /Corner Cafe, -₹120\.50/ }).click();
  const editDialog = page.getByRole('dialog', { name: strings.form.editTitle.expense });
  await expect(editDialog).toBeVisible();
  await editDialog.getByLabel(strings.form.amount, { exact: true }).fill('150');
  await editDialog.getByRole('button', { name: strings.form.saveChanges }).click();
  await expect(editDialog).toBeHidden();
  await expect(page.getByTestId('total-expense')).toHaveText('₹150.00');
  await expect(page.getByTestId('balance')).toHaveText('+₹8,150.00');

  // Months are calendar months: the previous month is empty.
  await page.getByRole('button', { name: strings.month.previous }).click();
  await expect(page.getByTestId('balance')).toHaveText('₹0.00');
  await page.getByRole('button', { name: strings.month.next }).click();
  await expect(page.getByTestId('balance')).toHaveText('+₹8,150.00');
});

test('transactions page: search, filter, delete and undo', async ({ page, isMobile }, testInfo) => {
  await newAccount(page, testInfo, 'INR');

  for (const [payee, category, value] of [
    ['Corner Cafe', 'Food', '80'],
    ['Metro', 'Transport', '45'],
    ['Book Shop', 'Shopping', '300'],
  ] as const) {
    await openAdd(page);
    const dialog = addDialog(page);
    await dialog.getByLabel(strings.form.amount, { exact: true }).fill(value);
    await chooseOption(dialog, category);
    await dialog.getByLabel(strings.form.payee.expense).fill(payee);
    await dialog.getByRole('button', { name: strings.form.save.expense }).click();
    await expect(dialog).toBeHidden();
  }

  await page.getByRole('link', { name: strings.home.seeAllLabel }).click();
  await expect(page.getByRole('heading', { name: strings.pages.transactions.title, level: 1 })).toBeVisible();
  await expect(page.getByRole('heading', { name: strings.transactions.today, level: 2 })).toBeVisible();
  const rows = page.getByRole('button', { name: /^Edit / });
  await expect(rows).toHaveCount(3);

  // Search matches payee (case-insensitive).
  await page.getByRole('searchbox', { name: strings.transactions.searchLabel }).fill('cafe');
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toHaveAccessibleName(/Corner Cafe/);
  await page.getByRole('button', { name: strings.transactions.clearFilters }).click();
  await expect(rows).toHaveCount(3);

  // Filter by category.
  await page.getByLabel(strings.transactions.filters.category).selectOption({ label: 'Transport' });
  await expect(rows).toHaveCount(1);
  await page.getByRole('button', { name: strings.transactions.clearFilters }).click();
  await expect(rows).toHaveCount(3);

  // Delete: swipe left on phones, the row's delete button on desktop. Both offer Undo.
  const metro = page.getByRole('button', { name: /^Edit Metro/ });
  if (isMobile) {
    const box = (await metro.boundingBox())!;
    const y = box.y + box.height / 2;
    await page.mouse.move(box.x + box.width - 20, y);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2, y, { steps: 5 });
    await page.mouse.move(box.x + 10, y, { steps: 5 });
    await page.mouse.up();
  } else {
    await page.getByRole('button', { name: /^Delete Metro/ }).click();
  }
  await expect(rows).toHaveCount(2);
  await expect(page.getByText(strings.transactions.deleted.expense)).toBeVisible();

  await page.getByRole('button', { name: strings.transactions.undo }).click();
  await expect(rows).toHaveCount(3);
  await expect(page.getByRole('button', { name: /^Edit Metro/ })).toBeVisible();
});

test('categories: add, use in the Add form, hide', async ({ page }, testInfo) => {
  await newAccount(page, testInfo, 'INR');
  await page.goto('/settings/categories');
  await expect(page.getByRole('heading', { name: strings.pages.categories.title, level: 1 })).toBeVisible();

  await page.getByRole('button', { name: strings.categories.add }).click();
  const editor = page.getByRole('dialog', { name: strings.categories.editor.addTitle });
  await editor.getByLabel(strings.categories.editor.name).fill('Coffee');
  // `has` is evaluated inside each label, so it takes an unrooted locator.
  const coffeeIcon = page.getByRole('radio', { name: strings.categories.icons['coffee']! });
  await editor.locator('label').filter({ has: coffeeIcon }).click();
  await expect(editor.getByRole('radio', { name: strings.categories.icons['coffee']! })).toBeChecked();
  await editor.getByRole('button', { name: strings.categories.editor.save }).click();
  await expect(editor).toBeHidden();
  await expect(page.getByText('Coffee', { exact: true })).toBeVisible();

  // Names are unique per type, ignoring case.
  await page.getByRole('button', { name: strings.categories.add }).click();
  await editor.getByLabel(strings.categories.editor.name).fill('coffee');
  await editor.getByRole('button', { name: strings.categories.editor.save }).click();
  await expect(editor.getByText(strings.errors.byCode['23505']!)).toBeVisible();
  await page.keyboard.press('Escape');

  // The new category is offered in the Add form...
  await openAdd(page);
  await expect(addDialog(page).getByRole('radio', { name: 'Coffee', exact: true })).toBeAttached();
  await page.keyboard.press('Escape');

  // ...until it is hidden.
  await page.getByRole('button', { name: strings.categories.hideLabel('Coffee') }).click();
  await expect(page.getByText(strings.categories.hidden, { exact: true })).toBeVisible();
  await openAdd(page);
  await expect(addDialog(page).getByRole('radio', { name: 'Food', exact: true })).toBeAttached();
  await expect(addDialog(page).getByRole('radio', { name: 'Coffee', exact: true })).toHaveCount(0);
});
