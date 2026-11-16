
import { getWeather } from "./weather.js";
import { searchGitHub } from "./github.js";

import {
    getMemories,
    saveMemory,
    deleteMemory
} from "./memory.js";

export const toolDeclarations = [

    // WEATHER
    {
        name: "get_weather",
        description: "Mengambil informasi cuaca terkini berdasarkan nama kota.",
        parameters: {
            type: "object",
            properties: {
                city: {
                    type: "string",
                    description: "Nama kota atau kabupaten"
                }
            },
            required: ["city"]
        }
    },

    // GITHUB
    {
        name: "search_github",
        description: "Mencari repositori publik di GitHub berdasarkan kata kunci, nama proyek, atau teknologi.",
        parameters: {
            type: "object",
            properties: {
                query: {
                    type: "string",
                    description: "Kata kunci pencarian repositori GitHub"
                }
            },
            required: ["query"]
        }
    },

    // SAVE MEMORY
    {
        name: "save_memory",
        description: "Menyimpan informasi umum ke Memory NEX AI. Gunakan HANYA jika pengguna secara jelas meminta NEX AI untuk mengingat atau menyimpan informasi tersebut. Jangan simpan password, API key, kredensial, atau informasi pribadi sensitif.",
        parameters: {
            type: "object",
            properties: {
                content: {
                    type: "string",
                    description: "Informasi umum yang diminta pengguna untuk diingat"
                },
                category: {
                    type: "string",
                    description: "Kategori Memory, misalnya project, preference, atau general"
                }
            },
            required: ["content"]
        }
    },

    // GET MEMORIES
    {
        name: "get_memories",
        description: "Melihat daftar Memory yang sudah tersimpan. Gunakan ketika pengguna bertanya apa yang NEX AI ingat atau meminta melihat Memory.",
        parameters: {
            type: "object",
            properties: {},
            required: []
        }
    },

    // DELETE MEMORY
    {
        name: "delete_memory",
        description: "Menghapus Memory berdasarkan ID. Gunakan hanya jika pengguna secara jelas meminta menghapus Memory tertentu.",
        parameters: {
            type: "object",
            properties: {
                id: {
                    type: "string",
                    description: "ID Memory yang ingin dihapus"
                }
            },
            required: ["id"]
        }
    }

];

// ==========================
// EXECUTE TOOL
// ==========================

export async function executeTool(name, args) {

    switch (name) {

        case "get_weather":
            return await getWeather(args);

        case "search_github":
            return await searchGitHub(args);

        case "save_memory":
            return await saveMemory(args);

        case "get_memories":
            return await getMemories();

        case "delete_memory":
            return await deleteMemory(args);

        default:
            throw new Error(`Tool tidak dikenal: ${name}`);
    }
}
