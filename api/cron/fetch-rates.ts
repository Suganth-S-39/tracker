// Daily exchange-rate fetch, triggered by Vercel Cron (vercel.json "crons", once a day on Hobby).
//
// Calls the fetch-rates Supabase Edge Function with the project's secret key. The scheduler lives
// outside Supabase on purpose (DECISIONS.md): free-tier projects pause after about a week without
// activity, which also stops pg_cron, and this daily call counts as activity.
//
// Vercel sends `Authorization: Bearer <CRON_SECRET>` with cron requests; anything else is refused,
// so the public URL can't be used to trigger fetches. Server-only environment variables (Vercel
// project settings, never prefixed VITE_): CRON_SECRET, SUPABASE_URL, SUPABASE_SECRET_KEY.
//
// Self-contained on purpose: Vercel compiles /api without the app's path aliases or tsconfig references.

import { createHash, timingSafeEqual } from 'node:crypto';

/** Constant-time comparison (hashing first makes both sides the same length). */
function sameSecret(a: string, b: string): boolean {
  const digest = (value: string) => createHash('sha256').update(value).digest();
  return timingSafeEqual(digest(a), digest(b));
}

export async function GET(request: Request): Promise<Response> {
  const { CRON_SECRET, SUPABASE_URL, SUPABASE_SECRET_KEY } = process.env;

  if (!CRON_SECRET || !sameSecret(request.headers.get('authorization') ?? '', `Bearer ${CRON_SECRET}`)) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }
  if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
    return Response.json({ error: 'SUPABASE_URL and SUPABASE_SECRET_KEY must be set' }, { status: 500 });
  }

  const target = new URL('functions/v1/fetch-rates', SUPABASE_URL.endsWith('/') ? SUPABASE_URL : `${SUPABASE_URL}/`);
  const upstream = await fetch(target, { method: 'POST', headers: { apikey: SUPABASE_SECRET_KEY } });
  const body = await upstream.text();
  if (!upstream.ok) console.error(`fetch-rates failed: ${upstream.status} ${body}`);

  return new Response(body, {
    status: upstream.ok ? 200 : 502,
    headers: { 'Content-Type': 'application/json' },
  });
}
