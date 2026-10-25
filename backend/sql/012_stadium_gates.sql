create table if not exists public.stadium_gates (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  zone_id uuid references public.zones(id) on delete cascade,
  gate_name text not null,
  sector_name text not null,
  status text not null default 'fluid' check (status in ('fluid', 'congestion', 'blocked')),
  is_paused boolean not null default false,
  updated_at timestamptz not null default now()
);

create index if not exists idx_stadium_gates_match on public.stadium_gates(match_id);
