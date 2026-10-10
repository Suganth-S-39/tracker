-- Savings goals (owner request, 2026-10-10): saving up for one specific thing ("New phone").
--
-- * Money in: a savings transaction linked to the goal (transactions.goal_id), made in the Add
--   form like any other saving. It's an ordinary transaction: it can be edited or deleted, as
--   long as the goal never ends up below zero.
-- * Money out: take_from_goal records a 'withdrawal', which puts it back in the month's balance.
-- * Bought: complete_goal takes out whatever is in the goal and records the purchase as an expense
--   linked to the goal, in one call. The balance doesn't drop twice (the money was set aside
--   already) and budgets leave the purchase out; it still shows in Transactions and Reports.
--   reopen_goal undoes it.
-- * Progress (what's in the goal, recent pace) is derived in goal_list, never stored.
-- Withdrawals and purchases change only through these functions (app.goal_write flag, like the
-- IOU functions).

-- ---------------------------------------------------------------------------
-- goals
-- ---------------------------------------------------------------------------
create table public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  -- What it costs, in base-currency minor units (the base currency is locked once chosen).
  target_minor bigint not null check (target_minor > 0),
  target_date date,
  -- Icon key from the app's goal icon set (kebab-case).
  icon text not null default 'target' check (icon ~ '^[a-z0-9-]{1,40}$'),
  -- Optional photo of the thing: same format and limits as the profile photo.
  photo_data_url text constraint goals_photo_data_url_check check (
    photo_data_url is null or (
      char_length(photo_data_url) <= 70000
      and photo_data_url ~ '^data:image/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$'
    )
  ),
  -- Set by complete_goal, cleared by reopen_goal.
  bought_on date,
  purchase_transaction_id uuid,
  -- The withdrawal of what was in the goal when it was bought (none if it was empty).
  closing_transaction_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint goals_user_id_id_key unique (user_id, id),
  constraint goals_bought_has_purchase check ((bought_on is null) = (purchase_transaction_id is null)),
  constraint goals_closing_needs_purchase check (closing_transaction_id is null or purchase_transaction_id is not null)
);

create index goals_user_idx on public.goals (user_id) where deleted_at is null;

create trigger set_updated_at before update on public.goals
  for each row execute function private.set_updated_at();

alter table public.goals enable row level security;

create policy "Users read own rows" on public.goals
  for select to authenticated using (user_id = (select auth.uid()));
create policy "Users create own rows" on public.goals
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "Users update own rows" on public.goals
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- No DELETE (soft delete). The bought columns are writable only so the (security invoker) goal
-- functions can set them; goals_guard rejects changes to them from anywhere else.
revoke all on public.goals from anon, authenticated;
grant select on public.goals to authenticated;
grant insert (name, target_minor, target_date, icon, photo_data_url) on public.goals to authenticated;
grant update (name, target_minor, target_date, icon, photo_data_url, deleted_at,
              bought_on, purchase_transaction_id, closing_transaction_id) on public.goals to authenticated;

create function private.goals_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (new.bought_on is distinct from old.bought_on
      or new.purchase_transaction_id is distinct from old.purchase_transaction_id
      or new.closing_transaction_id is distinct from old.closing_transaction_id)
     and coalesce(current_setting('app.goal_write', true), '') <> 'on' then
    raise exception 'goal_managed' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger goals_guard before update on public.goals
  for each row execute function private.goals_guard();

-- ---------------------------------------------------------------------------
-- Transactions linked to a goal
-- ---------------------------------------------------------------------------
alter table public.transactions add column goal_id uuid;

