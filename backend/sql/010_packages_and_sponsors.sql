create table if not exists public.packages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  description text,
  price numeric not null check (price >= 0),
  items jsonb not null default '[]'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_packages_tenant on public.packages(tenant_id);
create index if not exists idx_packages_active on public.packages(active);

create table if not exists public.sponsors (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  logo_url text,
  link text,
  position text not null default 'home' check (position in ('home', 'tienda', 'checkout', 'partidos', 'sidebar')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_sponsors_tenant on public.sponsors(tenant_id);
create index if not exists idx_sponsors_active on public.sponsors(active);