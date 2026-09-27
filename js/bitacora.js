/* ============================================================
   MIS BITÁCORAS — LOTE 06/09/2026 · SEC-HACIENDA
   (14/09/2026: las dos pastillas se las cede a js/mi-trabajo.js, que
    agrupa bitácoras y actuaciones en un solo botón. Este archivo sigue
    siendo el DUEÑO del lector de bitácora — window.BITACORA.anotaciones —
    y el único sitio donde vive esa regla en todo el front. Si
    mi-trabajo.js no carga, las pastillas se pintan como el 06/09.)

   Por qué existe
     Desde este lote el asistente ya no tiene expedientes asignados:
     ve y edita TODOS los repartidos. Lo que separa "lo que apoyo" de
     "lo que puedo ver" es la BITÁCORA: si escribí en ella, ese
     expediente es mío en la práctica.

   Qué agrega, sin tocar app.js
     1) Una pastilla  🗒️ MIS BITÁCORAS  en BD Predial y en Asignaciones.
        Es un filtro más: se combina con clasificación, actuación,
        estado, vencimiento y el buscador de siempre.
     2) Un botón  📖 VER MIS BITÁCORAS  que abre la lista de MIS
        anotaciones en orden, de la más reciente a la más vieja,
        agrupadas por mes. Al tocar una, la app deja el expediente
        solo en pantalla.
     3) Los conteos: cuántas anotaciones, en cuántos expedientes y
        cuántas van este mes.

   Cómo sabe cuáles son mías
     La bitácora es un historial de varias líneas con la forma
         NOMBRE dd/mm/aaaa: texto
     (así la escribe la app desde siempre). Se lee lo que va ANTES de
     la fecha y se compara con el nombre del usuario sin tildes ni
     espacios dobles. Las líneas siguientes, sin fecha, son la
     continuación de esa misma anotación. Es EXACTAMENTE la misma
     regla que usa el servidor para armar la descarga a Excel
     (DSC_bitacoraEnRango_), para que lo que se ve y lo que baja
     nunca se contradigan.

   No modifica app.js: se carga después y envuelve lo que app.js expone.
   ============================================================ */
