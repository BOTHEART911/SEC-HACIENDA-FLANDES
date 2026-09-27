/* ============================================================
   EN VIVO — FASE 4 · SEC-HACIENDA
   Las vistas se actualizan por aviso de Firebase, no por reloj.
   Reusa el proyecto que ya trae la app (semaforo-hacienda) y su
   SDK compat 10.12.2: no se carga nada nuevo.

   Cómo funciona
     1) Cada cambio guardado por la app "sella" un nodo:
          <base>/<coleccion> = { t: <hora servidor>, por: <cliente> }
        Colecciones: solicitudes · procesos · predial · drive · usuarios.
     2) Todos los demás dispositivos oyen ese nodo (onValue) y, si la
        vista abierta depende de esa colección, la recargan EN SILENCIO
        (sin loader, conservando filtro, pestaña, página y scroll).
     3) Lo que cambia FUERA de la app (las solicitudes que entran por
        WhatsApp y las escribe otro sistema) lo sella el vigía del
        backend (EnVivo.gs, disparador de 1 minuto).

   Ruta del nodo
     FASE 12: se usa /chats/__envivo (permitido por las reglas de hoy y
     el mismo nodo que sella el vigía del backend). /meta queda como
     alternativa y ya NO se prueba de entrada, que era lo que sacaba el
     aviso rojo permission_denied en cada arranque. Ver el LEEME.

   Respaldo
     Si Firebase no conecta en 15 s, se reactivan los temporizadores
     originales de app.js para no quedarse sin actualizaciones.

   No modifica app.js: reemplaza en caliente lo que hace falta.
   ============================================================ */
