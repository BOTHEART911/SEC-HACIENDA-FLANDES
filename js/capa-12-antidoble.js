/* ============================================================
   CAPA 12 — ANTI DOBLE CLIC  ·  SEC-HACIENDA (FASE 4)
   Se carga DESPUÉS de app.js y de las capas de la Fase 3.
   No modifica app.js: envuelve en caliente apiGet/apiPost y
   escucha en window (fase de captura), así cubre por igual los
   130 addEventListener('click') de app.js, los 33 onclick= del
   index.html y cualquier botón creado a mano.

   Dos protecciones:
     A) CANDADO DEL CONTROL — el botón que disparó la operación
        queda sordo hasta que la operación termina. Es invisible
        mientras la espera no se note (260 ms); solo entonces se
        atenúa y cambia el cursor.
     B) ESCUDO DE PANTALLA — mientras hay una petición en vuelo,
        toda la pantalla ignora los toques. Se salvan a propósito:
        las SALIDAS (atrás / cancelar / cerrar), el botón de tema
        y los diálogos de SweetAlert (si no, un diálogo abierto
        durante una petición quedaría muerto).

   Además clasifica las peticiones en dos clases:
     · de usuario  → levantan el escudo
     · silenciosas → las del motor EN VIVO (js/en-vivo.js). No
       levantan el escudo y esconden el loader de pantalla.

   Los estilos los inyecta este mismo archivo (no toca styles.css).
   ============================================================ */
