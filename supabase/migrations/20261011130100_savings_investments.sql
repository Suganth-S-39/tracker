-- Savings and investments (owner request, 2026-10-10).
--
-- Money set aside or invested is recorded with its own kind ('savings', 'investment') and its
-- own categories. It isn't spending: budgets, the spending report and the calendar's "spent"
-- count expenses only (those queries already filter on type = 'expense'). Home shows it in its
-- own tiles, and the month's balance is what's left after expenses, savings and investments.

-- ---------------------------------------------------------------------------
-- Month summary with savings and investments
-- ---------------------------------------------------------------------------
-- The return type changes, so the function is replaced. IOU-linked transactions stay excluded.
drop function public.month_summary(date);

create function public.month_summary(p_month date)
returns table (income_minor bigint, expense_minor bigint, savings_minor bigint, investment_minor bigint, net_minor bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  with totals as (
    select
      coalesce(sum(t.base_amount_minor) filter (where t.type = 'income'), 0) as income,
      coalesce(sum(t.base_amount_minor) filter (where t.type = 'expense'), 0) as expense,
      coalesce(sum(t.base_amount_minor) filter (where t.type = 'savings'), 0) as savings,
      coalesce(sum(t.base_amount_minor) filter (where t.type = 'investment'), 0) as investment
    from public.transactions t
    where t.deleted_at is null
      and t.iou_id is null
      and t.date >= date_trunc('month', p_month)::date
      and t.date < (date_trunc('month', p_month) + interval '1 month')::date
  )
  select income::bigint, expense::bigint, savings::bigint, investment::bigint,
         (income - expense - savings - investment)::bigint
  from totals
$$;

revoke all on function public.month_summary(date) from public, anon;
grant execute on function public.month_summary(date) to authenticated;

-- ---------------------------------------------------------------------------
-- Starter categories for the new kinds
-- ---------------------------------------------------------------------------
-- New users get them at onboarding (same function as before, plus the new rows).
create or replace function public.complete_onboarding(p_base_currency text, p_timezone text)
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
      timezone = p_timezone
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

-- Existing accounts get the same starter categories once (skipping a kind they already have
-- categories for, so running this again changes nothing).
insert into public.categories (user_id, name, icon, kind, is_default, sort_order)
select p.user_id, d.name, d.icon, d.kind::public.transaction_type, true, d.sort_order
from public.profiles p
cross join (
  values
    ('Savings account', 'piggy-bank', 'savings', 1),
    ('Emergency fund', 'shield-check', 'savings', 2),
    ('Fixed deposit', 'landmark', 'savings', 3),
    ('Mutual funds', 'trending-up', 'investment', 1),
    ('Stocks', 'chart-candlestick', 'investment', 2),
    ('Gold', 'coins', 'investment', 3),
    ('Retirement', 'sunset', 'investment', 4)
) as d(name, icon, kind, sort_order)
where p.base_currency is not null
  and not exists (
    select 1 from public.categories c
    where c.user_id = p.user_id and c.kind = d.kind::public.transaction_type
  );
