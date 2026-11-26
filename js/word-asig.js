/* ============================================================
   SEC-HACIENDA-FLANDES · WORD EN LÍNEA EN LA ASIGNACIÓN (20/11/2026)

   En una asignación NO finalizada, el Word que se sube queda como
   documento de Google (backend HACIENDA · Word1120.gs), compartido por
   correo solo con el abogado y el asistente de la asignación (nunca por
   enlace). Aquí, en el detalle de la asignación:
     · «Abrir para editar»: el documento en Google Docs (con la cuenta del
       correo de USUARIOS), con su historial de versiones.
     · «Descargar Word»: la exportación .docx de Google, directo, sin pasar
       por Apps Script.
     · Quien no sea el abogado ni el asistente lo ve en el visor de siempre.
     · Si el backend avisa que alguien no tiene cuenta de Google en
       USUARIOS (`wordAviso`), se dice para que ADMIN lo corrija.
   Cero viajes nuevos: todo sale de la fila que ya está en memoria.
   ============================================================ */
(function () {
  'use strict';
  var CASILLAS = [['recibido1', 'Recibido'], ['recibido2', 'Recibido 2'], ['recibido3', 'Recibido 3'],
    ['respuesta1', 'Respuesta 1'], ['respuesta2', 'Respuesta 2'], ['respuesta3', 'Respuesta 3']];

  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function ico(n, t) { return '<i class="hi" data-ico="' + n + '" data-t="' + (t || 18) + '" aria-hidden="true"></i>'; }
  function norm(s) { var t = String(s || '').trim().toUpperCase(); try { t = t.normalize('NFD').replace(/[̀-ͯ]/g, ''); } catch (e) {} return t.replace(/\s+/g, ' '); }
  function idDe(u) { var m = String(u || '').match(/docs\.google\.com\/document\/d\/([-\w]{20,})/); return m ? m[1] : ''; }
  function yo() { try { return (0, eval)('typeof currentUser !== "undefined" ? currentUser : null'); } catch (e) { return null; } }
  function aviso(t, tipo, ms) { try { (window.KIT || {}).aviso(t, tipo || 'info', ms || 5000); } catch (e) {} }

  /** Documentos de Google de la fila. */
  function docs(row) {
    return CASILLAS.map(function (c) { return { k: c[0], t: c[1], id: idDe(row && row[c[0]]) }; }).filter(function (d) { return d.id; });
  }
  function esDeLaAsignacion(row) {
    var u = yo(); if (!u) return false;
    var n = norm(u.nombre);
    return !!n && (n === norm(row.asignado) || n === norm(row.asistente));
  }

  /** Pinta la franja de Word en línea debajo de los documentos del detalle. */
  function pintar(row, filesWrap) {
    if (!filesWrap) return;
    var viejo = filesWrap.parentNode && filesWrap.parentNode.querySelector('.proc-word');
    if (viejo) viejo.remove();
    var ds = docs(row);
    if (!ds.length) return;
    var u = yo() || {}, suyo = esDeLaAsignacion(row);
    var correo = String(u.correo || '').trim();
    var au = correo ? '?authuser=' + encodeURIComponent(correo) : '';
    var finalizada = String(row.estado || '').toUpperCase() === 'FINALIZADO';
    var div = document.createElement('div');
    div.className = 'proc-word';
    div.innerHTML = '<p class="proc-word__t">' + ico('documento', 16) + ' Word en línea' +
        (suyo ? '' : ' <small>· lo editan el abogado y el asistente de la asignación</small>') + '</p>' +
      ds.map(function (d) {
        return '<div class="proc-word__it"><span class="proc-word__n">' + esc(d.t) + '</span>' +
          (suyo ? '<a class="kit-btn proc-word__b" href="https://docs.google.com/document/d/' + d.id + '/edit' + au + '" target="_blank" rel="noopener">' + ico('lapiz', 16) + (finalizada ? ' Abrir' : ' Abrir para editar') + '</a>' +
            '<a class="kit-btn proc-word__b" href="https://docs.google.com/document/d/' + d.id + '/export?format=docx' + (correo ? '&authuser=' + encodeURIComponent(correo) : '') + '" target="_blank" rel="noopener">' + ico('descargar', 16) + ' Descargar Word</a>' : '') +
          '</div>';
      }).join('') +
      (suyo && !correo ? '<p class="proc-word__aviso">' + ico('aviso', 14) + ' Tu usuario no tiene correo en USUARIOS: pide a ADMIN que ponga tu Gmail para poder editar.</p>' :
        (suyo ? '<p class="proc-word__nota">Se abre con tu cuenta ' + esc(correo) + '. Los cambios y el historial de versiones quedan en Google Docs.</p>' : ''));
    filesWrap.parentNode.insertBefore(div, filesWrap.nextSibling);
    try { if (window.HAC_FLANDES && window.HAC_FLANDES.iconizar) window.HAC_FLANDES.iconizar(div); } catch (e) {}
  }

  /** Respuesta del backend con `wordAviso`: dice quién no puede editar. */
  function avisar(res) {
    var l = res && res.wordAviso;
    if (!l || !l.length) return;
    aviso('El Word quedó en línea, pero no se pudo compartir con ' + l.join(', ') + ': no tiene' + (l.length > 1 ? 'n' : '') +
      ' una cuenta de Google (Gmail) en USUARIOS. ADMIN debe poner su correo y volver a subirlo o reasignar.', 'aviso', 9000);
  }

  /* las respuestas de editar/agregar/procarchivo pasan por apiPost: se mira wordAviso sin tocar su lógica */
  function envolver() {
    var original = window.apiPost;
    if (typeof original !== 'function' || original.__word) return;
    var envuelta = function (accion) {
      var a = String(accion || '').toLowerCase();
      var p = original.apply(this, arguments);
      if (a === 'editarproceso' || a === 'agregarproceso' || a === 'procarchivo' || a === 'procreasignar') {
        Promise.resolve(p).then(function (r) { try { avisar(r); } catch (e) {} }, function () {});
      }
      return p;
    };
    envuelta.__word = true;
    window.apiPost = envuelta;
  }
  envolver();

  /* ══════════════ 25/11 · EDITAR ASIGNACIÓN: «archivo ya cargado» se ve y se edita ══════════════
     Antes la marca era un enlace directo a Drive/Docs: se abría con la cuenta de Google que
     tuviera el navegador (casi nunca la que tiene permiso) y no dejaba ver ni editar.
     Ahora:
       · tocar la marca → el visor de la app (los bytes los entrega HACIENDA, sin permisos de Drive);
       · abogado y asistente de una asignación NO finalizada:
           – documento de Google → «Abrir para editar» (con su correo de USUARIOS) y «Descargar Word»;
           – Word viejo guardado en Drive → «Pasar a Word en línea» (POST wordlinea: una copia
             convertida, compartida solo con ellos; el Word original no se borra).
     Un PDF solo se ve. Cero viajes al abrir la vista: lo único que viaja es la conversión, a pedido. */
  var EDIT = ['recibido1', 'recibido2', 'recibido3', 'respuesta1', 'respuesta2', 'respuesta3'];
  var NOMBRE = { recibido1: 'Recibido 1', recibido2: 'Recibido 2', recibido3: 'Recibido 3', respuesta1: 'Respuesta 1', respuesta2: 'Respuesta 2', respuesta3: 'Respuesta 3' };
  function correoMio() { var u = yo() || {}; return String(u.correo || '').trim(); }
  function enlaces(id) {
    var c = correoMio(), au = c ? '?authuser=' + encodeURIComponent(c) : '';
    return '<a class="kit-btn proc-word__b" href="https://docs.google.com/document/d/' + id + '/edit' + au + '" target="_blank" rel="noopener">' + ico('lapiz', 16) + ' Abrir para editar</a>' +
      '<a class="kit-btn proc-word__b" href="https://docs.google.com/document/d/' + id + '/export?format=docx' + (c ? '&authuser=' + encodeURIComponent(c) : '') + '" target="_blank" rel="noopener">' + ico('descargar', 16) + ' Descargar Word</a>';
  }
  function verEnVisor(url, titulo) {
    try { if (typeof window.verArchivo_ === 'function') return window.verArchivo_(url, titulo); } catch (e) {}
    window.open(url, '_blank', 'noopener');
  }
  function nuevoRid() { return 'wl-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
  function reintentable(e) {
    if (!e) return false;
    if (e.name === 'TypeError' || e.name === 'SyntaxError') return true;
    return /RED|Failed to fetch|NetworkError|404/i.test(String(e.codigo || '') + ' ' + String(e.message || ''));
  }
  function pedir(cuerpo, intento) {
    return window.apiPost('wordlinea', cuerpo).catch(function (e) {
      if ((intento || 0) < 1 && reintentable(e)) return pedir(cuerpo, 1);   /* mismo rid */
      throw e;
    });
  }
  function pasarALinea(row, campo, btn, caja, badge) {
    if (btn.__ocupado) return;
    btn.__ocupado = true; btn.disabled = true; btn.classList.add('ica-ocupado');
    var txt = btn.innerHTML;
    btn.innerHTML = ico('reloj', 16) + ' Pasando a Word en línea…';
    btn.__rid = btn.__rid || nuevoRid();
    var t0 = Date.now();
    pedir({ id_proceso: row.id_proceso, rowIndex: row.rowIndex, campo: campo, rid: btn.__rid }).then(function (r) {
      try { console.info('[medicion] wordlinea:pantalla', Date.now() - t0, 'ms'); } catch (e) {}
      if (r && r.noWord) {
        caja.innerHTML = '<span class="proc-word__nota">' + ico('info', 14) + ' Es un PDF: se ve en el visor, no se edita.</span>';
        return;
      }
      if (r && r.fila) Object.keys(r.fila).forEach(function (k) { row[k] = r.fila[k]; });
      if (r && r.url && badge) badge.href = r.url;
      avisar(r);
      caja.innerHTML = enlaces(r.id);
      try { if (window.HAC_FLANDES && window.HAC_FLANDES.iconizar) window.HAC_FLANDES.iconizar(caja); } catch (e) {}
      aviso(r && r.convertido ? 'Listo: el Word quedó en línea. Toca «Abrir para editar».' : 'El documento ya estaba en línea.', 'ok', 4500);
    }, function (e) {
      btn.__ocupado = false; btn.disabled = false; btn.classList.remove('ica-ocupado'); btn.innerHTML = txt;
      if (!reintentable(e)) btn.__rid = null;
      aviso('No se pudo pasar a Word en línea: ' + String((e && e.message) || e), 'error', 7000);
    });
  }
  function prepararEditar(row) {
    if (!row) return;
    var suyo = esDeLaAsignacion(row);
    var finalizada = String(row.estado || '').toUpperCase() === 'FINALIZADO';
    EDIT.forEach(function (campo) {
      var badge = document.getElementById('edit-' + campo + '-loaded');
      var vieja = document.getElementById('edit-' + campo + '-word');
      if (vieja) vieja.remove();
      if (!badge) return;
      var url = String(row[campo] || '').trim();
      badge.onclick = function (ev) {
        ev.preventDefault();
        /* el mismo visor del detalle (todos los documentos, anterior/siguiente); su botón de pestaña abre Google Docs */
        try {
          if (typeof window.abrirDocsAsignacion_ === 'function' && typeof window.docsAsignacion_ === 'function') {
            var pos = window.docsAsignacion_(row).findIndex(function (d) { return d._campo === campo; });
            return window.abrirDocsAsignacion_(row, pos < 0 ? 0 : pos);
          }
        } catch (e) {}
        verEnVisor(badge.href || url, NOMBRE[campo]);
      };
      if (!suyo || finalizada || !url) return;
      var id = idDe(url);
      var caja = document.createElement('div');
      caja.id = 'edit-' + campo + '-word';
      caja.className = 'proc-word__it proc-word__it--editar';
      if (id) caja.innerHTML = enlaces(id);
      else if (/drive\.google\.com|\/d\//.test(url)) {
        caja.innerHTML = '<button type="button" class="kit-btn proc-word__b">' + ico('documento', 16) + ' Pasar a Word en línea para editar</button>';
        var b = caja.querySelector('button');
        b.addEventListener('click', function () { pasarALinea(row, campo, b, caja, badge); });
      } else return;
      badge.parentNode.insertBefore(caja, badge.nextSibling);
      try { if (window.HAC_FLANDES && window.HAC_FLANDES.iconizar) window.HAC_FLANDES.iconizar(caja); } catch (e) {}
    });
  }
  /* abrirEditarAsignacion_ lo reasigna app.js (marcas «ya cargado») y otras capas lo envuelven:
     se envuelve después, idempotente. */
  function engancharEditar() {
    var orig = window.abrirEditarAsignacion_;
    if (typeof orig !== 'function' || orig.__word) return;
    var env = function (row) {
      var r = orig.apply(this, arguments);
      try { prepararEditar(row); } catch (e) { console.warn('WORD_ASIG editar:', e); }
      return r;
    };
    env.__word = true;
    window.abrirEditarAsignacion_ = env;
  }
  engancharEditar();
  setTimeout(engancharEditar, 1500);
  setTimeout(engancharEditar, 4000);

  /** 25/11 — enlace para editar en Google Docs (con la cuenta de USUARIOS) si quien abre es el abogado
      o el asistente de una asignación no finalizada y el documento ya está en línea; si no, ''. */
  function abrirUrl(row, url) {
    var id = idDe(url);
    if (!id || !row || String(row.estado || '').toUpperCase() === 'FINALIZADO' || !esDeLaAsignacion(row)) return '';
    var c = correoMio();
    return 'https://docs.google.com/document/d/' + id + '/edit' + (c ? '?authuser=' + encodeURIComponent(c) : '');
  }

  window.WORD_ASIG = { pintar: pintar, docs: docs, avisar: avisar, prepararEditar: prepararEditar, abrirUrl: abrirUrl };
}());
