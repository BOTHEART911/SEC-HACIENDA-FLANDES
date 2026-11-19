/* ============================================================
   SEC-HACIENDA-FLANDES · NUEVO INICIO
   18/11/2026 · maqueta aprobada por Oscar (patrón Flandes Core)

   Qué pinta, arriba de las listas de siempre:
     1) La tarea del rol, en la tarjeta grande con el cielo del kit
        (aurora y burbujas, el mismo efecto de la portada):
          ADMIN y DEV ......... Mi semáforo de toda la Secretaría
          ABOGADO, ASISTENTE,
          TRIBUTARIO .......... sus asignaciones
          ARCHIVO ............. bitácoras por responder en BD Predial
          ATENCIÓN ............ Pendientes predial
     2) Lo próximo que vence.
     3) Cuatro accesos rápidos (cada uno con su ícono).
     4) "Piden tu acción": bitácoras, requerimientos ICA vencidos y
        asesorías sin disponibilidad.

   CERO VIAJES NUEVOS. Los datos llegan en la misma respuesta de entrada
   (login / loginpin / perfil con ini=1 → backend Inicio1118.gs) y aquí se
   guardan en window.HAC_INI. Con eso se dejan de pedir en el inicio
   'bitpendientes' (13 s medidos) y 'asesoriashoy'. Lo de ICA sale de la
   precarga que js/ica.js ya hace al entrar.

   Cabecera antes que datos: se pinta al instante con lo último que se
   supo en este teléfono (por usuario) y se completa cuando llega la
   respuesta. Si la lista de Mi semáforo ya está en memoria, los conteos
   se sacan de ahí con la MISMA regla de la vista (procGrupoVence_), así
   lo que se guarda se ve sin volver a pedir nada.

   Si el backend todavía no trae 'inicio', todo sigue como antes: las
   piezas de siempre hacen sus viajes de fondo.
   ============================================================ */
