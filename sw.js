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
  './css/visor.css',
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
  './js/iconos-hacienda.js',
  './js/guia.js',
  './js/hacienda.js',
  './css/hacienda.css',
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
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    /* FASE 4: uno por uno, NO addAll. addAll es atómico: si un solo archivo
       falta (como pasó con css/base-visual.css) se cae la precarga entera y
       la app se queda sin caché para trabajar sin red. */
    caches.open(CACHE_NAME).then(cache =>
      Promise.all(APP_SHELL.map(u => cache.add(u).catch(() => {})))
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
    event.respondWith(fetch(req, { cache: 'no-store' }).catch(() => caches.match(req)));
    return;
  }

  // Imágenes y sonidos del repo: caché primero (no cambian nunca)
  /* FASE 10 — esta rama NO tenía .catch(). Si el archivo todavía no estaba
     en caché y la red fallaba o la petición se abortaba (cambio de vista,
     relevo del service worker), el promise se rechazaba y respondWith
     devolvía un fallo de red: es el "net::ERR_FAILED" que aparecía en la
     consola con los mp3, aunque el archivo SÍ existe en sound/. Ahora se
     reintenta con la caché y, si tampoco está, se responde en silencio en
     vez de romper la petición. */
  if (url.origin === location.origin && /\/(img|sound)\//.test(url.pathname)) {
    const esSonido = /\/sound\//.test(url.pathname);
    event.respondWith(
      caches.match(req).then(hit => hit || fetch(req).then(res => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE_ARCHIVOS).then(cache => cache.put(req, copy)).catch(() => {});
        }
        return res;
      }).catch(() => caches.match(req).then(h => h || (
        esSonido
          ? new Response(new Uint8Array(), { status: 200, headers: { 'Content-Type': 'audio/mpeg' } })
          : new Response('', { status: 504, statusText: 'sin red' })
      ))))
    );
    return;
  }

  // HTML, JS y CSS: network-first (red primero, caché como respaldo)
  const isAppShell = /\.(html|js|css)$/.test(url.pathname) || url.pathname.endsWith('/');
  if (isAppShell && url.origin === location.origin) {
    event.respondWith(
      fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(req, copy)).catch(() => {});
        return res;
      }).catch(() => caches.match(req))
    );
    return;
  }

  // Resto: red con fallback a caché
  event.respondWith(fetch(req).catch(() => caches.match(req)));
});
