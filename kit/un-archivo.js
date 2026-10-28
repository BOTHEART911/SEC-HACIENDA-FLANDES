/* ============================================================
   KIT · UN ARCHIVO POR CAMPO (27/10/2026) · SEC-HACIENDA-FLANDES

   Regla ÚNICA para TODOS los campos de adjuntar de la app (los
   <input type="file"> de siempre, las casillas del kit de adjuntos,
   la factura de Notificar, las evidencias de ICA, soporte…):

     1. Ctrl+V con VARIOS archivos copiados → no se pega NADA y sale
        "Estás pegando más de un archivo: copia y pega solo uno".
     2. El archivo que entra (pegado, elegido o arrastrado) ya está
        puesto en OTRO campo del mismo formulario → no entra y se dice
        en cuál está. Así no se reparte el mismo grupo de archivos en
        campos diferentes ni se repite el mismo documento.
     3. Los campos de archivo nativos aceptan Ctrl+V cuando tienen el
        foco (antes el pegado no hacía nada en ellos).

   Cómo funciona
     Se carga justo después de kit/kit.js y escucha "paste" en la fase
     de CAPTURA de window: decide antes que cualquier otro escuchador
     (los del kit, Notificar o ICA viven en document). Si bloquea,
     corta el evento y nadie más lo ve.

     Las casillas que guardan el archivo en memoria (kit de adjuntos)
     le preguntan a KIT.unArchivo.repetido(zona, archivo) antes de
     aceptar. Los campos nativos se revisan en "change" (captura).

   Mismo archivo = mismo nombre (sin mayúsculas) y mismo peso.
   ============================================================ */
