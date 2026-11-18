import { neon } from "@neondatabase/serverless";

function validId(value) {
  return /^\d+$/.test(String(value ?? ""));
}

function makeCode(name) {
  return String(name).normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 45);
}

export default async function handler(req, res) {
  if (!process.env.DATABASE_URL) {
    return res.status(500).json({ success: false, message: "DATABASE_URL belum ditemukan" });
  }
  const sql = neon(process.env.DATABASE_URL);

  try {
    if (req.method === "GET") {
      const q = typeof req.query.q === "string" ? req.query.q.trim().slice(0, 100) : "";
      const search = `%${q}%`;
      const products = await sql`
        SELECT p.id, p.code, p.name, p.unit, p.low_stock_threshold,
          p.is_active, p.sort_order, p.created_at, p.updated_at,
          COUNT(a.id)::int AS alias_count,
          COALESCE(json_agg(json_build_object('id', a.id, 'raw_alias', a.raw_alias)
            ORDER BY a.raw_alias) FILTER (WHERE a.id IS NOT NULL), '[]'::json) AS aliases
        FROM stock_products p
        LEFT JOIN stock_product_aliases a ON a.product_id = p.id
        WHERE (${q} = '' OR p.name ILIKE ${search} OR p.code ILIKE ${search}
          OR EXISTS (SELECT 1 FROM stock_product_aliases ax
            WHERE ax.product_id = p.id AND ax.raw_alias ILIKE ${search}))
        GROUP BY p.id
        ORDER BY p.sort_order, p.name
      `;
      return res.status(200).json({ success: true, total: products.length, products });
    }

    if (req.method === "POST") {
      const { name, unit = "portion", low_stock_threshold = 0 } = req.body || {};
      const cleanName = typeof name === "string" ? name.trim().slice(0, 120) : "";
      const cleanUnit = typeof unit === "string" ? unit.trim().slice(0, 30) : "";
      const threshold = Number(low_stock_threshold);
      if (!cleanName) return res.status(400).json({ success: false, message: "Nama produk wajib diisi" });
      if (!cleanUnit) return res.status(400).json({ success: false, message: "Satuan produk wajib diisi" });
      if (!Number.isFinite(threshold) || threshold < 0) {
        return res.status(400).json({ success: false, message: "Batas minimum stok harus berupa angka 0 atau lebih" });
      }
      const baseCode = makeCode(cleanName);
      if (!baseCode) return res.status(400).json({ success: false, message: "Nama produk tidak dapat dijadikan kode" });
      const code = `${baseCode}_${Date.now().toString(36).toUpperCase()}`.slice(0, 50);
      const inserted = await sql`
        INSERT INTO stock_products (code, name, unit, low_stock_threshold, sort_order)
        VALUES (${code}, ${cleanName}, ${cleanUnit}, ${threshold},
          COALESCE((SELECT MAX(sort_order) + 1 FROM stock_products), 1))
        RETURNING id, code, name, unit, low_stock_threshold, is_active, sort_order, created_at, updated_at
      `;
      return res.status(201).json({ success: true, message: "Produk berhasil ditambahkan", product: inserted[0] });
    }

    if (req.method === "PATCH") {
      const { id, name, unit, low_stock_threshold, is_active } = req.body || {};
      if (!validId(id)) return res.status(400).json({ success: false, message: "ID produk tidak valid" });
      const current = await sql`SELECT id FROM stock_products WHERE id = ${id}`;
      if (!current.length) return res.status(404).json({ success: false, message: "Produk tidak ditemukan" });
      if (name !== undefined && (typeof name !== "string" || !name.trim())) {
        return res.status(400).json({ success: false, message: "Nama produk tidak boleh kosong" });
      }
      if (unit !== undefined && (typeof unit !== "string" || !unit.trim())) {
        return res.status(400).json({ success: false, message: "Satuan produk tidak boleh kosong" });
      }
      const threshold = low_stock_threshold === undefined ? null : Number(low_stock_threshold);
      if (threshold !== null && (!Number.isFinite(threshold) || threshold < 0)) {
        return res.status(400).json({ success: false, message: "Batas minimum stok harus berupa angka 0 atau lebih" });
      }
      if (is_active !== undefined && typeof is_active !== "boolean") {
        return res.status(400).json({ success: false, message: "Status produk tidak valid" });
      }
      const updated = await sql`
        UPDATE stock_products SET
          name = COALESCE(${name === undefined ? null : name.trim().slice(0, 120)}, name),
          unit = COALESCE(${unit === undefined ? null : unit.trim().slice(0, 30)}, unit),
          low_stock_threshold = COALESCE(${threshold}, low_stock_threshold),
          is_active = COALESCE(${is_active === undefined ? null : is_active}, is_active),
          updated_at = NOW()
        WHERE id = ${id}
        RETURNING id, code, name, unit, low_stock_threshold, is_active, sort_order, created_at, updated_at
      `;
      return res.status(200).json({ success: true, message: "Produk berhasil diperbarui", product: updated[0] });
    }

    if (req.method === "DELETE") {
      const id = req.query.id;
      if (!validId(id)) return res.status(400).json({ success: false, message: "ID produk tidak valid" });
      const updated = await sql`
        UPDATE stock_products SET is_active = FALSE, updated_at = NOW()
        WHERE id = ${id} AND is_active = TRUE RETURNING id, name
      `;
      if (!updated.length) {
        const exists = await sql`SELECT id FROM stock_products WHERE id = ${id}`;
        return res.status(exists.length ? 409 : 404).json({ success: false,
          message: exists.length ? "Produk sudah diarsipkan" : "Produk tidak ditemukan" });
      }
      return res.status(200).json({ success: true, message: `Produk ${updated[0].name} berhasil diarsipkan` });
    }

    res.setHeader("Allow", "GET, POST, PATCH, DELETE");
    return res.status(405).json({ success: false, message: "Method not allowed" });
  } catch (error) {
    console.error("Stock products API:", error);
    if (error.code === "23505") return res.status(409).json({ success: false, message: "Nama produk atau kode produk sudah digunakan" });
    return res.status(500).json({ success: false, message: "Gagal memproses produk. Periksa koneksi database dan struktur tabel." });
  }
}
