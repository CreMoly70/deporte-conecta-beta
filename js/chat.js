// ============================
// Deporte Conecta — Chat Privado
// ============================

// Clave en localStorage
const CHAT_KEY = "dc_chats";

// Utils
function byId(id){ return document.getElementById(id); }

function readLS(k, def){
  try { return JSON.parse(localStorage.getItem(k)) ?? def }
  catch { return def }
}

function saveLS(k, v){
  localStorage.setItem(k, JSON.stringify(v));
}

// ============================
// Cargar el chat
// ============================
document.addEventListener("DOMContentLoaded", () => {

  if (!DS.isLoggedIn()){
    location.href = "auth.html";
    return;
  }

  const params = new URLSearchParams(location.search);
  const otherId = params.get("id");
  const myId = DS.getSessionUserId();

  if (!otherId){
    alert("Chat no encontrado.");
    location.href = "chat_list.html";
    return;
  }

  // Mostrar info del usuario con quien chateo
  const other = DS.getUserById(otherId);
  if (!other){
    alert("El usuario ya no existe.");
    location.href = "chat_list.html";
    return;
  }

  // Nombre del usuario
  byId("chatUserName").textContent =
    other.name || other.username || "Usuario";

  // Avatar (si existe elemento en HTML)
  const ava = byId("chatUserAvatar");
  if (ava && other.avatar){
    ava.src = other.avatar;
  }

  // Identificador único del chat
  window.chatKey = [myId, otherId].sort().join("_");

  // Primera carga
  loadMessages();

  // Enviar mensaje
  byId("btnSend").addEventListener("click", sendMessage);

  byId("msgInput").addEventListener("keydown", (e)=>{
    if (e.key === "Enter") sendMessage();
  });

  // Refrescar automáticamente cada 1 segundo
  setInterval(loadMessages, 1000);
});

// ============================
// Marcar mensajes como leídos
// ============================
function markAsRead(){
  const myId = DS.getSessionUserId();
  let all = readLS(CHAT_KEY, {});

  if (!all[window.chatKey]) return;

  all[window.chatKey] = all[window.chatKey].map(msg => {
    if (msg.from !== myId) msg.read = true;
    return msg;
  });

  saveLS(CHAT_KEY, all);
}

// ============================
// Cargar mensajes (UNIFICADO)
// ============================
function loadMessages(){
  markAsRead();

  const msgs = readLS(CHAT_KEY, {});
  const arr = msgs[window.chatKey] || [];

  const box = byId("chatMessages");
  if (!box) return;

  box.innerHTML = arr.map(msg => {
    const side = msg.from === DS.getSessionUserId() ? "me" : "other";
    return `
      <div class="msg msg-${side}">
        <div class="msg-text">${escapeHtml(msg.text)}</div>
        <div class="msg-time">${formatTime(msg.time)}</div>
      </div>
    `;
  }).join("");

  box.scrollTop = box.scrollHeight;
}

// ============================
// Enviar mensaje
// ============================
function sendMessage(){
  const inp = byId("msgInput");
  const text = inp.value.trim();
  if (!text) return;

  const all = readLS(CHAT_KEY, {});
  if (!all[window.chatKey]) all[window.chatKey] = [];

  all[window.chatKey].push({
    from: DS.getSessionUserId(),
    text,
    time: Date.now(),
    read: false
  });

  saveLS(CHAT_KEY, all);

  inp.value = "";
  loadMessages();
}

// ============================
// Utilidades
// ============================
function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'
  }[c]));
}

function formatTime(ms){
  const d = new Date(ms);
  return d.toLocaleTimeString([], {hour:"2-digit", minute:"2-digit"});
}