(function () {
  'use strict';

  if (window.__KIT_UNARCHIVO) return;
  window.__KIT_UNARCHIVO = true;

  var K = window.KIT || {};
  var MSG_VARIOS = 'Estás pegando más de un archivo: copia y pega solo uno.';

  var SCOPE = 'form, dialog, [role="dialog"], .swal2-popup, .kit-modal, .kit-hoja, .modal, [id^="view-"], .view';

  function aviso(t, tipo, ms) {
    try { if (window.KIT && window.KIT.aviso) return window.KIT.aviso(t, tipo || 'aviso', ms || 5000); } catch (_) {}
    try { if (window.Swal) return window.Swal.fire({ icon: 'warning', text: t, timer: ms || 5000 }); } catch (_) {}
  }

  function firma(f) {
    return f ? String(f.name || '').trim().toLowerCase() + '|' + Number(f.size || 0) : '';
  }

  /** Cuántos archivos trae el portapapeles (Chrome los da en items, Safari en files). */
  function archivosDe(dt) {
    if (!dt) return [];
    var out = [], i, f;
    var items = dt.items || [];
    for (i = 0; i < items.length; i++) {
      if (items[i].kind !== 'file') continue;
      f = items[i].getAsFile();
      if (f) out.push(f);
    }
    var fs = dt.files || [];
    if (fs.length > out.length) out = Array.prototype.slice.call(fs);
    return out;
  }

  function visible(el) { return !!(el && (el.offsetParent || el.getClientRects().length)); }

  function ambito(el) {
    return (el && el.closest && el.closest(SCOPE)) || document.body;
  }

  /** Nombre que la persona ve del campo (la etiqueta de arriba). */
  function rotulo(el) {
    if (!el) return 'otro campo';
    var t = '';
    if (el.id) {
      var l = document.querySelector('label[for="' + el.id + '"]');
      if (l) t = l.textContent;
    }
    if (!t && el.getAttribute) t = el.getAttribute('aria-label') || (el.dataset && el.dataset.etiqueta) || '';
    if (!t) {
      var p = el.previousElementSibling, n = 0;
      while (p && n < 3 && !t) { if (p.tagName === 'LABEL' || /^H\d$/.test(p.tagName)) t = p.textContent; p = p.previousElementSibling; n++; }
    }
    t = String(t || '').replace(/\(.*?\)/g, '').replace(/\s+/g, ' ').trim();
    return t ? '"' + t + '"' : 'otro campo';
  }

  /** Lista de [campo, firma] de lo que ya está puesto en el ámbito, menos `fuera`. */
  function puestos(scope, fuera) {
    var out = [];
    var ins = scope.querySelectorAll('input[type="file"]');
    for (var i = 0; i < ins.length; i++) {
      var inp = ins[i];
      if (inp === fuera || (fuera && fuera.contains && fuera.contains(inp))) continue;
      var fs = inp.files || [];
      for (var j = 0; j < fs.length; j++) out.push([inp, firma(fs[j])]);
    }
    var zs = scope.querySelectorAll('.kit-adj');
    for (var z = 0; z < zs.length; z++) {
      var zona = zs[z];
      if (zona === fuera || (fuera && fuera.contains && fuera.contains(zona))) continue;
      var api = zona.__kitAdjuntos;
      var lista = api && api.archivos ? api.archivos() : [];
      for (var k = 0; k < lista.length; k++) out.push([zona, firma(lista[k])]);
    }
    return out;
  }

  /**
   * ¿Este archivo ya está puesto en otro campo del mismo formulario?
   * Devuelve el texto del aviso, o '' si puede entrar.
   */
  function repetido(campo, f) {
    var fi = firma(f);
    if (!fi) return '';
    var scope = ambito(campo);
    /* un campo suelto (los ocultos que se crean para "Agregar" del visor) no tiene formulario */
    if (scope === document.body) return '';
    var ps = puestos(scope, campo);
    for (var i = 0; i < ps.length; i++) {
      if (ps[i][1] === fi) {
        return '"' + (f.name || 'Ese archivo') + '" ya está puesto en ' + rotulo(ps[i][0]) +
               ' de este formulario. Copia y pega otro.';
      }
    }
    return '';
  }

  function cortar(e) {
    e.preventDefault();
    e.stopPropagation();
    if (e.stopImmediatePropagation) e.stopImmediatePropagation();
  }

  /* El campo que se quedaría el pegado: casilla activa del kit, o el input con foco. */
  function destino() {
    var a = document.activeElement;
    if (a && a.tagName === 'INPUT' && a.type === 'file') return a;
    var z = document.querySelector('.kit-adj.kit-adj--activa');
    if (z && visible(z)) return z;
    if (a && a.closest) {
      var dentro = a.closest('.kit-adj');
      if (dentro) return dentro;
    }
    return null;
  }

  /* ── 1 y 3 · PEGAR ── */
  window.addEventListener('paste', function (e) {
    var fs = archivosDe(e.clipboardData);
    if (!fs.length) return;                    /* texto: el pegado es de quien escribe */

    if (fs.length > 1) {
      cortar(e);
      aviso(MSG_VARIOS, 'aviso', 5000);
      try { if (navigator.vibrate) navigator.vibrate(20); } catch (_) {}
      return;
    }

    var d = destino();
    if (!d) return;                            /* Notificar/ICA deciden su propia zona */

    var motivo = repetido(d, fs[0]);
    if (motivo) { cortar(e); aviso(motivo, 'aviso', 6000); return; }

    /* campo nativo con foco: el navegador no pega archivos ahí; se le pone a mano */
    if (d.tagName === 'INPUT') {
      cortar(e);
      try {
        var dt = new DataTransfer();
        dt.items.add(fs[0]);
        d.files = dt.files;
        d.dispatchEvent(new Event('input', { bubbles: true }));
        d.dispatchEvent(new Event('change', { bubbles: true }));
      } catch (_) {
        aviso('Este navegador no deja pegar aquí: toca el campo y elige el archivo.', 'aviso', 5000);
      }
    }
  }, true);

  /* ── 2 · ELEGIR o ARRASTRAR sobre un campo nativo ── */
  document.addEventListener('change', function (e) {
    var inp = e.target;
    if (!inp || inp.tagName !== 'INPUT' || inp.type !== 'file') return;
    if (inp.closest && inp.closest('.kit-adj')) return;   /* el kit lo revisa en su cabe() */
    var fs = inp.files || [];
    for (var i = 0; i < fs.length; i++) {
      var motivo = repetido(inp, fs[i]);
      if (motivo) {
        e.stopPropagation();
        if (e.stopImmediatePropagation) e.stopImmediatePropagation();
        try { inp.value = ''; } catch (_) {}
        aviso(motivo, 'aviso', 6000);
        return;
      }
    }
  }, true);

  var api = { repetido: repetido, archivosDe: archivosDe, MSG_VARIOS: MSG_VARIOS };
  window.UN_ARCHIVO = api;
  if (window.KIT) window.KIT.unArchivo = api;
}());
