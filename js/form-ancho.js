/* ============================================================
   FORM-ANCHO — LOTE 08/09/2026 · SEC-HACIENDA

   Qué arregla
     Los formularios de EXPEDIENTE (agregar y editar) y de ASIGNACIÓN
     (agregar y editar) pintan los campos uno debajo de otro en una
     columna de 560 px. En un PC eso deja media pantalla vacía y obliga
     a bajar mucho: el de expediente tiene 33 campos.

   Cómo
     El HTML de esos formularios es una lista plana: <label>, control,
     ayuda, <label>, control… No se puede repartir en columnas sin
     emparejar antes cada etiqueta con lo suyo, así que esta capa
     envuelve cada pareja en un `div.fa-g` y marca su contenedor como
     `.fa-cont`. El CSS hace el resto: 1 columna en móvil, 2 desde
     820 px y 3 desde 1180 px.

   Reglas del agrupado
     · Un grupo EMPIEZA en cada <label> y se traga lo que venga detrás
       (control, ayudas, estados de archivo, campos ocultos).
     · Se CORTA en los títulos (h2/h3), las líneas y en cualquier
       elemento que a su vez contenga etiquetas o botones — así los
       bloques grandes (#bdp-extra-fields, la fila de Guardar/Regresar)
       nunca se meten dentro de un campo.
     · Los grupos con textarea o con selector de categoría ocupan la
       fila entera: son campos que necesitan ancho.

   Lo que NO se rompe
     La etiqueta sigue siendo el hermano anterior de su control, que es
     como app.js esconde los campos de Respuesta y Evidencia. Cuando
     app.js esconde una etiqueta y su campo, esta capa esconde también
     el grupo, para que no quede un hueco en la rejilla.
   ============================================================ */
(function () {
  'use strict';

  if (window.__HACFORMANCHO_LISTO) return;
  window.__HACFORMANCHO_LISTO = true;

  var VISTAS = ['view-bdp-form', 'view-agregar-asignacion', 'view-editar-asignacion'];

  /* ══════════════ agrupar ══════════════ */

  function esCorte(el) {
    var t = el.tagName;
    if (t === 'H1' || t === 'H2' || t === 'H3' || t === 'H4' || t === 'HR') return true;
    if (el.classList && el.classList.contains('btn-row')) return true;
    /* Un bloque que trae dentro etiquetas o botones no es parte de un
       campo: es otra sección. */
    return !!(el.querySelector && el.querySelector('label, h1, h2, h3, h4, button, .btn-row'));
  }

  function anchoCompleto(grupo) {
    return !!grupo.querySelector('textarea, .cat-selector');
  }

  function agruparEn(cont) {
    if (!cont || cont.classList.contains('fa-cont')) return;
    cont.classList.add('fa-cont');

    var hijos = Array.prototype.slice.call(cont.children);
    var grupo = null;

    hijos.forEach(function (el) {
      if (el.tagName === 'LABEL') {
        grupo = cont.ownerDocument.createElement('div');
        grupo.className = 'fa-g';
        cont.insertBefore(grupo, el);
        grupo.appendChild(el);
        return;
      }
      if (!grupo) return;              // lo de antes del primer label se deja como está
      if (esCorte(el)) { grupo = null; return; }
      grupo.appendChild(el);
    });

    var grupos = cont.querySelectorAll(':scope > .fa-g');
    Array.prototype.forEach.call(grupos, function (g) {
      if (anchoCompleto(g)) g.classList.add('fa-full');
    });
  }

  /* ══════════════ que no queden huecos ══════════════ */

  function visible(el) {
    if (el.tagName === 'INPUT' && String(el.type).toLowerCase() === 'hidden') return false;
    return el.style.display !== 'none';
  }

  function revisarHuecos(vista) {
    var grupos = vista.querySelectorAll('.fa-g');
    Array.prototype.forEach.call(grupos, function (g) {
      var hijos = Array.prototype.slice.call(g.children);
      var hayAlgo = hijos.some(visible);
      g.style.display = hayAlgo ? '' : 'none';
    });
  }

  function vigilar(vista) {
    if (vista.__faVigilada || typeof MutationObserver !== 'function') return;
    vista.__faVigilada = true;
    var pendiente = null;
    var obs = new MutationObserver(function () {
      if (pendiente) return;
      pendiente = setTimeout(function () {
        pendiente = null;
        try { revisarHuecos(vista); } catch (e) {}
      }, 0);
    });
    obs.observe(vista, { attributes: true, attributeFilter: ['style'], subtree: true });
  }

  /* ══════════════ arranque ══════════════ */

  function preparar(id) {
    var vista = document.getElementById(id);
    if (!vista || vista.getAttribute('data-fa') === '1') return;

    /* Los contenedores son los padres que tienen etiquetas colgando: en
       el formulario de expediente son tres (super, el bloque de en medio
       y los campos extra). */
    var padres = [];
    var labels = vista.querySelectorAll('label');
    Array.prototype.forEach.call(labels, function (l) {
      if (l.parentNode && padres.indexOf(l.parentNode) === -1) padres.push(l.parentNode);
    });
    padres.forEach(agruparEn);

    vista.setAttribute('data-fa', '1');
    vigilar(vista);
    revisarHuecos(vista);
  }

  function arrancar() { VISTAS.forEach(preparar); }

  function engancharVistas() {
    var original = window.showView;
    if (typeof original !== 'function' || original.__fa) return;
    var envuelta = function (id) {
      var r = original.apply(this, arguments);
      try {
        if (VISTAS.indexOf(String(id || '')) !== -1) {
          preparar(String(id));
          revisarHuecos(document.getElementById(String(id)));
        }
      } catch (e) { console.warn('FORM-ANCHO:', e); }
      return r;
    };
    envuelta.__fa = true;
    window.showView = envuelta;
  }

  function todo() { arrancar(); engancharVistas(); }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', todo);
  } else {
    todo();
  }

  /* Otras capas también envuelven showView: se repite por si alguna
     llegó después (es idempotente, marca __fa y data-fa). */
  setTimeout(todo, 1500);

  /* Puerta para las pruebas. */
  window.FORMANCHO = {
    vistas: VISTAS,
    preparar: preparar,
    revisarHuecos: revisarHuecos,
    arrancar: todo
  };
})();