(function () {
  'use strict';

  /* ══════════ FASE 12 — orden de rutas y aviso rojo ══════════
     El aviso "set at /meta/__ping failed: permission_denied" lo escribe
     el propio SDK de Firebase cuando se prueba /meta y las reglas no lo
     permiten: NO se puede atrapar con try/catch, solo se evita no
     probando esa ruta.

     Hasta la Fase 11 se probaba /meta primero y siempre fallaba, así que
     el rojo salía en cada arranque de cada dispositivo. Ahora se prueba
     primero 'chats/__envivo', que es:
       · la que las reglas de la base permiten hoy, y
       · la MISMA que usa el backend por defecto (EnVivo.gs → envivo.ruta).
     Con eso el rojo desaparece y, de paso, navegador y vigía sellan y
     escuchan el mismo nodo (antes podían separarse).

     /meta queda como alternativa: si algún día se añaden sus reglas hay
     que cambiar TAMBIÉN envivo.ruta a 'meta' en Configuración → Avanzado,
     o el vigía sellaría un nodo que nadie oye. Ver el LEEME.

     Además cada dispositivo recuerda la ruta que le funcionó y la prueba
     primero en los arranques siguientes (se olvida a los 7 días). */
  var RUTA_BACKEND = 'chats/__envivo';   /* la de hoy, la del vigía */
  var RUTA_LIMPIA  = 'meta';             /* solo con reglas nuevas */
  var ORDEN = [RUTA_BACKEND, RUTA_LIMPIA];

  var LS_RUTA  = 'hacVivoRuta';
  var LS_FECHA = 'hacVivoRutaTs';
  var OLVIDO_MS = 7 * 24 * 60 * 60 * 1000;

  function rutaRecordada_() {
    try {
      var r  = localStorage.getItem(LS_RUTA) || '';
      var ts = Number(localStorage.getItem(LS_FECHA) || 0);
      if (!r || ORDEN.indexOf(r) < 0) return '';
      if ((Date.now() - ts) > OLVIDO_MS) return '';
      return r;
    } catch (e) { return ''; }
  }

  function recordarRuta_(r) {
    try {
      localStorage.setItem(LS_RUTA, r);
      localStorage.setItem(LS_FECHA, String(Date.now()));
    } catch (e) {}
  }

  /* orden de prueba: primero la recordada, después el orden natural */
  function ordenRutas_() {
    var lista = ORDEN.slice();
    var r = rutaRecordada_();
    var i = lista.indexOf(r);
    if (i > 0) { lista.splice(i, 1); lista.unshift(r); }
    return lista;
  }
  var ESPERA_CONEXION_MS = 15000;
  var REBOTE_MS = 400;          /* junta avisos seguidos */

  var CLIENTE = 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

  /* acción del backend (en minúsculas) -> colección que toca */
  var ACCION_COL = {
    marcaraldia: 'solicitudes', marcarnoencontrado: 'solicitudes',
    guardarrespuesta: 'solicitudes', agregarsolicitudpresencial: 'solicitudes',
    marcarrespuesta: 'solicitudes', dardebajasolicitud: 'solicitudes',

    agregarproceso: 'procesos', editarproceso: 'procesos', firmarproceso: 'procesos',
    eliminarproceso: 'procesos', rebotarproceso: 'procesos', guardarexpediente: 'procesos',
    /* 17/09 — SOLICITUD EXPEDIENTE (js/solicitud-exp.js) */
    solicitudexpproceso: 'procesos', solicitudexppredial: 'predial',

    agregarpredial: 'predial', editarpredial: 'predial', eliminarpredial: 'predial',
    decisionpredial: 'predial', rebotarpredial: 'predial',
    setexpedientearchivo: 'predial', eliminarexpedientearchivo: 'predial',

    updatedrivecorreo: 'drive',

    usuariocrear: 'usuarios', usuarioguardar: 'usuarios',
    usuarioestado: 'usuarios', usuariopin: 'usuarios'
  };

  /* vista -> de qué colección vive y cómo se recarga.
     Todas son declaraciones de función: viven en window. */
  var ultimoEstadoLista = 'PENDIENTE';

  var VISTAS = {
    'view-lista': {
      col: 'solicitudes', filtro: 'lista-filter',
      f: function () { return window.loadAndRenderList_(ultimoEstadoLista); }
    },
    'view-atenciones': {
      col: 'solicitudes', filtro: 'atenc-filter',
      f: function () { return window.atencionesLoadAll_(); }
    },
    'view-asignaciones': {
      col: 'procesos', filtro: 'proc-filter',
      f: function () { return window.loadAndRenderProcesos_(); }
    },
    'view-bd-predial': {
      col: 'predial', filtro: 'bdp-filter',
      f: function () { return window.loadBDPredial_(); }
    },
    'view-drive-anexos': {
      col: 'drive',
      f: function () { return window.loadDriveData_(); }
    }
    /* view-estadisticas queda FUERA a propósito: repintar las gráficas
       debajo del usuario es peor que esperar; se recarga al entrar. */
  };

  var db = null, refBase = null, ruta = '';
  var sellos = {};        /* colección -> último sello visto */
  var sucias = {};        /* colecciones cambiadas mientras no se podía refrescar */
  var vivo = false, rebote = null, refrescando = false;

  /* ══════════════ utilidades ══════════════ */

  function existe(f) { return typeof f === 'function'; }
  function $(id) { return document.getElementById(id); }

  function vistaActiva_() {
    var v = document.querySelector('.view.active');
    return v ? v.id : '';
  }

  /* Las 10 capas reales del index (mismo criterio que la Fase 3:
     #modal-chat no usa .hidden sino .open). Los demás id que empiezan
     por "modal-" son piezas de adentro, no capas. */
  var CAPAS = ['modal-respuesta-limpia', 'modal-rebotar', 'modal-solicitar-proceso',
               'modal-decision', 'modal-chat', 'modal-expediente', 'modal-bdp-decision',
               'modal-bdp-rebotar', 'modal-bdp-expedientes', 'modal-bdp-archivo'];

  function abierta_(el) {
    if (!el) return false;
    if (el.id === 'modal-chat') return el.classList.contains('open');
    return !el.classList.contains('hidden');
  }

  /* ¿hay algo encima que no se debe pisar? */
  function tapado_() {
    if (document.querySelector('.swal2-container')) return true;
    for (var i = 0; i < CAPAS.length; i++) { if (abierta_($(CAPAS[i]))) return true; }
    /* si está escribiendo, tampoco (menos en los buscadores de la vista) */
    var FILTROS = ['lista-filter', 'proc-filter', 'bdp-filter', 'atenc-filter', 'drive-filter'];
    var a = document.activeElement;
    if (a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) && FILTROS.indexOf(a.id) === -1) return true;
    return false;
  }

  /* ══════════════ aviso discreto ══════════════ */

  function montarEstilos_() {
    if ($('hac-envivo-css')) return;
    var s = document.createElement('style');
    s.id = 'hac-envivo-css';
    s.textContent =
      '#hac-envivo-chip{position:fixed;left:50%;bottom:18px;transform:translate(-50%,14px);' +
      'z-index:20050;pointer-events:none;opacity:0;transition:opacity .18s ease,transform .18s ease;' +
      'background:rgba(6,64,43,.94);color:#fff;font-size:12.5px;font-weight:600;' +
      'padding:7px 14px;border-radius:999px;box-shadow:0 6px 18px rgba(0,0,0,.22);}' +
      '#hac-envivo-chip.ver{opacity:1;transform:translate(-50%,0);}' +
      'html[data-tema="oscuro"] #hac-envivo-chip{background:rgba(20,40,32,.96);}';
    (document.head || document.documentElement).appendChild(s);
  }

  var chipTimer = null;
  function chip_(texto) {
    montarEstilos_();
    var c = $('hac-envivo-chip');
    if (!c) {
      c = document.createElement('div');
      c.id = 'hac-envivo-chip';
      document.body.appendChild(c);
    }
    c.textContent = texto;
    c.classList.add('ver');
    if (chipTimer) clearTimeout(chipTimer);
    chipTimer = setTimeout(function () { c.classList.remove('ver'); }, 1900);
  }

  /* ══════════════ refresco en silencio ══════════════ */

  function reaplicarFiltro_(conf) {
    if (!conf.filtro) return;
    var el = $(conf.filtro);
    if (!el || !String(el.value || '').trim()) return;
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function refrescarVista_(col) {
    var id = vistaActiva_();
    var conf = VISTAS[id];
    if (!conf || conf.col !== col) return false;
    if (!existe(conf.f)) return false;
    if (refrescando) return false;
    if (tapado_()) { sucias[col] = true; return false; }

    refrescando = true;
    var y = window.scrollY;
    var p;
    /* La bandera solo tiene que durar la parte SÍNCRONA: todos estos
       cargadores llaman a apiGet en su primera línea. */
    window.__HAC_SILENCIO = true;
    try { p = conf.f(); }
    catch (e) { window.__HAC_SILENCIO = false; refrescando = false; return false; }
    window.__HAC_SILENCIO = false;

    Promise.resolve(p).then(function () {
      reaplicarFiltro_(conf);
      try { window.scrollTo(0, y); } catch (e) {}
      chip_('Actualizado');
    }).catch(function () {
      /* silencioso a propósito: no se molesta al usuario por un fallo puntual */
    }).then(function () { refrescando = false; });
    return true;
  }

  /* al entrar a una vista sucia, se recarga sola */
  function engancharVistas_() {
    var original = window.showView;
    if (!existe(original) || original.__envivo) return;
    var envuelto = function (id) {
      var r = original.apply(this, arguments);
      var conf = VISTAS[id];
      if (conf && sucias[conf.col]) {
        sucias[conf.col] = false;
        setTimeout(function () { refrescarVista_(conf.col); }, 350);
      }
      return r;
    };
    envuelto.__envivo = true;
    window.showView = envuelto;
  }

  /* recordar el último estado pedido en la lista (currentListMode es
     un let de app.js: no vive en window) */
  function engancharLista_() {
    var original = window.loadAndRenderList_;
    if (!existe(original) || original.__envivo) return;
    var envuelto = function (estado) {
      if (estado) ultimoEstadoLista = estado;
      return original.apply(this, arguments);
    };
    envuelto.__envivo = true;
    window.loadAndRenderList_ = envuelto;
  }

  /* ══════════════ sellar cambios propios ══════════════ */

  function sellar_(col) {
    if (!refBase || !col) return;
    try {
      refBase.child(col).set({
        t: window.firebase.database.ServerValue.TIMESTAMP,
        por: CLIENTE
      });
    } catch (e) {}
  }

  function engancharEscrituras_() {
    var original = window.apiPost;
    if (!existe(original) || original.__envivo) return;
    var envuelto = function (accion) {
      var col = ACCION_COL[String(accion || '').toLowerCase()];
      return Promise.resolve(original.apply(this, arguments)).then(function (v) {
        if (col) sellar_(col);
        return v;
      });
    };
    envuelto.__envivo = true;
    window.apiPost = envuelto;
  }

  /* ══════════════ temporizadores viejos ══════════════ */

  var timers = {};
  function apagarTemporizadores_() {
    ['startPendientesAutoRefresh_', 'startAsignacionesAutoRefresh_'].forEach(function (n) {
      if (!existe(window[n]) || window[n].__envivo) return;
      var original = window[n];
      var envuelto = function () { if (!vivo) return original.apply(this, arguments); };
      envuelto.__envivo = true;
      envuelto.__original = original;
      window[n] = envuelto;
      timers[n] = original;
    });
    ['stopPendientesAutoRefresh_', 'stopAsignacionesAutoRefresh_'].forEach(function (n) {
      if (existe(window[n])) { try { window[n](); } catch (e) {} }
    });
  }

  function encenderRespaldo_(motivo) {
    if (vivo) return;
    try { console.warn('[EN VIVO] respaldo por temporizador:', motivo); } catch (e) {}
    /* FASE 12 — timers{} solo se llena dentro de apagarTemporizadores_, y
       eso únicamente pasa cuando el EN VIVO SÍ conectó. Si nunca conectó
       (sin base, sin conexión, reglas cerradas) quedaba vacío y este
       respaldo no encendía nada: se apoyaba en que los relojes de app.js
       hubieran quedado vivos por casualidad. Ahora cae a la función de
       window, que con vivo=false ejecuta la original igual. */
    var id = vistaActiva_();
    if (id === 'view-lista') arrancarReloj_('startPendientesAutoRefresh_');
    if (id === 'view-asignaciones') arrancarReloj_('startAsignacionesAutoRefresh_');
  }

  function arrancarReloj_(nombre) {
    var f = timers[nombre] || (existe(window[nombre]) ? window[nombre] : null);
    if (f) { try { f(); } catch (e) {} }
  }

  /* ══════════════ arranque ══════════════ */

  var primerAviso = true;

  function oir_() {
    refBase.on('value', function (snap) {
      var v = snap.val() || {};
      if (rebote) clearTimeout(rebote);
      rebote = setTimeout(function () {
        /* la primera foto solo se memoriza: no se sabe qué es nuevo */
        var foto = primerAviso;
        primerAviso = false;
        Object.keys(v).forEach(function (col) {
          if (col === '__ping') return;
          var d = v[col] || {};
          var sello = String(d.t || '');
          if (!sello || sellos[col] === sello) return;
          sellos[col] = sello;
          if (foto) return;
          if (d.por === CLIENTE) return;       /* mi propio cambio: ya lo tengo */

          /* FASE 6 — si cambió una hoja de la que dependen los botones
             (a alguien pudieron asignarle su primera fila), se vuelve a
             pedir el alcance en silencio. js/alcance.js decide si de
             verdad hace falta: si ya ve todo, no gasta el viaje. */
          if (col === 'procesos' || col === 'predial' || col === 'solicitudes') {
            try {
              if (window.ALCANCE && typeof window.ALCANCE.recargarSiHaceFalta === 'function') {
                window.ALCANCE.recargarSiHaceFalta();
              }
            } catch (e) {}
          }

          if (!refrescarVista_(col)) sucias[col] = true;
        });
      }, REBOTE_MS);
    }, function (err) {
      encenderRespaldo_('sin lectura: ' + (err && err.message ? err.message : err));
      vivo = false;
    });
  }

  function probar_(rutaCandidata) {
    return new Promise(function (resolve) {
      var r = db.ref(rutaCandidata);
      var listo = false;
      var corte = setTimeout(function () { if (!listo) { listo = true; resolve(false); } }, 6000);
      r.child('__ping').set(window.firebase.database.ServerValue.TIMESTAMP)
        .then(function () { if (!listo) { listo = true; clearTimeout(corte); resolve(true); } })
        .catch(function () { if (!listo) { listo = true; clearTimeout(corte); resolve(false); } });
    });
  }

  /* FASE 12 — prueba las rutas en orden y se queda con la primera que
     deje escribir. Devuelve '' si ninguna sirve. */
  function elegirRuta_(lista, i) {
    if (i >= lista.length) return Promise.resolve('');
    return probar_(lista[i]).then(function (ok) {
      return ok ? lista[i] : elegirRuta_(lista, i + 1);
    });
  }

  function arrancar_() {
    if (window.__HACVIVO_LISTO) return;   /* nunca montar dos veces */
    window.__HACVIVO_LISTO = true;
    if (!existe(window.initFirebase_)) { encenderRespaldo_('sin initFirebase_'); return; }

    var rendicion = setTimeout(function () { encenderRespaldo_('sin conexión'); }, ESPERA_CONEXION_MS);

    window.initFirebase_().then(function (base) {
      if (!base) { clearTimeout(rendicion); encenderRespaldo_('sin base'); return; }
      db = base;
      return elegirRuta_(ordenRutas_(), 0).then(function (elegida) {
        clearTimeout(rendicion);
        if (!elegida) { encenderRespaldo_('reglas de la base no permiten escribir'); return; }
        ruta = elegida;
        recordarRuta_(ruta);
        refBase = db.ref(ruta);
        vivo = true;
        try { console.info('[EN VIVO] activo en /' + ruta); } catch (e) {}
        apagarTemporizadores_();
        engancharEscrituras_();
        engancharLista_();
        engancharVistas_();
        oir_();
      });
    }).catch(function (e) {
      clearTimeout(rendicion);
      encenderRespaldo_(e && e.message ? e.message : 'fallo al iniciar');
    });
  }

  window.HACVIVO = {
    activo:   function () { return vivo; },
    ruta:     function () { return ruta; },
    cliente:  CLIENTE,
    sellos:   function () { return sellos; },
    sucias:   function () { return sucias; },
    VISTAS:   VISTAS,
    ACCION_COL: ACCION_COL,
    refrescar: refrescarVista_,
    sellar:    sellar_
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', arrancar_);
  } else {
    arrancar_();
  }
})();
