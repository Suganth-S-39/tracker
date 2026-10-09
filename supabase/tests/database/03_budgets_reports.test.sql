-- Phase 3: carry-forward budgets, usage, and report queries.
begin;
create extension if not exists pgtap with schema extensions;
select plan(18);

insert into auth.users (id, instance_id, aud, role, email)
values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'alice@example.com'),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bob@example.com');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);
select public.complete_onboarding('USD', 'UTC');
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);
select public.complete_onboarding('INR', 'Asia/Kolkata');

-- Spending: September and October, plus income and a soft-deleted expense that must not count.
select public.create_transaction('expense', (select id from public.categories where name = 'Food'), '2026-09-20', 40000, 'INR', '1', 40000, null, null);
select public.create_transaction('expense', (select id from public.categories where name = 'Food'), '2026-10-02', 30000, 'INR', '1', 30000, null, null);
select public.create_transaction('expense', (select id from public.categories where name = 'Food'), '2026-10-15', 15000, 'INR', '1', 15000, null, null);
select public.create_transaction('expense', (select id from public.categories where name = 'Rent'), '2026-10-01', 200000, 'INR', '1', 200000, null, null);
select public.create_transaction('expense', (select id from public.categories where name = 'Transport'), '2026-10-03', 5000, 'INR', '1', 5000, null, 'deleted');
select public.create_transaction('income', (select id from public.categories where name = 'Salary'), '2026-10-01', 900000, 'INR', '1', 900000, null, null);
update public.transactions set deleted_at = now() where note = 'deleted';

-- An IOU-linked expense in October (written directly; the IOU functions arrive in phase 4).
reset role;
select set_config('app.iou_write', 'on', true); -- what the IOU functions do
insert into public.ious (id, user_id, person_name, direction, original_amount_minor, original_currency,
  base_amount_minor, exchange_rate, date, transaction_id)
values ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'Sam', 'lent',
  70000, 'INR', 70000, 1, '2026-10-05', '44444444-4444-4444-4444-444444444444');
insert into public.transactions (id, user_id, type, category_id, date, original_amount_minor,
  original_currency, base_amount_minor, exchange_rate, iou_id)
values ('44444444-4444-4444-4444-444444444444', '11111111-1111-1111-1111-111111111111', 'expense',
  (select id from public.categories where user_id = '11111111-1111-1111-1111-111111111111' and system_key = 'lent'),
  '2026-10-05', 70000, 'INR', 70000, 1, '33333333-3333-3333-3333-333333333333');
select set_config('app.iou_write', '', true);
set local role authenticated;

-- ---------------------------------------------------------------------------
-- Budgets carry forward
-- ---------------------------------------------------------------------------
select lives_ok($$ select public.set_budget('2026-09-14', null, 500000) $$, 'set an overall budget (any day maps to its month)');
select lives_ok(
  $$ select public.set_budget('2026-09-01', (select id from public.categories where name = 'Food'), 50000) $$,
  'set a category budget'
);
select is((select count(*)::int from public.budgets where deleted_at is null), 2, 'one row per budget');

select results_eq(
  $$ select category_id is null, amount_minor, spent_minor, set_for_month from public.budget_status('2026-10-01') $$,
  $$ values (true, 500000::bigint, 245000::bigint, '2026-09-01'::date),
            (false, 50000::bigint, 45000::bigint, '2026-09-01'::date) $$,
  'September budgets carry into October; usage counts October expenses only, without income, deleted or IOU rows'
);

select lives_ok($$ select public.set_budget('2026-10-01', null, 600000) $$, 'change the overall budget from October');
select lives_ok($$ select public.set_budget('2026-10-20', null, 650000) $$, 'setting it again in the same month replaces it');
select is(
  (select count(*)::int from public.budgets where category_id is null and month = '2026-10-01' and deleted_at is null),
  1,
  'still one overall row for October'
);
select results_eq($$ select amount_minor from public.budget_status('2026-09-01') where category_id is null $$,
  $$ values (500000::bigint) $$, 'September keeps its own budget');
select results_eq($$ select amount_minor from public.budget_status('2026-12-01') where category_id is null $$,
  $$ values (650000::bigint) $$, 'later months use the newest earlier budget');

select lives_ok(
  $$ select public.set_budget('2026-11-01', (select id from public.categories where name = 'Food'), 0) $$,
  'setting 0 clears a category budget from that month on'
);
select results_eq($$ select count(*)::int from public.budget_status('2026-11-01') where category_id is not null $$,
  $$ values (0) $$, 'the cleared budget is gone from November');
select results_eq($$ select count(*)::int from public.budget_status('2026-10-01') where category_id is not null $$,
  $$ values (1) $$, '...but October still has it');
select is_empty($$ select * from public.budget_status('2026-08-01') $$, 'no budgets before the first one was set');

select throws_ok(
  $$ select public.set_budget('2026-10-01', (select id from public.categories where name = 'Salary'), 1000) $$,
  '23514', 'category_kind_mismatch',
  'category budgets are for expense categories only'
);

-- ---------------------------------------------------------------------------
-- Reports
-- ---------------------------------------------------------------------------
select results_eq(
  $$ select c.name, s.spent_minor from public.spending_by_category('2026-10-01') with ordinality s(category_id, spent_minor, n)
     join public.categories c on c.id = s.category_id order by s.n $$,
  $$ values ('Rent'::text, 200000::bigint), ('Food', 45000::bigint) $$,
  'spending by category, largest first, IOU movements excluded by default'
);
select results_eq(
  $$ select c.name, s.spent_minor from public.spending_by_category('2026-10-01', false) with ordinality s(category_id, spent_minor, n)
     join public.categories c on c.id = s.category_id order by s.n $$,
  $$ values ('Rent'::text, 200000::bigint), ('Lent', 70000::bigint), ('Food', 45000::bigint) $$,
  'IOU movements included when the switch is off'
);
select results_eq(
  $$ select month, income_minor, expense_minor from public.monthly_totals('2026-08-01', '2026-10-31') $$,
  $$ values ('2026-08-01'::date, 0::bigint, 0::bigint),
            ('2026-09-01'::date, 0::bigint, 40000::bigint),
            ('2026-10-01'::date, 900000::bigint, 245000::bigint) $$,
  'monthly totals include empty months and exclude IOU movements by default'
);

-- Another user sees none of this.
select set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);
select ok(
  (select count(*) from public.budget_status('2026-10-01')) = 0
  and (select count(*) from public.spending_by_category('2026-10-01')) = 0
  and (select sum(expense_minor) from public.monthly_totals('2026-08-01', '2026-10-31')) = 0,
  'another user sees no budgets, spending or totals'
);

select * from finish();
rollback;
