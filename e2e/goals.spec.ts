import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { strings } from '../src/strings/en';
import { newAccount } from './support/account';
import { pickFromList } from './support/select';

// Savings goals (owner request, 2026-10-10). Base currency INR, locale en-US.
const g = strings.goals;

async function createGoal(page: Page, name: string, target: string) {
  await page.getByRole('link', { name: new RegExp(g.homeEmptyAction) }).click();
  const form = page.getByRole('dialog', { name: g.form.addTitle });
  await form.getByLabel(g.form.name).fill(name);
  await form.getByLabel(g.form.target, { exact: true }).fill(target);
  // The radios are visually hidden; their labels are the icon tiles you tap.
  await form.locator('label').filter({ has: page.getByRole('radio', { name: g.icons['smartphone']!, exact: true }) }).click();
  await expect(form.getByRole('radio', { name: g.icons['smartphone']!, exact: true })).toBeChecked();
  await form.getByRole('button', { name: g.form.create }).click();
  await expect(page.getByRole('heading', { name, level: 1 })).toBeVisible();
}

test('a goal: add money, take some out, buy it, and undo the purchase', async ({ page }, testInfo) => {
  await newAccount(page, testInfo, 'INR');

  // Home invites you to make one; the goal page opens once it's made.
  await createGoal(page, 'New phone', '15000');
  await expect(page).toHaveURL(/\/goals\/[0-9a-f-]{36}$/);
  await expect(page.getByTestId('goal-saved')).toHaveText('₹0.00');
  await expect(page.getByTestId('goal-hints')).toHaveText(g.pace.none);

  // Add money opens the Add form on Savings, already pointed at the goal.
  await page.getByRole('button', { name: g.addMoney }).click();
  const add = page.getByRole('dialog', { name: strings.form.addTitle });
  await expect(add.getByRole('combobox', { name: strings.form.goal })).toHaveText(/New phone/);
  await expect(add.getByRole('combobox', { name: strings.recurring.repeat })).toHaveCount(0);
  await add.getByLabel(strings.form.amount, { exact: true }).fill('5000');
  await add.locator('label').filter({ hasText: /^Savings account$/ }).click();
  await add.getByRole('button', { name: strings.form.save.savings }).click();
  await expect(page.getByText(g.addedTo('New phone'))).toBeVisible();
  await expect(page.getByTestId('goal-saved')).toHaveText('₹5,000.00');
  await expect(page.getByText('33%', { exact: true })).toBeVisible();
  await expect(page.getByTestId('goal-hints')).toContainText('At your recent pace');

  // Taking out more than is there is refused; less goes back into the balance.
  await page.getByRole('button', { name: g.takeOut, exact: true }).click();
  const takeOut = page.getByRole('dialog', { name: g.takeOutForm.title });
  await takeOut.getByLabel(g.takeOutForm.amount, { exact: true }).fill('6000');
  await takeOut.getByRole('button', { name: g.takeOutForm.save }).click();
  await expect(takeOut.getByText(g.takeOutForm.errors.tooMuch('₹5,000.00'))).toBeVisible();
  await takeOut.getByLabel(g.takeOutForm.amount, { exact: true }).fill('1000');
  await takeOut.getByRole('button', { name: g.takeOutForm.save }).click();
  await expect(page.getByText(g.takenOut('₹1,000.00'))).toBeVisible();
  await expect(page.getByTestId('goal-saved')).toHaveText('₹4,000.00');

  // History: the take-out (a plus: it's back in the balance) and the saving, both labelled.
  const history = page.getByRole('region', { name: g.history });
  await expect(history.getByRole('button', { name: /^Edit New phone, \+₹1,000\.00/ })).toContainText(strings.transactions.kindTag.withdrawal);
  await expect(history.getByRole('button', { name: /^Edit Savings account, -₹5,000\.00/ })).toBeVisible();

  // Home: savings are net of what came out; the goal shows its progress.
  await page.getByRole('link', { name: strings.nav.home }).first().click();
  await expect(page.getByTestId('total-savings')).toHaveText('₹4,000.00');
  await expect(page.getByTestId('balance')).toHaveText('-₹4,000.00');
  await expect(page.getByTestId('home-goal-saved')).toHaveText('₹4,000.00 of ₹15,000.00');

  // The take-out in Transactions opens its goal (it isn't edited or deleted there).
  await page.getByRole('link', { name: strings.nav.transactions }).first().click();
  await page.getByRole('button', { name: /^Edit New phone, \+₹1,000\.00/ }).click();
  await expect(page.getByRole('heading', { name: 'New phone', level: 1 })).toBeVisible();

  // Bought: what it cost, where the money comes from, then a celebration.
  await page.getByRole('button', { name: g.bought }).click();
  const bought = page.getByRole('dialog', { name: g.boughtForm.title });
  await expect(bought.getByLabel(g.boughtForm.cost, { exact: true })).toHaveValue('15000.00');
  await expect(bought.getByText(g.boughtForm.fromGoal('₹4,000.00'))).toBeVisible();
  await expect(bought.getByText(g.boughtForm.extra('₹11,000.00'))).toBeVisible();
  await bought.getByRole('button', { name: g.boughtForm.save }).click();
  await expect(page.getByText(g.boughtToast)).toBeVisible();
  await expect(page.getByText(g.celebration, { exact: true })).toBeVisible();
  await expect(page.getByText(g.savedTotal('₹4,000.00'))).toBeVisible();

  // The purchase counts as spending, paid partly from the goal.
  await page.getByRole('link', { name: strings.nav.home }).first().click();
  await expect(page.getByTestId('total-expense')).toHaveText('₹15,000.00');
  await expect(page.getByTestId('total-savings')).toHaveText('₹0.00');
  await expect(page.getByTestId('balance')).toHaveText('-₹15,000.00');
  // Nothing left to save for: Home invites a new goal again.
  await expect(page.getByRole('link', { name: new RegExp(g.homeEmptyAction) })).toBeVisible();

  // Not bought yet puts it all back.
  await page.goto('/goals');
  await page.getByRole('link', { name: /^New phone: bought/ }).click();
  await page.getByRole('button', { name: g.notBought }).click();
  await page.getByRole('dialog', { name: g.confirmReopen.title }).getByRole('button', { name: g.confirmReopen.confirm }).click();
  await expect(page.getByTestId('goal-saved')).toHaveText('₹4,000.00');
});

