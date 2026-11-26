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

create or replace function public.sell_zone_tickets(
    p_match_id uuid,
    p_zone_id uuid,
    p_buyer_id uuid,
    p_tickets jsonb
)
returns jsonb
language plpgsql
set search_path = public, pg_temp
as $$
declare
    zone_row public.zones%rowtype;
    sold_count bigint;
    requested_count integer;
    sale_limit integer;
    created_tickets jsonb;
    active_offer record;
    discount_amount numeric(12, 2) := 0;
    final_ticket_price numeric(12, 2);
begin
    if coalesce(jsonb_typeof(p_tickets), '') <> 'array' then
        raise exception using errcode = 'P0001', message = 'INVALID_TICKET_LIST';
    end if;

    requested_count := jsonb_array_length(p_tickets);
    if requested_count < 1 then
        raise exception using errcode = 'P0001', message = 'INVALID_TICKET_COUNT';
    end if;

    select *
    into zone_row
    from public.zones
    where id = p_zone_id
      and match_id = p_match_id
    for update;

    if not found then
        raise exception using errcode = 'P0001', message = 'ZONE_NOT_FOUND';
    end if;

    if not zone_row.is_enabled then
        raise exception using errcode = 'P0001', message = 'ZONE_DISABLED';
    end if;

    if zone_row.sale_mode <> 'general' then
        raise exception using errcode = 'P0001', message = 'NUMBERED_ZONE_REQUIRES_SEAT_SELECTION';
    end if;

    sale_limit := least(zone_row.capacity, coalesce(zone_row.tickets_for_sale, zone_row.capacity));

    select count(*)
    into sold_count
    from public.tickets
    where zone_id = p_zone_id
      and status is distinct from 'cancelled';

    if sold_count + requested_count > sale_limit then
        raise exception using
            errcode = 'P0001',
            message = 'INSUFFICIENT_CAPACITY',
            detail = greatest(sale_limit - sold_count, 0)::text;
    end if;

    select offer.id,
           campaign.title,
           offer.discount_type,
           offer.discount_value,
           case
               when offer.discount_type = 'percentage'
                   then round(zone_row.price * offer.discount_value / 100, 2)
               else least(offer.discount_value, zone_row.price)
           end as discount_amount
    into active_offer
    from public.campaign_ticket_offers as offer
    join public.promotion_campaigns as campaign on campaign.id = offer.campaign_id
    join public.matches as match on match.id = offer.match_id
    where offer.match_id = p_match_id
      and offer.zone_id = p_zone_id
      and campaign.tenant_id = match.tenant_id
      and campaign.is_active
      and campaign.starts_at <= now()
      and campaign.ends_at >= now()
    order by 5 desc, campaign.created_at asc
    limit 1;

    if found then
        discount_amount := least(zone_row.price, active_offer.discount_amount);
    end if;
    final_ticket_price := greatest(0, zone_row.price - discount_amount);

    with inserted as (
        insert into public.tickets (
            match_id,
            zone_id,
            buyer_id,
            qr_code,
            price,
            status,
            buyer_ci,
            buyer_name,
            payment_method,
            sold_by_cashier
        )
        select
            p_match_id,
            p_zone_id,
            p_buyer_id,
            ticket.qr_code,
            final_ticket_price,
            'valid',
            ticket.buyer_ci,
            ticket.buyer_name,
            coalesce(ticket.payment_method, 'efectivo'),
            ticket.sold_by_cashier
        from jsonb_to_recordset(p_tickets) as ticket(
            qr_code text,
            buyer_ci text,
            buyer_name text,
            payment_method text,
            sold_by_cashier uuid
        )
        returning *
    )
    select coalesce(jsonb_agg(to_jsonb(inserted)), '[]'::jsonb)
    into created_tickets
    from inserted;

    return jsonb_build_object(
        'tickets', created_tickets,
        'remaining', sale_limit - sold_count - requested_count
    );
end;
$$;

revoke all on function public.create_manual_payment(uuid, text, jsonb, jsonb, text)
    from public, anon, authenticated;
grant execute on function public.create_manual_payment(uuid, text, jsonb, jsonb, text)
    to service_role;
revoke all on function public.sell_zone_tickets(uuid, uuid, uuid, jsonb)
    from public, anon, authenticated;
grant execute on function public.sell_zone_tickets(uuid, uuid, uuid, jsonb)
    to service_role;

notify pgrst, 'reload schema';
