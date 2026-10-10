-- Phase 5: deleting an account removes every row the user owns (the delete-account Edge Function
-- deletes the auth user; ON DELETE CASCADE does the rest), and nobody else's.
begin;
create extension if not exists pgtap with schema extensions;
select plan(3);

insert into auth.users (id, instance_id, aud, role, email)
values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'alice@example.com'),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bob@example.com');

-- Give both users one of everything.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);
select public.complete_onboarding('INR', 'Asia/Kolkata');
select public.create_transaction('expense', (select id from public.categories where name = 'Rent'), '2026-10-01', 100000, 'INR', '1', 100000, 'Landlord', null, 'monthly');
select public.set_budget('2026-10-01', null, 500000);
select public.create_repayment(public.create_iou('Sam', 'lent', 5000, 'INR', '1', 5000, '2026-10-01'), 1000, 'INR', 1000, '1', 1000, '1', '2026-10-02');
-- A bought goal: the goal and its purchase reference each other.
insert into public.goals (name, target_minor) values ('Phone', 20000);
select public.create_transaction('savings', (select id from public.categories where name = 'Savings account'), '2026-10-01', 20000, 'INR', '1', 20000, null, null, null, (select id from public.goals));
select public.complete_goal((select id from public.goals), (select id from public.categories where name = 'Shopping'), '2026-10-03', 19000);
select set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);
select public.complete_onboarding('USD', 'UTC');
select public.create_transaction('expense', (select id from public.categories where name = 'Food'), '2026-10-01', 1200, 'USD', '1', 1200, null, null, 'weekly');
select public.create_iou('Lee', 'borrowed', 3000, 'USD', '1', 3000, '2026-10-01');
reset role;

create temp table owned as
select 'profiles' as t, user_id from public.profiles
union all select 'categories', user_id from public.categories
union all select 'transactions', user_id from public.transactions
union all select 'budgets', user_id from public.budgets
union all select 'recurring_rules', user_id from public.recurring_rules
union all select 'ious', user_id from public.ious
union all select 'iou_repayments', user_id from public.iou_repayments
union all select 'goals', user_id from public.goals;

select is(
  (select count(distinct t)::int from owned where user_id = '11111111-1111-1111-1111-111111111111'),
  8,
  'before: alice has rows in all eight user tables'
);

-- What the Edge Function does with the admin client.
delete from auth.users where id = '11111111-1111-1111-1111-111111111111';

select is_empty(
  $$ select 'profiles' from public.profiles where user_id = '11111111-1111-1111-1111-111111111111'
     union all select 'categories' from public.categories where user_id = '11111111-1111-1111-1111-111111111111'
     union all select 'transactions' from public.transactions where user_id = '11111111-1111-1111-1111-111111111111'
     union all select 'budgets' from public.budgets where user_id = '11111111-1111-1111-1111-111111111111'
     union all select 'recurring_rules' from public.recurring_rules where user_id = '11111111-1111-1111-1111-111111111111'
     union all select 'ious' from public.ious where user_id = '11111111-1111-1111-1111-111111111111'
     union all select 'iou_repayments' from public.iou_repayments where user_id = '11111111-1111-1111-1111-111111111111'
     union all select 'goals' from public.goals where user_id = '11111111-1111-1111-1111-111111111111' $$,
  'after: none of alice''s rows remain in any table'
);

select results_eq(
  $$ select t, count(*)::int from (
       select 'profiles' as t from public.profiles where user_id = '22222222-2222-2222-2222-222222222222'
       union all select 'ious' from public.ious where user_id = '22222222-2222-2222-2222-222222222222'
       union all select 'recurring_rules' from public.recurring_rules where user_id = '22222222-2222-2222-2222-222222222222'
     ) x group by t order by t $$,
  $$ values ('ious'::text, 1), ('profiles', 1), ('recurring_rules', 1) $$,
  'another user''s data is untouched'
);

select * from finish();
rollback;
