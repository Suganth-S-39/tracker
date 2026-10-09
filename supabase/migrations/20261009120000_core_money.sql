-- Phase 2: money helpers, exchange-rate lookup, transaction functions and queries.

create extension if not exists pg_trgm with schema extensions;

-- ---------------------------------------------------------------------------
-- Money helpers (private). Same rules as src/domain/money.ts.
-- ---------------------------------------------------------------------------

-- Rounds half to even ("banker's rounding"): 2.5 -> 2, 3.5 -> 4, -2.5 -> -2.
-- Postgres round(numeric) rounds half away from zero, so it is only used off the halfway point.
create function private.round_half_even(p_value numeric, p_places integer default 0)
returns numeric
language sql
immutable
strict
parallel safe
set search_path = ''
as $$
  select case
    when abs(p_value) * power(10::numeric, p_places)
         - trunc(abs(p_value) * power(10::numeric, p_places)) = 0.5
    then sign(p_value)
         * (trunc(abs(p_value) * power(10::numeric, p_places))
            + mod(trunc(abs(p_value) * power(10::numeric, p_places)), 2))
         / power(10::numeric, p_places)
    else round(p_value, p_places)
  end
$$;

-- Converts minor units of one currency into minor units of another at `p_rate`
-- (1 major unit of the source = p_rate major units of the target), rounding half-even.
create function private.convert_minor(
  p_amount_minor bigint,
  p_rate numeric,
  p_from_exponent integer,
  p_to_exponent integer
)
returns bigint
language sql
immutable
strict
parallel safe
set search_path = ''
as $$
  select private.round_half_even(
    p_amount_minor * p_rate * power(10::numeric, p_to_exponent - p_from_exponent), 0
  )::bigint
$$;

