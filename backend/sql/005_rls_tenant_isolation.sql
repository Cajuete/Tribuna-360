create or replace function public.current_user_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
    select id
    from public.users
    where auth_user_id = auth.uid()
    limit 1;
$$;

create index if not exists idx_users_tenant_id
    on public.users (tenant_id);
create index if not exists idx_users_auth_user_id
    on public.users (auth_user_id);

create index if not exists idx_tenants_association_id
    on public.tenants (association_id);

create index if not exists idx_matches_tenant_id
    on public.matches (tenant_id);
create index if not exists idx_matches_tenant_date
    on public.matches (tenant_id, match_date);

create index if not exists idx_zones_match_id
    on public.zones (match_id);

create index if not exists idx_tickets_match_id
    on public.tickets (match_id);
create index if not exists idx_tickets_zone_id
    on public.tickets (zone_id);
create index if not exists idx_tickets_buyer_id
    on public.tickets (buyer_id);

create index if not exists idx_products_tenant_id
    on public.products (tenant_id);

create index if not exists idx_orders_tenant_id
    on public.orders (tenant_id);
create index if not exists idx_orders_user_id
    on public.orders (user_id);
create index if not exists idx_orders_product_id
    on public.orders (product_id);

create index if not exists idx_membership_plans_tenant_id
    on public.membership_plans (tenant_id);

create index if not exists idx_memberships_tenant_id
    on public.memberships (tenant_id);
create index if not exists idx_memberships_user_id
    on public.memberships (user_id);
create index if not exists idx_memberships_plan_id
    on public.memberships (plan_id);

create index if not exists idx_club_requests_association_id
    on public.club_requests (association_id);
create index if not exists idx_club_requests_status
    on public.club_requests (status);


alter table public.associations      enable row level security;
alter table public.tenants           enable row level security;
alter table public.users             enable row level security;
alter table public.matches           enable row level security;
alter table public.zones             enable row level security;
alter table public.tickets           enable row level security;
alter table public.products          enable row level security;
alter table public.orders            enable row level security;
alter table public.membership_plans  enable row level security;
alter table public.memberships       enable row level security;
alter table public.club_requests     enable row level security;

drop policy if exists associations_public_read on public.associations;
create policy associations_public_read
    on public.associations for select
    to anon, authenticated
    using (true);

drop policy if exists tenants_public_read on public.tenants;
create policy tenants_public_read
    on public.tenants for select
    to anon, authenticated
    using (true);

drop policy if exists matches_public_read on public.matches;
create policy matches_public_read
    on public.matches for select
    to anon, authenticated
    using (true);

drop policy if exists zones_public_read on public.zones;
create policy zones_public_read
    on public.zones for select
    to anon, authenticated
    using (true);

drop policy if exists products_public_read on public.products;
create policy products_public_read
    on public.products for select
    to anon, authenticated
    using (true);

drop policy if exists membership_plans_public_read on public.membership_plans;
create policy membership_plans_public_read
    on public.membership_plans for select
    to anon, authenticated
    using (true);

drop policy if exists users_select_own on public.users;
create policy users_select_own
    on public.users for select
    to authenticated
    using (auth_user_id = auth.uid());

drop policy if exists orders_select_own on public.orders;
create policy orders_select_own
    on public.orders for select
    to authenticated
    using (user_id = public.current_user_id());

drop policy if exists tickets_select_own on public.tickets;
create policy tickets_select_own
    on public.tickets for select
    to authenticated
    using (buyer_id = public.current_user_id());

drop policy if exists memberships_select_own on public.memberships;
create policy memberships_select_own
    on public.memberships for select
    to authenticated
    using (user_id = public.current_user_id());
