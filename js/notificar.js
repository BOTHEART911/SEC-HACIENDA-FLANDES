/* ============================================================
   NOTIFICACIÓN ELECTRÓNICA DE LA FACTURA PREDIAL — 21/10/2026
   SEC-HACIENDA-FLANDES · BD Predial

   · Botón "Notificar" (sobre) en cada tarjeta que la persona puede editar.
   · Modal "Notificación": N.° de factura (6 dígitos → se guarda con el año
     delante: 117639 → 2026117639) con botón Validar, y la factura en PDF
     (adjuntar, arrastrar o Ctrl+V). Cancelar / Enviar.
   · Enviar = UN viaje al backend ICA (cuenta cobrocoactivo, tiene Gmail y
     la firma). ICA le pregunta a HACIENDA, con la llave de quien envía, si
     puede notificar esa fila y trae los datos REALES (correo, nombre,
     ficha, documento y la plantilla); envía; y HACIENDA deja la constancia
     (CITACIÓN y ELECTRÓNICA = SI, columna AR). La respuesta trae la fila
     y aquí se parcha en memoria: no se recarga la lista.
   · Reloj "Plazo": 60 días corridos desde el día siguiente al envío.
     RECONSIDERACIÓN (estado del proceso) lo detiene y lo quita.
   · Respuestas del contribuyente: las guarda ICA (bandeja de cobro
     coactivo). La tarjeta se entera de fondo (notifresumen, un viaje por
     sesión de vista, en cola detrás de lo de primer plano) y el detalle
     las trae al abrirse (cabecera primero, respuestas después).
   ============================================================ */
