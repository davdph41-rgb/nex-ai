import { getWeather } from "./weather.js";

export const toolDeclarations = [
    {
        name: "get_weather",
        description: "Mengambil informasi cuaca terkini berdasarkan nama kota atau kabupaten di Indonesia.",
        parameters: {
            type: "object",
            properties: {
                city: {
                    type: "string",
                    description: "Nama kota atau kabupaten di Indonesia"
                }
            },
            required: ["city"]
        }
    }
];

export async function executeTool(name, args) {
    switch (name) {
        case "get_weather":
            return await getWeather(args);

        default:
            throw new Error(`Tool tidak dikenal: ${name}`);
    }
}
