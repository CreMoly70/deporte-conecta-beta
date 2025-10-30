// Deporte Conecta · Mapa colaborativo con Leaflet + localStorage (v sesión de usuario)
const LS_KEYS = {
  LOCATIONS: 'dc_locations',
  FAVORITES: 'dc_favorites',      // base de favoritos
  PREF_SPORT: 'dc_pref_sport',
  PREF_SEARCH: 'dc_pref_search'
};

let map;
let allMarkers = [];
let currentData = [];
let addMode = false;
let tempMarker = null;
let tempLatLng = null;
let nearCircle = null;
let nearCenterMarker = null;
let selectingCenter = false;

// ============= Boot =============
document.addEventListener('DOMContentLoaded', () => {
  if (!DS.isLoggedIn()) {
    location.href = 'auth.html';
    return;
  }

  // Mapa base
  map = L.map('map').setView([4.65, -74.1], 12);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);

  // Datos iniciales
  const stored = readLS(LS_KEYS.LOCATIONS, []);
  currentData = (stored || []).map(normalize);
  render();

  // Prefiltros
  const preSport = readLS(LS_KEYS.PREF_SPORT, '');
  if (preSport) byId('sportFilter').value = preSport;
  byId('searchText').value = readLS(LS_KEYS.PREF_SEARCH, '');

  // Eventos UI
  byId('sportFilter').addEventListener('change', () => { persistPrefs(); render(); });
  byId('searchText').addEventListener('input', debounce(() => { persistPrefs(); render(); }, 120));
  byId('btnClear').addEventListener('click', clearFilters);

  byId('btnAddMode').addEventListener('click', toggleAddMode);
  byId('btnCancelAdd').addEventListener('click', () => setAddMode(false));
  byId('btnSave').addEventListener('click', saveLocation);

  map.on('click', (e) => {
    if (!addMode) return;
    const { lat, lng } = e.latlng;
    tempLatLng = { lat, lng };
    ensureTempMarkerAt(lat, lng, true);
  });

  byId('infoClose').addEventListener('click', hideInfo);
  const mb = qs('#infoModal .modal-backdrop');
  if (mb) mb.addEventListener('click', (e) => { if (e.target.dataset.close !== undefined || e.target === mb) hideInfo(); });

  byId('btnFav').addEventListener('click', openFavPanel);
  byId('btnCloseFav').addEventListener('click', closeFavPanel);

  byId('btnNear').addEventListener('click', () => byId('nearPanel').hidden = false);
  byId('btnCloseNear').addEventListener('click', () => byId('nearPanel').hidden = true);
  byId('btnNearClear').addEventListener('click', clearNear);
  byId('btnNearLocate').addEventListener('click', locateMe);
  byId('btnNearSelect').addEventListener('click', startSelectNearCenter);
  byId('btnNearApply').addEventListener('click', applyNearFilter);
});

// ============= Helpers =============
function byId(id){ return document.getElementById(id); }
function qs(sel){ return document.querySelector(sel); }
function readLS(k, def){ try{ return JSON.parse(localStorage.getItem(k)) ?? def }catch{ return def } }
function saveLS(k,v){ localStorage.setItem(k, JSON.stringify(v)) }

function normalize(p){
  return {
    id: p.id || (crypto?.randomUUID?.() || String(Date.now())+Math.random()),
    name: (p.name || 'Lugar sin nombre').trim(),
    sport: p.sport || 'Fútbol',
    lat: Number(p.lat),
    lng: Number(p.lng),
    schedule: p.schedule || '',
    info: p.info || '',
    verified: !!p.verified,
    createdBy: p.createdBy || null,
    createdAt: p.createdAt || Date.now()
  };
}

function persistPrefs(){
  saveLS(LS_KEYS.PREF_SPORT, byId('sportFilter').value);
  saveLS(LS_KEYS.PREF_SEARCH, byId('searchText').value.trim());
}

function debounce(fn, ms){ let t; return (...args)=>{ clearTimeout(t); t=setTimeout(()=>fn(...args), ms) } }
function escapeHtml(str){ return String(str).replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[s])); }

