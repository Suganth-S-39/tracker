-- Phase 4: recurring transactions and their generation job.
begin;
create extension if not exists pgtap with schema extensions;
select plan(26);

delete from public.exchange_rates;
insert into public.exchange_rates (date, base, quote, rate) values
  ('2026-01-01', 'EUR', 'USD', 1.10), ('2026-01-01', 'EUR', 'INR', 99.00); -- USD -> INR = 90

-- ---------------------------------------------------------------------------
-- Due-date arithmetic
-- ---------------------------------------------------------------------------
select results_eq(
  $$ values
       (private.next_occurrence('2026-12-31', 'daily', 31)),
       (private.next_occurrence('2026-12-29', 'weekly', 29)),
       (private.next_occurrence('2026-01-31', 'monthly', 31)),
       (private.next_occurrence('2026-02-28', 'monthly', 31)),
       (private.next_occurrence('2026-04-30', 'monthly', 31)),
       (private.next_occurrence('2028-02-29', 'yearly', 29)),
       (private.next_occurrence('2031-02-28', 'yearly', 29)) $$,
  $$ values ('2027-01-01'::date), ('2027-01-05'::date), ('2026-02-28'::date), ('2026-03-31'::date),
            ('2026-05-31'::date), ('2029-02-28'::date), ('2032-02-29'::date) $$,
  'daily, weekly, and monthly/yearly with month-end clamping that returns to the anchor day'
);

-- ---------------------------------------------------------------------------
-- Users: alice (INR, far-east time zone), bob (USD, far-west time zone)
-- ---------------------------------------------------------------------------
insert into auth.users (id, instance_id, aud, role, email)
values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'alice@example.com'),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bob@example.com');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);
select public.complete_onboarding('USD', 'Pacific/Pago_Pago'); -- UTC-11
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);
select public.complete_onboarding('INR', 'Pacific/Kiritimati'); -- UTC+14

create temp table ids (name text primary key, id uuid);
grant all on ids to authenticated;

-- ---------------------------------------------------------------------------
-- Repeat: rule + first occurrence in one call
-- ---------------------------------------------------------------------------
select lives_ok(
  $$ insert into ids select 'rent-tx', public.create_transaction('expense', (select id from public.categories where name = 'Rent'),
       '2026-01-31', 2500000, 'INR', '1', 2500000, 'Landlord', 'Flat', 'monthly') $$,
  'a transaction with Repeat creates its rule and first occurrence'
);
insert into ids select 'rent', recurring_rule_id from public.transactions where id = (select id from ids where name = 'rent-tx');
select results_eq(
  $$ select frequency::text, anchor_day::int, next_due_date, amount_minor, payee from public.recurring_rules where id = (select id from ids where name = 'rent') $$,
  $$ values ('monthly'::text, 31, '2026-02-28'::date, 2500000::bigint, 'Landlord'::text) $$,
  'the rule remembers the day of month and is next due at the end of February'
);
select results_eq(
  $$ select occurrence_date from public.transactions where id = (select id from ids where name = 'rent-tx') $$,
  $$ values ('2026-01-31'::date) $$,
  'the first occurrence is linked to the rule'
);

-- ---------------------------------------------------------------------------
-- Generation
-- ---------------------------------------------------------------------------
reset role;
select is(private.generate_recurring('2026-04-15 12:00+00'), 2, 'catching up generates every due occurrence');
select results_eq(
  $$ select date, base_amount_minor, payee, note from public.transactions
     where recurring_rule_id = (select id from ids where name = 'rent') order by date $$,
  $$ values ('2026-01-31'::date, 2500000::bigint, 'Landlord'::text, 'Flat'::text),
            ('2026-02-28'::date, 2500000::bigint, 'Landlord'::text, 'Flat'::text),
            ('2026-03-31'::date, 2500000::bigint, 'Landlord'::text, 'Flat'::text) $$,
  'occurrences copy the rule and follow the month-end rule'
);
select results_eq(
  $$ select next_due_date from public.recurring_rules where id = (select id from ids where name = 'rent') $$,
  $$ values ('2026-04-30'::date) $$,
  'next_due_date advances past the generated occurrences'
);
select is(private.generate_recurring('2026-04-15 12:00+00'), 0, 'running the job again is harmless');

