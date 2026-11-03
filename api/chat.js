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

        /*
        =========================
        WEATHER + LOCATION TOOL
        =========================
        */

        const weatherWords=[
            "cuaca",
            "weather",
            "suhu",
            "temperatur",
            "hujan",
            "kelembapan",
            "angin"
        ];

        const wantsWeather=weatherWords.some(word=>
            message.toLowerCase().includes(word)
        );

        if(wantsWeather){

            /*
            Cari nama lokasi dari kalimat user.
            Contoh:
            "cuaca di Jakarta"
            "suhu Bandung"
            */

            let city="Surakarta";

            const match=message.match(
                /(?:di|kota|wilayah)\s+([a-zA-ZÀ-ÿ\s-]+)/i
            );

            if(match){
                city=match[1]
                    .trim()
                    .replace(/[?.!,]+$/,"");
            }

            /*
            LOCATION TOOL
            */

            const locationResponse=await fetch(
                `https://geocoding-api.open-meteo.com/v1/search`+
                `?name=${encodeURIComponent(city)}`+
                `&count=1`+
                `&language=id`+
                `&format=json`
            );

            const locationData=await locationResponse.json();

            const location=locationData?.results?.[0];

            if(location){

                /*
                WEATHER TOOL
                */

                const weatherResponse=await fetch(
                    `https://api.open-meteo.com/v1/forecast`+
                    `?latitude=${location.latitude}`+
                    `&longitude=${location.longitude}`+
                    `&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m`+
                    `&timezone=auto`
                );

                const weather=await weatherResponse.json();

                if(weatherResponse.ok&&weather.current){

                    weatherContext=`
DATA CUACA TERKINI:

Lokasi: ${location.name}, ${location.country}

Latitude: ${location.latitude}
Longitude: ${location.longitude}

Suhu: ${weather.current.temperature_2m}°C
Terasa seperti: ${weather.current.apparent_temperature}°C
Kelembapan: ${weather.current.relative_humidity_2m}%
Curah hujan: ${weather.current.precipitation} mm
Kecepatan angin: ${weather.current.wind_speed_10m} km/j
Weather code: ${weather.current.weather_code}
Zona waktu: ${weather.timezone}

Gunakan data ini untuk menjawab pertanyaan pengguna.
Jangan mengarang data cuaca.
`;
                }
            }
        }

        /*
        =========================
        GEMINI
        =========================
        */

        const contents=[
            ...history,
            {
                role:"user",
                parts:[{
                    text:
                    weatherContext+
                    "\n\nPERTANYAAN USER:\n"+
                    message
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
                            "Kamu adalah NEX AI, asisten AI pribadi yang ramah, "+
                            "cerdas dan singkat. Jawab dalam bahasa Indonesia. "+
                            "Gunakan konteks percakapan sebelumnya. "+
                            "Jika diberikan DATA CUACA TERKINI, gunakan data tersebut "+
                            "dan jangan mengarang informasi."
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
            return res.status(500).json({
                error:"Gemini tidak memberikan jawaban"
            });
        }

        return res.status(200).json({
            reply
        });

    }catch(error){

        console.error(error);

        return res.status(500).json({
            error:"Server error",
            message:error.message
        });
    }
}