// ============= Filtros y render =============
function clearFilters(){
  byId('sportFilter').value = '';
  byId('searchText').value = '';
  persistPrefs();
  render();
}

function applyFilters(list){
  const sport = byId('sportFilter').value;
  const q = byId('searchText').value.trim().toLowerCase();
  let filtered = list.filter(l =>
    (!sport || l.sport === sport) &&
    (!q || (l.name + ' ' + l.sport).toLowerCase().includes(q))
  );

  if (nearCircle) {
    const center = nearCircle.getLatLng();
    const radius = nearCircle.getRadius();
    filtered = filtered.filter(p => map.distance(center, [p.lat, p.lng]) <= radius);
  }
  return filtered;
}

function render(){
  allMarkers.forEach(m => m.remove());
  allMarkers = [];

  const filtered = applyFilters(currentData);
  const favs = getFavorites();
  const myUserId = DS.getSessionUserId();

  filtered.forEach(p => {
    const marker = L.marker([p.lat, p.lng], { title: p.name }).addTo(map);
    const isFav = favs.has(p.id);
    const favLabel = isFav ? '★ Quitar de favoritos' : '☆ Agregar a favoritos';

    let creatorBlock = '';
    if (p.createdBy) {
      const u = DS.getUserById(p.createdBy);
      const label = u ? (u.name || u.username || 'Usuario') : String(p.createdBy).slice(0,8);
      creatorBlock = `
        <small style="opacity:.85">Creado por: <strong>@${escapeHtml(label)}</strong></small><br>
        <div class="popup-actions" style="margin-top:6px;">
          <button onclick="viewCreatorProfile('${p.createdBy}')" class="button button--ghost" style="padding:.45rem .7rem">👤 Ver perfil</button>
        </div>
      `;
    }

    const canDelete = (p.createdBy && p.createdBy === myUserId);
    let actions = `
      <div class="popup-actions" style="margin-top:10px;">
        <div class="left">
          <button onclick="showInfo('${p.id}')" class="button button--ghost" style="padding:.45rem .7rem">ℹ️ Info</button>
          <button onclick="toggleFavorite('${p.id}')" class="button button--ghost" style="padding:.45rem .7rem">${favLabel}</button>
        </div>
        <div class="right">
          ${ canDelete ? `<button onclick="deleteLocation('${p.id}')" class="button button--ghost" style="padding:.45rem .7rem">🗑️ Eliminar</button>` : '' }
        </div>
      </div>
    `;

    marker.bindPopup(`
      <div class="popup">
        <h4 class="popup-title">${escapeHtml(p.name)}</h4>
        ${creatorBlock}
        <div class="popup-meta">
          <small>Deporte: ${escapeHtml(p.sport)}</small>
          ${p.schedule ? `<small>Horario: ${escapeHtml(p.schedule)}</small>` : ''}
        </div>
        ${actions}
      </div>
    `);
    allMarkers.push(marker);
  });

  const stats = computeStats(filtered, favs);
  const sb = byId('statsBar');
  if (sb) sb.textContent = `Lugares: ${filtered.length} · Top: ${stats.topSport} · Favoritos: ${stats.favCount}`;
}

function computeStats(list, favs){
  const bySport = list.reduce((a,l)=> (a[l.sport]=(a[l.sport]||0)+1, a), {});
  const topSport = Object.entries(bySport).sort((a,b)=>b[1]-a[1])[0]?.[0] || '—';
  const favCount = Array.from(favs).filter(id => list.some(x=>x.id===id)).length;
  return { topSport, favCount };
}

// ============= Añadir ubicación =============
function toggleAddMode(){ setAddMode(!addMode); }

function setAddMode(state){
  addMode = state;
  const btn = byId('btnAddMode');
  const panel = byId('addPanel');

  if(addMode){
    btn.textContent = '✅ Añadiendo (clic en el mapa)';
    btn.classList.add('button--accent');
    panel.hidden = false;
  }else{
    btn.textContent = '➕ Añadir';
    btn.classList.remove('button--accent');
    panel.hidden = true;
    if (tempMarker){ tempMarker.remove(); tempMarker = null; }
    tempLatLng = null;
  }
}

