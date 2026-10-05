/************************************************************************
 *  VISOR ÚNICO DE DOCUMENTOS  (js/visor.js) — 04/10/2026
 *  ---------------------------------------------------------------------
 *  Un solo visor para TODA la app, el mismo de CONTRATACIÓN-FLANDES
 *  (kit/visor.js): ventana que se mueve, se minimiza y cambia de tamaño,
 *  anterior/siguiente, lista de todos los documentos del registro, zoom
 *  (botones, Ctrl + rueda, pellizco, doble clic) y botón AGREGAR cuando
 *  la vista lo ofrece.
 *
 *  Por qué ya no hay marco de Drive (/preview)
 *    Los documentos llevan datos personales y no se publican por enlace.
 *    Un marco de Drive solo se ve si el navegador le pasa a ese marco la
 *    sesión de Google de una cuenta con permiso; casi nunca la tiene
 *    (cookies de terceros), así que Drive manda al inicio de sesión y ese
 *    no se deja enmarcar ("frame-ancestors"). Además el visor de Drive
 *    registra 'unload', que Chrome ya no permite ("[Violation] unload").
 *    Ahora los bytes los entrega el backend (HACIENDA o ICA) con la API de
 *    Drive, se pintan aquí con pdf.js y quedan en memoria mientras el
 *    visor esté abierto. Nada se descarga al equipo ni se publica.
 *
 *  API
 *    VISOR.abrir(url, { nombre, agregar, lista, indice })   (compatible)
 *    VISOR.lista(items, { indice, agregar(doc, api), agregarTexto, fuente })
 *        item = { titulo, id | url, mime, detalle, cargar }
 *        fuente(id) → Promise {nombre, mime, b64}  (por defecto, HACIENDA)
 *    VISOR.carpeta(folderIdOUrl, op)   todos los archivos de una carpeta
 *    VISOR.cerrar() · VISOR.abierto() · VISOR.medidas()
 *
 *  Carga: después de kit/visor.js y de app.js.
 ************************************************************************/
