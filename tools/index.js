import { getWeather } from "./weather.js";
import { searchGitHub } from "./github.js";

export const toolDeclarations = [

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
    }

];

export async function executeTool(name, args) {

    switch (name) {

        case "get_weather":
            return await getWeather(args);

        case "search_github":
            return await searchGitHub(args);

        default:
            throw new Error(`Tool tidak dikenal: ${name}`);
    }
}
