/* ============================================================
   MASIFICACIÓN MAIL — 17/11/2026 · SEC-HACIENDA-FLANDES

   Dos vistas (todos los roles):
     · Predial · Comunicaciones persuasivas (view-mas-pers): una carta en
       PDF por contribuyente con la tabla de TODAS sus fichas, oficio
       consecutivo automático, constancia en la bitácora del expediente.
     · Predial · Marketing (view-mas-mkt): correo con la imagen en el cuerpo
       y adjunta; destinatarios por Excel o por filtros de BD Predial.

   Los correos salen de cobrocoactivo@flandes-tolima.gov.co por el backend
   ICA (Masivo.gs). El navegador NUNCA envía: arma la campaña y la pone en
   la cola; la cola sale de fondo al ritmo configurado (300-400 por hora).

   Rendimiento (reglas 11–15)
     · Una vista, un viaje: 'masarranque' trae campañas + conteos +
       configuración + cuota, una vez por sesión; reabrir es instantáneo.
     · Destinatarios por páginas; el informe Excel se arma en el equipo.
     · Corte al salir (AbortController); los guardados no se cortan.
     · Escrituras: botón ocupado + escudo desde el primer toque + rid; el
       reintento (solo red o el 404 de Google) usa el MISMO rid.
     · Con una campaña en cola y la vista abierta, el avance se refresca
       de fondo cada 90 s (se detiene al salir de la vista).
     · Medición en pantalla: window.__masMed (ruta, ms, KB).
   ============================================================ */
