
alter table public.membership_plans
    add column if not exists duration_days integer default 30;

update public.membership_plans
set duration_days = 30
where duration_days is null or duration_days < 1;

alter table public.membership_plans
    alter column duration_days set not null;

alter table public.membership_plans
    drop constraint if exists membership_plans_duration_days_check;

alter table public.membership_plans
    add constraint membership_plans_duration_days_check
    check (duration_days between 1 and 3650);

alter table public.memberships
    add column if not exists started_at timestamptz;

update public.memberships
set started_at = created_at
where started_at is null;

alter table public.memberships
    alter column started_at set default now();

alter table public.memberships
    alter column started_at set not null;

alter table public.memberships
    add column if not exists expires_at timestamptz;

update public.memberships m
set expires_at = m.started_at + make_interval(days => coalesce(p.duration_days, 30))
from public.membership_plans p
where p.id = m.plan_id
  and m.expires_at is null;

create index if not exists idx_memberships_expires_at
    on public.memberships (expires_at);

create index if not exists idx_memberships_tenant_status
    on public.memberships (tenant_id, status);
