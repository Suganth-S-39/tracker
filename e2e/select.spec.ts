import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { strings } from '../src/strings/en';
import { newAccount } from './support/account';

const f = strings.transactions.filters;

// The app's own dropdowns (components/ui/Select) replace native selects: they must keep a native
// select's keyboard and screen-reader behavior.
test('dropdowns: keyboard, type-ahead, outside click, groups, and Escape inside a dialog', async ({ page, isMobile }, testInfo) => {
  await newAccount(page, testInfo, 'INR');
  await page.getByRole('link', { name: strings.nav.transactions }).first().click();
  await expect(page.getByRole('heading', { name: strings.pages.transactions.title, level: 1 })).toBeVisible();

  // Keyboard: open with ArrowDown on the current choice, move, choose with Enter.
  const type = page.getByRole('combobox', { name: f.type });
  await type.focus();
  await page.keyboard.press('ArrowDown');
  await expect(type).toHaveAttribute('aria-expanded', 'true');
  const typeList = page.getByRole('listbox', { name: f.type });
  await expect(typeList.getByRole('option', { name: f.allTypes })).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(type).toHaveText(strings.form.kinds.expense);
  await expect(type).toHaveAttribute('aria-expanded', 'false');
  await expect(type).toBeFocused();

  // Type-ahead opens the list on the matching option.
  await page.keyboard.press('i');
  await expect(type).toHaveAttribute('aria-activedescendant', /.+/);
  await page.keyboard.press('Enter');
  await expect(type).toHaveText(strings.form.kinds.income);

  // Grouped list (expense / income categories): accessible, and drawn above the page (top layer).
  const category = page.getByRole('combobox', { name: f.category });
  await category.click();
  const categoryList = page.getByRole('listbox', { name: f.category });
  await expect(categoryList.getByRole('group', { name: strings.categories.sections.expense })).toBeVisible();
  expect(await categoryList.evaluate((el) => el.matches(':popover-open'))).toBe(true);
  const axe = await new AxeBuilder({ page }).include('[role="listbox"]').analyze();
  expect(axe.violations.map((v) => v.id)).toEqual([]);

  // A press outside closes it without changing anything.
  await page.getByRole('heading', { name: strings.pages.transactions.title, level: 1 }).click();
  await expect(categoryList).toHaveCount(0);
  await expect(category).toHaveText(f.allCategories);

  // Inside a dialog, Escape closes the list first, then the dialog.
  await page.getByRole('button', { name: strings.nav.addLong }).first().click();
  const dialog = page.getByRole('dialog', { name: strings.form.addTitle });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('combobox', { name: strings.form.currency }).click();
  await expect(dialog.getByRole('listbox')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog.getByRole('listbox')).toHaveCount(0);
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();

  // Phones: choosing by tap works the same.
  if (isMobile) {
    await category.click();
    await page.getByRole('option', { name: 'Food', exact: true }).click();
    await expect(category).toHaveText('Food');
  }
});
