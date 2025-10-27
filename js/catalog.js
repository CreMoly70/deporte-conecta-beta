// Catálogo con info por deporte + atajo para abrir el mapa prefiltrado
const SPORTS_INFO = {
  "Fútbol": {
    resumen: "Deporte de equipo (11 vs 11 o variantes reducidas) cuyo objetivo es marcar goles en la portería rival.",
    como_jugar: [
      "Se juega moviendo el balón principalmente con los pies; manos solo para el portero dentro del área.",
      "Gana quien anota más goles en el tiempo establecido (o al término del partido).",
      "Versiones populares: fútbol 11, 8, 5 (futsal)."
    ],
    reglas_basicas: [
      "Fuera de juego: no recibir el balón detrás de la línea defensiva rival sin cumplir condiciones.",
      "Faltas y tarjetas: amarilla (advertencia) y roja (expulsión).",
      "Saques: banda con las manos, esquina y meta con el pie."
    ],
    beneficios: [
      "Mejora resistencia cardiovascular y coordinación.",
      "Fomenta el trabajo en equipo y la comunicación.",
      "Bajo costo de entrada para empezar."
    ],
    consejos: [
      "Calienta 10–15 min y estira al terminar.",
      "Hidrátate y usa guayos/zapatos adecuados al terreno.",
      "Practica pases cortos y control orientado."
    ],
    equipo_basico: "Balón, tenis/guayos, medias largas y canilleras; portero: guantes.",
    nivel_novato: "Empieza con fútbol 5 o 7 en canchas pequeñas; reglas simples y cambios frecuentes."
  },
  "Baloncesto": {
    resumen: "Deporte de equipo (5 vs 5) donde se intenta encestar el balón en el aro rival.",
    como_jugar: [
      "Bote obligatorio al desplazarse; no se puede caminar con el balón sin botar (pasos).",
      "Puntos: 2/3 según zona de tiro; 1 punto desde tiros libres.",
      "Defensa: individual o en zona."
    ],
    reglas_basicas: [
      "Faltas personales y de equipo; 5 faltas personales implica expulsión.",
      "Violaciones: dobles, pasos, 3 segundos en la zona, 8/24 segundos.",
      "Saque lateral o de fondo tras infracciones."
    ],
    beneficios: [
      "Potencia agilidad, salto y coordinación mano-ojo.",
      "Desarrolla toma de decisiones rápida.",
      "Gran gasto calórico en sesiones cortas."
    ],
    consejos: [
      "Practica mecánica de tiro y bandejas con ambas manos.",
      "Trabaja el drible bajo presión y cambios de ritmo.",
      "Zapatillas con buen agarre y estabilidad de tobillo."
    ],
    equipo_basico: "Balón de baloncesto y zapatillas con amortiguación/soporte.",
    nivel_novato: "Juegos 3x3 en media cancha; reglas simplificadas y posesiones cortas."
  },
  "Voleibol": {
    resumen: "Dos equipos separados por una red buscan que el balón toque el suelo rival en máximo 3 toques por lado.",
    como_jugar: [
      "Técnicas básicas: recepción (mancheta), colocación (toque) y remate.",
      "Rotación de posiciones tras recuperar servicio.",
      "Se juega a sets; gana quien alcanza primero la puntuación objetivo con 2 puntos de diferencia."
    ],
    reglas_basicas: [
      "Máximo 3 toques por equipo antes de pasar el balón.",
      "No se puede agarrar ni retener el balón.",
      "Toque de red y pisar la línea al sacar son faltas."
    ],
    beneficios: [
      "Mejora reflejos, coordinación y saltabilidad.",
      "Trabajo en equipo y comunicación constante.",
      "Bajo impacto en articulaciones (indoor)."
    ],
    consejos: [
      "Aprende a colocarte bajo el balón y usa base estable (piernas flexionadas).",
      "Comunica “mía” para evitar choques.",
      "En playa, usa bloqueador y defensor con roles claros."
    ],
    equipo_basico: "Balón de voleibol (indoor o playa) y calzado para la superficie.",
    nivel_novato: "Juega 3x3 o 4x4 para más toques por persona y aprendizaje rápido."
  },
  "Ciclismo": {
    resumen: "Actividad sobre bicicleta en carretera, montaña o ciudad; ideal para resistencia y exploración.",
    como_jugar: [
      "Mantén cadencia estable (80–100 rpm) y selecciona marchas adecuadas.",
      "Gestiona esfuerzos en subidas y recupera en bajadas.",
      "Señaliza maniobras y respeta normas de tránsito."
    ],
    reglas_basicas: [
      "Uso del casco recomendado/obligatorio según país y rutas.",
      "Circula por la derecha (o según normativa local) y respeta semáforos.",
      "Lleva luces/reflectivos en baja visibilidad."
    ],
    beneficios: [
      "Alto trabajo cardiovascular con bajo impacto.",
      "Fortalece tren inferior y core.",
      "Excelente para turismo activo y movilidad."
    ],
    consejos: [
      "Revisa frenos, presión de llantas y cadena antes de salir.",
      "Lleva hidratación, herramienta básica y cámara de repuesto.",
      "Empieza con rutas planas y aumenta distancia gradualmente."
    ],
    equipo_basico: "Bicicleta en buen estado, casco, guantes y luces; opcional: culotte/maillot.",
    nivel_novato: "Rutas cortas (10–20 km) en ciclovías o parques; sube progresivo."
  },
  "Atletismo": {
    resumen: "Conjunto de disciplinas: carreras, saltos y lanzamientos; base para el desarrollo físico general.",
    como_jugar: [
      "Carreras: mantener técnica de zancada y ritmo según distancia.",
      "Saltos: impulso y caída controlada; lanzamientos con técnica guiada.",
      "Entrena por bloques: técnica, fuerza y resistencia."
    ],
    reglas_basicas: [
      "Carriles asignados en pruebas de velocidad.",
      "Salidas falsas penalizadas.",
      "Intentos limitados en saltos y lanzamientos."
    ],
    beneficios: [
      "Mejora capacidad aeróbica y fuerza funcional.",
      "Desarrollo de disciplina y constancia.",
      "Amplia variedad para todos los niveles."
    ],
    consejos: [
      "Progresión de cargas para evitar lesiones.",
      "Calentamiento dinámico y enfriamiento con estiramientos.",
      "Zapatillas adecuadas a la disciplina (running, clavos, etc.)."
    ],
    equipo_basico: "Ropa deportiva cómoda y calzado específico; accesorios según prueba.",
    nivel_novato: "Correr/caminar por intervalos 1:1 y aumentar el tiempo útil cada semana."
  }
};

