/* ============================================================
   FASE 10 — ESQUELETOS EN LUGAR DEL LOADER  ·  SEC-HACIENDA
   Se carga EL ÚLTIMO (después de js/visor.js), porque envuelve
   apiGet/apiPost por encima de la capa 12.

   QUÉ CAMBIA
     · El loader de pantalla completa (#loader) deja de salir en
       las LECTURAS. En su lugar se pinta un esqueleto en el sitio
       donde van a caer los datos.
     · El loader se queda SOLO donde no hay nada que esqueletar:
       las ESCRITURAS (guardar, enviar, eliminar, subir archivo) y
       el inicio de sesión. Ahí sí hace falta saber que la app está
       escribiendo, y el candado de la capa 12 no se ve lo bastante.
     · Las peticiones de fondo (motor EN VIVO, perfil, alcance,
       configuración) no encienden nada: ni loader ni esqueleto.

   CÓMO SE DECIDE DÓNDE PINTAR
     Por la VISTA que esté activa cuando arranca la petición, no por
     el nombre de la acción: la misma acción (listSolicitudes) se usa
     desde tres vistas distintas.

   DOS FORMAS DE ESQUELETO
     · relleno → se escriben tarjetas grises DENTRO del contenedor
       de la lista (solo si está vacío: si ya hay datos pintados se
       dejan, que es mejor que parpadear).
     · cubrir  → se le pone una sábana con brillo ENCIMA al bloque,
       sin tocar su contenido. Es la única forma válida donde hay
       <canvas> de Chart.js: escribir dentro los destruiría.

   CASO APARTE: PENDIENTES PREDIAL
     Su botón pedía los datos ANTES de entrar a la vista (para no
     entrar si no había filas), así que el esqueleto se pintaba en
     un contenedor que nadie estaba viendo. Ahora se entra primero
     con el esqueleto puesto y, si vuelve vacío, se sale a Inicio
     con el aviso de siempre.

   No toca app.js. Los estilos los inyecta este mismo archivo.
   ============================================================ */
