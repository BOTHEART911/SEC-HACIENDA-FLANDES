/* ============================================================
   SEC-HACIENDA-FLANDES · ICONOS PROPIOS DE HACIENDA
   Fase 2 · 27/09/2026

   El kit trae el set de iconos del ecosistema (kit/iconos.js), pero
   Hacienda tiene acciones que las otras apps no tienen: semáforo,
   expediente, balanza de la etapa jurídica, firmar, rebotar, al día,
   no encontrado… Aquí se suman con la MISMA rejilla y el mismo trazo
   (24×24, solo línea, currentColor), para que se lean como un solo set.

   No toca kit/iconos.js (esa pieza es compartida con las 7 apps):
   envuelve K.icono y responde primero con los de aquí.

   También resuelve el paso de las imágenes viejas a iconos: cada botón
   de acción de la app vieja pintaba un PNG/WebP (editar.webp,
   eliminar.webp…). ICO_POR_IMG dice qué icono le corresponde a cada
   una, y js/hacienda.js las cambia por el SVG al pintarse.
   ============================================================ */
(function (raiz) {
  'use strict';

  var K = raiz.KIT;
  if (!K || !K.piezas || !K.piezas.iconos) return;

  var GROSOR = K.piezas.iconos.grosor ? K.piezas.iconos.grosor() : 2.2;

  var PROPIOS = {
    /* ---------- lugares ---------- */
    'casa':
      '<path d="M3.5 11L12 4l8.5 7"/><path d="M5.5 9.5V20h13V9.5"/><path d="M10 20v-5.5h4V20"/>',
    'semaforo':
      '<rect x="7.5" y="2.5" width="9" height="19" rx="3"/>' +
      '<circle cx="12" cy="7" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="12" cy="17" r="1.6"/>' +
      '<path d="M7.5 7H4.5M7.5 12H4.5M19.5 7h-3M19.5 12h-3"/>',
    'carpeta':
      '<path d="M3 7.5a2 2 0 0 1 2-2h4.2l2 2.2H19a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    'carpeta-abierta':
      '<path d="M3 17V7.5a2 2 0 0 1 2-2h4.2l2 2.2H17a2 2 0 0 1 2 2v1.3"/>' +
      '<path d="M3 17l2.6-5.4a2 2 0 0 1 1.8-1.1H20a1 1 0 0 1 .9 1.4L18.6 17.8a2 2 0 0 1-1.8 1.2H5a2 2 0 0 1-2-2z"/>',
    'expediente':
      '<path d="M3 7.5a2 2 0 0 1 2-2h4.2l2 2.2H19a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>' +
      '<path d="M8 12.5h8M8 15.5h5"/>',
    'base-datos':
      '<ellipse cx="12" cy="5.8" rx="7.5" ry="2.8"/>' +
      '<path d="M4.5 5.8v12.4c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8V5.8"/>' +
      '<path d="M4.5 12c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8"/>',
    'equipo':
      '<circle cx="9" cy="8" r="3.2"/><path d="M3.2 19.5a5.8 5.8 0 0 1 11.6 0"/>' +
      '<path d="M15.5 5.2a3.2 3.2 0 0 1 0 5.6"/><path d="M17.2 14.1a5.8 5.8 0 0 1 3.6 5.4"/>',
    'calendario':
      '<rect x="3.5" y="5" width="17" height="15.5" rx="2.4"/><path d="M3.5 10h17"/>' +
      '<path d="M8 3v4M16 3v4"/><path d="M8 14h2M12 14h2M8 17h2"/>',
    'mapa':
      '<path d="M9 4.5L3.5 6.8v13L9 17.5l6 2.5 5.5-2.3v-13L15 7z"/><path d="M9 4.5v13M15 7v13"/>',
    'tendencia':
      '<path d="M3.5 17.5l5.5-5.5 4 4 7.5-7.5"/><path d="M15 8.5h5.5V14"/>',
    'diana':
      '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/>',
    'engranaje':
      '<circle cx="12" cy="12" r="3.1"/>' +
      '<path d="M19.4 13.5a7.7 7.7 0 0 0 0-3l2-1.6-2-3.4-2.4 1a7.6 7.6 0 0 0-2.6-1.5L14 2.5h-4l-.4 2.5A7.6 7.6 0 0 0 7 6.5l-2.4-1-2 3.4 2 1.6a7.7 7.7 0 0 0 0 3l-2 1.6 2 3.4 2.4-1A7.6 7.6 0 0 0 9.6 19l.4 2.5h4l.4-2.5a7.6 7.6 0 0 0 2.6-1.5l2.4 1 2-3.4z"/>',
    'libro':
      '<path d="M4 5.5A2 2 0 0 1 6 3.5h13v14H6a2 2 0 0 0-2 2z"/><path d="M4 19.5A2 2 0 0 0 6 21.5h13v-4"/>' +
      '<path d="M8.5 8h6.5M8.5 11.5h4.5"/>',

    /* ---------- bandejas ---------- */
    'bandeja-entrada':
      '<path d="M3.5 13.5l2.4-7.2A2 2 0 0 1 7.8 5h8.4a2 2 0 0 1 1.9 1.3l2.4 7.2"/>' +
      '<path d="M3.5 13.5V18a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2v-4.5H15.5l-1.2 2.3h-4.6l-1.2-2.3z"/>',
    'bandeja-salida':
      '<path d="M3.5 13.5V18a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2v-4.5H15.5l-1.2 2.3h-4.6l-1.2-2.3z"/>' +
      '<path d="M12 11V2.8"/><path d="M8.6 6.2L12 2.8l3.4 3.4"/>',
    'atencion':
      '<circle cx="12" cy="7.5" r="3.5"/><path d="M5 20.5a7 7 0 0 1 14 0"/><path d="M16.5 3.2l1.2-1.2M19.6 6.4l1.4-.3"/>',

    /* ---------- acciones ---------- */
    'firma':
      '<path d="M3 17.5c2.2-3.8 3.9-5.7 5.1-5.7 1.8 0 .2 5 2.1 5 1.3 0 2.2-2.4 3.5-2.4.9 0 1 1.4 2.1 1.4"/>' +
      '<path d="M14.2 4.8l3.5-1.3 1.3 3.5-6.9 6.9-3.1.6.6-3.1z"/><path d="M3 20.5h18"/>',
    'devolver':
      '<path d="M9 14.5L4 9.5l5-5"/><path d="M4 9.5h10a6 6 0 0 1 0 12h-3"/>',
    'balanza':
      '<path d="M12 3.5v17"/><path d="M7.5 20.5h9"/><path d="M5 7h14"/><path d="M12 5.2L10.8 7"/>' +
      '<path d="M5 7l-2.8 6.5a3 3 0 0 0 5.6 0z"/><path d="M19 7l-2.8 6.5a3 3 0 0 0 5.6 0z"/>',
    'chincheta':
      '<path d="M15 3.5l5.5 5.5-2.2 1.1-3.4 3.4.4 3.9-1.5 1.5-3.4-3.4L6 19.9"/>' +
      '<path d="M8.9 9.6l3.4-3.4 1.1-2.2"/><path d="M7.4 11.1l5.5 5.5"/>',
    'al-dia':
      '<circle cx="12" cy="12" r="8.8"/><path d="M8 12.3l2.7 2.7L16.2 9.4"/>',
    'no-encontrado':
      '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.3 15.3L20.5 20.5"/><path d="M8.3 8.3l4.4 4.4M12.7 8.3l-4.4 4.4"/>',
    'dar-baja':
      '<circle cx="12" cy="12" r="8.8"/><path d="M8 12h8"/>',
    'pin':
      '<rect x="3" y="6.5" width="18" height="11" rx="3"/>' +
      '<circle cx="7.6" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="10.5" cy="12" r="1" fill="currentColor" stroke="none"/>' +
      '<circle cx="13.4" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="16.4" cy="12" r="1" fill="currentColor" stroke="none"/>',
    'salir':
      '<path d="M14.5 4.5H18a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2h-3.5"/><path d="M10 16l-4-4 4-4"/><path d="M6 12h10"/>',
    'cambiar-usuario':
      '<circle cx="9" cy="8" r="3.2"/><path d="M3.2 19.5a5.8 5.8 0 0 1 9.4-4.5"/>' +
      '<path d="M15.5 13.5h6l-2-2M21.5 17.5h-6l2 2"/>',
    'filtro':
      '<path d="M3.5 5h17l-6.5 8v5.5l-4 2V13z"/>',
    'actualizar':
      '<path d="M20 11.5a8 8 0 0 0-14.3-4.6L3.5 9"/><path d="M3.5 4.5V9H8"/>' +
      '<path d="M4 12.5a8 8 0 0 0 14.3 4.6l2.2-2.1"/><path d="M20.5 19.5V15H16"/>',
    'excel':
      '<path d="M14 3.5H6.5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V9z"/><path d="M14 3.5V9h5.5"/>' +
      '<path d="M8.5 12.5l4 5M12.5 12.5l-4 5"/>',
    'recibo':
      '<path d="M6 3.5h12v17l-2.2-1.5-2 1.5-1.8-1.5-1.8 1.5-2-1.5L6 20.5z"/><path d="M9 8h6M9 11.5h6M9 15h3.5"/>',
    'subir':
      '<path d="M12 15.5V4.5"/><path d="M7.5 9L12 4.5 16.5 9"/><path d="M4.5 15v3.5a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V15"/>',
    'chat':
      '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-4.5 4v-4H6.5A2.5 2.5 0 0 1 4 13.5z"/>' +
      '<path d="M8 8.5h8M8 11.5h5"/>',
    'clip-doc':
      '<path d="M14 3.5H6.5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V9z"/><path d="M14 3.5V9h5.5"/><path d="M9 13h6M9 16.5h4"/>',
    'estrella-medalla':
      '<circle cx="12" cy="9" r="5.5"/><path d="M8.5 13.3L7 21l5-2.6 5 2.6-1.5-7.7"/>',
    'dinero':
      '<rect x="2.5" y="6" width="19" height="12" rx="2.2"/><circle cx="12" cy="12" r="2.8"/><path d="M6 9.5v5M18 9.5v5"/>',
    'hoy':
      '<rect x="3.5" y="5" width="17" height="15.5" rx="2.4"/><path d="M3.5 10h17"/><path d="M8 3v4M16 3v4"/>' +
      '<rect x="11" y="13" width="4" height="4" rx=".8" fill="currentColor" stroke="none"/>'
  };

  var original = K.icono;

  function svg(nombre, tam) {
    var t = PROPIOS[nombre];
    if (!t) return original(nombre, tam);
    var n = tam || 20;
    return '<svg class="kit-ico kit-ico--' + nombre + '" viewBox="0 0 24 24"' +
           ' width="' + n + '" height="' + n + '" fill="none" stroke="currentColor"' +
           ' stroke-width="' + GROSOR + '" stroke-linecap="round" stroke-linejoin="round"' +
           ' aria-hidden="true" focusable="false">' + t + '</svg>';
  }

  var P = K.piezas.iconos;
  var hayOriginal = P.hay, nombresOriginal = P.nombres;
  P.svg = svg;
  P.nodo = function (nombre, tam) {
    var c = document.createElement('span');
    c.innerHTML = svg(nombre, tam);
    return c.firstChild;
  };
  P.hay = function (nombre) { return !!PROPIOS[nombre] || hayOriginal(nombre); };
  P.nombres = function () { return nombresOriginal().concat(Object.keys(PROPIOS)); };
  K.icono = svg;

  /* Imagen vieja → icono. Solo las de ACCIÓN: las ilustraciones de las
     categorías del semáforo (categoria1.png…) son dibujos con sentido
     propio y se quedan como están. */
  raiz.ICO_POR_IMG = {
    'editar': 'lapiz', 'eliminar': 'basura', 'mostrar': 'ojo', 'ocultar': 'ojo-tapado',
    'firma': 'firma', 'devolver': 'devolver', 'inbox': 'bandeja-entrada', 'outbox': 'bandeja-salida',
    'memoria': 'libro', 'al-dia': 'al-dia', 'no-found': 'no-encontrado', 'mensaje': 'chat',
    'drive': 'carpeta', 'carpeta-drive': 'carpeta', 'chincheta': 'chincheta', 'juridico': 'balanza',
    'pdf': 'pdf', 'excel': 'excel', 'expediente': 'expediente', 'agregar': 'mas',
    'barras': 'grafica', 'usuarios': 'equipo', 'reloj': 'reloj', 'target': 'diana',
    'calendario': 'calendario', 'mapa': 'mapa', 'tendencia': 'tendencia',
    'notificacion': 'campana', 'chat': 'chat', 'buscar': 'buscar', 'base-de-datos': 'base-datos',
    'semaforo': 'semaforo', 'predial': 'recibo', 'alerta': 'aviso'
  };

  raiz.ICO_ = function (nombre, tam) { return svg(nombre, tam || 20); };
  /* icono pequeño + espacio, para rótulos de botones y pastillas */
  raiz.ICOS = function (nombre, tam) { return svg(nombre, tam || 16) + ' '; };

  /* Las consultas de Insights (capa 11) venían con un emoji cada una. Se
     cambian por el icono del set que dice lo mismo. */
  var EMO = {
    '👀': 'ojo', '🏘️': 'casa', '⏰': 'reloj', '📅': 'calendario', '📆': 'hoy', '🕐': 'reloj',
    '👥': 'equipo', '📝': 'lapiz', '✅': 'al-dia', '⚡': 'velocimetro', '🗓️': 'hoy', '💬': 'chat',
    '📈': 'tendencia', '🏆': 'estrella-medalla', '😴': 'reloj', '🚦': 'semaforo', '🗂️': 'carpeta',
    '🧩': 'diana', '⚖️': 'balanza', '📮': 'sobre', '📎': 'clip', '🔁': 'devolver', '🙋': 'persona',
    '🗒️': 'libro', '🥶': 'aviso', '🗃️': 'expediente', '💰': 'dinero', '📌': 'chincheta',
    '🕰️': 'reloj', '📁': 'carpeta', '🗄️': 'archivo', '📧': 'sobre', '🟢': 'al-dia', '🎯': 'diana',
    '📊': 'grafica', '🚨': 'aviso', '🧑‍💼': 'persona', '🌐': 'globo', '♻️': 'actualizar', '📋': 'documento'
  };
  raiz.icoDeEmoji = function (e, tam) {
    var n = EMO[String(e || '').trim()];
    return n ? svg(n, tam || 16) : String(e || '');
  };
}(window));