document.addEventListener('DOMContentLoaded', () => {
  // Clicks en los botones del catálogo
  document.querySelectorAll('button[data-sport]').forEach(btn => {
    btn.addEventListener('click', () => {
      const sport = btn.getAttribute('data-sport');
      const action = btn.getAttribute('data-action');

      if(action === 'map'){
        localStorage.setItem('dc_pref_sport', JSON.stringify(sport));
        localStorage.setItem('dc_pref_search', JSON.stringify(""));
        window.location.href = 'map.html';
        return;
      }

      if(action === 'info'){
        openInfoModal(sport);
      }
    });
  });

  // Modal events
  document.getElementById('infoClose').addEventListener('click', closeInfoModal);
  document.querySelector('#infoModal .modal-backdrop').addEventListener('click', (e)=>{
    if(e.target.dataset.close) closeInfoModal();
  });
});

function openInfoModal(sport){
  const data = SPORTS_INFO[sport] || {};
  const title = document.getElementById('infoTitle');
  const body = document.getElementById('infoBody');

  title.textContent = sport;

  const section = (h, items) => {
    if(!items || (Array.isArray(items) && items.length===0)) return '';
    if(Array.isArray(items)){
      return `
        <h4 style="margin:.75rem 0 .35rem">${h}</h4>
        <ul style="margin:.2rem 0 .7rem .9rem">
          ${items.map(li=>`<li style="margin:.15rem 0; line-height:1.4">${escapeHtml(li)}</li>`).join('')}
        </ul>
      `;
    }
    return `
      <h4 style="margin:.75rem 0 .35rem">${h}</h4>
      <p style="margin:.2rem 0 .7rem">${escapeHtml(items)}</p>
    `;
  };

  body.innerHTML = `
    ${section('Resumen', data.resumen)}
    ${section('¿Cómo se juega?', data.como_jugar)}
    ${section('Reglas básicas', data.reglas_basicas)}
    ${section('Beneficios de practicarlo', data.beneficios)}
    ${section('Consejos prácticos', data.consejos)}
    ${section('Equipo básico', data.equipo_basico)}
    ${section('Si estás empezando…', data.nivel_novato)}
  `;

  document.getElementById('infoModal').hidden = false;
}

function closeInfoModal(){
  document.getElementById('infoModal').hidden = true;
}

function escapeHtml(str){
  return String(str).replace(/[&<>"']/g, s => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'
  })[s]);
}
