# Input Produksi

Aplikasi web ringan untuk input akhir shift, monitoring target, rekap line, master produk, dan analisis reject. Aplikasi berjalan langsung di browser dan menyimpan data melalui Supabase.

## Menjalankan aplikasi

Gunakan static server agar perilakunya sama dengan deployment:

```bash
python3 -m http.server 8000
```

Buka `http://localhost:8000`, kemudian masukkan Project URL dan anon public key pada menu **Konfigurasi**.

## Database

1. Buka SQL Editor di project Supabase.
2. Jalankan [`supabase_schema.sql`](supabase_schema.sql).
3. Pastikan kebijakan akses database sesuai lingkungan operasional sebelum deployment publik.

Skema dan arti kolom didokumentasikan di [`docs/database.md`](docs/database.md). Migration ini tidak mengubah mekanisme PIN atau menambahkan Supabase Auth.

## Pemeriksaan lokal

Tidak ada dependency npm yang perlu diunduh. Gunakan Node.js 18 atau lebih baru:

```bash
npm test
npm run check
```

Perhitungan produksi murni berada di `production-core.js`, sehingga dapat diuji tanpa DOM dan tanpa koneksi Supabase. `app.js` bertugas membaca form dan meneruskan nilainya ke modul tersebut.

## Berkas utama

- `index.html` — struktur aplikasi.
- `style.css` — seluruh tampilan aplikasi.
- `production-core.js` — rumus produksi dan target yang bebas dari DOM.
- `app.js` — interaksi UI, koneksi Supabase, CRUD, dan export.
- `dashboard.js` — KPI dan chart monitoring.
- `test/production-core.test.js` — regression test rumus produksi.