function ensureTempMarkerAt(lat, lng, open=false){
  if(!tempMarker){
    tempMarker = L.marker([lat, lng], { draggable: true, title:'Nuevo lugar' }).addTo(map);
    tempMarker.on('dragend', () => {
      const pos = tempMarker.getLatLng();
      tempLatLng = { lat: pos.lat, lng: pos.lng };
    });
  }else{
    tempMarker.setLatLng([lat, lng]);
  }
  const html = `<strong>Nuevo lugar</strong><br>Arrastra para ajustar.<br>Lat: ${lat.toFixed(6)} · Lng: ${lng.toFixed(6)}`;
  tempMarker.bindPopup(html);
  if(open) tempMarker.openPopup();
}

function saveLocation(){
  if (!DS.isLoggedIn()) { alert('Debes iniciar sesión.'); return; }

  const name = byId('name').value.trim();
  const sport = byId('sport').value;
  const schedule = byId('hours').value.trim();
  const info = byId('more').value.trim();

  if(!addMode){ alert('Pulsa “Añadir” para entrar en modo de colocación.'); return; }
  if(!tempLatLng){ alert('Haz clic en el mapa para colocar el marcador.'); return; }
  if(!name){ alert('Ingresa un nombre para el lugar.'); return; }

  const item = normalize({
    name, sport, schedule, info,
    lat: tempLatLng.lat, lng: tempLatLng.lng,
    verified:false, createdBy: DS.getSessionUserId()
  });

  const list = readLS(LS_KEYS.LOCATIONS, []);
  list.push(item);
  saveLS(LS_KEYS.LOCATIONS, list);
  currentData = list;

  byId('name').value = '';
  byId('hours').value = '';
  byId('more').value = '';
  if (tempMarker){ tempMarker.remove(); tempMarker = null; }
  tempLatLng = null;
  setAddMode(false);
  render();
  alert(`Ubicación "${item.name}" guardada.`);
}

// ============= Eliminar =============
function deleteLocation(id){
  const list = readLS(LS_KEYS.LOCATIONS, []);
  const i = list.findIndex(x => x.id === id);
  if(i < 0) return;

  const myUserId = DS.getSessionUserId();
  if(list[i].createdBy !== myUserId){
    alert('Solo puedes eliminar ubicaciones que hayas añadido.');
    return;
  }
  if(!confirm(`¿Eliminar "${list[i].name}"?`)) return;

  list.splice(i,1);
  saveLS(LS_KEYS.LOCATIONS, list);
  currentData = list;
  render();
  if (!byId('favPanel').hidden) fillFavPanel();
}

// ============= Favoritos por usuario =============
function getFavKey() {
  const userId = DS.getSessionUserId();
  return userId ? `${LS_KEYS.FAVORITES}_${userId}` : LS_KEYS.FAVORITES;
}
function getFavorites() { return new Set(readLS(getFavKey(), [])); }
function saveFavorites(set) { saveLS(getFavKey(), Array.from(set)); }
function toggleFavorite(id){
  const favs = getFavorites();
  if(favs.has(id)) favs.delete(id); else favs.add(id);
  saveFavorites(favs);
  render();
  if (!byId('favPanel').hidden) fillFavPanel();
}

// Panel Favoritos
function openFavPanel(){ fillFavPanel(); byId('favPanel').hidden = false; }
function closeFavPanel(){ byId('favPanel').hidden = true; }

function fillFavPanel(){
  const favList = byId('favList');
  const favs = getFavorites();
  const items = currentData.filter(p => favs.has(p.id));

  if (!items.length){
    favList.innerHTML = `<div class="side-item"><small>No tienes favoritos todavía.</small></div>`;
    return;
  }

  favList.innerHTML = items.map(p => `
    <div class="side-item">
      <h4>${escapeHtml(p.name)}</h4>
      <small>${escapeHtml(p.sport)} ${p.schedule ? '· '+escapeHtml(p.schedule) : ''}</small>
      <div class="side-actions">
        <button class="button button--ghost" onclick="centerOn('${p.id}')">Ver en mapa</button>
        <button class="button button--ghost" onclick="toggleFavorite('${p.id}')">Quitar</button>
      </div>
    </div>
  `).join('');
}

