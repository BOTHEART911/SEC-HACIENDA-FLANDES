/* ============================================================
   ADJUNTOS — LOTE 06/09/2026 · SEC-HACIENDA

   Qué cambia
     Los 14 campos de archivo que solo aceptaban PDF ahora también
     aceptan Word (.doc y .docx):
       · Responder solicitud → Recibo 1 a 5
       · Agregar asignación  → Documento Recibido 1 a 3
       · Editar asignación   → Recibido 1 a 3 y Respuesta 1 a 3
     (La evidencia de envío sigue siendo imagen, no se toca.)

   Dos capas, como siempre
     · El `accept` del campo, para que el explorador de archivos ya
       muestre los Word (va en index.html; aquí se vuelve a poner por
       si alguna vista se pinta desde js).
     · La validación de app.js (`isPdfFile_`), que rechazaba todo lo
       que no fuera PDF. Se envuelve para que deje pasar Word.

   Lo que hay que saber
     El servidor guarda el archivo con SU extensión real (antes le
     ponía .pdf a todo). Un Word en Drive se puede ver y descargar,
     pero el botón IMPRIMIR de la app cae a abrir Drive: solo los PDF
     y los documentos de Google se imprimen desde dentro.

   No modifica app.js: se carga después y envuelve lo que app.js expone.
   ============================================================ */
(function () {
  'use strict';

  if (window.__HACADJ_LISTO) return;
  window.__HACADJ_LISTO = true;

  /* Lo que se puede adjuntar donde antes solo iba PDF. */
  var ACEPTA = '.pdf,.doc,.docx,application/pdf,application/msword,' +
               'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

  var CAMPOS = [
    'recibo1', 'recibo2', 'recibo3', 'recibo4', 'recibo5',
    'proc-recibido1', 'proc-recibido2', 'proc-recibido3',
    'edit-recibido1', 'edit-recibido2', 'edit-recibido3',
    'edit-respuesta1', 'edit-respuesta2', 'edit-respuesta3'
  ];

  function extensionOk(file) {
    var n = String((file && file.name) || '').toLowerCase();
    return /\.(pdf|doc|docx)$/.test(n);
  }

  function tipoOk(file) {
    var t = String((file && file.type) || '').toLowerCase();
    return t === 'application/pdf' ||
           t === 'application/msword' ||
           t === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  }

  /* Se acepta por nombre O por tipo: Windows a veces manda el tipo vacío,
     y algunos Android mandan un tipo genérico con el nombre correcto. */
  function documentoOk(file) {
    if (!file) return false;
    return extensionOk(file) || tipoOk(file);
  }

  function ponerAccept() {
    for (var i = 0; i < CAMPOS.length; i++) {
      var el = document.getElementById(CAMPOS[i]);
      if (el && el.getAttribute('accept') !== ACEPTA) el.setAttribute('accept', ACEPTA);
    }
  }

  function envolverValidacion() {
    var original = window.isPdfFile_;
    if (typeof original !== 'function' || original.__adj) return;
    var envuelta = function (file) {
      if (documentoOk(file)) return true;
      return original.apply(this, arguments);
    };
    envuelta.__adj = true;
    window.isPdfFile_ = envuelta;
  }

  function arrancar() {
    ponerAccept();
    envolverValidacion();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', arrancar);
  else arrancar();

  setTimeout(arrancar, 1200);

  window.ADJUNTOS = {
    acepta: ACEPTA,
    campos: CAMPOS,
    documentoOk: documentoOk
  };
})();
