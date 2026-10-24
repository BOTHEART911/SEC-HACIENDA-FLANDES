/* ============================================================
   SEC-HACIENDA-FLANDES · ASISTENTE DE AYUDA (adaptador)
   24/10/2026 · la misma pieza de las 7 apps Flandes (kit/asistente.js)

   El robot pregunta "¿en qué te puedo ayudar?", entiende lo que la persona
   escribe o dicta, responde con la base (js/ayuda-base.js, o la del
   backend si cambió) y la LLEVA al sitio. Aquí se le dice lo que solo esta
   app sabe:
     · a dónde puede llevar (destino): las tarjetas del inicio, y con filtro
       ya puesto: semáforo con las vencidas o lo que vence hoy, la pastilla
       "Bitácoras por responder" del semáforo o de la base predial, nueva
       asignación;
     · qué está cerrado (puerta): la tarjeta que el rol no tiene (la misma
       que alcance.js esconde) y el entrenamiento, solo DEV;
     · lo más urgente al abrir (urgente): bitácoras en rojo → asignaciones
       vencidas o de hoy → bitácoras por responder → solicitudes pendientes →
       (DEV) soportes por atender y preguntas por enseñar;
     · los datos reales de las respuestas ({{clave}}).

   TODO sale de lo que la app ya tiene en memoria (perfil, alcance, conteos
   del inicio, listas ya bajadas): responder NO cuesta ningún viaje.

   Un solo robot: el botón "Consultar" de la capa 11 ya no sale aparte; sus
   consultas (cifras de lo que se ve) se abren desde el asistente, con la
   pregunta frecuente "Consultas de esta vista".

   Red (reglas 12 y 13): la base viaja con el login/revalidación solo si
   cambió su sello; las preguntas (anónimas) van en UN viaje de fondo con su
   rid; la voz Inworld por las rutas que ya tenía la app (vozestado /
   vozhablar) y, si falla o tarda, la del teléfono.
   ============================================================ */
