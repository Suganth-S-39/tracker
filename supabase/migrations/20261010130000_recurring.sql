-- Phase 4: recurring transactions (spec section 9).
--
-- * Creating a transaction with Repeat creates the rule and its first occurrence in one call.
-- * An hourly pg_cron job generates every occurrence whose due date has arrived in the user's own
--   time zone, then advances next_due_date. Insert-only: guarded by the unique
--   (recurring_rule_id, occurrence_date) constraint, which includes soft-deleted rows, so it never
--   overwrites an edited occurrence or restores a deleted one, and running it twice is harmless.
-- * Editing a rule only affects occurrences generated afterwards (past ones are separate rows).

-- The due date after p_date. Monthly and yearly rules clamp to the last day of short months and
-- return to the anchor day when the month allows (Jan 31 -> Feb 28 -> Mar 31; Feb 29 -> Feb 28).
create function private.next_occurrence(
  p_date date,
  p_frequency public.recurrence_frequency,
  p_anchor_day integer
)
returns date
language plpgsql
immutable
strict
set search_path = ''
as $$
declare
  v_first date;
  v_days_in_month integer;
begin
  if p_frequency = 'daily' then
    return p_date + 1;
  elsif p_frequency = 'weekly' then
    return p_date + 7;
  end if;

  v_first := (date_trunc('month', p_date)
    + case p_frequency when 'monthly' then interval '1 month' else interval '12 months' end)::date;
  v_days_in_month := extract(day from (v_first + interval '1 month' - interval '1 day'))::integer;
  return v_first + (least(p_anchor_day, v_days_in_month) - 1);
end;
$$;

