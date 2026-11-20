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
      if (a === 'editarproceso' || a === 'agregarproceso' || a === 'procarchivo') {
        Promise.resolve(p).then(function (r) { try { avisar(r); } catch (e) {} }, function () {});
      }
      return p;
    };
    envuelta.__word = true;
    window.apiPost = envuelta;
  }
  envolver();

  window.WORD_ASIG = { pintar: pintar, docs: docs, avisar: avisar };
}());
