export default async function handler(req,res){
    try{
        if(req.method!=="POST"){
            return res.status(405).json({
                error:"Method not allowed"
            });
        }

        const message=req.body?.message;

        if(!message){
            return res.status(400).json({
                error:"Message kosong"
            });
        }

        const key=process.env.GEMINI_API_KEY;

        if(!key){
            return res.status(500).json({
                error:"GEMINI_API_KEY tidak ditemukan"
            });
        }

        const url=
            "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key="+
            encodeURIComponent(key);

        const result=await fetch(url,{
            method:"POST",
            headers:{
                "Content-Type":"application/json"
            },
            body:JSON.stringify({
                contents:[
                    {
                        parts:[
                            {
                                text:
                                "Kamu adalah NEX AI, asisten AI pribadi. Jawab dalam bahasa Indonesia dengan jelas dan ramah.\n\n"+
                                "User: "+message
                            }
                        ]
                    }
                ]
            })
        });

        const text=await result.text();

        let data;

        try{
            data=JSON.parse(text);
        }catch{
            return res.status(500).json({
                error:"Gemini mengirim response yang tidak valid",
                raw:text
            });
        }

        if(!result.ok){
            return res.status(result.status).json({
                error:"Gemini API error",
                details:data
            });
        }

        const reply=
            data?.candidates?.[0]?.content?.parts?.[0]?.text;

        if(!reply){
            return res.status(500).json({
                error:"Jawaban Gemini kosong",
                details:data
            });
        }

        return res.status(200).json({
            reply
        });

    }catch(error){

        console.error("NEX ERROR:",error);

        return res.status(500).json({
            error:"NEX backend error",
            message:error?.message||"Unknown error"
        });
    }
}
