alter table public.matches
    add column if not exists latitude numeric(9, 6),
    add column if not exists longitude numeric(9, 6);

do $$
begin
    if not exists (
        select 1 from pg_constraint where conname = 'matches_stadium_coordinates_check'
    ) then
        alter table public.matches
            add constraint matches_stadium_coordinates_check
            check (
                (latitude is null and longitude is null)
                or (
                    latitude is not null
                    and longitude is not null
                    and latitude between -90 and 90
                    and longitude between -180 and 180
                )
            );
    end if;
end
$$;