(function () {
  'use strict';

  var K = window.KIT;
  if (!K || !K.piezas || !K.piezas.asistente) return;
  var As = K.piezas.asistente;
  var M = window.MARCA || {};
  window.HAC_AYUDA = { activo: true };
  window.__ayudaMed = window.__ayudaMed || [];

  function $(id) { return document.getElementById(id); }
  function tk() { return window.HAC_SESION ? window.HAC_SESION.tk() : ''; }
  function nuevoRid() { return 'ayu' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10); }
  function error(codigo, msg) { var e = new Error(msg); e.codigo = codigo; return e; }
  function esperar(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  /* ══════════════ red ══════════════
     Reintento ÚNICO y solo ante falla de red o respuesta que no es JSON (el
     404 de echo de Google), con el mismo rid. Una respuesta de otra sesión
     nunca se usa. */
  function llamar(accion, datos, op) {
    op = op || {}; datos = datos || {};
    var u = M.API_URL || '';
    var llave = tk();
    var t0 = performance.now();
    function una(n) {
      var p;
      if (!op.post) {
        var qs = '?action=' + encodeURIComponent(accion);
        Object.keys(datos).forEach(function (k) { qs += '&' + k + '=' + encodeURIComponent(datos[k]); });
        p = fetch(u + qs, { cache: 'no-store' });
      } else {
        p = fetch(u + '?action=' + encodeURIComponent(accion), {
          method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(Object.assign({ tk: llave, rid: op.rid || '' }, datos))
        });
      }
      return p.then(function (r) { return r.text(); }).then(function (t) {
        var j; try { j = JSON.parse(t); } catch (e) { throw error('RED', 'Respuesta inesperada del servidor.'); }
        if (llave !== tk()) throw error('VIEJA', 'Sesión cambiada');
        var med = { ruta: accion, ms: Math.round(performance.now() - t0), kb: Math.round(t.length / 102.4) / 10, n: n };
        try { window.__ayudaMed.push(med); if (window.__ayudaMed.length > 200) window.__ayudaMed.shift(); console.debug('[ayuda]', med); } catch (e) {}
        if (!j.ok) {
          if (j.codigo === 'SESION_VENCIDA') { try { window.dispatchEvent(new CustomEvent('hac:sesionVencida', { detail: { mensaje: j.error } })); } catch (e) {} }
          /* el backend todavía sin la ruta: la pieza guarda la cola y lo intenta en la próxima apertura */
          if (j.codigo === 'ACCION' || /Acción no válida/i.test(j.error || '')) throw error('ACCION', 'El servidor no tiene la accion ' + accion);
          throw error(j.codigo || 'ERROR', j.error || 'No se pudo completar.');
        }
        return j.data;
      }).catch(function (e) {
        var red = (e instanceof TypeError) || (e && e.codigo === 'RED');
        if (red && n < 1) return esperar(1200).then(function () { return una(n + 1); });
        throw e;
      });
    }
    return una(0);
  }

  /* ══════════════ la pieza del kit habla con HACIENDA ══════════════ */
  var pedirAntes = K.pedir;
  K.pedir = function (accion, datos) {
    datos = datos || {};
    if (accion === 'asistenteRegistrar') return llamar('asistenteregistrar', { lista: datos.lista || [] }, { post: true, rid: datos.rid || nuevoRid() });
    if (accion === 'vozEstado') return llamar('vozestado', {});
    if (accion === 'vozHablar') {
      return llamar('vozhablar', { texto: String(datos.texto || '') }, { post: true, rid: nuevoRid() }).then(function (r) {
        if (!r || r.ok === false || !r.base64) throw new Error((r && r.msg) || 'No se pudo generar la voz.');
        return r;
      });
    }
    return pedirAntes.apply(K, arguments);
  };

  /* gemini.js y soporte.js preguntan quién es (sin sesión del CORE en esta app) */
  if (!K.piezas.sesion) {
    K.piezas.sesion = { yo: function () { var p = perfil(); return p ? { nombre: p.nombre || '', documento: p.documento || '' } : null; } };
  }

  /* ══════════════ lo que la app ya sabe ══════════════ */
  function perfil() { try { return (window.IDN && window.IDN.perfil()) || null; } catch (e) { return null; } }
  function roles() { try { return (window.IDN && window.IDN.roles()) || []; } catch (e) { return []; } }
  function tiene(r) { return roles().indexOf(r) !== -1; }
  function esDev() { try { return !!(window.IDN && window.IDN.esDev()); } catch (e) { return tiene('DEV'); } }
  function esAdmin() { return esDev() || tiene('ADMIN'); }
  function ALC() { return window.ALC || {}; }
  /* las variables de app.js son 'let' de nivel superior: se leen por nombre */
  function leer(nombre, def) {
    try { var v = (0, eval)('typeof ' + nombre + ' !== "undefined" ? ' + nombre + ' : undefined'); return v === undefined ? def : v; }
    catch (e) { return def; }
  }
  function fn(nombre) { var f = leer(nombre, null); return typeof f === 'function' ? f : null; }
  function llano(s) { return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim(); }
  function plural(n, uno, varios) { return K.numero(n) + ' ' + (n === 1 ? uno : varios); }
  function nombrePropio(s) {
    return String(s || '').toLowerCase().replace(/(^|\s)(\S)/g, function (m, a, b) { return a + b.toUpperCase(); })
      .replace(/ (De|Del|La|Las|Los|Y|E|En) /g, function (m) { return m.toLowerCase(); });
  }
  function primerNombre() { var p = perfil(); return nombrePropio(String((p && p.nombre) || '').split(/\s+/)[0] || ''); }
  function lista(filas, fmt, max) {
    max = max || 5;
    var t = filas.slice(0, max).map(fmt).join('\n');
    if (filas.length > max) t += '\n… y ' + (filas.length - max) + ' más.';
    return t;
  }

  /* ---------- semáforo (si la lista ya se bajó) ---------- */
  function procMias() {
    var l = leer('__procListCache', null);
    if (!Array.isArray(l) || !l.length) return null;
    if (ALC().alcance && ALC().alcance.todo) return l;
    var yo = llano((perfil() || {}).nombre);
    return l.filter(function (r) { return llano(r.asignado) === yo || llano(r.asistente) === yo; });
  }
  function grupo(r) { var g = fn('procGrupoVence_'); try { return g ? g(r) : ''; } catch (e) { return ''; } }
  function semCuenta() {
    var l = procMias();
    if (!l) return null;
    var c = { total: 0, VENCIDOS: [], HOY: [], PRONTO: [] };
    l.forEach(function (r) {
      if (llano(r.estado) === 'FINALIZADO') return;
      c.total++;
      var g = grupo(r);
      if (c[g]) c[g].push(r);
    });
    return c;
  }
  function linAsig(r) {
    var t = String(r.categoria || r.subcategoria || r.tipo || 'Asignación');
    return '· **' + (r.id_proceso || r.id || '') + '** ' + nombrePropio(t).slice(0, 60) + (r.respuesta ? ' — vence ' + String(r.respuesta).slice(0, 10) : '');
  }

  /* ---------- bitácoras por responder (conteos del inicio) ---------- */
  function bit() {
    var c = null;
    try { c = window.BITAB && window.BITAB.conteos(); } catch (e) {}
    if (!c) return null;
    var p = c.pred || { n: 0, rojo: 0 }, q = c.proc || { n: 0, rojo: 0 };
    if (!c.pred && !c.proc) return null;
    return { pred: p.n || 0, predRojo: p.rojo || 0, proc: q.n || 0, procRojo: q.rojo || 0 };
  }

  /* ---------- solicitudes pendientes de predial ---------- */
  function pendientesPredial() {
    var l = leer('__listCache', null), modo = leer('currentListMode', '');
    if (!Array.isArray(l) || modo !== 'PENDIENTE') return null;
    return l.length;
  }

  /* ══════════════ lo más urgente al abrir ══════════════ */
  function candidatos() {
    var out = [], b = bit(), s = semCuenta(), pend = pendientesPredial();
    if (b && (b.predRojo || b.procRojo)) {
      var rojos = b.predRojo + b.procRojo;
      out.push({ texto: '**' + plural(rojos, 'bitácora lleva', 'bitácoras llevan') + ' más de 3 días hábiles sin respuesta**' +
        (b.predRojo && b.procRojo ? ' (base predial y semáforo).' : (b.predRojo ? ' en la base predial.' : ' en el semáforo.')),
        accion: b.predRojo >= b.procRojo ? 'ir:predBit' : 'ir:semBit' });
    }
    if (s && s.VENCIDOS.length) out.push({ texto: '**' + plural(s.VENCIDOS.length, 'asignación vencida', 'asignaciones vencidas') + '** en tu semáforo.', accion: 'ir:semVencidas' });
    if (s && s.HOY.length) out.push({ texto: '**' + plural(s.HOY.length, 'asignación vence', 'asignaciones vencen') + ' hoy.**', accion: 'ir:semHoy' });
    if (b && (b.pred || b.proc) && !(b.predRojo || b.procRojo)) {
      out.push({ texto: 'Tienes **' + plural(b.pred + b.proc, 'bitácora por responder', 'bitácoras por responder') + '**.', accion: b.pred >= b.proc ? 'ir:predBit' : 'ir:semBit' });
    }
    if (pend) out.push({ texto: 'Hay **' + plural(pend, 'solicitud de predial esperando', 'solicitudes de predial esperando') + '** respuesta.', accion: 'ir:pendientes' });
    if (esDev()) {
      var d = null; try { d = window.SOPORTES && window.SOPORTES._datos(); } catch (e) {}
      var ab = d && d.lista ? d.lista.filter(function (x) { return x.estado === 'PENDIENTE' || x.estado === 'REABIERTO' || x.estado === 'EN PROCESO'; }).length : 0;
      if (ab) out.push({ texto: 'Hay **' + plural(ab, 'soporte por atender', 'soportes por atender') + '**.', accion: 'ir:soportes' });
      var A = window.AYUDA_DEV && window.AYUDA_DEV._datos ? window.AYUDA_DEV._datos() : null;
      if (A && A.resumen && A.resumen.porEnsenar) out.push({ texto: 'El asistente tiene **' + plural(A.resumen.porEnsenar, 'pregunta por enseñar', 'preguntas por enseñar') + '**.', accion: 'ir:asistente' });
    }
    return out;
  }
  function urgente() { return candidatos()[0] || null; }

  /* ══════════════ a dónde puede llevar ══════════════
     [rótulo, tarjeta del inicio, después de llegar (cuando la lista ya está)] */
  function cuandoLista(vista, cache, hacer) {
    var t0 = Date.now();
    (function mirar() {
      var v = $(vista), l = leer(cache, null);
      if (v && v.classList.contains('active') && Array.isArray(l) && l.length) { try { hacer(); } catch (e) {} return; }
      if (Date.now() - t0 < 12000) setTimeout(mirar, 150);
    }());
  }
  function vence(valor) {
    return function () {
      cuandoLista('view-asignaciones', '__procListCache', function () {
        (0, eval)('__procFiltroVence = ' + JSON.stringify(valor));
        var f = fn('applyProcFilters_'); if (f) f();
      });
    };
  }
  function pastillaBit(vista, cache) {
    return function () { cuandoLista(vista, cache, function () { if (window.BITAB) window.BITAB.pastilla(vista, true); }); };
  }
  function nuevaAsignacion() {
    var t0 = Date.now();
    (function mirar() {
      var b = $('btn-agregar-asignacion'), v = $('view-asignaciones');
      if (b && v && v.classList.contains('active') && b.style.display !== 'none') { b.click(); return; }
      if (Date.now() - t0 < 12000) setTimeout(mirar, 150);
    }());
  }
  var DESTINOS = {
    inicio:      ['Ir al inicio', ''],
    agregar:     ['Ir a Agregar atención', 'btn-agregar'],
    pendientes:  ['Ir a Pendientes predial', 'btn-pendientes'],
    atenciones:  ['Ir a Atenciones registradas', 'btn-atenciones-registradas'],
    informes:    ['Abrir Mis informes predial', 'btn-mis-informes'],
    estadisticas:['Ir a Estadísticas', 'btn-estadisticas'],
    predial:     ['Ir a la Base de datos predial', 'btn-bd-predial'],
    predBit:     ['Ver las bitácoras por responder', 'btn-bd-predial', pastillaBit('view-bd-predial', '__bdpListCache')],
    semaforo:    ['Ir a Mi semáforo', 'btn-semaforo'],
    semBit:      ['Ver las bitácoras por responder', 'btn-semaforo', pastillaBit('view-asignaciones', '__procListCache')],
    semVencidas: ['Ver las vencidas', 'btn-semaforo', vence('VENCIDOS')],
    semHoy:      ['Ver las que vencen hoy', 'btn-semaforo', vence('HOY')],
    semNueva:    ['Crear la asignación', 'btn-semaforo', nuevaAsignacion],
    ica:         ['Ir a Requerimientos ICA', 'btn-ica-req'],
    anexos:      ['Ir a Drive anexos', 'btn-drive-anexos'],
    gerencial:   ['Abrir el Informe gerencial', 'btn-gerencial'],
    soportes:    ['Ir a Soportes', 'btn-soportes'],
    config:      ['Ir a Configuración', 'btn-config'],
    asistente:   ['Ir al Entrenamiento', 'btn-asistente-dev']
  };
  var NOMBRES = { agregar: 'Agregar atención predial', pendientes: 'Pendientes predial', atenciones: 'Atenciones registradas',
    informes: 'Mis informes predial', estadisticas: 'Estadísticas', predial: 'la Base de datos predial', semaforo: 'Mi semáforo',
    ica: 'Industria y Comercio', anexos: 'Drive anexos', gerencial: 'el Informe gerencial', soportes: 'Soportes (desarrollador)',
    config: 'Configuración' };

  function tarjeta(id) { var d = DESTINOS[id]; return d && d[1] ? $(d[1]) : null; }
  function visible(b) { return !!b && b.style.display !== 'none' && !b.hidden; }

  function destino(id) {
    var d = DESTINOS[id];
    if (!d) return null;
    return { etiqueta: d[0], ir: function () {
      if (id === 'inicio') { if (typeof window.showView === 'function') window.showView('view-inicio'); return; }
      var b = tarjeta(id);
      if (!b) return;
      var v = document.querySelector('.view.active');
      /* ya está en la vista de destino con la lista bajada: solo el filtro */
      if (d[2] && v && ((d[1] === 'btn-semaforo' && v.id === 'view-asignaciones') || (d[1] === 'btn-bd-predial' && v.id === 'view-bd-predial'))) { d[2](); return; }
      b.click();
      if (d[2]) d[2]();
    } };
  }

  /** Lo cerrado: la tarjeta que el rol no tiene, y el entrenamiento solo DEV. */
  function puerta(id) {
    var d = DESTINOS[id];
    if (!d || id === 'inicio') return null;
    if (id === 'asistente') return esDev() ? null : { texto: 'El **entrenamiento del asistente** solo lo maneja el rol **DEV**.', accion: '' };
    if (id === 'soportes' && !esDev()) return { texto: '**Soportes** (todos los casos) es del desarrollador. Para contar un problema usa **Soporte**.', accion: 'soporte' };
    var b = tarjeta(id);
    if (b && visible(b)) return null;
    var base = DESTINOS[id][1];
    var nom = NOMBRES[id] || NOMBRES[Object.keys(DESTINOS).filter(function (k) { return DESTINOS[k][1] === base && NOMBRES[k]; })[0]] || 'esa vista';
    return { texto: 'Tu usuario no tiene acceso a **' + nom + '**. Los accesos los da un administrador en Configuración, con tu rol.', accion: '' };
  }

  /* ══════════════ acciones que no son ir a una vista ══════════════ */
  function vistaTitulo() {
    try { var b = K.piezas.banner && K.piezas.banner.elemento(); return b ? ((b.querySelector('.kit-banner__titulo') || {}).textContent || '') : ''; } catch (e) { return ''; }
  }
  function activarAvisos() {
    var a = K.piezas.avisos, pp = window.HAC_PUBLICO && window.HAC_PUBLICO.push;
    if (!a || !pp || !pp.firebase || !pp.vapid) { K.aviso('Los avisos al teléfono aún no están configurados.', 'aviso', 4000); return; }
    a.configurar(pp);
    if (a.estado() === 'listo') { K.aviso('Los avisos ya están activos en este teléfono.', 'ok', 3000); return; }
    a.activar({ forzar: true });
  }
  function hayConsultas() {
    var v = document.querySelector('.view.active');
    var C = window.__hac11;
    return !!(v && C && C.PANELES && C.PANELES[v.id]);
  }
  function accion(a) {
    switch (a) {
      case 'guia': return { etiqueta: 'Abrir la guía rápida', icono: 'libro', hacer: function () { if (window.GUIA) window.GUIA.abrir(); } };
      case 'soporte':
        /* al DEV la pregunta sin respuesta lo lleva a enseñársela al asistente */
        if (esDev()) return { etiqueta: 'Enseñarle esta pregunta', icono: 'robot', hacer: function (p) { if (window.AYUDA_DEV) window.AYUDA_DEV.probar(p || '', vista()); } };
        return { etiqueta: 'Contarle a soporte', icono: 'salvavidas', hacer: function (p) {
          if (K.piezas.soporte) K.piezas.soporte.abrir({ vista: vistaTitulo() || 'Inicio', texto: p ? 'Le pregunté al asistente: «' + p + '»\n' : '' });
        } };
      case 'foto': return { etiqueta: 'Cambiar mi foto', icono: 'camara', hacer: function () { if (typeof window.showView === 'function') window.showView('view-inicio'); var c = $('hf-cara'); if (c) c.click(); } };
      case 'pin': return { etiqueta: 'Cambiar mi PIN', icono: 'pin', hacer: function () { var b = $('btn-cambiar-pin'); if (b) b.click(); } };
      case 'avisos': return { etiqueta: 'Activar los avisos', icono: 'campana', hacer: activarAvisos };
      case 'instalar': return { etiqueta: 'Instalar la app', icono: 'descargar', hacer: function () { if (K.piezas.instalar) K.piezas.instalar.abrir(); } };
      case 'tema': return { etiqueta: 'Cambiar claro / oscuro', icono: 'luna', cierra: false, hacer: function () { K.alternarTema(); } };
      case 'consultas':
        if (!hayConsultas()) return null;
        return { etiqueta: 'Ver las consultas', icono: 'grafica', hacer: function () {
          var v = document.querySelector('.view.active');
          setTimeout(function () { try { window.__hac11.abrir(v.id); } catch (e) {} }, 220);
        } };
      default: return null;
    }
  }

  /* ══════════════ los datos de las respuestas ══════════════ */
  function textoPendientes() {
    var t = [];
    candidatos().forEach(function (c) { t.push('· ' + c.texto); });
    if (!t.length) {
      var falta = !bit() && !semCuenta();
      return falta ? 'Por ahora no veo nada urgente. Los conteos del inicio todavía están llegando: si acabas de entrar, pregúntame en un momento.'
        : 'No tienes nada urgente: ni bitácoras por responder ni asignaciones vencidas. ✓';
    }
    return 'Esto es lo que tienes, lo más urgente primero:\n' + t.join('\n');
  }
  var ROL_TXT = { DEV: 'Desarrollador', ADMIN: 'Administrador', ABOGADO: 'Abogado', ASISTENTE: 'Asistente', ARCHIVO: 'Archivo', ATENCION: 'Atención', TRIBUTARIO: 'Tributario' };
  function textoFunciones() {
    var r = roles().map(function (x) { return ROL_TXT[x] || x; });
    var t = [];
    document.querySelectorAll('#view-inicio .acceso').forEach(function (b) {
      if (!visible(b) || b.getAttribute('data-ica-pronto')) return;
      var tt = b.querySelector('.acceso__t'); var n = String((tt || b).textContent || '').replace(/\s+/g, ' ').trim();
      if (n) t.push(n.split(/\s{2,}/)[0]);
    });
    return (r.length ? 'Tus roles: **' + r.join(' · ') + '**.' : 'Tu usuario todavía no tiene un rol: pídeselo a un administrador.') +
      (t.length ? '\nEn tu inicio tienes: ' + t.slice(0, 14).join(', ') + '.' : '');
  }
  function textoSemaforo() {
    var s = semCuenta();
    if (!s) return 'Abre **Mi semáforo** y vuelve a preguntarme: así te digo cuántas tienes y cuáles vencen. ';
    if (!s.total) return 'No tienes asignaciones abiertas. ✓ ';
    return 'Tienes **' + plural(s.total, 'asignación abierta', 'asignaciones abiertas') + '**' +
      (s.VENCIDOS.length ? ', **' + s.VENCIDOS.length + ' vencida' + (s.VENCIDOS.length === 1 ? '' : 's') + '**' : '') +
      (s.HOY.length ? ', ' + s.HOY.length + ' vence' + (s.HOY.length === 1 ? '' : 'n') + ' hoy' : '') +
      (s.PRONTO.length ? ', ' + s.PRONTO.length + ' en 3 días hábiles o menos' : '') + '. ';
  }
  function textoGrupo(g, vacio, uno, varios) {
    var s = semCuenta();
    if (!s) return 'Te llevo a **Mi semáforo** con ese filtro puesto.';
    var l = s[g];
    if (!l.length) return vacio;
    return '**' + plural(l.length, uno, varios) + '**:\n' + lista(l, linAsig, 5);
  }
  function dato(k) {
    var A = ALC(), b, n;
    switch (k) {
      case 'nombre': return primerNombre();
      case 'queMeToca': return textoPendientes();
      case 'misFunciones': return textoFunciones();
      case 'gerencialQuien': return esAdmin() ? ', y si es de una persona o de toda la Secretaría,' : '';
      case 'pendientes':
        n = pendientesPredial();
        return n === null ? '' : (n ? 'Hay **' + plural(n, 'solicitud esperando', 'solicitudes esperando') + '** respuesta. ' : 'No hay solicitudes pendientes. ✓ ');
      case 'predialAlcance':
        var al = A.alcance || {}, pu = A.puede || {};
        if (al.todo) return 'Ves **todos los expedientes**: los creas, los repartes y los sigues. ';
        if (pu.editarPredialAsistente) return 'Como asistente ves y trabajas **todos los expedientes repartidos**. ';
        if (al.predialSoloExpediente) return 'Ves los expedientes con archivo físico o con solicitud de expediente. ';
        return 'Ves **tus expedientes** como sustanciador. ';
      case 'descargaPredial':
        if (!(A.ver || {}).descargaPredial) return 'Tu rol no tiene la descarga de la base predial. Pídesela a un administrador si la necesitas.';
        if ((A.alcance || {}).todo) return 'En la base predial toca **Descargar**: Excel con los filtros que quieras (clasificación, actuación, sustanciador, fechas de bitácora).';
        if ((A.puede || {}).editarPredialAsistente) return 'En la base predial toca **Descargar**: salen los expedientes donde escribiste bitácora.';
        return 'En la base predial toca **Descargar**: salen tus filas a Excel.';
      case 'bitPendientes':
        b = bit();
        if (!b) return '';
        if (!(b.pred + b.proc)) return 'No tienes bitácoras por responder. ✓\n';
        return 'Tienes **' + plural(b.pred + b.proc, 'bitácora por responder', 'bitácoras por responder') + '**' +
          ' (' + [b.pred ? b.pred + ' en la base predial' : '', b.proc ? b.proc + ' en el semáforo' : ''].filter(String).join(' y ') + ')' +
          ((b.predRojo + b.procRojo) ? ', **' + (b.predRojo + b.procRojo) + ' en rojo**' : '') + '.\n';
      case 'semaforo': return textoSemaforo();
      case 'semVencidas': return textoGrupo('VENCIDOS', 'No tienes asignaciones vencidas. ✓', 'asignación vencida', 'asignaciones vencidas');
      case 'semHoy': return textoGrupo('HOY', 'Nada vence hoy. ✓', 'asignación vence hoy', 'asignaciones vencen hoy');
      case 'anexos':
        var ax = A.anexos || {};
        if (ax.admin) return 'En **Drive anexos** administras las evidencias de los contratistas: creas el CONTRATO, apruebas o reabres cuentas y das el permiso de PDF.';
        if (ax.c) return 'En **Drive anexos** subes los anexos de tu cuenta, por obligación: Agregar → obligación → archivo → nombre. Luego copias el enlace en tu cuenta.';
        return '**Drive anexos** guarda las evidencias de cada contrato, cuenta por cuenta.';
      case 'anexosTipos': return (ALC().anexos || {}).pdf ? 'Word, Excel o PDF' : 'Word o Excel';
      case 'soportePend':
        var sp = window.__ayudaSoporte;
        return sp && sp.pendientes && sp.pendientes.length ? 'Tienes **' + plural(sp.pendientes.length, 'soporte resuelto', 'soportes resueltos') + '** por calificar. ' : '';
      case 'soportesDev':
        if (!esDev()) return '';
        var d = null; try { d = window.SOPORTES && window.SOPORTES._datos(); } catch (e) {}
        if (!d || !d.lista) return '';
        n = d.lista.filter(function (x) { return x.estado === 'PENDIENTE' || x.estado === 'REABIERTO' || x.estado === 'EN PROCESO'; }).length;
        return n ? 'Hay **' + plural(n, 'soporte por atender', 'soportes por atender') + '**. ' : 'No hay soportes por atender. ✓ ';
      case 'asistente':
        if (!esDev()) return '';
        var X = window.AYUDA_DEV && window.AYUDA_DEV._datos ? window.AYUDA_DEV._datos() : null;
        if (!X || !X.resumen) return '';
        return X.resumen.porEnsenar ? 'Hay **' + plural(X.resumen.porEnsenar, 'pregunta por enseñar', 'preguntas por enseñar') + '**. ' : 'No hay preguntas por enseñar. ✓ ';
      case 'avisosTelefono':
        var es = K.piezas.avisos ? K.piezas.avisos.estado() : '';
        if (es === 'listo') return 'Este teléfono **ya recibe avisos** de la app, aunque la tengas cerrada.';
        if (es === 'ios-sin-instalar') return 'En iPhone los avisos solo llegan con la app **instalada** en la pantalla de inicio: menú de tu foto → Instalar la app.';
        if (es === 'bloqueado') return 'Los avisos están **bloqueados** en este navegador: actívalos en los permisos del sitio (el candado junto a la dirección) y vuelve a abrir la app.';
        return 'Los avisos se activan al entrar: acepta el permiso de notificaciones cuando el teléfono lo pida, o actívalos aquí.';
      default: return '';
    }
  }

  /* ══════════════ la guía de cada vista (primer mensaje) ══════════════ */
  var GUIAS = {
    inicio: 'Tus tarjetas están por bloques: **Predial**, **Industria y Comercio**, **Gestión** y **La app**. Solo ves las de tu rol.',
    lista: 'Solicitudes de predial que llegaron por WhatsApp. Abre una y responde con los recibos, o ciérrala como AL DÍA, NO ENCONTRADO o Dar de baja.',
    respuesta: 'Revisa los datos del contribuyente y responde con los recibos.',
    agregar: 'Registra a quien vino en persona: sus datos, lo que pidió y la respuesta.',
    atenciones: 'Lo ya atendido, por chat y en ventanilla, con su tiempo de respuesta.',
    estadisticas: 'Tiempos, zonas y tendencia de las solicitudes del año.',
    panel: 'La carga y el avance de cada persona del equipo.',
    asignaciones: 'Tus asignaciones con su plazo en días hábiles. El color dice cuánto queda; la marca de bitácora, si te escribieron.',
    'ver-asignacion': 'El detalle de la asignación: bitácora, etapa, documentos y chat.',
    'editar-asignacion': 'Cambia lo que haga falta y guarda.',
    'agregar-asignacion': 'Abogado, apoyo y plazo: al guardar le llega por WhatsApp y push.',
    'bd-predial': 'Filtra con las pastillas o el buscador, abre la tarjeta y escribe la bitácora y la actuación.',
    'bdp-detalle': 'El expediente completo: bitácoras, actuaciones, notificación y archivo.',
    'bdp-form': 'Llena los datos del expediente y guarda.',
    'bdp-panel': 'Las cifras de la base predial.',
    'drive-anexos': 'Las evidencias de cada contrato, cuenta por cuenta.',
    'ica-req': 'Requerimientos de información de Industria y Comercio, con su plazo de 15 días hábiles.',
    guia: 'Tu guía, armada con tus roles. El botón PDF la descarga.'
  };

  function vistaId() { var v = document.querySelector('.view.active'); return v ? v.id : ''; }
  function vista() { return vistaId().replace(/^view-/, '') || 'inicio'; }

  var ADAPTADOR = {
    vista: vista,
    estado: function () { return 'ACTIVO'; },
    dato: dato, urgente: urgente, destino: destino, puerta: puerta, accion: accion
  };

  /* ══════════════ la pantalla de entrada ══════════════ */
  function resaltar(el) {
    if (!el) return;
    el.classList.add('kit-as-resalta');
    try { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (e) {}
    setTimeout(function () { el.classList.remove('kit-as-resalta'); }, 3600);
  }
  var ENTRADA = {
    vista: function () { return 'entrada'; },
    estado: function () { return ''; },
    dato: function () { return ''; },
    urgente: function () { return null; },
    destino: function () { return null; },
    puerta: function () { return null; },
    accion: function (a) {
      if (a === 'olvide') return { etiqueta: 'Mostrarme el botón', icono: 'whatsapp', hacer: function () {
        var o = $('idn-olvide'), pp = $('idn-paso-pin');
        /* NO se toca: pedir el PIN lo decide la persona */
        if (o && pp && !pp.classList.contains('hidden')) resaltar(o);
        else resaltar($('idn-cuentas') || document.querySelector('.login-tab[data-tab="doc"]'));
      } };
      if (a === 'documento') return { etiqueta: 'Ir a la entrada', icono: 'persona', hacer: function () {
        var t = document.querySelector('.login-tab[data-tab="doc"]');
        var hayCuentas = $('idn-cuentas') && $('idn-cuentas').children.length;
        if (!hayCuentas && t) t.click();
        var el = hayCuentas ? $('idn-cuentas') : document.querySelector('#tab-doc input');
        if (el) { if (el.focus) el.focus(); resaltar(el); }
      } };
      if (a === 'instalar') return { etiqueta: 'Cómo instalarla', icono: 'descargar', hacer: function () { if (K.piezas.instalar) K.piezas.instalar.abrir(); } };
      return null;
    }
  };

  As.configurar({ app: 'HACIENDA', base: window.AYUDA_BASE || [], adaptador: ADAPTADOR });

  /* ══════════════ el botón: en cada vista ══════════════ */
  var enEntrada = false, ultima = '';
  function montar() {
    var ins = K.piezas.insights;
    if (!ins) return;
    var id = vistaId();
    if (!id) return;
    if (id === 'view-instalar') { if (enEntrada) { As.salirEntrada(); enEntrada = false; } ins.ocultar(); ultima = id; return; }
    if (id === 'view-login') {
      if (!enEntrada) { As.enEntrada(ENTRADA); enEntrada = true; }
      ultima = id;
      return;
    }
    if (!perfil()) return;
    if (enEntrada) { As.salirEntrada(); enEntrada = false; }
    if (ultima === id) return;
    ultima = id;
    var k = id.replace(/^view-/, '');
    ins.montar({ vista: vistaTitulo() || 'Sec. Hacienda', clave: k, guia: GUIAS[k] || '', botones: [],
      alto: !!document.querySelector('#' + id + ' .hf-fijo, #' + id + ' .kit-barra-fija') });
  }
  var pendiente = null;
  function revisar() {
    if (pendiente) return;
    pendiente = setTimeout(function () { pendiente = null; try { montar(); } catch (e) {} }, 120);
  }
  function arrancar() {
    var original = window.showView;
    if (typeof original === 'function' && !original.__ayu) {
      var env = function () { var r = original.apply(this, arguments); revisar(); return r; };
      env.__ayu = true;
      window.showView = env;
    }
    try {
      var raiz = document.getElementById('app') || document.body;
      new MutationObserver(function (muts) {
        for (var i = 0; i < muts.length; i++) {
          var t = muts[i].target;
          if (t && t.classList && t.classList.contains('view')) { revisar(); return; }
        }
      }).observe(raiz, { attributes: true, attributeFilter: ['class'], subtree: true });
    } catch (e) {}
    revisar();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', arrancar); else arrancar();
  /* app.js y otras capas vuelven a envolver showView: se envuelve otra vez (idempotente) */
  setTimeout(arrancar, 1500);

  /* ══════════════ la base que manda el backend ══════════════ */
  window.addEventListener('hac:asistente', function (ev) {
    var a = ev && ev.detail;
    if (!a || !a.sello) return;
    if (a.temas && a.temas.length) As.base(a.temas, a.sello);
  });
  window.addEventListener('hac:login', function () { ultima = ''; revisar(); });
  window.addEventListener('hac:logout', function () { ultima = ''; setTimeout(revisar, 0); });
  window.addEventListener('hac:soportePendiente', function (ev) { window.__ayudaSoporte = ev && ev.detail; });

  window.AYUDA = {
    adaptador: ADAPTADOR, entrada: ENTRADA, montar: montar, _llamar: llamar,
    selloGuardado: function () { try { return As.selloGuardado(); } catch (e) { return ''; } },
    /* para las pruebas */
    _urgente: urgente, _candidatos: candidatos, _dato: dato, _destinos: DESTINOS, _puerta: puerta, _guias: GUIAS,
    _med: function () { return window.__ayudaMed.slice(); }
  };
}());
