/* ============================================================
   INDUSTRIA Y COMERCIO · REQUERIMIENTOS — 04/10/2026 · SEC-HACIENDA

   Habla con el backend ICA (Apps Script en la cuenta cobrocoactivo),
   no con HACIENDA. La sesión es la misma: la llave `tk` viaja y el
   backend ICA la confirma con HACIENDA una vez (y la recuerda 30 min).

   Rendimiento (reglas 11–15)
     · Una vista, un viaje: 'arranque' trae lista + configuración +
       festivos. Se pide UNA vez por sesión; después todo es local
       (filtros, búsqueda, pastillas, conteos, insights).
     · Tras guardar se parcha la fila en memoria; nada se recarga.
     · Cabecera antes que datos: el detalle pinta lo que ya se sabe de
       la fila y luego completa evidencias, envíos y bitácora.
     · Corte al salir de la vista (AbortController); los guardados no
       se cortan. Una respuesta de una sesión vieja nunca pisa la nueva.
     · Toda escritura: botón ocupado desde el primer toque + rid. El
       reintento (solo ante falla de red o el 404 de Google) usa el MISMO
       rid: el servidor devuelve lo ya hecho, nunca repite el envío.
     · Medición en pantalla: window.__icaMed (ruta, ms, KB).
   ============================================================ */
