-- Phase 4: IOUs, repayments and their linked transactions.
begin;
create extension if not exists pgtap with schema extensions;
select plan(34);

delete from public.exchange_rates;
insert into public.exchange_rates (date, base, quote, rate) values
  ('2026-10-01', 'EUR', 'USD', 1.10), ('2026-10-01', 'EUR', 'INR', 99.00); -- USD -> INR = 90

insert into auth.users (id, instance_id, aud, role, email)
values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'alice@example.com'),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bob@example.com');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);
select public.complete_onboarding('USD', 'UTC');
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);
select public.complete_onboarding('INR', 'Asia/Kolkata');

create temp table ids (name text primary key, id uuid);
grant all on ids to authenticated;

-- ---------------------------------------------------------------------------
-- Lending in the base currency, partial repayment
-- ---------------------------------------------------------------------------
select lives_ok(
  $$ insert into ids select 'sam', public.create_iou('  Sam ', 'lent', 100000, 'INR', '1', 100000, '2026-10-01', '2026-12-01', 'Concert tickets') $$,
  'lend money: create an IOU'
);
select results_eq(
  $$ select person_name, original_amount_minor, repaid_minor, remaining_minor, status, repayment_count
     from public.iou_balances where id = (select id from ids where name = 'sam') $$,
  $$ values ('Sam'::text, 100000::bigint, 0::bigint, 100000::bigint, 'open'::text, 0) $$,
  'the balance view derives remaining and status'
);
select results_eq(
  $$ select t.type::text, c.system_key::text, t.payee, t.base_amount_minor
     from public.transactions t join public.categories c on c.id = t.category_id
     where t.iou_id = (select id from ids where name = 'sam') $$,
  $$ values ('expense'::text, 'lent'::text, 'Sam'::text, 100000::bigint) $$,
  'lending creates an expense in "Lent" with the person as payee'
);

select lives_ok(
  $$ insert into ids select 'sam-r1', public.create_repayment((select id from ids where name = 'sam'),
       40000, 'INR', 40000, '1', 40000, '1', '2026-10-05', 'First half-ish') $$,
  'record a partial repayment'
);
select results_eq(
  $$ select repaid_minor, remaining_minor, status from public.iou_balances where id = (select id from ids where name = 'sam') $$,
  $$ values (40000::bigint, 60000::bigint, 'open'::text) $$,
  'remaining balance goes down'
);
select results_eq(
  $$ select t.type::text, c.system_key::text, t.payee
     from public.iou_repayments r
     join public.transactions t on t.id = r.transaction_id
     join public.categories c on c.id = t.category_id
     where r.id = (select id from ids where name = 'sam-r1') $$,
  $$ values ('income'::text, 'repayment_received'::text, 'Sam'::text) $$,
  'their repayment creates income in "Repayment received"'
);

select throws_ok(
  $$ select public.create_repayment((select id from ids where name = 'sam'), 60001, 'INR', 60001, '1', 60001, '1', '2026-10-06', null) $$,
  '23514', 'repayment_exceeds_remaining',
  'a repayment cannot exceed the remaining balance'
);
select throws_ok(
  $$ select public.create_repayment((select id from ids where name = 'sam'), 1000, 'INR', 1000, '1', 999, '1', '2026-10-06', null) $$,
  '23514', 'base_amount_mismatch',
  'a repayment whose linked transaction is invalid fails...'
);
select is(
  (select count(*)::int from public.iou_repayments where iou_id = (select id from ids where name = 'sam')),
  1,
  '...and leaves no repayment behind (one function, all or nothing)'
);
select throws_ok(
  $$ select public.create_repayment((select id from ids where name = 'sam'), 1000, 'INR', 1000, '1', 1000, '1', '2026-09-30', null) $$,
  '23514', 'repayment_before_iou',
  'a repayment cannot be dated before the IOU'
);

-- ---------------------------------------------------------------------------
-- Borrowing in a foreign currency, repaid in two currencies
-- ---------------------------------------------------------------------------
select lives_ok(
  $$ insert into ids select 'kai', public.create_iou('Kai', 'borrowed', 10000, 'USD', '90', 900000, '2026-10-01', null, null) $$,
  'borrow USD 100.00'
);
select results_eq(
  $$ select t.type::text, c.system_key::text from public.transactions t join public.categories c on c.id = t.category_id
     where t.id = (select transaction_id from public.ious where id = (select id from ids where name = 'kai')) $$,
  $$ values ('income'::text, 'borrowed'::text) $$,
  'borrowing creates income in "Borrowed"'
);
select lives_ok(
  $$ select public.create_repayment((select id from ids where name = 'kai'),
       450000, 'INR', 5000, '0.011111111111', 450000, '1', '2026-10-02', null) $$,
  'repay INR 4,500.00, worth USD 50.00 at 1/90'
);
select results_eq(
  $$ select remaining_minor from public.iou_balances where id = (select id from ids where name = 'kai') $$,
  $$ values (5000::bigint) $$,
  'the remaining balance is counted in the IOU''s own currency'
);
select results_eq(
  $$ select t.type::text, c.system_key::text from public.iou_repayments r
     join public.transactions t on t.id = r.transaction_id join public.categories c on c.id = t.category_id
     where r.iou_id = (select id from ids where name = 'kai') $$,
  $$ values ('expense'::text, 'repayment_paid'::text) $$,
  'my repayment creates an expense in "Repayment paid"'
);
select throws_ok(
  $$ select public.create_repayment((select id from ids where name = 'kai'),
       450000, 'INR', 4000, '0.011111111111', 450000, '1', '2026-10-02', null) $$,
  '23514', 'repayment_amount_mismatch',
  'the converted amount must match the repayment rate'
);
select lives_ok(
  $$ select public.create_repayment((select id from ids where name = 'kai'),
       5000, 'USD', 5000, '1', 460000, '92', '2026-10-03', null) $$,
  'repay the rest in USD after the rate moved'
);
select results_eq(
  $$ select remaining_minor, status from public.iou_balances where id = (select id from ids where name = 'kai') $$,
  $$ values (0::bigint, 'settled'::text) $$,
  'settled at exactly zero: rate changes leave no leftover'
);

