const input=document.getElementById("messageInput");
const send=document.getElementById("sendBtn");
const chat=document.getElementById("chat");

let conversation=JSON.parse(localStorage.getItem("nexConversation")||"[]");

async function sendMessage(){
    const message=input.value.trim();
    if(!message)return;

    document.querySelector(".suggestions")?.remove();

    addMessage("YOU",message,"user");

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
            body:JSON.stringify({
                message,
                history:conversation
            })
        });

        const text=await response.text();

        let data;
        try{
            data=JSON.parse(text);
        }catch{
            throw new Error(`Server error (${response.status})`);
        }

        if(!response.ok){
            throw new Error(
                data?.details?.error?.message||
                data?.message||
                data?.error||
                "Request gagal"
            );
        }

        if(!data.reply){
            throw new Error("Jawaban AI kosong.");
        }

        loading.innerHTML=`
            <strong>NEX AI</strong>
            <p>${escapeHTML(data.reply)}</p>
        `;

        conversation.push({
            role:"user",
            parts:[{text:message}]
        });

        conversation.push({
            role:"model",
            parts:[{text:data.reply}]
        });

        localStorage.setItem(
            "nexConversation",
            JSON.stringify(conversation)
        );

    }catch(error){
        loading.innerHTML=`
            <strong>NEX AI ERROR</strong>
            <p>${escapeHTML(error.message)}</p>
        `;
    }

    send.disabled=false;
    input.focus();
    chat.scrollTop=chat.scrollHeight;
}

function addMessage(name,text,type){
    const message=document.createElement("div");
    message.className=`message ${type}`;

    message.innerHTML=`
        <strong>${name}</strong>
        <p>${escapeHTML(text)}</p>
    `;

    chat.appendChild(message);
}

function quickMessage(message){
    input.value=message;
    sendMessage();
}

function escapeHTML(text){
    const div=document.createElement("div");
    div.textContent=String(text);
    return div.innerHTML;
}

send.onclick=sendMessage;

input.addEventListener("keydown",e=>{
    if(e.key==="Enter")sendMessage();
});
