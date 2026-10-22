/* ============================================================
   SEC-HACIENDA-FLANDES · SOPORTE (22/10/2026)

   El mismo soporte de FLANDES-CORE, en esta app:

   · TODOS: "Soporte" (tarjeta del inicio y menú de la foto) abre la pieza
     del kit (kit/soporte.js): cuenta lo que pasa con hasta 3 capturas
     (adjuntar, arrastrar o Ctrl+V), "Mis solicitudes" con el estado y la
     respuesta, y la calificación con ESTRELLAS cuando un caso queda
     RESUELTO (llega con el arranque: r.soporte, sin otro viaje).
   · Solo DEV: la vista SOPORTES (#view-soportes) con todos los casos,
     cifras, filtros, responder / cambiar estado, cargar uno a nombre de
     alguien, y descargas PDF, Excel e informe gerencial.

   La pieza del kit habla con el CORE (K.pedir 'soporte', 'soporteMios',
   'soporteCalificar'); aquí esas tres acciones se traducen a las rutas de
   HACIENDA (soportecrear, soportemios, soportecalificar).

   Rendimiento (reglas 11 a 18):
   · Una vista, un viaje: 'soportevista' trae lista + cifras + ajustes.
     Carga única por sesión; tras guardar se parcha el caso en memoria.
   · Las personas a quien cargar un soporte se piden solo al abrir ese
     formulario (una vez por sesión).
   · Toda escritura: botón ocupado desde el primer toque y un rid; un
     reintento (solo falla de red o el 404 de echo de Google) va con el
     MISMO rid. Una respuesta de otra sesión nunca pisa la actual.
   · Medición: window.__sopMed (ruta, ms, KB) y console.debug.
   ============================================================ */
