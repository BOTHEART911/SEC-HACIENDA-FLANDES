/* ===========================================================================
   SEC-HACIENDA · FASE 2 — RESOLVEDOR ÚNICO DE ARCHIVOS (imágenes y sonidos)
   ---------------------------------------------------------------------------
   Se carga ANTES que app.js.

   Los 68 enlaces de Cloudinary que había repartidos por app.js, index.html,
   styles.css y manifest.webmanifest pasaron a vivir en este repo, en img/ y
   sound/ (65 archivos: 3 enlaces apuntaban al mismo archivo).

   Un solo sitio manda: ASSETS.BASE.
     - ''  (por defecto) = los archivos salen de este mismo repo.
     - 'https://loquesea/' = todo el front pasa a servirse de ahí, sin tocar
       ninguna otra línea de código.

   Además hace de red de seguridad: cualquier enlace de Cloudinary que
   sobreviva en el HTML (viejo caché, copia pegada, etc.) se reescribe solo
   al archivo local que le corresponde.
   =========================================================================== */
(function (w) {
  'use strict';

  var LEGADO = {
    'https://res.cloudinary.com/dqqeavica/image/upload/v1746905870/fondo_verde_tvntsi.png': 'img/fondo-verde.png',
    'https://res.cloudinary.com/dqqeavica/image/upload/v1759767447/Notificaci%C3%B3n_jtptyw.webp': 'img/notificacion.webp',
    'https://res.cloudinary.com/dqqeavica/image/upload/v1763997280/DRIVE_bycgsc.webp': 'img/drive.webp',
    'https://res.cloudinary.com/dqqeavica/image/upload/v1764084782/Mostrar_yymceh.png': 'img/mostrar.png',
    'https://res.cloudinary.com/dqqeavica/image/upload/v1764084782/Ocultar_lgdxpd.png': 'img/ocultar.png',
    'https://res.cloudinary.com/dqqeavica/image/upload/v1764111247/carpeta_drive_epbrhp.webp': 'img/carpeta-drive.webp',
    'https://res.cloudinary.com/dqqeavica/image/upload/v1765740540/instalacion_lydtcl.gif': 'img/instalacion.gif',
    'https://res.cloudinary.com/dqqeavica/image/upload/v1765745210/instalacion_ios_ysbhnd.gif': 'img/instalacion-ios.gif',
    'https://res.cloudinary.com/dqqeavica/image/upload/v1766347982/banner_wbfbf7.gif': 'img/banner.gif',
    'https://res.cloudinary.com/dqqeavica/image/upload/v1766349498/slider_zcq18s.gif': 'img/slider.gif',
    'https://res.cloudinary.com/dqqeavica/image/upload/v1769204556/buscar_vaaua0.webp': 'img/buscar.webp',
    'https://res.cloudinary.com/dqqeavica/image/upload/v1771979124/editar_bx9dsl.webp': 'img/editar.webp',
    'https://res.cloudinary.com/dqqeavica/image/upload/v1773105921/memoria_o2lro5.webp': 'img/memoria.webp',
    'https://res.cloudinary.com/dqqeavica/image/upload/v1773342298/al_dia_o70awr.webp': 'img/al-dia.webp',
    'https://res.cloudinary.com/dqqeavica/image/upload/v1773342299/no_found_czsnkj.webp': 'img/no-found.webp',
    'https://res.cloudinary.com/dqqeavica/image/upload/v1773350454/hacienda_id9f13.png': 'img/hacienda.png',
    'https://res.cloudinary.com/dqqeavica/image/upload/v1774398142/mensaje_xu3mbq.webp': 'img/mensaje.webp',
    'https://res.cloudinary.com/dqqeavica/image/upload/v1775788266/subcategoria4.1_c1nm1b.png': 'img/subcategoria4-1.png',
    'https://res.cloudinary.com/dqqeavica/image/upload/v1775788362/juridico_csqxdq.png': 'img/juridico.png',
    'https://res.cloudinary.com/dqqeavica/image/upload/v1775788408/chincheta_v6mg7a.png': 'img/chincheta.png',
    'https://res.cloudinary.com/dqqeavica/image/upload/v1775788435/Eliminar_jcmwso.webp': 'img/eliminar.webp',
    'https://res.cloudinary.com/dqqeavica/image/upload/v1775841196/inbox_nvanat.webp': 'img/inbox.webp',
    'https://res.cloudinary.com/dqqeavica/image/upload/v1775841196/outbox_tnns1w.webp': 'img/outbox.webp',
    'https://res.cloudinary.com/dqqeavica/image/upload/v1775844088/devolver_zhe62l.webp': 'img/devolver.webp',
    'https://res.cloudinary.com/dqqeavica/image/upload/v1775850623/firma_e19uie.webp': 'img/firma.webp',
    'https://res.cloudinary.com/dqqeavica/image/upload/v1775925730/categoria1_dytugz.png': 'img/categoria1.png',
    'https://res.cloudinary.com/dqqeavica/image/upload/v1775925730/subcategoria1.1_obq8j3.png': 'img/subcategoria1-1.png',
    'https://res.cloudinary.com/dqqeavica/image/upload/v1775925730/subcategoria1.3_cjc9uw.png': 'img/subcategoria1-3.png',
    'https://res.cloudinary.com/dqqeavica/image/upload/v1775925730/subcategoria1.4_but7fh.png': 'img/subcategoria1-4.png',
    'https://res.cloudinary.com/dqqeavica/image/upload/v1775925731/subcategoria1.2_fexkst.png': 'img/subcategoria1-2.png',
    'https://res.cloudinary.com/dqqeavica/image/upload/v1775925920/categoria2_hsjnwc.png': 'img/categoria2.png',
    'https://res.cloudinary.com/dqqeavica/image/upload/v1775925920/subcategoria2.1_tkss3x.png': 'img/subcategoria2-1.png',
    'https://res.cloudinary.com/dqqeavica/image/upload/v1775925920/subcategoria2.2_a9ffzt.png': 'img/subcategoria2-2.png',
    'https://res.cloudinary.com/dqqeavica/image/upload/v1775925920/subcategroia2.3_iijlxw.png': 'img/subcategoria2-3.png',
    'https://res.cloudinary.com/dqqeavica/image/upload/v1775926064/categoria3_zvzmre.png': 'img/categoria3.png',
    'https://res.cloudinary.com/dqqeavica/image/upload/v1775926065/subcategoria3.1_v11uug.png': 'img/subcategoria3-1.png',
    'https://res.cloudinary.com/dqqeavica/image/upload/v1775926065/subcategoria3.2_zd5p4f.png': 'img/subcategoria3-2.png',
    'https://res.cloudinary.com/dqqeavica/image/upload/v1775926065/subcategoria3.3_rv6imv.png': 'img/subcategoria3-3.png',
    'https://res.cloudinary.com/dqqeavica/image/upload/v1775926219/categoria4_u9oodc.png': 'img/categoria4.png',
    'https://res.cloudinary.com/dqqeavica/image/upload/v1775926219/subcategoria4.1_cosola.png': 'img/subcategoria4-1.png',
    'https://res.cloudinary.com/dqqeavica/image/upload/v1775926220/subcategoria4.2_ndos1e.png': 'img/subcategoria4-2.png',
    'https://res.cloudinary.com/dqqeavica/image/upload/v1775926220/subcategoria4.3_zwehxh.png': 'img/subcategoria4-3.png',
    'https://res.cloudinary.com/dqqeavica/image/upload/v1775926546/juridico_oepj4a.png': 'img/juridico.png',
    'https://res.cloudinary.com/dqqeavica/image/upload/v1776016986/chat_sueco4.webp': 'img/chat.webp',
    'https://res.cloudinary.com/dqqeavica/image/upload/v1776026457/predial_fnzfh5.png': 'img/predial.png',
    'https://res.cloudinary.com/dqqeavica/image/upload/v1776028801/semaforo_vdxduc.png': 'img/semaforo.png',
    'https://res.cloudinary.com/dqqeavica/image/upload/v1776033644/pdf_frtzh4.webp': 'img/pdf.webp',
    'https://res.cloudinary.com/dqqeavica/image/upload/v1776121369/expediente_clb9ca.webp': 'img/expediente.webp',
    'https://res.cloudinary.com/dqqeavica/image/upload/v1776287026/barras_pinzze.png': 'img/barras.png',
    'https://res.cloudinary.com/dqqeavica/image/upload/v1776287377/usuarios_dkzfqk.webp': 'img/usuarios.webp',
    'https://res.cloudinary.com/dqqeavica/image/upload/v1776287528/reloj_mnsqmb.png': 'img/reloj.png',
    'https://res.cloudinary.com/dqqeavica/image/upload/v1776287585/target_rmpes0.webp': 'img/target.webp',
    'https://res.cloudinary.com/dqqeavica/image/upload/v1776301265/calendario_tbjeas.webp': 'img/calendario.webp',
    'https://res.cloudinary.com/dqqeavica/image/upload/v1776301266/mapa_o7izhb.png': 'img/mapa.png',
    'https://res.cloudinary.com/dqqeavica/image/upload/v1776301266/tendencia_cpy1nw.png': 'img/tendencia.png',
    'https://res.cloudinary.com/dqqeavica/image/upload/v1778186304/excel_rkcld6.webp': 'img/excel.webp',
    'https://res.cloudinary.com/dqqeavica/image/upload/v1778860849/agregar_ojlawh.webp': 'img/agregar.webp',
    'https://res.cloudinary.com/dqqeavica/image/upload/v1778860851/base_de_datos_cty8xc.webp': 'img/base-de-datos.webp',
    'https://res.cloudinary.com/dqqeavica/image/upload/v1783042503/alerta_a3op0o.webp': 'img/alerta.webp',
    'https://res.cloudinary.com/dqqeavica/video/upload/v1759011577/Namedrop_Popup_ale2zy.mp3': 'sound/namedrop-popup.mp3',
    'https://res.cloudinary.com/dqqeavica/video/upload/v1759011577/Pay_fail_ls2aif.mp3': 'sound/pay-fail.mp3',
    'https://res.cloudinary.com/dqqeavica/video/upload/v1759011577/Pay_success_t5aawh.mp3': 'sound/pay-success.mp3',
    'https://res.cloudinary.com/dqqeavica/video/upload/v1759011577/Siri_End_kelv02.mp3': 'sound/siri-end.mp3',
    'https://res.cloudinary.com/dqqeavica/video/upload/v1759011577/Siri_star_g1owy4.mp3': 'sound/siri-star.mp3',
    'https://res.cloudinary.com/dqqeavica/video/upload/v1759011578/Default_notification_pkp4wr.mp3': 'sound/default-notification.mp3',
    'https://res.cloudinary.com/dqqeavica/video/upload/v1759011578/Keyboard_Enter_b9k2dc.mp3': 'sound/keyboard-enter.mp3',
    'https://res.cloudinary.com/dqqeavica/video/upload/v1759011578/Low_battery_d5qua1.mp3': 'sound/low-battery.mp3',
    'https://res.cloudinary.com/dqqeavica/video/upload/v1759011578/Low_battery_d5quaa1.mp3': 'sound/low-battery.mp3',
  };

  var ASSETS = {
    /* ÚNICO punto de cambio. Vacío = este repo. Si algún día vuelven a un CDN,
       se pone aquí la base terminada en '/' y no se toca nada más. */
    BASE: '',

    /* Lista de los archivos que existen, por si hace falta auditarla. */
    LISTA: [
          "img/agregar.webp",
          "img/al-dia.webp",
          "img/alerta.webp",
          "img/banner.gif",
          "img/barras.png",
          "img/base-de-datos.webp",
          "img/buscar.webp",
          "img/calendario.webp",
          "img/carpeta-drive.webp",
          "img/categoria1.png",
          "img/categoria2.png",
          "img/categoria3.png",
          "img/categoria4.png",
          "img/chat.webp",
          "img/chincheta.png",
          "img/devolver.webp",
          "img/drive.webp",
          "img/editar.webp",
          "img/eliminar.webp",
          "img/excel.webp",
          "img/expediente.webp",
          "img/firma.webp",
          "img/fondo-verde.png",
          "img/hacienda.png",
          "img/inbox.webp",
          "img/instalacion-ios.gif",
          "img/instalacion.gif",
          "img/juridico.png",
          "img/mapa.png",
          "img/memoria.webp",
          "img/mensaje.webp",
          "img/mostrar.png",
          "img/no-found.webp",
          "img/notificacion.webp",
          "img/ocultar.png",
          "img/outbox.webp",
          "img/pdf.webp",
          "img/predial.png",
          "img/reloj.png",
          "img/semaforo.png",
          "img/slider.gif",
          "img/subcategoria1-1.png",
          "img/subcategoria1-2.png",
          "img/subcategoria1-3.png",
          "img/subcategoria1-4.png",
          "img/subcategoria2-1.png",
          "img/subcategoria2-2.png",
          "img/subcategoria2-3.png",
          "img/subcategoria3-1.png",
          "img/subcategoria3-2.png",
          "img/subcategoria3-3.png",
          "img/subcategoria4-1.png",
          "img/subcategoria4-2.png",
          "img/subcategoria4-3.png",
          "img/target.webp",
          "img/tendencia.png",
          "img/usuarios.webp",
          "sound/default-notification.mp3",
          "sound/keyboard-enter.mp3",
          "sound/low-battery.mp3",
          "sound/namedrop-popup.mp3",
          "sound/pay-fail.mp3",
          "sound/pay-success.mp3",
          "sound/siri-end.mp3",
          "sound/siri-star.mp3"
    ],

    /* Resolvedor: A('img/pdf.webp') -> ruta final. */
    url: function (ruta) {
      var r = String(ruta == null ? '' : ruta).trim();
      if (!r) return '';
      if (/^(https?:|data:|blob:)/i.test(r)) return ASSETS.deCloudinary(r);
      r = r.replace(/^\.?\//, '');
      return ASSETS.BASE ? (ASSETS.BASE.replace(/\/+$/, '') + '/' + r) : r;
    },

    /* Enlace viejo de Cloudinary -> archivo local. Si no lo conoce, lo deja igual. */
    deCloudinary: function (url) {
      var u = String(url == null ? '' : url).trim();
      if (!u) return '';
      var local = LEGADO[u];
      if (!local) {
        try { local = LEGADO[decodeURI(u)]; } catch (_) {}
      }
      if (!local) return u;
      return ASSETS.BASE ? (ASSETS.BASE.replace(/\/+$/, '') + '/' + local) : local;
    },

    /* Reescribe en caliente lo que ya está pintado en pantalla. */
    aplicar: function (raiz) {
      var nodos = (raiz || document).querySelectorAll('img[src],source[src],audio[src],video[poster]');
      for (var i = 0; i < nodos.length; i++) {
        var el = nodos[i];
        ASSETS._arregla(el, 'src');
        ASSETS._arregla(el, 'poster');
      }
    },

    _arregla: function (el, attr) {
      var v = el.getAttribute && el.getAttribute(attr);
      if (!v) return;
      var nuevo = null;
      if (v.indexOf('res.cloudinary.com') !== -1) {
        nuevo = ASSETS.deCloudinary(v);
      } else if (ASSETS.BASE && /^(img|sound)\//.test(v)) {
        nuevo = ASSETS.url(v);
      }
      if (nuevo && nuevo !== v) el.setAttribute(attr, nuevo);
    },

    /* Vigila el HTML que app.js va pintando después. Solo se enciende si hace
       falta (hay BASE, o quedó algún enlace viejo de Cloudinary vivo). */
    vigilar: function () {
      if (!w.MutationObserver) return;
      var obs = new MutationObserver(function (muts) {
        for (var i = 0; i < muts.length; i++) {
          var añadidos = muts[i].addedNodes || [];
          for (var j = 0; j < añadidos.length; j++) {
            var n = añadidos[j];
            if (!n || n.nodeType !== 1) continue;
            if (n.tagName === 'IMG' || n.tagName === 'SOURCE' || n.tagName === 'AUDIO') {
              ASSETS._arregla(n, 'src');
            }
            if (n.querySelectorAll) ASSETS.aplicar(n);
          }
        }
      });
      obs.observe(document.documentElement, { childList: true, subtree: true });
    }
  };

  w.ASSETS = ASSETS;
  /* Atajo corto para usar dentro de app.js: A('img/pdf.webp') */
  w.A = function (ruta) { return ASSETS.url(ruta); };

  function arrancar() {
    ASSETS.aplicar(document);
    ASSETS.vigilar();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', arrancar);
  } else {
    arrancar();
  }
})(window);
