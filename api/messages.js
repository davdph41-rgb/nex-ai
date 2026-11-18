
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
    // GET: Mengambil pesan berdasarkan conversationId.
    if (req.method === "GET") {
      const conversationId = req.query.conversationId;

      if (!conversationId || !/^\d+$/.test(String(conversationId))) {
        return res.status(400).json({
          success: false,
          message: "conversationId tidak valid"
        });
      }

      const messages = await sql`
        SELECT id, conversation_id, role, content, created_at
        FROM messages
        WHERE conversation_id = ${conversationId}
        ORDER BY created_at ASC, id ASC
      `;

      return res.status(200).json({
        success: true,
        total: messages.length,
        messages
      });
    }

    // POST: Menyimpan pesan baru.
    if (req.method === "POST") {
      const { conversationId, role, content } = req.body || {};

      if (
        !conversationId ||
        !/^\d+$/.test(String(conversationId)) ||
        !["user", "model"].includes(role) ||
        typeof content !== "string" ||
        !content.trim()
      ) {
        return res.status(400).json({
          success: false,
          message: "Data pesan tidak valid"
        });
      }

      const conversation = await sql`
        SELECT id FROM conversations
        WHERE id = ${conversationId}
      `;

      if (conversation.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Percakapan tidak ditemukan"
        });
      }

      const result = await sql`
        INSERT INTO messages (
          conversation_id,
          role,
          content
        )
        VALUES (
          ${conversationId},
          ${role},
          ${content.trim()}
        )
        RETURNING id, conversation_id, role, content, created_at
      `;

      await sql`
        UPDATE conversations
        SET updated_at = NOW()
        WHERE id = ${conversationId}
      `;

      return res.status(201).json({
        success: true,
        message: "Pesan berhasil disimpan",
        data: result[0]
      });
    }

    // PATCH: Edit pesan pengguna atau potong percakapan untuk regenerate.
    if (req.method === "PATCH") {
      const { id, content, action } = req.body || {};

      if (!id || !/^\d+$/.test(String(id))) {
        return res.status(400).json({
          success: false,
          message: "ID pesan tidak valid"
        });
      }

      const targetRows = await sql`
        SELECT id, conversation_id, role, created_at
        FROM messages
        WHERE id = ${id}
      `;

      if (!targetRows.length) {
        return res.status(404).json({
          success: false,
          message: "Pesan tidak ditemukan"
        });
      }

      const target = targetRows[0];

      if (target.role !== "user") {
        return res.status(400).json({
          success: false,
          message: "Hanya pesan pengguna yang dapat diproses"
        });
      }

      if (action === "edit") {
        if (typeof content !== "string" || !content.trim()) {
          return res.status(400).json({
            success: false,
            message: "Isi pesan tidak boleh kosong"
          });
        }

        await sql`
          UPDATE messages
          SET content = ${content.trim().slice(0, 20000)}
          WHERE id = ${id}
        `;

      } else if (action !== "truncateAfter") {
        return res.status(400).json({
          success: false,
          message: "Aksi tidak valid"
        });
      }

      await sql`
        DELETE FROM messages
        WHERE conversation_id = ${target.conversation_id}
          AND (
            created_at > ${target.created_at}
            OR (
              created_at = ${target.created_at}
              AND id > ${id}
            )
          )
      `;

      await sql`
        UPDATE conversations
        SET updated_at = NOW()
        WHERE id = ${target.conversation_id}
      `;

      return res.status(200).json({
        success: true,
        message: "Percakapan diperbarui"
      });
    }

    return res.status(405).json({
      success: false,
      message: "Method tidak diizinkan"
    });

  } catch (error) {
    console.error("Messages API error:", error);

    return res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server"
    });
  }
}