revoke all on function private.next_occurrence(date, public.recurrence_frequency, integer) from public, anon;
grant execute on function private.next_occurrence(date, public.recurrence_frequency, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- create_transaction gains Repeat: the rule and its first occurrence in one call.
-- ---------------------------------------------------------------------------
drop function public.create_transaction(public.transaction_type, uuid, date, bigint, text, text, bigint, text, text);

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
  p_repeat public.recurrence_frequency default null
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
    base_amount_minor, exchange_rate, recurring_rule_id, occurrence_date
  )
  values (
    p_type, p_category_id, p_date, v_payee, v_note, p_original_amount_minor, p_original_currency,
    p_base_amount_minor, p_exchange_rate::numeric, v_rule_id, case when v_rule_id is null then null else p_date end
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.create_transaction(public.transaction_type, uuid, date, bigint, text, text, bigint, text, text, public.recurrence_frequency)
  from public, anon;
grant execute on function public.create_transaction(public.transaction_type, uuid, date, bigint, text, text, bigint, text, text, public.recurrence_frequency)
  to authenticated;

-- ---------------------------------------------------------------------------
-- Generation (server-only: bypasses RLS to process every user's rules)
-- ---------------------------------------------------------------------------

-- Generates due occurrences for all users. p_now is injectable for tests. A foreign-currency rule
-- uses the latest rate; if no rate is known yet it is skipped and retried on the next run.
-- p_max_per_rule bounds one run's catch-up for a long-overdue rule; the next run continues.
create function private.generate_recurring(p_now timestamptz default now(), p_max_per_rule integer default 400)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
  v_today date;
  v_due date;
  v_rate numeric;
  v_from_exponent integer;
  v_to_exponent integer;
  v_steps integer;
  v_inserted integer;
  v_created integer := 0;
begin
  for r in
    select rr.*, p.timezone, p.base_currency
    from public.recurring_rules rr
    join public.profiles p on p.user_id = rr.user_id
    where rr.is_active
      and rr.deleted_at is null
      and p.base_currency is not null
      and rr.next_due_date <= (p_now at time zone p.timezone)::date
    for update of rr skip locked
  loop
    v_today := (p_now at time zone r.timezone)::date;

    if r.currency = r.base_currency then
      v_rate := 1;
    else
      v_rate := (select lr.rate::numeric from public.latest_rate(r.currency, r.base_currency) lr);
      continue when v_rate is null;
    end if;
    v_from_exponent := (select exponent from public.currencies where code = r.currency);
    v_to_exponent := (select exponent from public.currencies where code = r.base_currency);

    v_due := r.next_due_date;
    v_steps := 0;
    while v_due <= v_today and v_steps < p_max_per_rule loop
      insert into public.transactions (
        user_id, type, category_id, date, payee, note, original_amount_minor, original_currency,
        base_amount_minor, exchange_rate, recurring_rule_id, occurrence_date
      )
      values (
        r.user_id, r.type, r.category_id, v_due, r.payee, r.note, r.amount_minor, r.currency,
        private.convert_minor(r.amount_minor, v_rate, v_from_exponent, v_to_exponent), v_rate, r.id, v_due
      )
      on conflict (recurring_rule_id, occurrence_date) do nothing;
      get diagnostics v_inserted = row_count;
      v_created := v_created + v_inserted;

      v_due := private.next_occurrence(v_due, r.frequency, r.anchor_day);
      v_steps := v_steps + 1;
    end loop;

    update public.recurring_rules set next_due_date = v_due where id = r.id;
  end loop;

  return v_created;
end;
$$;

revoke all on function private.generate_recurring(timestamptz, integer) from public, anon, authenticated;

-- Hourly, so each user's day boundary (in their own time zone) is picked up within the hour.
-- Re-scheduling with the same name replaces the job.
create extension if not exists pg_cron with schema pg_catalog;
grant usage on schema cron to postgres;
select cron.schedule('generate-recurring-transactions', '0 * * * *', 'select private.generate_recurring()');

-- ---------------------------------------------------------------------------
-- Managing rules (Settings > Recurring)
-- ---------------------------------------------------------------------------

-- Changes apply to occurrences generated from now on. Moving the next date also moves the day of
-- month that monthly and yearly rules return to.
create function public.update_recurring_rule(
  p_id uuid,
  p_type public.transaction_type,
  p_category_id uuid,
  p_amount_minor bigint,
  p_currency text,
  p_frequency public.recurrence_frequency,
  p_next_due_date date,
  p_payee text default null,
  p_note text default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.recurring_rules
  set type = p_type,
      category_id = p_category_id,
      amount_minor = p_amount_minor,
      currency = p_currency,
      frequency = p_frequency,
      anchor_day = case when p_next_due_date <> next_due_date then extract(day from p_next_due_date)::smallint else anchor_day end,
      next_due_date = p_next_due_date,
      payee = nullif(btrim(p_payee), ''),
      note = nullif(btrim(p_note), '')
  where id = p_id and deleted_at is null;

  if not found then
    raise exception 'recurring_rule_not_found' using errcode = 'P0002';
  end if;
  return p_id;
end;
$$;

-- Pausing stops generation. Resuming skips the paused period (DECISIONS.md): the next due date
-- moves forward to today or later in the user's time zone, without back-filling.
create function public.set_recurring_rule_active(p_id uuid, p_active boolean)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_rule public.recurring_rules;
  v_today date;
  v_due date;
begin
  select * into v_rule from public.recurring_rules where id = p_id and deleted_at is null for update;
  if not found then
    raise exception 'recurring_rule_not_found' using errcode = 'P0002';
  end if;

  if not p_active then
    update public.recurring_rules set is_active = false where id = p_id;
    return;
  end if;
  if v_rule.is_active then
    return;
  end if;

  v_today := (now() at time zone (select timezone from public.profiles where user_id = v_rule.user_id))::date;
  v_due := v_rule.next_due_date;
  while v_due < v_today loop
    v_due := private.next_occurrence(v_due, v_rule.frequency, v_rule.anchor_day);
  end loop;

  update public.recurring_rules set is_active = true, next_due_date = v_due where id = p_id;
end;
$$;

-- Stops the rule. Occurrences already generated stay.
create function public.delete_recurring_rule(p_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.recurring_rules set deleted_at = now(), is_active = false where id = p_id and deleted_at is null;
  if not found then
    raise exception 'recurring_rule_not_found' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.update_recurring_rule(uuid, public.transaction_type, uuid, bigint, text, public.recurrence_frequency, date, text, text) from public, anon;
revoke all on function public.set_recurring_rule_active(uuid, boolean) from public, anon;
revoke all on function public.delete_recurring_rule(uuid) from public, anon;
grant execute on function public.update_recurring_rule(uuid, public.transaction_type, uuid, bigint, text, public.recurrence_frequency, date, text, text) to authenticated;
grant execute on function public.set_recurring_rule_active(uuid, boolean) to authenticated;
grant execute on function public.delete_recurring_rule(uuid) to authenticated;