-- Deferred, like the IOU links: a goal and its purchase reference each other, and deleting an
-- account removes both in one go.
alter table public.transactions
  add constraint transactions_goal_fkey foreign key (user_id, goal_id)
    references public.goals (user_id, id) deferrable initially deferred,
  add constraint transactions_withdrawal_has_goal check (type <> 'withdrawal' or goal_id is not null),
  -- Savings put in, withdrawals taken out, and the purchase (an expense).
  add constraint transactions_goal_kinds check (goal_id is null or type in ('savings', 'withdrawal', 'expense')),
  add constraint transactions_goal_not_iou check (goal_id is null or iou_id is null),
  -- Repeat isn't offered for goal savings (DECISIONS.md).
  add constraint transactions_goal_not_recurring check (goal_id is null or recurring_rule_id is null);

alter table public.goals
  add constraint goals_purchase_fkey foreign key (user_id, purchase_transaction_id)
    references public.transactions (user_id, id) deferrable initially deferred,
  add constraint goals_closing_fkey foreign key (user_id, closing_transaction_id)
    references public.transactions (user_id, id) deferrable initially deferred;

create index transactions_goal_idx on public.transactions (goal_id) where goal_id is not null;

-- ---------------------------------------------------------------------------
-- The reserved category for money taken out of a goal
-- ---------------------------------------------------------------------------
alter table public.categories drop constraint categories_system_key_kind;
alter table public.categories
  add constraint categories_system_key_kind check (
    system_key is null
    or (system_key in ('lent', 'repayment_paid') and kind = 'expense')
    or (system_key in ('repayment_received', 'borrowed') and kind = 'income')
    or (system_key = 'goal_withdrawal' and kind = 'withdrawal')
  ),
  -- Withdrawals only ever use the reserved category.
  add constraint categories_withdrawal_is_system check (kind <> 'withdrawal' or is_system);