-- ---------------------------------------------------------------------------
-- Editing IOUs
-- ---------------------------------------------------------------------------
select throws_ok(
  $$ select public.update_iou((select id from ids where name = 'kai'), 'Kai', 'borrowed', 10000, 'EUR', '99', 990000, '2026-10-01') $$,
  'P0001', 'iou_locked_with_repayments',
  'currency is locked once there are repayments'
);
select throws_ok(
  $$ select public.update_iou((select id from ids where name = 'sam'), 'Sam', 'lent', 30000, 'INR', '1', 30000, '2026-10-01') $$,
  '23514', 'iou_amount_below_repaid',
  'the amount cannot drop below what has been repaid'
);
select lives_ok(
  $$ select public.update_iou((select id from ids where name = 'sam'), 'Samuel', 'lent', 120000, 'INR', '1', 120000, '2026-10-01', '2026-12-15', 'Concert + dinner') $$,
  'edit an IOU'
);
select is(
  (select count(*)::int from public.transactions where iou_id = (select id from ids where name = 'sam') and payee = 'Samuel'),
  2,
  'renaming the person updates the payee on every linked transaction'
);
select results_eq(
  $$ select original_amount_minor from public.transactions where id = (select transaction_id from public.ious where id = (select id from ids where name = 'sam')) $$,
  $$ values (120000::bigint) $$,
  'the linked transaction follows the new amount'
);

-- ---------------------------------------------------------------------------
-- Home totals
-- ---------------------------------------------------------------------------
select lives_ok(
  $$ insert into ids select 'lee', public.create_iou('Lee', 'borrowed', 2000, 'USD', '90', 180000, '2026-10-01', null, null) $$,
  'borrow USD 20.00'
);
select results_eq(
  $$ select owed_to_me_minor, i_owe_minor, owed_approximate, owe_approximate from public.iou_totals() $$,
  $$ values (80000::bigint, 180000::bigint, false, true) $$,
  'open balances in the base currency; only totals with converted balances are approximate'
);

-- ---------------------------------------------------------------------------
-- Only the IOU functions can write IOU rows
-- ---------------------------------------------------------------------------
select throws_ok(
  $$ insert into public.transactions (type, category_id, date, original_amount_minor, original_currency, base_amount_minor, exchange_rate, iou_id)
     select 'expense', id, '2026-10-01', 100, 'INR', 100, 1, (select id from ids where name = 'lee')
     from public.categories where system_key = 'lent' $$,
  'P0001', 'iou_managed',
  'IOU-linked transactions cannot be inserted directly'
);
select throws_ok(
  $$ update public.transactions set deleted_at = now() where iou_id = (select id from ids where name = 'lee') $$,
  'P0001', 'iou_managed',
  'IOU-linked transactions cannot be changed or deleted directly'
);
select throws_ok(
  $$ update public.ious set original_amount_minor = 1 where id = (select id from ids where name = 'lee') $$,
  'P0001', 'iou_managed',
  'IOUs cannot be changed directly'
);

-- ---------------------------------------------------------------------------
-- Deleting
-- ---------------------------------------------------------------------------
select lives_ok($$ select public.delete_repayment((select id from ids where name = 'sam-r1')) $$, 'delete a repayment');
select results_eq(
  $$ select remaining_minor, (select deleted_at is not null from public.transactions t
       where t.id = (select transaction_id from public.iou_repayments where id = (select id from ids where name = 'sam-r1')))
     from public.iou_balances where id = (select id from ids where name = 'sam') $$,
  $$ values (120000::bigint, true) $$,
  'the balance goes back up and the linked transaction is deleted too'
);
select lives_ok($$ select public.delete_iou((select id from ids where name = 'kai')) $$, 'delete an IOU');
select results_eq(
  $$ select (select count(*) from public.iou_balances where id = (select id from ids where name = 'kai'))::int,
            (select count(*) from public.transactions where iou_id = (select id from ids where name = 'kai') and deleted_at is null)::int,
            (select count(*) from public.iou_repayments where iou_id = (select id from ids where name = 'kai') and deleted_at is null)::int $$,
  $$ values (0, 0, 0) $$,
  'deleting an IOU removes its repayments and every linked transaction'
);

-- ---------------------------------------------------------------------------
-- Another user
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);
select is((select count(*)::int from public.iou_balances), 0, 'another user sees none of alice''s IOUs');
select throws_ok(
  $$ select public.create_repayment((select id from ids where name = 'lee'), 100, 'USD', 100, '1', 100, '1', '2026-10-05', null) $$,
  'P0002', 'iou_not_found',
  'another user cannot repay or change alice''s IOU'
);

select * from finish();
rollback;
