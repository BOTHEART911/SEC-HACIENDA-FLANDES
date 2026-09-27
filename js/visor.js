/************************************************************************
 *  FASE 8 — VISOR DE ARCHIVOS  (js/visor.js)
 *  ---------------------------------------------------------------------
 *  Un solo visor para TODA la app. Antes cada sitio hacía window.open y el
 *  usuario terminaba con media docena de pestañas de Drive abiertas.
 *
 *  window.VISOR.abrir(url, { nombre })
 *    · Imagen            → se manda al lightbox que ya existe (openLightbox_).
 *    · Archivo de Drive  → modal sobre la app, con scroll, y tres botones:
 *                          abrir en pestaña · descargar · imprimir.
 *    · Cualquier otra    → pestaña nueva (no se rompe nada).
 *
 *  IMPRIMIR: el iframe de Drive es de otro origen y el navegador no deja
 *  llamar print() sobre él. Por eso se le pide el PDF al backend
 *  (acción visorarchivo, Visor.gs), se arma un blob del MISMO origen y ese
 *  sí se imprime. Si el archivo no es imprimible (Word, imágenes) o pesa
 *  demasiado, se cae a abrir el visor de Drive, que trae su propia
 *  impresión: nunca se queda el usuario sin salida.
 *
 *  Carga: después de app.js y de base-visual.js (usa BV._cierres).
 ************************************************************************/
