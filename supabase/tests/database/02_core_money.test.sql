-- Phase 2: money helpers, rate lookup, transaction functions and queries.
begin;
create extension if not exists pgtap with schema extensions;
select plan(45);

-- ---------------------------------------------------------------------------
-- Half-even rounding (same cases as src/domain/money.test.ts)
-- ---------------------------------------------------------------------------
select is(private.round_half_even(2.5, 0), 2::numeric, 'half-even: 2.5 -> 2');
select is(private.round_half_even(3.5, 0), 4::numeric, 'half-even: 3.5 -> 4');
select is(private.round_half_even(-2.5, 0), -2::numeric, 'half-even: -2.5 -> -2');
select is(private.round_half_even(-3.5, 0), -4::numeric, 'half-even: -3.5 -> -4');
select is(private.round_half_even(2.4999, 0), 2::numeric, 'below half rounds down');
select is(private.round_half_even(2.5001, 0), 3::numeric, 'above half rounds up');
select is(private.round_half_even(2.675, 2), 2.68::numeric, 'half-even at 2 places: 2.675 -> 2.68');
select is(private.round_half_even(1.005, 2), 1.00::numeric, 'half-even at 2 places: 1.005 -> 1.00');
select is(private.round_half_even(0.0000000000125, 12), 0.000000000012::numeric, 'half-even at 12 places');

-- convert_minor: amount in minor units x rate, across exponents
select is(private.convert_minor(1000, 0.30705, 2, 3), 3070::bigint,
  'USD 10.00 at 0.30705 -> KWD 3.070 (3.0705 rounds half-even, not up)');
select is(private.convert_minor(1000, 0.30715, 2, 3), 3072::bigint,
  'USD 10.00 at 0.30715 -> KWD 3.072 (3.0715 rounds half-even up to the even digit)');
select is(private.convert_minor(1250, 0.0067, 0, 2), 838::bigint, 'JPY 1250 at 0.0067 -> USD 8.38 (0 -> 2 decimals)');
select is(private.convert_minor(999, 154.123, 2, 0), 1540::bigint, 'USD 9.99 at 154.123 -> JPY 1540 (2 -> 0 decimals)');
select is(private.convert_minor(12345, 1, 2, 2), 12345::bigint, 'rate 1 keeps the amount');

-- ---------------------------------------------------------------------------
-- Rates: stored against a pivot, cross rates derived
-- ---------------------------------------------------------------------------
delete from public.exchange_rates;
insert into public.exchange_rates (date, base, quote, rate) values
  ('2026-10-01', 'EUR', 'USD', 1.10), ('2026-10-01', 'EUR', 'INR', 99.00),
  ('2026-10-02', 'EUR', 'USD', 1.12), ('2026-10-02', 'EUR', 'INR', 100.80),
  ('2026-10-02', 'EUR', 'KWD', 0.3456),
  -- A newer date with only one currency: cross rates must use a date that has both.
  ('2026-10-03', 'EUR', 'USD', 1.13);

select results_eq($$ select rate, rate_date from public.latest_rate('USD', 'INR') $$,
  $$ values ('90.000000000000'::text, '2026-10-02'::date) $$,
  'cross rate USD->INR uses the latest date with both legs (100.80 / 1.12)');
select results_eq($$ select rate from public.latest_rate('EUR', 'USD') $$, $$ values ('1.130000000000'::text) $$,
  'pivot -> quote is the stored rate');
select results_eq($$ select rate from public.latest_rate('USD', 'EUR') $$, $$ values ('0.884955752212'::text) $$,
  'quote -> pivot is the inverse, rounded half-even to 12 places');
select results_eq($$ select rate, rate_date from public.latest_rate('INR', 'INR') $$, $$ values ('1'::text, null::date) $$,
  'same currency is 1');
select is_empty($$ select * from public.latest_rate('USD', 'JPY') $$, 'no row when a rate is unknown');

