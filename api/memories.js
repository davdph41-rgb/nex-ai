
import { neon } from "@neondatabase/serverless";

export default async function handler(req, res) {
  if (!process.env.DATABASE_URL) {
    return res.status(500).json({
      success: false,
      message: "DATABASE_URL belum ditemukan"
    });
  }

  const sql = neon(process.env.DATABASE_URL);

  try {
    // GET: Mengambil semua Memory
    if (req.method === "GET") {
      const memories = await sql`
        SELECT
          id,
          content,
          category,
          created_at,
          updated_at
        FROM memories
        ORDER BY updated_at DESC
      `;

      return res.status(200).json({
        success: true,
        total: memories.length,
        memories
      });
    }

    // POST: Menyimpan Memory baru
    if (req.method === "POST") {
      const { content, category } = req.body || {};

      if (
        typeof content !== "string" ||
        !content.trim()
      ) {
        return res.status(400).json({
          success: false,
          message: "Isi Memory tidak boleh kosong"
        });
      }

      const memoryContent = content.trim();
      const memoryCategory =
        typeof category === "string" && category.trim()
          ? category.trim().slice(0, 100)
          : "general";

      const result = await sql`
        INSERT INTO memories (content, category)
        VALUES (${memoryContent}, ${memoryCategory})
        RETURNING *
      `;

      return res.status(201).json({
        success: true,
        message: "Memory berhasil disimpan",
        memory: result[0]
      });
    }

    // PATCH: Mengubah Memory
    if (req.method === "PATCH") {
      const { id, content, category } = req.body || {};

      if (!id || !/^\d+$/.test(String(id))) {
        return res.status(400).json({
          success: false,
          message: "ID Memory tidak valid"
        });
      }

      if (
        typeof content !== "string" ||
        !content.trim()
      ) {
        return res.status(400).json({
          success: false,
          message: "Isi Memory tidak boleh kosong"
        });
      }

      const memoryCategory =
        typeof category === "string" && category.trim()
          ? category.trim().slice(0, 100)
          : "general";

      const result = await sql`
        UPDATE memories
        SET
          content = ${content.trim()},
          category = ${memoryCategory},
          updated_at = NOW()
        WHERE id = ${id}
        RETURNING *
      `;

      if (result.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Memory tidak ditemukan"
        });
      }

      return res.status(200).json({
        success: true,
        message: "Memory berhasil diperbarui",
        memory: result[0]
      });
    }

    // DELETE: Menghapus Memory
    if (req.method === "DELETE") {
      const id = req.query.id;

      if (!id || !/^\d+$/.test(String(id))) {
        return res.status(400).json({
          success: false,
          message: "ID Memory tidak valid"
        });
      }

      const result = await sql`
        DELETE FROM memories
        WHERE id = ${id}
        RETURNING id
      `;

      if (result.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Memory tidak ditemukan"
        });
      }

      return res.status(200).json({
        success: true,
        message: "Memory berhasil dihapus"
      });
    }

    return res.status(405).json({
      success: false,
      message: "Method tidak diizinkan"
    });

  } catch (error) {
    console.error("Memories API error:", error);

    return res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server"
    });
  }
}
