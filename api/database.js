
import { neon } from "@neondatabase/serverless";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  try {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL belum tersedia");
    }

    const sql = neon(process.env.DATABASE_URL);

    const result = await sql`
      SELECT
        table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name IN ('conversations', 'messages')
      ORDER BY table_name
    `;

    return res.status(200).json({
      success: true,
      tables: result
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      error: "Database connection failed"
    });
  }
}
