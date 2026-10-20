-- 001_perfil_usuario.sql
-- Perfil completo para el registro de hinchas.
-- Ejecutar en: Supabase Dashboard -> SQL Editor

alter table public.users
  add column if not exists first_name text,
  add column if not exists paternal_last_name text,
  add column if not exists maternal_last_name text,
  add column if not exists phone text,
  add column if not exists age integer,
  add column if not exists ci text;

-- C.I. unico (permite multiples NULL para cuentas creadas por clubes/sistema)
create unique index if not exists users_ci_unique_idx
  on public.users (ci)
  where ci is not null;
