import { neon } from "@neondatabase/serverless";

function isValidDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function validId(value) {
  return /^\d+$/.test(String(value ?? ""));
}

export default async function handler(req, res) {
  if (!process.env.DATABASE_URL) {
    return res.status(500).json({ success: false, message: "DATABASE_URL belum ditemukan" });
  }

  const sql = neon(process.env.DATABASE_URL);

  try {
    if (req.method === "GET") {
      const businessDate = req.query.date;
      if (!isValidDate(businessDate)) {
        return res.status(400).json({ success: false, message: "Parameter date wajib berformat YYYY-MM-DD" });
      }

      const items = await sql`
        SELECT
          p.id AS product_id,
          p.code,
          p.name,
          p.unit,
          p.low_stock_threshold,
          i.id AS inventory_id,
          i.opening_stock,
          i.notes,
          i.updated_at AS inventory_updated_at
        FROM stock_products p
        LEFT JOIN stock_daily_inventory i
          ON i.product_id = p.id AND i.business_date = ${businessDate}::date
        WHERE p.is_active = TRUE
        ORDER BY p.sort_order, p.name
      `;

      return res.status(200).json({
        success: true,
        business_date: businessDate,
        total: items.length,
        initialized: items.some(item => item.inventory_id !== null),
        items
      });
    }

    if (req.method === "POST") {
      const { business_date: businessDate, items } = req.body || {};

      if (!isValidDate(businessDate)) {
        return res.status(400).json({ success: false, message: "Tanggal operasional tidak valid" });
      }
      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ success: false, message: "Daftar stok produk wajib diisi" });
      }

      const normalized = [];
      const seen = new Set();

      for (const item of items) {
        if (!validId(item?.product_id)) {
          return res.status(400).json({ success: false, message: "ID produk tidak valid" });
        }
        const id = String(item.product_id);
        if (seen.has(id)) {
          return res.status(400).json({ success: false, message: "Produk yang sama tidak boleh dikirim dua kali" });
        }
        seen.add(id);

        const quantity = Number(item.opening_stock);
        if (item.opening_stock === "" || item.opening_stock === null ||
            !Number.isFinite(quantity) || quantity < 0) {
          return res.status(400).json({ success: false, message: "Semua jumlah stok wajib berupa angka 0 atau lebih" });
        }

        normalized.push({ product_id: id, opening_stock: quantity });
      }

      const activeProducts = await sql`
        SELECT id FROM stock_products WHERE is_active = TRUE ORDER BY sort_order, id
      `;
      const activeIds = new Set(activeProducts.map(product => String(product.id)));

      if (normalized.length !== activeIds.size || normalized.some(item => !activeIds.has(item.product_id))) {
        return res.status(400).json({
          success: false,
          message: "Data harus berisi tepat satu jumlah stok untuk setiap produk aktif."
        });
      }

      const payload = JSON.stringify(normalized);
      const saved = await sql`
        INSERT INTO stock_daily_inventory (business_date, product_id, opening_stock)
        SELECT ${businessDate}::date, input_rows.product_id, input_rows.opening_stock
        FROM jsonb_to_recordset(${payload}::jsonb)
          AS input_rows(product_id BIGINT, opening_stock NUMERIC)
        ON CONFLICT (business_date, product_id)
        DO UPDATE SET
          opening_stock = EXCLUDED.opening_stock,
          updated_at = NOW()
        RETURNING id, product_id, opening_stock, updated_at
      `;

      return res.status(200).json({
        success: true,
        message: `Stok awal ${businessDate} berhasil disimpan.`,
        business_date: businessDate,
        total: saved.length,
        items: saved
      });
    }

    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ success: false, message: "Method not allowed" });
  } catch (error) {
    console.error("Stock inventory API:", error);
    return res.status(500).json({
      success: false,
      message: "Gagal memproses inventaris. Periksa tabel stock_daily_inventory dan koneksi database."
    });
  }
}
