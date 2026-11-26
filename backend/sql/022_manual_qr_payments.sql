create table if not exists public.tenant_payment_settings (
    tenant_id uuid primary key references public.tenants(id) on delete cascade,
    qr_image_url text,
    account_name text,
    payment_instructions text,
    updated_at timestamptz not null default now()
);

create table if not exists public.payments (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.users(id) on delete restrict,
    tenant_id uuid not null references public.tenants(id) on delete restrict,
    purchase_type text not null check (purchase_type in ('ticket', 'store', 'membership', 'membership_renewal')),
    payment_method text not null default 'qr' check (payment_method in ('qr', 'card')),
    amount numeric(12,2) not null check (amount >= 0),
    currency text not null default 'BOB',
    status text not null default 'awaiting_proof'
        check (status in ('awaiting_proof', 'pending_review', 'approved', 'rejected', 'cancelled')),
    idempotency_key text not null,
    purchase_data jsonb not null default '{}'::jsonb,
    proof_path text,
    buyer_note text,
    review_note text,
    reviewed_by uuid references public.users(id) on delete set null,
    reviewed_at timestamptz,
    expires_at timestamptz not null default (now() + interval '30 minutes'),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (user_id, idempotency_key)
);

create index if not exists idx_payments_tenant_status_created
    on public.payments (tenant_id, status, created_at desc);
create index if not exists idx_payments_user_created
    on public.payments (user_id, created_at desc);

alter table public.orders
    add column if not exists payment_id uuid references public.payments(id) on delete set null;

alter table public.tickets
    add column if not exists payment_id uuid references public.payments(id) on delete set null;

alter table public.tickets
    drop constraint if exists tickets_status_check;

alter table public.tickets
    add constraint tickets_status_check
    check (status in ('valid', 'used', 'cancelled', 'pending_payment'));

create index if not exists idx_orders_payment_id on public.orders (payment_id);
create index if not exists idx_tickets_payment_id on public.tickets (payment_id);

alter table public.tenant_payment_settings enable row level security;
alter table public.payments enable row level security;

