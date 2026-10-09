import { expect, type Page, type TestInfo } from '@playwright/test';
import { strings } from '../../src/strings/en';
import { latestAuthLink } from './mailpit';
import { pickFromList } from './select';

export const PASSWORD = 'Sup3r-secret-pass';

export function uniqueEmail(prefix: string, testInfo: TestInfo): string {
  return `${prefix}-${testInfo.project.name}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
}

/** Signs up through the UI and opens the confirmation email link in the same browser. */
export async function signUpAndConfirm(page: Page, email: string): Promise<void> {
  await page.goto('/sign-up');
  await page.getByLabel(strings.auth.email).fill(email);
  await page.getByLabel(strings.auth.password).fill(PASSWORD);
  await page.getByRole('button', { name: strings.auth.signUp.submit }).click();
  await expect(page.getByRole('heading', { name: strings.auth.signUp.checkEmailTitle })).toBeVisible();
  await page.goto(await latestAuthLink(email));
  await expect(page.getByRole('heading', { name: strings.onboarding.title })).toBeVisible();
}

/** A fresh, onboarded account with the given base currency, landed on Home. Returns its email. */
export async function newAccount(page: Page, testInfo: TestInfo, baseCurrency = 'INR'): Promise<string> {
  const email = uniqueEmail('e2e', testInfo);
  await signUpAndConfirm(page, email);
  await pickFromList(page, strings.onboarding.currencyLabel, new RegExp(`^${baseCurrency} ·`));
  await page.getByRole('button', { name: strings.onboarding.submit }).click();
  await expect(page.getByRole('heading', { name: strings.pages.home.title, level: 1 })).toBeAttached();
  return email;
}
