-- Phase 3: budgets (carry forward) and report queries.
--
-- Budgets carry forward (DECISIONS.md): a budget set for a month applies to that month and every
-- later month until a newer one is set for the same category (or overall). An amount of 0 clears
-- it from that month on. Usage is derived here, never stored.

-- Sets the budget for a month (overall when p_category_id is null), replacing one already set for
-- that same month. Runs as the calling user, so RLS applies.
create function public.set_budget(p_month date, p_category_id uuid, p_amount_minor bigint)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_month date := date_trunc('month', p_month)::date;
begin
  update public.budgets
  set amount_minor = p_amount_minor
  where user_id = (select auth.uid())
    and month = v_month
    and category_id is not distinct from p_category_id
    and deleted_at is null;

  if not found then
    insert into public.budgets (month, category_id, amount_minor)
    values (v_month, p_category_id, p_amount_minor);
  end if;
end;
$$;

-- Effective budgets for a month with what has been spent against them, in base minor units.
-- Spending = expense transactions in that calendar month, excluding IOU-linked ones; the overall
-- budget counts every such expense. Only budgets above zero are returned.
create function public.budget_status(p_month date)
returns table (category_id uuid, amount_minor bigint, spent_minor bigint, set_for_month date)
language sql
stable
security invoker
set search_path = ''
as $$
  with bounds as (
    select date_trunc('month', p_month)::date as first_day,
           (date_trunc('month', p_month) + interval '1 month')::date as next_month
  ),
  effective as (
    -- Latest budget at or before the month, per category (null = overall is one group).
    select distinct on (b.category_id) b.category_id, b.amount_minor, b.month
    from public.budgets b, bounds
    where b.deleted_at is null and b.month <= bounds.first_day
    order by b.category_id, b.month desc, b.updated_at desc
  ),
  spending as (
    select t.category_id, sum(t.base_amount_minor) as spent
    from public.transactions t, bounds
    where t.deleted_at is null
      and t.iou_id is null
      and t.type = 'expense'
      and t.date >= bounds.first_day
      and t.date < bounds.next_month
    group by t.category_id
  )
  select
    e.category_id,
    e.amount_minor,
    (case
       when e.category_id is null then (select coalesce(sum(s.spent), 0) from spending s)
       else coalesce((select s.spent from spending s where s.category_id = e.category_id), 0)
     end)::bigint,
    e.month
  from effective e
  where e.amount_minor > 0
  order by e.category_id nulls first
$$;

-- Spending per category for a month, largest first. IOU movements (the Lent and Repayment paid
-- system categories) are left out unless p_exclude_iou is false.
create function public.spending_by_category(p_month date, p_exclude_iou boolean default true)
returns table (category_id uuid, spent_minor bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select t.category_id, sum(t.base_amount_minor)::bigint as spent
  from public.transactions t
  where t.deleted_at is null
    and t.type = 'expense'
    and (not p_exclude_iou or t.iou_id is null)
    and t.date >= date_trunc('month', p_month)::date
    and t.date < (date_trunc('month', p_month) + interval '1 month')::date
  group by t.category_id
  having sum(t.base_amount_minor) > 0
  order by spent desc, t.category_id
$$;

-- Income and expense per calendar month for a range of months (inclusive), including months with
-- no transactions, oldest first. Owner addition: the Reports bar chart.
create function public.monthly_totals(p_from_month date, p_to_month date, p_exclude_iou boolean default true)
returns table (month date, income_minor bigint, expense_minor bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  with months as (
    select generate_series(
      date_trunc('month', p_from_month),
      date_trunc('month', p_to_month),
      interval '1 month'
    )::date as month
  )
  select
    m.month,
    coalesce(sum(t.base_amount_minor) filter (where t.type = 'income'), 0)::bigint,
    coalesce(sum(t.base_amount_minor) filter (where t.type = 'expense'), 0)::bigint
  from months m
  left join public.transactions t
    on t.deleted_at is null
   and (not p_exclude_iou or t.iou_id is null)
   and t.date >= m.month
   and t.date < (m.month + interval '1 month')::date
  group by m.month
  order by m.month
$$;

revoke all on function public.set_budget(date, uuid, bigint) from public, anon;
revoke all on function public.budget_status(date) from public, anon;
revoke all on function public.spending_by_category(date, boolean) from public, anon;
revoke all on function public.monthly_totals(date, date, boolean) from public, anon;
grant execute on function public.set_budget(date, uuid, bigint) to authenticated;
grant execute on function public.budget_status(date) to authenticated;
grant execute on function public.spending_by_category(date, boolean) to authenticated;
grant execute on function public.monthly_totals(date, date, boolean) to authenticated;
