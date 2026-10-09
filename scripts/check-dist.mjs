// Post-build checks on dist/. Runs after every `npm run build` (npm's postbuild), including the
// build on Vercel, so a bad deploy fails before it goes live.
//
// 1. No server secrets in the built site: Supabase secret keys (sb_secret_...) or legacy
//    service-role JWTs. Only the publishable key may ship (CLAUDE.md, architecture rule 9).
// 2. The Content-Security-Policy in vercel.json allows every inline script in dist/index.html
//    (by sha256) and the Supabase project the bundle talks to (connect-src). Without this, a
//    changed theme script or a new Supabase project would deploy a site the browser blocks.

import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const dist = join(root, 'dist');
const TEXT_FILE = /\.(html|js|mjs|css|json|webmanifest|txt|map|svg)$/;

const listFiles = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? listFiles(path) : [path];
  });

const isServiceRoleJwt = (payload) => {
  try {
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')).role === 'service_role';
  } catch {
    return false;
  }
};

const problems = [];
const texts = [];

for (const file of listFiles(dist).filter((f) => TEXT_FILE.test(f))) {
  const text = readFileSync(file, 'utf8');
  const name = relative(root, file);
  texts.push(text);
  if (text.includes('sb_secret_')) problems.push(`${name} contains a Supabase secret key (sb_secret_...).`);
  for (const [, payload] of text.matchAll(/eyJ[\w-]+\.(eyJ[\w-]+)\.[\w-]+/g)) {
    if (isServiceRoleJwt(payload)) problems.push(`${name} contains a service-role JWT.`);
  }
}

const csp = JSON.parse(readFileSync(join(root, 'vercel.json'), 'utf8'))
  .headers.flatMap((rule) => rule.headers)
  .find((header) => header.key === 'Content-Security-Policy')?.value;

if (!csp) {
  problems.push('vercel.json has no Content-Security-Policy header.');
} else {
  const sources = (directive) =>
    csp
      .split(';')
      .map((part) => part.trim().split(/\s+/))
      .find(([name]) => name === directive)
      ?.slice(1) ?? [];

  const html = readFileSync(join(dist, 'index.html'), 'utf8');
  for (const [, script] of html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)) {
    const hash = `'sha256-${createHash('sha256').update(script).digest('base64')}'`;
    if (!sources('script-src').includes(hash)) {
      problems.push(`CSP script-src in vercel.json is missing ${hash} for an inline script in index.html.`);
    }
  }

  const origins = new Set([...texts.join('\n').matchAll(/https:\/\/[a-z0-9-]+\.supabase\.co(?![a-z0-9.-])/g)].map(([o]) => o));
  for (const origin of origins) {
    if (!sources('connect-src').includes(origin)) {
      problems.push(`CSP connect-src in vercel.json doesn't allow ${origin}, the Supabase project this build uses.`);
    }
  }
}

if (problems.length) {
  console.error(`dist check failed:\n${problems.map((p) => `  - ${p}`).join('\n')}`);
  process.exit(1);
}
console.log('dist check passed: no secrets in the build, CSP matches.');
