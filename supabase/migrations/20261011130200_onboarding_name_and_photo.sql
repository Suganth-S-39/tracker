-- Owner request, 2026-10-10: first-run setup asks for the person's name (and optionally a photo)
-- along with the base currency, all saved in the one onboarding call. The name is required by the
-- setup screen; here both stay optional so other callers (and tests) are unaffected. The photo
-- goes through the profiles_avatar_data_url_check constraint like any other photo update.
drop function public.complete_onboarding(text, text);

create function public.complete_onboarding(
  p_base_currency text,
  p_timezone text,
  p_display_name text default null,
  p_avatar_data_url text default null
)
returns public.profiles
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_profile public.profiles;
begin
  update public.profiles
  set base_currency = p_base_currency,
      timezone = p_timezone,
      display_name = coalesce(nullif(btrim(p_display_name), ''), display_name),
      avatar_data_url = coalesce(p_avatar_data_url, avatar_data_url)
  where user_id = (select auth.uid())
    and base_currency is null
  returning * into v_profile;

  if not found then
    raise exception 'onboarding_already_completed' using errcode = 'P0001';
  end if;

  insert into public.categories (name, icon, kind, is_default, sort_order)
  values
    ('Food', 'utensils', 'expense', true, 1),
    ('Transport', 'bus', 'expense', true, 2),
    ('Rent', 'house', 'expense', true, 3),
    ('Shopping', 'shopping-bag', 'expense', true, 4),
    ('Bills', 'receipt', 'expense', true, 5),
    ('Health', 'heart-pulse', 'expense', true, 6),
    ('Entertainment', 'clapperboard', 'expense', true, 7),
    ('Salary', 'briefcase', 'income', true, 1),
    ('Other', 'sparkles', 'income', true, 2),
    ('Savings account', 'piggy-bank', 'savings', true, 1),
    ('Emergency fund', 'shield-check', 'savings', true, 2),
    ('Fixed deposit', 'landmark', 'savings', true, 3),
    ('Mutual funds', 'trending-up', 'investment', true, 1),
    ('Stocks', 'chart-candlestick', 'investment', true, 2),
    ('Gold', 'coins', 'investment', true, 3),
    ('Retirement', 'sunset', 'investment', true, 4);

  return v_profile;
end;
$$;

revoke all on function public.complete_onboarding(text, text, text, text) from public, anon;
grant execute on function public.complete_onboarding(text, text, text, text) to authenticated;
