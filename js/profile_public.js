// Deporte Conecta — Perfil público

document.addEventListener("DOMContentLoaded", () => {
  const params = new URLSearchParams(location.search);
  const userId = params.get("id");

  if (!userId){
    alert("Perfil no encontrado.");
    location.href = "map.html";
    return;
  }

  const user = DS.getUserById(userId);
  if (!user){
    alert("Este usuario ya no existe.");
    location.href = "map.html";
    return;
  }

  // Datos principales
  byId("ppName").textContent = user.name || user.username;
  byId("ppCity").textContent = user.city || "Sin ciudad";
  byId("ppBio").textContent = user.bio || "Sin biografía.";

  // Avatar
  const avatar = byId("ppAvatar");
  if (user.avatar){
    avatar.src = user.avatar;
  } else {
    avatar.style.opacity = "0.4";
  }

  // Deportes favoritos
  const sp = byId("ppSports");
  if (user.sportsFav?.length){
    sp.innerHTML = user.sportsFav
      .map(s => `<span class="pill">${escapeHtml(s)}</span>`)
      .join("");
  } else {
    sp.innerHTML = `<small style="opacity:.7">Sin deportes favoritos</small>`;
  }

  // Ubicaciones creadas por este usuario
  const list = readLS("dc_locations", [])
    .filter(p => p.createdBy === userId)
    .sort((a,b) => (b.createdAt || 0) - (a.createdAt || 0));

  const wrap = byId("ppPlaces");
  if (!list.length){
    wrap.innerHTML = `<div class="item"><small style="opacity:.8">No tiene ubicaciones.</small></div>`;
  } else {
    wrap.innerHTML = list.map(p => `
      <div class="item">
        <strong>${escapeHtml(p.name)}</strong><br>
        <small>${escapeHtml(p.sport)}</small><br>
        <small style="opacity:.8">${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}</small>
        <div class="item-actions">
          <button class="button button--ghost" onclick="goTo('${p.id}')">Ver en mapa</button>
        </div>
      </div>
    `).join("");
  }

  // ============================
  //  BOTÓN — Enviar mensaje
  // ============================
  byId("btnChat").addEventListener("click", () => {
    const myId = DS.getSessionUserId();

    if (myId === userId){
      alert("No puedes enviarte mensajes a ti mismo.");
      return;
    }

    // Redirigir al chat real
    location.href = `chat.html?id=${userId}`;
  });
});

// Utils
function byId(id){ return document.getElementById(id); }

function readLS(k, def){
  try { return JSON.parse(localStorage.getItem(k)) ?? def }
  catch { return def }
}

function escapeHtml(str){
  return String(str).replace(/[&<>"']/g, s => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'
  }[s]));
}

function goTo(id){
  location.href = `map.html?loc=${id}`;
}
