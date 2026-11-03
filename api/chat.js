
import {
    toolDeclarations,
    executeTool
} from "../tools/index.js";

export default async function handler(req, res) {

    if (req.method !== "POST") {
        return res.status(405).json({
            error: "Method not allowed"
        });
    }

    try {
        const { message, history = [] } = req.body || {};
        const key = process.env.GEMINI_API_KEY;

        if (!message) {
            return res.status(400).json({
                error: "Message kosong"
            });
        }

        if (!key) {
            return res.status(500).json({
                error: "GEMINI_API_KEY tidak ditemukan"
            });
        }

        const model = "gemini-3.5-flash-lite";

        const apiURL =
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

        const systemInstruction = {
            parts: [{
                text:
                    "Kamu adalah NEX AI, asisten AI pribadi. " +
                    "Jawab menggunakan bahasa Indonesia yang ramah dan jelas. " +
                    "Gunakan riwayat percakapan. " +
                    "Gunakan get_weather untuk informasi cuaca terkini. " +
                    "Gunakan search_github untuk mencari repositori GitHub. " +
                    "Jangan mengarang hasil dari tool."
            }]
        };

        const tools = [{
            functionDeclarations: toolDeclarations
        }];

        async function askGemini(contents) {
            const response = await fetch(apiURL, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-goog-api-key": key
                },
                body: JSON.stringify({
                    systemInstruction,
                    contents,
                    tools
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.error?.message || "Gemini API error"
                );
            }

            return data;
        }

        // Percakapan awal
        let contents = [
            ...history,
            {
                role: "user",
                parts: [{ text: message }]
            }
        ];

        // Maksimal 5 putaran pemanggilan tool
        for (let step = 0; step < 5; step++) {

            const data = await askGemini(contents);

            const candidate = data.candidates?.[0];
            const modelContent = candidate?.content;

            if (!modelContent) {
                throw new Error(
                    "Gemini tidak mengembalikan content. " +
                    "Finish reason: " +
                    (candidate?.finishReason || "unknown")
                );
            }

            const parts = modelContent.parts || [];

            const functionCalls = parts
                .filter(part => part.functionCall)
                .map(part => part.functionCall);

            // Tidak ada tool yang perlu dijalankan
            if (functionCalls.length === 0) {

                const reply = parts
                    .filter(part => part.text)
                    .map(part => part.text)
                    .join("\n");

                if (reply.trim()) {
                    return res.status(200).json({ reply });
                }

                throw new Error(
                    "Gemini menghasilkan respons tanpa teks. " +
                    "Finish reason: " +
                    (candidate.finishReason || "unknown")
                );
            }

            // Simpan respons model, termasuk function call
            contents.push(modelContent);

            // Jalankan seluruh tool yang diminta
            const functionResponses = [];

            for (const call of functionCalls) {

                try {
                    const result = await executeTool(
                        call.name,
                        call.args || {}
                    );

                    functionResponses.push({
                        functionResponse: {
                            name: call.name,
                            response: { result },
                            ...(call.id ? { id: call.id } : {})
                        }
                    });

                } catch (error) {

                    functionResponses.push({
                        functionResponse: {
                            name: call.name,
                            response: {
                                error: error.message
                            },
                            ...(call.id ? { id: call.id } : {})
                        }
                    });
                }
            }

            // Kirim hasil tool kembali ke Gemini
            contents.push({
                role: "user",
                parts: functionResponses
            });
        }

        return res.status(200).json({
            reply: "Maaf, proses permintaan membutuhkan terlalu banyak pemanggilan tool. Coba sederhanakan pertanyaanmu."
        });

    } catch (error) {

        console.error("NEX AI ERROR:", error);

        return res.status(500).json({
            error: "Server error",
            message: error.message
        });
    }
}