drop policy if exists tenant_payment_settings_public_read on public.tenant_payment_settings;
create policy tenant_payment_settings_public_read
    on public.tenant_payment_settings for select
    to anon, authenticated
    using (true);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
    ('payment-proofs', 'payment-proofs', false, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']),
    ('tenant-payment-qr', 'tenant-payment-qr', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.expire_manual_payments()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    payment_row public.payments%rowtype;
    order_row public.orders%rowtype;
    expired_count integer := 0;
begin
    for payment_row in
        select * from public.payments
        where status in ('awaiting_proof', 'pending_review')
          and expires_at <= now()
        for update skip locked
    loop
        update public.tickets set status = 'cancelled'
        where payment_id = payment_row.id and status = 'pending_payment';
        for order_row in
            select * from public.orders where payment_id = payment_row.id and status = 'pending' for update
        loop
            update public.products set stock = stock + order_row.quantity where id = order_row.product_id;
            update public.orders set status = 'cancelled' where id = order_row.id;
        end loop;
        update public.payments
        set status = 'cancelled', updated_at = now(),
            review_note = 'Pago vencido; se liberó la reserva.'
        where id = payment_row.id;
        expired_count := expired_count + 1;
    end loop;
    return expired_count;
end;
$$;

create or replace function public.create_manual_payment(
    p_user_id uuid,
    p_purchase_type text,
    p_data jsonb,
    p_ticket_codes jsonb,
    p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    payment_row public.payments%rowtype;
    tenant_key uuid;
    amount_value numeric(12,2);
    quantity_value integer;
    product_row public.products%rowtype;
    zone_row public.zones%rowtype;
    match_row public.matches%rowtype;
    plan_row public.membership_plans%rowtype;
    membership_row public.memberships%rowtype;
    item jsonb;
    items_value jsonb;
    order_id_value uuid;
    total_value numeric(12,2) := 0;
begin
    perform public.expire_manual_payments();

    if p_user_id is null or nullif(btrim(p_idempotency_key), '') is null
       or length(p_idempotency_key) > 100 then
        raise exception using errcode = 'P0001', message = 'INVALID_PAYMENT_REQUEST';
    end if;

    perform pg_advisory_xact_lock(hashtextextended(p_user_id::text || ':' || p_idempotency_key, 0));
    select * into payment_row
    from public.payments
    where user_id = p_user_id and idempotency_key = p_idempotency_key;
    if found then
        return jsonb_build_object('id', payment_row.id, 'status', payment_row.status);
    end if;

    if p_purchase_type = 'ticket' then
        quantity_value := (p_data->>'quantity')::integer;
        if quantity_value < 1
           or coalesce(jsonb_array_length(p_ticket_codes), 0) <> quantity_value then
            raise exception using errcode = 'P0001', message = 'INVALID_TICKET_COUNT';
        end if;

        select * into match_row
        from public.matches
        where id = (p_data->>'match_id')::uuid;
        if not found then
            raise exception using errcode = 'P0001', message = 'MATCH_NOT_FOUND';
        end if;

        select * into zone_row
        from public.zones
        where id = (p_data->>'zone_id')::uuid
          and match_id = match_row.id
        for update;
        if not found then
            raise exception using errcode = 'P0001', message = 'ZONE_NOT_FOUND';
        end if;
        if not zone_row.is_enabled then
            raise exception using errcode = 'P0001', message = 'ZONE_DISABLED';
        end if;
        if coalesce(zone_row.sale_mode, 'general') = 'numbered' then
            raise exception using errcode = 'P0001', message = 'NUMBERED_ZONE_REQUIRES_SEAT_SELECTION';
        end if;

        if (
            select count(*) from public.tickets
            where zone_id = zone_row.id and status is distinct from 'cancelled'
        ) + quantity_value > least(zone_row.capacity, coalesce(zone_row.tickets_for_sale, zone_row.capacity)) then
            raise exception using errcode = 'P0001', message = 'INSUFFICIENT_CAPACITY';
        end if;

        tenant_key := match_row.tenant_id;
        amount_value := zone_row.price * quantity_value;
        insert into public.payments (user_id, tenant_id, purchase_type, amount, idempotency_key, purchase_data)
        values (p_user_id, tenant_key, p_purchase_type, amount_value, p_idempotency_key,
            jsonb_build_object('match_id', match_row.id, 'zone_id', zone_row.id, 'quantity', quantity_value,
                'buyer_name', nullif(btrim(p_data->>'buyer_name'), ''),
                'buyer_ci', nullif(btrim(p_data->>'buyer_ci'), ''),
                'description', quantity_value || ' entrada(s) · ' || zone_row.name || ' · ' || match_row.opponent))
        returning * into payment_row;

        insert into public.tickets (
            match_id, zone_id, buyer_id, qr_code, price, status,
            buyer_ci, buyer_name, payment_method, payment_id
        )
        select match_row.id, zone_row.id, p_user_id, ticket.qr_code, zone_row.price, 'pending_payment',
            nullif(btrim(p_data->>'buyer_ci'), ''), nullif(btrim(p_data->>'buyer_name'), ''), 'qr', payment_row.id
        from jsonb_to_recordset(p_ticket_codes) as ticket(qr_code text);
    elsif p_purchase_type = 'store' then
        items_value := p_data->'items';
        if jsonb_typeof(items_value) <> 'array' or jsonb_array_length(items_value) < 1
           or jsonb_array_length(items_value) > 10 then
            raise exception using errcode = 'P0001', message = 'INVALID_ORDER_ITEMS';
        end if;

        for item in select value from jsonb_array_elements(items_value)
        loop
            quantity_value := (item->>'quantity')::integer;
            if quantity_value < 1 or quantity_value > 10 then
                raise exception using errcode = 'P0001', message = 'INVALID_ORDER_QUANTITY';
            end if;
            select * into product_row
            from public.products
            where id = (item->>'product_id')::uuid
            for update;
            if not found then
                raise exception using errcode = 'P0001', message = 'PRODUCT_NOT_FOUND';
            end if;
            if tenant_key is not null and tenant_key <> product_row.tenant_id then
                raise exception using errcode = 'P0001', message = 'CROSS_TENANT_CART_NOT_ALLOWED';
            end if;
            tenant_key := product_row.tenant_id;
            if product_row.stock < quantity_value then
                raise exception using errcode = 'P0001', message = 'INSUFFICIENT_STOCK';
            end if;
            update public.products set stock = stock - quantity_value where id = product_row.id;
            total_value := total_value + product_row.price * quantity_value;
        end loop;

        amount_value := total_value;
        insert into public.payments (user_id, tenant_id, purchase_type, amount, idempotency_key, purchase_data)
        values (p_user_id, tenant_key, p_purchase_type, amount_value, p_idempotency_key,
            jsonb_build_object('items', items_value, 'description', 'Compra en tienda'))
        returning * into payment_row;

        for item in select value from jsonb_array_elements(items_value)
        loop
            select * into product_row
            from public.products
            where id = (item->>'product_id')::uuid;
            quantity_value := (item->>'quantity')::integer;
            insert into public.orders (tenant_id, user_id, product_id, quantity, unit_price, total, status, payment_id)
            values (tenant_key, p_user_id, product_row.id, quantity_value, product_row.price,
                product_row.price * quantity_value, 'pending', payment_row.id);
        end loop;
    elsif p_purchase_type = 'membership' then
        select * into plan_row
        from public.membership_plans
        where id = (p_data->>'plan_id')::uuid;
        if not found then
            raise exception using errcode = 'P0001', message = 'PLAN_NOT_FOUND';
        end if;
        tenant_key := plan_row.tenant_id;
        perform pg_advisory_xact_lock(hashtextextended(p_user_id::text || ':' || tenant_key::text, 0));
        select * into plan_row
        from public.membership_plans
        where id = (p_data->>'plan_id')::uuid
        for update;
        if not found then
            raise exception using errcode = 'P0001', message = 'PLAN_NOT_FOUND';
        end if;
        if exists (
            select 1 from public.memberships
            where user_id = p_user_id and tenant_id = plan_row.tenant_id and status = 'active'
        ) then
            raise exception using errcode = 'P0001', message = 'ACTIVE_MEMBERSHIP_EXISTS';
        end if;
        if exists (
            select 1 from public.payments
            where user_id = p_user_id and tenant_id = tenant_key
              and purchase_type in ('membership', 'membership_renewal')
              and status in ('awaiting_proof', 'pending_review')
        ) then
            raise exception using errcode = 'P0001', message = 'MEMBERSHIP_PAYMENT_PENDING';
        end if;
        amount_value := plan_row.price;
        insert into public.payments (user_id, tenant_id, purchase_type, amount, idempotency_key, purchase_data)
        values (p_user_id, tenant_key, p_purchase_type, amount_value, p_idempotency_key,
            jsonb_build_object('plan_id', plan_row.id, 'description', 'Membresía · ' || plan_row.name))
        returning * into payment_row;
    elsif p_purchase_type = 'membership_renewal' then
        select * into membership_row
        from public.memberships
        where id = (p_data->>'membership_id')::uuid
          and user_id = p_user_id
          and status = 'active';
        if not found then
            raise exception using errcode = 'P0001', message = 'MEMBERSHIP_NOT_FOUND';
        end if;
        tenant_key := membership_row.tenant_id;
        perform pg_advisory_xact_lock(hashtextextended(p_user_id::text || ':' || tenant_key::text, 0));
        select * into membership_row
        from public.memberships
        where id = (p_data->>'membership_id')::uuid
          and user_id = p_user_id
          and status = 'active'
        for update;
        if not found then
            raise exception using errcode = 'P0001', message = 'MEMBERSHIP_NOT_FOUND';
        end if;
        if exists (
            select 1 from public.membership_cancellation_requests
            where membership_id = membership_row.id and status = 'pending'
        ) then
            raise exception using errcode = 'P0001', message = 'CANCELLATION_PENDING';
        end if;
        if exists (
            select 1 from public.payments
            where user_id = p_user_id and tenant_id = tenant_key
              and purchase_type in ('membership', 'membership_renewal')
              and status in ('awaiting_proof', 'pending_review')
        ) then
            raise exception using errcode = 'P0001', message = 'MEMBERSHIP_PAYMENT_PENDING';
        end if;
        select * into plan_row from public.membership_plans where id = membership_row.plan_id;
        if not found then
            raise exception using errcode = 'P0001', message = 'PLAN_NOT_FOUND';
        end if;
        amount_value := plan_row.price;
        insert into public.payments (user_id, tenant_id, purchase_type, amount, idempotency_key, purchase_data)
        values (p_user_id, tenant_key, p_purchase_type, amount_value, p_idempotency_key,
            jsonb_build_object('membership_id', membership_row.id, 'plan_id', plan_row.id,
                'description', 'Renovación de membresía · ' || plan_row.name))
        returning * into payment_row;
    else
        raise exception using errcode = 'P0001', message = 'INVALID_PURCHASE_TYPE';
    end if;

    if amount_value is null or amount_value <= 0 then
        raise exception using errcode = 'P0001', message = 'INVALID_PAYMENT_AMOUNT';
    end if;
    if not exists (
        select 1 from public.tenant_payment_settings
        where tenant_id = tenant_key and qr_image_url is not null
    ) then
        raise exception using errcode = 'P0001', message = 'QR_NOT_CONFIGURED';
    end if;

    return jsonb_build_object('id', payment_row.id, 'status', payment_row.status);
end;
$$;

create or replace function public.submit_payment_proof(
    p_payment_id uuid,
    p_user_id uuid,
    p_proof_path text,
    p_buyer_note text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    payment_row public.payments%rowtype;
begin
    select * into payment_row
    from public.payments
    where id = p_payment_id and user_id = p_user_id
    for update;
    if not found then
        raise exception using errcode = 'P0001', message = 'PAYMENT_NOT_FOUND';
    end if;
    if payment_row.status <> 'awaiting_proof' then
        raise exception using errcode = 'P0001', message = 'PAYMENT_NOT_AWAITING_PROOF';
    end if;
    if payment_row.expires_at <= now() then
        raise exception using errcode = 'P0001', message = 'PAYMENT_EXPIRED';
    end if;
    if nullif(btrim(p_proof_path), '') is null or length(coalesce(p_buyer_note, '')) > 500 then
        raise exception using errcode = 'P0001', message = 'INVALID_PAYMENT_PROOF';
    end if;

    update public.payments
    set proof_path = p_proof_path,
        buyer_note = nullif(btrim(p_buyer_note), ''),
        status = 'pending_review',
        expires_at = now() + interval '7 days',
        updated_at = now()
    where id = p_payment_id;

    return jsonb_build_object('id', p_payment_id, 'status', 'pending_review');
end;
$$;

create or replace function public.resolve_manual_payment(
    p_payment_id uuid,
    p_decision text,
    p_review_note text,
    p_reviewer_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    payment_row public.payments%rowtype;
    reviewer_role text;
    reviewer_tenant uuid;
    membership_row public.memberships%rowtype;
    plan_row public.membership_plans%rowtype;
    duration_value integer;
    expires_value timestamptz;
    order_row public.orders%rowtype;
begin
    if p_decision not in ('approved', 'rejected') then
        raise exception using errcode = 'P0001', message = 'INVALID_DECISION';
    end if;
    if length(coalesce(p_review_note, '')) > 2000 then
        raise exception using errcode = 'P0001', message = 'REVIEW_NOTE_TOO_LONG';
    end if;

    select role, tenant_id into reviewer_role, reviewer_tenant
    from public.users where id = p_reviewer_id;
    if reviewer_role is null or reviewer_role not in ('superadmin', 'club_admin', 'payment_manager') then
        raise exception using errcode = '42501', message = 'PAYMENT_REVIEWER_REQUIRED';
    end if;

    select * into payment_row from public.payments where id = p_payment_id for update;
    if not found then
        raise exception using errcode = 'P0001', message = 'PAYMENT_NOT_FOUND';
    end if;
    if reviewer_role <> 'superadmin' and reviewer_tenant is distinct from payment_row.tenant_id then
        raise exception using errcode = '42501', message = 'PAYMENT_OTHER_TENANT';
    end if;
    if payment_row.status <> 'pending_review' then
        raise exception using errcode = 'P0001', message = 'PAYMENT_ALREADY_RESOLVED';
    end if;
    if payment_row.expires_at <= now() then
        raise exception using errcode = 'P0001', message = 'PAYMENT_EXPIRED';
    end if;
    if p_decision = 'rejected' and nullif(btrim(p_review_note), '') is null then
        raise exception using errcode = 'P0001', message = 'REJECTION_NOTE_REQUIRED';
    end if;

    if p_decision = 'approved' then
        if payment_row.purchase_type in ('membership', 'membership_renewal') then
            perform pg_advisory_xact_lock(hashtextextended(payment_row.user_id::text || ':' || payment_row.tenant_id::text, 0));
        end if;
        if payment_row.purchase_type = 'ticket' then
            update public.tickets set status = 'valid'
            where payment_id = payment_row.id and status = 'pending_payment';
            if not found then
                raise exception using errcode = 'P0001', message = 'PAYMENT_TICKETS_NOT_FOUND';
            end if;
        elsif payment_row.purchase_type = 'store' then
            update public.orders set status = 'paid'
            where payment_id = payment_row.id and status = 'pending';
            if not found then
                raise exception using errcode = 'P0001', message = 'PAYMENT_ORDERS_NOT_FOUND';
            end if;
        elsif payment_row.purchase_type = 'membership' then
            select * into plan_row
            from public.membership_plans
            where id = (payment_row.purchase_data->>'plan_id')::uuid
            for update;
            if not found then
                raise exception using errcode = 'P0001', message = 'PLAN_NOT_FOUND';
            end if;
            if exists (
                select 1 from public.memberships
                where user_id = payment_row.user_id and tenant_id = payment_row.tenant_id and status = 'active'
            ) then
                raise exception using errcode = 'P0001', message = 'ACTIVE_MEMBERSHIP_EXISTS';
            end if;
            duration_value := greatest(coalesce(plan_row.duration_days, 30), 1);
            insert into public.memberships (plan_id, tenant_id, user_id, status, started_at, expires_at)
            values (plan_row.id, payment_row.tenant_id, payment_row.user_id, 'active', now(),
                now() + make_interval(days => duration_value));
        else
            select * into membership_row
            from public.memberships
            where id = (payment_row.purchase_data->>'membership_id')::uuid
              and user_id = payment_row.user_id
              and tenant_id = payment_row.tenant_id
              and status = 'active'
            for update;
            if not found then
                raise exception using errcode = 'P0001', message = 'MEMBERSHIP_NOT_FOUND';
            end if;
            if exists (
                select 1 from public.membership_cancellation_requests
                where membership_id = membership_row.id and status = 'pending'
            ) then
                raise exception using errcode = 'P0001', message = 'CANCELLATION_PENDING';
            end if;
            select * into plan_row from public.membership_plans where id = membership_row.plan_id;
            duration_value := greatest(coalesce(plan_row.duration_days, 30), 1);
            expires_value := greatest(coalesce(membership_row.expires_at, now()), now())
                + make_interval(days => duration_value);
            update public.memberships
            set expires_at = expires_value,
                started_at = case when membership_row.expires_at is null or membership_row.expires_at <= now()
                    then now() else membership_row.started_at end
            where id = membership_row.id;
        end if;
    else
        update public.tickets set status = 'cancelled'
        where payment_id = payment_row.id and status = 'pending_payment';
        for order_row in
            select * from public.orders where payment_id = payment_row.id and status = 'pending' for update
        loop
            update public.products set stock = stock + order_row.quantity where id = order_row.product_id;
            update public.orders set status = 'cancelled' where id = order_row.id;
        end loop;
    end if;

    update public.payments
    set status = p_decision,
        review_note = nullif(btrim(p_review_note), ''),
        reviewed_by = p_reviewer_id,
        reviewed_at = now(),
        updated_at = now()
    where id = payment_row.id;

    return jsonb_build_object('id', payment_row.id, 'status', p_decision, 'reviewed_at', now());
end;
$$;

revoke all on function public.create_manual_payment(uuid, text, jsonb, jsonb, text) from public, anon, authenticated;
grant execute on function public.create_manual_payment(uuid, text, jsonb, jsonb, text) to service_role;
revoke all on function public.expire_manual_payments() from public, anon, authenticated;
grant execute on function public.expire_manual_payments() to service_role;
revoke all on function public.submit_payment_proof(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.submit_payment_proof(uuid, uuid, text, text) to service_role;
revoke all on function public.resolve_manual_payment(uuid, text, text, uuid) from public, anon, authenticated;
grant execute on function public.resolve_manual_payment(uuid, text, text, uuid) to service_role;
