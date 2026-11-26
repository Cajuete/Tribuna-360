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
            zone_row.price,
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

create or replace function public.regenerate_zone_ticket(
    p_ticket_id uuid,
    p_qr_code text
)
returns uuid
language plpgsql
set search_path = public, pg_temp
as $$
declare
    old_ticket public.tickets%rowtype;
    new_ticket_id uuid;
begin
    select *
    into old_ticket
    from public.tickets
    where id = p_ticket_id
    for update;

    if not found then
        raise exception using errcode = 'P0001', message = 'TICKET_NOT_FOUND';
    end if;

    perform 1
    from public.zones
    where id = old_ticket.zone_id
    for update;

    if not found then
        raise exception using errcode = 'P0001', message = 'ZONE_NOT_FOUND';
    end if;

    update public.tickets
    set status = 'cancelled'
    where id = old_ticket.id;

    insert into public.tickets (
        match_id,
        zone_id,
        buyer_id,
        qr_code,
        price,
        status,
        buyer_ci,
        buyer_name,
        payment_method
    )
    values (
        old_ticket.match_id,
        old_ticket.zone_id,
        old_ticket.buyer_id,
        p_qr_code,
        old_ticket.price,
        'valid',
        old_ticket.buyer_ci,
        old_ticket.buyer_name,
        old_ticket.payment_method
    )
    returning id into new_ticket_id;

    return new_ticket_id;
end;
$$;

revoke all on function public.sell_zone_tickets(uuid, uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.sell_zone_tickets(uuid, uuid, uuid, jsonb) to service_role;

revoke all on function public.regenerate_zone_ticket(uuid, text) from public, anon, authenticated;
grant execute on function public.regenerate_zone_ticket(uuid, text) to service_role;
