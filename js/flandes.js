/* ============================================================
   SEC-HACIENDA-FLANDES · IDENTIDAD FLANDES
   Fase 1 · 27/09/2026

   Qué hace
     Viste la app de la Secretaría de Hacienda con la identidad del
     ecosistema Flandes (la de CONTRATISTA-FLANDES): banner superior con
     foto y botón atrás, inicio con franja de cielo y tarjetas de acceso,
     portada de bienvenida para instalar, login con el escudo, cohete de
     guardado en vez del loader iOS, aviso de conexión y la firma de
     Oscar Polania en el pie.

   Cómo lo hace SIN tocar la lógica
     No reemplaza ninguna función de js/app.js ni de los módulos. Todo es
     un ESPEJO:
       · El inicio nuevo pinta una tarjeta por cada botón del inicio viejo
         y, al tocarla, hace clic en ese botón. Si app.js (o alcance.js,
         configuracion.js…) enciende o apaga un botón por permisos, la
         tarjeta se enciende o se apaga con él (MutationObserver).
       · El atrás del banner hace clic en el "Regresar" de la vista, que
         queda escondido. La vista sigue decidiendo a dónde volver.
       · El cohete sale cuando el #loader viejo se mostraría, y se va
         cuando él se va. Quién lo enciende sigue siendo app.js.
     Así, cualquier función que exista hoy sigue viva, y la regla de
     permisos se escribe en un solo sitio (app.js / alcance.js).

   Se carga el ÚLTIMO (después de mi-trabajo.js).
   ============================================================ */
