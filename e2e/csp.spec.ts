import { expect, test, type Page } from '@playwright/test';
import { strings } from '../src/strings/en';
import { PREVIEW_URL } from '../playwright.config';
import { newAccount } from './support/account';
import { addTransaction } from './support/transactions';

// The production Content-Security-Policy from vercel.json must not break the app. Runs against the
// production build: `vite preview` sends vercel.json's headers (vite.config.ts, with the local
// Supabase origin), while the dev server relies on inline scripts the policy blocks.

test.use({ baseURL: PREVIEW_URL });
test.skip(({ isMobile }) => isMobile, 'The policy is the same on every device; the desktop run covers it.');

/** Collects CSP violations reported by the page (events) and by the browser (console). */
async function watchViolations(page: Page): Promise<string[]> {
  const violations: string[] = [];
  page.on('console', (message) => {
    if (/content security policy/i.test(message.text())) violations.push(message.text());
  });
  await page.exposeFunction('reportCspViolation', (text: string) => violations.push(text));
  await page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (event) => {
      const report = (window as unknown as { reportCspViolation: (text: string) => void }).reportCspViolation;
      report(`${event.violatedDirective} blocked ${event.blockedURI || 'inline'}`);
    });
  });
  return violations;
}

test('the app works under the production Content-Security-Policy', async ({ page }, testInfo) => {
  const violations = await watchViolations(page);

  // Guards against a stale preview server started before the headers were configured.
  const response = await page.goto('/sign-in');
  expect(response?.headers()['content-security-policy']).toContain("frame-ancestors 'none'");

  await newAccount(page, testInfo, 'INR');

  // The self-hosted font loaded (font-src). A blocked inline theme script would be a violation.
  const fontLoaded = await page.evaluate(async () => {
    await document.fonts.ready;
    return [...document.fonts].some((font) => font.status === 'loaded');
  });
  expect(fontLoaded).toBe(true);

  // The service worker registers (worker-src).
  const scope = await page.evaluate(async () => (await navigator.serviceWorker.ready).scope);
  expect(scope).toBe(`${PREVIEW_URL}/`);

  await addTransaction(page, { amount: '42', category: 'Food', payee: 'Policy Cafe' });
  await expect(page.getByRole('button', { name: /^Edit Policy Cafe/ })).toBeVisible();

  await page.getByRole('link', { name: strings.nav.reports }).first().click();
  await expect(page.getByRole('heading', { name: strings.pages.reports.title, level: 1 })).toBeVisible();
  await expect(page.getByText(strings.reports.byCategory)).toBeVisible();

  await page.getByRole('link', { name: strings.nav.settings }).first().click();
  await expect(page.getByRole('heading', { name: strings.pages.settings.title, level: 1 })).toBeVisible();

  // A full reload (now served by the service worker) restores the session under the policy.
  await page.reload();
  await expect(page.getByRole('heading', { name: strings.pages.settings.title, level: 1 })).toBeVisible();

  expect(violations).toEqual([]);
});
