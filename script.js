const input=document.getElementById("messageInput");
const send=document.getElementById("sendBtn");
const chat=document.querySelector(".chat");

async function sendMessage(){
    const message=input.value.trim();
    if(!message)return;

    const user=document.createElement("div");
    user.className="message";
    user.innerHTML=`<strong>YOU</strong><p>${message}</p>`;
    chat.appendChild(user);

    input.value="";
    send.disabled=true;

    const loading=document.createElement("div");
    loading.className="message ai";
    loading.innerHTML=`<strong>NEX AI</strong><p>Thinking...</p>`;
    chat.appendChild(loading);

    try{
        const response=await fetch("/api/chat",{
            method:"POST",
            headers:{"Content-Type":"application/json"},
            body:JSON.stringify({message})
        });

        const data=await response.json();

        if(!response.ok){
            throw new Error(data.error||"Request gagal");
        }

        loading.innerHTML=`
            <strong>NEX AI</strong>
            <p>${data.reply}</p>
        `;
    }catch(error){
        console.error(error);

        loading.innerHTML=`
            <strong>NEX AI</strong>
            <p>Maaf, terjadi kesalahan saat menghubungi AI.</p>
        `;
    }

    send.disabled=false;
    input.focus();
}

send.onclick=sendMessage;

input.addEventListener("keydown",e=>{
    if(e.key==="Enter")sendMessage();
});
