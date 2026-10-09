import { defineConfig, devices } from '@playwright/test';

/** Production build served by `vite preview`, for csp.spec.ts. */
export const PREVIEW_URL = 'http://localhost:4173';

// End-to-end tests run against the Vite dev server and the local Supabase stack
// (`npm run db:start` first). Each test signs up a fresh user, so runs are independent.
export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5173',
    locale: 'en-US',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'phone', use: { ...devices['Pixel 7'] } },
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } } },
  ],
  webServer: [
    {
      command: 'npm run dev',
      url: 'http://localhost:5173',
      reuseExistingServer: true,
      timeout: 60_000,
    },
    {
      // The CSP spec needs the production build (the dev server uses inline scripts the policy
      // blocks). A server already running on this port is reused as is: rebuild it after changes.
      command: 'npm run build && npx vite preview --port 4173 --strictPort',
      url: PREVIEW_URL,
      reuseExistingServer: true,
      timeout: 180_000,
    },
  ],
});
