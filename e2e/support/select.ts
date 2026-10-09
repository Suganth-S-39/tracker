import type { Locator, Page } from '@playwright/test';

/** Opens one of the app's dropdowns (components/ui/Select) by its label and picks an option. */
export async function pickFromList(scope: Page | Locator, label: string, option: string | RegExp): Promise<void> {
  await scope.getByRole('combobox', { name: label }).click();
  await scope.getByRole('option', typeof option === 'string' ? { name: option, exact: true } : { name: option }).click();
}
