NEX AI STOCK MANAGEMENT - STAGE 5
Manajemen Sesi Otomatis

ISI PAKET
- api/stock/sessions.js       Endpoint jadwal dan status sesi
- api/stock/transactions.js  Diperbarui untuk mengaitkan transaksi ke sesi aktif
- index.html                 Panel jadwal sesi dan input waktu nota
- script.js                  Memuat status sesi dan mengirim waktu transaksi
- style.css                  Tampilan sesi responsif
- STAGE-5-MIGRATION.sql      Migrasi database yang diperlukan

ATURAN SESI
Weekday (Senin-Jumat):
- Sesi 1: 12:00-15:00
- Sesi 2: 15:00-17:00
Weekend (Sabtu-Minggu):
- Sesi 1: 10:00-12:00
- Sesi 2: 12:00-15:00
- Sesi 3: 15:00-17:00

CARA MEMASANG
1. Buat backup database Neon terlebih dahulu.
2. Buka Neon SQL Editor dan jalankan isi STAGE-5-MIGRATION.sql SATU KALI.
3. Salin folder api/stock/ dari paket ke repository NEX AI (gabungkan, jangan hapus file lain).
4. Ganti index.html, script.js, dan style.css di root repository dengan file dari paket.
5. Commit dan push ke GitHub, lalu tunggu deployment Vercel selesai.
6. Pastikan DATABASE_URL tetap tersedia di Environment Variables Vercel.

CATATAN PENTING
- Tahap 5 menambahkan tabel stock_sessions dan kolom session_id pada stock_transactions.
- Jangan menjalankan migration ini berulang kali secara manual. Pernyataan dibuat aman untuk kolom/tabel yang sudah ada, tetapi jalankan sekali saja.
- Sistem menampilkan status sesi berdasarkan waktu Asia/Jakarta. Saat halaman sesi dimuat/di-refresh, sesi yang waktunya telah lewat akan ditandai terkunci.
- Transaksi manual hanya dapat disimpan pada tanggal hari ini dan selama sesi berjalan. Waktu pada nota wajib berada di rentang sesi aktif.
- Transaksi yang sudah terikat ke sesi tidak dipindahkan otomatis ke sesi lain.
- Tahap ini belum mencakup OCR nota, edit/void transaksi, atau laporan akhir.
- Sesuai kesepakatan, pengujian fungsional ditunda sampai seluruh tahapan selesai. Jangan gunakan transaksi operasional sungguhan sebelum pengujian akhir.
