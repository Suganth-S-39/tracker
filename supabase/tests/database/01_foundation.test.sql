-- Phase 1: schema, signup/onboarding, integrity rules and row level security.
-- Run with `npm run test:db` (local Supabase must be running). Everything rolls back.
begin;
create extension if not exists pgtap with schema extensions;
select plan(48);

-- ---------------------------------------------------------------------------
-- Setup: two users. The signup trigger creates their profiles and IOU categories.
-- alice = 11111111-..., bob = 22222222-...
-- ---------------------------------------------------------------------------
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data)
values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'alice@example.com', '{"full_name": "Alice"}'),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'bob@example.com', '{}');

-- ---------------------------------------------------------------------------
-- Structure
-- ---------------------------------------------------------------------------
select is_empty(
  $$ select tablename from pg_tables where schemaname = 'public' and not rowsecurity $$,
  'every public table has row level security enabled'
);
select is_empty(
  $$ select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.prosecdef $$,
  'public (API-callable) functions are all security invoker'
);
select results_eq(
  $$ select code, exponent from public.currencies where code in ('INR', 'JPY', 'KWD', 'USD') order by code $$,
  $$ values ('INR'::text, 2::smallint), ('JPY', 0::smallint), ('KWD', 3::smallint), ('USD', 2::smallint) $$,
  'currencies carry ISO 4217 exponents (0, 2 and 3 decimals)'
);

-- ---------------------------------------------------------------------------
-- Signup trigger
-- ---------------------------------------------------------------------------
select results_eq(
  $$ select display_name, email, base_currency from public.profiles
     where user_id = '11111111-1111-1111-1111-111111111111' $$,
  $$ values ('Alice'::text, 'alice@example.com'::text, null::text) $$,
  'signup creates a profile with name and email, and no base currency yet'
);
select results_eq(
  $$ select system_key::text, kind::text from public.categories
     where user_id = '11111111-1111-1111-1111-111111111111' and is_system order by system_key $$,
  $$ values ('borrowed', 'income'), ('lent', 'expense'), ('repayment_paid', 'expense'), ('repayment_received', 'income') $$,
  'signup creates the four reserved IOU categories'
);
select is(
  (select display_name from public.profiles where user_id = '22222222-2222-2222-2222-222222222222'),
  null,
  'display name is empty when the provider gives none'
);

-- Ids that later tests need while acting as bob (who cannot read alice's rows).
create temp table fixture as
select id as alice_category_id
from public.categories
where user_id = '11111111-1111-1111-1111-111111111111' and system_key = 'lent';
grant select on fixture to authenticated;

-- ---------------------------------------------------------------------------
-- Act as alice
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);

select is((select count(*)::int from public.profiles), 1, 'a user sees only their own profile');

-- Onboarding
select lives_ok($$ select public.complete_onboarding('INR', 'Asia/Kolkata') $$, 'onboarding succeeds');
select results_eq(
  $$ select base_currency, timezone from public.profiles $$,
  $$ values ('INR'::text, 'Asia/Kolkata'::text) $$,
  'onboarding saves the base currency and timezone'
);
select is(
  (select count(*)::int from public.categories where not is_system and is_default),
  9,
  'onboarding creates the nine starter categories'
);
select throws_ok(
  $$ select public.complete_onboarding('USD', 'UTC') $$,
  'P0001', 'onboarding_already_completed',
  'onboarding only runs once'
);

-- Profile rules
select throws_ok(
  $$ update public.profiles set base_currency = 'USD' $$,
  'P0001', 'base_currency_locked',
  'the base currency cannot change after onboarding (open item 1)'
);
select throws_ok(
  $$ update public.profiles set timezone = 'Mars/Olympus_Mons' $$,
  '22023', 'invalid_timezone',
  'the timezone must be a valid IANA name'
);
select lives_ok(
  $$ update public.profiles set timezone = 'Europe/London', theme_mode = 'dark', accent_theme = 'teal' $$,
  'users can change their timezone and theme'
);
select throws_ok(
  $$ update public.profiles set email = 'someone@else.com' $$,
  '42501', null,
  'email is not directly editable'
);
select throws_ok($$ delete from public.profiles $$, '42501', null, 'profiles cannot be deleted through the API');

-- Categories
select is_empty(
  $$ update public.categories set name = 'Renamed' where is_system returning id $$,
  'system categories cannot be edited'
);
select throws_ok(
  $$ insert into public.categories (name, kind, is_system) values ('Sneaky', 'expense', true) $$,
  '42501', null,
  'users cannot create system categories'
);
select throws_ok(
  $$ update public.categories set kind = 'income' where name = 'Food' $$,
  '42501', null,
  'a category''s kind cannot change'
);
select lives_ok(
  $$ insert into public.categories (name, icon, kind) values ('Coffee', 'coffee', 'expense') $$,
  'users can add a category'
);
select throws_ok(
  $$ insert into public.categories (name, kind) values ('  coffee ', 'expense') $$,
  '23505', null,
  'category names are unique per kind, ignoring case and spaces'
);
select lives_ok(
  $$ update public.categories set is_hidden = true, name = 'Coffee & tea' where name = 'Coffee' $$,
  'users can rename and hide their categories'
);
select throws_ok($$ delete from public.categories $$, '42501', null, 'categories cannot be deleted');

