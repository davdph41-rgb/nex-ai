export default async function handler(req,res){
    if(req.method!=="GET"){
        return res.status(405).json({
            error:"Method not allowed"
        });
    }

    try{
        const lat=req.query.lat;
        const lon=req.query.lon;

        if(!lat||!lon){
            return res.status(400).json({
                error:"lat dan lon diperlukan"
            });
        }

        const url=
            `https://api.open-meteo.com/v1/forecast`+
            `?latitude=${encodeURIComponent(lat)}`+
            `&longitude=${encodeURIComponent(lon)}`+
            `&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m`+
            `&timezone=auto`;

        const response=await fetch(url);

        const data=await response.json();

        if(!response.ok){
            return res.status(response.status).json({
                error:"Weather API error",
                details:data
            });
        }

        return res.status(200).json({
            location:{
                latitude:Number(lat),
                longitude:Number(lon)
            },
            current:data.current,
            timezone:data.timezone
        });

    }catch(error){
        console.error(error);

        return res.status(500).json({
            error:"Server error",
            message:error.message
        });
    }
}
