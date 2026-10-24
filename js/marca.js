/* ============================================================
   SEC-HACIENDA-FLANDES · MARCA
   El único archivo que se toca al mover el despliegue del backend.

   API_URL es el backend HACIENDA (Apps Script). La app habla con él
   por GET ?action= (js/app.js lo lee de aquí como API_BASE); el kit
   de Flandes no habla con él directamente: js/flandes.js le responde
   'ping' y 'config' sin salir de la app.
   ============================================================ */
(function (raiz) {
  'use strict';
  raiz.MARCA = {
    APP: 'HACFLANDES',
    TITULO: 'Sec. Hacienda',
    MUNICIPIO: 'Alcaldía de Flandes',
    API_URL: 'https://script.google.com/macros/s/AKfycby_TJ_vPiqPJdJdqBMuhya_Prwb7UMoFEUMISeHv_nAqT0jepMDfu5kNBn5ayTKiuJB_A/exec',
    /* 04/10/2026 — backend ICA (Industria y Comercio) en la cuenta cobrocoactivo */
    ICA_URL: 'https://script.google.com/macros/s/AKfycbzll56cF_pNX1G8vKP35XSlcaNZqOg87IK-Q8VF5D_i1acrAhT_HfathLfAGfZGQM5QJQ/exec',
    MEDIOS_BASE: 'https://botheart911.github.io/ALCALDIA-MEDIOS/',
    /* 'hacflandes.' y NO 'hac.': las llaves 'hac.*' son las de la sesión,
       las cuentas y el tema que ya usa la app (identidad.js), y se
       comparten a propósito con la app vieja mientras conviven. */
    STORAGE_NS: 'hacflandes.',
    APP_ICON: 'img/icono-512.png',
    /* 24/10/2026 — ASISTENTE DE AYUDA · Gemini por Firebase AI Logic (plan sin costo)
       en el proyecto semaforo-hacienda (cuenta alcaldia.digital), NO en flandes-avisos.
       Pública por diseño (configuración web de Firebase). La llave de GEMINI es otra:
       restringida a https://botheart911.github.io/* y SOLO a Firebase AI Logic y App Check.
       App Check con reCAPTCHA Enterprise (Fraud Defense). Gemini solo ELIGE el tema. */
    FIREBASE: {
      authDomain: 'semaforo-hacienda.firebaseapp.com',
      projectId: 'semaforo-hacienda',
      storageBucket: 'semaforo-hacienda.firebasestorage.app',
      messagingSenderId: '372729856735',
      appId: '1:372729856735:web:abddede02bcc431c07df6a'
    },
    GEMINI: {
      apiKey: 'AIzaSyB_unWKXQCZyP2WFzpWce60fYPsI6e8bGg',
      siteKey: '6LdkU_8tAAAAAFtGdObFc45EtbEDXjRQNHUcsnka',
      modelo: 'gemini-3.1-flash-lite',
      contexto: 'una app de la Secretaría de Hacienda de la Alcaldía de Flandes (Colombia) que usan sus funcionarios para la atención del impuesto predial (solicitudes por WhatsApp, atención presencial, recibos), la base de datos predial y el cobro coactivo (expedientes, bitácoras, actuaciones, notificación de facturas por correo), el semáforo de asignaciones con plazos en días hábiles, los requerimientos de Industria y Comercio, las evidencias de los contratistas (Drive anexos), informes, soporte y configuración.'
    }
  };
})(window);