(function () {
  'use strict';

  if (window.__hacEsqueletos) return;
  window.__hacEsqueletos = true;

  /* ── Qué peticiones SÍ pueden encender el loader ──────── */
  /* Lecturas que no tienen dónde pintar un esqueleto. */
  var GET_CON_LOADER = { login: 1, loginpin: 1 };
  /* Escrituras que en realidad son lecturas (traen un archivo). */
  var POST_SIN_LOADER = { visorarchivo: 1 };
  /* Peticiones de fondo: ni loader ni esqueleto. */
  var DE_FONDO = {
    alcance: 1, perfil: 1, cfgtodo: 1, cfgusuarios: 1,
    descargaopciones: 1, usuarioslogin: 1, getsolicitudbyid: 1,
    buscarcontacto: 1
  };

  /* ── Qué pinta cada vista ─────────────────────────────── */
  var VISTAS = {
    'view-lista':        { relleno: [{ sel: '#lista-wrap',  n: 4, rejilla: false }] },
    'view-atenciones':   { relleno: [{ sel: '#atenc-wrap',  n: 6, rejilla: true  }] },
    'view-bd-predial':   { relleno: [{ sel: '#bdp-list',    n: 4, rejilla: true  }] },
    'view-asignaciones': { relleno: [{ sel: '#proc-list',   n: 3, rejilla: false }] },
    'view-drive-anexos': { relleno: [{ sel: '#drive-grid',  n: 6, rejilla: true  }] },
    'view-estadisticas': { cubrir: ['#estad-view-tiempo', '#estad-view-zonas', '#estad-view-tendencia'] },
    'view-panel':        { cubrir: ['#panel-view-resumen', '#panel-view-equipo', '#panel-view-tiempo', '#panel-view-cats'] },
    'view-bdp-panel':    { cubrir: ['#bdpp-view-resumen', '#bdpp-view-cartera', '#bdpp-view-actuaciones', '#bdpp-view-equipo'] }
  };

  var MAX_MS = 20000;   /* red de seguridad: nada tapado para siempre */

  /* ══════════════ 1) EL LOADER SOLO CUANDO TOCA ══════════════ */

  var conLoader = 0;

  function pintarLoader_() {
    try {
      if (!document.body) return;
      document.body.classList.toggle('hac-sin-loader', conLoader === 0);
    } catch (e) {}
  }

  /* ══════════════ 2) ESQUELETOS ══════════════ */

  var cubiertos = [];        /* elementos con sábana puesta      */
  var reloj = null;

  function vistaActiva_() {
    var v = document.querySelector('.view.active');
    return v ? v.id : '';
  }

  /* Vacío = sin nada, o solo con un esqueleto de antes. */
  function vacio_(el) {
    if (!el) return false;
    var t = String(el.textContent || '').trim();
    if (t) return false;
    var hijos = el.children;
    for (var i = 0; i < hijos.length; i++) {
      var c = hijos[i];
      if (c.classList && (c.classList.contains('sk') || c.classList.contains('sk-wrap'))) continue;
      return false;
    }
    return true;
  }

  function tarjetas_(n) {
    var html = '';
    for (var i = 0; i < n; i++) {
      html += '<div class="sk sk-card" aria-hidden="true">' +
              '<div class="sk sk-line w60"></div>' +
              '<div class="sk sk-line w95"></div>' +
              '<div class="sk sk-line w80"></div>' +
              '<div class="sk sk-line w40"></div>' +
              '</div>';
    }
    return html;
  }

  function rellenar_(spec) {
    var el = document.querySelector(spec.sel);
    if (!el || !vacio_(el)) return false;
    el.innerHTML = spec.rejilla ? tarjetas_(spec.n) : '<div class="sk-wrap">' + tarjetas_(spec.n) + '</div>';
    return true;
  }

  function cubrir_(sel) {
    var el = document.querySelector(sel);
    if (!el || el.dataset.hacSk === '1') return false;
    el.dataset.hacSk = '1';
    cubiertos.push(el);
    return true;
  }

  function destapar_() {
    for (var i = 0; i < cubiertos.length; i++) {
      try { delete cubiertos[i].dataset.hacSk; } catch (e) { cubiertos[i].removeAttribute('data-hac-sk'); }
    }
    cubiertos = [];
    if (reloj) { clearTimeout(reloj); reloj = null; }
  }

  function pintarVista_() {
    var spec = VISTAS[vistaActiva_()];
    if (!spec) return false;
    var algo = false;
    if (spec.relleno) for (var i = 0; i < spec.relleno.length; i++) algo = rellenar_(spec.relleno[i]) || algo;
    if (spec.cubrir)  for (var j = 0; j < spec.cubrir.length; j++)  algo = cubrir_(spec.cubrir[j]) || algo;
    if (algo) {
      if (reloj) clearTimeout(reloj);
      reloj = setTimeout(destapar_, MAX_MS);
    }
    return algo;
  }

  /* ══════════════ 3) ENVOLTORIO DE LA RED ══════════════ */

  var enVueloMudas = 0;

  function envolverRed_() {
    ['apiGet', 'apiPost'].forEach(function (nombre) {
      var original = window[nombre];
      if (typeof original !== 'function' || original.__hac10) return;

      var envuelto = function (accion) {
        var acc = String(accion || '').toLowerCase();
        var fondo = !!window.__HAC_SILENCIO || !!DE_FONDO[acc];
        var conLoad = !fondo && (nombre === 'apiPost' ? !POST_SIN_LOADER[acc] : !!GET_CON_LOADER[acc]);

        if (esperandoPendientes && acc === 'listsolicitudes') arrancoPendientes = true;

        if (conLoad) { conLoader++; pintarLoader_(); }
        else if (!fondo) { enVueloMudas++; pintarVista_(); }

        var cerrado = false;
        function cerrar() {
          if (cerrado) return;
          cerrado = true;
          if (conLoad) { conLoader = Math.max(0, conLoader - 1); pintarLoader_(); }
          else if (!fondo) {
            enVueloMudas = Math.max(0, enVueloMudas - 1);
            if (enVueloMudas === 0) destapar_();
          }
        }

        var p;
        try { p = original.apply(this, arguments); }
        catch (e) { cerrar(); throw e; }

        return Promise.resolve(p).then(function (v) {
          try { pendientesRespondio_(acc, v); } catch (e) {}
          cerrar();
          return v;
        }, function (e) {
          try { pendientesFallo_(acc); } catch (e2) {}
          cerrar();
          throw e;
        });
      };

      envuelto.__hac10 = true;
      envuelto.__original = original;
      window[nombre] = envuelto;
    });
  }

  /* ══════════════ 4) PENDIENTES PREDIAL ══════════════ */

  var esperandoPendientes = false;
  var arrancoPendientes = false;
  var relojPendientes = null;

  function puedeVerPendientes_() {
    try {
      if (typeof window.canSeePendientes_ === 'function') return !!window.canSeePendientes_();
    } catch (e) {}
    var b = document.getElementById('btn-pendientes');
    return !!(b && b.style.display !== 'none');
  }

  function aInicio_() {
    esperandoPendientes = false;
    arrancoPendientes = false;
    if (relojPendientes) { clearTimeout(relojPendientes); relojPendientes = null; }
    destapar_();
    var w = document.getElementById('lista-wrap');
    if (w) w.innerHTML = '';
    if (typeof window.showView === 'function') window.showView('view-inicio');
  }

  function pendientesRespondio_(acc, valor) {
    if (!esperandoPendientes || acc !== 'listsolicitudes') return;
    var n = Array.isArray(valor) ? valor.length : 0;
    if (n === 0) aInicio_();          /* "ESTÁS AL DÍA": el aviso lo sigue dando app.js */
    else {                            /* hay filas: app.js pinta y entra */
      esperandoPendientes = false;
      arrancoPendientes = false;
      if (relojPendientes) { clearTimeout(relojPendientes); relojPendientes = null; }
    }
  }

  function pendientesFallo_(acc) {
    if (esperandoPendientes && acc === 'listsolicitudes') aInicio_();
  }

  function montarPendientes_() {
    /* En captura sobre document: corre ANTES del manejador del propio
       botón (que vive en app.js) sin tener que tocarlo ni quitarlo. */
    document.addEventListener('click', function (ev) {
      var b = ev.target && ev.target.closest ? ev.target.closest('#btn-pendientes') : null;
      if (!b || b.disabled) return;
      if (!puedeVerPendientes_()) return;          /* que app.js dé el aviso de permiso */
      if (typeof window.showView !== 'function') return;

      esperandoPendientes = true;
      var t = document.getElementById('lista-title');
      if (t) t.textContent = 'PENDIENTES PREDIAL';
      var f = document.getElementById('lista-filter');
      if (f) f.value = '';
      var w = document.getElementById('lista-wrap');
      if (w) w.innerHTML = '';
      window.showView('view-lista');
      pintarVista_();

      /* Red de seguridad: si el manejador de app.js se devuelve sin pedir
         nada (sesión caída, permiso denegado, un error), nadie puede
         quedarse mirando un esqueleto que no va a llegar nunca. */
      if (relojPendientes) clearTimeout(relojPendientes);
      relojPendientes = setTimeout(function () {
        if (esperandoPendientes && !arrancoPendientes) aInicio_();
      }, 1500);
    }, true);
  }

  /* ══════════════ 5) ESTILOS ══════════════ */

  function estilos_() {
    var css =
      /* el loader solo aparece cuando alguien lo pidió de verdad */
      'body.hac-sin-loader #loader{opacity:0!important;pointer-events:none!important;}' +
      /* sábana para los bloques con gráficas: no se toca su contenido */
      '[data-hac-sk="1"]{position:relative;min-height:120px;}' +
      '[data-hac-sk="1"]>*{visibility:hidden;}' +
      '[data-hac-sk="1"]::before{content:"";position:absolute;inset:0;z-index:2;border-radius:14px;' +
      'background:rgba(var(--surface-rgb,255,255,255),.55);}' +
      '[data-hac-sk="1"]::after{content:"";position:absolute;inset:0;z-index:3;border-radius:14px;' +
      'background:linear-gradient(90deg,rgba(140,140,140,.10) 25%,rgba(140,140,140,.20) 37%,rgba(140,140,140,.10) 63%);' +
      'background-size:400% 100%;animation:hacSk 1.3s ease-in-out infinite;}' +
      '@keyframes hacSk{0%{background-position:100% 50%;}100%{background-position:0 50%;}}' +
      '@media (prefers-reduced-motion: reduce){[data-hac-sk="1"]::after{animation:none;}}';
    var s = document.createElement('style');
    s.id = 'hac-esqueletos-css';
    s.textContent = css;
    (document.head || document.documentElement).appendChild(s);
  }

  /* ══════════════ ARRANQUE ══════════════ */

  function arrancar_() {
    estilos_();
    envolverRed_();
    montarPendientes_();
    pintarLoader_();
    /* Al cambiar de vista, nada puede quedar tapado de la anterior. */
    var showOriginal = window.showView;
    if (typeof showOriginal === 'function') {
      window.showView = function () {
        var r = showOriginal.apply(this, arguments);
        if (enVueloMudas === 0) destapar_();
        return r;
      };
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', arrancar_);
  else arrancar_();

  window.HACSK = {
    pintar: pintarVista_,
    destapar: destapar_,
    vistas: VISTAS,
    conLoader: function () { return conLoader; }
  };
})();