(function () {
  'use strict';

  if (window.__HACBIT_LISTO) return;
  window.__HACBIT_LISTO = true;

  var MESES = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO',
               'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];

  /* Qué mira cada vista. `id` sale de los datos que ya están en pantalla. */
  var FUENTES = {
    'view-bd-predial': {
      pastilla: 'bit-pill-predial',
      anclaje:  'bdp-pills-mias-wrap',
      titulo:   'MIS BITÁCORAS · BD PREDIAL',
      buscador: 'bdp-filter',
      refrescar: 'applyBDPredialFilters_',
      lista: function () { return leer('__bdpListCache'); },
      ficha: function (r) {
        return {
          clave:  txt(r.no_exp_fisico) || txt(r.id_predial),
          quien:  txt(r.nombres),
          extra:  txt(r.actuacion),
          buscar: txt(r.no_exp_fisico) || txt(r.id_predial)
        };
      }
    },
    'view-asignaciones': {
      pastilla: 'bit-pill-procesos',
      anclaje:  'proc-filtros',
      titulo:   'MIS BITÁCORAS · ASIGNACIONES',
      buscador: 'proc-filter',
      refrescar: 'applyProcFilters_',
      lista: function () { return leer('__procListCache'); },
      ficha: function (r) {
        return {
          clave:  txt(r.consecutivo) || txt(r.id_proceso),
          quien:  txt(r.peticionario) || txt(r.descripcion).slice(0, 60),
          extra:  txt(r.estado),
          buscar: txt(r.consecutivo) || txt(r.id_proceso)
        };
      }
    }
  };

  /* ══════════════ utilidades ══════════════ */

  function $(id) { return document.getElementById(id); }
  function txt(v) { return String(v == null ? '' : v).trim(); }

  function norm(s) {
    return String(s == null ? '' : s)
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toUpperCase();
  }

  function escapar(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }

  /* Los caches de app.js son `let` de nivel superior: no cuelgan de window,
     pero sí se ven desde otro script clásico. Mismo truco de la capa 11. */
  function leer(nombre) {
    try {
      /* jshint evil:true */
      var v = (0, eval)(nombre);
      return Array.isArray(v) ? v : [];
    } catch (_) { return []; }
  }

  function miNombre() {
    try {
      if (window.ALC && window.ALC.nombre) return norm(window.ALC.nombre);
      if (window.currentUser && window.currentUser.nombre) return norm(window.currentUser.nombre);
    } catch (_) {}
    return '';
  }

  /* ══════════════ leer la bitácora ══════════════ */

  /**
   * Anotaciones de `autor` dentro de un texto de bitácora.
   * Devuelve [{ dia:aaaammdd, fecha:'dd/mm/aaaa', texto }] en el orden
   * en que están escritas. Si `autor` viene vacío, sirven todas.
   */
  function anotaciones(texto, autor) {
    var s = String(texto == null ? '' : texto);
    if (!s.trim()) return [];

    var lineas = s.split(/\r?\n/);
    var quien = norm(autor);
    var out = [];
    var actual = null;

    for (var i = 0; i < lineas.length; i++) {
      var linea = lineas[i];
      var m = linea.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);

      if (!m) {
        /* Línea de continuación: solo se pega si la anotación abierta es mía. */
        if (actual && linea.trim()) actual.texto += (actual.texto ? '\n' : '') + linea.trim();
        continue;
      }

      var antes = linea.substring(0, m.index);
      if (quien && norm(antes) !== quien) { actual = null; continue; }

      var resto = linea.substring(m.index + m[0].length).replace(/^\s*[:\-·]\s*/, '').trim();
      actual = {
        dia:   Number(m[3]) * 10000 + Number(m[2]) * 100 + Number(m[1]),
        anio:  Number(m[3]),
        mes:   Number(m[2]),
        fecha: m[0],
        autor: norm(antes),
        texto: resto
      };
      out.push(actual);
    }
    return out;
  }

  /** ¿Escribí yo en esta bitácora? */
  function esMia(texto) {
    var yo = miNombre();
    if (!yo) return false;
    return anotaciones(texto, yo).length > 0;
  }

  /**
   * Anotaciones de una vista, con su expediente al lado.
   * `opciones.campo` — de qué columna salen (por defecto `bitacora`; el
   *   historial de ACTUACIONES vive en `actuaciones` y se escribe con el
   *   MISMO formato, por eso lo lee este mismo lector).
   * `opciones.autor` — de quién. Si no viene, las mías. Cadena vacía = de
   *   todos (lo usa el selector de ADMIN/DEV de MI TRABAJO).
   * `opciones.filas` — trabajar sobre otra lista (p. ej. lo filtrado en
   *   pantalla) en vez de la lista completa de la vista.
   */
  function mias(vista, opciones) {
    var def = FUENTES[vista];
    if (!def) return [];
    opciones = opciones || {};
    var campo = opciones.campo || 'bitacora';
    var tieneAutor = Object.prototype.hasOwnProperty.call(opciones, 'autor');
    var yo = tieneAutor ? String(opciones.autor == null ? '' : opciones.autor) : miNombre();
    if (!tieneAutor && !yo) return [];

    var filas = Array.isArray(opciones.filas) ? opciones.filas : def.lista();
    var out = [];
    for (var i = 0; i < filas.length; i++) {
      var r = filas[i];
      var anot = anotaciones(r[campo], yo);
      if (!anot.length) continue;
      var f = def.ficha(r);
      for (var j = 0; j < anot.length; j++) {
        out.push({
          dia: anot[j].dia, anio: anot[j].anio, mes: anot[j].mes,
          fecha: anot[j].fecha, texto: anot[j].texto, autor: anot[j].autor,
          clave: f.clave, quien: f.quien, extra: f.extra, buscar: f.buscar,
          fila: r
        });
      }
    }
    out.sort(function (a, b) { return b.dia - a.dia; });
    return out;
  }

  /* ══════════════ el filtro (la pastilla) ══════════════ */

  var encendido = { 'view-bd-predial': false, 'view-asignaciones': false };

  function filtrar(vista, items) {
    if (!encendido[vista]) return items;
    var yo = miNombre();
    if (!yo) return items;
    return items.filter(function (r) { return anotaciones(r.bitacora, yo).length > 0; });
  }

  /** La misma regla, pero sobre el campo y el autor que le pidan. La usa
   *  js/mi-trabajo.js para el filtro de pantalla de las dos pestañas. */
  function conAnotacion(filas, campo, autor) {
    var c = campo || 'bitacora';
    var a = String(autor == null ? '' : autor);
    return (filas || []).filter(function (r) {
      var n = anotaciones(r[c], a);
      return !!(n && n.length);
    });
  }

  /* Se envuelve el pintado, no el filtrado: así este filtro se suma a los
     que ya existen (estado, clasificación, buscador…) sin tocar ninguno. */
  function envolverRender(nombre, vista) {
    var original = window[nombre];
    if (typeof original !== 'function' || original.__bit) return;
    var envuelta = function (items) {
      var lista = Array.isArray(items) ? items : [];
      return original.call(this, filtrar(vista, lista));
    };
    envuelta.__bit = true;
    window[nombre] = envuelta;
  }

  function refrescar(vista) {
    var def = FUENTES[vista];
    try {
      if (typeof window[def.refrescar] === 'function') window[def.refrescar]();
    } catch (e) { console.warn('BITACORA:', e); }
  }

  /* ══════════════ pintar los botones ══════════════ */

  function pintarBotones(vista) {
    /* 14/09 — si MI TRABAJO montó, estas dos pastillas viven dentro de su
       modal y aquí no se pinta nada. */
    if (window.MITRABAJO && window.MITRABAJO.gobierna) return;
    var def = FUENTES[vista];
    if (!def || $(def.pastilla)) return;

    var ancla = $(def.anclaje);
    if (!ancla || !ancla.parentNode) return;

    var wrap = document.createElement('div');
    wrap.className = 'bit-wrap';
    wrap.id = def.pastilla + '-wrap';
    wrap.innerHTML =
      '<button type="button" id="' + def.pastilla + '" class="proc-status-pill bit-pill" data-salida="1">' +
        '🗒️ MIS BITÁCORAS<span class="bit-num" id="' + def.pastilla + '-num"></span>' +
      '</button>' +
      '<button type="button" id="' + def.pastilla + '-ver" class="proc-status-pill bit-ver" data-salida="1">' +
        '📖 VER MIS BITÁCORAS' +
      '</button>';

    ancla.parentNode.insertBefore(wrap, ancla.nextSibling);

    $(def.pastilla).addEventListener('click', function () {
      encendido[vista] = !encendido[vista];
      this.classList.toggle('active', encendido[vista]);
      try { if (window.playSoundOnce && window.SOUNDS) window.playSoundOnce(window.SOUNDS.menu); } catch (_) {}
      refrescar(vista);
    });

    $(def.pastilla + '-ver').addEventListener('click', function () {
      abrirModal(vista);
    });
  }

  /** El número de la pastilla: cuántos expedientes tienen anotación mía. */
  function pintarNumero(vista) {
    var def = FUENTES[vista];
    var el = $(def.pastilla + '-num');
    if (!el) return;
    var yo = miNombre();
    if (!yo) { el.textContent = ''; return; }
    var filas = def.lista();
    var n = 0;
    for (var i = 0; i < filas.length; i++) {
      if (anotaciones(filas[i].bitacora, yo).length) n++;
    }
    el.textContent = n ? ' · ' + n : '';
  }

  /* ══════════════ el modal ══════════════ */

  function crearModal() {
    if ($('modal-bitacoras')) return;
    var capa = document.createElement('div');
    capa.id = 'modal-bitacoras';
    capa.className = 'hidden';
    capa.setAttribute('role', 'dialog');
    capa.innerHTML =
      '<div class="card narrow bit-caja">' +
        '<h2 id="bit-titulo" style="color:var(--primary);margin-top:0;">MIS BITÁCORAS</h2>' +
        '<div id="bit-resumen" class="bit-resumen"></div>' +
        '<div id="bit-lista" class="bit-lista"></div>' +
        '<div class="btn-row" style="margin-top:14px;">' +
          '<button id="btn-bit-cerrar" class="danger">CERRAR</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(capa);

    $('btn-bit-cerrar').addEventListener('click', cerrarModal);

    /* Que cierre con clic fuera, como los demás modales (Fase 3). */
    try { if (window.BV && window.BV._cierres) window.BV._cierres['modal-bitacoras'] = ['btn-bit-cerrar']; }
    catch (_) {}
  }

  function cerrarModal() {
    var m = $('modal-bitacoras');
    if (m) m.classList.add('hidden');
  }

  function abrirModal(vista) {
    crearModal();
    var def = FUENTES[vista];
    var datos = mias(vista);

    $('bit-titulo').textContent = def.titulo;
    pintarResumen(datos);
    pintarLista(vista, datos);

    $('modal-bitacoras').classList.remove('hidden');
  }

  function pintarResumen(datos) {
    var cont = $('bit-resumen');
    if (!datos.length) {
      cont.innerHTML = '<p class="bit-vacio">Todavía no tienes anotaciones en la bitácora de lo que estás viendo.</p>';
      return;
    }
    var hoy = new Date();
    var esteMes = hoy.getFullYear() * 100 + (hoy.getMonth() + 1);
    var nMes = 0, exps = {};
    for (var i = 0; i < datos.length; i++) {
      if (datos[i].anio * 100 + datos[i].mes === esteMes) nMes++;
      exps[datos[i].clave] = true;
    }
    var nExp = 0;
    for (var k in exps) { if (Object.prototype.hasOwnProperty.call(exps, k)) nExp++; }

    cont.innerHTML =
      caja(datos.length, datos.length === 1 ? 'anotación' : 'anotaciones') +
      caja(nExp, nExp === 1 ? 'expediente' : 'expedientes') +
      caja(nMes, 'este mes') +
      caja(datos[0].fecha, 'la última', true);
  }

  function caja(valor, etiqueta, chica) {
    return '<div class="bit-caja-num">' +
             '<b' + (chica ? ' class="chica"' : '') + '>' + escapar(String(valor)) + '</b>' +
             '<span>' + escapar(etiqueta) + '</span>' +
           '</div>';
  }

  function pintarLista(vista, datos) {
    var cont = $('bit-lista');
    cont.innerHTML = '';
    if (!datos.length) return;

    var mesActual = '';
    var html = '';
    for (var i = 0; i < datos.length; i++) {
      var d = datos[i];
      var titulo = (MESES[d.mes - 1] || '') + ' ' + d.anio;
      if (titulo !== mesActual) {
        mesActual = titulo;
        var enEsteMes = datos.filter(function (x) {
          return (MESES[x.mes - 1] || '') + ' ' + x.anio === titulo;
        }).length;
        html += '<div class="bit-mes">' + escapar(titulo) +
                '<span>' + enEsteMes + '</span></div>';
      }
      html +=
        '<div class="bit-item" data-bit-buscar="' + escapar(d.buscar) + '">' +
          '<div class="bit-fecha">' + escapar(d.fecha) + '</div>' +
          '<div class="bit-cuerpo">' +
            '<p class="bit-exp">' + escapar(d.clave || '—') +
              (d.quien ? ' <span>· ' + escapar(d.quien) + '</span>' : '') + '</p>' +
            (d.extra ? '<p class="bit-extra">' + escapar(d.extra) + '</p>' : '') +
            '<p class="bit-texto">' + escapar(d.texto || '(sin texto)') + '</p>' +
          '</div>' +
        '</div>';
    }
    cont.innerHTML = html;

    cont.addEventListener('click', function (ev) {
      var it = ev.target.closest ? ev.target.closest('[data-bit-buscar]') : null;
      if (!it) return;
      var q = it.getAttribute('data-bit-buscar') || '';
      if (!q) return;
      var buscador = $(FUENTES[vista].buscador);
      if (buscador) {
        buscador.value = q;
        cerrarModal();
        refrescar(vista);
      }
    });
  }

  /* ══════════════ montaje ══════════════ */

  function alEntrar(vista) {
    if (!FUENTES[vista]) return;
    pintarBotones(vista);
    /* La lista llega del servidor un momento después de mostrar la vista. */
    setTimeout(function () { pintarNumero(vista); }, 400);
    setTimeout(function () { pintarNumero(vista); }, 2500);
  }

  function engancharVistas() {
    var original = window.showView;
    if (typeof original !== 'function' || original.__bit) return;
    var envuelta = function (id) {
      var r = original.apply(this, arguments);
      try { alEntrar(id); } catch (e) { console.warn('BITACORA:', e); }
      return r;
    };
    envuelta.__bit = true;
    window.showView = envuelta;
  }

  function arrancar() {
    envolverRender('renderBDPredial_', 'view-bd-predial');
    envolverRender('renderProcList_', 'view-asignaciones');
    engancharVistas();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', arrancar);
  else arrancar();

  /* app.js reasigna renderProcList_ al final de su propio archivo y otras
     capas también envuelven showView: se vuelve a envolver por si alguna
     llegó después. Es idempotente (marca __bit). */
  setTimeout(arrancar, 1500);

  /* Puerta para las pruebas y para quien quiera reutilizar el lector. */
  window.BITACORA = {
    anotaciones: anotaciones,
    esMia: esMia,
    mias: mias,
    filtrar: filtrar,
    conAnotacion: conAnotacion,
    fuentes: FUENTES,
    norm: norm,
    abrir: abrirModal,
    cerrar: cerrarModal,
    pastilla: function (vista, valor) {
      encendido[vista] = !!valor;
      var b = $(FUENTES[vista].pastilla);
      if (b) b.classList.toggle('active', !!valor);
    },
    encendido: function (vista) { return !!encendido[vista]; },
    pintarNumero: pintarNumero,
    montar: alEntrar
  };
})();
