/* ============================================================
   SOLICITUD EXPEDIENTE — 17/09/2026 · SEC-HACIENDA
   El "Mensaje o Bitácora" entre quien trabaja un expediente y el rol
   ARCHIVO. En ASIGNACIONES (PROCESOS col AD) y, desde hoy, también en
   BD PREDIAL (PREDIAL col AP).

   Qué hace este archivo
     1) Es el DUEÑO del lector de la solicitud: `SOLEXP.entradas(texto)`.
        Lo usan la tarjeta (botón rojo con latido), las pastillas de
        filtro de app.js, MI TRABAJO y la descarga a Excel/PDF. Una sola
        regla para todos.
     2) El modal MENSAJE O BITÁCORA (el de siempre, #modal-expediente),
        ahora con cada mensaje en su burbuja, con fecha y con quién lo
        escribió.
     3) Enviar: el navegador manda SOLO el mensaje nuevo; el servidor lo
        añade al final con la fecha y la hora (SolicitudExp.gs). Antes el
        navegador mandaba el historial entero y dos personas escribiendo
        a la vez se pisaban.

   El formato (bloques separados por una línea en blanco)
       NOMBRE COMPLETO dd/mm/aaaa hh:mm: texto      ← desde hoy
       SOL MAR: texto                               ← los viejos, sin fecha
   Los viejos usan los dos primeros nombres. Para saber quién es quién se
   mira contra los nombres que ya trajo el servidor (ALC.catalogos): si
   hay UNA sola persona con esos dos primeros nombres, es ella.

   ¿Cuándo va en rojo?
     Cuando hay mensajes y el ÚLTIMO no es de alguien con rol ARCHIVO.
     Ej.: solicitud → respuesta → nueva solicitud  ⇒ rojo.

   ¿Qué solicitudes son "mías"?
     Las conversaciones (expedientes) donde escribí al menos un mensaje;
     se toma la conversación entera, porque una solicitud sin su
     respuesta no le sirve a nadie. Quien tiene el rol ARCHIVO es la
     destinataria de TODAS: para ella, todas son suyas.
   ============================================================ */
