/* ============================================================
   SEC-HACIENDA-FLANDES · ASESORÍAS (25/10/2026)

   Las asesorías telefónicas que los ciudadanos agendan en la web
   ASESORIA-HACIENDA-FLANDES. Para TODOS los usuarios:

   · Vista ASESORIAS (#view-asesorias): tarjetas o calendario (se
     alterna), pastillas por estado, filtros (asesor, fechas, asunto,
     "Mías" por defecto), buscador, descargas Excel/PDF, Insights y
     EN VIVO. En cada tarjeta: LLAMAR (solo en celular), WhatsApp y
     Gestionar (bitácora y estados NO CONTESTA, ATENDIDA, RESUELTA,
     REPROGRAMADA — esta exige un cupo libre nuevo).
   · MI DISPONIBILIDAD: cada funcionario abre o cierra sus días y franjas
     (mañana / tarde) sin cruzarse con los demás.
   · Tarjeta "Asesorías de hoy" en el inicio (de fondo, después de lo
     de primer plano).
   · Configuración → Asesorías (solo DEV): asuntos (agregar, activar),
     minutos por cupo, antelación, ventana y franjas. Los textos de
     WhatsApp están en Configuración → Plantillas (ase.*).

   Rendimiento (reglas 11 a 18)
   · Una vista, un viaje: 'asesoriasvista' trae lista ligera (fmt=2) +
     disponibilidad + cupos libres + asuntos + ajustes. Carga única por
     sesión; filtros, buscador y calendario son locales.
   · Cabecera antes que datos: el detalle se pinta con la fila que ya se
     tiene y la bitácora llega después ('asesoriauna').
   · Toda escritura: botón ocupado + rid; tras guardar se parcha la fila
     en memoria (no se recarga la lista). Reintento único, mismo rid,
     solo ante falla de red o el 404 de echo de Google.
   · Corte al salir de la vista (AbortController). Lecturas de fondo:
     una sola, después del arranque.
   · Medición: window.__aseMed (ruta, ms, KB) y console.debug.
   ============================================================ */
