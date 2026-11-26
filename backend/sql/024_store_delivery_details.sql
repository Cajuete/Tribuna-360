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
    if p_purchase_type = 'store' then
        if p_delivery is null
           or jsonb_typeof(p_delivery) <> 'object'
           or length(btrim(coalesce(p_delivery->>'recipient_name', ''))) not between 2 and 120
           or length(btrim(coalesce(p_delivery->>'phone', ''))) not between 6 and 30
           or (p_delivery->>'phone') !~ '^[+()0-9[:space:]-]+$'
           or coalesce(p_delivery->>'method', '') not in ('home', 'point')
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
        update public.payments as payment_row
        set purchase_data = jsonb_set(
            jsonb_set(payment_row.purchase_data, '{delivery}', p_delivery, true),
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
                where order_row.payment_id = payment_row.id
            ), '[]'::jsonb),
            true
        )
        where payment_row.id = (result_value->>'id')::uuid
          and payment_row.user_id = p_user_id
          and payment_row.purchase_type = 'store'
          and payment_row.status = 'awaiting_proof';
    end if;

    return result_value;
end;
$$;

revoke all on function public.create_manual_payment_with_delivery(uuid, text, jsonb, jsonb, text, jsonb)
    from public, anon, authenticated;
grant execute on function public.create_manual_payment_with_delivery(uuid, text, jsonb, jsonb, text, jsonb)
    to service_role;
