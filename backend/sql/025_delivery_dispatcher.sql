alter type public.user_role add value if not exists 'delivery_manager';

alter table public.tenants
    add column if not exists delivery_home_fee numeric(10, 2) not null default 20,
    add column if not exists delivery_point_fee numeric(10, 2) not null default 10,
    add column if not exists delivery_interdepartment_surcharge numeric(10, 2) not null default 50;

do $$
begin
    if not exists (
        select 1 from pg_constraint where conname = 'tenants_delivery_fees_check'
    ) then
        alter table public.tenants
            add constraint tenants_delivery_fees_check
            check (
                delivery_home_fee between 0 and 10000
                and delivery_point_fee between 0 and 10000
                and delivery_interdepartment_surcharge between 0 and 10000
            );
    end if;
end $$;

alter table public.orders
    add column if not exists delivery_proof_path text,
    add column if not exists delivered_at timestamptz,
    add column if not exists delivered_by uuid references public.users(id) on delete set null;

alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders
    add constraint orders_status_check
    check (status in ('pending', 'paid', 'shipped', 'delivered', 'cancelled'));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
    'delivery-proofs',
    'delivery-proofs',
    false,
    5242880,
    array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

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
