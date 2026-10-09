-- Owner request, 2026-10-10: savings and investments as their own kinds of transaction (next
-- migration). New enum values can't be used in the transaction that adds them, so they get a
-- migration of their own.
alter type public.transaction_type add value if not exists 'savings';
alter type public.transaction_type add value if not exists 'investment';
