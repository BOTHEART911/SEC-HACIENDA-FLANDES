/* ============================================================
   SEC-HACIENDA-FLANDES · CORTE AL CAMBIAR DE VISTA
   29/09/2026 · optimización a fondo · se carga justo después de sesion.js

   1) CORTE. Si una vista todavía está cargando y la persona toca otro
      botón o ATRÁS, esas LECTURAS se cancelan (AbortController) para que
      no le quiten red ni servidor a la vista nueva. Los GUARDADOS (POST)
      nunca se tocan.
   2) HERENCIA. Si la vista nueva pide exactamente lo mismo que venía en
      camino, lo hereda en vez de pedirlo otra vez.
   3) FONDO ORDENADO. Las lecturas de segundo plano (precarga de
      expedientes, estado de la voz) esperan a que termine lo de primer
      plano, van de a máximo 2 y se descartan al cambiar de vista.
   4) DETALLE AL INSTANTE. Volver al mismo detalle (expediente, solicitud,
      carpeta) no vuelve a pedirlo durante 2 min. Cualquier guardado borra
      esa memoria.

   Una lectura cortada termina con el error '__HAC_CANCELADA__'. Nadie lo
   ve: los avisos de error que lo traen se callan aquí mismo.

   "Vista" = familia de pantallas: ir de la lista a su detalle y volver NO
   corta nada (la precarga de BD Predial sigue viva al abrir un expediente).
   ============================================================ */
