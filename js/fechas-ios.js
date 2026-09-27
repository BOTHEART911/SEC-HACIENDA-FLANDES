/* ============================================================
   FECHAS ESTILO iOS — FASE 13 · SEC-HACIENDA

   Qué hace
     Una sola rueda (como la de SEP-GROUP) para TODOS los campos de
     fecha de la app. Reemplaza en caliente los tres selectores que
     existían y convierte los <input type="date"> nativos.

   Lo que NO cambia (condiciones de cada campo, tal cual estaban)
     · Debe Desde ................ solo AÑO, del actual hacia 1975, guarda YYYY01
     · 4 fechas de BD Predial .... día/mes/año, del actual hacia 2010, dd/mm/yyyy
     · 5 fechas de Asignaciones .. día/mes, AÑO FIJO 2026, dd/mm/2026
     · Seguimiento (2 campos) .... respeta el `min` (hoy) del input; value en ISO
     · Descargas (desde/hasta) ... value en ISO, admite fechas pasadas

   Cómo respeta el value ISO
     Los <input type="date"> pasan a type="text" (para que el
     navegador no abra su propio calendario) y se les redefine la
     propiedad `value`: al leerla devuelve ISO — que es lo que
     espera app.js y js/descargas.js — y al escribirla se repinta
     el texto en dd/mm/aaaa. `min`, `max` y el evento `change`
     siguen funcionando igual.

   No modifica app.js, index.html ni descargas.js.
   ============================================================ */
