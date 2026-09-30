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

  /** Texto de la respuesta SOLO si es un error corto; '' si es otra cosa. */
  function mirarInicio(r) {
    var copia = r.clone();
    if (!copia.body || !copia.body.getReader || typeof TextDecoder !== 'function') {
      return copia.text().then(function (t) { return t.length > 4096 ? '' : t; });
    }
    var lector = copia.body.getReader();
    var dec = new TextDecoder();
    var txt = '';
    function paso() {
      return lector.read().then(function (res) {
        if (res.done) return txt;
        txt += dec.decode(res.value, { stream: true });
        var inicio = txt.replace(/^\s+/, '');
        if (inicio.length >= 11 && inicio.indexOf('{"ok":false') !== 0) { try { lector.cancel(); } catch (e) {} return ''; }
        if (txt.length > 4096) { try { lector.cancel(); } catch (e) {} return ''; }
        return paso();
      });
    }
    return paso();
  }

  var fetchOriginal = raiz.fetch ? raiz.fetch.bind(raiz) : null;
  if (fetchOriginal) {
    raiz.fetch = function (entrada, opciones) {
      if (!esApi(entrada)) return fetchOriginal(entrada, opciones);
      /* FASE 4 — la llave con la que salió ESTA petición. Si el servidor dice
         "sesión vencida" pero la llave ya no es la de ahora (una respuesta
         vieja que llega después de volver a entrar, o una petición que traía
         otra llave), no se cierra la sesión buena. */
      var urlConLlave = conLlave(entrada);
      var m = /[?&]tk=([^&]*)/.exec(urlConLlave);
      var llaveUsada = m ? decodeURIComponent(m[1]) : '';
      return fetchOriginal(urlConLlave, opciones).then(function (r) {
        /* Solo se mira la respuesta si es un error pequeño (las listas
           grandes no se leen dos veces). */
        var largo = Number(r.headers && r.headers.get && r.headers.get('content-length')) || 0;
        if (largo > 4096) return r;
        /* 29/09 — Apps Script no manda content-length: antes se clonaba y se
           leía ENTERA cada respuesta (también los 2,5 MB de BD Predial).
           Ahora se mira solo el primer trozo: un error empieza por
           {"ok":false y es pequeño; cualquier otra cosa se suelta ya. */
        return mirarInicio(r).then(function (txt) {
          if (!txt || txt.indexOf('SESION_VENCIDA') === -1) return r;
          var j = null;
          try { j = JSON.parse(txt); } catch (e) { return r; }
          if (j && j.ok === false && j.codigo === 'SESION_VENCIDA' && llaveUsada === leer()) vencida(j.error);
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
