alter table public.matches
  add column if not exists image_url text;

create index if not exists idx_matches_image_url
  on public.matches (image_url);
