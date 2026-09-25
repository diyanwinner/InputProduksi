-- Skema referensi Input Produksi v3.5.
-- Aman dijalankan ulang: tabel dibuat bila belum ada dan kolom target ditambahkan secara idempotent.

create table if not exists public.master (
    id text primary key,
    kode text not null,
    nama text not null default '',
    tipe text not null default 'pcs' check (tipe in ('pcs', 'kg_sisa')),
    gram numeric not null default 0,
    runner numeric not null default 0,
    cavity numeric not null default 1,
    cycle_time_sec numeric not null default 0,
    per_dus numeric not null default 0,
    per_box numeric not null default 0
);

create table if not exists public.logs (
    id text primary key,
    tanggal date not null,
    shift text not null,
    line text not null,
    kode text not null,
    nama text not null default '',
    tipe text not null default 'pcs',
    gram numeric not null default 0,
    runner numeric not null default 0,
    cavity numeric not null default 1,
    counter numeric not null default 0,
    qty_dus numeric not null default 0,
    isi_dus numeric not null default 0,
    qty_box numeric not null default 0,
    isi_box numeric not null default 0,
    qty_dus_plus numeric not null default 0,
    isi_dus_plus numeric not null default 0,
    hasil numeric not null default 0,
    okpcs numeric not null default 0,
    okkg numeric not null default 0,
    reject numeric not null default 0,
    yieldpct numeric not null default 0,
    sisa_bahan numeric not null default 0,
    catatan text not null default '',
    reject_uneven numeric not null default 0,
    reject_mottled numeric not null default 0,
    reject_startup numeric not null default 0,
    reject_short numeric not null default 0,
    reject_flow numeric not null default 0,
    reject_flashing numeric not null default 0,
    reject_crack numeric not null default 0,
    reject_spot numeric not null default 0,
    reject_scratch numeric not null default 0,
    reject_dirty numeric not null default 0,
    reject_max numeric not null default 0,
    detail_sisa jsonb
);

alter table public.master add column if not exists cycle_time_sec numeric not null default 0;

alter table public.logs add column if not exists cycle_time_sec_snapshot numeric not null default 0;
alter table public.logs add column if not exists shift_hours numeric not null default 8;
alter table public.logs add column if not exists standard_shift_hours numeric not null default 8;
alter table public.logs add column if not exists effective_hours numeric not null default 8;
alter table public.logs add column if not exists planned_stop_hours numeric not null default 0;
alter table public.logs add column if not exists planned_stop_reason text not null default '';
alter table public.logs add column if not exists planned_stop_note text not null default '';
alter table public.logs add column if not exists cavity_standard_snapshot numeric not null default 1;
alter table public.logs add column if not exists cavity_active numeric not null default 1;
alter table public.logs add column if not exists target_shot_hour numeric not null default 0;
alter table public.logs add column if not exists target_hour_standard numeric not null default 0;
alter table public.logs add column if not exists target_hour_actual numeric not null default 0;
alter table public.logs add column if not exists target_standard_pcs numeric not null default 0;
alter table public.logs add column if not exists target_actual_pcs numeric not null default 0;
alter table public.logs add column if not exists achievement_standard_pct numeric not null default 0;
alter table public.logs add column if not exists achievement_actual_pct numeric not null default 0;
alter table public.logs add column if not exists gap_standard_pcs numeric not null default 0;
alter table public.logs add column if not exists gap_actual_pcs numeric not null default 0;
alter table public.logs add column if not exists target_status text not null default 'NO_TARGET';
alter table public.logs add column if not exists time_loss_pcs numeric not null default 0;
alter table public.logs add column if not exists cavity_loss_pcs numeric not null default 0;
alter table public.logs add column if not exists capacity_loss_total_pcs numeric not null default 0;
alter table public.logs add column if not exists cavity_adjust_reason text not null default '';
alter table public.logs add column if not exists cavity_note text not null default '';
alter table public.logs add column if not exists under_target_reason text not null default '';

create index if not exists logs_tanggal_idx on public.logs (tanggal desc);
create index if not exists logs_line_tanggal_idx on public.logs (line, tanggal desc);
create index if not exists logs_kode_idx on public.logs (kode);
create unique index if not exists master_kode_nama_uidx on public.master (lower(kode), lower(nama));

comment on table public.master is 'Master produk dan standar teknis produksi.';
comment on table public.logs is 'Snapshot laporan akhir shift; nilai target disimpan agar histori tidak berubah saat master diperbarui.';
