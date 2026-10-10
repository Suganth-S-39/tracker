-- Savings goals: money in (savings linked to the goal), out (withdrawals), bought (purchase), and
-- the rules that keep a goal from ever holding less than nothing.
begin;
create extension if not exists pgtap with schema extensions;
select plan(40);

insert into auth.users (id, instance_id, aud, role, email)
values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'alice@example.com'),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bob@example.com');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);
select public.complete_onboarding('INR', 'Asia/Kolkata');

create temp table ids (key text primary key, id uuid);
grant all on ids to authenticated;

-- ---------------------------------------------------------------------------
-- A goal and money going in
-- ---------------------------------------------------------------------------
select lives_ok(
  $$ with g as (
       insert into public.goals (name, target_minor, target_date, icon) values ('New phone', 1500000, '2026-12-15', 'smartphone') returning id
     )
     insert into ids select 'phone', id from g $$,
  'a goal is created with a name, a target and an optional date'
);
select throws_ok(
  $$ insert into public.goals (name, target_minor) values ('Nothing', 0) $$,
  '23514', null, 'a goal needs a target above zero'
);
select throws_ok(
  $$ insert into public.goals (name, target_minor, photo_data_url) values ('Bad photo', 100, 'data:image/svg+xml;base64,PHN2Zy8+') $$,
  '23514', null, 'goal photos are raster images only'
);
select throws_ok(
  $$ insert into public.goals (name, target_minor, bought_on) values ('Sneaky', 100, '2026-10-01') $$,
  '42501', null, 'a goal can''t be created as already bought'
);

select public.create_transaction('income', (select id from public.categories where name = 'Salary'), '2026-10-01', 2000000, 'INR', '1', 2000000, null, null);
select lives_ok(
  $$ insert into ids select 'in1', public.create_transaction('savings', (select id from public.categories where name = 'Savings account'),
       '2026-10-02', 500000, 'INR', '1', 500000, null, null, null, (select id from ids where key = 'phone')) $$,
  'savings go into a goal'
);
select public.create_transaction('savings', (select id from public.categories where name = 'Savings account'),
  '2026-10-05', 350000, 'INR', '1', 350000, null, 'Bonus', null, (select id from ids where key = 'phone'));

select results_eq(
  $$ select saved_minor, added_minor, taken_minor, has_photo, first_added_on from public.goal_list('2026-10-10') $$,
  $$ values (850000::bigint, 850000::bigint, 0::bigint, false, '2026-10-02'::date) $$,
  'goal_list adds up what''s in the goal'
);
select throws_ok(
  $$ select public.create_transaction('savings', (select id from public.categories where name = 'Savings account'),
       '2026-10-06', 100, 'INR', '1', 100, null, null, 'weekly', (select id from ids where key = 'phone')) $$,
  '23514', 'goal_repeat_unsupported', 'goal savings can''t repeat'
);
select throws_ok(
  $$ select public.create_transaction('income', (select id from public.categories where name = 'Salary'),
       '2026-10-06', 100, 'INR', '1', 100, null, null, null, (select id from ids where key = 'phone')) $$,
  '23514', null, 'only savings go into a goal (not income)'
);
select results_eq(
  $$ select count(*)::int from public.list_transactions(50, null, null, null, null, null, null, null, null, (select id from ids where key = 'phone')) $$,
  $$ values (2) $$,
  'the list shows one goal''s money'
);

-- ---------------------------------------------------------------------------
-- Taking money out
-- ---------------------------------------------------------------------------
select throws_ok(
  $$ select public.take_from_goal((select id from ids where key = 'phone'), 850001, '2026-10-07') $$,
  '23514', 'goal_take_exceeds_saved', 'you can''t take out more than is in the goal'
);
select lives_ok(
  $$ insert into ids select 'out1', public.take_from_goal((select id from ids where key = 'phone'), 100000, '2026-10-07', ' Doctor ') $$,
  'taking money out'
);
select results_eq(
  $$ select t.type::text, c.system_key::text, t.base_amount_minor, t.note from public.transactions t
     join public.categories c on c.id = t.category_id where t.id = (select id from ids where key = 'out1') $$,
  $$ values ('withdrawal', 'goal_withdrawal', 100000::bigint, 'Doctor') $$,
  'is a withdrawal in the reserved category'
);
select results_eq(
  $$ select saved_minor, taken_minor, recent_net_minor from public.goal_list('2026-10-10') $$,
  $$ values (750000::bigint, 100000::bigint, 750000::bigint) $$,
  'what''s in the goal drops, and the pace counts it'
);
select results_eq(
  $$ select savings_minor, net_minor from public.month_summary('2026-10-01') $$,
  $$ values (750000::bigint, 1250000::bigint) $$,
  'the month''s savings are net of what was taken out, so the balance gets it back'
);
select throws_ok(
  $$ insert into public.transactions (type, category_id, date, original_amount_minor, original_currency, base_amount_minor, exchange_rate, goal_id)
     values ('withdrawal', (select id from public.categories where system_key = 'goal_withdrawal'), '2026-10-07', 1, 'INR', 1, 1, (select id from ids where key = 'phone')) $$,
  'P0001', 'goal_managed', 'withdrawals are only made by take_from_goal'
);
select throws_ok(
  $$ update public.transactions set deleted_at = now() where id = (select id from ids where key = 'out1') $$,
  'P0001', 'goal_managed', 'and only deleted through the goal functions'
);
select throws_ok(
  $$ insert into public.categories (name, kind) values ('Mine', 'withdrawal') $$,
  null, null, 'nobody makes their own withdrawal categories'
);

