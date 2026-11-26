create table if not exists public.campaign_ticket_offers (
    id uuid primary key default gen_random_uuid(),
    campaign_id uuid not null references public.promotion_campaigns(id) on delete cascade,
    match_id uuid not null references public.matches(id) on delete cascade,
    zone_id uuid not null references public.zones(id) on delete cascade,
    discount_type text not null check (discount_type in ('percentage', 'fixed')),
    discount_value numeric(12, 2) not null check (
        discount_value > 0
        and (discount_type <> 'percentage' or discount_value <= 100)
    ),
    created_at timestamptz not null default now(),
    unique (campaign_id, match_id, zone_id)
);

create index if not exists idx_campaign_ticket_offers_campaign
    on public.campaign_ticket_offers (campaign_id);
create index if not exists idx_campaign_ticket_offers_match_zone
    on public.campaign_ticket_offers (match_id, zone_id);

alter table public.campaign_ticket_offers enable row level security;
revoke all on public.campaign_ticket_offers from public, anon, authenticated;
grant all on public.campaign_ticket_offers to service_role;

drop function if exists public.save_promotion_campaign(
    uuid, uuid, text, text, text, text[], timestamptz, timestamptz, boolean, jsonb
);

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
    p_offers jsonb,
    p_ticket_offers jsonb
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
    offer_match_id uuid;
    offer_zone_id uuid;
    product_tenant_id uuid;
    match_tenant_id uuid;
    zone_match_id uuid;
    zone_is_enabled boolean;
    zone_sale_mode text;
    offer_type text;
    offer_value numeric(12, 2);
    offer_count integer;
begin
    if p_offers is null or jsonb_typeof(p_offers) <> 'array'
       or p_ticket_offers is null or jsonb_typeof(p_ticket_offers) <> 'array' then
        raise exception using errcode = 'P0001', message = 'INVALID_CAMPAIGN';
    end if;

    if p_tenant_id is null
       or length(btrim(coalesce(p_title, ''))) not between 2 and 120
       or length(coalesce(p_description, '')) > 500
       or nullif(btrim(coalesce(p_banner_image_url, '')), '') is null
       or length(coalesce(p_banner_image_url, '')) > 500
       or p_starts_at is null
       or p_ends_at is null
       or p_ends_at <= p_starts_at
       or coalesce(cardinality(p_placements), 0) = 0
       or not (p_placements <@ array['home', 'club', 'store', 'matches']::text[])
       or jsonb_array_length(p_offers) > 30
       or jsonb_array_length(p_ticket_offers) > 30
       or jsonb_array_length(p_offers) + jsonb_array_length(p_ticket_offers) not between 1 and 30 then
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

        delete from public.campaign_offers where campaign_id = campaign_key;
        delete from public.campaign_ticket_offers where campaign_id = campaign_key;
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

    for offer_item in select value from jsonb_array_elements(p_ticket_offers)
    loop
        begin
            offer_match_id := (offer_item->>'match_id')::uuid;
            offer_zone_id := (offer_item->>'zone_id')::uuid;
            offer_value := (offer_item->>'discount_value')::numeric;
        exception when others then
            raise exception using errcode = 'P0001', message = 'INVALID_CAMPAIGN_TICKET_OFFER';
        end;

        offer_type := offer_item->>'discount_type';
        select match.tenant_id, zone.match_id, zone.is_enabled, zone.sale_mode
        into match_tenant_id, zone_match_id, zone_is_enabled, zone_sale_mode
        from public.matches as match
        join public.zones as zone on zone.id = offer_zone_id
        where match.id = offer_match_id;

        if match_tenant_id is null or match_tenant_id <> p_tenant_id
           or zone_match_id is distinct from offer_match_id
           or zone_is_enabled is distinct from true
           or zone_sale_mode <> 'general'
           or offer_type is null or offer_type not in ('percentage', 'fixed')
           or offer_value is null
           or offer_value <= 0
           or (offer_type = 'percentage' and offer_value > 100) then
            raise exception using errcode = 'P0001', message = 'INVALID_CAMPAIGN_TICKET_OFFER';
        end if;

        insert into public.campaign_ticket_offers (
            campaign_id, match_id, zone_id, discount_type, discount_value
        )
        values (
            campaign_key, offer_match_id, offer_zone_id, offer_type, offer_value
        );
    end loop;

    select
        (select count(*) from public.campaign_offers where campaign_id = campaign_key)
        + (select count(*) from public.campaign_ticket_offers where campaign_id = campaign_key)
    into offer_count;
    if offer_count <> jsonb_array_length(p_offers) + jsonb_array_length(p_ticket_offers) then
        raise exception using errcode = 'P0001', message = 'INVALID_CAMPAIGN';
    end if;

    return campaign_key;
end;
$$;

revoke all on function public.save_promotion_campaign(
    uuid, uuid, text, text, text, text[], timestamptz, timestamptz, boolean, jsonb, jsonb
) from public, anon, authenticated;
grant execute on function public.save_promotion_campaign(
    uuid, uuid, text, text, text, text[], timestamptz, timestamptz, boolean, jsonb, jsonb
) to service_role;

