/* ============================================================
 * CAPA 11 · INSIGHTS — SEC-HACIENDA (FASE 11 · 05/08/2026)
 * ------------------------------------------------------------
 * QUÉ HACE
 *   Pone un botón robot flotante en las 8 vistas que tienen datos
 *   que analizar. Al tocarlo abre una hoja tipo chat SIN campo de
 *   texto: abajo hay botones fijos y cada uno responde con un
 *   informe escrito, con efecto "escribiendo", lectura en voz,
 *   Copiar y enviar por WhatsApp.
 *
 * DE DÓNDE SALEN LOS NÚMEROS (esto es lo importante)
 *   NO hay Gemini ni ninguna IA. Cada informe se calcula AQUÍ, en
 *   el navegador, con las MISMAS listas que ya están pintadas en
 *   la pantalla y RESPETANDO los filtros, el buscador y la pestaña
 *   que tenga puesta el usuario. Por eso salen al instante, no
 *   viaja ni un dato a terceros y siempre cuadran con lo que se ve.
 *   Donde se puede, se llaman los propios helpers de app.js
 *   (diasHabiles_, panelSemaforoDistrib_, bdppGroupCount_…) para
 *   que el informe y el gráfico no puedan discrepar.
 *
 * VOZ
 *   Inworld, por dos endpoints nuevos del backend (vozEstado /
 *   vozHablar) que guardan la clave en la configuración de la hoja.
 *   Se manda a leer SOLO el resumen en cifras: ni nombres, ni
 *   documentos, ni direcciones, ni el texto de las solicitudes
 *   salen de la app hacia el proveedor de voz.
 *   La petición se hace con fetch propio a propósito: pasar por
 *   apiPost encendería el loader y el candado de la capa 12.
 *
 * iPhone
 *   Safari solo deja sonar audio si hubo un gesto antes. El audio se
 *   desbloquea en el mismo toque que abre el panel y en cada toque
 *   de un botón.
 *
 * INSTALACIÓN (al final del <body>, DESPUÉS de js/esqueletos.js)
 *   <script src="js/capa-11-insights.js"></script>
 * PAREJA
 *   css/capa-11-insights.css (en el <head>, después de css/visor.css).
 *
 * No toca app.js.
 * ============================================================ */
