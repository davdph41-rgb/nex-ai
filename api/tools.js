const tools={
    weather:{
        name:"weather",
        description:"Mengambil informasi cuaca berdasarkan lokasi."
    },

    github:{
        name:"github",
        description:"Mencari informasi repositori GitHub."
    },

    projects:{
        name:"projects",
        description:"Mengakses informasi proyek pengguna."
    }
};

export default async function handler(req,res){

    if(req.method!=="GET"){
        return res.status(405).json({
            error:"Method not allowed"
        });
    }

    return res.status(200).json({
        status:"online",
        name:"NEX AI TOOL ROUTER",
        availableTools:Object.keys(tools),
        tools
    });

}
