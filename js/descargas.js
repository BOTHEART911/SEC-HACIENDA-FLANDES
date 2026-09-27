/* ============================================================
   DESCARGAS — FASE 6 · SEC-HACIENDA
   Los 3 modales de descarga a Excel.

   Qué reemplaza
     Los 3 botones viejos eran enlaces fijos a archivos de Drive
     (columnas G, H e I de USUARIOS): había que mantenerlos a mano.
     Ahora el archivo se arma en el momento, con las columnas que
     cada quien marque y solo con SUS filas.

   Cómo funciona
     1) Al abrir un modal por primera vez se piden las opciones al
        servidor: qué descargas ve esta persona, las columnas de la
        hoja (leídas de su fila 1) y los valores reales de los
        filtros. Una sola llamada para los 3 modales.
     2) Al descargar, el servidor manda las filas por páginas y el
        navegador arma el .xlsx. Quien baja 9.400 expedientes ve el
        avance; quien baja 300 no alcanza a notarlo.

   Quién puede qué
     No se decide aquí. El botón se enciende con el alcance de la
     Fase 5 y el servidor vuelve a comprobarlo en cada página: aunque
     alguien edite la petición con la consola, no le llegan filas
     ajenas.

   Excel
     La librería que escribe el .xlsx se baja solo cuando hace falta
     (la primera descarga), no en el arranque de la app. Si no se
     puede bajar, se ofrece el mismo contenido en CSV para que nadie
     se quede sin su archivo.

   No modifica app.js: se carga después y usa lo que app.js expone.
   ============================================================ */
