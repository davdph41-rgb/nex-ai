export default async function handler(req,res){
    if(req.method!=="POST"){
        return res.status(405).json({error:"Method not allowed"});
    }

    try{
        const {message}=req.body||{};

        if(!message){
            return res.status(400).json({error:"Message kosong"});
        }

        const apiKey=process.env.GEMINI_API_KEY;

        if(!apiKey){
            return res.status(500).json({
                error:"GEMINI_API_KEY belum terbaca di Vercel"
            });
        }

        const response=await fetch(
            "https://generativelanguage.googleapis.com/v1/interactions",
            {
                method:"POST",
                headers:{
                    "Content-Type":"application/json",
                    "x-goog-api-key":apiKey
                },
                body:JSON.stringify({
                    model:"gemini-3.8-flash",
                    input:
                        "Kamu adalah NEX AI, asisten AI pribadi yang ramah, pintar, dan membantu. Jawab dalam bahasa Indonesia.\n\nUser: "+
                        message
                })
            }
        );

        const data=await response.json();

        if(!response.ok){
            console.error("GEMINI ERROR:",data);

            return res.status(response.status).json({
                error:"Gemini API error",
                details:data
            });
        }

        const reply=
            data?.steps
                ?.filter(step=>step.type==="model_output")
                ?.flatMap(step=>step.content||[])
                ?.find(item=>item.type==="text")
                ?.text;

        if(!reply){
            return res.status(500).json({
                error:"Gemini tidak mengembalikan jawaban",
                details:data
            });
        }

        return res.status(200).json({
            reply:reply
        });

    }catch(error){

        console.error("SERVER ERROR:",error);

        return res.status(500).json({
            error:"Server error",
            message:error?.message||String(error)
        });
    }
}
