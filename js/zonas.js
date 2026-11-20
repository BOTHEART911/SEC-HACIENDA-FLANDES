/* ============================================================
   SEC-HACIENDA-FLANDES · RESIDENCIAS DESDE LA HOJA ZONAS (20/11/2026)

   Antes el select «Residencia» de AGREGAR ATENCIÓN PREDIAL traía 132
   nombres escritos a mano en index.html: lo que se agregaba en la hoja
   ZONAS nunca llegaba (faltaban SAN FERNANDO DE SEGOVIA, SANTA HAGIA
   SOFIA y SANTORINI).

   Ahora:
   · la lista viaja en la MISMA respuesta de entrada (login / loginpin /
     perfil), sin viaje nuevo: se manda el sello que tiene el equipo ('zv')
     y el backend (Zonas1120.gs) solo devuelve la lista si cambió;
   · queda recordada en el equipo y se pinta al instante al abrir la vista;
   · si el backend aún no trae 'zonas', sigue la lista del HTML.
   ============================================================ */
(function () {
  'use strict';
  var LLAVE = 'hacflandes.zonas.v1';
  var ACC = { login: 1, loginpin: 1, perfil: 1 };

  function leer() {
    try { var z = JSON.parse(localStorage.getItem(LLAVE) || 'null'); if (z && z.v && Array.isArray(z.l) && z.l.length) return z; } catch (_) {}
    return null;
  }
  function guardar(z) { try { localStorage.setItem(LLAVE, JSON.stringify({ v: z.v, l: z.l })); } catch (_) {} }

  var actual = leer();

  function pintar(lista) {
    var sel = document.getElementById('upd-residencia');
    if (!sel || !lista || !lista.length) return;
    var previo = String(sel.value || '');
    var ch = null;
    try { ch = (0, eval)('typeof choicesResidencia !== "undefined" ? choicesResidencia : null'); } catch (_) {}
    if (ch) {
      try {
        ch.clearChoices();
        ch.setChoices(
          [{ value: '', label: 'Selecciona tu Residencia', disabled: true, selected: !previo }]
            .concat(lista.map(function (n) { return { value: n, label: n, selected: n === previo }; })),
          'value', 'label', true);
        return;
      } catch (_) { /* si Choices falla se reescriben las opciones */ }
    }
    var frag = document.createDocumentFragment();
    var o0 = document.createElement('option');
    o0.value = ''; o0.disabled = true; o0.selected = !previo; o0.textContent = 'Selecciona tu Residencia';
    frag.appendChild(o0);
    lista.forEach(function (n) {
      var o = document.createElement('option');
      o.value = n; o.textContent = n; if (n === previo) o.selected = true;
      frag.appendChild(o);
    });
    sel.innerHTML = '';
    sel.appendChild(frag);
  }

  function recibir(r) {
    var z = r && r.zonas;
    if (!z || !z.v) return;
    if (Array.isArray(z.l) && z.l.length) {
      actual = { v: z.v, l: z.l };
      guardar(actual);
      pintar(actual.l);
    }
  }

  function envolver() {
    var original = window.apiGet;
    if (typeof original !== 'function' || original.__zonas) return;
    var envuelta = function (accion, params) {
      var a = String(accion || '').toLowerCase();
      if (!ACC[a]) return original.apply(this, arguments);
      var p = {};
      for (var k in (params || {})) if (Object.prototype.hasOwnProperty.call(params, k)) p[k] = params[k];
      p.zv = actual ? actual.v : '0';
      return Promise.resolve(original.call(this, accion, p)).then(function (r) {
        try { recibir(r); } catch (_) {}
        return r;
      });
    };
    envuelta.__zonas = true;
    window.apiGet = envuelta;
  }

  envolver();
  /* lo recordado se pinta antes de que Choices arme el select */
  if (actual) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { pintar(actual.l); });
    else pintar(actual.l);
  }
  window.HAC_ZONAS = { lista: function () { return actual ? actual.l.slice() : null; }, pintar: pintar };
})();
