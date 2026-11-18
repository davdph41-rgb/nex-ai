import { neon } from "@neondatabase/serverless";
import { randomUUID } from "node:crypto";

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

      const [products, transactions] = await Promise.all([
        sql`
          SELECT p.id AS product_id, p.name, p.code, p.unit, p.low_stock_threshold,
            i.opening_stock,
            COALESCE(SUM(CASE WHEN t.status = 'posted' THEN t.quantity * t.stock_effect ELSE 0 END), 0) AS movement_total,
            COALESCE(i.opening_stock, 0) +
              COALESCE(SUM(CASE WHEN t.status = 'posted' THEN t.quantity * t.stock_effect ELSE 0 END), 0) AS available_stock,
            (i.id IS NOT NULL) AS inventory_initialized
          FROM stock_products p
          LEFT JOIN stock_daily_inventory i
            ON i.product_id = p.id AND i.business_date = ${businessDate}::date
          LEFT JOIN stock_transactions t
            ON t.product_id = p.id AND t.business_date = ${businessDate}::date
          WHERE p.is_active = TRUE
          GROUP BY p.id, i.id, i.opening_stock
          ORDER BY p.sort_order, p.name
        `,
        sql`
          SELECT t.id, t.transaction_code, t.business_date, t.product_id,
            p.name AS product_name, p.unit, t.transaction_type, t.quantity,
            t.stock_effect, t.status, t.notes, t.created_at
          FROM stock_transactions t
          JOIN stock_products p ON p.id = t.product_id
          WHERE t.business_date = ${businessDate}::date
          ORDER BY t.created_at DESC, t.id DESC
          LIMIT 100
        `
      ]);

      return res.status(200).json({
        success: true,
        business_date: businessDate,
        inventory_initialized: products.length > 0 && products.every(p => p.inventory_initialized),
        products,
        transactions
      });
    }

    if (req.method === "POST") {
      const { business_date: businessDate, product_id: productId, quantity: rawQuantity, notes = "" } = req.body || {};
      const quantity = Number(rawQuantity);
      const cleanNotes = typeof notes === "string" ? notes.trim().slice(0, 500) : "";

      if (!isValidDate(businessDate)) {
        return res.status(400).json({ success: false, message: "Tanggal transaksi tidak valid" });
      }
      if (!validId(productId)) {
        return res.status(400).json({ success: false, message: "Pilih produk yang valid" });
      }
      if (rawQuantity === "" || rawQuantity === null || !Number.isFinite(quantity) || quantity <= 0) {
        return res.status(400).json({ success: false, message: "Jumlah penjualan harus lebih dari 0" });
      }

      const product = await sql`
        SELECT id, name FROM stock_products WHERE id = ${productId} AND is_active = TRUE
      `;
      if (!product.length) {
        return res.status(404).json({ success: false, message: "Produk aktif tidak ditemukan" });
      }

      const transactionCode = `MAN-${Date.now().toString(36).toUpperCase()}-${randomUUID().slice(0, 8).toUpperCase()}`;
      const idempotencyKey = randomUUID();
      const inserted = await sql`
        WITH current_balance AS (
          SELECT i.opening_stock + COALESCE(SUM(
            CASE WHEN t.status = 'posted' THEN t.quantity * t.stock_effect ELSE 0 END
          ), 0) AS available_stock
          FROM stock_daily_inventory i
          LEFT JOIN stock_transactions t
            ON t.product_id = i.product_id AND t.business_date = i.business_date
          WHERE i.business_date = ${businessDate}::date AND i.product_id = ${productId}
          GROUP BY i.opening_stock
        ), saved AS (
          INSERT INTO stock_transactions (
            transaction_code, business_date, product_id, transaction_type,
            quantity, stock_effect, status, idempotency_key, notes
          )
          SELECT ${transactionCode}, ${businessDate}::date, ${productId},
            'manual_sale', ${quantity}, -1, 'posted', ${idempotencyKey}, ${cleanNotes}
          FROM current_balance
          WHERE available_stock >= ${quantity}
          RETURNING id, transaction_code, business_date, product_id,
            transaction_type, quantity, stock_effect, status, notes, created_at
        )
        SELECT * FROM saved
      `;

      if (!inserted.length) {
        const inventory = await sql`
          SELECT id FROM stock_daily_inventory
          WHERE business_date = ${businessDate}::date AND product_id = ${productId}
        `;
        if (!inventory.length) {
          return res.status(409).json({ success: false, message: "Stok awal untuk produk ini belum disimpan pada tanggal tersebut. Simpan stok awal terlebih dahulu." });
        }
        return res.status(409).json({ success: false, message: "Stok tidak mencukupi untuk jumlah penjualan tersebut." });
      }

      return res.status(201).json({ success: true, message: `Penjualan ${product[0].name} berhasil dicatat.`, transaction: inserted[0] });
    }

    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ success: false, message: "Method not allowed" });
  } catch (error) {
    console.error("Stock transactions API:", error);
    if (error.code === "23505") {
      return res.status(409).json({ success: false, message: "Transaksi duplikat terdeteksi. Muat ulang data sebelum mencoba lagi." });
    }
    return res.status(500).json({ success: false, message: "Gagal memproses transaksi stok. Periksa struktur tabel dan koneksi database." });
  }
}