-- ---------------------------------------------------------------------------
-- Users: alice (base INR) and bob (base USD)
-- ---------------------------------------------------------------------------
insert into auth.users (id, instance_id, aud, role, email)
values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'alice@example.com'),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bob@example.com');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);
select public.complete_onboarding('USD', 'America/New_York');
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);
select public.complete_onboarding('INR', 'Asia/Kolkata');

select ok((select count(*) from public.latest_rate('USD', 'INR')) = 1, 'signed-in users can look up rates');

-- create_transaction
select lives_ok(
  $$ select public.create_transaction('expense', (select id from public.categories where name = 'Food'),
       '2026-10-05', 12050, 'INR', '1', 12050, '  Corner Cafe  ', 'Lunch') $$,
  'create an expense in the base currency'
);
select results_eq(
  $$ select payee, note, exchange_rate from public.transactions where note = 'Lunch' $$,
  $$ values ('Corner Cafe'::text, 'Lunch'::text, 1::numeric) $$,
  'payee is trimmed and the rate is stored exactly'
);
select throws_ok(
  $$ select public.create_transaction('expense', (select id from public.categories where name = 'Food'),
       '2026-10-05', 100, 'INR', '1.5', 150, null, null) $$,
  '23514', 'base_amount_mismatch',
  'in the base currency the rate must be 1'
);
select lives_ok(
  $$ select public.create_transaction('income', (select id from public.categories where name = 'Salary'),
       '2026-10-03', 10000, 'USD', '90.123456789012', 901235, 'Acme Corp', 'Consulting') $$,
  'create a foreign-currency income with a 12-decimal rate'
);
select results_eq(
  $$ select exchange_rate::text from public.transactions where note = 'Consulting' $$,
  $$ values ('90.123456789012'::text) $$,
  'the rate is stored without losing precision'
);
select lives_ok(
  $$ select public.create_transaction('expense', (select id from public.categories where name = 'Shopping'),
       '2026-10-04', 1000, 'KWD', '270.5', 27050, 'corner cafe', 'KWD shoes') $$,
  'converted amount equal to amount x rate is accepted (3-decimal currency)'
);
select throws_ok(
  $$ select public.create_transaction('expense', (select id from public.categories where name = 'Food'),
       '2026-10-05', 10000, 'USD', '90', 899000, null, null) $$,
  '23514', 'base_amount_mismatch',
  'a converted amount that does not match the rate is rejected'
);
select throws_ok(
  $$ select public.create_transaction('expense', (select id from public.categories where name = 'Food'),
       '2026-10-05', 10000, 'USD', 'abc', 900000, null, null) $$,
  '22P02', null,
  'the rate must be a number'
);

-- More rows for list/summary tests
select public.create_transaction('expense', (select id from public.categories where name = 'Transport'),
  '2026-09-30', 5000, 'INR', '1', 5000, 'Metro', null);
select public.create_transaction('expense', (select id from public.categories where name = 'Bills'),
  '2026-10-05', 30000, 'INR', '1', 30000, 'Power Co', 'October 100% paid');

-- update_transaction
select lives_ok(
  $$ select public.update_transaction((select id from public.transactions where note = 'Lunch'),
       'expense', (select id from public.categories where name = 'Food'), '2026-10-05', 13000, 'INR', '1', 13000,
       'Corner Cafe', 'Lunch') $$,
  'update a transaction'
);
select is((select original_amount_minor from public.transactions where note = 'Lunch'), 13000::bigint, 'the update is saved');

-- list_transactions: newest first, keyset cursor, filters, search
select results_eq(
  $$ select note from public.list_transactions(p_limit => 10) $$,
  $$ values ('October 100% paid'::text), ('Lunch'), ('KWD shoes'), ('Consulting'), (null) $$,
  'newest first by date, then by creation time'
);
select results_eq(
  $$ with first_page as (select * from public.list_transactions(p_limit => 2)),
          cursor as (select * from first_page order by date, created_at, id limit 1)
     select l.note from cursor c, public.list_transactions(2, c.date, c.created_at, c.id) l $$,
  $$ values ('KWD shoes'::text), ('Consulting') $$,
  'the cursor continues exactly after the previous page'
);
select results_eq($$ select note from public.list_transactions(p_type => 'income') $$, $$ values ('Consulting'::text) $$,
  'filter by type');
