-- Add this once in Supabase SQL Editor before deploying the opening balance UI.
alter table public.suppliers
add column if not exists opening_balance numeric(15, 2) not null default 0;
