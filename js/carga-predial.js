/* ============================================================
   SEC-HACIENDA-FLANDES · CARGA MASIVA A BD PREDIAL (27/11/2026)
   Solo ADMIN y DEV. Backend: HACIENDA Carga1127.gs (POST cargamasivapred).

   1) Descargar plantilla (plantillas/PLANTILLA_CARGA_PREDIAL.xlsx) o subir
      el Excel de trabajo del ADMIN con las mismas columnas:
      No., Ficha catastral, Matrícula, Propietario, C.C. / NIT, Correo
      electrónico, Dirección, Valor adeudado, Debe desde, Debe hasta.
   2) REVISIÓN fila por fila en el navegador, sin viajar: listas, avisos,
      errores y fichas que ya están en BD Predial (la lista ya está en
      memoria por la carga única de la vista).
   3) GRABAR en bloques de 200 con rid por bloque (un reintento devuelve lo
      mismo sin repetir). Cada bloque devuelve sus filas en el formato del
      listado y se parchan en memoria: la lista no se recarga.

   Reglas del ADMIN (27/11):
   · La llave es la FICHA. Ficha que ya está en la base: no se crea. Si esa
     ficha entró por una carga masiva (bitácora «CARGA MASIVA»), la nueva
     subida solo llena los campos que estén vacíos (p. ej. el correo).
   · Matrícula repetida en el archivo o que ya está en la base: se carga
     sin matrícula, con aviso. Matrícula rara: se carga como viene, con aviso.
   · Documento: sin ceros a la izquierda ni dígito de verificación; todo
     ceros (o vacío) queda 0.
   · Debe desde / hasta AAAA → AAAA01 (se acepta 1975).
   · Varios correos separados por espacio: el primero es del propietario y
     los demás van en copia. «DIAN» o un correo inválido se descarta.
   · Entra sin No. de expediente físico, actuación NINGUNA, estado NINGUNO,
     sustanciador NINGUNO, sin WhatsApp. Bitácora «CARGA MASIVA dd/mm/aaaa».
   ============================================================ */
