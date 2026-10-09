-- Signup hook (profile + reserved IOU categories) and first-run onboarding.

-- Runs when Supabase Auth creates a user. Security definer because it is called from the auth
-- schema, before the user has a session; it only ever writes rows for the new user.
create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id, email, display_name)
  values (
    new.id,
    new.email,
    nullif(btrim(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', '')), '')
  );

  -- The four reserved IOU categories. The UI shows localised names by system_key; these names
  -- are only a fallback.
  insert into public.categories (user_id, name, icon, kind, is_system, system_key, sort_order)
  values
    (new.id, 'Lent', 'hand-coins', 'expense', true, 'lent', 1000),
    (new.id, 'Repayment paid', 'hand-coins', 'expense', true, 'repayment_paid', 1001),
    (new.id, 'Borrowed', 'handshake', 'income', true, 'borrowed', 1000),
    (new.id, 'Repayment received', 'handshake', 'income', true, 'repayment_received', 1001);

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- Keep profiles.email in sync when the user changes their email address.
create function private.handle_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles set email = new.email where user_id = new.id;
  return new;
end;
$$;

create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row
  when (old.email is distinct from new.email)
  execute function private.handle_user_email_change();

revoke all on function private.handle_new_user() from public, anon, authenticated;
revoke all on function private.handle_user_email_change() from public, anon, authenticated;

-- First run: choose the base currency, save the timezone and create the starter categories,
-- all in one call. Runs as the calling user, so RLS applies.
create function public.complete_onboarding(p_base_currency text, p_timezone text)
returns public.profiles
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_profile public.profiles;
begin
  update public.profiles
  set base_currency = p_base_currency,
      timezone = p_timezone
  where user_id = (select auth.uid())
    and base_currency is null
  returning * into v_profile;

  if not found then
    raise exception 'onboarding_already_completed' using errcode = 'P0001';
  end if;

  insert into public.categories (name, icon, kind, is_default, sort_order)
  values
    ('Food', 'utensils', 'expense', true, 1),
    ('Transport', 'bus', 'expense', true, 2),
    ('Rent', 'house', 'expense', true, 3),
    ('Shopping', 'shopping-bag', 'expense', true, 4),
    ('Bills', 'receipt', 'expense', true, 5),
    ('Health', 'heart-pulse', 'expense', true, 6),
    ('Entertainment', 'clapperboard', 'expense', true, 7),
    ('Salary', 'briefcase', 'income', true, 1),
    ('Other', 'sparkles', 'income', true, 2);

  return v_profile;
end;
$$;

revoke all on function public.complete_onboarding(text, text) from public, anon;
grant execute on function public.complete_onboarding(text, text) to authenticated;
