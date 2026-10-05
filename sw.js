/* ============================================================
   SEC-HACIENDA-FLANDES · SERVICE WORKER DEL CACHÉ
   Solo el armazón (HTML, CSS, JS) y los medios del repo. NADA de datos:
   las llamadas a Apps Script no se tocan (fue el "Unexpected token '<'"
   de agosto en la app vieja de contratista).

   El nombre de la caché sale de version.js: cada publicación estrena
   caché. OJO con los prefijos, porque todas las apps comparten origen
   (botheart911.github.io):
     · 'hacflandes-v…'   el armazón. kit/version.js borra las 'hacflandes-'
                         viejas al publicar.
     · 'hacflmedios-v1'  imágenes y sonidos. Prefijo DISTINTO a propósito:
                         si empezara por 'hacflandes-' se borraría en cada
                         publicación y habría que bajar otra vez los medios.
     · Nunca se toca 'sec-hacienda-…' (la app vieja) ni las de otras apps.
   ============================================================ */
importScripts('./version.js');

var CACHE_NAME = 'hacflandes-v' + APP_VERSION;
var CACHE_ARCHIVOS = 'hacflmedios-v1';
var RUTA_VERSION = new URL('./version.js', self.location.href).pathname;
var APP_SHELL = [
  './',
  './index.html',
  './js/app.js',
  './styles.css',
  './js/assets.js',
  './js/identidad.js',
  './css/identidad.css',
  './js/configuracion.js',
  './css/configuracion.css',
  './js/base-visual.js',
  './css/base-visual.css',
  './js/capa-12-antidoble.js',
  './js/en-vivo.js',
  './js/alcance.js',
  './js/descargas.js',
  './css/descargas.css',
  './css/vistas.css',
  './js/visor.js',
  './kit/visor.css',
  './kit/visor.js',
  './js/esqueletos.js',
  './js/capa-11-insights.js',
  './css/capa-11-insights.css',
  './js/fechas-ios.js',
  './css/fechas-ios.css',
  './js/asignador.js',
  './css/asignador.css',
  './js/asistente.js',
  './js/bitacora.js',
  './css/bitacora.css',
  './js/adjuntos.js',
  './js/bdp-rapido.js',
  './js/no-aperturados.js',
  './js/form-ancho.js',
  './css/form-ancho.css',
  './js/bitacora-export.js',
  './css/bitacora-export.css',
  './js/mi-trabajo.js',
  './css/mi-trabajo.css',
  './js/solicitud-exp.js',
  './css/solicitud-exp.css',
  './manifest.webmanifest',
  './version.js',
  './js/marca.js',
  './js/sesion.js',
  './js/corte.js',
  './kit/avisos.js',
  './js/iconos-hacienda.js',
  './js/guia.js',
  './js/hacienda.js',
  './css/hacienda.css',
  './css/ica.css',
  './js/ica.js',
  './js/ica-municipios.js',
  './kit/sesion.css',
  './kit/bienvenida.css',
  './kit/bienvenida.js',
  './kit/kit.js',
  './kit/iconos.js',
  './kit/confirmar.js',
  './kit/version.js',
  './kit/base.css',
  './kit/banner.js',
  './kit/banner.css',
  './kit/cielo.js',
  './kit/cielo.css',
  './kit/creditos.js',
  './kit/creditos.css',
  './kit/guardado.js',
  './kit/guardado.css',
  './kit/instalar.js',
  './kit/instalar.css',
  './kit/conexion.js',
  './kit/conexion.css',
  './kit/personas.js',
  './kit/personas.css',
  './img/icono-32.png',
  './img/icono-180.png',
  './img/icono-192.png',
  './img/icono-512.png'
];
/* ============================================================
   29/09/2026 · MODO FRESCO (versión vieja en los equipos)
   Antes: HTML/JS/CSS "red primero" pero SIN cache:'no-cache', así que el
   navegador contestaba con su propia caché HTTP (GitHub Pages da 10 min)
   y tras publicar se mezclaban archivos viejos y nuevos. Y el respaldo
   caches.match() buscaba en TODAS las cachés, incluso las de versiones
   pasadas.
   Ahora, en cada apertura (navegación):
     · se pregunta version.js a la RED; si el número publicado NO es el de
       este service worker, esa apertura entera sale de la red (cache:'reload')
       y no se mezcla nada viejo;
     · si coincide, el armazón sale de la caché de ESTA versión (rápido) y,
       si falta algo, de la red revalidada.
   Solo se lee de caches.open(CACHE_NAME): nunca de una versión anterior.
   ============================================================ */
var FRESCOS = {};                  /* clientId -> true: abrió con versión nueva */
var ESPERA_VERSION_MS = 3000;

