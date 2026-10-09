-- Phase 4: IOUs and repayments, always written together with their linked transactions.
--
-- Spec section 9: each IOU and each repayment has a linked transaction in one of the four
-- reserved categories, and creating / editing / deleting either happens inside one Postgres
-- function. Remaining balance and status are derived (iou_balances), never stored.

-- ---------------------------------------------------------------------------
-- Guard: IOU rows and IOU-linked transactions change only through the functions below.
-- The functions set a transaction-local flag; nothing exposed through the API can set it.
-- ---------------------------------------------------------------------------
create function private.guard_iou_writes()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if coalesce(current_setting('app.iou_write', true), '') <> 'on' then
    raise exception 'iou_managed' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger guard_iou_writes before insert or update on public.ious
  for each row execute function private.guard_iou_writes();
create trigger guard_iou_writes before insert or update on public.iou_repayments
  for each row execute function private.guard_iou_writes();
create trigger guard_iou_insert before insert on public.transactions
  for each row when (new.iou_id is not null) execute function private.guard_iou_writes();
create trigger guard_iou_update before update on public.transactions
  for each row when (old.iou_id is not null or new.iou_id is not null) execute function private.guard_iou_writes();

-- The caller's reserved category for an IOU event.
create function private.system_category_id(p_key public.system_category_key)
returns uuid
language sql
stable
set search_path = ''
as $$
  select id from public.categories where user_id = (select auth.uid()) and system_key = p_key
$$;

-- Validates a repayment against its IOU: not before the IOU, converted amount consistent with
-- the repayment -> IOU-currency rate, and never more than what remains (spec section 9).
create function private.assert_repayment(
  p_iou public.ious,
  p_exclude_repayment uuid,
  p_amount_minor bigint,
  p_currency text,
  p_iou_currency_amount_minor bigint,
  p_iou_currency_rate numeric,
  p_date date
)
returns void
language plpgsql
stable
set search_path = ''
as $$
declare
  v_remaining bigint;
begin
  if p_date < p_iou.date then
    raise exception 'repayment_before_iou' using errcode = '23514';
  end if;

  if p_currency = p_iou.original_currency then
    if p_iou_currency_rate <> 1 or p_iou_currency_amount_minor <> p_amount_minor then
      raise exception 'repayment_amount_mismatch' using errcode = '23514';
    end if;
  elsif abs(
    private.convert_minor(
      p_amount_minor,
      p_iou_currency_rate,
      (select exponent from public.currencies where code = p_currency)::integer,
      (select exponent from public.currencies where code = p_iou.original_currency)::integer
    ) - p_iou_currency_amount_minor
  ) > 1 then
    raise exception 'repayment_amount_mismatch' using errcode = '23514';
  end if;

  select p_iou.original_amount_minor - coalesce(sum(r.iou_currency_amount_minor), 0)
  into v_remaining
  from public.iou_repayments r
  where r.iou_id = p_iou.id
    and r.deleted_at is null
    and r.id is distinct from p_exclude_repayment;

  if p_iou_currency_amount_minor > v_remaining then
    raise exception 'repayment_exceeds_remaining' using errcode = '23514';
  end if;
end;
$$;

revoke all on function private.guard_iou_writes() from public, anon, authenticated;
revoke all on function private.system_category_id(public.system_category_key) from public, anon;
revoke all on function private.assert_repayment(public.ious, uuid, bigint, text, bigint, numeric, date) from public, anon;
grant execute on function private.system_category_id(public.system_category_key) to authenticated;
grant execute on function private.assert_repayment(public.ious, uuid, bigint, text, bigint, numeric, date) to authenticated;

-- ---------------------------------------------------------------------------
-- IOUs
-- ---------------------------------------------------------------------------