-- Signup creates it with the IOU ones. The UI shows its name by system_key; this one is a fallback.
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id, email, display_name)
  values (
    new.id,
    new.email,
    nullif(btrim(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', '')), '')
  );

  insert into public.categories (user_id, name, icon, kind, is_system, system_key, sort_order)
  values
    (new.id, 'Lent', 'hand-coins', 'expense', true, 'lent', 1000),
    (new.id, 'Repayment paid', 'hand-coins', 'expense', true, 'repayment_paid', 1001),
    (new.id, 'Borrowed', 'handshake', 'income', true, 'borrowed', 1000),
    (new.id, 'Repayment received', 'handshake', 'income', true, 'repayment_received', 1001),
    (new.id, 'From a goal', 'target', 'withdrawal', true, 'goal_withdrawal', 1000);

  return new;
end;
$$;

-- Existing accounts get it once.
insert into public.categories (user_id, name, icon, kind, is_system, system_key, sort_order)
select p.user_id, 'From a goal', 'target', 'withdrawal', true, 'goal_withdrawal', 1000
from public.profiles p
on conflict (user_id, system_key) do nothing;

-- Reserved categories (IOU and goal) only on the rows their functions write.
create or replace function private.transactions_validate()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_base_currency text;
  v_from_exponent integer;
  v_to_exponent integer;
begin
  perform private.assert_category_usable(
    new.user_id, new.category_id, new.type, new.iou_id is not null or new.type = 'withdrawal'
  );

  select base_currency into v_base_currency from public.profiles where user_id = new.user_id;
  if v_base_currency is null then
    raise exception 'onboarding_required' using errcode = 'P0001';
  end if;

  if new.original_currency = v_base_currency then
    if new.exchange_rate <> 1 or new.base_amount_minor <> new.original_amount_minor then
      raise exception 'base_amount_mismatch' using errcode = '23514';
    end if;
  else
    select exponent into v_from_exponent from public.currencies where code = new.original_currency;
    select exponent into v_to_exponent from public.currencies where code = v_base_currency;
    if abs(
      private.convert_minor(new.original_amount_minor, new.exchange_rate, v_from_exponent, v_to_exponent)
      - new.base_amount_minor
    ) > 1 then
      raise exception 'base_amount_mismatch' using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Goal integrity
-- ---------------------------------------------------------------------------

-- What's in a goal now: put in minus taken out (base currency).
create function private.goal_balance(p_goal_id uuid)
returns bigint
language sql
stable
set search_path = ''
as $$
  select coalesce(sum(case t.type when 'savings' then t.base_amount_minor else -t.base_amount_minor end), 0)::bigint
  from public.transactions t
  where t.goal_id = p_goal_id
    and t.deleted_at is null
    and t.type in ('savings', 'withdrawal')
$$;

-- Locks an open goal (not deleted, not bought) for a change to its money, so two changes at once
-- can't overdraw it.
create function private.lock_open_goal(p_goal_id uuid)
returns public.goals
language plpgsql
set search_path = ''
as $$
declare
  v_goal public.goals;
begin
  select * into v_goal from public.goals where id = p_goal_id and deleted_at is null for update;
  if not found then
    raise exception 'goal_not_found' using errcode = 'P0002';
  end if;
  if v_goal.bought_on is not null then
    raise exception 'goal_closed' using errcode = 'P0001';
  end if;
  return v_goal;
end;
$$;

-- Withdrawals and purchases belong to the goal functions. Savings put into a goal are ordinary
-- transactions, but money only moves into or out of an open goal: once it's bought, what it was
-- bought with is fixed (reopen it to change that).
create function private.transactions_goal_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_old_managed boolean := false;
  -- Money moves into or out of a goal.
  v_moves boolean := true;
  -- The row joins a goal (new, moved to another goal, or restored).
  v_joins boolean := true;
  v_goal public.goals;
begin
  if tg_op = 'UPDATE' then
    v_old_managed := old.type = 'withdrawal' or (old.type = 'expense' and old.goal_id is not null);
    v_joins := new.goal_id is distinct from old.goal_id or old.deleted_at is not null;
    v_moves := v_joins
      or new.type <> old.type
      or new.base_amount_minor <> old.base_amount_minor
      or (new.deleted_at is null) <> (old.deleted_at is null);
  end if;

  if v_old_managed or new.type = 'withdrawal' or (new.type = 'expense' and new.goal_id is not null) then
    if coalesce(current_setting('app.goal_write', true), '') <> 'on' then
      raise exception 'goal_managed' using errcode = 'P0001';
    end if;
    return new;
  end if;

  if not v_moves then
    return new;
  end if;

  -- A deleted goal keeps its history but takes no new money; its old savings can still change.
  if new.goal_id is not null and new.deleted_at is null then
    select * into v_goal from public.goals where id = new.goal_id and user_id = new.user_id for update;
    if not found or (v_goal.deleted_at is not null and v_joins) then
      raise exception 'goal_not_found' using errcode = 'P0002';
    end if;
    if v_goal.deleted_at is null and v_goal.bought_on is not null then
      raise exception 'goal_closed' using errcode = 'P0001';
    end if;
  end if;

  if tg_op = 'UPDATE' and old.goal_id is not null then
    select * into v_goal from public.goals where id = old.goal_id for update;
    if found and v_goal.deleted_at is null and v_goal.bought_on is not null then
      raise exception 'goal_closed' using errcode = 'P0001';
    end if;
  end if;

  return new;
end;
$$;

create trigger transactions_goal_guard_insert before insert on public.transactions
  for each row when (new.goal_id is not null) execute function private.transactions_goal_guard();
create trigger transactions_goal_guard_update before update on public.transactions
  for each row when (old.goal_id is not null or new.goal_id is not null)
  execute function private.transactions_goal_guard();

-- After any change to a goal's money: an open goal never holds less than nothing (e.g. deleting
-- savings that were already taken out again).
create function private.transactions_goal_balance()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_goal_id uuid;
  v_goal_ids uuid[] := array[new.goal_id];
begin
  if tg_op = 'UPDATE' then
    v_goal_ids := v_goal_ids || old.goal_id;
  end if;

  foreach v_goal_id in array v_goal_ids loop
    continue when v_goal_id is null;
    if exists (
      select 1 from public.goals g
      where g.id = v_goal_id and g.deleted_at is null and g.bought_on is null
    ) and private.goal_balance(v_goal_id) < 0 then
      raise exception 'goal_balance_negative' using errcode = '23514';
    end if;
  end loop;
  return null;
end;
$$;

create trigger transactions_goal_balance_insert after insert on public.transactions
  for each row when (new.goal_id is not null) execute function private.transactions_goal_balance();
create trigger transactions_goal_balance_update after update on public.transactions
  for each row when (old.goal_id is not null or new.goal_id is not null)
  execute function private.transactions_goal_balance();

revoke all on function private.goals_guard() from public, anon, authenticated;
revoke all on function private.transactions_goal_guard() from public, anon, authenticated;
revoke all on function private.transactions_goal_balance() from public, anon, authenticated;
revoke all on function private.goal_balance(uuid) from public, anon;
revoke all on function private.lock_open_goal(uuid) from public, anon;
-- Called from triggers and security-invoker functions running as the signed-in user.
grant execute on function private.goal_balance(uuid) to authenticated;
grant execute on function private.lock_open_goal(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Transactions: Add / Edit gain "For a goal" (savings only)
-- ---------------------------------------------------------------------------
drop function public.create_transaction(public.transaction_type, uuid, date, bigint, text, text, bigint, text, text, public.recurrence_frequency);

create function public.create_transaction(
  p_type public.transaction_type,
  p_category_id uuid,
  p_date date,
  p_original_amount_minor bigint,
  p_original_currency text,
  p_exchange_rate text,
  p_base_amount_minor bigint,
  p_payee text default null,
  p_note text default null,
  p_repeat public.recurrence_frequency default null,
  p_goal_id uuid default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
  v_rule_id uuid;
  v_payee text := nullif(btrim(p_payee), '');
  v_note text := nullif(btrim(p_note), '');
begin
  if p_goal_id is not null and p_repeat is not null then
    raise exception 'goal_repeat_unsupported' using errcode = '23514';
  end if;

  if p_repeat is not null then
    -- The first occurrence is this transaction (even if future-dated); the job takes it from
    -- there, back-filling any due dates already in the past (DECISIONS.md).
    insert into public.recurring_rules (
      type, category_id, amount_minor, currency, payee, note, frequency, anchor_day, next_due_date
    )
    values (
      p_type, p_category_id, p_original_amount_minor, p_original_currency, v_payee, v_note, p_repeat,
      extract(day from p_date)::smallint,
      private.next_occurrence(p_date, p_repeat, extract(day from p_date)::integer)
    )
    returning id into v_rule_id;
  end if;

  insert into public.transactions (
    type, category_id, date, payee, note, original_amount_minor, original_currency,
    base_amount_minor, exchange_rate, recurring_rule_id, occurrence_date, goal_id
  )
  values (
    p_type, p_category_id, p_date, v_payee, v_note, p_original_amount_minor, p_original_currency,
    p_base_amount_minor, p_exchange_rate::numeric, v_rule_id, case when v_rule_id is null then null else p_date end,
    p_goal_id
  )
  returning id into v_id;

  return v_id;
end;
$$;

drop function public.update_transaction(uuid, public.transaction_type, uuid, date, bigint, text, text, bigint, text, text);

create function public.update_transaction(
  p_id uuid,
  p_type public.transaction_type,
  p_category_id uuid,
  p_date date,
  p_original_amount_minor bigint,
  p_original_currency text,
  p_exchange_rate text,
  p_base_amount_minor bigint,
  p_payee text default null,
  p_note text default null,
  p_goal_id uuid default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.transactions
  set type = p_type,
      category_id = p_category_id,
      date = p_date,
      payee = nullif(btrim(p_payee), ''),
      note = nullif(btrim(p_note), ''),
      original_amount_minor = p_original_amount_minor,
      original_currency = p_original_currency,
      base_amount_minor = p_base_amount_minor,
      exchange_rate = p_exchange_rate::numeric,
      goal_id = p_goal_id
  where id = p_id
    and deleted_at is null
    -- IOU-linked transactions change only through the IOU functions (phase 4); withdrawals and
    -- purchases only through the goal functions (transactions_goal_guard says so).
    and iou_id is null;

  if not found then
    raise exception 'transaction_not_found' using errcode = 'P0002';
  end if;
  return p_id;
end;
$$;

-- The list returns the goal (and its name, so rows can say which goal without another request)
-- and can show one goal's money.
drop function public.list_transactions(integer, date, timestamptz, uuid, public.transaction_type, uuid, date, date, text);

create function public.list_transactions(
  p_limit integer default 50,
  p_cursor_date date default null,
  p_cursor_created_at timestamptz default null,
  p_cursor_id uuid default null,
  p_type public.transaction_type default null,
  p_category_id uuid default null,
  p_from date default null,
  p_to date default null,
  p_search text default null,
  p_goal_id uuid default null
)
returns table (
  id uuid,
  type public.transaction_type,
  category_id uuid,
  date date,
  payee text,
  note text,
  original_amount_minor bigint,
  original_currency text,
  base_amount_minor bigint,
  exchange_rate text,
  recurring_rule_id uuid,
  iou_id uuid,
  goal_id uuid,
  goal_name text,
  created_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    t.id, t.type, t.category_id, t.date, t.payee, t.note,
    t.original_amount_minor, t.original_currency, t.base_amount_minor, t.exchange_rate::text,
    t.recurring_rule_id, t.iou_id, t.goal_id, g.name, t.created_at
  from public.transactions t
  left join public.goals g on g.id = t.goal_id
  where t.deleted_at is null
    and (p_cursor_date is null
         or (t.date, t.created_at, t.id) < (p_cursor_date, p_cursor_created_at, p_cursor_id))
    and (p_type is null or t.type = p_type)
    and (p_category_id is null or t.category_id = p_category_id)
    and (p_from is null or t.date >= p_from)
    and (p_to is null or t.date <= p_to)
    and (p_goal_id is null or t.goal_id = p_goal_id)
    and (coalesce(btrim(p_search), '') = ''
         or (coalesce(t.payee, '') || ' ' || coalesce(t.note, ''))
            ilike '%' || private.escape_like(btrim(p_search)) || '%')
  order by t.date desc, t.created_at desc, t.id desc
  limit least(greatest(coalesce(p_limit, 50), 1), 200)
$$;

revoke all on function public.create_transaction(public.transaction_type, uuid, date, bigint, text, text, bigint, text, text, public.recurrence_frequency, uuid)
  from public, anon;
revoke all on function public.update_transaction(uuid, public.transaction_type, uuid, date, bigint, text, text, bigint, text, text, uuid)
  from public, anon;
revoke all on function public.list_transactions(integer, date, timestamptz, uuid, public.transaction_type, uuid, date, date, text, uuid)
  from public, anon;
grant execute on function public.create_transaction(public.transaction_type, uuid, date, bigint, text, text, bigint, text, text, public.recurrence_frequency, uuid)
  to authenticated;
grant execute on function public.update_transaction(uuid, public.transaction_type, uuid, date, bigint, text, text, bigint, text, text, uuid)
  to authenticated;
grant execute on function public.list_transactions(integer, date, timestamptz, uuid, public.transaction_type, uuid, date, date, text, uuid)
  to authenticated;

-- ---------------------------------------------------------------------------
-- Month totals and budgets
-- ---------------------------------------------------------------------------

-- Savings is what was set aside this month net of what was taken back out of goals (including to
-- pay for a goal's purchase, which counts as an expense). So buying with saved money leaves the
-- balance where it was, and the balance stays income - expenses - savings - investments.
create or replace function public.month_summary(p_month date)
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
      coalesce(sum(t.base_amount_minor) filter (where t.type = 'savings'), 0)
        - coalesce(sum(t.base_amount_minor) filter (where t.type = 'withdrawal'), 0) as savings,
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

-- A goal's purchase was saved up for separately, so it doesn't use up the month's budgets.
create or replace function public.budget_status(p_month date)
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
      and t.goal_id is null
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

-- ---------------------------------------------------------------------------
-- Goal actions
-- ---------------------------------------------------------------------------

-- Takes money out of an open goal, back into the balance. Base currency, at most what's in it.
create function public.take_from_goal(p_goal_id uuid, p_amount_minor bigint, p_date date, p_note text default null)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
  v_base_currency text;
begin
  perform private.lock_open_goal(p_goal_id);
  if p_amount_minor > private.goal_balance(p_goal_id) then
    raise exception 'goal_take_exceeds_saved' using errcode = '23514';
  end if;
  select base_currency into v_base_currency from public.profiles where user_id = (select auth.uid());

  perform set_config('app.goal_write', 'on', true);
  insert into public.transactions (
    type, category_id, date, note, original_amount_minor, original_currency,
    base_amount_minor, exchange_rate, goal_id
  )
  values (
    'withdrawal', private.system_category_id('goal_withdrawal'), p_date, nullif(btrim(p_note), ''),
    p_amount_minor, v_base_currency, p_amount_minor, 1, p_goal_id
  )
  returning id into v_id;
  perform set_config('app.goal_write', '', true);
  return v_id;
end;
$$;

-- Deletes (or, for Undo, restores) a withdrawal from an open goal. Restoring is checked against
-- what's in the goal again, by transactions_goal_balance.
create function public.set_goal_withdrawal_deleted(p_id uuid, p_deleted boolean)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_goal_id uuid;
begin
  select goal_id into v_goal_id
  from public.transactions
  where id = p_id and type = 'withdrawal' and (deleted_at is null) = p_deleted;
  if not found then
    raise exception 'transaction_not_found' using errcode = 'P0002';
  end if;
  perform private.lock_open_goal(v_goal_id);

  perform set_config('app.goal_write', 'on', true);
  update public.transactions
  set deleted_at = case when p_deleted then now() else null end
  where id = p_id;
  perform set_config('app.goal_write', '', true);
end;
$$;

-- "I bought it": takes out everything in the goal and records what it actually cost as an expense
-- in the chosen category, in one call. If it cost less, the rest stays in the balance; if more,
-- the extra comes out of the balance like any expense.
create function public.complete_goal(
  p_goal_id uuid,
  p_category_id uuid,
  p_date date,
  p_amount_minor bigint,
  p_payee text default null,
  p_note text default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_goal public.goals;
  v_balance bigint;
  v_base_currency text;
  v_closing_id uuid;
  v_purchase_id uuid;
begin
  v_goal := private.lock_open_goal(p_goal_id);
  v_balance := private.goal_balance(p_goal_id);
  select base_currency into v_base_currency from public.profiles where user_id = (select auth.uid());

  perform set_config('app.goal_write', 'on', true);

  if v_balance > 0 then
    insert into public.transactions (
      type, category_id, date, original_amount_minor, original_currency, base_amount_minor, exchange_rate, goal_id
    )
    values (
      'withdrawal', private.system_category_id('goal_withdrawal'), p_date,
      v_balance, v_base_currency, v_balance, 1, p_goal_id
    )
    returning id into v_closing_id;
  end if;

  insert into public.transactions (
    type, category_id, date, payee, note, original_amount_minor, original_currency,
    base_amount_minor, exchange_rate, goal_id
  )
  values (
    'expense', p_category_id, p_date, coalesce(nullif(btrim(p_payee), ''), btrim(v_goal.name)), nullif(btrim(p_note), ''),
    p_amount_minor, v_base_currency, p_amount_minor, 1, p_goal_id
  )
  returning id into v_purchase_id;

  update public.goals
  set bought_on = p_date,
      purchase_transaction_id = v_purchase_id,
      closing_transaction_id = v_closing_id
  where id = p_goal_id;

  perform set_config('app.goal_write', '', true);
  return p_goal_id;
end;
$$;

-- "Not bought yet": removes the purchase and puts the money back in the goal.
create function public.reopen_goal(p_goal_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_goal public.goals;
begin
  select * into v_goal from public.goals where id = p_goal_id and deleted_at is null for update;
  if not found then
    raise exception 'goal_not_found' using errcode = 'P0002';
  end if;
  if v_goal.bought_on is null then
    raise exception 'goal_not_bought' using errcode = 'P0001';
  end if;

  perform set_config('app.goal_write', 'on', true);
  update public.transactions
  set deleted_at = now()
  where id in (v_goal.purchase_transaction_id, v_goal.closing_transaction_id) and deleted_at is null;
  update public.goals
  set bought_on = null, purchase_transaction_id = null, closing_transaction_id = null
  where id = p_goal_id;
  perform set_config('app.goal_write', '', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- Reads
-- ---------------------------------------------------------------------------

-- Every goal with its progress, open ones first (soonest target date first), then bought ones
-- (latest first). Base currency. The pace numbers cover the 8 weeks up to p_today (the browser's
-- date): what was put in minus taken out, and when money first went in. Photos aren't included
-- (they're large and rarely change): has_photo says to fetch them, updated_at when to refetch.
create function public.goal_list(p_today date)
returns table (
  id uuid,
  name text,
  target_minor bigint,
  target_date date,
  icon text,
  has_photo boolean,
  bought_on date,
  purchase_transaction_id uuid,
  closing_transaction_id uuid,
  created_at timestamptz,
  updated_at timestamptz,
  -- In the goal now.
  saved_minor bigint,
  -- Ever put in.
  added_minor bigint,
  -- Taken back out (not counting what paid for it).
  taken_minor bigint,
  -- What it cost (bought goals).
  spent_minor bigint,
  recent_net_minor bigint,
  first_added_on date
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    g.id, g.name, g.target_minor, g.target_date, g.icon, g.photo_data_url is not null,
    g.bought_on, g.purchase_transaction_id, g.closing_transaction_id, g.created_at, g.updated_at,
    (coalesce(sum(t.base_amount_minor) filter (where t.type = 'savings'), 0)
      - coalesce(sum(t.base_amount_minor) filter (where t.type = 'withdrawal'), 0))::bigint,
    coalesce(sum(t.base_amount_minor) filter (where t.type = 'savings'), 0)::bigint,
    coalesce(sum(t.base_amount_minor) filter (
      where t.type = 'withdrawal' and t.id is distinct from g.closing_transaction_id
    ), 0)::bigint,
    coalesce(sum(t.base_amount_minor) filter (where t.type = 'expense'), 0)::bigint,
    coalesce(sum(case when t.type = 'savings' then t.base_amount_minor else -t.base_amount_minor end) filter (
      where t.type in ('savings', 'withdrawal')
        and t.id is distinct from g.closing_transaction_id
        and t.date between p_today - 55 and p_today
    ), 0)::bigint,
    min(t.date) filter (where t.type = 'savings')
  from public.goals g
  left join public.transactions t on t.goal_id = g.id and t.deleted_at is null
  where g.deleted_at is null
  group by g.id
  order by g.bought_on is not null, g.bought_on desc, g.target_date nulls last, g.created_at
$$;

revoke all on function public.take_from_goal(uuid, bigint, date, text) from public, anon;
revoke all on function public.set_goal_withdrawal_deleted(uuid, boolean) from public, anon;
revoke all on function public.complete_goal(uuid, uuid, date, bigint, text, text) from public, anon;
revoke all on function public.reopen_goal(uuid) from public, anon;
revoke all on function public.goal_list(date) from public, anon;
grant execute on function public.take_from_goal(uuid, bigint, date, text) to authenticated;
grant execute on function public.set_goal_withdrawal_deleted(uuid, boolean) to authenticated;
grant execute on function public.complete_goal(uuid, uuid, date, bigint, text, text) to authenticated;
grant execute on function public.reopen_goal(uuid) to authenticated;
grant execute on function public.goal_list(date) to authenticated;
