-- Calendar daily totals and profile photos.
begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

insert into auth.users (id, instance_id, aud, role, email)
values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'alice@example.com'),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bob@example.com');

set local role authenticated;
-- Bob has spending on the same day, which must never show up in Alice's calendar.
select set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);
select public.complete_onboarding('INR', 'UTC');
select public.create_transaction('expense', (select id from public.categories where name = 'Food'), '2026-10-02', 99900, 'INR', '1', 99900, null, null);

select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);
select public.complete_onboarding('INR', 'Asia/Kolkata');
select public.create_transaction('expense', (select id from public.categories where name = 'Food'), '2026-10-02', 30000, 'INR', '1', 30000, null, null);
select public.create_transaction('expense', (select id from public.categories where name = 'Transport'), '2026-10-02', 5000, 'INR', '1', 5000, null, null);
select public.create_transaction('income', (select id from public.categories where name = 'Salary'), '2026-10-02', 900000, 'INR', '1', 900000, null, null);
select public.create_transaction('expense', (select id from public.categories where name = 'Rent'), '2026-10-31', 200000, 'INR', '1', 200000, null, null);
select public.create_transaction('expense', (select id from public.categories where name = 'Food'), '2026-11-01', 1000, 'INR', '1', 1000, null, null);
select public.create_transaction('expense', (select id from public.categories where name = 'Food'), '2026-10-09', 4000, 'INR', '1', 4000, null, 'deleted');
update public.transactions set deleted_at = now() where note = 'deleted';

-- An IOU-linked expense on Oct 2 (written the way the IOU functions do).
reset role;
select set_config('app.iou_write', 'on', true);
insert into public.ious (id, user_id, person_name, direction, original_amount_minor, original_currency,
  base_amount_minor, exchange_rate, date, transaction_id)
values ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'Sam', 'lent',
  70000, 'INR', 70000, 1, '2026-10-02', '44444444-4444-4444-4444-444444444444');
insert into public.transactions (id, user_id, type, category_id, date, original_amount_minor,
  original_currency, base_amount_minor, exchange_rate, iou_id)
values ('44444444-4444-4444-4444-444444444444', '11111111-1111-1111-1111-111111111111', 'expense',
  (select id from public.categories where user_id = '11111111-1111-1111-1111-111111111111' and system_key = 'lent'),
  '2026-10-02', 70000, 'INR', 70000, 1, '33333333-3333-3333-3333-333333333333');
select set_config('app.iou_write', '', true);
set local role authenticated;

-- ---------------------------------------------------------------------------
-- daily_totals
-- ---------------------------------------------------------------------------
select results_eq(
  $$ select day, income_minor, expense_minor, transaction_count from public.daily_totals('2026-10-15') $$,
  $$ values ('2026-10-02'::date, 900000::bigint, 35000::bigint, 3),
            ('2026-10-31'::date, 0::bigint, 200000::bigint, 1) $$,
  'per-day income and expense for the month only; deleted rows, IOU movements and other users left out'
);
select results_eq(
  $$ select expense_minor, transaction_count from public.daily_totals('2026-10-01', false) where day = '2026-10-02' $$,
  $$ values (105000::bigint, 4) $$,
  'IOU movements are included when asked'
);
select is((select count(*)::int from public.daily_totals('2026-12-01')), 0, 'a month without activity has no rows');

reset role;
select ok(not has_function_privilege('anon', 'public.daily_totals(date, boolean)', 'execute'), 'anon cannot call daily_totals');
set local role authenticated;

-- ---------------------------------------------------------------------------
-- Profile photo
-- ---------------------------------------------------------------------------
select lives_ok(
  $$ update public.profiles set avatar_data_url = 'data:image/webp;base64,UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA' $$,
  'a small WebP photo is accepted'
);
select is((select left(avatar_data_url, 15) from public.profiles), 'data:image/webp', 'and stored on the profile');
select throws_ok(
  $$ update public.profiles set avatar_data_url = 'data:image/svg+xml;base64,PHN2Zy8+' $$,
  '23514', null, 'SVG is rejected (it can carry scripts)'
);
select throws_ok(
  $$ update public.profiles set avatar_data_url = 'https://example.com/me.png' $$,
  '23514', null, 'links are rejected: only inline images'
);
select throws_ok(
  $$ update public.profiles set avatar_data_url = 'data:image/png;base64,' || repeat('A', 70000) $$,
  '23514', null, 'oversized images are rejected'
);
select lives_ok($$ update public.profiles set avatar_data_url = null $$, 'the photo can be removed');

-- Bob cannot change Alice's photo (RLS: his update matches no rows).
select set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);
update public.profiles set avatar_data_url = 'data:image/png;base64,AAAA' where user_id = '11111111-1111-1111-1111-111111111111';
reset role;
select is(
  (select avatar_data_url from public.profiles where user_id = '11111111-1111-1111-1111-111111111111'),
  null,
  'another user cannot set someone else''s photo'
);

select * from finish();
rollback;
