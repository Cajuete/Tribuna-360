

alter table public.tenants
  add column if not exists short_history text,
  add column if not exists trophies_count integer default 0,
  add column if not exists trophies_list text;