-- Deleting savings that were already taken out again would leave the goal below zero.
select public.take_from_goal((select id from ids where key = 'phone'), 400000, '2026-10-08');
select throws_ok(
  $$ update public.transactions set deleted_at = now() where id = (select id from ids where key = 'in1') $$,
  '23514', 'goal_balance_negative', 'a goal never holds less than nothing'
);
select lives_ok(
  $$ select public.set_goal_withdrawal_deleted((select id from ids where key = 'out1'), true) $$,
  'deleting a withdrawal'
);
select is((select saved_minor from public.goal_list('2026-10-10')), 450000::bigint, 'puts the money back in the goal');
select lives_ok(
  $$ select public.set_goal_withdrawal_deleted((select id from ids where key = 'out1'), false) $$,
  'and Undo restores it'
);
select is((select saved_minor from public.goal_list('2026-10-10')), 350000::bigint, 'taking it out again');

-- ---------------------------------------------------------------------------
-- Bought
-- ---------------------------------------------------------------------------
select public.set_budget('2026-10-01', null, 1000000);
select lives_ok(
  $$ select public.complete_goal((select id from ids where key = 'phone'), (select id from public.categories where name = 'Shopping'), '2026-10-09', 400000) $$,
  'I bought it (it cost a bit more than was in the goal)'
);
select results_eq(
  $$ select bought_on, saved_minor, spent_minor, taken_minor from public.goal_list('2026-10-10') $$,
  $$ values ('2026-10-09'::date, 0::bigint, 400000::bigint, 500000::bigint) $$,
  'the goal is bought, empty, and remembers what it cost'
);
select results_eq(
  $$ select t.type::text, t.payee, t.base_amount_minor from public.transactions t
     where t.id = (select purchase_transaction_id from public.goals where id = (select id from ids where key = 'phone')) $$,
  $$ values ('expense', 'New phone', 400000::bigint) $$,
  'the purchase is an expense named after the goal'
);
select results_eq(
  $$ select expense_minor, savings_minor, net_minor from public.month_summary('2026-10-01') $$,
  $$ values (400000::bigint, 0::bigint, 1600000::bigint) $$,
  'only the extra it cost comes out of the balance (the rest was saved)'
);
select is(
  (select spent_minor from public.budget_status('2026-10-01') where category_id is null),
  0::bigint,
  'budgets leave the purchase out'
);
select is(
  (select spent_minor from public.spending_by_category('2026-10-01') where category_id = (select id from public.categories where name = 'Shopping')),
  400000::bigint,
  'the spending report shows it'
);
select throws_ok(
  $$ select public.create_transaction('savings', (select id from public.categories where name = 'Savings account'),
       '2026-10-10', 100, 'INR', '1', 100, null, null, null, (select id from ids where key = 'phone')) $$,
  'P0001', 'goal_closed', 'a bought goal takes no more money'
);
select throws_ok(
  $$ update public.transactions set base_amount_minor = 1, original_amount_minor = 1 where id = (select id from ids where key = 'in1') $$,
  'P0001', 'goal_closed', 'and what it was bought with is fixed'
);
select lives_ok(
  $$ update public.transactions set note = 'First pay' where id = (select id from ids where key = 'in1') $$,
  'notes on its savings can still change'
);
select throws_ok(
  $$ update public.goals set bought_on = null where id = (select id from ids where key = 'phone') $$,
  'P0001', 'goal_managed', 'bought is only set and cleared by the goal functions'
);
select throws_ok(
  $$ select public.update_transaction((select purchase_transaction_id from public.goals), 'expense',
       (select id from public.categories where name = 'Shopping'), '2026-10-09', 1, 'INR', '1', 1, null, null,
       (select id from ids where key = 'phone')) $$,
  'P0001', 'goal_managed', 'the purchase changes only through the goal'
);

select lives_ok($$ select public.reopen_goal((select id from ids where key = 'phone')) $$, 'not bought yet');
select results_eq(
  $$ select bought_on, saved_minor, spent_minor from public.goal_list('2026-10-10') $$,
  $$ values (null::date, 350000::bigint, 0::bigint) $$,
  'reopening removes the purchase and puts the money back'
);

-- ---------------------------------------------------------------------------
-- Deleted goals and other people
-- ---------------------------------------------------------------------------
update public.goals set deleted_at = now() where id = (select id from ids where key = 'phone');
select is_empty($$ select id from public.goal_list('2026-10-10') $$, 'a deleted goal leaves the list');
select throws_ok(
  $$ select public.create_transaction('savings', (select id from public.categories where name = 'Savings account'),
       '2026-10-10', 100, 'INR', '1', 100, null, null, null, (select id from ids where key = 'phone')) $$,
  'P0002', 'goal_not_found', 'and takes no more money'
);
select throws_ok($$ delete from public.goals $$, '42501', null, 'goals are never hard-deleted by users');

select set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);
select public.complete_onboarding('USD', 'UTC');
select is_empty($$ select id from public.goals $$, 'nobody else can see a goal');
select throws_ok(
  $$ select public.take_from_goal((select id from ids where key = 'phone'), 1, '2026-10-10') $$,
  'P0002', 'goal_not_found', 'or take money out of it'
);

select * from finish();
rollback;
