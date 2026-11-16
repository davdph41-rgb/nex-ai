
import { neon } from "@neondatabase/serverless";

function getDatabase() {
    if (!process.env.DATABASE_URL) {
        throw new Error("DATABASE_URL belum ditemukan");
    }

    return neon(process.env.DATABASE_URL);
}

// ==========================
// GET MEMORIES
// ==========================

export async function getMemories() {
    const sql = getDatabase();

    const memories = await sql`
        SELECT id, content, category, created_at, updated_at
        FROM memories
        ORDER BY updated_at DESC
        LIMIT 50
    `;

    return {
        success: true,
        total: memories.length,
        memories
    };
}

// ==========================
// SAVE MEMORY
// ==========================

export async function saveMemory(args) {
    const sql = getDatabase();

    const content = args.content?.trim();
    const category = args.category?.trim() || "general";

    if (!content) {
        throw new Error("Isi Memory tidak boleh kosong");
    }

    if (content.length > 1000) {
        throw new Error("Memory maksimal 1000 karakter");
    }

    const result = await sql`
        INSERT INTO memories (content, category)
        VALUES (${content}, ${category.slice(0, 100)})
        RETURNING id, content, category, created_at
    `;

    return {
        success: true,
        message: "Memory berhasil disimpan",
        memory: result[0]
    };
}

// ==========================
// DELETE MEMORY
// ==========================

export async function deleteMemory(args) {
    const sql = getDatabase();

    const id = String(args.id || "");

    if (!/^\d+$/.test(id)) {
        throw new Error("ID Memory tidak valid");
    }

    const result = await sql`
        DELETE FROM memories
        WHERE id = ${id}
        RETURNING id
    `;

    if (result.length === 0) {
        return {
            success: false,
            message: "Memory tidak ditemukan"
        };
    }

    return {
        success: true,
        message: "Memory berhasil dihapus",
        id: result[0].id
    };
}
