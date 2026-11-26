create table if not exists public.promotion_campaigns (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid not null references public.tenants(id) on delete cascade,
    title text not null check (length(btrim(title)) between 2 and 120),
    description text check (description is null or length(description) <= 500),
    banner_image_url text,
    placements text[] not null default array['home']::text[],
    starts_at timestamptz not null,
    ends_at timestamptz not null,
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    check (ends_at > starts_at),
    check (
        cardinality(placements) > 0
        and placements <@ array['home', 'club', 'store', 'matches']::text[]
    )
);

create table if not exists public.campaign_offers (
    id uuid primary key default gen_random_uuid(),
    campaign_id uuid not null references public.promotion_campaigns(id) on delete cascade,
    product_id uuid not null references public.products(id) on delete cascade,
    discount_type text not null check (discount_type in ('percentage', 'fixed')),
    discount_value numeric(12, 2) not null check (
        discount_value > 0
        and (discount_type <> 'percentage' or discount_value <= 100)
    ),
    created_at timestamptz not null default now(),
    unique (campaign_id, product_id)
);

create index if not exists idx_promotion_campaigns_active_dates
    on public.promotion_campaigns (tenant_id, is_active, starts_at, ends_at);
create index if not exists idx_campaign_offers_campaign
    on public.campaign_offers (campaign_id);
create index if not exists idx_campaign_offers_product
    on public.campaign_offers (product_id);

alter table public.promotion_campaigns enable row level security;
alter table public.campaign_offers enable row level security;

revoke all on public.promotion_campaigns, public.campaign_offers
    from public, anon, authenticated;
grant all on public.promotion_campaigns, public.campaign_offers to service_role;