-- Escapes LIKE wildcards in user search text.
create function private.escape_like(p_text text)
returns text
language sql
immutable
strict
parallel safe
set search_path = ''
as $$
  select replace(replace(replace(p_text, '\', '\\'), '%', '\%'), '_', '\_')
$$;

-- Precision of derived and stored rates (DECISIONS.md: 12 decimal places, half-even).
create function private.rate_scale()
returns integer
language sql
immutable
parallel safe
set search_path = ''
as $$ select 12 $$;

revoke all on function private.round_half_even(numeric, integer) from public, anon;
revoke all on function private.convert_minor(bigint, numeric, integer, integer) from public, anon;
revoke all on function private.escape_like(text) from public, anon;
revoke all on function private.rate_scale() from public, anon;
-- Called from security-invoker functions and triggers running as the signed-in user.
grant execute on function private.round_half_even(numeric, integer) to authenticated;
grant execute on function private.convert_minor(bigint, numeric, integer, integer) to authenticated;
grant execute on function private.escape_like(text) to authenticated;
grant execute on function private.rate_scale() to authenticated;

-- ---------------------------------------------------------------------------
-- Exchange-rate lookup
-- ---------------------------------------------------------------------------

-- Latest rate for 1 unit of p_from in p_to, derived through the pivot currency the rates are
-- stored against, rounded half-even to 12 decimal places. Returned as text so it reaches the
-- browser exactly (PostgREST sends numeric as a JSON number). No row when no rate is known.
create function public.latest_rate(p_from text, p_to text)
returns table (rate text, rate_date date)
language sql
stable
security invoker
set search_path = ''
as $$
  with legs as (
    select r.date, r.base, r.quote, r.rate
    from public.exchange_rates r
    where r.quote in (p_from, p_to)
    union all
    -- The pivot currency itself: rate 1 against itself on every date it was fetched.
    select distinct r.date, r.base, r.base, 1::numeric
    from public.exchange_rates r
    where r.base in (p_from, p_to)
  )
  select '1', null::date
  where p_from = p_to
  union all
  (
    select
      private.round_half_even(t.rate::numeric(48, 24) / f.rate, private.rate_scale())::text,
      f.date
    from legs f
    join legs t on t.date = f.date and t.base = f.base
    where p_from <> p_to and f.quote = p_from and t.quote = p_to
    order by f.date desc
    limit 1
  )
$$;

revoke all on function public.latest_rate(text, text) from public, anon;
grant execute on function public.latest_rate(text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Transactions: integrity
-- ---------------------------------------------------------------------------

-- The stored base amount must match original amount x rate (half-even, within 1 minor unit,
-- since a rate derived from a typed converted amount is rounded to 12 decimal places).
-- In the base currency itself the rate is exactly 1 and the amounts are equal.
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
  perform private.assert_category_usable(new.user_id, new.category_id, new.type, new.iou_id is not null);

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

-- Lists order by (date, created_at). now() is fixed for a whole database transaction, so rows
-- inserted together (e.g. recurring occurrences) would tie; clock_timestamp() keeps real order.
alter table public.transactions alter column created_at set default clock_timestamp();

-- Keyset pagination order (date, created_at, id), plus search over payee and note.
drop index public.transactions_user_date_idx;
create index transactions_user_date_idx
  on public.transactions (user_id, date desc, created_at desc, id desc)
  where deleted_at is null;
create index transactions_search_idx
  on public.transactions
  using gin ((coalesce(payee, '') || ' ' || coalesce(note, '')) extensions.gin_trgm_ops)
  where deleted_at is null;

-- ---------------------------------------------------------------------------
-- Transactions: writes. The rate arrives as text so it is stored exactly.
-- (Phase 4 extends create_transaction with Repeat: rule + first occurrence in one call.)
-- ---------------------------------------------------------------------------

create function public.create_transaction(
  p_type public.transaction_type,
  p_category_id uuid,
  p_date date,
  p_original_amount_minor bigint,
  p_original_currency text,
  p_exchange_rate text,
  p_base_amount_minor bigint,
  p_payee text default null,
  p_note text default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
begin
  insert into public.transactions (
    type, category_id, date, payee, note,
    original_amount_minor, original_currency, base_amount_minor, exchange_rate
  )
  values (
    p_type, p_category_id, p_date, nullif(btrim(p_payee), ''), nullif(btrim(p_note), ''),
    p_original_amount_minor, p_original_currency, p_base_amount_minor, p_exchange_rate::numeric
  )
  returning id into v_id;
  return v_id;
end;
$$;

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
  p_note text default null
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
      exchange_rate = p_exchange_rate::numeric
  where id = p_id
    and deleted_at is null
    -- IOU-linked transactions change only through the IOU functions (phase 4).
    and iou_id is null;

  if not found then
    raise exception 'transaction_not_found' using errcode = 'P0002';
  end if;
  return p_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Transactions: reads
-- ---------------------------------------------------------------------------

-- One page of the Transactions list, newest first. Pass the last row's (date, created_at, id)
-- as the cursor for the next page. Search matches payee and note.
create function public.list_transactions(
  p_limit integer default 50,
  p_cursor_date date default null,
  p_cursor_created_at timestamptz default null,
  p_cursor_id uuid default null,
  p_type public.transaction_type default null,
  p_category_id uuid default null,
  p_from date default null,
  p_to date default null,
  p_search text default null
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
    t.recurring_rule_id, t.iou_id, t.created_at
  from public.transactions t
  where t.deleted_at is null
    and (p_cursor_date is null
         or (t.date, t.created_at, t.id) < (p_cursor_date, p_cursor_created_at, p_cursor_id))
    and (p_type is null or t.type = p_type)
    and (p_category_id is null or t.category_id = p_category_id)
    and (p_from is null or t.date >= p_from)
    and (p_to is null or t.date <= p_to)
    and (coalesce(btrim(p_search), '') = ''
         or (coalesce(t.payee, '') || ' ' || coalesce(t.note, ''))
            ilike '%' || private.escape_like(btrim(p_search)) || '%')
  order by t.date desc, t.created_at desc, t.id desc
  limit least(greatest(coalesce(p_limit, 50), 1), 200)
$$;

-- Income, expense and net for the calendar month containing p_month, in base-currency minor
-- units. IOU-linked transactions (the four system categories) are excluded, as on Home and in
-- budgets.
create function public.month_summary(p_month date)
returns table (income_minor bigint, expense_minor bigint, net_minor bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  with totals as (
    select
      coalesce(sum(t.base_amount_minor) filter (where t.type = 'income'), 0) as income,
      coalesce(sum(t.base_amount_minor) filter (where t.type = 'expense'), 0) as expense
    from public.transactions t
    where t.deleted_at is null
      and t.iou_id is null
      and t.date >= date_trunc('month', p_month)::date
      and t.date < (date_trunc('month', p_month) + interval '1 month')::date
  )
  select income::bigint, expense::bigint, (income - expense)::bigint from totals
$$;

-- Distinct payees used before, most recent first (case-insensitive; the latest spelling wins).
-- IOU-linked transactions are left out so people's names don't mix with merchants.
create function public.recent_payees(p_limit integer default 300)
returns table (payee text)
language sql
stable
security invoker
set search_path = ''
as $$
  select p.payee
  from (
    select distinct on (lower(t.payee)) t.payee, t.date, t.created_at
    from public.transactions t
    where t.deleted_at is null and t.iou_id is null and t.payee is not null
    order by lower(t.payee), t.date desc, t.created_at desc
  ) p
  order by p.date desc, p.created_at desc
  limit least(greatest(coalesce(p_limit, 300), 1), 1000)
$$;

revoke all on function public.create_transaction(public.transaction_type, uuid, date, bigint, text, text, bigint, text, text)
  from public, anon;
revoke all on function public.update_transaction(uuid, public.transaction_type, uuid, date, bigint, text, text, bigint, text, text)
  from public, anon;
revoke all on function public.list_transactions(integer, date, timestamptz, uuid, public.transaction_type, uuid, date, date, text)
  from public, anon;
revoke all on function public.month_summary(date) from public, anon;
revoke all on function public.recent_payees(integer) from public, anon;

grant execute on function public.create_transaction(public.transaction_type, uuid, date, bigint, text, text, bigint, text, text)
  to authenticated;
grant execute on function public.update_transaction(uuid, public.transaction_type, uuid, date, bigint, text, text, bigint, text, text)
  to authenticated;
grant execute on function public.list_transactions(integer, date, timestamptz, uuid, public.transaction_type, uuid, date, date, text)
  to authenticated;
grant execute on function public.month_summary(date) to authenticated;
grant execute on function public.recent_payees(integer) to authenticated;
