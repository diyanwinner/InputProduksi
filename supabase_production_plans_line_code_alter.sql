-- Production Plan Task 2 migration.
-- Jalankan manual di Supabase SQL Editor untuk tabel production_plans yang sudah ada.
-- Tidak menghapus ataupun mengubah plan yang telah tersimpan.

alter table public.production_plans
    add column if not exists line_code text;

create index if not exists production_plans_line_start_idx
    on public.production_plans (line_code, start_date);

comment on column public.production_plans.line_code is 'Nomor mesin/line untuk Production Plan; plan lama dapat bernilai null.';