(function (raiz) {
  'use strict';

  if (raiz.HAC_CORTE) return;

  var API = String((raiz.MARCA && raiz.MARCA.API_URL) || '');
  var CANCELADA = '__HAC_CANCELADA__';
  var ESPERA_CORTE_MS = 40;       /* ventana para que la vista nueva herede */
  var FONDO_MAX = 2;
  var FONDO_ESPERA_MS = 400;
  var MEMO_MS = 120000;

  /* Lecturas atadas a la vista que las pidió. */
  var CORTABLES = {
    listsolicitudes: 1, listatenciones: 1, listprocesos: 1, listpredial: 1,
    getpredial: 1, getpredialbloque: 1, getsolicitudbyid: 1, listdriverows: 1,
    listmisexpedientes: 1, buscarmisexpedientes: 1, buscarcontacto: 1,
    vozestado: 1, descargaopciones: 1
  };
  /* Segundo plano: detrás de lo de primer plano. */
  var FONDO = { getpredialbloque: 1, vozestado: 1 };
  /* Detalles que se recuerdan un rato. */
  var MEMO = { getpredial: 1, getsolicitudbyid: 1, listmisexpedientes: 1 };

  var FAMILIAS = {
    'view-lista': 'solicitudes', 'view-respuesta': 'solicitudes',
    'view-asignaciones': 'procesos', 'view-panel': 'procesos',
    'view-ver-asignacion': 'procesos', 'view-editar-asignacion': 'procesos',
    'view-agregar-asignacion': 'procesos',
    'view-bd-predial': 'predial', 'view-bdp-detalle': 'predial',
    'view-bdp-form': 'predial', 'view-bdp-panel': 'predial',
    'view-drive-anexos': 'drive', 'view-drive-editar': 'drive',
    'view-atenciones': 'atenciones', 'view-estadisticas': 'estadisticas'
  };

  function familiaDe(id) { return FAMILIAS[id] || id || ''; }
  function vistaActiva() {
    var v = document.querySelector('.view.active');
    return v ? v.id : '';
  }

  var familia = '';
  var vuelo = {};          /* llave -> { promesa, ctrl, familia } */
  var memo = {};           /* llave -> { t, texto, estado, cabeceras } */
  var primerPlano = 0;
  var colaFondo = [];
  var fondoActivos = 0;
  var ultimoPrimer = 0;

  function esApi(url) { return !!API && typeof url === 'string' && url.indexOf(API) === 0; }

  /** action + parámetros ordenados, sin la llave de sesión. */
  function llaveDe(url) {
    try {
      var u = new URL(url);
      var pares = [];
      u.searchParams.forEach(function (v, k) { if (k !== 'tk') pares.push(k + '=' + v); });
      pares.sort();
      return pares.join('&').toLowerCase();
    } catch (e) { return String(url); }
  }
  function accionDe(url) {
    try { return String(new URL(url).searchParams.get('action') || '').toLowerCase(); }
    catch (e) { return ''; }
  }

  function cancelada() { var e = new Error(CANCELADA); e.codigo = 'CANCELADA'; e.cancelada = true; return e; }

  var fetchAnterior = raiz.fetch ? raiz.fetch.bind(raiz) : null;
  if (!fetchAnterior) return;

  function soltarFondo() {
    if (fondoActivos >= FONDO_MAX || !colaFondo.length) return;
    var falta = FONDO_ESPERA_MS - (Date.now() - ultimoPrimer);
    if (primerPlano > 0 || falta > 0) {
      setTimeout(soltarFondo, Math.max(falta, 120));
      return;
    }
    while (fondoActivos < FONDO_MAX && colaFondo.length) {
      var t = colaFondo.shift();
      if (t.descartada) continue;
      fondoActivos++;
      t.arrancar();
    }
  }

  function lanzar(url, opciones, llave, esFondo) {
    var ctrl = typeof AbortController === 'function' ? new AbortController() : null;
    var op = {};
    for (var k in (opciones || {})) op[k] = opciones[k];
    if (ctrl) op.signal = ctrl.signal;

    var entrada = { ctrl: ctrl, familia: familia, fondo: esFondo, cortada: false };
    var arrancar = function () {
      if (!esFondo) { primerPlano++; }
      return fetchAnterior(url, op).then(function (r) {
        return r;
      }, function (err) {
        if (entrada.cortada) throw cancelada();
        throw err;
      }).then(function (r) {
        terminar();
        return r;
      }, function (e) {
        terminar();
        throw e;
      });
    };
    function terminar() {
      if (entrada.terminada) return;
      entrada.terminada = true;
      if (vuelo[llave] === entrada) delete vuelo[llave];
      if (esFondo) { fondoActivos = Math.max(0, fondoActivos - 1); }
      else { primerPlano = Math.max(0, primerPlano - 1); ultimoPrimer = Date.now(); }
      soltarFondo();
    }

    if (esFondo) {
      entrada.promesa = new Promise(function (ok, mal) {
        var tarea = {
          arrancar: function () { arrancar().then(ok, mal); },
          descartada: false
        };
        entrada.tarea = tarea;
        entrada.descartar = function () {
          tarea.descartada = true;
          entrada.cortada = true;
          if (!entrada.terminada && !tarea.iniciada) { entrada.terminada = true; if (vuelo[llave] === entrada) delete vuelo[llave]; mal(cancelada()); }
        };
        var orig = tarea.arrancar;
        tarea.arrancar = function () { tarea.iniciada = true; orig(); };
        colaFondo.push(tarea);
        setTimeout(soltarFondo, 0);
      });
    } else {
      entrada.promesa = arrancar();
    }
    vuelo[llave] = entrada;
    return entrada;
  }

  raiz.fetch = function (entrada, opciones) {
    if (!esApi(entrada)) return fetchAnterior(entrada, opciones);
    var metodo = String((opciones && opciones.method) || 'GET').toUpperCase();

    /* GUARDADOS: nunca se cortan. Y cualquier guardado borra la memoria
       de detalles (lo que se vea después debe ser lo nuevo). */
    if (metodo !== 'GET') {
      memo = {};
      /* Una escritura hace viejo lo que venía en camino de fondo. */
      Object.keys(vuelo).forEach(function (k) { var v = vuelo[k]; if (v.fondo && v.descartar) v.descartar(); });
      return fetchAnterior(entrada, opciones);
    }

    var accion = accionDe(entrada);
    if (!CORTABLES[accion]) return fetchAnterior(entrada, opciones);

    /* La vista pudo cambiar en este mismo instante (el observador de clases
       avisa un poco después): se pone al día ANTES de decidir de quién es
       esta lectura, para que la vista nueva herede y no se la corten. */
    alCambiarVista();

    var llave = llaveDe(entrada);

    /* DETALLE AL INSTANTE */
    if (MEMO[accion]) {
      var m = memo[llave];
      if (m && Date.now() - m.t < MEMO_MS) {
        return m.texto.then(function (txt) {
          if (txt === null) { delete memo[llave]; return raiz.fetch(entrada, opciones); }
          return new Response(txt, { status: 200, headers: { 'Content-Type': 'application/json' } });
        });
      }
    }

    /* HERENCIA: lo mismo ya viene en camino → se comparte. */
    var ya = vuelo[llave];
    if (ya && !ya.cortada) {
      ya.familia = familia;          /* ahora es de la vista nueva: no se corta */
      if (ya.fondo && !FONDO[accion]) {
        /* La vista la necesita YA: sale de la cola de fondo. */
        if (ya.tarea && !ya.tarea.iniciada) {
          colaFondo = colaFondo.filter(function (t) { return t !== ya.tarea; });
          ya.fondo = false;
          ya.tarea.arrancar();
          fondoActivos++;   /* terminar() lo descuenta como fondo */
        }
      }
      return ya.promesa.then(function (r) { return r.clone(); });
    }

    var nueva = lanzar(entrada, opciones, llave, !!FONDO[accion]);
    return nueva.promesa.then(function (r) {
      if (MEMO[accion] && r.ok) {
        /* Se guarda YA la promesa del texto: una segunda apertura inmediata
           la espera en vez de volver a viajar. Si no era una respuesta buena,
           se descarta (null) y esa segunda apertura sí viaja. */
        var marca = {};
        marca.t = Date.now();
        marca.texto = r.clone().text().then(function (txt) {
          return txt.indexOf('{"ok":true') === 0 ? txt : null;
        }, function () { return null; });
        memo[llave] = marca;
      }
      return r.clone();
    });
  };

  /* ── CORTE al cambiar de familia de vista ── */
  var relojCorte = null;
  function alCambiarVista() {
    var nueva = familiaDe(vistaActiva());
    if (!nueva || nueva === familia) return;
    var anterior = familia;
    familia = nueva;
    if (!anterior) return;
    clearTimeout(relojCorte);
    relojCorte = setTimeout(function () {
      Object.keys(vuelo).forEach(function (k) {
        var v = vuelo[k];
        if (v.familia !== anterior || v.terminada) return;
        v.cortada = true;
        if (v.descartar) v.descartar();
        if (v.ctrl) { try { v.ctrl.abort(); } catch (e) {} }
        delete vuelo[k];
      });
    }, ESPERA_CORTE_MS);
  }

  function vigilarVistas() {
    familia = familiaDe(vistaActiva());
    if (typeof MutationObserver !== 'function') return;
    var obs = new MutationObserver(alCambiarVista);
    document.querySelectorAll('.view').forEach(function (v) {
      obs.observe(v, { attributes: true, attributeFilter: ['class'] });
    });
  }

  /* ── Los avisos de error de una lectura cortada no se muestran ── */
  function callarSwal() {
    var S = raiz.Swal;
    if (!S || !S.fire || S.fire.__corte) return;
    var fire = S.fire;
    var callado = function () {
      try {
        var txt = JSON.stringify(Array.prototype.slice.call(arguments));
        if (txt && txt.indexOf(CANCELADA) !== -1) return Promise.resolve({ isDismissed: true, dismiss: 'cancel' });
      } catch (e) {}
      return fire.apply(this, arguments);
    };
    callado.__corte = true;
    S.fire = callado;
  }
  /* Tampoco en la consola como "promesa rechazada sin manejar". */
  raiz.addEventListener('unhandledrejection', function (ev) {
    var r = ev && ev.reason;
    if (r && (r.cancelada || String(r.message || r).indexOf(CANCELADA) !== -1)) ev.preventDefault();
  });

  function iniciar() { vigilarVistas(); callarSwal(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();

  raiz.HAC_CORTE = {
    CANCELADA: CANCELADA,
    esCancelada: function (e) { return !!(e && (e.cancelada || String(e.message || e).indexOf(CANCELADA) !== -1)); },
    familia: function () { return familia; },
    enVuelo: function () { return Object.keys(vuelo).length; },
    fondo: function () { return { cola: colaFondo.length, activos: fondoActivos }; },
    olvidar: function () { memo = {}; }
  };
})(window);
