// Deporte Conecta · Mapa colaborativo con Leaflet + localStorage (versión estable)
const LS_KEYS = {
  LOCATIONS: 'dc_locations',
  FAVORITES: 'dc_favorites',      // set de ids (se migra a por-usuario más adelante)
  PREF_SPORT: 'dc_pref_sport',
  PREF_SEARCH: 'dc_pref_search',
  DEVICE_ID: 'dc_device_id'
};

let map;
let allMarkers = [];
let currentData = [];
let addMode = false;     // modo colocar marcador
let tempMarker = null;   // marcador temporal (draggable)
let tempLatLng = null;   // coords elegidas
let nearCircle = null;   // círculo de "cerca de mí"

// ============= Boot =============
document.addEventListener('DOMContentLoaded', () => {
  ensureDeviceId();

  // Mapa
  map = L.map('map').setView([4.65, -74.1], 12);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);

  // Datos
  const stored = readLS(LS_KEYS.LOCATIONS, []);
  if (stored.length) {
    currentData = stored.map(normalize);
    render();
  } else {
    fetch('data/places.json').then(r => r.ok ? r.json() : [])
      .catch(() => [])
      .then(seed => {
        currentData = Array.isArray(seed) ? seed.map(normalize) : [];
        saveLS(LS_KEYS.LOCATIONS, currentData);
        render();
      });
  }

  // Prefiltros
  const preSport = readLS(LS_KEYS.PREF_SPORT, '');
  if (preSport) byId('sportFilter').value = preSport;
  byId('searchText').value = readLS(LS_KEYS.PREF_SEARCH, '');

  // UI listeners
  byId('sportFilter').addEventListener('change', () => { persistPrefs(); render(); });
  byId('searchText').addEventListener('input', debounce(() => { persistPrefs(); render(); }, 120));
  byId('btnClear').addEventListener('click', clearFilters);

  // Añadir ubicación
  byId('btnAddMode').addEventListener('click', toggleAddMode);
  byId('btnCancelAdd').addEventListener('click', () => setAddMode(false));
  byId('btnSave').addEventListener('click', saveLocation);

  // Click en mapa para colocar/ajustar marcador temporal
  map.on('click', (e) => {
    if (!addMode) return;
    const { lat, lng } = e.latlng;
    tempLatLng = { lat, lng };
    ensureTempMarkerAt(lat, lng, true);
  });

  // Modal Información
  byId('infoClose').addEventListener('click', hideInfo);
  const mb = qs('#infoModal .modal-backdrop');
  if (mb) mb.addEventListener('click', (e) => { if (e.target.dataset.close !== undefined || e.target === mb) hideInfo(); });

  // Favoritos (panel lateral)
  byId('btnFav').addEventListener('click', openFavPanel);
  byId('btnCloseFav').addEventListener('click', closeFavPanel);

  // Cerca de mí (si lo usas)
  const btnNear = byId('btnNear');
  if (btnNear) {
    btnNear.addEventListener('click', () => byId('nearPanel').hidden = false);
    byId('btnCloseNear').addEventListener('click', () => byId('nearPanel').hidden = true);
    byId('btnNearClear').addEventListener('click', () => { if (nearCircle) { map.removeLayer(nearCircle); nearCircle = null; } render(); });
    byId('btnNearLocate').addEventListener('click', locateMe);
    byId('btnNearApply').addEventListener('click', applyNearFilter);
  }
});

// ============= Helpers =============
function byId(id){ return document.getElementById(id); }
function qs(sel){ return document.querySelector(sel); }
function readLS(k, def){ try{ return JSON.parse(localStorage.getItem(k)) ?? def }catch{ return def } }
function saveLS(k,v){ localStorage.setItem(k, JSON.stringify(v)) }

function ensureDeviceId(){
  let id = localStorage.getItem(LS_KEYS.DEVICE_ID);
  if(!id){
    id = (crypto?.randomUUID?.() || String(Date.now()) + Math.random().toString(16).slice(2));
    localStorage.setItem(LS_KEYS.DEVICE_ID, id);
  }
  return id;
}
function getDeviceId(){ return localStorage.getItem(LS_KEYS.DEVICE_ID) }

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
    createdBy: p.createdBy || p.deviceId || null, // compat
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

  // Filtro "cerca de mí" si hay círculo activo
  if (nearCircle) {
    const center = nearCircle.getLatLng();
    const radius = nearCircle.getRadius(); // metros
    filtered = filtered.filter(p => map.distance(center, [p.lat, p.lng]) <= radius);
  }
  return filtered;
}

