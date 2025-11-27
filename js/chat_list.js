// ============================
// Deporte Conecta — Lista de chats
// ============================

const CHAT_KEY = "dc_chats";

function byId(id){ return document.getElementById(id); }

function readLS(k, def){
  try { return JSON.parse(localStorage.getItem(k)) ?? def; }
  catch { return def; }
}

function saveLS(k, v){
  localStorage.setItem(k, JSON.stringify(v));
}

let myId = null;

// ============================
// Boot
// ============================
document.addEventListener("DOMContentLoaded", () => {
  if (!DS.isLoggedIn()){
    location.href = "auth.html";
    return;
  }

  myId = DS.getSessionUserId();

  renderChatList();
  // refresco suave cada 2s para ver nuevos mensajes
  setInterval(renderChatList, 2000);
});

// ============================
// Hidden / borrados solo para este usuario
// ============================
function getHiddenKey(){
  return `dc_chats_hidden_${myId}`;
}

function getHiddenSet(){
  return new Set(readLS(getHiddenKey(), []));
}

function saveHiddenSet(set){
  saveLS(getHiddenKey(), Array.from(set));
}

// ============================
// Render de la lista de chats
// ============================
function renderChatList(){
  const container = byId("chatList");
  if (!container) return;

  const allChats = readLS(CHAT_KEY, {});
  const hidden = getHiddenSet();
  const entries = [];

  Object.entries(allChats).forEach(([key, messages]) => {
    if (!messages || !messages.length) return;
    if (hidden.has(key)) return;

    const [id1, id2] = key.split("_");
    if (!id1 || !id2) return;

    const otherId = id1 === myId ? id2 : (id2 === myId ? id1 : null);
    if (!otherId) return;

    const other = DS.getUserById(otherId);
    if (!other) return;

    const last = messages[messages.length - 1];
    const unread = messages.filter(m => m.from !== myId && !m.read).length;

    entries.push({
      key,
      otherId,
      other,
      last,
      unread
    });
  });

  // ordenar por último mensaje (más reciente arriba)
  entries.sort((a,b) => (b.last?.time || 0) - (a.last?.time || 0));

  // Total de no leídos
  const totalUnread = entries.reduce((acc, e) => acc + (e.unread || 0), 0);
  const badge = byId("totalUnread");
  if (badge){
    if (totalUnread > 0){
      badge.textContent = `${totalUnread} nuevo${totalUnread > 1 ? "s" : ""}`;
      badge.hidden = false;
    } else {
      badge.hidden = true;
    }
  }

  if (!entries.length){
    container.innerHTML = `<p class="empty">No tienes chats todavía. Empieza escribiendo desde un perfil público. 🏀</p>`;
    return;
  }

  container.innerHTML = entries.map(e => {
    const name = e.other.name || e.other.username || "Usuario";
    const lastText = e.last?.text || "";
    const time = e.last?.time ? formatTime(e.last.time) : "";

    // Avatar
    let avatarHtml = `<div class="chat-avatar"></div>`;
    if (e.other.avatar){
      avatarHtml = `<img class="chat-avatar" src="${escapeHtml(e.other.avatar)}" alt="">`;
    }

    const unreadHtml = e.unread > 0
      ? `<div class="unread-badge">${e.unread}</div>`
      : "";

    return `
      <div class="chat-row" data-other-id="${e.otherId}">
        ${avatarHtml}
        <div class="chat-info">
          <div class="chat-name">${escapeHtml(name)}</div>
          <div class="chat-last">${escapeHtml(lastText)}</div>
        </div>
        <div class="chat-meta">
          <div class="chat-time">${escapeHtml(time)}</div>
          <div class="chat-actions">
            ${unreadHtml}
            <button class="btn-delete-chat" data-chat-key="${e.key}" title="Borrar solo para mí">🗑</button>
          </div>
        </div>
      </div>
    `;
  }).join("");

  // Listeners: abrir chat
  container.querySelectorAll(".chat-row").forEach(row => {
    const otherId = row.dataset.otherId;
    row.addEventListener("click", () => {
      if (!otherId) return;
      location.href = `chat.html?id=${encodeURIComponent(otherId)}`;
    });
  });

  // Listeners: borrar solo para mí
  container.querySelectorAll(".btn-delete-chat").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const key = btn.dataset.chatKey;
      if (!key) return;
      if (!confirm("¿Borrar este chat solo para ti? El otro usuario seguirá viendo la conversación.")){
        return;
      }
      const hidden = getHiddenSet();
      hidden.add(key);
      saveHiddenSet(hidden);
      renderChatList();
    });
  });
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
  if (!ms) return "";
  const d = new Date(ms);
  return d.toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" });
}
