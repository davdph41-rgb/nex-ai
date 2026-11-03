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

        const model =
            "gemini-3.5-flash-lite";

        const apiURL =
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

        const systemInstruction = {
            parts: [{
                text:
                    "Kamu adalah NEX AI, asisten AI pribadi. " +
                    "Jawab menggunakan bahasa Indonesia yang ramah dan jelas. " +
                    "Gunakan riwayat percakapan. " +
                    "Gunakan tool get_weather jika pengguna meminta informasi cuaca terkini. " +
                    "Jangan mengarang data dari tool."
            }]
        };

        const tools = [{
            functionDeclarations: toolDeclarations
        }];

        const contents = [
            ...history,
            {
                role: "user",
                parts: [{ text: message }]
            }
        ];

        async function askGemini(chatContents) {

            const response = await fetch(apiURL, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-goog-api-key": key
                },
                body: JSON.stringify({
                    systemInstruction,
                    contents: chatContents,
                    tools
                })
            });

            const data = await response.json();

            if (!response.ok) {
                console.error("Gemini error:", data);

                throw new Error(
                    data.error?.message || "Gemini API error"
                );
            }

            return data;
        }

        // TAHAP 1: Gemini menentukan apakah tool diperlukan

        const firstData = await askGemini(contents);

        const candidate =
            firstData.candidates?.[0];

        const modelContent =
            candidate?.content;

        if (!modelContent) {
            throw new Error("Respons Gemini kosong");
        }

        const parts = modelContent.parts || [];

        const functionCalls = parts
            .filter(part => part.functionCall)
            .map(part => part.functionCall);

        // Jika tidak ada tool yang dipanggil

        if (functionCalls.length === 0) {

            const reply = parts
                .filter(part => part.text)
                .map(part => part.text)
                .join("\n");

            return res.status(200).json({
                reply
            });
        }

        // TAHAP 2: Backend menjalankan tool

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
                        response: {
                            result
                        },
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

        // TAHAP 3: Kirim hasil tool kembali ke Gemini

        const secondContents = [
            ...contents,
            modelContent,
            {
                role: "user",
                parts: functionResponses
            }
        ];

        const finalData =
            await askGemini(secondContents);

        const finalParts =
            finalData.candidates?.[0]?.content?.parts || [];

        const reply = finalParts
            .filter(part => part.text)
            .map(part => part.text)
            .join("\n");

        if (!reply) {
            throw new Error("Jawaban akhir Gemini kosong");
        }

        return res.status(200).json({
            reply
        });

    } catch (error) {

        console.error("NEX AI ERROR:", error);

        return res.status(500).json({
            error: "Server error",
            message: error.message
        });
    }
}
