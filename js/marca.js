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
    APP_ICON: 'img/icono-512.png'
  };
})(window);
