const input=document.getElementById("messageInput");
const send=document.getElementById("sendBtn");
const chat=document.getElementById("chat");

async function sendMessage(){
    const message=input.value.trim();
    if(!message)return;

    document.querySelector(".suggestions")?.remove();

    const user=document.createElement("div");
    user.className="message user";
    user.innerHTML=`
        <strong>YOU</strong>
        <p>${escapeHTML(message)}</p>
    `;
    chat.appendChild(user);

    input.value="";
    send.disabled=true;

    const loading=document.createElement("div");
    loading.className="message ai";
    loading.innerHTML=`
        <strong>NEX AI</strong>
        <p>Thinking...</p>
    `;
    chat.appendChild(loading);

    try{
        const response=await fetch("/api/chat",{
            method:"POST",
            headers:{
                "Content-Type":"application/json"
            },
            body:JSON.stringify({message})
        });

        const data=await response.json();

        if(!response.ok){
            const detail=
                data?.details?.error?.message ||
                data?.details?.message ||
                data?.message ||
                data?.error ||
                "Unknown error";

            throw new Error(detail);
        }

        loading.innerHTML=`
            <strong>NEX AI</strong>
            <p>${escapeHTML(data.reply)}</p>
        `;

    }catch(error){

        console.error(error);

        loading.innerHTML=`
            <strong>NEX AI ERROR</strong>
            <p>${escapeHTML(error.message)}</p>
        `;
    }

    send.disabled=false;
    input.focus();
    chat.scrollTop=chat.scrollHeight;
}

function escapeHTML(text){
    const div=document.createElement("div");
    div.textContent=String(text);
    return div.innerHTML;
}

function quickMessage(message){
    input.value=message;
    sendMessage();
}

send.onclick=sendMessage;

input.addEventListener("keydown",e=>{
    if(e.key==="Enter")sendMessage();
});