(function () {
  'use strict';

  if (window.__hac11Insights) return;
  window.__hac11Insights = true;

  /* ---------------- iconos ---------------- */
  var ROBOT = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<rect x="4" y="8" width="16" height="11" rx="3.5"/><path d="M12 8V4.5"/><circle cx="12" cy="3.2" r="1.3"/>' +
    '<path d="M1.8 12.5v3M22.2 12.5v3"/><circle cx="9" cy="13" r="1.15" fill="currentColor" stroke="none"/>' +
    '<circle cx="15" cy="13" r="1.15" fill="currentColor" stroke="none"/><path d="M9.5 16.3h5"/></svg>';
  var CERRAR = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  var WA = '<svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" aria-hidden="true"><path d="M12.04 2C6.6 2 2.2 6.4 2.2 11.84c0 1.74.46 3.42 1.32 4.9L2 22l5.4-1.42a9.8 9.8 0 0 0 4.64 1.18h.01c5.43 0 9.84-4.4 9.84-9.84C21.89 6.4 17.48 2 12.04 2zm0 17.96h-.01a8.2 8.2 0 0 1-4.16-1.14l-.3-.18-3.09.81.82-3.01-.2-.31a8.14 8.14 0 0 1-1.25-4.35c0-4.51 3.67-8.18 8.19-8.18 2.19 0 4.24.85 5.79 2.4a8.13 8.13 0 0 1 2.4 5.79c0 4.51-3.68 8.17-8.19 8.17z"/></svg>';
  var BOCINA = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 9.5h3l4-3v11l-4-3H5z"/><path d="M16 9.2a4 4 0 0 1 0 5.6"/><path d="M18.6 6.8a7.5 7.5 0 0 1 0 10.4"/></svg>';
  var STOP = '<svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" aria-hidden="true"><rect x="7" y="7" width="10" height="10" rx="2"/></svg>';

  /* WAV mudo: deja el <audio> "activado" dentro del gesto del usuario,
     que es lo que exige Safari en iPhone. */
  var SILENCIO = 'data:audio/wav;base64,UklGRqQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YYAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==';

  /* ---------------- estado ---------------- */
  var fab = null;
  var abierta = false;
  var cerrarHoja = null;
  var vozCfg = null, pidiendoVoz = null;

  /* ============================================================
     UTILIDADES
     ============================================================ */
  function limpio(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function nodo(html) {
    var t = document.createElement('template');
    t.innerHTML = String(html).trim();
    return t.content.firstElementChild;
  }
  function reducido() {
    try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
  }
  function avisar(msg) {
    try {
      if (window.Swal && Swal.fire) Swal.fire({ icon: 'error', title: msg, timer: 2200, showConfirmButton: false });
    } catch (e) {}
  }
  /* Mayúsculas y sin tildes. Si app.js está cargado se usa el suyo,
     para que agrupar aquí y filtrar allá den lo mismo. */
  function llano(s) {
    try { if (typeof normalizeText_ === 'function') return normalizeText_(s); } catch (e) {}
    var t = String(s == null ? '' : s).trim().toUpperCase();
    try { return t.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); } catch (e) { return t; }
  }
  function txt(v) { return String(v == null ? '' : v).trim(); }
  function etiq(v) { var s = txt(v).toUpperCase(); return s || 'SIN DATO'; }
  function num(n) {
    try { return Number(n || 0).toLocaleString('es-CO'); } catch (e) { return String(n || 0); }
  }
  function b(n) { return '**' + num(n) + '**'; }
  function pct(a, t) { return t ? Math.round(a * 100 / t) : 0; }
  function bp(a, t) { return '**' + pct(a, t) + ' %**'; }
  function plural(n, uno, varios) { return n === 1 ? uno : varios; }
  /* Pesos: se usan los mismos formateadores del panel predial si están. */
  function pesos(n) {
    try { if (typeof bdppFmtPesos_ === 'function') return bdppFmtPesos_(n); } catch (e) {}
    return '$ ' + num(Math.round(Number(n) || 0));
  }
  function pesosCorto(n) {
    try { if (typeof bdppFmtPesosCorto_ === 'function') return bdppFmtPesosCorto_(n); } catch (e) {}
    return pesos(n);
  }

  /* ---------------- fechas ----------------
     Lo que llega del backend es texto: "13/03/2026" o
     "13/03/2026 5:19 PM" (así lo arma formatFechaHoraDDMMYYYY_hmmAMPM_).
     También se acepta ISO por si alguna hoja trae ese formato. */
  function fecha(s) {
    var t = txt(s);
    if (!t) return null;
    var m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ ,]+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([ap])?\.?\s*m?\.?)?/i.exec(t);
    var Y, M, D, h = 0, mi = 0, ampm = '';
    if (m) {
      D = +m[1]; M = +m[2]; Y = +m[3];
      if (m[4] != null) { h = +m[4]; mi = +m[5]; ampm = (m[7] || '').toLowerCase(); }
    } else {
      var i = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ](\d{1,2}):(\d{2}))?/.exec(t);
      if (!i) return null;
      Y = +i[1]; M = +i[2]; D = +i[3];
      if (i[4] != null) { h = +i[4]; mi = +i[5]; }
    }
    if (ampm === 'p' && h < 12) h += 12;
    if (ampm === 'a' && h === 12) h = 0;
    if (!Y || !M || !D || Y < 1990) return null;
    var d = new Date(Y, M - 1, D, h, mi, 0, 0);
    return isNaN(d.getTime()) ? null : d;
  }
  /* ¿el texto traía hora de verdad? (medianoche = fila sin hora) */
  function tieneHora(s) {
    return /\d{1,2}:\d{2}/.test(txt(s));
  }
  var MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
               'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  var DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  function claveMes(d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2); }
  function mesTxt(k) {
    var p = String(k).split('-');
    var i = parseInt(p[1], 10) - 1;
    return (MESES[i] ? MESES[i].charAt(0).toUpperCase() + MESES[i].slice(1) : p[1]) + ' ' + p[0];
  }
  function hoy() { var d = new Date(); d.setHours(0, 0, 0, 0); return d; }
  function diasEntre(a, bb) {
    if (!a || !bb) return null;
    var x = new Date(a.getFullYear(), a.getMonth(), a.getDate());
    var y = new Date(bb.getFullYear(), bb.getMonth(), bb.getDate());
    return Math.round((y - x) / 86400000);
  }
  function antiguedad(f) {
    var d = fecha(f);
    if (!d) return null;
    return diasEntre(d, hoy());
  }

  /* ============================================================
     AGREGADOS GENÉRICOS
     Todo informe se arma con estas cuatro piezas.
     ============================================================ */
  function conteo(lista, clave) {
    var m = {};
    for (var i = 0; i < lista.length; i++) {
      var k = typeof clave === 'function' ? clave(lista[i]) : etiq(lista[i][clave]);
      if (k == null || k === false) continue;
      m[k] = (m[k] || 0) + 1;
    }
    return m;
  }
  function suma(lista, clave, campo) {
    var m = {};
    for (var i = 0; i < lista.length; i++) {
      var k = typeof clave === 'function' ? clave(lista[i]) : etiq(lista[i][clave]);
      if (k == null || k === false) continue;
      m[k] = (m[k] || 0) + (Number(lista[i][campo]) || 0);
    }
    return m;
  }
  /* Pares [clave, valor] ordenados de mayor a menor. */
  function orden(mapa) {
    return Object.keys(mapa).map(function (k) { return [k, mapa[k]]; })
      .sort(function (a, bb) { return bb[1] - a[1] || String(a[0]).localeCompare(String(bb[0])); });
  }
  /* Líneas "• CLAVE — 12 (30 %)". n = cuántas se listan; el resto se resume. */
  function top(mapa, n, total, pinta) {
    var pares = orden(mapa), out = [], i;
    var lim = n || pares.length;
    for (i = 0; i < pares.length && i < lim; i++) {
      var v = pares[i][1];
      var val = pinta ? pinta(v) : ('**' + num(v) + '**');
      out.push('- ' + pares[i][0] + ' — ' + val + (total ? ' (' + pct(v, total) + ' %)' : ''));
    }
    if (pares.length > lim) {
      var resto = 0;
      for (; i < pares.length; i++) resto += pares[i][1];
      out.push('- y ' + (pares.length - lim) + ' ' + plural(pares.length - lim, 'grupo más', 'grupos más') +
               ' — ' + (pinta ? pinta(resto) : '**' + num(resto) + '**'));
    }
    return out;
  }
  function bloque(titulo, lineas) {
    if (!lineas || !lineas.length) return '';
    return '**' + titulo + '**\n' + lineas.join('\n');
  }
  function unir() {
    var out = [];
    for (var i = 0; i < arguments.length; i++) {
      var t = arguments[i];
      if (t) out.push(t);
    }
    return out.join('\n\n');
  }
  function cuantos(mapa) { return Object.keys(mapa).length; }
  function mayor(mapa) { var p = orden(mapa); return p.length ? p[0] : null; }

  /* Informe estándar: { titulo, texto, voz, lista } */
  function rep(titulo, texto, voz, lista) {
    return { titulo: titulo, texto: texto, voz: voz || '', lista: lista || [] };
  }
  function vacio(titulo, que) {
    return rep(titulo,
      'No hay ' + (que || 'datos') + ' en pantalla ahora mismo.\nQuita los filtros o vuelve a cargar la vista y consúltame otra vez.',
      'No hay ' + (que || 'datos') + ' en pantalla ahora mismo.');
  }
  /* Personas para los botones de WhatsApp (solo donde hay teléfono). */
  function personas(lista, tope) {
    var out = [];
    for (var i = 0; i < lista.length && out.length < (tope || 12); i++) {
      out.push({ nombre: txt(lista[i].nombre), contacto: txt(lista[i].whatsapp || lista[i].contacto) });
    }
    return out;
  }

  /* ============================================================
     DE DÓNDE SE LEE CADA VISTA
     ------------------------------------------------------------
     app.js declara estas listas con `let` en el ámbito global: NO
     cuelgan de window, pero otro <script> clásico sí las ve. Cada
     acceso va protegido por si en algún momento cambian de nombre:
     el panel se queda sin datos, nunca se cae la app.
     ============================================================ */
  function leer(f, porDefecto) {
    try { var v = f(); return (v == null) ? porDefecto : v; } catch (e) { return porDefecto; }
  }
  function vistaActiva() {
    var v = document.querySelector('.view.active');
    return v ? v.id : '';
  }
  function valor(id) {
    var el = document.getElementById(id);
    return el ? txt(el.value) : '';
  }

  /* SOLICITUDES en pantalla = la caché pasada por el buscador de la
     vista, exactamente el mismo filtro que usa aplicarFiltroLista_. */
  function solicitudes() {
    var base = leer(function () { return __listCache; }, []) || [];
    var q = llano(valor('lista-filter'));
    if (!q) return base;
    return base.filter(function (it) {
      return llano([it.id_predial, it.nombre, it.documento, it.barrio, it.whatsapp,
                    it.codigo, it.solicitud, it.fecha, it.estado, it.observacion,
                    it.respondida].join(' ')).indexOf(q) !== -1;
    });
  }
  function modoLista() { return leer(function () { return currentListMode; }, 'PENDIENTE'); }

  function atenciones() { return leer(function () { return __atencPagedCache; }, []) || []; }
  function atencChat()  { return leer(function () { return __atencionesChatCache; }, []) || []; }
  function atencPres()  { return leer(function () { return __atencionesPresCache; }, []) || []; }
  function atencTab()   { return leer(function () { return __atencionesTabActual; }, 'chat'); }

  function estad() { return leer(function () { return __estadCache; }, []) || []; }

  function panelProc() { return (window.__panelData && window.__panelData.length) ? window.__panelData : []; }

  function procFiltrado() {
    var vistos = leer(function () { return __procPagedCache; }, []) || [];
    var todos  = leer(function () { return __procListCache; }, []) || [];
    if (vistos.length) return vistos;
    return conFiltroProc() ? vistos : todos;   /* 0 con filtro puesto SÍ es 0 */
  }
  function conFiltroProc() {
    return leer(function () { return __procStatusFilter; }, 'ALL') !== 'ALL' ||
           leer(function () { return __procFiltroAsignado; }, 'ALL') !== 'ALL' ||
           leer(function () { return __procFiltroVence; }, 'ALL') !== 'ALL' ||
           !!valor('proc-filter');
  }
  function procTodos() { return leer(function () { return __procListCache; }, []) || []; }

  function bdpFiltrado() {
    var vistos = leer(function () { return __bdpFilteredCache; }, []) || [];
    var todos  = leer(function () { return __bdpListCache; }, []) || [];
    if (vistos.length) return vistos;
    return conFiltroBdp() ? vistos : todos;
  }
  function conFiltroBdp() {
    return leer(function () { return __bdpFilterClasif; }, 'ALL') !== 'ALL' ||
           leer(function () { return __bdpFilterActuacion; }, 'ALL') !== 'ALL' ||
           leer(function () { return __bdpFilterSustanciador; }, 'ALL') !== 'ALL' ||
           leer(function () { return __bdpFilterEstado; }, 'ALL') !== 'ALL' ||
           leer(function () { return __bdpFilterMias; }, false) === true ||
           !!valor('bdp-filter');
  }
  function bdpTodos() { return leer(function () { return __bdpListCache; }, []) || []; }

  function bdpp() { return leer(function () { return __bdppData; }, []) || []; }
  function drive() { return leer(function () { return DRIVE_DATA; }, []) || []; }

  /* ── LOTE 06/09 · MIS BITÁCORAS ────────────────────────────────────
     La bitácora es un historial de líneas `NOMBRE dd/mm/aaaa: texto`.
     El lector vive en js/bitacora.js (window.BITACORA) para que la
     pastilla de la vista, este panel y la descarga del servidor usen
     exactamente la misma regla. Si por lo que sea no está montado, se
     lee aquí igual: el informe nunca se cae. */
  function anotacionesDe(texto, autor) {
    try {
      if (window.BITACORA && typeof window.BITACORA.anotaciones === 'function') {
        return window.BITACORA.anotaciones(texto, autor);
      }
    } catch (_) {}
    var s = String(texto == null ? '' : texto);
    if (!s.trim()) return [];
    var lineas = s.split(/\r?\n/);
    var quien = llano(autor);
    var out = [];
    for (var i = 0; i < lineas.length; i++) {
      var m = lineas[i].match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
      if (!m) continue;
      if (quien && llano(lineas[i].substring(0, m.index)) !== quien) continue;
      out.push({
        dia: Number(m[3]) * 10000 + Number(m[2]) * 100 + Number(m[1]),
        anio: Number(m[3]), mes: Number(m[2]), fecha: m[0],
        texto: lineas[i].substring(m.index + m[0].length).replace(/^\s*[:\-]\s*/, '').trim()
      });
    }
    return out;
  }

  /* Informe común de "mis bitácoras" para BD Predial y Asignaciones:
     los dos cuentan lo mismo, solo cambia cómo se llama cada fila. */
  function repMisBitacoras(titulo, lista, ficha, unoVarios, pieFiltro) {
    var yo = yoNombre();
    if (!yo) {
      return rep(titulo, 'No logro saber con qué usuario estás dentro.',
                 'No sé con qué usuario estás dentro.');
    }

    var conMias = [];
    var todasMias = [];
    for (var i = 0; i < lista.length; i++) {
      var anot = anotacionesDe(lista[i].bitacora, yo);
      if (!anot.length) continue;
      conMias.push({ fila: lista[i], anot: anot });
      for (var j = 0; j < anot.length; j++) todasMias.push(anot[j]);
    }

    if (!conMias.length) {
      return rep(titulo,
        'Todavía no tienes ninguna anotación tuya en ' + unoVarios[1] + ' que estás viendo.' + pieFiltro,
        'No tienes anotaciones propias en lo que estás viendo.');
    }

    todasMias.sort(function (a, bb) { return bb.dia - a.dia; });

    var hoy = new Date();
    var claveMes = hoy.getFullYear() * 100 + (hoy.getMonth() + 1);
    var esteMes = 0, hace30 = 0;
    var limite = new Date(hoy.getTime() - 30 * 86400000);
    var limDia = limite.getFullYear() * 10000 + (limite.getMonth() + 1) * 100 + limite.getDate();
    for (var k = 0; k < todasMias.length; k++) {
      if (todasMias[k].anio * 100 + todasMias[k].mes === claveMes) esteMes++;
      if (todasMias[k].dia >= limDia) hace30++;
    }

    /* Cuántas anotaciones por mes, de la más reciente hacia atrás */
    var porMes = {};
    for (var q = 0; q < todasMias.length; q++) {
      var cl = todasMias[q].anio + '-' + ('0' + todasMias[q].mes).slice(-2);
      porMes[cl] = (porMes[cl] || 0) + 1;
    }
    var meses = Object.keys(porMes).sort().reverse().slice(0, 6).map(function (cl) {
      return '- ' + cl + ' — ' + b(porMes[cl]);
    });

    /* Los 10 expedientes que toqué de últimas */
    conMias.sort(function (a, bb) {
      return bb.anot[bb.anot.length - 1].dia - a.anot[a.anot.length - 1].dia;
    });
    var ultimos = conMias.slice(0, 10).map(function (x) {
      var ult = x.anot[x.anot.length - 1];
      return '- ' + ult.fecha + ' — ' + ficha(x.fila) +
             ' (' + x.anot.length + ' ' + plural(x.anot.length, 'anotación', 'anotaciones') + ')';
    });

    return rep(titulo, unir(
      'Has escrito ' + b(todasMias.length) + ' ' +
        plural(todasMias.length, 'anotación', 'anotaciones') + ' en ' +
        b(conMias.length) + ' ' + plural(conMias.length, unoVarios[0], unoVarios[1]) +
        ' de ' + b(lista.length) + ' que estás viendo.',
      bloque('De un vistazo', [
        '- Este mes: ' + b(esteMes),
        '- Últimos 30 días: ' + b(hace30),
        '- La más reciente: ' + txt(todasMias[0].fecha),
        '- Promedio por expediente: ' +
          b(Math.round(todasMias.length * 10 / conMias.length) / 10)
      ]),
      bloque('Mes a mes', meses),
      bloque('Los 10 que toqué de últimas', ultimos),
      pieFiltro
    ), 'Has escrito ' + num(todasMias.length) + ' anotaciones en ' +
       num(conMias.length) + ' de ' + num(lista.length) + ' expedientes. Este mes, ' +
       num(esteMes) + '.');
  }

  /* Lo que estoy viendo y NO he tocado nunca. */
  function repSinMias(titulo, lista, ficha, unoVarios, pieFiltro) {
    var yo = yoNombre();
    if (!yo) {
      return rep(titulo, 'No logro saber con qué usuario estás dentro.',
                 'No sé con qué usuario estás dentro.');
    }
    var sin = lista.filter(function (r) { return !anotacionesDe(r.bitacora, yo).length; });
    if (!sin.length) {
      return rep(titulo,
        'Tienes anotación tuya en **todos** los ' + unoVarios[1] + ' que estás viendo. Bien ahí.' + pieFiltro,
        'Tienes anotación propia en todos los que estás viendo.');
    }
    var sinNada = sin.filter(function (r) { return !txt(r.bitacora); }).length;
    var deOtros = sin.length - sinNada;
    return rep(titulo, unir(
      'Hay ' + b(sin.length) + ' de ' + b(lista.length) + ' ' + unoVarios[1] +
        ' donde **no** has escrito nada.',
      bloque('Cómo están', [
        '- Con bitácora de otra persona: ' + b(deOtros),
        '- Sin una sola anotación: ' + b(sinNada)
      ]),
      bloque('Los 10 primeros', sin.slice(0, 10).map(function (r) {
        return '- ' + ficha(r);
      })),
      pieFiltro
    ), 'Hay ' + num(sin.length) + ' de ' + num(lista.length) +
       ' donde no has escrito nada; ' + num(sinNada) + ' no tienen ninguna anotación.');
  }

  function yoNombre() { return llano(leer(function () { return currentUser && currentUser.nombre; }, '')); }
  function haySesion() { return !!leer(function () { return currentUser; }, null); }

  /* ============================================================
     CATÁLOGO DE CONSULTAS (el primero de cada lista es la portada)
     ============================================================ */
  var PANELES = {
    'view-lista': {
      titulo: 'Consultas de solicitudes', sub: 'Solicitudes de Predial',
      botones: [
        { id: 'resumen',    et: 'Lo que estoy viendo',     ic: '👀' },
        { id: 'barrio',     et: 'Por barrio',              ic: '🏘️' },
        { id: 'antiguas',   et: 'Las más antiguas',        ic: '⏰' },
        { id: 'mes',        et: 'Por mes',                 ic: '📅' },
        { id: 'semana',     et: 'Día de la semana',        ic: '📆' },
        { id: 'horas',      et: 'Horas pico',              ic: '🕐' },
        { id: 'repetidos',  et: 'Contribuyentes repetidos', ic: '👥' },
        { id: 'piden',      et: 'Qué están pidiendo',      ic: '📝' },
        { id: 'cierre',     et: 'Cómo se cerraron',        ic: '✅' },
        { id: 'tiempo',     et: 'Tiempo de respuesta',     ic: '⚡' },
        { id: 'hoy',        et: 'De hoy y de la semana',   ic: '🗓️' }
      ]
    },
    'view-atenciones': {
      titulo: 'Consultas de atenciones', sub: 'Atenciones registradas',
      botones: [
        { id: 'resumen',   et: 'Lo que estoy viendo', ic: '👀' },
        { id: 'canal',     et: 'Chat vs presencial', ic: '💬' },
        { id: 'barrio',    et: 'Por barrio',         ic: '🏘️' },
        { id: 'mes',       et: 'Por mes',            ic: '📅' },
        { id: 'tiempo',    et: 'Tiempo de respuesta', ic: '⚡' },
        { id: 'horas',     et: 'Horas pico',         ic: '🕐' },
        { id: 'semana',    et: 'Día de la semana',   ic: '📆' },
        { id: 'repetidos', et: 'Repetidos',          ic: '👥' },
        { id: 'piden',     et: 'Qué pidieron',       ic: '📝' },
        { id: 'antiguas',  et: 'Las más antiguas',   ic: '⏰' }
      ]
    },
    'view-estadisticas': {
      titulo: 'Consultas de estadísticas', sub: 'Estadísticas de atención',
      botones: [
        { id: 'resumen',   et: 'Lo que estoy viendo', ic: '👀' },
        { id: 'mes',       et: 'Mes a mes',          ic: '📅' },
        { id: 'tendencia', et: 'Tendencia',          ic: '📈' },
        { id: 'zonastop',  et: 'Zonas que más piden', ic: '🏆' },
        { id: 'zonasfrias',et: 'Zonas dormidas',     ic: '😴' },
        { id: 'canalzona', et: 'Canal por zona',     ic: '💬' },
        { id: 'horas',     et: 'Horas pico',         ic: '🕐' },
        { id: 'semana',    et: 'Día de la semana',   ic: '📆' },
        { id: 'repetidos', et: 'Recurrentes',        ic: '👥' },
        { id: 'tiempo',    et: 'Tiempo de respuesta', ic: '⚡' }
      ]
    },
    'view-panel': {
      titulo: 'Consultas del panel', sub: 'Panel de asignaciones',
      botones: [
        { id: 'resumen',   et: 'Lo que estoy viendo', ic: '👀' },
        { id: 'estado',    et: 'Por estado',         ic: '🚦' },
        { id: 'equipo',    et: 'Carga del equipo',   ic: '👥' },
        { id: 'vence',     et: 'Vencidas y por vencer', ic: '⏰' },
        { id: 'categoria', et: 'Por categoría',      ic: '🗂️' },
        { id: 'subcat',    et: 'Por subcategoría',   ic: '🧩' },
        { id: 'etapa',     et: 'Etapa jurídica',     ic: '⚖️' },
        { id: 'medio',     et: 'Por medio',          ic: '📮' },
        { id: 'cierre',    et: 'Cierres y tiempos',  ic: '✅' },
        { id: 'evidencia', et: 'Sin evidencia',      ic: '📎' },
        { id: 'rebote',    et: 'Rebotadas',          ic: '🔁' },
        { id: 'mes',       et: 'Por mes',            ic: '📅' }
      ]
    },
    'view-asignaciones': {
      titulo: 'Consultas de asignaciones', sub: 'Mi semáforo',
      botones: [
        { id: 'resumen',   et: 'Lo que estoy viendo', ic: '👀' },
        { id: 'vence',     et: 'Vencidas y por vencer', ic: '⏰' },
        { id: 'equipo',    et: 'Por asignado',       ic: '👥' },
        { id: 'estado',    et: 'Por estado',         ic: '🚦' },
        { id: 'categoria', et: 'Por categoría',      ic: '🗂️' },
        { id: 'etapa',     et: 'Etapa jurídica',     ic: '⚖️' },
        { id: 'evidencia', et: 'Sin evidencia',      ic: '📎' },
        { id: 'mias',      et: 'Las mías',           ic: '🙋' },
        { id: 'misbit',    et: 'Mis bitácoras',      ic: '🗒️' },
        { id: 'bitfrias',  et: 'Sin anotación mía',  ic: '🥶' },
        { id: 'medio',     et: 'Por medio',          ic: '📮' },
        { id: 'expediente',et: 'Expediente interno', ic: '🗃️' },
        { id: 'mes',       et: 'Por mes',            ic: '📅' },
        { id: 'cierre',    et: 'Cierres y tiempos',  ic: '✅' }
      ]
    },
    'view-bd-predial': {
      titulo: 'Consultas de la BD Predial', sub: 'Base de datos predial',
      botones: [
        { id: 'resumen',   et: 'Lo que estoy viendo', ic: '👀' },
        { id: 'clasif',    et: 'Cartera por clasificación', ic: '💰' },
        { id: 'actuacion', et: 'Por actuación',      ic: '⚖️' },
        { id: 'equipo',    et: 'Por sustanciador',   ic: '👥' },
        { id: 'estado',    et: 'Por estado del proceso', ic: '🚦' },
        { id: 'seguimiento', et: 'Seguimientos',     ic: '⏰' },
        { id: 'misseg',    et: 'Mis seguimientos',   ic: '📌' },
        { id: 'top',       et: 'Mayores deudas',     ic: '🏆' },
        { id: 'antiguedad',et: 'Antigüedad de la deuda', ic: '🕰️' },
        { id: 'expfisico', et: 'Sin expediente físico', ic: '📁' },
        { id: 'archivo',   et: 'Sin archivar en Drive', ic: '🗄️' },
        { id: 'correo',    et: 'Sin correo',         ic: '📧' },
        { id: 'aldia',     et: 'Al día y sin deuda', ic: '🟢' },
        { id: 'mias',      et: 'Las mías',           ic: '🙋' },
        { id: 'misbit',    et: 'Mis bitácoras',      ic: '🗒️' },
        { id: 'bitfrias',  et: 'Sin anotación mía',  ic: '🥶' }
      ]
    },
    'view-bdp-panel': {
      titulo: 'Consultas del panel predial', sub: 'Panel de la BD Predial',
      botones: [
        { id: 'resumen',   et: 'Lo que estoy viendo', ic: '👀' },
        { id: 'concentra', et: 'Concentración de la deuda', ic: '🎯' },
        { id: 'clasif',    et: 'Por clasificación',  ic: '📊' },
        { id: 'actuacion', et: 'Actuaciones',        ic: '⚖️' },
        { id: 'equipo',    et: 'Carga por sustanciador', ic: '👥' },
        { id: 'estado',    et: 'Estado del proceso', ic: '🚦' },
        { id: 'alta',      et: 'Alta prioridad',     ic: '🚨' },
        { id: 'antiguedad',et: 'Antigüedad de la deuda', ic: '🕰️' },
        { id: 'asistente', et: 'Asistentes',         ic: '🧑‍💼' },
        { id: 'expfisico', et: 'Sin expediente físico', ic: '📁' },
        { id: 'correo',    et: 'Sin correo',         ic: '📧' },
        { id: 'top',       et: 'Mayores deudas',     ic: '🏆' }
      ]
    },
    'view-drive-anexos': {
      titulo: 'Consultas de Drive Anexos', sub: 'Carpetas de anexos',
      botones: [
        { id: 'resumen',   et: 'Lo que estoy viendo', ic: '👀' },
        { id: 'sincarpeta',et: 'Sin carpeta',        ic: '📁' },
        { id: 'sincorreo', et: 'Sin correo',         ic: '📧' },
        { id: 'dominio',   et: 'Por dominio',        ic: '🌐' },
        { id: 'repetidos', et: 'Correos repetidos',  ic: '♻️' },
        { id: 'listado',   et: 'Listado completo',   ic: '📋' }
      ]
    }
  };

  /* Un informe = una función pura sobre la lista de la vista. */
  function informe(vista, id) {
    switch (vista) {
      case 'view-lista':        return repSol(id, solicitudes(), modoLista());
      case 'view-atenciones':   return repAtn(id, atenciones());
      case 'view-estadisticas': return repEst(id, estad());
      case 'view-panel':        return repProc(id, panelProc(), 'panel');
      case 'view-asignaciones': return repProc(id, procFiltrado(), 'lista');
      case 'view-bd-predial':   return repPred(id, bdpFiltrado(), 'lista');
      case 'view-bdp-panel':    return repPred(id, bdpp(), 'panel');
      case 'view-drive-anexos': return repDrive(id, drive());
    }
    return rep('', 'No conozco esa consulta.', '');
  }

  /* ============================================================
     PIEZAS COMPARTIDAS POR LAS VISTAS DE SOLICITUDES
     (lista, atenciones y estadísticas leen la misma hoja)
     ============================================================ */
  function lineasMes(lista, campo) {
    var m = conteo(lista, function (r) {
      var d = fecha(r[campo || 'fecha']);
      return d ? claveMes(d) : 'SIN FECHA';
    });
    var claves = Object.keys(m).sort();
    var out = [];
    for (var i = 0; i < claves.length; i++) {
      var k = claves[i];
      out.push('- ' + (k === 'SIN FECHA' ? 'Sin fecha' : mesTxt(k)) + ' — ' + b(m[k]));
    }
    return out;
  }
  function lineasHoras(lista, campo) {
    var conHora = lista.filter(function (r) { return tieneHora(r[campo || 'fecha']); });
    if (!conHora.length) return null;
    var m = conteo(conHora, function (r) {
      var d = fecha(r[campo || 'fecha']);
      return d ? ('0' + d.getHours()).slice(-2) + ':00' : null;
    });
    var claves = Object.keys(m).sort();
    var out = [];
    for (var i = 0; i < claves.length; i++) out.push('- ' + claves[i] + ' — ' + b(m[claves[i]]));
    return { lineas: out, total: conHora.length, mapa: m };
  }
  function lineasSemana(lista, campo) {
    var m = conteo(lista, function (r) {
      var d = fecha(r[campo || 'fecha']);
      return d ? String(d.getDay()) : null;
    });
    var out = [], total = 0, i;
    for (i = 1; i <= 6; i++) if (m[String(i)]) total += m[String(i)];
    if (m['0']) total += m['0'];
    for (i = 1; i <= 6; i++) {
      if (!m[String(i)]) continue;
      out.push('- ' + DIAS[i].charAt(0).toUpperCase() + DIAS[i].slice(1) + ' — ' + b(m[String(i)]) + ' (' + pct(m[String(i)], total) + ' %)');
    }
    if (m['0']) out.push('- Domingo — ' + b(m['0']) + ' (' + pct(m['0'], total) + ' %)');
    return { lineas: out, mapa: m, total: total };
  }
  function repetidosDoc(lista) {
    var m = {};
    for (var i = 0; i < lista.length; i++) {
      var d = txt(lista[i].documento);
      if (!d) continue;
      if (!m[d]) m[d] = { n: 0, nombre: txt(lista[i].nombre), tel: txt(lista[i].whatsapp) };
      m[d].n++;
    }
    var pares = Object.keys(m).map(function (k) { return m[k]; })
      .filter(function (v) { return v.n > 1; })
      .sort(function (a, bb) { return bb.n - a.n; });
    return pares;
  }
  function tiempos(lista) {
    var con = [], mismo = 0, sumaDias = 0, tarde = 0;
    for (var i = 0; i < lista.length; i++) {
      var a = fecha(lista[i].fecha), z = fecha(lista[i].respondida);
      if (!a || !z) continue;
      var d = diasEntre(a, z);
      if (d == null || d < 0) continue;
      con.push(d); sumaDias += d;
      if (d === 0) mismo++;
      if (d > 3) tarde++;
    }
    return {
      n: con.length, sinDato: lista.length - con.length,
      prom: con.length ? (sumaDias / con.length) : 0,
      mismo: mismo, tarde: tarde,
      max: con.length ? Math.max.apply(null, con) : 0
    };
  }
  function normPide(t) {
    var s = llano(t).replace(/[.,;:!¡?¿]/g, ' ').replace(/\s+/g, ' ').trim();
    if (!s || s === 'N/A' || s === 'NA') return 'SIN TEXTO (ATENCIÓN PRESENCIAL)';
    return s;
  }
  function masViejas(lista, tope) {
    var con = lista.map(function (r) { return { r: r, d: antiguedad(r.fecha) }; })
      .filter(function (x) { return x.d != null; })
      .sort(function (a, bb) { return bb.d - a.d; });
    return con.slice(0, tope || 10);
  }

  /* ============================================================
     1) SOLICITUDES DE PREDIAL  (view-lista)
     ============================================================ */
  function repSol(id, lista, modo) {
    var titulo = tituloDe('view-lista', id) + ' · ' + modo;
    if (!lista.length) return vacio(titulo, 'solicitudes');
    var n = lista.length;
    var base = leer(function () { return __listCache; }, []) || [];
    var filtro = valor('lista-filter');
    var pieFiltro = filtro ? '\n\n_Estás viendo ' + num(n) + ' de ' + num(base.length) + ' porque buscaste "' + filtro + '".' : '';

    switch (id) {
      case 'resumen': {
        var barrios = conteo(lista, 'barrio');
        var docs = repetidosDoc(lista);
        var v = masViejas(lista, 1);
        var t = tiempos(lista);
        var texto = unir(
          'Tienes ' + b(n) + ' ' + plural(n, 'solicitud', 'solicitudes') + ' de tipo **' + modo + '** en pantalla.',
          bloque('De un vistazo', [
            '- Barrios distintos: ' + b(cuantos(barrios)),
            '- Contribuyentes distintos: ' + b(cuantos(conteo(lista, 'documento'))),
            '- Con más de una solicitud: ' + b(docs.length),
            v.length ? '- La más antigua lleva ' + b(v[0].d) + ' ' + plural(v[0].d, 'día', 'días') : null,
            t.n ? '- Respondidas: ' + b(t.n) + ' (' + pct(t.n, n) + ' %), en promedio a los ' + b(Math.round(t.prom * 10) / 10) + ' días' : null
          ].filter(Boolean)),
          bloque('Los barrios que más pesan', top(barrios, 5, n))
        );
        return rep(titulo, texto + pieFiltro,
          'Tienes ' + num(n) + ' solicitudes de tipo ' + modo + ' en pantalla, de ' + cuantos(barrios) +
          ' barrios y ' + cuantos(conteo(lista, 'documento')) + ' contribuyentes distintos.');
      }
      case 'barrio': {
        var m = conteo(lista, 'barrio');
        var g = mayor(m);
        return rep(titulo, unir(
          'Las ' + b(n) + ' solicitudes en pantalla vienen de ' + b(cuantos(m)) + ' ' + plural(cuantos(m), 'barrio', 'barrios') + '.',
          bloque('Reparto por barrio', top(m, 15, n))
        ) + pieFiltro,
          'Las ' + num(n) + ' solicitudes vienen de ' + cuantos(m) + ' barrios. El que más pesa es ' +
          (g ? g[0] + ', con ' + num(g[1]) + ', el ' + pct(g[1], n) + ' por ciento' : 'ninguno') + '.');
      }
      case 'antiguas': {
        var v2 = masViejas(lista, 10);
        if (!v2.length) return rep(titulo, 'Ninguna de las solicitudes en pantalla trae una fecha que se pueda leer.', 'Ninguna solicitud trae fecha legible.');
        var mas30 = lista.filter(function (r) { var d = antiguedad(r.fecha); return d != null && d > 30; }).length;
        var mas7  = lista.filter(function (r) { var d = antiguedad(r.fecha); return d != null && d > 7; }).length;
        var lineas = v2.map(function (x) {
          return '- ' + txt(x.r.nombre) + ' — ' + b(x.d) + ' ' + plural(x.d, 'día', 'días') + ' (' + txt(x.r.fecha) + ')';
        });
        return rep(titulo, unir(
          'De las ' + b(n) + ' en pantalla, ' + b(mas7) + ' llevan más de una semana y ' + b(mas30) + ' más de un mes.',
          bloque('Las 10 más antiguas', lineas),
          'Debajo tienes el botón de WhatsApp de cada una.'
        ) + pieFiltro,
          'De ' + num(n) + ' solicitudes, ' + num(mas7) + ' llevan más de una semana y ' + num(mas30) + ' más de un mes.',
          personas(v2.map(function (x) { return x.r; }), 10));
      }
      case 'mes': {
        var lm = lineasMes(lista);
        return rep(titulo, unir('Reparto por mes de las ' + b(n) + ' solicitudes en pantalla.', bloque('Mes a mes', lm)) + pieFiltro,
          'Las ' + num(n) + ' solicitudes se reparten en ' + lm.length + ' meses.');
      }
      case 'semana': {
        var ls = lineasSemana(lista);
        if (!ls.lineas.length) return rep(titulo, 'Ninguna solicitud trae una fecha legible.', 'Sin fechas legibles.');
        var pico = mayor(ls.mapa);
        return rep(titulo, unir('Qué días de la semana llega la gente.', bloque('Por día', ls.lineas)) + pieFiltro,
          'El día de más movimiento es el ' + DIAS[+pico[0]] + ', con ' + num(pico[1]) + ' solicitudes.');
      }
      case 'horas': {
        var lh = lineasHoras(lista);
        if (!lh) return rep(titulo, 'Las solicitudes en pantalla no traen hora, solo fecha, así que no se puede sacar la hora pico.', 'Las solicitudes no traen hora.');
        var p = mayor(lh.mapa);
        return rep(titulo, unir(
          'De las ' + b(n) + ' en pantalla, ' + b(lh.total) + ' traen hora.',
          bloque('Por hora del día', lh.lineas),
          'La hora más cargada es la de las **' + p[0] + '**.'
        ) + pieFiltro, 'La hora más cargada es la de las ' + p[0] + ', con ' + num(p[1]) + ' solicitudes.');
      }
      case 'repetidos': {
        var r2 = repetidosDoc(lista);
        if (!r2.length) return rep(titulo, 'Ningún contribuyente aparece dos veces en lo que estás viendo.', 'Ningún contribuyente se repite.');
        var suman = r2.reduce(function (a, x) { return a + x.n; }, 0);
        var lin = r2.slice(0, 12).map(function (x) { return '- ' + x.nombre + ' — ' + b(x.n) + ' solicitudes'; });
        return rep(titulo, unir(
          b(r2.length) + ' ' + plural(r2.length, 'contribuyente ha pedido', 'contribuyentes han pedido') + ' más de una vez, y entre todos suman ' + b(suman) + ' solicitudes (' + pct(suman, n) + ' % de lo que ves).',
          bloque('Quiénes repiten', lin)
        ) + pieFiltro,
          num(r2.length) + ' contribuyentes han pedido más de una vez y suman ' + num(suman) + ' solicitudes, el ' + pct(suman, n) + ' por ciento.',
          r2.slice(0, 12).map(function (x) { return { nombre: x.nombre, contacto: x.tel }; }));
      }
      case 'piden': {
        var m3 = conteo(lista, function (r) { return normPide(r.solicitud); });
        return rep(titulo, unir(
          'Qué pidieron las ' + b(n) + ' solicitudes en pantalla, agrupando textos iguales.',
          bloque('Lo que piden', top(m3, 10, n))
        ) + pieFiltro, 'Hay ' + cuantos(m3) + ' textos de solicitud distintos entre las ' + num(n) + ' de pantalla.');
      }
      case 'cierre': {
        var m4 = conteo(lista, function (r) {
          var o = llano(r.observacion);
          if (!o || o === 'N/A') return 'SIN OBSERVACIÓN';
          return o;
        });
        return rep(titulo, unir(
          'Con qué observación quedaron cerradas las ' + b(n) + ' solicitudes en pantalla.',
          bloque('Observación de cierre', top(m4, 10, n))
        ) + pieFiltro, 'Hay ' + cuantos(m4) + ' formas de cierre distintas entre las ' + num(n) + ' solicitudes.');
      }
      case 'tiempo': {
        var t2 = tiempos(lista);
        if (!t2.n) return rep(titulo, 'Ninguna de las solicitudes en pantalla tiene fecha de respuesta, así que no hay tiempo que medir.\nLas PENDIENTES todavía no se han respondido.', 'Ninguna solicitud tiene fecha de respuesta.');
        return rep(titulo, unir(
          'De las ' + b(n) + ' en pantalla, ' + b(t2.n) + ' tienen fecha de respuesta.',
          bloque('Cuánto se demoran', [
            '- Promedio: ' + b(Math.round(t2.prom * 10) / 10) + ' días',
            '- Respondidas el mismo día: ' + b(t2.mismo) + ' (' + pct(t2.mismo, t2.n) + ' %)',
            '- Con más de 3 días: ' + b(t2.tarde) + ' (' + pct(t2.tarde, t2.n) + ' %)',
            '- La que más tardó: ' + b(t2.max) + ' días',
            t2.sinDato ? '- Sin fecha de respuesta: ' + b(t2.sinDato) : null
          ].filter(Boolean))
        ) + pieFiltro,
          'De ' + num(n) + ' solicitudes, ' + num(t2.n) + ' están respondidas, en promedio a los ' +
          (Math.round(t2.prom * 10) / 10) + ' días, y ' + pct(t2.mismo, t2.n) + ' por ciento el mismo día.');
      }
      case 'hoy': {
        var h = hoy(), dh = 0, ds = 0, dm = 0;
        for (var i = 0; i < lista.length; i++) {
          var d = fecha(lista[i].fecha); if (!d) continue;
          var dif = diasEntre(d, h);
          if (dif === 0) dh++;
          if (dif != null && dif >= 0 && dif < 7) ds++;
          if (d.getMonth() === h.getMonth() && d.getFullYear() === h.getFullYear()) dm++;
        }
        return rep(titulo, unir(
          'Movimiento reciente de lo que tienes en pantalla.',
          bloque('Últimos días', [
            '- Hoy: ' + b(dh),
            '- Últimos 7 días: ' + b(ds),
            '- Este mes: ' + b(dm) + ' (' + pct(dm, n) + ' % de lo que ves)'
          ])
        ) + pieFiltro,
          'Hoy entraron ' + num(dh) + ', en los últimos siete días ' + num(ds) + ' y en el mes ' + num(dm) + '.');
      }
    }
    return rep(titulo, 'No conozco esa consulta.', '');
  }

  /* Título bonito del informe = el mismo texto del botón. */
  function tituloDe(vista, id) {
    var p = PANELES[vista];
    if (!p) return '';
    for (var i = 0; i < p.botones.length; i++) {
      if (p.botones[i].id === id) return p.botones[i].ic + ' ' + p.botones[i].et;
    }
    return '';
  }

  /* ============================================================
     2) ATENCIONES REGISTRADAS  (view-atenciones)
     ============================================================ */
  function repAtn(id, lista) {
    var tab = atencTab();
    var comoSeLlama = tab === 'chat' ? 'ATENDIDAS POR CHAT' : 'ATENDIDAS PRESENCIALES';
    var titulo = tituloDe('view-atenciones', id) + ' · ' + comoSeLlama;
    if (!lista.length && id !== 'canal') return vacio(titulo, 'atenciones');
    var n = lista.length;
    var filtro = valor('atenc-filter');
    var pieFiltro = filtro ? '\n\n_Estás viendo ' + num(n) + ' porque buscaste "' + filtro + '".' : '';

    switch (id) {
      case 'resumen': {
        var barrios = conteo(lista, 'barrio');
        var t = tiempos(lista);
        var v = masViejas(lista, 1);
        return rep(titulo, unir(
          'Estás viendo ' + b(n) + ' ' + plural(n, 'atención', 'atenciones') + ' **' + comoSeLlama + '**.',
          bloque('De un vistazo', [
            '- Barrios distintos: ' + b(cuantos(barrios)),
            '- Contribuyentes distintos: ' + b(cuantos(conteo(lista, 'documento'))),
            '- Con fecha de respuesta: ' + b(t.n) + (t.n ? ' (promedio ' + b(Math.round(t.prom * 10) / 10) + ' días)' : ''),
            v.length ? '- La más antigua es de hace ' + b(v[0].d) + ' ' + plural(v[0].d, 'día', 'días') : null
          ].filter(Boolean)),
          bloque('Barrios que más aparecen', top(barrios, 5, n))
        ) + pieFiltro,
          'Estás viendo ' + num(n) + ' atenciones ' + (tab === 'chat' ? 'por chat' : 'presenciales') +
          ', de ' + cuantos(barrios) + ' barrios.');
      }
      case 'canal': {
        var c = atencChat().length, p = atencPres().length, tot = c + p;
        if (!tot) return vacio(titulo, 'atenciones');
        return rep(titulo, unir(
          'Comparación de los dos canales, con TODAS las atenciones cargadas (no solo la pestaña que estás viendo).',
          bloque('Canales', [
            '- Chat: ' + b(c) + ' (' + pct(c, tot) + ' %)',
            '- Presencial: ' + b(p) + ' (' + pct(p, tot) + ' %)',
            '- Total: ' + b(tot)
          ]),
          c > p ? 'Manda el **chat**: por cada atención presencial hay **' + (Math.round(c / Math.max(p, 1) * 10) / 10) + '** por chat.'
                : 'Manda lo **presencial**: por cada atención por chat hay **' + (Math.round(p / Math.max(c, 1) * 10) / 10) + '** presenciales.'
        ),
          'De ' + num(tot) + ' atenciones, ' + num(c) + ' fueron por chat, el ' + pct(c, tot) +
          ' por ciento, y ' + num(p) + ' presenciales.');
      }
      case 'barrio': {
        var m = conteo(lista, 'barrio');
        var g = mayor(m);
        return rep(titulo, unir(
          'Las ' + b(n) + ' atenciones en pantalla vienen de ' + b(cuantos(m)) + ' barrios.',
          bloque('Reparto por barrio', top(m, 15, n))
        ) + pieFiltro,
          'Las atenciones vienen de ' + cuantos(m) + ' barrios y el que más pesa es ' + (g ? g[0] : '') + '.');
      }
      case 'mes': {
        var lm = lineasMes(lista);
        return rep(titulo, unir('Cuándo se atendieron las ' + b(n) + ' de pantalla.', bloque('Mes a mes', lm)) + pieFiltro,
          'Las ' + num(n) + ' atenciones se reparten en ' + lm.length + ' meses.');
      }
      case 'tiempo': {
        var t2 = tiempos(lista);
        if (!t2.n) return rep(titulo, 'Ninguna de las atenciones en pantalla trae fecha de respuesta.', 'Sin fechas de respuesta.');
        return rep(titulo, unir(
          'De las ' + b(n) + ' en pantalla, ' + b(t2.n) + ' tienen fecha de respuesta.',
          bloque('Cuánto se demoró la respuesta', [
            '- Promedio: ' + b(Math.round(t2.prom * 10) / 10) + ' días',
            '- El mismo día: ' + b(t2.mismo) + ' (' + pct(t2.mismo, t2.n) + ' %)',
            '- Con más de 3 días: ' + b(t2.tarde) + ' (' + pct(t2.tarde, t2.n) + ' %)',
            '- La que más tardó: ' + b(t2.max) + ' días'
          ])
        ) + pieFiltro,
          'El promedio de respuesta es de ' + (Math.round(t2.prom * 10) / 10) + ' días y el ' +
          pct(t2.mismo, t2.n) + ' por ciento se respondió el mismo día.');
      }
      case 'horas': {
        var lh = lineasHoras(lista);
        if (!lh) return rep(titulo, 'Las atenciones en pantalla no traen hora, solo fecha.', 'Las atenciones no traen hora.');
        var p2 = mayor(lh.mapa);
        return rep(titulo, unir(
          b(lh.total) + ' de las ' + b(n) + ' traen hora.',
          bloque('Por hora del día', lh.lineas),
          'La hora más cargada es la de las **' + p2[0] + '**.'
        ) + pieFiltro, 'La hora más cargada es la de las ' + p2[0] + '.');
      }
      case 'semana': {
        var ls = lineasSemana(lista);
        if (!ls.lineas.length) return rep(titulo, 'Ninguna atención trae fecha legible.', 'Sin fechas legibles.');
        var pico = mayor(ls.mapa);
        return rep(titulo, unir('Qué días se atiende más.', bloque('Por día', ls.lineas)) + pieFiltro,
          'El día de más atención es el ' + DIAS[+pico[0]] + '.');
      }
      case 'repetidos': {
        var r2 = repetidosDoc(lista);
        if (!r2.length) return rep(titulo, 'Nadie aparece dos veces en lo que estás viendo.', 'Nadie se repite.');
        var suman = r2.reduce(function (a, x) { return a + x.n; }, 0);
        return rep(titulo, unir(
          b(r2.length) + ' ' + plural(r2.length, 'contribuyente ha vuelto', 'contribuyentes han vuelto') + ', y suman ' + b(suman) + ' atenciones (' + pct(suman, n) + ' %).',
          bloque('Quiénes vuelven', r2.slice(0, 12).map(function (x) { return '- ' + x.nombre + ' — ' + b(x.n) + ' veces'; }))
        ) + pieFiltro,
          num(r2.length) + ' contribuyentes han vuelto y suman ' + num(suman) + ' atenciones.');
      }
      case 'piden': {
        var m3 = conteo(lista, function (r) { return normPide(r.solicitud); });
        return rep(titulo, unir(
          'Qué pidieron las ' + b(n) + ' atenciones en pantalla.',
          bloque('Lo que pidieron', top(m3, 10, n))
        ) + pieFiltro, 'Hay ' + cuantos(m3) + ' textos distintos entre las ' + num(n) + ' atenciones.');
      }
      case 'antiguas': {
        var v2 = masViejas(lista, 10);
        if (!v2.length) return rep(titulo, 'Ninguna trae una fecha que se pueda leer.', 'Sin fechas legibles.');
        return rep(titulo, unir(
          'Las atenciones más viejas que tienes en pantalla.',
          bloque('Las 10 más antiguas', v2.map(function (x) {
            return '- ' + txt(x.r.nombre) + ' — hace ' + b(x.d) + ' ' + plural(x.d, 'día', 'días') + ' (' + txt(x.r.fecha) + ')';
          }))
        ) + pieFiltro, 'La más antigua es de hace ' + num(v2[0].d) + ' días.');
      }
    }
    return rep(titulo, 'No conozco esa consulta.', '');
  }

  /* ============================================================
     3) ESTADÍSTICAS  (view-estadisticas)
     La vista junta ATENDIDA CHAT y ATENDIDA PRESENCIAL y agrupa los
     barrios con normalizeZona_ (quita el "I", "II" del final), así
     que los informes agrupan igual: informe y gráfico no pueden
     discrepar.
     ============================================================ */
  function zona(r) {
    try { if (typeof normalizeZona_ === 'function') return normalizeZona_(r.barrio) || 'SIN DATO'; } catch (e) {}
    return etiq(r.barrio);
  }
  function esChat(r) { return llano(r.estado) === 'ATENDIDA CHAT'; }

  function repEst(id, lista) {
    var titulo = tituloDe('view-estadisticas', id);
    if (!lista.length) return vacio(titulo, 'atenciones');
    var n = lista.length;
    var chat = lista.filter(esChat).length;
    var pres = n - chat;
    var anio = new Date().getFullYear();
    var deAnio = lista.filter(function (r) { var d = fecha(r.fecha); return d && d.getFullYear() === anio; });

    switch (id) {
      case 'resumen': {
        var z = conteo(lista, zona);
        var lm = lineasMes(deAnio);
        return rep(titulo, unir(
          'La vista tiene cargadas ' + b(n) + ' atenciones en total, de las cuales ' + b(deAnio.length) + ' son de **' + anio + '**.',
          bloque('Cómo se atendió', [
            '- Chat: ' + b(chat) + ' (' + pct(chat, n) + ' %)',
            '- Presencial: ' + b(pres) + ' (' + pct(pres, n) + ' %)'
          ]),
          bloque('Territorio', [
            '- Zonas distintas: ' + b(cuantos(z)),
            '- Contribuyentes distintos: ' + b(cuantos(conteo(lista, 'documento'))),
            '- Meses con movimiento en ' + anio + ': ' + b(lm.length)
          ]),
          bloque('Las 5 zonas que más piden', top(z, 5, n))
        ),
          'Hay ' + num(n) + ' atenciones cargadas: ' + num(chat) + ' por chat y ' + num(pres) +
          ' presenciales, repartidas en ' + cuantos(z) + ' zonas.');
      }
      case 'mes': {
        var m = {}, i;
        for (i = 0; i < lista.length; i++) {
          var d = fecha(lista[i].fecha); if (!d) continue;
          var k = claveMes(d);
          if (!m[k]) m[k] = { chat: 0, pres: 0 };
          if (esChat(lista[i])) m[k].chat++; else m[k].pres++;
        }
        var claves = Object.keys(m).sort();
        var lin = claves.map(function (k) {
          var v = m[k].chat + m[k].pres;
          return '- ' + mesTxt(k) + ' — ' + b(v) + '  (chat ' + num(m[k].chat) + ' · presencial ' + num(m[k].pres) + ')';
        });
        var mejor = claves.slice().sort(function (a, bb) { return (m[bb].chat + m[bb].pres) - (m[a].chat + m[a].pres); })[0];
        return rep(titulo, unir(
          'Mes a mes, separando los dos canales.',
          bloque('Movimiento por mes', lin),
          mejor ? 'El mes más cargado fue **' + mesTxt(mejor) + '**, con **' + num(m[mejor].chat + m[mejor].pres) + '**.' : null
        ), mejor ? 'El mes más cargado fue ' + mesTxt(mejor) + ', con ' + num(m[mejor].chat + m[mejor].pres) + ' atenciones.' : 'Sin fechas legibles.');
      }
      case 'tendencia': {
        var mm = {}, i2;
        for (i2 = 0; i2 < lista.length; i2++) {
          var d2 = fecha(lista[i2].fecha); if (!d2) continue;
          var k2 = claveMes(d2); mm[k2] = (mm[k2] || 0) + 1;
        }
        var cl = Object.keys(mm).sort();
        if (cl.length < 2) return rep(titulo, 'Todavía no hay meses suficientes para hablar de tendencia.', 'No hay meses suficientes para una tendencia.');
        var ult = mm[cl[cl.length - 1]], ant = mm[cl[cl.length - 2]];
        var dif = ult - ant;
        var prom = Math.round(cl.reduce(function (a, k) { return a + mm[k]; }, 0) / cl.length);
        var alto = cl.slice().sort(function (a, bb) { return mm[bb] - mm[a]; })[0];
        var bajo = cl.slice().sort(function (a, bb) { return mm[a] - mm[bb]; })[0];
        return rep(titulo, unir(
          'Comparando **' + mesTxt(cl[cl.length - 1]) + '** (' + b(ult) + ') con **' + mesTxt(cl[cl.length - 2]) + '** (' + b(ant) + ').',
          bloque('Cómo va', [
            (dif >= 0 ? '- Subió **' + num(dif) + '**' : '- Bajó **' + num(-dif) + '**') +
              (ant ? ' (' + Math.abs(Math.round(dif * 100 / ant)) + ' %)' : ''),
            '- Promedio de los ' + cl.length + ' meses: ' + b(prom),
            '- Mes más alto: **' + mesTxt(alto) + '** con ' + b(mm[alto]),
            '- Mes más bajo: **' + mesTxt(bajo) + '** con ' + b(mm[bajo])
          ])
        ),
          'El último mes ' + (dif >= 0 ? 'subió ' : 'bajó ') + num(Math.abs(dif)) +
          ' atenciones frente al anterior. El promedio mensual es de ' + num(prom) + '.');
      }
      case 'zonastop': {
        var z2 = conteo(lista, zona);
        var pares = orden(z2);
        var diez = pares.slice(0, 10).reduce(function (a, x) { return a + x[1]; }, 0);
        return rep(titulo, unir(
          'Hay ' + b(cuantos(z2)) + ' zonas con movimiento.',
          bloque('Las 15 que más piden', top(z2, 15, n)),
          'Las 10 primeras concentran ' + b(diez) + ' atenciones, el ' + bp(diez, n) + ' del total.'
        ),
          'Las diez zonas que más piden concentran el ' + pct(diez, n) + ' por ciento de las atenciones.');
      }
      case 'zonasfrias': {
        var z3 = conteo(lista, zona);
        var pares3 = orden(z3).filter(function (x) { return x[0] !== 'SIN DATO'; });
        var cola = pares3.slice(-15).reverse();
        var una = pares3.filter(function (x) { return x[1] === 1; }).length;
        return rep(titulo, unir(
          'Zonas con poquísimo movimiento: o no conocen el servicio, o allí no hay problema con el predial.',
          bloque('Las que menos aparecen', cola.map(function (x) { return '- ' + x[0] + ' — ' + b(x[1]); })),
          b(una) + ' ' + plural(una, 'zona aparece', 'zonas aparecen') + ' una sola vez.'
        ), num(una) + ' zonas aparecen una sola vez en todo el histórico cargado.');
      }
      case 'canalzona': {
        var mz = {}, i3;
        for (i3 = 0; i3 < lista.length; i3++) {
          var k3 = zona(lista[i3]);
          if (!mz[k3]) mz[k3] = { chat: 0, pres: 0 };
          if (esChat(lista[i3])) mz[k3].chat++; else mz[k3].pres++;
        }
        var top15 = Object.keys(mz).sort(function (a, bb) {
          return (mz[bb].chat + mz[bb].pres) - (mz[a].chat + mz[a].pres);
        }).slice(0, 12);
        var lin3 = top15.map(function (k) {
          var t = mz[k].chat + mz[k].pres;
          return '- ' + k + ' — chat ' + b(mz[k].chat) + ' · presencial ' + b(mz[k].pres) + ' (' + pct(mz[k].chat, t) + ' % chat)';
        });
        var soloPres = Object.keys(mz).filter(function (k) { return mz[k].chat === 0 && mz[k].pres > 2; });
        return rep(titulo, unir(
          'Por dónde prefiere pedir cada zona.',
          bloque('Las 12 zonas con más movimiento', lin3),
          soloPres.length ? bloque('Zonas que NUNCA usan el chat (y vienen 3 o más veces)', soloPres.slice(0, 10).map(function (k) { return '- ' + k; })) : null
        ),
          'En las zonas con más movimiento, el chat pesa distinto en cada una. Hay ' + soloPres.length +
          ' zonas que nunca han usado el chat.');
      }
      case 'horas': {
        var lh = lineasHoras(lista);
        if (!lh) return rep(titulo, 'Las atenciones cargadas no traen hora.', 'No traen hora.');
        var p4 = mayor(lh.mapa);
        var manana = 0, tarde = 0;
        Object.keys(lh.mapa).forEach(function (k) {
          if (parseInt(k, 10) < 12) manana += lh.mapa[k]; else tarde += lh.mapa[k];
        });
        return rep(titulo, unir(
          b(lh.total) + ' atenciones traen hora.',
          bloque('Por hora del día', lh.lineas),
          bloque('Mañana o tarde', [
            '- Antes de las 12: ' + b(manana) + ' (' + pct(manana, lh.total) + ' %)',
            '- Desde las 12: ' + b(tarde) + ' (' + pct(tarde, lh.total) + ' %)'
          ]),
          'La hora pico es la de las **' + p4[0] + '**.'
        ), 'La hora pico es la de las ' + p4[0] + '. Antes del mediodía se atiende el ' + pct(manana, lh.total) + ' por ciento.');
      }
      case 'semana': {
        var ls = lineasSemana(lista);
        if (!ls.lineas.length) return rep(titulo, 'Sin fechas legibles.', 'Sin fechas legibles.');
        var pico2 = mayor(ls.mapa);
        var flojo = orden(ls.mapa).slice(-1)[0];
        return rep(titulo, unir(
          'Cómo se reparte la semana.',
          bloque('Por día', ls.lineas),
          'El día fuerte es el **' + DIAS[+pico2[0]] + '** y el más flojo el **' + DIAS[+flojo[0]] + '**.'
        ), 'El día fuerte es el ' + DIAS[+pico2[0]] + ' y el más flojo el ' + DIAS[+flojo[0]] + '.');
      }
      case 'repetidos': {
        var r4 = repetidosDoc(lista);
        if (!r4.length) return rep(titulo, 'Nadie repite en el histórico cargado.', 'Nadie repite.');
        var suman4 = r4.reduce(function (a, x) { return a + x.n; }, 0);
        return rep(titulo, unir(
          b(r4.length) + ' contribuyentes han pedido más de una vez y suman ' + b(suman4) + ' atenciones (' + bp(suman4, n) + ').',
          bloque('Los 12 que más vuelven', r4.slice(0, 12).map(function (x) { return '- ' + x.nombre + ' — ' + b(x.n) + ' veces'; }))
        ), num(r4.length) + ' contribuyentes repiten y concentran el ' + pct(suman4, n) + ' por ciento de las atenciones.');
      }
      case 'tiempo': {
        var t5 = tiempos(lista);
        if (!t5.n) return rep(titulo, 'No hay fechas de respuesta para medir.', 'Sin fechas de respuesta.');
        return rep(titulo, unir(
          b(t5.n) + ' de las ' + b(n) + ' atenciones tienen fecha de respuesta.',
          bloque('Cuánto se demora la Secretaría', [
            '- Promedio: ' + b(Math.round(t5.prom * 10) / 10) + ' días',
            '- El mismo día: ' + b(t5.mismo) + ' (' + pct(t5.mismo, t5.n) + ' %)',
            '- Más de 3 días: ' + b(t5.tarde) + ' (' + pct(t5.tarde, t5.n) + ' %)',
            '- La que más tardó: ' + b(t5.max) + ' días'
          ])
        ), 'El promedio de respuesta es de ' + (Math.round(t5.prom * 10) / 10) + ' días.');
      }
    }
    return rep(titulo, 'No conozco esa consulta.', '');
  }

  /* ============================================================
     4 y 5) ASIGNACIONES  (view-panel y view-asignaciones)
     Los dos leen filas de PROCESOS. El panel lee TODAS las del
     usuario; la vista de tarjetas lee lo que dejaron los filtros.
     Los días hábiles, el semáforo y el grupo de vencimiento se
     piden a app.js (diasHabiles_, panelSemaforoDistrib_,
     procGrupoVence_): así el informe no puede decir algo distinto
     de lo que pinta la tarjeta.
     ============================================================ */
  function finalizado(r) { return llano(r.estado) === 'FINALIZADO'; }
  function activos(lista) { return lista.filter(function (r) { return !finalizado(r); }); }
  function grupoVence(r) {
    try { if (typeof procGrupoVence_ === 'function') return procGrupoVence_(r); } catch (e) {}
    return '';
  }
  function faltanDias(r) {
    try {
      if (typeof diasHabiles_ === 'function' && typeof formatDDMMYYYY_ === 'function') {
        return diasHabiles_(formatDDMMYYYY_(new Date()), r.respuesta);
      }
    } catch (e) {}
    return null;
  }
  function diasCierre(r) {
    try { if (typeof diasHabiles_ === 'function') return Math.abs(diasHabiles_(r.recibido, r.cierre)); } catch (e) {}
    return null;
  }
  function semaforo(lista) {
    try { if (typeof panelSemaforoDistrib_ === 'function') return panelSemaforoDistrib_(lista); } catch (e) {}
    return null;
  }

  function repProc(id, lista, donde) {
    var titulo = tituloDe(donde === 'panel' ? 'view-panel' : 'view-asignaciones', id);
    if (!lista.length) return vacio(titulo, 'asignaciones');
    var n = lista.length;
    var act = activos(lista);
    var fin = n - act.length;
    var todos = donde === 'panel' ? lista : procTodos();
    var pieFiltro = (donde === 'lista' && todos.length && todos.length !== n)
      ? '\n\n_Estás viendo ' + num(n) + ' de ' + num(todos.length) + ' por los filtros que tienes puestos.' : '';

    switch (id) {
      case 'resumen': {
        var s = semaforo(lista);
        var venc = act.filter(function (r) { return grupoVence(r) === 'VENCIDOS'; }).length;
        var lineas = [
          '- Activas (sin finalizar): ' + b(act.length) + ' (' + pct(act.length, n) + ' %)',
          '- Finalizadas: ' + b(fin) + ' (' + pct(fin, n) + ' %)',
          '- Vencidas: ' + b(venc),
          '- Personas con carga: ' + b(cuantos(conteo(act, 'asignado')))
        ];
        var semLin = s ? [
          '- 🟢 A tiempo: ' + b(s.verde),
          '- 🟡 Mitad de plazo: ' + b(s.naranja),
          '- 🟠 Quedan 3 días o menos: ' + b(s['rojo-claro']),
          '- 🔴 Vencidas: ' + b(s.rojo),
          '- ⚪ Finalizadas: ' + b(s.gris)
        ] : null;
        return rep(titulo, unir(
          (donde === 'panel' ? 'El panel está mirando ' : 'Estás viendo ') + b(n) + ' ' + plural(n, 'asignación', 'asignaciones') + '.',
          bloque('De un vistazo', lineas),
          semLin ? bloque('Semáforo', semLin) : null,
          venc ? '⚠️ Hay **' + num(venc) + '** ' + plural(venc, 'asignación vencida', 'asignaciones vencidas') + ' esperando.' : '✅ Ninguna asignación está vencida.'
        ) + pieFiltro,
          'Hay ' + num(n) + ' asignaciones: ' + num(act.length) + ' activas, ' + num(fin) + ' finalizadas y ' + num(venc) + ' vencidas.');
      }
      case 'estado': {
        var m = conteo(lista, 'estado');
        var g = mayor(m);
        return rep(titulo, unir(
          'Reparto de las ' + b(n) + ' asignaciones por estado.',
          bloque('Estados', top(m, 12, n))
        ) + pieFiltro,
          'El estado más común es ' + (g ? g[0] + ', con ' + num(g[1]) + ', el ' + pct(g[1], n) + ' por ciento' : 'ninguno') + '.');
      }
      case 'equipo': {
        var byA = {};
        lista.forEach(function (r) {
          var k = etiq(r.asignado) === 'SIN DATO' ? 'SIN ASIGNAR' : etiq(r.asignado);
          if (!byA[k]) byA[k] = { total: 0, act: 0, venc: 0, fin: 0 };
          byA[k].total++;
          if (finalizado(r)) byA[k].fin++;
          else {
            byA[k].act++;
            if (grupoVence(r) === 'VENCIDOS') byA[k].venc++;
          }
        });
        var claves = Object.keys(byA).sort(function (a, bb) { return byA[bb].act - byA[a].act || byA[bb].total - byA[a].total; });
        var lin = claves.map(function (k) {
          var v = byA[k];
          return '- ' + k + ' — activas ' + b(v.act) + ' · vencidas ' + b(v.venc) + ' · finalizadas ' + b(v.fin) + ' (total ' + num(v.total) + ')';
        });
        var conVenc = claves.filter(function (k) { return byA[k].venc > 0; });
        return rep(titulo, unir(
          'Cómo está repartida la carga entre ' + b(claves.length) + ' ' + plural(claves.length, 'persona', 'personas') + '.',
          bloque('Carga por persona', lin),
          conVenc.length ? '⚠️ Con vencidas: **' + conVenc.join('**, **') + '**.' : '✅ Nadie tiene asignaciones vencidas.'
        ) + pieFiltro,
          'La carga está repartida entre ' + claves.length + ' personas. ' +
          (conVenc.length ? conVenc.length + ' tienen asignaciones vencidas.' : 'Nadie tiene vencidas.'));
      }
      case 'vence': {
        var g2 = { VENCIDOS: 0, HOY: 0, PRONTO: 0, LEJOS: 0, SIN: 0 };
        act.forEach(function (r) {
          var k = grupoVence(r);
          if (g2[k] === undefined) g2.SIN++; else g2[k]++;
        });
        var lista2 = act.filter(function (r) { return grupoVence(r) === 'VENCIDOS'; })
          .map(function (r) { return { r: r, d: faltanDias(r) }; })
          .sort(function (a, bb) { return (a.d || 0) - (bb.d || 0); })
          .slice(0, 10);
        return rep(titulo, unir(
          'De las ' + b(act.length) + ' asignaciones activas:',
          bloque('Vencimientos', [
            '- 🔴 Vencidas: ' + b(g2.VENCIDOS),
            '- 🟠 Vencen hoy: ' + b(g2.HOY),
            '- 🟡 En 3 días o menos: ' + b(g2.PRONTO),
            '- 🟢 Con más de 3 días: ' + b(g2.LEJOS),
            g2.SIN ? '- ⚪ Sin fecha de respuesta: ' + b(g2.SIN) : null
          ].filter(Boolean)),
          lista2.length ? bloque('Las vencidas que más pesan', lista2.map(function (x) {
            return '- ' + txt(x.r.consecutivo || x.r.id_proceso) + ' — ' + txt(x.r.asignado) + ' (vencía el ' + txt(x.r.respuesta) + ')';
          })) : null
        ) + pieFiltro,
          'De ' + num(act.length) + ' activas, ' + num(g2.VENCIDOS) + ' están vencidas, ' + num(g2.HOY) +
          ' vencen hoy y ' + num(g2.PRONTO) + ' en tres días o menos.');
      }
      case 'categoria': {
        var m3 = conteo(lista, 'categoria');
        var act3 = conteo(act, 'categoria');
        var lin3 = orden(m3).map(function (x) {
          return '- ' + x[0] + ' — ' + b(x[1]) + ' (' + pct(x[1], n) + ' %) · activas ' + num(act3[x[0]] || 0);
        });
        return rep(titulo, unir('Las ' + b(n) + ' asignaciones se reparten en ' + b(cuantos(m3)) + ' categorías.',
          bloque('Categorías', lin3)) + pieFiltro,
          'Hay ' + cuantos(m3) + ' categorías. La que más pesa es ' + (mayor(m3) || [''])[0] + '.');
      }
      case 'subcat': {
        var m4 = conteo(lista, 'subcategoria');
        return rep(titulo, unir('Detalle por subcategoría.', bloque('Subcategorías', top(m4, 15, n))) + pieFiltro,
          'Hay ' + cuantos(m4) + ' subcategorías distintas.');
      }
      case 'etapa': {
        var m5 = conteo(lista, 'etapa');
        var sin = m5['SIN DATO'] || 0;
        return rep(titulo, unir(
          'En qué etapa jurídica están las ' + b(n) + ' asignaciones.',
          bloque('Etapas', top(m5, 15, n)),
          sin ? '⚠️ **' + num(sin) + '** ' + plural(sin, 'no tiene', 'no tienen') + ' etapa escrita.' : null
        ) + pieFiltro, 'Hay ' + cuantos(m5) + ' etapas jurídicas distintas y ' + num(sin) + ' sin etapa.');
      }
      case 'medio': {
        var m6 = conteo(lista, 'medio');
        return rep(titulo, unir('Por dónde entraron las ' + b(n) + ' asignaciones.', bloque('Medio de entrada', top(m6, 10, n))) + pieFiltro,
          'Entraron por ' + cuantos(m6) + ' medios distintos.');
      }
      case 'cierre': {
        var cerradas = lista.filter(function (r) { return finalizado(r) && txt(r.cierre); });
        if (!cerradas.length) return rep(titulo, 'Todavía no hay asignaciones finalizadas con fecha de cierre en lo que estás viendo.', 'No hay asignaciones cerradas con fecha.');
        var ds = cerradas.map(diasCierre).filter(function (d) { return d != null; });
        var prom = ds.length ? Math.round(ds.reduce(function (a, x) { return a + x; }, 0) / ds.length) : 0;
        var rapidas = ds.filter(function (d) { return d <= 5; }).length;
        var lentas = ds.filter(function (d) { return d > 15; }).length;
        var porMes = conteo(cerradas, function (r) { var d = fecha(r.cierre); return d ? claveMes(d) : 'SIN FECHA'; });
        var cl = Object.keys(porMes).sort();
        return rep(titulo, unir(
          b(cerradas.length) + ' de las ' + b(n) + ' están finalizadas con fecha de cierre.',
          bloque('Cuánto tomó cerrarlas (días hábiles)', [
            '- Promedio: ' + b(prom) + ' días',
            '- En 5 días o menos: ' + b(rapidas) + ' (' + pct(rapidas, ds.length) + ' %)',
            '- Con más de 15 días: ' + b(lentas) + ' (' + pct(lentas, ds.length) + ' %)',
            '- La que más tardó: ' + b(ds.length ? Math.max.apply(null, ds) : 0) + ' días'
          ]),
          bloque('Cierres por mes', cl.map(function (k) {
            return '- ' + (k === 'SIN FECHA' ? 'Sin fecha' : mesTxt(k)) + ' — ' + b(porMes[k]);
          }))
        ) + pieFiltro,
          num(cerradas.length) + ' asignaciones cerradas, en promedio en ' + num(prom) + ' días hábiles.');
      }
      case 'evidencia': {
        var sinEv = lista.filter(function (r) { return !txt(r.evidencia); });
        var sinEvFin = sinEv.filter(finalizado);
        return rep(titulo, unir(
          b(sinEv.length) + ' de ' + b(n) + ' asignaciones no tienen cargada la evidencia de envío (' + bp(sinEv.length, n) + ').',
          sinEvFin.length ? '🚨 De esas, **' + num(sinEvFin.length) + '** ya están **FINALIZADAS**: se cerraron sin dejar el soporte.' : '✅ Todas las finalizadas tienen su evidencia.',
          sinEv.length ? bloque('Las primeras sin evidencia', sinEv.slice(0, 12).map(function (r) {
            return '- ' + txt(r.consecutivo || r.id_proceso) + ' — ' + txt(r.asignado) + ' (' + txt(r.estado) + ')';
          })) : null
        ) + pieFiltro,
          num(sinEv.length) + ' asignaciones no tienen evidencia, y ' + num(sinEvFin.length) + ' de ellas ya están finalizadas.');
      }
      case 'rebote': {
        var reb = lista.filter(function (r) { return txt(r.rebote); });
        if (!reb.length) return rep(titulo, '✅ Ninguna asignación de las que estás viendo ha sido rebotada.', 'Ninguna asignación ha sido rebotada.');
        var porQuien = conteo(reb, 'asignado');
        return rep(titulo, unir(
          b(reb.length) + ' ' + plural(reb.length, 'asignación ha sido rebotada', 'asignaciones han sido rebotadas') + ' (' + bp(reb.length, n) + ').',
          bloque('A quién le rebotaron', top(porQuien, 10, reb.length)),
          bloque('Las últimas', reb.slice(0, 8).map(function (r) {
            return '- ' + txt(r.consecutivo || r.id_proceso) + ' — ' + txt(r.asignado);
          }))
        ) + pieFiltro, num(reb.length) + ' asignaciones han sido rebotadas.');
      }
      case 'mes': {
        var lm = lineasMes(lista, 'creacion');
        return rep(titulo, unir('Cuándo se crearon las ' + b(n) + ' asignaciones.', bloque('Mes a mes', lm)) + pieFiltro,
          'Las asignaciones se crearon a lo largo de ' + lm.length + ' meses.');
      }
      /* LOTE 06/09 — las mismas dos consultas de bitácora que en BD Predial */
      case 'misbit':
        return repMisBitacoras(titulo, lista, function (r) {
          return (txt(r.consecutivo) || txt(r.id_proceso)) +
                 (txt(r.peticionario) ? ' — ' + txt(r.peticionario) : '');
        }, ['asignación', 'asignaciones'], pieFiltro);

      case 'bitfrias':
        return repSinMias(titulo, lista, function (r) {
          return (txt(r.consecutivo) || txt(r.id_proceso)) +
                 (txt(r.peticionario) ? ' — ' + txt(r.peticionario) : '');
        }, ['asignación', 'asignaciones'], pieFiltro);

      case 'mias': {
        var yo = yoNombre();
        if (!yo) return rep(titulo, 'No logro saber con qué usuario estás dentro.', 'No sé con qué usuario estás dentro.');
        var mias = lista.filter(function (r) { return llano(r.asignado) === yo || llano(r.asistente) === yo; });
        if (!mias.length) return rep(titulo, 'De lo que estás viendo, ninguna asignación está a tu nombre.', 'Ninguna asignación está a tu nombre.');
        var actM = activos(mias);
        var vencM = actM.filter(function (r) { return grupoVence(r) === 'VENCIDOS'; }).length;
        var hoyM = actM.filter(function (r) { return grupoVence(r) === 'HOY'; }).length;
        return rep(titulo, unir(
          'Tienes ' + b(mias.length) + ' de las ' + b(n) + ' asignaciones en pantalla (' + bp(mias.length, n) + ').',
          bloque('Lo tuyo', [
            '- Activas: ' + b(actM.length),
            '- Finalizadas: ' + b(mias.length - actM.length),
            '- 🔴 Vencidas: ' + b(vencM),
            '- 🟠 Vencen hoy: ' + b(hoyM)
          ]),
          vencM ? bloque('Tus vencidas', actM.filter(function (r) { return grupoVence(r) === 'VENCIDOS'; }).slice(0, 10).map(function (r) {
            return '- ' + txt(r.consecutivo || r.id_proceso) + ' — vencía el ' + txt(r.respuesta);
          })) : null
        ) + pieFiltro,
          'Tienes ' + num(mias.length) + ' asignaciones: ' + num(actM.length) + ' activas, ' + num(vencM) + ' vencidas.');
      }
      case 'expediente': {
        var con = lista.filter(function (r) { return txt(r.expediente); });
        var m7 = conteo(con, 'expediente');
        var repes = orden(m7).filter(function (x) { return x[1] > 1; });
        return rep(titulo, unir(
          b(con.length) + ' de ' + b(n) + ' asignaciones tienen expediente interno (' + bp(con.length, n) + ').',
          bloque('Cómo está', [
            '- Con expediente: ' + b(con.length),
            '- Sin expediente: ' + b(n - con.length),
            '- Expedientes distintos: ' + b(cuantos(m7)),
            '- Expedientes con más de una asignación: ' + b(repes.length)
          ]),
          repes.length ? bloque('Expedientes con varias asignaciones', repes.slice(0, 10).map(function (x) {
            return '- ' + x[0] + ' — ' + b(x[1]) + ' asignaciones';
          })) : null
        ) + pieFiltro,
          num(con.length) + ' asignaciones tienen expediente interno y ' + num(n - con.length) + ' no.');
      }
    }
    return rep(titulo, 'No conozco esa consulta.', '');
  }

  /* ============================================================
     6 y 7) PREDIAL  (view-bd-predial y view-bdp-panel)
     Las dos leen el objeto ligero de PREDIAL (18 campos). La BD
     respeta las pastillas de filtro y el buscador; el panel mira
     todo lo que trajo el alcance del usuario.
     ============================================================ */
  function deuda(r) { return Number(r.valor_deuda) || 0; }
  function carteraDe(lista) {
    var t = 0;
    for (var i = 0; i < lista.length; i++) t += deuda(lista[i]);
    return t;
  }
  /* DEBE DESDE viene como 201801 (año + mes) o como 2018. */
  function anioDeuda(r) {
    var s = txt(r.debe_desde).replace(/\D/g, '');
    if (s.length >= 4) {
      var y = parseInt(s.slice(0, 4), 10);
      if (y >= 1980 && y <= 2100) return y;
    }
    return null;
  }

  function repPred(id, lista, donde) {
    var vista = donde === 'panel' ? 'view-bdp-panel' : 'view-bd-predial';
    var titulo = tituloDe(vista, id);
    if (!lista.length) return vacio(titulo, 'expedientes');
    var n = lista.length;
    var cartera = carteraDe(lista);
    var todos = donde === 'panel' ? lista : bdpTodos();
    var pieFiltro = (donde === 'lista' && todos.length && todos.length !== n)
      ? '\n\n_Estás viendo ' + num(n) + ' de ' + num(todos.length) + ' expedientes por los filtros que tienes puestos.' : '';

    switch (id) {
      case 'resumen': {
        var cl = conteo(lista, 'clasificacion');
        var carClas = suma(lista, 'clasificacion', 'valor_deuda');
        var sinAct = lista.filter(function (r) { return llano(r.actuacion) === 'NINGUNA' || !txt(r.actuacion); }).length;
        var sinSus = lista.filter(function (r) { return llano(r.sustanciador) === 'NINGUNO' || !txt(r.sustanciador); }).length;
        var alDia = lista.filter(function (r) { return llano(r.estado_proceso) === 'AL DIA'; }).length;
        return rep(titulo, unir(
          (donde === 'panel' ? 'El panel está mirando ' : 'Estás viendo ') + b(n) + ' ' + plural(n, 'expediente', 'expedientes') +
            ' que suman **' + pesosCorto(cartera) + '** de cartera.',
          bloque('De un vistazo', [
            '- Deuda promedio: **' + pesosCorto(n ? cartera / n : 0) + '**',
            '- 🔴 ALTA: ' + b(cl.ALTA || 0) + ' — ' + pesosCorto(carClas.ALTA || 0),
            '- 🟠 MEDIA: ' + b(cl.MEDIA || 0) + ' — ' + pesosCorto(carClas.MEDIA || 0),
            '- 🟢 BAJA: ' + b(cl.BAJA || 0) + ' — ' + pesosCorto(carClas.BAJA || 0)
          ]),
          bloque('Lo que está sin tocar', [
            '- Sin actuación: ' + b(sinAct) + ' (' + pct(sinAct, n) + ' %)',
            '- Sin sustanciador: ' + b(sinSus) + ' (' + pct(sinSus, n) + ' %)',
            '- Al día: ' + b(alDia)
          ])
        ) + pieFiltro,
          'Hay ' + num(n) + ' expedientes con una cartera de ' + pesosCorto(cartera) + '. ' +
          num(cl.ALTA || 0) + ' son de clasificación alta y ' + num(sinAct) + ' no tienen ninguna actuación.');
      }
      case 'clasif': {
        var c2 = conteo(lista, 'clasificacion');
        var s2 = suma(lista, 'clasificacion', 'valor_deuda');
        var lin = ['ALTA', 'MEDIA', 'BAJA'].filter(function (k) { return c2[k]; }).map(function (k) {
          return '- ' + k + ' — ' + b(c2[k]) + ' expedientes (' + pct(c2[k], n) + ' %) · **' + pesosCorto(s2[k]) + '** (' + pct(s2[k], cartera) + ' % de la cartera)';
        });
        return rep(titulo, unir(
          'Cómo se reparten los ' + b(n) + ' expedientes y los **' + pesosCorto(cartera) + '**.',
          bloque('Por clasificación', lin),
          c2.ALTA ? '🔴 Los **' + num(c2.ALTA) + '** de clasificación ALTA son el **' + pct(c2.ALTA, n) + ' %** de los expedientes pero el **' + pct(s2.ALTA || 0, cartera) + ' %** de la plata.' : null
        ) + pieFiltro,
          'La clasificación alta son ' + num(c2.ALTA || 0) + ' expedientes, el ' + pct(c2.ALTA || 0, n) +
          ' por ciento, y concentran el ' + pct(s2.ALTA || 0, cartera) + ' por ciento de la cartera.');
      }
      case 'actuacion': {
        var c3 = conteo(lista, 'actuacion');
        var s3 = suma(lista, 'actuacion', 'valor_deuda');
        var ning = (c3.NINGUNA || 0) + (c3['SIN DATO'] || 0);
        var lin3 = orden(c3).map(function (x) {
          return '- ' + x[0] + ' — ' + b(x[1]) + ' (' + pct(x[1], n) + ' %) · ' + pesosCorto(s3[x[0]] || 0);
        });
        return rep(titulo, unir(
          'Qué se ha hecho con los ' + b(n) + ' expedientes.',
          bloque('Actuaciones', lin3),
          ning ? '⚠️ **' + num(ning) + '** expedientes (' + pct(ning, n) + ' %) siguen **sin ninguna actuación**, y son **' + pesosCorto((s3.NINGUNA || 0) + (s3['SIN DATO'] || 0)) + '** sin cobrar.' : null
        ) + pieFiltro,
          num(ning) + ' expedientes siguen sin ninguna actuación, el ' + pct(ning, n) + ' por ciento del total.');
      }
      case 'equipo': {
        var byS = {};
        lista.forEach(function (r) {
          var k = etiq(r.sustanciador);
          if (k === 'SIN DATO' || k === 'NINGUNO') k = 'SIN SUSTANCIADOR';
          if (!byS[k]) byS[k] = { n: 0, $: 0, alta: 0, act: 0 };
          byS[k].n++; byS[k].$ += deuda(r);
          if (llano(r.clasificacion) === 'ALTA') byS[k].alta++;
          if (llano(r.actuacion) !== 'NINGUNA' && txt(r.actuacion)) byS[k].act++;
        });
        var claves = Object.keys(byS).sort(function (a, bb) { return byS[bb].n - byS[a].n; });
        var lin4 = claves.map(function (k) {
          var v = byS[k];
          return '- ' + k + ' — ' + b(v.n) + ' expedientes · ' + pesosCorto(v.$) + ' · con actuación ' + b(v.act) + ' · ALTA ' + b(v.alta);
        });
        var sinDuenio = byS['SIN SUSTANCIADOR'];
        return rep(titulo, unir(
          'Cómo está repartida la BD entre ' + b(claves.length) + ' ' + plural(claves.length, 'nombre', 'nombres') + '.',
          bloque('Carga por sustanciador', lin4),
          sinDuenio ? '⚠️ **' + num(sinDuenio.n) + '** expedientes (' + pct(sinDuenio.n, n) + ' %) no tienen sustanciador: **' + pesosCorto(sinDuenio.$) + '** sin responsable.' : '✅ Todos los expedientes tienen sustanciador.'
        ) + pieFiltro,
          'La base está repartida entre ' + claves.length + ' nombres. ' +
          (sinDuenio ? num(sinDuenio.n) + ' expedientes no tienen sustanciador.' : 'Todos tienen sustanciador.'));
      }
      case 'estado': {
        var c5 = conteo(lista, 'estado_proceso');
        var s5 = suma(lista, 'estado_proceso', 'valor_deuda');
        var lin5 = orden(c5).map(function (x) {
          return '- ' + x[0] + ' — ' + b(x[1]) + ' (' + pct(x[1], n) + ' %) · ' + pesosCorto(s5[x[0]] || 0);
        });
        var ning5 = (c5.NINGUNO || 0) + (c5['SIN DATO'] || 0);
        return rep(titulo, unir(
          'En qué estado va el proceso de cobro.',
          bloque('Estado del proceso', lin5),
          ning5 ? '⚠️ **' + num(ning5) + '** expedientes (' + pct(ning5, n) + ' %) no tienen estado de proceso.' : null
        ) + pieFiltro,
          'Hay ' + cuantos(c5) + ' estados de proceso y ' + num(ning5) + ' expedientes sin estado.');
      }
      case 'top': {
        var tops = lista.slice().sort(function (a, bb) { return deuda(bb) - deuda(a); }).slice(0, 15);
        var suman = tops.reduce(function (a, r) { return a + deuda(r); }, 0);
        return rep(titulo, unir(
          'Los 15 expedientes con mayor deuda de los ' + b(n) + ' que estás viendo.',
          bloque('Mayores deudas', tops.map(function (r, i) {
            return '- ' + (i + 1) + '. ' + txt(r.nombres) + ' — **' + pesos(deuda(r)) + '** (' + etiq(r.actuacion) + ')';
          })),
          'Entre esos 15 suman **' + pesosCorto(suman) + '**, el ' + bp(suman, cartera) + ' de toda la cartera que ves.'
        ) + pieFiltro,
          'Los quince expedientes con mayor deuda suman ' + pesosCorto(suman) + ', el ' + pct(suman, cartera) + ' por ciento de la cartera.');
      }
      case 'concentra': {
        var ord = lista.slice().sort(function (a, bb) { return deuda(bb) - deuda(a); });
        function acum(k) {
          var t = 0;
          for (var i = 0; i < k && i < ord.length; i++) t += deuda(ord[i]);
          return t;
        }
        var t10 = acum(10), t50 = acum(50), t100 = acum(100);
        var mitad = 0, cuantosPara = 0;
        for (var i = 0; i < ord.length; i++) {
          mitad += deuda(ord[i]); cuantosPara++;
          if (mitad >= cartera / 2) break;
        }
        return rep(titulo, unir(
          'La cartera que estás viendo es de **' + pesosCorto(cartera) + '** repartida en ' + b(n) + ' expedientes.',
          bloque('Dónde está la plata', [
            '- Los 10 más grandes: **' + pesosCorto(t10) + '** (' + pct(t10, cartera) + ' %)',
            '- Los 50 más grandes: **' + pesosCorto(t50) + '** (' + pct(t50, cartera) + ' %)',
            '- Los 100 más grandes: **' + pesosCorto(t100) + '** (' + pct(t100, cartera) + ' %)'
          ]),
          '🎯 Con solo **' + num(cuantosPara) + '** expedientes (' + bp(cuantosPara, n) + ' de la base) se cobra **la mitad** de toda la cartera.'
        ) + pieFiltro,
          'Con ' + num(cuantosPara) + ' expedientes, el ' + pct(cuantosPara, n) +
          ' por ciento de la base, se cobra la mitad de la cartera. Los diez más grandes son el ' + pct(t10, cartera) + ' por ciento.');
      }
      case 'alta': {
        var altas = lista.filter(function (r) { return llano(r.clasificacion) === 'ALTA'; });
        if (!altas.length) return rep(titulo, 'No hay expedientes de clasificación ALTA en lo que estás viendo.', 'No hay expedientes de clasificación alta.');
        var cAlta = carteraDe(altas);
        var sinAct2 = altas.filter(function (r) { return llano(r.actuacion) === 'NINGUNA' || !txt(r.actuacion); });
        var sinSus2 = altas.filter(function (r) { return llano(r.sustanciador) === 'NINGUNO' || !txt(r.sustanciador); });
        return rep(titulo, unir(
          '🚨 ' + b(altas.length) + ' expedientes de clasificación **ALTA** que suman **' + pesosCorto(cAlta) + '** (' + bp(cAlta, cartera) + ' de la cartera).',
          bloque('Qué falta ahí', [
            '- Sin ninguna actuación: ' + b(sinAct2.length) + ' — **' + pesosCorto(carteraDe(sinAct2)) + '**',
            '- Sin sustanciador: ' + b(sinSus2.length),
            '- Deuda promedio: **' + pesosCorto(cAlta / altas.length) + '**'
          ]),
          bloque('Las 10 más grandes sin actuación', sinAct2.slice().sort(function (a, bb) { return deuda(bb) - deuda(a); }).slice(0, 10).map(function (r) {
            return '- ' + txt(r.nombres) + ' — **' + pesos(deuda(r)) + '**';
          }))
        ) + pieFiltro,
          'Hay ' + num(altas.length) + ' expedientes de clasificación alta por ' + pesosCorto(cAlta) +
          ', y ' + num(sinAct2.length) + ' de ellos no tienen ninguna actuación.');
      }
      case 'antiguedad': {
        var m6 = {}, s6 = {}, sinAnio = 0;
        lista.forEach(function (r) {
          var y = anioDeuda(r);
          if (!y) { sinAnio++; return; }
          m6[y] = (m6[y] || 0) + 1;
          s6[y] = (s6[y] || 0) + deuda(r);
        });
        var anios = Object.keys(m6).sort();
        var corte = new Date().getFullYear() - 5;
        var viejos = 0, viejos$ = 0;
        anios.forEach(function (y) { if (+y <= corte) { viejos += m6[y]; viejos$ += s6[y]; } });
        return rep(titulo, unir(
          'Desde qué año deben los ' + b(n) + ' expedientes en pantalla.',
          bloque('Por año de inicio de la deuda', anios.map(function (y) {
            return '- ' + y + ' — ' + b(m6[y]) + ' · ' + pesosCorto(s6[y]);
          })),
          bloque('Lo viejo', [
            '- Deudas de ' + corte + ' o antes: ' + b(viejos) + ' (' + pct(viejos, n) + ' %) · **' + pesosCorto(viejos$) + '**',
            sinAnio ? '- Sin año legible: ' + b(sinAnio) : null
          ].filter(Boolean)),
          '⚠️ Entre más vieja la deuda, más cerca está de prescribir.'
        ) + pieFiltro,
          num(viejos) + ' expedientes deben desde ' + corte + ' o antes, y suman ' + pesosCorto(viejos$) + '.');
      }
      case 'expfisico': {
        var sinF = lista.filter(function (r) { return !txt(r.no_exp_fisico); });
        return rep(titulo, unir(
          b(sinF.length) + ' de ' + b(n) + ' expedientes no tienen número de expediente físico (' + bp(sinF.length, n) + ').',
          bloque('Cuánto pesa eso', [
            '- Cartera sin expediente físico: **' + pesosCorto(carteraDe(sinF)) + '**',
            '- De clasificación ALTA: ' + b(sinF.filter(function (r) { return llano(r.clasificacion) === 'ALTA'; }).length),
            '- Con actuación empezada: ' + b(sinF.filter(function (r) { return llano(r.actuacion) !== 'NINGUNA' && txt(r.actuacion); }).length)
          ]),
          sinF.length ? '⚠️ Los que ya tienen actuación y no tienen expediente físico son los que hay que abrir primero.' : '✅ Todos tienen expediente físico.'
        ) + pieFiltro,
          num(sinF.length) + ' expedientes no tienen número de expediente físico, y suman ' + pesosCorto(carteraDe(sinF)) + '.');
      }
      case 'archivo': {
        var sinA = lista.filter(function (r) { return !txt(r.archivo_expediente); });
        var conA = n - sinA.length;
        return rep(titulo, unir(
          b(conA) + ' de ' + b(n) + ' expedientes tienen el archivo cargado en Drive (' + bp(conA, n) + ').',
          bloque('Lo que falta subir', [
            '- Sin archivo en Drive: ' + b(sinA.length),
            '- De esos, con actuación empezada: ' + b(sinA.filter(function (r) { return llano(r.actuacion) !== 'NINGUNA' && txt(r.actuacion); }).length),
            '- De esos, de clasificación ALTA: ' + b(sinA.filter(function (r) { return llano(r.clasificacion) === 'ALTA'; }).length)
          ])
        ) + pieFiltro,
          num(conA) + ' expedientes tienen archivo en Drive y ' + num(sinA.length) + ' no.');
      }
      case 'correo': {
        var sinC = lista.filter(function (r) { return !txt(r.correo_electronico); });
        var conC = n - sinC.length;
        return rep(titulo, unir(
          'Solo ' + b(conC) + ' de ' + b(n) + ' expedientes tienen correo del contribuyente (' + bp(conC, n) + ').',
          bloque('Qué significa', [
            '- Sin correo: ' + b(sinC.length) + ' — **' + pesosCorto(carteraDe(sinC)) + '** de cartera',
            '- Sin correo y de clasificación ALTA: ' + b(sinC.filter(function (r) { return llano(r.clasificacion) === 'ALTA'; }).length)
          ]),
          '📧 Sin correo no hay notificación electrónica: toca citación y notificación personal.'
        ) + pieFiltro,
          num(conC) + ' expedientes tienen correo y ' + num(sinC.length) + ' no, lo que representa ' + pesosCorto(carteraDe(sinC)) + ' de cartera.');
      }
      case 'aldia': {
        var alDia2 = lista.filter(function (r) { return llano(r.estado_proceso) === 'AL DIA'; });
        var cero = lista.filter(function (r) { return deuda(r) === 0; });
        var acuerdo = lista.filter(function (r) { return llano(r.estado_proceso) === 'ACUERDO DE PAGO'; });
        return rep(titulo, unir(
          'Lo que ya no hay que perseguir.',
          bloque('Al día', [
            '- Marcados AL DÍA: ' + b(alDia2.length) + ' (' + pct(alDia2.length, n) + ' %)',
            '- Con deuda en cero: ' + b(cero.length),
            '- Con acuerdo de pago: ' + b(acuerdo.length) + ' — ' + pesosCorto(carteraDe(acuerdo))
          ]),
          (cero.length !== alDia2.length)
            ? '⚠️ Hay diferencia entre los marcados AL DÍA (**' + num(alDia2.length) + '**) y los que tienen la deuda en cero (**' + num(cero.length) + '**): vale la pena revisarlo.'
            : '✅ Los marcados al día son exactamente los que tienen deuda en cero.'
        ) + pieFiltro,
          num(alDia2.length) + ' expedientes están marcados al día y ' + num(cero.length) + ' tienen la deuda en cero.');
      }
      case 'asistente': {
        var byAs = {};
        lista.forEach(function (r) {
          var k = etiq(r.asistente);
          if (k === 'SIN DATO') k = 'SIN ASISTENTE';
          if (!byAs[k]) byAs[k] = { n: 0, $: 0 };
          byAs[k].n++; byAs[k].$ += deuda(r);
        });
        var cl2 = Object.keys(byAs).sort(function (a, bb) { return byAs[bb].n - byAs[a].n; });
        return rep(titulo, unir(
          'Expedientes que tiene apoyado cada asistente.',
          bloque('Por asistente', cl2.map(function (k) {
            return '- ' + k + ' — ' + b(byAs[k].n) + ' · ' + pesosCorto(byAs[k].$);
          }))
        ) + pieFiltro, 'Hay ' + cl2.length + ' asistentes distintos en los expedientes que ves.');
      }
      /* ── FASE 13 — Seguimientos (columnas AM y AN de PREDIAL) ── */
      /* LOTE 06/09 — el asistente ya no tiene expedientes asignados: lo que
         marca su trabajo es la bitácora. */
      case 'misbit':
        return repMisBitacoras(titulo, lista, function (r) {
          return txt(r.nombres) + (txt(r.no_exp_fisico) ? ' (' + txt(r.no_exp_fisico) + ')' : '');
        }, ['expediente', 'expedientes'], pieFiltro);

      case 'bitfrias':
        return repSinMias(titulo, lista, function (r) {
          return txt(r.nombres) + (txt(r.no_exp_fisico) ? ' (' + txt(r.no_exp_fisico) + ')' : '');
        }, ['expediente', 'expedientes'], pieFiltro);

      case 'seguimiento':
      case 'misseg': {
        var soloMios = (id === 'misseg');
        var yoS = yoNombre();
        if (soloMios && !yoS) {
          return rep(titulo, 'No logro saber con qué usuario estás dentro.', 'No sé con qué usuario estás dentro.');
        }
        var base = soloMios
          ? lista.filter(function (r) { return llano(r.sustanciador) === yoS || llano(r.asistente) === yoS; })
          : lista;

        var conFecha = base.filter(function (r) { return !!fecha(r.fecha_seguimiento); });
        var prog = conFecha.filter(function (r) { return llano(r.recordatorio) === 'PROGRAMADO'; });
        var recordados = conFecha.filter(function (r) { return llano(r.recordatorio) === 'RECORDADO'; }).length;
        var sinMarca = conFecha.length - prog.length - recordados;

        if (!prog.length) {
          return rep(titulo,
            (soloMios
              ? 'No tienes ningún seguimiento **PROGRAMADO** entre lo que estás viendo.'
              : 'No hay ningún seguimiento **PROGRAMADO** entre los ' + b(base.length) + ' expedientes que ves.') +
            (recordados ? '\n\nYa fueron recordados: ' + b(recordados) + '.' : '') + pieFiltro,
            'No hay seguimientos programados entre los ' + num(base.length) + ' expedientes que ves.');
        }

        var hoyD = new Date(); hoyD.setHours(0, 0, 0, 0);
        var DIA = 86400000;
        function diasA(r) {
          var f = fecha(r.fecha_seguimiento);
          f.setHours(0, 0, 0, 0);
          return Math.round((f - hoyD) / DIA);
        }
        var vencidos = prog.filter(function (r) { return diasA(r) < 0; });
        var deHoy    = prog.filter(function (r) { return diasA(r) === 0; });
        var semana   = prog.filter(function (r) { var d = diasA(r); return d > 0 && d <= 7; });
        var luego    = prog.filter(function (r) { return diasA(r) > 7; });

        var ordenados = prog.slice().sort(function (a, bb) { return diasA(a) - diasA(bb); });
        var proximos = ordenados.slice(0, 10).map(function (r) {
          var d = diasA(r);
          var cuando = d < 0 ? ('🔴 hace ' + Math.abs(d) + ' ' + plural(Math.abs(d), 'día', 'días'))
                     : d === 0 ? '🟠 HOY'
                     : ('🟢 en ' + d + ' ' + plural(d, 'día', 'días'));
          return '- ' + txt(r.fecha_seguimiento) + ' · ' + cuando + ' — ' + txt(r.nombres) +
                 (txt(r.no_exp_fisico) ? ' (' + txt(r.no_exp_fisico) + ')' : '') +
                 (soloMios ? '' : ' · ' + etiq(r.sustanciador));
        });

        var carteraProg = carteraDe(prog);
        var porSust = null;
        if (!soloMios) {
          var mapS = conteo(prog, function (r) { return etiq(r.sustanciador); });
          porSust = bloque('Quién los tiene', orden(mapS).map(function (x) {
            return '- ' + x[0] + ' — ' + b(x[1]);
          }));
        }

        return rep(titulo, unir(
          (soloMios ? 'Tienes ' : 'Hay ') + b(prog.length) + ' ' +
            plural(prog.length, 'seguimiento programado', 'seguimientos programados') +
            ' con **' + pesosCorto(carteraProg) + '** de cartera detrás.',
          bloque('Cómo vienen', [
            '- 🔴 Vencidos: ' + b(vencidos.length),
            '- 🟠 Para hoy: ' + b(deHoy.length),
            '- 🟢 En los próximos 7 días: ' + b(semana.length),
            '- 📆 Más adelante: ' + b(luego.length)
          ]),
          bloque('Los 10 más urgentes', proximos),
          porSust,
          vencidos.length
            ? '⚠️ **' + num(vencidos.length) + '** ' + plural(vencidos.length, 'seguimiento se pasó', 'seguimientos se pasaron') +
              ' de fecha y siguen en PROGRAMADO: **' + pesosCorto(carteraDe(vencidos)) + '**.'
            : '✅ Ningún seguimiento programado está vencido.',
          (recordados || sinMarca)
            ? '_Además hay ' + num(recordados) + ' ya recordados' +
              (sinMarca > 0 ? ' y ' + num(sinMarca) + ' con fecha pero sin marcar' : '') + '._'
            : null
        ) + pieFiltro,
          (soloMios ? 'Tienes ' : 'Hay ') + num(prog.length) + ' seguimientos programados. ' +
          num(vencidos.length) + ' están vencidos, ' + num(deHoy.length) + ' son para hoy y ' +
          num(semana.length) + ' caen en los próximos siete días.');
      }
      case 'mias': {
        var yo2 = yoNombre();
        if (!yo2) return rep(titulo, 'No logro saber con qué usuario estás dentro.', 'No sé con qué usuario estás dentro.');
        var mias2 = lista.filter(function (r) { return llano(r.sustanciador) === yo2 || llano(r.asistente) === yo2; });
        if (!mias2.length) return rep(titulo, 'De lo que estás viendo, ningún expediente está a tu nombre.', 'Ningún expediente está a tu nombre.');
        var cMias = carteraDe(mias2);
        var altaM = mias2.filter(function (r) { return llano(r.clasificacion) === 'ALTA'; }).length;
        var sinActM = mias2.filter(function (r) { return llano(r.actuacion) === 'NINGUNA' || !txt(r.actuacion); }).length;
        return rep(titulo, unir(
          'Tienes ' + b(mias2.length) + ' expedientes a tu nombre, con **' + pesosCorto(cMias) + '** de cartera.',
          bloque('Lo tuyo', [
            '- 🔴 Clasificación ALTA: ' + b(altaM),
            '- Sin ninguna actuación: ' + b(sinActM) + ' — **' + pesosCorto(carteraDe(mias2.filter(function (r) { return llano(r.actuacion) === 'NINGUNA' || !txt(r.actuacion); }))) + '**',
            '- Con archivo en Drive: ' + b(mias2.filter(function (r) { return txt(r.archivo_expediente); }).length)
          ]),
          bloque('Tus 8 deudas más grandes', mias2.slice().sort(function (a, bb) { return deuda(bb) - deuda(a); }).slice(0, 8).map(function (r) {
            return '- ' + txt(r.nombres) + ' — **' + pesos(deuda(r)) + '** (' + etiq(r.actuacion) + ')';
          }))
        ) + pieFiltro,
          'Tienes ' + num(mias2.length) + ' expedientes con ' + pesosCorto(cMias) + ' de cartera, ' +
          num(altaM) + ' de clasificación alta y ' + num(sinActM) + ' sin ninguna actuación.');
      }
    }
    return rep(titulo, 'No conozco esa consulta.', '');
  }

  /* ============================================================
     8) DRIVE ANEXOS  (view-drive-anexos)
     ============================================================ */
  function dominio(c) {
    var s = txt(c).toLowerCase();
    var i = s.indexOf('@');
    return i > 0 ? s.slice(i + 1) : '';
  }
  function repDrive(id, lista) {
    var titulo = tituloDe('view-drive-anexos', id);
    if (!lista.length) return vacio(titulo, 'usuarios');
    var n = lista.length;
    var sinCarpeta = lista.filter(function (r) { return !txt(r.enlace); });
    var sinCorreo = lista.filter(function (r) { return !txt(r.correo); });

    switch (id) {
      case 'resumen':
        return rep(titulo, unir(
          'La vista tiene ' + b(n) + ' ' + plural(n, 'persona', 'personas') + '.',
          bloque('Cómo está', [
            '- Con carpeta de anexos: ' + b(n - sinCarpeta.length) + ' (' + pct(n - sinCarpeta.length, n) + ' %)',
            '- Con correo: ' + b(n - sinCorreo.length) + ' (' + pct(n - sinCorreo.length, n) + ' %)',
            '- Sin carpeta: ' + b(sinCarpeta.length),
            '- Sin correo: ' + b(sinCorreo.length),
            '- Dominios distintos: ' + b(cuantos(conteo(lista.filter(function (r) { return dominio(r.correo); }), function (r) { return dominio(r.correo); })))
          ]),
          sinCorreo.length ? '⚠️ Sin correo no se le puede dar acceso a la carpeta de Drive.' : '✅ Todos tienen correo.'
        ),
          'Hay ' + num(n) + ' personas: ' + num(n - sinCarpeta.length) + ' con carpeta y ' + num(sinCorreo.length) + ' sin correo.');
      case 'sincarpeta':
        if (!sinCarpeta.length) return rep(titulo, '✅ Todas las personas de la vista tienen carpeta de anexos.', 'Todas tienen carpeta de anexos.');
        return rep(titulo, unir(
          b(sinCarpeta.length) + ' de ' + b(n) + ' no tienen carpeta de anexos (' + bp(sinCarpeta.length, n) + ').',
          bloque('Quiénes', sinCarpeta.map(function (r) {
            return '- ' + txt(r.nombre) + (txt(r.correo) ? '' : ' (tampoco tiene correo)');
          }))
        ), num(sinCarpeta.length) + ' personas no tienen carpeta de anexos.');
      case 'sincorreo':
        if (!sinCorreo.length) return rep(titulo, '✅ Todas las personas de la vista tienen correo.', 'Todas tienen correo.');
        return rep(titulo, unir(
          b(sinCorreo.length) + ' de ' + b(n) + ' no tienen correo (' + bp(sinCorreo.length, n) + ').',
          bloque('Quiénes', sinCorreo.map(function (r) {
            return '- ' + txt(r.nombre) + (txt(r.enlace) ? ' — sí tiene carpeta, pero nadie puede entrar' : ' — tampoco tiene carpeta');
          })),
          '📧 Escríbeles el correo desde la misma tarjeta: la app le da acceso a la carpeta sola.'
        ), num(sinCorreo.length) + ' personas no tienen correo registrado.');
      case 'dominio': {
        var con = lista.filter(function (r) { return dominio(r.correo); });
        if (!con.length) return rep(titulo, 'Nadie tiene correo registrado.', 'Nadie tiene correo registrado.');
        var m = conteo(con, function (r) { return dominio(r.correo); });
        var noGoogle = con.filter(function (r) {
          var d = dominio(r.correo);
          return d.indexOf('gmail.') === -1 && d.indexOf('google') === -1;
        });
        return rep(titulo, unir(
          'De qué proveedor son los ' + b(con.length) + ' correos registrados.',
          bloque('Dominios', top(m, 12, con.length)),
          noGoogle.length ? '⚠️ **' + num(noGoogle.length) + '** ' + plural(noGoogle.length, 'correo no es de Google', 'correos no son de Google') + ': Drive puede pedirles crear cuenta para abrir la carpeta.' : '✅ Todos los correos son de Google.'
        ), 'Hay ' + cuantos(m) + ' dominios distintos y ' + num(noGoogle.length) + ' correos que no son de Google.');
      }
      case 'repetidos': {
        var m2 = {}, i;
        for (i = 0; i < lista.length; i++) {
          var c = txt(lista[i].correo).toLowerCase();
          if (!c) continue;
          (m2[c] = m2[c] || []).push(txt(lista[i].nombre));
        }
        var rep2 = Object.keys(m2).filter(function (k) { return m2[k].length > 1; });
        if (!rep2.length) return rep(titulo, '✅ No hay dos personas con el mismo correo.', 'No hay correos repetidos.');
        return rep(titulo, unir(
          '⚠️ ' + b(rep2.length) + ' ' + plural(rep2.length, 'correo está repetido', 'correos están repetidos') + '.',
          bloque('Repetidos', rep2.map(function (k) { return '- ' + k + ' — ' + m2[k].join(', '); })),
          'Dos personas con el mismo correo ven la misma carpeta de anexos.'
        ), num(rep2.length) + ' correos están repetidos entre dos o más personas.');
      }
      case 'listado':
        return rep(titulo, unir(
          'Las ' + b(n) + ' personas de la vista.',
          bloque('Listado', lista.map(function (r) {
            return '- ' + txt(r.nombre) + ' — ' + (txt(r.correo) || 'sin correo') + (txt(r.enlace) ? '' : ' · sin carpeta');
          }))
        ), 'Son ' + num(n) + ' personas en total.');
    }
    return rep(titulo, 'No conozco esa consulta.', '');
  }

  /* ============================================================
     VOZ
     ------------------------------------------------------------
     fetch propio a propósito: pasar por apiGet/apiPost encendería
     el loader de la app y el candado de la capa 12, y esto es una
     lectura de fondo que no debe bloquear nada.
     ============================================================ */
  function base() {
    try { if (typeof API_BASE === 'string' && API_BASE) return API_BASE; } catch (e) {}
    return '';
  }
  function uid() {
    try { if (typeof uidActual_ === 'function') return uidActual_(); } catch (e) {}
    return '';
  }
  function pedirGet(accion, params) {
    var u = base();
    if (!u) return Promise.reject(new Error('Sin conexión configurada.'));
    var p = params || {}; p.action = accion;
    return fetch(u + '?' + new URLSearchParams(p).toString(), { method: 'GET' })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (!j.ok) throw new Error(j.error || 'Error del servidor');
        return j.data;
      });
  }
  function pedirPost(accion, cuerpo) {
    var u = base();
    if (!u) return Promise.reject(new Error('Sin conexión configurada.'));
    return fetch(u + '?action=' + encodeURIComponent(accion), {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(cuerpo || {})
    }).then(function (r) { return r.json(); })
      .then(function (j) {
        if (!j.ok) throw new Error(j.error || 'Error del servidor');
        return j.data;
      });
  }

  function pedirVoz() {
    if (vozCfg) return Promise.resolve(vozCfg);
    if (pidiendoVoz) return pidiendoVoz;
    pidiendoVoz = pedirGet('vozestado', { uid: uid() })
      .then(function (r) { vozCfg = r || { configurada: false }; return vozCfg; })
      .catch(function () { vozCfg = { configurada: false, error: true }; return vozCfg; })
      .then(function (v) { pidiendoVoz = null; mostrarBotonesVoz(); return v; });
    return pidiendoVoz;
  }
  function mostrarBotonesVoz() {
    var hay = !!(vozCfg && vozCfg.configurada);
    var bs = document.querySelectorAll('.iq-voz');
    for (var k = 0; k < bs.length; k++) bs[k].style.display = hay ? '' : 'none';
  }

  var Repro = (function () {
    var audio = null, cola = [], i = 0, sig = null, activo = false, dueno = null;

    function el() {
      if (!audio) {
        audio = document.createElement('audio');
        audio.setAttribute('playsinline', '');
        audio.preload = 'auto';
        audio.style.display = 'none';
        document.body.appendChild(audio);
      }
      return audio;
    }
    function desbloquear() {
      var a = el();
      try {
        if (!a.dataset.libre) {
          a.src = SILENCIO;
          var p = a.play();
          if (p && p.then) p.then(function () { a.dataset.libre = '1'; }).catch(function () {});
          else a.dataset.libre = '1';
        }
      } catch (e) {}
    }
    /* Sin lookbehind a propósito: Safari < 16.4 lanza SyntaxError al
       cargar el archivo y eso tumbaría la capa entera, no solo la voz. */
    function frasear(t) {
      var out = [], act = '';
      for (var k = 0; k < t.length; k++) {
        var c = t.charAt(k);
        act += c;
        if ('.!?\u2026:;\n'.indexOf(c) >= 0) {
          while (k + 1 < t.length && /[\s"\u201d\u00bb)]/.test(t.charAt(k + 1))) { act += t.charAt(++k); }
          out.push(act); act = '';
        }
      }
      if (act.trim()) out.push(act);
      return out.length ? out : [t];
    }
    function trocear(txt2) {
      var t = String(txt2 || '')
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        .replace(/^\s*#{1,6}\s*/gm, '')
        .replace(/^\s*[-*•]\s+/gm, '')
        .replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]|[\u2190-\u2BFF\uFE0F]/g, '')
        .replace(/[ \t]+/g, ' ')
        .trim();
      if (!t) return [];
      var frases = frasear(t), out = [], act = '';
      for (var k = 0; k < frases.length; k++) {
        var f = frases[k].trim();
        if (!f) continue;
        while (f.length > 900) { out.push(f.slice(0, 900)); f = f.slice(900); }
        if ((act + ' ' + f).trim().length > 420 && act) { out.push(act.trim()); act = f; }
        else { act = (act ? act + ' ' : '') + f; }
      }
      if (act.trim()) out.push(act.trim());
      return out;
    }
    function pedir(t) {
      return pedirPost('vozhablar', { uid: uid(), texto: t }).then(function (r) {
        if (!r || r.ok === false) throw new Error((r && r.msg) || 'No se pudo generar la voz.');
        return 'data:' + (r.mime || 'audio/mpeg') + ';base64,' + r.base64;
      });
    }
    function siguiente() {
      if (!activo) return;
      if (i >= cola.length) return parar();
      var p = sig || pedir(cola[i]);
      sig = null;
      p.then(function (src) {
        if (!activo) return;
        var a = el();
        a.src = src;
        var pl = a.play();
        if (pl && pl.catch) pl.catch(function () { parar(); });
        if (i + 1 < cola.length) sig = pedir(cola[i + 1]).catch(function () { return null; });
        i++;
      }).catch(function (err) {
        parar();
        avisar((err && err.message) || 'No se pudo generar la voz.');
      });
    }
    function hablar(t, quien) {
      parar();
      cola = trocear(t);
      if (!cola.length) return;
      i = 0; sig = null; activo = true; dueno = quien || null;
      var a = el();
      a.onended = function () { if (activo) siguiente(); };
      a.onerror = function () { parar(); };
      siguiente();
      repintar();
    }
    function parar() {
      activo = false; cola = []; i = 0; sig = null;
      try { if (audio) { audio.pause(); audio.removeAttribute('src'); audio.load(); } } catch (e) {}
      dueno = null;
      repintar();
    }
    function repintar() {
      var bs = document.querySelectorAll('.iq-voz');
      for (var k = 0; k < bs.length; k++) {
        var on = activo && bs[k] === dueno;
        bs[k].classList.toggle('on', on);
        bs[k].innerHTML = on ? (STOP + ' Detener') : (BOCINA + ' Escuchar');
        bs[k].setAttribute('aria-label', on ? 'Detener la lectura' : 'Escuchar la respuesta');
      }
    }
    return {
      desbloquear: desbloquear, hablar: hablar, parar: parar, trocear: trocear,
      suena: function () { return activo; }, dueno: function () { return dueno; }
    };
  })();

  /* ============================================================
     BOTÓN FLOTANTE
     ============================================================ */
  function montar() {
    var v = vistaActiva();
    if (!PANELES[v] || !haySesion()) return quitar();
    if (fab) {
      if (fab.dataset.vista !== v) {
        fab.dataset.vista = v;
        if (abierta && cerrarHoja) cerrarHoja();
      }
      return;
    }
    /* data-salida = la capa 12 no le pone candado. Es obligatorio: este
       botón no pide red (los informes se calculan aquí), así que el
       candado de 500 ms de la capa 12 se quedaba puesto y el toque
       siguiente —el de después de arrastrarlo— no abría nada. */
    fab = nodo(
      '<button class="iq-fab" type="button" data-salida aria-label="Consultas" title="Tócalo para consultar. Mantenlo pulsado para moverlo.">' +
      '<span class="iq-fab-ring" aria-hidden="true"></span>' +
      '<span class="iq-fab-ic">' + ROBOT + '</span>' +
      '<span class="iq-fab-tx">Consultar</span>' +
      '</button>'
    );
    fab.dataset.vista = v;
    if (reducido()) fab.classList.add('iq-sin-motor');
    fab.addEventListener('click', function (ev) {
      if (fab.dataset.arrastro === '1') { fab.dataset.arrastro = ''; ev.preventDefault(); return; }
      Repro.desbloquear();
      abrir(fab.dataset.vista);
    });
    arrastrable(fab);
    document.body.appendChild(fab);
  }
  function quitar() {
    if (fab) { fab.remove(); fab = null; }
    if (abierta && cerrarHoja) cerrarHoja();
  }

  /* Clic sostenido para mover. No se guarda la posición: al cambiar de
     vista el nodo se destruye y el siguiente nace en su esquina. */
  function arrastrable(el) {
    var ESPERA = 420, TOLERA = 10;
    var temp = null, listo = false, x0 = 0, y0 = 0, dx = 0, dy = 0, pid = null;

    function fijar(izq, arr) {
      var w = el.offsetWidth, h = el.offsetHeight, m = 8;
      izq = Math.max(m, Math.min(izq, window.innerWidth - w - m));
      arr = Math.max(m, Math.min(arr, window.innerHeight - h - m));
      el.style.left = izq + 'px'; el.style.top = arr + 'px';
      el.style.right = 'auto'; el.style.bottom = 'auto';
    }
    function soltar() {
      clearTimeout(temp); temp = null;
      if (listo) { el.classList.remove('iq-fab-mov'); try { el.releasePointerCapture(pid); } catch (e) {} }
      listo = false; pid = null;
    }
    el.addEventListener('pointerdown', function (ev) {
      if (ev.button != null && ev.button > 0) return;
      pid = ev.pointerId; x0 = ev.clientX; y0 = ev.clientY; el.dataset.arrastro = '';
      temp = setTimeout(function () {
        var c = el.getBoundingClientRect();
        dx = x0 - c.left; dy = y0 - c.top; listo = true;
        el.classList.add('iq-fab-mov');
        try { el.setPointerCapture(pid); } catch (e) {}
        try { if (navigator.vibrate) navigator.vibrate(12); } catch (e) {}
        fijar(c.left, c.top);
      }, ESPERA);
    });
    el.addEventListener('pointermove', function (ev) {
      if (!listo) {
        if (temp && (Math.abs(ev.clientX - x0) > TOLERA || Math.abs(ev.clientY - y0) > TOLERA)) { clearTimeout(temp); temp = null; }
        return;
      }
      ev.preventDefault();
      el.dataset.arrastro = '1';
      fijar(ev.clientX - dx, ev.clientY - dy);
    });
    el.addEventListener('pointerup', soltar);
    el.addEventListener('pointercancel', function () { el.dataset.arrastro = ''; soltar(); });
    el.__fijar = fijar;
  }

  /* Un solo listener global: el FAB se crea y se destruye a cada rato y
     uno por FAB sería una fuga silenciosa. */
  window.addEventListener('resize', function () {
    if (!fab || !fab.parentNode || !fab.__fijar || !fab.style.left) return;
    fab.__fijar(parseFloat(fab.style.left) || 0, parseFloat(fab.style.top) || 0);
  });

  /* ============================================================
     HOJA DE CONSULTAS
     ============================================================ */
  function abrir(vista) {
    if (abierta) return;
    var cfg = PANELES[vista];
    if (!cfg) return;
    abierta = true;

    var hoja = nodo(
      '<div class="iq-wrap" data-salida role="dialog" aria-modal="true" aria-label="' + limpio(cfg.titulo) + '">' +
      '  <div class="iq-fondo"></div>' +
      '  <section class="iq-hoja">' +
      '    <header class="iq-h">' +
      '      <span class="iq-h-ic">' + ROBOT + '</span>' +
      '      <div class="iq-h-tx"><b>' + limpio(cfg.titulo) + '</b><small>' + limpio(cfg.sub) + '</small></div>' +
      '      <button class="iq-x" type="button" aria-label="Cerrar">' + CERRAR + '</button>' +
      '    </header>' +
      '    <div class="iq-body" id="iq-body"></div>' +
      '    <div class="iq-pie" id="iq-pie" role="group" aria-label="Consultas disponibles"></div>' +
      '  </section>' +
      '</div>'
    );
    document.body.appendChild(hoja);
    requestAnimationFrame(function () { hoja.classList.add('iq-on'); });

    var body = hoja.querySelector('#iq-body');
    var pie = hoja.querySelector('#iq-pie');

    function cerrar() {
      abierta = false; cerrarHoja = null;
      Repro.parar();
      hoja.classList.remove('iq-on');
      setTimeout(function () { hoja.remove(); }, reducido() ? 0 : 260);
      document.removeEventListener('keydown', esc);
    }
    cerrarHoja = cerrar;
    function esc(ev) { if (ev.key === 'Escape') cerrar(); }
    document.addEventListener('keydown', esc);
    hoja.querySelector('.iq-x').addEventListener('click', cerrar);
    hoja.querySelector('.iq-fondo').addEventListener('click', cerrar);

    cfg.botones.forEach(function (bt) {
      var el = nodo('<button class="iq-chip" type="button" data-id="' + bt.id + '"><span aria-hidden="true">' + bt.ic + '</span> ' + limpio(bt.et) + '</button>');
      el.addEventListener('click', function () {
        var ch = pie.querySelectorAll('.iq-chip');
        for (var k = 0; k < ch.length; k++) ch[k].classList.toggle('on', ch[k] === el);
        Repro.desbloquear();
        lanzar(body, vista, bt);
      });
      pie.appendChild(el);
    });

    pedirVoz();
    /* FASE 13 — NO se lanza nada solo. La primera consulta (👀 Lo que
       estoy viendo) queda ahí abajo esperando: el usuario decide si la
       manda o si toca otro botón. */
    pintarAviso(body, 'Toca 👀 Lo que estoy viendo para el resumen, o cualquier otra consulta de abajo. Los números salen de lo que tienes en pantalla ahora mismo, con los filtros puestos.');
  }

  function irAbajo(body) { body.scrollTop = body.scrollHeight; }

  function pintarAviso(body, t) {
    var el = nodo('<div class="iq-hint"></div>');
    el.textContent = t;
    body.appendChild(el);
    return el;
  }

  function lanzar(body, vista, boton) {
    Repro.parar();
    var mio = nodo('<div class="iq-msg iq-yo"></div>');
    mio.textContent = boton.ic + ' ' + boton.et;
    body.appendChild(mio);
    irAbajo(body);

    var cargando = nodo(
      '<div class="iq-msg iq-bot iq-cargando">' +
      '<span class="iq-pts"><i></i><i></i><i></i></span>' +
      '<span class="iq-carga-tx">Leyendo lo que tienes en pantalla…</span>' +
      '</div>'
    );
    body.appendChild(cargando);
    irAbajo(body);

    var t0 = Date.now();
    var r;
    try { r = informe(vista, boton.id); }
    catch (err) {
      if (cargando.parentNode) cargando.remove();
      var e = nodo('<div class="iq-msg iq-err"></div>');
      e.textContent = 'No se pudo armar la consulta: ' + ((err && err.message) || err);
      body.appendChild(e); irAbajo(body);
      return;
    }
    /* Que el "escribiendo" se vea aunque el cálculo sea instantáneo. */
    var espera = Math.max(0, 420 - (Date.now() - t0));
    setTimeout(function () {
      if (!cargando.parentNode) return;      /* cerraron la hoja */
      cargando.remove();
      pintar(body, r);
    }, espera);
  }

  function pintar(body, r) {
    var el = nodo('<div class="iq-msg iq-bot"></div>');
    var caja = nodo('<div class="iq-tx"></div>');
    el.appendChild(caja);
    body.appendChild(el);
    irAbajo(body);

    escribiendo(caja, r.texto, function () {
      if (r.lista && r.lista.length) el.appendChild(listaPersonas(r.lista));
      el.appendChild(botonera(r));
      irAbajo(body);
      leerSiToca(el, r.voz || r.texto);
    }, function () { irAbajo(body); });
    return el;
  }

  /* Efecto "escribiendo": se revela el texto plano y al terminar se
     cambia por el HTML con negritas y viñetas. Un toque lo salta. */
  function escribiendo(caja, texto, fin, tick) {
    var t = String(texto || '');
    function acabar() {
      caja.innerHTML = aHtml(t);
      caja.classList.remove('iq-escribiendo');
      caja.onclick = null;
      if (fin) fin();
    }
    if (reducido() || t.length < 2) { acabar(); return; }
    caja.classList.add('iq-escribiendo');
    var i = 0;
    var paso = Math.max(2, Math.ceil(t.length / 70));      /* ~1,4 s pase lo que pase */
    var timer = setInterval(function () {
      if (!caja.isConnected) { clearInterval(timer); return; }
      i += paso;
      caja.textContent = t.slice(0, i);
      if (tick) tick();
      if (i >= t.length) { clearInterval(timer); acabar(); }
    }, 20);
    caja.onclick = function () { clearInterval(timer); acabar(); };
  }

  /* Texto plano → HTML mínimo (párrafos, viñetas, **negrita** y _cursiva_). */
  function aHtml(t) {
    var lineas = String(t || '').split(/\r?\n/);
    var out = [], lista = [];
    function cerrarLista() { if (lista.length) { out.push('<ul>' + lista.join('') + '</ul>'); lista = []; } }
    for (var i = 0; i < lineas.length; i++) {
      var l = lineas[i].trim();
      if (!l) { cerrarLista(); continue; }
      var m = /^[-*•]\s+(.*)$/.exec(l);
      if (m) { lista.push('<li>' + realce(limpio(m[1])) + '</li>'); continue; }
      cerrarLista();
      var clase = /^_/.test(l) ? ' class="iq-muted"' : '';
      out.push('<p' + clase + '>' + realce(limpio(l.replace(/^_/, '').replace(/^#{1,6}\s*/, ''))) + '</p>');
    }
    cerrarLista();
    return out.join('') || '<p class="iq-muted">Sin datos.</p>';
  }
  function realce(s) { return s.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>'); }

  function listaPersonas(lista) {
    var caja = nodo('<div class="iq-personas"></div>');
    lista.forEach(function (p) {
      var n = '';
      try { n = String(p.contacto || '').replace(/\D/g, ''); } catch (e) {}
      var fila = nodo('<div class="iq-per"><span class="iq-per-n"></span></div>');
      fila.querySelector('.iq-per-n').textContent = String(p.nombre || '').trim();
      if (n) {
        var bt = nodo('<button class="iq-per-wa" type="button" aria-label="Escribir por WhatsApp">' + WA + '</button>');
        bt.addEventListener('click', function () {
          window.open('https://wa.me/' + (n.length === 10 ? '57' + n : n), '_blank');
        });
        fila.appendChild(bt);
      }
      caja.appendChild(fila);
    });
    return caja;
  }

  function botonera(r) {
    var caja = nodo('<div class="iq-acts"></div>');

    var voz = nodo('<button class="iq-act iq-voz" type="button" aria-label="Escuchar la respuesta">' + BOCINA + ' Escuchar</button>');
    if (!(vozCfg && vozCfg.configurada)) voz.style.display = 'none';
    voz.addEventListener('click', function () {
      if (Repro.suena() && Repro.dueno() === voz) return Repro.parar();
      Repro.desbloquear();
      Repro.hablar(r.voz || r.texto, voz);
    });
    caja.appendChild(voz);

    var cop = nodo('<button class="iq-act" type="button">Copiar</button>');
    cop.addEventListener('click', function () {
      var t = (r.titulo ? r.titulo + '\n\n' : '') + String(r.texto || '').replace(/\*\*/g, '');
      try {
        navigator.clipboard.writeText(t);
        cop.textContent = 'Copiado ✓';
        setTimeout(function () { cop.textContent = 'Copiar'; }, 1600);
      } catch (e) { avisar('No se pudo copiar.'); }
    });
    caja.appendChild(cop);

    var wa = nodo('<button class="iq-act" type="button">' + WA + ' WhatsApp</button>');
    wa.addEventListener('click', function () { compartir(r); });
    caja.appendChild(wa);

    return caja;
  }

  /* WhatsApp sin número: abre el selector de contactos. Se recorta
     porque una URL gigante no la abre ni el móvil ni el web. */
  function compartir(r) {
    var cab = (r.titulo ? r.titulo + '\n\n' : '');
    var cuerpo = String(r.texto || '').replace(/\*\*/g, '*');
    var TOPE = 1500;
    if (cab.length + cuerpo.length > TOPE) {
      cuerpo = cuerpo.slice(0, TOPE - cab.length - 20).replace(/\s+\S*$/, '') + '…';
    }
    var t = encodeURIComponent(cab + cuerpo);
    var movil = /android|iphone|ipad|ipod/i.test(navigator.userAgent);
    window.open((movil ? 'whatsapp://send?text=' : 'https://api.whatsapp.com/send?text=') + t, '_blank');
  }

  /* Lectura automática: solo si el backend dice que hay clave y el
     interruptor de Configuración → Avanzado está en SÍ. */
  function leerSiToca(burbuja, texto) {
    pedirVoz().then(function (v) {
      if (!v || !v.configurada || !v.auto) return;
      if (!burbuja || !burbuja.parentNode) return;
      Repro.hablar(texto, burbuja.querySelector('.iq-voz'));
    });
  }

  /* ============================================================
     ARRANQUE
     ------------------------------------------------------------
     app.js expone showView; se envuelve (mismo patrón que usa
     js/configuracion.js) en vez de vigilar el DOM entero. Se deja
     además un respaldo por si alguna vista se activa sin pasar por
     showView.
     ============================================================ */
  var pendiente = null;
  function revisar() {
    if (pendiente) return;
    pendiente = setTimeout(function () {
      pendiente = null;
      if (PANELES[vistaActiva()] && haySesion()) montar(); else quitar();
    }, 90);
  }

  function arrancar() {
    var original = window.showView;
    if (typeof original === 'function') {
      window.showView = function () {
        var r = original.apply(this, arguments);
        revisar();
        return r;
      };
    }
    var login = window.procesarLoginExitoso_;
    if (typeof login === 'function') {
      window.procesarLoginExitoso_ = function () {
        var r = login.apply(this, arguments);
        revisar();
        return r;
      };
    }
    try {
      var raiz = document.getElementById('app') || document.body;
      new MutationObserver(function (muts) {
        for (var i = 0; i < muts.length; i++) {
          if (muts[i].type === 'attributes') { revisar(); return; }
        }
      }).observe(raiz, { attributes: true, attributeFilter: ['class'], subtree: true });
    } catch (e) {}
    window.addEventListener('hashchange', revisar);
    revisar();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', arrancar);
  else arrancar();

  /* Puerta trasera para las pruebas (la app no la usa) */
  window.__hac11 = {
    informe: informe, PANELES: PANELES, aHtml: aHtml, fecha: fecha,
    trocear: Repro.trocear, montar: montar, quitar: quitar, revisar: revisar,
    solicitudes: solicitudes, procFiltrado: procFiltrado, bdpFiltrado: bdpFiltrado,
    tiempos: tiempos, repetidosDoc: repetidosDoc, anioDeuda: anioDeuda,
    compartir: compartir, pct: pct,
    fab: function () { return fab; }, abierta: function () { return abierta; },
    abrir: abrir, cerrar: function () { if (cerrarHoja) cerrarHoja(); },
    vozCfg: function (v) { vozCfg = v; return vozCfg; }
  };
})();
