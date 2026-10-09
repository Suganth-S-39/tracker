import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from '../api/cron/fetch-rates';

const ENDPOINT = 'https://cron.example/api/cron/fetch-rates';
const call = (authorization?: string) =>
  GET(new Request(ENDPOINT, { headers: authorization ? { authorization } : {} }));

describe('cron: fetch-rates', () => {
  const upstream = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubEnv('CRON_SECRET', 'cron-secret-value');
    vi.stubEnv('SUPABASE_URL', 'https://project.supabase.co');
    vi.stubEnv('SUPABASE_SECRET_KEY', 'sb_secret_test');
    upstream.mockReset();
    upstream.mockResolvedValue(Response.json({ date: '2026-10-09', pivot: 'EUR', count: 30 }));
    vi.stubGlobal('fetch', upstream);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('refuses requests without the cron secret', async () => {
    expect((await call()).status).toBe(401);
    expect((await call('Bearer wrong')).status).toBe(401);
    expect((await call('cron-secret-value')).status).toBe(401);
    expect(upstream).not.toHaveBeenCalled();
  });

  it('refuses everything when CRON_SECRET is not configured', async () => {
    vi.stubEnv('CRON_SECRET', '');
    expect((await call('Bearer ')).status).toBe(401);
    expect((await call('Bearer undefined')).status).toBe(401);
    expect(upstream).not.toHaveBeenCalled();
  });

  it('calls the Edge Function with the secret key and passes its result through', async () => {
    const response = await call('Bearer cron-secret-value');

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ date: '2026-10-09', pivot: 'EUR', count: 30 });
    expect(upstream).toHaveBeenCalledTimes(1);
    const [url, init] = upstream.mock.calls[0]!;
    expect(url instanceof URL ? url.href : url).toBe('https://project.supabase.co/functions/v1/fetch-rates');
    expect(init?.method).toBe('POST');
    expect(init?.headers).toEqual({ apikey: 'sb_secret_test' });
  });

  it('reports a failed fetch as 502', async () => {
    upstream.mockResolvedValue(Response.json({ error: 'Provider returned 503' }, { status: 502 }));
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const response = await call('Bearer cron-secret-value');
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: 'Provider returned 503' });
  });

  it('fails clearly when the Supabase settings are missing', async () => {
    vi.stubEnv('SUPABASE_SECRET_KEY', '');
    const response = await call('Bearer cron-secret-value');
    expect(response.status).toBe(500);
    expect(upstream).not.toHaveBeenCalled();
  });
});
