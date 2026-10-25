
create table if not exists public.promotions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  code text not null,
  description text,
  discount_type text not null default 'percentage' check (discount_type in ('percentage', 'fixed')),
  discount_value numeric not null check (discount_value >= 0),
  applies_to text not null default 'both' check (applies_to in ('tickets', 'products', 'both')),
  zone_name text,
  max_uses integer,
  used_count integer not null default 0,
  starts_at timestamptz,
  ends_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (tenant_id, code)
);

create index if not exists idx_promotions_tenant on public.promotions(tenant_id);
create index if not exists idx_promotions_active on public.promotions(is_active);
