/* ============================================================
   MI TRABAJO — 14/09/2026 · SEC-HACIENDA

   Qué resuelve
     1) BD Predial tenía TRES botones en la fila de pastillas
        (🗒️ MIS BITÁCORAS, 📖 VER MIS BITÁCORAS, 📥 DESCARGAR
        BITÁCORAS) y con las actuaciones iban a ser cinco. Aquí
        queda UNO: 📂 MI TRABAJO, y todo lo demás vive dentro.
     2) Las ACTUACIONES, que hasta hoy no se podían mirar por
        persona porque la hoja no guardaba quién las ponía. Desde
        esta entrega el backend escribe un historial en la columna
        AO con el MISMO formato de línea que la bitácora
        (`NOMBRE dd/mm/aaaa: texto`), así que se lee con el MISMO
        lector: window.BITACORA.anotaciones. Una sola regla.
     3) El ADMIN y el DEV ya no ven «Todavía no tienes anotaciones…»:
        eligen entre TODAS o las de una persona concreta.

   De dónde salen los datos
     De la memoria, igual que la descarga: __bdpFilteredCache /
     __bdpListCache y __procPagedCache / __procListCache. Cero
     viajes nuevos, cero endpoints nuevos. El caché ES lo que el
     servidor ya autorizó a ver, así que tampoco hay que revalidar
     permisos.

   El selector de personas
     NO sale de los catálogos de roles: hay gente con cientos de
     anotaciones que ya no tiene rol (una reasignación de
     sustanciadores deja a su autor fuera de todos los catálogos).
     Sale de los autores que de verdad aparecen en lo que está en
     memoria, con su conteo al lado. Los que tienen una o dos
     anotaciones se dejan fuera del desplegable: son las líneas mal
     escritas (texto antes de la fecha), no personas. Para esas
     está la opción TODAS.
     Los nombres NO se fusionan: si en la hoja hay «DIEGO FERNANDO
     GARCIA» y «DIEGO FERNANDO GARCIA:» salen los dos, porque el
     lector los ve distintos y esconderlo haría que el listado y la
     descarga dijeran cosas diferentes.

   17/09/2026 — tercera pestaña 📨 SOLICITUDES (Solicitud Expediente
   con el rol ARCHIVO), en BD Predial y en Asignaciones. No usa el lector
   de bitácora: su dueño es js/solicitud-exp.js (window.SOLEXP). Las
   solicitudes se listan por CONVERSACIÓN (expediente), pendientes
   primero. Al rol ARCHIVO no se le muestra la pestaña Bitácoras en
   Asignaciones (decisión del 11/09: no escribe bitácora ahí) y se abre
   directo en Solicitudes.

   No modifica app.js ni styles.css.
   ============================================================ */
