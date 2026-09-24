# Input Produksi

Aplikasi web ringan untuk input akhir shift, monitoring target, rekap line, master produk, dan analisis reject. Aplikasi berjalan langsung di browser dan menyimpan data melalui Supabase.

## Menjalankan aplikasi

Untuk pengembangan modern dengan hot reload:

```bash
npm install
npm run dev
```

Buka alamat yang ditampilkan Vite, kemudian masukkan Project URL dan anon public key pada menu **Konfigurasi**. Untuk membuat bundle deployment gunakan `npm run build`; hasilnya berada di folder `dist`.

## Database

1. Buka SQL Editor di project Supabase.
2. Jalankan [`supabase_schema.sql`](supabase_schema.sql).
3. Pastikan kebijakan akses database sesuai lingkungan operasional sebelum deployment publik.

Skema dan arti kolom didokumentasikan di [`docs/database.md`](docs/database.md). Migration ini tidak mengubah mekanisme PIN atau menambahkan Supabase Auth.

## Pemeriksaan lokal

Regression test memakai test runner bawaan Node.js. Setelah dependency pengembangan terpasang, jalankan:

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
