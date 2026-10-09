// Daily exchange-rate fetch (spec section 9, open item 2: Frankfurter).
//
// Stores the provider's latest rates against one pivot currency in public.exchange_rates;
// public.latest_rate() derives any cross rate from them. Re-running on the same day is harmless
// (upsert on date, base, quote).
//
// Only backend callers may run it: the request must carry the project's secret key in the
// `apikey` header (withSupabase auth 'secret'). It is triggered daily by an external scheduler
// (DECISIONS.md: the call also keeps a free-tier project from pausing).
//
// Local run:
//   curl -X POST http://127.0.0.1:54321/functions/v1/fetch-rates -H "apikey: <SECRET_KEY>"
//   (SECRET_KEY from `npx supabase status -o env`)

import { withSupabase } from 'npm:@supabase/server@1';

const PROVIDER_URL = 'https://api.frankfurter.dev/v2/rates';
const PIVOT = 'EUR';

type ProviderRow = { date: string; base: string; quote: string; rate: string };

/**
 * Parses the provider's JSON keeping each rate's exact decimal text (JSON numbers would go
 * through binary floating point). Uses JSON.parse source-text access, with a plain-number
 * fallback for runtimes without it.
 */
function parseRows(body: string): ProviderRow[] {
  const reviver = (key: string, value: unknown, context?: { source?: string }) =>
    key === 'rate' ? (context?.source ?? String(value)) : value;
  const parsed = JSON.parse(body, reviver as (key: string, value: unknown) => unknown) as unknown;
  if (!Array.isArray(parsed)) throw new Error('Unexpected provider response');
  return parsed as ProviderRow[];
}

export default {
  fetch: withSupabase({ auth: 'secret' }, async (_req, ctx) => {
    const { data: currencies, error: currencyError } = await ctx.supabaseAdmin
      .from('currencies')
      .select('code');
    if (currencyError) return Response.json({ error: currencyError.message }, { status: 500 });
    const supported = new Set(currencies.map((c: { code: string }) => c.code));

    const response = await fetch(`${PROVIDER_URL}?base=${PIVOT}`);
    if (!response.ok) {
      return Response.json({ error: `Provider returned ${response.status}` }, { status: 502 });
    }
    const rows = parseRows(await response.text())
      .filter((row) => row.base === PIVOT && row.quote !== PIVOT && supported.has(row.quote))
      .filter((row) => /^\d+(\.\d+)?$/.test(row.rate) && Number(row.rate) > 0)
      .map((row) => ({ date: row.date, base: row.base, quote: row.quote, rate: row.rate }));

    if (rows.length === 0) return Response.json({ error: 'No usable rates' }, { status: 502 });

    const { error: upsertError } = await ctx.supabaseAdmin
      .from('exchange_rates')
      .upsert(rows, { onConflict: 'date,base,quote' });
    if (upsertError) return Response.json({ error: upsertError.message }, { status: 500 });

    return Response.json({ date: rows[0]?.date, pivot: PIVOT, count: rows.length });
  }),
};
