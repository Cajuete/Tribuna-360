create table if not exists public.tenant_follows (
    tenant_id uuid not null references public.tenants(id) on delete cascade,
    user_id uuid not null references public.users(id) on delete cascade,
    created_at timestamptz not null default now(),
    primary key (tenant_id, user_id)
);

create index if not exists idx_tenant_follows_user_id
    on public.tenant_follows (user_id);

alter table public.tenant_follows enable row level security;
revoke all on public.tenant_follows from anon, authenticated;
grant select, insert, delete on public.tenant_follows to service_role;

alter table public.tenants
    add column if not exists follower_count bigint not null default 0
    check (follower_count >= 0);

update public.tenants as tenant
set follower_count = (
    select count(*)
    from public.tenant_follows as follow
    where follow.tenant_id = tenant.id
);

create or replace function public.update_tenant_follower_count()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
    if tg_op = 'INSERT' then
        update public.tenants
        set follower_count = follower_count + 1
        where id = new.tenant_id;
        return new;
    end if;

    update public.tenants
    set follower_count = greatest(follower_count - 1, 0)
    where id = old.tenant_id;
    return old;
end;
$$;

drop trigger if exists tenant_follows_update_count on public.tenant_follows;
create trigger tenant_follows_update_count
after insert or delete on public.tenant_follows
for each row execute function public.update_tenant_follower_count();

revoke all on function public.update_tenant_follower_count() from public, anon, authenticated;