-- Edited and deleted occurrences are never touched again.
update public.transactions set note = 'Paid late' where recurring_rule_id = (select id from ids where name = 'rent') and date = '2026-02-28';
update public.transactions set deleted_at = now() where recurring_rule_id = (select id from ids where name = 'rent') and date = '2026-03-31';
update public.recurring_rules set next_due_date = '2026-02-28' where id = (select id from ids where name = 'rent');
select is(private.generate_recurring('2026-04-15 12:00+00'), 0, 'a re-run over the same dates inserts nothing');
select results_eq(
  $$ select note from public.transactions where recurring_rule_id = (select id from ids where name = 'rent') and date = '2026-02-28' $$,
  $$ values ('Paid late'::text) $$,
  'an edited occurrence is never overwritten'
);
select results_eq(
  $$ select count(*)::int from public.transactions
     where recurring_rule_id = (select id from ids where name = 'rent') and date = '2026-03-31' and deleted_at is null $$,
  $$ values (0) $$,
  'a deleted occurrence is never restored'
);


-- Time zones: "today" is the user's own date. (Each Repeat is created in its own statement:
-- calling create_transaction inside a WHERE clause would run it once per scanned row.)
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);
insert into ids select 'alice-coffee-tx', public.create_transaction('expense', (select id from public.categories where name = 'Food'),
  '2026-05-30', 15000, 'INR', '1', 15000, 'Cafe', null, 'daily');
insert into ids select 'alice-coffee', recurring_rule_id from public.transactions where id = (select id from ids where name = 'alice-coffee-tx');
select set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);
insert into ids select 'bob-coffee-tx', public.create_transaction('expense', (select id from public.categories where name = 'Food'),
  '2026-05-30', 500, 'USD', '1', 500, 'Cafe', null, 'daily');
insert into ids select 'bob-coffee', recurring_rule_id from public.transactions where id = (select id from ids where name = 'bob-coffee-tx');
reset role;
-- 2026-05-30 12:00 UTC is already May 31 in Kiritimati (UTC+14) but still May 30 in Pago Pago (UTC-11).
select private.generate_recurring('2026-05-30 12:00+00');
select results_eq(
  $$ select (select count(*)::int from public.transactions where recurring_rule_id = (select id from ids where name = 'alice-coffee')),
            (select count(*)::int from public.transactions where recurring_rule_id = (select id from ids where name = 'bob-coffee')) $$,
  $$ values (2, 1) $$,
  'only the user whose day has arrived gets the next occurrence'
);
select results_eq(
  $$ select (select next_due_date from public.recurring_rules where id = (select id from ids where name = 'alice-coffee')),
            (select next_due_date from public.recurring_rules where id = (select id from ids where name = 'bob-coffee')) $$,
  $$ values ('2026-06-01'::date, '2026-05-31'::date) $$,
  'each rule advances by its owner''s local date'
);

-- Foreign currency: the latest rate; no rate known yet: skipped and retried later.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);
insert into ids select 'usd-sub-tx', public.create_transaction('expense', (select id from public.categories where name = 'Entertainment'),
  '2026-01-15', 1000, 'USD', '88', 88000, 'Streaming', null, 'monthly');
insert into ids select 'usd-sub', recurring_rule_id from public.transactions where id = (select id from ids where name = 'usd-sub-tx');
insert into ids select 'jpy-sub-tx', public.create_transaction('expense', (select id from public.categories where name = 'Entertainment'),
  '2026-01-15', 500, 'JPY', '0.55', 27500, 'Game pass', null, 'monthly');