(function (raiz) {
  'use strict';

  var BLOQUE = 200;
  var PLANTILLA = 'plantillas/PLANTILLA_CARGA_PREDIAL.xlsx';
  var LOCAL_XLSX = 'vendor/xlsx-0.18.5.full.min.js';
  var MARCA_CM = 'CARGA MASIVA';

  /* ══════════════ normalización (pura: también corre en node) ══════════════ */
  function sinTildes(s) {
    var t = String(s == null ? '' : s);
    try { t = t.normalize('NFD').replace(/[̀-ͯ]/g, ''); } catch (e) {}
    return t;
  }
  function clave(s) { return sinTildes(s).toUpperCase().replace(/[^A-Z0-9]/g, ''); }
  function txt(v) { return String(v == null ? '' : v).replace(/[ ​﻿]/g, ' ').replace(/\s+/g, ' ').trim(); }
  function digitos(v) { return String(v == null ? '' : v).replace(/\D/g, ''); }
  function correoOk(c) { return /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(c); }

  /** Columna de cada campo, por el nombre de la cabecera. */
  function columnas(cab) {
    var c = cab.map(clave);
    function col() {
      for (var a = 0; a < arguments.length; a++) for (var i = 0; i < c.length; i++) if (c[i].indexOf(arguments[a]) === 0) return i;
      return -1;
    }
    return {
      no: col('NO', 'N'), ficha: col('FICHA'), mat: col('MATRICULA'), nom: col('PROPIETARIO', 'NOMBRE'),
      doc: col('CCNIT', 'NIT', 'CC', 'DOCUMENTO', 'CEDULA'), cor: col('CORREO'), dir: col('DIRECCION'),
      valor: col('VALOR'), desde: col('DEBEDESDE', 'DESDE'), hasta: col('DEBEHASTA', 'HASTA', 'DEUDAHASTA')
    };
  }

  /** Busca la fila de cabecera (la primera con FICHA) en las 10 primeras. */
  function cabecera(filas) {
    for (var i = 0; i < Math.min(10, filas.length); i++) {
      var f = filas[i] || [];
      for (var j = 0; j < f.length; j++) if (clave(f[j]).indexOf('FICHA') === 0) return i;
    }
    return -1;
  }

  /** Documento: DV fuera, letras fuera, ceros a la izquierda fuera; todo ceros → 0. */
  function documento(raw, aj, av) {
    var s = txt(raw);
    if (!s) { av.push('Sin documento: queda 0'); return '0'; }
    var m = s.match(/^(\d[\d.\s]*)\s*-\s*(\d)$/);
    if (m) { s = m[1]; aj.dv = 1; }
    if (/[A-Za-z]/.test(s)) av.push('Documento «' + txt(raw) + '» con letras: se dejan solo los números');
    var d = digitos(s);
    var sin = d.replace(/^0+/, '');
    if (sin !== d) aj.ceros = 1;
    if (!sin) return '0';
    if (sin.length > 10) av.push('Documento de ' + sin.length + ' dígitos');
    return sin;
  }

  /** Año (AAAA) o AAAAMM → AAAAMM. */
  function vigencia(v, anioMax) {
    var d = digitos(v);
    if (/^\d{4}$/.test(d)) { var y = +d; return (y >= 1900 && y <= anioMax) ? d + '01' : ''; }
    if (/^\d{6}$/.test(d)) { var y2 = +d.slice(0, 4), mm = +d.slice(4); return (y2 >= 1900 && y2 <= anioMax && mm >= 1 && mm <= 12) ? d : ''; }
    return '';
  }

  /** Matrícula: { ok:'357-xxxxx' | raro | '', key } */
  function matricula(raw) {
    var s = txt(raw).toUpperCase();
    if (!s) return { val: '', key: '', rara: false };
    var m = s.match(/^357\s*-\s*(\d{1,7})$/);
    if (m) return { val: '357-' + m[1], key: m[1].replace(/^0+/, ''), rara: false };
    return { val: s, key: digitos(s.replace(/^357-/, '')).replace(/^0+/, ''), rara: true };
  }

  function valor(v) {
    if (typeof v === 'number') return Math.round(v);
    var s = String(v == null ? '' : v).replace(/[$\s]/g, '');
    if (/,\d{1,2}$/.test(s)) s = s.replace(/,\d{1,2}$/, '');
    return Number(s.replace(/\D/g, '')) || 0;
  }

  /**
   * filas: matriz del Excel (con cabecera). db: { fichas: {ficha: {id, cm}}, mats: {key: id} }.
   * Devuelve { items, resumen, error }.
   */
  function normalizar(filas, db, opc) {
    opc = opc || {};
    db = db || { fichas: {}, mats: {} };
    var anioMax = opc.anio || new Date().getFullYear();
    var h = cabecera(filas);
    if (h < 0) return { error: 'No encontré la columna «Ficha catastral». Usa la plantilla o un archivo con esas columnas.' };
    var c = columnas(filas[h]);
    var faltan = [];
    ['ficha', 'nom', 'doc', 'dir', 'valor', 'desde'].forEach(function (k) { if (c[k] < 0) faltan.push(k); });
    if (faltan.length) return { error: 'Al archivo le faltan columnas: ' + faltan.map(function (k) { return { ficha: 'Ficha catastral', nom: 'Propietario', doc: 'C.C. / NIT', dir: 'Dirección', valor: 'Valor adeudado', desde: 'Debe desde' }[k]; }).join(', ') + '.' };

    var items = [], vistasFicha = {}, cuentaMat = {};
    for (var i = h + 1; i < filas.length; i++) {
      var f = filas[i] || [];
      var v = function (k) { return c[k] >= 0 ? f[c[k]] : ''; };
      var vacia = true;
      for (var z = 0; z < f.length; z++) if (txt(f[z])) { vacia = false; break; }
      if (vacia) continue;
      /* pie del archivo («N.° de predios», «TOTALES»): el No. es texto */
      var no = txt(v('no'));
      if (c.no >= 0 && no && !/^\d+$/.test(no)) continue;
      if (!txt(v('ficha')) && !txt(v('nom'))) continue;

      var it = { fila: i + 1, no: no, d: {}, avisos: [], errores: [], aj: {}, estado: 'nuevo', id: '' };
      var d = it.d;

      /* ficha (la llave) */
      var fr = v('ficha');
      var fd = typeof fr === 'number' ? String(Math.round(fr)) : digitos(fr);
      if (typeof fr === 'number' && fd.length < 15) { fd = ('000000000000000' + fd).slice(-15); it.avisos.push('La ficha venía como número: se completó con ceros a 15 dígitos'); }
      if (!/^\d{12,15}$/.test(fd)) it.errores.push('Ficha catastral inválida (12 a 15 dígitos)');
      d.ficha = fd;

      /* propietario(s) y documento(s) */
      var nom = txt(v('nom')).toUpperCase();
      if (!nom) it.errores.push('Falta el propietario');
      var docRaw = txt(v('doc'));
      var noms = nom.split(/\s+\/\s+/), docs = docRaw.split(/\s+-\s+/);
      if (noms.length > 1 && noms.length === docs.length && docs.every(function (x) { return /\d/.test(x); })) {
        it.avisos.push(noms.length + ' propietarios');
      } else { noms = [nom]; docs = [docRaw]; }
      d.nom = noms; d.doc = docs.map(function (x) { return documento(x, it.aj, it.avisos); });

      /* correos: el primero al propietario, los demás en copia */
      var crudos = String(v('cor') == null ? '' : v('cor')).split(/[\s,;]+/).filter(Boolean);
      var buenos = [];
      crudos.forEach(function (x) {
        var cc = x.toLowerCase().replace(/^mailto:/, '');
        if (!correoOk(cc)) { it.avisos.push('Correo «' + x + '» descartado'); return; }
        if (buenos.indexOf(cc) === -1) buenos.push(cc);
      });
      if (buenos.length > 1) it.aj.copia = 1;
      d.cor = buenos;

      /* matrícula */
      var mt = matricula(v('mat'));
      d.mat = mt.val; it.matKey = mt.key;
      if (mt.rara) it.avisos.push('Matrícula rara «' + mt.val + '»: se carga como viene');
      if (mt.key) cuentaMat[mt.key] = (cuentaMat[mt.key] || 0) + 1;

      d.dir = txt(v('dir'));
      if (!d.dir) it.errores.push('Falta la dirección');
      d.valor = valor(v('valor'));
      if (!(d.valor > 0)) it.errores.push('Valor adeudado en 0 o vacío');
      d.desde = vigencia(v('desde'), anioMax);
      if (!d.desde) it.errores.push('Debe desde inválido (año AAAA)');
      var hs = c.hasta >= 0 ? txt(v('hasta')) : '';
      d.hasta = hs ? vigencia(hs, anioMax + 1) : String(anioMax) + '01';
      if (!d.hasta) it.errores.push('Debe hasta inválido (año AAAA)');
      if (d.desde && d.hasta && d.desde > d.hasta) it.errores.push('Debe desde es posterior a Debe hasta');

      /* ficha repetida en el archivo / ya en la base */
      if (fd && vistasFicha[fd]) it.errores.push('Ficha repetida en el archivo (fila ' + vistasFicha[fd] + ')');
      else if (fd) vistasFicha[fd] = it.fila;
      var ya = fd ? db.fichas[fd] : null;
      if (ya && !it.errores.length) { it.estado = ya.cm ? 'completar' : 'existe'; it.id = ya.id; }
      items.push(it);
    }

    /* matrícula repetida en el archivo o que ya está en la base: va sin matrícula */
    items.forEach(function (it) {
      if (!it.matKey || it.estado === 'existe') return;
      var enBase = db.mats[it.matKey];
      if (enBase && enBase !== it.id) { it.avisos.push('La matrícula ' + it.d.mat + ' ya está en ' + enBase + ': se carga sin matrícula'); it.d.mat = ''; it.matQuitada = 1; }
      else if (cuentaMat[it.matKey] > 1) { it.avisos.push('Matrícula ' + it.d.mat + ' repetida en el archivo: se carga sin matrícula'); it.d.mat = ''; it.matQuitada = 1; }
    });

    var r = { total: items.length, nuevos: 0, completar: 0, existe: 0, errores: 0, avisos: 0, dv: 0, ceros: 0, copia: 0, valor: 0 };
    items.forEach(function (it) {
      if (it.errores.length) { it.estado = 'error'; r.errores++; return; }
      r[it.estado === 'nuevo' ? 'nuevos' : it.estado]++;
      if (it.avisos.length) r.avisos++;
      if (it.aj.dv) r.dv++; if (it.aj.ceros) r.ceros++; if (it.aj.copia) r.copia++;
      if (it.estado === 'nuevo') r.valor += it.d.valor;
    });
    return { items: items, resumen: r };
  }

  /** Lo que viaja al servidor por fila (nombres, docs y correos alineados por línea). */
  function paraEnviar(it) {
    var d = it.d, nom = d.nom.slice(), doc = d.doc.slice(), cor = [];
    for (var k = 0; k < nom.length; k++) cor.push(k === 0 ? (d.cor[0] || '') : '');
    cor = cor.concat(d.cor.slice(1));          /* los demás en copia */
    while (cor.length && !cor[cor.length - 1]) cor.pop();
    return { i: it.fila, ficha: d.ficha, mat: d.mat, nom: nom.join('\n'), doc: doc.join('\n'), cor: cor.join('\n'),
      dir: d.dir, valor: d.valor, desde: d.desde, hasta: d.hasta, mq: it.matQuitada ? 1 : 0 };
  }

  var API = { normalizar: normalizar, paraEnviar: paraEnviar, BLOQUE: BLOQUE, MARCA_CM: MARCA_CM };
  if (typeof module !== 'undefined' && module.exports) { module.exports = API; return; }
  raiz.CARGAPRED = API;
  if (!raiz.document) return;

  /* ══════════════ la vista ══════════════ */
  var doc = raiz.document;
  var VISTA = 'view-bdp-carga';
  var S = { res: null, nombre: '', tab: 'todas', pag: 0, ocupado: false, rids: {}, hechos: {}, informe: [] };

  function $(id) { return doc.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function ico(n, t) { try { return raiz.ICO_ ? raiz.ICO_(n, t || 18) : ''; } catch (e) { return ''; } }
  function sonar(n) { try { if (typeof playSoundOnce === 'function' && typeof SOUNDS !== 'undefined' && SOUNDS[n]) playSoundOnce(SOUNDS[n]); } catch (e) {} }
  function perfil() { try { return (raiz.IDN && raiz.IDN.perfil()) || null; } catch (e) { return null; } }
  function esJefe() {
    var p = perfil(), r = (p && p.roles) || [];
    if (r.indexOf('ADMIN') !== -1 || r.indexOf('DEV') !== -1) return true;
    try { return !!(typeof currentUser !== 'undefined' && currentUser && currentUser.isSuper); } catch (e) { return false; }
  }
  function pesos(n) { return '$ ' + (Number(n) || 0).toLocaleString('es-CO'); }
  function N(n) { return (Number(n) || 0).toLocaleString('es-CO'); }
  function nuevoRid() { return 'cmp' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
  function lista() { try { return Array.isArray(__bdpListCache) ? __bdpListCache : []; } catch (e) { return []; } }
  function med(nombre, ms, extra) { try { (raiz.__cmpMed = raiz.__cmpMed || []).push({ que: nombre, ms: Math.round(ms), extra: extra || '' }); } catch (e) {} }
  function ahora() { return (raiz.performance && performance.now()) || Date.now(); }

  function cargarXlsx() {
    if (raiz.XLSX) return Promise.resolve(raiz.XLSX);
    return new Promise(function (ok, mal) {
      var s = doc.createElement('script'); s.src = LOCAL_XLSX; s.async = true;
      s.onload = function () { raiz.XLSX ? ok(raiz.XLSX) : mal(new Error('No cargó el lector de Excel.')); };
      s.onerror = function () { mal(new Error('No cargó el lector de Excel. Revisa tu internet.')); };
      doc.head.appendChild(s);
    });
  }

  /** Fichas y matrículas de la lista en memoria. */
  function base() {
    var fichas = {}, mats = {};
    lista().forEach(function (r) {
      var f = digitos(String(r.ficha_catastral || '').replace(/^'/, ''));
      if (f) fichas[f] = { id: String(r.id_predial || ''), cm: String(r.bitacora || '').toUpperCase().indexOf(MARCA_CM) !== -1 };
      var m = matricula(r.matricula);
      if (m.key && !mats[m.key]) mats[m.key] = String(r.id_predial || '');
    });
    return { fichas: fichas, mats: mats };
  }

  function montar() {
    if ($(VISTA)) return $(VISTA);
    var cont = doc.querySelector('.container') || doc.body;
    var sec = doc.createElement('section');
    sec.id = VISTA; sec.className = 'view';
    sec.innerHTML =
      '<div class="vista kit-ancho cmp">' +
        '<div class="cmp-pasos">' +
          '<div class="cmp-paso"><span class="cmp-paso__n">1</span><div><b>Llena la plantilla</b><p>Una fila por ficha catastral. Las columnas grises se llenan solas.</p>' +
            '<a class="kit-btn" href="' + PLANTILLA + '" download data-salida="1">' + ico('descargar') + ' Descargar plantilla</a></div></div>' +
          '<div class="cmp-paso"><span class="cmp-paso__n">2</span><div><b>Sube el Excel</b><p>La app revisa cada fila aquí mismo, antes de grabar nada.</p>' +
            '<label class="kit-btn kit-btn--marca cmp-subir">' + ico('subir') + ' Subir Excel<input type="file" accept=".xlsx,.xls,.csv" hidden data-cmp-file></label></div></div>' +
          '<div class="cmp-paso"><span class="cmp-paso__n">3</span><div><b>Graba</b><p>En bloques de ' + BLOQUE + '. Entran sin expediente físico, sin actuación ni sustanciador, y sin WhatsApp.</p></div></div>' +
        '</div>' +
        '<div id="cmp-res" class="cmp-res" aria-live="polite"></div>' +
        '<button type="button" class="hf-atras" hidden>Regresar</button>' +
      '</div>';
    cont.appendChild(sec);
    sec.querySelector('.hf-atras').addEventListener('click', function () {
      if (S.ocupado) { try { K.aviso('Espera a que termine de grabar.', 'aviso', 3000); } catch (e) {} return; }
      sonar('back');
      if (typeof abrirBDPredial_ === 'function') abrirBDPredial_(); else if (typeof showView === 'function') showView('view-bd-predial');
    });
    sec.querySelector('[data-cmp-file]').addEventListener('change', function () {
      var file = this.files[0]; this.value = '';
      if (file) leer(file);
    });
    sec.addEventListener('click', function (e) {
      var t = e.target.closest('[data-cmp-tab]');
      if (t) { S.tab = t.getAttribute('data-cmp-tab'); S.pag = 0; pintarTabla(); return; }
      var p = e.target.closest('[data-cmp-pag]');
      if (p) { S.pag = Math.max(0, S.pag + Number(p.getAttribute('data-cmp-pag'))); pintarTabla(); return; }
      if (e.target.closest('[data-cmp-grabar]')) grabar(e.target.closest('[data-cmp-grabar]'));
      if (e.target.closest('[data-cmp-informe]')) informe();
    });
    return sec;
  }

  function abrir() {
    if (!esJefe()) { try { Swal.fire({ icon: 'warning', title: 'Solo ADMIN o DEV' }); } catch (e) {} return; }
    montar();
    if (typeof showView === 'function') showView(VISTA);
    if (!S.res && !S.ocupado) $('cmp-res').innerHTML = '';
    /* la revisión compara contra la lista: si no está en memoria se trae de fondo */
    if (!lista().length && typeof loadBDPredial_ === 'function') {
      try { loadBDPredial_(); } catch (e) {}
    }
  }

  function esperarLista() {
    var t0 = Date.now();
    return new Promise(function (ok) {
      (function mirar() {
        if (lista().length || Date.now() - t0 > 30000) return ok();
        setTimeout(mirar, 300);
      })();
    });
  }

  function leer(file) {
    if (S.ocupado) return;
    var t0 = ahora();
    S.nombre = file.name; S.res = null; S.hechos = {}; S.rids = {}; S.informe = [];
    $('cmp-res').innerHTML = '<div class="cmp-cargando">' + ico('reloj') + ' Leyendo ' + esc(file.name) + '…</div>';
    Promise.all([cargarXlsx(), file.arrayBuffer(), esperarLista()]).then(function (x) {
      var X = x[0], wb = X.read(x[1], { type: 'array', cellText: false, cellDates: false });
      var hoja = wb.SheetNames.filter(function (n) { return !/INSTRUC|LISTA/i.test(n); })[0] || wb.SheetNames[0];
      var filas = X.utils.sheet_to_json(wb.Sheets[hoja], { header: 1, raw: true, defval: '' });
      if (!lista().length) throw new Error('No se pudo traer BD Predial para comparar. Revisa la conexión y vuelve a subir el archivo.');
      var res = normalizar(filas, base(), { anio: Number(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date()).slice(0, 4)) });
      if (res.error) throw new Error(res.error);
      S.res = res; S.tab = res.resumen.errores ? 'errores' : 'todas'; S.pag = 0;
      med('revision', ahora() - t0, res.resumen.total + ' filas');
      pintar();
    }).catch(function (e) {
      $('cmp-res').innerHTML = '<p class="cmp-err">' + ico('aviso') + ' ' + esc(e.message || e) + '</p>';
    });
  }

  function porGrabar() { return S.res ? S.res.items.filter(function (it) { return (it.estado === 'nuevo' || it.estado === 'completar') && !S.hechos[it.fila]; }) : []; }

  function pintar() {
    var r = S.res.resumen, pend = porGrabar();
    var kpi = function (n, t, cls, i) { return '<div class="cmp-kpi' + (cls ? ' cmp-kpi--' + cls : '') + '">' + ico(i, 18) + '<b>' + N(n) + '</b><span>' + t + '</span></div>'; };
    var aj = [];
    if (r.dv) aj.push(N(r.dv) + ' documentos sin dígito de verificación');
    if (r.ceros) aj.push(N(r.ceros) + ' sin ceros a la izquierda');
    if (r.copia) aj.push(N(r.copia) + ' con correos en copia');
    $('cmp-res').innerHTML =
      '<div class="cmp-cab"><div><b>' + esc(S.nombre) + '</b><span>' + N(r.total) + ' filas · ' + pesos(r.valor) + ' en los expedientes nuevos</span></div>' +
        '<div class="cmp-acc">' +
          (S.informe.length ? '<button type="button" class="kit-btn" data-cmp-informe>' + ico('excel') + ' Descargar resultado</button>' : '') +
          '<button type="button" class="kit-btn kit-btn--marca" data-cmp-grabar' + (pend.length ? '' : ' hidden') + '>' + ico('check') + ' Grabar ' + N(pend.length) + '</button>' +
        '</div></div>' +
      '<div class="cmp-kpis">' +
        kpi(r.nuevos, 'expedientes nuevos', 'ok', 'mas') +
        (r.completar ? kpi(r.completar, 'de cargas anteriores: se llenan los campos vacíos', '', 'girar') : '') +
        kpi(r.existe, 'ya están en BD Predial (no se crean)', '', 'base-datos') +
        kpi(r.avisos, 'con aviso (sí se cargan)', r.avisos ? 'aviso' : '', 'aviso') +
        kpi(r.errores, 'con error (no se cargan)', r.errores ? 'malo' : '', 'cerrar') +
      '</div>' +
      (aj.length ? '<p class="cmp-nota">' + ico('info', 16) + ' Ajustes automáticos: ' + aj.join(' · ') + '.</p>' : '') +
      '<div id="cmp-prog" class="cmp-prog" hidden><div class="cmp-prog__barra"><i></i></div><span></span></div>' +
      '<div class="cmp-tabs" role="tablist">' +
        tab('todas', 'Todas', r.total) + tab('avisos', 'Con aviso', r.avisos) + tab('errores', 'Con error', r.errores) +
        tab('existe', 'Ya existen', r.existe + r.completar) + (S.informe.length ? tab('hechos', 'Grabadas', Object.keys(S.hechos).length) : '') +
      '</div>' +
      '<div id="cmp-tabla"></div>';
    pintarTabla();
  }
  function tab(id, t, n) { return '<button type="button" role="tab" data-ini class="cmp-tab' + (S.tab === id ? ' activa' : '') + '" data-cmp-tab="' + id + '" data-salida="1" aria-selected="' + (S.tab === id) + '">' + t + ' <span>' + N(n) + '</span></button>'; }

  var ESTADO = { nuevo: ['Nuevo', 'ok'], completar: ['Completa vacíos', ''], existe: ['Ya existe', ''], error: ['Error', 'malo'] };
  function filtrar() {
    var its = S.res.items;
    if (S.tab === 'avisos') return its.filter(function (x) { return x.estado !== 'error' && x.avisos.length; });
    if (S.tab === 'errores') return its.filter(function (x) { return x.estado === 'error'; });
    if (S.tab === 'existe') return its.filter(function (x) { return x.estado === 'existe' || x.estado === 'completar'; });
    if (S.tab === 'hechos') return its.filter(function (x) { return S.hechos[x.fila]; });
    return its;
  }
  function pintarTabla() {
    var el = $('cmp-tabla'); if (!el || !S.res) return;
    doc.querySelectorAll('#' + VISTA + ' .cmp-tab').forEach(function (b) { var a = b.getAttribute('data-cmp-tab') === S.tab; b.classList.toggle('activa', a); b.setAttribute('aria-selected', a); });
    var its = filtrar(), TAM = 100, pags = Math.max(1, Math.ceil(its.length / TAM));
    if (S.pag >= pags) S.pag = pags - 1;
    var ver = its.slice(S.pag * TAM, S.pag * TAM + TAM);
    if (!its.length) { el.innerHTML = '<p class="cmp-vacio">Nada en esta pestaña.</p>'; return; }
    el.innerHTML = '<div class="cmp-tabla"><table><thead><tr><th>Fila</th><th>Ficha</th><th>Propietario</th><th class="cmp-num">Valor</th><th>Estado</th><th>Detalle</th></tr></thead><tbody>' +
      ver.map(function (it) {
        var h = S.hechos[it.fila], e = h ? [h.t, h.c] : (ESTADO[it.estado] || ['', '']);
        var det = it.errores.concat(it.avisos);
        if (it.estado === 'existe') det.unshift('Ya está como ' + it.id + ': no se toca');
        if (it.estado === 'completar' && !h) det.unshift(it.id + ' entró por carga masiva: se llenan solo sus campos vacíos');
        if (h && h.det) det.unshift(h.det);
        return '<tr><td>' + it.fila + '</td><td class="cmp-mono">' + esc(it.d.ficha) + '</td><td>' + esc(it.d.nom.join(' / ')) + '</td><td class="cmp-num">' + pesos(it.d.valor) + '</td>' +
          '<td><span class="cmp-est' + (e[1] ? ' cmp-est--' + e[1] : '') + '">' + esc(e[0]) + '</span></td><td class="cmp-det">' + esc(det.join(' · ')) + '</td></tr>';
      }).join('') + '</tbody></table></div>' +
      (pags > 1 ? '<div class="cmp-pag"><button type="button" class="kit-btn" data-cmp-pag="-1" data-salida="1"' + (S.pag ? '' : ' disabled') + '>' + ico('atras', 16) + ' Anterior</button><span>Página ' + (S.pag + 1) + ' de ' + pags + '</span>' +
        '<button type="button" class="kit-btn" data-cmp-pag="1" data-salida="1"' + (S.pag < pags - 1 ? '' : ' disabled') + '>Siguiente</button></div>' : '');
  }

  /* ══════════════ grabar ══════════════ */
  function reintentable(e) {
    if (!e) return false;
    if (e.name === 'TypeError' || e.name === 'SyntaxError') return true;
    return /Failed to fetch|NetworkError|404|Unexpected token/i.test(String(e.message || ''));
  }
  function enviar(cuerpo, intento) {
    return raiz.apiPost('cargamasivapred', cuerpo).catch(function (e) {
      if ((intento || 0) < 1 && reintentable(e)) return enviar(cuerpo, 1);   /* mismo rid */
      throw e;
    });
  }

  function progreso(hechas, total, txtP) {
    var p = $('cmp-prog'); if (!p) return;
    p.hidden = false;
    p.querySelector('i').style.transform = 'scaleX(' + (total ? hechas / total : 0) + ')';
    p.querySelector('span').textContent = txtP;
  }

  function grabar(btn) {
    if (S.ocupado || btn.disabled) return;
    var pend = porGrabar();
    if (!pend.length) return;
    var conf = (typeof Swal !== 'undefined') ? Swal.fire({ icon: 'question', title: 'Grabar en BD Predial',
      html: '<b>' + N(pend.length) + '</b> filas en bloques de ' + BLOQUE + '.<br>No se envía WhatsApp. Mientras graba no cierres la app.',
      showCancelButton: true, confirmButtonText: 'Grabar', cancelButtonText: 'Cancelar' }) : Promise.resolve({ isConfirmed: true });
    conf.then(function (ok) {
      if (!ok.isConfirmed) return;
      S.ocupado = true; btn.disabled = true; btn.classList.add('cmp-ocupado');
      btn.innerHTML = ico('reloj') + ' Grabando…';
      var bloques = [];
      for (var i = 0; i < pend.length; i += BLOQUE) bloques.push(pend.slice(i, i + BLOQUE));
      var hechas = 0, t0 = ahora(), cuenta = { creado: 0, completado: 0, igual: 0, existe: 0, error: 0 };
      progreso(0, pend.length, 'Bloque 1 de ' + bloques.length + '…');
      var cadena = bloques.reduce(function (p, bl, k) {
        return p.then(function () {
          var llave = bl[0].fila + '-' + bl[bl.length - 1].fila;
          var rid = S.rids[llave] || (S.rids[llave] = nuevoRid());
          var tb = ahora();
          return enviar({ rid: rid, filas: bl.map(paraEnviar) }).then(function (res) {
            med('bloque ' + (k + 1), ahora() - tb, (res && res.ms ? 'servidor ' + res.ms + ' ms' : '') + (res && res.kb ? ' · ' + res.kb + ' KB' : ''));
            aplicar(res, bl, cuenta);
            hechas += bl.length;
            progreso(hechas, pend.length, N(hechas) + ' de ' + N(pend.length) + (k + 1 < bloques.length ? ' · bloque ' + (k + 2) + ' de ' + bloques.length + '…' : ''));
          });
        });
      }, Promise.resolve());
      cadena.then(function () {
        med('grabado total', ahora() - t0, pend.length + ' filas');
        fin(btn, cuenta, null);
      }, function (e) { fin(btn, cuenta, e); });
    });
  }

  var TXT = { creado: ['Creado', 'ok'], completado: ['Completado', 'ok'], igual: ['Sin cambios', ''], existe: ['Ya existe', ''], error: ['No se grabó', 'malo'] };
  function aplicar(res, bl, cuenta) {
    res = res || {};
    var porFila = {};
    bl.forEach(function (it) { porFila[it.fila] = it; });
    (res.res || []).forEach(function (x) {
      var it = porFila[x[0]]; if (!it) return;
      var est = x[1], t = TXT[est] || ['', ''];
      S.hechos[it.fila] = { t: t[0], c: t[1], det: x[3] || '' };
      cuenta[est] = (cuenta[est] || 0) + 1;
      if (x[2]) it.id = x[2];
      S.informe.push({ fila: it.fila, ficha: it.d.ficha, id: x[2] || '', estado: t[0], detalle: [x[3] || ''].concat(it.avisos).filter(Boolean).join(' · ') });
    });
    parchar(res.lista);
  }

  /** Las filas nuevas o completadas entran a la lista en memoria (un solo repintado). */
  function parchar(l) {
    if (!l || !l.campos || !l.filas || !l.filas.length) return;
    var cache = lista(), porId = {};
    cache.forEach(function (r, i) { porId[String(r.id_predial)] = i; });
    var nuevas = [];
    l.filas.forEach(function (f) {
      var o = {}; for (var c = 0; c < l.campos.length; c++) o[l.campos[c]] = f[c];
      var i = porId[String(o.id_predial)];
      var row = i !== undefined ? Object.assign(cache[i], o) : o;
      row.__completa = false;
      try { row.__searchBlob = bdpBlob_(row); } catch (e) {}
      if (i === undefined) nuevas.push(row);
    });
    if (nuevas.length) Array.prototype.unshift.apply(cache, nuevas.reverse());
    S.parchado = true;
  }

  function fin(btn, cuenta, err) {
    S.ocupado = false; btn.classList.remove('cmp-ocupado'); btn.disabled = false;
    /* la copia del equipo se rehace en la próxima apertura (regla: se limpia el recuerdo local) */
    if (S.parchado) { try { raiz.PREDSYNC && raiz.PREDSYNC.borrar(); } catch (e) {} try { applyBDPredialFilters_(); } catch (e) {} S.parchado = false; }
    S.tab = 'hechos'; S.pag = 0;
    pintar();
    var partes = [];
    if (cuenta.creado) partes.push('<b>' + N(cuenta.creado) + '</b> creados');
    if (cuenta.completado) partes.push('<b>' + N(cuenta.completado) + '</b> completados');
    if (cuenta.igual) partes.push(N(cuenta.igual) + ' sin cambios');
    if (cuenta.existe) partes.push(N(cuenta.existe) + ' ya existían');
    if (cuenta.error) partes.push(N(cuenta.error) + ' no se grabaron');
    var msg = partes.join(' · ') || 'Nada que grabar';
    $('cmp-res').insertAdjacentHTML('afterbegin', err
      ? '<p class="cmp-err">' + ico('aviso') + ' ' + esc(err.message || err) + '. ' + msg + '. Vuelve a tocar Grabar: lo ya grabado no se repite.</p>'
      : '<p class="cmp-ok">' + ico('check') + ' ' + msg + '.</p>');
    sonar(err ? 'error' : 'success');
  }

  function informe() {
    cargarXlsx().then(function (X) {
      var filas = [['Fila', 'Ficha catastral', 'ID', 'Resultado', 'Detalle']].concat(S.informe.map(function (x) { return [x.fila, x.ficha, x.id, x.estado, x.detalle]; }));
      (S.res ? S.res.items : []).forEach(function (it) {
        if (it.estado === 'error' || (it.estado === 'existe' && !S.hechos[it.fila])) filas.push([it.fila, it.d.ficha, it.id, it.estado === 'error' ? 'Error' : 'Ya existe', it.errores.concat(it.avisos).join(' · ')]);
      });
      var wb = X.utils.book_new(), ws = X.utils.aoa_to_sheet(filas);
      ws['!cols'] = [{ wch: 6 }, { wch: 18 }, { wch: 13 }, { wch: 14 }, { wch: 90 }];
      X.utils.book_append_sheet(wb, ws, 'RESULTADO');
      X.writeFile(wb, 'RESULTADO_CARGA_MASIVA_' + new Date().toISOString().slice(0, 10) + '.xlsx');
    }).catch(function (e) { try { K.aviso(e.message, 'malo', 4000); } catch (_) {} });
  }

  /* ══════════════ el botón en BD Predial ══════════════ */
  function boton() {
    var hb = doc.querySelector('#view-bd-predial .hf-herramientas');
    if (!hb) return;
    var b = $('btn-bdp-carga');
    if (!b) {
      b = doc.createElement('button');
      b.type = 'button'; b.id = 'btn-bdp-carga'; b.className = 'kit-btn';
      b.innerHTML = ico('subir') + ' Carga masiva';
      b.addEventListener('click', function () { sonar('menu'); abrir(); });
      var ag = $('btn-bdp-agregar');
      if (ag && ag.nextSibling) hb.insertBefore(b, ag.nextSibling); else hb.appendChild(b);
    }
    b.style.display = esJefe() ? '' : 'none';
  }
  function arrancar() {
    boton();
    var v = $('view-bd-predial');
    if (v && raiz.MutationObserver) new MutationObserver(function () { if (v.classList.contains('active')) boton(); }).observe(v, { attributes: true, attributeFilter: ['class'] });
  }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', arrancar); else arrancar();

  raiz.CARGAPRED.abrir = abrir;
  raiz.CARGAPRED._estado = function () { return S; };
})(typeof window !== 'undefined' ? window : this);