create or replace function public.apply_campaign_ticket_discounts(p_payment_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    payment_row public.payments%rowtype;
    zone_price numeric(12, 2);
    active_offer record;
    ticket_count integer;
    discount_total numeric(12, 2) := 0;
    final_ticket_price numeric(12, 2);
    offer_found boolean := false;
    ticket_discount_data jsonb;
begin
    select * into payment_row
    from public.payments
    where id = p_payment_id
    for update;

    if not found
       or payment_row.purchase_type <> 'ticket'
       or coalesce(payment_row.purchase_data->>'campaign_ticket_discount_applied', 'false') = 'true' then
        return;
    end if;

    if payment_row.status <> 'awaiting_proof' then
        update public.payments
        set purchase_data = coalesce(purchase_data, '{}'::jsonb)
            || jsonb_build_object('campaign_ticket_discount_applied', true)
        where id = p_payment_id;
        return;
    end if;

    select price into zone_price
    from public.zones
    where id = (payment_row.purchase_data->>'zone_id')::uuid
      and match_id = (payment_row.purchase_data->>'match_id')::uuid;

    if zone_price is null then
        update public.payments
        set purchase_data = coalesce(purchase_data, '{}'::jsonb)
            || jsonb_build_object('campaign_ticket_discount_applied', true)
        where id = p_payment_id;
        return;
    end if;

    select offer.id,
           campaign.title,
           offer.discount_type,
           offer.discount_value,
           case
               when offer.discount_type = 'percentage'
                   then round(zone_price * offer.discount_value / 100, 2)
               else least(offer.discount_value, zone_price)
           end as discount_amount
    into active_offer
    from public.campaign_ticket_offers as offer
    join public.promotion_campaigns as campaign on campaign.id = offer.campaign_id
    join public.matches as match on match.id = offer.match_id
    where offer.match_id = (payment_row.purchase_data->>'match_id')::uuid
      and offer.zone_id = (payment_row.purchase_data->>'zone_id')::uuid
      and campaign.tenant_id = payment_row.tenant_id
      and match.tenant_id = payment_row.tenant_id
      and campaign.is_active
      and campaign.starts_at <= now()
      and campaign.ends_at >= now()
    order by 5 desc, campaign.created_at asc
    limit 1;
    offer_found := found;

    select count(*) into ticket_count
    from public.tickets
    where payment_id = p_payment_id
      and status = 'pending_payment';

    if not found or ticket_count = 0 then
        update public.payments
        set purchase_data = coalesce(purchase_data, '{}'::jsonb)
            || jsonb_build_object('campaign_ticket_discount_applied', true)
        where id = p_payment_id;
        return;
    end if;

    if offer_found then
        discount_total := least(zone_price, active_offer.discount_amount) * ticket_count;
        final_ticket_price := greatest(0, zone_price - least(zone_price, active_offer.discount_amount));
        ticket_discount_data := jsonb_build_object(
            'campaign_id', active_offer.id,
            'campaign_title', active_offer.title,
            'original_unit_price', zone_price,
            'discount_per_ticket', least(zone_price, active_offer.discount_amount),
            'final_unit_price', final_ticket_price,
            'quantity', ticket_count
        );

        update public.tickets
        set price = final_ticket_price
        where payment_id = p_payment_id
          and status = 'pending_payment';
    end if;

    update public.payments
    set amount = greatest(0, amount - discount_total),
        purchase_data = coalesce(purchase_data, '{}'::jsonb) || jsonb_build_object(
            'campaign_ticket_discount_applied', true,
            'campaign_ticket_discount_total', discount_total,
            'campaign_ticket_discount', ticket_discount_data
        )
    where id = p_payment_id;
end;
$$;

revoke all on function public.apply_campaign_ticket_discounts(uuid)
    from public, anon, authenticated;
grant execute on function public.apply_campaign_ticket_discounts(uuid) to service_role;

update public.payments
set purchase_data = coalesce(purchase_data, '{}'::jsonb)
    || jsonb_build_object('campaign_ticket_discount_applied', true)
where purchase_type = 'ticket'
  and coalesce(purchase_data->>'campaign_ticket_discount_applied', 'false') <> 'true';

do $$
begin
    if to_regprocedure('public.create_manual_payment_with_delivery_before_ticket_campaigns(uuid,text,jsonb,jsonb,text,jsonb)') is null then
        alter function public.create_manual_payment_with_delivery(uuid, text, jsonb, jsonb, text, jsonb)
            rename to create_manual_payment_with_delivery_before_ticket_campaigns;
    end if;
end;
$$;

revoke all on function public.create_manual_payment_with_delivery_before_ticket_campaigns(
    uuid, text, jsonb, jsonb, text, jsonb
) from public, anon, authenticated, service_role;

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
begin
    result_value := public.create_manual_payment_with_delivery_before_ticket_campaigns(
        p_user_id,
        p_purchase_type,
        p_data,
        p_ticket_codes,
        p_idempotency_key,
        p_delivery
    );

    if p_purchase_type = 'ticket' then
        perform public.apply_campaign_ticket_discounts((result_value->>'id')::uuid);
    end if;

    return result_value;
end;
$$;

revoke all on function public.create_manual_payment_with_delivery(
    uuid, text, jsonb, jsonb, text, jsonb
) from public, anon, authenticated;
grant execute on function public.create_manual_payment_with_delivery(
    uuid, text, jsonb, jsonb, text, jsonb
) to service_role;

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

revoke all on function public.sell_zone_tickets(uuid, uuid, uuid, jsonb)
    from public, anon, authenticated;
grant execute on function public.sell_zone_tickets(uuid, uuid, uuid, jsonb)
    to service_role;

notify pgrst, 'reload schema';
