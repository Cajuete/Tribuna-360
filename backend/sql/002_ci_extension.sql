
alter table public.users
  add column if not exists ci_extension text;
