-- First-run setup saves the name and optional photo in the same call.
begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

insert into auth.users (id, instance_id, aud, role, email)
values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'alice@example.com'),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bob@example.com'),
  ('33333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'cara@example.com');

set local role authenticated;

select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);
select lives_ok(
  $$ select public.complete_onboarding('INR', 'Asia/Kolkata', '  Alice  ', 'data:image/webp;base64,UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA') $$,
  'onboarding with a name and a photo'
);
select results_eq(
  $$ select display_name, left(avatar_data_url, 15), base_currency from public.profiles $$,
  $$ values ('Alice', 'data:image/webp', 'INR') $$,
  'the name (trimmed), photo and base currency are saved together'
);

select set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);
select lives_ok($$ select public.complete_onboarding('USD', 'UTC', '   ') $$, 'a blank name is allowed by the database (the setup screen requires one)');
select is((select display_name from public.profiles), null, 'and saves no name');

select set_config('request.jwt.claims', '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}', true);
select throws_ok(
  $$ select public.complete_onboarding('USD', 'UTC', 'Cara', 'data:image/svg+xml;base64,PHN2Zy8+') $$,
  '23514', null, 'an invalid photo is rejected'
);
select is((select base_currency from public.profiles), null, 'and nothing is saved (one call, all or nothing)');

select * from finish();
rollback;
