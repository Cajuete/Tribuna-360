create table if not exists public.membership_cancellation_requests (
    id uuid primary key default gen_random_uuid(),
    membership_id uuid not null references public.memberships(id) on delete cascade,
    user_id uuid not null references public.users(id) on delete cascade,
    tenant_id uuid not null references public.tenants(id) on delete cascade,
    status text not null default 'pending'
        check (status in ('pending', 'approved', 'rejected')),
    requested_at timestamptz not null default now(),
    reviewed_at timestamptz,
    reviewed_by uuid references public.users(id) on delete set null,
    review_note text
);

create unique index if not exists idx_membership_cancellation_pending
    on public.membership_cancellation_requests (membership_id)
    where status = 'pending';

create index if not exists idx_membership_cancellation_tenant_status
    on public.membership_cancellation_requests (tenant_id, status, requested_at desc);

alter table public.membership_cancellation_requests enable row level security;

create or replace function public.resolve_membership_cancellation_request(
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
    request_row public.membership_cancellation_requests%rowtype;
    membership_row public.memberships%rowtype;
    reviewer_role text;
    reviewer_tenant_id uuid;
    clean_note text := nullif(btrim(coalesce(p_review_note, '')), '');
begin
    if p_decision is null or p_decision not in ('approved', 'rejected') then
        raise exception using errcode = 'P0001', message = 'INVALID_DECISION';
    end if;

    if length(coalesce(p_review_note, '')) > 2000 then
        raise exception using errcode = 'P0001', message = 'REVIEW_NOTE_TOO_LONG';
    end if;

    select role, tenant_id
    into reviewer_role, reviewer_tenant_id
    from public.users
    where id = p_reviewed_by;

    if reviewer_role is null or reviewer_role not in ('superadmin', 'club_admin') then
        raise exception using errcode = '42501', message = 'CLUB_ADMIN_REQUIRED';
    end if;

    select *
    into request_row
    from public.membership_cancellation_requests
    where id = p_request_id
    for update;

    if not found then
        raise exception using errcode = 'P0001', message = 'CANCELLATION_REQUEST_NOT_FOUND';
    end if;

    if reviewer_role <> 'superadmin' and reviewer_tenant_id is distinct from request_row.tenant_id then
        raise exception using errcode = '42501', message = 'CANCELLATION_REQUEST_OTHER_TENANT';
    end if;

    if request_row.status <> 'pending' then
        raise exception using errcode = 'P0001', message = 'CANCELLATION_REQUEST_ALREADY_RESOLVED';
    end if;

    select *
    into membership_row
    from public.memberships
    where id = request_row.membership_id
    for update;

    if not found or membership_row.user_id <> request_row.user_id
        or membership_row.tenant_id <> request_row.tenant_id then
        raise exception using errcode = 'P0001', message = 'CANCELLATION_REQUEST_MEMBERSHIP_MISMATCH';
    end if;

    if p_decision = 'approved' then
        update public.memberships
        set status = 'cancelled'
        where id = membership_row.id
          and status = 'active';
    end if;

    update public.membership_cancellation_requests
    set status = p_decision,
        reviewed_at = now(),
        reviewed_by = p_reviewed_by,
        review_note = clean_note
    where id = request_row.id;

    return jsonb_build_object(
        'id', request_row.id,
        'status', p_decision,
        'reviewed_at', now(),
        'membership_id', request_row.membership_id
    );
end;
$$;

revoke all on function public.resolve_membership_cancellation_request(uuid, text, text, uuid) from public, anon, authenticated;
grant execute on function public.resolve_membership_cancellation_request(uuid, text, text, uuid) to service_role;
