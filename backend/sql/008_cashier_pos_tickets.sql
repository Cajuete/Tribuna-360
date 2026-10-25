
alter table public.tickets
  add column if not exists buyer_ci text,
  add column if not exists buyer_name text,
  add column if not exists payment_method text default 'efectivo',
  add column if not exists sold_by_cashier uuid references public.users(id);

create index if not exists idx_tickets_sold_by_cashier
  on public.tickets (sold_by_cashier);
