// Deporte Conecta · Mapa colaborativo con Leaflet + localStorage
const LS_KEYS = {
  LOCATIONS: 'dc_locations',
  FAVORITES: 'dc_favorites',
  PREF_SPORT: 'dc_pref_sport',
  PREF_SEARCH: 'dc_pref_search',
  DEVICE_ID: 'dc_device_id'
};

let map;
let allMarkers = [];
let currentData = [];
let addMode = false;     // modo colocar marcador
let tempMarker = null;   // marcador temporal
let tempLatLng = null;   // coords elegidas
let favPanelOpen = false;

// ---- Estado del filtro "Cerca de mí"
let nearPanelOpen = false;
let nearCenter = null;            // {lat, lng}
let nearRadiusKm = 3;             // número
let nearCircle = null;            // L.Circle
let nearCenterMarker = null;      // L.Marker
let pickCenterMode = false;       // si está activo: el próximo click define el centro

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
    currentData = stored;
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
  if (preSport) document.getElementById('sportFilter').value = preSport;
  document.getElementById('searchText').value = readLS(LS_KEYS.PREF_SEARCH, '');

  // UI filtros básicos
  document.getElementById('sportFilter').addEventListener('change', () => { persistPrefs(); render(); });
  document.getElementById('searchText').addEventListener('input', debounce(() => { persistPrefs(); render(); }, 150));
  document.getElementById('btnClear').addEventListener('click', () => {
    document.getElementById('sportFilter').value = '';
    document.getElementById('searchText').value = '';
    persistPrefs(); render();
  });

  // Añadir: abre/cierra panel y activa modo
  document.getElementById('btnAddMode').addEventListener('click', toggleAddMode);
  document.getElementById('btnCancelAdd').addEventListener('click', () => setAddMode(false));
  document.getElementById('btnSave').addEventListener('click', saveLocation);

  // Favoritos
  document.getElementById('btnFavPanel').addEventListener('click', toggleFavPanel);
  document.getElementById('favClose').addEventListener('click', () => setFavPanel(false));
  document.getElementById('favList').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if(!btn) return;
    const id = btn.dataset.id;
    const action = btn.dataset.action;
    if(action === 'open'){ openPlace(id); }
    if(action === 'unfav'){ toggleFavorite(id); }
  });

  // Cerca de mí: UI
  document.getElementById('btnNear').addEventListener('click', toggleNearPanel);
  document.getElementById('nearClose').addEventListener('click', () => setNearPanel(false));
  document.getElementById('nearUseGeo').addEventListener('click', useGeolocation);
  document.getElementById('nearPickOnMap').addEventListener('click', enablePickCenter);
  document.getElementById('nearApply').addEventListener('click', () => { setNearPanel(true); render(); });
  document.getElementById('nearClear').addEventListener('click', clearNearFilter);

  const range = document.getElementById('nearRange');
  const rangeNum = document.getElementById('nearRangeNum');
  range.addEventListener('input', () => { syncNearRange(range, rangeNum); updateNearCircle(); });
  rangeNum.addEventListener('input', () => { syncNearRange(rangeNum, range); updateNearCircle(); });

  // Click mapa
  map.on('click', (e) => {
    if (addMode) {
      const { lat, lng } = e.latlng;
      tempLatLng = { lat, lng };
      ensureTempMarkerAt(lat, lng, true);
    }
    if (pickCenterMode) {
      setNearCenter(e.latlng.lat, e.latlng.lng, true);
      pickCenterMode = false;
      setNearStatus('Centro establecido en el mapa.');
    }
  });

  // Modal info
  document.getElementById('infoClose').addEventListener('click', hideInfo);
  document.querySelector('#infoModal .modal-backdrop').addEventListener('click', (e) => {
    if (e.target.dataset.close) hideInfo();
  });
});

// ===== Helpers =====
function readLS(k, def){ try{ return JSON.parse(localStorage.getItem(k)) ?? def }catch{ return def } }
function saveLS(k,v){ localStorage.setItem(k, JSON.stringify(v)) }

function ensureDeviceId(){
  let id = localStorage.getItem(LS_KEYS.DEVICE_ID);
  if(!id){
    id = crypto.randomUUID();
    localStorage.setItem(LS_KEYS.DEVICE_ID, id);
  }
  return id;
}
function getDeviceId(){ return localStorage.getItem(LS_KEYS.DEVICE_ID) }

function normalize(p){
  return {
    id: p.id || crypto.randomUUID(),
    name: (p.name || 'Lugar sin nombre').trim(),
    sport: p.sport || 'Fútbol',
    lat: Number(p.lat),
    lng: Number(p.lng),
    schedule: p.schedule || '',
    info: p.info || '',
    verified: !!p.verified,
    createdBy: p.createdBy || null
  };
}

function persistPrefs(){
  saveLS(LS_KEYS.PREF_SPORT, document.getElementById('sportFilter').value);
  saveLS(LS_KEYS.PREF_SEARCH, document.getElementById('searchText').value.trim());
}

function debounce(fn, ms){ let t; return (...args)=>{ clearTimeout(t); t=setTimeout(()=>fn(...args), ms) } }
function escapeHtml(str){ return String(str).replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[s])); }