(function () {
  'use strict';

  var K = window.KIT;
  if (!K) return;
  var M = window.MARCA || {};
  var VISTA = 'view-asesorias';
  var MED = window.__aseMed = window.__aseMed || [];

  function $(id) { return document.getElementById(id); }
  function esc(s) { return K.esc(String(s == null ? '' : s)); }
  function ico(n, t) { return K.icono(n, t || 16); }
  function aviso(t, tono, ms) { K.aviso(t, tono || 'info', ms || 4000); }
  function perfil() { try { return (window.IDN && window.IDN.perfil()) || {}; } catch (e) { return {}; } }
  function esDev() { try { return !!(window.IDN && window.IDN.esDev()); } catch (e) { return false; } }
  function tk() { return window.HAC_SESION ? window.HAC_SESION.tk() : ''; }
  function nuevoRid() { return 'ase' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10); }
  function error(codigo, msg) { var e = new Error(msg); e.codigo = codigo; return e; }
  function esperar(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function medir(o) { try { MED.push(o); if (MED.length > 200) MED.shift(); console.debug('[asesorias]', o); } catch (e) {} }
  function titulo(s) {
    s = String(s || '').toLowerCase().replace(/(^|[\s(,])([a-záéíóúñü])/g, function (m, a, b) { return a + b.toUpperCase(); });
    return s.replace(/ (De|Del|La|Las|Los|Y|E|En|Para|Por|A) /g, function (m) { return m.toLowerCase(); });
  }
  function esCelular() { try { return matchMedia('(pointer: coarse)').matches || /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent); } catch (e) { return false; } }

  var DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  var DIAS_C = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
  var MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  function partes(iso) { var p = String(iso).split('-'); return { y: +p[0], m: +p[1], d: +p[2] }; }
  function dow(iso) { var p = partes(iso); return new Date(Date.UTC(p.y, p.m - 1, p.d)).getUTCDay(); }
  function fechaLarga(iso) { if (!iso) return ''; var p = partes(iso); return DIAS[dow(iso)] + ' ' + p.d + ' de ' + MESES[p.m - 1]; }
  function fechaCorta(iso) { if (!iso) return ''; var p = partes(iso); return DIAS_C[dow(iso)] + ' ' + p.d + '/' + ('0' + p.m).slice(-2); }
  function min(h) { var m = /^(\d{1,2}):(\d{2})/.exec(String(h || '')); return m ? (+m[1]) * 60 + (+m[2]) : -1; }
  function hora12(h) { var t = min(h); if (t < 0) return h || ''; var H = Math.floor(t / 60), m = t % 60; return ((H % 12) || 12) + ':' + ('0' + m).slice(-2) + (H < 12 ? ' a. m.' : ' p. m.'); }
  function hoyIso() { return new Date(Date.now() - 5 * 3600000).toISOString().slice(0, 10); }
  function sumarDias(iso, n) { var p = partes(iso); return new Date(Date.UTC(p.y, p.m - 1, p.d + n)).toISOString().slice(0, 10); }
  function dmy(iso) { var p = String(iso).split('-'); return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : ''; }
  function claseEstado(e) { return String(e || '').replace(/\s+/g, '-'); }
  var ACTIVOS = { PROGRAMADA: 1, REPROGRAMADA: 1 };
  var TONO = { PROGRAMADA: 'info', REPROGRAMADA: 'info', 'NO CONTESTA': 'aviso', ATENDIDA: 'ok', RESUELTA: 'ok' };

  /* ══════════════ red ══════════════
     op = { post, rid, signal }. Reintento ÚNICO y solo ante falla de red o
     respuesta que no es JSON (el 404 de echo de Google), con el mismo rid. */
  function llamar(accion, datos, op) {
    op = op || {}; datos = datos || {};
    var llave = tk(), t0 = performance.now();
    function una(n) {
      var p;
      if (!op.post) {
        var qs = '?action=' + encodeURIComponent(accion);
        Object.keys(datos).forEach(function (k) { qs += '&' + k + '=' + encodeURIComponent(datos[k]); });
        p = fetch(M.API_URL + qs, { signal: op.signal, cache: 'no-store' });
      } else {
        p = fetch(M.API_URL + '?action=' + encodeURIComponent(accion), {
          method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(Object.assign({ tk: llave, rid: op.rid || '' }, datos))
        });
      }
      return p.then(function (r) { return r.text(); }).then(function (t) {
        var j; try { j = JSON.parse(t); } catch (e) { throw error('RED', 'Respuesta inesperada del servidor.'); }
        if (llave !== tk()) throw error('VIEJA', 'Sesión cambiada');
        medir({ ruta: accion, ms: Math.round(performance.now() - t0), kb: Math.round(t.length / 102.4) / 10, n: n });
        if (!j.ok) {
          if (j.codigo === 'SESION_VENCIDA') { try { window.dispatchEvent(new CustomEvent('hac:sesionVencida', { detail: { mensaje: j.error } })); } catch (e) {} }
          throw error(j.codigo || 'ERROR', /Acción (GET )?no válida/i.test(j.error || '') ? 'El servidor todavía no tiene las asesorías. Avísale al desarrollador.' : (j.error || 'No se pudo completar.'));
        }
        return j.data;
      }).catch(function (e) {
        if (e && e.name === 'AbortError') throw e;
        var red = (e instanceof TypeError) || (e && e.codigo === 'RED');
        if (red && n < 1) return esperar(1200).then(function () { return una(n + 1); });
        if (red) throw error('RED', 'Sin conexión con el servidor. Revisa tu internet e inténtalo de nuevo.');
        throw e;
      });
    }
    return una(0);
  }
  function cancelada(e) { return e && (e.name === 'AbortError' || e.codigo === 'VIEJA'); }

  /* ══════════════ datos en memoria ══════════════ */
  var D = null;            /* lo que trajo asesoriasvista, con la lista rehidratada */
  var CTRL = null;
  function rehidratar(campos, filas) {
    return (filas || []).map(function (f) { var o = {}; for (var i = 0; i < campos.length; i++) o[campos[i]] = f[i]; return o; });
  }
  function preparar(o) {
    o.__blob = K.norm([o.id, o.nombre, o.documento, o.telefono, o.ubicacion, o.asunto, o.det, o.asesor, o.estado, o.com].join(' '));
    return o;
  }
  function traer(fresco) {
    if (D && !fresco) return Promise.resolve(D);
    if (CTRL) { try { CTRL.abort(); } catch (e) {} }
    CTRL = window.AbortController ? new AbortController() : null;
    return llamar('asesoriasvista', {}, { signal: CTRL && CTRL.signal }).then(function (d) {
      CTRL = null;
      d.lista = rehidratar(d.campos, d.filas).map(preparar); delete d.filas;
      d.disp = (d.disp || []).map(function (x) { return { f: x[0], fr: x[1], doc: x[2], nombre: x[3] }; });
      d.cupos = (d.cupos || []).map(function (x) { return { f: x[0], fr: x[1], h: x[2], doc: x[3] }; });
      D = d;
      pintarHoyLocal();
      return D;
    });
  }
  function lista() { return (D && D.lista) || []; }
  function porId(id) { var l = lista(); for (var i = 0; i < l.length; i++) if (l[i].id === id) return l[i]; return null; }
  /** Parcha una fila (la respuesta trae la fila nueva en fmt=2) sin recargar la lista. */
  function fundir(det) {
    if (!det || !D) return null;
    var o = preparar(rehidratar(det.campos, [det.fila2])[0]);
    var l = D.lista, i;
    for (i = 0; i < l.length; i++) if (l[i].id === o.id) { l[i] = o; break; }
    if (i === l.length) l.unshift(o);
    pintarHoyLocal();
    return o;
  }
  function sellar() { try { if (window.HACVIVO && window.HACVIVO.sellar) window.HACVIVO.sellar('asesorias'); } catch (e) {} }

  /* ══════════════ filtros ══════════════ */
  var F = null;
  function filtrosIniciales() { return { estado: 'ACTIVAS', mias: true, asesor: '', asunto: '', desde: '', hasta: '', buscar: '', modo: 'tarjetas', dia: '' }; }
  var ESTADOS_F = [['ACTIVAS', 'Por atender'], ['HOY', 'Hoy'], ['PROGRAMADA', 'Programadas'], ['REPROGRAMADA', 'Reprogramadas'],
                   ['NO CONTESTA', 'No contesta'], ['ATENDIDA', 'Atendidas'], ['RESUELTA', 'Resueltas'], ['', 'Todas']];
  function pasaEstado(x, e) {
    if (!e) return true;
    if (e === 'ACTIVAS') return !!ACTIVOS[x.estado];
    if (e === 'HOY') return x.fecha === hoyIso();
    return x.estado === e;
  }
  function yo() { return String(perfil().documento || ''); }
  function filtradas(sinEstado) {
    var q = K.norm(F.buscar), d = yo();
    return lista().filter(function (x) {
      if (F.mias && x.asesorDoc !== d) return false;
      if (!sinEstado && !pasaEstado(x, F.estado)) return false;
      if (F.asesor && x.asesorDoc !== F.asesor) return false;
      if (F.asunto && x.asunto !== F.asunto) return false;
      if (F.desde && x.fecha < F.desde) return false;
      if (F.hasta && x.fecha > F.hasta) return false;
      if (q && x.__blob.indexOf(q) < 0) return false;
      return true;
    }).sort(function (a, b) {
      var aa = ACTIVOS[a.estado] ? 0 : 1, bb = ACTIVOS[b.estado] ? 0 : 1;
      if (aa !== bb) return aa - bb;
      var ka = a.fecha + ' ' + a.hora, kb = b.fecha + ' ' + b.hora;
      return aa === 0 ? (ka < kb ? -1 : ka > kb ? 1 : 0) : (ka > kb ? -1 : ka < kb ? 1 : 0);
    });
  }

  /* ══════════════ la vista ══════════════ */
  function activa() { var v = $(VISTA); return !!(v && v.classList.contains('active')); }
  function montarVista() {
    if ($(VISTA)) return $(VISTA);
    var cont = document.querySelector('.container') || document.body;
    var sec = document.createElement('section');
    sec.id = VISTA; sec.className = 'view';
    sec.innerHTML =
      '<div class="vista kit-ancho ase">' +
        '<div class="hf-herramientas ase-herr">' +
          '<button type="button" class="kit-btn kit-btn--marca" id="ase-disp">' + ico('calendario') + ' Mi disponibilidad</button>' +
          '<div class="kit-pastillas ase-modo" role="group" aria-label="Ver como">' +
            '<button type="button" class="kit-pastilla" data-modo="tarjetas" aria-pressed="true">' + ico('hoja', 14) + ' Tarjetas</button>' +
            '<button type="button" class="kit-pastilla" data-modo="calendario" aria-pressed="false">' + ico('calendario', 14) + ' Calendario</button>' +
          '</div>' +
          '<button type="button" class="kit-btn" id="ase-xls">' + ico('excel') + ' Excel</button>' +
          '<button type="button" class="kit-btn" id="ase-pdf">' + ico('pdf') + ' PDF</button>' +
          '<button type="button" class="kit-btn" id="ase-refrescar" title="Volver a traer las asesorías">' + ico('recargar') + ' Refrescar</button>' +
        '</div>' +
        '<div class="ase-aviso" id="ase-aviso" hidden></div>' +
        '<div class="hf-barra">' +
          '<span class="hf-conteo"><b id="ase-count">0</b> <span id="ase-count-t">asesorías</span></span>' +
          '<label class="hf-buscar"><i class="hi" data-ico="buscar"></i><input id="ase-buscar" type="search" placeholder="Buscar por nombre, documento, celular, código o texto" autocomplete="off"></label>' +
        '</div>' +
        '<div class="kit-pastillas ase-pills" id="ase-pills" role="group" aria-label="Estado"></div>' +
        '<details class="ase-fil" id="ase-fil"><summary>' + ico('lupa', 14) + ' Filtros <span id="ase-fil-n"></span></summary><div class="ase-filtros">' +
          '<label class="ase-chk"><input type="checkbox" id="ase-mias" checked> <span>Solo las mías</span></label>' +
          '<label><span>Asesor</span><select id="ase-asesor"><option value="">Todos</option></select></label>' +
          '<label><span>Asunto</span><select id="ase-asunto"><option value="">Todos</option></select></label>' +
          '<label><span>Desde</span><input type="date" id="ase-desde"></label>' +
          '<label><span>Hasta</span><input type="date" id="ase-hasta"></label>' +
          '<button type="button" class="kit-btn kit-btn--plano" id="ase-limpiar">' + ico('cerrar', 14) + ' Quitar filtros</button>' +
        '</div></details>' +
        '<div id="ase-cal" class="ase-cal" hidden></div>' +
        '<div id="ase-lista" class="ase-lista"></div>' +
        '<div class="ase-mas"><button type="button" class="kit-btn" id="ase-vermas" hidden>Ver más</button>' +
          '<button type="button" class="kit-btn kit-btn--plano" id="ase-hist" hidden>' + ico('reloj', 14) + ' Traer las más antiguas</button></div>' +
        '<button type="button" class="hf-atras" hidden>Regresar</button>' +
      '</div>';
    cont.appendChild(sec);
    /* en el celular los filtros quedan plegados (la lista primero) */
    if (window.innerWidth > 700) sec.querySelector('#ase-fil').open = true;
    try { sec.querySelectorAll('i.hi[data-ico]').forEach(function (i) { i.outerHTML = ico(i.getAttribute('data-ico'), 18); }); } catch (e) {}

    sec.querySelector('.hf-atras').addEventListener('click', salir);
    $('ase-disp').addEventListener('click', miDisponibilidad);
    $('ase-xls').addEventListener('click', function () { exportar('xlsx', this); });
    $('ase-pdf').addEventListener('click', function () { exportar('pdf', this); });
    $('ase-refrescar').addEventListener('click', refrescar);
    $('ase-vermas').addEventListener('click', function () { MOSTRAR += 60; pintar(); });
    $('ase-hist').addEventListener('click', traerHistoria);
    var tq = null;
    $('ase-buscar').addEventListener('input', function (e) { clearTimeout(tq); var v = e.target.value; tq = setTimeout(function () { F.buscar = v; MOSTRAR = 60; pintar(); }, 140); });
    $('ase-mias').addEventListener('change', function () { F.mias = this.checked; MOSTRAR = 60; pintar(); });
    $('ase-asesor').addEventListener('change', function () { F.asesor = this.value; if (this.value) { F.mias = false; $('ase-mias').checked = false; } pintar(); });
    $('ase-asunto').addEventListener('change', function () { F.asunto = this.value; pintar(); });
    $('ase-desde').addEventListener('change', function () { F.desde = this.value; pintar(); });
    $('ase-hasta').addEventListener('change', function () { F.hasta = this.value; pintar(); });
    $('ase-limpiar').addEventListener('click', function () {
      var modo = F.modo; F = filtrosIniciales(); F.modo = modo; F.estado = ''; F.mias = false;
      ['ase-buscar', 'ase-desde', 'ase-hasta', 'ase-asesor', 'ase-asunto'].forEach(function (k) { $(k).value = ''; });
      $('ase-mias').checked = false; pintar();
    });
    sec.querySelectorAll('[data-modo]').forEach(function (b) {
      b.addEventListener('click', function () { K.vibrar(6); F.modo = b.getAttribute('data-modo'); F.dia = ''; pintar(); });
    });
    var pz = $('ase-pills');
    ESTADOS_F.forEach(function (e) {
      var b = K.nodo('<button type="button" class="kit-pastilla" data-e="' + e[0] + '" aria-pressed="false"><span></span> <b class="ase-n">0</b></button>');
      b.querySelector('span').textContent = e[1];
      b.addEventListener('click', function () { K.vibrar(6); F.estado = e[0]; MOSTRAR = 60; pintar(); });
      pz.appendChild(b);
    });
    $('ase-lista').addEventListener('click', alClic);
    $('ase-cal').addEventListener('click', function (e) {
      var d = e.target.closest('[data-dia]'); if (d) { F.dia = F.dia === d.getAttribute('data-dia') ? '' : d.getAttribute('data-dia'); pintar(); }
      var n = e.target.closest('[data-mes]'); if (n) { CAL_MES = n.getAttribute('data-mes'); pintar(); }
    });
    return sec;
  }

  var MOSTRAR = 60, CAL_MES = '';
  function esqueleto() {
    var h = '';
    for (var i = 0; i < 3; i++) h += '<div class="kit-tarjeta ase-c ase-esq"><span></span><span></span><span></span></div>';
    $('ase-lista').innerHTML = h;
  }
  function abrir() {
    var t0 = performance.now();
    if (!F) F = filtrosIniciales();
    montarVista();
    if (typeof window.showView === 'function') window.showView(VISTA);
    if (D) { pintar(); return; }
    esqueleto();
    traer().then(function () {
      if (!activa()) return;
      /* quien no tiene asesorías ni disponibilidad propia ve todas de entrada */
      if (!lista().some(function (x) { return x.asesorDoc === yo(); })) { F.mias = false; $('ase-mias').checked = false; }
      pintar();
      medir({ ruta: 'vista:asesorias', ms: Math.round(performance.now() - t0) });
    }, function (e) {
      if (cancelada(e) || !activa()) return;
      $('ase-lista').innerHTML = '<div class="ase-vacio">' + ico('aviso', 28) + '<p>' + esc(e.message) + '</p>' +
        '<button type="button" class="kit-btn" id="ase-reintentar">' + ico('recargar') + ' Reintentar</button></div>';
      var b = $('ase-reintentar'); if (b) b.addEventListener('click', abrir);
    });
  }
  function salir() {
    if (CTRL) { try { CTRL.abort(); } catch (e) {} CTRL = null; }
    if (typeof window.showView === 'function') window.showView('view-inicio');
  }
  function refrescar() {
    var b = $('ase-refrescar'); if (!b || b.disabled) return;
    b.disabled = true; b.classList.add('kit-ocupado');
    traer(true).then(function () { if (activa()) pintar(); aviso('Asesorías al día.', 'ok', 2000); },
      function (e) { if (!cancelada(e)) aviso(e.message, 'aviso', 5000); })
      .then(function () { b.disabled = false; b.classList.remove('kit-ocupado'); });
  }
  function traerHistoria() {
    var b = $('ase-hist'); if (!b || b.disabled) return;
    b.disabled = true; b.classList.add('kit-ocupado');
    llamar('asesoriashist', {}).then(function (h) {
      rehidratar(h.campos, h.filas).map(preparar).forEach(function (o) { if (!porId(o.id)) D.lista.push(o); });
      D.hayMas = false; F.desde = ''; pintar(); aviso('Llegaron ' + (h.filas || []).length + ' asesorías más antiguas.', 'ok');
    }, function (e) { aviso(e.message, 'aviso', 5000); }).then(function () { b.disabled = false; b.classList.remove('kit-ocupado'); });
  }

  function opcionesSelect() {
    var as = {}, su = {};
    lista().forEach(function (x) { if (x.asesorDoc) as[x.asesorDoc] = x.asesor; if (x.asunto) su[x.asunto] = 1; });
    (D.disp || []).forEach(function (x) { as[x.doc] = x.nombre; });
    (D.asuntosTodos || []).forEach(function (x) { su[x.n] = 1; });
    var s1 = $('ase-asesor'), v1 = s1.value;
    s1.innerHTML = '<option value="">Todos</option>' + Object.keys(as).sort(function (a, b) { return as[a] < as[b] ? -1 : 1; })
      .map(function (k) { return '<option value="' + esc(k) + '">' + esc(titulo(as[k])) + '</option>'; }).join('');
    s1.value = v1;
    var s2 = $('ase-asunto'), v2 = s2.value;
    s2.innerHTML = '<option value="">Todos</option>' + Object.keys(su).sort().map(function (k) { return '<option>' + esc(k) + '</option>'; }).join('');
    s2.value = v2;
  }

  function pintar() {
    if (!D || !$(VISTA)) return;
    var t0 = performance.now();
    opcionesSelect();
    var nf = (F.mias ? 1 : 0) + (F.asesor ? 1 : 0) + (F.asunto ? 1 : 0) + (F.desde ? 1 : 0) + (F.hasta ? 1 : 0);
    $('ase-fil-n').textContent = nf ? '(' + nf + ')' : '';
    var avz = $('ase-aviso');
    if (D.publico && D.publico.error && esDev()) { avz.hidden = false; avz.textContent = 'Los cupos no se pudieron publicar en Firebase: ' + D.publico.error + '. La web usa el respaldo del servidor.'; }
    else avz.hidden = true;
    var base = filtradas(true);
    $('ase-pills').querySelectorAll('.kit-pastilla').forEach(function (b) {
      var e = b.getAttribute('data-e');
      b.setAttribute('aria-pressed', String(e === F.estado));
      b.querySelector('.ase-n').textContent = K.numero(base.filter(function (x) { return pasaEstado(x, e); }).length);
    });
    document.querySelectorAll('#' + VISTA + ' [data-modo]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-modo') === F.modo)); });
    var l = filtradas();
    $('ase-count').textContent = K.numero(l.length);
    $('ase-count-t').textContent = (l.length === 1 ? 'asesoría' : 'asesorías') + ' con estos filtros · ' + K.numero(lista().length) + ' en total';
    $('ase-hist').hidden = !D.hayMas;
    var cal = $('ase-cal');
    cal.hidden = F.modo !== 'calendario';
    if (F.modo === 'calendario') { pintarCalendario(l); if (F.dia) l = l.filter(function (x) { return x.fecha === F.dia; }); else l = []; }
    var z = $('ase-lista');
    if (!l.length) {
      z.innerHTML = F.modo === 'calendario' ? '<p class="ase-vacio ase-vacio--chico">' + (F.dia ? 'Ninguna asesoría ese día con estos filtros.' : 'Toca un día para ver sus asesorías.') + '</p>' :
        '<div class="ase-vacio">' + ico('telefono', 30) + '<p>' + (lista().length ? 'Ninguna asesoría con esos filtros.' : 'Todavía no hay asesorías. Llegan apenas un ciudadano agenda en la web; abre tus horarios en Mi disponibilidad.') + '</p></div>';
      $('ase-vermas').hidden = true;
      return;
    }
    var frag = document.createDocumentFragment();
    l.slice(0, MOSTRAR).forEach(function (x) { frag.appendChild(tarjeta(x)); });
    z.innerHTML = ''; z.appendChild(frag);
    $('ase-vermas').hidden = l.length <= MOSTRAR;
    try { console.debug('[asesorias] pintar', l.length, Math.round(performance.now() - t0) + ' ms'); } catch (e) {}
  }

  function pintarCalendario(l) {
    var hoy = hoyIso();
    if (!CAL_MES) CAL_MES = (F.dia || hoy).slice(0, 7);
    var y = +CAL_MES.slice(0, 4), m = +CAL_MES.slice(5, 7);
    var primero = CAL_MES + '-01', diasMes = new Date(Date.UTC(y, m, 0)).getUTCDate();
    var porDia = {};
    l.forEach(function (x) { var k = x.fecha; (porDia[k] = porDia[k] || { n: 0, act: 0 }).n++; if (ACTIVOS[x.estado]) porDia[k].act++; });
    var disp = {}; (D.disp || []).forEach(function (x) { if (!F.mias || x.doc === yo()) disp[x.f] = 1; });
    var ant = new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 7), sig = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 7);
    var h = '<div class="ase-cal__cab"><button type="button" class="kit-btn kit-btn--plano" data-mes="' + ant + '">' + ico('atras', 14) + '</button>' +
      '<b>' + MESES[m - 1] + ' ' + y + '</b><button type="button" class="kit-btn kit-btn--plano" data-mes="' + sig + '">' + ico('adelante', 14) + '</button></div>' +
      '<div class="ase-cal__rej">' + ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'].map(function (d) { return '<span class="ase-cal__dn">' + d + '</span>'; }).join('');
    var off = (dow(primero) + 6) % 7;
    for (var i = 0; i < off; i++) h += '<span></span>';
    for (var d = 1; d <= diasMes; d++) {
      var iso = CAL_MES + '-' + ('0' + d).slice(-2), c = porDia[iso];
      h += '<button type="button" class="ase-cal__d' + (iso === hoy ? ' es-hoy' : '') + (iso === F.dia ? ' sel' : '') + (disp[iso] ? ' con-disp' : '') + '" data-dia="' + iso + '">' +
        '<span>' + d + '</span>' + (c ? '<b class="' + (c.act ? 'act' : '') + '">' + c.n + '</b>' : '') + '</button>';
    }
    h += '</div><p class="ase-cal__ley"><span class="con-disp-m"></span> con horario abierto · <b class="act">n</b> por atender</p>';
    $('ase-cal').innerHTML = h;
  }

  function tarjeta(x) {
    var t = K.nodo('<article class="kit-tarjeta ase-c ase-c--' + (TONO[x.estado] || 'nada') + '" data-id="' + esc(x.id) + '">' +
      '<div class="ase-c__cab"><span class="ase-c__cara"></span><div class="ase-c__t"><b></b><small></small></div><span class="ase-est"></span></div>' +
      '<p class="ase-c__cuando"></p><p class="ase-c__meta"></p><p class="ase-c__det"></p><div class="ase-c__acc"></div></article>');
    if (K.piezas.personas && K.piezas.personas.avatar) { try { t.querySelector('.ase-c__cara').appendChild(K.piezas.personas.avatar(x.nombre || 'CIUDADANO', { tam: 40 })); } catch (e) {} }
    t.querySelector('.ase-c__t b').textContent = titulo(x.nombre);
    t.querySelector('.ase-c__t small').textContent = 'CC/NIT ' + x.documento + ' · ' + x.telefono;
    var est = t.querySelector('.ase-est'); est.textContent = x.estado; est.classList.add('ase-est--' + claseEstado(x.estado));
    t.querySelector('.ase-c__cuando').innerHTML = ico('reloj', 14) + ' <b>' + esc(fechaLarga(x.fecha)) + ' · ' + esc(hora12(x.hora)) + '</b>' + (x.fecha === hoyIso() ? ' <em class="ase-hoy">hoy</em>' : '');
    t.querySelector('.ase-c__meta').textContent = [x.id, x.asunto, x.ubicacion, 'asesor: ' + titulo(x.asesor), x.reprog ? 'reprogramada ' + x.reprog + (x.reprog === 1 ? ' vez' : ' veces') : ''].filter(Boolean).join(' · ');
    t.querySelector('.ase-c__det').textContent = x.det;
    if (x.cal) t.querySelector('.ase-c__det').insertAdjacentHTML('afterend', '<p class="ase-cal-est">' + estrellas(x.cal) + (x.com ? ' “' + esc(x.com) + '”' : '') + '</p>');
    var acc = t.querySelector('.ase-c__acc'), tel = String(x.telefono || '');
    if (esCelular() && tel) acc.appendChild(K.nodo('<a class="kit-btn kit-btn--marca ase-mini" href="tel:+57' + esc(tel) + '" data-acc="llamar">' + ico('llamar', 14) + ' Llamar</a>'));
    if (tel) {
      var a = K.nodo('<a class="kit-btn kit-btn--plano ase-mini" target="_blank" rel="noopener" data-acc="wa">' + ico('whatsapp', 14) + ' WhatsApp</a>');
      a.href = 'https://wa.me/57' + tel + '?text=' + encodeURIComponent('Hola ' + titulo(String(x.nombre || '').split(' ')[0]) + ', le escribimos de la Secretaría de Hacienda de Flandes por su asesoría ' + x.id + ' (' + x.asunto + ').');
      acc.appendChild(a);
    }
    acc.appendChild(K.nodo('<button type="button" class="kit-btn kit-btn--plano ase-mini" data-acc="gestionar">' + ico('lapiz', 14) + ' Gestionar</button>'));
    return t;
  }
  function estrellas(n) {
    var h = ''; for (var i = 1; i <= 5; i++) h += '<span class="kit-est__v' + (i <= n ? ' kit-est__v--on' : '') + '">' + ico('estrella', 14) + '</span>';
    return '<span class="kit-est__ver" aria-label="' + n + ' de 5 estrellas">' + h + '</span>';
  }
  function alClic(e) {
    var b = e.target.closest('[data-acc]'); if (!b) return;
    var c = b.closest('.ase-c'); var x = c && porId(c.getAttribute('data-id')); if (!x) return;
    var a = b.getAttribute('data-acc');
    if (a === 'gestionar') gestionar(x);
    if (a === 'llamar' || a === 'wa') medir({ ruta: 'accion:' + a, id: x.id });
  }

  /* ══════════════ capa (modal) con el estilo del kit ══════════════ */
  function capa(tituloTxt, cuerpo, botones) {
    var h = K.nodo('<div class="kit-capa kit-sop kit-capa--on ase-capa" role="dialog" aria-modal="true">' +
      '<div class="kit-capa__velo"></div><section class="kit-capa__hoja kit-sop__hoja ase-hoja">' +
      '<header class="kit-capa__h"><span></span><button type="button" class="kit-capa__x" aria-label="Cerrar">' + ico('cerrar', 18) + '</button></header>' +
      '<div class="kit-capa__cuerpo kit-sop__cuerpo"></div><footer class="kit-capa__pie"></footer></section></div>');
    h.querySelector('.kit-capa__h span').textContent = tituloTxt;
    h.querySelector('.kit-capa__cuerpo').appendChild(cuerpo);
    var api = { ocupado: false, botones: [], cerrar: null };
    function fuera() { if (api.ocupado) return; document.removeEventListener('keydown', tecla); if (api.alCerrar) api.alCerrar(); h.remove(); }
    function tecla(e) { if (e.key === 'Escape') fuera(); }
    api.cerrar = fuera;
    h.querySelector('.kit-capa__x').addEventListener('click', fuera);
    h.querySelector('.kit-capa__velo').addEventListener('click', fuera);
    document.addEventListener('keydown', tecla);
    (botones || []).forEach(function (b) {
      var el = K.nodo('<button type="button" class="kit-btn' + (b.marca ? ' kit-btn--marca' : '') + '"></button>');
      el.innerHTML = (b.icono ? ico(b.icono, 16) + ' ' : '') + esc(b.texto);
      el.addEventListener('click', function () { b.al(el); });
      h.querySelector('.kit-capa__pie').appendChild(el);
      api.botones.push(el);
    });
    document.body.appendChild(h);
    return api;
  }
  function ocupar(api, b, si) { api.ocupado = si; K.ocupado = si; api.botones.forEach(function (x) { x.disabled = si; }); if (b) b.classList.toggle('kit-ocupado', si); }

  /* ══════════════ gestionar: bitácora y estados ══════════════ */
  function gestionar(x) {
    var rid = nuevoRid(), estado = '', cupo = null;
    var puede = esSuper() || x.asesorDoc === yo();
    var f = K.nodo('<div class="ase-form">' +
      '<div class="ase-ficha"></div>' +
      '<details class="ase-det" open><summary>' + ico('abajo', 12) + ' Lo que pidió el ciudadano</summary><p class="ase-det__txt"></p></details>' +
      '<div class="ase-bit"><p class="ase-et">Bitácora</p><div class="ase-traza"><p class="ase-cargando">Trayendo la bitácora…</p></div></div>' +
      (puede ? '<div class="kit-pastillas ase-estados" role="radiogroup" aria-label="Estado"></div>' +
        '<div class="ase-reprog" hidden><p class="ase-et">Escoge el nuevo cupo (libre)</p><div class="ase-rp-dias"></div><div class="ase-rp-horas"></div></div>' +
        '<label class="kit-sop__campo"><span class="ase-nota-t">Nota para la bitácora</span><textarea rows="3" maxlength="2000" placeholder="Qué se habló, qué quedó pendiente…"></textarea></label>' +
        '<label class="ase-chk ase-avisar" hidden><input type="checkbox" checked> <span>Avisarle al ciudadano por WhatsApp</span></label>' +
        '<p class="ase-nota"></p>' : '<p class="ase-nota">Solo el funcionario asignado (o ADMIN/DEV) cambia esta asesoría.</p>') +
      '</div>');
    var fi = f.querySelector('.ase-ficha');
    fi.innerHTML = '<p class="ase-ficha__n"></p><p class="ase-ficha__m"></p><p class="ase-ficha__c"></p>';
    fi.querySelector('.ase-ficha__n').textContent = titulo(x.nombre) + ' · CC/NIT ' + x.documento;
    fi.querySelector('.ase-ficha__m').textContent = x.telefono + ' · ' + x.ubicacion + ' · ' + x.asunto;
    fi.querySelector('.ase-ficha__c').innerHTML = '<b>' + esc(fechaLarga(x.fecha)) + ' · ' + esc(hora12(x.hora)) + '</b> · ' + esc(x.estado) + ' · asesor ' + esc(titulo(x.asesor));
    f.querySelector('.ase-det__txt').textContent = x.det;
    var botones = [{ texto: 'Cerrar', al: function () { m.cerrar(); } }];
    if (puede) botones.push({ texto: 'Guardar', icono: 'check', marca: true, al: guardar });
    var m = capa(x.id + ' · ' + x.estado, f, botones);
    /* cabecera ya pintada; la bitácora y el texto completo llegan después */
    llamar('asesoriauna', { id: x.id, fila: x.fila }).then(function (u) {
      f.querySelector('.ase-det__txt').textContent = u.detalle || x.det;
      var tz = f.querySelector('.ase-traza'); tz.innerHTML = '';
      (u.bitacora || []).slice().reverse().forEach(function (b) {
        var p = K.nodo('<p><b></b> <span></span><br><small></small></p>');
        p.querySelector('b').textContent = b.evento; p.querySelector('span').textContent = b.detalle;
        p.querySelector('small').textContent = b.fecha + ' · ' + titulo(b.quien);
        tz.appendChild(p);
      });
      if (u.comentario) tz.insertAdjacentHTML('afterbegin', '<p class="ase-cal-est">' + estrellas(x.cal) + ' “' + esc(u.comentario) + '”</p>');
      if (!tz.children.length) tz.innerHTML = '<p class="ase-nota">Sin movimientos.</p>';
    }, function (e) { if (!cancelada(e)) f.querySelector('.ase-traza').innerHTML = '<p class="ase-nota">' + esc(e.message) + '</p>'; });
    if (!puede) return;

    var ze = f.querySelector('.ase-estados'), rp = f.querySelector('.ase-reprog'), txt = f.querySelector('textarea'),
        nota = f.querySelector('.ase-nota'), avz = f.querySelector('.ase-avisar');
    var opciones = [['', 'Solo nota'], ['NO CONTESTA', 'No contesta'], ['ATENDIDA', 'Atendida'], ['RESUELTA', 'Resuelta'], ['REPROGRAMADA', 'Reprogramar']];
    if (x.estado === 'RESUELTA' && x.cal) opciones = [['', 'Solo nota']];
    opciones.forEach(function (o) {
      var b = K.nodo('<button type="button" class="kit-pastilla" role="radio" aria-pressed="' + (o[0] === estado) + '"></button>');
      b.textContent = o[1];
      b.addEventListener('click', function () { K.vibrar(6); estado = o[0]; ze.querySelectorAll('.kit-pastilla').forEach(function (y) { y.setAttribute('aria-pressed', String(y === b)); }); pintarNota(); });
      ze.appendChild(b);
    });
    function pintarNota() {
      rp.hidden = estado !== 'REPROGRAMADA';
      avz.hidden = ['NO CONTESTA', 'RESUELTA', 'REPROGRAMADA'].indexOf(estado) < 0;
      f.querySelector('.ase-nota-t').textContent = (estado === 'ATENDIDA' || estado === 'RESUELTA') ? 'Qué se habló o qué se hizo (obligatorio)' : 'Nota para la bitácora' + (estado ? ' (opcional)' : '');
      nota.textContent = {
        '': 'Queda en la bitácora; el estado no cambia.',
        'NO CONTESTA': 'Al guardar le llega al ciudadano un WhatsApp con el enlace para volver a agendar.',
        'ATENDIDA': 'Se habló con el ciudadano; aún falta resolver algo.',
        'RESUELTA': 'Le llega un WhatsApp para calificar la atención con estrellas.',
        'REPROGRAMADA': 'Escoge un cupo libre: la asesoría pasa al funcionario dueño de ese horario y el ciudadano recibe la nueva hora.'
      }[estado] || '';
      if (estado === 'REPROGRAMADA') pintarReprog();
    }
    var rpDia = '';
    function pintarReprog() {
      var cs = (D.cupos || []).filter(function (c) { return !(c.f === x.fecha && c.h === x.hora); });
      var dias = []; cs.forEach(function (c) { if (dias.indexOf(c.f) < 0) dias.push(c.f); });
      var zd = rp.querySelector('.ase-rp-dias'), zh = rp.querySelector('.ase-rp-horas');
      if (!dias.length) { zd.innerHTML = '<p class="ase-nota">No hay cupos libres. Abre horarios en Mi disponibilidad.</p>'; zh.innerHTML = ''; return; }
      if (dias.indexOf(rpDia) < 0) rpDia = dias[0];
      zd.innerHTML = dias.map(function (d) { return '<button type="button" class="kit-pastilla" data-d="' + d + '" aria-pressed="' + (d === rpDia) + '">' + esc(fechaCorta(d)) + '</button>'; }).join('');
      zh.innerHTML = cs.filter(function (c) { return c.f === rpDia; }).map(function (c) {
        var due = (D.disp || []).filter(function (z) { return z.f === c.f && z.fr === c.fr; })[0];
        var on = cupo && cupo.f === c.f && cupo.h === c.h;
        return '<button type="button" class="ase-hora" data-h="' + c.h + '" aria-pressed="' + on + '"><b>' + esc(hora12(c.h)) + '</b><small>' + esc(due ? titulo(due.nombre).split(' ')[0] : '') + '</small></button>';
      }).join('');
    }
    rp.addEventListener('click', function (e) {
      var d = e.target.closest('[data-d]'); if (d) { rpDia = d.getAttribute('data-d'); cupo = null; pintarReprog(); return; }
      var h = e.target.closest('[data-h]'); if (h) { cupo = { f: rpDia, h: h.getAttribute('data-h') }; pintarReprog(); }
    });
    pintarNota();

    function guardar(b) {
      if (m.ocupado) return;
      var t = txt.value.trim();
      if (!estado && t.length < 3) { txt.focus(); aviso('Escribe la nota o escoge un estado.', 'aviso'); return; }
      if ((estado === 'ATENDIDA' || estado === 'RESUELTA') && t.length < 5) { txt.focus(); aviso('Cuenta en la bitácora qué se habló o qué se hizo.', 'aviso', 5000); return; }
      if (estado === 'REPROGRAMADA' && !cupo) { aviso('Escoge el nuevo cupo.', 'aviso'); return; }
      ocupar(m, b, true);
      var t0 = performance.now();
      var datos = { id: x.id, estado: estado, nota: t, avisar: !avz.querySelector('input') || avz.querySelector('input').checked };
      if (cupo) { datos.fecha = cupo.f; datos.hora = cupo.h; }
      llamar('aseestado', datos, { post: true, rid: rid }).then(function (r) {
        ocupar(m, b, false);
        fundir(r.asesoria);
        if (r.cupos) D.cupos = r.cupos.map(function (c) { return { f: c[0], fr: c[1], h: c[2], doc: c[3] }; });
        sellar(); m.cerrar(); pintar();
        aviso((estado ? 'Quedó ' + estado + '.' : 'Nota guardada.') + (r.avisado ? ' El ciudadano recibe el WhatsApp.' : ''), 'ok', 4000);
        medir({ ruta: 'guardar:estado', ms: Math.round(performance.now() - t0) });
      }, function (e) {
        ocupar(m, b, false);
        if (e.codigo === 'CUPO') { cupo = null; traer(true).then(function () { if (estado === 'REPROGRAMADA') pintarReprog(); }); }
        if (!cancelada(e)) aviso(e.message, 'malo', 8000);
      });
    }
  }
  function esSuper() { var p = perfil(); var r = p.roles || []; return r.indexOf('ADMIN') >= 0 || r.indexOf('DEV') >= 0; }

  /* ══════════════ MI DISPONIBILIDAD ══════════════ */
  function miDisponibilidad() {
    if (!D) { aviso('Espera a que carguen las asesorías.', 'aviso'); return; }
    var rid = nuevoRid(), cambios = {};
    var yoD = yo(), hoy = hoyIso();
    var dueno = {}; (D.disp || []).forEach(function (x) { dueno[x.f + '|' + x.fr] = x; });
    var agendadas = {}; lista().forEach(function (x) { if (ACTIVOS[x.estado] && x.asesorDoc === yoD) agendadas[x.fecha + '|' + x.franja] = (agendadas[x.fecha + '|' + x.franja] || 0) + 1; });
    var cfg = D.cfg || {};
    var dias = [], d = hoy;
    while (dias.length < 30) { var w = dow(d); if (w >= 1 && w <= 5) dias.push(d); d = sumarDias(d, 1); }
    var f = K.nodo('<div class="ase-form ase-disp">' +
      '<p class="ase-nota">Toca una franja para abrirla o cerrarla. Mañana ' + esc(cfg.manana || '') + ' · Tarde ' + esc(cfg.tarde || '') + ' · cupos de ' + esc(cfg.duracion || 20) + ' minutos. ' +
      'Las franjas de otro funcionario no se pueden tomar; las que tienen asesorías agendadas no se pueden cerrar. Los festivos se descuentan solos.</p>' +
      '<div class="ase-disp__acc"><button type="button" class="kit-btn kit-btn--plano ase-mini" data-todo="M">Abrir todas las mañanas</button><button type="button" class="kit-btn kit-btn--plano ase-mini" data-todo="T">Abrir todas las tardes</button></div>' +
      '<div class="ase-disp__rej"></div></div>');
    var rej = f.querySelector('.ase-disp__rej');
    function estadoDe(k) {
      var x = dueno[k], mia = x && x.doc === yoD;
      var abierto = (k in cambios) ? cambios[k] : !!mia;
      return { otro: x && !mia ? x : null, abierto: abierto, agendadas: agendadas[k] || 0 };
    }
    function pintarRej() {
      rej.innerHTML = dias.map(function (iso) {
        var h = '<div class="ase-disp__dia"><span class="ase-disp__f"><b>' + esc(fechaCorta(iso)) + '</b></span>';
        ['M', 'T'].forEach(function (fr) {
          var k = iso + '|' + fr, e = estadoDe(k);
          var cls = e.otro ? 'otro' : (e.abierto ? 'on' : '');
          var et = e.otro ? titulo(e.otro.nombre).split(' ').slice(0, 2).join(' ') : (e.abierto ? (e.agendadas ? e.agendadas + ' agendada' + (e.agendadas === 1 ? '' : 's') : 'Abierta') : 'Cerrada');
          h += '<button type="button" class="ase-fr ' + cls + (e.agendadas ? ' fija' : '') + (k in cambios ? ' cambio' : '') + '" data-k="' + k + '"' + (e.otro ? ' disabled' : '') + '>' +
            '<small>' + (fr === 'M' ? 'Mañana' : 'Tarde') + '</small><span>' + esc(et) + '</span></button>';
        });
        return h + '</div>';
      }).join('');
      var n = Object.keys(cambios).length;
      m.botones[1].textContent = n ? 'Guardar ' + n + (n === 1 ? ' cambio' : ' cambios') : 'Guardar';
    }
    rej.addEventListener('click', function (e) {
      var b = e.target.closest('[data-k]'); if (!b || b.disabled) return;
      var k = b.getAttribute('data-k'), x = estadoDe(k);
      if (x.otro) return;
      if (x.abierto && x.agendadas) { aviso('Esa franja tiene asesorías agendadas: reprográmalas antes de cerrarla.', 'aviso', 5000); return; }
      K.vibrar(6);
      var nuevo = !x.abierto, original = !!(dueno[k] && dueno[k].doc === yoD);
      if (nuevo === original) delete cambios[k]; else cambios[k] = nuevo;
      pintarRej();
    });
    f.querySelector('.ase-disp__acc').addEventListener('click', function (e) {
      var b = e.target.closest('[data-todo]'); if (!b) return;
      var fr = b.getAttribute('data-todo');
      dias.forEach(function (iso) { var k = iso + '|' + fr, x = estadoDe(k); if (!x.otro && !x.abierto) { var original = !!(dueno[k] && dueno[k].doc === yoD); if (original) delete cambios[k]; else cambios[k] = true; } });
      pintarRej();
    });
    var m = capa('Mi disponibilidad · próximos 30 días hábiles', f, [
      { texto: 'Cerrar', al: function () { m.cerrar(); } },
      { texto: 'Guardar', icono: 'check', marca: true, al: function (b) {
        if (m.ocupado) return;
        var ag = [], qu = [];
        Object.keys(cambios).forEach(function (k) { var p = k.split('|'); (cambios[k] ? ag : qu).push({ f: p[0], fr: p[1] }); });
        if (!ag.length && !qu.length) { m.cerrar(); return; }
        ocupar(m, b, true);
        var t0 = performance.now();
        llamar('asedisp', { agregar: ag, quitar: qu }, { post: true, rid: rid }).then(function (r) {
          ocupar(m, b, false);
          D.disp = (r.disp || []).map(function (x) { return { f: x[0], fr: x[1], doc: x[2], nombre: x[3] }; });
          D.cupos = (r.cupos || []).map(function (c) { return { f: c[0], fr: c[1], h: c[2], doc: c[3] }; });
          sellar(); m.cerrar(); pintar(); pintarHoyLocal();
          aviso('Disponibilidad guardada. ' + (r.publicado ? 'Los ciudadanos ya ven tus horarios.' : 'Los horarios se publican en un minuto.'), 'ok', 5000);
          medir({ ruta: 'guardar:disponibilidad', ms: Math.round(performance.now() - t0) });
        }, function (e) { ocupar(m, b, false); rid = nuevoRid(); if (!cancelada(e)) aviso(e.message, 'malo', 9000); });
      } }]);
    pintarRej();
  }

  /* ══════════════ descargas ══════════════ */
  function filasExp(l) {
    return l.map(function (x) {
      return { id: x.id, creacion: x.creacion, fecha: dmy(x.fecha), hora: hora12(x.hora), estado: x.estado, nombre: x.nombre, documento: x.documento,
               telefono: x.telefono, ubicacion: x.ubicacion, asunto: x.asunto, detalle: x.det, asesor: titulo(x.asesor), reprog: x.reprog || '',
               cal: x.cal || '', calificacion: x.cal ? x.cal + ' de 5' : '', comentario: x.com, origen: x.origen };
    });
  }
  function exportar(que, btn) {
    var l = filtradas();
    if (!l.length) { aviso('No hay asesorías con esos filtros.', 'aviso', 3000); return; }
    var ex = K.piezas.exportar;
    if (!ex) { aviso('La descarga no cargó. Recarga la app.', 'aviso'); return; }
    if (btn.disabled) return;
    btn.disabled = true; btn.classList.add('kit-ocupado');
    var filas = filasExp(l), t0 = performance.now();
    var sub = (F.desde || F.hasta ? 'Del ' + (F.desde ? dmy(F.desde) : 'inicio') + ' al ' + (F.hasta ? dmy(F.hasta) : 'hoy') + ' · ' : '') + l.length + (l.length === 1 ? ' asesoría' : ' asesorías') + (F.mias ? ' · ' + titulo(perfil().nombre) : '');
    var p = que === 'xlsx'
      ? ex.aExcel('Asesorías telefónicas SEC Hacienda', [
          { campo: 'id', titulo: 'Código' }, { campo: 'fecha', titulo: 'Fecha' }, { campo: 'hora', titulo: 'Hora' }, { campo: 'estado', titulo: 'Estado' },
          { campo: 'nombre', titulo: 'Ciudadano' }, { campo: 'documento', titulo: 'Documento' }, { campo: 'telefono', titulo: 'Celular' },
          { campo: 'ubicacion', titulo: 'Ubicación' }, { campo: 'asunto', titulo: 'Asunto' }, { campo: 'detalle', titulo: 'Solicitud' },
          { campo: 'asesor', titulo: 'Asesor' }, { campo: 'reprog', titulo: 'Reprogramaciones' }, { campo: 'cal', titulo: 'Estrellas' },
          { campo: 'comentario', titulo: 'Comentario' }, { campo: 'creacion', titulo: 'Pedida el' }, { campo: 'origen', titulo: 'Origen' }
        ], filas)
      : ex.aPDF('Asesorías telefónicas SEC Hacienda', [
          { campo: 'asunto', titulo: 'Asunto' }, { campo: 'detalle', titulo: 'Solicitud', largo: true }, { campo: 'ubicacion', titulo: 'Ubicación' },
          { campo: 'telefono', titulo: 'Celular' }, { campo: 'asesor', titulo: 'Asesor' }, { campo: 'calificacion', titulo: 'Calificación' },
          { campo: 'comentario', titulo: 'Comentario', largo: true }
        ], filas, {
          subtitulo: sub,
          bloque: { titulo: function (f2) { return f2.id + ' · ' + titulo(f2.nombre); }, sub: function (f2) { return f2.fecha + ' ' + f2.hora + ' · CC/NIT ' + f2.documento; },
                    marca: function (f2) { return f2.estado; }, tono: function (f2) { return TONO[f2.estado] === 'ok' ? 'ok' : (f2.estado === 'NO CONTESTA' ? 'malo' : 'aviso'); } },
          grupo: function (f2) { return f2.estado; },
          resumen: function (fs) {
            var c = cifras(fs.map(function (z) { return { estado: z.estado, cal: z.cal }; }));
            return [{ etiqueta: 'Asesorías', valor: c.total }, { etiqueta: 'Por atender', valor: c.activas }, { etiqueta: 'Resueltas', valor: c.RESUELTA || 0 },
                    { etiqueta: 'No contestaron', valor: c['NO CONTESTA'] || 0 }].concat(c.calificadas ? [{ etiqueta: 'Calificación promedio', valor: String(c.promedio).replace('.', ',') + ' de 5' }] : []);
          }
        });
    Promise.resolve(p).then(function () { medir({ ruta: 'descarga:' + que, ms: Math.round(performance.now() - t0) }); },
      function (e) { aviso((e && e.message) || 'No se pudo armar la descarga.', 'malo', 6000); })
      .then(function () { btn.disabled = false; btn.classList.remove('kit-ocupado'); });
  }
  function cifras(l) {
    var c = { total: l.length, activas: 0, calificadas: 0, suma: 0 };
    l.forEach(function (x) { c[x.estado] = (c[x.estado] || 0) + 1; if (ACTIVOS[x.estado]) c.activas++; if (+x.cal) { c.calificadas++; c.suma += +x.cal; } });
    c.promedio = c.calificadas ? Math.round(c.suma / c.calificadas * 10) / 10 : 0;
    return c;
  }

  /* ══════════════ Insights ══════════════ */
  function insight(id) {
    if (!D) return { titulo: 'Asesorías', texto: 'Abre la vista para que carguen las asesorías.', voz: '' };
    var n = K.numero, l = filtradas(true), c = cifras(l), hoy = hoyIso();
    if (id === 'hoy') {
      var h = l.filter(function (x) { return x.fecha === hoy; }).sort(function (a, b) { return a.hora < b.hora ? -1 : 1; });
      return { titulo: 'Asesorías de hoy', texto: '**' + n(h.length) + '** para hoy: ' + n(h.filter(function (x) { return ACTIVOS[x.estado]; }).length) + ' por atender.',
               lista: h.map(function (x) { return hora12(x.hora) + ' · ' + titulo(x.nombre) + ' · ' + x.estado; }), voz: n(h.length) + ' asesorías para hoy.' };
    }
    if (id === 'calificacion') {
      var cal = l.filter(function (x) { return x.cal; });
      return { titulo: 'Calificación', texto: c.calificadas ? 'Promedio **' + String(c.promedio).replace('.', ',') + ' de 5** con ' + n(c.calificadas) + ' calificaciones.' : 'Todavía nadie ha calificado una asesoría.',
               lista: cal.slice(0, 10).map(function (x) { return x.id + ' · ' + x.cal + '★ · ' + titulo(x.nombre) + (x.com ? ' · “' + x.com + '”' : ''); }), voz: '' };
    }
    if (id === 'asesor') {
      var por = {};
      l.forEach(function (x) { var k = titulo(x.asesor) || 'Sin asesor'; var o = por[k] = por[k] || { n: 0, act: 0, res: 0 }; o.n++; if (ACTIVOS[x.estado]) o.act++; if (x.estado === 'RESUELTA') o.res++; });
      return { titulo: 'Por asesor', texto: 'Asesorías por funcionario (con los filtros de la vista).',
               lista: Object.keys(por).sort(function (a, b) { return por[b].n - por[a].n; }).map(function (k) { return k + ': ' + por[k].n + ' · ' + por[k].act + ' por atender · ' + por[k].res + ' resueltas'; }), voz: '' };
    }
    var nc = c['NO CONTESTA'] || 0;
    return { titulo: 'Resumen de asesorías', texto: '**' + n(c.total) + '** asesorías: **' + n(c.activas) + '** por atender, ' + n(c.RESUELTA || 0) + ' resueltas, ' + n(c.ATENDIDA || 0) + ' atendidas y ' + n(nc) + ' sin contestar.' +
             (c.total ? ' Efectividad de contacto: **' + Math.round((c.total - nc - c.activas) / Math.max(1, c.total - c.activas) * 100) + ' %**.' : '') +
             (c.calificadas ? ' Calificación promedio **' + String(c.promedio).replace('.', ',') + ' de 5**.' : ''), voz: n(c.total) + ' asesorías, ' + n(c.activas) + ' por atender.' };
  }

  /* ══════════════ tarjeta del inicio: asesorías de hoy ══════════════ */
  var HOY = null;
  function montarHoy() {
    var ini = document.querySelector('#view-inicio .hf-inicio'); if (!ini) return null;
    var z = $('ase-hoy');
    if (!z) {
      z = K.nodo('<section class="kit-tarjeta ase-hoyc" id="ase-hoy" hidden><div class="ase-hoyc__cab">' + ico('telefono', 20) +
        '<b>Asesorías de hoy</b><button type="button" class="kit-btn kit-btn--plano ase-mini" id="ase-hoy-ver">Ver todas</button></div><div class="ase-hoyc__l"></div></section>');
      var saludo = ini.querySelector('.saludo');
      if (saludo && saludo.nextSibling) ini.insertBefore(z, saludo.nextSibling); else ini.appendChild(z);
      z.querySelector('#ase-hoy-ver').addEventListener('click', function () { if (!F) F = filtrosIniciales(); F.estado = 'HOY'; abrir(); });
      z.addEventListener('click', function (e) { var b = e.target.closest('[data-ase]'); if (!b) return; var id = b.getAttribute('data-ase'); if (!F) F = filtrosIniciales(); F.estado = 'HOY'; abrir(); setTimeout(function () { var x = porId(id); if (x) gestionar(x); }, D ? 50 : 1500); });
    }
    return z;
  }
  function pintarHoy() {
    var z = montarHoy(); if (!z || !HOY) return;
    var l = HOY.mias || [];
    var p = z.querySelector('.ase-hoyc__l');
    if (!l.length) {
      if (!HOY.tengoDisp) { z.hidden = true; return; }
      p.innerHTML = '<p class="ase-nota">Hoy no tienes asesorías agendadas.' + (HOY.total ? ' En la Secretaría hay ' + HOY.total + ' para hoy.' : '') + '</p>';
    } else {
      p.innerHTML = l.map(function (x) {
        var tel = String(x.telefono || '');
        return '<div class="ase-hoyc__i' + (ACTIVOS[x.estado] ? '' : ' hecha') + (x.id === HOY.proxima ? ' prox' : '') + '"><button type="button" data-ase="' + esc(x.id) + '"><b>' + esc(hora12(x.hora)) + '</b> ' +
          esc(titulo(x.nombre)) + '<small>' + esc(x.asunto) + ' · ' + esc(x.estado) + '</small></button>' +
          (esCelular() && tel && ACTIVOS[x.estado] ? '<a class="kit-btn kit-btn--marca ase-mini" href="tel:+57' + esc(tel) + '">' + ico('llamar', 14) + '</a>' : '') + '</div>';
      }).join('');
    }
    z.hidden = false;
  }
  /** Con la vista cargada, la tarjeta del inicio se arma sin viajar. */
  function pintarHoyLocal() {
    if (!D) return;
    var hoy = hoyIso(), d = yo(), ahora = Date.now();
    var l = lista().filter(function (x) { return x.fecha === hoy; });
    var mias = l.filter(function (x) { return x.asesorDoc === d; }).sort(function (a, b) { return a.hora < b.hora ? -1 : 1; });
    var prox = mias.filter(function (x) { return ACTIVOS[x.estado]; })[0];
    HOY = { mias: mias, total: l.length, proxima: prox ? prox.id : '', tengoDisp: (D.disp || []).some(function (x) { return x.doc === d && x.f >= hoy; }) };
    pintarHoy();
  }
  function cargarHoy() {
    if (D) { pintarHoyLocal(); return; }
    llamar('asesoriashoy', {}).then(function (h) { if (!D) { HOY = h; pintarHoy(); } }, function () {});
  }

  /* ══════════════ Configuración → Asesorías (solo DEV) ══════════════ */
  function pintarConfig(cont) {
    if (!cont) return;
    cont.innerHTML = '<p class="hf-intro">Cargando…</p>';
    traer().then(function () {
      var c = D.cfg || {}, as = (D.asuntosTodos || []).map(function (x) { return { n: x.n, a: !!x.a }; });
      var f = K.nodo('<div class="ase-cfg">' +
        '<p class="hf-intro">Lo que ve el ciudadano en la web de asesorías. Los textos de WhatsApp están en <b>Plantillas de mensajes</b> (los que empiezan por "Asesorías").</p>' +
        '<h4>Asuntos</h4><div class="ase-cfg__as"></div>' +
        '<div class="ase-cfg__nuevo"><input type="text" maxlength="120" placeholder="Nuevo asunto"><button type="button" class="kit-btn">' + ico('mas', 14) + ' Agregar</button></div>' +
        '<h4>Cupos</h4><div class="ase-cfg__num">' +
          '<label><span>Minutos por cupo</span><input type="number" min="5" max="120" step="5" name="duracion"></label>' +
          '<label><span>Horas mínimas de antelación</span><input type="number" min="0" max="72" name="antelacion"></label>' +
          '<label><span>Días hacia adelante</span><input type="number" min="1" max="60" name="ventana"></label>' +
          '<label><span>Franja de la mañana</span><input type="text" name="manana" placeholder="09:00-11:00"></label>' +
          '<label><span>Franja de la tarde</span><input type="text" name="tarde" placeholder="15:00-17:00"></label>' +
        '</div><p class="ase-nota ase-cfg__cuenta"></p>' +
        '<button type="button" class="kit-btn kit-btn--marca ase-cfg__g">' + ico('check', 16) + ' Guardar ajustes de asesorías</button></div>');
      ['duracion', 'antelacion', 'ventana', 'manana', 'tarde'].forEach(function (k) { f.querySelector('[name="' + k + '"]').value = c[k] == null ? '' : c[k]; });
      function cuenta() {
        var d = +f.querySelector('[name="duracion"]').value || 20, mm = function (v) { var r = /(\d+):(\d+)-(\d+):(\d+)/.exec(v || ''); return r ? ((+r[3]) * 60 + (+r[4]) - (+r[1]) * 60 - (+r[2])) : 0; };
        var a = Math.floor(mm(f.querySelector('[name="manana"]').value) / d), b = Math.floor(mm(f.querySelector('[name="tarde"]').value) / d);
        f.querySelector('.ase-cfg__cuenta').textContent = 'Así quedan ' + a + ' cupos en la mañana y ' + b + ' en la tarde por funcionario.';
      }
      f.addEventListener('input', cuenta); cuenta();
      var za = f.querySelector('.ase-cfg__as');
      function pintarAs() {
        za.innerHTML = '';
        as.forEach(function (x, i) {
          var r = K.nodo('<label class="ase-cfg__a"><input type="checkbox"> <span></span></label>');
          r.querySelector('input').checked = x.a; r.querySelector('span').textContent = x.n;
          r.querySelector('input').addEventListener('change', function () { as[i].a = this.checked; });
          za.appendChild(r);
        });
      }
      pintarAs();
      f.querySelector('.ase-cfg__nuevo button').addEventListener('click', function () {
        var inp = f.querySelector('.ase-cfg__nuevo input'), v = inp.value.replace(/\s+/g, ' ').trim();
        if (v.length < 4) { aviso('Escribe el asunto.', 'aviso'); return; }
        if (as.some(function (x) { return K.norm(x.n) === K.norm(v); })) { aviso('Ese asunto ya está.', 'aviso'); return; }
        as.push({ n: v, a: true }); inp.value = ''; pintarAs();
      });
      var rid = nuevoRid();
      f.querySelector('.ase-cfg__g').addEventListener('click', function () {
        var b = this; if (b.disabled) return;
        b.disabled = true; b.classList.add('kit-ocupado');
        var datos = { asuntos: as };
        ['duracion', 'antelacion', 'ventana', 'manana', 'tarde'].forEach(function (k) { datos[k] = f.querySelector('[name="' + k + '"]').value.trim(); });
        llamar('asecfg', datos, { post: true, rid: rid }).then(function (r) {
          D.cfg = r.cfg; D.asuntosTodos = r.asuntosTodos; rid = nuevoRid();
          aviso('Ajustes de asesorías guardados' + (r.publicado ? ' y publicados en la web.' : '. Se publican en un minuto.'), 'ok', 5000);
        }, function (e) { aviso(e.message, 'malo', 8000); }).then(function () { b.disabled = false; b.classList.remove('kit-ocupado'); });
      });
      cont.innerHTML = ''; cont.appendChild(f);
    }, function (e) { cont.innerHTML = '<p class="hf-intro">' + esc(e.message) + '</p>'; });
  }

  /* ══════════════ enganches ══════════════ */
  function enchufar() {
    var a = $('btn-asesorias'); if (a && !a.__ase) { a.__ase = true; a.addEventListener('click', function () { if (!F) F = filtrosIniciales(); abrir(); }); }
    try {
      if (window.HACVIVO && window.HACVIVO.VISTAS && !window.HACVIVO.VISTAS[VISTA]) {
        window.HACVIVO.VISTAS[VISTA] = { col: 'asesorias', filtro: 'ase-buscar', f: function () { return traer(true).then(function () { if (activa()) pintar(); }); } };
      }
    } catch (e) {}
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', enchufar); else enchufar();
  window.addEventListener('hac:login', function () {
    D = null; F = null; HOY = null; var z = $('ase-hoy'); if (z) z.hidden = true;
    enchufar();
    /* de fondo, detrás de lo de primer plano del inicio */
    setTimeout(cargarHoy, 1800);
  });
  window.addEventListener('hac:logout', function () { D = null; F = null; HOY = null; var z = $('ase-hoy'); if (z) z.hidden = true; });
  window.addEventListener('hac:sesionVencida', function () { D = null; HOY = null; });

  window.ASESORIAS = { abrir: abrir, insight: insight, pintarConfig: pintarConfig, _datos: function () { return D; }, _filtradas: function () { return F ? filtradas() : []; }, _med: function () { return MED.slice(); } };
}());
