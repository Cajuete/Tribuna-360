alter table public.tenants
  add column if not exists is_active boolean not null default true;

alter table public.tenants
  add column if not exists subscription_status text not null default 'active';

alter table public.tenants
  add column if not exists subscription_plan text not null default 'basic';

alter table public.tenants
  add column if not exists activated_at timestamptz not null default now();

alter table public.tenants
  add column if not exists commission_rate numeric(5,2);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'tenants_subscription_status_check'
  ) then
    alter table public.tenants
      add constraint tenants_subscription_status_check
      check (subscription_status in ('trial', 'active', 'suspended', 'cancelled'));
  end if;
end $$;

create table if not exists public.platform_settings (
  id uuid primary key default gen_random_uuid(),
  payment_provider text not null default 'simulado',
  payment_public_key text,
  payment_secret_key text,
  platform_commission_rate numeric(5,2) not null default 5.00,
  currency text not null default 'BOB',
  updated_at timestamptz not null default now()
);

insert into public.platform_settings (payment_provider, platform_commission_rate, currency)
select 'simulado', 5.00, 'BOB'
where not exists (select 1 from public.platform_settings);