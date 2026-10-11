/* ============================================================
   SEC-HACIENDA-FLANDES · INFORME GERENCIAL (11/10/2026)

   El mismo PDF que las apps de FLANDES-CORE (kit/gerencial.js): portada
   membretada, indicadores, gráficas, calendario, distribución, anexo y
   nota metodológica, con la gestión de una persona en un rango de fechas.
   ADMIN y DEV escogen a la persona o "Toda la Secretaría".

   Un viaje: la ruta 'gerencial' de HACIENDA (Gerencial.gs) cuenta por
   AUTOR en PREDIAL (bitácoras y actuaciones), PROCESOS (bitácoras y
   asignaciones finalizadas) y SOLICITUDES (quién atendió) y devuelve todo
   compacto (< 100 KB aun con un año de toda la Secretaría). ICA sale de la
   lista que la app ya precarga al entrar (otro backend, sin viaje nuevo).

   Mientras el modal está abierto se bajan en reposo jsPDF y la pieza
   kit/gerencial.js; ADMIN/DEV piden la lista de personas de fondo.
   ============================================================ */
(function () {
  'use strict';

  var K = window.KIT;
  var M = window.MARCA || {};
  var CDN_PDF = 'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js';
  var MEDIDAS = [];
  function $(id) { return document.getElementById(id); }
  function aviso(t, tono, ms) { if (K && K.aviso) K.aviso(t, tono || 'info', ms || 4000); else if (window.Swal) Swal.fire({ text: t }); }

  /* ══════════════ quién soy ══════════════ */
  function perfil() { try { return window.IDN ? window.IDN.perfil() : null; } catch (e) { return null; } }
  function jefe() { try { return !!(window.IDN && window.IDN.esAdmin()); } catch (e) { return false; } }
  function norm(s) { return String(s == null ? '' : s).toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[:;,.\-\s]+$/g, '').replace(/\s+/g, ' ').trim(); }
  function titulo(s) {
    s = String(s || '').toLowerCase().replace(/(^|[\s(,])([a-záéíóúñü])/g, function (m, a, b) { return a + b.toUpperCase(); });
    return s.replace(/ (De|Del|La|Las|Los|Y|E|En|Para|Por|A) /g, function (m) { return m.toLowerCase(); });
  }

  /* ══════════════ librerías en reposo ══════════════ */
  var cargas = {};
  function guion(url) {
    if (cargas[url]) return cargas[url];
    cargas[url] = new Promise(function (res, rej) {
      var s = document.createElement('script');
      s.src = url; s.async = true;
      s.onload = function () { res(true); };
      s.onerror = function () { delete cargas[url]; rej(new Error('No se pudo bajar ' + url)); };
      document.head.appendChild(s);
    });
    return cargas[url];
  }
  function libPDF() { return (window.jspdf && window.jspdf.jsPDF) ? Promise.resolve(true) : guion(CDN_PDF); }
  function libGer() { return window.KIT_GERENCIAL ? Promise.resolve(true) : guion('kit/gerencial.js?v=' + encodeURIComponent(window.APP_VERSION || '')); }

  /* el escudo de la app a 240 px (en el PDF mide 26 mm; el de 512 hace lento cada página) */
  var escudo = null;
  function escudoPNG() {
    if (escudo !== null) return Promise.resolve(escudo);
    return new Promise(function (res) {
      var img = new Image();
      img.onload = function () {
        try {
          var c = document.createElement('canvas'); c.width = 240; c.height = 240;
          c.getContext('2d').drawImage(img, 0, 0, 240, 240);
          escudo = c.toDataURL('image/png');
        } catch (e) { escudo = ''; }
        res(escudo);
      };
      img.onerror = function () { escudo = ''; res(''); };
      img.src = M.APP_ICON || 'img/icono-512.png';
    });
  }
  function calentar() {
    var ir = function () { libPDF().catch(function () {}); libGer().catch(function () {}); escudoPNG(); };
    if (window.requestIdleCallback) window.requestIdleCallback(ir, { timeout: 1500 }); else setTimeout(ir, 300);
  }

  /* ══════════════ fechas ══════════════ */
  function iso(d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function hoy() { return new Date(); }
  var PERIODOS = [
    { k: 'mes', t: 'Este mes', f: function () { var h = hoy(); return [new Date(h.getFullYear(), h.getMonth(), 1), h]; } },
    { k: 'ant', t: 'Mes anterior', f: function () { var h = hoy(); return [new Date(h.getFullYear(), h.getMonth() - 1, 1), new Date(h.getFullYear(), h.getMonth(), 0)]; } },
    { k: 'tri', t: 'Últimos 3 meses', f: function () { var h = hoy(); return [new Date(h.getFullYear(), h.getMonth() - 2, 1), h]; } },
    { k: 'ano', t: 'Este año', f: function () { var h = hoy(); return [new Date(h.getFullYear(), 0, 1), h]; } }
  ];
  function aDia(s) { var m = /^(\d{4})(\d{2})(\d{2})$/.exec(String(s)); return m ? new Date(+m[1], +m[2] - 1, +m[3], 12) : null; }

  /* ══════════════ el viaje ══════════════ */
  var personasListas = null, pidiendoPersonas = null;
  function pedir(params, senal) {
    var url = new URL(M.API_URL || window.API_BASE || '');
    url.search = new URLSearchParams(Object.assign({ action: 'gerencial' }, params)).toString();
    var tk = window.HAC_SESION ? window.HAC_SESION.tk() : '';      /* la llave con la que sale */
    function una() {
      return fetch(url.toString(), { method: 'GET', signal: senal }).then(function (r) {
        if (!r.ok) { var e = new Error('HTTP ' + r.status); e.red = r.status === 404; throw e; }   /* 404 de echo: se reintenta */
        return r.json();
      });
    }
    return una().catch(function (e) {
      if (senal && senal.aborted) throw e;
      if (e && (e.red || e.name === 'TypeError')) return una();       /* lectura: reintentar es inofensivo */
      throw e;
    }).then(function (j) {
      if (window.HAC_SESION && window.HAC_SESION.tk() !== tk) { var v = new Error('La sesión cambió'); v.vieja = true; throw v; }
      if (!j || !j.ok) { var er = new Error((j && j.error) || 'No se pudo armar el informe'); er.codigo = j && j.codigo; throw er; }
      return j.data;
    });
  }
  function traerPersonas() {
    if (!jefe()) return Promise.resolve(null);
    if (personasListas) return Promise.resolve(personasListas);
    if (!pidiendoPersonas) {
      pidiendoPersonas = pedir({ personas: '1' }).then(function (d) {
        personasListas = (d && d.personas) || null;
        return personasListas;
      }).catch(function () { return null; }).then(function (x) { pidiendoPersonas = null; return x; });
    }
    return pidiendoPersonas;
  }

  /* ══════════════ el modal ══════════════ */
  var modal = null, ctrl = null, ocupado = false;
  function armar() {
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = 'modal-gerencial';
    modal.className = 'hf-modal hidden';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'ger-t');
    modal.innerHTML =
      '<div class="hf-modal__hoja ger">' +
        '<div class="hf-modal__cab"><i class="hi" data-ico="tendencia"></i><h2 id="ger-t">Informe gerencial</h2></div>' +
        '<p class="hf-modal__p">PDF con portada, indicadores y gráficas de la gestión registrada en la app en el periodo que escojas.</p>' +
        '<label class="ger__campo" id="ger-quien-c" hidden><span>De quién</span><select id="ger-quien"></select></label>' +
        '<div class="ger__campo"><span>Periodo</span><div class="ger__pastillas" id="ger-pers"></div></div>' +
        '<div class="ger__fechas">' +
          '<label class="ger__campo"><span>Desde</span><input type="date" id="ger-desde"></label>' +
          '<label class="ger__campo"><span>Hasta</span><input type="date" id="ger-hasta"></label>' +
        '</div>' +
        '<p class="kit-sesion__error" id="ger-error" role="alert"></p>' +
        '<div class="hf-modal__pie">' +
          '<button type="button" class="kit-btn" id="ger-cancelar">Cancelar</button>' +
          '<button type="button" class="kit-btn kit-btn--marca" id="ger-ir"><i class="hi" data-ico="pdf"></i> <span>Descargar PDF</span></button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(modal);
    try { if (window.HAC_ICONOS && window.HAC_ICONOS.pintar) window.HAC_ICONOS.pintar(modal); } catch (e) {}
    pintarIconos(modal);

    var cont = $('ger-pers');
    PERIODOS.forEach(function (p) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'kit-pastilla'; b.textContent = p.t; b.setAttribute('data-k', p.k); b.setAttribute('aria-pressed', 'false');
      b.addEventListener('click', function () { ponerPeriodo(p.k); });
      cont.appendChild(b);
    });
    ['ger-desde', 'ger-hasta'].forEach(function (id) {
      $(id).addEventListener('change', function () { marcarPastilla(''); error(''); });
    });
    $('ger-cancelar').addEventListener('click', cerrar);
    $('ger-ir').addEventListener('click', descargar);
    modal.addEventListener('click', function (ev) { if (ev.target === modal && !ocupado) cerrar(); });
    document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape' && modal && !modal.classList.contains('hidden') && !ocupado) cerrar(); });
    return modal;
  }
  function pintarIconos(raiz) {
    raiz.querySelectorAll('i.hi[data-ico]').forEach(function (i) {
      if (i.innerHTML) return;
      try { i.innerHTML = K.icono(i.getAttribute('data-ico'), Number(i.getAttribute('data-t')) || 18); } catch (e) {}
    });
  }
  function marcarPastilla(k) {
    modal.querySelectorAll('#ger-pers .kit-pastilla').forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-k') === k ? 'true' : 'false'); });
  }
  function ponerPeriodo(k) {
    var p = PERIODOS.filter(function (x) { return x.k === k; })[0];
    if (!p) return;
    var r = p.f();
    $('ger-desde').value = iso(r[0]); $('ger-hasta').value = iso(r[1]);
    $('ger-hasta').max = iso(hoy()); $('ger-desde').max = iso(hoy());
    marcarPastilla(k); error('');
  }
  function error(t) { var e = $('ger-error'); if (!e) return; e.textContent = t || ''; e.classList.toggle('kit-sesion__error--on', !!t); }

  function pintarPersonas(lista) {
    var sel = $('ger-quien'), yo = (perfil() || {}).nombre || '';
    var antes = sel.value || yo;
    var nombres = [];
    if (lista && lista.length) nombres = lista.map(function (p) { return { n: p[0], r: p[1], a: p[2] }; });
    else {
      /* mientras llega la lista del servidor: los catálogos que ya están en memoria */
      var vistos = {}; var C = (window.ALC && window.ALC.catalogos) || {};
      [yo].concat(Object.keys(C).reduce(function (a, k) { return a.concat((C[k] || []).map(function (x) { return x.nombre; })); }, []))
        .forEach(function (n) { n = String(n || '').trim(); if (n && !vistos[norm(n)]) { vistos[norm(n)] = 1; nombres.push({ n: n, r: '', a: 1 }); } });
    }
    sel.innerHTML = '';
    var o = document.createElement('option'); o.value = '*'; o.textContent = 'Toda la Secretaría (todos juntos)'; sel.appendChild(o);
    var g1 = document.createElement('optgroup'); g1.label = 'Una persona';
    var g2 = document.createElement('optgroup'); g2.label = 'Inactivos';
    nombres.forEach(function (p) {
      var op = document.createElement('option');
      op.value = p.n; op.textContent = titulo(p.n) + (p.r ? ' · ' + titulo(p.r) : '');
      (p.a ? g1 : g2).appendChild(op);
    });
    sel.appendChild(g1); if (g2.children.length) sel.appendChild(g2);
    sel.value = antes;
    if (sel.value !== antes) sel.value = yo || '*';
  }

  function abrir() {
    if (!perfil()) { aviso('Primero inicia sesión.', 'aviso'); return; }
    armar();
    var esJefe = jefe();
    $('ger-quien-c').hidden = !esJefe;
    if (esJefe) {
      pintarPersonas(personasListas);
      if (!personasListas) traerPersonas().then(function (l) { if (l && modal && !modal.classList.contains('hidden')) pintarPersonas(l); });
    }
    if (!$('ger-desde').value) ponerPeriodo('mes');
    error('');
    modal.classList.remove('hidden');
    calentar();
  }
  function cerrar() {
    if (ctrl) { try { ctrl.abort(); } catch (e) {} ctrl = null; }
    if (modal) modal.classList.add('hidden');
    ocupado = false; botonLibre();
  }
  function botonOcupado() {
    var b = $('ger-ir'); if (!b) return;
    b.disabled = true; b.classList.add('ger--ocupado'); b.querySelector('span').textContent = 'Armando el informe…';
  }
  function botonLibre() {
    var b = $('ger-ir'); if (!b) return;
    b.disabled = false; b.classList.remove('ger--ocupado'); b.querySelector('span').textContent = 'Descargar PDF';
  }

  /* ══════════════ de la respuesta al "spec" de kit/gerencial.js ══════════════ */
  var TONO = { o: 'ok', a: 'aviso', m: 'malo', i: 'info' };
  function decodificar(d) {
    var base = aDia(d.desde);
    var partes = d.r ? d.r.split(';') : [];
    var x = d.x || [], desdeX = partes.length - x.length;
    return partes.map(function (s, i) {
      var c = s.split('.');
      var f = new Date(base); f.setDate(f.getDate() + parseInt(c[0], 36));
      var t = d.tipos[parseInt(c[1], 36)] || ['', 'i', ''];
      var reg = { fecha: iso(f), tipo: t[0], tono: TONO[t[1]] || 'info', categoria: t[2], autor: c[2] ? (d.autores[parseInt(c[2], 36)] || '') : '' };
      if (i >= desdeX) { var e = x[i - desdeX] || []; reg.sujeto = e[0] || ''; reg.ref = e[1] || ''; reg.hora = e[2] || ''; }
      return reg;
    });
  }
  function contar(regs, fn) {
    var m = {};
    regs.forEach(function (r) { var k = fn(r); if (k) m[k] = (m[k] || 0) + 1; });
    return Object.keys(m).map(function (k) { return { etiqueta: k, valor: m[k] }; }).sort(function (a, b) { return b.valor - a.valor || a.etiqueta.localeCompare(b.etiqueta, 'es'); });
  }
  function pares(a, tono) { return (a || []).map(function (p) { return { etiqueta: titulo(p[0]), valor: p[1], tono: tono }; }); }
  function n(v) { return Math.round(Number(v) || 0).toLocaleString('es-CO'); }
  function pct(a, b) { return b ? (Math.round(a / b * 1000) / 10).toLocaleString('es-CO') + ' %' : '—'; }
  function minutos(m) { m = Math.round(Number(m) || 0); if (!m) return '—'; if (m < 60) return m + ' min'; var h = Math.floor(m / 60), r = m % 60; return h < 48 ? h + ' h' + (r ? ' ' + r + ' min' : '') : Math.round(h / 24) + ' días'; }

  /* ICA: lo que esta persona registró en el periodo (la lista ya está en memoria) */
  function icaDe(persona, todos, desde, hasta) {
    var S = window.ICA && window.ICA._S;
    var lista = S && Array.isArray(S.lista) ? S.lista : null;
    if (!lista) return null;
    var yo = norm(persona);
    var mias = lista.filter(function (r) { return todos || norm(r.crep) === yo; });
    var regs = [], et = {}, env = 0, resp = 0;
    mias.forEach(function (r) {
      var cre = String(r.cre || '').slice(0, 10);
      if (cre && cre >= desde && cre <= hasta) regs.push({ fecha: cre, tipo: 'Contribuyente de ICA registrado', tono: 'ok', categoria: 'Industria y Comercio', sujeto: r.nom || '', ref: r.of ? 'Oficio ' + r.of : '', autor: norm(r.crep) });
      var e = String(r.env || '').slice(0, 10), p = String(r.resp || '').slice(0, 10);
      if (e && e >= desde && e <= hasta) { env++; regs.push({ fecha: e, tipo: 'Requerimiento de ICA enviado', tono: 'ok', categoria: 'Industria y Comercio', sujeto: r.nom || '', ref: r.of ? 'Oficio ' + r.of : '', autor: norm(r.crep) }); }
      if (p && p >= desde && p <= hasta) resp++;
      et[r.et || 'SIN ETAPA'] = (et[r.et || 'SIN ETAPA'] || 0) + 1;
    });
    if (!mias.length) return null;
    return { regs: regs, total: mias.length, env: env, resp: resp, etapas: Object.keys(et).map(function (k) { return [k, et[k]]; }).sort(function (a, b) { return b[1] - a[1]; }) };
  }

  function spec(d, persona, todos, desde, hasta) {
    var regs = decodificar(d);
    var ica = icaDe(persona, todos, desde, hasta);
    if (ica && ica.regs.length) regs = regs.concat(ica.regs);
    var nombrePer = todos ? 'Toda la Secretaría de Hacienda' : titulo(persona);
    var secciones = [], extra = [];

    /* por funcionario (solo "todos") */
    if (todos && regs.length) {
      var porF = contar(regs, function (r) { return r.autor ? titulo(r.autor) : 'Sin autor registrado'; });
      secciones.push({ titulo: 'Gestión por funcionario', intro: 'Quién registró cada gestión del periodo (autor de la anotación o de la atención).',
        kpis: [{ etiqueta: 'Funcionarios con gestión', valor: n(porF.filter(function (x) { return x.etiqueta !== 'Sin autor registrado'; }).length), tono: 'info' },
               { etiqueta: 'Mayor gestión', valor: porF[0] ? n(porF[0].valor) : '0', nota: porF[0] ? porF[0].etiqueta : '' }],
        graficas: [{ titulo: 'Gestiones por funcionario', tipo: 'barrasH', datos: porF.slice(0, 15), max: 15 }] });
    }

    /* Predial */
    var P = d.pred || {}, predRegs = regs.filter(function (r) { return r.categoria === 'Predial'; });
    if (predRegs.length || P.cartera) {
      var acts = predRegs.filter(function (r) { return /^Actuación: /.test(r.tipo); });
      secciones.push({ titulo: 'Predial · cobro coactivo', intro: 'Actuaciones y bitácoras registradas en BD Predial en el periodo, y el estado de hoy de la cartera ' + (todos ? 'asignada.' : 'a su cargo (sustanciador o asistente).'),
        kpis: [{ etiqueta: 'Actuaciones registradas', valor: n(acts.length), tono: 'ok' },
               { etiqueta: 'Anotaciones de bitácora', valor: n(predRegs.filter(function (r) { return /^Bitácora/.test(r.tipo); }).length), tono: 'info' },
               { etiqueta: 'Expedientes en cartera hoy', valor: n(P.cartera), nota: n(P.conActuacion) + ' con actuación' },
               { etiqueta: 'Seguimientos vencidos hoy', valor: n(P.segVencidos), nota: n(P.segProgramados) + ' programados', tono: P.segVencidos ? 'malo' : 'ok' }],
        graficas: [{ titulo: 'Actuaciones registradas por tipo', tipo: 'barrasH', datos: contar(acts, function (r) { return r.tipo.replace(/^Actuación: /, ''); }).map(function (x) { return { etiqueta: titulo(x.etiqueta), valor: x.valor }; }), max: 12 },
                   { titulo: 'Cartera por actuación vigente (hoy)', tipo: 'barrasH', datos: pares(P.porActuacion), max: 12 }] });
      if (P.segVencidos) extra.push('Hoy hay ' + n(P.segVencidos) + ' seguimientos de predial con la fecha vencida en la cartera ' + (todos ? 'asignada.' : 'a su cargo.'));
    }

    /* Asignaciones */
    var A = d.proc || {}, procRegs = regs.filter(function (r) { return r.categoria === 'Asignaciones'; });
    if (procRegs.length || A.recibidas || A.abiertas) {
      secciones.push({ titulo: 'Asignaciones · Mi semáforo', intro: 'Oficios asignados ' + (todos ? '' : 'a la persona (como asignado o asistente) ') + 'que llegaron y se cerraron en el periodo. "A tiempo" = cerrada hasta la fecha de respuesta.',
        kpis: [{ etiqueta: 'Recibidas en el periodo', valor: n(A.recibidas), tono: 'info' },
               { etiqueta: 'Finalizadas', valor: n(A.finalizadas), nota: pct(A.aTiempo, A.finalizadas) + ' a tiempo', tono: 'ok' },
               { etiqueta: 'Abiertas hoy', valor: n(A.abiertas), nota: n(A.vencidas) + ' con el plazo vencido', tono: A.vencidas ? 'aviso' : 'ok' },
               { etiqueta: 'Bitácoras de asignación', valor: n(procRegs.filter(function (r) { return /^Bitácora/.test(r.tipo); }).length), tono: 'info' }],
        graficas: [{ titulo: 'Cierre frente al plazo', tipo: 'proporcion', datos: [{ etiqueta: 'A tiempo', valor: A.aTiempo || 0, tono: 'ok' }, { etiqueta: 'Fuera de plazo', valor: A.fuera || 0, tono: 'malo' }].filter(function (x) { return x.valor; }) },
                   { titulo: 'Recibidas por categoría', tipo: 'barrasH', datos: pares(A.porCategoria), max: 10 },
                   { titulo: 'Recibidas por medio', tipo: 'barrasH', datos: pares(A.porMedio), max: 8 }] });
      if (A.vencidas) extra.push(n(A.vencidas) + (A.vencidas === 1 ? ' asignación sigue abierta' : ' asignaciones siguen abiertas') + ' con el plazo de respuesta vencido.');
    }

    /* Atención al contribuyente */
    var T = d.atn || {}, atnTot = (T.chat || 0) + (T.pres || 0) + (T.otras || 0);
    if (atnTot) {
      secciones.push({ titulo: 'Atención al contribuyente', intro: 'Solicitudes de predial atendidas por chat y en persona (usuario que guardó la atención).',
        kpis: [{ etiqueta: 'Por chat', valor: n(T.chat), tono: 'ok' }, { etiqueta: 'Presenciales', valor: n(T.pres), tono: 'ok' },
               { etiqueta: 'Otras gestiones', valor: n(T.otras), nota: 'al día, no encontrado…', tono: 'info' },
               { etiqueta: 'Respuesta promedio al chat', valor: minutos(T.minProm), nota: 'de la llegada a la respuesta', tono: 'info' }],
        graficas: [{ titulo: 'Canal de atención', tipo: 'proporcion', datos: [{ etiqueta: 'Chat', valor: T.chat || 0, tono: 'info' }, { etiqueta: 'Presencial', valor: T.pres || 0, tono: 'ok' }, { etiqueta: 'Otras', valor: T.otras || 0, tono: 'aviso' }].filter(function (x) { return x.valor; }) }] });
      if (T.minProm) extra.push('El chat se respondió en promedio en ' + minutos(T.minProm) + ' desde que llegó la solicitud.');
    }

    /* Industria y Comercio */
    if (ica) {
      secciones.push({ titulo: 'Industria y Comercio', intro: 'Contribuyentes de ICA ' + (todos ? 'registrados' : 'que registró la persona') + ' y su avance (lista de requerimientos de la app).',
        kpis: [{ etiqueta: 'Contribuyentes', valor: n(ica.total), tono: 'info' }, { etiqueta: 'Requerimientos enviados', valor: n(ica.env), nota: 'en el periodo', tono: 'ok' },
               { etiqueta: 'Respuestas recibidas', valor: n(ica.resp), nota: 'en el periodo', tono: 'ok' }],
        graficas: [{ titulo: 'Contribuyentes por etapa (hoy)', tipo: 'barrasH', datos: pares(ica.etapas), max: 8 }] });
    }

    var rango = desde.split('-').reverse().join('-') + (hasta !== desde ? ' a ' + hasta.split('-').reverse().join('-') : '');
    return {
      app: 'Sec. Hacienda', ecosistema: 'FLANDES-CORE · Secretaría de Hacienda',
      persona: nombrePer, rol: todos ? 'Secretaría de Hacienda' : titulo(d.rol || ''),
      desde: desde, hasta: hasta,
      nombre: ['Informe gerencial Sec Hacienda', todos ? 'Toda la Secretaria' : titulo(persona), rango].join(' '),
      palabra: ['gestión', 'gestiones'],
      etiquetas: { tipo: 'Gestión', categoria: 'Módulo', sujeto: 'Contribuyente', sujetos: 'contribuyentes' },
      tonos: { ok: 'Resueltas o registradas', aviso: 'En seguimiento', malo: 'Fuera de plazo', info: 'Anotaciones de bitácora' },
      registros: regs,
      /* distintos y top 10 los contó el servidor (los registros viejos viajan sin nombre); ICA suma sus contribuyentes */
      sujetos: { n: ((d.s && d.s.n) || 0) + (ica ? ica.regs.filter(function (r, i, a) { return r.sujeto && a.findIndex(function (z) { return z.sujeto === r.sujeto; }) === i; }).length : 0),
                 top: ((d.s && d.s.top) || []).map(function (x) { return { etiqueta: x[0], valor: x[1] }; }) },
      secciones: secciones,
      hallazgos: extra,
      notaAnexo: 'El detalle completo de bitácoras y actuaciones está en Mi trabajo (BD Predial y Asignaciones).'
    };
  }

  /* ══════════════ descargar ══════════════ */
  function descargar() {
    if (ocupado) return;
    var desde = $('ger-desde').value, hasta = $('ger-hasta').value;
    if (!desde || !hasta) return error('Escoge las dos fechas.');
    if (desde > hasta) return error('La fecha "Desde" no puede ser posterior a "Hasta".');
    var yo = (perfil() || {}).nombre || '';
    var persona = jefe() ? ($('ger-quien').value || yo) : yo;
    var todos = persona === '*';
    error('');
    ocupado = true; botonOcupado();
    ctrl = window.AbortController ? new AbortController() : null;
    var t0 = performance.now(), tRed = 0;
    var pRed = pedir({ desde: desde, hasta: hasta, persona: persona }, ctrl && ctrl.signal).then(function (d) { tRed = performance.now() - t0; return d; });
    /* ICA: si la lista aún no se ha precargado y la persona la maneja, se pide en paralelo */
    var pIca = (window.ICA && window.ICA.puede && window.ICA.puede() && !(window.ICA._S && window.ICA._S.cargado))
      ? Promise.race([window.ICA.cargar().catch(function () {}), new Promise(function (r) { setTimeout(r, 4000); })]) : Promise.resolve();
    Promise.all([pRed, libPDF(), libGer(), escudoPNG(), pIca]).then(function (r) {
      var d = r[0];
      var t1 = performance.now();
      var sp = spec(d, todos ? '*' : (d.persona || persona), todos, desde, hasta);
      var out = window.KIT_GERENCIAL.dibujar(sp, { MARCA_MUNICIPIO: 'MUNICIPIO DE FLANDES', MARCA_NIT: '' }, r[3], '');
      var med = { cuando: new Date().toISOString(), persona: todos ? '*' : 'una', dias: Math.round((new Date(hasta) - new Date(desde)) / 864e5) + 1,
        registros: sp.registros.length, paginas: out.paginas, msTotal: Math.round(performance.now() - t0), msRed: Math.round(tRed),
        msServidor: d.ms, msLeer: d.msLeer, frio: (d.frio || []).join('/'), msDibujo: Math.round(performance.now() - t1) };
      MEDIDAS.push(med);
      try { console.info('[gerencial]', med); } catch (e) {}
      cerrar();
      aviso('Informe gerencial descargado (' + out.paginas + ' páginas).', 'ok', 4000);
    }).catch(function (e) {
      if (e && (e.name === 'AbortError' || e.vieja)) return;
      ocupado = false; botonLibre();
      var msg = (e && e.message) || '';
      if (/Acción no válida/i.test(msg)) msg = 'El servidor todavía no tiene el informe gerencial. Avísale al desarrollador.';
      else if (/HTTP|fetch|Failed|NetworkError|bajar/i.test(msg)) msg = 'No hay conexión para armar el informe. Revisa la red y vuelve a intentar.';
      error(msg || 'No se pudo armar el informe.');
    });
  }

  /* ══════════════ la tarjeta del inicio ══════════════ */
  function enchufar() {
    var b = $('btn-gerencial');
    if (b && !b.__ger) { b.__ger = true; b.addEventListener('click', abrir); }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', enchufar); else enchufar();
  window.addEventListener('hac:login', function () { personasListas = null; });

  window.GERENCIAL = { abrir: abrir, _spec: spec, _decodificar: decodificar, _medidas: function () { return MEDIDAS.slice(); } };
}());