(function () {
  'use strict';

  var K = window.KIT;
  if (!K) { try { console.warn('[flandes] falta kit.js'); } catch (e) {} return; }

  var M = window.MARCA || {};
  function $(id) { return document.getElementById(id); }

  /* ══════════════ 0) EL KIT NO HABLA CON EL CORE ══════════════
     Las piezas de Flandes piden 'ping' (conexión) y 'config' (firma) al
     FLANDES-CORE. Esta app tiene su propio backend (HACIENDA), así que se
     les responde aquí: la firma sale de sus valores por defecto y la
     conexión se comprueba tocando el backend de verdad. */
  var pedirOriginal = K.pedir;
  K.pedir = function (accion, datos, opciones) {
    if (accion === 'config') return Promise.resolve({});
    if (accion === 'ping') {
      var url = (M.API_URL || '') + '?action=ping&t=' + Date.now();
      return fetch(url, { cache: 'no-store' }).then(function () { return { ok: true }; });
    }
    return pedirOriginal.apply(K, arguments);
  };

  /* ══════════════ 1) TEMA: una sola llave para las dos capas ══════════════
     base-visual.js guarda el tema en 'hac.tema.v1' y el kit en su propio
     espacio. Se mantienen iguales en los dos sentidos. */
  K.cuando('kit:tema', function (d) {
    try { localStorage.setItem('hac.tema.v1', (d && d.tema) || K.temaActual()); } catch (e) {}
  });
  (function sincronizarDeEntrada() {
    var t = null;
    try { t = localStorage.getItem('hac.tema.v1'); } catch (e) {}
    if (t === 'oscuro' || t === 'claro') { if (t !== K.temaActual()) K.ponerTema(t, true); }
  }());

  /* ══════════════ 2) VISTAS: título y atrás del banner ══════════════ */
  var TITULOS = {
    'view-inicio': 'Sec. Hacienda',
    'view-lista': 'Pendientes predial',
    'view-respuesta': 'Atender solicitud',
    'view-agregar': 'Agregar atención predial',
    'view-atenciones': 'Atenciones registradas',
    'view-estadisticas': 'Estadísticas',
    'view-panel': 'Panel',
    'view-drive-anexos': 'Drive anexos',
    'view-drive-editar': 'Editar Drive anexos',
    'view-asignaciones': 'Mi semáforo',
    'view-agregar-asignacion': 'Nueva asignación',
    'view-ver-asignacion': 'Asignación',
    'view-editar-asignacion': 'Editar asignación',
    'view-bd-predial': 'Base de datos predial',
    'view-bdp-form': 'Expediente predial',
    'view-bdp-detalle': 'Detalle del expediente',
    'view-bdp-panel': 'Panel base de datos',
    'view-config': 'Configuración'
  };

  /* El "Regresar" de cada vista. Si una vista nueva no está aquí, se busca
     el primer botón que diga Regresar/Volver fuera de un modal. */
  var ATRAS = {
    'view-lista': '#lista-back',
    'view-respuesta': '#resp-back',
    'view-agregar': '#add-back',
    'view-atenciones': '#atenc-back',
    'view-estadisticas': 'button[onclick^="estadGoBack_"]',
    'view-panel': '#panel-back-btn',
    'view-drive-anexos': '#btn-drive-regresar',
    'view-drive-editar': '#btn-drive-back-edit',
    'view-asignaciones': '#btn-asignaciones-back',
    'view-agregar-asignacion': '#btn-proc-add-back',
    'view-ver-asignacion': '#btn-ver-asignacion-back',
    'view-editar-asignacion': '#btn-edit-asig-back',
    'view-bd-predial': '#btn-bdp-back',
    'view-bdp-form': '#btn-bdp-form-back',
    'view-bdp-detalle': '#btn-bdp-det-back',
    'view-bdp-panel': 'button[onclick^="bdppGoBack_"]',
    'view-config': '#cfg-regresar'
  };
  var SIN_BANNER = { 'view-login': 1, 'view-instalar': 1 };

  function botonAtras(vista) {
    var sel = ATRAS[vista.id];
    var b = sel ? vista.querySelector(sel) : null;
    if (b) return b;
    var todos = vista.querySelectorAll('button');
    for (var i = 0; i < todos.length; i++) {
      var t = (todos[i].textContent || '').trim();
      if (!/^(←\s*)?(regresar|volver)$/i.test(t)) continue;
      if (todos[i].closest('[id^="modal"], .modal, [class*="modal"]')) continue;
      return todos[i];
    }
    return null;
  }

  function vistaActiva() { return document.querySelector('.view.active'); }

  function perfil() { try { return (window.IDN && window.IDN.perfil()) || null; } catch (e) { return null; } }

  function nombreCorto(n) {
    var p = String(n || '').trim().split(/\s+/).filter(Boolean);
    if (p.length >= 3) return p[0] + ' ' + p[p.length >= 4 ? 2 : 1];
    return p.join(' ');
  }
  function tituloCaso(s) {
    return String(s || '').toLowerCase().replace(/(^|\s)(\S)/g, function (m, a, b) { return a + b.toUpperCase(); });
  }
  /* La foto: la del perfil o, si el perfil guardado no la trae todavía,
     la que identidad.js ya pintó en el avatar viejo del inicio. */
  function fotoActual(p) {
    var f = (p && p.foto) || '';
    var img = $('idn-avatar-img');
    if (!f && img && !img.classList.contains('hidden') && img.getAttribute('src')) f = img.src;
    return f;
  }
  function rolesTexto(p) {
    var r = (p && p.roles) || [];
    return r.length ? r.join(' · ') : 'Sin rol asignado';
  }

  var bannerListo = false;
  function montarBanner() {
    if (!K.piezas.banner) return;
    var p = perfil() || {};
    var menu = [
      { texto: 'Cambiar foto de perfil', al: function () { var a = $('idn-avatar'); if (a) a.click(); } },
      { texto: 'Instalar la app', al: function () { if (K.piezas.instalar) K.piezas.instalar.abrir(); } },
      { texto: 'Cambiar de usuario', al: function () { var b = $('btn-cambiar-usuario'); if (b) b.click(); } },
      { texto: 'Cerrar sesión', peligro: true, al: function () {
          if (window.IDN && window.IDN.cerrarSesion) window.IDN.cerrarSesion();
          else { var b = $('btn-logout'); if (b) b.click(); }
        } }
    ];
    K.piezas.banner.montar({
      titulo: M.TITULO || 'Sec. Hacienda',
      nombre: p.nombre || '',
      foto: fotoActual(p),
      rol: rolesTexto(p),
      menu: menu
    });
    var bar = K.piezas.banner.elemento();
    if (bar && K.piezas.cielo) K.piezas.cielo.soloFondo(bar);
    bannerListo = true;
  }

  function refrescarPerfil() {
    var p = perfil();
    if (!p) return;
    if (!bannerListo) montarBanner();
    K.piezas.banner.perfil({ nombre: p.nombre || '', foto: fotoActual(p), rol: rolesTexto(p) });
    pintarSaludo();
  }

  var ultimaVista = '';
  function alCambiarVista() {
    var v = vistaActiva();
    if (!v) return;
    var id = v.id;
    var raiz = document.documentElement;
    raiz.classList.toggle('hf-sin-banner', !!SIN_BANNER[id]);
    raiz.setAttribute('data-hf-vista', id);
    if (SIN_BANNER[id]) { ultimaVista = id; return; }

    if (!bannerListo) montarBanner();
    var t = TITULOS[id];
    if (id === 'view-lista') { var lt = $('lista-title'); if (lt && lt.textContent.trim()) t = tituloCaso(lt.textContent.trim()); }
    if (!t) { var h = v.querySelector('h1, h2'); t = h ? tituloCaso(h.textContent.trim()) : (M.TITULO || ''); }
    K.piezas.banner.vista(t);

    if (id === 'view-inicio') {
      K.piezas.banner.atras(null);
      refrescarPerfil();
      espejoInicio();
    } else {
      var b = botonAtras(v);
      if (b) {
        b.classList.add('hf-atras-viejo');
        K.piezas.banner.atras(function () { b.click(); });
      } else {
        K.piezas.banner.atras(function () { if (typeof window.showView === 'function') window.showView('view-inicio'); });
      }
    }
    ultimaVista = id;
  }

  /* ══════════════ 3) INICIO: franja de cielo + tarjetas espejo ══════════════ */

  /* Cada botón del inicio viejo → su tarjeta. El icono va con la acción
     (regla de Oss del 23/09: nada de imágenes que no correspondan). */
  var ACCESOS = [
    { bloque: 'PREDIAL', id: 'btn-agregar', t: 'AGREGAR ATENCIÓN PREDIAL', p: 'Registra la atención presencial de un contribuyente', img: 'img/agregar.webp' },
    { bloque: 'PREDIAL', id: 'btn-pendientes', t: 'PENDIENTES PREDIAL', p: 'Solicitudes que esperan respuesta', img: 'img/inbox.webp' },
    { bloque: 'PREDIAL', id: 'btn-atenciones-registradas', t: 'ATENCIONES REGISTRADAS', p: 'Todo lo que ya se atendió', img: 'img/outbox.webp' },
    { bloque: 'PREDIAL', id: 'btn-mis-informes', t: 'MIS INFORMES PREDIAL', p: 'Descarga tus atenciones a Excel por fechas', img: 'img/excel.webp' },
    { bloque: 'PREDIAL', id: 'btn-estadisticas', t: 'ESTADÍSTICAS', p: 'Tiempos, categorías y tendencia de las solicitudes', img: 'img/barras.png' },
    { bloque: 'PREDIAL', id: 'btn-bd-predial', t: 'BASE DE DATOS PREDIAL', p: 'Expedientes, actuaciones, bitácoras y seguimientos', img: 'img/base-de-datos.webp' },
    { bloque: 'GESTIÓN', id: 'btn-semaforo', t: 'MI SEMÁFORO', p: 'Asignaciones y vencimientos por días hábiles', img: 'img/semaforo.png' },
    { bloque: 'GESTIÓN', id: 'btn-drive-anexos', t: 'DRIVE ANEXOS', p: 'Carpetas de anexos de cada funcionario', img: 'img/drive.webp' },
    { bloque: 'ADMINISTRACIÓN', id: 'btn-config', t: 'CONFIGURACIÓN', p: 'Usuarios, roles, plantillas de mensajes y ajustes', icono: 'herramienta' }
  ];

  var caja = null;          /* el inicio nuevo */
  var tarjetas = {};        /* id del botón viejo → tarjeta */
  var bloques = {};         /* nombre → sección */
  var vigilante = null;

  function visible(b) {
    if (!b) return false;
    if (b.style.display === 'none' || b.hidden) return false;
    var fila = b.closest('#predial-submenu');
    /* los del submenú PREDIAL dependen solo de su propio display: el
       submenú plegado ya no existe en el inicio nuevo */
    if (fila) return b.style.display !== 'none';
    return true;
  }

  function tarjeta(def) {
    var ico = def.icono
      ? '<span class="acceso__img acceso__img--ico">' + K.icono(def.icono, 24) + '</span>'
      : '<img class="acceso__img" src="' + K.esc(def.img) + '" alt="" loading="lazy">';
    var b = K.nodo(
      '<button type="button" class="acceso" data-hf-de="' + K.esc(def.id) + '">' + ico +
      '  <span class="acceso__txt">' +
      '    <span class="acceso__t">' + K.esc(def.t) + '</span>' +
      '    <span class="acceso__p">' + K.esc(def.p) + '</span>' +
      '  </span>' +
      '</button>'
    );
    b.addEventListener('click', function () {
      var viejo = $(def.id);
      K.vibrar(8);
      if (viejo) viejo.click();
    });
    return b;
  }

  function construirInicio() {
    var vista = $('view-inicio');
    if (!vista || caja) return;
    var original = vista.querySelector('.card');
    if (original) original.classList.add('hf-original');

    caja = K.nodo('<div class="hf-inicio vista kit-ancho"></div>');
    var saludo = K.nodo(
      '<section class="saludo hf-saludo">' +
      '  <div class="saludo__txt">' +
      '    <p class="saludo__hola">Hola,</p>' +
      '    <h2 class="saludo__nombre" id="hf-nombre"></h2>' +
      '    <p class="saludo__doc" id="hf-roles"></p>' +
      '  </div>' +
      '  <button type="button" class="hf-cara" id="hf-cara" aria-label="Cambiar foto de perfil"></button>' +
      '</section>'
    );
    saludo.querySelector('#hf-cara').addEventListener('click', function () { var a = $('idn-avatar'); if (a) a.click(); });
    caja.appendChild(saludo);
    if (K.piezas.cielo) K.piezas.cielo.poner(saludo, { burbujas: 3 });

    var orden = [];
    ACCESOS.forEach(function (def) {
      if (!bloques[def.bloque]) {
        var s = K.nodo('<section class="bloque"><h3 class="bloque__t">' + K.esc(def.bloque) + '</h3>' +
          '<div class="kit-rejilla kit-rejilla--auto accesos"></div></section>');
        bloques[def.bloque] = s;
        orden.push(s);
      }
      var t = tarjeta(def);
      tarjetas[def.id] = t;
      bloques[def.bloque].querySelector('.accesos').appendChild(t);
    });
    orden.forEach(function (s) { caja.appendChild(s); });
    var vacio = K.nodo('<p class="hf-vacio" hidden>Tu usuario todavía no tiene un rol con accesos. Pide a un administrador que te asigne uno desde Configuración.</p>');
    caja.appendChild(vacio);
    if (K.piezas.creditos) K.piezas.creditos.montar(caja);

    vista.insertBefore(caja, vista.firstChild);
  }

  /* Botones que otros módulos agregan al inicio y no están en ACCESOS:
     también se reflejan, en su propio bloque, para que nada se pierda. */
  function botonesSueltos() {
    var vista = $('view-inicio');
    if (!vista) return;
    var orig = vista.querySelector('.hf-original');
    if (!orig) return;
    var conocidos = {};
    ACCESOS.forEach(function (d) { conocidos[d.id] = 1; });
    ['btn-logout', 'btn-cambiar-usuario', 'btn-cat-predial', 'idn-avatar'].forEach(function (x) { conocidos[x] = 1; });
    orig.querySelectorAll('button[id]').forEach(function (b) {
      if (conocidos[b.id] || tarjetas[b.id]) return;
      if (b.closest('.idn-avatar-wrap')) return;
      var img = b.querySelector('img');
      var def = {
        bloque: 'MÁS', id: b.id,
        t: (b.textContent || '').replace(/\s+/g, ' ').trim().toUpperCase(),
        p: '', img: img ? img.getAttribute('src') : '', icono: img ? '' : 'mas'
      };
      if (!bloques['MÁS']) {
        var s = K.nodo('<section class="bloque"><h3 class="bloque__t">MÁS</h3><div class="kit-rejilla kit-rejilla--auto accesos"></div></section>');
        bloques['MÁS'] = s;
        var pie = caja.querySelector('.kit-cred');
        caja.insertBefore(s, caja.querySelector('.hf-vacio') || pie);
      }
      var t = tarjeta(def);
      tarjetas[b.id] = t;
      bloques['MÁS'].querySelector('.accesos').appendChild(t);
    });
  }

  function espejoInicio() {
    construirInicio();
    if (!caja) return;
    botonesSueltos();
    var alguno = false;
    Object.keys(tarjetas).forEach(function (id) {
      var on = visible($(id));
      tarjetas[id].hidden = !on;
      if (on) alguno = true;
    });
    Object.keys(bloques).forEach(function (n) {
      var hay = bloques[n].querySelector('.acceso:not([hidden])');
      bloques[n].hidden = !hay;
    });
    var v = caja.querySelector('.hf-vacio');
    if (v) v.hidden = alguno || !perfil();
    pintarSaludo();

    if (!vigilante) {
      var orig = $('view-inicio').querySelector('.hf-original');
      vigilante = new MutationObserver(function () {
        clearTimeout(vigilante._t);
        vigilante._t = setTimeout(espejoInicio, 30);
      });
      if (orig) vigilante.observe(orig, { subtree: true, childList: true, attributes: true, attributeFilter: ['style', 'hidden', 'class', 'src'] });
    }
  }

  function pintarSaludo() {
    if (!caja) return;
    var p = perfil();
    var n = $('hf-nombre'), r = $('hf-roles'), c = $('hf-cara');
    var nombre = (p && p.nombre) || ($('inicio-nombre') ? $('inicio-nombre').textContent : '');
    if (n) n.textContent = tituloCaso(nombreCorto(nombre));
    if (r) r.textContent = rolesTexto(p);
    if (c) {
      var foto = fotoActual(p);
      var clave = foto + '|' + nombre;
      if (c.getAttribute('data-k') !== clave) {
        c.setAttribute('data-k', clave);
        c.innerHTML = '';
        if (K.piezas.personas) c.appendChild(K.piezas.personas.avatar(nombre, { tam: 64, foto: foto }));
        else c.textContent = nombre.slice(0, 2);
        c.insertAdjacentHTML('beforeend', '<span class="hf-cara__cam" aria-hidden="true">' + K.icono('camara', 14) + '</span>');
      }
    }
  }

  /* ══════════════ 4) PORTADA Y LOGIN ══════════════ */
  function vestirLogin() {
    var login = $('view-login');
    if (!login || login.querySelector('.hf-marca')) return;
    var card = login.querySelector('.card');
    if (!card) return;
    var h1 = card.querySelector('h1');
    var marca = K.nodo(
      '<div class="hf-marca">' +
      '  <img class="hf-marca__logo" src="' + K.esc(M.APP_ICON || 'img/icono-512.png') + '" alt="Escudo Sec. Hacienda">' +
      '  <h1 class="hf-marca__t">Sec. Hacienda</h1>' +
      '  <p class="hf-marca__sub">Alcaldía de Flandes · solo personal autorizado de la Secretaría</p>' +
      '</div>'
    );
    card.insertBefore(marca, card.firstChild);
    if (h1) h1.classList.add('hf-oculto');
    var ayuda = card.querySelector('.helper');
    if (ayuda && /personal autorizado/i.test(ayuda.textContent)) ayuda.classList.add('hf-oculto');
    var pie = $('hf-cred-login');
    if (pie && K.piezas.creditos) pie.innerHTML = K.piezas.creditos.html();

    var tema = K.nodo('<button type="button" class="hf-tema" aria-label="Cambiar tema"></button>');
    function pintarTema() { tema.innerHTML = K.icono(K.temaActual() === 'oscuro' ? 'sol' : 'luna', 18); }
    tema.addEventListener('click', function () { K.alternarTema(); pintarTema(); });
    K.cuando('kit:tema', pintarTema);
    pintarTema();
    document.body.appendChild(tema);
  }

  function portada() {
    var b = K.piezas.bienvenida;
    if (!b || !b.procede || !b.procede()) return;
    b.abrir({
      titulo: 'Sec. Hacienda',
      sub: 'Alcaldía de Flandes',
      imagen: M.APP_ICON || 'img/icono-512.png'
    }).then(function () {
      var v = vistaActiva();
      if (v && v.id === 'view-instalar' && typeof window.showView === 'function') window.showView('view-login');
    });
  }

  /* La vista INSTALAR vieja queda como respaldo detrás de la portada: su
     botón abre la guía del kit (los 8 casos de instalación) y se le suma
     el camino de seguir en el navegador, que antes no existía. */
  function vestirInstalar() {
    var v = $('view-instalar');
    if (!v || v.querySelector('.hf-seguir')) return;
    var card = v.querySelector('.card');
    if (!card) return;
    card.innerHTML =
      '<div class="hf-marca">' +
      '  <img class="hf-marca__logo" src="' + K.esc(M.APP_ICON || 'img/icono-512.png') + '" alt="">' +
      '  <h1 class="hf-marca__t">Sec. Hacienda</h1>' +
      '  <p class="hf-marca__sub">Alcaldía de Flandes · herramienta de uso exclusivo para personal autorizado</p>' +
      '</div>' +
      '<div class="hf-botones">' +
      '  <button type="button" class="kit-btn kit-btn--marca hf-instalar">' + K.icono('descargar', 18) + ' Cómo instalarla</button>' +
      '  <button type="button" class="kit-btn kit-btn--plano hf-seguir">Continuar en el navegador</button>' +
      '</div>' +
      '<button id="btn-instalar" type="button" hidden></button>' +
      '<footer class="kit-cred">' + (K.piezas.creditos ? K.piezas.creditos.html() : '') + '</footer>';
    card.querySelector('.hf-instalar').addEventListener('click', function () { if (K.piezas.instalar) K.piezas.instalar.abrir(); });
    card.querySelector('.hf-seguir').addEventListener('click', function () { window.showView('view-login'); });
  }

  /* ══════════════ 5) EL COHETE EN VEZ DEL LOADER iOS ══════════════
     El #loader viejo sigue existiendo (app.js lo enciende y lo apaga),
     pero ya no se ve: cuando él se mostraría, sale el cohete del kit.
     esqueletos.js ya decide cuándo hay loader (solo en escrituras y en
     el login); aquí solo se cambia CÓMO se ve. */
  function vigilarLoader() {
    var l = $('loader');
    if (!l || !K.piezas.guardado) return;
    var abierto = false;
    function mirar() {
      var on = !l.classList.contains('hidden') && !document.body.classList.contains('hac-sin-loader');
      if (on && !abierto) {
        abierto = true;
        var v = vistaActiva();
        var entrando = v && (v.id === 'view-login' || v.id === 'view-instalar');
        K.piezas.guardado.abrir(entrando
          ? { titulo: 'Entrando', sub: 'Estamos validando tu acceso.', pasos: ['Validando tu acceso…', 'Cargando tus permisos…', 'Preparando tu inicio…'] }
          : { titulo: 'Guardando', sub: 'No cierres esta ventana hasta que termine.', pasos: ['Enviando la información…', 'Guardando en la hoja…', 'Actualizando la vista…'] });
      } else if (!on && abierto) {
        abierto = false;
        K.piezas.guardado.cerrar();
      }
    }
    new MutationObserver(mirar).observe(l, { attributes: true, attributeFilter: ['class'] });
    new MutationObserver(mirar).observe(document.body, { attributes: true, attributeFilter: ['class'] });
  }

  /* ══════════════ ARRANQUE ══════════════ */
  function vigilarVistas() {
    var obs = new MutationObserver(function () {
      clearTimeout(obs._t);
      obs._t = setTimeout(alCambiarVista, 0);
    });
    document.querySelectorAll('.view').forEach(function (v) {
      obs.observe(v, { attributes: true, attributeFilter: ['class'] });
    });
    /* vistas que los módulos crean después (Configuración, por ejemplo) */
    var cont = document.querySelector('.container') || document.body;
    new MutationObserver(function (muts) {
      muts.forEach(function (m) {
        m.addedNodes.forEach(function (n) {
          if (n.nodeType === 1 && n.classList.contains('view')) obs.observe(n, { attributes: true, attributeFilter: ['class'] });
        });
      });
    }).observe(cont, { childList: true });
    /* el título de PENDIENTES cambia según la lista que se abra */
    var lt = $('lista-title');
    if (lt) new MutationObserver(function () { if (ultimaVista === 'view-lista') alCambiarVista(); }).observe(lt, { childList: true, characterData: true, subtree: true });
  }

  function arrancar() {
    try { if (K.piezas.version) K.piezas.version.vigilar(); } catch (e) {}
    try { if (K.piezas.conexion) K.piezas.conexion.vigilar(); } catch (e) {}
    try { if (K.piezas.instalar) K.piezas.instalar.vigilar(); } catch (e) {}
    vestirLogin();
    vestirInstalar();
    vigilarLoader();
    vigilarVistas();
    alCambiarVista();
    /* la foto o el nombre cambian (subir foto, cambiar de usuario) */
    var ini = $('inicio-nombre');
    if (ini) new MutationObserver(refrescarPerfil).observe(ini, { childList: true, characterData: true, subtree: true });
    document.addEventListener('load', function (e) {
      if (e.target && e.target.id === 'idn-avatar-img') refrescarPerfil();
    }, true);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', arrancar);
  else arrancar();
  window.addEventListener('load', function () { setTimeout(portada, 60); });

  window.HAC_FLANDES = { refrescar: function () { alCambiarVista(); refrescarPerfil(); } };
})();