(function () {
  'use strict';

  if (window.__HACSOLEXP_LISTO) return;
  window.__HACSOLEXP_LISTO = true;

  var MESES = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO',
               'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];

  /* Lo que cambia entre las dos vistas. */
  var VISTAS = {
    'view-asignaciones': {
      campo:  'solicitudExpediente',
      accion: 'solicitudexpproceso',
      id:     function (r) { return txt(r.id_proceso); },
      clave:  function (r) { return txt(r.consecutivo) || txt(r.id_proceso); },
      titulo: function (r) {
        return 'Cons. ' + (txt(r.consecutivo) || '—') +
               (txt(r.expediente) ? ' · Exp. ' + txt(r.expediente) : '');
      },
      quien:  function (r) { return txt(r.peticionario) || txt(r.descripcion).slice(0, 70); },
      aviso:  function (r, yo) {
        return 'Tienes una solicitud de *' + yo + '*\n' +
               '*N° Exp. Interno:* ' + (txt(r.expediente) || txt(r.id_proceso)) + '\n' +
               '> Revisa la App';
      },
      todo: '__procListCache',
      refrescar: 'applyProcFilters_'
    },
    'view-bd-predial': {
      campo:  'solicitud_expediente',
      accion: 'solicitudexppredial',
      id:     function (r) { return txt(r.id_predial); },
      clave:  function (r) { return txt(r.no_exp_fisico) || txt(r.id_predial); },
      titulo: function (r) { return 'Exp. ' + (txt(r.no_exp_fisico) || txt(r.id_predial) || '—'); },
      quien:  function (r) { return txt(r.nombres); },
      aviso:  function (r, yo) {
        return 'Tienes una solicitud de *' + yo + '*\n' +
               '*BD Predial · N° Exp. Físico:* ' + (txt(r.no_exp_fisico) || txt(r.id_predial)) + '\n' +
               (txt(r.nombres) ? '*Contribuyente:* ' + txt(r.nombres) + '\n' : '') +
               '> Revisa la App';
      },
      todo: '__bdpListCache',
      refrescar: 'applyBDPredialFilters_'
    }
  };

  /* ══════════════ utilidades ══════════════ */

  function $(id) { return document.getElementById(id); }
  function txt(v) { return String(v == null ? '' : v).trim(); }

  function norm(s) {
    return String(s == null ? '' : s)
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ').trim().toUpperCase();
  }

  function escapar(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }

  function prefijo(nombre) {
    return norm(nombre).split(' ').filter(Boolean).slice(0, 2).join(' ');
  }

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

  function sonar(cual) {
    try { if (window.playSoundOnce && window.SOUNDS && window.SOUNDS[cual]) window.playSoundOnce(window.SOUNDS[cual]); }
    catch (_) {}
  }

  /* ══════════════ quién es quién ══════════════ */

  /* Se rehace solo si cambian los catálogos (llegan con el alcance). */
  var memo = { firma: '', archivo: [], todos: [] };

  function catalogos() {
    var cs = (window.ALC && window.ALC.catalogos) || {};
    var firma = '';
    try { firma = JSON.stringify(cs).length + ':' + (window.ALC && window.ALC.nombre || ''); } catch (_) {}
    if (firma === memo.firma) return memo;

    var archivo = [], todos = {}, k, i;
    var lista = cs.archivo || [];
    for (i = 0; i < lista.length; i++) {
      var n = norm(lista[i] && lista[i].nombre);
      if (n) archivo.push(n);
    }
    for (k in cs) {
      if (!Object.prototype.hasOwnProperty.call(cs, k)) continue;
      var l = cs[k] || [];
      for (i = 0; i < l.length; i++) {
        var m = norm(l[i] && (l[i].nombre != null ? l[i].nombre : l[i]));
        if (m) todos[m] = true;
      }
    }
    var yo = miNombre();
    if (yo) todos[yo] = true;
    memo = { firma: firma, archivo: archivo, todos: Object.keys(todos) };
    return memo;
  }

  /** Nombre completo de un autor escrito con los dos primeros nombres.
   *  Solo si hay UNA persona que calce; si no, se deja como está. */
  function canon(autor) {
    var a = norm(autor);
    if (!a) return '';
    var c = catalogos();
    if (c.todos.indexOf(a) !== -1) return a;
    var hits = [];
    for (var i = 0; i < c.todos.length; i++) {
      if (prefijo(c.todos[i]) === a) hits.push(c.todos[i]);
    }
    return hits.length === 1 ? hits[0] : a;
  }

  function esArchivoNombre(autor) {
    var a = norm(autor);
    if (!a) return false;
    var c = catalogos();
    for (var i = 0; i < c.archivo.length; i++) {
      if (c.archivo[i] === a || prefijo(c.archivo[i]) === a) return true;
    }
    return false;
  }

  function soyArchivo() {
    try {
      if (typeof window.esArchivo_ === 'function') return !!window.esArchivo_();
    } catch (_) {}
    return esArchivoNombre(miNombre());
  }

  /* ══════════════ el lector ══════════════ */

  /* Autor en MAYÚSCULAS (con tildes y puntos), de 1 a 6 palabras, fecha y
     hora opcionales, y dos puntos. Si un bloque no calza, es la
     continuación del mensaje anterior. */
  var CABEZA = /^([A-ZÁÉÍÓÚÜÑ][A-ZÁÉÍÓÚÜÑ.]*(?:[ \t]+[A-ZÁÉÍÓÚÜÑ][A-ZÁÉÍÓÚÜÑ.]*){0,5})(?:[ \t]+(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ \t]+(\d{1,2}):(\d{2}))?)?[ \t]*:[ \t]*([\s\S]*)$/;

  /**
   * Mensajes de una solicitud, en el orden en que están escritos.
   * [{ orden, autor, canon, dia (aaaammdd, 0 sin fecha), anio, mes,
   *    fecha ('dd/mm/aaaa hh:mm' o ''), texto, esArchivo }]
   */
  function entradas(texto) {
    var s = String(texto == null ? '' : texto).replace(/\r\n?/g, '\n');
    if (!s.trim()) return [];
    var bloques = s.split(/\n[ \t]*\n/);
    var out = [];
    for (var i = 0; i < bloques.length; i++) {
      var b = bloques[i].replace(/^\s+|\s+$/g, '');
      if (!b) continue;
      var m = b.match(CABEZA);
      if (!m) {
        if (out.length) out[out.length - 1].texto += '\n\n' + b;
        else out.push(nueva(out.length, '', null, b));
        continue;
      }
      out.push(nueva(out.length, m[1], m, m[7]));
    }
    return out;
  }

  function nueva(orden, autor, m, cuerpo) {
    var a = norm(autor);
    var e = {
      orden: orden, autor: a, canon: canon(a),
      dia: 0, anio: 0, mes: 0, fecha: '',
      texto: String(cuerpo == null ? '' : cuerpo).trim(),
      esArchivo: esArchivoNombre(a)
    };
    if (m && m[2]) {
      var d = Number(m[2]), me = Number(m[3]), y = Number(m[4]);
      e.dia = y * 10000 + me * 100 + d;
      e.anio = y; e.mes = me;
      var p = function (n) { return String(n).padStart(2, '0'); };
      e.fecha = p(d) + '/' + p(me) + '/' + y + (m[5] ? ' ' + p(m[5]) + ':' + m[6] : '');
    }
    return e;
  }

  /** 'NINGUNA' | 'PENDIENTE' | 'RESPONDIDA' */
  function estado(texto) {
    var e = entradas(texto);
    if (!e.length) return 'NINGUNA';
    return e[e.length - 1].esArchivo ? 'RESPONDIDA' : 'PENDIENTE';
  }

  /* Memoria por fila: la lista de BD Predial tiene 9.500 filas y las
     pastillas cuentan en cada filtro. Se recalcula solo si cambió el texto
     o llegaron los catálogos. */
  function estadoFila(r, vista) {
    if (!r) return 'NINGUNA';
    var def = VISTAS[vista] || VISTAS['view-asignaciones'];
    var t = r[def.campo];
    if (!txt(t)) return 'NINGUNA';
    var f = catalogos().firma;
    if (r.__sexTxt === t && r.__sexFirma === f) return r.__sexEst;
    var est = estado(t);
    try {
      Object.defineProperty(r, '__sexTxt', { value: t, writable: true, configurable: true, enumerable: false });
      Object.defineProperty(r, '__sexFirma', { value: f, writable: true, configurable: true, enumerable: false });
      Object.defineProperty(r, '__sexEst', { value: est, writable: true, configurable: true, enumerable: false });
    } catch (_) {}
    return est;
  }

  /** Cuántas filas hay en cada estado. */
  function conteo(filas, vista) {
    var c = { PENDIENTE: 0, RESPONDIDA: 0, NINGUNA: 0 };
    var l = filas || [];
    for (var i = 0; i < l.length; i++) c[estadoFila(l[i], vista)]++;
    return c;
  }

  /** ¿Participa `autor` en esta conversación? '' = cualquiera con mensajes.
   *  Para quien tiene rol ARCHIVO, toda conversación es suya. */
  function participa(texto, autor) {
    var e = entradas(texto);
    if (!e.length) return false;
    var a = norm(autor);
    if (!a) return true;
    if (esArchivoNombre(a)) return true;
    var ca = canon(a);
    for (var i = 0; i < e.length; i++) {
      if (e[i].canon === ca || e[i].autor === a) return true;
    }
    return false;
  }

  /**
   * Los mensajes de las conversaciones de `autor`, con su fila al lado.
   * Forma compatible con el motor de descarga (dia, fecha, autor, texto).
   */
  function mensajes(vista, opciones) {
    var def = VISTAS[vista];
    if (!def) return [];
    opciones = opciones || {};
    var autor = Object.prototype.hasOwnProperty.call(opciones, 'autor') ? opciones.autor : miNombre();
    var filas = Array.isArray(opciones.filas) ? opciones.filas : leer(def.todo);
    var out = [];
    for (var i = 0; i < filas.length; i++) {
      var r = filas[i];
      var t = r[def.campo];
      if (!txt(t) || !participa(t, autor)) continue;
      var e = entradas(t);
      for (var j = 0; j < e.length; j++) out.push(item(e[j], r, vista));
    }
    return out;
  }

  function item(e, r, vista) {
    return {
      dia: e.dia, anio: e.anio, mes: e.mes, orden: e.orden,
      fecha: e.fecha || 'SIN FECHA',
      sinFecha: !e.dia,
      autor: e.canon || e.autor,
      texto: e.texto,
      tipo: e.esArchivo ? 'RESPUESTA' : 'SOLICITUD',
      estado: estadoFila(r, vista),
      fila: r
    };
  }

  /** Lector con la firma del motor de descarga: (texto, autor) → items. */
  function lectorDescarga(vista) {
    return function (texto, autor) {
      if (!txt(texto) || !participa(texto, autor)) return [];
      var e = entradas(texto);
      var out = [];
      for (var i = 0; i < e.length; i++) {
        out.push({
          dia: e[i].dia, anio: e[i].anio, mes: e[i].mes, orden: e[i].orden,
          fecha: e[i].fecha || 'SIN FECHA',
          sinFecha: !e[i].dia,
          autor: e[i].canon || e[i].autor,
          texto: e[i].texto,
          tipo: e[i].esArchivo ? 'RESPUESTA' : 'SOLICITUD'
        });
      }
      return out;
    };
  }

  /** Filas con conversación de `autor` (filtro de pantalla de MI TRABAJO). */
  function conSolicitud(filas, vista, autor) {
    var def = VISTAS[vista];
    if (!def) return filas || [];
    return (filas || []).filter(function (r) { return participa(r[def.campo], autor); });
  }

  /** Autores con su número de mensajes (desplegable de ADMIN/DEV). */
  function autores(filas, vista) {
    var def = VISTAS[vista];
    var cuenta = {};
    var l = filas || [];
    for (var i = 0; i < l.length; i++) {
      var t = def ? l[i][def.campo] : '';
      if (!txt(t)) continue;
      var e = entradas(t);
      for (var j = 0; j < e.length; j++) {
        var n = e[j].canon || e[j].autor || '';
        if (!n) continue;
        cuenta[n] = (cuenta[n] || 0) + 1;
      }
    }
    var out = [];
    for (var k in cuenta) {
      if (Object.prototype.hasOwnProperty.call(cuenta, k)) out.push({ nombre: k, etiqueta: k, n: cuenta[k] });
    }
    out.sort(function (a, b) { return b.n - a.n; });
    return out;
  }

  /* ══════════════ el botón de la tarjeta ══════════════ */

  function pintarBoton(btn, row, vista) {
    if (!btn) return;
    var est = estadoFila(row, vista);
    btn.classList.add('sex-btn');
    btn.classList.toggle('sex-pendiente', est === 'PENDIENTE');
    btn.classList.toggle('sex-respondida', est === 'RESPONDIDA');
    var t = est === 'PENDIENTE' ? 'Solicitud Expediente · falta respuesta de ARCHIVO'
          : (est === 'RESPONDIDA' ? 'Solicitud Expediente · respondida' : 'Solicitud Expediente');
    btn.title = t;
    btn.setAttribute('aria-label', t);
  }

  /* ══════════════ el modal ══════════════ */

  var abierto = null;     /* { vista, row } */

  function montarModal() {
    var m = $('modal-expediente');
    if (!m || m.__sex) return m;
    m.__sex = true;
    m.classList.add('sex-modal');

    var h2 = m.querySelector('h2');
    if (h2) { h2.textContent = 'MENSAJE O BITÁCORA'; h2.id = 'sex-titulo'; }

    /* Cabecera con el expediente y el estado, debajo del título. */
    if (h2 && !$('sex-sub')) {
      var sub = document.createElement('div');
      sub.id = 'sex-sub';
      sub.className = 'sex-sub';
      h2.parentNode.insertBefore(sub, h2.nextSibling);
    }

    var hist = $('modal-expediente-historial');
    if (hist) {
      hist.removeAttribute('style');
      hist.className = 'sex-historial';
    }
    var vacio = $('modal-expediente-vacio');
    if (vacio) { vacio.removeAttribute('style'); vacio.className = 'sex-vacio'; }

    var ta = $('modal-expediente-nuevo');
    if (ta) {
      ta.setAttribute('maxlength', '2000');
      ta.setAttribute('placeholder', 'Escribe tu solicitud o respuesta…');
    }
    return m;
  }

  function burbuja(e, yo) {
    var mio = yo && (e.canon === yo || e.autor === yo);
    var cls = 'sex-msg' + (e.esArchivo ? ' sex-msg-archivo' : '') + (mio ? ' sex-msg-mio' : '');
    return '<div class="' + cls + '">' +
             '<div class="sex-msg-cab">' +
               '<span class="sex-msg-autor">' + escapar(e.canon || e.autor || 'SIN AUTOR') + '</span>' +
               '<span class="sex-msg-tipo">' + (e.esArchivo ? 'RESPUESTA' : 'SOLICITUD') + '</span>' +
             '</div>' +
             '<div class="sex-msg-texto">' + escapar(e.texto || '(sin texto)') + '</div>' +
             '<div class="sex-msg-fecha">' + escapar(e.fecha || 'sin fecha') + '</div>' +
           '</div>';
  }

  function chipEstado(est) {
    if (est === 'PENDIENTE') return '<span class="sex-chip sex-chip-rojo">● Falta respuesta de ARCHIVO</span>';
    if (est === 'RESPONDIDA') return '<span class="sex-chip sex-chip-verde">✔ Respondida</span>';
    return '<span class="sex-chip">Sin mensajes</span>';
  }

  function pintarModal() {
    if (!abierto) return;
    var def = VISTAS[abierto.vista];
    var r = abierto.row;
    var t = r[def.campo];
    var e = entradas(t);
    var yo = canon(miNombre());

    var sub = $('sex-sub');
    if (sub) {
      sub.innerHTML = '<div class="sex-sub-exp"><b>' + escapar(def.titulo(r)) + '</b>' +
        (def.quien(r) ? ' · ' + escapar(def.quien(r)) : '') + '</div>' + chipEstado(estadoFila(r, abierto.vista));
    }

    var hist = $('modal-expediente-historial');
    var vacio = $('modal-expediente-vacio');
    if (e.length) {
      var html = '';
      for (var i = 0; i < e.length; i++) html += burbuja(e[i], yo);
      hist.innerHTML = html;
      hist.style.display = '';
      if (vacio) vacio.style.display = 'none';
      requestAnimationFrame(function () { hist.scrollTop = hist.scrollHeight; });
    } else {
      hist.innerHTML = '';
      hist.style.display = 'none';
      if (vacio) { vacio.textContent = 'Aún no hay mensajes en este expediente.'; vacio.style.display = ''; }
    }
  }

  function abrir(vista, row) {
    if (!VISTAS[vista] || !row) return;
    var m = montarModal();
    if (!m) return;
    abierto = { vista: vista, row: row };
    pintarModal();
    var ta = $('modal-expediente-nuevo');
    if (ta) ta.value = '';
    m.classList.remove('hidden');
    setTimeout(function () { if (ta) ta.focus(); }, 60);
  }

  function cerrar() {
    var m = $('modal-expediente');
    if (m) m.classList.add('hidden');
    abierto = null;
  }

  function uid() {
    try { if (typeof window.uidActual_ === 'function') return window.uidActual_(); } catch (_) {}
    return '';
  }

  var enviando = false;

  function enviar() {
    if (!abierto || enviando) return Promise.resolve(false);
    var vista = abierto.vista, row = abierto.row;
    var def = VISTAS[vista];
    var ta = $('modal-expediente-nuevo');
    var texto = txt(ta && ta.value);
    if (!texto) {
      try { window.Swal.fire({ icon: 'warning', title: 'Escribe algo antes de enviar' }); } catch (_) {}
      return Promise.resolve(false);
    }

    enviando = true;
    var soyArch = soyArchivo();
    return Promise.resolve(window.apiPost(def.accion, {
      uid: uid(),
      id: def.id(row),
      rowIndex: row.rowIndex,
      texto: texto
    })).then(function (res) {
      var nuevo = res && typeof res.texto === 'string' ? res.texto : null;
      if (nuevo === null) throw new Error('El servidor no devolvió el historial');
      aplicar(vista, row, nuevo);

      /* Aviso a quien lleve ARCHIVO, salvo que quien escribe sea ARCHIVO. */
      if (!soyArch && typeof window.telsArchivo_ === 'function' && typeof window.sendProcWA_ === 'function') {
        var tels = window.telsArchivo_() || [];
        var yo = (window.currentUser && window.currentUser.nombre) || miNombre();
        for (var i = 0; i < tels.length; i++) window.sendProcWA_(tels[i], def.aviso(row, yo));
      }

      cerrar();
      sonar('success');
      try { window.Swal.fire({ icon: 'success', title: 'Enviado', timer: 1400, showConfirmButton: false }); } catch (_) {}
      return true;
    }).catch(function (e) {
      try { window.Swal.fire({ icon: 'error', title: 'No se pudo enviar', text: String((e && e.message) || e) }); } catch (_) {}
      return false;
    }).then(function (ok) {
      enviando = false;
      return ok;
    });
  }

  /** Deja el texto nuevo en la fila (y en su gemela del listado completo)
   *  y repinta lo que depende de él. */
  function aplicar(vista, row, nuevo) {
    var def = VISTAS[vista];
    row[def.campo] = nuevo;
    var todo = leer(def.todo);
    for (var i = 0; i < todo.length; i++) {
      if (todo[i] !== row && def.id(todo[i]) === def.id(row)) todo[i][def.campo] = nuevo;
    }
    /* Se vuelve a filtrar para que el botón, la pastilla y los conteos
       queden al día (si el filtro PENDIENTES está puesto, la tarjeta
       respondida sale de la lista, que es lo esperado). */
    try { if (typeof window[def.refrescar] === 'function') window[def.refrescar](); }
    catch (err) { console.warn('SOLEXP:', err); }
  }

  /* Los dos botones del modal. app.js ya no les pone manejador (17/09):
     el envío y el cierre viven aquí. Se enganchan una sola vez. */
  function engancharBotones() {
    var g = $('btn-expediente-guardar');
    if (g && !g.__sex) {
      g.__sex = true;
      g.addEventListener('click', function () { enviar(); });
    }
    var c = $('btn-expediente-cancelar');
    if (c && !c.__sex) {
      c.__sex = true;
      c.setAttribute('data-salida', '1');
      c.addEventListener('click', function () { sonar('back'); cerrar(); });
    }
    try { if (window.BV && window.BV._cierres) window.BV._cierres['modal-expediente'] = ['btn-expediente-cancelar']; }
    catch (_) {}
  }

  function arrancar() {
    montarModal();
    engancharBotones();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', arrancar);
  else arrancar();

  window.SOLEXP = {
    entradas: entradas,
    estado: estado,
    estadoFila: estadoFila,
    conteo: conteo,
    participa: participa,
    mensajes: mensajes,
    lectorDescarga: lectorDescarga,
    conSolicitud: conSolicitud,
    autores: autores,
    canon: canon,
    esArchivoNombre: esArchivoNombre,
    pintarBoton: pintarBoton,
    abrir: abrir,
    cerrar: cerrar,
    enviar: enviar,
    vistas: VISTAS,
    campo: function (vista) { return (VISTAS[vista] || {}).campo; },
    MESES: MESES
  };
})();
