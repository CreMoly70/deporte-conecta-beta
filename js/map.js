// Deporte Conecta · Mapa colaborativo con Leaflet + localStorage (v sesión de usuario)
const LS_KEYS = {
  LOCATIONS: 'dc_locations',
  FAVORITES: 'dc_favorites',
  PREF_SPORT: 'dc_pref_sport'
};

let map;
let allMarkers = [];
let currentData = [];
let addMode = false;
let tempMarker = null;
let tempLatLng = null;

// Cerca de mí
let nearCircle = null;
let nearCenterMarker = null;
let selectingCenter = false;

// Autocompletado de lugares
let searchResultsEl = null;

// --- Torneos / Puntos de encuentro ---
let tournamentMode = false;
let tempTournamentMarker = null;
let tempTournamentLatLng = null;

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

  // Prefiltro: solo deporte
  const preSport = readLS(LS_KEYS.PREF_SPORT, '');
  if (preSport) byId('sportFilter').value = preSport;

  // Eventos UI
  byId('sportFilter').addEventListener('change', () => {
    persistPrefs();
    render();
  });

  // Buscador real mejorado (PHOTON)
  const searchInput = byId('searchText');
  setupPlaceSearch(searchInput);

  byId('btnClear').addEventListener('click', clearFilters);

  byId('btnAddMode').addEventListener('click', toggleAddMode);
  byId('btnCancelAdd').addEventListener('click', () => setAddMode(false));
  byId('btnSave').addEventListener('click', saveLocation);

  // ----- Botones para torneos / puntos de encuentro -----
  byId('btnTournamentMode')?.addEventListener('click', toggleTournamentMode);
  byId('btnCancelTournament')?.addEventListener('click', cancelTournamentMode);
  byId('btnSaveTournament')?.addEventListener('click', saveTournament);

  // Click en el mapa: soporte para modo "Añadir" NORMAL y modo "Torneo"
  map.on('click', (e) => {
    const { lat, lng } = e.latlng;

    // Modo ubicación normal
    if (addMode) {
      tempLatLng = { lat, lng };
      ensureTempMarkerAt(lat, lng, true);
      return;
    }

    // Modo torneo / punto de encuentro
    if (tournamentMode) {
      tempTournamentLatLng = { lat, lng };
      ensureTournamentMarkerAt(lat, lng, true);
      return;
    }
  });

  byId('infoClose').addEventListener('click', hideInfo);
  const mb = qs('#infoModal .modal-backdrop');
  if (mb) {
    mb.addEventListener('click', (e) => {
      if (e.target.dataset.close !== undefined || e.target === mb) hideInfo();
    });
  }

  byId('btnFav').addEventListener('click', openFavPanel);
  byId('btnCloseFav').addEventListener('click', closeFavPanel);

  // -------- Panel "Cerca de mí" --------
  const nearPanel   = byId('nearPanel');
  const btnNear     = byId('btnNear');
  const btnCloseNear = byId('btnCloseNear');

  if (btnNear && nearPanel)
    btnNear.addEventListener('click', () => nearPanel.hidden = false);

  if (btnCloseNear && nearPanel)
    btnCloseNear.addEventListener('click', () => nearPanel.hidden = true);

  byId('btnNearClear')?.addEventListener('click', clearNear);
  byId('btnNearLocate')?.addEventListener('click', locateMe);
  byId('btnNearSelect')?.addEventListener('click', startSelectNearCenter);
  byId('btnNearApply')?.addEventListener('click', applyNearFilter);

  // Re-render cada minuto para actualizar tiempos restantes de torneos
  setInterval(render, 60_000);
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
    createdAt: p.createdAt || Date.now(),
    // campos opcionales para torneos / puntos
    tType: p.tType || null,      // 'tournament' | 'meetpoint' | null
    endAt: p.endAt || null       // timestamp ms
  };
}

function persistPrefs(){
  saveLS(LS_KEYS.PREF_SPORT, byId('sportFilter').value);
}

function debounce(fn, ms){
  let t;
  return (...args)=>{
    clearTimeout(t);
    t = setTimeout(()=>fn(...args), ms);
  };
}