function render(){
  // limpiar marcadores existentes
  allMarkers.forEach(m => m.remove());
  allMarkers = [];

  const filtered = applyFilters(currentData);
  const favs = new Set(readLS(LS_KEYS.FAVORITES, []));
  const myId = getDeviceId();

  filtered.forEach(p => {
    const marker = L.marker([p.lat, p.lng], { title: p.name }).addTo(map);

    const isFav = favs.has(p.id);
    const favLabel = isFav ? '★ Quitar de favoritos' : '☆ Agregar a favoritos';
    const creator = p.createdBy ? `<small style="opacity:.85">Creado por: ${escapeHtml(String(p.createdBy).slice(0,16))}</small><br>` : '';

    let actions = `
      <div class="popup-actions">
        <div class="left">
          <button onclick="showInfo('${p.id}')" class="button button--ghost" style="padding:.45rem .7rem">ℹ️ Info</button>
          <button onclick="toggleFavorite('${p.id}')" class="button button--ghost" style="padding:.45rem .7rem">${favLabel}</button>
        </div>
        <div class="right">
          ${ (p.createdBy && p.createdBy === myId) ? `<button onclick="deleteLocation('${p.id}')" class="button button--ghost" style="padding:.45rem .7rem">🗑️ Eliminar</button>` : '' }
        </div>
      </div>
    `;

    marker.bindPopup(`
      <div class="popup">
        <h4 class="popup-title">${escapeHtml(p.name)}</h4>
        ${creator}
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
  const name = byId('name').value.trim();
  const sport = byId('sport').value;
  const schedule = byId('hours').value.trim();
  const info = byId('more').value.trim();

  if(!addMode){
    alert('Pulsa “Añadir” para entrar en modo de colocación.');
    return;
  }
  if(!tempLatLng){
    alert('Haz clic en el mapa para colocar el marcador.');
    return;
  }
  if(!name){
    alert('Ingresa un nombre para el lugar.');
    return;
  }

  const item = normalize({
    name, sport, schedule, info,
    lat: tempLatLng.lat, lng: tempLatLng.lng,
    verified:false, createdBy:getDeviceId()
  });

  const list = readLS(LS_KEYS.LOCATIONS, []);
  list.push(item);
  saveLS(LS_KEYS.LOCATIONS, list);
  currentData = list;

  // limpiar formulario y modo
  byId('name').value = '';
  byId('hours').value = '';
  byId('more').value = '';
  if (tempMarker){ tempMarker.remove(); tempMarker = null; }
  tempLatLng = null;
  setAddMode(false);

  render(); // <- esto agrega el nuevo marcador al mapa
  alert(`Ubicación "${item.name}" guardada.`);
}

// ============= Eliminar y Favoritos =============
function deleteLocation(id){
  const list = readLS(LS_KEYS.LOCATIONS, []);
  const i = list.findIndex(x => x.id === id);
  if(i < 0) return;

  const myId = getDeviceId();
  if(list[i].createdBy !== myId){
    alert('Solo puedes eliminar ubicaciones que hayas añadido.');
    return;
  }
  if(!confirm(`¿Eliminar "${list[i].name}"?`)) return;

  list.splice(i,1);
  saveLS(LS_KEYS.LOCATIONS, list);
  currentData = list;
  render();
  // refrescar panel favoritos si está abierto
  if (!byId('favPanel').hidden) fillFavPanel();
}

function getFavorites(){ return new Set(readLS(LS_KEYS.FAVORITES, [])); }
function toggleFavorite(id){
  const favs = getFavorites();
  if(favs.has(id)) favs.delete(id); else favs.add(id);
  saveLS(LS_KEYS.FAVORITES, Array.from(favs));
  render();
  if (!byId('favPanel').hidden) fillFavPanel();
}

// ============= Panel de Favoritos =============
function openFavPanel(){
  fillFavPanel();
  byId('favPanel').hidden = false;
}
function closeFavPanel(){ byId('favPanel').hidden = true; }

function fillFavPanel(){
  const favList = byId('favList');
  const favs = new Set(readLS(LS_KEYS.FAVORITES, []));
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

function centerOn(id){
  const p = currentData.find(x => x.id === id);
  if(!p) return;
  map.setView([p.lat, p.lng], Math.max(map.getZoom(), 15));
  // abre popup del marcador correspondiente
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
  byId('infoTitle').textContent = item.name;
  byId('infoBody').innerHTML = `
    <p><strong>Deporte:</strong> ${escapeHtml(item.sport)}</p>
    ${item.schedule ? `<p><strong>Horario:</strong> ${escapeHtml(item.schedule)}</p>` : ''}
    ${item.info ? `<p><strong>Más información:</strong><br>${escapeHtml(item.info)}</p>` : '<p>No hay información adicional.</p>'}
    <p style="opacity:.7"><small>Ubicación: ${item.lat.toFixed(5)}, ${item.lng.toFixed(5)}</small></p>
  `;
  byId('infoModal').hidden = false;
}
function hideInfo(){ byId('infoModal').hidden = true; }

// ============= Cerca de mí (opcional) =============
function locateMe(){
  if (!navigator.geolocation){ alert('Geolocalización no soportada.'); return; }
  navigator.geolocation.getCurrentPosition(pos => {
    const { latitude, longitude } = pos.coords;
    map.setView([latitude, longitude], 15);
    // solo centrado; el círculo se dibuja al aplicar
  }, () => alert('No fue posible obtener tu ubicación.'));
}

function applyNearFilter(){
  const km = Number(byId('nearRadius').value) || 3;
  const center = map.getCenter();
  const meters = km * 1000;

  if (nearCircle) map.removeLayer(nearCircle);
  nearCircle = L.circle(center, { radius: meters, color:'#5aa3ff', fillColor:'#5aa3ff', fillOpacity:.15 }).addTo(map);
  render();
}