(function () {
  'use strict';

  var ID_MODAL   = 'modal-visor';
  var ID_MARCO   = 'visor-marco';
  var ID_IFRAME  = 'visor-iframe';
  var ID_TITULO  = 'visor-titulo';
  var ID_CERRAR  = 'btn-visor-cerrar';
  var ID_NOTA    = 'visor-nota';

  var actual = { id: '', url: '', nombre: '', agregar: null };
  var imprimiendo = false;
  var urlBlob = '';

  function $(id) { return document.getElementById(id); }

  function avisar(icono, titulo, texto) {
    if (window.Swal) Swal.fire({ icon: icono, title: titulo, text: texto });
    else if (icono === 'error') console.warn(titulo + ': ' + texto);
  }

  function uid() {
    try {
      if (typeof window.uidActual_ === 'function') {
        var u = window.uidActual_();
        if (u) return u;
      }
      var p = (window.IDN && window.IDN.perfil) ? window.IDN.perfil() : null;
      if (p && p.uid) return p.uid;
    } catch (_) {}
    return '';
  }

  /* ══════════════ qué clase de enlace es ══════════════ */

  function idDrive_(u) {
    var s = String(u || '').trim();
    if (!s) return '';
    if (/^[-\w]{20,}$/.test(s)) return s;
    var m = s.match(/\/file\/d\/([-\w]{20,})/) ||
            s.match(/[?&]id=([-\w]{20,})/) ||
            s.match(/\/d\/([-\w]{20,})/);
    return m ? m[1] : '';
  }

  function esCarpeta_(u) {
    return /drive\.google\.com\/(drive\/)?(u\/\d+\/)?folders\//.test(String(u || ''));
  }

  function esImagen_(u) {
    var s = String(u || '').split('#')[0].split('?')[0];
    if (/\.(png|jpe?g|webp|gif|bmp|avif)$/i.test(s)) return true;
    /* Cloudinary y las fotos servidas por Google también son imágenes */
    if (/res\.cloudinary\.com|googleusercontent\.com/.test(String(u || ''))) return true;
    return false;
  }

  function urlPreview_(id) {
    return 'https://drive.google.com/file/d/' + id + '/preview';
  }
  function urlVista_(id) {
    return 'https://drive.google.com/file/d/' + id + '/view';
  }
  function urlDescarga_(id) {
    return 'https://drive.google.com/uc?export=download&id=' + id;
  }

  function pestana_(u) {
    var w = window.open(u, '_blank', 'noopener');
    if (!w) avisar('info', 'Permite las ventanas emergentes',
                   'El navegador bloqueó la pestaña nueva.');
    return w;
  }

  /* ══════════════ el modal ══════════════ */

  function crear_() {
    if ($(ID_MODAL)) return;

    var capa = document.createElement('div');
    capa.id = ID_MODAL;
    capa.className = 'hidden';
    capa.setAttribute('role', 'dialog');
    capa.setAttribute('aria-modal', 'true');
    capa.innerHTML =
      '<div class="visor-caja">' +
        '<div class="visor-cab">' +
          '<span class="visor-icono" aria-hidden="true">📄</span>' +
          '<h3 id="' + ID_TITULO + '" class="visor-titulo">Archivo</h3>' +
          '<button type="button" id="' + ID_CERRAR + '" class="visor-x" aria-label="Cerrar">✕</button>' +
        '</div>' +
        '<div id="' + ID_MARCO + '" class="visor-marco">' +
          '<iframe id="' + ID_IFRAME + '" src="" title="Vista del archivo" ' +
                  'allow="autoplay" referrerpolicy="no-referrer"></iframe>' +
        '</div>' +
        '<p id="' + ID_NOTA + '" class="visor-nota"></p>' +
        '<div class="visor-acciones">' +
          /* FASE 9: se agrega el archivo que se está mirando al expediente.
             Solo aparece cuando quien abre el visor pasa opciones.agregar. */
          '<button type="button" class="visor-acc visor-acc-ok hidden" id="btn-visor-agregar">＋ Agregar</button>' +
          '<button type="button" class="visor-acc" id="btn-visor-descargar">⬇ Descargar</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(capa);

    $(ID_CERRAR).addEventListener('click', cerrar);
    $('btn-visor-descargar').addEventListener('click', function () {
      if (actual.id) pestana_(urlDescarga_(actual.id));
      else if (actual.url) pestana_(actual.url);
    });
    /* FASE 9 · ajuste 4 — "Abrir en pestaña" e "Imprimir" salieron de la fila:
       la propia previsualización de Drive ya trae su botón para abrir el
       archivo en ventana aparte, y esos dos abrían pestañas que el navegador
       bloqueaba ("Permite las ventanas emergentes"). La impresión de verdad
       sigue disponible por código: VISOR.imprimir(id, nombre). */
    $('btn-visor-agregar').addEventListener('click', function () {
      if (typeof actual.agregar === 'function') actual.agregar(actual.url, actual.nombre);
    });

    /* Clic fuera y Escape los maneja la Fase 3 (base-visual). Se registra
       aquí en caliente para no tocar el mapa CIERRES a mano. */
    try {
      if (window.BV && window.BV._cierres) window.BV._cierres[ID_MODAL] = [ID_CERRAR];
    } catch (_) {}
  }

  function nota_(texto) {
    var el = $(ID_NOTA);
    if (el) el.textContent = texto || '';
  }

  function abrir(url, opciones) {
    opciones = opciones || {};
    var u = String(url || '').trim();
    if (!u) {
      avisar('info', 'Sin archivo', 'Este registro no tiene archivo para mostrar.');
      return false;
    }

    /* 1) Imágenes: ya hay lightbox desde antes, no se duplica */
    if (esImagen_(u) && typeof window.openLightbox_ === 'function') {
      window.openLightbox_(u);
      return true;
    }

    /* 2) Carpetas: el visor no muestra carpetas */
    if (esCarpeta_(u)) { pestana_(u); return true; }

    var id = idDrive_(u);
    if (!id) { pestana_(u); return true; }      /* enlace externo */

    crear_();
    actual = {
      id: id, url: u,
      nombre: opciones.nombre || 'Archivo',
      agregar: (typeof opciones.agregar === 'function') ? opciones.agregar : null
    };
    var bAgr = $('btn-visor-agregar');
    if (bAgr) bAgr.classList.toggle('hidden', !actual.agregar);

    $(ID_TITULO).textContent = actual.nombre;
    $(ID_TITULO).title = actual.nombre;
    nota_('');
    var marco = $(ID_IFRAME);
    marco.setAttribute('src', urlPreview_(id));

    $(ID_MODAL).classList.remove('hidden');
    document.body.classList.add('visor-abierto');
    try { if (window.BV && window.BV.sonar) window.BV.sonar('info'); } catch (_) {}
    return true;
  }

  function cerrar() {
    var m = $(ID_MODAL);
    if (!m) return;
    m.classList.add('hidden');
    document.body.classList.remove('visor-abierto');
    var f = $(ID_IFRAME);
    if (f) f.setAttribute('src', '');           /* corta la carga y el audio */
    actual = { id: '', url: '', nombre: '', agregar: null };
    nota_('');
    soltarBlob_();
  }

  function abierto() {
    var m = $(ID_MODAL);
    return !!(m && !m.classList.contains('hidden'));
  }

  /* ══════════════ imprimir de verdad ══════════════ */

  function soltarBlob_() {
    if (!urlBlob) return;
    try { URL.revokeObjectURL(urlBlob); } catch (_) {}
    urlBlob = '';
    var vieja = $('visor-print-frame');
    if (vieja && vieja.parentNode) vieja.parentNode.removeChild(vieja);
  }

  function base64ABlob_(b64, mime) {
    var bruto = atob(String(b64 || ''));
    var n = bruto.length;
    var bytes = new Uint8Array(n);
    for (var i = 0; i < n; i++) bytes[i] = bruto.charCodeAt(i);
    return new Blob([bytes], { type: mime || 'application/pdf' });
  }

  function caerAPestana_(id, motivo) {
    if (motivo) nota_(motivo);
    if (id) pestana_(urlVista_(id));
  }

  function imprimir(id, nombre) {
    id = id || actual.id;
    if (!id) { avisar('warning', 'Sin archivo abierto', ''); return; }
    if (imprimiendo) return;

    var u = uid();
    if (!u) {                       /* sin sesión no hay endpoint que valga */
      caerAPestana_(id, 'Sin sesión: se abre el visor de Drive para imprimir.');
      return;
    }
    if (typeof window.apiPost !== 'function') {
      caerAPestana_(id, 'Se abre el visor de Drive para imprimir.');
      return;
    }

    imprimiendo = true;
    var btn = $('btn-visor-imprimir');
    var textoBtn = btn ? btn.textContent : '';
    if (btn) { btn.disabled = true; btn.textContent = '🖨 Preparando…'; }
    nota_('Preparando la impresión…');

    window.apiPost('visorarchivo', { uid: u, id: id }).then(function (res) {
      if (!res || !res.imprimible) {
        caerAPestana_(id, (res && res.motivo) ? res.motivo + ' Se abre el visor de Drive.'
                                              : 'Se abre el visor de Drive para imprimir.');
        return;
      }
      soltarBlob_();
      urlBlob = URL.createObjectURL(base64ABlob_(res.base64, 'application/pdf'));

      var marco = document.createElement('iframe');
      marco.id = 'visor-print-frame';
      marco.style.position = 'fixed';
      marco.style.width = '1px';
      marco.style.height = '1px';
      marco.style.opacity = '0';
      marco.style.border = '0';
      marco.style.left = '-9999px';
      marco.setAttribute('aria-hidden', 'true');
      marco.src = urlBlob;

      var lanzado = false;
      marco.onload = function () {
        if (lanzado) return;
        lanzado = true;
        try {
          marco.contentWindow.focus();
          marco.contentWindow.print();
          nota_('Se abrió el diálogo de impresión de ' + (nombre || res.nombre || 'el archivo') + '.');
        } catch (err) {
          /* iOS y algunos navegadores no imprimen iframes ocultos:
             se abre el PDF propio en una pestaña y desde ahí se imprime. */
          pestana_(urlBlob);
          nota_('Tu navegador no imprime desde la app: se abrió el PDF en otra pestaña.');
        }
      };
      document.body.appendChild(marco);
    }).catch(function (e) {
      caerAPestana_(id, 'No se pudo preparar la impresión (' +
        ((e && e.message) ? e.message : String(e)) + '). Se abre el visor de Drive.');
    }).then(function () {
      imprimiendo = false;
      if (btn) { btn.disabled = false; btn.textContent = textoBtn || '🖨 Imprimir'; }
    });
  }

  /* ══════════════ API ══════════════ */

  window.VISOR = {
    abrir: abrir,
    cerrar: cerrar,
    abierto: abierto,
    imprimir: imprimir,
    _id: idDrive_,
    _esImagen: esImagen_,
    _esCarpeta: esCarpeta_
  };

  /* Atajo cómodo para app.js: si por lo que sea el visor no cargó, la app
     sigue funcionando exactamente como antes (pestaña nueva). */
  window.abrirArchivo_ = function (url, nombre, agregar) {
    if (window.VISOR && typeof window.VISOR.abrir === 'function') {
      return window.VISOR.abrir(url, { nombre: nombre, agregar: agregar });
    }
    window.open(url, '_blank', 'noopener');
    return true;
  };
})();
