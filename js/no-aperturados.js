/* ============================================================
   NO APERTURADOS — LOTE 08/09/2026 · SEC-HACIENDA

   Qué es
     Una pastilla más en BASE DE DATOS IMPUESTO PREDIAL, al lado de
     "SOLO LAS MÍAS": al tocarla deja en pantalla únicamente los
     expedientes SIN valor en NO. EXP. FÍSICO (columna M) — los que
     todavía no se han aperturado. Se vuelve a tocar y se quita.

   Cómo está hecho
     Se envuelve `renderBDPredial_`, o sea que el filtro se aplica al
     PINTAR: se suma a los filtros de siempre (clasificación, actuación,
     sustanciador, estado, buscador, mis bitácoras) sin tocar ninguno y
     sin tocar app.js. El número de la pastilla es cuántos no aperturados
     hay en lo que se está viendo ahora mismo; si no hay ninguno, la
     pastilla se esconde (a un abogado normalmente no le sale).

   Dato del día de la entrega: 3.033 de los 9.459 expedientes están sin
   No. Exp. Físico, y los 3.033 están en SUSTANCIADOR = NINGUNO.

   OJO — aperturar (escribir el No. Exp. Físico) lo siguen haciendo solo
   ADMIN y DEV: es un campo estructural y el servidor lo bloquea para
   todos los demás. Para el asistente esta pastilla es de consulta.
   ============================================================ */
(function () {
  'use strict';

  if (window.__HACNOAP_LISTO) return;
  window.__HACNOAP_LISTO = true;

  var activo = false;

  function sinExpediente(row) {
    return String((row && row.no_exp_fisico) || '').trim() === '';
  }

  /* ══════════════ la pastilla ══════════════ */

  function crear() {
    if (document.getElementById('bdp-noap-wrap')) return document.getElementById('bdp-pill-noap');
    var ancla = document.getElementById('bdp-pills-mias-wrap');
    if (!ancla || !ancla.parentNode) return null;

    var wrap = document.createElement('div');
    wrap.id = 'bdp-noap-wrap';
    wrap.style.display = 'none';

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'bdp-pill-noap';
    btn.className = 'proc-status-pill';
    /* styles.css:146 pone width:100% a TODO button: hay que fijarlo. */
    btn.style.width = 'auto';
    btn.style.background = 'linear-gradient(135deg,#f97316,#c2410c)';
    btn.style.color = '#fff';
    btn.style.borderColor = 'transparent';
    /* La capa 12 deja candado ~500 ms tras cada clic; esto no llama al
       servidor, así que se marca como salida para poder alternar rápido. */
    btn.setAttribute('data-salida', '1');
    btn.textContent = '🗂️ NO APERTURADOS';

    btn.addEventListener('click', function () {
      try { playSoundOnce(SOUNDS.menu); } catch (e) {}
      activo = !activo;
      if (activo) btn.classList.add('active');
      else btn.classList.remove('active');
      try {
        if (typeof applyBDPredialFilters_ === 'function') applyBDPredialFilters_();
      } catch (e) {}
    });

    wrap.appendChild(btn);

    /* Va SIEMPRE la última del grupo: justo antes de los botones de
       acción. Si se colgara de "SOLO LAS MÍAS" quedaría antes o después
       de MIS BITÁCORAS según cuál de los dos archivos montara primero. */
    var vista = document.getElementById('view-bd-predial');
    var botones = vista ? vista.querySelector('.btn-row') : null;
    if (botones && botones.parentNode) botones.parentNode.insertBefore(wrap, botones);
    else ancla.parentNode.insertBefore(wrap, ancla.nextSibling);
    return btn;
  }

  function pintar(n) {
    var btn = crear();
    if (!btn) return;
    var wrap = document.getElementById('bdp-noap-wrap');
    btn.textContent = '🗂️ NO APERTURADOS (' + n + ')';
    if (activo) btn.classList.add('active');
    else btn.classList.remove('active');
    if (wrap) wrap.style.display = (n > 0 || activo) ? '' : 'none';
  }

  /* ══════════════ el filtro, al pintar ══════════════ */

  function envolverRender() {
    var original = window.renderBDPredial_;
    if (typeof original !== 'function' || original.__noap) return;

    var envuelta = function (items) {
      var lista = Array.isArray(items) ? items : [];
      var n = 0;
      for (var i = 0; i < lista.length; i++) if (sinExpediente(lista[i])) n++;
      pintar(n);
      if (activo) lista = lista.filter(sinExpediente);
      return original.call(this, lista);
    };
    envuelta.__noap = true;
    window.renderBDPredial_ = envuelta;
  }

  /* Al entrar a la vista, app.js reinicia todos los filtros: este
     también, para que nadie se encuentre la lista recortada sin saber
     por qué. */
  function envolverShowView() {
    var original = window.showView;
    if (typeof original !== 'function' || original.__noap) return;

    var envuelta = function (id) {
      if (String(id || '') === 'view-bd-predial') {
        activo = false;
        var btn = document.getElementById('bdp-pill-noap');
        if (btn) btn.classList.remove('active');
      }
      return original.apply(this, arguments);
    };
    envuelta.__noap = true;
    window.showView = envuelta;
  }

  function arrancar() {
    crear();
    envolverRender();
    envolverShowView();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', arrancar);
  } else {
    arrancar();
  }

  /* Otras capas también envuelven renderBDPredial_ y showView; se repite
     por si alguna llegó después (es idempotente, marca __noap). */
  setTimeout(arrancar, 1500);

  /* Puerta para las pruebas. */
  window.NOAPERTURADOS = {
    sinExpediente: sinExpediente,
    activo: function () { return activo; },
    alternar: function () {
      var btn = document.getElementById('bdp-pill-noap');
      if (btn) btn.click();
    },
    arrancar: arrancar
  };
})();
