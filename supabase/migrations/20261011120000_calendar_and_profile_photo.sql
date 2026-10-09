-- Owner requests, 2026-10-10: a calendar of daily spending on the Transactions page, and a
-- profile photo instead of the generic person icon.

-- ---------------------------------------------------------------------------
-- Calendar: income and expense per day of a month
-- ---------------------------------------------------------------------------
-- Base currency, from the stored base amounts (architecture rule 2: derived values come from SQL).
-- Only days with activity are returned; the calendar shows the rest as empty. IOU movements are
-- left out by default, matching Home, Budgets and Reports. RLS limits it to the caller's rows.
create function public.daily_totals(p_month date, p_exclude_iou boolean default true)
returns table (day date, income_minor bigint, expense_minor bigint, transaction_count integer)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    t.date,
    coalesce(sum(t.base_amount_minor) filter (where t.type = 'income'), 0)::bigint,
    coalesce(sum(t.base_amount_minor) filter (where t.type = 'expense'), 0)::bigint,
    count(*)::integer
  from public.transactions t
  where t.deleted_at is null
    and (not p_exclude_iou or t.iou_id is null)
    and t.date >= date_trunc('month', p_month)::date
    and t.date < (date_trunc('month', p_month) + interval '1 month')::date
  group by t.date
  order by t.date
$$;

revoke all on function public.daily_totals(date, boolean) from public, anon;
grant execute on function public.daily_totals(date, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- Profile photo
-- ---------------------------------------------------------------------------
-- A small square image (resized and re-encoded in the browser, which also drops photo metadata
-- such as GPS location), stored inline as a data URL. No separate file storage to set up or
-- secure, and it goes with the profile when the account is deleted. Raster formats only (an
-- SVG can carry scripts) and at most ~50 KB.
alter table public.profiles
  add column avatar_data_url text
  constraint profiles_avatar_data_url_check check (
    avatar_data_url is null or (
      char_length(avatar_data_url) <= 70000
      and avatar_data_url ~ '^data:image/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$'
    )
  );

grant update (avatar_data_url) on public.profiles to authenticated;
