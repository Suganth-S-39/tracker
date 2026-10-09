-- User-owned tables, row level security and integrity rules.
--
-- Conventions (CLAUDE.md):
--   * Every user-owned table has id, user_id (default auth.uid()), created_at, updated_at, deleted_at.
--   * Money is bigint minor units; rates are numeric. Never floating point.
--   * Users never hard-delete rows: there is no DELETE grant. Soft delete sets deleted_at.
--     Hard deletes only happen when the account is deleted (cascade from auth.users).
--   * Child rows reference parents through composite (user_id, id) foreign keys, so a user can
--     never point a row at another user's category, rule or IOU (FK checks bypass RLS).
--   * Errors raised for business rules use a stable machine-readable message (for example
--     'category_kind_mismatch') that the frontend maps to a friendly string.

create type public.transaction_type as enum ('expense', 'income');
create type public.theme_mode as enum ('light', 'dark', 'system');
-- Owner redesign (2026-10-09, Apple-inspired): graphite is the default; no purple or dark blue.
create type public.accent_theme as enum ('graphite', 'green', 'teal', 'gold', 'rose');
create type public.iou_direction as enum ('lent', 'borrowed');
create type public.recurrence_frequency as enum ('daily', 'weekly', 'monthly', 'yearly');
-- Identifies the four reserved IOU categories independently of their (localisable) names.
create type public.system_category_key as enum ('lent', 'repayment_received', 'borrowed', 'repayment_paid');

-- ---------------------------------------------------------------------------
-- profiles (one row per auth user, created by the signup trigger)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique default auth.uid() references auth.users (id) on delete cascade,
  display_name text check (display_name is null or char_length(display_name) <= 80),
  email text,
  -- Null until first-run onboarding. Locked once set (open item 1).
  base_currency text references public.currencies (code),
  -- IANA name, used by the scheduled jobs to work out "today" for this user.
  timezone text not null default 'UTC',
  accent_theme public.accent_theme not null default 'graphite',
  theme_mode public.theme_mode not null default 'system',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- ---------------------------------------------------------------------------
-- categories
-- ---------------------------------------------------------------------------
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 40),
  -- Icon key from the app's curated icon set (kebab-case).
  icon text not null default 'tag' check (icon ~ '^[a-z0-9-]{1,40}$'),
  kind public.transaction_type not null,
  is_hidden boolean not null default false,
  is_default boolean not null default false,
  is_system boolean not null default false,
  -- Not in the spec's data model: stable key for the four reserved IOU categories.
  system_key public.system_category_key,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint categories_user_id_id_key unique (user_id, id),
  constraint categories_user_id_system_key_key unique (user_id, system_key),
  constraint categories_system_key_iff_system check (is_system = (system_key is not null)),
  constraint categories_system_key_kind check (
    system_key is null
    or (system_key in ('lent', 'repayment_paid') and kind = 'expense')
    or (system_key in ('repayment_received', 'borrowed') and kind = 'income')
  )
);

create unique index categories_unique_name_idx
  on public.categories (user_id, kind, lower(btrim(name)))
  where deleted_at is null;

-- ---------------------------------------------------------------------------
-- recurring_rules
-- ---------------------------------------------------------------------------
create table public.recurring_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  type public.transaction_type not null,
  category_id uuid not null,
  amount_minor bigint not null check (amount_minor > 0),
  currency text not null references public.currencies (code),
  payee text check (payee is null or char_length(btrim(payee)) between 1 and 100),
  note text check (note is null or char_length(note) <= 500),
  frequency public.recurrence_frequency not null,
  -- Not in the spec's data model: the day of month the rule was created for. Monthly and yearly
  -- rules clamp to the last day of short months and return to this day when the month allows.
  anchor_day smallint not null check (anchor_day between 1 and 31),
  next_due_date date not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint recurring_rules_user_id_id_key unique (user_id, id),
  constraint recurring_rules_category_fkey foreign key (user_id, category_id)
    references public.categories (user_id, id)
);

create index recurring_rules_due_idx on public.recurring_rules (next_due_date)
  where is_active and deleted_at is null;

-- ---------------------------------------------------------------------------
-- transactions
-- ---------------------------------------------------------------------------
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  type public.transaction_type not null,
  category_id uuid not null,
  -- Plain local calendar date: whatever the user saw when saving.
  date date not null,
  payee text check (payee is null or char_length(btrim(payee)) between 1 and 100),
  note text check (note is null or char_length(note) <= 500),
  original_amount_minor bigint not null check (original_amount_minor > 0),
  original_currency text not null references public.currencies (code),
  -- Can round to 0 for a tiny amount in a much weaker currency.
  base_amount_minor bigint not null check (base_amount_minor >= 0),
  -- original -> base. 1 when the original currency is the base currency.
  exchange_rate numeric not null check (exchange_rate > 0),
  recurring_rule_id uuid,
  occurrence_date date,
  iou_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint transactions_user_id_id_key unique (user_id, id),
  -- Includes soft-deleted rows on purpose: a deleted occurrence is never regenerated.
  constraint transactions_recurring_occurrence_key unique (recurring_rule_id, occurrence_date),
  constraint transactions_occurrence_pair check ((recurring_rule_id is null) = (occurrence_date is null)),
  constraint transactions_category_fkey foreign key (user_id, category_id)
    references public.categories (user_id, id),
  constraint transactions_recurring_rule_fkey foreign key (user_id, recurring_rule_id)
    references public.recurring_rules (user_id, id)
);