create or replace function public.save_promotion_campaign(
    p_campaign_id uuid,
    p_tenant_id uuid,
    p_title text,
    p_description text,
    p_banner_image_url text,
    p_placements text[],
    p_starts_at timestamptz,
    p_ends_at timestamptz,
    p_is_active boolean,
    p_offers jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    campaign_key uuid;
    offer_item jsonb;
    offer_product_id uuid;
    product_tenant_id uuid;
    offer_type text;
    offer_value numeric(12, 2);
    offer_count integer;
begin
    if p_offers is null or jsonb_typeof(p_offers) <> 'array' then
        raise exception using errcode = 'P0001', message = 'INVALID_CAMPAIGN';
    end if;

    if p_tenant_id is null
       or length(btrim(coalesce(p_title, ''))) not between 2 and 120
       or length(coalesce(p_description, '')) > 500
       or p_starts_at is null
       or p_ends_at is null
       or p_ends_at <= p_starts_at
       or coalesce(cardinality(p_placements), 0) = 0
       or not (p_placements <@ array['home', 'club', 'store', 'matches']::text[])
       or jsonb_array_length(p_offers) not between 1 and 30 then
        raise exception using errcode = 'P0001', message = 'INVALID_CAMPAIGN';
    end if;

    if p_campaign_id is null then
        insert into public.promotion_campaigns (
            tenant_id, title, description, banner_image_url, placements,
            starts_at, ends_at, is_active
        )
        values (
            p_tenant_id, btrim(p_title), nullif(btrim(coalesce(p_description, '')), ''),
            nullif(btrim(coalesce(p_banner_image_url, '')), ''), p_placements,
            p_starts_at, p_ends_at, coalesce(p_is_active, true)
        )
        returning id into campaign_key;
    else
        update public.promotion_campaigns
        set title = btrim(p_title),
            description = nullif(btrim(coalesce(p_description, '')), ''),
            banner_image_url = nullif(btrim(coalesce(p_banner_image_url, '')), ''),
            placements = p_placements,
            starts_at = p_starts_at,
            ends_at = p_ends_at,
            is_active = coalesce(p_is_active, true),
            updated_at = now()
        where id = p_campaign_id
          and tenant_id = p_tenant_id
        returning id into campaign_key;

        if campaign_key is null then
            raise exception using errcode = 'P0001', message = 'CAMPAIGN_NOT_FOUND';
        end if;

        delete from public.campaign_offers
        where campaign_id = campaign_key;
    end if;

    for offer_item in select value from jsonb_array_elements(p_offers)
    loop
        begin
            offer_product_id := (offer_item->>'product_id')::uuid;
            offer_value := (offer_item->>'discount_value')::numeric;
        exception when others then
            raise exception using errcode = 'P0001', message = 'INVALID_CAMPAIGN_OFFER';
        end;

        offer_type := offer_item->>'discount_type';
        select tenant_id into product_tenant_id
        from public.products
        where id = offer_product_id;

        if product_tenant_id is null or product_tenant_id <> p_tenant_id
           or offer_type is null or offer_type not in ('percentage', 'fixed')
           or offer_value is null
           or offer_value <= 0
           or (offer_type = 'percentage' and offer_value > 100) then
            raise exception using errcode = 'P0001', message = 'INVALID_CAMPAIGN_OFFER';
        end if;

        insert into public.campaign_offers (
            campaign_id, product_id, discount_type, discount_value
        )
        values (
            campaign_key, offer_product_id, offer_type, offer_value
        );
    end loop;

    select count(*) into offer_count
    from public.campaign_offers
    where campaign_id = campaign_key;
    if offer_count <> jsonb_array_length(p_offers) then
        raise exception using errcode = 'P0001', message = 'INVALID_CAMPAIGN_OFFER';
    end if;

    return campaign_key;
end;
$$;

revoke all on function public.save_promotion_campaign(
    uuid, uuid, text, text, text, text[], timestamptz, timestamptz, boolean, jsonb
) from public, anon, authenticated;
grant execute on function public.save_promotion_campaign(
    uuid, uuid, text, text, text, text[], timestamptz, timestamptz, boolean, jsonb
) to service_role;

create or replace function public.apply_campaign_discounts(p_payment_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    payment_row public.payments%rowtype;
    order_item record;
    active_offer record;
    final_unit_price numeric(12, 2);
    discount_per_unit numeric(12, 2);
    total_discount numeric(12, 2) := 0;
    discount_items jsonb := '[]'::jsonb;
begin
    select * into payment_row
    from public.payments
    where id = p_payment_id
    for update;

    if not found
       or payment_row.purchase_type <> 'store'
       or coalesce(payment_row.purchase_data->>'campaign_discounts_applied', 'false') = 'true' then
        return;
    end if;

    if payment_row.status <> 'awaiting_proof' then
        update public.payments
        set purchase_data = coalesce(purchase_data, '{}'::jsonb)
            || jsonb_build_object('campaign_discounts_applied', true)
        where id = p_payment_id;
        return;
    end if;

    for order_item in
        select ord.id, ord.product_id, ord.quantity, product.name, product.price
        from public.orders as ord
        join public.products as product on product.id = ord.product_id
        where ord.payment_id = p_payment_id
        for update of ord
    loop
        select campaign.id,
               campaign.title,
               offer.discount_type,
               offer.discount_value,
               case
                   when offer.discount_type = 'percentage'
                       then round(order_item.price * offer.discount_value / 100, 2)
                   else least(offer.discount_value, order_item.price)
               end as discount_amount
        into active_offer
        from public.campaign_offers as offer
        join public.promotion_campaigns as campaign on campaign.id = offer.campaign_id
        join public.products as product on product.id = offer.product_id
        where offer.product_id = order_item.product_id
          and campaign.tenant_id = payment_row.tenant_id
          and product.tenant_id = payment_row.tenant_id
          and campaign.is_active
          and campaign.starts_at <= now()
          and campaign.ends_at >= now()
        order by 5 desc, campaign.created_at asc
        limit 1;

        if found then
            if active_offer.discount_amount > 0 then
                discount_per_unit := active_offer.discount_amount;
                final_unit_price := greatest(0, order_item.price - discount_per_unit);
                total_discount := total_discount + discount_per_unit * order_item.quantity;

                update public.orders
                set unit_price = final_unit_price,
                    total = final_unit_price * order_item.quantity
                where id = order_item.id;

                discount_items := discount_items || jsonb_build_array(jsonb_build_object(
                    'campaign_id', active_offer.id,
                    'campaign_title', active_offer.title,
                    'product_id', order_item.product_id,
                    'product_name', order_item.name,
                    'quantity', order_item.quantity,
                    'original_unit_price', order_item.price,
                    'discount_per_unit', discount_per_unit,
                    'final_unit_price', final_unit_price,
                    'discount_total', discount_per_unit * order_item.quantity
                ));
            end if;
        end if;
    end loop;

    update public.payments
    set amount = greatest(0, amount - total_discount),
        purchase_data = coalesce(purchase_data, '{}'::jsonb) || jsonb_build_object(
            'campaign_discounts_applied', true,
            'campaign_discount_total', total_discount,
            'campaign_discounts', discount_items
        )
    where id = p_payment_id;
end;
$$;

revoke all on function public.apply_campaign_discounts(uuid)
    from public, anon, authenticated;
grant execute on function public.apply_campaign_discounts(uuid) to service_role;

update public.payments
set purchase_data = coalesce(purchase_data, '{}'::jsonb)
    || jsonb_build_object('campaign_discounts_applied', true)
where purchase_type = 'store'
  and coalesce(purchase_data->>'campaign_discounts_applied', 'false') <> 'true';

create or replace function public.create_manual_payment_with_delivery(
    p_user_id uuid,
    p_purchase_type text,
    p_data jsonb,
    p_ticket_codes jsonb,
    p_idempotency_key text,
    p_delivery jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    result_value jsonb;
    payment_row public.payments%rowtype;
    origin_department text;
    destination_department text;
    delivery_fee numeric(12, 2);
    home_fee numeric(10, 2);
    point_fee numeric(10, 2);
    interdepartment_surcharge numeric(10, 2);
    delivery_value jsonb;
begin
    if p_purchase_type = 'store' then
        destination_department := p_delivery->>'department';
        if p_delivery is null
           or jsonb_typeof(p_delivery) <> 'object'
           or length(btrim(coalesce(p_delivery->>'recipient_name', ''))) not between 2 and 120
           or length(btrim(coalesce(p_delivery->>'phone', ''))) not between 6 and 30
           or (p_delivery->>'phone') !~ '^[+()0-9[:space:]-]+$'
           or coalesce(p_delivery->>'method', '') not in ('home', 'point')
           or coalesce(p_delivery->>'department', '') not in (
               'Beni', 'Chuquisaca', 'Cochabamba', 'La Paz', 'Oruro',
               'Pando', 'Potosí', 'Santa Cruz', 'Tarija'
           )
           or length(btrim(coalesce(p_delivery->>'city', ''))) not between 2 and 100
           or length(coalesce(p_delivery->>'reference', '')) > 250
           or (
               p_delivery->>'method' = 'home'
               and (
                   length(btrim(coalesce(p_delivery->>'zone', ''))) not between 2 and 100
                   or length(btrim(coalesce(p_delivery->>'street', ''))) not between 2 and 160
                   or length(coalesce(p_delivery->>'number', '')) > 30
               )
           )
           or (
               p_delivery->>'method' = 'point'
               and length(btrim(coalesce(p_delivery->>'location', ''))) not between 5 and 240
           ) then
            raise exception using errcode = 'P0001', message = 'INVALID_DELIVERY_DETAILS';
        end if;
    elsif p_delivery is not null then
        raise exception using errcode = 'P0001', message = 'INVALID_DELIVERY_DETAILS';
    end if;

    result_value := public.create_manual_payment(
        p_user_id,
        p_purchase_type,
        p_data,
        p_ticket_codes,
        p_idempotency_key
    );

    if p_purchase_type = 'store' then
        perform public.apply_campaign_discounts((result_value->>'id')::uuid);

        select * into payment_row
        from public.payments
        where id = (result_value->>'id')::uuid
          and user_id = p_user_id
          and purchase_type = 'store';

        if payment_row.purchase_data->'delivery' is null
           and payment_row.status = 'awaiting_proof' then
            select department, delivery_home_fee, delivery_point_fee, delivery_interdepartment_surcharge
            into origin_department, home_fee, point_fee, interdepartment_surcharge
            from public.tenants
            where id = payment_row.tenant_id;

            if origin_department is null or origin_department not in (
                'Beni', 'Chuquisaca', 'Cochabamba', 'La Paz', 'Oruro',
                'Pando', 'Potosí', 'Santa Cruz', 'Tarija'
            ) then
                raise exception using errcode = 'P0001', message = 'DELIVERY_DEPARTMENT_NOT_CONFIGURED';
            end if;

            delivery_fee := case p_delivery->>'method'
                when 'home' then home_fee
                else point_fee
            end;
            if destination_department <> origin_department then
                delivery_fee := delivery_fee + interdepartment_surcharge;
            end if;

            delivery_value := jsonb_build_object(
                'recipient_name', btrim(p_delivery->>'recipient_name'),
                'phone', btrim(p_delivery->>'phone'),
                'method', p_delivery->>'method',
                'city', btrim(p_delivery->>'city'),
                'department', destination_department,
                'origin_department', origin_department,
                'zone', case when p_delivery->>'method' = 'home' then btrim(p_delivery->>'zone') else '' end,
                'street', case when p_delivery->>'method' = 'home' then btrim(p_delivery->>'street') else '' end,
                'number', case when p_delivery->>'method' = 'home' then btrim(coalesce(p_delivery->>'number', '')) else '' end,
                'location', case when p_delivery->>'method' = 'point' then btrim(p_delivery->>'location') else '' end,
                'reference', btrim(coalesce(p_delivery->>'reference', '')),
                'fee', delivery_fee,
                'fee_status', 'included'
            );

            update public.payments as stored_payment
            set amount = stored_payment.amount + delivery_fee,
                purchase_data = jsonb_set(
                    jsonb_set(
                        jsonb_set(stored_payment.purchase_data, '{delivery}', delivery_value, true),
                        '{items_summary}',
                        coalesce((
                            select jsonb_agg(
                                jsonb_build_object(
                                    'name', product_row.name,
                                    'quantity', order_row.quantity,
                                    'unit_price', order_row.unit_price,
                                    'total', order_row.total
                                )
                                order by product_row.name
                            )
                            from public.orders as order_row
                            join public.products as product_row on product_row.id = order_row.product_id
                            where order_row.payment_id = stored_payment.id
                        ), '[]'::jsonb),
                        true
                    ),
                    '{delivery_fee}',
                    to_jsonb(delivery_fee),
                    true
                )
            where stored_payment.id = payment_row.id
              and stored_payment.user_id = p_user_id
              and stored_payment.purchase_type = 'store'
              and stored_payment.status = 'awaiting_proof'
              and stored_payment.purchase_data->'delivery' is null;
        end if;
    end if;

    return result_value;
end;
$$;

revoke all on function public.create_manual_payment_with_delivery(uuid, text, jsonb, jsonb, text, jsonb)
    from public, anon, authenticated;
grant execute on function public.create_manual_payment_with_delivery(uuid, text, jsonb, jsonb, text, jsonb)
    to service_role;
