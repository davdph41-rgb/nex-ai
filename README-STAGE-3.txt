NEX AI Stock Management - Stage 3 (Opening Inventory)

File yang diperbarui/ditambahkan:
1. api/stock/inventory.js (BARU)
2. index.html (DIPERBARUI)
3. script.js (DIPERBARUI)
4. style.css (DIPERBARUI)

Cara pemasangan:
1. Ekstrak ZIP ini.
2. Salin folder api/stock/inventory.js ke repo pada lokasi api/stock/inventory.js.
3. Ganti index.html, script.js, dan style.css di root repo dengan versi dari ZIP ini.
4. Jangan mengganti file backend lain atau menjalankan ulang SQL migration.
5. Commit dan push ke GitHub, lalu tunggu deployment Vercel selesai.

Catatan:
- Endpoint baru: GET/POST /api/stock/inventory
- Menggunakan tabel stock_daily_inventory yang sudah dibuat oleh migration Stock v1.
- GET membutuhkan query date=YYYY-MM-DD.
- POST menyimpan satu nilai stok awal untuk setiap produk aktif pada tanggal terpilih.
- Menyimpan ulang tanggal yang sama memperbarui opening_stock, bukan membuat baris ganda.
- Tahap ini hanya mengelola stok awal harian. Pengurangan stok, transaksi, sesi, dan saldo stok tersisa belum termasuk tahap ini.
