do $$
declare
    placement_constraint record;
begin
    for placement_constraint in
        select conname
        from pg_constraint
        where conrelid = 'public.promotion_campaigns'::regclass
          and contype = 'c'
          and pg_get_constraintdef(oid) ilike '%placements%'
    loop
        execute format('alter table public.promotion_campaigns drop constraint %I', placement_constraint.conname);
    end loop;
end;
$$;

alter table public.promotion_campaigns
    add constraint promotion_campaigns_placements_check
    check (
        cardinality(placements) > 0
        and placements <@ array['home', 'club', 'store', 'matches', 'memberships']::text[]
    );

create table if not exists public.campaign_membership_offers (
    id uuid primary key default gen_random_uuid(),
    campaign_id uuid not null references public.promotion_campaigns(id) on delete cascade,
    plan_id uuid not null references public.membership_plans(id) on delete cascade,
    discount_type text not null check (discount_type in ('percentage', 'fixed')),
    discount_value numeric(12, 2) not null check (discount_value > 0),
    created_at timestamptz not null default now(),
    unique (campaign_id, plan_id)
);

create index if not exists idx_campaign_membership_offers_campaign
    on public.campaign_membership_offers (campaign_id);
create index if not exists idx_campaign_membership_offers_plan
    on public.campaign_membership_offers (plan_id);

alter table public.campaign_membership_offers enable row level security;
revoke all on public.campaign_membership_offers from public, anon, authenticated;
grant all on public.campaign_membership_offers to service_role;

