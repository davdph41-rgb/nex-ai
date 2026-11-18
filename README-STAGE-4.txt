NEX AI STOCK MANAGEMENT - STAGE 4
Transaksi Penjualan Manual dan Perhitungan Stok Tersedia

FILE DALAM PAKET
- api/stock/inventory.js       (endpoint Tahap 3)
- api/stock/transactions.js    (endpoint baru Tahap 4)
- index.html                   (UI Stok Awal + Transaksi)
- script.js                    (logika UI Tahap 3 dan 4)
- style.css                    (tampilan responsif Tahap 3 dan 4)

CARA MEMASANG
1. Ekstrak ZIP.
2. Salin folder api/stock/ ke folder api/stock/ pada repository NEX AI. Jika diminta, timpa inventory.js dengan versi dalam paket dan tambahkan transactions.js.
3. Ganti index.html, script.js, dan style.css di root repository dengan versi dalam paket.
4. Pastikan Environment Variable DATABASE_URL tetap tersedia di Vercel.
5. Commit dan push ke GitHub, lalu tunggu deployment Vercel selesai.

CATATAN DATABASE
- Tidak perlu menjalankan SQL migration lagi.
- Endpoint ini memakai tabel stock_products, stock_daily_inventory, dan stock_transactions yang sudah dibuat oleh migration Stock Management v1.0.
- Tidak ada tabel baru yang dibuat pada tahap ini.

FITUR TAHAP 4
- Catat penjualan manual untuk tanggal operasional tertentu.
- Penjualan mengurangi stok tersedia.
- Sistem menolak transaksi jika stok awal belum disimpan atau stok tidak mencukupi.
- Menampilkan stok tersedia per produk dan riwayat maksimal 100 transaksi untuk tanggal yang dipilih.
- Riwayat transaksi disimpan di Neon.

PENTING
- Jangan masukkan transaksi operasional sungguhan sampai seluruh tahapan dan pengujian akhir selesai.
- Tahap ini belum mencakup OCR nota, pengelolaan sesi otomatis, edit/void transaksi, maupun reservasi.