(function () {
  'use strict';

  /* ── Tiempos ──────────────────────────────────────────── */
  var COLA_MS   = 140;    /* margen tras la última respuesta      */
  var ESPERA_MS = 500;    /* si el clic no pide red, se suelta    */
  var POLL_MS   = 40;     /* cada cuánto se revisa el candado     */
  var TICK_MS   = 120;    /* latido del escudo                    */
  var DIM_MS    = 260;    /* a partir de aquí se nota la espera   */
  var MAX_MS    = 20000;  /* seguro: nunca bloquear más de 20 s   */
  var GESTO_MS  = 1500;   /* una petición "de usuario" nace justo
                             después de un toque; las de arranque y
                             las de fondo NO deben cegar la pantalla */
  var MAX_ESCUDO_MS = 15000; /* seguro del escudo: nunca más de 15 s */

  var LECTURAS_DE_VISTA = {
    listsolicitudes: 1, listatenciones: 1, listprocesos: 1, listpredial: 1,
    getpredial: 1, getsolicitudbyid: 1, listdriverows: 1, listmisexpedientes: 1,
    buscarmisexpedientes: 1, descargaopciones: 1, getpredialbloque: 1
  };

  var ATRIBUTO = 'data-hac-busy';
  var CLASE_DIM = 'hac12-dim';

  /* Controles reales de esta app (leídos de index.html y app.js) */
  var CONTROLES = [
    'button', '[role="button"]', 'input[type="submit"]', 'input[type="button"]',
    '.pin-key', '.idn-key', '.chip', '.panel-tab', '.login-tab', '.cat-pill',
    '.icon-btn', '.icon-in-input', '.proc-icon-btn', '.bdp-icon-btn',
    '.proc-action-btn', '.estad-pager-btn', '.pdf-acc', '.tema-btn'
  ];
  var SEL_CONTROL = CONTROLES.join(',');
  var SEL_SIN_CANDADO = '.idn-key, .pin-key, #idn-ojo, [data-ojo-de]';
  var SEL_SIN_CANDADO = '.idn-key, .pin-key, #idn-ojo, [data-ojo-de]';

  /* Salidas: nunca se bloquean (uno puede equivocarse de vista y no
     debe esperar a que cargue para poder salir). */
  var SALIDAS = [
    '#lista-back', '#resp-back', '#add-back', '#btn-drive-back-edit',
    '#btn-asignaciones-back', '#btn-proc-add-back', '#btn-ver-asignacion-back',
    '#btn-edit-asig-back', '#panel-back-btn', '#atenc-back', '#btn-bdp-back',
    '#btn-bdp-form-back', '#btn-bdp-det-back', '#btn-bdp-exp-atras',
    '#btn-bdp-arch-atras', '#btn-chat-close', '#proc-lightbox-close',
    '#btn-cerrar-respuesta-limpia', '#btn-sp-cancelar', '#btn-dec-cancelar',
    '#btn-bdp-dec-cancelar', '#btn-bdp-reb-cancelar', '#btn-expediente-cancelar',
    '#btn-tema', '[data-salida]',
    /* SEC-HACIENDA-FLANDES: el banner (atrás, tema, menú), la portada, el
       tema del login y las capas del kit son salidas: nunca se bloquean. */
    '.kit-banner', '.kit-bien', '.kit-capa', '.kit-conex', '.hf-tema',
    /* FASE 2: los Cancelar/Cerrar de los modales nuevos y el cambio de
       cuenta del ingreso */
    '#pin-cancelar', '#btn-rebote-regresar', '#btn-bdp-exp-salir',
    '#btn-bdp-arch-salir1', '#btn-bdp-arch-salir2', '#idn-volver', '.hf-atras'
  ];
  var SEL_SALIDA = SALIDAS.join(',') + ',.swal2-container';

  /* ══════════════ 1) CONTADORES DE PETICIONES ══════════════ */

  var enVuelo     = 0;   /* peticiones nacidas de un gesto  */
  var fondo       = 0;   /* peticiones de arranque o de fondo */
  var silenciosas = 0;   /* peticiones del motor EN VIVO    */
  var tFin        = 0;
  var tInicio     = 0;   /* cuándo empezó la tanda en vuelo */
  var ultimoGesto = 0;

  function esperando_() {
    if (enVuelo > 0) {
      if (tInicio && (Date.now() - tInicio) > MAX_ESCUDO_MS) return false;  /* seguro */
      return true;
    }
    return !!tFin && (Date.now() - tFin) < COLA_MS;
  }

  function cerrar_(clase) {
    if (clase === 'silencio') silenciosas = Math.max(0, silenciosas - 1);
    else if (clase === 'fondo') fondo = Math.max(0, fondo - 1);
    else {
      enVuelo = Math.max(0, enVuelo - 1);
      tFin = Date.now();
      if (enVuelo === 0) tInicio = 0;
    }
    pintarSilencio_();
  }

  /* De dónde nace la petición: del motor EN VIVO, de un toque del
     usuario, o del arranque / de un proceso de fondo. */
  function clasificar_() {
    if (window.__HAC_SILENCIO) return 'silencio';
    if (ultimoGesto && (Date.now() - ultimoGesto) < GESTO_MS) return 'usuario';
    return 'fondo';
  }

  /* Envuelve apiGet/apiPost. Son declaraciones de función: viven en
     window, y app.js / identidad.js / configuracion.js las llaman por
     nombre suelto, así que ven el reemplazo. */
  function envolverRed_() {
    ['apiGet', 'apiPost'].forEach(function (nombre) {
      var original = window[nombre];
      if (typeof original !== 'function' || original.__hac12) return;
      var envuelto = function () {
        var clase = clasificar_();
        /* 29/09 — las LECTURAS de una vista (listas y detalles) ya no ciegan
           la pantalla: si la persona toca otro botón mientras cargan, esa
           lectura se corta (js/corte.js) y la vista nueva entra al instante.
           Antes el escudo se tragaba ese toque. Los guardados siguen igual. */
        if (nombre === 'apiGet' && clase === 'usuario' &&
            LECTURAS_DE_VISTA[String(arguments[0] || '').toLowerCase()]) clase = 'fondo';
        if (clase === 'silencio') silenciosas++;
        else if (clase === 'fondo') fondo++;
        else { enVuelo++; if (enVuelo === 1) tInicio = Date.now(); }
        pintarSilencio_();
        var p;
        try { p = original.apply(this, arguments); }
        catch (e) { cerrar_(clase); throw e; }
        return Promise.resolve(p).then(
          function (v) { cerrar_(clase); return v; },
          function (e) { cerrar_(clase); throw e; }
        );
      };
      envuelto.__hac12 = true;
      envuelto.__original = original;
      window[nombre] = envuelto;
    });
  }

  /* Mientras solo corren peticiones silenciosas se esconde el loader
     de pantalla completa (si no, cada aviso del EN VIVO taparía la
     app con el desenfoque). Si el usuario pide algo, vuelve. */
  function pintarSilencio_() {
    try {
      if (!document.body) return;
      document.body.classList.toggle('hac-silencio',
        (silenciosas > 0 || fondo > 0) && enVuelo === 0);
    } catch (e) {}
  }

  /* ══════════════ 2) CANDADO DEL CONTROL ══════════════ */

  function exento_(destino) {
    if (!destino || !destino.closest) return false;
    return !!destino.closest(SEL_SALIDA);
  }

  function ocupado_(el) {
    return !!(el && el.getAttribute && el.getAttribute(ATRIBUTO) === '1');
  }

  function soltar_(el, temporizador) {
    if (temporizador) clearInterval(temporizador);
    if (!el) return;
    if (el.removeAttribute) el.removeAttribute(ATRIBUTO);
    if (el.classList) el.classList.remove(CLASE_DIM);
  }

  function candado_(el) {
    if (!el || el.disabled || ocupado_(el)) return;
    el.setAttribute(ATRIBUTO, '1');
    var t0    = Date.now();
    var base  = enVuelo;
    var subio = false;
    var temporizador = setInterval(function () {
      var ahora = Date.now();
      /* el atuendo visual solo si la espera se nota */
      if (subio && (ahora - t0) > DIM_MS && el.classList) el.classList.add(CLASE_DIM);
      if (ahora - t0 > MAX_MS) { soltar_(el, temporizador); return; }
      if (!subio) {
        if (enVuelo > base) { subio = true; return; }
        /* el clic no pidió red: era una acción visual */
        if (ahora - t0 > ESPERA_MS) soltar_(el, temporizador);
        return;
      }
      if (!esperando_()) soltar_(el, temporizador);
    }, POLL_MS);
  }

  /* ══════════════ 3) ESCUDO DE PANTALLA ══════════════ */

  function tragar_(ev, suave) {
    if (suave) { ev.stopPropagation(); return; }   /* deja vivo el scroll */
    if (ev.cancelable) ev.preventDefault();
    ev.stopPropagation();
    if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();
  }

  function montarEscudo_() {
    var suaves = { pointerdown: 1, touchstart: 1 };
    ['pointerdown', 'touchstart', 'mousedown', 'mouseup', 'pointerup', 'click']
      .forEach(function (tipo) {
        window.addEventListener(tipo, function (ev) {
          if (exento_(ev.target)) { ultimoGesto = Date.now(); return; }
          if (esperando_()) { tragar_(ev, suaves[tipo]); return; }
          ultimoGesto = Date.now();
          if (tipo !== 'click') return;
          var el = ev.target && ev.target.closest ? ev.target.closest(SEL_CONTROL) : null;
          if (!el) return;
          /* FASE 4 — teclas del PIN y ojos: se tocan rápido y a veces la misma
             dos veces (PIN 1122). El candado de 500 ms se comía el segundo
             toque. Siguen bajo el escudo mientras haya una petición en vuelo. */
          if (el.matches && el.matches(SEL_SIN_CANDADO)) return;
          /* FASE 4 — teclas del PIN y ojos: se tocan rápido y a veces la misma
             dos veces (PIN 1122). El candado de 500 ms se comía el segundo
             toque. Siguen bajo el escudo mientras haya una petición en vuelo. */
          if (el.matches && el.matches(SEL_SIN_CANDADO)) return;
          if (ocupado_(el)) { tragar_(ev); return; }   /* 2.º toque */
          candado_(el);
        }, true);
      });
  }

  /* Latido: cursor de espera en toda la pantalla solo si se nota */
  function montarLatido_() {
    var desde = 0;
    setInterval(function () {
      var hay = esperando_();
      if (hay && !desde) desde = Date.now();
      if (!hay) desde = 0;
      var marcar = !!desde && (Date.now() - desde) > DIM_MS;
      try {
        if (document.body) document.body.classList.toggle('hac12-esperando', marcar);
      } catch (e) {}
    }, TICK_MS);
  }

  /* ══════════════ 4) ESTILOS ══════════════ */

  function prefijar_(lista, prefijo, regla) {
    return lista.map(function (s) { return prefijo + ' ' + s; }).join(',') + regla;
  }

  function montarEstilos_() {
    if (document.getElementById('hac12-css')) return;
    var s = document.createElement('style');
    s.id = 'hac12-css';
    s.textContent =
      /* control con candado que ya se nota */
      '.' + CLASE_DIM + '{opacity:.62;cursor:progress!important;}' +
      '.' + CLASE_DIM + ':hover{filter:none!important;}' +
      '.' + CLASE_DIM + ':active{transform:none!important;}' +
      /* :disabled — en styles.css solo existía una regla (.estad-pager-btn) */
      'button:disabled,.btn:disabled,.btn-primary:disabled{opacity:.55;cursor:not-allowed!important;}' +
      'button:disabled:hover,.btn-primary:disabled:hover{filter:none!important;}' +
      'button:disabled:active,.btn-primary:disabled:active{transform:none!important;}' +
      /* cursor de espera en toda la pantalla */
      prefijar_(CONTROLES, 'body.hac12-esperando', '{cursor:progress!important;}') +
      /* menos en las salidas, que siguen vivas */
      prefijar_(SALIDAS, 'body.hac12-esperando', '{cursor:pointer!important;}') +
      /* refresco EN VIVO: sin loader de pantalla completa */
      'body.hac-silencio #loader{opacity:0!important;pointer-events:none!important;}';
    (document.head || document.documentElement).appendChild(s);
  }

  /* ══════════════ 5) ARRANQUE ══════════════ */

  function arrancar_() {
    if (window.__HAC12_LISTO) return;   /* nunca montar dos veces */
    window.__HAC12_LISTO = true;
    montarEstilos_();
    envolverRed_();
    montarEscudo_();
    montarLatido_();
  }

  window.HAC12 = {
    enVuelo:     function () { return enVuelo; },
    fondo:       function () { return fondo; },
    silenciosas: function () { return silenciosas; },
    esperando:   esperando_,
    ocupado:     ocupado_,
    CONTROLES:   CONTROLES,
    SALIDAS:     SALIDAS
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', arrancar_);
  } else {
    arrancar_();
  }
})();
