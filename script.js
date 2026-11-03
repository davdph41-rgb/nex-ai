const input=document.getElementById("messageInput");
const send=document.getElementById("sendBtn");

send.onclick=()=>{
    if(input.value.trim()){
        alert("AI belum terhubung. Kita sambungkan di STEP 3!");
        input.value="";
    }
};

input.addEventListener("keydown",e=>{
    if(e.key==="Enter")send.click();
});