(function () {
  'use strict';
  if (window.ICA) return;

  var K = window.KIT || {};
  var VISTA = 'view-ica-req';
  var ANIO0 = 2021;
  var LOTE_MAX = 10;
  var ETAPAS = [
    ['CREADO', 'Creado'], ['REQUERIMIENTO', 'Requerimiento'], ['EVALUACION', 'Evaluación'],
    ['DECISION', 'Decisión del caso'], ['ACTUACION', 'Actuación tributaria'], ['CIERRE', 'Cierre'],
    ['TRASLADO', 'Traslado de cobro']
  ];
  var ETQ = {}; ETAPAS.forEach(function (e) { ETQ[e[0]] = e[1]; });
  var SEGS = [
    ['PEND', 'Pendiente de seguimiento', 'vencido'], ['PORVENCER', 'Por vencer', 'reloj'],
    ['PLAZO', 'En plazo', 'check'], ['RESP', 'Respondió', 'responder'],
    ['INSIST', '2.º requerimiento', 'megafono'], ['SIN', 'Sin enviar', 'sobre']
  ];
  var MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  var MES3 = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

  var S = {
    lista: null, porId: {}, cfg: null, festivos: {}, hoy: '', cargado: false, cargando: null,
    et: 'ALL', seg: 'ALL', q: '', sel: {}, mostrar: 60, ctrl: null, tkCarga: '', v: ''
  };
  window.__icaMed = window.__icaMed || [];

  /* ══════════════ utilidades ══════════════ */
  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }
  function norm(s) {
    var t = String(s == null ? '' : s).trim().toUpperCase();
    try { t = t.normalize('NFD').replace(/[̀-ͯ]/g, ''); } catch (e) {}
    return t;
  }
  function ico(n, t) {
    try { if (K.icono) return K.icono(n, t || 18); } catch (e) {}
    return '<i class="hi" data-ico="' + n + '" data-t="' + (t || 18) + '"></i>';
  }
  function aviso(t, tipo, ms) { try { K.aviso(t, tipo || 'info', ms || 3500); } catch (e) { try { console.log(t); } catch (_) {} } }
  function sonar(n) { try { /* SOUNDS es const de app.js: se lee por nombre */ if (typeof playSoundOnce === 'function' && typeof SOUNDS !== 'undefined' && SOUNDS[n]) playSoundOnce(SOUNDS[n]); } catch (e) {} }
  function perfil() { try { return (window.IDN && window.IDN.perfil()) || null; } catch (e) { return null; } }
  function roles() { var p = perfil(); return (p && p.roles) || []; }
  function tiene() { var r = roles(); for (var i = 0; i < arguments.length; i++) if (r.indexOf(arguments[i]) !== -1) return true; return false; }
  function puede() { return tiene('TRIBUTARIO', 'ADMIN', 'DEV'); }
  function esJefe() { return tiene('ADMIN', 'DEV'); }
  function yo() { var p = perfil(); return norm(p && p.nombre); }

  function identTxt(tipo, ide) {
    ide = String(ide || '');
    return (tipo === 'NIT' && ide.length > 1) ? ide.slice(0, -1) + '-' + ide.slice(-1) : ide;
  }
  function titulo(s) {
    return String(s || '').toLowerCase().replace(/(^|[\s(.-])([a-záéíóúñü])/g, function (t, a, l) { return a + l.toUpperCase(); })
      .replace(/\b(De|Del|La|Las|Los|Y|El)\b/g, function (w) { return w.toLowerCase(); }).replace(/^./, function (c) { return c.toUpperCase(); });
  }
  function fCorta(iso) { if (!iso) return ''; var p = String(iso).slice(0, 10).split('-'); return (+p[2]) + ' ' + MES3[+p[1] - 1] + ' ' + p[0]; }
  function fLarga(iso) { if (!iso) return ''; var p = String(iso).slice(0, 10).split('-'); return MESES[+p[1] - 1] + ' ' + (+p[2]) + ' de ' + p[0]; }
  function deIso(s) { var p = String(s).split('-'); return new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])); }
  function aIso(d) { return d.toISOString().slice(0, 10); }
  function hoyIso() {
    if (S.hoy) return S.hoy;
    try { return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date()); } catch (e) { return aIso(new Date()); }
  }
  function esHabil(d) { var w = d.getUTCDay(); return w !== 0 && w !== 6 && !S.festivos[aIso(d)]; }
  function habilesHasta(desde, hasta) {
    var d = deIso(desde), f = deIso(hasta), c = 0;
    while (d < f) { d = new Date(d.getTime() + 86400000); if (esHabil(d)) c++; }
    return c;
  }
  function anioActual() { return Number(hoyIso().slice(0, 4)); }

  /** Dígito de verificación DIAN (módulo 11). */
  function dvNit(base) {
    var P = [3, 7, 13, 17, 19, 23, 29, 37, 41, 43, 47, 53, 59, 67, 71], s = 0, d = String(base).replace(/\D/g, '');
    for (var i = 0; i < d.length && i < P.length; i++) s += Number(d.charAt(d.length - 1 - i)) * P[i];
    var r = s % 11;
    return r > 1 ? 11 - r : r;
  }
  function nitOk(ide) {
    ide = String(ide || '').replace(/\D/g, '');
    if (ide.length < 6) return false;
    return dvNit(ide.slice(0, -1)) === Number(ide.slice(-1));
  }
  function correoOk(c) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(c || '').trim()); }

  /* ══════════════ red ══════════════ */
  function url() { return (window.HAC_PUBLICO && window.HAC_PUBLICO.icaUrl) || (window.MARCA && window.MARCA.ICA_URL) || ''; }
  function tk() { return window.HAC_SESION ? window.HAC_SESION.tk() : ''; }
  function nuevoRid() { return 'ica' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10); }
  function error(codigo, msg) { var e = new Error(msg); e.codigo = codigo; return e; }
  function esperar(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  /**
   * accion, datos, op { post, rid, signal }.
   * Reintento único y SOLO ante falla de red / respuesta que no es JSON
   * (el 404 de echo de Google), con el mismo rid.
   */
  function llamar(accion, datos, op) {
    op = op || {};
    datos = datos || {};
    var u = url();
    if (!u) return Promise.reject(error('SIN_URL', 'El módulo aún no está conectado: falta la URL del backend ICA en Configuración → Avanzado.'));
    var llave = tk();
    var t0 = (window.performance && performance.now()) || Date.now();
    function una(n) {
      var p;
      if (!op.post) {
        var qs = '?action=' + encodeURIComponent(accion) + '&tk=' + encodeURIComponent(llave);
        Object.keys(datos).forEach(function (k) { qs += '&' + k + '=' + encodeURIComponent(datos[k]); });
        p = fetch(u + qs, { signal: op.signal, cache: 'no-store' });
      } else {
        p = fetch(u + '?action=' + encodeURIComponent(accion), {
          method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(Object.assign({ tk: llave, rid: op.rid || '' }, datos)), signal: op.signal
        });
      }
      return p.then(function (r) { return r.text(); }).then(function (t) {
        var j; try { j = JSON.parse(t); } catch (e) { throw error('RED', 'Respuesta inesperada del servidor.'); }
        /* una respuesta de otra sesión nunca pisa la actual */
        if (llave !== tk()) throw error('VIEJA', 'Sesión cambiada');
        var ms = Math.round(((window.performance && performance.now()) || Date.now()) - t0);
        try { window.__icaMed.push({ ruta: accion, ms: ms, kb: Math.round(t.length / 102.4) / 10, n: n }); if (window.__icaMed.length > 200) window.__icaMed.shift(); } catch (e) {}
        if (j.v && S.v && j.v !== S.v) S.versionNueva = true;
        if (j.v) S.v = j.v;
        if (!j.ok) {
          if (j.codigo === 'SESION_VENCIDA') { try { window.dispatchEvent(new CustomEvent('hac:sesionVencida', { detail: { mensaje: j.error } })); } catch (e) {} }
          throw error(j.codigo || 'ERROR', j.error || 'No se pudo completar.');
        }
        return j.data;
      }).catch(function (e) {
        if (e && e.name === 'AbortError') throw e;
        var red = (e instanceof TypeError) || (e && e.codigo === 'RED');
        if (red && n < 1) return esperar(1200).then(function () { return una(n + 1); });
        if (red) throw error('RED', 'Sin conexión con el servidor. Revisa tu internet e inténtalo de nuevo.');
        throw e;
      });
    }
    return una(0);
  }
  function cancelada(e) { return e && (e.name === 'AbortError' || e.codigo === 'VIEJA'); }

  /* ══════════════ datos en memoria ══════════════ */
  function aObjetos(l) {
    var c = l.campos;
    return (l.filas || []).map(function (f) { var o = {}; for (var i = 0; i < c.length; i++) o[c[i]] = f[i] == null ? '' : f[i]; return aBien(o); });
  }
  function filaObj(f) {
    if (!Array.isArray(f)) return aBien(f);
    var c = (S.lista && S.campos) || [];
    var o = {}; for (var i = 0; i < c.length; i++) o[c[i]] = f[i] == null ? '' : f[i];
    return aBien(o);
  }
  function aBien(o) {
    o.nev = Number(o.nev) || 0; o.nbit = Number(o.nbit) || 0;
    o._q = norm([o.id, o.of, o.ide, identTxt(o.tid, o.ide), o.nom, o.rep, o.c1, o.c2, o.mun, o.dir, o.vig].join(' '));
    return o;
  }
  function parchar(f) {
    var o = filaObj(f);
    if (!S.lista) return o;
    var i = -1;
    for (var k = 0; k < S.lista.length; k++) if (S.lista[k].id === o.id) { i = k; break; }
    if (i === -1) S.lista.unshift(o); else S.lista[i] = o;
    S.porId[o.id] = o;
    return o;
  }

  /** Estado del seguimiento (derivado: el servidor cuenta igual). */
  function seg(r) {
    var hoy = hoyIso();
    if (r.resp) return { k: 'RESP', t: 'Respondió el ' + fCorta(r.resp) };
    if (r.ins) {
      if (hoy > r.insv) return { k: 'PEND', t: '2.º requerimiento vencido el ' + fCorta(r.insv) + ' sin respuesta', ins: true, venc: true };
      return { k: 'INSIST', t: '2.º requerimiento enviado el ' + fCorta(r.ins) + ' · vence el ' + fCorta(r.insv) };
    }
    if (!r.env) return { k: 'SIN', t: 'Sin enviar' };
    if (hoy > r.ven) return { k: 'PEND', t: 'Venció el ' + fCorta(r.ven) + ' sin respuesta · pendiente de seguimiento', venc: true };
    var q = habilesHasta(hoy, r.ven);
    var recDias = (S.cfg && S.cfg.recDias) || 5;
    if (q <= recDias) return { k: 'PORVENCER', t: 'Vence el ' + fCorta(r.ven) + ' · ' + (q === 0 ? 'hoy es el último día' : 'quedan ' + q + ' día' + (q === 1 ? '' : 's') + ' hábil' + (q === 1 ? '' : 'es')) + (r.rec ? ' · recordatorio enviado' : ''), q: q };
    return { k: 'PLAZO', t: 'Enviado el ' + fCorta(r.env) + ' · vence el ' + fCorta(r.ven) + ' (' + q + ' días hábiles)', q: q };
  }
  function enviable(r) { return !r.env && !r.resp && ['CIERRE', 'TRASLADO'].indexOf(r.et) === -1; }
  function insistible(r) { return !!r.env && !r.resp && !r.ins && hoyIso() > r.ven && ['CIERRE', 'TRASLADO'].indexOf(r.et) === -1; }
  function seleccionable(r) { return enviable(r) || insistible(r); }

  /* ══════════════ carga (una vez por sesión) ══════════════ */
  function cargar(forzar) {
    if (S.cargado && !forzar) return Promise.resolve(S.lista);
    if (S.cargando && !forzar) return S.cargando;
    if (S.ctrl) try { S.ctrl.abort(); } catch (e) {}
    var ctrl = S.ctrl = (typeof AbortController === 'function') ? new AbortController() : null;
    S.tkCarga = tk();
    var p = llamar('arranque', {}, { signal: ctrl && ctrl.signal }).then(function (d) {
      S.campos = d.lista.campos;
      S.lista = aObjetos(d.lista);
      S.porId = {}; S.lista.forEach(function (o) { S.porId[o.id] = o; });
      S.cfg = d.cfg; S.hoy = d.hoy;
      S.festivos = {}; (d.festivos || []).forEach(function (f) { S.festivos[f] = 1; });
      S.cargado = true;
      return S.lista;
    });
    S.cargando = p;
    p.then(function () { S.cargando = null; }, function () { S.cargando = null; });
    return p;
  }
  function olvidar() { S.lista = null; S.porId = {}; S.cfg = null; S.cargado = false; S.sel = {}; }
  window.addEventListener('hac:sesionVencida', olvidar);

  /* ══════════════ la vista ══════════════ */
  function montarVista() {
    if ($(VISTA)) return $(VISTA);
    var cont = document.querySelector('.container') || document.body;
    var sec = document.createElement('section');
    sec.id = VISTA; sec.className = 'view';
    sec.innerHTML =
      '<div class="vista kit-ancho ica">' +
        '<div class="hf-herramientas ica-herr">' +
          '<button type="button" class="kit-btn kit-btn--marca" id="ica-agregar">' + ico('mas') + ' Agregar contribuyente</button>' +
          '<button type="button" class="kit-btn" id="ica-masiva">' + ico('excel') + ' Carga masiva</button>' +
          '<button type="button" class="kit-btn" id="ica-enviar-sel" disabled>' + ico('enviar') + ' Enviar seleccionados <b id="ica-nsel">0</b></button>' +
          '<button type="button" class="kit-btn" id="ica-mitrabajo">' + ico('libro') + ' Mi trabajo</button>' +
          '<button type="button" class="kit-btn" id="ica-config">' + ico('engranaje') + ' Configuración</button>' +
          '<button type="button" class="kit-btn" id="ica-refrescar" title="Volver a traer la lista del servidor">' + ico('recargar') + ' Refrescar</button>' +
        '</div>' +
        '<div class="ica-resumen" id="ica-resumen"></div>' +
        '<div class="hf-barra">' +
          '<span class="hf-conteo"><b id="ica-count">0</b> <span id="ica-count-t">contribuyentes</span></span>' +
          '<label class="hf-buscar"><i class="hi" data-ico="buscar"></i><input id="ica-buscar" type="search" placeholder="Buscar por nombre, NIT/CC, oficio, correo, municipio…" autocomplete="off"></label>' +
        '</div>' +
        '<div class="ica-filtros">' +
          '<div class="ica-filtros__t">Etapa</div><div class="ica-pills" id="ica-pills-et"></div>' +
          '<div class="ica-filtros__t">Seguimiento</div><div class="ica-pills" id="ica-pills-seg"></div>' +
        '</div>' +
        '<div class="ica-selbar" id="ica-selbar" hidden>' +
          '<span id="ica-seltxt"></span>' +
          '<button type="button" class="kit-btn" id="ica-sel-vis">' + ico('check') + ' Seleccionar visibles (máx. ' + LOTE_MAX + ')</button>' +
          '<button type="button" class="kit-btn" id="ica-sel-limpiar">' + ico('cerrar') + ' Quitar selección</button>' +
        '</div>' +
        '<div id="ica-lista" class="hf-rejilla"></div>' +
        '<div class="ica-mas"><button type="button" class="kit-btn" id="ica-vermas" hidden>Ver más</button></div>' +
        '<button type="button" class="hf-atras" hidden>Regresar</button>' +
      '</div>';
    cont.appendChild(sec);

    /* Botón atrás (barra y físico): el banner hace clic en .hf-atras de la vista activa.
       Corta las lecturas en curso de la vista y vuelve al inicio. */
    sec.querySelector('.hf-atras').addEventListener('click', salir);
    $('ica-agregar').addEventListener('click', function () { abrirForm(null); });
    $('ica-masiva').addEventListener('click', abrirMasiva);
    $('ica-enviar-sel').addEventListener('click', enviarSeleccion);
    $('ica-mitrabajo').addEventListener('click', abrirMiTrabajo);
    $('ica-config').addEventListener('click', abrirConfig);
    $('ica-refrescar').addEventListener('click', refrescar);
    $('ica-vermas').addEventListener('click', function () { S.mostrar += 60; pintarLista(); });
    $('ica-sel-vis').addEventListener('click', seleccionarVisibles);
    $('ica-sel-limpiar').addEventListener('click', function () { S.sel = {}; pintarLista(); });
    var tq = null;
    $('ica-buscar').addEventListener('input', function (e) {
      clearTimeout(tq);
      var v = e.target.value;
      tq = setTimeout(function () { S.q = norm(v); S.mostrar = 60; pintarLista(); }, 140);
    });
    $('ica-lista').addEventListener('click', alClicLista);
    $('ica-lista').addEventListener('change', function (e) {
      var c = e.target.closest('input.ica-chk'); if (!c) return;
      var id = c.getAttribute('data-id');
      if (c.checked) {
        if (Object.keys(S.sel).length >= LOTE_MAX) { c.checked = false; aviso('Máximo ' + LOTE_MAX + ' por envío. Envía este bloque y sigue con el siguiente.', 'aviso'); return; }
        S.sel[id] = 1;
      } else delete S.sel[id];
      pintarSeleccion();
    });
    return sec;
  }

  /** 04/10 · REFRESCAR: vuelve a pedir la lista (un viaje) y las respuestas nuevas. */
  function refrescar() {
    var b = $('ica-refrescar');
    if (!b || b.disabled) return;
    b.disabled = true; b.classList.add('ica-ocupado');
    sonar('menu');
    cargar(true).then(function () {
      if (activa()) pintarTodo();
      S.novEn = 0; novedades();
      aviso('Lista actualizada.', 'ok', 2000);
    }, function (e) { if (!cancelada(e)) aviso(e.message, 'aviso', 5000); })
      .then(function () { b.disabled = false; b.classList.remove('ica-ocupado'); });
  }

  function salir() {
    try { if (window.VISOR && window.VISOR.abierto && window.VISOR.abierto()) window.VISOR.cerrar(); } catch (e) {}
    document.querySelectorAll('.ica-modal').forEach(function (m) { if (!m.__ocupado && m.cerrar) m.cerrar(); });
    if (typeof window.showView === 'function') window.showView('view-inicio');
  }
  function abrir() {
    if (!puede()) { aviso('No tienes acceso a Industria y Comercio.', 'aviso'); return; }
    montarVista();
    if (typeof window.showView === 'function') window.showView(VISTA);
    if (!S.cargado) {
      pintarEsqueleto();
      cargar().then(function () { if (activa()) pintarTodo(); novedades(); }, function (e) {
        if (cancelada(e)) return;
        if (!activa()) return;
        $('ica-lista').innerHTML = '<div class="ica-vacio">' + ico('aviso', 28) + '<p>' + esc(e.message) + '</p>' +
          '<button type="button" class="kit-btn" id="ica-reintentar">' + ico('recargar') + ' Reintentar</button></div>';
        var b = $('ica-reintentar'); if (b) b.addEventListener('click', abrir);
      });
    } else { pintarTodo(); novedades(); }
  }
  /**
   * Respuestas nuevas de los contribuyentes, DE FONDO (no frena la vista): el
   * servidor mira el historial de Gmail y devuelve solo las filas que cambiaron.
   * Una vez por minuto como mucho; se descarta si cambia la sesión. Si el backend
   * aún no tiene la ruta (versión anterior), se ignora en silencio.
   */
  function novedades() {
    var ahora = Date.now();
    if (S.novEn && ahora - S.novEn < 60000) return;
    S.novEn = ahora;
    var llave = tk();
    llamar('novedades', {}).then(function (d) {
      if (llave !== tk() || !d || !d.filas || !d.filas.length || !S.lista) return;
      var resp = 0;
      d.filas.forEach(function (f) { var o = parchar(f); if (o.resp) resp++; });
      if (activa()) pintarTodo();
      if (resp) { sonar('success'); aviso(resp === 1 ? 'Un contribuyente respondió el requerimiento.' : resp + ' contribuyentes respondieron.', 'ok', 5000); }
    }, function () {});
  }
  function activa() { var v = $(VISTA); return !!(v && v.classList.contains('active')); }

  function pintarEsqueleto() {
    var h = '';
    for (var i = 0; i < 6; i++) h += '<div class="sol-card ica-card ica-sk"><span></span><span></span><span></span><span></span></div>';
    $('ica-lista').innerHTML = h;
    $('ica-pills-et').innerHTML = ''; $('ica-pills-seg').innerHTML = ''; $('ica-resumen').innerHTML = '';
  }

  function filtrar() {
    var et = S.et, sg = S.seg, q = S.q;
    return (S.lista || []).filter(function (r) {
      if (et !== 'ALL' && r.et !== et) return false;
      if (sg !== 'ALL' && seg(r).k !== sg) return false;
      if (q && r._q.indexOf(q) === -1) return false;
      return true;
    });
  }
  function orden(a, b) {
    var pa = prioridad(a), pb = prioridad(b);
    if (pa !== pb) return pa - pb;
    return String(b.act || '').localeCompare(String(a.act || ''));
  }
  function prioridad(r) { return ({ PEND: 0, PORVENCER: 1, SIN: 2, INSIST: 3, PLAZO: 4, RESP: 5 })[seg(r).k]; }

  function pintarTodo() { pintarResumen(); pintarPills(); pintarLista(); }

  function pintarResumen() {
    var l = S.lista || [], c = { PEND: 0, PORVENCER: 0, RESP: 0, SIN: 0 }, env = 0;
    l.forEach(function (r) { var k = seg(r).k; if (c[k] != null) c[k]++; if (r.env) env++; });
    var tasa = env ? Math.round(c.RESP * 100 / env) : 0;
    $('ica-resumen').innerHTML =
      tarj('Contribuyentes', l.length, 'persona', '') +
      tarj('Requeridos', env, 'enviar', '') +
      tarj('Pendientes de seguimiento', c.PEND, 'vencido', c.PEND ? 'malo' : '') +
      tarj('Por vencer', c.PORVENCER, 'reloj', c.PORVENCER ? 'aviso' : '') +
      tarj('Respondieron', c.RESP + (env ? ' · ' + tasa + ' %' : ''), 'responder', 'ok');
    function tarj(t, n, i, tono) {
      return '<div class="ica-kpi' + (tono ? ' ica-kpi--' + tono : '') + '">' + ico(i, 18) + '<b>' + esc(n) + '</b><span>' + esc(t) + '</span></div>';
    }
  }

  function pintarPills() {
    var l = S.lista || [];
    var cet = { ALL: l.length }, cseg = { ALL: l.length };
    l.forEach(function (r) { cet[r.et] = (cet[r.et] || 0) + 1; var k = seg(r).k; cseg[k] = (cseg[k] || 0) + 1; });
    $('ica-pills-et').innerHTML = pill('et', 'ALL', 'Todas', cet.ALL) + ETAPAS.map(function (e) { return pill('et', e[0], e[1], cet[e[0]] || 0); }).join('');
    $('ica-pills-seg').innerHTML = pill('seg', 'ALL', 'Todos', cseg.ALL) + SEGS.map(function (s) { return pill('seg', s[0], s[1], cseg[s[0]] || 0, s[2]); }).join('');
    ['ica-pills-et', 'ica-pills-seg'].forEach(function (id) {
      $(id).onclick = function (e) {
        var b = e.target.closest('button[data-v]'); if (!b) return;
        S[b.getAttribute('data-f')] = b.getAttribute('data-v'); S.mostrar = 60; sonar('menu');
        pintarPills(); pintarLista();
      };
    });
    function pill(f, v, t, n, i) {
      var act = S[f] === v;
      return '<button type="button" class="proc-status-pill ica-pill ica-pill--' + v + (act ? ' active' : '') + '" data-f="' + f + '" data-v="' + v + '">' +
        (i ? ico(i, 14) : '') + esc(t) + '<span class="bit-num">' + (n || '') + '</span></button>';
    }
  }

  function pintarLista() {
    if (!S.lista) return;
    var l = filtrar().sort(orden);
    window.__icaFiltrado = l;
    $('ica-count').textContent = l.length;
    $('ica-count-t').textContent = l.length === 1 ? 'contribuyente' : 'contribuyentes';
    var cont = $('ica-lista');
    if (!l.length) {
      cont.innerHTML = '<div class="ica-vacio">' + ico('buscar', 28) + '<p>' + (S.lista.length ? 'Nada coincide con los filtros.' :
        'Aún no hay contribuyentes. Agrégalos uno a uno o con la carga masiva.') + '</p></div>';
    } else {
      cont.innerHTML = l.slice(0, S.mostrar).map(tarjeta).join('');
    }
    $('ica-vermas').hidden = l.length <= S.mostrar;
    pintarSeleccion();
  }

  function tarjeta(r) {
    var s = seg(r), sel = seleccionable(r);
    var vig = String(r.vig || '').split(/,\s*/).filter(String).map(function (y) { return '<span class="ica-anio">' + esc(y) + '</span>'; }).join('');
    var acc = '';
    acc += btn('ver', 'ojo', 'Ver detalle');
    acc += btn('editar', 'lapiz', 'Editar datos');
    if (insistible(r)) acc += btn('insistir', 'megafono', 'Enviar 2.º requerimiento', 'ica-btn--alerta');
    else acc += btn('enviar', 'enviar', r.env ? 'Reenviar requerimiento' : 'Enviar requerimiento', enviable(r) ? 'bdp-icon-btn--marca' : '', !(enviable(r) || (r.env && !r.resp)));
    acc += btn('evidencia', 'clip', 'Anexar evidencia');
    acc += btn('etapa', 'adelante', 'Cambiar etapa');
    if (puedeEliminar(r)) acc += btn('eliminar', 'basura', 'Eliminar contribuyente', 'danger-icon');
    return '<article class="sol-card ica-card ica-card--' + s.k + '" data-id="' + esc(r.id) + '">' +
      '<div class="ica-card__top">' +
        (sel ? '<label class="ica-sel" title="Seleccionar para envío"><input type="checkbox" class="ica-chk" data-id="' + esc(r.id) + '"' + (S.sel[r.id] ? ' checked' : '') + '></label>' : '') +
        '<span class="ica-of">Oficio ' + esc(r.of) + '</span>' +
        '<span class="ica-et ica-et--' + esc(r.et) + '">' + esc(ETQ[r.et] || r.et) + '</span>' +
      '</div>' +
      '<h4 class="ica-nom">' + esc(r.nom) + '</h4>' +
      '<p class="ica-id">' + esc(r.tid) + ' ' + esc(identTxt(r.tid, r.ide)) + ' · ' + esc(titulo(r.mun)) + (r.nat === 'JURIDICA' ? ' · Persona jurídica' : ' · Persona natural') + '</p>' +
      '<p class="ica-correo">' + ico('sobre', 14) + esc([r.c1, r.c2].filter(String).join(', ')) + '</p>' +
      '<div class="ica-vig">' + vig + '</div>' +
      '<div class="ica-seg ica-seg--' + s.k + '">' + ico(({ PEND: 'vencido', PORVENCER: 'reloj', PLAZO: 'check', RESP: 'responder', INSIST: 'megafono', SIN: 'sobre' })[s.k], 16) + '<span>' + esc(s.t) + '</span></div>' +
      '<div class="ica-meta"><span title="Evidencias">' + ico('clip', 14) + r.nev + '</span><span title="Anotaciones de bitácora">' + ico('libro', 14) + r.nbit + '</span>' +
        '<span class="ica-meta__act">' + (r.act ? 'Act. ' + esc(fCorta(r.act)) + (r.actp ? ' · ' + esc(titulo(r.actp)) : '') : '') + '</span></div>' +
      '<div class="bdp-actions">' + acc + '</div>' +
    '</article>';
    function btn(a, i, t, extra, off) {
      return '<button type="button" class="bdp-icon-btn ' + (extra || '') + '" data-a="' + a + '" title="' + esc(t) + '" aria-label="' + esc(t) + '"' + (off ? ' disabled' : '') + '>' + ico(i, 20) + '</button>';
    }
  }

  function alClicLista(e) {
    var b = e.target.closest('button[data-a]'); if (!b) return;
    var card = b.closest('[data-id]'); var r = card && S.porId[card.getAttribute('data-id')]; if (!r) return;
    var a = b.getAttribute('data-a');
    sonar('menu');
    if (a === 'ver') abrirFicha(r);
    else if (a === 'editar') abrirForm(r);
    else if (a === 'enviar') enviarUno(r, 'req');
    else if (a === 'insistir') enviarUno(r, 'ins');
    else if (a === 'evidencia') abrirEvidencias(r);
    else if (a === 'etapa') abrirEtapa(r);
    else if (a === 'eliminar') eliminar(r);
  }

  /* ══════════════ eliminar (04/10) ══════════════
     ADMIN y DEV siempre; TRIBUTARIO solo si nunca se le envió nada (el
     servidor vuelve a revisarlo). Se borra la fila y su carpeta de Drive va
     a la papelera con todos sus documentos (se recupera durante 30 días). */
  function puedeEliminar(r) { return esJefe() || (tiene('TRIBUTARIO') && !r.env); }
  function eliminar(r) {
    var m = modal({
      titulo: 'Eliminar contribuyente', icono: 'basura',
      cuerpo: '<div class="ica-conf"><p>Vas a eliminar a <b>' + esc(r.nom) + '</b> (oficio ' + esc(r.of) + ').</p>' +
        '<ul class="ica-lista-conf"><li><span>Registro y bitácora</span><b>se borran de la hoja</b></li>' +
        '<li><span>Carpeta de Drive</span><b>va a la papelera con todos sus documentos (' + (r.nev || 0) + ' evidencias)</b></li></ul>' +
        '<p class="ica-nota">Drive guarda la papelera 30 días. Escribe el número de oficio para confirmar.</p>' +
        '<label class="ica-campo"><span class="ica-campo__t">Número de oficio</span><input data-conf inputmode="numeric" autocomplete="off" placeholder="' + esc(r.of) + '"></label>' +
        '<p class="ica-err" data-err hidden></p></div>',
      pie: '<button type="button" class="kit-btn" data-cerrar>Cancelar</button><button type="button" class="kit-btn kit-btn--malo" data-si disabled>' + ico('basura') + ' Eliminar</button>'
    });
    var inp = m.q('[data-conf]'), si = m.q('[data-si]');
    inp.addEventListener('input', function () { si.disabled = inp.value.trim() !== String(r.of); });
    setTimeout(function () { inp.focus(); }, 80);
    si.addEventListener('click', function () {
      if (si.disabled) return;
      ocupado(m, si, true);
      var rid = si.__rid || (si.__rid = nuevoRid());
      guardando(llamar('eliminar', { id: r.id }, { post: true, rid: rid }), 'Eliminando').then(function (d) {
        ocupado(m, si, false); m.cerrar();
        S.lista = (S.lista || []).filter(function (x) { return x.id !== r.id; });
        delete S.porId[r.id]; delete S.sel[r.id];
        sonar('success');
        aviso('Contribuyente eliminado' + (d && d.carpeta ? '; su carpeta quedó en la papelera de Drive.' : '.'), 'ok', 4500);
        if (activa()) pintarTodo();
      }, function (e) {
        ocupado(m, si, false);
        if (e.codigo !== 'RED') si.__rid = null;
        var er = m.q('[data-err]'); er.hidden = false; er.textContent = e.message; sonar('error');
      });
    });
  }

  function pintarSeleccion() {
    var n = Object.keys(S.sel).filter(function (id) { return S.porId[id] && seleccionable(S.porId[id]); }).length;
    $('ica-nsel').textContent = n;
    $('ica-enviar-sel').disabled = !n;
    var hay = (S.lista || []).some(seleccionable);
    $('ica-selbar').hidden = !hay;
    $('ica-seltxt').textContent = n ? n + ' seleccionado' + (n === 1 ? '' : 's') + ' para enviar' : 'Marca las tarjetas que vas a enviar (de ' + LOTE_MAX + ' en ' + LOTE_MAX + ').';
  }
  function seleccionarVisibles() {
    S.sel = {};
    var n = 0;
    (window.__icaFiltrado || []).forEach(function (r) { if (n < LOTE_MAX && seleccionable(r)) { S.sel[r.id] = 1; n++; } });
    if (!n) aviso('No hay tarjetas para enviar con estos filtros.', 'info');
    pintarLista();
  }

  /* ══════════════ modales ══════════════ */
  function modal(op) {
    var m = document.createElement('div');
    m.className = 'hf-modal ica-modal';
    m.innerHTML = '<div class="hf-modal__hoja' + (op.ancha ? ' hf-modal__hoja--ancha' : '') + '" role="dialog" aria-modal="true">' +
      '<div class="hf-modal__cab">' + ico(op.icono || 'documento', 22) + '<h2>' + esc(op.titulo) + '</h2>' +
      '<button type="button" class="ica-x" data-cerrar aria-label="Cerrar" data-salida="1">' + ico('cerrar', 20) + '</button></div>' +
      '<div class="ica-modal__cuerpo">' + (op.cuerpo || '') + '</div>' +
      (op.pie != null ? '<div class="hf-modal__pie">' + op.pie + '</div>' : '') + '</div>';
    document.body.appendChild(m);
    var cerrar = function () { if (m.__ocupado) return; m.remove(); document.removeEventListener('keydown', tecla); if (op.alCerrar) op.alCerrar(); };
    var tecla = function (e) { if (e.key === 'Escape') cerrar(); };
    document.addEventListener('keydown', tecla);
    m.addEventListener('click', function (e) { if (e.target === m || e.target.closest('[data-cerrar]')) cerrar(); });
    m.cerrar = cerrar;
    m.q = function (s) { return m.querySelector(s); };
    try { if (window.KIT && K.piezas && K.piezas.iconos) {} } catch (e) {}
    return m;
  }
  /** Botón ocupado + escudo desde el primer toque. */
  function ocupado(m, btn, si) {
    m.__ocupado = !!si;
    if (btn) { btn.disabled = !!si; btn.classList.toggle('ica-ocupado', !!si); }
    m.classList.toggle('ica-modal--ocupado', !!si);
  }
  function guardando(promesa, texto) {
    try { if (K.piezas && K.piezas.guardado) return K.piezas.guardado.mientras(promesa, { titulo: texto }); } catch (e) {}
    return promesa;
  }
  function confirmar(titulo, html, si) {
    return new Promise(function (res) {
      var m = modal({ titulo: titulo, icono: 'info', cuerpo: '<div class="ica-conf">' + html + '</div>',
        pie: '<button type="button" class="kit-btn" data-cerrar>Cancelar</button><button type="button" class="kit-btn kit-btn--marca" data-si>' + esc(si || 'Sí, continuar') + '</button>',
        alCerrar: function () { res(false); } });
      m.q('[data-si]').addEventListener('click', function () { m.remove(); res(true); });
    });
  }

  /* ══════════════ alta / edición ══════════════ */
  function abrirForm(r) {
    var nuevo = !r;
    var d = r ? Object.assign({}, r) : { nat: 'NATURAL', dep: 'TOLIMA', mun: 'FLANDES', vig: '', pl: (S.cfg && S.cfg.plazo) || 15, un: (S.cfg && S.cfg.unidad) || 'HABILES' };
    var anios = []; for (var y = ANIO0; y <= anioActual(); y++) anios.push(y);
    var vigSel = {}; String(d.vig || '').split(/[,\s]+/).forEach(function (x) { if (x) vigSel[x] = 1; });
    var m = modal({
      titulo: nuevo ? 'Agregar contribuyente' : 'Editar · Oficio ' + d.of, icono: nuevo ? 'mas' : 'lapiz', ancha: true,
      cuerpo:
        '<form class="ica-form" autocomplete="off" novalidate>' +
        '<div class="ica-seg2" role="radiogroup" aria-label="Naturaleza del contribuyente">' +
          '<button type="button" data-nat="NATURAL">' + ico('persona', 18) + ' Persona natural</button>' +
          '<button type="button" data-nat="JURIDICA">' + ico('base-datos', 18) + ' Persona jurídica</button>' +
        '</div>' +
        '<div class="ica-rej2">' +
          campo('of', 'Número de oficio SHM', '<input name="of" inputmode="numeric" placeholder="Ej.: 00125" value="' + esc(d.of || '') + '">', 'Se guarda tal cual, con los ceros a la izquierda.') +
          campo('ide', 'Número de identificación <span class="ica-tipo" data-tipo></span>', '<input name="ide" inputmode="numeric" placeholder="Solo números" value="' + esc(d.ide || '') + '">', '<span data-dv></span>') +
          campo('nom', '<span data-nomt>Nombres y apellidos</span>', '<input name="nom" value="' + esc(d.nom || '') + '">') +
          campo('rep', 'Representante legal <span data-repopc class="ica-opc">(opcional)</span>', '<input name="rep" value="' + esc(d.rep || '') + '">') +
          campo('c1', 'Correo principal', '<input name="c1" type="email" inputmode="email" value="' + esc(d.c1 || '') + '">') +
          campo('c2', 'Correo adicional <span class="ica-opc">(opcional)</span>', '<input name="c2" type="email" inputmode="email" value="' + esc(d.c2 || '') + '">') +
          campo('dir', 'Dirección', '<input name="dir" value="' + esc(d.dir || '') + '">') +
          campo('ubic', 'Departamento y municipio', '<div class="ica-ubic"><select name="dep" aria-label="Departamento"></select><select name="mun" aria-label="Municipio"></select></div>') +
        '</div>' +
        campo('vig', 'Vigencias requeridas', '<div class="ica-anios">' + anios.map(function (a) {
          return '<button type="button" class="ica-anio-btn' + (vigSel[a] ? ' on' : '') + '" data-anio="' + a + '">' + a + '</button>'; }).join('') +
          '<button type="button" class="ica-anio-todos" data-todos>Todas</button></div>') +
        '<div class="ica-rej2">' +
          campo('pl', 'Días para responder', '<input name="pl" type="number" min="1" max="90" value="' + esc(d.pl || 15) + '">',
            'Automático: ' + ((S.cfg && S.cfg.plazo) || 15) + ' ' + unidadTxt((S.cfg && S.cfg.unidad) || 'HABILES') + '. Puedes cambiarlo para este contribuyente.') +
        '</div>' +
        '<p class="ica-err" data-err hidden></p>' +
        '</form>',
      pie: '<button type="button" class="kit-btn" data-cerrar>Cancelar</button><button type="button" class="kit-btn kit-btn--marca" data-guardar>' + ico('check') + (nuevo ? ' Guardar' : ' Guardar cambios') + '</button>'
    });
    var f = m.q('form');
    var nat = d.nat === 'JURIDICA' ? 'JURIDICA' : 'NATURAL';
    function ponerNat(v) {
      nat = v;
      m.querySelectorAll('[data-nat]').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-nat') === v); b.setAttribute('aria-pressed', b.getAttribute('data-nat') === v); });
      m.q('[data-tipo]').textContent = v === 'JURIDICA' ? 'NIT' : 'CC';
      m.q('[data-nomt]').textContent = v === 'JURIDICA' ? 'Razón social' : 'Nombres y apellidos';
      m.q('[data-repopc]').hidden = v === 'JURIDICA';
      revisarDv();
    }
    m.querySelectorAll('[data-nat]').forEach(function (b) { b.addEventListener('click', function () { ponerNat(b.getAttribute('data-nat')); }); });
    function revisarDv() {
      var out = m.q('[data-dv]'), v = f.ide.value.replace(/\D/g, '');
      if (nat !== 'JURIDICA' || v.length < 6) { out.textContent = nat === 'JURIDICA' ? 'NIT con el dígito de verificación al final, sin guion.' : ''; out.className = ''; return; }
      if (nitOk(v)) { out.innerHTML = '✓ Se verá <b>' + esc(identTxt('NIT', v)) + '</b>'; out.className = 'ica-ok'; }
      else { out.innerHTML = 'El dígito de verificación no coincide (para ' + esc(v.slice(0, -1)) + ' debería ser ' + dvNit(v.slice(0, -1)) + '). Revísalo.'; out.className = 'ica-warn'; }
    }
    f.ide.addEventListener('input', revisarDv);
    ubicacion(f.dep, f.mun, d.dep, d.mun);
    m.q('.ica-anios').addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      if (b.hasAttribute('data-todos')) { var todos = !m.querySelectorAll('.ica-anio-btn:not(.on)').length; m.querySelectorAll('.ica-anio-btn').forEach(function (x) { x.classList.toggle('on', !todos); }); return; }
      b.classList.toggle('on');
    });
    ponerNat(nat);
    setTimeout(function () { try { f.of.focus(); } catch (e) {} }, 60);

    m.q('[data-guardar]').addEventListener('click', function () {
      var btn = this;
      if (m.__ocupado) return;
      var datos = {
        of: f.of.value.trim(), nat: nat, ide: f.ide.value.replace(/\D/g, ''), nom: f.nom.value.trim().replace(/\s+/g, ' '),
        rep: f.rep.value.trim(), c1: f.c1.value.trim().toLowerCase(), c2: f.c2.value.trim().toLowerCase(), dir: f.dir.value.trim(),
        dep: f.dep.value, mun: f.mun.value,
        vig: Array.prototype.map.call(m.querySelectorAll('.ica-anio-btn.on'), function (b) { return b.getAttribute('data-anio'); }).join(', '),
        pl: f.pl.value, un: (r && r.un) || (S.cfg && S.cfg.unidad) || 'HABILES'
      };
      var falta = validar(datos, r);
      var err = m.q('[data-err]');
      if (falta.length) { err.hidden = false; err.innerHTML = 'Revisa: ' + falta.map(esc).join(' · '); sonar('error'); return; }
      err.hidden = true;
      var avisos = [];
      if (nat === 'JURIDICA' && !nitOk(datos.ide)) avisos.push('El dígito de verificación del NIT no coincide.');
      var mismo = (S.lista || []).filter(function (x) { return x.ide === datos.ide && (!r || x.id !== r.id); });
      if (mismo.length) avisos.push('Ya existe ' + mismo.length + ' registro(s) con ese documento (oficio ' + mismo.map(function (x) { return x.of; }).join(', ') + ').');
      (avisos.length ? confirmar('Antes de guardar', '<ul class="ica-lista-av">' + avisos.map(function (a) { return '<li>' + esc(a) + '</li>'; }).join('') + '</ul>', 'Guardar de todas formas') : Promise.resolve(true))
        .then(function (ok) {
          if (!ok) return;
          ocupado(m, btn, true);
          var rid = btn.__rid || (btn.__rid = nuevoRid());
          var p = nuevo ? llamar('crear', { datos: datos }, { post: true, rid: rid }) : llamar('editar', { id: r.id, datos: datos }, { post: true, rid: rid });
          guardando(p, nuevo ? 'Guardando contribuyente' : 'Guardando cambios').then(function (res) {
            var fila = nuevo ? res.filas[0] : res.fila;
            parchar(fila); ocupado(m, btn, false); m.cerrar();
            sonar('success'); aviso(nuevo ? 'Contribuyente agregado.' : 'Cambios guardados.', 'ok');
            if (activa()) pintarTodo();
          }, function (e) {
            ocupado(m, btn, false);
            if (e.codigo !== 'RED') btn.__rid = null;
            err.hidden = false; err.textContent = e.message; sonar('error');
          });
        });
    });
  }
  function unidadTxt(u) { return String(u).toUpperCase() === 'CALENDARIO' ? 'días calendario' : 'días hábiles'; }
  function campo(n, t, input, ayuda) {
    return '<label class="ica-campo ica-campo--' + n + '"><span class="ica-campo__t">' + t + '</span>' + input + (ayuda ? '<small>' + ayuda + '</small>' : '') + '</label>';
  }
  function validar(d, r) {
    var f = [];
    if (!d.of) f.push('número de oficio');
    else if ((S.lista || []).some(function (x) { return x.of === d.of && (!r || x.id !== r.id); })) f.push('el oficio ' + d.of + ' ya existe');
    if (!d.ide) f.push('número de identificación');
    if (!d.nom) f.push(d.nat === 'JURIDICA' ? 'razón social' : 'nombres y apellidos');
    if (d.nat === 'JURIDICA' && !d.rep) f.push('representante legal');
    if (!correoOk(d.c1)) f.push('correo principal válido');
    if (d.c2 && !correoOk(d.c2)) f.push('correo adicional válido');
    if (!d.dir) f.push('dirección');
    if (!d.mun) f.push('departamento y municipio');
    if (!d.vig) f.push('al menos una vigencia');
    var pl = Number(d.pl); if (!(pl >= 1 && pl <= 90)) f.push('días entre 1 y 90');
    return f;
  }

  /** Departamento → municipio (catálogo DIVIPOLA local, cero viajes). */
  function ubicacion(selD, selM, dep, mun) {
    var cat = window.ICA_MUNI;
    if (!cat) { selD.outerHTML = '<input name="dep" placeholder="Departamento" value="' + esc(dep || '') + '">'; return; }
    selD.innerHTML = '<option value="">Departamento</option>' + cat.departamentos.map(function (x) { return '<option value="' + esc(x) + '">' + esc(titulo(x)) + '</option>'; }).join('');
    function llenar(dp, marcar) {
      selM.innerHTML = '<option value="">' + (dp ? 'Municipio' : 'Elige el departamento') + '</option>' +
        ((cat.mapa[dp] || []).map(function (x) { return '<option value="' + esc(x) + '"' + (norm(x) === norm(marcar) ? ' selected' : '') + '>' + esc(titulo(x)) + '</option>'; }).join(''));
      selM.disabled = !dp;
    }
    var dp = norm(dep);
    if (!cat.mapa[dp] && mun) { for (var k in cat.mapa) if (cat.mapa[k].some(function (x) { return norm(x) === norm(mun); })) { dp = k; break; } }
    selD.value = cat.mapa[dp] ? dp : '';
    llenar(selD.value, mun);
    selD.addEventListener('change', function () { llenar(selD.value, ''); });
  }

  /* ══════════════ detalle (cabecera antes que datos) ══════════════ */
  function abrirFicha(r) {
    var s = seg(r);
    var m = modal({
      titulo: r.nom, icono: 'expediente', ancha: true,
      cuerpo:
        '<div class="ica-ficha">' +
          '<div class="ica-ficha__cab"><span class="ica-of">Oficio ' + esc(r.of) + '</span><span class="ica-et ica-et--' + esc(r.et) + '">' + esc(ETQ[r.et] || r.et) + '</span>' +
            '<span class="ica-seg ica-seg--' + s.k + '">' + esc(s.t) + '</span></div>' +
          '<dl class="ica-dl">' +
            dt('Naturaleza', r.nat === 'JURIDICA' ? 'Persona jurídica' : 'Persona natural') +
            dt(r.tid, identTxt(r.tid, r.ide)) +
            (r.rep ? dt('Representante legal', r.rep) : '') +
            dt('Correo', [r.c1, r.c2].filter(String).join(', ')) +
            dt('Dirección', r.dir) + dt('Municipio', titulo(r.mun) + (r.dep ? ' (' + titulo(r.dep) + ')' : '')) +
            dt('Vigencias', r.vig) + dt('Plazo', r.pl + ' ' + unidadTxt(r.un)) +
            (r.env ? dt('Enviado', fLarga(r.env)) + dt('Vence', fLarga(r.ven)) : '') +
            (r.rec ? dt('Recordatorio', fLarga(r.rec)) : '') +
            (r.ins ? dt('2.º requerimiento', fLarga(r.ins) + ' · vence ' + fLarga(r.insv)) : '') +
            (r.resp ? dt('Respondió', fLarga(r.resp)) : '') +
            dt('Creado', (r.cre || '') + (r.crep ? ' · ' + titulo(r.crep) : '')) +
          '</dl>' +
          '<h3 class="ica-h3">' + ico('clip', 18) + ' Evidencias y documentos</h3><div class="ica-evid" data-evid><div class="ica-cargando">Cargando…</div></div>' +
          '<h3 class="ica-h3">' + ico('enviar', 18) + ' Envíos</h3><div class="ica-envios" data-envios><div class="ica-cargando">Cargando…</div></div>' +
          '<h3 class="ica-h3">' + ico('libro', 18) + ' Bitácora</h3>' +
          '<div class="ica-bit-nueva"><textarea rows="2" maxlength="2000" placeholder="Escribe una anotación…" data-bit></textarea>' +
            '<button type="button" class="kit-btn kit-btn--marca" data-anotar>' + ico('check') + ' Anotar</button></div>' +
          '<div class="ica-bit" data-bitlista><div class="ica-cargando">Cargando…</div></div>' +
        '</div>',
      pie:
        '<button type="button" class="kit-btn" data-previa>' + ico('pdf') + ' Vista previa PDF</button>' +
        (insistible(r) ? '<button type="button" class="kit-btn kit-btn--marca" data-ins>' + ico('megafono') + ' Enviar 2.º requerimiento</button>' :
          (enviable(r) ? '<button type="button" class="kit-btn kit-btn--marca" data-env>' + ico('enviar') + ' Enviar requerimiento</button>' : ''))
    });
    var ctrl = (typeof AbortController === 'function') ? new AbortController() : null;
    var cerrarOrig = m.cerrar;
    m.cerrar = function () { try { ctrl && ctrl.abort(); } catch (e) {} cerrarOrig(); };
    var envB = m.q('[data-env]'); if (envB) envB.addEventListener('click', function () { m.cerrar(); enviarUno(r, 'req'); });
    var insB = m.q('[data-ins]'); if (insB) insB.addEventListener('click', function () { m.cerrar(); enviarUno(r, 'ins'); });
    m.q('[data-previa]').addEventListener('click', function () { previa(r, insistible(r) ? 'ins' : 'req', this); });
    m.q('[data-anotar]').addEventListener('click', function () {
      var btn = this, ta = m.q('[data-bit]'), t = ta.value.trim();
      if (!t) { ta.focus(); return; }
      if (btn.disabled) return;
      btn.disabled = true;
      var rid = btn.__rid || (btn.__rid = nuevoRid());
      llamar('bitacora', { id: r.id, texto: t }, { post: true, rid: rid }).then(function (res) {
        btn.disabled = false; btn.__rid = null; ta.value = '';
        var o = parchar(res.fila); pintarBit(res.bitacora); sonar('success'); aviso('Anotación guardada.', 'ok');
        if (activa()) pintarTodo(); r = o;
      }, function (e) { btn.disabled = false; if (e.codigo !== 'RED') btn.__rid = null; aviso(e.message, 'aviso', 5000); });
    });
    function pintarBit(texto) {
      var cont = m.q('[data-bitlista]');
      var items = leerBit(texto).reverse();
      cont.innerHTML = items.length ? items.map(function (a) {
        return '<div class="ica-bit__it"><div class="ica-bit__cab"><b>' + esc(titulo(a.autor || 'Sin autor')) + '</b><span>' + esc(a.fecha) + '</span></div><p>' + esc(a.texto) + '</p></div>';
      }).join('') : '<p class="ica-nada">Sin anotaciones.</p>';
    }
    llamar('ficha', { id: r.id, archivos: 1 }, { signal: ctrl && ctrl.signal }).then(function (d) {
      if (!document.body.contains(m)) return;
      var ev = d.evidencias || [];
      var archivos = d.archivos || ev.map(function (e) { return { id: e.id, n: e.n, m: e.m, f: e.f, t: e.t }; });
      m.q('[data-evid]').innerHTML = ev.length ? ev.map(function (e) {
        var tipo = e.t === 'doc' ? 'Documento enviado' : (e.t === 'resp' ? 'Respuesta del contribuyente' : 'Evidencia');
        return '<button type="button" class="ica-doc ica-doc--' + e.t + '" data-abrir="' + esc(e.id) + '" data-nombre="' + esc(e.n) + '" data-mime="' + esc(e.m) + '">' +
          ico(/pdf/.test(e.m) ? 'pdf' : (/image/.test(e.m) ? 'imagen' : 'documento'), 22) +
          '<span><b>' + esc(e.n) + '</b><small>' + esc(tipo) + ' · ' + esc(e.f || '') + (e.por ? ' · ' + esc(titulo(e.por)) : '') + '</small></span></button>';
      }).join('') : '<p class="ica-nada">Sin evidencias todavía.</p>';
      var en = d.envios || [];
      m.q('[data-envios]').innerHTML = en.length ? en.map(function (x) {
        var t = { req: 'Requerimiento', ins: '2.º requerimiento', rec: 'Recordatorio' }[x.t] || x.t;
        return '<div class="ica-envio">' + ico(x.t === 'rec' ? 'campana' : (x.t === 'ins' ? 'megafono' : 'enviar'), 18) + '<span><b>' + esc(t) + '</b> · ' + esc(x.f) +
          '<small>Para: ' + esc(x.para || '') + (x.por ? ' · por ' + esc(titulo(x.por)) : '') + '</small></span></div>';
      }).join('') : '<p class="ica-nada">Aún no se ha enviado.</p>';
      pintarBit(d.bitacora);
      m.q('[data-evid]').addEventListener('click', function (e) {
        var b = e.target.closest('[data-abrir]'); if (!b) return;
        abrirVisor(r, archivos, b.getAttribute('data-abrir'));
      });
    }, function (e) {
      if (cancelada(e)) return;
      ['[data-evid]', '[data-envios]', '[data-bitlista]'].forEach(function (s) { var x = m.q(s); if (x) x.innerHTML = '<p class="ica-err">' + esc(e.message) + '</p>'; });
    });
    function dt(a, b) { return '<div><dt>' + esc(a) + '</dt><dd>' + esc(b || '—') + '</dd></div>'; }
  }
  function leerBit(texto) {
    if (window.BITACORA && typeof window.BITACORA.anotaciones === 'function') return window.BITACORA.anotaciones(texto || '');
    return String(texto || '').split(/\n/).filter(String).map(function (l) {
      var m = l.match(/^(.*?)\s(\d{2}\/\d{2}\/\d{4}):\s*(.*)$/);
      return m ? { autor: m[1], fecha: m[2], texto: m[3], dia: Number(m[2].slice(6) + m[2].slice(3, 5) + m[2].slice(0, 2)) } : { autor: '', fecha: '', texto: l, dia: 0 };
    });
  }
  /* ══════════════ visor (04/10) ══════════════
     El mismo de CONTRATACIÓN: todos los documentos de la carpeta del
     contribuyente, anterior/siguiente, zoom y AGREGAR (evidencia). Los
     bytes los entrega el backend ICA ('archivo'): nada se publica por
     enlace ni se enmarca Drive. */
  var TIPO_DOC = { doc: 'Documento enviado', resp: 'Respuesta del contribuyente', usr: 'Evidencia', otro: 'Documento' };
  function fuenteICA(rid) {
    return function (archivoId) {
      return llamar('archivo', { id: rid, archivoId: archivoId }).then(function (d) {
        if (d && d.b64) return { nombre: d.nombre, mime: d.mime, b64: d.b64 };
        throw new Error((d && d.motivo) || 'No se pudo abrir el documento.');
      });
    };
  }
  function itemsDe(archivos) {
    return (archivos || []).map(function (a) {
      return { id: a.id, titulo: a.n, mime: a.m, detalle: (TIPO_DOC[a.t] || 'Documento') + (a.f ? ' · ' + a.f : '') };
    });
  }
  /** Abre el visor con todos los documentos del registro, empezando en `idActual` (o en `primero`). */
  function abrirVisor(r, archivos, idActual, primero) {
    if (!window.VISOR || typeof window.VISOR.lista !== 'function') { aviso('El visor no cargó. Recarga la app.', 'aviso'); return; }
    var items = itemsDe(archivos), ind = 0;
    for (var k = 0; k < items.length; k++) if (items[k].id === idActual) { ind = k; break; }
    if (primero) { items.unshift(primero); ind = 0; }
    if (!items.length) { aviso('Este contribuyente aún no tiene documentos.', 'info'); return; }
    window.VISOR.lista(items, {
      indice: ind, fuente: fuenteICA(r.id),
      agregarTexto: 'Agregar', agregarAyuda: 'Agregar una evidencia a este contribuyente (máx. 5)',
      agregar: function (d, api) { agregarDesdeVisor(r, api); }
    });
  }
  /** AGREGAR del visor: elige archivos, los sube como evidencia y los suma al visor sin cerrarlo. */
  function agregarDesdeVisor(r, api) {
    var inp = document.createElement('input');
    inp.type = 'file'; inp.multiple = true; inp.hidden = true;
    document.body.appendChild(inp);
    inp.addEventListener('change', function () {
      var files = Array.prototype.slice.call(inp.files || []); inp.remove();
      var cola = Promise.resolve();
      files.forEach(function (file) {
        cola = cola.then(function () {
          if (file.size > 20 * 1024 * 1024) { aviso(file.name + ': pasa de 20 MB.', 'aviso'); return; }
          aviso('Subiendo ' + file.name + '…', 'info', 2500);
          return leerB64(file).then(function (b64) {
            return llamar('evidencia', { id: r.id, archivo: { nombre: file.name || ('imagen-' + Date.now() + '.png'), mime: file.type || 'application/octet-stream', b64: b64 } }, { post: true, rid: nuevoRid() });
          }).then(function (res) {
            parchar(res.fila); if (activa()) pintarLista();
            var nueva = (res.evidencias || []).filter(function (e) { return e.t === 'usr'; }).slice(-1)[0];
            if (nueva) api.sumar({ id: nueva.id, titulo: nueva.n, mime: nueva.m, detalle: 'Evidencia · ' + (nueva.f || ''), fuente: fuenteICA(r.id) }, true);
            sonar('success'); aviso('Evidencia agregada.', 'ok', 2500);
          }, function (e) { aviso(e.message, 'aviso', 5000); sonar('error'); });
        });
      });
    }, { once: true });
    inp.click();
  }
  function previa(r, tipo, btn) {
    if (btn && btn.disabled) return;
    if (btn) btn.disabled = true;
    guardando(llamar('previa', { id: r.id, tipo: tipo }, { post: true }), 'Armando la vista previa').then(function (d) {
      if (btn) btn.disabled = false;
      var b64 = d.b64;
      var primero = b64 ? { titulo: d.nombre, tipo: 'pdf', detalle: 'Vista previa (aún no enviada)',
        cargar: function () { return Promise.resolve({ nombre: d.nombre + '.pdf', mime: 'application/pdf', base64: b64 }); } } : null;
      if (!primero) { aviso('El servidor aún no tiene la vista previa en PDF. Pide al administrador desplegar la versión nueva de ICA.', 'aviso', 7000); return; }
      abrirVisor(r, d.archivos || [], null, primero);
    }, function (e) { if (btn) btn.disabled = false; aviso(e.message, 'aviso', 6000); });
  }

  /* ══════════════ envío ══════════════ */
  function enviarUno(r, tipo) {
    if (tipo === 'req' && r.env && !r.resp) {
      return confirmar('Reenviar requerimiento', '<p>Este requerimiento ya se envió el <b>' + esc(fLarga(r.env)) + '</b>. Si lo reenvías, el plazo vuelve a contar desde hoy.</p>', 'Reenviar').then(function (ok) { if (ok) enviarUno(Object.assign({}, r, { env: '' }), tipo); });
    }
    var plazo = tipo === 'ins' ? ((S.cfg && S.cfg.insDias) || 10) : r.pl;
    confirmar(tipo === 'ins' ? 'Enviar 2.º requerimiento' : 'Enviar requerimiento',
      '<ul class="ica-lista-conf">' +
        '<li><span>Contribuyente</span><b>' + esc(r.nom) + '</b></li>' +
        '<li><span>Oficio</span><b>' + esc(r.of) + '</b></li>' +
        '<li><span>Para</span><b>' + esc([r.c1, r.c2].filter(String).join(', ')) + '</b></li>' +
        '<li><span>Vigencias</span><b>' + esc(r.vig) + '</b></li>' +
        '<li><span>Plazo</span><b>' + esc(plazo + ' ' + unidadTxt(r.un)) + '</b></li>' +
      '</ul><p class="ica-nota">Se arma el PDF, se envía desde cobrocoactivo@flandes-tolima.gov.co y queda como primera evidencia.' +
        (tipo === 'ins' ? ' Se adjunta también el requerimiento inicial.' : '') + '</p>',
      'Enviar ahora').then(function (ok) {
      if (!ok) return;
      var rid = nuevoRid();
      guardando(llamar('enviar', { id: r.id, tipo: tipo }, { post: true, rid: rid }), 'Enviando el requerimiento').then(function (d) {
        parchar(d.fila); delete S.sel[r.id];
        sonar('success'); aviso(tipo === 'ins' ? '2.º requerimiento enviado.' : 'Requerimiento enviado.', 'ok', 4000);
        if (activa()) pintarTodo();
      }, function (e) { aviso(e.message, 'aviso', 7000); sonar('error'); });
    });
  }

  /** Lote de hasta 10: de 2 en 2, con progreso. Cada uno con su rid. */
  function enviarSeleccion() {
    var ids = Object.keys(S.sel).filter(function (id) { return S.porId[id] && seleccionable(S.porId[id]); }).slice(0, LOTE_MAX);
    if (!ids.length) return;
    var filas = ids.map(function (id) { var r = S.porId[id]; return { r: r, tipo: insistible(r) ? 'ins' : 'req', rid: nuevoRid(), estado: 'cola' }; });
    var m = modal({
      titulo: 'Enviar ' + filas.length + ' requerimiento' + (filas.length === 1 ? '' : 's'), icono: 'enviar', ancha: true,
      cuerpo: '<p class="hf-modal__p">Se envían de dos en dos desde cobrocoactivo@flandes-tolima.gov.co. Cada uno lleva su PDF y queda como evidencia.</p>' +
        '<div class="ica-lote" data-lote>' + filas.map(function (f, i) {
          return '<div class="ica-lote__it" data-i="' + i + '"><span class="ica-lote__est">' + ico('reloj', 18) + '</span><span><b>' + esc(f.r.nom) + '</b><small>Oficio ' + esc(f.r.of) +
            ' · ' + (f.tipo === 'ins' ? '2.º requerimiento' : 'Requerimiento') + ' · ' + esc(f.r.c1) + '</small></span><em data-msg></em></div>';
        }).join('') + '</div><div class="ica-barra"><span data-barra></span></div>',
      pie: '<button type="button" class="kit-btn" data-cerrar>Cancelar</button><button type="button" class="kit-btn kit-btn--marca" data-go>' + ico('enviar') + ' Enviar ahora</button>'
    });
    m.q('[data-go]').addEventListener('click', function () {
      var go = this;
      ocupado(m, go, true);
      m.querySelector('[data-cerrar]').disabled = true;
      var i = 0, hechos = 0, ok = 0;
      function marcar(k, est, msg) {
        var it = m.q('[data-i="' + k + '"]');
        it.className = 'ica-lote__it ica-lote__it--' + est;
        it.querySelector('.ica-lote__est').innerHTML = ico({ va: 'enviar', ok: 'check', mal: 'aviso' }[est] || 'reloj', 18);
        it.querySelector('[data-msg]').textContent = msg || '';
      }
      function siguiente() {
        if (i >= filas.length) return Promise.resolve();
        var k = i++, f = filas[k];
        marcar(k, 'va', 'Enviando…');
        return llamar('enviar', { id: f.r.id, tipo: f.tipo }, { post: true, rid: f.rid }).then(function (d) {
          parchar(d.fila); delete S.sel[f.r.id]; ok++; marcar(k, 'ok', 'Enviado');
        }, function (e) { marcar(k, 'mal', e.message); }).then(function () {
          hechos++; m.q('[data-barra]').style.width = Math.round(hechos * 100 / filas.length) + '%';
          return siguiente();
        });
      }
      Promise.all([siguiente(), siguiente()]).then(function () {
        ocupado(m, null, false);
        m.querySelector('[data-cerrar]').disabled = false;
        go.hidden = true;
        m.querySelector('[data-cerrar]').textContent = 'Cerrar';
        sonar(ok === filas.length ? 'success' : 'error');
        aviso(ok + ' de ' + filas.length + ' enviados.', ok === filas.length ? 'ok' : 'aviso', 5000);
        if (activa()) pintarTodo();
      });
    });
  }

  /* ══════════════ evidencias ══════════════ */
  function abrirEvidencias(r) {
    var m = modal({
      titulo: 'Evidencias · Oficio ' + r.of, icono: 'clip',
      cuerpo: '<p class="hf-modal__p">' + esc(r.nom) + '. Máximo 5 evidencias tuyas (los documentos enviados no cuentan). Cualquier tipo de archivo, hasta 20 MB.</p>' +
        '<div class="ica-drop" tabindex="0" data-drop>' + ico('subir', 30) + '<b>Arrastra aquí los archivos</b><span>o toca para elegirlos · si es una imagen, también puedes pegarla con Ctrl + V</span>' +
        '<input type="file" multiple hidden data-file></div>' +
        '<div class="ica-evid" data-lista><div class="ica-cargando">Cargando…</div></div>',
      pie: '<button type="button" class="kit-btn" data-cerrar>Listo</button>'
    });
    var ev = [], cola = Promise.resolve();
    var drop = m.q('[data-drop]'), inp = m.q('[data-file]');
    function propias() { return ev.filter(function (e) { return e.t === 'usr'; }).length; }
    function pintar() {
      m.q('[data-lista]').innerHTML = ev.length ? ev.map(function (e) {
        return '<div class="ica-doc ica-doc--' + e.t + '"><button type="button" class="ica-doc__abrir" data-abrir="' + esc(e.id) + '" data-nombre="' + esc(e.n) + '">' +
          ico(/pdf/.test(e.m) ? 'pdf' : (/image/.test(e.m) ? 'imagen' : 'documento'), 22) + '<span><b>' + esc(e.n) + '</b><small>' + esc(e.t === 'usr' ? 'Evidencia' : (e.t === 'doc' ? 'Documento enviado' : 'Respuesta')) + ' · ' + esc(e.f || '') + '</small></span></button>' +
          (e.t === 'usr' ? '<button type="button" class="bdp-icon-btn danger-icon" data-quitar="' + esc(e.id) + '" title="Quitar">' + ico('basura', 18) + '</button>' : '') + '</div>';
      }).join('') : '<p class="ica-nada">Sin evidencias todavía.</p>';
      drop.classList.toggle('ica-drop--lleno', propias() >= 5);
      drop.querySelector('b').textContent = propias() >= 5 ? 'Ya tiene 5 evidencias' : 'Arrastra aquí los archivos (' + propias() + '/5)';
    }
    var archivos = null;
    llamar('ficha', { id: r.id, archivos: 1 }).then(function (d) { ev = d.evidencias || []; archivos = d.archivos || null; pintar(); }, function (e) { m.q('[data-lista]').innerHTML = '<p class="ica-err">' + esc(e.message) + '</p>'; });
    function subir(files) {
      Array.prototype.forEach.call(files, function (file) {
        cola = cola.then(function () {
          if (propias() >= 5) { aviso('Ya tiene 5 evidencias.', 'aviso'); return; }
          if (file.size > 20 * 1024 * 1024) { aviso(file.name + ': pasa de 20 MB.', 'aviso'); return; }
          var tmp = { id: '_' + Math.random(), n: file.name, m: file.type, f: 'Subiendo…', t: 'usr' };
          ev.push(tmp); pintar();
          m.__ocupado = true;
          return leerB64(file).then(function (b64) {
            return llamar('evidencia', { id: r.id, archivo: { nombre: file.name || ('imagen-' + Date.now() + '.png'), mime: file.type || 'application/octet-stream', b64: b64 } }, { post: true, rid: nuevoRid() });
          }).then(function (res) {
            ev = res.evidencias; parchar(res.fila); pintar(); sonar('success');
            if (activa()) pintarLista();
          }, function (e) {
            ev = ev.filter(function (x) { return x !== tmp; }); pintar(); aviso(e.message, 'aviso', 5000);
          }).then(function () { m.__ocupado = false; });
        });
      });
    }
    drop.addEventListener('click', function () { if (propias() < 5) inp.click(); });
    drop.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); inp.click(); } });
    inp.addEventListener('change', function () { subir(inp.files); inp.value = ''; });
    ['dragenter', 'dragover'].forEach(function (t) { drop.addEventListener(t, function (e) { e.preventDefault(); drop.classList.add('ica-drop--sobre'); }); });
    ['dragleave', 'drop'].forEach(function (t) { drop.addEventListener(t, function (e) { e.preventDefault(); drop.classList.remove('ica-drop--sobre'); }); });
    drop.addEventListener('drop', function (e) { if (e.dataTransfer && e.dataTransfer.files) subir(e.dataTransfer.files); });
    var pegar = function (e) {
      if (!document.body.contains(m)) { document.removeEventListener('paste', pegar); return; }
      var it = (e.clipboardData && e.clipboardData.items) || [], fs = [];
      for (var i = 0; i < it.length; i++) if (it[i].kind === 'file') { var f = it[i].getAsFile(); if (f) fs.push(f); }
      if (fs.length) { e.preventDefault(); subir(fs); }
    };
    document.addEventListener('paste', pegar);
    m.q('[data-lista]').addEventListener('click', function (e) {
      var a = e.target.closest('[data-abrir]');
      if (a) {
        /* la lista de la carpeta + lo subido en este modal (sin repetir) */
        var todos = (archivos || []).slice(), vistos = {};
        todos.forEach(function (x) { vistos[x.id] = 1; });
        ev.forEach(function (x) { if (!vistos[x.id] && x.id.charAt(0) !== '_') todos.push({ id: x.id, n: x.n, m: x.m, f: x.f, t: x.t }); });
        abrirVisor(r, todos, a.getAttribute('data-abrir'));
        return;
      }
      var q = e.target.closest('[data-quitar]'); if (!q || q.disabled) return;
      var fid = q.getAttribute('data-quitar');
      confirmar('Quitar evidencia', '<p>El archivo va a la papelera de Drive (se puede recuperar durante 30 días).</p>', 'Quitar').then(function (ok) {
        if (!ok) return;
        q.disabled = true;
        llamar('quitarevid', { id: r.id, archivoId: fid }, { post: true, rid: nuevoRid() }).then(function (res) {
          ev = res.evidencias; parchar(res.fila); pintar(); if (activa()) pintarLista();
        }, function (e) { q.disabled = false; aviso(e.message, 'aviso'); });
      });
    });
  }
  function leerB64(file) {
    return new Promise(function (res, rej) {
      var fr = new FileReader();
      fr.onload = function () { res(String(fr.result).split(',')[1] || ''); };
      fr.onerror = function () { rej(new Error('No se pudo leer el archivo.')); };
      fr.readAsDataURL(file);
    });
  }

  /* ══════════════ etapa ══════════════ */
  function abrirEtapa(r) {
    var m = modal({
      titulo: 'Cambiar etapa · Oficio ' + r.of, icono: 'adelante',
      cuerpo: '<p class="hf-modal__p">' + esc(r.nom) + '</p><div class="ica-etapas">' + ETAPAS.map(function (e) {
        return '<label class="ica-etapa' + (r.et === e[0] ? ' on' : '') + '"><input type="radio" name="et" value="' + e[0] + '"' + (r.et === e[0] ? ' checked' : '') + '><span class="ica-et ica-et--' + e[0] + '">' + esc(e[1]) + '</span></label>';
      }).join('') + '</div><label class="ica-campo"><span class="ica-campo__t">Nota para la bitácora <span class="ica-opc">(opcional)</span></span><textarea rows="2" maxlength="500" data-nota></textarea></label>' +
        '<p class="ica-nota">Creado, Requerimiento y Evaluación los pone la app sola (al crear, al enviar y al vencer el plazo). Aquí puedes moverlo a mano.</p>',
      pie: '<button type="button" class="kit-btn" data-cerrar>Cancelar</button><button type="button" class="kit-btn kit-btn--marca" data-ok>' + ico('check') + ' Guardar etapa</button>'
    });
    m.q('.ica-etapas').addEventListener('change', function () { m.querySelectorAll('.ica-etapa').forEach(function (l) { l.classList.toggle('on', l.querySelector('input').checked); }); });
    m.q('[data-ok]').addEventListener('click', function () {
      var btn = this, sel = m.q('input[name="et"]:checked');
      if (!sel || sel.value === r.et) { m.cerrar(); return; }
      ocupado(m, btn, true);
      var rid = btn.__rid || (btn.__rid = nuevoRid());
      guardando(llamar('etapa', { id: r.id, etapa: sel.value, nota: m.q('[data-nota]').value.trim() }, { post: true, rid: rid }), 'Guardando etapa').then(function (d) {
        parchar(d.fila); ocupado(m, btn, false); m.cerrar(); sonar('success'); aviso('Etapa actualizada.', 'ok'); if (activa()) pintarTodo();
      }, function (e) { ocupado(m, btn, false); if (e.codigo !== 'RED') btn.__rid = null; aviso(e.message, 'aviso'); });
    });
  }

  /* ══════════════ carga masiva ══════════════ */
  var CDN_XLSX = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
  function cargarXlsx() {
    if (window.XLSX) return Promise.resolve(window.XLSX);
    return new Promise(function (res, rej) {
      var s = document.createElement('script'); s.src = CDN_XLSX; s.async = true;
      s.onload = function () { window.XLSX ? res(window.XLSX) : rej(new Error('No cargó el lector de Excel.')); };
      s.onerror = function () { rej(new Error('No cargó el lector de Excel. Revisa tu internet.')); };
      document.head.appendChild(s);
    });
  }
  function abrirMasiva() {
    var m = modal({
      titulo: 'Carga masiva', icono: 'excel', ancha: true,
      cuerpo: '<ol class="ica-pasos"><li><b>Descarga la plantilla</b> y llénala: una fila por contribuyente. Trae listas para naturaleza, departamento y municipio.</li>' +
        '<li><b>Súbela aquí.</b> La app revisa cada fila antes de guardar y te muestra cuáles tienen errores.</li></ol>' +
        '<div class="ica-masiva-btns"><a class="kit-btn" href="plantillas/PLANTILLA_CARGA_ICA.xlsx" download data-salida="1">' + ico('descargar') + ' Descargar plantilla</a>' +
        '<label class="kit-btn kit-btn--marca ica-subir">' + ico('subir') + ' Subir Excel<input type="file" accept=".xlsx,.xls,.csv" hidden data-file></label></div>' +
        '<div data-res></div>',
      pie: '<button type="button" class="kit-btn" data-cerrar>Cerrar</button><button type="button" class="kit-btn kit-btn--marca" data-guardar hidden>' + ico('check') + ' Guardar</button>'
    });
    var buenas = [];
    m.q('[data-file]').addEventListener('change', function () {
      var file = this.files[0]; this.value = '';
      if (!file) return;
      m.q('[data-res]').innerHTML = '<div class="ica-cargando">Leyendo ' + esc(file.name) + '…</div>';
      Promise.all([cargarXlsx(), file.arrayBuffer()]).then(function (x) {
        var X = x[0], wb = X.read(x[1], { type: 'array', raw: false, cellText: true });
        var nombre = wb.SheetNames.indexOf('REQUERIMIENTOS') !== -1 ? 'REQUERIMIENTOS' : wb.SheetNames.filter(function (n) { return n !== 'INSTRUCCIONES' && n !== 'LISTAS'; })[0];
        var filas = X.utils.sheet_to_json(wb.Sheets[nombre], { header: 1, raw: false, defval: '' });
        revisar(filas);
      }).catch(function (e) { m.q('[data-res]').innerHTML = '<p class="ica-err">' + esc(e.message) + '</p>'; });
    });
    function revisar(filas) {
      var cab = (filas[0] || []).map(norm);
      var col = function (txt) { for (var i = 0; i < cab.length; i++) if (cab[i].indexOf(txt) !== -1) return i; return -1; };
      var c = { of: col('OFICIO'), nat: col('NATURALEZA'), ide: col('IDENTIFICACION'), nom: col('NOMBRE'), rep: col('REPRESENTANTE'),
        c1: col('CORREO PRINCIPAL'), c2: col('CORREO ADICIONAL'), dir: col('DIRECCION'), dep: col('DEPARTAMENTO'), mun: col('MUNICIPIO'), vig: col('VIGENCIA'), pl: col('DIAS') };
      if (c.of < 0 || c.ide < 0 || c.nom < 0) { m.q('[data-res]').innerHTML = '<p class="ica-err">El archivo no tiene las columnas de la plantilla. Descárgala y vuelve a intentarlo.</p>'; return; }
      var cat = window.ICA_MUNI, oficios = {}, malas = [];
      (S.lista || []).forEach(function (r) { oficios[r.of] = r.id; });
      buenas = [];
      for (var i = 1; i < filas.length; i++) {
        var f = filas[i], v = function (k) { return c[k] >= 0 ? String(f[c[k]] == null ? '' : f[c[k]]).trim() : ''; };
        if (!f.some(function (x) { return String(x).trim(); })) continue;
        var nat = norm(v('nat')).indexOf('JUR') === 0 ? 'JURIDICA' : 'NATURAL';
        var vig = v('vig').split(/[,;\s]+/).map(Number).filter(function (y) { return y >= ANIO0 && y <= anioActual(); });
        var dep = norm(v('dep')), mun = norm(v('mun'));
        if (cat) {
          var depOk = cat.departamentos.filter(function (d) { return norm(d) === dep; })[0];
          var munOk = depOk && cat.mapa[depOk].filter(function (x) { return norm(x) === mun; })[0];
          dep = depOk || dep; mun = munOk || '';
        }
        var d = { of: v('of'), nat: nat, ide: v('ide').replace(/\D/g, ''), nom: v('nom').replace(/\s+/g, ' '), rep: v('rep'), c1: v('c1').toLowerCase(), c2: v('c2').toLowerCase(),
          dir: v('dir'), dep: dep, mun: mun, vig: vig.join(', '), pl: v('pl') || ((S.cfg && S.cfg.plazo) || 15), un: (S.cfg && S.cfg.unidad) || 'HABILES' };
        var falta = validar(d, null);
        if (oficios[d.of]) falta.push('oficio repetido');
        if (nat === 'JURIDICA' && d.ide && !nitOk(d.ide)) falta.push('dígito de verificación del NIT no coincide');
        if (falta.length) malas.push({ fila: i + 1, nom: d.nom || d.of, error: falta.join(', ') });
        else { oficios[d.of] = 'nuevo'; buenas.push(d); }
      }
      m.q('[data-res]').innerHTML =
        '<div class="ica-masiva-res"><div class="ica-kpi ica-kpi--ok">' + ico('check', 18) + '<b>' + buenas.length + '</b><span>listas para guardar</span></div>' +
        '<div class="ica-kpi' + (malas.length ? ' ica-kpi--malo' : '') + '">' + ico('aviso', 18) + '<b>' + malas.length + '</b><span>con errores (no se guardan)</span></div></div>' +
        (malas.length ? '<div class="ica-tabla"><table><thead><tr><th>Fila</th><th>Contribuyente</th><th>Qué corregir</th></tr></thead><tbody>' +
          malas.slice(0, 200).map(function (x) { return '<tr><td>' + x.fila + '</td><td>' + esc(x.nom) + '</td><td>' + esc(x.error) + '</td></tr>'; }).join('') + '</tbody></table></div>' : '');
      var g = m.q('[data-guardar]');
      g.hidden = !buenas.length; g.innerHTML = ico('check') + ' Guardar ' + buenas.length;
    }
    m.q('[data-guardar]').addEventListener('click', function () {
      var btn = this;
      if (!buenas.length || m.__ocupado) return;
      ocupado(m, btn, true);
      var trozos = []; for (var i = 0; i < buenas.length; i += 100) trozos.push(buenas.slice(i, i + 100));
      var hechas = 0, rech = [];
      var cadena = trozos.reduce(function (p, t, k) {
        return p.then(function () {
          return llamar('crearlote', { filas: t }, { post: true, rid: (btn.__rid || (btn.__rid = nuevoRid())) + '-' + k }).then(function (res) {
            (res.filas || []).forEach(parchar); hechas += (res.filas || []).length;
            (res.rechazos || []).forEach(function (x) { rech.push(t[x.i].of + ': ' + x.error); });
          });
        });
      }, Promise.resolve());
      guardando(cadena, 'Guardando la carga masiva').then(function () {
        ocupado(m, btn, false); btn.hidden = true; btn.__rid = null; buenas = [];
        m.q('[data-res]').innerHTML = '<p class="ica-ok">' + ico('check') + ' Se guardaron <b>' + hechas + '</b> contribuyentes.</p>' +
          (rech.length ? '<p class="ica-err">No se guardaron: ' + rech.map(esc).join(' · ') + '</p>' : '');
        sonar('success'); if (activa()) pintarTodo();
      }, function (e) {
        ocupado(m, btn, false);
        m.q('[data-res]').insertAdjacentHTML('beforeend', '<p class="ica-err">' + esc(e.message) + (hechas ? ' (ya se habían guardado ' + hechas + ')' : '') + '</p>');
      });
    });
  }

  /* ══════════════ mi trabajo (bitácoras) ══════════════ */
  function registrarFuente() {
    var BX = window.BITEXPORT;
    if (!BX || !BX.fuentes || BX.fuentes[VISTA]) return;
    BX.fuentes[VISTA] = {
      clave: 'hac.bitexport.ica.v1', campo: 'bitacora', etiqueta: 'ANOTACIÓN', cosa: 'anotación', cosas: 'anotaciones',
      pastilla: 'bxp-pill-ica', wrap: '__ninguno__', ancla: '__ninguno__',
      pantalla: '__icaBitPantalla', todo: '__icaBitTodo', detalle: null, acciones: null,
      subtitulo: 'Secretaría de Hacienda · Industria y Comercio · Requerimientos',
      tituloUno: 'BITÁCORA DEL REQUERIMIENTO', tituloVar: 'BITÁCORA DE REQUERIMIENTOS ICA',
      archivoUno: 'BITACORA ICA ', archivoVar: 'BITACORAS REQUERIMIENTOS ICA',
      enPantalla: 'Lo que estoy viendo en Requerimientos', enTodo: 'Todos los requerimientos',
      todoTxt: 'Todos los requerimientos', pantallaTxt: 'Los requerimientos filtrados en pantalla',
      uno: 'requerimiento', varios: 'requerimientos', prefijo: 'OF. ',
      arriba: ['oficio', 'nombre'],
      oculto: function () { return false; },
      id: function (r) { return String(r.id || ''); },
      titulo: function (r) { return String(r.oficio || r.id || '—'); },
      quien: function (r) { return String(r.nombre || ''); },
      columnas: [
        { k: 'oficio', t: 'OFICIO SHM', def: true }, { k: 'nombre', t: 'CONTRIBUYENTE', def: true },
        { k: 'documento', t: 'NIT / CC', def: true }, { k: 'etapa', t: 'ETAPA', def: true },
        { k: 'municipio', t: 'MUNICIPIO', def: false }, { k: 'correo', t: 'CORREO', def: false }, { k: 'vigencias', t: 'VIGENCIAS', def: false }
      ]
    };
  }
  function abrirMiTrabajo() {
    var jefe = esJefe();
    var m = modal({
      titulo: 'Mi trabajo', icono: 'libro', ancha: true,
      cuerpo: '<div class="ica-mt-filtros">' +
          (jefe ? '<label class="ica-campo"><span class="ica-campo__t">De quién</span><select data-autor><option value="">Todas las personas</option></select></label>' : '') +
          '<label class="ica-campo"><span class="ica-campo__t">Desde</span><input type="date" data-desde></label>' +
          '<label class="ica-campo"><span class="ica-campo__t">Hasta</span><input type="date" data-hasta></label>' +
        '</div><div class="ica-mt-res" data-res></div><div class="ica-bit ica-mt" data-lista><div class="ica-cargando">Cargando bitácoras…</div></div>',
      pie: '<button type="button" class="kit-btn" data-cerrar>Cerrar</button><button type="button" class="kit-btn kit-btn--marca" data-bajar disabled>' + ico('descargar') + ' Descargar Excel o PDF</button>'
    });
    var todos = [];
    llamar('bitacoras', {}).then(function (filas) {
      todos = (filas || []).map(function (f) {
        var r = S.porId[f[0]] || {};
        return { id: f[0], oficio: f[1], nombre: f[2], documento: identTxt(f[4], f[3]), etapa: ETQ[f[5]] || f[5], bitacora: f[6],
          municipio: titulo(r.mun || ''), correo: [r.c1, r.c2].filter(String).join(', '), vigencias: r.vig || '' };
      });
      window.__icaBitTodo = todos;
      if (jefe) {
        var cuenta = {};
        todos.forEach(function (t) { leerBit(t.bitacora).forEach(function (a) { if (a.autor) cuenta[a.autor] = (cuenta[a.autor] || 0) + 1; }); });
        var sel = m.q('[data-autor]');
        Object.keys(cuenta).sort().forEach(function (a) { var o = document.createElement('option'); o.value = a; o.textContent = titulo(a) + ' (' + cuenta[a] + ')'; sel.appendChild(o); });
      }
      pintar(); m.q('[data-bajar]').disabled = false;
    }, function (e) { m.q('[data-lista]').innerHTML = '<p class="ica-err">' + esc(e.message) + '</p>'; });
    function autor() { return jefe ? (m.q('[data-autor]').value || '') : yo(); }
    function pintar() {
      var au = autor(), d1 = (m.q('[data-desde]').value || '').replace(/-/g, ''), d2 = (m.q('[data-hasta]').value || '').replace(/-/g, '');
      var items = [];
      todos.forEach(function (t) {
        leerBit(t.bitacora).forEach(function (a) {
          if (au && norm(a.autor) !== norm(au)) return;
          if (d1 && a.dia < Number(d1)) return;
          if (d2 && a.dia > Number(d2)) return;
          items.push({ a: a, t: t });
        });
      });
      items.sort(function (x, y) { return y.a.dia - x.a.dia; });
      window.__icaBitPantalla = todos.filter(function (t) { return items.some(function (x) { return x.t === t; }); });
      m.q('[data-res]').innerHTML = '<span class="hf-conteo"><b>' + items.length + '</b> anotaciones</span> <span class="hf-conteo"><b>' + window.__icaBitPantalla.length + '</b> requerimientos</span>';
      m.q('[data-lista]').innerHTML = items.length ? items.slice(0, 300).map(function (x) {
        return '<div class="ica-bit__it"><div class="ica-bit__cab"><b>Oficio ' + esc(x.t.oficio) + ' · ' + esc(x.t.nombre) + '</b><span>' + esc(x.a.fecha) + (jefe ? ' · ' + esc(titulo(x.a.autor)) : '') + '</span></div><p>' + esc(x.a.texto) + '</p></div>';
      }).join('') + (items.length > 300 ? '<p class="ica-nada">… y ' + (items.length - 300) + ' más (descárgalas para verlas todas).</p>' : '') : '<p class="ica-nada">' + (au ? 'Todavía no tienes anotaciones en este rango.' : 'Sin anotaciones en este rango.') + '</p>';
    }
    m.addEventListener('change', function (e) { if (e.target.matches('[data-autor],[data-desde],[data-hasta]')) pintar(); });
    m.q('[data-bajar]').addEventListener('click', function () {
      registrarFuente();
      if (!window.BITEXPORT) { aviso('La descarga no está disponible en este momento.', 'aviso'); return; }
      m.cerrar();
      window.BITEXPORT.abrir(null, VISTA, { autor: autor() });
    });
  }

  /* ══════════════ configuración de la vista ══════════════ */
  var GRUPOS = [['correo', 'Correo del requerimiento', 'sobre'], ['plazo', 'Plazos y seguimiento', 'reloj'], ['rec', 'Recordatorio', 'campana'],
    ['ins', '2.º requerimiento (insistencia)', 'megafono'], ['firmas', 'Firmas del documento', 'firma'], ['dev', 'Desarrollador', 'engranaje']];
  var MARCADORES = '{{numOficio}} {{fecha}} {{nombre}} {{tipo}} {{identificacion}} {{direccion}} {{correo}} {{municipio}} {{vigencias}} {{plazoTexto}} {{vence}} {{fechaEnvio}} {{diasRestantes}} {{firmaNombre}} {{firmaCargo}}';
  function abrirConfig() {
    var c = S.cfg;
    if (!c) { aviso('Espera a que cargue la vista.', 'info'); return; }
    var porG = {}; c.campos.forEach(function (x) { (porG[x.g] = porG[x.g] || []).push(x); });
    var m = modal({
      titulo: 'Configuración · Requerimientos', icono: 'engranaje', ancha: true,
      cuerpo: '<div class="ica-cfg-plant">' +
          '<button type="button" class="kit-btn" data-plant="' + esc(c.plantillaReq || '') + '"' + (c.plantillaReq ? '' : ' disabled') + '>' + ico('documento') + ' Ir a plantilla del requerimiento</button>' +
          '<button type="button" class="kit-btn" data-plant="' + esc(c.plantillaIns || '') + '"' + (c.plantillaIns ? '' : ' disabled') + '>' + ico('documento') + ' Ir a plantilla del 2.º requerimiento</button>' +
          (c.esDev ? '<label class="kit-btn ica-subir">' + ico('firma') + (c.hayFirma ? ' Cambiar firma de la Secretaria ✓' : ' Subir firma de la Secretaria') + '<input type="file" accept="image/png,image/jpeg" hidden data-firma></label>' : '') +
        '</div>' +
        '<p class="ica-nota">Marcadores que puedes usar en asuntos y cuerpos: <code>' + esc(MARCADORES) + '</code></p>' +
        GRUPOS.filter(function (g) { return porG[g[0]]; }).map(function (g) {
          return '<details class="ica-cfg-g"' + (g[0] === 'correo' ? ' open' : '') + '><summary>' + ico(g[2], 18) + ' ' + esc(g[1]) + '</summary>' +
            porG[g[0]].map(function (x) {
              var inp = x.largo ? '<textarea rows="8" data-k="' + esc(x.k) + '">' + esc(x.v) + '</textarea>' :
                (x.k === 'plazo.unidad' ? '<select data-k="plazo.unidad"><option value="HABILES"' + (x.v !== 'CALENDARIO' ? ' selected' : '') + '>Días hábiles</option><option value="CALENDARIO"' + (x.v === 'CALENDARIO' ? ' selected' : '') + '>Días calendario</option></select>' :
                  /\.on$/.test(x.k) ? '<select data-k="' + esc(x.k) + '"><option' + (x.v !== 'NO' ? ' selected' : '') + '>SI</option><option' + (x.v === 'NO' ? ' selected' : '') + '>NO</option></select>' :
                  '<input data-k="' + esc(x.k) + '" value="' + esc(x.v) + '"' + (x.tipo === 'numero' ? ' type="number" min="0"' : '') + (x.bloq ? ' disabled' : '') + '>');
              return '<label class="ica-campo' + (x.bloq ? ' ica-campo--bloq' : '') + '"><span class="ica-campo__t">' + esc(x.t) + (x.bloq ? ' <span class="ica-opc">· solo el desarrollador</span>' : '') + '</span>' + inp + '</label>';
            }).join('') + '</details>';
        }).join('') + '<p class="ica-err" data-err hidden></p>',
      pie: '<button type="button" class="kit-btn" data-cerrar>Cerrar</button><button type="button" class="kit-btn kit-btn--marca" data-guardar>' + ico('check') + ' Guardar cambios</button>'
    });
    m.querySelectorAll('[data-plant]').forEach(function (b) {
      b.addEventListener('click', function () { var id = b.getAttribute('data-plant'); if (id) window.open('https://docs.google.com/document/d/' + id + '/edit', '_blank', 'noopener'); });
    });
    var fi = m.q('[data-firma]');
    if (fi) fi.addEventListener('change', function () {
      var file = fi.files[0]; fi.value = ''; if (!file) return;
      if (file.size > 3 * 1024 * 1024) { aviso('La imagen de la firma debe pesar menos de 3 MB.', 'aviso'); return; }
      guardando(leerB64(file).then(function (b64) { return llamar('firma', { archivo: { nombre: file.name, mime: file.type, b64: b64 } }, { post: true, rid: nuevoRid() }); }), 'Guardando la firma')
        .then(function (cfg) { S.cfg = cfg; aviso('Firma guardada. Sale en los próximos documentos.', 'ok'); m.cerrar(); abrirConfig(); }, function (e) { aviso(e.message, 'aviso'); });
    });
    m.q('[data-guardar]').addEventListener('click', function () {
      var btn = this, cambios = {}, n = 0;
      c.campos.forEach(function (x) { if (x.bloq) return; var el = m.q('[data-k="' + x.k + '"]'); if (el && String(el.value) !== String(x.v)) { cambios[x.k] = el.value; n++; } });
      if (!n) { m.cerrar(); return; }
      ocupado(m, btn, true);
      var rid = btn.__rid || (btn.__rid = nuevoRid());
      guardando(llamar('cfgguardar', { cambios: cambios }, { post: true, rid: rid }), 'Guardando configuración').then(function (cfg) {
        S.cfg = cfg; ocupado(m, btn, false); m.cerrar(); sonar('success'); aviso('Configuración guardada.', 'ok'); if (activa()) pintarTodo();
      }, function (e) { ocupado(m, btn, false); if (e.codigo !== 'RED') btn.__rid = null; var er = m.q('[data-err]'); er.hidden = false; er.textContent = e.message; });
    });
  }

  /* ══════════════ insights (capa 11) ══════════════ */
  function insight(id) {
    var l = (window.__icaFiltrado && activa()) ? window.__icaFiltrado : (S.lista || []);
    var b = function (n) { return '**' + Number(n || 0).toLocaleString('es-CO') + '**'; };
    var rep = function (t, x, v) { return { titulo: t, texto: x, voz: v || x.replace(/\*\*/g, ''), lista: [] }; };
    if (!l.length) return rep('Requerimientos', 'No hay requerimientos en pantalla ahora mismo.\nQuita los filtros o agrega contribuyentes y consúltame otra vez.');
    var cuenta = function (fn) { var m = {}; l.forEach(function (r) { var k = fn(r); if (k == null) return; [].concat(k).forEach(function (kk) { m[kk] = (m[kk] || 0) + 1; }); }); return m; };
    var orden = function (m) { return Object.keys(m).sort(function (a, c) { return m[c] - m[a]; }); };
    var env = l.filter(function (r) { return r.env; }), resp = l.filter(function (r) { return r.resp; });
    var segs = cuenta(function (r) { return seg(r).k; });
    var tasa = env.length ? Math.round(resp.length * 100 / env.length) : 0;
    switch (id) {
      case 'etapa': {
        var e = cuenta(function (r) { return r.et; });
        return rep('Por etapa', ETAPAS.filter(function (x) { return e[x[0]]; }).map(function (x) { return '- ' + x[1] + ' — ' + b(e[x[0]]); }).join('\n'));
      }
      case 'pendientes': {
        var p = l.filter(function (r) { return seg(r).k === 'PEND'; }).sort(function (a, c) { return String(a.insv || a.ven).localeCompare(String(c.insv || c.ven)); });
        if (!p.length) return rep('Pendientes de seguimiento', '**Nada pendiente.** Ningún plazo vencido sin respuesta en lo que estás viendo. 👏');
        return rep('Pendientes de seguimiento', b(p.length) + ' requerimiento(s) vencieron sin respuesta:\n' + p.slice(0, 15).map(function (r) {
          return '- Oficio ' + r.of + ' · ' + r.nom + ' — venció el ' + fCorta(r.insv || r.ven) + (r.ins ? ' (2.º requerimiento)' : ' → enviar 2.º requerimiento'); }).join('\n') +
          (p.length > 15 ? '\n… y ' + (p.length - 15) + ' más.' : ''));
      }
      case 'porvencer': {
        var v = l.filter(function (r) { return seg(r).k === 'PORVENCER'; }).sort(function (a, c) { return String(a.ven).localeCompare(String(c.ven)); });
        if (!v.length) return rep('Por vencer', 'Ningún plazo vence en los próximos días hábiles.');
        return rep('Por vencer', b(v.length) + ' vencen pronto:\n' + v.slice(0, 15).map(function (r) { return '- Oficio ' + r.of + ' · ' + r.nom + ' — ' + seg(r).t; }).join('\n'));
      }
      case 'respuesta': {
        return rep('Tasa de respuesta', 'De ' + b(env.length) + ' requeridos, respondieron ' + b(resp.length) + ' (**' + tasa + ' %**).\n' +
          '- Pendientes de seguimiento — ' + b(segs.PEND || 0) + '\n- En plazo — ' + b((segs.PLAZO || 0) + (segs.PORVENCER || 0)) + '\n- 2.º requerimiento en curso — ' + b(segs.INSIST || 0));
      }
      case 'vigencias': {
        var g = cuenta(function (r) { return String(r.vig || '').split(/,\s*/).filter(String); });
        return rep('Por vigencia', Object.keys(g).sort().map(function (y) { return '- ' + y + ' — ' + b(g[y]) + ' contribuyentes'; }).join('\n'));
      }
      case 'municipio': {
        var mu = cuenta(function (r) { return titulo(r.mun) || 'Sin municipio'; }), o = orden(mu);
        return rep('Por municipio', o.slice(0, 12).map(function (k) { return '- ' + k + ' — ' + b(mu[k]); }).join('\n') + (o.length > 12 ? '\n… y ' + (o.length - 12) + ' municipios más.' : ''));
      }
      case 'naturaleza': {
        var n = cuenta(function (r) { return r.nat === 'JURIDICA' ? 'Personas jurídicas' : 'Personas naturales'; });
        return rep('Naturaleza', Object.keys(n).map(function (k) { return '- ' + k + ' — ' + b(n[k]); }).join('\n'));
      }
      case 'envios': {
        var me = cuenta(function (r) { return r.env ? r.env.slice(0, 7) : null; });
        var ks = Object.keys(me).sort();
        if (!ks.length) return rep('Envíos por mes', 'Aún no se ha enviado ningún requerimiento.');
        return rep('Envíos por mes', ks.map(function (k) { var p = k.split('-'); return '- ' + MESES[+p[1] - 1] + ' ' + p[0] + ' — ' + b(me[k]); }).join('\n'));
      }
      default: {
        return rep('Lo que estoy viendo',
          'Hay ' + b(l.length) + ' contribuyentes en pantalla; ' + b(env.length) + ' ya fueron requeridos y ' + b(l.length - env.length) + ' están sin enviar.\n\n' +
          '**Seguimiento**\n- Pendientes (vencidos sin respuesta) — ' + b(segs.PEND || 0) + '\n- Por vencer — ' + b(segs.PORVENCER || 0) +
          '\n- En plazo — ' + b(segs.PLAZO || 0) + '\n- Respondieron — ' + b(segs.RESP || 0) + ' (' + tasa + ' % de los requeridos)' +
          ((segs.PEND || 0) ? '\n\n👉 Revisa la pastilla **Pendiente de seguimiento**: allí está el botón del 2.º requerimiento.' : ''));
      }
    }
  }

  /* ══════════════ arranque ══════════════ */
  function enchufar() {
    var b = $('btn-ica-req');
    if (b && !b.__ica) { b.__ica = true; b.addEventListener('click', function () { sonar('back'); abrir(); }); }
    document.querySelectorAll('[data-ica-pronto]').forEach(function (x) {
      if (x.__ica) return; x.__ica = true;
      x.addEventListener('click', function () { aviso(x.getAttribute('data-ica-pronto') + ': próximamente.', 'info'); });
    });
  }
  /* Precarga de fondo al entrar (no bloquea nada): el clic en Requerimientos abre ya con datos. */
  window.addEventListener('hac:login', function () {
    olvidar();
    setTimeout(function () { if (puede() && url() && !S.cargado) cargar().catch(function () {}); }, 2500);
  });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', enchufar); else enchufar();

  window.ICA = {
    abrir: abrir, cargar: cargar, olvidar: olvidar, insight: insight, puede: puede,
    _S: S, _seg: seg, _dv: dvNit, _nitOk: nitOk, _habiles: habilesHasta, _validar: validar, _identTxt: identTxt
  };
}());
