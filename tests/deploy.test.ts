// Deployment config (vercel.json) stays consistent with the app.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

type VercelConfig = {
  rewrites: { source: string; destination: string }[];
  crons: { path: string; schedule: string }[];
  headers: { source: string; headers: { key: string; value: string }[] }[];
};

const vercel = JSON.parse(read('vercel.json')) as VercelConfig;
const globalHeaders = vercel.headers.find((rule) => rule.source === '/(.*)')?.headers ?? [];
const csp = globalHeaders.find((h) => h.key === 'Content-Security-Policy')?.value ?? '';
const sources = (directive: string) =>
  csp
    .split(';')
    .map((part) => part.trim().split(/\s+/))
    .find(([name]) => name === directive)
    ?.slice(1) ?? [];

describe('Content-Security-Policy', () => {
  it('allows each inline script in index.html by hash (update vercel.json when the script changes)', () => {
    const scripts = [...read('index.html').matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)];
    expect(scripts.length).toBeGreaterThan(0);
    for (const [, body] of scripts) {
      const hash = `'sha256-${createHash('sha256').update(body ?? '').digest('base64')}'`;
      expect(sources('script-src')).toContain(hash);
    }
  });

  it('allows no inline script or eval beyond those hashes', () => {
    expect(sources('script-src')).not.toContain("'unsafe-inline'");
    expect(sources('script-src')).not.toContain("'unsafe-eval'");
    expect(sources('default-src')).toEqual(["'self'"]);
  });

  it('blocks framing and plugins', () => {
    expect(sources('frame-ancestors')).toEqual(["'none'"]);
    expect(sources('object-src')).toEqual(["'none'"]);
  });

  it('lets the app reach its Supabase project over HTTPS only', () => {
    const remote = sources('connect-src').filter((s) => s !== "'self'");
    expect(remote.length).toBeGreaterThan(0);
    for (const origin of remote) expect(origin).toMatch(/^https:\/\/[a-z0-9]+\.supabase\.co$/);
  });
});

describe('vercel.json', () => {
  it('sends the other security headers on every response', () => {
    const keys = globalHeaders.map((h) => h.key);
    expect(keys).toEqual(expect.arrayContaining(['X-Content-Type-Options', 'Referrer-Policy', 'Permissions-Policy']));
  });

  it('serves the SPA for client routes but not for /api', () => {
    expect(vercel.rewrites).toEqual([{ source: '/((?!api/).*)', destination: '/index.html' }]);
  });

  it('points every cron at an existing function with a GET handler, at most daily (Hobby plan)', () => {
    expect(vercel.crons.length).toBeGreaterThan(0);
    for (const cron of vercel.crons) {
      const file = new URL(`..${cron.path}.ts`, import.meta.url);
      expect(existsSync(file)).toBe(true);
      expect(readFileSync(file, 'utf8')).toMatch(/export (async )?function GET\(/);
      const [minute, hour] = cron.schedule.split(' ');
      expect(minute).toMatch(/^\d+$/);
      expect(hour).toMatch(/^\d+$/);
    }
  });
});