function versionDeLaRed_() {
  return new Promise(function (listo) {
    var t = setTimeout(function () { listo(''); }, ESPERA_VERSION_MS);
    fetch(RUTA_VERSION + '?sw=' + Date.now(), { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.text() : ''; })
      .then(function (txt) {
        clearTimeout(t);
        var m = /APP_VERSION\s*=\s*["']([^"']+)["']/.exec(String(txt || ''));
        listo(m ? m[1].trim() : '');
      })
      .catch(function () { clearTimeout(t); listo(''); });
  });
}

function deMiCache_(req) {
  return caches.open(CACHE_NAME).then(function (c) { return c.match(req, { ignoreSearch: false }); });
}

function guardar_(req, res) {
  if (!res || !res.ok || res.type === 'opaque') return;
  var copy = res.clone();
  caches.open(CACHE_NAME).then(function (c) { return c.put(req, copy); }).catch(function () {});
}

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    /* FASE 4: uno por uno, NO addAll (si falta un archivo no se cae todo).
       29/09: cache:'reload' — la precarga NO puede salir de la caché HTTP
       del navegador, o la caché nueva nacería con archivos viejos. */
    caches.open(CACHE_NAME).then(cache =>
      Promise.all(APP_SHELL.map(u =>
        fetch(new Request(u, { cache: 'reload' }))
          .then(res => { if (res && res.ok) return cache.put(u, res); })
          .catch(() => {})
      ))
    )
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      /* OJO: en GitHub Pages todas las apps comparten origen. Solo se borran
         las cachés de ESTA app, nunca las de las otras (contratista, etc.). */
      Promise.all(
        keys.filter(k => (k.indexOf('hacflandes-') === 0 && k !== CACHE_NAME) || (k.indexOf('hacflmedios-') === 0 && k !== CACHE_ARCHIVOS))
            .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // version.js de la raíz SIEMPRE desde la red (kit/version.js decide con él)
  if (url.pathname === RUTA_VERSION) {
    event.respondWith(fetch(req, { cache: 'no-store' }).catch(() => deMiCache_(req)));
    return;
  }

  // Imágenes y sonidos del repo: caché primero (no cambian nunca)
  /* FASE 10 — con .catch(): una petición abortada no rompe la respuesta. */
  if (url.origin === location.origin && /\/(img|sound)\//.test(url.pathname)) {
    const esSonido = /\/sound\//.test(url.pathname);
    event.respondWith(
      caches.match(req, { cacheName: CACHE_ARCHIVOS }).then(hit => hit || fetch(req).then(res => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE_ARCHIVOS).then(cache => cache.put(req, copy)).catch(() => {});
        }
        return res;
      }).catch(() => caches.match(req, { cacheName: CACHE_ARCHIVOS }).then(h => h || (
        esSonido
          ? new Response(new Uint8Array(), { status: 200, headers: { 'Content-Type': 'audio/mpeg' } })
          : new Response('', { status: 504, statusText: 'sin red' })
      ))))
    );
    return;
  }

  if (url.origin !== location.origin) return;   /* CDN, Apps Script: no se tocan */

  // Apertura (navegación): se decide si esta carga va FRESCA.
  if (req.mode === 'navigate') {
    event.respondWith(versionDeLaRed_().then(function (red) {
      const fresca = !!red && red !== String(APP_VERSION);
      if (event.resultingClientId) FRESCOS[event.resultingClientId] = fresca;
      return fetch(req, { cache: fresca ? 'reload' : 'no-cache' })
        .then(function (res) { if (!fresca) guardar_(req, res); return res; })
        .catch(function () { return deMiCache_(req).then(h => h || deMiCache_('./index.html')); });
    }));
    return;
  }

  // HTML, JS y CSS del armazón
  const isAppShell = /\.(html|js|css|webmanifest)$/.test(url.pathname) || url.pathname.endsWith('/');
  if (isAppShell) {
    const fresca = FRESCOS[event.clientId];
    if (fresca === true) {
      /* La página abrió con una versión más nueva que este service worker:
         todo de la red, sin pasar por ninguna caché. */
      event.respondWith(fetch(req, { cache: 'reload' }).catch(() => deMiCache_(req)));
      return;
    }
    if (fresca === false) {
      /* Misma versión: la caché de ESTA versión primero (instantáneo). */
      event.respondWith(deMiCache_(req).then(hit => hit || fetch(req, { cache: 'no-cache' }).then(res => { guardar_(req, res); return res; })));
      return;
    }
    /* No se sabe (el service worker se durmió y perdió la lista): red
       revalidada primero, caché de esta versión como respaldo. */
    event.respondWith(
      fetch(req, { cache: 'no-cache' }).then(res => { guardar_(req, res); return res; })
        .catch(() => deMiCache_(req))
    );
    return;
  }

  // Resto: red con respaldo en la caché de esta versión
  event.respondWith(fetch(req).catch(() => deMiCache_(req)));
});
