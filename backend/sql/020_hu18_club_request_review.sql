alter table public.club_requests
    add column if not exists status_token_hash text,
    add column if not exists reviewed_at timestamptz,
    add column if not exists reviewed_by uuid references public.users(id) on delete set null,
    add column if not exists review_note text,
    add column if not exists tenant_id uuid references public.tenants(id) on delete set null;

create unique index if not exists idx_club_requests_status_token_hash
    on public.club_requests (status_token_hash)
    where status_token_hash is not null;

create index if not exists idx_club_requests_pending_created_at
    on public.club_requests (created_at)
    where status = 'pending';

update public.club_requests request
set tenant_id = tenant.id
from public.tenants tenant
where request.status = 'approved'
  and request.tenant_id is null
  and request.slug = tenant.slug;

create or replace function public.resolve_club_request(
    p_request_id uuid,
    p_decision text,
    p_review_note text,
    p_reviewed_by uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    request_row public.club_requests%rowtype;
    tenant_row public.tenants%rowtype;
    clean_note text := nullif(btrim(coalesce(p_review_note, '')), '');
    reused_tenant boolean := false;
begin
    if p_decision is null or p_decision not in ('approved', 'rejected') then
        raise exception using errcode = 'P0001', message = 'INVALID_DECISION';
    end if;

    if p_decision = 'rejected' and clean_note is null then
        raise exception using errcode = 'P0001', message = 'REJECTION_NOTE_REQUIRED';
    end if;

    if length(coalesce(p_review_note, '')) > 2000 then
        raise exception using errcode = 'P0001', message = 'REVIEW_NOTE_TOO_LONG';
    end if;

    if not exists (
        select 1
        from public.users
        where id = p_reviewed_by
          and role = 'superadmin'
    ) then
        raise exception using errcode = '42501', message = 'SUPERADMIN_REQUIRED';
    end if;

    select *
    into request_row
    from public.club_requests
    where id = p_request_id
    for update;

    if not found then
        raise exception using errcode = 'P0001', message = 'CLUB_REQUEST_NOT_FOUND';
    end if;

    if request_row.status <> 'pending' then
        raise exception using errcode = 'P0001', message = 'CLUB_REQUEST_ALREADY_RESOLVED';
    end if;

    if p_decision = 'approved' then
        perform pg_advisory_xact_lock(hashtextextended(request_row.slug, 0));

        select *
        into tenant_row
        from public.tenants
        where slug = request_row.slug
        for update;

        if found then
            if tenant_row.association_id is distinct from request_row.association_id then
                raise exception using errcode = 'P0001', message = 'CLUB_SLUG_CONFLICT';
            end if;

            update public.tenants
            set is_active = true,
                activated_at = coalesce(activated_at, now())
            where id = tenant_row.id
            returning * into tenant_row;
            reused_tenant := true;
        else
            insert into public.tenants (
                name,
                slug,
                logo_url,
                stadium_name,
                stadium_capacity,
                association_id,
                department,
                personeria,
                run_code,
                is_active
            )
            values (
                request_row.club_name,
                request_row.slug,
                request_row.logo_url,
                request_row.stadium_name,
                request_row.stadium_capacity,
                request_row.association_id,
                request_row.department,
                request_row.personeria,
                request_row.run_code,
                true
            )
            returning * into tenant_row;
        end if;
    end if;

    update public.club_requests
    set status = p_decision,
        reviewed_at = now(),
        reviewed_by = p_reviewed_by,
        review_note = clean_note,
        tenant_id = case when p_decision = 'approved' then tenant_row.id else null end
    where id = request_row.id;

    return jsonb_build_object(
        'id', request_row.id,
        'status', p_decision,
        'reviewed_at', now(),
        'tenant_id', case when p_decision = 'approved' then tenant_row.id else null end,
        'tenant_reused', reused_tenant
    );
end;
$$;

revoke all on function public.resolve_club_request(uuid, text, text, uuid) from public, anon, authenticated;
grant execute on function public.resolve_club_request(uuid, text, text, uuid) to service_role;
