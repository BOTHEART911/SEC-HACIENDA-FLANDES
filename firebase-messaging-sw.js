/* ============================================================
   SEC-HACIENDA-FLANDES · SERVICE WORKER DE LOS AVISOS PUSH
   Fase 3 · 27/09/2026 (mismo patrón de CONTRATISTA-FLANDES)
   26/11/2026 · un solo aviso: el backend manda solo data

   Va APARTE de sw.js (caché e instalación) y en su propio scope
   (./firebase-cloud-messaging-push-scope): dos service workers no
   comparten scope y en './' se llevaría la PWA por delante.

   La configuración de Firebase NO está escrita aquí: la app la trae de
   Configuración (push.firebase) y se la pasa a este archivo en la
   dirección con la que lo registra (?c=...). Ver js/hacienda.js.
   ============================================================ */

var CFG_FB = {};
try {
  var c = new URL(self.location.href).searchParams.get('c') || '';
  if (c) CFG_FB = JSON.parse(atob(c));
} catch (e) { CFG_FB = {}; }

var NS_FB = 'hacflandes.';
var ICONO = 'img/icono-192.png';

importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

if (CFG_FB && CFG_FB.apiKey) {
  firebase.initializeApp(CFG_FB);
  var messaging = firebase.messaging();

  /* Aviso con la app CERRADA o en segundo plano.
     26/11/2026 · El backend manda SOLO data (titulo, cuerpo, enlace,
     vista, tipo): con el bloque notification el SDK pintaba además su
     aviso genérico (campana gris con la «B») y llegaban DOS. Este es el
     único que pinta, con el ícono de la app. notification queda como
     respaldo de lectura para un mensaje viejo que esté en camino. */
  messaging.onBackgroundMessage(function (payload) {
    var n = payload.notification || {};
    var d = payload.data || {};
    var titulo = d.titulo || n.title || 'Sec. Hacienda';
    var cuerpo = d.cuerpo || n.body || '';
    return self.registration.showNotification(titulo, {
      body: cuerpo,
      icon: ICONO,
      badge: ICONO,
      /* con el prefijo de la app: un aviso de otra app del mismo origen
         no reemplaza este en el mismo teléfono */
      tag: NS_FB + 'aviso-' + (d.tipo || '') + '-' + Date.now(),
      data: { vista: d.vista || '', tipo: d.tipo || '', enlace: d.enlace || '' }
    });
  });
}

/* Tocar el aviso abre la app; si ya está abierta, la enfoca. */
self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  var base = new URL('./', self.location.href).href;
  var dd = (e.notification && e.notification.data) || {};
  var abrir = (dd.enlace && String(dd.enlace).indexOf(base) === 0) ? dd.enlace : base;
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (lista) {
      for (var i = 0; i < lista.length; i++) {
        var cl = lista[i];
        if (cl.url.indexOf(base) === 0 && 'focus' in cl) return cl.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(abrir);
    })
  );
});
