-- Production Plan adjustments setup. Jalankan manual di Supabase SQL Editor.
-- Tidak mengubah tabel logs atau production_plans yang sudah ada.

create table if not exists public.production_plan_adjustments (
    id text primary key,
    plan_id text not null references public.production_plans(id) on delete cascade,
    adjustment_date date not null,
    direction text not null check (direction in ('LOSS', 'ADD')),
    qty numeric not null check (qty > 0),
    reason text not null check (reason in ('Reject Tambahan', 'Rusak', 'Disposal', 'Sortir', 'Koreksi', 'Lainnya')),
    note text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists production_plan_adjustments_plan_date_idx
    on public.production_plan_adjustments (plan_id, adjustment_date desc);

create or replace function public.set_production_plan_adjustments_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists production_plan_adjustments_updated_at on public.production_plan_adjustments;
create trigger production_plan_adjustments_updated_at
before update on public.production_plan_adjustments
for each row execute function public.set_production_plan_adjustments_updated_at();

create or replace function public.validate_production_plan_adjustment_date()
returns trigger
language plpgsql
as $$
declare
    plan_start date;
begin
    select start_date into plan_start from public.production_plans where id = new.plan_id;
    if plan_start is null then
        raise exception 'Production Plan tidak ditemukan';
    end if;
    if new.adjustment_date < plan_start then
        raise exception 'Tanggal penyesuaian tidak boleh sebelum tanggal mulai plan';
    end if;
    return new;
end;
$$;

drop trigger if exists production_plan_adjustments_validate_date on public.production_plan_adjustments;
create trigger production_plan_adjustments_validate_date
before insert or update on public.production_plan_adjustments
for each row execute function public.validate_production_plan_adjustment_date();

comment on table public.production_plan_adjustments is 'Penyesuaian hasil GOOD Production Plan; tidak mengubah laporan logs.';