(function () {
  'use strict';

  var K = window.KIT || {};
  function pieza() { return K.piezas && K.piezas.visor; }

  /* ══════════════ memoria de bytes (por id de Drive) ══════════════
     Volver a un documento ya visto es inmediato. Tope 40 MB. */
  var MEM = {}, ORDEN = [], PESO = 0, TOPE = 40 * 1024 * 1024;
  var PEND = {};
  var MEDIDAS = [];

  function guardar(id, v) {
    if (MEM[id]) return;
    MEM[id] = v; ORDEN.push(id); PESO += v.bytes.length;
    while (PESO > TOPE && ORDEN.length > 1) {
      var x = ORDEN.shift(); if (MEM[x]) { PESO -= MEM[x].bytes.length; delete MEM[x]; }
    }
  }
  function aBytes(b64) {
    var bin = atob(String(b64 || '').replace(/\s/g, ''));
    var n = bin.length, out = new Uint8Array(n);
    for (var k = 0; k < n; k++) out[k] = bin.charCodeAt(k);
    return out;
  }
  function tipoDe(mime, nombre) {
    var m = String(mime || '').toLowerCase(), n = String(nombre || '').toLowerCase();
    if (/^image\//.test(m) || /\.(png|jpe?g|webp|gif|bmp|avif)$/.test(n)) return 'imagen';
    if (/pdf/.test(m) || /\.pdf$/.test(n) || /google-apps\.(document|spreadsheet|presentation)/.test(m)) return 'pdf';
    return m ? 'otro' : '';
  }

  function uid() {
    try {
      if (typeof window.uidActual_ === 'function') { var u = window.uidActual_(); if (u) return u; }
      var p = (window.IDN && window.IDN.perfil) ? window.IDN.perfil() : null;
      if (p && p.uid) return p.uid;
    } catch (_) {}
    return '';
  }

  /** Bytes de HACIENDA (GET visordoc). Sin el cargando global: el visor
      enseña su propio "Abriendo el documento…" y la app sigue libre.
      Un reintento solo ante falla de red o el 404 de echo de Google.
      Backend anterior (sin la ruta): 'visorarchivo' (solo PDF/Docs). */
  function getHacienda(accion, params, n) {
    var base = String((window.MARCA && window.MARCA.API_URL) || '');
    if (!base || typeof fetch !== 'function') return Promise.reject(new Error('Sin conexión con el servidor.'));
    var qs = '?action=' + encodeURIComponent(accion);
    Object.keys(params || {}).forEach(function (k) { qs += '&' + k + '=' + encodeURIComponent(params[k]); });
    return fetch(base + qs, { cache: 'no-store' }).then(function (r) { return r.text(); }).then(function (t) {
      var j; try { j = JSON.parse(t); } catch (e) { var x = new Error('red'); x.red = true; throw x; }
      if (!j.ok) { var er = new Error(j.error || 'No se pudo abrir el documento.'); er.codigo = j.codigo || ''; throw er; }
      return j.data;
    }).catch(function (e) {
      if ((e instanceof TypeError || e.red) && !(n > 0)) return new Promise(function (res) { setTimeout(res, 900); }).then(function () { return getHacienda(accion, params, 1); });
      if (e instanceof TypeError || e.red) throw new Error('Sin conexión con el servidor. Revisa tu internet.');
      throw e;
    });
  }
  function fuenteHacienda(id) {
    return getHacienda('visordoc', { id: id }).then(function (r) {
      if (r && r.b64) return { nombre: r.nombre, mime: r.mime, b64: r.b64 };
      var e = new Error((r && r.motivo) || 'No se pudo abrir el documento.'); e.sinBytes = true; throw e;
    }, function (e) {
      if (!/acci[oó]n|action/i.test(String(e && e.message)) || typeof window.apiPost !== 'function') throw e;
      return window.apiPost('visorarchivo', { uid: uid(), id: id }).then(function (r) {
        if (r && r.imprimible && r.base64) return { nombre: r.nombre, mime: 'application/pdf', b64: r.base64 };
        throw new Error((r && r.motivo) || 'Este archivo no se puede ver aquí. Usa descargar.');
      });
    });
  }

  /** Pide (una sola vez) los bytes de un id con la fuente dada. */
  function bytesDe(id, fuente, nombre) {
    if (MEM[id]) return Promise.resolve(MEM[id]);
    if (PEND[id]) return PEND[id];
    var t0 = Date.now();
    PEND[id] = Promise.resolve(fuente(id)).then(function (r) {
      var bytes = r.bytes || aBytes(r.b64);
      var v = { nombre: r.nombre || nombre || 'documento', mime: r.mime || 'application/octet-stream', bytes: bytes };
      v.tipo = tipoDe(v.mime, v.nombre) || 'otro';
      guardar(id, v);
      MEDIDAS.push({ id: String(id).slice(0, 6), ms: Date.now() - t0, kb: Math.round(bytes.length / 1024) });
      if (MEDIDAS.length > 100) MEDIDAS.shift();
      delete PEND[id];
      return v;
    }, function (e) { delete PEND[id]; throw e; });
    return PEND[id];
  }

  /* ══════════════ qué es cada enlace ══════════════ */
  function idDrive(u) {
    var s = String(u || '').trim();
    if (!s) return '';
    if (/^[-\w]{20,}$/.test(s)) return s;
    var m = s.match(/\/file\/d\/([-\w]{20,})/) || s.match(/\/document\/d\/([-\w]{20,})/) ||
            s.match(/\/spreadsheets\/d\/([-\w]{20,})/) || s.match(/\/presentation\/d\/([-\w]{20,})/) ||
            s.match(/[?&]id=([-\w]{20,})/) || s.match(/googleusercontent\.com\/d\/([-\w]{20,})/) ||
            s.match(/\/d\/([-\w]{20,})/);
    return m ? m[1] : '';
  }
  function esCarpeta(u) { return /drive\.google\.com\/(drive\/)?(u\/\d+\/)?folders\/|[?&]folder/.test(String(u || '')); }
  function idCarpeta(u) { var m = String(u || '').match(/folders\/([-\w]{15,})/); return m ? m[1] : (/^[-\w]{15,}$/.test(String(u || '')) ? String(u) : ''); }
  function esImagenUrl(u) {
    var s = String(u || '').split('#')[0].split('?')[0];
    return /\.(png|jpe?g|webp|gif|bmp|avif)$/i.test(s) || /res\.cloudinary\.com/.test(String(u || ''));
  }

  /** Convierte lo que manda cada vista en un documento del visor. */
  function aDoc(it, fuente) {
    it = it || {};
    var titulo = it.titulo || it.nombre || it.name || 'Documento';
    var url = it.url || '';
    var id = it.id || idDrive(url);
    var d = { titulo: titulo, detalle: it.detalle || '', _ref: it };
    if (typeof it.cargar === 'function') { d.cargar = it.cargar; if (it.tipo) d.tipo = it.tipo; return d; }
    if (id && !esCarpeta(url)) {
      var f = it.fuente || fuente || fuenteHacienda;
      var t = tipoDe(it.mime, titulo);
      if (t) d.tipo = t;
      d.cargar = function () {
        return bytesDe(id, f, titulo).then(function (v) { return { nombre: v.nombre, mime: v.mime, bytes: v.bytes, tipo: v.tipo }; });
      };
      d._id = id; d._fuente = f;
      return d;
    }
    if (url && esImagenUrl(url)) { d.url = url; d.tipo = 'imagen'; return d; }
    if (url) { d.url = url; d.externo = true; return d; }
    return null;
  }

  /* Adelanta el siguiente documento de fondo (uno a la vez: la fila de
     Apps Script es de todos). Lo que la persona toca va primero. */
  var adelantando = false;
  function adelantar(docs, k) {
    if (adelantando) return;
    var d = docs[k];
    if (!d || !d._id || MEM[d._id] || PEND[d._id]) return;
    adelantando = true;
    bytesDe(d._id, d._fuente, d.titulo).then(null, function () {}).then(function () { adelantando = false; });
  }

  function lista(items, op) {
    op = op || {};
    var v = pieza();
    var docs = (items || []).map(function (it) { return aDoc(it, op.fuente); }).filter(Boolean);
    if (!docs.length) { aviso('Este registro no tiene archivos para mostrar.'); return false; }
    /* un enlace externo suelto (no de Drive) se abre como siempre */
    if (docs.length === 1 && docs[0].externo) { pestana(docs[0].url); return true; }
    docs = docs.filter(function (d) { return !d.externo; });
    if (!v) { return sinKit(docs, op); }
    /* el siguiente se adelanta al pedir cada uno */
    docs.forEach(function (d, j) {
      if (!d.cargar) return;
      var orig = d.cargar;
      d.cargar = function () { var p = orig(); p.then(function () { adelantar(docs, j + 1); }, function () {}); return p; };
    });
    var ag = op.agregar;
    v.abrir(docs, {
      indice: op.indice || 0,
      agregarTexto: op.agregarTexto,
      agregarAyuda: op.agregarAyuda,
      alCerrar: op.alCerrar,
      agregar: typeof ag === 'function' ? function (d, apiKit) {
        /* la vista recibe un api que entiende sus ítems (id/url/titulo) */
        var api = {
          lista: apiKit.lista, indice: apiKit.indice, cerrar: apiKit.cerrar,
          sumar: function (it, verlo) { var nd = aDoc(it, op.fuente); if (nd) apiKit.sumar(nd, verlo); }
        };
        return ag(d, api);
      } : null
    });
    try { if (window.BV && window.BV.sonar) window.BV.sonar((typeof SOUNDS !== 'undefined' && SOUNDS.info) || 'sound/default-notification.mp3'); } catch (_) {}
    return true;
  }

  /** Compatible con las llamadas de antes: VISOR.abrir(url, {nombre, agregar}). */
  function abrir(url, op) {
    op = op || {};
    if (op.lista && op.lista.length) return lista(op.lista, op);
    var u = String(url || '').trim();
    if (!u) { aviso('Este registro no tiene archivo para mostrar.'); return false; }
    if (esCarpeta(u)) return carpeta(u, op);
    return lista([{ url: u, titulo: op.nombre || 'Archivo', mime: op.mime }], op);
  }

  /** Todos los archivos de una carpeta (HACIENDA 'visorcarpeta'). */
  function carpeta(ref, op) {
    op = op || {};
    var id = idCarpeta(ref);
    if (!id) { pestana(ref); return true; }
    aviso('Buscando los documentos de la carpeta…', 'info', 2500);
    return getHacienda('visorcarpeta', { id: id }).then(function (r) {
      var fs = (r && r.archivos) || [];
      if (!fs.length) { aviso('La carpeta no tiene archivos.', 'aviso'); return false; }
      return lista(fs.map(function (f) { return { id: f.id, titulo: f.nombre, mime: f.mime, detalle: f.ruta || f.fecha || '' }; }), op);
    }, function (e) {
      /* backend anterior sin la ruta: la carpeta en Drive, como antes */
      if (/acci[oó]n|action|desconocid|no v[aá]lid/i.test(String(e && e.message))) { pestana(ref); return true; }
      aviso((e && e.message) || 'No se pudo leer la carpeta.', 'aviso');
      return false;
    });
  }

  /* ══════════════ sin kit (no debería pasar): pestaña ══════════════ */
  function sinKit(docs, op) {
    var d = docs[op.indice || 0] || docs[0];
    if (d && d._id) pestana('https://drive.google.com/file/d/' + d._id + '/view');
    else if (d && d.url) pestana(d.url);
    return true;
  }
  function pestana(u) {
    var w = window.open(u, '_blank', 'noopener');
    if (!w) aviso('El navegador bloqueó la pestaña nueva. Permite las ventanas emergentes.', 'aviso');
    return w;
  }
  function aviso(t, tipo, ms) {
    try { if (K.aviso) return K.aviso(t, tipo || 'info', ms || 3500); } catch (_) {}
    try { if (window.Swal) Swal.fire({ icon: 'info', text: t }); } catch (_) {}
  }

  function cerrar() { var v = pieza(); if (v && v.abierto()) v.cerrar(); }
  function abierto() { var v = pieza(); return !!(v && v.abierto()); }

  /** URL en memoria (blob) de un archivo de Drive privado: para miniaturas en línea. */
  function urlDe(id, fuente) {
    return bytesDe(id, fuente || fuenteHacienda, '').then(function (v) {
      if (!v._blobUrl) v._blobUrl = URL.createObjectURL(new Blob([v.bytes], { type: v.mime }));
      return v._blobUrl;
    });
  }

  window.VISOR = {
    abrir: abrir, lista: lista, carpeta: carpeta, cerrar: cerrar, abierto: abierto, urlDe: urlDe, bytes: bytesDe,
    medidas: function () { return MEDIDAS.slice(); },
    olvidar: function (id) { if (MEM[id]) { PESO -= MEM[id].bytes.length; delete MEM[id]; ORDEN = ORDEN.filter(function (x) { return x !== id; }); } },
    _id: idDrive, _tipo: tipoDe, _esCarpeta: esCarpeta,
    /* imprimir: el propio visor lo hace sobre los bytes (botón de la barra) */
    imprimir: function (id, nombre) { return lista([{ id: id, titulo: nombre || 'Documento' }], {}); }
  };

  /* Las imágenes también van al visor (zoom, arrastre); el lightbox viejo
     queda de respaldo si el kit no cargó. */
  var lbViejo = window.openLightbox_;
  window.openLightbox_ = function (src) {
    if (!pieza()) return typeof lbViejo === 'function' ? lbViejo(src) : pestana(src);
    var id = idDrive(src);
    return lista([id ? { id: id, titulo: 'Imagen', mime: 'image/jpeg' } : { url: src, titulo: 'Imagen' }], {});
  };

  window.abrirArchivo_ = function (url, nombre, agregar) { return abrir(url, { nombre: nombre, agregar: agregar }); };
})();
