export default async function handler(req,res){
    if(req.method!=="POST"){
        return res.status(405).json({error:"Method not allowed"});
    }

    try{
        const {message}=req.body||{};
        const key=process.env.GEMINI_API_KEY;

        if(!message){
            return res.status(400).json({error:"Message kosong"});
        }

        if(!key){
            return res.status(500).json({
                error:"GEMINI_API_KEY tidak ditemukan"
            });
        }

        const response=await fetch(
            "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent",
            {
                method:"POST",
                headers:{
                    "Content-Type":"application/json",
                    "x-goog-api-key":key
                },
                body:JSON.stringify({
                    contents:[
                        {
                            parts:[
                                {
                                    text:
                                    "Kamu adalah NEX AI, asisten AI pribadi yang ramah dan singkat. Jawab dalam bahasa Indonesia.\n\n"+
                                    message
                                }
                            ]
                        }
                    ]
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
