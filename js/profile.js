/* Deporte Conecta · Pantalla de perfil (demo local)
   • Misma funcionalidad
   • Mejor feedback visual
   • Alertas modernizadas (estilo toast simple)
*/

// Claves usadas por el mapa
const LS_KEYS = {
  LOCATIONS: 'dc_locations'
};

document.addEventListener('DOMContentLoaded', () => {
  if (!DS.isLoggedIn()) return;

  const user = DS.getUserById(DS.getSessionUserId());
  if (!user) { 
    DS.clearSession(); 
    location.href = 'auth.html'; 
    return; 
  }

  // saludo
  byId('helloUser').textContent = `Hola, ${user.name || user.username}`;

  // avatar
  renderAvatar(user.avatar);

  // valores iniciales
  byId('name').value = user.name || '';
  byId('username').value = user.username || '';
  byId('email').value = user.email || '';
  byId('city').value = user.city || '';
  byId('bio').value = user.bio || '';

  const mult = byId('sportsFav');
  setMultiSelect(mult, user.sportsFav || []);
  renderSportsPreview(user.sportsFav || []);

  mult.addEventListener('change', () => {
    const sel = getMultiSelectValues(mult);
    renderSportsPreview(sel);
  });

  // cambio de avatar
  byId('avatarInput').addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const data = await fileToDataURL(file);
    renderAvatar(data);
  });

  byId('btnSaveProfile').addEventListener('click', onSaveProfile);

  // ubicaciones creadas por el usuario
  renderMyPlaces();
});

// ==========================
//       GUARDAR PERFIL
// ==========================
async function onSaveProfile(){
  if (!DS.isLoggedIn()) return;

  const id = DS.getSessionUserId();
  const name = byId('name').value.trim();
  const username = byId('username').value.trim();
  const email = byId('email').value.trim();
  const city = byId('city').value.trim();
  const bio = byId('bio').value.trim();
  const sportsFav = getMultiSelectValues(byId('sportsFav'));

  const avatar = byId('avatarImg')?.dataset?.src || '';

  try{
    const updated = await DS.updateUser(id, {
      name, username, email, city, bio, sportsFav, avatar
    });

    showToast("Perfil actualizado correctamente.");

    byId('helloUser').textContent = `Hola, ${updated.name || updated.username}`;
    renderMyPlaces();

  }catch(err){
    showToast(err.message || 'No fue posible actualizar el perfil.', true);
  }
}

// ==========================
//         AVATAR
// ==========================
function renderAvatar(dataURL){
  const img = byId('avatarImg');
  if (!img) return;

  if (dataURL){
    img.src = dataURL;
    img.dataset.src = dataURL;
  }else{
    img.removeAttribute('src');
    img.dataset.src = '';
  }

  // animación suave
  img.style.opacity = "0";
  setTimeout(() => (img.style.opacity = "1"), 40);
}

// ==========================
//      DEPORTES FAVORITOS
// ==========================
function setMultiSelect(select, values){
  const set = new Set(values);
  [...select.options].forEach(opt => opt.selected = set.has(opt.value));
}

function getMultiSelectValues(select){
  return [...select.selectedOptions].map(o => o.value);
}

function renderSportsPreview(list){
  const cont = byId('sportsPreview');

  if (!list.length){
    cont.innerHTML = `<span class="small" style="opacity:.7">Aún no seleccionas deportes.</span>`;
    return;
  }

  cont.innerHTML = list
    .map(s => `<span class="pill">${escapeHtml(s)}</span>`)
    .join('');
}

// ==========================
//      MIS UBICACIONES
// ==========================
function renderMyPlaces(){
  const userId = DS.getSessionUserId();
  const list = readLS(LS_KEYS.LOCATIONS, []).filter(p => p.createdBy === userId);

  const wrap = byId('myPlaces');
  const stats = byId('myStats');

  stats.textContent = `Total: ${list.length}`;

  if (!list.length){
    wrap.innerHTML = `
      <div class="item">
        <small style="opacity:.8">No has añadido ubicaciones todavía.</small>
      </div>
    `;
    return;
  }

  list.sort((a,b) => (b.createdAt||0) - (a.createdAt||0));

  wrap.innerHTML = list.map(p => `
    <div class="item">
      <div class="item-head">
        <strong>${escapeHtml(p.name)}</strong>
        <span class="small" style="opacity:.85">
          ${escapeHtml(p.sport)} ${p.schedule ? "· " + escapeHtml(p.schedule) : ""}
        </span>
      </div>

      <small style="opacity:.75">
        Coords: ${Number(p.lat).toFixed(5)}, ${Number(p.lng).toFixed(5)}
      </small>

      ${p.info ? `<small style="opacity:.85">${escapeHtml(p.info)}</small>` : ''}

      <div class="item-actions">
        <a class="button button--ghost" href="map.html">Ver en mapa</a>
        <button class="button button--ghost" onclick="deleteMyPlace('${p.id}')">Eliminar</button>
      </div>
    </div>
  `).join('');
}

function deleteMyPlace(id){
  if (!confirm('¿Eliminar esta ubicación?')) return;

  const list = readLS(LS_KEYS.LOCATIONS, []);
  const i = list.findIndex(x => x.id === id);
  if (i < 0) return;

  const myId = DS.getSessionUserId();
  if (list[i].createdBy !== myId){
    showToast("Solo puedes eliminar tus propias ubicaciones.", true);
    return;
  }

  list.splice(i,1);
  saveLS(LS_KEYS.LOCATIONS, list);
  renderMyPlaces();
}

// ==========================
//         UTILS
// ==========================
function byId(id){ return document.getElementById(id); }

function readLS(k, def){
  try { return JSON.parse(localStorage.getItem(k)) ?? def }
  catch { return def }
}

function saveLS(k,v){ localStorage.setItem(k, JSON.stringify(v)) }

function escapeHtml(str){
  return String(str).replace(/[&<>"']/g, s =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[s])
  );
}

function fileToDataURL(file){
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = e => resolve(e.target.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

// ==========================
//      TOAST VISUAL (nuevo)
// ==========================
function showToast(msg, error=false){
  const toast = document.createElement("div");
  toast.textContent = msg;

  toast.style.position = "fixed";
  toast.style.bottom = "26px";
  toast.style.right = "26px";
  toast.style.padding = "12px 18px";
  toast.style.borderRadius = "12px";
  toast.style.fontSize = ".9rem";
  toast.style.zIndex = "9999";
  toast.style.color = "#fff";
  toast.style.background = error
    ? "rgba(255,80,80,0.85)"
    : "rgba(70,140,255,0.85)";
  toast.style.backdropFilter = "blur(8px)";
  toast.style.boxShadow = "0 6px 16px rgba(0,0,0,.35)";
  toast.style.opacity = "0";
  toast.style.transition = "opacity .35s ease";

  document.body.appendChild(toast);

  setTimeout(() => { toast.style.opacity = "1"; }, 20);
  setTimeout(() => {
    toast.style.opacity = "0";
    setTimeout(() => toast.remove(), 400);
  }, 2300);
}
