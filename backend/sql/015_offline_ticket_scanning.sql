create table if not exists public.offline_ticket_scan_receipts (
    client_scan_id text primary key,
    scanner_user_id text not null,
    match_id text not null,
    qr_code text not null,
    outcome text not null check (outcome in ('synced', 'conflict', 'invalid')),
    message text not null,
    created_at timestamptz not null default now()
);

create index if not exists idx_offline_scan_receipts_match
    on public.offline_ticket_scan_receipts(match_id, created_at);

alter table public.offline_ticket_scan_receipts enable row level security;
revoke all on public.offline_ticket_scan_receipts from public, anon, authenticated;
grant all on public.offline_ticket_scan_receipts to service_role;

create or replace function public.sync_offline_ticket_scans(
    p_match_id text,
    p_scanner_user_id text,
    p_scans jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    item jsonb;
    scan_id text;
    scan_code text;
    scan_outcome text;
    scan_message text;
    existing_receipt public.offline_ticket_scan_receipts%rowtype;
    ticket_row public.tickets%rowtype;
    results jsonb := '[]'::jsonb;
begin
    if coalesce(jsonb_typeof(p_scans), '') <> 'array' then
        raise exception 'Se requiere una lista de escaneos.';
    end if;
    if jsonb_array_length(p_scans) > 100 then
        raise exception 'Se requiere un arreglo de hasta 100 escaneos.';
    end if;

    for item in select value from jsonb_array_elements(p_scans)
    loop
        scan_id := item->>'client_scan_id';
        scan_code := item->>'qr_code';
        scan_outcome := null;
        scan_message := null;

        if scan_id is null or length(scan_id) > 80 or scan_code is null or length(scan_code) > 80 then
            raise exception 'Escaneo offline inválido.';
        end if;

        perform pg_advisory_xact_lock(hashtext(scan_id));

        select * into existing_receipt
        from public.offline_ticket_scan_receipts
        where client_scan_id = scan_id;

        if found then
            if existing_receipt.scanner_user_id = p_scanner_user_id
                and existing_receipt.match_id = p_match_id
                and existing_receipt.qr_code = scan_code then
                scan_outcome := existing_receipt.outcome;
                scan_message := existing_receipt.message;
            else
                scan_outcome := 'invalid';
                scan_message := 'El identificador de escaneo ya fue utilizado.';
            end if;
        else
            select * into ticket_row
            from public.tickets
            where qr_code = scan_code and match_id::text = p_match_id
            for update;

            if not found then
                scan_outcome := 'invalid';
                scan_message := 'Entrada inválida o no pertenece a este partido.';
            elsif ticket_row.status = 'valid' then
                update public.tickets
                set status = 'used', scanned_at = now()
                where id = ticket_row.id;
                scan_outcome := 'synced';
                scan_message := 'Entrada aceptada y sincronizada.';
            elsif ticket_row.status = 'used' then
                scan_outcome := 'conflict';
                scan_message := 'La entrada ya fue utilizada por otro escáner o en línea.';
            else
                scan_outcome := 'invalid';
                scan_message := 'La entrada ya no está habilitada.';
            end if;

            insert into public.offline_ticket_scan_receipts (
                client_scan_id, scanner_user_id, match_id, qr_code, outcome, message
            ) values (
                scan_id, p_scanner_user_id, p_match_id, scan_code, scan_outcome, scan_message
            );
        end if;

        results := results || jsonb_build_array(jsonb_build_object(
            'client_scan_id', scan_id,
            'status', scan_outcome,
            'message', scan_message
        ));
    end loop;

    return results;
end;
$$;

revoke all on function public.sync_offline_ticket_scans(text, text, jsonb) from public, anon, authenticated;
grant execute on function public.sync_offline_ticket_scans(text, text, jsonb) to service_role;
