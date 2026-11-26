alter table public.promotions
    add column if not exists audience text not null default 'all';

do $$
begin
    if not exists (
        select 1
        from pg_constraint
        where conname = 'promotions_audience_check'
          and conrelid = 'public.promotions'::regclass
    ) then
        alter table public.promotions
            add constraint promotions_audience_check
            check (audience in ('all', 'members'));
    end if;
end;
$$;

create or replace function public.apply_promotion_code(p_payment_id uuid, p_code text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    payment_row public.payments%rowtype;
    promotion_row public.promotions%rowtype;
    ticket_row record;
    order_row record;
    normalized_code text;
    required_target text;
    zone_name_value text;
    subtotal_value numeric(12, 2) := 0;
    remaining_discount numeric(12, 2) := 0;
    line_discount numeric(12, 2) := 0;
    line_total numeric(12, 2) := 0;
    discount_total numeric(12, 2) := 0;
begin
    normalized_code := upper(btrim(coalesce(p_code, '')));
    if normalized_code = '' or length(normalized_code) > 50 then
        raise exception using errcode = 'P0001', message = 'PROMOTION_CODE_INVALID';
    end if;

    select * into payment_row
    from public.payments
    where id = p_payment_id
    for update;
    if not found then
        raise exception using errcode = 'P0001', message = 'PAYMENT_NOT_FOUND';
    end if;

    if coalesce(payment_row.purchase_data->>'promo_code_applied', 'false') = 'true' then
        if payment_row.purchase_data->>'promo_code' = normalized_code then
            return;
        end if;
        raise exception using errcode = 'P0001', message = 'PROMOTION_ALREADY_APPLIED';
    end if;
    if payment_row.status <> 'awaiting_proof' then
        raise exception using errcode = 'P0001', message = 'PROMOTION_PAYMENT_NOT_ACTIVE';
    end if;

    select * into promotion_row
    from public.promotions
    where tenant_id = payment_row.tenant_id
      and code = normalized_code
    for update;
    if not found or not promotion_row.is_active
       or (promotion_row.starts_at is not null and promotion_row.starts_at > now())
       or (promotion_row.ends_at is not null and promotion_row.ends_at <= now()) then
        raise exception using errcode = 'P0001', message = 'PROMOTION_CODE_INVALID';
    end if;
    if promotion_row.max_uses is not null and promotion_row.used_count >= promotion_row.max_uses then
        raise exception using errcode = 'P0001', message = 'PROMOTION_CODE_LIMIT_REACHED';
    end if;
    if payment_row.purchase_type = 'ticket' then
        required_target := 'tickets';
    elsif payment_row.purchase_type = 'store' then
        required_target := 'products';
    else
        raise exception using errcode = 'P0001', message = 'PROMOTION_CODE_NOT_APPLICABLE';
    end if;
    if promotion_row.applies_to not in ('both', required_target) then
        raise exception using errcode = 'P0001', message = 'PROMOTION_CODE_NOT_APPLICABLE';
    end if;
    if payment_row.purchase_type = 'store' and promotion_row.zone_name is not null then
        raise exception using errcode = 'P0001', message = 'PROMOTION_CODE_NOT_APPLICABLE';
    end if;

    if promotion_row.audience = 'members'
       and not exists (
           select 1
           from public.memberships
           where user_id = payment_row.user_id
             and tenant_id = payment_row.tenant_id
             and status = 'active'
             and (expires_at is null or expires_at > now())
       ) then
        raise exception using errcode = 'P0001', message = 'PROMOTION_MEMBERS_ONLY';
    end if;

    if payment_row.purchase_type = 'ticket' then
        select name into zone_name_value
        from public.zones
        where id = (payment_row.purchase_data->>'zone_id')::uuid
          and match_id = (payment_row.purchase_data->>'match_id')::uuid;
        if promotion_row.zone_name is not null
           and lower(btrim(promotion_row.zone_name)) <> lower(btrim(coalesce(zone_name_value, ''))) then
            raise exception using errcode = 'P0001', message = 'PROMOTION_ZONE_RESTRICTED';
        end if;
        select coalesce(sum(price), 0) into subtotal_value
        from public.tickets
        where payment_id = p_payment_id and status = 'pending_payment';
    else
        select coalesce(sum(total), 0) into subtotal_value
        from public.orders
        where payment_id = p_payment_id and status = 'pending';
    end if;
    if subtotal_value <= 0 then
        raise exception using errcode = 'P0001', message = 'PROMOTION_CODE_NO_DISCOUNT';
    end if;

    if promotion_row.discount_type = 'percentage' then
        remaining_discount := round(subtotal_value * promotion_row.discount_value / 100, 2);
    else
        remaining_discount := least(subtotal_value, promotion_row.discount_value);
    end if;
    remaining_discount := least(subtotal_value, remaining_discount);
    if remaining_discount >= subtotal_value then
        raise exception using errcode = 'P0001', message = 'PROMOTION_CODE_ZERO_TOTAL';
    end if;
    if remaining_discount <= 0 then
        raise exception using errcode = 'P0001', message = 'PROMOTION_CODE_NO_DISCOUNT';
    end if;

    if payment_row.purchase_type = 'ticket' then
        for ticket_row in
            select id, price
            from public.tickets
            where payment_id = p_payment_id and status = 'pending_payment'
            order by id
            for update
        loop
            if promotion_row.discount_type = 'percentage' then
                line_discount := least(
                    ticket_row.price,
                    remaining_discount,
                    round(ticket_row.price * promotion_row.discount_value / 100, 2)
                );
            else
                line_discount := least(ticket_row.price, remaining_discount);
            end if;
            update public.tickets
            set price = greatest(0, ticket_row.price - line_discount)
            where id = ticket_row.id;
            discount_total := discount_total + line_discount;
            remaining_discount := greatest(0, remaining_discount - line_discount);
        end loop;
        if remaining_discount > 0 then
            for ticket_row in
                select id, price
                from public.tickets
                where payment_id = p_payment_id
                  and status = 'pending_payment'
                  and price > 0
                order by id
                for update
            loop
                line_discount := least(ticket_row.price, remaining_discount);
                update public.tickets
                set price = greatest(0, ticket_row.price - line_discount)
                where id = ticket_row.id;
                discount_total := discount_total + line_discount;
                remaining_discount := greatest(0, remaining_discount - line_discount);
                exit when remaining_discount = 0;
            end loop;
        end if;
    else
        for order_row in
            select id, quantity, unit_price, total
            from public.orders
            where payment_id = p_payment_id and status = 'pending'
            order by id
            for update
        loop
            if promotion_row.discount_type = 'percentage' then
                line_discount := least(
                    order_row.total,
                    remaining_discount,
                    round(order_row.total * promotion_row.discount_value / 100, 2)
                );
            else
                line_discount := least(order_row.total, remaining_discount);
            end if;
            line_total := greatest(0, order_row.total - line_discount);
            update public.orders
            set total = line_total,
                unit_price = case
                    when order_row.quantity > 0 then round(line_total / order_row.quantity, 2)
                    else order_row.unit_price
                end
            where id = order_row.id;
            discount_total := discount_total + line_discount;
            remaining_discount := greatest(0, remaining_discount - line_discount);
        end loop;
        if remaining_discount > 0 then
            for order_row in
                select id, quantity, unit_price, total
                from public.orders
                where payment_id = p_payment_id and status = 'pending' and total > 0
                order by id
                for update
            loop
                line_discount := least(order_row.total, remaining_discount);
                line_total := greatest(0, order_row.total - line_discount);
                update public.orders
                set total = line_total,
                    unit_price = case
                        when order_row.quantity > 0 then round(line_total / order_row.quantity, 2)
                        else order_row.unit_price
                    end
                where id = order_row.id;
                discount_total := discount_total + line_discount;
                remaining_discount := greatest(0, remaining_discount - line_discount);
                exit when remaining_discount = 0;
            end loop;
        end if;
    end if;

    if discount_total <= 0 then
        raise exception using errcode = 'P0001', message = 'PROMOTION_CODE_NO_DISCOUNT';
    end if;

    update public.promotions
    set used_count = used_count + 1
    where id = promotion_row.id;

    update public.payments
    set amount = greatest(0, amount - discount_total),
        purchase_data = coalesce(purchase_data, '{}'::jsonb) || jsonb_build_object(
            'promo_id', promotion_row.id,
            'promo_code', normalized_code,
            'promo_code_applied', true,
            'promo_description', promotion_row.description,
            'promo_discount_type', promotion_row.discount_type,
            'promo_discount_value', promotion_row.discount_value,
            'promo_discount_total', discount_total
        )
    where id = p_payment_id;

    if payment_row.purchase_type = 'store' then
        update public.payments as stored_payment
        set purchase_data = jsonb_set(
            stored_payment.purchase_data,
            '{items_summary}',
            coalesce((
                select jsonb_agg(
                    jsonb_build_object(
                        'name', product.name,
                        'quantity', order_item.quantity,
                        'unit_price', order_item.unit_price,
                        'total', order_item.total
                    )
                    order by product.name
                )
                from public.orders as order_item
                join public.products as product on product.id = order_item.product_id
                where order_item.payment_id = p_payment_id
            ), '[]'::jsonb),
            true
        )
        where stored_payment.id = p_payment_id;
    end if;
end;
$$;

revoke all on function public.apply_promotion_code(uuid, text)
    from public, anon, authenticated;
grant execute on function public.apply_promotion_code(uuid, text) to service_role;

create or replace function public.release_promotion_code_use()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
    if old.status in ('awaiting_proof', 'pending_review')
       and new.status in ('rejected', 'cancelled')
       and coalesce(old.purchase_data->>'promo_code_applied', 'false') = 'true'
       and coalesce(old.purchase_data->>'promo_code_use_released', 'false') <> 'true' then
        if nullif(old.purchase_data->>'promo_id', '') is not null then
            update public.promotions
            set used_count = greatest(0, used_count - 1)
            where id = (old.purchase_data->>'promo_id')::uuid;
        else
            update public.promotions
            set used_count = greatest(0, used_count - 1)
            where tenant_id = old.tenant_id
              and code = old.purchase_data->>'promo_code';
        end if;
        new.purchase_data := coalesce(new.purchase_data, '{}'::jsonb)
            || jsonb_build_object('promo_code_use_released', true);
    end if;
    return new;
end;
$$;

drop trigger if exists payments_release_promotion_code_use on public.payments;
create trigger payments_release_promotion_code_use
    before update of status on public.payments
    for each row execute function public.release_promotion_code_use();

do $$
begin
    if to_regprocedure('public.create_manual_payment_with_delivery_before_promotion_codes(uuid,text,jsonb,jsonb,text,jsonb)') is null then
        alter function public.create_manual_payment_with_delivery(uuid, text, jsonb, jsonb, text, jsonb)
            rename to create_manual_payment_with_delivery_before_promotion_codes;
    end if;
end;
$$;

revoke all on function public.create_manual_payment_with_delivery_before_promotion_codes(
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
    promotion_code text;
begin
    result_value := public.create_manual_payment_with_delivery_before_promotion_codes(
        p_user_id,
        p_purchase_type,
        p_data,
        p_ticket_codes,
        p_idempotency_key,
        p_delivery
    );

    promotion_code := nullif(upper(btrim(coalesce(p_data->>'promo_code', ''))), '');
    if promotion_code is not null then
        perform public.apply_promotion_code((result_value->>'id')::uuid, promotion_code);
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
