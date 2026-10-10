-- Owner request, 2026-10-10: savings goals (next migration). Money taken back out of a goal is a
-- transaction of its own kind, 'withdrawal', in a reserved category. New enum values can't be used
-- in the transaction that adds them, so they get a migration of their own.
alter type public.transaction_type add value if not exists 'withdrawal';
alter type public.system_category_key add value if not exists 'goal_withdrawal';
