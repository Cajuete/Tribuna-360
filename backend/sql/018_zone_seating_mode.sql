alter table public.zones
    add column if not exists sale_mode text not null default 'general';

update public.zones
set sale_mode = 'general'
where sale_mode is null;

alter table public.zones
    alter column sale_mode set default 'general',
    alter column sale_mode set not null;

do $$
begin
    if not exists (
        select 1
        from pg_constraint
        where conrelid = 'public.zones'::regclass
          and conname = 'zones_sale_mode_check'
    ) then
        alter table public.zones
            add constraint zones_sale_mode_check
            check (sale_mode in ('general', 'numbered'));
    end if;
end;
$$;

create or replace function public.prevent_sold_zone_mode_change()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
    if new.sale_mode is distinct from old.sale_mode
       and exists (
           select 1
           from public.tickets
           where zone_id = old.id
             and status is distinct from 'cancelled'
       ) then
        raise exception using
            errcode = 'P0001',
            message = 'ZONE_HAS_ACTIVE_TICKETS';
    end if;
    return new;
end;
$$;

drop trigger if exists zones_prevent_sold_mode_change on public.zones;
create trigger zones_prevent_sold_mode_change
before update of sale_mode on public.zones
for each row
execute function public.prevent_sold_zone_mode_change();

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

revoke all on function public.sell_zone_tickets(uuid, uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.sell_zone_tickets(uuid, uuid, uuid, jsonb) to service_role;