(function () {
  'use strict';
  if (window.MASIVO) return;

  var K = window.KIT || {};
  var VISTAS = { PERS: 'view-mas-pers', MKT: 'view-mas-mkt' };
  var NOMBRE = { PERS: 'Comunicaciones persuasivas', MKT: 'Marketing' };
  var LOCAL_XLSX = 'vendor/xlsx-0.18.5.full.min.js';
  var ESTADOS = { EN_COLA: ['En cola', 'reloj'], PAUSADA: ['Pausada', 'pausa'], TERMINADA: ['Terminada', 'check'], CANCELADA: ['Cancelada', 'cerrar'] };
  var DEST_EST = { PEND: 'Pendiente', ENVIADO: 'Enviado', FALLO: 'Falló', OMITIDO: 'Omitido', CANCELADO: 'Cancelado' };
  var MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

  var S = { camps: null, cfg: null, cuota: null, yo: null, hoy: '', cargado: false, cargando: null, ctrl: null, sondeo: null, tipo: 'PERS' };
  window.__masMed = window.__masMed || [];

  /* ══════════════ utilidades ══════════════ */
  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
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
  function sonar(n) { try { if (typeof playSoundOnce === 'function' && typeof SOUNDS !== 'undefined' && SOUNDS[n]) playSoundOnce(SOUNDS[n]); } catch (e) {} }
  function num(n) { try { return Number(n || 0).toLocaleString('es-CO'); } catch (e) { return String(n); } }
  function fLarga(iso) { var p = String(iso || '').slice(0, 10).split('-'); return p.length < 3 ? String(iso || '') : (+p[2]) + ' de ' + MESES[+p[1] - 1] + ' de ' + p[0]; }
  function fCorta(t) { var m = String(t || '').match(/^(\d{4})-(\d{2})-(\d{2})(?:\s+(\d{2}:\d{2}))?/); return m ? m[3] + '/' + m[2] + '/' + m[1] + (m[4] ? ' ' + m[4] : '') : String(t || ''); }
  function esperar(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function error(codigo, msg) { var e = new Error(msg); e.codigo = codigo; return e; }
  function nuevoRid() { return 'mas' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10); }
  function tk() { return window.HAC_SESION ? window.HAC_SESION.tk() : ''; }
  function url() { return (window.HAC_PUBLICO && window.HAC_PUBLICO.icaUrl) || (window.MARCA && window.MARCA.ICA_URL) || ''; }
  function cancelada(e) { return e && (e.name === 'AbortError' || e.codigo === 'VIEJA'); }
  function activa(tipo) { var v = $(VISTAS[tipo || S.tipo]); return !!(v && v.classList.contains('active')); }

  /* ══════════════ red (backend ICA) ══════════════ */
  function llamar(accion, datos, op) {
    op = op || {};
    datos = datos || {};
    /* 17/11 — op.hac: la petición va a HACIENDA (backend principal) con la misma sesión */
    var u = op.hac ? ((window.MARCA && window.MARCA.API_URL) || '') : url();
    if (!u) return Promise.reject(error('SIN_URL', 'Falta la dirección del backend. Recarga la app.'));
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
        if (llave !== tk()) throw error('VIEJA', 'Sesión cambiada');
        var ms = Math.round(((window.performance && performance.now()) || Date.now()) - t0);
        try { window.__masMed.push({ ruta: accion, ms: ms, kb: Math.round(t.length / 102.4) / 10, n: n }); if (window.__masMed.length > 200) window.__masMed.shift(); } catch (e) {}
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
  function guardando(promesa, texto) {
    try { if (K.piezas && K.piezas.guardado) return K.piezas.guardado.mientras(promesa, { titulo: texto }); } catch (e) {}
    return promesa;
  }

  /* ══════════════ carga (una vez por sesión) ══════════════ */
  function cargar(forzar, silencio) {
    if (S.cargado && !forzar) return Promise.resolve();
    if (S.cargando && !forzar) return S.cargando;
    if (S.ctrl && !silencio) try { S.ctrl.abort(); } catch (e) {}
    var ctrl = (typeof AbortController === 'function') ? new AbortController() : null;
    if (!silencio) S.ctrl = ctrl;
    var p = llamar('masarranque', {}, { signal: ctrl && ctrl.signal }).then(function (d) {
      S.camps = d.camps || []; S.cfg = d.cfg; S.cuota = d.cuota; S.yo = d.yo; S.hoy = d.hoy; S.cargado = true;
    });
    S.cargando = p;
    p.then(function () { S.cargando = null; }, function () { S.cargando = null; });
    return p;
  }
  function olvidar() { S.camps = null; S.cfg = null; S.cargado = false; S.opc = null; parar(); }
  /* 17/11 — conteos de BD Predial para los filtros: se piden de fondo al abrir
     Marketing y se reutilizan 10 min (el asistente los pinta al instante). */
  function opciones() {
    if (S.opc && Date.now() - S.opcT < 600000) return Promise.resolve(S.opc);
    if (S.opcP) return S.opcP;
    S.opcP = llamar('masopciones', {}).then(function (o) { S.opc = o; S.opcT = Date.now(); S.opcP = null; return o; },
      function (e) { S.opcP = null; throw e; });
    return S.opcP;
  }
  window.addEventListener('hac:sesionVencida', olvidar);

  /* ══════════════ la vista ══════════════ */
  function montarVista(tipo) {
    var id = VISTAS[tipo];
    if ($(id)) return $(id);
    var cont = document.querySelector('.container') || document.body;
    var sec = document.createElement('section');
    sec.id = id; sec.className = 'view';
    var p = 'mas-' + tipo.toLowerCase();
    sec.innerHTML =
      '<div class="vista kit-ancho mas" data-tipo="' + tipo + '">' +
        '<div class="hf-herramientas">' +
          '<button type="button" class="kit-btn kit-btn--marca" data-mas="nueva">' + ico('mas') + ' Nueva campaña</button>' +
          '<button type="button" class="kit-btn" data-mas="config">' + ico('engranaje') + ' Configuración</button>' +
          '<button type="button" class="kit-btn" data-mas="refrescar" title="Volver a traer el avance">' + ico('recargar') + ' Refrescar</button>' +
        '</div>' +
        '<p class="mas-intro">' + (tipo === 'PERS'
          ? 'Una carta en PDF por contribuyente, con la tabla de todas sus fichas, desde <b>cobrocoactivo@flandes-tolima.gov.co</b>. Cada envío queda en la bitácora del expediente.'
          : 'Correo con la imagen de la campaña (en el cuerpo y adjunta) desde <b>cobrocoactivo@flandes-tolima.gov.co</b>. Destinatarios por Excel o por filtros de BD Predial.') + '</p>' +
        '<div class="mas-cuota" id="' + p + '-cuota"></div>' +
        '<div class="hf-rejilla mas-lista" id="' + p + '-lista"></div>' +
        '<button type="button" class="hf-atras" hidden>Regresar</button>' +
      '</div>';
    cont.appendChild(sec);
    sec.querySelector('.hf-atras').addEventListener('click', salir);
    sec.addEventListener('click', function (e) {
      var b = e.target.closest('[data-mas]'); if (!b || b.disabled) return;
      var a = b.getAttribute('data-mas');
      if (a === 'nueva') { sonar('menu'); abrirNueva(tipo); }
      else if (a === 'config') { sonar('menu'); abrirConfig(tipo); }
      else if (a === 'refrescar') refrescar(b);
      else {
        var card = b.closest('[data-camp]'); if (!card) return;
        var c = campDe(card.getAttribute('data-camp')); if (!c) return;
        if (a === 'ver') abrirDetalle(c);
        else if (a === 'informe') informe(c, b);
        else cambiarEstado(c, a, b);
      }
    });
    return sec;
  }
  function campDe(id) { return (S.camps || []).filter(function (c) { return c.id === id; })[0]; }
  function salir() {
    var abiertos = Array.prototype.filter.call(document.querySelectorAll('.mas-modal'), function (m) { return m.cerrar; });
    if (abiertos.some(function (m) { return m.__ocupado; })) return;
    abiertos.reverse().reduce(function (p, m) { return p.then(function (ok) { return ok ? m.cerrar() : false; }); }, Promise.resolve(true))
      .then(function (ok) { if (ok) { parar(); if (typeof window.showView === 'function') window.showView('view-inicio'); } });
  }
  function abrir(tipo) {
    S.tipo = tipo;
    montarVista(tipo);
    if (typeof window.showView === 'function') window.showView(VISTAS[tipo]);
    if (tipo === 'MKT') setTimeout(function () { if (activa(tipo)) opciones().catch(function () {}); }, 0);
    if (S.cargado) { pintar(tipo); sondear(); return; }
    pintarEsqueleto(tipo);
    cargar().then(function () { if (activa(tipo)) { pintar(tipo); sondear(); } }, function (e) {
      if (cancelada(e) || !activa(tipo)) return;
      var l = $('mas-' + tipo.toLowerCase() + '-lista');
      l.innerHTML = '<div class="ica-vacio">' + ico('aviso', 28) + '<p>' + esc(e.message) + '</p><button type="button" class="kit-btn" data-reint>' + ico('recargar') + ' Reintentar</button></div>';
      l.querySelector('[data-reint]').addEventListener('click', function () { abrir(tipo); });
    });
  }
  function refrescar(b) {
    if (b) { b.disabled = true; b.classList.add('ica-ocupado'); }
    sonar('menu');
    return cargar(true).then(function () { if (activa()) pintar(S.tipo); if (b) aviso('Avance actualizado.', 'ok', 1800); },
      function (e) { if (!cancelada(e)) aviso(e.message, 'aviso', 5000); })
      .then(function () { if (b) { b.disabled = false; b.classList.remove('ica-ocupado'); } });
  }
  /** Con campañas en cola y la vista abierta: avance de fondo cada 90 s (sin bloquear nada). */
  function sondear() {
    parar();
    S.sondeo = setInterval(function () {
      if (!activa() || document.hidden) return;
      if (!(S.camps || []).some(function (c) { return c.est === 'EN_COLA'; })) return;
      cargar(true, true).then(function () { if (activa()) pintar(S.tipo); }, function () {});
    }, 90000);
  }
  function parar() { if (S.sondeo) { clearInterval(S.sondeo); S.sondeo = null; } }

  function pintarEsqueleto(tipo) {
    var h = ''; for (var i = 0; i < 3; i++) h += '<div class="sol-card ica-card ica-sk"><span></span><span></span><span></span><span></span></div>';
    $('mas-' + tipo.toLowerCase() + '-lista').innerHTML = h;
  }
  function pintar(tipo) {
    var p = 'mas-' + tipo.toLowerCase();
    var cu = S.cuota || {};
    var hayCola = (S.camps || []).some(function (c) { return c.est === 'EN_COLA'; });
    $(p + '-cuota').innerHTML =
      '<div class="mas-cuota__barra"><i style="width:' + Math.min(100, Math.round(100 * (cu.usado || 0) / Math.max(1, cu.tope || 1))) + '%"></i></div>' +
      '<span>' + ico('sobre', 14) + ' Últimas 24 h: <b>' + num(cu.usado) + '</b> de <b>' + num(cu.tope) + '</b> destinatarios · ritmo <b>' + num(cu.ritmo) + '</b> por hora' +
      (cu.pausaGmail ? ' · <b class="mas-mal">Gmail pidió pausa hasta ' + esc(fCorta(cu.pausaGmail)) + '</b>' : '') +
      (hayCola ? ' · la cola sale sola cada 10 min' : '') + '</span>';
    var l = (S.camps || []).filter(function (c) { return c.tipo === tipo; });
    var cont = $(p + '-lista');
    if (!l.length) {
      cont.innerHTML = '<div class="ica-vacio">' + ico(tipo === 'PERS' ? 'documento' : 'megafono', 30) + '<p>Aún no hay campañas de ' + esc(NOMBRE[tipo].toLowerCase()) + '. Crea la primera con <b>Nueva campaña</b>.</p></div>';
      return;
    }
    cont.innerHTML = l.map(tarjeta).join('');
  }
  function tarjeta(c) {
    var n = c.n || {}, total = n.t || c.total || 0, hechos = (n.env || 0) + (n.fallo || 0) + (n.omit || 0) + (n.canc || 0);
    var pct = total ? Math.round(100 * hechos / total) : 0;
    var e = ESTADOS[c.est] || [c.est, 'info'];
    var ritmo = (S.cuota && S.cuota.ritmo) || 350;
    var eta = c.est === 'EN_COLA' && n.pend ? ' · faltan ' + num(n.pend) + ' (≈ ' + (n.pend / ritmo < 1 ? Math.max(10, Math.round(60 * n.pend / ritmo)) + ' min' : (Math.round(10 * n.pend / ritmo) / 10).toString().replace('.', ',') + ' h') + ')' : '';
    var puede = puedeCambiar(c);
    var acc = btn('ver', 'ojo', 'Ver destinatarios') + btn('informe', 'excel', 'Informe en Excel');
    if (puede && c.est === 'EN_COLA') acc += btn('pausar', 'pausa', 'Pausar el envío');
    if (puede && c.est === 'PAUSADA') acc += btn('reanudar', 'play', 'Reanudar el envío', 'bdp-icon-btn--marca');
    if (puede && n.fallo) acc += btn('reintentar', 'recargar', 'Reintentar los fallidos (' + n.fallo + ')');
    if (puede && (c.est === 'EN_COLA' || c.est === 'PAUSADA')) acc += btn('cancelar', 'cerrar', 'Cancelar lo que falta', 'danger-icon');
    return '<article class="sol-card mas-card mas-card--' + esc(c.est) + '" data-camp="' + esc(c.id) + '">' +
      '<div class="ica-card__top"><span class="mas-est mas-est--' + esc(c.est) + '">' + ico(e[1], 14) + ' ' + esc(e[0]) + '</span>' +
        (c.of ? '<span class="ica-of">Oficios ' + esc(c.of) + '</span>' : '') + '</div>' +
      '<h4 class="ica-nom">' + esc(c.nom) + '</h4>' +
      '<p class="ica-id">' + esc(fCorta(c.cre)) + ' · ' + esc(c.por) + (c.origen === 'BD' ? ' · desde BD Predial' : (c.origen ? ' · desde Excel' : '')) + (c.fl ? ' · beneficio hasta el ' + esc(fLarga(c.fl)) : '') + '</p>' +
      '<p class="mas-asunto">' + ico('sobre', 14) + esc(c.asunto) + '</p>' +
      '<div class="mas-prog" title="' + pct + ' %"><i style="width:' + pct + '%"></i></div>' +
      '<p class="mas-prog__t"><b>' + num(n.env) + '</b> enviados de <b>' + num(total) + '</b>' + esc(eta) + '</p>' +
      '<div class="mas-chips">' +
        chip('ok', 'check', n.env, 'Enviados') + chip('', 'reloj', n.pend, 'Pendientes') + chip('malo', 'aviso', n.fallo, 'Fallidos') +
        chip('', 'cerrar', n.omit, 'Omitidos (sin correo)') + chip('malo', 'devolver', n.reb, 'Rebotaron') + chip('ok', 'responder', n.resp, 'Respondieron') +
      '</div>' +
      '<div class="bdp-actions">' + acc + '</div></article>';
    function chip(t, i, v, tt) { return v ? '<span class="mas-chip' + (t ? ' mas-chip--' + t : '') + '" title="' + esc(tt) + '">' + ico(i, 13) + num(v) + ' ' + esc(tt.split(' (')[0].toLowerCase()) + '</span>' : ''; }
    function btn(a, i, t, extra) { return '<button type="button" class="bdp-icon-btn ' + (extra || '') + '" data-mas="' + a + '" title="' + esc(t) + '" aria-label="' + esc(t) + '">' + ico(i, 20) + '</button>'; }
  }
  function perfilApp() { try { return (window.IDN && window.IDN.perfil()) || null; } catch (e) { return null; } }
  function esJefe() { var r = (perfilApp() || {}).roles || []; return r.indexOf('ADMIN') !== -1 || r.indexOf('DEV') !== -1; }
  function puedeCambiar(c) { return esJefe() || String((S.yo && S.yo.nombre) || '').trim().toUpperCase() === String(c.por || '').trim().toUpperCase(); }

  /* ══════════════ modales ══════════════ */
  function modal(op) {
    var m = document.createElement('div');
    m.className = 'hf-modal mas-modal ica-modal';
    m.innerHTML = '<div class="hf-modal__hoja' + (op.ancha ? ' hf-modal__hoja--ancha mas-hoja' : '') + '" role="dialog" aria-modal="true">' +
      '<div class="hf-modal__cab">' + ico(op.icono || 'sobre', 22) + '<h2>' + esc(op.titulo) + '</h2>' +
      '<button type="button" class="ica-x" data-cerrar aria-label="Cerrar">' + ico('cerrar', 20) + '</button></div>' +
      '<div class="ica-modal__cuerpo">' + (op.cuerpo || '') + '</div>' +
      (op.pie != null ? '<div class="hf-modal__pie">' + op.pie + '</div>' : '') + '</div>';
    document.body.appendChild(m);
    var quitar = function () { m.remove(); document.removeEventListener('keydown', tecla); if (op.alCerrar) op.alCerrar(); };
    var cerrar = function (forzar) {
      if (m.__ocupado) return Promise.resolve(false);
      if (forzar !== true && op.sucio && op.sucio()) {
        return confirmar('¿Descartar la campaña?', '<p>Lo que preparaste aún no está en la cola. Si cierras, se pierde.</p>', 'Sí, descartar')
          .then(function (ok) { if (ok) quitar(); return ok; });
      }
      quitar(); return Promise.resolve(true);
    };
    var tecla = function (e) { if (e.key === 'Escape' && !op.fijo && document.body.lastElementChild === m) cerrar(); };
    document.addEventListener('keydown', tecla);
    var bajo = false;
    m.addEventListener('pointerdown', function (e) { bajo = (e.target === m); });
    m.addEventListener('click', function (e) {
      if (e.target.closest('[data-cerrar]')) { cerrar(); return; }
      if (e.target === m && bajo && !op.fijo) cerrar();
      bajo = false;
    });
    m.cerrar = cerrar;
    m.q = function (s) { return m.querySelector(s); };
    return m;
  }
  function ocupado(m, btn, si) {
    m.__ocupado = !!si;
    if (btn) { btn.disabled = !!si; btn.classList.toggle('ica-ocupado', !!si); }
    m.classList.toggle('ica-modal--ocupado', !!si);
  }
  function confirmar(titulo, html, si, peligro) {
    return new Promise(function (res) {
      var m = modal({ titulo: titulo, icono: 'info', cuerpo: '<div class="ica-conf">' + html + '</div>',
        pie: '<button type="button" class="kit-btn" data-cerrar>Volver</button><button type="button" class="kit-btn ' + (peligro ? 'mas-btn-peligro' : 'kit-btn--marca') + '" data-si>' + esc(si || 'Sí, continuar') + '</button>',
        alCerrar: function () { res(false); } });
      m.q('[data-si]').addEventListener('click', function () { m.remove(); res(true); });
    });
  }

  /* ══════════════ pausar / reanudar / cancelar / reintentar ══════════════ */
  function cambiarEstado(c, accion, b) {
    var txt = { pausar: ['Pausar el envío', 'Los correos que faltan quedan esperando hasta que la reanudes.', 'Pausar'],
      reanudar: ['Reanudar el envío', 'La cola sigue con lo que falta en la próxima vuelta (cada 10 minutos).', 'Reanudar'],
      cancelar: ['Cancelar lo que falta', 'Los <b>' + num((c.n || {}).pend) + '</b> correos pendientes NO se enviarán. Lo ya enviado se conserva. No se puede deshacer.', 'Sí, cancelar'],
      reintentar: ['Reintentar los fallidos', 'Los <b>' + num((c.n || {}).fallo) + '</b> envíos que fallaron vuelven a la cola.', 'Reintentar'] }[accion];
    if (!txt) return;
    confirmar(txt[0], '<p>' + txt[1] + '</p>', txt[2], accion === 'cancelar').then(function (ok) {
      if (!ok) return;
      b.disabled = true; b.classList.add('ica-ocupado');
      var rid = nuevoRid();
      guardando(llamar('masestado', { id: c.id, accion: accion }, { post: true, rid: rid }), 'Guardando').then(function (d) {
        parchar(d.camp); sonar('success');
        aviso({ pausar: 'Envío pausado.', reanudar: 'Envío reanudado.', cancelar: 'Lo pendiente quedó cancelado.', reintentar: 'Los fallidos volvieron a la cola.' }[accion], 'ok');
        if (activa()) pintar(S.tipo);
      }, function (e) { aviso(e.message, 'aviso', 5000); b.disabled = false; b.classList.remove('ica-ocupado'); });
    });
  }
  function parchar(c) {
    if (!c || !S.camps) return;
    var i = -1; S.camps.forEach(function (x, k) { if (x.id === c.id) i = k; });
    if (i === -1) S.camps.unshift(c); else S.camps[i] = c;
  }

  /* ══════════════ Excel ══════════════ */
  var promX = null;
  function xlsx() {
    if (window.XLSX) return Promise.resolve(window.XLSX);
    if (promX) return promX;
    promX = new Promise(function (ok, mal) {
      var s = document.createElement('script'); s.src = LOCAL_XLSX; s.async = true;
      s.onload = function () { window.XLSX ? ok(window.XLSX) : mal(new Error('No cargó el lector de Excel.')); };
      s.onerror = function () { promX = null; mal(new Error('No cargó el lector de Excel. Recarga la app.')); };
      document.head.appendChild(s);
    });
    return promX;
  }
  var ultimo = null;
  function bajarBlob(blob, nombre) {
    if (ultimo) try { URL.revokeObjectURL(ultimo.url); } catch (e) {}
    ultimo = { url: URL.createObjectURL(blob), nombre: nombre };
    disparar();
  }
  function disparar() {
    if (!ultimo) return;
    var a = document.createElement('a'); a.href = ultimo.url; a.download = ultimo.nombre; a.rel = 'noopener';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  }
  function respaldo(cont) {
    if (!cont || !ultimo) return;
    var b = document.createElement('button'); b.type = 'button'; b.className = 'kit-btn mas-mini'; b.textContent = '¿No se descargó? Tócalo aquí';
    b.addEventListener('click', disparar);
    cont.appendChild(b);
  }
  /** Lee la plantilla (o el archivo del usuario): busca la hoja con NOMBRE + CORREO (+ FICHA). */
  function leerExcel(file, tipo) {
    return Promise.all([xlsx(), file.arrayBuffer()]).then(function (x) {
      var X = x[0], wb = X.read(x[1], { type: 'array', raw: false, cellText: true });
      var mejor = null;
      wb.SheetNames.forEach(function (n) {
        if (mejor) return;
        var filas = X.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: false, defval: '' });
        for (var h = 0; h < Math.min(8, filas.length); h++) {
          var c = columnas(filas[h]);
          if (c.nom >= 0 && c.cor >= 0 && (tipo !== 'PERS' || c.fic >= 0)) { mejor = { filas: filas, cab: h, c: c, hoja: n }; return; }
        }
      });
      if (!mejor) throw new Error(tipo === 'PERS' ? 'No encontré las columnas Nombres, NIT o cédula, Correo y Fichas catastrales. Descarga la plantilla y vuelve a intentarlo.'
        : 'No encontré las columnas Nombres y Correo. Descarga la plantilla y vuelve a intentarlo.');
      var out = [];
      for (var i = mejor.cab + 1; i < mejor.filas.length; i++) {
        var f = mejor.filas[i], v = function (k) { return mejor.c[k] >= 0 ? String(f[mejor.c[k]] == null ? '' : f[mejor.c[k]]).trim() : ''; };
        if (!v('nom') && !v('cor') && !v('fic')) continue;
        if (norm(v('nom')) === 'NOMBRE COMPLETO DEL CONTRIBUYENTE') continue;   /* la fila de ejemplo de la plantilla */
        out.push({ fila: i + 1, nom: v('nom'), doc: v('doc'), correos: v('cor'), fichas: v('fic') });
      }
      if (!out.length) throw new Error('La hoja «' + mejor.hoja + '» no trae filas con datos.');
      return { filas: out, hoja: mejor.hoja };
    });
  }
  function columnas(cab) {
    var c = { nom: -1, doc: -1, cor: -1, fic: -1 };
    (cab || []).forEach(function (t, i) {
      t = norm(t);
      if (c.nom < 0 && /NOMBRE|RAZON SOCIAL|CONTRIBUYENTE/.test(t)) c.nom = i;
      else if (c.doc < 0 && /NIT|CEDULA|DOCUMENTO|IDENTIFICACION/.test(t)) c.doc = i;
      else if (c.cor < 0 && /CORREO|E-?MAIL/.test(t)) c.cor = i;
      else if (c.fic < 0 && /FICHA/.test(t)) c.fic = i;
    });
    return c;
  }

  /* ══════════════ imagen (marketing): adjuntar, arrastrar o Ctrl+V ══════════════ */
  /** Se aliviana en el equipo (máx. 1200 px de ancho, JPEG): el correo pesa menos y llega mejor. */
  function prepararImagen(file) {
    return new Promise(function (ok, mal) {
      if (!file || !/^image\//.test(file.type)) { mal(new Error('El archivo no es una imagen.')); return; }
      var lector = new FileReader();
      lector.onload = function () {
        var img = new Image();
        img.onload = function () {
          var ancho = Math.min(1200, img.naturalWidth), alto = Math.round(img.naturalHeight * ancho / img.naturalWidth);
          var cv = document.createElement('canvas'); cv.width = ancho; cv.height = alto;
          var cx = cv.getContext('2d'); cx.fillStyle = '#fff'; cx.fillRect(0, 0, ancho, alto); cx.drawImage(img, 0, 0, ancho, alto);
          var dataUrl = cv.toDataURL('image/jpeg', 0.86);
          var nombre = String(file.name || 'imagen').replace(/\.[^.]+$/, '') + '.jpg';
          ok({ b64: dataUrl.split(',')[1], mime: 'image/jpeg', nombre: nombre === '.jpg' || nombre === 'image.jpg' ? 'Campana_Hacienda_Flandes.jpg' : nombre, url: dataUrl, w: ancho, h: alto,
            kb: Math.round(dataUrl.length * 0.75 / 1024) });
        };
        img.onerror = function () { mal(new Error('No se pudo leer la imagen.')); };
        img.src = lector.result;
      };
      lector.onerror = function () { mal(new Error('No se pudo leer el archivo.')); };
      lector.readAsDataURL(file);
    });
  }

  /* ══════════════ NUEVA CAMPAÑA (asistente de 3 pasos) ══════════════ */
  function abrirNueva(tipo) {
    if (!S.cfg) { aviso('Espera a que cargue la vista.', 'info'); return; }
    var cfg = {}; S.cfg.campos.forEach(function (x) { cfg[x.k] = x.v; });
    var W = { tipo: tipo, paso: 1, prep: null, img: null, origen: tipo === 'PERS' ? 'EXCEL' : 'BD', opciones: null, muestraI: 0, hechaPrueba: false };
    var pre = tipo === 'PERS' ? 'mas.pers.' : 'mas.mkt.';
    var m = modal({
      fijo: true, ancha: true, icono: tipo === 'PERS' ? 'documento' : 'megafono',
      titulo: 'Nueva campaña · ' + NOMBRE[tipo],
      sucio: function () { return !!W.prep && !W.creada; },
      cuerpo:
        '<ol class="mas-pasos"><li data-p="1" class="on">' + ico('persona', 16) + ' Destinatarios</li><li data-p="2">' + ico('sobre', 16) + ' Correo</li><li data-p="3">' + ico('ojo', 16) + ' Revisar y enviar</li></ol>' +
        /* ── paso 1 ── */
        '<section class="mas-paso" data-paso="1">' +
          (tipo === 'MKT' ? '<div class="ica-seg2 mas-origen" role="radiogroup"><button type="button" data-origen="BD" class="on">' + ico('base-datos', 18) + ' Desde BD Predial</button>' +
            '<button type="button" data-origen="EXCEL">' + ico('excel', 18) + ' Desde Excel</button></div>' : '') +
          '<div class="mas-excel"' + (tipo === 'MKT' ? ' hidden' : '') + '>' +
            '<ol class="ica-pasos"><li><b>Descarga la plantilla</b> y llénala: una fila por contribuyente con ' + (tipo === 'PERS' ? '<b>nombre, NIT o cédula, correo(s) y fichas</b>. La dirección y «en mora desde» de cada ficha salen de BD Predial; el número de oficio lo pone la app (consecutivo).' : '<b>nombre, NIT o cédula y correo(s)</b>.') +
              ' Si ya tienes el Excel con esas columnas (como «comunicaciones_persuasivas.xlsx»), súbelo tal cual.</li>' +
              '<li><b>Súbelo aquí.</b> La app revisa cada fila contra BD Predial antes de seguir.</li></ol>' +
            '<div class="ica-masiva-btns"><a class="kit-btn" href="plantillas/PLANTILLA_MASIVO_PREDIAL.xlsx" download>' + ico('descargar') + ' Descargar plantilla</a>' +
              '<label class="kit-btn kit-btn--marca ica-subir">' + ico('subir') + ' Subir Excel<input type="file" accept=".xlsx,.xls,.csv" hidden data-file></label></div>' +
          '</div>' +
          (tipo === 'MKT' ? '<div class="mas-bd">' +
            '<p class="ica-nota">Contribuyentes de BD Predial con correo válido, agrupados por documento (un correo por contribuyente). No salen los correos malos ni los que se dieron de baja.</p>' +
            '<div class="mas-filtros" data-filtros><div class="ica-cargando">Cargando los filtros…</div></div>' +
            '<div class="ica-masiva-btns"><button type="button" class="kit-btn kit-btn--marca" data-calcular>' + ico('filtro') + ' Calcular destinatarios</button></div>' +
          '</div>' : '') +
          '<div data-res></div>' +
        '</section>' +
        /* ── paso 2 ── */
        '<section class="mas-paso" data-paso="2" hidden>' +
          '<div class="ica-rej2">' +
            '<label class="ica-campo"><span class="ica-campo__t">Nombre de la campaña</span><input data-k="nombre" maxlength="80" placeholder="' + esc(NOMBRE[tipo] + ' · ' + fLarga(S.hoy)) + '"></label>' +
            '<label class="ica-campo"><span class="ica-campo__t">Fecha límite del beneficio</span><input type="date" data-k="fl" value="' + esc(cfg['mas.fechaLimite'] || '') + '"><small>Va en {{fechaLimite}}: «' + esc(fLarga(cfg['mas.fechaLimite'])) + '».</small></label>' +
          '</div>' +
          (tipo === 'MKT' ? '<div class="ica-campo"><span class="ica-campo__t">Imagen de la campaña</span>' +
            '<div class="ica-drop mas-drop" tabindex="0" data-drop><div data-img-vacio>' + ico('imagen', 28) + '<p><b>Adjunta, arrastra o pega (Ctrl+V)</b> la imagen. Va dentro del correo y como adjunto.</p>' +
              '<label class="kit-btn">' + ico('subir') + ' Adjuntar imagen<input type="file" accept="image/*" hidden data-imgfile></label></div>' +
              '<div data-img-lleno hidden><img alt="Imagen de la campaña" data-img-prev><p class="ica-nota" data-img-info></p><button type="button" class="kit-btn" data-img-quitar>' + ico('cerrar') + ' Cambiar imagen</button></div>' +
            '</div></div>' : '') +
          '<label class="ica-campo"><span class="ica-campo__t">Asunto</span><input data-k="asunto" maxlength="300" value="' + esc(cfg[pre + 'asunto'] || '') + '"></label>' +
          '<label class="ica-campo"><span class="ica-campo__t">Cuerpo del correo</span><textarea data-k="cuerpo" rows="12">' + esc(cfg[pre + 'cuerpo'] || '') + '</textarea>' +
            '<small>Marcadores: <code>{{nombre}} {{documento}} {{fechaLimite}}' + (tipo === 'PERS' ? ' {{numOficio}} {{textoFichas}} {{nFichas}}' : '') + '</code> · <b>**negrita**</b> · líneas que empiezan con «• » quedan en lista.' +
            (tipo === 'MKT' ? ' Al final va sola la línea para darse de baja.' : ' El PDF de la carta va adjunto.') + '</small></label>' +
          '<button type="button" class="kit-btn mas-mini" data-restaurar>' + ico('recargar') + ' Volver al texto sugerido</button>' +
        '</section>' +
        /* ── paso 3 ── */
        '<section class="mas-paso" data-paso="3" hidden>' +
          '<div class="mas-resumen" data-resumen></div>' +
          '<div class="mas-previa"><div class="mas-previa__barra"><button type="button" class="kit-btn mas-mini" data-ant>‹</button><span data-quien></span><button type="button" class="kit-btn mas-mini" data-sig>›</button>' +
            '<button type="button" class="kit-btn mas-mini" data-verpdf hidden>' + ico('pdf') + ' Ver la carta en PDF</button></div>' +
            '<p class="mas-previa__asunto" data-pasunto></p><iframe class="mas-previa__marco" data-marco title="Vista previa del correo" sandbox=""></iframe></div>' +
          '<div class="mas-prueba"><label class="ica-campo"><span class="ica-campo__t">Enviarme una prueba a</span><input type="email" data-prueba value="' + esc((S.yo && S.yo.correo) || '') + '"></label>' +
            '<button type="button" class="kit-btn" data-enviar-prueba>' + ico('enviar') + ' Enviar prueba</button></div>' +
        '</section>' +
        '<p class="ica-err" data-err hidden></p>',
      pie: '<button type="button" class="kit-btn" data-cerrar>Cancelar</button>' +
        '<button type="button" class="kit-btn" data-atras hidden>' + ico('atras') + ' Atrás</button>' +
        '<button type="button" class="kit-btn kit-btn--marca" data-seguir disabled>Seguir ' + ico('adelante') + '</button>' +
        '<button type="button" class="kit-btn kit-btn--marca" data-crear hidden>' + ico('cohete') + ' Poner en cola</button>'
    });
    var err = m.q('[data-err]');
    function falla(t) { err.hidden = !t; err.textContent = t || ''; if (t) sonar('error'); }
    function irA(p) {
      W.paso = p; falla('');
      m.querySelectorAll('.mas-paso').forEach(function (s) { s.hidden = Number(s.getAttribute('data-paso')) !== p; });
      m.querySelectorAll('.mas-pasos li').forEach(function (l) { var n = Number(l.getAttribute('data-p')); l.classList.toggle('on', n === p); l.classList.toggle('hecho', n < p); });
      m.q('[data-atras]').hidden = p === 1;
      m.q('[data-seguir]').hidden = p === 3;
      m.q('[data-crear]').hidden = p !== 3;
      m.q('[data-seguir]').disabled = p === 1 && !(W.prep && W.prep.conCorreo);
      if (p === 3) previa(0);
      try { m.q('.hf-modal__hoja').scrollTop = 0; } catch (e) {}
    }
    m.q('[data-atras]').addEventListener('click', function () { irA(W.paso - 1); });
    m.q('[data-seguir]').addEventListener('click', function () {
      if (W.paso === 1) { if (W.prep && W.prep.conCorreo) irA(2); return; }
      if (W.paso === 2) {
        var f = valores();
        if (!f.asunto || !f.cuerpo) { falla('Escribe el asunto y el cuerpo del correo.'); return; }
        if (!/^\d{4}-\d{2}-\d{2}$/.test(f.fl)) { falla('Elige la fecha límite del beneficio.'); return; }
        if (tipo === 'MKT' && !W.img) { falla('Adjunta la imagen de la campaña.'); return; }
        irA(3);
      }
    });
    function valores() {
      return { nombre: m.q('[data-k="nombre"]').value.trim(), asunto: m.q('[data-k="asunto"]').value.trim(),
        cuerpo: m.q('[data-k="cuerpo"]').value.replace(/\s+$/, ''), fl: m.q('[data-k="fl"]').value };
    }
    m.q('[data-restaurar]').addEventListener('click', function () {
      var d = {}; S.cfg.campos.forEach(function (x) { d[x.k] = x.v; });
      m.q('[data-k="asunto"]').value = d[pre + 'asunto'] || ''; m.q('[data-k="cuerpo"]').value = d[pre + 'cuerpo'] || '';
    });

    /* ── paso 1: origen ── */
    function ponerOrigen(o) {
      W.origen = o;
      m.querySelectorAll('[data-origen]').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-origen') === o); });
      var ex = m.q('.mas-excel'), bd = m.q('.mas-bd');
      if (ex) ex.hidden = o !== 'EXCEL';
      if (bd) bd.hidden = o !== 'BD';
      W.prep = null; W.prepP = null; m.q('[data-res]').innerHTML = ''; m.q('[data-seguir]').disabled = true;
      if (o === 'BD') filtrosBd();
    }
    m.querySelectorAll('[data-origen]').forEach(function (b) { b.addEventListener('click', function () { ponerOrigen(b.getAttribute('data-origen')); }); });
    if (tipo === 'MKT') filtrosBd();

    m.q('[data-file]').addEventListener('change', function () {
      var file = this.files[0]; this.value = '';
      if (!file) return;
      var res = m.q('[data-res]');
      res.innerHTML = '<div class="ica-cargando">' + ico('reloj', 16) + ' Leyendo ' + esc(file.name) + ' y revisando cada ficha contra BD Predial…</div>';
      m.q('[data-seguir]').disabled = true;
      var t0 = Date.now();
      leerExcel(file, tipo).then(function (x) {
        return llamar('masvalidar', { tipo: tipo, filas: x.filas }, { post: true }).then(function (d) {
          d.hoja = x.hoja; d.archivo = file.name; return d;
        });
      }).then(function (d) { W.prepP = null; W.prep = d; medir('validar:pantalla', t0); pintarPrep(d); },
        function (e) { res.innerHTML = '<p class="ica-err">' + esc(e.message) + '</p>'; sonar('error'); });
    });

    function filtrosBd() {
      var z = m.q('[data-filtros]'); if (!z) return;
      if (W.opciones) { pintarFiltros(z, W.opciones); return; }
      opciones().then(function (o) { W.opciones = o; pintarFiltros(z, o); },
        function (e) { z.innerHTML = '<p class="ica-err">' + esc(e.message) + '</p>'; });
    }
    function pintarFiltros(z, o) {
      var cl = o.clasif || {};
      z.innerHTML =
        '<p class="ica-nota">' + num(o.conCorreo) + ' de ' + num(o.total) + ' expedientes tienen correo.</p>' +
        '<div class="ica-campo"><span class="ica-campo__t">Clasificación (por valor de la deuda)</span><div class="ica-pills" data-clasif>' +
          ['ALTA', 'MEDIA', 'BAJA'].map(function (c) { return '<button type="button" class="proc-status-pill" data-c="' + c + '">' + c.charAt(0) + c.slice(1).toLowerCase() + '<span class="bit-num">' + num(cl[c]) + '</span></button>'; }).join('') +
        '</div><small>Sin marcar = todas.</small></div>' +
        '<div class="ica-rej2">' +
          '<label class="ica-campo"><span class="ica-campo__t">Valor de la deuda desde ($)</span><input inputmode="numeric" data-f="min" placeholder="0"></label>' +
          '<label class="ica-campo"><span class="ica-campo__t">Valor de la deuda hasta ($)</span><input inputmode="numeric" data-f="max" placeholder="Sin tope"></label>' +
          '<label class="ica-campo"><span class="ica-campo__t">En mora desde (año) o antes</span><input inputmode="numeric" maxlength="4" data-f="mora" placeholder="Ej.: 2022"></label>' +
          '<label class="ica-campo mas-chk"><input type="checkbox" data-f="deuda" checked> <span>Solo con deuda (valor mayor que cero)</span></label>' +
        '</div>' +
        lista('Estado del proceso', 'estados', o.estados) + lista('Actuación', 'actuaciones', o.actuaciones);
      z.querySelectorAll('[data-c]').forEach(function (b) { b.addEventListener('click', function () { b.classList.toggle('active'); }); });
      z.querySelectorAll('[data-f="min"],[data-f="max"]').forEach(function (i) {
        i.addEventListener('input', function () { var v = i.value.replace(/\D/g, ''); i.value = v ? Number(v).toLocaleString('es-CO') : ''; });
      });
      function lista(t, k, arr) {
        return '<details class="mas-multi"><summary>' + esc(t) + ' <span data-cuenta="' + k + '">(todos)</span></summary><div class="mas-multi__l">' +
          (arr || []).map(function (x) { return '<label><input type="checkbox" data-m="' + k + '" value="' + esc(x[0]) + '"> ' + esc(x[0]) + ' <small>(' + num(x[1]) + ')</small></label>'; }).join('') + '</div></details>';
      }
      z.addEventListener('change', function (e) {
        var c = e.target.closest('[data-m]'); if (!c) return;
        var k = c.getAttribute('data-m'), n = z.querySelectorAll('[data-m="' + k + '"]:checked').length;
        z.querySelector('[data-cuenta="' + k + '"]').textContent = n ? '(' + n + ')' : '(todos)';
      });
    }
    var calc = m.q('[data-calcular]');
    if (calc) calc.addEventListener('click', function () {
      var z = m.q('[data-filtros]'); if (!z || calc.disabled) return;
      var dig = function (s) { return Number(String((z.querySelector(s) || {}).value || '').replace(/\D/g, '')) || 0; };
      var f = {
        clasif: Array.prototype.map.call(z.querySelectorAll('[data-c].active'), function (b) { return b.getAttribute('data-c'); }),
        min: dig('[data-f="min"]'), max: dig('[data-f="max"]'), moraHasta: String((z.querySelector('[data-f="mora"]') || {}).value || '').replace(/\D/g, ''),
        soloDeuda: (z.querySelector('[data-f="deuda"]') || {}).checked ? 1 : 0,
        estados: Array.prototype.map.call(z.querySelectorAll('[data-m="estados"]:checked'), function (x) { return x.value; }),
        actuaciones: Array.prototype.map.call(z.querySelectorAll('[data-m="actuaciones"]:checked'), function (x) { return x.value; })
      };
      calc.disabled = true; calc.classList.add('ica-ocupado');
      var res = m.q('[data-res]'); res.innerHTML = '<div class="ica-cargando">' + ico('reloj', 16) + ' Buscando en BD Predial…</div>';
      var t0 = Date.now();
      /* 17/11 — un solo salto: HACIENDA da el resumen y la muestra al instante; ICA
         arma de fondo la lista de envío (quita los dados de baja) con la referencia. */
      W.prepP = null;
      /* respaldo: si HACIENDA aún no tiene la ruta (o ICA no tiene masbdref), el camino de antes */
      var viejo = function () { return llamar('masbd', { filtros: f }, { post: true }).then(function (d) { W.prepP = null; d.__viejo = 1; return d; }); };
      llamar('masdestinos', { f: JSON.stringify(f) }, { hac: true }).catch(function (e) {
        if (/acci[oó]n( get)? no v[aá]lida/i.test(e.message || '') || e.codigo === 'ACCION') return viejo();
        throw e;
      }).then(function (d) {
        if (d.__viejo) { W.prep = d; W.filtros = f; medir('masbd:pantalla', t0); pintarPrep(d); return; }
        W.prep = d; W.filtros = f; medir('masdestinos:pantalla', t0); pintarPrep(d);
        if (!d.conCorreo) return;
        var p = W.prepP = llamar('masbdref', { ref: d.ref }, { post: true }).catch(function (e) {
          /* ruta aún no desplegada, o la referencia no llegó a la caché de HACIENDA: el camino de antes */
          if (/acci[oó]n( get)? no v[aá]lida/i.test(e.message || '') || e.codigo === 'ACCION' || e.codigo === 'PREP_VENCIDA') return llamar('masbd', { filtros: f }, { post: true });
          throw e;
        }).then(function (r) {
          if (W.prepP !== p) return W.prep;
          W.prep = r; medir('masbdref:fondo', t0);
          if (r.conCorreo !== d.conCorreo || r.bajas) pintarPrep(r, true);
          return r;
        });
        p.catch(function () {});
      }, function (e) { res.innerHTML = '<p class="ica-err">' + esc(e.message) + '</p>'; sonar('error'); })
        .then(function () { calc.disabled = false; calc.classList.remove('ica-ocupado'); });
    });

    /* La lista de envío lista en ICA (con la búsqueda de BD Predial llega de fondo). */
    function listo() {
      if (W.prep && W.prep.prep) return Promise.resolve(W.prep);
      if (W.prepP) return W.prepP.then(function (r) { if (r && r.prep) return r; throw error('PREP', 'Vuelve a buscar los destinatarios.'); });
      return Promise.reject(error('PREP', 'Vuelve a buscar los destinatarios.'));
    }
    function pintarPrep(d, callado) {
      var malos = (d.errores || []).filter(function (x) { return !x.aviso; }).length;
      var avisos = (d.errores || []).length - malos;
      m.q('[data-res]').innerHTML =
        '<div class="ica-masiva-res">' +
          '<div class="ica-kpi ica-kpi--ok">' + ico('check', 18) + '<b>' + num(d.conCorreo) + '</b><span>' + (tipo === 'PERS' ? 'cartas listas para enviar' : 'correos listos para enviar') + '</span></div>' +
          (tipo === 'PERS' ? '<div class="ica-kpi">' + ico('mapa', 18) + '<b>' + num(d.fichas) + '</b><span>fichas completadas con BD Predial</span></div>' : '') +
          (d.sinCorreo ? '<div class="ica-kpi ica-kpi--aviso">' + ico('cerrar', 18) + '<b>' + num(d.sinCorreo) + '</b><span>sin correo válido (quedan omitidos)</span></div>' : '') +
          (malos ? '<div class="ica-kpi ica-kpi--malo">' + ico('aviso', 18) + '<b>' + num(malos) + '</b><span>filas que no se incluyen</span></div>' : '') +
          (d.origen === 'BD' ? '<div class="ica-kpi">' + ico('base-datos', 18) + '<b>' + num(d.filasBd) + '</b><span>expedientes cumplen los filtros' + (d.sinCorreoBd ? ' (' + num(d.sinCorreoBd) + ' sin correo útil)' : '') + '</span></div>' : '') +
        '</div>' +
        (d.archivo ? '<p class="ica-nota">' + ico('excel', 14) + ' ' + esc(d.archivo) + ' · hoja «' + esc(d.hoja) + '»' + (avisos ? ' · ' + num(avisos) + ' fila(s) con avisos (sí se incluyen)' : '') + '</p>' : '') +
        ((d.errores || []).length ? '<details class="mas-errores"' + (malos ? ' open' : '') + '><summary>Revisar ' + num(d.nErrores) + ' fila(s) con observaciones</summary><div class="ica-tabla"><table><thead><tr><th>Fila</th><th>Contribuyente</th><th>Qué pasa</th></tr></thead><tbody>' +
          d.errores.map(function (x) { return '<tr class="' + (x.aviso ? '' : 'mas-mal') + '"><td>' + esc(x.fila) + '</td><td>' + esc(x.nom) + '</td><td>' + esc(x.error) + '</td></tr>'; }).join('') +
          '</tbody></table></div></details>' : '') +
        ((d.muestra || []).length ? '<div class="ica-tabla mas-muestra"><table><thead><tr><th>Contribuyente</th><th>Correo(s)</th>' + (tipo === 'PERS' ? '<th>Fichas (dirección · en mora desde)</th>' : '<th>Fichas</th>') + '</tr></thead><tbody>' +
          d.muestra.map(function (x) {
            return '<tr><td><b>' + esc(x.nom) + '</b><br><small>' + esc(x.doc) + '</small></td><td>' + esc(x.correos.join(', ')) + (x.omit && x.omit.length ? '<br><small class="mas-mal">' + esc(x.omit.join(' · ')) + '</small>' : '') + '</td><td>' +
              x.fichas.map(function (f) { return esc(f[0]) + (tipo === 'PERS' ? ' · ' + esc(f[1] || '—') + ' · ' + esc(desde(f[2])) : ''); }).join('<br>') + (x.nf > x.fichas.length ? '<br><small>y ' + (x.nf - x.fichas.length) + ' más</small>' : '') + '</td></tr>';
          }).join('') + '</tbody></table><p class="ica-nota">Muestra de los primeros ' + d.muestra.length + '.</p></div>' : '');
      m.q('[data-seguir]').disabled = !d.conCorreo;
      if (!d.conCorreo) falla('Ningún destinatario tiene un correo válido.'); else { falla(''); if (!callado) sonar('success'); }
    }

    /* ── paso 2: imagen ── */
    if (tipo === 'MKT') {
      var drop = m.q('[data-drop]');
      var tomar = function (file) {
        prepararImagen(file).then(function (im) {
          W.img = im;
          m.q('[data-img-vacio]').hidden = true; m.q('[data-img-lleno]').hidden = false;
          m.q('[data-img-prev]').src = im.url;
          m.q('[data-img-info]').textContent = im.w + ' × ' + im.h + ' px · ' + im.kb + ' KB (aligerada para el correo)';
          drop.classList.add('ica-drop--lleno'); falla('');
        }, function (e) { falla(e.message); });
      };
      m.q('[data-imgfile]').addEventListener('change', function () { var f = this.files[0]; this.value = ''; if (f) tomar(f); });
      m.q('[data-img-quitar]').addEventListener('click', function () {
        W.img = null; m.q('[data-img-vacio]').hidden = false; m.q('[data-img-lleno]').hidden = true; drop.classList.remove('ica-drop--lleno');
      });
      ['dragenter', 'dragover'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('ica-drop--sobre'); }); });
      ['dragleave', 'drop'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove('ica-drop--sobre'); }); });
      drop.addEventListener('drop', function (e) { var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]; if (f) tomar(f); });
      var pegar = function (e) {
        if (W.paso !== 2 || !document.body.contains(m)) return;
        var it = Array.prototype.filter.call((e.clipboardData && e.clipboardData.items) || [], function (x) { return /^image\//.test(x.type); })[0];
        if (it) { e.preventDefault(); tomar(it.getAsFile()); }
      };
      document.addEventListener('paste', pegar);
      var obs = new MutationObserver(function () { if (!document.body.contains(m)) { document.removeEventListener('paste', pegar); obs.disconnect(); } });
      obs.observe(document.body, { childList: true });
    }

    /* ── paso 3: vista previa con contribuyentes reales ── */
    var pdfActual = null;
    function previa(i) {
      if (!(W.prep && W.prep.prep)) {
        m.q('[data-pasunto]').textContent = 'Terminando de preparar la lista…';
        listo().then(function () { previa(i); }, function (e) { m.q('[data-pasunto]').innerHTML = '<span class="mas-mal">' + esc(e.message) + '</span>'; });
        return;
      }
      var muestra = (W.prep && W.prep.muestra) || [];
      if (!muestra.length) return;
      W.muestraI = (i + muestra.length) % muestra.length;
      var x = muestra[W.muestraI];
      var f = valores();
      m.q('[data-quien]').innerHTML = '<b>' + esc(x.nom) + '</b> · ' + (W.muestraI + 1) + ' de ' + muestra.length;
      m.q('[data-pasunto]').textContent = 'Armando la vista previa…';
      m.q('[data-verpdf]').hidden = true; pdfActual = null;
      var marco = m.q('[data-marco]');
      marco.srcdoc = '<p style="font:14px Arial;color:#667">Armando la vista previa con los datos reales…</p>';
      var n = W.prep.conCorreo, cu = S.cuota || {};
      var horas = n / Math.max(1, cu.ritmo || 350), dias = Math.ceil(n / Math.max(1, cu.tope || 1500));
      m.q('[data-resumen]').innerHTML = '<p>' + ico('cohete', 16) + ' Se pondrán en cola <b>' + num(n) + '</b> ' + (tipo === 'PERS' ? 'cartas' : 'correos') +
        ' desde <b>cobrocoactivo@flandes-tolima.gov.co</b>. Salen solas al ritmo de <b>' + num(cu.ritmo) + '</b> por hora (≈ ' + (horas < 1 ? Math.max(10, Math.round(horas * 60)) + ' min' : (Math.round(horas * 10) / 10).toString().replace('.', ',') + ' h') + ')' +
        (dias > 1 ? ', en unos <b>' + dias + ' días</b> por el tope de ' + num(cu.tope) + ' destinatarios en 24 h' : '') + '. Puedes pausar o cancelar cuando quieras.</p>' +
        (tipo === 'PERS' ? '<p class="ica-nota">Oficios desde el No. <b>' + esc(oficioDesde()) + '</b> (consecutivo automático). Cada envío queda en la bitácora del expediente y el PDF en su detalle.</p>' : '');
      var t0 = Date.now();
      var cuerpo = { tipo: tipo, prep: W.prep.prep, i: x.i, asunto: f.asunto, cuerpo: f.cuerpo, fechaLimite: f.fl };
      if (tipo === 'MKT' && W.img) cuerpo.img = { b64: '', mime: W.img.mime, nombre: W.img.nombre };   /* la imagen ya está en el equipo: no viaja para la vista previa */
      llamar('masprevia', cuerpo, { post: true }).then(function (d) {
        if (W.muestraI !== x.i && muestra[W.muestraI] !== x) return;
        medir('previa:pantalla', t0);
        m.q('[data-pasunto]').innerHTML = '<b>Asunto:</b> ' + esc(d.asunto) + '<br><b>Para:</b> ' + esc((d.para || []).join(', ')) + (d.omit && d.omit.length ? ' <small class="mas-mal">(no se usan: ' + esc(d.omit.join(' · ')) + ')</small>' : '');
        var html = d.html;
        if (tipo === 'MKT' && W.img) html = html.replace('<div style="border:1px solid #d6dfda;border-top:0;padding:20px 18px;border-radius:0 0 8px 8px">',
          '<div style="border:1px solid #d6dfda;border-top:0;padding:20px 18px;border-radius:0 0 8px 8px"><p style="margin:0 0 16px;text-align:center"><img src="' + W.img.url + '" style="max-width:100%;width:560px;height:auto;border-radius:6px"></p>');
        marco.srcdoc = '<!DOCTYPE html><html><head><meta charset="utf-8"><base target="_blank"></head><body style="margin:12px;background:#fff">' + html + '</body></html>';
        if (d.pdf && d.pdf.b64) { pdfActual = d.pdf; m.q('[data-verpdf]').hidden = false; }
      }, function (e) { m.q('[data-pasunto]').innerHTML = '<span class="mas-mal">' + esc(e.message) + '</span>'; marco.srcdoc = ''; });
    }
    function oficioDesde() {
      var o = (S.cfg && S.cfg.of) || {}; var t = String(o.sig || 1); while (t.length < (o.ancho || 4)) t = '0' + t; return (o.pre || '') + t;
    }
    m.q('[data-ant]').addEventListener('click', function () { previa(W.muestraI - 1); });
    m.q('[data-sig]').addEventListener('click', function () { previa(W.muestraI + 1); });
    m.q('[data-verpdf]').addEventListener('click', function () {
      if (!pdfActual) return;
      if (window.VISOR && window.VISOR.lista) {
        window.VISOR.lista([{ id: 'mas-previa', titulo: pdfActual.nombre, mime: 'application/pdf', detalle: 'Vista previa · datos reales' }], {
          indice: 0, fuente: function () { return Promise.resolve({ nombre: pdfActual.nombre, mime: 'application/pdf', b64: pdfActual.b64 }); } });
      } else {
        var bin = atob(pdfActual.b64), u8 = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
        window.open(URL.createObjectURL(new Blob([u8], { type: 'application/pdf' })), '_blank', 'noopener');
      }
    });
    m.q('[data-enviar-prueba]').addEventListener('click', function () {
      var b = this; if (m.__ocupado) return;
      var para = m.q('[data-prueba]').value.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(para)) { falla('Escribe un correo válido para la prueba.'); return; }
      var f = valores();
      ocupado(m, b, true); falla('');
      var t0 = Date.now(), rid = nuevoRid();
      guardando(listo().then(function () {
        var x = W.prep.muestra[W.muestraI] || W.prep.muestra[0];
        var cuerpo = { tipo: tipo, prep: W.prep.prep, i: x.i, asunto: f.asunto, cuerpo: f.cuerpo, fechaLimite: f.fl, para: para };
        if (tipo === 'MKT') cuerpo.img = { b64: W.img.b64, mime: W.img.mime, nombre: W.img.nombre };
        return llamar('masprueba', cuerpo, { post: true, rid: rid });
      }), 'Enviando la prueba').then(function (d) {
        ocupado(m, b, false); W.hechaPrueba = true; medir('prueba:pantalla', t0); sonar('success');
        aviso('Prueba enviada a ' + d.para + ' con los datos de ' + d.nom + '. Revisa tu bandeja (y spam).', 'ok', 6000);
      }, function (e) { ocupado(m, b, false); falla(e.message); });
    });

    /* ── poner en cola ── */
    m.q('[data-crear]').addEventListener('click', function () {
      var b = this; if (m.__ocupado) return;
      var f = valores();
      var n = W.prep.conCorreo;
      confirmar('Poner en cola', '<p>Se enviarán <b>' + num(n) + '</b> ' + (tipo === 'PERS' ? 'cartas' : 'correos') + ' desde cobrocoactivo@flandes-tolima.gov.co.</p>' +
        (W.hechaPrueba ? '' : '<p class="mas-mal">Aún no te enviaste una prueba. Te recomendamos revisarla antes.</p>') +
        '<p>La cola empieza en la próxima vuelta (máximo 10 minutos) y la puedes pausar o cancelar en cualquier momento.</p>', 'Sí, poner en cola').then(function (ok) {
        if (!ok) return;
        ocupado(m, b, true); falla('');
        var rid = b.__rid || (b.__rid = nuevoRid());
        var t0 = Date.now();
        guardando(listo().then(function () {
          var cuerpo = { tipo: tipo, prep: W.prep.prep, nombre: f.nombre, asunto: f.asunto, cuerpo: f.cuerpo, fechaLimite: f.fl };
          if (tipo === 'MKT') cuerpo.img = { b64: W.img.b64, mime: W.img.mime, nombre: W.img.nombre };
          return llamar('mascrear', cuerpo, { post: true, rid: rid });
        }), 'Poniendo la campaña en cola').then(function (d) {
          W.creada = true; ocupado(m, b, false); medir('crear:pantalla', t0);
          parchar(d.camp); if (d.cuota) S.cuota = d.cuota;
          if (tipo === 'PERS') { try { S.cfg.of.sig = Number(S.cfg.of.sig || 1) + n; } catch (e) {} }
          m.cerrar(true); sonar('success');
          aviso('Campaña en cola: ' + num(n) + ' ' + (tipo === 'PERS' ? 'cartas' : 'correos') + '. Empieza en la próxima vuelta (≤ 10 min).', 'ok', 6000);
          if (activa(tipo)) pintar(tipo);
          sondear();
        }, function (e) { ocupado(m, b, false); if (e.codigo !== 'RED') b.__rid = null; falla(e.message); });
      });
    });
    irA(1);
  }
  function desde(v) {
    var x = String(v || '').match(/^(\d{4})(\d{2})$/);
    if (x && +x[2] >= 1 && +x[2] <= 12) { var t = MESES[+x[2] - 1]; return t.charAt(0).toUpperCase() + t.slice(1) + ' de ' + x[1]; }
    return String(v || '—');
  }
  function medir(r, t0) { try { window.__masMed.push({ ruta: r, ms: Date.now() - t0 }); } catch (e) {} }

  /* ══════════════ DETALLE: destinatarios por páginas ══════════════ */
  var FILTROS = [['TODOS', 'Todos', 't'], ['ENVIADO', 'Enviados', 'env'], ['PEND', 'Pendientes', 'pend'], ['FALLO', 'Fallidos', 'fallo'], ['OMITIDO', 'Omitidos', 'omit'],
    ['REB', 'Rebotaron', 'reb'], ['RESP', 'Respondieron', 'resp'], ['CANCELADO', 'Cancelados', 'canc']];
  function abrirDetalle(c) {
    var D = { f: 'TODOS', q: '', pag: 0, filas: [], total: 0, ctrl: null };
    var n = c.n || {};
    var m = modal({ titulo: c.nom, icono: 'persona', ancha: true,
      cuerpo: '<p class="ica-nota">' + esc(c.asunto) + '</p>' +
        '<div class="ica-pills" data-pills>' + FILTROS.filter(function (x) { return x[0] === 'TODOS' || n[x[2]]; }).map(function (x) {
          return '<button type="button" class="proc-status-pill' + (x[0] === 'TODOS' ? ' active' : '') + '" data-f="' + x[0] + '">' + esc(x[1]) + '<span class="bit-num">' + num(x[0] === 'TODOS' ? (n.t || c.total) : n[x[2]]) + '</span></button>';
        }).join('') + '</div>' +
        '<label class="hf-buscar mas-buscar"><i class="hi" data-ico="buscar"></i><input type="search" data-q placeholder="Buscar por nombre, NIT/CC, correo, oficio o ficha…"></label>' +
        '<div class="ica-tabla mas-dest" data-tabla><div class="ica-cargando">Cargando…</div></div>' +
        '<div class="ica-mas"><button type="button" class="kit-btn" data-mas-pag hidden>Ver más</button></div>',
      pie: '<button type="button" class="kit-btn" data-informe>' + ico('excel') + ' Informe en Excel</button><button type="button" class="kit-btn kit-btn--marca" data-cerrar>Cerrar</button>',
      alCerrar: function () { try { if (D.ctrl) D.ctrl.abort(); } catch (e) {} }
    });
    try { if (K.piezas && K.piezas.iconos) K.piezas.iconos.pintar(m); } catch (e) {}
    function traer(mas) {
      try { if (D.ctrl) D.ctrl.abort(); } catch (e) {}
      D.ctrl = (typeof AbortController === 'function') ? new AbortController() : null;
      if (!mas) { D.pag = 0; D.filas = []; m.q('[data-tabla]').innerHTML = '<div class="ica-cargando">Cargando…</div>'; }
      llamar('masdest', { id: c.id, f: D.f, q: D.q, pag: D.pag, tam: 200 }, { signal: D.ctrl && D.ctrl.signal }).then(function (d) {
        var o = d.filas.map(function (f) { var x = {}; d.campos.forEach(function (k, i) { x[k] = f[i]; }); return x; });
        D.filas = D.filas.concat(o); D.total = d.total;
        pintarTabla();
      }, function (e) { if (!cancelada(e)) m.q('[data-tabla]').innerHTML = '<p class="ica-err">' + esc(e.message) + '</p>'; });
    }
    function pintarTabla() {
      var t = m.q('[data-tabla]');
      if (!D.filas.length) { t.innerHTML = '<div class="ica-vacio">' + ico('buscar', 24) + '<p>No hay destinatarios con este filtro.</p></div>'; m.q('[data-mas-pag]').hidden = true; return; }
      t.innerHTML = '<table><thead><tr>' + (c.tipo === 'PERS' ? '<th>Oficio</th>' : '') + '<th>Contribuyente</th><th>Correo(s)</th><th>Estado</th><th></th></tr></thead><tbody>' +
        D.filas.map(function (x) {
          var est = DEST_EST[x.est] || x.est;
          var det = [];
          if (x.f) det.push(fCorta(x.f));
          if (x.reb) det.push('Rebotó: ' + x.reb);
          if (x.resp) det.push('Respondió ' + fCorta(x.resp) + (x.de ? ' (' + x.de + ')' : ''));
          if (x.err && x.est !== 'ENVIADO') det.push(x.err);
          if (x.omit) det.push('No se usó: ' + x.omit);
          return '<tr class="mas-dest--' + esc(x.est) + (x.reb ? ' mas-dest--reb' : '') + '">' + (c.tipo === 'PERS' ? '<td>' + esc(x.of) + '</td>' : '') +
            '<td><b>' + esc(x.nom) + '</b><br><small>' + esc(x.doc) + (x.fichas ? ' · ' + esc(String(x.fichas).split(', ').length === 1 ? 'Ficha ' + x.fichas : String(x.fichas).split(', ').length + ' fichas') : '') + '</small></td>' +
            '<td>' + esc(String(x.correos || '').split(',').join(', ')) + '</td>' +
            '<td><span class="mas-dest__est">' + esc(est) + '</span><br><small>' + esc(det.join(' · ')) + '</small></td>' +
            '<td>' + (x.pdf ? '<button type="button" class="bdp-icon-btn" data-pdf="' + esc(x.n) + '" title="Ver la carta enviada">' + ico('pdf', 18) + '</button>' : '') + '</td></tr>';
        }).join('') + '</tbody></table>';
      var b = m.q('[data-mas-pag]'); b.hidden = D.filas.length >= D.total; b.textContent = 'Ver más (' + num(D.total - D.filas.length) + ')';
    }
    m.q('[data-pills]').addEventListener('click', function (e) {
      var b = e.target.closest('[data-f]'); if (!b) return;
      m.querySelectorAll('[data-pills] [data-f]').forEach(function (x) { x.classList.toggle('active', x === b); });
      D.f = b.getAttribute('data-f'); sonar('menu'); traer(false);
    });
    var tq = null;
    m.q('[data-q]').addEventListener('input', function (e) { clearTimeout(tq); var v = e.target.value.trim(); tq = setTimeout(function () { D.q = v; traer(false); }, 350); });
    m.q('[data-mas-pag]').addEventListener('click', function () { D.pag++; traer(true); });
    m.q('[data-tabla]').addEventListener('click', function (e) {
      var b = e.target.closest('[data-pdf]'); if (!b) return;
      var nn = b.getAttribute('data-pdf');
      var x = D.filas.filter(function (y) { return String(y.n) === nn; })[0] || {};
      verPdf({ id: 'mas-' + c.id + '-' + nn, titulo: 'Oficio ' + (x.of || '') + ' · ' + (x.nom || ''), fuente: function () { return llamar('masarchivo', { id: c.id, n: nn }); } });
    });
    m.q('[data-informe]').addEventListener('click', function () { informe(c, this); });
    traer(false);
  }
  function verPdf(o) {
    if (!window.VISOR || !window.VISOR.lista) { aviso('El visor no cargó. Recarga la app.', 'aviso'); return; }
    window.VISOR.lista([{ id: o.id, titulo: o.titulo + '.pdf', mime: 'application/pdf', detalle: 'Comunicación persuasiva' }], {
      indice: 0,
      fuente: function () { return o.fuente().then(function (x) { if (x && x.b64) return { nombre: x.nombre, mime: x.mime, b64: x.b64 }; throw new Error('No se pudo abrir el PDF.'); }); }
    });
  }

  /* ══════════════ INFORME (Excel armado en el equipo) ══════════════ */
  function informe(c, b) {
    if (b.disabled) return;
    b.disabled = true; b.classList.add('ica-ocupado');
    var t0 = Date.now(), filas = [], pag = 0;
    function pagina() {
      return llamar('masdest', { id: c.id, f: 'TODOS', pag: pag, tam: 500 }).then(function (d) {
        d.filas.forEach(function (f) { var x = {}; d.campos.forEach(function (k, i) { x[k] = f[i]; }); filas.push(x); });
        if (filas.length < d.total && d.filas.length) { pag++; return pagina(); }
      });
    }
    Promise.all([xlsx(), pagina()]).then(function (r) {
      var X = r[0], n = c.n || {};
      var res = [['INFORME DE MASIFICACIÓN MAIL · SECRETARÍA DE HACIENDA DE FLANDES'], [],
        ['Campaña', c.nom], ['Tipo', NOMBRE[c.tipo]], ['Estado', (ESTADOS[c.est] || [c.est])[0]], ['Creada', fCorta(c.cre) + ' · ' + c.por],
        ['Inicio del envío', fCorta(c.ini)], ['Fin del envío', fCorta(c.fin)], ['Asunto', c.asunto], ['Remitente', 'cobrocoactivo@flandes-tolima.gov.co'],
        c.of ? ['Oficios', c.of] : ['', ''], ['Beneficio hasta', fLarga(c.fl)], [],
        ['Destinatarios', n.t || c.total], ['Enviados', n.env || 0], ['Pendientes', n.pend || 0], ['Fallidos', n.fallo || 0], ['Omitidos (sin correo)', n.omit || 0],
        ['Cancelados', n.canc || 0], ['Rebotaron', n.reb || 0], ['Respondieron', n.resp || 0], [], ['Generado', new Date().toLocaleString('es-CO')]];
      var cab = (c.tipo === 'PERS' ? ['OFICIO'] : []).concat(['CONTRIBUYENTE', 'NIT / CC', 'CORREOS', 'FICHAS', 'ESTADO', 'FECHA DE ENVÍO', 'REBOTÓ (CORREOS MALOS)', 'RESPONDIÓ', 'RESPONDIÓ DESDE', 'OBSERVACIÓN']);
      var det = filas.map(function (x) {
        return (c.tipo === 'PERS' ? [x.of] : []).concat([x.nom, x.doc, String(x.correos || '').split(',').join(', '), x.fichas, DEST_EST[x.est] || x.est, fCorta(x.f), x.reb, fCorta(x.resp), x.de,
          [x.est !== 'ENVIADO' ? x.err : '', x.omit ? 'No se usó: ' + x.omit : ''].filter(String).join(' · ')]);
      });
      var wb = X.utils.book_new();
      var h1 = X.utils.aoa_to_sheet(res); h1['!cols'] = [{ wch: 24 }, { wch: 70 }];
      var h2 = X.utils.aoa_to_sheet([cab].concat(det));
      h2['!cols'] = cab.map(function (t, i) { var mx = t.length; det.slice(0, 200).forEach(function (f) { mx = Math.max(mx, String(f[i] == null ? '' : f[i]).length); }); return { wch: Math.min(Math.max(mx + 2, 10), 50) }; });
      h2['!autofilter'] = { ref: X.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: det.length, c: cab.length - 1 } }) };
      X.utils.book_append_sheet(wb, h1, 'RESUMEN');
      X.utils.book_append_sheet(wb, h2, 'DESTINATARIOS');
      var buf = X.write(wb, { bookType: 'xlsx', type: 'array' });
      var nombre = ('Informe ' + c.nom).replace(/[\\/:*?"<>|]/g, ' ').slice(0, 90) + ' ' + new Date().toISOString().slice(0, 10) + '.xlsx';
      bajarBlob(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), nombre);
      medir('informe:pantalla', t0);
      aviso('Informe listo: ' + num(filas.length) + ' destinatarios.', 'ok', 4000);
      var cont = b.closest('.hf-modal__pie') || b.parentNode; if (cont && !cont.querySelector('.mas-mini')) respaldo(cont);
    }, function (e) { aviso((e && e.message) || 'No se pudo armar el informe.', 'aviso', 6000); })
      .then(function () { b.disabled = false; b.classList.remove('ica-ocupado'); });
  }

  /* ══════════════ CONFIGURACIÓN ══════════════ */
  function abrirConfig(tipo) {
    var c = S.cfg;
    if (!c) { aviso('Espera a que cargue la vista.', 'info'); return; }
    var propios = tipo === 'PERS' ? /^mas\.(pers|fechaLimite|plantilla|of|ritmo|tope)/ : /^mas\.(mkt|fechaLimite|baja|ritmo|tope)/;
    var campos = c.campos.filter(function (x) { return propios.test(x.k); });
    var m = modal({ fijo: true, ancha: true, icono: 'engranaje', titulo: 'Configuración · ' + NOMBRE[tipo],
      cuerpo: (tipo === 'PERS' ? '<div class="ica-cfg-plant"><button type="button" class="kit-btn" data-plant' + (c.plantilla ? '' : ' disabled') + '>' + ico('documento') + ' Ir a la plantilla de la carta</button></div>' +
          '<p class="ica-nota">Marcadores de la plantilla: <code>{{fecha}} {{numOficio}} {{nombre}} {{documento}} {{correo}} {{refFichas}} {{textoMora}} {{fechaLimite}}</code> y en la fila de la tabla <code>{{ficha}} {{direccionFicha}} {{moraDesde}}</code> (la fila se repite sola por cada ficha).</p>' : '') +
        '<p class="ica-nota">El asunto y el cuerpo de aquí son el texto sugerido de cada campaña nueva; en cada campaña se pueden ajustar.' + (c.jefe ? '' : ' Plantilla, ritmo, tope y oficio los cambian ADMIN o DEV.') + '</p>' +
        campos.map(function (x) {
          var inp = x.largo ? '<textarea rows="10" data-k="' + esc(x.k) + '">' + esc(x.v) + '</textarea>' :
            (x.k === 'mas.fechaLimite' ? '<input type="date" data-k="' + esc(x.k) + '" value="' + esc(x.v) + '">' :
              '<input data-k="' + esc(x.k) + '" value="' + esc(x.v) + '"' + (x.tipo === 'numero' ? ' type="number" min="0"' : '') + (x.bloq ? ' disabled' : '') + '>');
          return '<label class="ica-campo' + (x.bloq ? ' ica-campo--bloq' : '') + '"><span class="ica-campo__t">' + esc(x.t) + (x.bloq ? ' <span class="ica-opc">· ADMIN o DEV</span>' : '') + '</span>' + inp + '</label>';
        }).join('') + '<p class="ica-err" data-err hidden></p>',
      pie: '<button type="button" class="kit-btn" data-cerrar>Cerrar</button><button type="button" class="kit-btn kit-btn--marca" data-guardar>' + ico('check') + ' Guardar cambios</button>'
    });
    var pl = m.q('[data-plant]');
    if (pl) pl.addEventListener('click', function () { window.open('https://docs.google.com/document/d/' + c.plantilla + '/edit', '_blank', 'noopener'); });
    m.q('[data-guardar]').addEventListener('click', function () {
      var btn = this, cambios = {}, n = 0;
      campos.forEach(function (x) { if (x.bloq) return; var el = m.q('[data-k="' + x.k + '"]'); if (el && String(el.value) !== String(x.v)) { cambios[x.k] = el.value; n++; } });
      if (!n) { m.cerrar(); return; }
      ocupado(m, btn, true);
      var rid = btn.__rid || (btn.__rid = nuevoRid());
      guardando(llamar('mascfg', { cambios: cambios }, { post: true, rid: rid }), 'Guardando configuración').then(function (cfg) {
        S.cfg = cfg; ocupado(m, btn, false); m.cerrar(true); sonar('success'); aviso('Configuración guardada.', 'ok');
        if (cambios['mas.ritmo'] || cambios['mas.tope']) refrescar();
      }, function (e) { ocupado(m, btn, false); if (e.codigo !== 'RED') btn.__rid = null; var er = m.q('[data-err]'); er.hidden = false; er.textContent = e.message; });
    });
  }

  /* ══════════════ BD Predial: correo malo y comunicaciones persuasivas del expediente ══════════════ */
  function arDe(row) {
    var t = String((row && row.notificacion) || '').trim();
    if (!t) return null;
    if (row.__masTxt === t) return row.__mas;
    var o = null; try { o = JSON.parse(t); } catch (e) { o = null; }
    row.__masTxt = t; row.__mas = o;
    return o;
  }
  /** Correos marcados como malos (rebote) que siguen escritos en el expediente. */
  function malos(row) {
    var o = arDe(row); if (!o || !Array.isArray(o.cm) || !o.cm.length) return [];
    var hoy = String(row.correo_electronico || '').toLowerCase();
    return o.cm.map(function (x) { return String(x.c || '').toLowerCase(); }).filter(function (c) { return c && hoy.indexOf(c) !== -1; });
  }
  function chipBd(row) {
    var ml = malos(row);
    return ml.length ? '<div class="ntf-linea"><span class="ntf-chip ntf-chip--reb" title="Rebotó: ' + esc(ml.join(', ')) + ' · corrígelo en Editar">' + ico('aviso', 14) + ' Correo malo</span></div>' : '';
  }
  function detalleBd(row, cont) {
    if (!cont) return;
    var o = arDe(row) || {};
    var cp = Array.isArray(o.cp) ? o.cp : [], ml = malos(row);
    if (!cp.length && !ml.length) return;
    var w = document.createElement('div');
    w.className = 'bdp-det-section mas-det';
    w.innerHTML = '<div class="bdp-det-section-title">' + ico('documento', 18) + ' Comunicaciones persuasivas</div>' +
      (ml.length ? '<div class="ntf-det__estado ntf-reloj--malo">' + ico('aviso', 16) + ' Correo malo (rebotó): <b>' + esc(ml.join(', ')) + '</b>. Corrígelo en Editar.</div>' : '') +
      (cp.length ? '<ul class="ntf-det__envios">' + cp.slice().reverse().map(function (x) {
        return '<li><b>Oficio ' + esc(x.of) + '</b> · ' + esc(fCorta(x.f)) + (x.h ? ' ' + esc(x.h) : '') + (x.camp ? ' · ' + esc(x.camp) : '') +
          (x.pdf ? ' <button type="button" class="kit-btn mas-mini" data-pdf="' + esc(x.pdf) + '" data-of="' + esc(x.of) + '">' + ico('pdf', 14) + ' Ver PDF</button>' : '') + '</li>';
      }).join('') + '</ul>' : '');
    cont.appendChild(w);
    w.addEventListener('click', function (e) {
      var b = e.target.closest('[data-pdf]'); if (!b) return;
      var pdf = b.getAttribute('data-pdf');
      verPdf({ id: 'mas-exp-' + pdf, titulo: 'Comunicación persuasiva Oficio ' + b.getAttribute('data-of'),
        fuente: function () { return llamar('masexp', { id_predial: row.id_predial, fila: row.rowIndex || '', pdf: pdf }); } });
    });
  }

  /* ══════════════ arranque ══════════════ */
  function enchufar() {
    [['btn-mas-pers', 'PERS'], ['btn-mas-mkt', 'MKT']].forEach(function (x) {
      var b = $(x[0]);
      if (b && !b.__mas) { b.__mas = true; b.addEventListener('click', function () { sonar('back'); abrir(x[1]); }); }
    });
  }
  window.addEventListener('hac:login', function () { olvidar(); });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', enchufar); else enchufar();

  window.MASIVO = {
    abrir: abrir, cargar: cargar, olvidar: olvidar, chipBd: chipBd, detalleBd: detalleBd, malos: malos,
    _S: S, _columnas: columnas, _leerExcel: leerExcel, _tarjeta: tarjeta
  };
}());