test('goals: edit, choose a goal in the Add form, delete and undo; no serious axe issues', async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await newAccount(page, testInfo, 'INR');
  await createGoal(page, 'Bike', '8000');

  await page.getByRole('button', { name: g.edit, exact: true }).click();
  const edit = page.getByRole('dialog', { name: g.form.editTitle });
  await edit.getByLabel(g.form.target, { exact: true }).fill('9000');
  await edit.getByLabel(g.form.targetDate).fill('2099-12-31');
  await edit.getByRole('button', { name: g.form.save }).click();
  await expect(page.getByText(g.ofTarget('₹9,000.00'))).toBeVisible();
  await expect(page.getByText(g.by('Dec 31, 2099'), { exact: true })).toBeVisible();

  // The plain Add form offers the goal for savings.
  await page.getByRole('button', { name: strings.nav.addLong }).first().click();
  const add = page.getByRole('dialog', { name: strings.form.addTitle });
  await add.locator('label').filter({ hasText: new RegExp(`^${strings.form.kindTabs.savings}$`) }).click();
  await pickFromList(add, strings.form.goal, 'Bike');
  await add.getByLabel(strings.form.amount, { exact: true }).fill('900');
  await add.locator('label').filter({ hasText: /^Savings account$/ }).click();
  await add.getByRole('button', { name: strings.form.save.savings }).click();
  await expect(page.getByTestId('goal-saved')).toHaveText('₹900.00');
  await expect(page.getByTestId('goal-hints')).toContainText(/Save ₹[\d,]+\.00 a week to get it by Dec 31, 2099\./);

  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => v.id)).toEqual([]);

  // Delete (with the money still in it), then Undo.
  await page.getByRole('button', { name: g.delete, exact: true }).click();
  const confirm = page.getByRole('dialog', { name: g.confirmDelete.title });
  await expect(confirm.getByText(g.confirmDelete.withMoney('₹900.00'))).toBeVisible();
  await confirm.getByRole('button', { name: g.confirmDelete.confirm }).click();
  await expect(page).toHaveURL(/\/goals$/);
  await expect(page.getByRole('heading', { name: g.emptyTitle })).toBeVisible();
  await page.getByRole('button', { name: strings.transactions.undo }).click();
  await expect(page.getByRole('link', { name: /^Bike: ₹900\.00 of ₹9,000\.00 saved$/ })).toBeVisible();
});