(function () {
  'use strict';

  var K = window.KIT;
  if (!K) return;
  var M = window.MARCA || {};
  var VISTA = 'view-soportes';
  window.__sopMed = window.__sopMed || [];

  function $(id) { return document.getElementById(id); }
  function esc(s) { return K.esc(String(s == null ? '' : s)); }
  function ico(n, t) { return K.icono(n, t || 16); }
  function aviso(t, tono, ms) { K.aviso(t, tono || 'info', ms || 4000); }
  function esDev() { try { return !!(window.IDN && window.IDN.esDev()); } catch (e) { return false; } }
  function tk() { return window.HAC_SESION ? window.HAC_SESION.tk() : ''; }
  function nuevoRid() { return 'sop' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10); }
  function error(codigo, msg) { var e = new Error(msg); e.codigo = codigo; return e; }
  function esperar(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function titulo(s) {
    s = String(s || '').toLowerCase().replace(/(^|[\s(,])([a-záéíóúñü])/g, function (m, a, b) { return a + b.toUpperCase(); });
    return s.replace(/ (De|Del|La|Las|Los|Y|E|En|Para|Por|A) /g, function (m) { return m.toLowerCase(); });
  }

  /* ══════════════ red ══════════════
     op = { post, rid, signal }. Reintento ÚNICO y solo ante falla de red o
     respuesta que no es JSON (el 404 de echo de Google), con el mismo rid. */
  function llamar(accion, datos, op) {
    op = op || {}; datos = datos || {};
    var u = M.API_URL || '';
    var llave = tk();
    var t0 = performance.now();
    function una(n) {
      var p;
      if (!op.post) {
        var qs = '?action=' + encodeURIComponent(accion);
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
        if (llave !== tk()) throw error('VIEJA', 'Sesión cambiada');
        var med = { ruta: accion, ms: Math.round(performance.now() - t0), kb: Math.round(t.length / 102.4) / 10, n: n };
        try { window.__sopMed.push(med); if (window.__sopMed.length > 200) window.__sopMed.shift(); console.debug('[soporte]', med); } catch (e) {}
        if (!j.ok) {
          if (j.codigo === 'SESION_VENCIDA') { try { window.dispatchEvent(new CustomEvent('hac:sesionVencida', { detail: { mensaje: j.error } })); } catch (e) {} }
          throw error(j.codigo || 'ERROR', /Acción no válida/i.test(j.error || '') ? 'El servidor todavía no tiene el soporte. Avísale al desarrollador.' : (j.error || 'No se pudo completar.'));
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

  /* ══════════════ la pieza del kit habla con HACIENDA ══════════════ */
  var pedirAntes = K.pedir;
  K.pedir = function (accion, datos) {
    datos = datos || {};
    if (accion === 'soporte') {
      return llamar('soportecrear', { mensaje: datos.mensaje, contexto: datos.contexto, fotos: datos.fotos || [] }, { post: true, rid: datos.rid || nuevoRid() })
        .then(function (r) { if (D) { D = null; } return r; });   /* la vista DEV lo vuelve a traer */
    }
    if (accion === 'soporteMios') return llamar('soportemios', {});
    if (accion === 'soporteCalificar') {
      return llamar('soportecalificar', { id: datos.id, estrellas: datos.estrellas, comentario: datos.comentario || '' }, { post: true, rid: datos.rid || nuevoRid() });
    }
    return pedirAntes.apply(K, arguments);
  };

  /** "Soporte": el modal del kit, con la vista en la que está la persona. */
  function contar() {
    if (!K.piezas.soporte) { aviso('El soporte no cargó. Recarga la app.', 'aviso'); return; }
    var t = '';
    try { var b = K.piezas.banner && K.piezas.banner.elemento(); t = b ? (b.querySelector('.kit-banner__titulo') || {}).textContent || '' : ''; } catch (e) {}
    K.piezas.soporte.abrir({ vista: t || 'Inicio' });
  }

  /* ══════════════ SOPORTES (solo DEV) ══════════════ */

  var D = null;                     /* lo que trajo 'soportevista' */
  var F = { estado: 'ABIERTOS', buscar: '', desde: '', hasta: '' };
  var CTRL = null;
  var MOSTRAR = 60;
  var TONO = { PENDIENTE: 'aviso', 'EN PROCESO': 'info', RESUELTO: 'ok', REABIERTO: 'malo', CERRADO: 'nada' };
  var ETIQ = ['', 'Muy mala', 'Mala', 'Regular', 'Buena', 'Excelente'];
  var ESTADOS_F = [['', 'Todos'], ['ABIERTOS', 'Por atender'], ['PENDIENTE', 'Pendientes'], ['EN PROCESO', 'En proceso'],
                   ['REABIERTO', 'Reabiertos'], ['RESUELTO', 'Por calificar'], ['CERRADO', 'Cerrados'], ['REALIZADOS', 'Realizados']];

  function lista() { return (D && D.lista) || []; }
  function iso(f) { var m = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(String(f || '')); return m ? m[3] + '-' + m[2] + '-' + m[1] : ''; }
  function diasDesde(f) {
    var m = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(String(f || ''));
    if (!m) return -1;
    var d = new Date(+m[3], +m[2] - 1, +m[1]), h = new Date(); h.setHours(0, 0, 0, 0);
    return Math.round((h - d) / 864e5);
  }
  function estrellas(n, t) {
    var h = '';
    for (var i = 1; i <= 5; i++) h += '<span class="kit-est__v' + (i <= n ? ' kit-est__v--on' : '') + '">' + ico('estrella', t || 14) + '</span>';
    return '<span class="kit-est__ver" aria-label="' + n + ' de 5 estrellas">' + h + '</span>';
  }
  function cifras(l) {
    var c = { total: l.length, PENDIENTE: 0, 'EN PROCESO': 0, RESUELTO: 0, REABIERTO: 0, CERRADO: 0, calificados: 0, suma: 0, sinCalificar: 0 };
    l.forEach(function (x) {
      c[x.estado] = (c[x.estado] || 0) + 1;
      if (x.estrellas) { c.calificados++; c.suma += x.estrellas; }
      if (x.estado === 'RESUELTO' && !x.estrellas) c.sinCalificar++;
    });
    c.promedio = c.calificados ? Math.round(c.suma / c.calificados * 10) / 10 : 0;
    return c;
  }
  function pasaEstado(x, e) {
    if (e === 'REALIZADOS') return x.estado === 'RESUELTO' || x.estado === 'CERRADO';
    if (e === 'ABIERTOS') return x.estado === 'PENDIENTE' || x.estado === 'EN PROCESO' || x.estado === 'REABIERTO';
    return !e || x.estado === e;
  }
  function filtradas() {
    var q = K.norm(F.buscar);
    return lista().filter(function (x) {
      if (!pasaEstado(x, F.estado)) return false;
      var d = iso(x.fecha);
      if (F.desde && (!d || d < F.desde)) return false;
      if (F.hasta && (!d || d > F.hasta)) return false;
      if (q && K.norm([x.id, x.emisor, x.documento, x.solicitud, x.respuesta, x.comentario, x.rol, x.tipo, x.vista].join(' ')).indexOf(q) < 0) return false;
      return true;
    });
  }
  function fundir(x) {
    if (!x || !D) return;
    var l = D.lista, i;
    for (i = 0; i < l.length; i++) if (l[i].id === x.id) { l[i] = x; break; }
    if (i === l.length) l.unshift(x);
    D.cifras = cifras(l);
  }

  function traer(fresco) {
    if (D && !fresco) return Promise.resolve(D);
    if (CTRL) { try { CTRL.abort(); } catch (e) {} }
    CTRL = window.AbortController ? new AbortController() : null;
    return llamar('soportevista', {}, { signal: CTRL && CTRL.signal }).then(function (d) {
      D = d || { lista: [] }; D.cifras = cifras(D.lista || []); CTRL = null; return D;
    });
  }

  function activa() { var v = $(VISTA); return !!(v && v.classList.contains('active')); }

  function montarVista() {
    if ($(VISTA)) return $(VISTA);
    var cont = document.querySelector('.container') || document.body;
    var sec = document.createElement('section');
    sec.id = VISTA; sec.className = 'view';
    sec.innerHTML =
      '<div class="vista kit-ancho sop">' +
        '<div class="hf-herramientas sop-herr">' +
          '<button type="button" class="kit-btn kit-btn--marca" id="sop-cargar">' + ico('mas') + ' Registrar un soporte</button>' +
          '<button type="button" class="kit-btn" id="sop-pdf">' + ico('pdf') + ' PDF</button>' +
          '<button type="button" class="kit-btn" id="sop-xls">' + ico('excel') + ' Excel</button>' +
          '<button type="button" class="kit-btn" id="sop-ger">' + ico('tendencia') + ' Informe gerencial</button>' +
          '<button type="button" class="kit-btn" id="sop-refrescar" title="Volver a traer los soportes">' + ico('recargar') + ' Refrescar</button>' +
        '</div>' +
        '<div class="kit-tarjeta sop-cifras" id="sop-cifras"></div>' +
        '<div class="hf-barra">' +
          '<span class="hf-conteo"><b id="sop-count">0</b> <span id="sop-count-t">soportes</span></span>' +
          '<label class="hf-buscar"><i class="hi" data-ico="buscar"></i><input id="sop-buscar" type="search" placeholder="Buscar por persona, documento, número o texto" autocomplete="off"></label>' +
        '</div>' +
        '<div class="sop-filtros">' +
          '<div class="kit-pastillas" id="sop-pills" role="group" aria-label="Estado"></div>' +
          '<div class="sop-fechas"><label><span>Desde</span><input type="date" id="sop-desde"></label><label><span>Hasta</span><input type="date" id="sop-hasta"></label>' +
          '<button type="button" class="kit-btn kit-btn--plano" id="sop-limpiar">' + ico('cerrar', 14) + ' Quitar filtros</button></div>' +
        '</div>' +
        '<div id="sop-lista" class="sop-lista"></div>' +
        '<div class="sop-mas"><button type="button" class="kit-btn" id="sop-vermas" hidden>Ver más</button></div>' +
        '<button type="button" class="hf-atras" hidden>Regresar</button>' +
      '</div>';
    cont.appendChild(sec);
    try { sec.querySelectorAll('i.hi[data-ico]').forEach(function (i) { i.outerHTML = ico(i.getAttribute('data-ico'), 18); }); } catch (e) {}

    sec.querySelector('.hf-atras').addEventListener('click', salir);
    $('sop-cargar').addEventListener('click', cargar);
    $('sop-pdf').addEventListener('click', function () { exportar('pdf', this); });
    $('sop-xls').addEventListener('click', function () { exportar('xlsx', this); });
    $('sop-ger').addEventListener('click', function () { gerencial(this); });
    $('sop-refrescar').addEventListener('click', refrescar);
    $('sop-vermas').addEventListener('click', function () { MOSTRAR += 60; pintar(); });
    var tq = null;
    $('sop-buscar').addEventListener('input', function (e) {
      clearTimeout(tq); var v = e.target.value;
      tq = setTimeout(function () { F.buscar = v; MOSTRAR = 60; pintar(); }, 140);
    });
    $('sop-desde').addEventListener('change', function () { F.desde = this.value; pintar(); });
    $('sop-hasta').addEventListener('change', function () { F.hasta = this.value; pintar(); });
    $('sop-limpiar').addEventListener('click', function () {
      F = { estado: '', buscar: '', desde: '', hasta: '' };
      $('sop-buscar').value = ''; $('sop-desde').value = ''; $('sop-hasta').value = '';
      pintar();
    });
    var pz = $('sop-pills');
    ESTADOS_F.forEach(function (e) {
      var b = K.nodo('<button type="button" class="kit-pastilla" data-e="' + e[0] + '" aria-pressed="false"><span></span> <b class="sop-n">0</b></button>');
      b.querySelector('span').textContent = e[1];
      b.addEventListener('click', function () { K.vibrar(6); F.estado = e[0]; MOSTRAR = 60; pintar(); });
      pz.appendChild(b);
    });
    $('sop-lista').addEventListener('click', alClic);
    return sec;
  }

  function esqueleto() {
    var h = '';
    for (var i = 0; i < 3; i++) h += '<div class="kit-tarjeta sop-c sop-esq"><span></span><span></span><span></span></div>';
    $('sop-lista').innerHTML = h;
    $('sop-cifras').innerHTML = '<div class="sop-esq sop-esq--cifras"><span></span></div>';
  }

  function abrir() {
    if (!esDev()) { aviso('Solo el desarrollador gestiona los soportes.', 'aviso'); return; }
    var t0 = performance.now();
    montarVista();
    if (typeof window.showView === 'function') window.showView(VISTA);
    if (D) { pintar(); return; }
    esqueleto();
    traer().then(function () {
      if (!activa()) return;
      pintar();
      try { window.__sopMed.push({ ruta: 'vista:soportes', ms: Math.round(performance.now() - t0) }); } catch (e) {}
    }, function (e) {
      if (cancelada(e) || !activa()) return;
      $('sop-lista').innerHTML = '<div class="sop-vacio">' + ico('aviso', 28) + '<p>' + esc(e.message) + '</p>' +
        '<button type="button" class="kit-btn" id="sop-reintentar">' + ico('recargar') + ' Reintentar</button></div>';
      $('sop-cifras').innerHTML = '';
      var b = $('sop-reintentar'); if (b) b.addEventListener('click', abrir);
    });
  }
  function salir() {
    if (CTRL) { try { CTRL.abort(); } catch (e) {} CTRL = null; }
    try { if (window.VISOR && window.VISOR.abierto && window.VISOR.abierto()) window.VISOR.cerrar(); } catch (e) {}
    if (typeof window.showView === 'function') window.showView('view-inicio');
  }
  function refrescar() {
    var b = $('sop-refrescar');
    if (!b || b.disabled) return;
    b.disabled = true; b.classList.add('kit-ocupado');
    traer(true).then(function () { if (activa()) pintar(); aviso('Soportes al día.', 'ok', 2000); },
      function (e) { if (!cancelada(e)) aviso(e.message, 'aviso', 5000); })
      .then(function () { b.disabled = false; b.classList.remove('kit-ocupado'); });
  }

  function pintarCifras() {
    var c = (D && D.cifras) || cifras([]);
    var z = $('sop-cifras');
    z.innerHTML = '';
    var r = K.nodo('<div class="sop-cifras__r"></div>');
    [[c.PENDIENTE, 'Pendientes', 'PENDIENTE'], [c['EN PROCESO'], 'En proceso', 'EN PROCESO'], [c.REABIERTO, 'Reabiertos', 'REABIERTO'],
     [c.sinCalificar, 'Por calificar', 'RESUELTO'], [c.CERRADO, 'Cerrados', 'CERRADO']].forEach(function (x) {
      var b = K.nodo('<button type="button" class="sop-cifra' + (x[2] === 'REABIERTO' && x[0] ? ' sop-cifra--malo' : '') + '"><b>' + K.numero(x[0] || 0) + '</b><span>' + esc(x[1]) + '</span></button>');
      b.addEventListener('click', function () { K.vibrar(6); F.estado = x[2]; MOSTRAR = 60; pintar(); });
      r.appendChild(b);
    });
    z.appendChild(r);
    var p = K.nodo('<p class="sop-prom"></p>');
    if (c.calificados) p.innerHTML = estrellas(Math.round(c.promedio), 18) + ' <b>' + String(c.promedio).replace('.', ',') + '</b> de 5 · ' + c.calificados + (c.calificados === 1 ? ' calificación' : ' calificaciones');
    else p.textContent = 'Todavía nadie ha calificado un soporte.';
    z.appendChild(p);
  }

  function pintar() {
    if (!D || !$(VISTA)) return;
    var t0 = performance.now();
    pintarCifras();
    var n = {};
    ESTADOS_F.forEach(function (e) { n[e[0]] = lista().filter(function (x) { return pasaEstado(x, e[0]); }).length; });
    $('sop-pills').querySelectorAll('.kit-pastilla').forEach(function (b) {
      var e = b.getAttribute('data-e');
      b.setAttribute('aria-pressed', String(e === F.estado));
      b.querySelector('.sop-n').textContent = K.numero(n[e] || 0);
    });
    var l = filtradas();
    $('sop-count').textContent = K.numero(l.length);
    $('sop-count-t').textContent = (l.length === 1 ? 'soporte' : 'soportes') + ' con estos filtros · ' + K.numero(lista().length) + ' en total';
    var z = $('sop-lista');
    if (!l.length) {
      z.innerHTML = '<div class="sop-vacio">' + ico('salvavidas', 30) + '<p>' +
        (lista().length ? 'Ningún soporte con esos filtros.' : 'Todavía no hay soportes. Aparecen apenas alguien cuente un problema desde la app, o cuando registres uno.') + '</p></div>';
      $('sop-vermas').hidden = true;
      return;
    }
    var frag = document.createDocumentFragment();
    l.slice(0, MOSTRAR).forEach(function (x) { frag.appendChild(tarjeta(x)); });
    z.innerHTML = ''; z.appendChild(frag);
    $('sop-vermas').hidden = l.length <= MOSTRAR;
    try { console.debug('[soporte] pintar', l.length, Math.round(performance.now() - t0) + ' ms'); } catch (e) {}
  }

  function tarjeta(x) {
    var t = K.nodo('<article class="kit-tarjeta sop-c sop-c--' + (TONO[x.estado] || 'nada') + '" data-id="' + esc(x.id) + '">' +
      '<div class="sop-c__cab"><span class="sop-c__cara"></span><div class="sop-c__t"><b></b><small></small></div><span class="sop-est"></span></div>' +
      '<p class="sop-c__meta"></p><p class="sop-c__sol"></p></article>');
    if (K.piezas.personas && K.piezas.personas.avatar) { try { t.querySelector('.sop-c__cara').appendChild(K.piezas.personas.avatar(x.emisor || 'SIN NOMBRE', { tam: 40 })); } catch (e) {} }
    t.querySelector('.sop-c__t b').textContent = titulo(x.emisor || 'Sin nombre');
    t.querySelector('.sop-c__t small').textContent = [x.rol, x.documento].filter(Boolean).join(' · ');
    var est = t.querySelector('.sop-est');
    est.textContent = x.estado === 'RESUELTO' ? 'RESUELTO · por calificar' : x.estado;
    est.classList.add('sop-est--' + (TONO[x.estado] || 'nada'));
    var dias = diasDesde(x.fecha);
    t.querySelector('.sop-c__meta').textContent = [x.id, x.fecha ? x.fecha.slice(0, 16) : '', x.tipo && x.tipo !== 'SOLICITUD' ? x.tipo.toLowerCase() : '', x.vista ? 'vista: ' + x.vista : ''].filter(Boolean).join(' · ');
    if (x.reabierto) t.querySelector('.sop-c__meta').appendChild(K.nodo('<em class="sop-re">' + ico('recargar', 12) + ' reabierto ' + x.reabierto + (x.reabierto === 1 ? ' vez' : ' veces') + '</em>'));
    if ((x.estado === 'PENDIENTE' || x.estado === 'REABIERTO') && dias >= 2) t.querySelector('.sop-c__meta').appendChild(K.nodo('<em class="sop-dias">' + dias + ' días esperando</em>'));
    t.querySelector('.sop-c__sol').textContent = x.solicitud;
    if (x.fotos && x.fotos.length) {
      var zf = K.nodo('<div class="sop-fotos"></div>');
      x.fotos.forEach(function (id, i) {
        var b = K.nodo('<button type="button" class="kit-btn kit-btn--plano sop-mini" data-acc="foto" data-i="' + i + '">' + ico('imagen', 14) + ' Captura ' + (i + 1) + '</button>');
        zf.appendChild(b);
      });
      t.appendChild(zf);
    }
    if (x.respuesta) {
      var r = K.nodo('<div class="sop-resp"><p class="sop-et">Respuesta</p><p class="sop-resp__t"></p><small></small></div>');
      r.querySelector('.sop-resp__t').textContent = x.respuesta;
      r.querySelector('small').textContent = [x.respondidoPor ? titulo(x.respondidoPor) : '', x.fechaRespuesta].filter(Boolean).join(' · ');
      t.appendChild(r);
    }
    if (x.estrellas) {
      var q = K.nodo('<p class="sop-cal"></p>');
      q.innerHTML = estrellas(x.estrellas, 16) + ' <b>' + ETIQ[x.estrellas] + '</b>';
      if (x.comentario) q.appendChild(document.createTextNode(' · “' + x.comentario + '”'));
      t.appendChild(q);
    }
    if (x.historial && x.historial.length) {
      var det = K.nodo('<details class="sop-det"><summary>' + ico('abajo', 12) + ' Historial (' + x.historial.length + ')</summary><div class="sop-traza"></div></details>');
      x.historial.forEach(function (h) {
        var p = K.nodo('<p></p>');
        p.textContent = [h.fecha, h.evento, titulo(h.quien), h.detalle].filter(Boolean).join(' · ');
        det.querySelector('.sop-traza').appendChild(p);
      });
      t.appendChild(det);
    }
    var acc = K.nodo('<div class="sop-c__acc"></div>');
    if (x.estado !== 'CERRADO') acc.appendChild(K.nodo('<button type="button" class="kit-btn kit-btn--plano sop-mini" data-acc="responder">' + ico('responder', 14) + (x.respuesta ? ' Responder de nuevo' : ' Responder') + '</button>'));
    if (x.contacto) {
      var tel = x.contacto.length === 10 ? '57' + x.contacto : x.contacto;
      var a = K.nodo('<a class="kit-btn kit-btn--plano sop-mini" target="_blank" rel="noopener">' + ico('whatsapp', 14) + ' Escribirle</a>');
      a.href = 'https://wa.me/' + tel + '?text=' + encodeURIComponent('Hola ' + titulo(String(x.emisor || '').split(' ')[0]) + ', te escribo por tu solicitud de soporte ' + x.id + '.');
      acc.appendChild(a);
    }
    if (acc.children.length) t.appendChild(acc);
    return t;
  }

  function porId(id) { var l = lista(); for (var i = 0; i < l.length; i++) if (l[i].id === id) return l[i]; return null; }
  function alClic(e) {
    var b = e.target.closest('[data-acc]'); if (!b) return;
    var c = b.closest('.sop-c'); var x = c && porId(c.getAttribute('data-id'));
    if (!x) return;
    if (b.getAttribute('data-acc') === 'responder') responder(x);
    if (b.getAttribute('data-acc') === 'foto') {
      if (!window.VISOR || !window.VISOR.lista) { aviso('El visor no cargó. Recarga la app.', 'aviso'); return; }
      window.VISOR.lista(x.fotos.map(function (id, j) { return { id: id, titulo: x.id + ' · captura ' + (j + 1), mime: 'image/jpeg' }; }), { indice: Number(b.getAttribute('data-i')) || 0 });
    }
  }

  /* ══════════════ capa (modal) con el estilo del kit ══════════════ */
  function capa(tituloTxt, cuerpo, botones) {
    var h = K.nodo('<div class="kit-capa kit-sop kit-capa--on sop-capa" role="dialog" aria-modal="true">' +
      '<div class="kit-capa__velo"></div><section class="kit-capa__hoja kit-sop__hoja sop-hoja">' +
      '<header class="kit-capa__h"><span></span><button type="button" class="kit-capa__x" aria-label="Cerrar">' + ico('cerrar', 18) + '</button></header>' +
      '<div class="kit-capa__cuerpo kit-sop__cuerpo"></div><footer class="kit-capa__pie"></footer></section></div>');
    h.querySelector('.kit-capa__h span').textContent = tituloTxt;
    h.querySelector('.kit-capa__cuerpo').appendChild(cuerpo);
    var api = { ocupado: false, botones: [], cerrar: null };
    function fuera() { if (api.ocupado) return; document.removeEventListener('keydown', tecla); if (api.alCerrar) api.alCerrar(); h.remove(); }
    function tecla(e) { if (e.key === 'Escape') fuera(); }
    api.cerrar = fuera;
    h.querySelector('.kit-capa__x').addEventListener('click', fuera);
    h.querySelector('.kit-capa__velo').addEventListener('click', fuera);
    document.addEventListener('keydown', tecla);
    (botones || []).forEach(function (b) {
      var el = K.nodo('<button type="button" class="kit-btn' + (b.marca ? ' kit-btn--marca' : '') + '"></button>');
      el.innerHTML = (b.icono ? ico(b.icono, 16) + ' ' : '') + esc(b.texto);
      el.addEventListener('click', function () { b.al(el); });
      h.querySelector('.kit-capa__pie').appendChild(el);
      api.botones.push(el);
    });
    document.body.appendChild(h);
    return api;
  }
  function ocupar(api, b, si) {
    api.ocupado = si; K.ocupado = si;
    api.botones.forEach(function (x) { x.disabled = si; });
    if (b) b.classList.toggle('kit-ocupado', si);
  }

  /* ══════════════ responder / cambiar estado ══════════════ */
  function responder(x) {
    var elegido = 'RESUELTO', rid = nuevoRid();
    var f = K.nodo('<div class="sop-form">' +
      '<div class="sop-form__sol"><p class="sop-et"></p><p class="sop-form__txt"></p></div>' +
      '<div class="kit-pastillas sop-estados" role="radiogroup" aria-label="Estado"></div>' +
      '<label class="kit-sop__campo"><span>Qué se hizo (es lo que la persona lee y califica)</span><textarea rows="5" maxlength="3000"></textarea></label>' +
      '<label class="sop-check"><input type="checkbox" checked><span>Avisarle y pedirle que califique (push y WhatsApp)</span></label>' +
      '<p class="sop-nota"></p></div>');
    f.querySelector('.sop-et').textContent = x.id + ' · ' + titulo(x.emisor);
    f.querySelector('.sop-form__txt').textContent = x.solicitud;
    var txt = f.querySelector('textarea');
    txt.value = x.estado === 'REABIERTO' ? '' : (x.respuesta || '');
    if (x.estado === 'REABIERTO') txt.placeholder = 'Lo reabrió con ' + x.estrellas + (x.estrellas === 1 ? ' estrella' : ' estrellas') + (x.comentario ? ': “' + x.comentario + '”' : '');
    var chk = f.querySelector('input[type=checkbox]'), nota = f.querySelector('.sop-nota'), z = f.querySelector('.sop-estados');
    [['PENDIENTE', 'Pendiente'], ['EN PROCESO', 'La estoy atendiendo'], ['RESUELTO', 'Quedó resuelto']].forEach(function (e) {
      var b = K.nodo('<button type="button" class="kit-pastilla" role="radio" aria-pressed="' + (e[0] === elegido) + '"></button>');
      b.textContent = e[1];
      b.addEventListener('click', function () { elegido = e[0]; z.querySelectorAll('.kit-pastilla').forEach(function (y) { y.setAttribute('aria-pressed', String(y === b)); }); pintarNota(); });
      z.appendChild(b);
    });
    function pintarNota() {
      chk.parentNode.hidden = elegido !== 'RESUELTO';
      nota.textContent = elegido === 'RESUELTO' ? 'Al guardar le llega el aviso y la próxima vez que entre a la app califica con estrellas.' : 'Queda ' + elegido + ': la persona lo ve así en Mis solicitudes.';
    }
    pintarNota();
    var m = capa(x.estado === 'REABIERTO' ? 'Responder el caso reabierto' : 'Responder el soporte', f, [
      { texto: 'Cancelar', al: function () { m.cerrar(); } },
      { texto: 'Guardar', icono: 'check', marca: true, al: function (b) {
        if (m.ocupado) return;
        var t = txt.value.trim();
        if (elegido === 'RESUELTO' && t.length < 5) { txt.focus(); aviso('Escribe qué se hizo: es lo que la persona va a calificar.', 'aviso', 5000); return; }
        ocupar(m, b, true);
        var t0 = performance.now();
        llamar('soporteresponder', { id: x.id, estado: elegido, respuesta: t, avisar: chk.checked }, { post: true, rid: rid }).then(function (r) {
          ocupar(m, b, false);
          fundir(r.soporte); m.cerrar(); pintar();
          aviso(elegido === 'RESUELTO' ? 'Resuelto. ' + (chk.checked ? 'Le llega el aviso para calificar.' : '') : 'Guardado: ' + elegido + '.', 'ok', 4000);
          try { window.__sopMed.push({ ruta: 'guardar:responder', ms: Math.round(performance.now() - t0) }); } catch (e) {}
        }, function (e) { ocupar(m, b, false); if (!cancelada(e)) aviso(e.message, 'malo', 8000); });
      } }]);
    setTimeout(function () { txt.focus(); }, 120);
  }

  /* ══════════════ registrar un soporte a nombre de alguien ══════════════ */
  var PERSONAS = null, PERSONAS_P = null;
  function traerPersonas() {
    if (PERSONAS) return Promise.resolve(PERSONAS);
    if (!PERSONAS_P) PERSONAS_P = llamar('soportepersonas', {}).then(function (p) { PERSONAS = (p.filas || []).map(function (f) { return { doc: f[0], nombre: f[1], roles: f[2] }; }); PERSONAS_P = null; return PERSONAS; },
      function (e) { PERSONAS_P = null; throw e; });
    return PERSONAS_P;
  }

  function cargar() {
    var para = null, estado = 'RESUELTO', adj = null, rid = nuevoRid();
    var f = K.nodo('<div class="sop-form">' +
      '<div class="kit-sop__campo sop-quien"><span>Para quién</span>' +
      '<label class="hf-buscar sop-bus"><i class="hi" data-ico="buscar"></i><input type="search" autocomplete="off" placeholder="Nombre o documento"></label>' +
      '<div class="sop-res" role="listbox"></div><div class="sop-elegido" hidden></div></div>' +
      '<label class="kit-sop__campo"><span>Qué pidió o qué le pasaba</span><textarea class="sop-sol" rows="3" maxlength="3000" placeholder="Ej: no le abría el Drive de su expediente"></textarea></label>' +
      '<div class="kit-pastillas sop-estados" role="radiogroup" aria-label="Estado"></div>' +
      '<label class="kit-sop__campo sop-campo-resp"><span>Qué se hizo</span><textarea class="sop-resp-in" rows="3" maxlength="3000" placeholder="Ej: se le compartió la carpeta a su correo nuevo"></textarea></label>' +
      '<div class="kit-sop__fotos"><span class="kit-sop__et">Capturas (opcional, hasta 3: adjuntar, arrastrar o Ctrl+V)</span><div class="sop-zona"></div></div>' +
      '<label class="sop-check sop-avisar"><input type="checkbox" checked><span>Avisarle y pedirle que califique</span></label>' +
      '</div>');
    try { f.querySelectorAll('i.hi[data-ico]').forEach(function (i) { i.outerHTML = ico(i.getAttribute('data-ico'), 18); }); } catch (e) {}
    var inp = f.querySelector('.sop-bus input'), res = f.querySelector('.sop-res'), eleg = f.querySelector('.sop-elegido');
    var esperando = !PERSONAS;
    traerPersonas().then(function () { esperando = false; buscar(); }, function (e) { res.innerHTML = ''; res.appendChild(K.nodo('<p class="sop-nota sop-nota--malo">No se pudo traer la lista de personas: ' + esc(e.message) + '</p>')); });
    function buscar() {
      res.innerHTML = '';
      if (esperando) { res.appendChild(K.nodo('<p class="sop-nota">Trayendo la lista de personas…</p>')); return; }
      var q = K.norm(inp.value);
      if (q.length < 2) { res.appendChild(K.nodo('<p class="sop-nota">Escribe al menos dos letras o números.</p>')); return; }
      var l = PERSONAS.filter(function (p) { return K.norm([p.nombre, p.doc, p.roles].join(' ')).indexOf(q) >= 0; });
      if (!l.length) { res.appendChild(K.nodo('<p class="sop-nota">Nadie con eso.</p>')); return; }
      l.slice(0, 8).forEach(function (p) {
        var b = K.nodo('<button type="button" class="sop-per" role="option"><b></b><small></small></button>');
        b.querySelector('b').textContent = titulo(p.nombre);
        b.querySelector('small').textContent = p.doc + (p.roles ? ' · ' + p.roles : '');
        b.addEventListener('click', function () { elegir(p); });
        res.appendChild(b);
      });
    }
    function elegir(p) {
      para = p; res.innerHTML = ''; inp.parentNode.hidden = true; eleg.hidden = false; eleg.innerHTML = '';
      var c = K.nodo('<div class="sop-per sop-per--on"><b></b><small></small><button type="button" class="kit-btn kit-btn--plano sop-mini">Cambiar</button></div>');
      c.querySelector('b').textContent = titulo(p.nombre);
      c.querySelector('small').textContent = p.doc + (p.roles ? ' · ' + p.roles : '');
      c.querySelector('button').addEventListener('click', function () { para = null; eleg.hidden = true; inp.parentNode.hidden = false; inp.focus(); });
      eleg.appendChild(c);
    }
    inp.addEventListener('input', K.debounce(buscar, 120));
    var ze = f.querySelector('.sop-estados'), cAv = f.querySelector('.sop-avisar');
    [['PENDIENTE', 'Queda pendiente'], ['EN PROCESO', 'Lo estoy atendiendo'], ['RESUELTO', 'Ya quedó resuelto']].forEach(function (x) {
      var b = K.nodo('<button type="button" class="kit-pastilla" role="radio" aria-pressed="' + (x[0] === estado) + '"></button>');
      b.textContent = x[1];
      b.addEventListener('click', function () { estado = x[0]; ze.querySelectorAll('.kit-pastilla').forEach(function (y) { y.setAttribute('aria-pressed', String(y === b)); }); cAv.hidden = estado !== 'RESUELTO'; });
      ze.appendChild(b);
    });
    var m = capa('Registrar un soporte', f, [
      { texto: 'Cancelar', al: function () { m.cerrar(); } },
      { texto: 'Guardar soporte', icono: 'check', marca: true, al: function (b) {
        if (m.ocupado) return;
        var sol = f.querySelector('.sop-sol').value.trim(), resp = f.querySelector('.sop-resp-in').value.trim();
        if (!para) { inp.focus(); aviso('Escoge a la persona.', 'aviso', 4000); return; }
        if (sol.length < 10) { f.querySelector('.sop-sol').focus(); aviso('Cuenta qué pidió (al menos diez letras).', 'aviso', 4000); return; }
        if (estado === 'RESUELTO' && resp.length < 5) { f.querySelector('.sop-resp-in').focus(); aviso('Escribe qué se hizo: es lo que la persona va a calificar.', 'aviso', 5000); return; }
        ocupar(m, b, true);
        var t0 = performance.now();
        fotos(adj).then(function (fs) {
          return llamar('soportecargar', { documento: para.doc, solicitud: sol, respuesta: resp, estado: estado, avisar: f.querySelector('.sop-avisar input').checked, fotos: fs }, { post: true, rid: rid });
        }).then(function (r) {
          ocupar(m, b, false);
          fundir(r.soporte); m.cerrar();
          F.estado = ''; pintar();
          aviso('Quedó el soporte ' + r.soporte.id + '.', 'ok', 5000);
          try { window.__sopMed.push({ ruta: 'guardar:cargar', ms: Math.round(performance.now() - t0) }); } catch (e) {}
        }, function (e) { ocupar(m, b, false); if (!cancelada(e)) aviso(e.message, 'malo', 8000); });
      } }]);
    if (K.piezas.adjuntos) adj = K.piezas.adjuntos.montar(f.querySelector('.sop-zona'), { acepta: 'image/*', varios: true, maximo: 3, maximoMB: 6 });
    m.alCerrar = function () { if (adj && adj.desmontar) adj.desmontar(); };
    setTimeout(function () { inp.focus(); }, 120);
  }

  /** Las capturas reducidas a JPEG, como en el soporte de las apps (kit/imagenes.js). */
  function fotos(adj) {
    if (!adj) return Promise.resolve([]);
    var l = adj.archivos ? adj.archivos() : [];
    if (!l.length) return Promise.resolve([]);
    var I = K.piezas.imagenes;
    if (!I || !I.preparar) return adj.aBase64();
    return Promise.all(l.map(function (f, i) {
      return I.preparar(f).then(function (r) {
        return { nombre: 'captura-' + (i + 1) + '.jpg', tipo: 'image/jpeg', datos: String(r.dataUrl).slice(String(r.dataUrl).indexOf(',') + 1) };
      });
    }));
  }

  /* ══════════════ PDF, Excel e informe gerencial ══════════════ */
  function filasExp(l) {
    return l.map(function (x) {
      return { id: x.id, fecha: x.fecha, persona: titulo(x.emisor), documento: x.documento, rol: x.rol, tipo: x.tipo, estado: x.estado,
               solicitud: x.solicitud, respuesta: x.respuesta, atendio: titulo(x.respondidoPor), fechaRespuesta: x.fechaRespuesta,
               estrellas: x.estrellas || '', calificacion: x.estrellas ? x.estrellas + ' de 5 · ' + ETIQ[x.estrellas] : (x.estado === 'RESUELTO' ? 'Por calificar' : ''),
               comentario: x.comentario, fechaCalificacion: x.fechaCalificacion, reabierto: x.reabierto || '', vista: x.vista, cargadoPor: titulo(x.cargadoPor),
               capturas: (x.fotos || []).length || '',
               historial: (x.historial || []).map(function (h) { return h.fecha + ' · ' + h.evento + ' · ' + titulo(h.quien) + (h.detalle ? ' · ' + h.detalle : ''); }).join('\n') };
    });
  }
  function subtitulo(l) {
    var rango = (F.desde || F.hasta) ? 'Del ' + (F.desde ? K.fecha(F.desde) : 'inicio') + ' al ' + (F.hasta ? K.fecha(F.hasta) : 'hoy') : 'Todos los soportes';
    var fe = ''; ESTADOS_F.forEach(function (e) { if (e[0] && e[0] === F.estado) fe = e[1].toLowerCase(); });
    return rango + (fe ? ' · ' + fe : '') + ' · ' + l.length + (l.length === 1 ? ' soporte' : ' soportes');
  }
  function exportar(que, btn) {
    var l = filtradas();
    if (!l.length) { aviso('No hay soportes con esos filtros.', 'aviso', 3000); return; }
    var ex = K.piezas.exportar;
    if (!ex) { aviso('La descarga no cargó. Recarga la app.', 'aviso'); return; }
    if (btn.disabled) return;
    btn.disabled = true; btn.classList.add('kit-ocupado');
    var filas = filasExp(l), t0 = performance.now();
    var p = que === 'xlsx'
      ? ex.aExcel('Soportes SEC Hacienda', [
          { campo: 'id', titulo: 'N° soporte' }, { campo: 'fecha', titulo: 'Fecha' }, { campo: 'persona', titulo: 'Persona' },
          { campo: 'documento', titulo: 'Documento' }, { campo: 'rol', titulo: 'Rol' }, { campo: 'tipo', titulo: 'Tipo' },
          { campo: 'estado', titulo: 'Estado' }, { campo: 'solicitud', titulo: 'Solicitud' }, { campo: 'respuesta', titulo: 'Respuesta' },
          { campo: 'atendio', titulo: 'Atendió' }, { campo: 'fechaRespuesta', titulo: 'Fecha respuesta' }, { campo: 'estrellas', titulo: 'Estrellas' },
          { campo: 'comentario', titulo: 'Comentario' }, { campo: 'fechaCalificacion', titulo: 'Fecha calificación' }, { campo: 'reabierto', titulo: 'Veces reabierto' },
          { campo: 'vista', titulo: 'Vista' }, { campo: 'capturas', titulo: 'Capturas' }, { campo: 'cargadoPor', titulo: 'Registrado por' }, { campo: 'historial', titulo: 'Historial' }
        ], filas)
      : ex.aPDF('Informe de soportes SEC Hacienda', [
          { campo: 'solicitud', titulo: 'Solicitud', largo: true }, { campo: 'respuesta', titulo: 'Respuesta', largo: true },
          { campo: 'atendio', titulo: 'Atendió' }, { campo: 'fechaRespuesta', titulo: 'Respondido' }, { campo: 'calificacion', titulo: 'Calificación' },
          { campo: 'comentario', titulo: 'Comentario de la persona', largo: true }, { campo: 'reabierto', titulo: 'Veces reabierto' }, { campo: 'tipo', titulo: 'Tipo' }
        ], filas, {
          subtitulo: subtitulo(l),
          bloque: {
            titulo: function (f) { return f.id + ' · ' + f.persona; },
            sub: function (f) { return [f.rol, f.documento, f.fecha].filter(Boolean).join(' · '); },
            marca: function (f) { return f.estado + (f.estrellas ? ' · ' + f.estrellas + '★' : ''); },
            tono: function (f) { return f.estado === 'REABIERTO' ? 'malo' : (f.estado === 'CERRADO' || f.estado === 'RESUELTO' ? 'ok' : 'aviso'); }
          },
          grupo: function (f) { return f.estado; },
          resumen: function (fs) {
            var c = cifras(fs.map(function (f) { return { estado: f.estado, estrellas: f.estrellas || 0 }; }));
            var r = [{ etiqueta: 'Soportes', valor: c.total }, { etiqueta: 'Por atender', valor: c.PENDIENTE + c['EN PROCESO'] + c.REABIERTO },
                     { etiqueta: 'Realizados', valor: c.RESUELTO + c.CERRADO }, { etiqueta: 'Reabiertos', valor: c.REABIERTO }];
            if (c.calificados) r.push({ etiqueta: 'Promedio (' + c.calificados + ' calificados)', valor: String(c.promedio).replace('.', ',') + ' de 5' });
            return r;
          }
        });
    Promise.resolve(p).then(function () { try { window.__sopMed.push({ ruta: 'descarga:' + que, ms: Math.round(performance.now() - t0) }); } catch (e) {} },
      function (e) { aviso((e && e.message) || 'No se pudo armar la descarga.', 'malo', 6000); })
      .then(function () { btn.disabled = false; btn.classList.remove('kit-ocupado'); });
  }

  function horas(a, b) { var x = tsDe(a), y = tsDe(b); return x && y && y >= x ? (y - x) / 36e5 : -1; }
  function tsDe(f) {
    var m = /^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/.exec(String(f || ''));
    return m ? new Date(+m[3], +m[2] - 1, +m[1], +(m[4] || 0), +(m[5] || 0)).getTime() : 0;
  }
  function cuentaPor(l, fn) {
    var m = {}; l.forEach(function (x) { var k = fn(x); if (k) m[k] = (m[k] || 0) + 1; });
    return Object.keys(m).map(function (k) { return { etiqueta: k, valor: m[k] }; }).sort(function (a, b) { return b.valor - a.valor; });
  }
  /** El spec de kit/gerencial.js con los soportes filtrados. */
  function specGerencial(l) {
    var hoy = new Date(), isoHoy = hoy.toISOString().slice(0, 10);
    var fechas = l.map(function (x) { return iso(x.fecha); }).filter(Boolean).sort();
    var desde = F.desde || fechas[0] || isoHoy, hasta = F.hasta || isoHoy;
    var TON = { PENDIENTE: 'aviso', 'EN PROCESO': 'aviso', RESUELTO: 'ok', CERRADO: 'ok', REABIERTO: 'malo' };
    var regs = l.map(function (x) {
      return { fecha: iso(x.fecha), hora: String(x.fecha || '').slice(11, 16), tipo: 'Soporte ' + x.estado.toLowerCase(), tono: TON[x.estado] || 'info',
               categoria: x.tipo === 'SOLICITUD' ? 'Pedido desde la app' : 'Registrado por DEV', sujeto: titulo(x.emisor), ref: x.id };
    }).filter(function (r) { return r.fecha; });
    var c = cifras(l);
    var resp = l.map(function (x) { return horas(x.fecha, x.fechaRespuesta); }).filter(function (h) { return h >= 0; });
    var prom = resp.length ? Math.round(resp.reduce(function (a, b) { return a + b; }, 0) / resp.length * 10) / 10 : 0;
    var est = [5, 4, 3, 2, 1].map(function (n) { return { etiqueta: n + (n === 1 ? ' estrella' : ' estrellas'), valor: l.filter(function (x) { return x.estrellas === n; }).length, tono: n >= 4 ? 'ok' : (n === 3 ? 'aviso' : 'malo') }; }).filter(function (x) { return x.valor; });
    var hall = [];
    if (c.REABIERTO) hall.push(c.REABIERTO + (c.REABIERTO === 1 ? ' soporte quedó reabierto' : ' soportes quedaron reabiertos') + ' por una calificación baja: revisar lo que dijo la persona.');
    if (c.sinCalificar) hall.push(c.sinCalificar + (c.sinCalificar === 1 ? ' soporte resuelto espera' : ' soportes resueltos esperan') + ' la calificación de la persona.');
    return {
      app: 'Sec. Hacienda · Soportes', ecosistema: 'FLANDES-CORE · Secretaría de Hacienda', persona: 'Soporte de la app SEC Hacienda',
      rol: 'Desarrollo y soporte', desde: desde, hasta: hasta, nombre: 'Informe gerencial soportes SEC Hacienda',
      palabra: ['soporte', 'soportes'],
      etiquetas: { tipo: 'Estado', categoria: 'Origen', sujeto: 'Persona' },
      tonos: { ok: 'Atendidos', malo: 'Reabiertos', aviso: 'Por atender', info: 'Otros' },
      registros: regs,
      kpis: [{ etiqueta: 'Soportes', valor: K.numero(c.total), tono: 'info' },
             { etiqueta: 'Por atender', valor: K.numero(c.PENDIENTE + c['EN PROCESO'] + c.REABIERTO), tono: (c.PENDIENTE + c['EN PROCESO'] + c.REABIERTO) ? 'aviso' : 'ok' },
             { etiqueta: 'Atendidos', valor: K.numero(c.RESUELTO + c.CERRADO), tono: 'ok' },
             { etiqueta: 'Calificación promedio', valor: c.calificados ? String(c.promedio).replace('.', ',') + ' de 5' : '—', nota: c.calificados + ' calificados', tono: c.promedio >= 4 || !c.calificados ? 'ok' : 'aviso' },
             { etiqueta: 'Tiempo medio de respuesta', valor: resp.length ? String(prom).replace('.', ',') + ' h' : '—', nota: resp.length + ' con respuesta', tono: 'info' }],
      secciones: [
        { titulo: 'Atención de los soportes', intro: 'Cómo van los soportes del periodo: los que siguen abiertos, los resueltos y los que la persona calificó.',
          graficas: [{ titulo: 'Soportes por estado', tipo: 'proporcion', datos: [
            { etiqueta: 'Pendientes', valor: c.PENDIENTE, tono: 'aviso' }, { etiqueta: 'En proceso', valor: c['EN PROCESO'], tono: 'info' },
            { etiqueta: 'Reabiertos', valor: c.REABIERTO, tono: 'malo' }, { etiqueta: 'Por calificar', valor: c.RESUELTO, tono: 'ok' },
            { etiqueta: 'Cerrados', valor: c.CERRADO, tono: 'ok' }].filter(function (x) { return x.valor; }) },
            { titulo: 'Soportes por persona', tipo: 'barrasH', datos: cuentaPor(l, function (x) { return titulo(x.emisor); }).slice(0, 15), max: 15 }] },
        { titulo: 'Calificación de la atención', intro: 'Las estrellas que dio cada persona al quedar resuelto su caso (con ' + ((D && D.cfg && D.cfg.reabreHasta) || 2) + ' o menos el caso se reabre).',
          graficas: [{ titulo: 'Calificaciones', tipo: 'barras', datos: est }] }
      ],
      hallazgos: hall
    };
  }
  function gerencial(btn) {
    var l = filtradas();
    if (!l.length) { aviso('No hay soportes con esos filtros.', 'aviso', 3000); return; }
    var ex = K.piezas.exportar;
    if (!ex || !ex.aGerencial) { aviso('El informe no cargó. Recarga la app.', 'aviso'); return; }
    if (btn.disabled) return;
    btn.disabled = true; btn.classList.add('kit-ocupado');
    var t0 = performance.now();
    ex.aGerencial(specGerencial(l)).then(function (out) {
      aviso('Informe gerencial descargado' + (out && out.paginas ? ' (' + out.paginas + ' páginas).' : '.'), 'ok', 4000);
      try { window.__sopMed.push({ ruta: 'descarga:gerencial', ms: Math.round(performance.now() - t0) }); } catch (e) {}
    }, function (e) { aviso((e && e.message) || 'No se pudo armar el informe.', 'malo', 6000); })
      .then(function () { btn.disabled = false; btn.classList.remove('kit-ocupado'); });
  }

  /* ══════════════ Insights de la vista ══════════════ */
  function insight(id) {
    var l = lista(), c = cifras(l), n = K.numero;
    if (!D) return { titulo: 'Soportes', texto: 'Abre la vista para que carguen los soportes.', voz: '' };
    var abiertos = l.filter(function (x) { return pasaEstado(x, 'ABIERTOS'); });
    var viejos = abiertos.filter(function (x) { return diasDesde(x.fecha) >= 2; });
    if (id === 'abiertos') {
      return { titulo: 'Soportes por atender', texto: '**' + n(abiertos.length) + '** por atender: ' + n(c.PENDIENTE) + ' pendientes, ' + n(c['EN PROCESO']) + ' en proceso y ' + n(c.REABIERTO) + ' reabiertos.' + (viejos.length ? ' **' + n(viejos.length) + '** llevan 2 días o más esperando.' : ''),
               lista: abiertos.slice(0, 10).map(function (x) { return x.id + ' · ' + titulo(x.emisor) + ' · ' + x.estado + ' · ' + SOP_corto(x.solicitud, 80); }), voz: n(abiertos.length) + ' soportes por atender.' };
    }
    if (id === 'calificacion') {
      return { titulo: 'Calificación', texto: c.calificados ? 'Promedio **' + String(c.promedio).replace('.', ',') + ' de 5** con ' + n(c.calificados) + ' calificaciones. ' + n(c.sinCalificar) + ' resueltos esperan la calificación.' : 'Todavía nadie ha calificado un soporte.',
               lista: l.filter(function (x) { return x.estrellas; }).slice(0, 10).map(function (x) { return x.id + ' · ' + x.estrellas + '★ · ' + titulo(x.emisor) + (x.comentario ? ' · “' + SOP_corto(x.comentario, 60) + '”' : ''); }),
               voz: c.calificados ? 'Promedio de ' + String(c.promedio).replace('.', ',') + ' estrellas.' : '' };
    }
    return { titulo: 'Resumen de soportes', texto: '**' + n(c.total) + '** soportes en total: **' + n(abiertos.length) + '** por atender, ' + n(c.RESUELTO) + ' resueltos por calificar y ' + n(c.CERRADO) + ' cerrados.' +
             (c.calificados ? ' Calificación promedio **' + String(c.promedio).replace('.', ',') + ' de 5**.' : ''), voz: n(c.total) + ' soportes, ' + n(abiertos.length) + ' por atender.' };
  }
  function SOP_corto(t, n) { t = String(t || '').replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n - 1) + '…' : t; }

  /* ══════════════ enganches ══════════════ */
  function enchufar() {
    var a = $('btn-soporte'); if (a && !a.__sop) { a.__sop = true; a.addEventListener('click', contar); }
    var b = $('btn-soportes'); if (b && !b.__sop) { b.__sop = true; b.addEventListener('click', abrir); }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', enchufar); else enchufar();
  window.addEventListener('hac:login', function () { D = null; PERSONAS = null; F = { estado: 'ABIERTOS', buscar: '', desde: '', hasta: '' }; });
  window.addEventListener('hac:logout', function () { D = null; PERSONAS = null; });
  window.addEventListener('hac:sesionVencida', function () { D = null; PERSONAS = null; });
  /* soportes resueltos por calificar: llegan con el arranque (login o revalidación) */
  window.addEventListener('hac:soportePendiente', function (e) {
    var s = e && e.detail; if (!s || !s.pendientes || !s.pendientes.length) return;
    setTimeout(function () { K.disparar('kit:soporte', s); }, 1500);
  });

  window.SOPORTES = { contar: contar, abrir: abrir, insight: insight, _datos: function () { return D; }, _filtradas: filtradas,
                      _spec: function () { return specGerencial(filtradas()); }, _med: function () { return window.__sopMed.slice(); } };
}());
