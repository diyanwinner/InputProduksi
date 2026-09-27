-- Production Plan setup. Jalankan manual sekali di Supabase SQL Editor.
-- Tidak menyentuh tabel logs atau mengubah histori produksi.

create table if not exists public.production_plans (
    id text primary key,
    product_id text not null references public.master(id) on update cascade on delete restrict,
    product_code_snapshot text not null,
    product_name_snapshot text not null,
    line_code text not null,
    plan_qty numeric not null check (plan_qty > 0),
    start_date date not null,
    due_date date,
    note text,
    status text not null default 'ACTIVE' check (status in ('ACTIVE', 'COMPLETED', 'CANCELLED')),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists production_plans_status_start_idx
    on public.production_plans (status, start_date);
create index if not exists production_plans_product_idx
    on public.production_plans (product_id);

create or replace function public.set_production_plans_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists production_plans_updated_at on public.production_plans;
create trigger production_plans_updated_at
before update on public.production_plans
for each row execute function public.set_production_plans_updated_at();

comment on table public.production_plans is 'Rencana internal kebutuhan GOOD/OK; tidak mengubah laporan produksi historis.';
