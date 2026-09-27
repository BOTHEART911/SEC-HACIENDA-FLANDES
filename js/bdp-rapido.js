/* ============================================================
   BDP-RÁPIDO — LOTE 08/09/2026 · SEC-HACIENDA

   El problema (medido, no supuesto)
     Desde la Fase 7 el listado de BD Predial viaja LIGERO (22 campos) y
     las 41 columnas se piden al abrir Ver / Editar / Decisión /
     Expediente. Esa petición (`getpredial`) abre el libro y recorre las
     9.458 celdas de la columna A para encontrar la fila… aunque la
     tarjeta YA sabe en qué fila está (`rowIndex` viaja en el listado
     desde la Fase 7 y nadie lo usaba). Resultado: varios segundos de
     espera con la vista tapada por el esqueleto en CADA clic.

   Qué hace este archivo (tres cosas, ninguna toca app.js)
     1) LISTADO COMPACTO. Pide `listpredial` con `fmt=2`: el servidor
        manda los nombres de los campos UNA vez y las filas como
        arreglos, y aquí se rearman los objetos de siempre. Para quien
        ve las 9.459 filas el viaje baja de ~5,6 MB a ~1,9 MB. Si el
        servidor todavía es el viejo y responde una lista de objetos,
        se deja pasar tal cual.
     2) FILA CONOCIDA. `getpredial` se llama con `fila` (el rowIndex de
        la tarjeta) y con `uid`, para que el servidor no tenga que
        buscar la fila y sí pueda comprobar el alcance.
     3) PRECARGA DE LA PÁGINA. Al terminar de pintar una página (100
        tarjetas) se piden en SEGUNDO PLANO las filas completas de lo
        que está en pantalla, de una sola lectura. Cuando el usuario
        toca Ver, el dato ya está: cero viaje.

   Detalles que importan
     · La precarga usa fetch propio, NO apiGet: pasar por apiGet
       encendería el esqueleto de la Fase 10 y el candado de la capa 12
       en una lectura de fondo que no debe tapar nada (mismo criterio
       que la capa 11 para la voz).
     · Si la precarga falla o llega tarde, el clic funciona exactamente
       como hoy. Es una mejora, nunca una dependencia.
   ============================================================ */
