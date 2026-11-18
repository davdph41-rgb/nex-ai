import { neon } from "@neondatabase/serverless";

function validId(value) {
  return /^\d+$/.test(String(value ?? ""));
}

function normalizeAlias(value) {
  return String(value).trim().toLocaleLowerCase("id-ID").replace(/\s+/g, " ");
}

export default async function handler(req, res) {
  if (!process.env.DATABASE_URL) {
    return res.status(500).json({ success: false, message: "DATABASE_URL belum ditemukan" });
  }
  const sql = neon(process.env.DATABASE_URL);

  try {
    if (req.method === "GET") {
      const productId = req.query.product_id;
      if (productId && !validId(productId)) {
        return res.status(400).json({ success: false, message: "ID produk tidak valid" });
      }
      const aliases = productId
        ? await sql`
            SELECT a.id, a.product_id, a.raw_alias, a.normalized_alias, a.created_at, p.name AS product_name
            FROM stock_product_aliases a JOIN stock_products p ON p.id = a.product_id
            WHERE a.product_id = ${productId} ORDER BY a.raw_alias
          `
        : await sql`
            SELECT a.id, a.product_id, a.raw_alias, a.normalized_alias, a.created_at, p.name AS product_name
            FROM stock_product_aliases a JOIN stock_products p ON p.id = a.product_id
            ORDER BY p.sort_order, a.raw_alias
          `;
      return res.status(200).json({ success: true, total: aliases.length, aliases });
    }

    if (req.method === "POST") {
      const { product_id, raw_alias } = req.body || {};
      const cleanAlias = typeof raw_alias === "string" ? raw_alias.trim().replace(/\s+/g, " ").slice(0, 180) : "";
      if (!validId(product_id)) return res.status(400).json({ success: false, message: "Pilih produk yang valid" });
      if (!cleanAlias) return res.status(400).json({ success: false, message: "Nama alias wajib diisi" });
      const product = await sql`SELECT id, name FROM stock_products WHERE id = ${product_id} AND is_active = TRUE`;
      if (!product.length) return res.status(404).json({ success: false, message: "Produk aktif tidak ditemukan" });
      const normalized = normalizeAlias(cleanAlias);
      const inserted = await sql`
        INSERT INTO stock_product_aliases (product_id, raw_alias, normalized_alias)
        VALUES (${product_id}, ${cleanAlias}, ${normalized})
        RETURNING id, product_id, raw_alias, normalized_alias, created_at
      `;
      return res.status(201).json({ success: true, message: "Alias berhasil ditambahkan", alias: inserted[0] });
    }

    if (req.method === "DELETE") {
      const id = req.query.id;
      if (!validId(id)) return res.status(400).json({ success: false, message: "ID alias tidak valid" });
      const deleted = await sql`
        DELETE FROM stock_product_aliases WHERE id = ${id}
        RETURNING id, raw_alias
      `;
      if (!deleted.length) return res.status(404).json({ success: false, message: "Alias tidak ditemukan" });
      return res.status(200).json({ success: true, message: `Alias ${deleted[0].raw_alias} berhasil dihapus` });
    }

    res.setHeader("Allow", "GET, POST, DELETE");
    return res.status(405).json({ success: false, message: "Method not allowed" });
  } catch (error) {
    console.error("Stock aliases API:", error);
    if (error.code === "23505") return res.status(409).json({ success: false, message: "Alias tersebut sudah digunakan oleh produk lain atau sudah terdaftar" });
    if (error.code === "23503") return res.status(400).json({ success: false, message: "Produk tidak ditemukan" });
    return res.status(500).json({ success: false, message: "Gagal memproses alias produk" });
  }
}
