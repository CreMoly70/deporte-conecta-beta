/* Deporte Conecta · Pantalla de perfil (demo local) */

// Claves usadas por el mapa
const LS_KEYS = {
  LOCATIONS: 'dc_locations'
};

document.addEventListener('DOMContentLoaded', () => {
  if (!DS.isLoggedIn()) return; // guardia adicional

  // Cargar datos de usuario
  const user = DS.getUserById(DS.getSessionUserId());
  if (!user) { DS.clearSession(); location.href = 'auth.html'; return; }

  // Saludo
  byId('helloUser').textContent = `Hola, ${user.name || user.username}`;

  // Avatar
  renderAvatar(user.avatar);

  // Inputs perfil
  byId('name').value = user.name || '';
  byId('username').value = user.username || '';
  byId('email').value = user.email || '';
  byId('city').value = user.city || '';
  byId('bio').value = user.bio || '';

  // Deportes favoritos
  const mult = byId('sportsFav');
  setMultiSelect(mult, user.sportsFav || []);
  renderSportsPreview(user.sportsFav || []);

  mult.addEventListener('change', () => {
    const sel = getMultiSelectValues(mult);
    renderSportsPreview(sel);
  });

  // Cambiar avatar (dataURL)
  byId('avatarInput').addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const dataURL = await fileToDataURL(file);
    renderAvatar(dataURL);
    // No guardamos aún hasta que pulse "Guardar cambios"
  });

  // Guardar perfil
  byId('btnSaveProfile').addEventListener('click', onSaveProfile);

  // Mis ubicaciones
  renderMyPlaces();
});

// ========== Perfil ==========
async function onSaveProfile(){
  if (!DS.isLoggedIn()) return;

  const id = DS.getSessionUserId();
  const name = byId('name').value.trim();
  const username = byId('username').value.trim();
  const email = byId('email').value.trim();
  const city = byId('city').value.trim();
  const bio = byId('bio').value.trim();
  const sportsFav = getMultiSelectValues(byId('sportsFav'));
  const avatarEl = byId('avatarImg');
  const avatar = avatarEl?.dataset?.src || ''; // usamos data-src para no depender del src cuando está vacío

  try{
    const updated = await DS.updateUser(id, { name, username, email, city, bio, sportsFav, avatar });
    alert('Perfil actualizado.');
    // refrescar saludo
    byId('helloUser').textContent = `Hola, ${updated.name || updated.username}`;
    // opcional: si quieres, sincroniza autor en tus ubicaciones antiguas que no tenían createdBy
    // migrateOwnedLocationsIfNeeded(updated.id);
    renderMyPlaces(); // por si cambia el nombre que mostramos al lado de cada punto (no necesario aquí)
  }catch(err){
    alert(err.message || 'No fue posible actualizar el perfil.');
  }
}

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
}

function setMultiSelect(selectEl, values){
  const set = new Set(values || []);
  Array.from(selectEl.options).forEach(opt => {
    opt.selected = set.has(opt.value);
  });
}
function getMultiSelectValues(selectEl){
  return Array.from(selectEl.selectedOptions).map(o => o.value);
}
function renderSportsPreview(list){
  const cont = byId('sportsPreview');
  if(!list || !list.length){
    cont.innerHTML = `<span class="small">Aún no seleccionas deportes.</span>`;
    return;
  }
  cont.innerHTML = list.map(s => `<span class="pill">${escapeHtml(s)}</span>`).join('');
}

// ========== Mis ubicaciones ==========
function renderMyPlaces(){
  const userId = DS.getSessionUserId();
  const list = readLS(LS_KEYS.LOCATIONS, []).filter(p => p.createdBy === userId);
  const wrap = byId('myPlaces');
  const stats = byId('myStats');

  stats.textContent = `Total: ${list.length}`;

  if (!list.length){
    wrap.innerHTML = `
      <div class="item"><small>No has añadido ubicaciones todavía.</small></div>
    `;
    return;
  }

  // ordenar por fecha descendente
  list.sort((a,b) => (b.createdAt||0) - (a.createdAt||0));

  wrap.innerHTML = list.map(p => `
    <div class="item">
      <div class="item-head">
        <strong>${escapeHtml(p.name)}</strong>
        <span class="small">${escapeHtml(p.sport)} ${p.schedule ? '· '+escapeHtml(p.schedule) : ''}</span>
      </div>
      <small>Coords: ${Number(p.lat).toFixed(5)}, ${Number(p.lng).toFixed(5)}</small>
      ${p.info ? `<small>${escapeHtml(p.info)}</small>` : ''}
      <div class="item-actions">
        <a class="button button--ghost" href="map.html" title="Ver en mapa">Ver en mapa</a>
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

  // seguridad: verificar autor
  const myId = DS.getSessionUserId();
  if (list[i].createdBy !== myId){
    alert('Solo puedes eliminar ubicaciones creadas por ti.');
    return;
  }

  list.splice(i,1);
  saveLS(LS_KEYS.LOCATIONS, list);
  renderMyPlaces();
}

// ========== Utils ==========
function byId(id){ return document.getElementById(id); }
function readLS(k, def){ try{ return JSON.parse(localStorage.getItem(k)) ?? def }catch{ return def } }
function saveLS(k,v){ localStorage.setItem(k, JSON.stringify(v)) }
function escapeHtml(str){ return String(str).replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[s])); }

function fileToDataURL(file){
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