(function () {
  'use strict';
  if (window.NOTIF) return;

  var PLAZO = 60;
  var MAX_MB = 10;
  var K = window.KIT || {};

  /* ══════════════ utilidades ══════════════ */
  function $(s, r) { return (r || document).querySelector(s); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }
  function ico(n, t) { try { return window.ICO_ ? window.ICO_(n, t || 18) : ''; } catch (_) { return ''; } }
  function aviso(t, tipo, ms) { try { K.aviso(t, tipo || 'info', ms || 3500); } catch (e) { try { console.log(t); } catch (_) {} } }
  function sonar(n) { try { if (typeof playSoundOnce === 'function' && typeof SOUNDS !== 'undefined' && SOUNDS[n]) playSoundOnce(SOUNDS[n]); } catch (e) {} }
  function tk() { return window.HAC_SESION ? window.HAC_SESION.tk() : ''; }
  function nuevoRid() { return 'ntf' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10); }
  function error(codigo, msg) { var e = new Error(msg); e.codigo = codigo; return e; }
  function esperar(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function anio() { return String(hoyBogota().getFullYear()); }
  var MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

  /** Hoy en Bogotá a las 12 m (sin líos de hora). */
  function hoyBogota() {
    try {
      var p = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
      return isoADate(p);
    } catch (_) { var d = new Date(); d.setHours(12, 0, 0, 0); return d; }
  }
  function isoADate(iso) {
    var m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12) : null;
  }
  function dmy(iso) { var m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? m[3] + '/' + m[2] + '/' + m[1] : String(iso || ''); }
  function largo(iso) { var d = isoADate(iso); return d ? d.getDate() + ' de ' + MESES[d.getMonth()] + ' de ' + d.getFullYear() : ''; }

  /* ══════════════ estado de una fila (columna AR) ══════════════ */
  function leer(row) {
    var t = String((row && row.notificacion) || '').trim();
    if (!t) return null;
    if (row.__ntfTxt === t) return row.__ntf;
    var o = null;
    try { o = JSON.parse(t); } catch (_) { o = null; }
    if (!o || !Array.isArray(o.e) || !o.e.length) o = null;
    row.__ntfTxt = t; row.__ntf = o;
    return o;
  }

  /**
   * { notificado, ultima, rec, dias, vence, vencido, clase }
   * dias = días que le quedan al plazo. Día del envío y día siguiente: 60;
   * pasado mañana: 59 … el día del vencimiento: 1; después: vencido.
   */
  function estado(row) {
    var o = leer(row);
    if (!o) return { notificado: false };
    var ult = o.e[o.e.length - 1];
    var d = isoADate(ult.f);
    var out = { notificado: true, ultima: ult, envios: o.e, rec: o.rec || '' };
    if (!d) return out;
    var vence = new Date(d.getTime() + PLAZO * 864e5);
    var hoy = hoyBogota();
    var dias = Math.round((vence - hoy) / 864e5) + 1;
    if (dias > PLAZO) dias = PLAZO;
    out.vence = vence;
    out.dias = dias;
    out.vencido = dias <= 0;
    out.clase = out.rec ? 'rec' : (out.vencido ? 'vencido' : (dias <= 5 ? 'malo' : (dias <= 15 ? 'aviso' : 'ok')));
    return out;
  }

  /* ══════════════ respuestas (de fondo, desde ICA) ══════════════ */
  var RES = { mapa: {}, cargado: false, pidiendo: null, ctrl: null };
  function respuestas(id) { return RES.mapa[String(id || '')] || null; }

  /* ══════════════ red: ICA ══════════════ */
  function urlICA() { return (window.HAC_PUBLICO && window.HAC_PUBLICO.icaUrl) || (window.MARCA && window.MARCA.ICA_URL) || ''; }
  function urlHAC() { try { if (typeof API_BASE === 'string' && API_BASE) return API_BASE; } catch (e) {} return (window.MARCA && window.MARCA.API_URL) || ''; }
  window.__ntfMed = window.__ntfMed || [];

  /**
   * Un viaje. Reintento único SOLO ante falla de red / respuesta que no es
   * JSON (el 404 de echo de Google) y con el MISMO rid: el servidor
   * devuelve lo ya hecho, nunca envía dos veces. La respuesta de una sesión
   * vieja nunca pisa la nueva (la llave se toma al despachar).
   */
  function llamar(base, accion, datos, op) {
    op = op || {};
    datos = datos || {};
    if (!base) return Promise.reject(error('SIN_URL', 'Falta la dirección del servidor. Recarga la app.'));
    var llave = tk();
    var t0 = (window.performance && performance.now()) || Date.now();
    function una(n) {
      var p;
      if (!op.post) {
        var qs = '?action=' + encodeURIComponent(accion) + '&tk=' + encodeURIComponent(llave);
        Object.keys(datos).forEach(function (k) { qs += '&' + k + '=' + encodeURIComponent(datos[k]); });
        p = fetch(base + qs, { signal: op.signal, cache: 'no-store' });
      } else {
        p = fetch(base + '?action=' + encodeURIComponent(accion), {
          method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(Object.assign({ tk: llave, rid: op.rid || '' }, datos)), signal: op.signal
        });
      }
      return p.then(function (r) { return r.text(); }).then(function (t) {
        var j; try { j = JSON.parse(t); } catch (e) { throw error('RED', 'Respuesta inesperada del servidor.'); }
        if (llave !== tk()) throw error('VIEJA', 'Sesión cambiada');
        var ms = Math.round(((window.performance && performance.now()) || Date.now()) - t0);
        try { window.__ntfMed.push({ ruta: accion, ms: ms, kb: Math.round(t.length / 102.4) / 10, n: n, srv: j.ms || '' }); if (window.__ntfMed.length > 100) window.__ntfMed.shift(); } catch (e) {}
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

  /** De fondo, detrás de lo de primer plano: quién respondió (una vez por sesión de vista). */
  function cargarResumen(forzar) {
    if (!urlICA() || !tk()) return Promise.resolve();
    if (RES.pidiendo) return RES.pidiendo;
    if (RES.cargado && !forzar) return Promise.resolve();
    RES.ctrl = window.AbortController ? new AbortController() : null;
    var arrancar = function () {
      return llamar(urlICA(), 'notifresumen', {}, { signal: RES.ctrl && RES.ctrl.signal }).then(function (d) {
        RES.mapa = (d && d.m) || {};
        RES.cargado = true;
        repintar();
      }, function (e) { if (!cancelada(e)) { try { console.warn('notifresumen', e.message); } catch (_) {} } })
        .then(function () { RES.pidiendo = null; });
    };
    /* que la lista y lo de primer plano salgan primero */
    RES.pidiendo = esperar(900).then(arrancar);
    return RES.pidiendo;
  }
  function cortarFondo() { try { if (RES.ctrl) RES.ctrl.abort(); } catch (_) {} RES.pidiendo = null; }

  function repintar() {
    try { if (document.getElementById('view-bd-predial') && !document.getElementById('view-bd-predial').classList.contains('hidden') && typeof applyBDPredialFilters_ === 'function') applyBDPredialFilters_(); } catch (_) {}
  }

  /* ══════════════ tarjeta ══════════════ */
  function relojTexto(st) {
    if (st.rec) return '';
    if (st.vencido) return 'Plazo vencido';
    return 'Plazo ' + st.dias + (st.dias === 1 ? ' día' : ' días');
  }
  /** La línea de la tarjeta: Notificado · reloj · Respondió. '' si no hay notificación. */
  function tarjeta(row) {
    var st = estado(row);
    if (!st.notificado) return '';
    var rs = respuestas(row.id_predial);
    var h = '<div class="ntf-linea">' +
      '<span class="ntf-chip ntf-chip--ok" title="Factura ' + esc(st.ultima.fac) + ' · ' + esc(dmy(st.ultima.f)) + (st.ultima.por ? ' · ' + esc(st.ultima.por) : '') + '">' + ico('sobre', 14) + ' Notificado</span>';
    if (st.rec) h += '<span class="ntf-chip ntf-chip--rec" title="Reloj detenido por el recurso de reconsideración">' + ico('balanza', 14) + ' Reconsideración</span>';
    else if (st.dias != null) h += '<span class="ntf-reloj ntf-reloj--' + st.clase + '" title="Vence el ' + esc(st.vence ? st.vence.toLocaleDateString('es-CO') : '') + '">' + ico('reloj', 14) + ' ' + esc(relojTexto(st)) + '</span>';
    if (rs && rs[0] > 0) h += '<span class="ntf-chip ntf-chip--resp" title="Última respuesta: ' + esc(dmy(rs[1])) + '">' + ico('responder', 14) + ' Respondió' + (rs[0] > 1 ? ' (' + rs[0] + ')' : '') + '</span>';
    return h + '</div>';
  }
  /** El botón de la tarjeta (solo quien puede editar el expediente). */
  function boton(row) {
    /* sin la columna AR en el listado = el backend aún no tiene la ruta (no se ofrece el botón) */
    if (!row || !('notificacion' in row)) return '';
    var st = estado(row);
    var t = st.notificado ? 'Notificar de nuevo (última: factura ' + st.ultima.fac + ')' : 'Notificar factura por correo';
    return '<button type="button" class="bdp-icon-btn ntf-btn' + (st.notificado ? ' ntf-btn--hecho' : '') + '" data-bdp-act="notificar" title="' + esc(t) + '" aria-label="' + esc(t) + '">' + ico('sobre', 22) + '</button>';
  }

  /* ══════════════ filtro NOTIFICACIÓN ══════════════ */
  var OPC = [
    ['ALL', 'Todas'], ['SIN', 'Sin notificar'], ['NOTIFICADO', 'Notificados'],
    ['VIGENTE', 'Plazo corriendo'], ['PORVENCER', 'Plazo por vencer (≤ 10 días)'],
    ['VENCIDO', 'Plazo vencido'], ['RESPONDIO', 'Respondieron'], ['RECONSIDERACION', 'En reconsideración']
  ];
  function clave(row) {
    var st = estado(row);
    var k = { SIN: !st.notificado, NOTIFICADO: !!st.notificado };
    if (st.notificado) {
      k.RECONSIDERACION = !!st.rec;
      k.VIGENTE = !st.rec && st.dias != null && !st.vencido;
      k.PORVENCER = k.VIGENTE && st.dias <= 10;
      k.VENCIDO = !st.rec && !!st.vencido;
      var rs = respuestas(row.id_predial);
      k.RESPONDIO = !!(rs && rs[0] > 0);
    }
    return k;
  }
  function pasa(row, valor) { return !valor || valor === 'ALL' ? true : !!clave(row)[valor]; }
  /** Pone el número de expedientes en cada pastilla (sobre lo que el servidor dejó ver). */
  function contar(lista) {
    var cont = document.getElementById('bdp-pills-notif');
    if (!cont) return;
    var n = {}; OPC.forEach(function (o) { n[o[0]] = 0; });
    (lista || []).forEach(function (r) { var k = clave(r); for (var x in k) if (k[x]) n[x]++; });
    n.ALL = (lista || []).length;
    cont.querySelectorAll('.proc-status-pill').forEach(function (b) {
      var v = b.getAttribute('data-notif') || 'ALL';
      var o = OPC.filter(function (x) { return x[0] === v; })[0];
      if (!o) return;
      var t = o[1] + (v === 'ALL' ? '' : ' (' + n[v] + ')');
      if (b.textContent !== t) b.textContent = t;
    });
  }

  /* ══════════════ modal ══════════════ */
  function modal(op) {
    var m = document.createElement('div');
    m.className = 'hf-modal ntf-modal';
    m.innerHTML = '<div class="hf-modal__hoja" role="dialog" aria-modal="true" aria-labelledby="ntf-tit">' +
      '<div class="hf-modal__cab">' + ico(op.icono || 'sobre', 22) + '<h2 id="ntf-tit">' + esc(op.titulo) + '</h2>' +
      '<button type="button" class="ntf-x" data-cerrar aria-label="Cerrar">' + ico('cerrar', 20) + '</button></div>' +
      '<div class="ntf-cuerpo">' + (op.cuerpo || '') + '</div>' +
      (op.pie != null ? '<div class="hf-modal__pie">' + op.pie + '</div>' : '') + '</div>';
    document.body.appendChild(m);
    var quitar = function () { m.remove(); document.removeEventListener('keydown', tecla); if (op.alCerrar) op.alCerrar(); };
    var cerrar = function (forzar) {
      if (m.__ocupado) return Promise.resolve(false);
      if (forzar !== true && op.sucio && op.sucio()) {
        return confirmar('¿Descartar la notificación?', '<p>Escribiste datos que aún no se han enviado. Si cierras, se pierden.</p>', 'Sí, descartar')
          .then(function (ok) { if (ok) quitar(); return ok; });
      }
      quitar(); return Promise.resolve(true);
    };
    var tecla = function (e) { if (e.key === 'Escape' && document.body.lastElementChild === m && !(window.VISOR && window.VISOR.abierto && window.VISOR.abierto())) cerrar(); };
    document.addEventListener('keydown', tecla);
    m.addEventListener('click', function (e) { if (e.target.closest('[data-cerrar]')) cerrar(); });
    m.cerrar = cerrar;
    m.q = function (s) { return m.querySelector(s); };
    return m;
  }
  function confirmar(titulo, html, si) {
    return new Promise(function (res) {
      var m = modal({ titulo: titulo, icono: 'info', cuerpo: '<div class="ntf-conf">' + html + '</div>',
        pie: '<button type="button" class="kit-btn" data-cerrar>Cancelar</button><button type="button" class="kit-btn kit-btn--marca" data-si>' + esc(si || 'Sí, continuar') + '</button>',
        alCerrar: function () { res(false); } });
      m.q('[data-si]').addEventListener('click', function () { m.remove(); res(true); });
    });
  }
  function guardando(promesa, texto) {
    try { if (K.piezas && K.piezas.guardado) return K.piezas.guardado.mientras(promesa, { titulo: texto }); } catch (e) {}
    return promesa;
  }
  function leerB64(file) {
    return new Promise(function (res, rej) {
      var fr = new FileReader();
      fr.onload = function () { res(String(fr.result).split(',')[1] || ''); };
      fr.onerror = function () { rej(new Error('No se pudo leer el archivo.')); };
      fr.readAsDataURL(file);
    });
  }
  function fichaLimpia(v) { try { return typeof bdpCleanFicha_ === 'function' ? bdpCleanFicha_(v) : String(v || ''); } catch (_) { return String(v || ''); } }
  function correoOk(c) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(c || '').trim()); }

  function abrir(row) {
    if (!row) return;
    var correo = String(row.correo_electronico || '').trim();
    var st = estado(row);
    var previo = st.notificado
      ? '<div class="ntf-previo">' + ico('info', 16) + ' Este expediente ya fue notificado con la factura <b>' + esc(st.ultima.fac) + '</b> el ' + esc(largo(st.ultima.f)) + '. Un envío nuevo vuelve a contar el plazo desde mañana.</div>'
      : '';
    var m = modal({
      titulo: 'Notificación', icono: 'sobre',
      sucio: function () { return !!(pdf || m.q('[name=fac]').value.trim()); },
      cuerpo:
        '<div class="ntf-para">' +
          '<div><small>Contribuyente</small><b>' + esc(row.nombres || '—') + '</b></div>' +
          '<div><small>NIT / CC</small><b>' + esc(row.nit_cedula || '—') + '</b></div>' +
          '<div><small>Ficha catastral</small><b>' + esc(fichaLimpia(row.ficha_catastral) || '—') + '</b></div>' +
          '<div class="ntf-para__correo"><small>Se envía a</small><b>' + (correo ? esc(correo) : '<span class="ntf-mal">Sin correo electrónico</span>') + '</b></div>' +
        '</div>' + previo +
        '<label class="ntf-lab" for="ntf-fac">N.° de factura <span class="hf-oblig">*</span></label>' +
        '<div class="ntf-fac">' +
          '<span class="ntf-fac__anio" title="Se antepone el año actual">' + anio() + '</span>' +
          '<input id="ntf-fac" name="fac" inputmode="numeric" autocomplete="off" maxlength="6" placeholder="6 dígitos" aria-describedby="ntf-fac-ayuda">' +
          '<button type="button" class="kit-btn ntf-validar" data-validar>' + ico('buscar', 16) + ' Validar</button>' +
        '</div>' +
        '<p class="ntf-ayuda" id="ntf-fac-ayuda" data-facmsg>Escribe los 6 dígitos de la factura. Se guarda como ' + anio() + '######.</p>' +
        '<label class="ntf-lab">Factura Impuesto Predial (PDF) <span class="hf-oblig">*</span></label>' +
        '<div class="ntf-drop" data-drop tabindex="0" role="button" aria-label="Adjuntar la factura en PDF">' +
          ico('pdf', 28) + '<b>Adjunta, arrastra o pega (Ctrl+V) la factura en PDF</b><small>Máximo ' + MAX_MB + ' MB</small>' +
        '</div>' +
        '<input type="file" accept="application/pdf,.pdf" hidden data-file>' +
        '<div class="ntf-archivo" data-archivo hidden></div>',
      pie: '<button type="button" class="kit-btn" data-cerrar>Cancelar</button>' +
           '<button type="button" class="kit-btn kit-btn--marca" data-enviar disabled>' + ico('enviar', 18) + ' Enviar</button>'
    });

    var pdf = null;          /* { nombre, b64, tam } */
    var validada = null;     /* número de 6 que ya pasó Validar */
    var inp = m.q('[name=fac]'), msg = m.q('[data-facmsg]'), btnEnviar = m.q('[data-enviar]'), btnVal = m.q('[data-validar]');
    var drop = m.q('[data-drop]'), finp = m.q('[data-file]'), caja = m.q('[data-archivo]');

    function listo() {
      var ok = /^\d{6}$/.test(inp.value) && !!pdf && correoOk(correo) && validada !== false;
      btnEnviar.disabled = !ok || !!m.__ocupado;
    }
    function ponerMsg(t, clase) { msg.innerHTML = t; msg.className = 'ntf-ayuda' + (clase ? ' ntf-ayuda--' + clase : ''); }
    inp.addEventListener('input', function () {
      var v = inp.value.replace(/\D/g, '').slice(0, 6);
      if (v !== inp.value) inp.value = v;
      validada = null;
      inp.classList.remove('ntf-in--mal', 'ntf-in--ok');
      ponerMsg(v.length === 6 ? 'Se guardará como <b>' + anio() + v + '</b>. Toca Validar para revisar que no se haya enviado antes.' : 'Escribe los 6 dígitos de la factura.', '');
      listo();
    });
    btnVal.addEventListener('click', function () {
      var v = inp.value;
      if (!/^\d{6}$/.test(v)) { ponerMsg('La factura debe tener exactamente 6 dígitos.', 'mal'); inp.focus(); return; }
      if (btnVal.disabled) return;
      btnVal.disabled = true; btnVal.classList.add('ntf-ocupado');
      ponerMsg('Revisando…', '');
      llamar(urlHAC(), 'notifvalidar', { fac: v, id_predial: row.id_predial }).then(function (d) {
        if (inp.value !== v) return;
        if (d.existe) {
          validada = false; inp.classList.add('ntf-in--mal');
          ponerMsg(ico('aviso', 15) + ' La factura <b>' + esc(d.fac) + '</b> ya se notificó' + (d.id_predial && d.id_predial !== row.id_predial ? ' en otro expediente' : ' en este expediente') + '. No se puede volver a enviar.', 'mal');
          sonar('error');
        } else {
          validada = v; inp.classList.add('ntf-in--ok');
          ponerMsg(ico('check', 15) + ' La factura <b>' + esc(d.fac) + '</b> no se ha enviado antes.', 'ok');
        }
        listo();
      }, function (e) { if (!cancelada(e)) ponerMsg(esc(e.message), 'mal'); })
        .then(function () { btnVal.disabled = false; btnVal.classList.remove('ntf-ocupado'); });
    });
    inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); btnVal.click(); } });

    function tomar(file) {
      if (!file) return;
      var esPdf = /pdf$/i.test(file.type || '') || /\.pdf$/i.test(file.name || '');
      if (!esPdf) { aviso('La factura debe ser un archivo PDF.', 'aviso', 4500); return; }
      if (file.size > MAX_MB * 1024 * 1024) { aviso('El PDF pasa de ' + MAX_MB + ' MB.', 'aviso', 4500); return; }
      leerB64(file).then(function (b64) {
        pdf = { nombre: file.name || ('Factura ' + anio() + inp.value + '.pdf'), b64: b64, tam: file.size };
        caja.hidden = false; drop.hidden = true;
        caja.innerHTML = '<button type="button" class="ntf-doc" data-ver>' + ico('pdf', 22) + '<span><b>' + esc(pdf.nombre) + '</b><small>' + (Math.round(pdf.tam / 1024)) + ' KB · toca para verlo</small></span></button>' +
          '<button type="button" class="bdp-icon-btn danger-icon" data-quitar title="Quitar el PDF" aria-label="Quitar el PDF">' + ico('basura', 18) + '</button>';
        listo();
      }, function (e) { aviso(e.message, 'aviso'); });
    }
    drop.addEventListener('click', function () { finp.click(); });
    drop.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); finp.click(); } });
    finp.addEventListener('change', function () { tomar(finp.files && finp.files[0]); finp.value = ''; });
    ['dragenter', 'dragover'].forEach(function (t) { drop.addEventListener(t, function (e) { e.preventDefault(); drop.classList.add('ntf-drop--sobre'); }); });
    ['dragleave', 'drop'].forEach(function (t) { drop.addEventListener(t, function (e) { e.preventDefault(); drop.classList.remove('ntf-drop--sobre'); }); });
    drop.addEventListener('drop', function (e) { if (e.dataTransfer && e.dataTransfer.files) tomar(e.dataTransfer.files[0]); });
    var pegar = function (e) {
      if (!document.body.contains(m)) { document.removeEventListener('paste', pegar); return; }
      var it = (e.clipboardData && e.clipboardData.items) || [];
      for (var i = 0; i < it.length; i++) if (it[i].kind === 'file') { var f = it[i].getAsFile(); if (f) { e.preventDefault(); tomar(f); return; } }
    };
    document.addEventListener('paste', pegar);
    caja.addEventListener('click', function (e) {
      if (e.target.closest('[data-quitar]')) { pdf = null; caja.hidden = true; caja.innerHTML = ''; drop.hidden = false; listo(); return; }
      if (e.target.closest('[data-ver]') && pdf && window.VISOR && window.VISOR.lista) {
        var copia = pdf;
        window.VISOR.lista([{ id: 'ntf-local', titulo: copia.nombre, mime: 'application/pdf', detalle: 'Factura a enviar' }], {
          fuente: function () { return Promise.resolve({ nombre: copia.nombre, mime: 'application/pdf', b64: copia.b64 }); }
        });
      }
    });

    btnEnviar.addEventListener('click', function () {
      if (btnEnviar.disabled || m.__ocupado) return;
      var seis = inp.value;
      /* escudo desde el primer toque: nada de doble envío */
      m.__ocupado = true; btnEnviar.disabled = true; m.classList.add('ntf-modal--ocupado');
      confirmar('¿Enviar la notificación?',
        '<p>Se enviará desde <b>cobrocoactivo@flandes-tolima.gov.co</b> a <b>' + esc(correo) + '</b> la <b>Factura No. ' + esc(anio() + seis) + '</b> de <b>' + esc(row.nombres || '') + '</b>, con el PDF adjunto.</p><p>El envío no se puede deshacer.</p>',
        'Sí, enviar').then(function (ok) {
        if (!ok) { m.__ocupado = false; m.classList.remove('ntf-modal--ocupado'); listo(); return; }
        var rid = btnEnviar.__rid || (btnEnviar.__rid = nuevoRid());
        var t0 = Date.now();
        guardando(llamar(urlICA(), 'notificar', {
          id_predial: row.id_predial, fila: row.rowIndex || '', factura: seis,
          pdf: { nombre: pdf.nombre, b64: pdf.b64 }
        }, { post: true, rid: rid }), 'Enviando la notificación').then(function (d) {
          m.__ocupado = false;
          sonar('success');
          try { window.__ntfMed.push({ ruta: 'notificar(total)', ms: Date.now() - t0 }); } catch (_) {}
          if (d && d.fila) { try { bdpAplicarFila_(d.fila); } catch (_) {} }
          else if (d && d.ntf) { row.notificacion = d.ntf; row.notif_citacion = 'SI'; row.notif_electr = 'SI'; repintar(); }
          if (d && d.registroPendiente) {
            /* el correo ya salió: solo falta la constancia en BD Predial. Se repite con el MISMO rid (no reenvía). */
            aviso('El correo salió. Dejando la constancia en BD Predial…', 'info', 4000);
            esperar(1500).then(function () { return llamar(urlICA(), 'notifreintentar', { rid: rid }, { post: true, rid: rid + '-r' }); }).then(function (x) {
              if (x && x.fila) { try { bdpAplicarFila_(x.fila); } catch (_) {} }
              aviso('Notificación enviada a ' + correo + ' y registrada.', 'ok', 5000);
            }, function (e2) {
              aviso('El correo salió a ' + correo + ', pero la constancia en BD Predial no quedó (' + e2.message + '). Recarga BD Predial; si no aparece "Notificado", avísale a soporte.', 'aviso', 12000);
            });
          }
          else aviso('Notificación enviada a ' + correo + '. Plazo de ' + PLAZO + ' días desde mañana.', 'ok', 5000);
          document.removeEventListener('paste', pegar);
          m.cerrar(true);
        }, function (e) {
          m.__ocupado = false; m.classList.remove('ntf-modal--ocupado');
          if (e.codigo !== 'RED') btnEnviar.__rid = null;
          if (e.codigo === 'FACTURA_REPETIDA') { validada = false; inp.classList.add('ntf-in--mal'); ponerMsg(esc(e.message), 'mal'); }
          sonar('error');
          aviso(e.message, 'aviso', 7000);
          listo();
        });
      });
    });

    if (!correoOk(correo)) {
      ponerMsg(ico('aviso', 15) + ' Este expediente no tiene un correo electrónico válido. Corrígelo en Editar antes de notificar.', 'mal');
      inp.disabled = true; btnVal.disabled = true;
    } else setTimeout(function () { try { inp.focus(); } catch (_) {} }, 60);
  }

  /* ══════════════ detalle del expediente ══════════════ */
  var detCtrl = null;
  function detalle(row, cont) {
    if (!cont) return;
    var st = estado(row);
    if (!st.notificado) return;
    var w = document.createElement('div');
    w.className = 'bdp-det-section ntf-det';
    var env = st.envios.slice().reverse().map(function (x) {
      return '<li><b>Factura ' + esc(x.fac) + '</b> · ' + esc(dmy(x.f)) + (x.h ? ' ' + esc(x.h) : '') + (x.por ? ' · ' + esc(x.por) : '') + '</li>';
    }).join('');
    var estadoTxt = st.rec ? 'Reloj detenido: recurso de RECONSIDERACIÓN desde el ' + esc(largo(st.rec)) + '.'
      : (st.vencido ? 'El plazo de ' + PLAZO + ' días venció el ' + esc(st.vence.toLocaleDateString('es-CO')) + '.'
        : 'Le quedan <b>' + st.dias + '</b> ' + (st.dias === 1 ? 'día' : 'días') + ' (vence el ' + esc(st.vence.toLocaleDateString('es-CO')) + ').');
    w.innerHTML =
      '<div class="bdp-det-section-title">' + ico('sobre', 18) + ' Notificación electrónica</div>' +
      '<div class="ntf-det__estado ntf-reloj--' + esc(st.clase || 'ok') + '">' + ico(st.rec ? 'balanza' : 'reloj', 16) + ' ' + estadoTxt + '</div>' +
      '<ul class="ntf-det__envios">' + env + '</ul>' +
      '<div class="ntf-det__resp" data-resp><div class="sk sk-line w95 ntf-esq"></div><div class="sk sk-line w60"></div></div>';
    cont.appendChild(w);
    var zona = w.querySelector('[data-resp]');
    try { if (detCtrl) detCtrl.abort(); } catch (_) {}
    detCtrl = window.AbortController ? new AbortController() : null;
    llamar(urlICA(), 'notifdetalle', { id_predial: row.id_predial, fila: row.rowIndex || '' }, { signal: detCtrl && detCtrl.signal }).then(function (d) {
      pintarRespuestas(row, zona, d || {});
    }, function (e) {
      if (cancelada(e)) return;
      zona.innerHTML = '<p class="ntf-ayuda ntf-ayuda--mal">No se pudieron traer las respuestas: ' + esc(e.message) + '</p>';
    });
  }
  function pintarRespuestas(row, zona, d) {
    var rs = d.respuestas || [];
    var docs = [];
    (d.envios || []).forEach(function (x) { if (x.pdf) docs.push({ id: x.pdf, titulo: 'Factura ' + x.fac + ' (enviada).pdf', mime: 'application/pdf', detalle: 'Notificación · ' + dmy(x.f) }); });
    var h = '';
    if (!rs.length) h = '<p class="ntf-ayuda">El contribuyente aún no ha respondido el correo.</p>';
    else h = rs.slice().reverse().map(function (r) {
      (r.adj || []).forEach(function (a) { docs.push({ id: a.id, titulo: a.n, mime: a.m, detalle: 'Respuesta · ' + dmy(r.f) }); });
      return '<div class="ntf-resp">' +
        '<div class="ntf-resp__cab">' + ico('responder', 16) + ' <b>Respuesta del ' + esc(dmy(r.f)) + (r.h ? ' ' + esc(r.h) : '') + '</b>' + (r.de ? ' · <span>' + esc(r.de) + '</span>' : '') + '</div>' +
        (r.tx ? '<div class="ntf-resp__tx">' + esc(r.tx) + '</div>' : '') +
        ((r.adj || []).length ? '<div class="ntf-resp__adj">' + r.adj.map(function (a) {
          return '<button type="button" class="ntf-doc" data-doc="' + esc(a.id) + '">' + ico(/pdf/.test(a.m) ? 'pdf' : (/image/.test(a.m) ? 'imagen' : 'documento'), 18) + '<span><b>' + esc(a.n) + '</b></span></button>';
        }).join('') + '</div>' : '') +
        '</div>';
    }).join('');
    if (docs.length) h += '<div class="ntf-resp__pie"><button type="button" class="kit-btn" data-doc="' + esc(docs[0].id) + '">' + ico('documento', 16) + ' Ver documentos (' + docs.length + ')</button></div>';
    zona.innerHTML = h;
    zona.addEventListener('click', function (e) {
      var b = e.target.closest('[data-doc]'); if (!b) return;
      if (!window.VISOR || !window.VISOR.lista) { aviso('El visor no cargó. Recarga la app.', 'aviso'); return; }
      var id = b.getAttribute('data-doc'), ind = 0;
      docs.forEach(function (x, k) { if (x.id === id) ind = k; });
      window.VISOR.lista(docs, {
        indice: ind,
        fuente: function (archivoId) {
          return llamar(urlICA(), 'notifarchivo', { id_predial: row.id_predial, fila: row.rowIndex || '', archivoId: archivoId }).then(function (x) {
            if (x && x.b64) return { nombre: x.nombre, mime: x.mime, b64: x.b64 };
            throw new Error('No se pudo abrir el documento.');
          });
        }
      });
    });
  }

  /* ══════════════ configuración del correo (ADMIN y DEV) ══════════════ */
  function roles() { try { var p = window.IDN && window.IDN.perfil && window.IDN.perfil(); return (p && p.roles) || []; } catch (_) { return []; } }
  function puedeConfig() { var r = roles(); return r.indexOf('ADMIN') !== -1 || r.indexOf('DEV') !== -1; }
  var VARS_AS = ['numFactura', 'fichaCatastral', 'nombre', 'documento'];
  var VARS_CU = ['dia', 'mes', 'ano', 'nombre', 'documento', 'fichaCatastral', 'numFactura', 'firmaSecretaria', 'firmaVistoBueno'];
  var EJEMPLO = { numFactura: anio() + '117639', fichaCatastral: '010000930011000', nombre: 'NOMBRE DEL CONTRIBUYENTE', documento: '12345678',
    dia: String(hoyBogota().getDate()), mes: MESES[hoyBogota().getMonth()], ano: anio() };

  /** Vista previa: misma regla que el servidor (**negrita**, • lista, enlaces, firmas). */
  function previa(tpl) {
    var out = [], lista = null, par = [];
    var cp = function () { if (par.length) { out.push('<p>' + par.join('<br>') + '</p>'); par = []; } };
    var cl = function () { if (lista) { out.push('<ul>' + lista.join('') + '</ul>'); lista = null; } };
    var linea = function (t) {
      var h = esc(t).replace(/\{\{\s*(\w+)\s*\}\}/g, function (m, k) { return EJEMPLO[k] != null ? '<mark>' + esc(EJEMPLO[k]) + '</mark>' : '<span class="ntf-cfg__malo">' + m + '</span>'; });
      return h.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/(https?:\/\/[^\s<]+)/g, '<a>$1</a>');
    };
    String(tpl || '').replace(/\r\n?/g, '\n').split('\n').forEach(function (l) {
      var t = l.trim(), fm = /^\{\{\s*(firmaSecretaria|firmaVistoBueno)\s*\}\}$/.exec(t);
      if (fm) { cp(); cl(); out.push('<div class="ntf-cfg__firma">' + ico('firma', 16) + (fm[1] === 'firmaSecretaria' ? ' Firma de la Secretaria' : ' Firma de visto bueno') + '</div>'); return; }
      if (!t) { cp(); cl(); return; }
      if (/^[•\-*]\s+/.test(t) && !/^\*\*/.test(t)) { cp(); (lista = lista || []).push('<li>' + linea(t.replace(/^[•\-*]\s+/, '')) + '</li>'); return; }
      cl(); par.push(linea(l));
    });
    cp(); cl();
    return out.join('');
  }

  function abrirConfig() {
    if (!puedeConfig()) { aviso('Solo ADMIN y DEV cambian el correo de notificación.', 'aviso'); return; }
    var m = modal({
      titulo: 'Correo de notificación', icono: 'engranaje',
      sucio: function () { return !!m.__sucio; },
      cuerpo: '<p class="ntf-ayuda">Lo que recibe el contribuyente al notificar la factura. Toca una variable para ponerla donde está el cursor. <b>**texto**</b> sale en negrita y las líneas que empiezan por • salen como lista.</p>' +
        '<div class="ntf-cfg" data-zona><div class="sk sk-line w95 ntf-esq"></div><div class="sk sk-line w80"></div><div class="sk sk-line w60"></div></div>',
      pie: '<button type="button" class="kit-btn" data-cerrar>Cancelar</button>' +
           '<button type="button" class="kit-btn kit-btn--marca" data-guardar disabled>' + ico('check', 18) + ' Guardar</button>'
    });
    m.querySelector('.hf-modal__hoja').classList.add('hf-modal__hoja--ancha');
    var zona = m.q('[data-zona]'), btn = m.q('[data-guardar]'), orig = {};
    function chips(vars, para) {
      return '<div class="ntf-cfg__vars">' + vars.map(function (v) { return '<button type="button" class="ntf-cfg__var" data-para="' + para + '" data-v="{{' + v + '}}">{{' + v + '}}</button>'; }).join('') + '</div>';
    }
    function pintar(d) {
      var pl = {}; (d.plantillas || []).forEach(function (x) { pl[x.clave] = x; });
      var as = pl['notif.asunto'] || {}, cu = pl['notif.cuerpo'] || {};
      orig = { as: as.texto || '', cu: cu.texto || '' };
      zona.innerHTML =
        '<label class="ntf-lab" for="ntf-cfg-as">Asunto' + (as.esDefecto === false ? ' <em class="ntf-cfg__tag">editado</em>' : '') + '</label>' + chips(VARS_AS, 'as') +
        '<input id="ntf-cfg-as" data-campo="as" autocomplete="off">' +
        '<div class="ntf-cfg__restaurar"><button type="button" class="kit-btn" data-rest="notif.asunto">' + ico('devolver', 16) + ' Restaurar asunto original</button></div>' +
        '<label class="ntf-lab" for="ntf-cfg-cu">Cuerpo del correo' + (cu.esDefecto === false ? ' <em class="ntf-cfg__tag">editado</em>' : '') + '</label>' + chips(VARS_CU, 'cu') +
        '<div class="ntf-cfg__dos"><textarea id="ntf-cfg-cu" data-campo="cu" rows="20"></textarea><div class="ntf-cfg__previa" data-previa aria-label="Vista previa"></div></div>' +
        '<div class="ntf-cfg__restaurar"><button type="button" class="kit-btn" data-rest="notif.cuerpo">' + ico('devolver', 16) + ' Restaurar cuerpo original</button></div>';
      m.q('[data-campo=as]').value = orig.as;
      m.q('[data-campo=cu]').value = orig.cu;
      refrescar();
    }
    function refrescar() {
      var a = m.q('[data-campo=as]'), c = m.q('[data-campo=cu]');
      if (!a) return;
      m.q('[data-previa]').innerHTML = '<div class="ntf-cfg__asunto"><small>Asunto</small>' + previa(a.value).replace(/<\/?p>/g, '') + '</div>' + previa(c.value);
      m.__sucio = a.value !== orig.as || c.value !== orig.cu;
      btn.disabled = !m.__sucio || !a.value.trim() || !c.value.trim();
    }
    zona.addEventListener('input', refrescar);
    zona.addEventListener('click', function (e) {
      var ch = e.target.closest('[data-v]');
      if (ch) {
        var el = m.q('[data-campo=' + ch.getAttribute('data-para') + ']'), v = ch.getAttribute('data-v');
        var i = el.selectionStart != null ? el.selectionStart : el.value.length, f = el.selectionEnd != null ? el.selectionEnd : i;
        el.value = el.value.slice(0, i) + v + el.value.slice(f); el.focus(); el.selectionStart = el.selectionEnd = i + v.length;
        refrescar(); return;
      }
      var r = e.target.closest('[data-rest]');
      if (r && !r.disabled) {
        confirmar('Restaurar el texto original', '<p>Se vuelve al texto de fábrica y se guarda de una vez.</p>', 'Restaurar').then(function (ok) {
          if (!ok) return;
          r.disabled = true;
          guardando(llamar(urlHAC(), 'cfgrestaurar', { clave: r.getAttribute('data-rest') }, { post: true, rid: nuevoRid() }), 'Restaurando').then(function (res) {
            var campo = r.getAttribute('data-rest') === 'notif.asunto' ? 'as' : 'cu';
            orig[campo] = (res && res.texto) || ''; m.q('[data-campo=' + campo + ']').value = orig[campo];
            r.disabled = false; refrescar(); sonar('success'); aviso('Texto original restaurado.', 'ok');
          }, function (er) { r.disabled = false; aviso(er.message, 'aviso', 6000); });
        });
      }
    });
    btn.addEventListener('click', function () {
      if (btn.disabled || m.__ocupado) return;
      var cambios = {}, a = m.q('[data-campo=as]').value.trim(), c = m.q('[data-campo=cu]').value.trim();
      if (a !== orig.as) cambios['notif.asunto'] = a;
      if (c !== orig.cu) cambios['notif.cuerpo'] = c;
      m.__ocupado = true; btn.disabled = true;
      var rid = btn.__rid || (btn.__rid = nuevoRid());
      guardando(llamar(urlHAC(), 'cfgguardar', { cambios: cambios }, { post: true, rid: rid }), 'Guardando el correo').then(function () {
        m.__ocupado = false; m.__sucio = false; btn.__rid = null; sonar('success');
        aviso('Correo de notificación guardado. Sale así desde el próximo envío.', 'ok', 5000);
        m.cerrar(true);
      }, function (er) {
        m.__ocupado = false; if (er.codigo !== 'RED') btn.__rid = null; refrescar(); aviso(er.message, 'aviso', 7000);
      });
    });
    llamar(urlHAC(), 'cfgtodo', {}).then(pintar, function (e) {
      if (!cancelada(e)) zona.innerHTML = '<p class="ntf-ayuda ntf-ayuda--mal">No se pudo cargar el correo: ' + esc(e.message) + '</p>';
    });
  }
  document.addEventListener('click', function (e) {
    if (e.target.closest && e.target.closest('#btn-bdp-correo')) { sonar('menu'); abrirConfig(); }
  });

  window.NOTIF = {
    puedeConfig: puedeConfig, abrirConfig: abrirConfig,
    PLAZO: PLAZO, OPC: OPC,
    estado: estado, tarjeta: tarjeta, boton: boton, abrir: abrir, detalle: detalle,
    pasa: pasa, clave: clave, contar: contar, respuestas: respuestas,
    cargarResumen: cargarResumen, cortarFondo: cortarFondo,
    blob: function (row) { var st = estado(row); return st.notificado ? st.envios.map(function (x) { return x.fac; }).join(' ') + ' notificado' : ''; }
  };
})();
