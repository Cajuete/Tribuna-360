alter table public.zones
  add column if not exists is_enabled boolean not null default true;

alter table public.zones
  add column if not exists tickets_for_sale integer;

update public.zones
  set tickets_for_sale = capacity
  where tickets_for_sale is null;

create index if not exists idx_zones_match_enabled
  on public.zones (match_id, is_enabled);
