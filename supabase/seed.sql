-- Local development seed data (applied by `supabase db reset`).
-- Users, profiles and categories come from the signup trigger and onboarding.

-- Sample exchange rates so the Add form has rates without calling the provider. Stored the same
-- way the fetch-rates Edge Function stores them: against the EUR pivot, one row per quote.
-- Run the function locally to replace them with real rates (see supabase/functions/fetch-rates).
insert into public.exchange_rates (date, base, quote, rate)
values
  (current_date, 'EUR', 'USD', 1.1204),
  (current_date, 'EUR', 'INR', 108.28),
  (current_date, 'EUR', 'GBP', 0.8648),
  (current_date, 'EUR', 'JPY', 177.31),
  (current_date, 'EUR', 'KWD', 0.34642),
  (current_date, 'EUR', 'AED', 4.1146),
  (current_date, 'EUR', 'SGD', 1.4512),
  (current_date, 'EUR', 'AUD', 1.6950),
  (current_date, 'EUR', 'CAD', 1.5580),
  (current_date, 'EUR', 'CHF', 0.9351)
on conflict (date, base, quote) do nothing;