create index transactions_user_date_idx on public.transactions (user_id, date desc, created_at desc)
  where deleted_at is null;
create index transactions_category_idx on public.transactions (category_id);
create index transactions_iou_idx on public.transactions (iou_id) where iou_id is not null;

-- ---------------------------------------------------------------------------
-- ious
-- ---------------------------------------------------------------------------
create table public.ious (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  person_name text not null check (char_length(btrim(person_name)) between 1 and 80),
  direction public.iou_direction not null,
  original_amount_minor bigint not null check (original_amount_minor > 0),
  original_currency text not null references public.currencies (code),
  base_amount_minor bigint not null check (base_amount_minor >= 0),
  exchange_rate numeric not null check (exchange_rate > 0),
  date date not null,
  due_date date,
  note text check (note is null or char_length(note) <= 500),
  -- The linked transaction. Written together with it by the IOU functions (phase 4).
  transaction_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint ious_user_id_id_key unique (user_id, id),
  constraint ious_due_after_date check (due_date is null or due_date >= date)
);

create index ious_user_idx on public.ious (user_id) where deleted_at is null;

-- ---------------------------------------------------------------------------
-- iou_repayments
-- ---------------------------------------------------------------------------
create table public.iou_repayments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  iou_id uuid not null,
  amount_minor bigint not null check (amount_minor > 0),
  currency text not null references public.currencies (code),
  -- The repayment converted into the IOU's currency; remaining balance is computed from this.
  iou_currency_amount_minor bigint not null check (iou_currency_amount_minor > 0),
  iou_currency_rate numeric not null check (iou_currency_rate > 0),
  base_amount_minor bigint not null check (base_amount_minor >= 0),
  exchange_rate numeric not null check (exchange_rate > 0),
  date date not null,
  note text check (note is null or char_length(note) <= 500),
  transaction_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint iou_repayments_iou_fkey foreign key (user_id, iou_id)
    references public.ious (user_id, id)
);

create index iou_repayments_iou_idx on public.iou_repayments (iou_id) where deleted_at is null;

-- IOUs and transactions reference each other; the IOU functions insert both in one call, so these
-- checks are deferred to commit.
alter table public.transactions
  add constraint transactions_iou_fkey foreign key (user_id, iou_id)
    references public.ious (user_id, id) deferrable initially deferred;
alter table public.ious
  add constraint ious_transaction_fkey foreign key (user_id, transaction_id)
    references public.transactions (user_id, id) deferrable initially deferred;
alter table public.iou_repayments
  add constraint iou_repayments_transaction_fkey foreign key (user_id, transaction_id)
    references public.transactions (user_id, id) deferrable initially deferred;

-- ---------------------------------------------------------------------------
-- budgets
-- ---------------------------------------------------------------------------
create table public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- First day of the month the budget starts applying from.
  month date not null check (extract(day from month) = 1),
  -- Base currency minor units. 0 clears a carried-forward budget from this month on (phase 3).
  amount_minor bigint not null check (amount_minor >= 0),
  -- Null means the overall budget.
  category_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint budgets_category_fkey foreign key (user_id, category_id)
    references public.categories (user_id, id)
);

-- One overall budget and at most one per category per month (ignoring soft-deleted rows).
create unique index budgets_one_per_month_idx
  on public.budgets (user_id, month, category_id) nulls not distinct
  where deleted_at is null;

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
create trigger set_updated_at before update on public.profiles
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.categories
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.recurring_rules
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.transactions
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.ious
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.iou_repayments
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.budgets
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Integrity triggers
-- ---------------------------------------------------------------------------

-- profiles: valid IANA timezone; base currency locked once chosen (open item 1).
create function private.profiles_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  begin
    perform now() at time zone new.timezone;
  exception when invalid_parameter_value then
    raise exception 'invalid_timezone' using errcode = '22023';
  end;

  if tg_op = 'UPDATE'
     and old.base_currency is not null
     and new.base_currency is distinct from old.base_currency then
    raise exception 'base_currency_locked' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

create trigger profiles_guard before insert or update on public.profiles
  for each row execute function private.profiles_guard();

-- categories: kind and system flags never change after creation.
create function private.categories_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.kind <> old.kind then
    raise exception 'category_kind_locked' using errcode = 'P0001';
  end if;
  if new.is_system <> old.is_system or new.system_key is distinct from old.system_key then
    raise exception 'system_category_locked' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger categories_guard before update on public.categories
  for each row execute function private.categories_guard();