// ===== Modo añadir / marcador temporal =====
function toggleAddMode(){ setAddMode(!addMode); }
function setAddMode(state){
  addMode = state;
  const btn = document.getElementById('btnAddMode');
  const panel = document.getElementById('addPanel');

  if(addMode){
    btn.textContent = '✅ Añadiendo (clic en el mapa)';
    btn.classList.remove('button--ghost');
    panel.hidden = false;
  }else{
    btn.textContent = '➕ Añadir';
    btn.classList.add('button--ghost');
    panel.hidden = true;
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

// ===== Favoritos =====
function getFavorites(){ return new Set(readLS(LS_KEYS.FAVORITES, [])); }
function setFavPanel(open){ 
  favPanelOpen = open; 
  document.getElementById('favPanel').hidden = !open; 
  renderFavoritesPanel();
}
function toggleFavPanel(){ setFavPanel(!favPanelOpen); }
function renderFavoritesPanel(){
  if(!favPanelOpen) return;
  const favs = getFavorites();
  const favArr = currentData.filter(x => favs.has(x.id));
  const listEl = document.getElementById('favList');
  if(favArr.length === 0){
    listEl.innerHTML = `<p style="opacity:.85;">No tienes favoritos aún. Usa el botón “${'☆ Agregar a favoritos'}” en el mapa.</p>`;
    return;
  }
  listEl.innerHTML = favArr.map(p => `
    <div class="side-item">
      <h4>${escapeHtml(p.name)}</h4>
      <small><strong>Deporte:</strong> ${escapeHtml(p.sport)}</small>
      ${p.schedule ? `<small><strong>Horario:</strong> ${escapeHtml(p.schedule)}</small>` : ''}
      <div class="side-actions">
        <button class="button button--ghost" data-action="open" data-id="${p.id}">📍 Abrir</button>
        <button class="button button--ghost" data-action="unfav" data-id="${p.id}">✖ Quitar</button>
      </div>
    </div>
  `).join('');
}
function openPlace(id){
  const p = currentData.find(x => x.id === id);
  if(!p) return;
  map.setView([p.lat, p.lng], Math.max(map.getZoom(), 15));
  const m = allMarkers.find(mk => {
    const ll = mk.getLatLng(); return Math.abs(ll.lat - p.lat) < 1e-9 && Math.abs(ll.lng - p.lng) < 1e-9;
  });
  if(m){ m.openPopup(); }
}

// ===== Cerca de mí =====
function toggleNearPanel(){ setNearPanel(!nearPanelOpen); }
function setNearPanel(open){
  nearPanelOpen = open;
  document.getElementById('nearPanel').hidden = !open;
  setNearStatus(nearCenter ? `Centro: ${nearCenter.lat.toFixed(5)}, ${nearCenter.lng.toFixed(5)} · Radio: ${nearRadiusKm} km` : 'Elige centro y radio.');
  // Sin re-render automático aquí para que el usuario pueda ajustar primero
}
function setNearStatus(text){ document.getElementById('nearStatus').textContent = text; }

function syncNearRange(src, dst){
  const v = Math.max(0.2, Math.min(20, Number(src.value) || 3));
  nearRadiusKm = Number(v.toFixed(1));
  src.value = nearRadiusKm;
  dst.value = nearRadiusKm;
}
function useGeolocation(){
  if(!navigator.geolocation){
    alert('Geolocalización no disponible en este navegador.');
    return;
  }
  navigator.geolocation.getCurrentPosition(
    pos => {
      const { latitude, longitude } = pos.coords;
      setNearCenter(latitude, longitude, true);
      setNearStatus('Centro establecido con tu ubicación.');
    },
    err => {
      alert('No se pudo obtener tu ubicación. Permite el acceso o inténtalo de nuevo.');
      console.warn(err);
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
  );
}
function enablePickCenter(){
  pickCenterMode = true;
  setNearStatus('Haz clic en el mapa para fijar el centro.');
}
function setNearCenter(lat, lng, zoomToCircle=false){
  nearCenter = { lat, lng };
  // dibujar/actualizar marcador y círculo
  if(!nearCenterMarker){
    nearCenterMarker = L.marker([lat, lng], { title: 'Centro del filtro' }).addTo(map);
  }else{
    nearCenterMarker.setLatLng([lat, lng]);
  }
  updateNearCircle();
  if(zoomToCircle && nearCircle){
    map.fitBounds(nearCircle.getBounds(), { padding: [20,20] });
  }
}
function updateNearCircle(){
  if(!nearCenter) return;
  const radiusMeters = nearRadiusKm * 1000;
  if(!nearCircle){
    nearCircle = L.circle([nearCenter.lat, nearCenter.lng], {
      radius: radiusMeters,
      color: '#7fd6ff',
      fillColor: '#7fd6ff',
      fillOpacity: 0.12,
      weight: 2
    }).addTo(map);
  }else{
    nearCircle.setLatLng([nearCenter.lat, nearCenter.lng]);
    nearCircle.setRadius(radiusMeters);
  }
}

function clearNearFilter(){
  nearCenter = null;
  nearRadiusKm = 3;
  pickCenterMode = false;
  if(nearCircle){ nearCircle.remove(); nearCircle = null; }
  if(nearCenterMarker){ nearCenterMarker.remove(); nearCenterMarker = null; }
  document.getElementById('nearRange').value = 3;
  document.getElementById('nearRangeNum').value = 3;
  setNearStatus('Filtro desactivado.');
  render();
}

// ===== Render / filtros / stats =====
function applyFilters(list){
  const sport = document.getElementById('sportFilter').value;
  const q = document.getElementById('searchText').value.trim().toLowerCase();
  let out = list.filter(l =>
    (!sport || l.sport === sport) &&
    (!q || (l.name + ' ' + l.sport).toLowerCase().includes(q))
  );

  // Filtro por distancia si hay centro y radio
  if(nearCenter && nearRadiusKm > 0){
    out = out.filter(p => {
      const d = map.distance([nearCenter.lat, nearCenter.lng], [p.lat, p.lng]); // metros
      return d <= nearRadiusKm * 1000;
    });
  }
  return out;
}

function render(){
  // limpiar marcadores
  allMarkers.forEach(m => m.remove());
  allMarkers = [];

  const filtered = applyFilters(currentData);
  const favs = getFavorites();
  const myId = getDeviceId();

  filtered.forEach(p => {
    const marker = L.marker([p.lat, p.lng], { title: p.name }).addTo(map);
    const isFav = favs.has(p.id);
    const favLabel = isFav ? '★ Quitar de favoritos' : '☆ Agregar a favoritos';

    const actionsLeft = `
      <button onclick="showInfo('${p.id}')" class="button button--ghost">ℹ️ Información</button>
      <button onclick="toggleFavorite('${p.id}')" class="button button--ghost">${favLabel}</button>
    `;
    const actionsRight = (p.createdBy && p.createdBy === myId)
      ? `<button onclick="deleteLocation('${p.id}')" class="button button--ghost">🗑️ Eliminar</button>`
      : '';

    const popupHtml = `
      <div class="popup">
        <h4 class="popup-title">${escapeHtml(p.name)}</h4>
        <div class="popup-meta">
          <small><strong>Deporte:</strong> ${escapeHtml(p.sport)}</small>
          ${p.schedule ? `<small><strong>Horario:</strong> ${escapeHtml(p.schedule)}</small>` : ''}
        </div>
        <div class="popup-actions">
          <div class="left">${actionsLeft}</div>
          <div class="right">${actionsRight}</div>
        </div>
      </div>
    `;
    marker.bindPopup(popupHtml);
    allMarkers.push(marker);
  });

  const stats = computeStats(filtered, favs);
  const nearText = nearCenter ? ` · En radio: ${filtered.length}` : '';
  document.getElementById('statsBar').textContent =
    `Lugares: ${filtered.length} · Top: ${stats.topSport} · Favoritos: ${stats.favCount}${nearText}`;

  renderFavoritesPanel(); // mantener panel sincronizado
}

function computeStats(list, favsSet){
  const bySport = list.reduce((a,l)=> (a[l.sport]=(a[l.sport]||0)+1, a), {});
  const topSport = Object.entries(bySport).sort((a,b)=>b[1]-a[1])[0]?.[0] || '—';
  const favCount = Array.from(favsSet).filter(id => list.some(x=>x.id===id)).length;
  return { topSport, favCount };
}

// ===== Guardar / Eliminar / Favoritos =====
function saveLocation(){
  const name = document.getElementById('name').value.trim();
  const sport = document.getElementById('sport').value;
  const schedule = document.getElementById('hours').value.trim();
  const info = document.getElementById('more').value.trim();

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

  // limpiar y salir del modo
  document.getElementById('name').value = '';
  document.getElementById('hours').value = '';
  document.getElementById('more').value = '';
  if(tempMarker){ tempMarker.remove(); tempMarker = null; }
  tempLatLng = null;
  setAddMode(false);

  render();
  alert(`Ubicación "${item.name}" guardada.`);
}

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
}

function toggleFavorite(id){
  const favs = getFavorites();
  if(favs.has(id)) favs.delete(id); else favs.add(id);
  saveLS(LS_KEYS.FAVORITES, Array.from(favs));
  render();
}

// ===== Información (modal) =====
function showInfo(id){
  const item = currentData.find(x => x.id === id);
  if(!item) return;
  document.getElementById('infoTitle').textContent = item.name;
  document.getElementById('infoBody').innerHTML = `
    <p><strong>Deporte:</strong> ${escapeHtml(item.sport)}</p>
    ${item.schedule ? `<p><strong>Horario:</strong> ${escapeHtml(item.schedule)}</p>` : ''}
    ${item.info ? `<p><strong>Más información:</strong><br>${escapeHtml(item.info)}</p>` : '<p>No hay información adicional.</p>'}
    <p style="opacity:.7"><small>Ubicación: ${item.lat.toFixed(5)}, ${item.lng.toFixed(5)}</small></p>
  `;
  document.getElementById('infoModal').hidden = false;
}
function hideInfo(){ document.getElementById('infoModal').hidden = true; }