select results_eq(
  $$ select note from public.list_transactions(p_from => '2026-10-04', p_to => '2026-10-04') $$,
  $$ values ('KWD shoes'::text) $$,
  'filter by date range'
);
select results_eq(
  $$ select note from public.list_transactions(p_search => 'CAFE') $$,
  $$ values ('Lunch'::text), ('KWD shoes') $$,
  'search matches payee, ignoring case'
);
select results_eq($$ select note from public.list_transactions(p_search => '100%') $$, $$ values ('October 100% paid'::text) $$,
  'search matches note, with % treated literally');
select results_eq(
  $$ select exchange_rate from public.list_transactions(p_type => 'income') $$,
  $$ values ('90.123456789012'::text) $$,
  'rates are returned as text'
);

-- Soft delete hides rows from lists and totals
update public.transactions set deleted_at = now() where note = 'KWD shoes';
select is((select count(*)::int from public.list_transactions()), 4, 'soft-deleted rows are not listed');

-- month_summary: base amounts, excluding IOU-linked transactions and other months
select results_eq(
  $$ select income_minor, expense_minor, net_minor from public.month_summary('2026-10-15') $$,
  $$ values (901235::bigint, 43000::bigint, 858235::bigint) $$,
  'month totals use base amounts and skip deleted rows and other months'
);

-- An IOU-linked transaction (written directly here; the IOU functions arrive in phase 4).
reset role;
select set_config('app.iou_write', 'on', true); -- what the IOU functions do
insert into public.ious (id, user_id, person_name, direction, original_amount_minor, original_currency,
  base_amount_minor, exchange_rate, date, transaction_id)
values ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'Sam', 'lent',
  50000, 'INR', 50000, 1, '2026-10-06', '44444444-4444-4444-4444-444444444444');
insert into public.transactions (id, user_id, type, category_id, date, payee, original_amount_minor,
  original_currency, base_amount_minor, exchange_rate, iou_id)
values ('44444444-4444-4444-4444-444444444444', '11111111-1111-1111-1111-111111111111', 'expense',
  (select id from public.categories where user_id = '11111111-1111-1111-1111-111111111111' and system_key = 'lent'),
  '2026-10-06', 'Sam', 50000, 'INR', 50000, 1, '33333333-3333-3333-3333-333333333333');
select set_config('app.iou_write', '', true);
set local role authenticated;

select results_eq(
  $$ select expense_minor from public.month_summary('2026-10-01') $$,
  $$ values (43000::bigint) $$,
  'IOU-linked transactions are excluded from month totals'
);
select results_eq(
  $$ select payee from public.recent_payees() $$,
  $$ values ('Power Co'::text), ('Corner Cafe'), ('Acme Corp'), ('Metro') $$,
  'payees: distinct ignoring case, most recent first, without deleted or IOU-linked rows'
);
select throws_ok(
  $$ select public.update_transaction('44444444-4444-4444-4444-444444444444', 'expense',
       (select id from public.categories where system_key = 'lent'), '2026-10-06', 1, 'INR', '1', 1, null, null) $$,
  'P0002', 'transaction_not_found',
  'IOU-linked transactions cannot be edited directly'
);

-- ---------------------------------------------------------------------------
-- Another user sees nothing and cannot change alice's rows
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);
select is((select count(*)::int from public.list_transactions()), 0, 'another user lists none of alice''s transactions');
select results_eq($$ select income_minor, expense_minor from public.month_summary('2026-10-01') $$,
  $$ values (0::bigint, 0::bigint) $$, 'another user''s month totals do not include alice''s data');
select throws_ok(
  $$ select public.update_transaction((select id from public.transactions limit 1), 'expense',
       (select id from public.categories where name = 'Food'), '2026-10-05', 1, 'USD', '1', 1, null, null) $$,
  'P0002', 'transaction_not_found',
  'another user cannot update alice''s transaction'
);

select * from finish();
rollback;