-- Shared check: the category exists for this user, matches the transaction type, and is a
-- system category exactly when the row is IOU-linked.
create function private.assert_category_usable(
  p_user_id uuid,
  p_category_id uuid,
  p_type public.transaction_type,
  p_iou_linked boolean
)
returns void
language plpgsql
stable
set search_path = ''
as $$
declare
  v_kind public.transaction_type;
  v_is_system boolean;
begin
  select kind, is_system into v_kind, v_is_system
  from public.categories
  where id = p_category_id and user_id = p_user_id;

  if not found then
    -- The composite foreign key reports this too; checked here for a clearer error.
    raise exception 'category_not_found' using errcode = '23503';
  end if;
  if v_kind <> p_type then
    raise exception 'category_kind_mismatch' using errcode = '23514';
  end if;
  if v_is_system and not p_iou_linked then
    raise exception 'system_category_reserved' using errcode = '23514';
  end if;
  if p_iou_linked and not v_is_system then
    raise exception 'iou_requires_system_category' using errcode = '23514';
  end if;
end;
$$;

create function private.transactions_validate()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform private.assert_category_usable(new.user_id, new.category_id, new.type, new.iou_id is not null);
  return new;
end;
$$;

create trigger transactions_validate before insert or update on public.transactions
  for each row execute function private.transactions_validate();

create function private.recurring_rules_validate()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform private.assert_category_usable(new.user_id, new.category_id, new.type, false);
  return new;
end;
$$;

create trigger recurring_rules_validate before insert or update on public.recurring_rules
  for each row execute function private.recurring_rules_validate();

-- Budgets apply to expense categories only (or overall when category_id is null).
create function private.budgets_validate()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.category_id is not null then
    perform private.assert_category_usable(new.user_id, new.category_id, 'expense', false);
  end if;
  return new;
end;
$$;

create trigger budgets_validate before insert or update on public.budgets
  for each row execute function private.budgets_validate();

revoke all on all functions in schema private from public, anon, authenticated;
-- Trigger functions run as the calling user, and a nested function call checks EXECUTE, so the
-- shared helper must be callable by signed-in users. The private schema is not exposed through
-- the Data API, so this does not make it reachable from outside.
grant usage on schema private to authenticated;
grant execute on function private.assert_category_usable(uuid, uuid, public.transaction_type, boolean)
  to authenticated;

-- ---------------------------------------------------------------------------
-- Row level security: users only ever see and change their own rows.
-- (select auth.uid()) is evaluated once per statement instead of once per row.
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.recurring_rules enable row level security;
alter table public.transactions enable row level security;
alter table public.ious enable row level security;
alter table public.iou_repayments enable row level security;
alter table public.budgets enable row level security;

-- profiles: created by the signup trigger, never inserted by users.
create policy "Users read own profile" on public.profiles
  for select to authenticated using (user_id = (select auth.uid()));
create policy "Users update own profile" on public.profiles
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- categories: system categories are readable but not editable.
create policy "Users read own categories" on public.categories
  for select to authenticated using (user_id = (select auth.uid()));
create policy "Users create own categories" on public.categories
  for insert to authenticated
  with check (user_id = (select auth.uid()) and not is_system);
create policy "Users update own non-system categories" on public.categories
  for update to authenticated
  using (user_id = (select auth.uid()) and not is_system)
  with check (user_id = (select auth.uid()) and not is_system);

-- The remaining tables share the same three policies.
create policy "Users read own rows" on public.recurring_rules
  for select to authenticated using (user_id = (select auth.uid()));
create policy "Users create own rows" on public.recurring_rules
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "Users update own rows" on public.recurring_rules
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "Users read own rows" on public.transactions
  for select to authenticated using (user_id = (select auth.uid()));
create policy "Users create own rows" on public.transactions
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "Users update own rows" on public.transactions
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "Users read own rows" on public.ious
  for select to authenticated using (user_id = (select auth.uid()));
create policy "Users create own rows" on public.ious
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "Users update own rows" on public.ious
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "Users read own rows" on public.iou_repayments
  for select to authenticated using (user_id = (select auth.uid()));
create policy "Users create own rows" on public.iou_repayments
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "Users update own rows" on public.iou_repayments
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "Users read own rows" on public.budgets
  for select to authenticated using (user_id = (select auth.uid()));
create policy "Users create own rows" on public.budgets
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "Users update own rows" on public.budgets
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Grants. anon gets nothing. No table grants DELETE to users (soft delete only).
-- Column-level grants make immutable columns impossible to change through the API.
-- ---------------------------------------------------------------------------
revoke all on public.profiles, public.categories, public.recurring_rules, public.transactions,
  public.ious, public.iou_repayments, public.budgets
  from anon, authenticated;

grant select on public.profiles to authenticated;
grant update (display_name, base_currency, timezone, accent_theme, theme_mode) on public.profiles to authenticated;

grant select on public.categories to authenticated;
grant insert (name, icon, kind, is_hidden, is_default, sort_order) on public.categories to authenticated;
grant update (name, icon, is_hidden, sort_order) on public.categories to authenticated;

grant select, insert, update on public.recurring_rules, public.transactions, public.ious,
  public.iou_repayments, public.budgets to authenticated;
