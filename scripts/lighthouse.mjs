// Lighthouse (mobile) against the production build, including signed-in screens.
//
// Usage (local Supabase running):  npm run build && npm run preview   (in one terminal)
//                                  npm run lighthouse                 (in another)
//
// Signed-in pages need a session: a confirmed test user is created with the local admin API,
// the browser signs in through the UI, and Lighthouse then runs in that same browser (via the
// remote-debugging port) with storage reset turned off so the session is kept.

import { execFileSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import lighthouse from 'lighthouse';

const APP = process.env.APP_URL ?? 'http://localhost:4173';
const PORT = 9333;
const TARGET = 90;
// Single runs vary by several points (simulated throttling on a busy machine); like Lighthouse CI,
// report the median run per page.
const RUNS = Number(process.env.LIGHTHOUSE_RUNS ?? 3);

function localSupabase() {
  const cli = fileURLToPath(new URL('../node_modules/supabase/dist/supabase.js', import.meta.url));
  const out = execFileSync(process.execPath, [cli, 'status', '-o', 'json'], { encoding: 'utf8' });
  const status = JSON.parse(out.slice(out.indexOf('{')));
  return { url: status.API_URL, secret: status.SECRET_KEY };
}

async function createUser(email, password) {
  const { url, secret } = localSupabase();
  const res = await fetch(`${url}/auth/v1/admin/users`, {
    method: 'POST',
    headers: { apikey: secret, Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, email_confirm: true }),
  });
  if (!res.ok) throw new Error(`Creating test user failed: ${res.status} ${await res.text()}`);
}

async function audit(path) {
  const runs = [];
  for (let i = 0; i < RUNS; i++) runs.push(await auditOnce(path));
  runs.sort((a, b) => a.performance - b.performance);
  return { ...runs[Math.floor(runs.length / 2)], runs: runs.map((r) => r.performance).join('/') };
}

async function auditOnce(path) {
  const result = await lighthouse(`${APP}${path}`, {
    port: PORT,
    output: 'json',
    logLevel: 'error',
    onlyCategories: ['performance', 'accessibility', 'best-practices'],
    formFactor: 'mobile',
    disableStorageReset: true,
  });
  const { categories, audits } = result.lhr;
  const score = (c) => Math.round((categories[c]?.score ?? 0) * 100);
  return {
    path,
    performance: score('performance'),
    accessibility: score('accessibility'),
    bestPractices: score('best-practices'),
    FCP: audits['first-contentful-paint'].displayValue,
    LCP: audits['largest-contentful-paint'].displayValue,
    TBT: audits['total-blocking-time'].displayValue,
    CLS: audits['cumulative-layout-shift'].displayValue,
  };
}

const context = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), 'lh-')), {
  headless: true,
  args: [`--remote-debugging-port=${PORT}`],
});
const rows = [];
try {
  rows.push(await audit('/sign-in'));

  const email = `lighthouse-${Date.now()}@example.com`;
  const password = 'Lighthouse-pass-1';
  await createUser(email, password);
  const page = context.pages()[0] ?? (await context.newPage());
  await page.goto(`${APP}/sign-in`);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.getByRole('button', { name: 'Get started' }).click();
  await page.getByRole('heading', { name: 'Home', level: 1 }).waitFor({ state: 'attached' });

  for (const path of ['/', '/transactions', '/reports']) rows.push(await audit(path));
} finally {
  await context.close();
}

console.table(rows);
const failing = rows.filter((r) => r.performance < TARGET);
if (failing.length) {
  console.error(`Performance below ${TARGET} on: ${failing.map((r) => r.path).join(', ')}`);
  process.exitCode = 1;
}
