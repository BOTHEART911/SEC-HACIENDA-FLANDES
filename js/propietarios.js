/* ============================================================
   VARIOS PROPIETARIOS — 22/10/2026 · SEC-HACIENDA-FLANDES · BD Predial

   Agregar y Editar expediente: el 1.er propietario usa los campos de
   siempre (Nombres, NIT o cédula, Correo). "Agregar otro propietario"
   abre una fila con 3 campos opcionales — del 2.º al 9.º.

   Reglas (las mismas del servidor, Notificar.gs · PROP_normalizar_):
     · fila con nombre + NIT/CC  → propietario (va como destinatario);
     · fila con SOLO correo       → copia (va en CC al notificar);
     · cualquier otra combinación no deja guardar;
     · fila vacía = no existe.
   Se guardan en las MISMAS columnas, un valor por línea (línea i de
   NOMBRES, NIT y CORREO = propietario i).

   Quitar una fila con datos pide confirmación. Todo es local: cero viajes.
   ============================================================ */
(function () {
  'use strict';
  if (window.PROP) return;
  var MAX = 9;

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }
  function ico(n, t) { try { return window.ICO_ ? window.ICO_(n, t || 18) : ''; } catch (_) { return ''; } }
  function lineas(v) { return String(v == null ? '' : v).replace(/\r\n?/g, '\n').split('\n').map(function (x) { return x.trim(); }); }
  function digitos(v) { return String(v || '').replace(/\D/g, ''); }
  function correoOk(c) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(c || '').trim()); }
  var ORD = ['', '1.er', '2.º', '3.er', '4.º', '5.º', '6.º', '7.º', '8.º', '9.º'];

  function soporta() { return !!(window.HAC_PUBLICO && window.HAC_PUBLICO.prop); }
  function zona() { return $('bdp-props-extra'); }
  function filas() { var z = zona(); return z ? Array.prototype.slice.call(z.querySelectorAll('.bdp-prop')) : []; }

  function renumerar() {
    filas().forEach(function (f, i) {
      var k = i + 2;
      f.setAttribute('data-k', k);
      f.querySelector('.bdp-prop__tit b').textContent = ORD[k] + ' propietario';
      f.querySelector('[data-p=nom]').setAttribute('aria-label', 'Nombres del ' + ORD[k] + ' propietario');
      f.querySelector('[data-p=doc]').setAttribute('aria-label', 'NIT o cédula del ' + ORD[k] + ' propietario');
      f.querySelector('[data-p=cor]').setAttribute('aria-label', 'Correo del ' + ORD[k] + ' propietario');
    });
    var b = $('btn-bdp-prop-mas');
    if (b) {
      var n = filas().length + 1;
      /* solo si el backend ya guarda varios propietarios (HAC_PUBLICO.prop): front y backend en cualquier orden */
      b.hidden = n >= MAX || !soporta();
      b.querySelector('span').textContent = 'Agregar otro propietario (' + ORD[n + 1 > MAX ? MAX : n + 1] + ')';
    }
  }

  function fila(datos) {
    var z = zona();
    if (!z || filas().length + 1 >= MAX) return null;
    var f = document.createElement('div');
    f.className = 'bdp-prop';
    f.innerHTML =
      '<div class="bdp-prop__tit"><span>' + ico('persona', 16) + ' <b></b> <small>opcional · con solo el correo va en copia</small></span>' +
        '<button type="button" class="bdp-icon-btn danger-icon" data-quitar title="Quitar este propietario" aria-label="Quitar este propietario">' + ico('basura', 18) + '</button></div>' +
      '<input type="text" data-p="nom" placeholder="Nombres (se guarda en mayúscula)" autocomplete="off">' +
      '<input type="text" data-p="doc" inputmode="numeric" placeholder="NIT o cédula (sin puntos)" autocomplete="off">' +
      '<input type="email" data-p="cor" placeholder="Correo electrónico" autocomplete="off">';
    z.appendChild(f);
    if (datos) {
      f.querySelector('[data-p=nom]').value = datos.nombre || '';
      f.querySelector('[data-p=doc]').value = datos.doc || '';
      f.querySelector('[data-p=cor]').value = datos.correo || '';
    }
    renumerar();
    return f;
  }

  function quitar(f) {
    var lleno = ['nom', 'doc', 'cor'].some(function (k) { return f.querySelector('[data-p=' + k + ']').value.trim(); });
    var hacer = function () { f.remove(); renumerar(); };
    if (!lleno) { hacer(); return; }
    var k = f.getAttribute('data-k');
    if (window.Swal && Swal.fire) {
      Swal.fire({ icon: 'question', title: '¿Quitar el ' + ORD[k] + ' propietario?',
        html: 'Esta fila tiene datos. Si la quitas, se borran al guardar el expediente.',
        showCancelButton: true, confirmButtonText: 'Sí, quitar', cancelButtonText: 'Cancelar' })
        .then(function (r) { if (r && r.isConfirmed) hacer(); });
    } else if (window.confirm('¿Quitar el ' + ORD[k] + ' propietario? Tiene datos.')) hacer();
  }

  function montar() {
    if ($('bdp-props-extra')) return;
    var cor = $('bdp-correo');
    if (!cor) return;
    var z = document.createElement('div');
    z.id = 'bdp-props-extra';
    z.className = 'bdp-props';
    var b = document.createElement('button');
    b.type = 'button';
    b.id = 'btn-bdp-prop-mas';
    b.className = 'kit-btn bdp-prop-mas';
    b.innerHTML = ico('mas', 18) + ' <span>Agregar otro propietario</span>';
    cor.insertAdjacentElement('afterend', b);
    cor.insertAdjacentElement('afterend', z);
    b.addEventListener('click', function () {
      var f = fila();
      if (f) setTimeout(function () { try { f.querySelector('[data-p=nom]').focus(); } catch (_) {} }, 30);
    });
    z.addEventListener('click', function (e) {
      var q = e.target.closest('[data-quitar]');
      if (q) quitar(q.closest('.bdp-prop'));
    });
    z.addEventListener('input', function (e) {
      var el = e.target;
      if (el.getAttribute('data-p') === 'doc') { var d = digitos(el.value).slice(0, 10); if (d !== el.value) el.value = d; }
      el.classList.remove('bdp-prop--mal');
    });
    renumerar();
  }

  /** Vacía las filas extra (Agregar expediente). */
  function limpiar() { montar(); filas().forEach(function (f) { f.remove(); }); renumerar(); }

  /** Editar: el 1.º a los campos de siempre, los demás a filas. */
  function cargar(row) {
    montar();
    limpiar();
    var a = lineas(row && row.nombres), b = lineas(row && row.nit_cedula), c = lineas(row && row.correo_electronico);
    var n = Math.max(a.length, b.length, c.length);
    var ps = [];
    for (var i = 0; i < n; i++) {
      var x = { nombre: a[i] || '', doc: b[i] || '', correo: c[i] || '' };
      if (x.nombre || x.doc || x.correo) ps.push(x);
    }
    var p0 = ps.shift() || { nombre: '', doc: '', correo: '' };
    if ($('bdp-nombres')) $('bdp-nombres').value = p0.nombre;
    if ($('bdp-nit')) $('bdp-nit').value = p0.doc;
    if ($('bdp-correo')) $('bdp-correo').value = p0.correo;
    ps.slice(0, MAX - 1).forEach(function (x) { fila(x); });
  }

  /**
   * Lee el formulario. → { ok, error, campo, nombres, nits, correos, n }
   * (texto con saltos de línea, alineado; sin filas vacías).
   */
  function leer() {
    montar();
    var N = [], D = [], C = [];
    var p0 = {
      nom: String(($('bdp-nombres') || {}).value || '').replace(/\s+/g, ' ').trim().toUpperCase(),
      doc: digitos(($('bdp-nit') || {}).value),
      cor: String(($('bdp-correo') || {}).value || '').trim().toLowerCase()
    };
    if (!p0.nom) return { ok: false, error: 'Nombres requeridos', campo: $('bdp-nombres') };
    if (!p0.doc || !/^\d{1,10}$/.test(p0.doc)) return { ok: false, error: 'NIT/Cédula inválido (1 a 10 dígitos)', campo: $('bdp-nit') };
    /* el 1.º conserva la regla de siempre (correo opcional y sin revisar formato: hay
       correos viejos que no se deben volver un bloqueo), pero UNO solo por propietario */
    if (p0.cor && /[\s,;\/]/.test(p0.cor)) return { ok: false, error: 'Un solo correo por propietario: los demás van en "Agregar otro propietario" (con solo el correo, en copia).', campo: $('bdp-correo') };
    N.push(p0.nom); D.push(p0.doc); C.push(p0.cor);
    var fs = filas();
    for (var i = 0; i < fs.length; i++) {
      var f = fs[i], k = N.length + 1;
      var x = {
        nom: f.querySelector('[data-p=nom]').value.replace(/\s+/g, ' ').trim().toUpperCase(),
        doc: digitos(f.querySelector('[data-p=doc]').value),
        cor: f.querySelector('[data-p=cor]').value.trim().toLowerCase()
      };
      if (!x.nom && !x.doc && !x.cor) continue;
      if (!(x.nom && x.doc) && !(!x.nom && !x.doc && x.cor)) {
        var malo = !x.nom ? '[data-p=nom]' : '[data-p=doc]';
        f.querySelector(malo).classList.add('bdp-prop--mal');
        return { ok: false, error: ORD[k] + ' propietario: escribe nombre y NIT/cédula, o deja solo el correo (va en copia).', campo: f.querySelector(malo) };
      }
      if (x.cor && !correoOk(x.cor)) {
        f.querySelector('[data-p=cor]').classList.add('bdp-prop--mal');
        return { ok: false, error: 'El correo del ' + ORD[k] + ' propietario no es válido', campo: f.querySelector('[data-p=cor]') };
      }
      N.push(x.nom); D.push(x.doc); C.push(x.cor);
    }
    var unir = function (arr) { return arr.join('\n').replace(/\n+$/, ''); };
    return { ok: true, nombres: unir(N), nits: unir(D), correos: unir(C), n: N.length };
  }

  /** Para pintar: "A / B" (una línea). */
  function unaLinea(v) { return lineas(v).filter(String).join(' / '); }
  /** [{nombre, doc, correo, tipo}] de una fila del listado. */
  function lista(row) {
    var a = lineas(row && row.nombres), b = lineas(row && row.nit_cedula), c = lineas(row && row.correo_electronico);
    var n = Math.max(a.length, b.length, c.length), out = [];
    for (var i = 0; i < n; i++) {
      var x = { nombre: a[i] || '', doc: b[i] || '', correo: String(c[i] || '').toLowerCase() };
      if (!x.nombre && !x.doc && !x.correo) continue;
      x.tipo = (x.nombre || x.doc || !out.length) ? 'prop' : 'copia';
      out.push(x);
    }
    return out;
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', montar); else montar();

  window.PROP = { MAX: MAX, limpiar: limpiar, cargar: cargar, leer: leer, lista: lista, unaLinea: unaLinea, montar: montar };
})();
