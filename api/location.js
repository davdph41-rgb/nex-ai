export default async function handler(req,res){
    if(req.method!=="GET"){
        return res.status(405).json({
            error:"Method not allowed"
        });
    }

    try{
        const city=req.query.city;

        if(!city){
            return res.status(400).json({
                error:"Nama kota diperlukan"
            });
        }

        const url=
            `https://geocoding-api.open-meteo.com/v1/search`+
            `?name=${encodeURIComponent(city)}`+
            `&count=1`+
            `&language=id`+
            `&format=json`;

        const response=await fetch(url);
        const data=await response.json();

        if(!response.ok){
            return res.status(response.status).json({
                error:"Geocoding API error",
                details:data
            });
        }

        const result=data?.results?.[0];

        if(!result){
            return res.status(404).json({
                error:"Lokasi tidak ditemukan"
            });
        }

        return res.status(200).json({
            name:result.name,
            country:result.country,
            latitude:result.latitude,
            longitude:result.longitude,
            timezone:result.timezone
        });

    }catch(error){
        console.error(error);

        return res.status(500).json({
            error:"Server error",
            message:error.message
        });
    }
}
