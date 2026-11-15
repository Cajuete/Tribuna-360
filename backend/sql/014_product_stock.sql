-- Agrega control de stock a productos (Ficha B)
alter table public.products
    add column if not exists stock integer not null default 0;

-- Garantiza valor inicial para registros existentes
update public.products
set stock = 0
where stock is null;

-- Evita valores negativos a nivel de base de datos
do $$
begin
    if not exists (
        select 1
        from pg_constraint
        where conname = 'products_stock_check'
    ) then
        alter table public.products
            add constraint products_stock_check check (stock >= 0);
    end if;
end
$$;