// ============= Centro en favorito =============
function centerOn(id){
  const p = currentData.find(x => x.id === id);
  if(!p) return;
  map.setView([p.lat, p.lng], Math.max(map.getZoom(), 15));
  const mk = allMarkers.find(m => {
    const ll = m.getLatLng();
    return Math.abs(ll.lat - p.lat) < 1e-7 && Math.abs(ll.lng - p.lng) < 1e-7;
  });
  if (mk) mk.openPopup();
}

// ============= Información (modal) =============
function showInfo(id){
  const item = currentData.find(x => x.id === id);
  if(!item) return;

  let creatorLine = '';
  if (item.createdBy) {
    const u = DS.getUserById(item.createdBy);
    const label = u ? (u.name || u.username || 'Usuario') : String(item.createdBy).slice(0,8);
    creatorLine = `<p><strong>Creador:</strong> @${escapeHtml(label)}</p>`;
  }

  byId('infoTitle').textContent = item.name;
  byId('infoBody').innerHTML = `
    ${creatorLine}
    <p><strong>Deporte:</strong> ${escapeHtml(item.sport)}</p>
    ${item.schedule ? `<p><strong>Horario:</strong> ${escapeHtml(item.schedule)}</p>` : ''}
    ${item.info ? `<p><strong>Más información:</strong><br>${escapeHtml(item.info)}</p>` : '<p>No hay información adicional.</p>'}
    <p style="opacity:.7"><small>Ubicación: ${item.lat.toFixed(5)}, ${item.lng.toFixed(5)}</small></p>
  `;
  byId('infoModal').hidden = false;
}
function hideInfo(){ byId('infoModal').hidden = true; }

// ============= Cerca de mí =============
function locateMe(){
  if (!navigator.geolocation){ alert('Geolocalización no soportada.'); return; }
  navigator.geolocation.getCurrentPosition(pos => {
    const { latitude, longitude } = pos.coords;
    setNearCenter(latitude, longitude);
    map.setView([latitude, longitude], 15);
  }, () => alert('No fue posible obtener tu ubicación.'));
}

function setNearCenter(lat, lng){
  if (nearCenterMarker) map.removeLayer(nearCenterMarker);
  nearCenterMarker = L.marker([lat, lng], {
    title: 'Centro de búsqueda',
    icon: L.divIcon({
      html: '📍',
      className: 'near-marker',
      iconSize: [24,24],
      iconAnchor: [12,12]
    })
  }).addTo(map);
}

function applyNearFilter(){
  const km = Number(byId('nearRadius').value) || 3;
  let center = nearCenterMarker ? nearCenterMarker.getLatLng() : map.getCenter();
  const meters = km * 1000;

  if (nearCircle) map.removeLayer(nearCircle);
  nearCircle = L.circle(center, {
    radius: meters,
    color:'#5aa3ff',
    fillColor:'#5aa3ff',
    fillOpacity:.15
  }).addTo(map);

  const label = L.tooltip(center, {
    permanent: true,
    direction: 'center',
    className: 'near-label'
  }).setContent(`Radio: ${km} km`);
  nearCircle.bindTooltip(label);

  render();
}

function clearNear(){
  if (nearCircle) { map.removeLayer(nearCircle); nearCircle = null; }
  if (nearCenterMarker) { map.removeLayer(nearCenterMarker); nearCenterMarker = null; }
  render();
}

function startSelectNearCenter(){
  selectingCenter = true;
  alert('Haz clic en el mapa para seleccionar el centro de búsqueda.');
  map.once('click', (e) => {
    setNearCenter(e.latlng.lat, e.latlng.lng);
    map.setView(e.latlng, 15);
    selectingCenter = false;
  });
}

// --- Ver perfil creador ---
function viewCreatorProfile(userId){
  const myId = DS.getSessionUserId();
  if (userId === myId){
    location.href = 'profile.html';
  } else {
    alert('Por ahora solo puedes ver tu propio perfil.');
  }
}
