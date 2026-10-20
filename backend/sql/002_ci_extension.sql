-- 002_ci_extension.sql
-- Extension (departamento) del C.I. como campo aparte.
-- Ejecutar en: Supabase Dashboard -> SQL Editor

alter table public.users
  add column if not exists ci_extension text;
