# Kontrak Data Supabase

Dokumen ini menjelaskan data yang dibaca dan ditulis aplikasi. Sumber skema executable berada di `supabase_schema.sql`.

## `master`

| Kolom | Arti |
|---|---|
| `id` | ID teks yang dibuat aplikasi. |
| `kode`, `nama` | Identitas produk; kombinasinya unik. |
| `tipe` | `pcs` atau `kg_sisa`, menentukan cara konversi sisa. |
| `gram`, `runner` | Berat produk dan runner dalam gram. |
| `cavity` | Jumlah cavity standar. |
| `cycle_time_sec` | Cycle time standar dalam detik. |
| `per_dus`, `per_box` | Isi standar kemasan. |

## `logs`

### Identitas dan hasil shift

`id`, `tanggal`, `shift`, `line`, `kode`, `nama`, dan `tipe` mengidentifikasi laporan. `gram`, `runner`, `cavity`, serta `counter` adalah snapshot input saat laporan dibuat. Hasil kalkulasi disimpan pada `hasil`, `okpcs`, `okkg`, `reject`, `yieldpct`, dan `sisa_bahan`.

### Packaging dan sisa

`qty_dus`, `isi_dus`, `qty_box`, `isi_box`, `qty_dus_plus`, dan `isi_dus_plus` membentuk total hasil packing. `detail_sisa` menyimpan array nilai sebelum/sesudah sebagai JSON.

### Reject

Detail reject disimpan pada kolom berawalan `reject_`: `uneven`, `mottled`, `startup`, `short`, `flow`, `flashing`, `crack`, `spot`, `scratch`, dan `dirty`. `reject_max` menyimpan detail reject tertinggi.

### Snapshot target

Kolom `cycle_time_sec_snapshot`, `cavity_standard_snapshot`, dan `standard_shift_hours` membekukan standar yang berlaku saat laporan dibuat. `effective_hours`, `planned_stop_hours`, `planned_stop_reason`, `cavity_active`, dan `cavity_adjust_reason` menjelaskan penurunan kapasitas.

Target disimpan dalam `target_shot_hour`, `target_hour_standard`, `target_hour_actual`, `target_standard_pcs`, dan `target_actual_pcs`. Hasil evaluasinya disimpan dalam `achievement_standard_pct`, `achievement_actual_pct`, `gap_standard_pcs`, `gap_actual_pcs`, dan `target_status`.

Loss disimpan terpisah pada `time_loss_pcs`, `cavity_loss_pcs`, dan `capacity_loss_total_pcs`. `under_target_reason` menjelaskan laporan yang berada di bawah toleransi.

## Status target

- `NO_TARGET`: cycle time/target belum tersedia.
- `TARGET_STANDARD_TERCAPAI`: OK minimal 97% dari target standar.
- `TERCAPAI_AKTUAL_LOSS_CAPACITY`: target aktual tercapai, tetapi kapasitas standar turun.
- `HAMPIR_TIDAK_TARGET`: pencapaian aktual 90% sampai di bawah 97%.
- `TIDAK_TARGET`: pencapaian aktual di bawah 90%.

## Catatan operasional

- Jangan mengubah snapshot pada laporan lama saat master produk diperbarui.
- Aplikasi saat ini membuat ID teks di browser, sehingga kolom `id` sengaja bertipe `text`.
- File skema belum mengaktifkan Auth atau mengubah PIN aplikasi sesuai kebutuhan operasional saat ini.
