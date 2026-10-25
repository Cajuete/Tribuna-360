create index if not exists idx_users_email on public.users(email);
create index if not exists idx_users_ci on public.users(ci);
create index if not exists idx_tickets_status on public.tickets(status);
