/* ============================================================
   SEC-HACIENDA-FLANDES · LLAVE DE SESIÓN
   Fase 3 · 27/09/2026 · se carga justo después de js/marca.js

   1) LLAVE DE SESIÓN. Desde la Fase 3 el servidor no le cree al
      navegador quién es: al entrar con el PIN entrega una llave ('tk')
      y la exige en CADA petición. Aquí se guarda y se pega sola a toda
      llamada al backend (apiGet, apiPost y los fetch de fondo de
      bdp-rapido, descargas, insights…), sin tocar cada archivo.
   2) SESIÓN VENCIDA. Si el servidor contesta SESION_VENCIDA se avisa
      una sola vez con el evento 'hac:sesionVencida' (identidad.js
      cierra la sesión y lleva al ingreso).
   ============================================================ */
(function (raiz) {
  'use strict';

  var M = raiz.MARCA || {};
  var API = String(M.API_URL || '');
  var K_TK = 'hac.tk.v1';

  function leer() { try { return localStorage.getItem(K_TK) || ''; } catch (e) { return ''; } }
  function poner(tk) {
    try { if (tk) localStorage.setItem(K_TK, tk); else localStorage.removeItem(K_TK); } catch (e) {}
  }

  function esApi(url) { return !!API && typeof url === 'string' && url.indexOf(API) === 0; }

  function conLlave(url) {
    var tk = leer();
    if (!tk || /[?&]tk=/.test(url)) return url;
    return url + (url.indexOf('?') === -1 ? '?' : '&') + 'tk=' + encodeURIComponent(tk);
  }

  var avisado = false;
  function vencida(msg) {
    if (avisado) return;
    avisado = true;
    try { raiz.dispatchEvent(new CustomEvent('hac:sesionVencida', { detail: { mensaje: msg || '' } })); } catch (e) {}
    setTimeout(function () { avisado = false; }, 4000);
  }

  var fetchOriginal = raiz.fetch ? raiz.fetch.bind(raiz) : null;
  if (fetchOriginal) {
    raiz.fetch = function (entrada, opciones) {
      if (!esApi(entrada)) return fetchOriginal(entrada, opciones);
      return fetchOriginal(conLlave(entrada), opciones).then(function (r) {
        /* Solo se mira la respuesta si es un error pequeño (las listas
           grandes no se leen dos veces). */
        var largo = Number(r.headers && r.headers.get && r.headers.get('content-length')) || 0;
        if (largo > 4096) return r;
        return r.clone().text().then(function (txt) {
          if (txt.length > 4096 || txt.indexOf('SESION_VENCIDA') === -1) return r;
          var j = null;
          try { j = JSON.parse(txt); } catch (e) { return r; }
          if (j && j.ok === false && j.codigo === 'SESION_VENCIDA') vencida(j.error);
          return r;
        }, function () { return r; });
      });
    };
  }

  raiz.HAC_SESION = {
    tk: leer,
    poner: poner,
    borrar: function () { poner(''); }
  };
})(window);