(function () {
  'use strict';
  if (window.HAC_INI) return;

  var K = window.KIT;
  var FRESCO_MS = 60000;               /* un dato de entrada sirve 1 minuto para evitar el viaje viejo */
  var LLAVE = 'hacflandes.inicio.v1.'; /* + uid */

  /* ══════════════ 1) Datos de entrada (HAC_INI) ══════════════ */
  var D = null, recibido = 0, pidiendo = false, esperas = [];
  var HAC_INI = window.HAC_INI = {
    /** Se va a pedir login/loginpin/perfil con ini=1. */
    pedido: function () { pidiendo = true; setTimeout(function () { if (pidiendo) HAC_INI.poner(null); }, 12000); },
    /** Llegó la respuesta (con o sin 'inicio'). */
    poner: function (ini, deUid) {
      pidiendo = false;
      if (ini && ini.v) {
        D = ini; recibido = Date.now();
        guardar(ini, deUid);
        try { window.dispatchEvent(new CustomEvent('hac:inicio', { detail: ini })); } catch (_) {}
      }
      var l = esperas; esperas = [];
      l.forEach(function (f) { try { f(HAC_INI.fresco()); } catch (_) {} });
      setTimeout(function () { try { pintar(); } catch (_) {} }, 0);
    },
    /** El dato de entrada si llegó hace menos de un minuto; si no, null. */
    fresco: function () { return D && (Date.now() - recibido) < FRESCO_MS ? D : null; },
    /** Espera la respuesta en vuelo (si la hay) y entrega el dato fresco o null. */
    esperar: function () {
      return new Promise(function (ok) {
        if (!pidiendo) return ok(HAC_INI.fresco());
        esperas.push(ok);
      });
    },
    datos: function () { return D; },
    esperando: function () { return pidiendo; },
    pintar: function () { pintar(); }
  };

  /* ══════════════ utilidades ══════════════ */
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function ico(n, t) { try { return K.icono(n, t || 20); } catch (_) { return ''; } }
  function n(x) { return Number(x) || 0; }
  function plural(c, uno, varios) { return c + ' ' + (c === 1 ? uno : varios); }
  function titulo(s) {
    return String(s || '').toLowerCase().replace(/(^|[\s(])([a-záéíóúñü])/g, function (m, a, b) { return a + b.toUpperCase(); });
  }
  function frase(s) { s = String(s || '').toLowerCase(); return s.charAt(0).toUpperCase() + s.slice(1); }
  function visible(id) {
    var b = $(id);
    return !!b && b.style.display !== 'none' && !b.hidden;
  }
  function usuario() { try { return window.currentUser || null; } catch (_) { return null; } }
  function roles() { var u = usuario(); return (u && u.roles) || []; }
  function tiene(r) { return roles().indexOf(r) !== -1; }
  function uid() { var u = usuario(); return (u && u.uid) || ''; }
  function sonar() { try { if (typeof playSoundOnce === 'function' && window.SOUNDS) playSoundOnce(SOUNDS.menu); } catch (_) {} }
  function tocar(id) { var b = $(id); if (b) { sonar(); b.click(); return true; } return false; }

  function guardar(ini, deUid) {
    var u = deUid || uid(); if (!u) return;
    try { localStorage.setItem(LLAVE + u, JSON.stringify({ t: Date.now(), d: ini })); } catch (_) {}
  }
  function recordado() {
    var u = uid(); if (!u) return null;
    try {
      var g = JSON.parse(localStorage.getItem(LLAVE + u) || 'null');
      /* lo de otro día no sirve: el semáforo cambia de un día a otro */
      if (g && g.d && g.d.hoy === hoyIso()) return g.d;
    } catch (_) {}
    return null;
  }
  function hoyIso() {
    var d = new Date();
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  }
  function datos() { return D || recordado(); }

  /* Lista de Mi semáforo ya en memoria (app.js): los conteos se sacan de
     ahí con la regla de la vista, sin viajar. */
  function listaProc() {
    try { var l = (0, eval)('__procListCache'); return Array.isArray(l) ? l : []; } catch (_) { return []; }
  }
  function semLocal() {
    var l = listaProc();
    if (!l.length || typeof window.procGrupoVence_ !== 'function') return null;
    var r = { n: 0, venc: 0, hoy: 0, pronto: 0, est: {}, prox: null }, mejor = null, mejorF = null;
    var h = new Date(); h.setHours(0, 0, 0, 0);
    l.forEach(function (o) {
      var est = String(o.estado || '').trim().toUpperCase();
      if (est === 'FINALIZADO') return;
      r.n++;
      r.est[est || 'SIN ESTADO'] = (r.est[est || 'SIN ESTADO'] || 0) + 1;
      var g = window.procGrupoVence_(o);
      if (g === 'VENCIDOS') r.venc++; else if (g === 'HOY') r.hoy++; else if (g === 'PRONTO') r.pronto++;
      var f = (typeof window.parseDDMMYYYYtoDate_ === 'function') ? window.parseDDMMYYYYtoDate_(o.respuesta) : null;
      if (f) { f.setHours(0, 0, 0, 0); if (f >= h && (!mejorF || f < mejorF)) { mejorF = f; mejor = o; } }
    });
    if (mejor) r.prox = { id: mejor.id_proceso, fila: mejor.rowIndex, resp: mejor.respuesta, hoy: mejorF.getTime() === h.getTime(), cat: mejor.categoria, asignado: mejor.asignado, desc: String(mejor.descripcion || '').replace(/\s+/g, ' ').trim().slice(0, 90) };
    return r;
  }
  function sem() { var l = semLocal(); if (l) return l; var d = datos(); return d && d.sem; }
  function bit() {
    try { var c = window.BITAB && window.BITAB.conteos(); if (c && (c.pred || c.proc)) return { pred: c.pred || { n: 0, rojo: 0 }, proc: c.proc || { n: 0, rojo: 0 } }; } catch (_) {}
    var d = datos(); return d && d.bit;
  }
  function ase() { var d = datos(); return d && d.ase; }
  function icaVencidos() {
    try {
      if (!window.ICA || !ICA.puede() || !ICA._S || !ICA._S.cargado) return null;
      var S = ICA._S, hoy = S.hoy, c = 0;
      (S.lista || []).forEach(function (r) {
        if (r.env && !r.resp && !r.ins && hoy > r.ven && ['CIERRE', 'TRASLADO'].indexOf(r.et) === -1) c++;
      });
      return c;
    } catch (_) { return null; }
  }

  /* ══════════════ 2) ¿Cuál es la tarea de este rol? ══════════════ */
  function modo() {
    var s = sem(), b = bit();
    if ((tiene('ADMIN') || tiene('DEV')) && visible('btn-semaforo')) return 'sem';
    if (tiene('ARCHIVO') && visible('btn-bd-predial')) return 'bit';
    if ((tiene('ABOGADO') || tiene('ASISTENTE') || tiene('TRIBUTARIO')) && visible('btn-semaforo') && s && s.n) return 'sem';
    if (tiene('ATENCION') && visible('btn-pendientes')) return 'pend';
    if (visible('btn-semaforo') && s && s.n) return 'sem';
    if (b && b.pred && b.pred.n && visible('btn-bd-predial')) return 'bit';
    if (visible('btn-pendientes')) return 'pend';
    return '';
  }

  /* ══════════════ 3) Acciones (siempre con los botones de siempre) ══════════════ */
  /** Abre Mi semáforo y, si se pide, deja puesto un filtro de vencimiento o una búsqueda. */
  function abrirSemaforo(vence, buscar) {
    if (!tocar('btn-semaforo')) return;
    if (!vence && !buscar) return;
    var t0 = Date.now();
    (function aplicar() {
      var lista = listaProc();
      var v = $('view-asignaciones');
      if (!v || !v.classList.contains('active') || (!lista.length && Date.now() - t0 < 8000)) {
        if (Date.now() - t0 < 8000) setTimeout(aplicar, 150);
        return;
      }
      try {
        if (vence) {
          (0, eval)('__procFiltroVence = ' + JSON.stringify(vence));
          if (typeof window.procSincronizarFiltros_ === 'function') window.procSincronizarFiltros_();
        }
        if (buscar) {
          var f = $('proc-filter');
          if (f) { f.value = buscar; f.dispatchEvent(new Event('input', { bubbles: true })); }
        }
        if (typeof window.applyProcFilters_ === 'function') window.applyProcFilters_();
      } catch (e) { console.warn('[inicio] filtro', e); }
    })();
  }
  function agregarAsignacion() {
    if (!tocar('btn-semaforo')) return;
    var t0 = Date.now();
    (function esperar() {
      if (visible('btn-agregar-asignacion')) { $('btn-agregar-asignacion').click(); return; }
      if (Date.now() - t0 < 8000) setTimeout(esperar, 150);
    })();
  }
  function puedeAgregar() {
    try { return typeof window.canSeeAgregarAsignacion_ === 'function' && !!window.canSeeAgregarAsignacion_(); } catch (_) { return false; }
  }

  var ACCIONES = {
    'sem': function () { abrirSemaforo(); },
    'sem-venc': function () { abrirSemaforo('VENCIDOS'); },
    'sem-hoy': function () { abrirSemaforo('HOY'); },
    'sem-pronto': function () { abrirSemaforo('PRONTO'); },
    'sem-agregar': agregarAsignacion,
    'prox': function (b) { abrirSemaforo('', b.getAttribute('data-id')); },
    'bdp': function () { tocar('btn-bd-predial'); },
    'pend': function () { tocar('btn-pendientes'); },
    'agregar': function () { tocar('btn-agregar'); },
    'ica': function () { tocar('btn-ica-req'); },
    'ase': function () { tocar('btn-asesorias'); },
    'drive': function () { tocar('btn-drive-anexos'); },
    'guia': function () { tocar('btn-guia'); }
  };

  /* ══════════════ 4) Pintar ══════════════ */
  var COLOR_EST = { 'ASIGNADO': 'hf-est--a', 'EN PROYECCIÓN': 'hf-est--b', 'EN PROYECCION': 'hf-est--b', 'EJECUTADO POR FINALIZAR': 'hf-est--c' };

  function htmlTarea(m) {
    var s = sem(), b = bit(), admin = tiene('ADMIN') || tiene('DEV');
    if (m === 'sem') {
      if (!s && pidiendo) return htmlEsqueleto('MI SEMÁFORO');
      if (!s) {
        /* sin conteos (backend anterior o sin red): la tarea igual queda a un toque */
        return '<div class="hf-tarea__cab"><span class="hf-tarea__eti">MI SEMÁFORO</span></div>' +
          '<h2 class="hf-tarea__t">Asignaciones y vencimientos por días hábiles</h2>' +
          '<div class="hf-tarea__btns"><button type="button" class="hf-tarea__bp" data-ini="sem">' + ico('semaforo', 20) + ' Abrir mi semáforo</button>' +
          (puedeAgregar() ? '<button type="button" class="hf-tarea__bs" data-ini="sem-agregar">' + ico('mas', 18) + ' Agregar asignación</button>' : '') + '</div>';
      }
      var urg = n(s.venc) + n(s.hoy);
      var pas = n(s.hoy) ? plural(n(s.hoy), 'vence hoy', 'vencen hoy') : (n(s.venc) ? plural(n(s.venc), 'vencida', 'vencidas') : 'Al día');
      var est = s.est || {}, claves = Object.keys(est).sort(function (a, c) { return est[c] - est[a]; });
      var barra = claves.map(function (k) {
        return '<span class="hf-tarea__seg ' + (COLOR_EST[k] || 'hf-est--d') + '" style="flex:' + est[k] + '"></span>';
      }).join('');
      var ley = claves.map(function (k) {
        return '<span><i class="' + (COLOR_EST[k] || 'hf-est--d') + '"></i>' + est[k] + ' ' + esc(frase(k)) + '</span>';
      }).join('');
      return '<div class="hf-tarea__cab"><span class="hf-tarea__eti">' + (admin ? 'MI SEMÁFORO · LA SECRETARÍA' : 'MI SEMÁFORO') + '</span>' +
          '<span class="hf-tarea__pas' + (urg ? '' : ' hf-tarea__pas--ok') + '">' + esc(pas) + '</span></div>' +
        '<h2 class="hf-tarea__t">' + (admin ? plural(n(s.n), 'asignación activa', 'asignaciones activas') : 'Tienes ' + plural(n(s.n), 'asignación activa', 'asignaciones activas')) + '</h2>' +
        '<div class="hf-tarea__cifras">' +
          cifra('sem-venc', s.venc, 'vencidas', 'Ver las vencidas') +
          cifra('sem-hoy', s.hoy, 'vencen hoy', 'Ver las que vencen hoy') +
          cifra('sem-pronto', s.pronto, 'vencen pronto', 'Ver las que vencen en los próximos días hábiles') +
        '</div>' +
        (claves.length ? '<div class="hf-tarea__barra" role="img" aria-label="' + esc(claves.map(function (k) { return est[k] + ' ' + frase(k); }).join(', ')) + '">' + barra + '</div><div class="hf-tarea__ley">' + ley + '</div>' : '') +
        '<div class="hf-tarea__btns">' +
          '<button type="button" class="hf-tarea__bp" data-ini="sem">' + ico('semaforo', 20) + ' Abrir mi semáforo</button>' +
          (puedeAgregar() ? '<button type="button" class="hf-tarea__bs" data-ini="sem-agregar">' + ico('mas', 18) + ' Agregar asignación</button>' : '') +
        '</div>';
    }
    if (m === 'bit') {
      var p = (b && b.pred) || null;
      if (!p && pidiendo) return htmlEsqueleto('BITÁCORAS POR RESPONDER');
      if (!p) p = { n: 0, rojo: 0 };
      return '<div class="hf-tarea__cab"><span class="hf-tarea__eti">BASE DE DATOS PREDIAL</span>' +
          '<span class="hf-tarea__pas' + (n(p.rojo) ? '' : ' hf-tarea__pas--ok') + '">' + (n(p.rojo) ? plural(n(p.rojo), 'en rojo', 'en rojo') : 'Al día') + '</span></div>' +
        '<h2 class="hf-tarea__t">' + (n(p.n) ? plural(n(p.n), 'bitácora por responder', 'bitácoras por responder') : 'No tienes bitácoras por responder') + '</h2>' +
        (n(p.n) ? '<div class="hf-tarea__cifras hf-tarea__cifras--2">' + cifra('bdp', p.rojo, 'en rojo', 'Abrir BD Predial') + cifra('bdp', n(p.n) - n(p.rojo), 'a tiempo', 'Abrir BD Predial') + '</div>' : '') +
        '<div class="hf-tarea__btns"><button type="button" class="hf-tarea__bp" data-ini="bdp">' + ico('base-datos', 20) + ' Abrir BD Predial</button></div>';
    }
    if (m === 'pend') {
      return '<div class="hf-tarea__cab"><span class="hf-tarea__eti">PENDIENTES PREDIAL</span></div>' +
        '<h2 class="hf-tarea__t">Solicitudes por chat que esperan respuesta</h2>' +
        '<p class="hf-tarea__p">Atiende primero las que llevan más tiempo esperando.</p>' +
        '<div class="hf-tarea__btns"><button type="button" class="hf-tarea__bp" data-ini="pend">' + ico('bandeja-entrada', 20) + ' Abrir pendientes</button>' +
          (visible('btn-agregar') ? '<button type="button" class="hf-tarea__bs" data-ini="agregar">' + ico('atencion', 18) + ' Agregar atención</button>' : '') + '</div>';
    }
    return '';
  }
  function cifra(acc, valor, txt, etiqueta) {
    return '<button type="button" class="hf-tarea__cifra" data-ini="' + acc + '" aria-label="' + esc(etiqueta + ': ' + n(valor)) + '"><b>' + n(valor) + '</b><span>' + esc(txt) + '</span></button>';
  }
  function htmlEsqueleto(eti) {
    return '<div class="hf-tarea__cab"><span class="hf-tarea__eti">' + eti + '</span></div>' +
      '<div class="hf-esq hf-esq--t"></div><div class="hf-tarea__cifras"><div class="hf-esq hf-esq--c"></div><div class="hf-esq hf-esq--c"></div><div class="hf-esq hf-esq--c"></div></div>' +
      '<div class="hf-esq hf-esq--b"></div>';
  }

  function htmlReciente(m) {
    if (m !== 'sem') return '';
    var s = sem(); if (!s || !s.prox) return '';
    var p = s.prox, admin = tiene('ADMIN') || tiene('DEV');
    var t = (p.hoy ? 'Vence hoy: ' : 'Próxima a vencer (' + esc(p.resp) + '): ') + esc(p.id) + (p.cat ? ' · ' + esc(frase(p.cat)) : '');
    var d = esc(frase(p.desc)) + (admin && p.asignado ? ' · ' + esc(titulo(p.asignado)) : '');
    return '<button type="button" class="hf-reciente" data-ini="prox" data-id="' + esc(p.id) + '">' +
      '<span class="hf-reciente__ic' + (p.hoy ? ' hf-reciente__ic--hoy' : '') + '">' + ico('reloj', 22) + '</span>' +
      '<span class="hf-reciente__tx"><b>' + t + '</b><span>' + d + '</span></span>' + ico('adelante', 18) + '</button>';
  }

  function htmlRapidos(m) {
    var b = bit();
    var cand = [
      { id: 'btn-agregar', acc: 'agregar', ic: 'atencion', t: 'Agregar atención', p: 'Un contribuyente en ventanilla' },
      { id: 'btn-bd-predial', acc: 'bdp', ic: 'base-datos', t: 'Base de datos predial', p: 'Expedientes y bitácoras', num: b && b.pred ? n(b.pred.n) : 0, rojo: b && b.pred ? n(b.pred.rojo) : 0 },
      { id: 'btn-ica-req', acc: 'ica', ic: 'sobre', t: 'Requerimientos ICA', p: 'Por correo, con su seguimiento' },
      { id: 'btn-drive-anexos', acc: 'drive', ic: 'carpeta', t: 'Drive anexos', p: 'Evidencias por contrato' },
      { id: 'btn-pendientes', acc: 'pend', ic: 'bandeja-entrada', t: 'Pendientes predial', p: 'Solicitudes por chat' },
      { id: 'btn-semaforo', acc: 'sem', ic: 'semaforo', t: 'Mi semáforo', p: 'Asignaciones por vencimiento' },
      { id: 'btn-asesorias', acc: 'ase', ic: 'telefono', t: 'Asesorías', p: 'Llamadas y mi disponibilidad' },
      { id: 'btn-guia', acc: 'guia', ic: 'libro', t: 'Guía rápida', p: 'Tus funciones, paso a paso' }
    ];
    /* lo que ya es la tarea grande no se repite como acceso */
    var fuera = { sem: ['sem'], bit: ['bdp'], pend: ['pend', 'agregar'] }[m] || [];
    var l = cand.filter(function (c) { return fuera.indexOf(c.acc) === -1 && visible(c.id); });
    /* rejilla pareja: 4 o 2, nunca un hueco */
    l = l.slice(0, l.length >= 4 ? 4 : (l.length >= 2 ? 2 : 0));
    if (!l.length) return '';
    return l.map(function (c) {
      return '<button type="button" class="hf-rapido" data-ini="' + c.acc + '">' + ico(c.ic, 26) +
        '<span class="hf-rapido__t">' + esc(c.t) + '</span><span class="hf-rapido__p">' + esc(c.p) + '</span>' +
        (c.num ? '<span class="hf-rapido__num' + (c.rojo ? ' hf-rapido__num--rojo' : '') + '" aria-label="' + c.num + ' por responder">' + c.num + '</span>' : '') +
        '</button>';
    }).join('');
  }

  function htmlAvisos(m) {
    var out = [], b = bit(), a = ase(), iv = icaVencidos();
    if (m !== 'bit' && b && b.pred && n(b.pred.n) && visible('btn-bd-predial')) {
      out.push(aviso(n(b.pred.rojo) ? 'malo' : 'aviso', 'comentario', 'bdp',
        plural(n(b.pred.n), 'bitácora por responder', 'bitácoras por responder') + ' en BD Predial',
        n(b.pred.rojo) ? n(b.pred.rojo) + ' en rojo · toca para verlas' : 'Toca para verlas'));
    }
    if (b && b.proc && n(b.proc.n) && visible('btn-semaforo')) {
      out.push(aviso(n(b.proc.rojo) ? 'malo' : 'aviso', 'comentario', 'sem',
        plural(n(b.proc.n), 'bitácora por responder', 'bitácoras por responder') + ' en Asignaciones',
        n(b.proc.rojo) ? n(b.proc.rojo) + ' en rojo' : 'Toca para verlas'));
    }
    if (iv && visible('btn-ica-req')) {
      out.push(aviso('aviso', 'vencido', 'ica', plural(iv, 'requerimiento de ICA vencido', 'requerimientos de ICA vencidos') + ' sin respuesta', 'Listos para insistir'));
    }
    if (a && !a.tengoDisp && !(a.mias || []).length && visible('btn-asesorias')) {
      out.push(aviso('neutro', 'calendario', 'ase', 'No tienes disponibilidad de asesorías publicada', 'Publícala para que los ciudadanos te agenden'));
    }
    return out.join('');
  }
  function aviso(tipo, ic, acc, t, p) {
    return '<button type="button" class="hf-aviso hf-aviso--' + tipo + '" data-ini="' + acc + '">' + ico(ic, 22) +
      '<span class="hf-aviso__tx"><b>' + esc(t) + '</b><span>' + esc(p) + '</span></span></button>';
  }

  var ultimo = {};
  function poner(id, html) {
    var z = $(id); if (!z) return;
    var cuerpo = z.querySelector('[data-ini-cuerpo]') || z;
    if (ultimo[id] !== html) { cuerpo.innerHTML = html; ultimo[id] = html; }
    z.hidden = !html;
  }

  function pintar() {
    var v = $('view-inicio');
    if (!v || !uid()) return;
    var m = modo();
    var tarea = $('hf-tarea');
    if (tarea && m) {
      tarea.setAttribute('data-modo', m);
      try { if (K && K.piezas && K.piezas.cielo) K.piezas.cielo.poner(tarea, { burbujas: 4 }); } catch (_) {}
    }
    poner('hf-tarea', m ? htmlTarea(m) : '');
    poner('hf-reciente', htmlReciente(m));
    poner('hf-rapidos', htmlRapidos(m));
    var av = htmlAvisos(m);
    poner('hf-avisos', av);
    var az = $('hf-avisos-z'); if (az) az.hidden = !av;
    v.classList.toggle('hf-ini-listo', !!m);
  }

  /* ══════════════ 5) Enganches ══════════════ */
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('#view-inicio [data-ini]');
    if (!b) return;
    var f = ACCIONES[b.getAttribute('data-ini')];
    if (f) { e.preventDefault(); f(b); }
  });

  var cola = 0;
  function luego() { clearTimeout(cola); cola = setTimeout(pintar, 60); }
  window.addEventListener('hac:inicio', luego);
  window.addEventListener('hac:login', function () { setTimeout(pintar, 0); });
  window.addEventListener('hac:logout', function () { D = null; recibido = 0; ultimo = {}; ['hf-tarea', 'hf-reciente', 'hf-rapidos', 'hf-avisos', 'hf-avisos-z'].forEach(function (id) { var z = $(id); if (z) z.hidden = true; }); });

  /* Los botones de siempre se encienden o apagan según el rol (app.js y
     alcance.js): cuando cambian, se vuelve a decidir qué va arriba. */
  function observar() {
    var v = $('view-inicio'); if (!v || !window.MutationObserver) return;
    var mo = new MutationObserver(luego);
    v.querySelectorAll('.acceso').forEach(function (b) { mo.observe(b, { attributes: true, attributeFilter: ['style', 'hidden'] }); });
    mo.observe(v, { attributes: true, attributeFilter: ['class'] });
    /* el número de bitácoras que js/bitacora-abierta.js pone en la fila (si lo pidió por su cuenta) */
    ['btn-bd-predial', 'btn-semaforo'].forEach(function (id) { var b = $(id); if (b) mo.observe(b, { childList: true, subtree: true, characterData: true }); });
  }
  /* Al volver al inicio se repinta con lo que haya en memoria (sin viajar). */
  function engancharVistas() {
    var orig = window.showView;
    if (typeof orig !== 'function' || orig.__ini) return;
    var env = function (id) {
      var r = orig.apply(this, arguments);
      if (id === 'view-inicio') luego();
      return r;
    };
    env.__ini = true;
    window.showView = env;
  }
  /* La precarga de ICA (js/ica.js, 2,5 s después de entrar) trae los
     vencidos sin un viaje más: se repinta cuando llega. */
  function esperarIca() {
    if (!window.ICA || !ICA.puede || !ICA.puede()) return;
    var t0 = Date.now();
    (function mirar() {
      if (ICA._S && ICA._S.cargado) { luego(); return; }
      if (Date.now() - t0 < 30000) setTimeout(mirar, 1000);
    })();
  }
  window.addEventListener('hac:login', function () { setTimeout(esperarIca, 3000); });

  function arrancar() { observar(); engancharVistas(); luego(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', arrancar); else arrancar();
  setTimeout(engancharVistas, 1600);
  setTimeout(engancharVistas, 4200);
}());