drop function if exists public.save_promotion_campaign(
    uuid, uuid, text, text, text, text[], timestamptz, timestamptz, boolean, jsonb, jsonb
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
    p_ticket_offers jsonb,
    p_membership_offers jsonb
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
    offer_plan_id uuid;
    product_tenant_id uuid;
    match_tenant_id uuid;
    zone_match_id uuid;
    zone_is_enabled boolean;
    zone_sale_mode text;
    plan_tenant_id uuid;
    plan_price numeric(12, 2);
    offer_type text;
    offer_value numeric(12, 2);
    offer_count integer;
begin
    if p_offers is null or jsonb_typeof(p_offers) <> 'array'
       or p_ticket_offers is null or jsonb_typeof(p_ticket_offers) <> 'array'
       or p_membership_offers is null or jsonb_typeof(p_membership_offers) <> 'array' then
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
       or not (p_placements <@ array['home', 'club', 'store', 'matches', 'memberships']::text[])
       or jsonb_array_length(p_offers) > 30
       or jsonb_array_length(p_ticket_offers) > 30
       or jsonb_array_length(p_membership_offers) > 30
       or jsonb_array_length(p_offers) + jsonb_array_length(p_ticket_offers)
            + jsonb_array_length(p_membership_offers) not between 1 and 30 then
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
        delete from public.campaign_membership_offers where campaign_id = campaign_key;
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
           or offer_value is null or offer_value <= 0
           or (offer_type = 'percentage' and offer_value > 100) then
            raise exception using errcode = 'P0001', message = 'INVALID_CAMPAIGN_OFFER';
        end if;

        insert into public.campaign_offers (
            campaign_id, product_id, discount_type, discount_value
        )
        values (campaign_key, offer_product_id, offer_type, offer_value);
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
           or offer_value is null or offer_value <= 0
           or (offer_type = 'percentage' and offer_value > 100) then
            raise exception using errcode = 'P0001', message = 'INVALID_CAMPAIGN_TICKET_OFFER';
        end if;

        insert into public.campaign_ticket_offers (
            campaign_id, match_id, zone_id, discount_type, discount_value
        )
        values (campaign_key, offer_match_id, offer_zone_id, offer_type, offer_value);
    end loop;

    for offer_item in select value from jsonb_array_elements(p_membership_offers)
    loop
        begin
            offer_plan_id := (offer_item->>'plan_id')::uuid;
            offer_value := (offer_item->>'discount_value')::numeric;
        exception when others then
            raise exception using errcode = 'P0001', message = 'INVALID_CAMPAIGN_MEMBERSHIP_OFFER';
        end;

        offer_type := offer_item->>'discount_type';
        select tenant_id, price into plan_tenant_id, plan_price
        from public.membership_plans
        where id = offer_plan_id;

        if plan_tenant_id is null or plan_tenant_id <> p_tenant_id
           or offer_type is null or offer_type not in ('percentage', 'fixed')
           or offer_value is null or offer_value <= 0
           or plan_price is null or plan_price <= 0
           or (offer_type = 'percentage' and offer_value >= 100)
           or (offer_type = 'fixed' and offer_value >= plan_price) then
            raise exception using errcode = 'P0001', message = 'INVALID_CAMPAIGN_MEMBERSHIP_OFFER';
        end if;

        insert into public.campaign_membership_offers (
            campaign_id, plan_id, discount_type, discount_value
        )
        values (campaign_key, offer_plan_id, offer_type, offer_value);
    end loop;

    select
        (select count(*) from public.campaign_offers where campaign_id = campaign_key)
        + (select count(*) from public.campaign_ticket_offers where campaign_id = campaign_key)
        + (select count(*) from public.campaign_membership_offers where campaign_id = campaign_key)
    into offer_count;
    if offer_count <> jsonb_array_length(p_offers) + jsonb_array_length(p_ticket_offers)
        + jsonb_array_length(p_membership_offers) then
        raise exception using errcode = 'P0001', message = 'INVALID_CAMPAIGN';
    end if;

    return campaign_key;
end;
$$;

revoke all on function public.save_promotion_campaign(
    uuid, uuid, text, text, text, text[], timestamptz, timestamptz, boolean, jsonb, jsonb, jsonb
) from public, anon, authenticated;
grant execute on function public.save_promotion_campaign(
    uuid, uuid, text, text, text, text[], timestamptz, timestamptz, boolean, jsonb, jsonb, jsonb
) to service_role;

create or replace function public.apply_campaign_membership_discount(p_payment_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    payment_row public.payments%rowtype;
    plan_row public.membership_plans%rowtype;
    active_offer record;
    discount_amount numeric(12, 2);
    final_price numeric(12, 2);
begin
    select * into payment_row
    from public.payments
    where id = p_payment_id
    for update;

    if not found
       or payment_row.purchase_type not in ('membership', 'membership_renewal')
       or coalesce(payment_row.purchase_data->>'campaign_membership_discount_applied', 'false') = 'true' then
        return;
    end if;

    if payment_row.status <> 'awaiting_proof' then
        update public.payments
        set purchase_data = coalesce(purchase_data, '{}'::jsonb)
            || jsonb_build_object('campaign_membership_discount_applied', true)
        where id = p_payment_id;
        return;
    end if;

    select * into plan_row
    from public.membership_plans
    where id = (payment_row.purchase_data->>'plan_id')::uuid
      and tenant_id = payment_row.tenant_id;

    if not found or plan_row.price is null or plan_row.price <= 0 then
        update public.payments
        set purchase_data = coalesce(purchase_data, '{}'::jsonb)
            || jsonb_build_object('campaign_membership_discount_applied', true)
        where id = p_payment_id;
        return;
    end if;

    select campaign.id,
           campaign.title,
           offer.discount_type,
           offer.discount_value,
           case
               when offer.discount_type = 'percentage'
                   then round(plan_row.price * offer.discount_value / 100, 2)
               else least(offer.discount_value, plan_row.price - 0.01)
           end as discount_amount
    into active_offer
    from public.campaign_membership_offers as offer
    join public.promotion_campaigns as campaign on campaign.id = offer.campaign_id
    join public.membership_plans as plan on plan.id = offer.plan_id
    where offer.plan_id = plan_row.id
      and campaign.tenant_id = payment_row.tenant_id
      and plan.tenant_id = payment_row.tenant_id
      and campaign.is_active
      and campaign.starts_at <= now()
      and campaign.ends_at >= now()
    order by 5 desc, campaign.created_at asc
    limit 1;

    if not found then
        update public.payments
        set purchase_data = coalesce(purchase_data, '{}'::jsonb)
            || jsonb_build_object('campaign_membership_discount_applied', true)
        where id = p_payment_id;
        return;
    end if;

    if active_offer.discount_amount <= 0 then
        update public.payments
        set purchase_data = coalesce(purchase_data, '{}'::jsonb)
            || jsonb_build_object('campaign_membership_discount_applied', true)
        where id = p_payment_id;
        return;
    end if;

    discount_amount := least(active_offer.discount_amount, plan_row.price - 0.01);
    final_price := greatest(0.01, plan_row.price - discount_amount);

    update public.payments
    set amount = final_price,
        purchase_data = coalesce(purchase_data, '{}'::jsonb) || jsonb_build_object(
            'campaign_membership_discount_applied', true,
            'campaign_membership_discount_total', discount_amount,
            'campaign_membership_discount', jsonb_build_object(
                'campaign_id', active_offer.id,
                'campaign_title', active_offer.title,
                'plan_id', plan_row.id,
                'plan_name', plan_row.name,
                'original_price', plan_row.price,
                'discount_amount', discount_amount,
                'final_price', final_price
            )
        )
    where id = p_payment_id;
end;
$$;

revoke all on function public.apply_campaign_membership_discount(uuid)
    from public, anon, authenticated;
grant execute on function public.apply_campaign_membership_discount(uuid) to service_role;

update public.payments
set purchase_data = coalesce(purchase_data, '{}'::jsonb)
    || jsonb_build_object('campaign_membership_discount_applied', true)
where purchase_type in ('membership', 'membership_renewal')
  and coalesce(purchase_data->>'campaign_membership_discount_applied', 'false') <> 'true';

do $$
begin
    if to_regprocedure('public.create_manual_payment_with_delivery_before_membership_campaigns(uuid,text,jsonb,jsonb,text,jsonb)') is null then
        alter function public.create_manual_payment_with_delivery(uuid, text, jsonb, jsonb, text, jsonb)
            rename to create_manual_payment_with_delivery_before_membership_campaigns;
    end if;
end;
$$;

revoke all on function public.create_manual_payment_with_delivery_before_membership_campaigns(
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
    result_value := public.create_manual_payment_with_delivery_before_membership_campaigns(
        p_user_id,
        p_purchase_type,
        p_data,
        p_ticket_codes,
        p_idempotency_key,
        p_delivery
    );

    if p_purchase_type in ('membership', 'membership_renewal') then
        perform public.apply_campaign_membership_discount((result_value->>'id')::uuid);
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

notify pgrst, 'reload schema';