-- You lend: expense in "Lent". You borrow: income in "Borrowed". The person is the payee.
create function public.create_iou(
  p_person_name text,
  p_direction public.iou_direction,
  p_original_amount_minor bigint,
  p_original_currency text,
  p_exchange_rate text,
  p_base_amount_minor bigint,
  p_date date,
  p_due_date date default null,
  p_note text default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_iou_id uuid := gen_random_uuid();
  v_transaction_id uuid := gen_random_uuid();
  v_person text := btrim(p_person_name);
  v_note text := nullif(btrim(p_note), '');
begin
  perform set_config('app.iou_write', 'on', true);

  insert into public.ious (
    id, person_name, direction, original_amount_minor, original_currency, base_amount_minor,
    exchange_rate, date, due_date, note, transaction_id
  )
  values (
    v_iou_id, v_person, p_direction, p_original_amount_minor, p_original_currency, p_base_amount_minor,
    p_exchange_rate::numeric, p_date, p_due_date, v_note, v_transaction_id
  );

  insert into public.transactions (
    id, type, category_id, date, payee, note, original_amount_minor, original_currency,
    base_amount_minor, exchange_rate, iou_id
  )
  values (
    v_transaction_id,
    case p_direction when 'lent' then 'expense'::public.transaction_type else 'income'::public.transaction_type end,
    private.system_category_id(case p_direction when 'lent' then 'lent'::public.system_category_key else 'borrowed'::public.system_category_key end),
    p_date, v_person, v_note, p_original_amount_minor, p_original_currency, p_base_amount_minor,
    p_exchange_rate::numeric, v_iou_id
  );

  perform set_config('app.iou_write', '', true);
  return v_iou_id;
end;
$$;

-- Once an IOU has repayments, its currency and direction are locked and its amount can't drop
-- below what has been repaid (DECISIONS.md). Renaming the person updates every linked payee.
create function public.update_iou(
  p_id uuid,
  p_person_name text,
  p_direction public.iou_direction,
  p_original_amount_minor bigint,
  p_original_currency text,
  p_exchange_rate text,
  p_base_amount_minor bigint,
  p_date date,
  p_due_date date default null,
  p_note text default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_iou public.ious;
  v_repaid bigint;
  v_repayments integer;
  v_first_repayment date;
  v_person text := btrim(p_person_name);
  v_note text := nullif(btrim(p_note), '');
begin
  select * into v_iou from public.ious where id = p_id and deleted_at is null for update;
  if not found then
    raise exception 'iou_not_found' using errcode = 'P0002';
  end if;

  select coalesce(sum(iou_currency_amount_minor), 0), count(*), min(date)
  into v_repaid, v_repayments, v_first_repayment
  from public.iou_repayments
  where iou_id = p_id and deleted_at is null;

  if v_repayments > 0 and (p_direction <> v_iou.direction or p_original_currency <> v_iou.original_currency) then
    raise exception 'iou_locked_with_repayments' using errcode = 'P0001';
  end if;
  if p_original_amount_minor < v_repaid then
    raise exception 'iou_amount_below_repaid' using errcode = '23514';
  end if;
  if v_first_repayment is not null and p_date > v_first_repayment then
    raise exception 'repayment_before_iou' using errcode = '23514';
  end if;

  perform set_config('app.iou_write', 'on', true);

  update public.ious
  set person_name = v_person,
      direction = p_direction,
      original_amount_minor = p_original_amount_minor,
      original_currency = p_original_currency,
      base_amount_minor = p_base_amount_minor,
      exchange_rate = p_exchange_rate::numeric,
      date = p_date,
      due_date = p_due_date,
      note = v_note
  where id = p_id;

  update public.transactions
  set type = case p_direction when 'lent' then 'expense'::public.transaction_type else 'income'::public.transaction_type end,
      category_id = private.system_category_id(case p_direction when 'lent' then 'lent'::public.system_category_key else 'borrowed'::public.system_category_key end),
      date = p_date,
      payee = v_person,
      note = v_note,
      original_amount_minor = p_original_amount_minor,
      original_currency = p_original_currency,
      base_amount_minor = p_base_amount_minor,
      exchange_rate = p_exchange_rate::numeric
  where id = v_iou.transaction_id;

  update public.transactions
  set payee = v_person
  where iou_id = p_id and id <> v_iou.transaction_id and deleted_at is null;

  perform set_config('app.iou_write', '', true);
  return p_id;
end;
$$;

-- Soft-deletes the IOU, its repayments and every linked transaction.
create function public.delete_iou(p_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform set_config('app.iou_write', 'on', true);

  update public.ious set deleted_at = now() where id = p_id and deleted_at is null;
  if not found then
    raise exception 'iou_not_found' using errcode = 'P0002';
  end if;
  update public.iou_repayments set deleted_at = now() where iou_id = p_id and deleted_at is null;
  update public.transactions set deleted_at = now() where iou_id = p_id and deleted_at is null;

  perform set_config('app.iou_write', '', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- Repayments (any currency). They repay you: income in "Repayment received".
-- You repay them: expense in "Repayment paid".
-- ---------------------------------------------------------------------------
create function public.create_repayment(
  p_iou_id uuid,
  p_amount_minor bigint,
  p_currency text,
  p_iou_currency_amount_minor bigint,
  p_iou_currency_rate text,
  p_base_amount_minor bigint,
  p_exchange_rate text,
  p_date date,
  p_note text default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_iou public.ious;
  v_id uuid := gen_random_uuid();
  v_transaction_id uuid := gen_random_uuid();
  v_note text := nullif(btrim(p_note), '');
begin
  -- Locking the IOU serialises repayments, so two at once can't overpay it.
  select * into v_iou from public.ious where id = p_iou_id and deleted_at is null for update;
  if not found then
    raise exception 'iou_not_found' using errcode = 'P0002';
  end if;

  perform private.assert_repayment(
    v_iou, null, p_amount_minor, p_currency, p_iou_currency_amount_minor, p_iou_currency_rate::numeric, p_date
  );

  perform set_config('app.iou_write', 'on', true);

  insert into public.iou_repayments (
    id, iou_id, amount_minor, currency, iou_currency_amount_minor, iou_currency_rate,
    base_amount_minor, exchange_rate, date, note, transaction_id
  )
  values (
    v_id, p_iou_id, p_amount_minor, p_currency, p_iou_currency_amount_minor, p_iou_currency_rate::numeric,
    p_base_amount_minor, p_exchange_rate::numeric, p_date, v_note, v_transaction_id
  );

  insert into public.transactions (
    id, type, category_id, date, payee, note, original_amount_minor, original_currency,
    base_amount_minor, exchange_rate, iou_id
  )
  values (
    v_transaction_id,
    case v_iou.direction when 'lent' then 'income'::public.transaction_type else 'expense'::public.transaction_type end,
    private.system_category_id(case v_iou.direction when 'lent' then 'repayment_received'::public.system_category_key else 'repayment_paid'::public.system_category_key end),
    p_date, v_iou.person_name, v_note, p_amount_minor, p_currency, p_base_amount_minor,
    p_exchange_rate::numeric, p_iou_id
  );

  perform set_config('app.iou_write', '', true);
  return v_id;
end;
$$;

create function public.update_repayment(
  p_id uuid,
  p_amount_minor bigint,
  p_currency text,
  p_iou_currency_amount_minor bigint,
  p_iou_currency_rate text,
  p_base_amount_minor bigint,
  p_exchange_rate text,
  p_date date,
  p_note text default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_repayment public.iou_repayments;
  v_iou public.ious;
  v_note text := nullif(btrim(p_note), '');
begin
  select * into v_repayment from public.iou_repayments where id = p_id and deleted_at is null;
  if not found then
    raise exception 'repayment_not_found' using errcode = 'P0002';
  end if;
  select * into v_iou from public.ious where id = v_repayment.iou_id and deleted_at is null for update;
  if not found then
    raise exception 'iou_not_found' using errcode = 'P0002';
  end if;

  perform private.assert_repayment(
    v_iou, p_id, p_amount_minor, p_currency, p_iou_currency_amount_minor, p_iou_currency_rate::numeric, p_date
  );

  perform set_config('app.iou_write', 'on', true);

  update public.iou_repayments
  set amount_minor = p_amount_minor,
      currency = p_currency,
      iou_currency_amount_minor = p_iou_currency_amount_minor,
      iou_currency_rate = p_iou_currency_rate::numeric,
      base_amount_minor = p_base_amount_minor,
      exchange_rate = p_exchange_rate::numeric,
      date = p_date,
      note = v_note
  where id = p_id;

  update public.transactions
  set date = p_date,
      note = v_note,
      original_amount_minor = p_amount_minor,
      original_currency = p_currency,
      base_amount_minor = p_base_amount_minor,
      exchange_rate = p_exchange_rate::numeric
  where id = v_repayment.transaction_id;

  perform set_config('app.iou_write', '', true);
  return p_id;
end;
$$;

create function public.delete_repayment(p_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_transaction_id uuid;
begin
  perform set_config('app.iou_write', 'on', true);

  update public.iou_repayments set deleted_at = now()
  where id = p_id and deleted_at is null
  returning transaction_id into v_transaction_id;
  if not found then
    raise exception 'repayment_not_found' using errcode = 'P0002';
  end if;
  update public.transactions set deleted_at = now() where id = v_transaction_id;

  perform set_config('app.iou_write', '', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- Reads. Remaining balance and status are derived, in the IOU's own currency, so rate changes
-- never leave leftovers (spec section 9). Rates are text so they reach the browser exactly.
-- ---------------------------------------------------------------------------
create view public.iou_balances with (security_invoker = true) as
select
  i.id,
  i.person_name,
  i.direction,
  i.original_amount_minor,
  i.original_currency,
  i.base_amount_minor,
  i.exchange_rate::text as exchange_rate,
  i.date,
  i.due_date,
  i.note,
  i.created_at,
  coalesce(r.repaid, 0)::bigint as repaid_minor,
  (i.original_amount_minor - coalesce(r.repaid, 0))::bigint as remaining_minor,
  coalesce(r.repayment_count, 0)::integer as repayment_count,
  case when i.original_amount_minor - coalesce(r.repaid, 0) = 0 then 'settled' else 'open' end as status
from public.ious i
left join lateral (
  select sum(rp.iou_currency_amount_minor) as repaid, count(*) as repayment_count
  from public.iou_repayments rp
  where rp.iou_id = i.id and rp.deleted_at is null
) r on true
where i.deleted_at is null;

create view public.iou_repayment_details with (security_invoker = true) as
select
  rp.id,
  rp.iou_id,
  rp.amount_minor,
  rp.currency,
  rp.iou_currency_amount_minor,
  rp.iou_currency_rate::text as iou_currency_rate,
  rp.base_amount_minor,
  rp.exchange_rate::text as exchange_rate,
  rp.date,
  rp.note,
  rp.created_at
from public.iou_repayments rp
where rp.deleted_at is null;

-- "You're owed" / "You owe" for Home, in the base currency: open balances converted at the
-- latest rate (or the IOU's own rate if none is known). Each total's `*_approximate` flag is true
-- when any balance in it needed converting (DECISIONS.md: shown with ≈).
create function public.iou_totals()
returns table (owed_to_me_minor bigint, i_owe_minor bigint, owed_approximate boolean, owe_approximate boolean)
language sql
stable
security invoker
set search_path = ''
as $$
  with base as (
    select p.base_currency, c.exponent
    from public.profiles p
    join public.currencies c on c.code = p.base_currency
    where p.user_id = (select auth.uid())
  ),
  open_balances as (
    select
      i.direction,
      i.original_currency,
      i.exchange_rate,
      i.original_amount_minor - coalesce((
        select sum(rp.iou_currency_amount_minor) from public.iou_repayments rp
        where rp.iou_id = i.id and rp.deleted_at is null
      ), 0) as remaining
    from public.ious i
    where i.deleted_at is null
  ),
  converted as (
    select
      o.direction,
      o.original_currency <> b.base_currency as foreign_currency,
      case
        when o.original_currency = b.base_currency then o.remaining
        else private.convert_minor(
          o.remaining::bigint,
          coalesce((select lr.rate::numeric from public.latest_rate(o.original_currency, b.base_currency) lr), o.exchange_rate),
          (select c.exponent from public.currencies c where c.code = o.original_currency)::integer,
          b.exponent::integer
        )
      end as base_minor
    from open_balances o, base b
    where o.remaining > 0
  )
  select
    coalesce(sum(base_minor) filter (where direction = 'lent'), 0)::bigint,
    coalesce(sum(base_minor) filter (where direction = 'borrowed'), 0)::bigint,
    coalesce(bool_or(foreign_currency) filter (where direction = 'lent'), false),
    coalesce(bool_or(foreign_currency) filter (where direction = 'borrowed'), false)
  from converted
$$;

revoke all on public.iou_balances, public.iou_repayment_details from anon;
grant select on public.iou_balances, public.iou_repayment_details to authenticated;

revoke all on function public.create_iou(text, public.iou_direction, bigint, text, text, bigint, date, date, text) from public, anon;
revoke all on function public.update_iou(uuid, text, public.iou_direction, bigint, text, text, bigint, date, date, text) from public, anon;
revoke all on function public.delete_iou(uuid) from public, anon;
revoke all on function public.create_repayment(uuid, bigint, text, bigint, text, bigint, text, date, text) from public, anon;
revoke all on function public.update_repayment(uuid, bigint, text, bigint, text, bigint, text, date, text) from public, anon;
revoke all on function public.delete_repayment(uuid) from public, anon;
revoke all on function public.iou_totals() from public, anon;

grant execute on function public.create_iou(text, public.iou_direction, bigint, text, text, bigint, date, date, text) to authenticated;
grant execute on function public.update_iou(uuid, text, public.iou_direction, bigint, text, text, bigint, date, date, text) to authenticated;
grant execute on function public.delete_iou(uuid) to authenticated;
grant execute on function public.create_repayment(uuid, bigint, text, bigint, text, bigint, text, date, text) to authenticated;
grant execute on function public.update_repayment(uuid, bigint, text, bigint, text, bigint, text, date, text) to authenticated;
grant execute on function public.delete_repayment(uuid) to authenticated;
grant execute on function public.iou_totals() to authenticated;