-- Transactions
select lives_ok(
  $$ insert into public.transactions
       (type, category_id, date, payee, original_amount_minor, original_currency, base_amount_minor, exchange_rate)
     select 'expense', id, '2026-10-01', 'Corner cafe', 12345, 'INR', 12345, 1
     from public.categories where name = 'Food' $$,
  'a user can add an expense in their own category'
);
select throws_ok(
  $$ insert into public.transactions
       (type, category_id, date, original_amount_minor, original_currency, base_amount_minor, exchange_rate)
     select 'income', id, '2026-10-01', 100, 'INR', 100, 1 from public.categories where name = 'Food' $$,
  '23514', 'category_kind_mismatch',
  'the transaction type must match the category kind'
);
select throws_ok(
  $$ insert into public.transactions
       (type, category_id, date, original_amount_minor, original_currency, base_amount_minor, exchange_rate)
     select 'expense', id, '2026-10-01', 100, 'INR', 100, 1 from public.categories where system_key = 'lent' $$,
  '23514', 'system_category_reserved',
  'IOU system categories cannot be used for ordinary transactions'
);
select throws_ok(
  $$ insert into public.transactions
       (type, category_id, date, original_amount_minor, original_currency, base_amount_minor, exchange_rate)
     select 'expense', id, '2026-10-01', 0, 'INR', 0, 1 from public.categories where name = 'Food' $$,
  '23514', null,
  'amounts must be positive'
);
select throws_ok(
  $$ insert into public.transactions
       (type, category_id, date, original_amount_minor, original_currency, base_amount_minor, exchange_rate)
     select 'expense', id, '2026-10-01', 100, 'XXX', 100, 1 from public.categories where name = 'Food' $$,
  '23503', null,
  'the currency must be a supported currency'
);
select lives_ok(
  $$ update public.transactions set deleted_at = now() where payee = 'Corner cafe' $$,
  'a transaction can be soft-deleted'
);
select lives_ok(
  $$ update public.transactions set deleted_at = null where payee = 'Corner cafe' $$,
  'a soft delete can be undone'
);
select throws_ok($$ delete from public.transactions $$, '42501', null, 'transactions cannot be hard-deleted');

-- Budgets
select lives_ok(
  $$ insert into public.budgets (month, amount_minor) values ('2026-10-01', 5000000) $$,
  'a user can set an overall budget'
);
select throws_ok(
  $$ insert into public.budgets (month, amount_minor) values ('2026-10-01', 6000000) $$,
  '23505', null,
  'only one overall budget per month'
);
select lives_ok(
  $$ update public.budgets set deleted_at = now();
     insert into public.budgets (month, amount_minor) values ('2026-10-01', 6000000) $$,
  'a removed budget can be replaced'
);
select throws_ok(
  $$ insert into public.budgets (month, amount_minor, category_id)
     select '2026-10-01', 1000, id from public.categories where name = 'Salary' $$,
  '23514', 'category_kind_mismatch',
  'category budgets are for expense categories only'
);
select throws_ok(
  $$ insert into public.budgets (month, amount_minor) values ('2026-10-15', 1000) $$,
  '23514', null,
  'a budget month is the first day of a month'
);

-- Shared reference data
select ok((select count(*) from public.currencies) > 100, 'signed-in users can read currencies');
select lives_ok($$ select * from public.exchange_rates $$, 'signed-in users can read exchange rates');
select throws_ok(
  $$ insert into public.exchange_rates (date, base, quote, rate) values ('2026-10-01', 'USD', 'INR', 88.1) $$,
  '42501', null,
  'users cannot write exchange rates'
);
select throws_ok($$ update public.currencies set exponent = 4 $$, '42501', null, 'users cannot change currencies');

-- ---------------------------------------------------------------------------
-- Act as bob: alice's data is invisible and untouchable
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);

select is((select count(*)::int from public.transactions), 0, 'another user cannot see alice''s transactions');
select is((select count(*)::int from public.budgets), 0, 'another user cannot see alice''s budgets');
select is(
  (select count(*)::int from public.categories where user_id = '11111111-1111-1111-1111-111111111111'),
  0,
  'another user cannot see alice''s categories'
);
select is_empty(
  $$ update public.profiles set display_name = 'Mallory'
     where user_id = '11111111-1111-1111-1111-111111111111' returning id $$,
  'another user cannot change alice''s profile'
);
select throws_ok(
  $$ insert into public.categories (user_id, name, kind)
     values ('11111111-1111-1111-1111-111111111111', 'Planted', 'expense') $$,
  '42501', null,
  'another user cannot create rows owned by alice'
);
select throws_ok(
  format(
    $$ insert into public.transactions
         (type, category_id, date, original_amount_minor, original_currency, base_amount_minor, exchange_rate)
       values ('expense', %L, '2026-10-01', 100, 'USD', 100, 1) $$,
    (select alice_category_id from fixture)
  ),
  '23503', null,
  'another user cannot attach a transaction to alice''s category'
);

-- ---------------------------------------------------------------------------
-- Not signed in: no access at all
-- ---------------------------------------------------------------------------
reset role;
set local role anon;
select set_config('request.jwt.claims', '', true);

select throws_ok($$ select * from public.profiles $$, '42501', null, 'anonymous users cannot read profiles');
select throws_ok($$ select * from public.currencies $$, '42501', null, 'anonymous users cannot read currencies');

select * from finish();
rollback;