(function () {
  'use strict';

  if (window.__HACRAPIDO_LISTO) return;
  window.__HACRAPIDO_LISTO = true;

  /* Cuántas filas se piden por precarga. La página son 100 tarjetas;
     el servidor corta en 300 por si acaso. */
  var TOPE_BLOQUE = 100;

  /* ══════════════ utilidades ══════════════ */

  function base() {
    try { if (typeof API_BASE === 'string' && API_BASE) return API_BASE; } catch (e) {}
    return '';
  }

  function uid() {
    try {
      if (typeof uidActual_ === 'function') {
        var u = uidActual_();
        if (u) return u;
      }
    } catch (e) {}
    try {
      var p = window.IDN && window.IDN.perfil ? window.IDN.perfil() : null;
      if (p && p.uid) return p.uid;
    } catch (e) {}
    return '';
  }

  /* Petición de fondo: sin loader, sin esqueleto, sin candado. */
  function pedir(accion, params) {
    var u = base();
    if (!u) return Promise.reject(new Error('Sin conexión configurada.'));
    var p = {};
    for (var k in (params || {})) {
      if (Object.prototype.hasOwnProperty.call(params, k)) p[k] = params[k];
    }
    p.action = accion;
    return fetch(u + '?' + new URLSearchParams(p).toString(), { method: 'GET' })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (!j || !j.ok) throw new Error((j && j.error) || 'Error');
        return j.data;
      });
  }

  /* ══════════════ 1 · listado compacto ══════════════ */

  /** { fmt:2, campos:[...], filas:[[...]] } → [ {campo:valor}, ... ]
   *  Cualquier otra cosa (incluida una lista de objetos del servidor
   *  viejo) se devuelve intacta. Es idempotente a propósito. */
  function rehidratar(data) {
    if (!data || Array.isArray(data)) return data;
    if (Number(data.fmt) !== 2 ||
        !Array.isArray(data.campos) || !Array.isArray(data.filas)) return data;

    var campos = data.campos;
    var nc = campos.length;
    var filas = data.filas;
    var out = new Array(filas.length);
    for (var i = 0; i < filas.length; i++) {
      var f = filas[i] || [];
      var o = {};
      for (var c = 0; c < nc; c++) o[campos[c]] = f[c];
      out[i] = o;
    }
    return out;
  }

  function envolverApiGet() {
    var original = window.apiGet;
    if (typeof original !== 'function' || original.__rapido) return;

    var envuelta = function (accion, params) {
      if (String(accion || '').toLowerCase() !== 'listpredial') {
        return original.apply(this, arguments);
      }
      var p = {};
      for (var k in (params || {})) {
        if (Object.prototype.hasOwnProperty.call(params, k)) p[k] = params[k];
      }
      p.fmt = '2';
      return Promise.resolve(original.call(this, accion, p)).then(rehidratar);
    };
    envuelta.__rapido = true;
    window.apiGet = envuelta;
  }

  /* ══════════════ 2 · la fila completa ══════════════ */

  function envolverFilaCompleta() {
    var original = window.bdpFilaCompleta_;
    if (typeof original !== 'function' || original.__rapido) return;

    var envuelta = function (row) {
      if (!row) return original.apply(this, arguments);
      if (row.__completa) return Promise.resolve(row);

      var n = Number(row.rowIndex) || 0;
      if (n < 2) return original.apply(this, arguments);

      return window.apiGet('getpredial', {
        id_predial: row.id_predial,
        fila: n,
        uid: uid()
      }).then(function (full) {
        if (full && full.id_predial) {
          Object.assign(row, full);
          row.__completa = true;
        }
        return row;
      }).catch(function (e) {
        try {
          Swal.fire({ icon: 'error', title: 'No se pudo abrir',
                      text: String((e && e.message) || e) });
        } catch (_) {}
        return null;
      });
    };
    envuelta.__rapido = true;
    window.bdpFilaCompleta_ = envuelta;
  }

  /* ══════════════ 3 · precarga de la página visible ══════════════ */

  /* __bdpFilteredCache es un `let` de app.js: no vive en window, pero sí
     en el ámbito global del documento. Si no está (app.js no cargó), no
     se precarga nada y todo sigue funcionando como hoy. */
  function listaActual() {
    try {
      if (typeof __bdpFilteredCache !== 'undefined' &&
          Array.isArray(__bdpFilteredCache)) return __bdpFilteredCache;
    } catch (e) {}
    return null;
  }

  var enVuelo = false;

  function precargarVisible() {
    if (enVuelo) return;
    var lista = listaActual();
    if (!lista || !lista.length) return;

    var tarjetas = document.querySelectorAll('#bdp-list [data-bdp-idx]');
    if (!tarjetas.length) return;

    var filas = [];
    var porFila = {};
    for (var i = 0; i < tarjetas.length && filas.length < TOPE_BLOQUE; i++) {
      var row = lista[Number(tarjetas[i].getAttribute('data-bdp-idx'))];
      if (!row || row.__completa || row.__pidiendo) continue;
      var n = Number(row.rowIndex) || 0;
      if (n < 2 || porFila[n]) continue;
      porFila[n] = row;
      filas.push(n);
    }
    if (!filas.length) return;

    var u = uid();
    if (!u) return;

    enVuelo = true;
    filas.forEach(function (n) { porFila[n].__pidiendo = true; });

    pedir('getpredialbloque', { uid: u, filas: filas.join(',') })
      .then(function (llegaron) {
        (llegaron || []).forEach(function (full) {
          var row = porFila[Number(full && full.rowIndex)];
          /* El id tiene que cuadrar: si alguien borró una fila entre
             medias, se prefiere no precargar antes que mezclar datos. */
          if (row && full && String(row.id_predial) === String(full.id_predial)) {
            Object.assign(row, full);
            row.__completa = true;
          }
        });
      })
      .catch(function () { /* en silencio: el clic sigue funcionando */ })
      .then(function () {
        enVuelo = false;
        filas.forEach(function (n) {
          if (porFila[n]) porFila[n].__pidiendo = false;
        });
      });
  }

  function envolverPintado() {
    var original = window.bdpPaintPage_;
    if (typeof original !== 'function' || original.__rapido) return;

    var envuelta = function () {
      var r = original.apply(this, arguments);
      try { setTimeout(precargarVisible, 0); } catch (e) {}
      return r;
    };
    envuelta.__rapido = true;
    window.bdpPaintPage_ = envuelta;
  }

  /* ══════════════ arranque ══════════════ */

  function arrancar() {
    envolverApiGet();
    envolverFilaCompleta();
    envolverPintado();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', arrancar);
  } else {
    arrancar();
  }

  /* Otras capas envuelven apiGet más tarde; se vuelve a envolver por si
     alguna llegó después. Es idempotente (marca __rapido) y rehidratar
     no hace nada sobre una lista ya rearmada. */
  setTimeout(arrancar, 1500);

  /* Puerta para las pruebas. */
  window.BDPRAPIDO = {
    rehidratar: rehidratar,
    precargar: precargarVisible,
    arrancar: arrancar
  };
})();