(function () {
  'use strict';

  if (window.__HACMITRAB_LISTO) return;
  window.__HACMITRAB_LISTO = true;

  /* Bandera que leen js/bitacora.js y js/bitacora-export.js para NO pintar
     sus propias pastillas. Se pone antes que nada: si este archivo carga,
     manda este archivo; si no carga, aquellos siguen pintando como antes. */
  window.MITRABAJO = window.MITRABAJO || {};
  window.MITRABAJO.gobierna = true;

  var MESES = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO',
               'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];

  /* Cuántas anotaciones necesita un nombre para entrar al desplegable.
     Con 1 o 2 lo que entra es basura: líneas que llevan el texto antes de
     la fecha y el lector toma ese texto como autor. */
  var MINIMO_AUTOR = 3;

  /* ══════════════ las pestañas ══════════════ */
  var PESTANAS = {
    bitacoras: {
      id: 'bitacoras',
      et: '🗒️ Bitácoras',
      campo: 'bitacora',
      cosa: 'anotación',
      cosas: 'anotaciones',
      vistas: ['view-bd-predial', 'view-asignaciones'],
      fuente: function (vista) {
        return vista === 'view-asignaciones' ? 'view-asignaciones' : 'view-bd-predial';
      },
      vacio: 'Todavía no hay anotaciones de bitácora en lo que estás viendo.'
    },
    actuaciones: {
      id: 'actuaciones',
      et: '⚖️ Actuaciones',
      campo: 'actuaciones',
      cosa: 'actuación',
      cosas: 'actuaciones',
      vistas: ['view-bd-predial'],
      fuente: function () { return 'view-bd-predial-actuaciones'; },
      vacio: 'Todavía no hay actuaciones registradas en lo que estás viendo.'
    },
    /* 17/09 — SOLICITUD EXPEDIENTE */
    solicitudes: {
      id: 'solicitudes',
      et: '📨 Solicitudes',
      campo: '',            /* depende de la vista: SOLEXP.campo(vista) */
      cosa: 'mensaje',
      cosas: 'mensajes',
      todas: 'Todas las solicitudes',
      vistas: ['view-bd-predial', 'view-asignaciones'],
      fuente: function (vista) {
        return vista === 'view-asignaciones' ? 'view-asignaciones-solicitudes' : 'view-bd-predial-solicitudes';
      },
      vacio: 'Todavía no hay solicitudes de expediente en lo que estás viendo.'
    }
  };

  /* Etiqueta de la opción TODAS del selector de ADMIN/DEV. */
  PESTANAS.bitacoras.todas = 'Todas las anotaciones';
  PESTANAS.actuaciones.todas = 'Todas las actuaciones';

  function solexp() { return window.SOLEXP || null; }

  /** El rol ARCHIVO no escribe bitácora en Asignaciones (11/09). */
  function esArchivo() {
    try { return typeof window.esArchivo_ === 'function' && !!window.esArchivo_(); }
    catch (_) { return false; }
  }

  /* Estado por vista: qué pestaña se está mirando, de quién, y si el filtro
     de pantalla está encendido. */
  var estado = {
    'view-bd-predial':  { pestana: 'bitacoras', autor: null, filtro: false },
    'view-asignaciones': { pestana: 'bitacoras', autor: null, filtro: false }
  };
  var fijadaArchivo = {};   /* ya se le abrió Solicitudes a ARCHIVO una vez */

  /* ══════════════ utilidades ══════════════ */

  function $(id) { return document.getElementById(id); }
  function txt(v) { return String(v == null ? '' : v).trim(); }

  function escapar(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }

  function leer(nombre) {
    try {
      /* jshint evil:true */
      var v = (0, eval)(nombre);
      return Array.isArray(v) ? v : [];
    } catch (_) { return []; }
  }

  function bit() { return window.BITACORA || null; }

  function norm(s) {
    var b = bit();
    if (b && typeof b.norm === 'function') return b.norm(s);
    return String(s == null ? '' : s)
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ').trim().toUpperCase();
  }

  function miNombre() {
    try {
      if (window.ALC && window.ALC.nombre) return norm(window.ALC.nombre);
      if (window.currentUser && window.currentUser.nombre) return norm(window.currentUser.nombre);
    } catch (_) {}
    return '';
  }

  /** ADMIN o DEV: la MISMA puerta que ya usa la descarga para ofrecer
   *  «todas / solo las mías». No se inventa otra. */
  function mando() {
    try { return !!(window.IDN && window.IDN.esAdmin && window.IDN.esAdmin()); }
    catch (_) { return false; }
  }

  /** Vistas donde este módulo trabaja. */
  function conocida(vista) { return !!estado[vista]; }

  function pestanasDe(vista) {
    var out = [];
    for (var k in PESTANAS) {
      if (!Object.prototype.hasOwnProperty.call(PESTANAS, k)) continue;
      if (PESTANAS[k].vistas.indexOf(vista) === -1) continue;
      if (k === 'bitacoras' && vista === 'view-asignaciones' && esArchivo()) continue;
      if (k === 'solicitudes' && !solexp()) continue;
      out.push(PESTANAS[k]);
    }
    return out;
  }

  function pestanaActiva(vista) {
    var st = estado[vista];
    var lista = pestanasDe(vista);
    /* ARCHIVO: la primera vez se abre en Solicitudes, que es su trabajo. */
    if (esArchivo() && !fijadaArchivo[vista] && PESTANAS.solicitudes && solexp()) {
      fijadaArchivo[vista] = true;
      st.pestana = 'solicitudes';
    }
    var p = PESTANAS[st.pestana];
    if (!p || lista.indexOf(p) === -1) {
      p = lista[0] || PESTANAS.bitacoras;
      st.pestana = p.id;
    }
    return p;
  }

  /** El autor con el que se está mirando. null = las mías. '' = todas. */
  function autorDe(vista) {
    var st = estado[vista];
    if (st.autor === null) return miNombre();
    return st.autor;
  }

  /* ══════════════ de dónde salen las filas ══════════════ */

  /* Se mira SIEMPRE lo filtrado en pantalla, con respaldo al listado
     completo si la lista todavía no se pintó. Es el mismo criterio que usa
     la descarga con la opción «lo que estoy viendo». */
  var CACHES = {
    'view-bd-predial':  { pantalla: '__bdpFilteredCache', todo: '__bdpListCache' },
    'view-asignaciones': { pantalla: '__procPagedCache',  todo: '__procListCache' }
  };

  function filasDe(vista) {
    var c = CACHES[vista];
    if (!c) return [];
    var v = leer(c.pantalla);
    return v.length ? v : leer(c.todo);
  }

  function filasTodo(vista) {
    var c = CACHES[vista];
    return c ? leer(c.todo) : [];
  }

  /* ══════════════ leer las anotaciones ══════════════ */

  /** Lista de items {fecha, dia, autor, texto, fila} para la pestaña.
   *  NO se recorre aquí: lo hace js/bitacora.js, que es el dueño del
   *  lector. Aquí solo se le dice qué campo, de quién y sobre qué filas.
   *  Así no hay una segunda copia de la regla que se pueda desincronizar. */
  function items(vista, pest, autor) {
    if (pest.id === 'solicitudes') {
      var sx = solexp();
      if (!sx) return null;
      return sx.mensajes(vista, { autor: autor, filas: filasDe(vista) });
    }
    var b = bit();
    if (!b || typeof b.mias !== 'function') return null;
    /* La vista de ACTUACIONES comparte la fuente de BD Predial en
       js/bitacora.js: lo único distinto es la columna. */
    var fuente = (vista === 'view-asignaciones') ? 'view-asignaciones' : 'view-bd-predial';
    return b.mias(fuente, {
      campo: pest.campo,
      autor: autor,
      filas: filasDe(vista)
    });
  }

  /** Los autores que de verdad aparecen, con su conteo. */
  function autores(vista, pest) {
    if (pest.id === 'solicitudes') {
      var sx = solexp();
      return sx ? sx.autores(filasDe(vista), vista) : [];
    }
    var b = bit();
    if (!b || typeof b.anotaciones !== 'function') return [];

    var filas = filasDe(vista);
    var cuenta = {};
    for (var i = 0; i < filas.length; i++) {
      var anot = b.anotaciones(filas[i][pest.campo], '');
      if (!anot) continue;
      for (var j = 0; j < anot.length; j++) {
        var a = txt(anot[j].autor);
        var k = a || '(sin autor)';
        cuenta[k] = (cuenta[k] || 0) + 1;
      }
    }

    var yo = miNombre();
    var out = [];
    for (var n in cuenta) {
      if (!Object.prototype.hasOwnProperty.call(cuenta, n)) continue;
      /* El propio usuario entra siempre, aunque tenga una sola. */
      if (cuenta[n] < MINIMO_AUTOR && n !== yo) continue;
      out.push({ nombre: n === '(sin autor)' ? '' : n, etiqueta: n, n: cuenta[n] });
    }
    out.sort(function (a, c) { return c.n - a.n; });
    return out;
  }

  /* ══════════════ clasificar las actuaciones ══════════════ */

  var DIA_MS = 86400000;

  function fechaDDMM(s) {
    var m = String(s || '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (!m) return null;
    var d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function diasA(fechaSeg) {
    var f = fechaDDMM(fechaSeg);
    if (!f) return null;
    var hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    return Math.round((f - hoy) / DIA_MS);
  }

  var GRUPOS_ACT = [
    { id: 'vencidas', et: 'VENCIDAS',            cl: 'mt-g-rojo' },
    { id: 'hoy',      et: 'PARA HOY',            cl: 'mt-g-ambar' },
    { id: 'semana',   et: 'ESTA SEMANA',         cl: 'mt-g-ambar' },
    { id: 'luego',    et: 'MÁS ADELANTE',        cl: 'mt-g-verde' },
    { id: 'sinfecha', et: 'SIN FECHA PROGRAMADA', cl: 'mt-g-gris' }
  ];

  function grupoDe(fila) {
    var d = diasA(fila && fila.fecha_seguimiento);
    if (d === null) return 'sinfecha';
    if (d < 0) return 'vencidas';
    if (d === 0) return 'hoy';
    if (d <= 7) return 'semana';
    return 'luego';
  }

  /**
   * Expedientes con actuación real pero SIN una sola línea de historial.
   * Son los que ya estaban antes de esta entrega: la hoja nunca guardó
   * quién los puso y no hay de dónde sacarlo. No se inventa un autor: se
   * muestran aparte para que no desaparezca nada.
   */
  function sinRegistro(vista) {
    if (vista !== 'view-bd-predial') return [];
    var b = bit();
    if (!b) return [];
    var filas = filasDe(vista);
    var out = [];
    for (var i = 0; i < filas.length; i++) {
      var r = filas[i];
      var act = norm(r.actuacion);
      if (!act || act === 'NINGUNA') continue;
      if (txt(r.actuaciones)) continue;
      out.push(r);
    }
    return out;
  }

  /* ══════════════ el filtro de pantalla ══════════════ */

  /* Se envuelve el PINTADO, no el filtrado: así este filtro se suma a las
     pastillas, los selectores y el buscador que ya existen, sin tocar
     ninguno. Mismo patrón que js/bitacora.js. */
  function aplicarFiltro(vista, lista) {
    var st = estado[vista];
    if (!st || !st.filtro) return lista;
    if (pestanaActiva(vista).id === 'solicitudes') {
      var sx = solexp();
      return sx ? sx.conSolicitud(lista, vista, autorDe(vista)) : lista;
    }
    var b = bit();
    if (!b || typeof b.conAnotacion !== 'function') return lista;
    var pest = pestanaActiva(vista);
    return b.conAnotacion(lista, pest.campo, autorDe(vista));
  }

  function envolverRender(nombre, vista) {
    var original = window[nombre];
    if (typeof original !== 'function' || original.__mt) return;
    var envuelta = function (lista) {
      return original.call(this, aplicarFiltro(vista, Array.isArray(lista) ? lista : []));
    };
    envuelta.__mt = true;
    window[nombre] = envuelta;
  }

  function refrescarVista(vista) {
    var f = vista === 'view-asignaciones' ? 'applyProcFilters_' : 'applyBDPredialFilters_';
    try { if (typeof window[f] === 'function') window[f](); }
    catch (e) { console.warn('MITRABAJO:', e); }
  }

  /* ══════════════ la pastilla ══════════════ */

  var ANCLAS = {
    'view-bd-predial':  'bdp-pills-mias-wrap',
    'view-asignaciones': 'proc-filtros'
  };

  function pintarPastilla(vista) {
    if (!conocida(vista)) return;
    if ($('mt-pill-' + vista)) return;
    var ancla = $(ANCLAS[vista]);
    if (!ancla || !ancla.parentNode) return;

    var wrap = document.createElement('div');
    wrap.className = 'bit-wrap mt-wrap';
    wrap.id = 'mt-wrap-' + vista;
    wrap.innerHTML =
      '<button type="button" id="mt-pill-' + vista + '" class="proc-status-pill mt-pill" data-salida="1">' +
        '📂 MI TRABAJO<span class="bit-num" id="mt-num-' + vista + '"></span>' +
      '</button>';
    ancla.parentNode.insertBefore(wrap, ancla.nextSibling);

    $('mt-pill-' + vista).addEventListener('click', function () {
      try { if (window.playSoundOnce && window.SOUNDS) window.playSoundOnce(window.SOUNDS.menu); } catch (_) {}
      abrir(vista);
    });
  }

  /** El número de la pastilla: cuántas cosas MÍAS hay en lo que se ve. */
  function pintarNumero(vista) {
    var el = $('mt-num-' + vista);
    if (!el) return;
    var yo = miNombre();
    if (!yo) { el.textContent = ''; return; }
    var n = 0;
    var pests = pestanasDe(vista);
    for (var i = 0; i < pests.length; i++) {
      var it = items(vista, pests[i], yo);
      if (it) n += it.length;
    }
    el.textContent = n ? ' · ' + n.toLocaleString('es-CO') : '';
    var pill = $('mt-pill-' + vista);
    if (pill) pill.classList.toggle('active', !!estado[vista].filtro);
  }

  /* ══════════════ el modal ══════════════ */

  function crearModal() {
    if ($('modal-mitrabajo')) return;
    var capa = document.createElement('div');
    capa.id = 'modal-mitrabajo';
    capa.className = 'hidden';
    capa.setAttribute('role', 'dialog');
    capa.innerHTML =
      '<div class="card narrow mt-caja">' +
        '<h2 id="mt-titulo" style="color:var(--primary);margin-top:0;">MI TRABAJO</h2>' +
        '<div id="mt-tabs" class="mt-tabs"></div>' +
        '<div id="mt-barra" class="mt-barra"></div>' +
        '<div id="mt-resumen" class="bit-resumen mt-resumen"></div>' +
        '<div id="mt-lista" class="bit-lista mt-lista"></div>' +
        '<div class="btn-row mt-botones" style="margin-top:14px;">' +
          '<button id="btn-mt-descargar" class="btn-primary">📥 DESCARGAR</button>' +
          '<button id="btn-mt-cerrar" class="danger">CERRAR</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(capa);

    $('btn-mt-cerrar').addEventListener('click', cerrar);
    $('btn-mt-descargar').addEventListener('click', descargar);

    $('mt-tabs').addEventListener('click', function (ev) {
      var b = ev.target.closest ? ev.target.closest('[data-mt-tab]') : null;
      if (!b) return;
      var vista = abierta;
      estado[vista].pestana = b.getAttribute('data-mt-tab');
      /* Al cambiar de pestaña el autor se conserva si esa persona también
         escribió allí; si no, se vuelve a «las mías». */
      pintar(vista);
      if (estado[vista].filtro) refrescarVista(vista);
    });

    $('mt-barra').addEventListener('change', function (ev) {
      var t = ev && ev.target;
      if (!t) return;
      var vista = abierta;
      if (t.id === 'mt-autor') {
        estado[vista].autor = t.value === '__MIAS__' ? null : t.value;
        pintar(vista);
        if (estado[vista].filtro) refrescarVista(vista);
      }
      if (t.id === 'mt-filtro') {
        estado[vista].filtro = !!t.checked;
        refrescarVista(vista);
        pintarNumero(vista);
      }
    });

    $('mt-lista').addEventListener('click', function (ev) {
      /* 17/09 — «Abrir conversación» abre el MENSAJE O BITÁCORA de ese
         expediente, encima de la vista (MI TRABAJO se cierra). */
      var sxb = ev.target.closest ? ev.target.closest('[data-mt-sx]') : null;
      if (sxb) {
        var fila = hilos[Number(sxb.getAttribute('data-mt-sx'))];
        if (fila && window.SOLEXP) { cerrar(); window.SOLEXP.abrir(abierta, fila); }
        return;
      }
      var it = ev.target.closest ? ev.target.closest('[data-mt-buscar]') : null;
      if (!it) return;
      var q = it.getAttribute('data-mt-buscar') || '';
      if (!q) return;
      var buscador = $(abierta === 'view-asignaciones' ? 'proc-filter' : 'bdp-filter');
      if (buscador) {
        buscador.value = q;
        cerrar();
        refrescarVista(abierta);
      }
    });

    try { if (window.BV && window.BV._cierres) window.BV._cierres['modal-mitrabajo'] = ['btn-mt-cerrar']; }
    catch (_) {}
  }

  var abierta = 'view-bd-predial';

  function abrir(vista) {
    if (!conocida(vista)) return;
    abierta = vista;
    crearModal();
    pintar(vista);
    $('modal-mitrabajo').classList.remove('hidden');
  }

  function cerrar() {
    var m = $('modal-mitrabajo');
    if (m) m.classList.add('hidden');
  }

  /* ══════════════ pintar ══════════════ */

  function pintar(vista) {
    var pest = pestanaActiva(vista);
    var st = estado[vista];

    $('mt-titulo').textContent = 'MI TRABAJO · ' +
      (vista === 'view-asignaciones' ? 'ASIGNACIONES' : 'BD PREDIAL');

    /* ── pestañas ── */
    var pests = pestanasDe(vista);
    var h = '';
    for (var i = 0; i < pests.length; i++) {
      h += '<button type="button" class="mt-tab' + (pests[i].id === pest.id ? ' active' : '') +
           '" data-mt-tab="' + pests[i].id + '" data-salida="1">' + pests[i].et + '</button>';
    }
    $('mt-tabs').innerHTML = h;
    $('mt-tabs').style.display = pests.length > 1 ? '' : 'none';

    /* ── barra: de quién + filtro de pantalla ── */
    var lista = autores(vista, pest);
    var yo = miNombre();
    var b = '';

    if (mando()) {
      /* La opción «las mías» solo tiene sentido si de verdad escribí algo. */
      var tengo = false;
      for (var k = 0; k < lista.length; k++) if (lista[k].nombre === yo) tengo = true;

      b += '<div class="mt-campo"><label for="mt-autor">De quién</label>' +
           '<select id="mt-autor" class="mt-select">';
      b += '<option value=""' + (st.autor === '' ? ' selected' : '') + '>' +
           escapar(pest.todas || ('Todas las ' + pest.cosas)) + '</option>';
      if (tengo) {
        b += '<option value="__MIAS__"' + (st.autor === null ? ' selected' : '') +
             '>Solo las mías</option>';
      } else if (st.autor === null) {
        /* No escribí nada aquí: se abre en TODAS en vez de en un vacío. */
        st.autor = '';
      }
      for (var j = 0; j < lista.length; j++) {
        if (lista[j].nombre === yo) continue;
        b += '<option value="' + escapar(lista[j].nombre) + '"' +
             (st.autor === lista[j].nombre ? ' selected' : '') + '>' +
             escapar(lista[j].etiqueta) + ' · ' + lista[j].n.toLocaleString('es-CO') + '</option>';
      }
      b += '</select></div>';
    } else if (pest.id === 'solicitudes') {
      b += esArchivo()
        ? '<p class="mt-nota">Se muestran <b>todas</b> las solicitudes: cada una va dirigida a ARCHIVO.</p>'
        : '<p class="mt-nota">Se muestran <b>tus</b> solicitudes: las conversaciones donde escribiste.</p>';
    } else {
      b += '<p class="mt-nota">Se muestran <b>tus</b> ' + escapar(pest.cosas) + '.</p>';
    }

    b += '<label class="mt-switch" for="mt-filtro">' +
           '<input type="checkbox" id="mt-filtro"' + (st.filtro ? ' checked' : '') + '>' +
           '<span>Dejar solo estos expedientes en pantalla</span>' +
         '</label>';

    $('mt-barra').innerHTML = b;

    /* ── datos ── */
    var autor = autorDe(vista);
    var datos = items(vista, pest, autor);

    if (datos === null) {
      $('mt-resumen').innerHTML = '<p class="bit-vacio">No se pudo leer el lector de bitácora ' +
        '(js/bitacora.js). Recarga la app.</p>';
      $('mt-lista').innerHTML = '';
      $('btn-mt-descargar').disabled = true;
      return;
    }

    if (pest.id === 'actuaciones') pintarActuaciones(vista, datos);
    else if (pest.id === 'solicitudes') pintarSolicitudes(vista, datos);
    else pintarBitacoras(vista, pest, datos);

    $('btn-mt-descargar').disabled = !datos.length;
  }

  function caja(valor, etiqueta, chica) {
    return '<div class="bit-caja-num">' +
             '<b' + (chica ? ' class="chica"' : '') + '>' + escapar(String(valor)) + '</b>' +
             '<span>' + escapar(etiqueta) + '</span>' +
           '</div>';
  }

  function claveDe(vista, r) {
    if (vista === 'view-asignaciones') return txt(r.consecutivo) || txt(r.id_proceso);
    return txt(r.no_exp_fisico) || txt(r.id_predial);
  }

  function quienDe(vista, r) {
    if (vista === 'view-asignaciones') return txt(r.peticionario) || txt(r.descripcion).slice(0, 60);
    return txt(r.nombres);
  }

  /* ── pestaña BITÁCORAS: por mes, de la más nueva a la más vieja ── */
  function pintarBitacoras(vista, pest, datos) {
    var res = $('mt-resumen');
    if (!datos.length) {
      res.innerHTML = '<p class="bit-vacio">' + escapar(pest.vacio) + '</p>';
      $('mt-lista').innerHTML = '';
      return;
    }
    var hoy = new Date();
    var esteMes = hoy.getFullYear() * 100 + (hoy.getMonth() + 1);
    var nMes = 0, exps = {};
    for (var i = 0; i < datos.length; i++) {
      if (datos[i].anio * 100 + datos[i].mes === esteMes) nMes++;
      exps[claveDe(vista, datos[i].fila)] = true;
    }
    var nExp = 0;
    for (var k in exps) { if (Object.prototype.hasOwnProperty.call(exps, k)) nExp++; }

    res.innerHTML =
      caja(datos.length.toLocaleString('es-CO'), datos.length === 1 ? 'anotación' : 'anotaciones') +
      caja(nExp.toLocaleString('es-CO'), nExp === 1 ? 'expediente' : 'expedientes') +
      caja(nMes.toLocaleString('es-CO'), 'este mes') +
      caja(datos[0].fecha, 'la última', true);

    var mesActual = '', html = '';
    for (var j = 0; j < datos.length; j++) {
      var d = datos[j];
      var titulo = (MESES[d.mes - 1] || '') + ' ' + d.anio;
      if (titulo !== mesActual) {
        mesActual = titulo;
        var n = datos.filter(function (x) {
          return (MESES[x.mes - 1] || '') + ' ' + x.anio === titulo;
        }).length;
        html += '<div class="bit-mes">' + escapar(titulo) + '<span>' + n + '</span></div>';
      }
      html += tarjeta(vista, d, true);
    }
    $('mt-lista').innerHTML = html;
  }

  /* ── pestaña ACTUACIONES: por urgencia del seguimiento ── */
  function pintarActuaciones(vista, datos) {
    var res = $('mt-resumen');
    var huerfanas = sinRegistro(vista);

    if (!datos.length && !huerfanas.length) {
      res.innerHTML = '<p class="bit-vacio">' + escapar(PESTANAS.actuaciones.vacio) + '</p>';
      $('mt-lista').innerHTML = '';
      return;
    }

    var cubos = {};
    for (var g = 0; g < GRUPOS_ACT.length; g++) cubos[GRUPOS_ACT[g].id] = [];
    var exps = {}, vencidas = 0;
    for (var i = 0; i < datos.length; i++) {
      var d = datos[i];
      var gid = grupoDe(d.fila);
      cubos[gid].push(d);
      if (gid === 'vencidas') vencidas++;
      exps[claveDe(vista, d.fila)] = true;
    }
    var nExp = 0;
    for (var k in exps) { if (Object.prototype.hasOwnProperty.call(exps, k)) nExp++; }

    res.innerHTML =
      caja(datos.length.toLocaleString('es-CO'), datos.length === 1 ? 'actuación' : 'actuaciones') +
      caja(nExp.toLocaleString('es-CO'), nExp === 1 ? 'expediente' : 'expedientes') +
      caja(vencidas.toLocaleString('es-CO'), 'vencidas') +
      caja(huerfanas.length.toLocaleString('es-CO'), 'sin registro');

    var html = '';
    for (var g2 = 0; g2 < GRUPOS_ACT.length; g2++) {
      var gr = GRUPOS_ACT[g2];
      var lista = cubos[gr.id];
      if (!lista.length) continue;
      html += '<div class="bit-mes ' + gr.cl + '">' + escapar(gr.et) +
              '<span>' + lista.length + '</span></div>';
      for (var j = 0; j < lista.length; j++) html += tarjeta(vista, lista[j], false);
    }

    if (huerfanas.length) {
      html += '<div class="bit-mes mt-g-gris">SIN REGISTRO DE AUTOR<span>' +
              huerfanas.length + '</span></div>' +
              '<p class="mt-aviso">Estos expedientes ya tenían actuación antes de que la app ' +
              'guardara quién la pone. No hay de dónde sacar el autor ni la fecha: se muestran ' +
              'para que no falte nada. En cuanto alguien les cambie la actuación o la fecha de ' +
              'seguimiento, quedan registrados.</p>';
      for (var h = 0; h < huerfanas.length; h++) html += tarjetaHuerfana(vista, huerfanas[h]);
    }

    $('mt-lista').innerHTML = html;
  }

  /* ── pestaña SOLICITUDES: una tarjeta por conversación, pendientes primero ── */
  var hilos = [];   /* filas pintadas, para el botón «Abrir conversación» */

  function pintarSolicitudes(vista, datos) {
    var res = $('mt-resumen');
    hilos = [];
    if (!datos.length) {
      res.innerHTML = '<p class="bit-vacio">' + escapar(PESTANAS.solicitudes.vacio) + '</p>';
      $('mt-lista').innerHTML = '';
      return;
    }
    var sx = solexp();
    var mapa = {}, orden = [];
    for (var i = 0; i < datos.length; i++) {
      var d = datos[i];
      var k = claveDe(vista, d.fila) + '|' + (d.fila.id_proceso || d.fila.id_predial || '');
      if (!mapa[k]) { mapa[k] = { fila: d.fila, msgs: [] }; orden.push(k); }
      mapa[k].msgs.push(d);
    }
    var pend = [], resp = [];
    for (var j = 0; j < orden.length; j++) {
      var h = mapa[orden[j]];
      h.msgs.sort(function (a, c) { return a.orden - c.orden; });
      h.estado = sx.estadoFila(h.fila, vista);
      h.ultimo = h.msgs[h.msgs.length - 1];
      h.dia = 0;
      for (var m = 0; m < h.msgs.length; m++) if (h.msgs[m].dia > h.dia) h.dia = h.msgs[m].dia;
      (h.estado === 'PENDIENTE' ? pend : resp).push(h);
    }
    var porFecha = function (a, c) { return c.dia - a.dia; };
    pend.sort(porFecha); resp.sort(porFecha);

    res.innerHTML =
      caja(orden.length.toLocaleString('es-CO'), orden.length === 1 ? 'conversación' : 'conversaciones') +
      caja(pend.length.toLocaleString('es-CO'), 'pendientes') +
      caja(resp.length.toLocaleString('es-CO'), 'respondidas') +
      caja(datos.length.toLocaleString('es-CO'), datos.length === 1 ? 'mensaje' : 'mensajes');

    var html = '';
    var grupo = function (lista, et, cl) {
      if (!lista.length) return;
      html += '<div class="bit-mes ' + cl + '">' + escapar(et) + '<span>' + lista.length + '</span></div>';
      for (var g = 0; g < lista.length; g++) html += tarjetaHilo(vista, lista[g]);
    };
    grupo(pend, 'PENDIENTES DE RESPUESTA DE ARCHIVO', 'mt-g-rojo');
    grupo(resp, 'RESPONDIDAS', 'mt-g-verde');
    $('mt-lista').innerHTML = html;
  }

  function tarjetaHilo(vista, h) {
    var idx = hilos.length;
    hilos.push(h.fila);
    var r = h.fila, u = h.ultimo;
    var corto = String(u.texto || '').replace(/\s+/g, ' ');
    if (corto.length > 140) corto = corto.slice(0, 137) + '…';
    return '<div class="bit-item" data-mt-buscar="' + escapar(claveDe(vista, r)) + '">' +
             '<div class="bit-fecha">' + escapar(u.fecha) + '</div>' +
             '<div class="bit-cuerpo">' +
               '<p class="bit-exp">' + escapar(claveDe(vista, r) || '—') +
                 (quienDe(vista, r) ? ' <span>· ' + escapar(quienDe(vista, r)) + '</span>' : '') + '</p>' +
               '<p class="bit-extra">' + h.msgs.length + (h.msgs.length === 1 ? ' mensaje' : ' mensajes') +
                 ' · último de ' + escapar(u.autor || 'SIN AUTOR') + '</p>' +
               '<p class="bit-texto">' + escapar(corto || '(sin texto)') + '</p>' +
               '<button type="button" class="mt-sx-abrir' + (h.estado === 'PENDIENTE' ? ' sex-pendiente-txt' : '') +
                 '" data-mt-sx="' + idx + '" data-salida="1">💬 Abrir conversación</button>' +
             '</div>' +
           '</div>';
  }

  function tarjeta(vista, d, esBitacora) {
    var r = d.fila;
    var seg = txt(r.fecha_seguimiento);
    var pieSeg = (!esBitacora && seg)
      ? '<p class="mt-seg">Seguimiento: <b>' + escapar(seg) + '</b>' +
        (txt(r.recordatorio) ? ' · ' + escapar(txt(r.recordatorio)) : '') + '</p>'
      : '';
    return '<div class="bit-item" data-mt-buscar="' + escapar(claveDe(vista, r)) + '">' +
             '<div class="bit-fecha">' + escapar(d.fecha) + '</div>' +
             '<div class="bit-cuerpo">' +
               '<p class="bit-exp">' + escapar(claveDe(vista, r) || '—') +
                 (quienDe(vista, r) ? ' <span>· ' + escapar(quienDe(vista, r)) + '</span>' : '') + '</p>' +
               (d.autor ? '<p class="bit-extra">' + escapar(d.autor) + '</p>' : '') +
               '<p class="bit-texto">' + escapar(d.texto || '(sin texto)') + '</p>' +
               pieSeg +
             '</div>' +
           '</div>';
  }

  function tarjetaHuerfana(vista, r) {
    return '<div class="bit-item mt-huerfana" data-mt-buscar="' + escapar(claveDe(vista, r)) + '">' +
             '<div class="bit-fecha">—</div>' +
             '<div class="bit-cuerpo">' +
               '<p class="bit-exp">' + escapar(claveDe(vista, r) || '—') +
                 (quienDe(vista, r) ? ' <span>· ' + escapar(quienDe(vista, r)) + '</span>' : '') + '</p>' +
               '<p class="bit-texto">' + escapar(txt(r.actuacion)) + '</p>' +
               (txt(r.fecha_seguimiento)
                 ? '<p class="mt-seg">Seguimiento: <b>' + escapar(txt(r.fecha_seguimiento)) + '</b></p>'
                 : '') +
             '</div>' +
           '</div>';
  }

  /* ══════════════ descargar ══════════════ */

  function descargar() {
    var vista = abierta;
    var pest = pestanaActiva(vista);
    if (!window.BITEXPORT || typeof window.BITEXPORT.abrir !== 'function') {
      try {
        Swal.fire({ icon: 'warning', title: 'No se puede descargar',
                    text: 'No cargó js/bitacora-export.js. Recarga la app.' });
      } catch (_) {}
      return;
    }
    /* Se le pasa EXACTAMENTE el autor con el que se está mirando: lo que se
       ve en esta lista y lo que sale en el archivo son lo mismo. */
    cerrar();
    window.BITEXPORT.abrir(null, pest.fuente(vista), { autor: autorDe(vista) });
  }

  /* ══════════════ montaje ══════════════ */

  function alEntrar(vista) {
    if (!conocida(vista)) return;
    pintarPastilla(vista);
    setTimeout(function () { pintarNumero(vista); }, 400);
    setTimeout(function () { pintarNumero(vista); }, 2500);
  }

  function engancharVistas() {
    var original = window.showView;
    if (typeof original !== 'function' || original.__mt) return;
    var envuelta = function (id) {
      var r = original.apply(this, arguments);
      try { alEntrar(id); } catch (e) { console.warn('MITRABAJO:', e); }
      return r;
    };
    envuelta.__mt = true;
    window.showView = envuelta;
  }

  function arrancar() {
    envolverRender('renderBDPredial_', 'view-bd-predial');
    envolverRender('renderProcList_', 'view-asignaciones');
    engancharVistas();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', arrancar);
  else arrancar();

  /* app.js reasigna renderProcList_ al final de su archivo y otras capas
     envuelven showView: se vuelve a enganchar por si alguna llegó después.
     Es idempotente (marca __mt). */
  setTimeout(arrancar, 1500);

  /* Puerta para las pruebas. */
  window.MITRABAJO.abrir = abrir;
  window.MITRABAJO.cerrar = cerrar;
  window.MITRABAJO.items = items;
  window.MITRABAJO.autores = autores;
  window.MITRABAJO.sinRegistro = sinRegistro;
  window.MITRABAJO.grupoDe = grupoDe;
  window.MITRABAJO.estado = estado;
  window.MITRABAJO.pintar = pintar;
  window.MITRABAJO.montar = alEntrar;
  window.MITRABAJO.descargar = descargar;
  window.MITRABAJO.filas = filasDe;
  window.MITRABAJO.todo = filasTodo;
  window.MITRABAJO.pestanas = pestanasDe;
  window.MITRABAJO.activa = pestanaActiva;
})();
