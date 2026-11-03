export async function getWeather({city}){

    if(!city){
        throw new Error("Nama kota diperlukan");
    }

    const locationURL=
        "https://geocoding-api.open-meteo.com/v1/search"+
        `?name=${encodeURIComponent(city)}`+
        "&count=10&language=id&format=json";

    const locationResponse=await fetch(locationURL);
    const locationData=await locationResponse.json();

    const location=locationData.results?.find(
        item=>item.country_code==="ID"
    );

    if(!location){
        throw new Error("Lokasi tidak ditemukan");
    }

    const weatherURL=
        "https://api.open-meteo.com/v1/forecast"+
        `?latitude=${location.latitude}`+
        `&longitude=${location.longitude}`+
        "&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m"+
        "&timezone=auto";

    const weatherResponse=await fetch(weatherURL);
    const weatherData=await weatherResponse.json();

    if(!weatherResponse.ok){
        throw new Error("Gagal mengambil data cuaca");
    }

    return {
        location:location.name,
        country:location.country,
        current:weatherData.current,
        timezone:weatherData.timezone
    };
}
