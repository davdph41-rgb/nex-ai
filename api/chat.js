export default async function handler(req,res){
    if(req.method!=="POST"){
        return res.status(405).json({error:"Method not allowed"});
    }

    try{
        const {message,history=[]}=req.body||{};
        const key=process.env.GEMINI_API_KEY;

        if(!message){
            return res.status(400).json({error:"Message kosong"});
        }

        if(!key){
            return res.status(500).json({
                error:"GEMINI_API_KEY tidak ditemukan"
            });
        }

        let weatherContext="";

        const weatherWords=[
            "cuaca","weather","suhu","temperatur",
            "hujan","kelembapan","angin"
        ];

        const wantsWeather=weatherWords.some(word=>
            message.toLowerCase().includes(word)
        );

        if(wantsWeather){

            const match=message.match(
    /(?:di|kota|wilayah)\s+(.+?)(?:\?|!|\.|,|$)/i
);

let city=match?.[1]?.trim()||"Surakarta";

city=city.replace(
    /\s+(sekarang|saat ini|hari ini|dong|ya|deh)$/i,
    ""
).trim();

            const locationResponse=await fetch(
                `https://geocoding-api.open-meteo.com/v1/search`+
                `?name=${encodeURIComponent(city)}`+
                `&count=10&language=id&format=json`
            );

            const locationData=await locationResponse.json();

            const results=locationData.results||[];

            const location=
                results.find(item=>item.country_code==="ID")||
                results.find(item=>item.country==="Indonesia");

            if(!location){
                return res.status(200).json({
                    reply:`Maaf, aku belum menemukan lokasi "${city}". Bisa sebutkan nama kota atau kabupatennya dengan lebih lengkap?`
                });
            }

            const weatherResponse=await fetch(
                `https://api.open-meteo.com/v1/forecast`+
                `?latitude=${location.latitude}`+
                `&longitude=${location.longitude}`+
                `&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m`+
                `&timezone=auto`
            );

            const weather=await weatherResponse.json();

            if(!weatherResponse.ok||!weather.current){
                throw new Error("Data cuaca tidak tersedia");
            }

            weatherContext=`
DATA CUACA TERKINI:
Lokasi: ${location.name}, ${location.country}
Suhu: ${weather.current.temperature_2m}°C
Terasa: ${weather.current.apparent_temperature}°C
Kelembapan: ${weather.current.relative_humidity_2m}%
Hujan: ${weather.current.precipitation} mm
Angin: ${weather.current.wind_speed_10m} km/jam
Weather code: ${weather.current.weather_code}
Waktu data: ${weather.current.time}
Zona waktu: ${weather.timezone}

Gunakan data ini secara akurat.
`;
        }

        const contents=[
            ...history,
            {
                role:"user",
                parts:[{
                    text:weatherContext+
                    "\n\nPERTANYAAN USER:\n"+message
                }]
            }
        ];

        const response=await fetch(
            "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent",
            {
                method:"POST",
                headers:{
                    "Content-Type":"application/json",
                    "x-goog-api-key":key
                },
                body:JSON.stringify({
                    systemInstruction:{
                        parts:[{
                            text:
                            "Kamu adalah NEX AI, asisten AI pribadi. "+
                            "Jawab dalam bahasa Indonesia dengan ramah. "+
                            "Gunakan riwayat percakapan. "+
                            "Jangan pernah mengarang data cuaca."
                        }]
                    },
                    contents
                })
            }
        );

        const data=await response.json();

        if(!response.ok){
            return res.status(response.status).json({
                error:"Gemini API error",
                details:data
            });
        }

        const reply=
            data?.candidates?.[0]?.content?.parts?.[0]?.text;

        if(!reply){
            throw new Error("Jawaban Gemini kosong");
        }

        return res.status(200).json({reply});

    }catch(error){
        console.error(error);

        return res.status(500).json({
            error:"Server error",
            message:error.message
        });
    }
}
