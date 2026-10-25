
create index if not exists idx_tickets_qr_code on public.tickets(qr_code);
create index if not exists idx_tickets_status on public.tickets(status);
create index if not exists idx_tickets_match_zone on public.tickets(match_id, zone_id);
