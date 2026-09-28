-- Production Plan Task 6 migration. Jalankan manual di Supabase SQL Editor.
-- Aman untuk data plan yang sudah ada: tidak menghapus tabel, plan, atau logs.

alter table public.production_plans
    add column if not exists completed_date date,
    add column if not exists completed_shift integer;

create table if not exists public.production_plan_machine_assignments (
    id text primary key,
    plan_id text not null references public.production_plans(id) on delete cascade,
    line_code text not null,
    effective_date date not null,
    effective_shift integer not null default 1 check (effective_shift between 1 and 3),
    created_at timestamptz not null default now()
);

create index if not exists production_plan_machine_assignments_plan_effective_idx
    on public.production_plan_machine_assignments (plan_id, effective_date, effective_shift, created_at);

create unique index if not exists production_plan_machine_assignments_unique_slot_idx
    on public.production_plan_machine_assignments (plan_id, line_code, effective_date, effective_shift);

-- Plan lama tetap memiliki histori mesin awal berdasarkan mesin dan tanggal mulai yang sudah tersimpan.
-- Shift 1 dipakai sebagai batas awal aman untuk data lama yang belum punya shift assignment.
insert into public.production_plan_machine_assignments (id, plan_id, line_code, effective_date, effective_shift)
select
    md5('production-plan-initial-assignment:' || p.id),
    p.id,
    p.line_code,
    p.start_date,
    1
from public.production_plans p
where p.line_code is not null
  and p.start_date is not null
  and not exists (
      select 1
      from public.production_plan_machine_assignments a
      where a.plan_id = p.id
  )
on conflict do nothing;

comment on table public.production_plan_machine_assignments is
    'Riwayat mesin Production Plan. Progress hanya menghitung log pada mesin yang assignment-nya berlaku untuk tanggal/shift log.';
comment on column public.production_plans.completed_date is
    'Batas tanggal histori Production Plan COMPLETED.';
comment on column public.production_plans.completed_shift is
    'Batas shift (1-3) histori Production Plan COMPLETED.';
