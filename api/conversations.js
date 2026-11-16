
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
    // GET: Mengambil daftar percakapan
    if (req.method === "GET") {
      const conversations = await sql`
        SELECT
          id,
          title,
          created_at,
          updated_at
        FROM conversations
        ORDER BY updated_at DESC
      `;

      return res.status(200).json({
        success: true,
        total: conversations.length,
        conversations
      });
    }

    // POST: Membuat percakapan baru
    if (req.method === "POST") {
      const title =
        typeof req.body?.title === "string" &&
        req.body.title.trim()
          ? req.body.title.trim().slice(0, 255)
          : "Chat Baru";

      const result = await sql`
        INSERT INTO conversations (title)
        VALUES (${title})
        RETURNING id, title, created_at, updated_at
      `;

      return res.status(201).json({
        success: true,
        message: "Chat berhasil dibuat",
        conversation: result[0]
      });
    }

    // DELETE: Menghapus percakapan
    if (req.method === "DELETE") {
      const id = req.query.id;

      if (!id || !/^\d+$/.test(String(id))) {
        return res.status(400).json({
          success: false,
          message: "ID percakapan tidak valid"
        });
      }

      const result = await sql`
        DELETE FROM conversations
        WHERE id = ${id}
        RETURNING id
      `;

      if (result.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Percakapan tidak ditemukan"
        });
      }

      return res.status(200).json({
        success: true,
        message: "Percakapan berhasil dihapus"
      });
    }

    return res.status(405).json({
      success: false,
      message: "Method tidak diizinkan"
    });

  } catch (error) {
    console.error("Conversations API error:", error);

    return res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server"
    });
  }
}