insert into ids select 'jpy-sub', recurring_rule_id from public.transactions where id = (select id from ids where name = 'jpy-sub-tx');
reset role;
select private.generate_recurring('2026-02-16 12:00+00');
select results_eq(
  $$ select exchange_rate, base_amount_minor from public.transactions
     where recurring_rule_id = (select id from ids where name = 'usd-sub') and date = '2026-02-15' $$,
  $$ values (90::numeric, 90000::bigint) $$,
  'a foreign-currency occurrence uses the latest rate'
);
select results_eq(
  $$ select (select count(*)::int from public.transactions where recurring_rule_id = (select id from ids where name = 'jpy-sub')),
            (select next_due_date from public.recurring_rules where id = (select id from ids where name = 'jpy-sub')) $$,
  $$ values (1, '2026-02-15'::date) $$,
  'with no rate yet, the rule is skipped and not advanced'
);

-- ---------------------------------------------------------------------------
-- Managing rules
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);
select lives_ok(
  $$ select public.update_recurring_rule((select id from ids where name = 'usd-sub'), 'expense',
       (select id from public.categories where name = 'Entertainment'), 1500, 'USD', 'monthly', '2026-03-15', 'Streaming+', null) $$,
  'edit a rule'
);
reset role;
select private.generate_recurring('2026-03-16 12:00+00');
select results_eq(
  $$ select date, original_amount_minor, payee from public.transactions
     where recurring_rule_id = (select id from ids where name = 'usd-sub') order by date $$,
  $$ values ('2026-01-15'::date, 1000::bigint, 'Streaming'::text),
            ('2026-02-15'::date, 1000::bigint, 'Streaming'::text),
            ('2026-03-15'::date, 1500::bigint, 'Streaming+'::text) $$,
  'editing a rule only affects occurrences generated afterwards'
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);
select lives_ok($$ select public.set_recurring_rule_active((select id from ids where name = 'usd-sub'), false) $$, 'pause a rule');
reset role;
select private.generate_recurring('2026-07-01 12:00+00');
select results_eq(
  $$ select count(*)::int from public.transactions where recurring_rule_id = (select id from ids where name = 'usd-sub') $$,
  $$ values (3) $$,
  'a paused rule generates nothing'
);
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);
select lives_ok($$ select public.set_recurring_rule_active((select id from ids where name = 'usd-sub'), true) $$, 'resume it');
select ok(
  (select next_due_date from public.recurring_rules where id = (select id from ids where name = 'usd-sub'))
    >= (now() at time zone 'Pacific/Kiritimati')::date,
  'resuming skips the paused period: next due is today or later, nothing is back-filled'
);

select lives_ok($$ select public.delete_recurring_rule((select id from ids where name = 'rent')) $$, 'delete a rule');
reset role;
create temp table rent_before as
  select count(*)::int as n from public.transactions
  where recurring_rule_id = (select id from ids where name = 'rent') and deleted_at is null;
select private.generate_recurring('2027-01-01 12:00+00');
select results_eq(
  $$ select count(*)::int from public.transactions
     where recurring_rule_id = (select id from ids where name = 'rent') and deleted_at is null $$,
  $$ select n from rent_before where n > 0 $$,
  'deleting a rule keeps its occurrences and stops new ones'
);
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);

-- ---------------------------------------------------------------------------
-- Security
-- ---------------------------------------------------------------------------
select throws_ok(
  $$ select private.generate_recurring() $$,
  '42501', null,
  'signed-in users cannot run the generation job'
);
select set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);
select throws_ok(
  $$ select public.delete_recurring_rule((select id from ids where name = 'usd-sub')) $$,
  'P0002', 'recurring_rule_not_found',
  'another user cannot change alice''s rules'
);
reset role;
select is(
  (select count(*)::int from cron.job where jobname = 'generate-recurring-transactions' and schedule = '0 * * * *'),
  1,
  'the hourly pg_cron job is scheduled'
);

select * from finish();
rollback;