function escapeHtml(str){
  return String(str).replace(/[&<>"']/g, s => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'
  }[s]));
}

//
// ============================================================
//   AUTOCOMPLETADO REAL PHOTON API (FUNCIONA DE VERDAD)
// ============================================================
function setupPlaceSearch(input){
  if (!input) return;

  const wrapper = input.parentElement;
  wrapper.style.position = "relative";

  searchResultsEl = document.createElement("ul");
  searchResultsEl.id = "searchResults";
  searchResultsEl.classList.add("search-results");
  searchResultsEl.hidden = true;
  wrapper.appendChild(searchResultsEl);

  let lastQuery = "";

  const doSearch = debounce(async (q)=>{
    if (q.length < 3){
      clearSearchResults();
      return;
    }

    lastQuery = q;

    try {
      const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=6&lang=es`;
      const res = await fetch(url);
      if (!res.ok) return;

      const data = await res.json();
      if (input.value.trim() !== lastQuery) return;

      renderSearchResults(data.features);

    } catch (err){
      console.error("Error buscando lugar:", err);
    }
  }, 300);

  input.addEventListener("input", ()=>{
    const q = input.value.trim();
    doSearch(q);
  });

  input.addEventListener("blur", ()=>{
    setTimeout(() => searchResultsEl.hidden = true, 180);
  });
}

function clearSearchResults(){
  if (!searchResultsEl) return;
  searchResultsEl.innerHTML = "";
  searchResultsEl.hidden = true;
}

function renderSearchResults(items){
  if (!items || items.length === 0){
    clearSearchResults();
    return;
  }

  searchResultsEl.innerHTML = items.map((item, idx)=>{
    const props = item.properties;
    const name =
      props.name ||
      props.city ||
      props.street ||
      props.country ||
      "Lugar encontrado";
    return `<li data-i="${idx}">${escapeHtml(name)}</li>`;
  }).join("");

  searchResultsEl.hidden = false;

  [...searchResultsEl.querySelectorAll("li")].forEach(li=>{
    li.addEventListener("click", ()=>{
      const place = items[li.dataset.i];
      const [lon, lat] = place.geometry.coordinates;

      map.setView([lat, lon], 15);
      searchResultsEl.hidden = true;
    });
  });
}

//
// ============================================================
//   RESTO DEL CÓDIGO (NO MODIFICADO + EXTENSIONES TORNEO)
// ============================================================

function clearFilters(){
  byId('sportFilter').value = '';
  const s = byId('searchText');
  if (s) s.value = '';
  persistPrefs();
  render();
  clearSearchResults();
}

function applyFilters(list){
  const sport = byId('sportFilter').value;
  let filtered = list.filter(l => (!sport || l.sport === sport));

  if (nearCircle) {
    const center = nearCircle.getLatLng();
    const radius = nearCircle.getRadius();
    filtered = filtered.filter(p => map.distance(center, [p.lat, p.lng]) <= radius);
  }
  return filtered;
}

// Elimina torneos/puntos vencidos del array y del localStorage
function filterExpired(list){
  const now = Date.now();
  const kept = [];
  let changed = false;

  for (const p of list){
    if (p.endAt && now > p.endAt){
      changed = true;
      continue;
    }
    kept.push(p);
  }

  if (changed){
    saveLS(LS_KEYS.LOCATIONS, kept);
    currentData = kept;
  }
  return kept;
}

// Devuelve texto de tiempo restante para torneos/puntos
function getRemainingLabel(item){
  if (!item.endAt) return '';

  const diff = item.endAt - Date.now();
  if (diff <= 0) return 'Finalizado';

  const totalMin = Math.round(diff / 60000);
  const hours = Math.floor(totalMin / 60);
  const mins  = totalMin % 60;

  if (hours > 0){
    return `${hours} h ${mins} min`;
  }
  return `${mins} min`;
}

function render(){
  allMarkers.forEach(m => m.remove());
  allMarkers = [];

  // Limpia torneos/puntos vencidos antes de filtrar
  const alive = filterExpired(currentData);
  const filtered = applyFilters(alive);
  const favs = getFavorites();
  const myUserId = DS.getSessionUserId();

  filtered.forEach(p => {
    // Icono especial para torneos / puntos de encuentro
    let markerOptions = { title: p.name };
    if (p.tType === 'tournament' || p.tType === 'meetpoint') {
      const emoji = p.tType === 'tournament' ? '🏆' : '🚩';
      markerOptions.icon = L.divIcon({
        html: emoji,
        className: 'tournament-marker',
        iconSize: [28, 28],
        iconAnchor: [14, 14]
      });
    }

    const marker = L.marker([p.lat, p.lng], markerOptions).addTo(map);
    const isFav = favs.has(p.id);
    const favLabel = isFav ? '★ Quitar de favoritos' : '☆ Agregar a favoritos';

    let creatorBlock = '';
    if (p.createdBy) {
      const u = DS.getUserById(p.createdBy);
      const label = u ? (u.name || u.username || 'Usuario') : String(p.createdBy).slice(0,8);
      creatorBlock = `
        <small style="opacity:.85">Creado por: <strong>@${escapeHtml(label)}</strong></small><br>
        <div class="popup-actions" style="margin-top:6px;">
          <button onclick="viewCreatorProfile('${p.createdBy}')">👤 Ver perfil</button>
        </div>
      `;
    }

    const canDelete = (p.createdBy && p.createdBy === myUserId);

    const actions = `
      <div class="popup-actions" style="margin-top:10px;">
        <div class="left">
          <button onclick="showInfo('${p.id}')">ℹ️ Info</button>
          <button onclick="toggleFavorite('${p.id}')">${favLabel}</button>
        </div>
        <div class="right">
          ${ canDelete ? `<button onclick="deleteLocation('${p.id}')">🗑️ Eliminar</button>` : '' }
        </div>
      </div>
    `;

    // Texto extra si es torneo / punto de encuentro
    let extraMeta = '';
    if (p.tType && p.endAt){
      const label = getRemainingLabel(p);
      const title = p.tType === 'tournament' ? 'Tiempo restante' : 'Válido';
      extraMeta = `<small><strong>${title}:</strong> ${escapeHtml(label)}</small>`;
    }

    // ==========================
    //     NUEVO POPUP PREMIUM
    // ==========================
    marker.bindPopup(`
      <div class="popup">
        <h4 class="popup-title">${escapeHtml(p.name)}</h4>

        ${creatorBlock}

        <div class="popup-meta">
          <small><strong>Deporte:</strong> ${escapeHtml(p.sport)}</small>
          ${p.schedule ? `<small><strong>Horario:</strong> ${escapeHtml(p.schedule)}</small>` : ''}
          ${extraMeta}
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
    // Desactiva modo torneo si estuviera activo
    if (tournamentMode) {
      cancelTournamentMode();
    }
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

// ============= Torneos / Puntos de encuentro =============
function toggleTournamentMode(){
  tournamentMode = !tournamentMode;
  const panel = byId('tournamentPanel');
  const btn = byId('btnTournamentMode');

  if (tournamentMode){
    // Desactiva modo añadir normal
    if (addMode) setAddMode(false);
    if (btn){
      btn.textContent = '🏆 Torneo (activo)';
      btn.classList.add('button--accent');
    }
    if (panel) panel.hidden = false;
    clearTempTournament();
  } else {
    if (btn){
      btn.textContent = '🏆 Torneos';
      btn.classList.remove('button--accent');
    }
    if (panel) panel.hidden = true;
    clearTempTournament();
  }
}

function cancelTournamentMode(){
  tournamentMode = false;
  const panel = byId('tournamentPanel');
  const btn = byId('btnTournamentMode');
  if (panel) panel.hidden = true;
  if (btn){
    btn.textContent = '🏆 Torneos';
    btn.classList.remove('button--accent');
  }
  clearTempTournament();
}

function clearTempTournament(){
  if (tempTournamentMarker){
    tempTournamentMarker.remove();
    tempTournamentMarker = null;
  }
  tempTournamentLatLng = null;
}

function ensureTournamentMarkerAt(lat, lng, open=false){
  if (!tempTournamentMarker){
    tempTournamentMarker = L.marker([lat, lng], {
      draggable: true,
      title: 'Nuevo torneo / punto',
      icon: L.divIcon({
        html: '🏆',
        className: 'tournament-marker',
        iconSize: [28, 28],
        iconAnchor: [14, 14]
      })
    }).addTo(map);

    tempTournamentMarker.on('dragend', () => {
      const pos = tempTournamentMarker.getLatLng();
      tempTournamentLatLng = { lat: pos.lat, lng: pos.lng };
    });
  } else {
    tempTournamentMarker.setLatLng([lat, lng]);
  }

  const html = `<strong>Nuevo torneo / punto</strong><br>Arrastra para ajustar.<br>Lat: ${lat.toFixed(6)} · Lng: ${lng.toFixed(6)}`;
  tempTournamentMarker.bindPopup(html);
  if (open) tempTournamentMarker.openPopup();
}

function saveTournament(){
  if (!DS.isLoggedIn()) { alert('Debes iniciar sesión.'); return; }

  const name = byId('tName').value.trim();
  const tType = byId('tType').value;          // 'tournament' | 'meetpoint'
  const duration = Number(byId('tDuration').value) || 2; // horas
  const info = byId('tInfo').value.trim();
  const tSport = byId('tSport').value;        // ⭐ deporte real del torneo/punto

  if (!tournamentMode){
    alert('Pulsa “🏆 Torneos” para entrar en modo de colocación.');
    return;
  }
  if (!tempTournamentLatLng){
    alert('Haz clic en el mapa para colocar el torneo / punto de encuentro.');
    return;
  }
  if (!name){
    alert('Ingresa un nombre para el torneo / punto.');
    return;
  }

  const now = Date.now();
  const endAt = now + duration * 60 * 60 * 1000;

  const item = normalize({
    name,
    sport: tSport,   // ⭐ se guarda el deporte elegido para que funcione el filtro
    schedule: '',
    info,
    lat: tempTournamentLatLng.lat,
    lng: tempTournamentLatLng.lng,
    verified: false,
    createdBy: DS.getSessionUserId(),
    createdAt: now,
    tType,
    endAt
  });

  const list = readLS(LS_KEYS.LOCATIONS, []);
  list.push(item);
  saveLS(LS_KEYS.LOCATIONS, list);
  currentData = list;

  // limpiar formulario
  byId('tName').value = '';
  byId('tInfo').value = '';
  byId('tDuration').value = '2';
  byId('tType').value = 'tournament';
  byId('tSport').value = 'Fútbol'; // reset por defecto

  clearTempTournament();

  // cerrar modo torneo
  cancelTournamentMode();
  render();

  alert(`Se creó el ${tType === 'tournament' ? 'torneo' : 'punto de encuentro'} "${item.name}".`);
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

function openFavPanel(){
  fillFavPanel();
  byId('favPanel').hidden = false;
}
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

// ============= Información =============
function showInfo(id){
  const item = currentData.find(x => x.id === id);
  if(!item) return;

  let creatorLine = '';
  if (item.createdBy) {
    const u = DS.getUserById(item.createdBy);
    const label = u ? (u.name || u.username || 'Usuario') : String(item.createdBy).slice(0,8);
    creatorLine = `<p><strong>Creador:</strong> @${escapeHtml(label)}</p>`;
  }

  // Texto extra de tiempo si es torneo/punto
  let extra = '';
  if (item.tType && item.endAt){
    const label = getRemainingLabel(item);
    const title = item.tType === 'tournament' ? 'Tiempo restante' : 'Válido';
    extra = `<p><strong>${title}:</strong> ${escapeHtml(label)}</p>`;
  }

  byId('infoTitle').textContent = item.name;
  byId('infoBody').innerHTML = `
    ${creatorLine}
    <p><strong>Deporte:</strong> ${escapeHtml(item.sport)}</p>
    ${item.schedule ? `<p><strong>Horario:</strong> ${escapeHtml(item.schedule)}</p>` : ''}
    ${item.info ? `<p><strong>Más información:</strong><br>${escapeHtml(item.info)}</p>` : '<p>No hay información adicional.</p>'}
    ${extra}
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