(function () {
  'use strict';

  if (window.__HACFEC_LISTO) return;
  window.__HACFEC_LISTO = true;

  var ALTO = 42;   /* alto de cada fila de la rueda (debe casar con el CSS) */
  var MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
               'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

  var estado = null;   /* { cols, opts } mientras la rueda está abierta */
  var overlay = null;

  /* ---------- utilidades de fecha ---------- */

  function pad(n) { return String(n).padStart(2, '0'); }
  function hoy() { var d = new Date(); return { y: d.getFullYear(), m: d.getMonth() + 1, d: d.getDate() }; }
  function diasDelMes(y, m) { return new Date(y, m, 0).getDate(); }
  function num(a, b, c) { return a * 10000 + b * 100 + c; }

  function deISO(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || ''));
    return m ? { y: +m[1], m: +m[2], d: +m[3] } : null;
  }
  function deDDMMYYYY(s) {
    var m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(s || '').trim());
    return m ? { y: +m[3], m: +m[2], d: +m[1] } : null;
  }
  function aISO(f) { return f.y + '-' + pad(f.m) + '-' + pad(f.d); }
  function aDDMMYYYY(f) { return pad(f.d) + '/' + pad(f.m) + '/' + f.y; }

  /* ---------- la hoja ---------- */

  function nodo(html) {
    var d = document.createElement('div');
    d.innerHTML = html;
    return d.firstElementChild;
  }

  function cerrar() {
    if (!overlay) return;
    var o = overlay; overlay = null; estado = null;
    o.classList.remove('iosf-on');
    setTimeout(function () { if (o.parentNode) o.remove(); }, 160);
    document.removeEventListener('keydown', escTecla);
  }
  function escTecla(ev) { if (ev.key === 'Escape') cerrar(); }

  function seleccionado(colEl) {
    return Math.max(0, Math.round(colEl.scrollTop / ALTO));
  }
  function marcar(colEl) {
    var i = seleccionado(colEl);
    var items = colEl.querySelectorAll('.iosf-item');
    for (var k = 0; k < items.length; k++) {
      items[k].classList.toggle('sel', +items[k].dataset.i === i);
    }
  }

  /* Construye una columna. `items` = [{v, txt}] */
  function construir(colEl, items, idxInicial, alQuedar) {
    colEl.innerHTML = '<div class="iosf-pad"></div>' +
      items.map(function (it, i) {
        return '<div class="iosf-item" data-i="' + i + '">' + it.txt + '</div>';
      }).join('') +
      '<div class="iosf-pad"></div>';
    colEl.__items = items;
    colEl.__alQuedar = alQuedar || null;
    colEl.scrollTop = Math.max(0, idxInicial) * ALTO;
    marcar(colEl);

    var t = null;
    colEl.onscroll = function () {
      marcar(colEl);
      if (t) clearTimeout(t);
      t = setTimeout(function () {
        var i = seleccionado(colEl);
        colEl.scrollTo({ top: i * ALTO, behavior: 'smooth' });
        if (alQuedar) alQuedar(i);
      }, 90);
    };

    var filas = colEl.querySelectorAll('.iosf-item');
    for (var k = 0; k < filas.length; k++) {
      filas[k].addEventListener('click', function () {
        var i = +this.dataset.i;
        colEl.scrollTop = i * ALTO;      /* instantáneo: lectura fiable */
        marcar(colEl);
        if (alQuedar) alQuedar(i);
      });
    }
  }

  function valorDe(colEl) {
    var items = colEl.__items || [];
    if (!items.length) return null;
    return items[Math.min(seleccionado(colEl), items.length - 1)].v;
  }

  /* ---------- cotas ---------- */

  function dentro(o, y, m, d) {
    var v = num(y, m, d);
    if (o.min && v < num(o.min.y, o.min.m, o.min.d)) return false;
    if (o.max && v > num(o.max.y, o.max.m, o.max.d)) return false;
    return true;
  }

  function aniosDe(o) {
    var out = [];
    for (var y = o.anioDesde; y <= o.anioHasta; y++) out.push(y);
    if (o.descendente) out.reverse();
    return out.map(function (y) { return { v: y, txt: String(y) }; });
  }
  function mesesDe(o, y) {
    var out = [];
    for (var m = 1; m <= 12; m++) {
      /* un mes vale si al menos un día suyo entra en la cota */
      var ok = false;
      var tot = diasDelMes(y, m);
      for (var d = 1; d <= tot; d++) { if (dentro(o, y, m, d)) { ok = true; break; } }
      if (ok) out.push({ v: m, txt: MESES[m - 1] });
    }
    return out;
  }
  function diasDe(o, y, m) {
    var out = [];
    var tot = diasDelMes(y, m);
    for (var d = 1; d <= tot; d++) if (dentro(o, y, m, d)) out.push({ v: d, txt: pad(d) });
    return out;
  }

  function indiceDe(items, valor, porDefecto) {
    for (var i = 0; i < items.length; i++) if (items[i].v === valor) return i;
    return porDefecto || 0;
  }

  /**
   * abrir({
   *   titulo, soloAnio, anioFijo, anioDesde, anioHasta, descendente,
   *   min:{y,m,d}, max:{y,m,d}, valor:{y,m,d}, onOk(fecha)
   * })
   */
  function abrir(o) {
    if (overlay) return;
    o = o || {};
    var h = hoy();
    var val = o.valor || null;

    if (o.anioFijo) { o.anioDesde = o.anioFijo; o.anioHasta = o.anioFijo; }
    if (!o.anioDesde) o.anioDesde = h.y;
    if (!o.anioHasta) o.anioHasta = h.y;
    if (o.anioHasta < o.anioDesde) o.anioHasta = o.anioDesde;

    var conAnio = !o.anioFijo;
    var y = (val && val.y >= o.anioDesde && val.y <= o.anioHasta) ? val.y
          : (o.anioFijo || (h.y >= o.anioDesde && h.y <= o.anioHasta ? h.y : o.anioHasta));
    var m = val ? val.m : h.m;
    var d = val ? val.d : h.d;

    overlay = nodo(
      '<div class="iosf-wrap" data-salida role="dialog" aria-modal="true" aria-label="Seleccionar fecha">' +
      '  <div class="iosf-fondo"></div>' +
      '  <section class="iosf-hoja">' +
      '    <header class="iosf-h">' +
      '      <span class="iosf-t">' + (o.titulo || 'Fecha') + '</span>' +
      (o.anioFijo ? '<span class="iosf-anio">' + o.anioFijo + '</span>' : '') +
      '    </header>' +
      '    <div class="iosf-ruedas">' +
      '      <div class="iosf-marca"></div>' +
      (o.soloAnio ? '' :
        '      <div class="iosf-col-wrap"><button type="button" class="iosf-fl" data-col="dia" data-d="-1">▲</button>' +
        '        <div class="iosf-col" id="iosf-dia"></div>' +
        '        <button type="button" class="iosf-fl" data-col="dia" data-d="1">▼</button></div>' +
        '      <div class="iosf-col-wrap"><button type="button" class="iosf-fl" data-col="mes" data-d="-1">▲</button>' +
        '        <div class="iosf-col" id="iosf-mes"></div>' +
        '        <button type="button" class="iosf-fl" data-col="mes" data-d="1">▼</button></div>') +
      (conAnio ?
        '      <div class="iosf-col-wrap"><button type="button" class="iosf-fl" data-col="anio" data-d="-1">▲</button>' +
        '        <div class="iosf-col" id="iosf-anio"></div>' +
        '        <button type="button" class="iosf-fl" data-col="anio" data-d="1">▼</button></div>' : '') +
      '    </div>' +
      '    <footer class="iosf-pie">' +
      '      <button type="button" class="iosf-ok">Listo</button>' +
      '      <button type="button" class="iosf-cancel">Cancelar</button>' +
      '    </footer>' +
      '  </section>' +
      '</div>'
    );

    document.body.appendChild(overlay);
    /* IMPORTANTE (trampa heredada de SEP-GROUP): el overlay tiene que
       estar VISIBLE antes de fijar scrollTop, o la rueda se queda en 0. */
    overlay.classList.add('iosf-on');

    estado = { o: o };

    var colAnio = overlay.querySelector('#iosf-anio');
    var colMes  = overlay.querySelector('#iosf-mes');
    var colDia  = overlay.querySelector('#iosf-dia');

    function rehacerDias() {
      if (!colDia) return;
      var yy = colAnio ? valorDe(colAnio) : (o.anioFijo || y);
      var mm = colMes ? valorDe(colMes) : m;
      var actual = valorDe(colDia);
      var items = diasDe(o, yy, mm);
      if (!items.length) items = [{ v: 1, txt: '01' }];
      construir(colDia, items, indiceDe(items, actual, 0));
    }
    function rehacerMeses() {
      if (!colMes) return;
      var yy = colAnio ? valorDe(colAnio) : (o.anioFijo || y);
      var actual = valorDe(colMes);
      var items = mesesDe(o, yy);
      if (!items.length) items = [{ v: 1, txt: MESES[0] }];
      construir(colMes, items, indiceDe(items, actual, 0), rehacerDias);
      rehacerDias();
    }

    if (colAnio) {
      var itemsA = aniosDe(o);
      construir(colAnio, itemsA, indiceDe(itemsA, y, 0), function () { rehacerMeses(); });
    }
    if (colMes) {
      var itemsM = mesesDe(o, y);
      construir(colMes, itemsM, indiceDe(itemsM, m, 0), rehacerDias);
    }
    if (colDia) {
      var itemsD = diasDe(o, y, m);
      construir(colDia, itemsD, indiceDe(itemsD, d, 0));
    }

    overlay.querySelector('.iosf-fondo').addEventListener('click', cerrar);
    overlay.querySelector('.iosf-cancel').addEventListener('click', cerrar);
    document.addEventListener('keydown', escTecla);

    var flechas = overlay.querySelectorAll('.iosf-fl');
    for (var k = 0; k < flechas.length; k++) {
      flechas[k].addEventListener('click', function () {
        var col = overlay.querySelector('#iosf-' + this.dataset.col);
        if (!col) return;
        var n = (col.__items || []).length;
        var i = Math.min(Math.max(seleccionado(col) + (+this.dataset.d), 0), n - 1);
        col.scrollTop = i * ALTO;
        marcar(col);
        if (this.dataset.col === 'anio') rehacerMeses();
        if (this.dataset.col === 'mes') rehacerDias();
      });
    }

    overlay.querySelector('.iosf-ok').addEventListener('click', function () {
      /* Leer TODO antes de cerrar: con el contenedor oculto, scrollTop = 0. */
      var yy = colAnio ? valorDe(colAnio) : (o.anioFijo || y);
      var mm = colMes ? valorDe(colMes) : 1;
      var dd = colDia ? valorDe(colDia) : 1;
      var fn = o.onOk;
      cerrar();
      if (fn) fn({ y: yy, m: mm, d: dd });
    });
  }

  /* ============================================================
     1) Debe Desde — solo AÑO (actual → 1975), guarda YYYY01
     ============================================================ */
  function montarAnio() {
    window.abrirBDPAnio_ = function () {
      var inp = document.getElementById('bdp-debe-desde-raw');
      var actual = String((inp && inp.value) || '').replace(/\D/g, '');
      var y = actual.length >= 4 ? +actual.slice(0, 4) : new Date().getFullYear();
      abrir({
        titulo: 'Debe desde',
        soloAnio: true,
        anioDesde: 1975,
        anioHasta: new Date().getFullYear(),
        descendente: true,
        valor: { y: y, m: 1, d: 1 },
        onOk: function (f) {
          var yyyymm = String(f.y) + '01';
          var vis = document.getElementById('bdp-debe-desde');
          var raw = document.getElementById('bdp-debe-desde-raw');
          if (vis) {
            vis.value = (typeof window.bdpFormatDebeDesde_ === 'function')
              ? window.bdpFormatDebeDesde_(yyyymm) : yyyymm;
          }
          if (raw) raw.value = yyyymm;
        }
      });
    };
  }

  /* ============================================================
     2) Las 4 fechas de BD Predial — dd/mm/yyyy (actual → 2010)
     ============================================================ */
  var MAPA_BDP = {
    'fecha-oficio-persuas': 'bdp-fecha-oficio-persuas',
    'fecha-entrega':        'bdp-fecha-entrega',
    'fecha-resolucion':     'bdp-fecha-resolucion',
    'fecha-oficio':         'bdp-fecha-oficio'
  };

  function montarBDPFecha() {
    window.abrirBDPFecha_ = function (target) {
      var id = MAPA_BDP[target];
      var el = id ? document.getElementById(id) : null;
      abrir({
        titulo: 'Selecciona la fecha',
        anioDesde: 2010,
        anioHasta: new Date().getFullYear(),
        descendente: true,
        valor: el ? deDDMMYYYY(el.value) : null,
        onOk: function (f) { if (el) el.value = aDDMMYYYY(f); }
      });
    };
  }

  /* ============================================================
     3) Las 5 fechas de Asignaciones — dd/mm, AÑO FIJO 2026
     ============================================================ */
  var ANIO_PROC = 2026;          /* misma condición que tenía app.js */
  var MAPA_PROC = {
    'recibido':       'proc-recibido',
    'respuesta':      'proc-respuesta',
    'edit-recibido':  'edit-recibido',
    'edit-respuesta': 'edit-respuesta',
    'edit-cierre':    'edit-cierre'
  };

  function montarProcPicker() {
    var fn = function (target) {
      var id = MAPA_PROC[target];
      var el = id ? document.getElementById(id) : null;
      var v = el ? deDDMMYYYY(el.value) : null;
      abrir({
        titulo: 'Selecciona la fecha',
        anioFijo: ANIO_PROC,
        valor: v ? { y: ANIO_PROC, m: v.m, d: v.d } : null,
        onOk: function (f) { if (el) el.value = pad(f.d) + '/' + pad(f.m) + '/' + ANIO_PROC; }
      });
    };
    window.abrirProcPicker_ = fn;
    window.abrirProcPicker = fn;
  }

  /* ============================================================
     4) Los <input type="date"> nativos (seguimiento y descargas)
     ============================================================ */
  function convertir(el) {
    if (!el || el.__iosf) return;
    el.__iosf = true;

    var minAttr = el.getAttribute('min') || '';
    var maxAttr = el.getAttribute('max') || '';
    var iso = el.value || '';

    el.type = 'text';
    el.readOnly = true;
    el.classList.add('iosf-input');
    el.setAttribute('inputmode', 'none');
    el.setAttribute('autocomplete', 'off');
    if (!el.placeholder) el.placeholder = 'dd/mm/aaaa';

    var guardado = iso;

    function pintar() {
      var f = deISO(guardado);
      el.setAttribute('data-iso', guardado || '');
      /* el texto visible se escribe con el setter NATIVO, porque el de la
         instancia se redefinió para hablar en ISO */
      try { descriptorTexto.set.call(el, f ? aDDMMYYYY(f) : ''); } catch (_) {}
    }

    var descriptorTexto = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');

    Object.defineProperty(el, 'value', {
      configurable: true,
      get: function () { return guardado; },
      set: function (v) {
        var s = String(v == null ? '' : v);
        guardado = deISO(s) ? s.slice(0, 10) : '';
        pintar();
      }
    });

    pintar();

    function abrirRueda(ev) {
      if (ev) { ev.preventDefault(); ev.stopPropagation(); }
      if (el.disabled) return;
      var h = hoy();
      var min = deISO(el.getAttribute('min') || minAttr);
      var max = deISO(el.getAttribute('max') || maxAttr);
      var desde = min ? min.y : (h.y - 15);
      var hasta = max ? max.y : (h.y + 3);
      if (hasta < desde) hasta = desde;
      abrir({
        titulo: 'Selecciona la fecha',
        anioDesde: desde,
        anioHasta: hasta,
        descendente: !max && !min ? true : (hasta === h.y),
        min: min, max: max,
        valor: deISO(guardado),
        onOk: function (f) {
          el.value = aISO(f);
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        }
      });
    }

    el.addEventListener('mousedown', abrirRueda);
    el.addEventListener('click', abrirRueda);
    el.addEventListener('focus', function () { el.blur(); });
    el.addEventListener('keydown', function (ev) { ev.preventDefault(); });
  }

  function convertirTodos(raiz) {
    var lista = (raiz || document).querySelectorAll('input[type="date"]');
    for (var i = 0; i < lista.length; i++) convertir(lista[i]);
  }

  function vigilar() {
    if (!window.MutationObserver) return;
    new MutationObserver(function (muts) {
      for (var i = 0; i < muts.length; i++) {
        var nuevos = muts[i].addedNodes || [];
        for (var k = 0; k < nuevos.length; k++) {
          var n = nuevos[k];
          if (!n || n.nodeType !== 1) continue;
          if (n.matches && n.matches('input[type="date"]')) convertir(n);
          else if (n.querySelectorAll) convertirTodos(n);
        }
      }
    }).observe(document.documentElement, { childList: true, subtree: true });
  }

  /* ---------- arranque ---------- */

  function montar() {
    montarAnio();
    montarBDPFecha();
    montarProcPicker();
    convertirTodos(document);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { montar(); vigilar(); });
  } else {
    montar(); vigilar();
  }
  window.addEventListener('load', montar);

  /* Puerta de pruebas */
  window.__hacFEC = {
    abrir: abrir,
    cerrar: cerrar,
    convertir: convertir,
    convertirTodos: convertirTodos,
    montar: montar,
    hoja: function () { return overlay; },
    columnas: function () {
      if (!overlay) return null;
      var r = {};
      ['dia', 'mes', 'anio'].forEach(function (c) {
        var el = overlay.querySelector('#iosf-' + c);
        r[c] = el ? (el.__items || []).map(function (i) { return i.v; }) : null;
      });
      return r;
    },
    elegir: function (col, valor) {
      var el = overlay && overlay.querySelector('#iosf-' + col);
      if (!el) return false;
      var items = el.__items || [];
      for (var i = 0; i < items.length; i++) {
        if (items[i].v === valor) {
          el.scrollTop = i * ALTO; marcar(el);
          if (el.__alQuedar) el.__alQuedar(i);
          return true;
        }
      }
      return false;
    },
    aceptar: function () {
      if (!overlay) return;
      overlay.querySelector('.iosf-ok').click();
    }
  };
})();
