
import { neon } from "@neondatabase/serverless";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({
      success: false,
      message: "Method tidak diizinkan"
    });
  }

  if (!process.env.DATABASE_URL) {
    return res.status(500).json({
      success: false,
      message: "DATABASE_URL belum ditemukan"
    });
  }

  try {
    const sql = neon(process.env.DATABASE_URL);

    const result = await sql`
      SELECT
        current_database() AS database,
        NOW() AS server_time
    `;

    return res.status(200).json({
      success: true,
      message: "Koneksi Neon berhasil!",
      database: result[0].database,
      serverTime: result[0].server_time
    });

  } catch (error) {
    console.error("Database error:", error);

    return res.status(500).json({
      success: false,
      message: "Gagal terhubung ke database Neon"
    });
  }
}
