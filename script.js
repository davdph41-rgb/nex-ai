const input=document.getElementById("messageInput");
const send=document.getElementById("sendBtn");
const chat=document.getElementById("chat");

async function sendMessage(){

    const message=input.value.trim();

    if(!message)return;

    const suggestions=document.querySelector(".suggestions");

    if(suggestions){
        suggestions.remove();
    }

    const userMessage=document.createElement("div");

    userMessage.className="message user";

    userMessage.innerHTML=`
        <strong>YOU</strong>
        <p>${escapeHTML(message)}</p>
    `;

    chat.appendChild(userMessage);

    input.value="";
    send.disabled=true;

    const loading=document.createElement("div");

    loading.className="message ai";

    loading.innerHTML=`
        <strong>NEX AI</strong>
        <p>Thinking...</p>
    `;

    chat.appendChild(loading);

    chat.scrollTop=chat.scrollHeight;

    try{

        const response=await fetch("/api/chat",{
            method:"POST",
            headers:{
                "Content-Type":"application/json"
            },
            body:JSON.stringify({
                message:message
            })
        });

        const data=await response.json();

        if(!response.ok){
            throw new Error(data.error||"Request gagal");
        }

        loading.innerHTML=`
            <strong>NEX AI</strong>
            <p>${escapeHTML(data.reply)}</p>
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

    chat.scrollTop=chat.scrollHeight;
}

function quickMessage(message){

    input.value=message;

    sendMessage();
}

function escapeHTML(text){

    const div=document.createElement("div");

    div.textContent=text;

    return div.innerHTML;
}

send.addEventListener("click",sendMessage);

input.addEventListener("keydown",e=>{

    if(e.key==="Enter"){
        sendMessage();
    }

});