(function () {
  'use strict';

  if (window.__HACDSC_LISTO) return;      /* guarda contra doble montaje */
  window.__HACDSC_LISTO = true;

  var CDN_XLSX  = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
  var CLAVE_COLS = 'hac.descargas.v1';    /* últimas columnas marcadas */
  var VIDA_OPCIONES_MS = 10 * 60 * 1000;  /* refrescar opciones cada 10 min */

  /* fuente -> botón que la abre y llave del alcance que la enciende */
  var FUENTES = {
    solicitudes: {
      boton: 'btn-mis-informes',
      ver:   'descargaSolicitudes',
      titulo:'MIS INFORMES PREDIAL',
      hoja:  'SOLICITUDES',
      fecha: true
    },
    predial: {
      boton: 'btn-bdp-mis-exp',
      ver:   'descargaPredial',
      titulo:'DATOS EXCEL',
      hoja:  'PREDIAL',
      filtros: true,
      /* LOTE 13/08 — rango OPCIONAL por las fechas de la BITÁCORA (col S) */
      bitacora: true
    },
    procesos: {
      boton: 'btn-mis-procesos',
      ver:   'descargaProcesos',
      titulo:'MIS PROCESOS',
      hoja:  'PROCESOS',
      /* LOTE 13/08 — rango por FECHA DE CREACION (col B), marcado de entrada
         y se puede desmarcar para llevarse todas las filas */
      creacion: true
    }
  };

  var opciones = null;        /* respuesta de descargaopciones */
  var pedidoEn = 0;
  var fuenteActiva = '';
  var bajando = false;

  /* ══════════════ utilidades ══════════════ */

  function $(id) { return document.getElementById(id); }

  function uid() {
    try {
      if (typeof window.uidActual_ === 'function') {
        var u = window.uidActual_();
        if (u) return u;
      }
      var p = window.IDN && window.IDN.perfil ? window.IDN.perfil() : null;
      if (p && p.uid) return p.uid;
    } catch (_) {}
    return '';
  }

  /* LOTE 06/09 — el aviso se da por DOS caminos a la vez:
     (1) SweetAlert, que ya sale por encima del modal (css/base-visual.css), y
     (2) una línea dentro del propio modal, que no depende de ninguna capa ni
         de que el CDN de Swal haya cargado.
     Así, si mañana otra hoja de estilos vuelve a tapar el aviso, el usuario
     sigue viendo por qué no le salió el archivo. */
  function avisar(icono, titulo, texto) {
    enModal(titulo, texto, icono);
    if (window.Swal) {
      window.Swal.fire({ icon: icono, title: titulo, text: texto || '' });
    } else {
      alert(titulo + (texto ? '\n' + texto : ''));
    }
  }

  /* Escribe el aviso dentro del modal (si está abierto). */
  function enModal(titulo, texto, icono) {
    var capa = document.getElementById('modal-descargas');
    if (!capa || capa.classList.contains('hidden')) return;
    var el = $('dsc-avance');
    if (!el) return;
    el.textContent = titulo + (texto ? ' — ' + texto : '');
    el.className = 'dsc-avance ' +
      (icono === 'error' || icono === 'warning' ? 'dsc-avance-malo' : 'dsc-avance-aviso');
  }

  /* LOTE 06/09 — true cuando esta persona baja PREDIAL por su BITACORA
     (rol ASISTENTE). Lo dice el servidor en descargaopciones. */
  function porBitacora() {
    return !!(opciones && opciones.porBitacora && fuenteActiva === 'predial');
  }

  function hoyISO(d) {
    var f = d || new Date();
    var p = function (n) { return String(n).padStart(2, '0'); };
    return f.getFullYear() + '-' + p(f.getMonth() + 1) + '-' + p(f.getDate());
  }

  function selloArchivo() {
    var f = new Date();
    var p = function (n) { return String(n).padStart(2, '0'); };
    return p(f.getDate()) + '-' + p(f.getMonth() + 1) + '-' + f.getFullYear();
  }

  function guardadas(fuente) {
    try {
      var t = JSON.parse(localStorage.getItem(CLAVE_COLS) || '{}');
      return Array.isArray(t[fuente]) ? t[fuente] : null;
    } catch (_) { return null; }
  }

  function guardar(fuente, cols) {
    try {
      var t = JSON.parse(localStorage.getItem(CLAVE_COLS) || '{}');
      t[fuente] = cols;
      localStorage.setItem(CLAVE_COLS, JSON.stringify(t));
    } catch (_) {}
  }

  /* ══════════════ opciones ══════════════ */

  function traerOpciones(forzar) {
    var u = uid();
    if (!u) return Promise.resolve(null);
    if (!forzar && opciones && (Date.now() - pedidoEn) < VIDA_OPCIONES_MS) {
      return Promise.resolve(opciones);
    }
    return window.apiGet('descargaopciones', { uid: u }).then(function (res) {
      if (res && res.encontrado) { opciones = res; pedidoEn = Date.now(); return res; }
      return null;
    }).catch(function (e) {
      console.warn('DESCARGAS: no se pudieron traer las opciones.', e);
      return null;
    });
  }

  /* ══════════════ el modal ══════════════ */

  function crearModal() {
    if ($('modal-descargas')) return;

    var capa = document.createElement('div');
    capa.id = 'modal-descargas';
    capa.className = 'hidden';
    capa.setAttribute('role', 'dialog');
    capa.innerHTML =
      '<div class="card narrow dsc-caja">' +
        '<h2 id="dsc-titulo" style="color:var(--primary);margin-top:0;">DESCARGA</h2>' +
        '<p id="dsc-alcance" class="dsc-alcance"></p>' +
        '<div id="dsc-filtros" class="dsc-filtros"></div>' +
        '<div class="dsc-cols-cab">' +
          '<label>Columnas del archivo</label>' +
          '<div class="dsc-cols-acc">' +
            '<button type="button" id="btn-dsc-todas" class="dsc-mini">Todas</button>' +
            '<button type="button" id="btn-dsc-ninguna" class="dsc-mini">Ninguna</button>' +
          '</div>' +
        '</div>' +
        '<div id="dsc-columnas" class="dsc-columnas"></div>' +
        '<p id="dsc-conteo" class="dsc-conteo"></p>' +
        '<p id="dsc-avance" class="dsc-avance"></p>' +
        '<div class="btn-row" style="margin-top:14px;">' +
          '<button id="btn-dsc-descargar" class="btn-primary">DESCARGAR EXCEL</button>' +
          '<button id="btn-dsc-cerrar" class="danger">CERRAR</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(capa);

    $('btn-dsc-cerrar').addEventListener('click', cerrar);
    $('btn-dsc-todas').addEventListener('click', function () { marcarTodas(true); });
    $('btn-dsc-ninguna').addEventListener('click', function () { marcarTodas(false); });
    $('btn-dsc-descargar').addEventListener('click', descargar);

    /* FASE 8 — el contador de filas.
       Los filtros SÍ cambian cuántas filas salen ⇒ se vuelve a preguntar.
       Las columnas NO ⇒ solo se repinta el texto, sin pedirle nada al
       servidor (marcar 20 columnas no trae ni una fila más). */
    $('dsc-filtros').addEventListener('change', function (ev) {
      /* LOTE 13/08 — el interruptor del rango atenúa o enciende su bloque */
      var t = ev && ev.target;
      if (t && t.type === 'checkbox' && /-(bit|crea)$/.test(t.id || '')) {
        var caja = $(t.id + '-bloque');
        if (caja) caja.classList.toggle('dsc-off', !t.checked);
      }
      contar(false);
    });
    $('dsc-filtros').addEventListener('input',  function () { contar(false); });
    $('dsc-columnas').addEventListener('change', pintarConteo);

    /* Que cierre con clic fuera como los demás modales (Fase 3). */
    try { if (window.BV && window.BV._cierres) window.BV._cierres['modal-descargas'] = ['btn-dsc-cerrar']; }
    catch (_) {}
  }

  function marcarTodas(valor) {
    var cajas = document.querySelectorAll('#dsc-columnas input[type=checkbox]');
    for (var i = 0; i < cajas.length; i++) cajas[i].checked = valor;
    pintarConteo();
  }

  function columnasMarcadas() {
    var out = [];
    var cajas = document.querySelectorAll('#dsc-columnas input[type=checkbox]');
    for (var i = 0; i < cajas.length; i++) if (cajas[i].checked) out.push(cajas[i].value);
    return out;
  }

  function pintarColumnas(fuente, lista) {
    var cont = $('dsc-columnas');
    cont.innerHTML = '';
    var previas = guardadas(fuente);

    for (var i = 0; i < lista.length; i++) {
      var col = lista[i];
      var id = 'dsc-c-' + col.c;
      var fila = document.createElement('label');
      fila.className = 'dsc-col';
      fila.setAttribute('for', id);

      var caja = document.createElement('input');
      caja.type = 'checkbox';
      caja.id = id;
      caja.value = col.c;
      caja.checked = previas ? (previas.indexOf(col.c) !== -1) : true;

      var txt = document.createElement('span');
      txt.textContent = col.t;

      fila.appendChild(caja);
      fila.appendChild(txt);
      cont.appendChild(fila);
    }
  }

  /* LOTE 13/08 — bloque de rango con interruptor.
     `id` es el del check; los campos quedan como <id>-desde / <id>-hasta.
     Cuando el check está apagado, el bloque se ve atenuado y no se manda
     ningún rango: se descarga todo. */
  function bloqueRango(id, titulo, nota, marcado, desdeISO, hastaISO) {
    var caja = document.createElement('div');
    caja.className = 'dsc-bloque' + (marcado ? '' : ' dsc-off');
    caja.id = id + '-bloque';
    caja.innerHTML =
      '<label class="dsc-check" for="' + id + '">' +
        '<input type="checkbox" id="' + id + '"' + (marcado ? ' checked' : '') + '>' +
        '<span>' + titulo + '</span>' +
      '</label>' +
      '<div class="dsc-rango">' +
        '<div><label for="' + id + '-desde">Desde</label>' +
          '<input type="date" id="' + id + '-desde" value="' + desdeISO + '"></div>' +
        '<div><label for="' + id + '-hasta">Hasta</label>' +
          '<input type="date" id="' + id + '-hasta" value="' + hastaISO + '"></div>' +
      '</div>' +
      (nota ? '<p class="dsc-nota">' + nota + '</p>' : '');
    return caja;
  }

  function pintarFiltros(fuente) {
    var cont = $('dsc-filtros');
    cont.innerHTML = '';
    var def = FUENTES[fuente];
    var todo = !!(opciones && opciones.todo);

    var hoy = new Date();
    var primero = new Date(hoy.getFullYear(), hoy.getMonth(), 1);

    if (def.fecha) {
      cont.innerHTML =
        '<div class="dsc-rango">' +
          '<div><label for="dsc-desde">Desde</label>' +
            '<input type="date" id="dsc-desde" value="' + hoyISO(primero) + '"></div>' +
          '<div><label for="dsc-hasta">Hasta</label>' +
            '<input type="date" id="dsc-hasta" value="' + hoyISO(hoy) + '"></div>' +
        '</div>' +
        '<p class="dsc-nota">Se filtra por <b>fecha_guardado</b>. Déjalo vacío para llevarte todo.</p>';
      return;
    }

    if (def.filtros) {
      var f = (opciones && opciones.filtros) ||
              { clasificaciones: [], letras: [], actuaciones: [], sustanciadores: [] };
      cont.appendChild(selector('dsc-clasificacion', 'CLASIFICACIÓN', f.clasificaciones, 'Todas'));
      cont.appendChild(selector('dsc-letra', 'NO. EXP. FÍSICO (A–Z)', f.letras, 'Todas'));
      cont.appendChild(selector('dsc-actuacion', 'ACTUACIÓN', f.actuaciones, 'Todas'));

      /* Solo quien ve todas las filas necesita elegir de quién son */
      if (todo) {
        cont.appendChild(selector('dsc-sustanciador', 'SUSTANCIADOR',
                                  f.sustanciadores || [], 'Todos'));
      }

      var orden = document.createElement('label');
      orden.className = 'dsc-orden';
      orden.innerHTML = '<input type="checkbox" id="dsc-orden"> ' +
        '<span>Ordenar de la A a la Z por NO. EXP. FÍSICO</span>';
      cont.appendChild(orden);
    }

    /* LOTE 13/08 — BITÁCORA: opcional, apagado de entrada */
    if (def.bitacora) {
      cont.appendChild(bloqueRango(
        'dsc-bit',
        'Descargar por fecha en Bitácora (opcional)',
        todo
          ? 'Deja las filas con alguna anotación fechada en el rango. Si eliges un ' +
            '<b>SUSTANCIADOR</b>, cuentan solo las anotaciones suyas.'
          : 'Deja las filas donde <b>tú</b> escribiste alguna anotación en ese rango.',
        false, hoyISO(primero), hoyISO(hoy)
      ));
    }

    /* LOTE 13/08 — FECHA DE CREACIÓN: marcado de entrada; al desmarcarlo se
       descargan todas las filas */
    if (def.creacion) {
      if (todo) {
        cont.appendChild(selector('dsc-asignado', 'ASIGNADO',
          ((opciones && opciones.filtrosProc) || {}).asignados || [], 'Todos'));
      }
      cont.appendChild(bloqueRango(
        'dsc-crea',
        'Descargar por fecha de Creación',
        'Desmárcalo para llevarte todas las filas, sin rango de fechas.',
        true, hoyISO(primero), hoyISO(hoy)
      ));
    }
  }

  function selector(id, etiqueta, valores, textoVacio) {
    var caja = document.createElement('div');
    caja.className = 'dsc-campo';

    var lab = document.createElement('label');
    lab.setAttribute('for', id);
    lab.textContent = etiqueta;

    var sel = document.createElement('select');
    sel.id = id;

    var op0 = document.createElement('option');
    op0.value = '';
    op0.textContent = textoVacio;
    sel.appendChild(op0);

    for (var i = 0; i < valores.length; i++) {
      var o = document.createElement('option');
      o.value = valores[i];
      o.textContent = valores[i];
      sel.appendChild(o);
    }

    caja.appendChild(lab);
    caja.appendChild(sel);
    return caja;
  }

  function abrir(fuente) {
    if (!FUENTES[fuente]) return;

    traerOpciones(false).then(function (op) {
      if (!op) {
        avisar('error', 'No se pudo preparar la descarga',
               'Revisa la conexión e inténtalo otra vez.');
        return;
      }
      if (!op.ver[fuente]) {
        avisar('info', 'No tienes filas que descargar aquí',
               'Esta descarga es de las filas que están a tu nombre.');
        return;
      }

      crearModal();
      fuenteActiva = fuente;

      $('dsc-titulo').textContent = FUENTES[fuente].titulo;
      $('dsc-alcance').textContent = op.todo
        ? 'Se descargan TODAS las filas de la hoja ' + FUENTES[fuente].hoja + '.'
        : (op.porBitacora && fuente === 'predial'
            ? 'Se descargan los expedientes donde TÚ escribiste en la bitácora.'
            : 'Se descargan solo las filas que están a tu nombre.');
      avance('');

      pintarFiltros(fuente);
      pintarColumnas(fuente, op.columnas[fuente] || []);

      $('modal-descargas').classList.remove('hidden');

      /* FASE 8 — el conteo arranca con el modal, ya con los filtros de fábrica */
      contTotal = null;
      pintarConteo('Contando filas…');
      contar(true);
    });
  }

  function cerrar() {
    if (bajando) return;                 /* no dejar el archivo a medias */
    var m = $('modal-descargas');
    if (m) m.classList.add('hidden');
  }

  /* ══════════════ FASE 8 — cuántas filas se van a descargar ══════════════
     Se le pregunta al backend con soloTotal:true (Descargas.gs): filtra igual
     que la descarga real pero no arma ninguna página, así se puede preguntar
     cada vez que el usuario mueve un filtro. La respuesta se guarda por
     combinación de filtros para no repetir la misma pregunta. */

  var contTotal   = null;     /* último total conocido            */
  var contTimer   = null;     /* rebote del teclado/los selects   */
  var contPedido  = 0;        /* para descartar respuestas viejas */
  var contCache   = {};       /* firma de filtros → total         */

  function firma(fuente, filtros) {
    return fuente + '|' + JSON.stringify(filtros || {});
  }

  function nColumnas() {
    return columnasMarcadas().length;
  }

  function pintarConteo(texto) {
    var el = $('dsc-conteo');
    if (!el) return;
    if (typeof texto === 'string') { el.textContent = texto; return; }

    var cols = nColumnas();
    if (contTotal === null) { el.textContent = ''; return; }
    if (contTotal === 0) {
      el.textContent = 'Con estos filtros no queda ninguna fila para descargar.';
      return;
    }
    el.textContent = 'Se van a descargar ' + contTotal.toLocaleString('es-CO') +
      ' filas × ' + cols + (cols === 1 ? ' columna' : ' columnas') + '.';
  }

  /* Petición sin el girador de pantalla: es un dato de apoyo, no una acción
     del usuario; no debe tapar el modal ni levantar el escudo de la capa 12. */
  function pedirSilencioso(accion, cuerpo) {
    var base = (typeof API_BASE !== 'undefined' && API_BASE) ? API_BASE : '';
    if (!base) return window.apiPost(accion, cuerpo);
    return fetch(base + '?action=' + encodeURIComponent(accion), {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(cuerpo)
    }).then(function (r) { return r.json(); }).then(function (j) {
      if (!j.ok) throw new Error(j.error || 'Error');
      return j.data;
    });
  }

  function contar(inmediato) {
    if (contTimer) { clearTimeout(contTimer); contTimer = null; }
    var espera = inmediato ? 0 : 450;
    contTimer = setTimeout(contarYa, espera);
  }

  function contarYa() {
    contTimer = null;
    var fuente = fuenteActiva;
    if (!FUENTES[fuente]) return;

    var u = uid();
    if (!u) { contTotal = null; pintarConteo(''); return; }

    var filtros = filtrosDelModal(fuente);
    delete filtros.orden;                 /* el orden no cambia el conteo */
    var f = firma(fuente, filtros);

    if (contCache.hasOwnProperty(f)) {
      contTotal = contCache[f];
      pintarConteo();
      return;
    }

    var mio = ++contPedido;
    pintarConteo('Contando filas…');

    pedirSilencioso('descargar', { uid: u, fuente: fuente, filtros: filtros, soloTotal: true })
      .then(function (res) {
        if (mio !== contPedido) return;             /* llegó tarde */
        var t = (res && typeof res.total === 'number') ? res.total : null;
        contTotal = t;
        if (t !== null) contCache[f] = t;
        pintarConteo();
      })
      .catch(function (e) {
        if (mio !== contPedido) return;
        contTotal = null;
        pintarConteo('');
        console.warn('DESCARGAS: no se pudo contar las filas.', e);
      });
  }

  /* ══════════════ la descarga ══════════════ */

  function filtrosDelModal(fuente) {
    var def = FUENTES[fuente];
    var out = {};
    if (def.fecha) {
      var d = $('dsc-desde'), h = $('dsc-hasta');
      if (d && d.value) out.desde = d.value;
      if (h && h.value) out.hasta = h.value;
    }
    if (def.filtros) {
      var c = $('dsc-clasificacion'), l = $('dsc-letra'), a = $('dsc-actuacion'), o = $('dsc-orden');
      var su = $('dsc-sustanciador');
      if (c && c.value) out.clasificacion = c.value;
      if (l && l.value) out.letra = l.value;
      if (a && a.value) out.actuacion = a.value;
      if (su && su.value) out.sustanciador = su.value;
      if (o && o.checked) out.orden = 'exp';
    }
    if (def.bitacora && $('dsc-bit') && $('dsc-bit').checked) {
      var bd = $('dsc-bit-desde'), bh = $('dsc-bit-hasta');
      if (bd && bd.value) out.bitDesde = bd.value;
      if (bh && bh.value) out.bitHasta = bh.value;
    }
    if (def.creacion) {
      var as = $('dsc-asignado');
      if (as && as.value) out.asignado = as.value;
      if ($('dsc-crea') && $('dsc-crea').checked) {
        var cd = $('dsc-crea-desde'), ch = $('dsc-crea-hasta');
        if (cd && cd.value) out.desde = cd.value;
        if (ch && ch.value) out.hasta = ch.value;
      }
    }
    return out;
  }

  function avance(texto) {
    var el = $('dsc-avance');
    if (!el) return;
    el.textContent = texto || '';
    el.className = 'dsc-avance';
  }

  function descargar() {
    if (bajando) return;
    var fuente = fuenteActiva;
    if (!FUENTES[fuente]) return;

    var cols = columnasMarcadas();
    if (!cols.length) {
      avisar('info', 'Marca al menos una columna', 'Sin columnas no hay archivo que armar.');
      return;
    }
    guardar(fuente, cols);

    var filtros = filtrosDelModal(fuente);
    var u = uid();
    if (!u) { avisar('error', 'Sesión no válida', 'Vuelve a iniciar sesión.'); return; }

    bajando = true;
    $('btn-dsc-descargar').disabled = true;
    avance('Preparando…');

    var encabezados = null;
    var filas = [];
    var titulo = FUENTES[fuente].titulo;

    function pagina(n) {
      return window.apiPost('descargar', {
        uid: u, fuente: fuente, columnas: cols, filtros: filtros, pagina: n
      }).then(function (res) {
        if (!encabezados) encabezados = res.encabezados || [];
        if (res.archivo) titulo = res.archivo;
        filas = filas.concat(res.filas || []);
        if (res.total) {
          avance('Bajando ' + filas.length.toLocaleString('es-CO') +
                 ' de ' + res.total.toLocaleString('es-CO') + '…');
        }
        if (res.hayMas) return pagina(n + 1);
        return res;
      });
    }

    pagina(1).then(function () {
      if (!filas.length) {
        avisar('info', 'No hay filas para descargar',
               porBitacora()
                 ? 'Tu archivo sale de los expedientes donde escribiste en la bitácora; con estos filtros no quedó ninguno.'
                 : 'Con los filtros que elegiste no quedó ninguna fila.');
        return;
      }
      avance('Armando el archivo…');
      return escribirExcel(titulo, encabezados, filas).then(function () {
        avance(filas.length.toLocaleString('es-CO') + ' filas descargadas.');
      });
    }).catch(function (e) {
      avisar('error', 'No se pudo descargar', (e && e.message) ? e.message : String(e));
    }).then(function () {
      bajando = false;
      var b = $('btn-dsc-descargar');
      if (b) b.disabled = false;
    });
  }

  /* ══════════════ el archivo ══════════════ */

  function cargarXLSX() {
    if (window.XLSX) return Promise.resolve(true);
    return new Promise(function (ok) {
      var s = document.createElement('script');
      s.src = CDN_XLSX;
      s.onload = function () { ok(!!window.XLSX); };
      s.onerror = function () { ok(false); };
      document.head.appendChild(s);
    });
  }

  function anchos(encabezados, filas) {
    var out = [];
    for (var c = 0; c < encabezados.length; c++) {
      var max = String(encabezados[c] || '').length;
      var tope = Math.min(filas.length, 200);      /* muestra: no recorrer 9.400 */
      for (var i = 0; i < tope; i++) {
        var v = filas[i][c];
        var n = String(v == null ? '' : v).length;
        if (n > max) max = n;
      }
      out.push({ wch: Math.min(Math.max(max + 2, 10), 45) });
    }
    return out;
  }

  function nombreArchivo(titulo, ext) {
    return String(titulo).replace(/[\\/:*?"<>|]/g, ' ').trim() +
           ' ' + selloArchivo() + '.' + ext;
  }

  function escribirExcel(titulo, encabezados, filas) {
    return cargarXLSX().then(function (hay) {
      if (!hay) return escribirCSV(titulo, encabezados, filas);

      var hoja = window.XLSX.utils.aoa_to_sheet([encabezados].concat(filas));
      hoja['!cols'] = anchos(encabezados, filas);
      hoja['!freeze'] = { xSplit: 0, ySplit: 1 };

      var libro = window.XLSX.utils.book_new();
      var nombreHoja = String(titulo).substring(0, 28) || 'Datos';
      window.XLSX.utils.book_append_sheet(libro, hoja, nombreHoja);
      window.XLSX.writeFile(libro, nombreArchivo(titulo, 'xlsx'));
      return true;
    });
  }

  /* Respaldo si no se pudo bajar la librería: el mismo contenido en
     CSV con punto y coma y BOM, que es lo que abre bien Excel aquí. */
  function escribirCSV(titulo, encabezados, filas) {
    var esc = function (v) {
      var s = String(v == null ? '' : v);
      return /[";\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    var lineas = [encabezados.map(esc).join(';')];
    for (var i = 0; i < filas.length; i++) lineas.push(filas[i].map(esc).join(';'));

    var blob = new Blob(['\ufeff' + lineas.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = nombreArchivo(titulo, 'csv');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);

    avisar('info', 'Se descargó en CSV',
           'No se pudo cargar la librería de Excel. El CSV abre en Excel con doble clic.');
    return true;
  }

  /* ══════════════ enganche con los botones ══════════════ */

  function engancharBotones() {
    Object.keys(FUENTES).forEach(function (fuente) {
      var b = $(FUENTES[fuente].boton);
      if (!b || b.__dsc) return;
      b.__dsc = true;
      b.addEventListener('click', function () { abrir(fuente); });
    });
  }

  /* Al cambiar de usuario se olvidan las opciones: nada de columnas
     ni permisos heredados de la persona anterior. */
  function olvidar() {
    caducar();
    cerrar();
  }

  /* Igual que olvidar, pero sin cerrar lo que esté abierto. Lo llama
     js/alcance.js cuando el alcance cambió en caliente (a alguien le
     acaban de asignar su primer expediente). */
  function caducar() {
    opciones = null;
    pedidoEn = 0;
  }

  function arrancar() {
    engancharBotones();
    try { $('btn-logout')?.addEventListener('click', olvidar); } catch (_) {}
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', arrancar);
  else arrancar();

  window.DESCARGAS = {
    abrir: abrir,
    cerrar: cerrar,
    olvidar: olvidar,
    caducar: caducar,
    opciones: function () { return opciones; },
    recargarOpciones: function () { return traerOpciones(true); }
  };
})();
