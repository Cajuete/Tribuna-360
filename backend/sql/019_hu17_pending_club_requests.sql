alter table public.club_requests
    add column if not exists contact_name text,
    add column if not exists privacy_consent_at timestamptz not null default now();

create unique index if not exists idx_club_requests_pending_email
    on public.club_requests (lower(btrim(contact_email)))
    where status = 'pending';

create unique index if not exists idx_club_requests_pending_club_association
    on public.club_requests (association_id, lower(btrim(slug)))
    where status = 'pending';
