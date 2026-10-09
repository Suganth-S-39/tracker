-- Savings and investments: their own kinds, never counted as spending.
begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

insert into auth.users (id, instance_id, aud, role, email)
values ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'alice@example.com');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);
select public.complete_onboarding('INR', 'Asia/Kolkata');

select results_eq(
  $$ select kind::text as k, count(*)::int from public.categories where not is_system group by kind order by k $$,
  $$ values ('expense', 7), ('income', 2), ('investment', 4), ('savings', 3) $$,
  'onboarding creates starter savings and investment categories'
);

select public.create_transaction('income', (select id from public.categories where name = 'Salary'), '2026-10-01', 1000000, 'INR', '1', 1000000, null, null);
select public.create_transaction('expense', (select id from public.categories where name = 'Food'), '2026-10-02', 40000, 'INR', '1', 40000, null, null);
select public.create_transaction('savings', (select id from public.categories where name = 'Emergency fund'), '2026-10-03', 200000, 'INR', '1', 200000, null, null);
select public.create_transaction('investment', (select id from public.categories where name = 'Mutual funds'), '2026-10-03', 150000, 'INR', '1', 150000, null, null);

select results_eq(
  $$ select income_minor, expense_minor, savings_minor, investment_minor, net_minor from public.month_summary('2026-10-15') $$,
  $$ values (1000000::bigint, 40000::bigint, 200000::bigint, 150000::bigint, 610000::bigint) $$,
  'the month summary separates savings and investments; the balance is what''s left after all of them'
);

select lives_ok($$ select public.set_budget('2026-10-01', null, 100000) $$, 'set an overall budget');
select is(
  (select spent_minor from public.budget_status('2026-10-01') where category_id is null),
  40000::bigint,
  'budgets count expenses only, not savings or investments'
);
select is(
  (select array_agg(category_id) from public.spending_by_category('2026-10-01')),
  array[(select id from public.categories where name = 'Food')],
  'the spending report shows expense categories only'
);
select results_eq(
  $$ select expense_minor, transaction_count from public.daily_totals('2026-10-01') where day = '2026-10-03' $$,
  $$ values (0::bigint, 2) $$,
  'the calendar''s spent leaves savings and investments out (they still count as activity)'
);
select results_eq(
  $$ select type::text, base_amount_minor from public.list_transactions(10, null, null, null, 'investment') $$,
  $$ values ('investment', 150000::bigint) $$,
  'transactions can be listed by the new kinds'
);

-- A category only fits its own kind.
select throws_ok(
  $$ select public.create_transaction('savings', (select id from public.categories where name = 'Food'), '2026-10-04', 100, 'INR', '1', 100, null, null) $$,
  null, null, 'a savings entry cannot use an expense category'
);

-- Recurring works for the new kinds (e.g. a monthly SIP).
select lives_ok(
  $$ select public.create_transaction('investment', (select id from public.categories where name = 'Mutual funds'), '2026-10-05', 500000, 'INR', '1', 500000, 'SIP', null, 'monthly') $$,
  'an investment can repeat monthly'
);
select is(
  (select type::text from public.recurring_rules where payee = 'SIP'),
  'investment',
  'the recurring rule keeps its kind'
);

select * from finish();
rollback;
