/* ============================================================
   BASE VISUAL — FASE 3 (SEC-HACIENDA)
   Se carga DESPUÉS de app.js, identidad.js y configuracion.js.
   No modifica app.js: reemplaza en caliente lo que hace falta. 

   Capas:
     1 modo oscuro          6 transición lateral entre vistas
     2 ancho en PC          7 pull to refresh
     3 clic fuera cierra    8 sonido sin retardo
     4 esqueletos de carga  9 modal de PDF (pestaña/imprimir/descargar)
     5 ripple + háptica    10 atenciones en rejilla y por tandas
   ============================================================ */
(function () {
  'use strict';

  var LS_TEMA = 'hac.tema.v1';
  var raiz = document.documentElement;

  function $(id) { return document.getElementById(id); }
  function existe(f) { return typeof f === 'function'; }

  /* ══════════════ 1) MODO OSCURO ══════════════ */

  function temaGuardado_() {
    try { return localStorage.getItem(LS_TEMA) || ''; } catch (e) { return ''; }
  }
  function temaActual_() {
    return raiz.getAttribute('data-tema') === 'oscuro' ? 'oscuro' : 'claro';
  }
  function aplicarTema_(t, guardar) {
    var oscuro = (t === 'oscuro');
    raiz.setAttribute('data-tema', oscuro ? 'oscuro' : 'claro');
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', oscuro ? '#0d1512' : '#06402B');
    var b = $('btn-tema');
    if (b) {
      b.textContent = oscuro ? '☀️' : '🌙';
      b.setAttribute('aria-label', oscuro ? 'Modo claro' : 'Modo oscuro');
      b.setAttribute('title', oscuro ? 'Modo claro' : 'Modo oscuro');
    }
    if (guardar) { try { localStorage.setItem(LS_TEMA, oscuro ? 'oscuro' : 'claro'); } catch (e) {} }
  }
  function alternarTema_() {
    aplicarTema_(temaActual_() === 'oscuro' ? 'claro' : 'oscuro', true);
    sonar_('sound/keyboard-enter.mp3');
    vibrar_(8);
  }
  function montarBotonTema_() {
    if ($('btn-tema')) return;
    var b = document.createElement('button');
    b.id = 'btn-tema';
    b.type = 'button';
    b.className = 'tema-btn';
    b.addEventListener('click', alternarTema_);
    document.body.appendChild(b);
    aplicarTema_(temaActual_(), false);
  }

  /* ══════════════ 2) ANCHO EN PC ══════════════ */

  var VISTAS_ANCHAS = {
    'view-inicio': 1, 'view-lista': 1, 'view-atenciones': 1,
    'view-bd-predial': 1, 'view-asignaciones': 1, 'view-panel': 1,
    'view-estadisticas': 1, 'view-drive-anexos': 1, 'view-bdp-panel': 1
  };
  function aplicarAncho_(id) {
    raiz.setAttribute('data-ancho', VISTAS_ANCHAS[id] ? '1' : '0');
  }

  /* ══════════════ 3) CLIC FUERA CIERRA EL MODAL ══════════════ */

  /* Mapa REAL leído de index.html: cada capa y el botón que ya la cierra. */
  var CIERRES = {
    'modal-respuesta-limpia': ['btn-cerrar-respuesta-limpia'],
    'modal-rebotar':          ['btn-rebote-regresar'],
    'modal-solicitar-proceso':['btn-sp-cancelar'],
    'modal-decision':         ['btn-dec-cancelar'],
    'modal-chat':             ['btn-chat-close'],
    'modal-expediente':       ['btn-expediente-cancelar'],
    'modal-bdp-decision':     ['btn-bdp-dec-cancelar'],
    'modal-bdp-rebotar':      ['btn-bdp-reb-cancelar'],
    'modal-bdp-expedientes':  ['btn-bdp-exp-salir'],
    /* dos estados: A (viendo archivo) y B (explorador) */
    'modal-bdp-archivo':      ['btn-bdp-arch-salir1', 'btn-bdp-arch-salir2']
  };

  function visible_(el) {
    if (!el) return false;
    /* #modal-chat no usa .hidden sino .open (styles.css: display none/flex) */
    if (el.id === 'modal-chat') return el.classList.contains('open');
    if (el.classList.contains('hidden')) return false;
    return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
  }
  function modalAbierto_() {
    for (var id in CIERRES) { if (visible_($(id))) return $(id); }
    return null;
  }
  function cerrarModal_(capa) {
    var ids = CIERRES[capa.id] || [];
    for (var i = 0; i < ids.length; i++) {
      var b = $(ids[i]);
      if (visible_(b)) { b.click(); return true; }
    }
    capa.classList.add('hidden');
    return true;
  }

  var abajoEn = null;
  function montarClicFuera_() {
    document.addEventListener('pointerdown', function (e) { abajoEn = e.target; }, true);
    document.addEventListener('click', function (e) {
      var capa = e.target;
      if (!capa || !capa.id || !CIERRES[capa.id]) return;
      /* solo si el gesto EMPEZÓ y TERMINÓ sobre la capa (no arrastres desde dentro) */
      if (abajoEn !== capa) return;
      /* app.js ya cierra #modal-chat por su cuenta al tocar la capa: si ya se
         cerró, aquí no se hace nada (no se cierra dos veces). */
      if (!visible_(capa)) return;
      e.stopPropagation();
      cerrarModal_(capa);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      var m = modalAbierto_();
      if (m) { e.preventDefault(); cerrarModal_(m); }
    });
  }

  /* ══════════════ 4) ESQUELETOS DE CARGA ══════════════ */

  /* ══ FASE 7.1 · el esqueleto MANDA sobre el loader ══
     El loader es una capa a pantalla completa (inset:0, z-index 9999,
     desenfoque de 6px) que aparece a los 120 ms de cualquier petición
     del usuario. El esqueleto se pintaba debajo y no se veía nunca.
     Mientras haya un esqueleto en pantalla, el loader se calla: el
     esqueleto YA dice que está cargando, y se ve mucho mejor.
     El escudo de la capa 12 sigue puesto (es invisible), así que no se
     pierde la protección contra el doble toque.                      */
  var esqueletosVivos = 0, relojEsqueleto = null;

  function marcarEsqueleto_() {
    esqueletosVivos++;
    document.body.classList.add('hac-esqueleto');
    /* Red de seguridad: si un cargador se cae y nunca termina, el loader
       no puede quedarse mudo para siempre. */
    if (relojEsqueleto) clearTimeout(relojEsqueleto);
    relojEsqueleto = setTimeout(soltarEsqueletoTodo_, 20000);
  }
  function soltarEsqueleto_() {
    esqueletosVivos = Math.max(0, esqueletosVivos - 1);
    if (esqueletosVivos === 0) soltarEsqueletoTodo_();
  }
  function soltarEsqueletoTodo_() {
    esqueletosVivos = 0;
    if (relojEsqueleto) { clearTimeout(relojEsqueleto); relojEsqueleto = null; }
    document.body.classList.remove('hac-esqueleto');
  }

  function esqueleto_(sel, n, rejilla) {
    var wrap = document.querySelector(sel);
    if (!wrap) return;
    marcarEsqueleto_();
    var html = '';
    for (var i = 0; i < n; i++) {
      html += '<div class="sk sk-card" aria-hidden="true">' +
              '<div class="sk sk-line w60"></div>' +
              '<div class="sk sk-line w95"></div>' +
              '<div class="sk sk-line w80"></div>' +
              '<div class="sk sk-line w40"></div>' +
              '</div>';
    }
    wrap.innerHTML = rejilla ? html : '<div class="sk-wrap">' + html + '</div>';
  }

  /* ══════════════ 5) RIPPLE + HÁPTICA ══════════════ */

  var SEL_TOCABLE = 'button, .chip, .icon-btn, .cat-pill, .panel-tab, .login-tab,' +
                    '.proc-icon-btn, .bdp-icon-btn, .pin-key, .idn-key, .estad-pager-btn,' +
                    '.icon-in-input, .pdf-acc, .tema-btn';

  function vibrar_(ms) {
    try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) {}
  }
  function reducido_() {
    try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
  }
  function montarRipple_() {
    document.addEventListener('pointerdown', function (e) {
      var el = e.target && e.target.closest ? e.target.closest(SEL_TOCABLE) : null;
      if (!el || el.disabled) return;
      vibrar_(8);
      if (reducido_()) return;
      var r = el.getBoundingClientRect();
      if (!r.width) return;
      if (getComputedStyle(el).position === 'static') el.classList.add('rip-host');
      else el.style.overflow = el.style.overflow || 'hidden';
      var d = Math.max(r.width, r.height);
      var s = document.createElement('span');
      s.className = 'rip';
      s.style.width = s.style.height = d + 'px';
      s.style.left = (e.clientX - r.left - d / 2) + 'px';
      s.style.top = (e.clientY - r.top - d / 2) + 'px';
      el.appendChild(s);
      setTimeout(function () { if (s.parentNode) s.parentNode.removeChild(s); }, 560);
    }, true);
  }

  /* ══════════════ 6) TRANSICIÓN LATERAL ══════════════ */

  var pila = [];
  function transicion_(id) {
    var el = $(id);
    if (!el || reducido_()) return;
    var pos = pila.indexOf(id);
    var atras = pos !== -1 && pos < pila.length - 1;
    if (atras) pila.length = pos + 1;
    else if (pila[pila.length - 1] !== id) pila.push(id);
    if (pila.length > 24) pila.shift();
    el.classList.remove('vt-ade', 'vt-atr');
    void el.offsetWidth;                      /* reinicia la animación */
    el.classList.add(atras ? 'vt-atr' : 'vt-ade');
  }

  /* ══════════════ 7) PULL TO REFRESH ══════════════ */

  /* vista -> cómo se recarga. Todas son declaraciones de función: viven en window. */
  var ultimoEstadoLista = 'PENDIENTE';
  var REFRESCO = {
    'view-lista':       { sel: '#lista-wrap', n: 4, f: function () { return window.loadAndRenderList_(ultimoEstadoLista); } },
    'view-atenciones':  { sel: '#atenc-wrap', n: 6, rejilla: true, f: function () { return window.atencionesLoadAll_(); } },
    'view-bd-predial':  { sel: '#bdp-list',   n: 4, f: function () { return window.loadBDPredial_(); } },
    'view-asignaciones':{ sel: '#proc-list',  n: 3, f: function () { return window.loadAndRenderProcesos_(); } },
    'view-drive-anexos':{ sel: '#drive-grid', n: 6, f: function () { return window.loadDriveData_(); } },
    'view-estadisticas':{ sel: null,          n: 0, f: function () { return window.loadEstadisticasData_(); } }
  };

  function vistaActiva_() {
    var v = document.querySelector('.view.active');
    return v ? v.id : '';
  }
  function refrescable_() {
    var id = vistaActiva_();
    var r = REFRESCO[id];
    if (!r || !existe(r.f)) return null;
    return r;
  }

  var UMBRAL = 78, TOPE = 110;
  var y0 = 0, tirando = false, listo = false, ptr = null, ocupado = false;

  function montarPTR_() {
    ptr = document.createElement('div');
    ptr.id = 'ptr';
    ptr.innerHTML = '<i></i><span>↓</span>';
    document.body.appendChild(ptr);
    ptrPos_(-60, 0);

    document.addEventListener('touchstart', function (e) {
      if (ocupado || e.touches.length !== 1) return;
      if (window.scrollY > 0 || modalAbierto_() || !refrescable_()) return;
      y0 = e.touches[0].clientY; tirando = true; listo = false;
    }, { passive: true });

    document.addEventListener('touchmove', function (e) {
      if (!tirando) return;
      var d = e.touches[0].clientY - y0;
      if (d <= 0) { tirando = false; ptrPos_(-60, 0); return; }
      d = Math.min(d * 0.55, TOPE);
      listo = d >= UMBRAL;
      ptr.classList.toggle('ptr-listo', listo);
      ptr.querySelector('span').textContent = listo ? '↑' : '↓';
      ptrPos_(d - 46, Math.min(1, d / UMBRAL));
    }, { passive: true });

    document.addEventListener('touchend', function () {
      if (!tirando) return;
      tirando = false;
      if (listo) refrescarAhora_();
      else ptrPos_(-60, 0);
    });
  }
  function ptrPos_(y, op) {
    if (!ptr) return;
    ptr.style.transition = tirando ? 'none' : 'transform .22s ease, opacity .22s ease';
    ptr.style.transform = 'translateY(' + y + 'px)';
    ptr.style.opacity = String(op);
  }
  function refrescarAhora_() {
    var r = refrescable_();
    if (!r || ocupado) { ptrPos_(-60, 0); return; }
    ocupado = true;
    ptr.classList.add('ptr-girando');
    ptr.querySelector('span').textContent = '';
    ptrPos_(16, 1);
    vibrar_(12);
    var tarea;
    try { tarea = r.f(); } catch (e) { tarea = null; }
    Promise.resolve(tarea).catch(function () {})
      .then(function () {
        ocupado = false;
        ptr.classList.remove('ptr-girando', 'ptr-listo');
        ptr.querySelector('span').textContent = '↓';
        ptrPos_(-60, 0);
      });
  }

  /* ══════════════ 8) SONIDO SIN RETARDO ══════════════ */

  var PISTAS = [
    'sound/pay-fail.mp3', 'sound/default-notification.mp3', 'sound/pay-success.mp3',
    'sound/low-battery.mp3', 'sound/siri-star.mp3', 'sound/siri-end.mp3',
    'sound/keyboard-enter.mp3', 'sound/namedrop-popup.mp3'
  ];
  var ctx = null, buffers = {}, pool = {}, desbloqueado = false;

  function ruta_(u) {
    var s = String(u || '');
    /* respeta el resolvedor de la Fase 2 si está */
    if (window.ASSETS && existe(window.ASSETS.A)) { try { return window.ASSETS.A(s); } catch (e) {} }
    return s;
  }
  function precargarWebAudio_() {
    if (!ctx) return;
    PISTAS.forEach(function (p) {
      if (buffers[p]) return;
      fetch(ruta_(p)).then(function (r) { return r.arrayBuffer(); })
        .then(function (b) {
          return new Promise(function (ok, mal) { ctx.decodeAudioData(b, ok, mal); });
        })
        .then(function (buf) { buffers[p] = buf; })
        .catch(function () {});
    });
  }
  /* FASE 10 — antes esto creaba 24 <audio> (8 pistas x 3) con preload='auto'
     a los 1,5 s de abrir, más los 8 fetch de WebAudio: 32 peticiones de
     sonido de golpe, muchas de ellas abortadas al cambiar de vista o al
     relevarse el service worker. Ese era el "net::ERR_FAILED" de la
     consola sobre los mp3. Ahora el lote de cada pista se crea la primera
     vez que esa pista suena de verdad, y quien precarga es WebAudio. */
  function lote_(p) {
    if (pool[p]) return pool[p];
    pool[p] = [0, 1, 2].map(function () {
      var a = new Audio(ruta_(p));
      a.preload = 'auto';
      return a;
    });
    return pool[p];
  }
  function desbloquear_() {
    if (desbloqueado) return;
    desbloqueado = true;
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (AC) { ctx = new AC(); if (ctx.state === 'suspended') ctx.resume(); precargarWebAudio_(); }
    } catch (e) { ctx = null; }
  }
  function sonar_(url) {
    var p = String(url || '');
    if (!p) return;
    if (ctx && buffers[p]) {
      try {
        if (ctx.state === 'suspended') ctx.resume();
        var s = ctx.createBufferSource();
        s.buffer = buffers[p];
        s.connect(ctx.destination);
        s.start(0);
        return;
      } catch (e) {}
    }
    var lote = lote_(p);
    if (lote) {
      for (var i = 0; i < lote.length; i++) {
        var a = lote[i];
        if (a.paused || a.ended) {
          try { a.currentTime = 0; a.play().catch(function () {}); return; } catch (e) {}
        }
      }
      try { lote[0].currentTime = 0; lote[0].play().catch(function () {}); return; } catch (e) {}
    }
    try { var n = new Audio(ruta_(p)); n.play().catch(function () {}); } catch (e) {}
  }
  function montarSonido_() {
    window.playSoundOnce = sonar_;
    ['pointerdown', 'keydown', 'touchstart'].forEach(function (ev) {
      window.addEventListener(ev, desbloquear_, { once: true, capture: true });
    });
    /* FASE 10 — fuera la precarga a ciegas de los 24 <audio>: hasta que no
       hay un gesto del usuario el navegador no deja sonar nada, así que
       bajarlos antes solo servía para llenar la consola de peticiones
       abortadas. */
  }

  /* ══════════════ 9) MODAL DE PDF ══════════════ */

  function idDrive_(u) {
    var s = String(u || '');
    var m = s.match(/\/file\/d\/([-\w]{20,})/) || s.match(/[?&]id=([-\w]{20,})/) ||
            s.match(/\/d\/([-\w]{20,})/);
    return m ? m[1] : '';
  }
  function urlActualPDF_() {
    var f = $('bdp-arch-iframe');
    return f ? idDrive_(f.getAttribute('src') || '') : '';
  }
  /* FASE 9 · ajuste 4 — "Abrir en pestaña" e "Imprimir" salieron de esta fila:
     la previsualización de Drive ya trae dentro del propio modal su botón para
     abrir el archivo en ventana aparte, y estos dos abrían pestañas que el
     navegador bloqueaba. imprimirPDF_ se conserva porque sigue siendo la
     entrada a la impresión de verdad (VISOR.imprimir) si algún día se vuelve
     a colgar de un botón. */
  function descargarPDF_() {
    var id = urlActualPDF_();
    if (!id) return avisoPDF_();
    window.open('https://drive.google.com/uc?export=download&id=' + id, '_blank', 'noopener');
  }
  function imprimirPDF_() {
    var id = urlActualPDF_();
    if (!id) return avisoPDF_();
    /* FASE 8: ya se puede imprimir de verdad. El visor (js/visor.js) le pide
       el PDF al backend, lo arma como blob del MISMO origen y llama a print().
       Si el visor no cargó, se queda el comportamiento de antes: abrir el
       visor de Drive, que trae su propio botón de imprimir. */
    if (window.VISOR && typeof window.VISOR.imprimir === 'function') {
      window.VISOR.imprimir(id, 'Expediente');
      return;
    }
    var w = window.open('https://drive.google.com/file/d/' + id + '/view', '_blank', 'noopener');
    if (!w && window.Swal) {
      Swal.fire({ icon: 'info', title: 'Permite las ventanas emergentes',
                  text: 'Para imprimir hay que abrir el expediente en una pestaña.' });
    }
  }
  function avisoPDF_() {
    if (window.Swal) Swal.fire({ icon: 'warning', title: 'Sin archivo abierto' });
  }
  function montarPDF_() {
    var cont = $('bdp-arch-view');
    if (!cont || $('pdf-acciones')) return;
    var fila = document.createElement('div');
    fila.id = 'pdf-acciones';
    fila.className = 'pdf-acciones';
    fila.innerHTML =
      '<button type="button" class="pdf-acc" id="btn-pdf-descargar">⬇ Descargar</button>';
    var marco = cont.querySelector('.bdp-arch-frame');
    if (marco && marco.nextSibling) cont.insertBefore(fila, marco.nextSibling);
    else cont.appendChild(fila);
    $('btn-pdf-descargar').addEventListener('click', descargarPDF_);
  }

  /* ══════════════ 10) ATENCIONES: rejilla + tandas ══════════════ */

  var TANDA = 30;
  var atencTodos = [], atencPintados = 0, atencObs = null;

  function esc_(s) {
    return existe(window.escapeHtml_) ? window.escapeHtml_(s)
      : String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
          return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
  }
  function tarjetaAtenc_(it) {
    var resp = (it.respondida && String(it.respondida).trim())
      ? '<p><span style="color:#16a34a;font-weight:1000;">RESPONDIDA:</span> ' + esc_(it.respondida) + '</p>' : '';
    return '<div class="sol-card">' +
      '<div class="sol-head"><p class="sol-title">Usuario: <b>' + esc_(it.nombre || '') + '</b></p></div>' +
      '<div class="sol-meta">' +
        '<p>Documento / NIT: ' + esc_(it.documento || '') + '</p>' +
        '<p>Residencia: ' + esc_(it.barrio || '') + '</p>' +
        '<p>Código Catastral: ' + esc_(it.codigo || '') + '</p>' +
        '<p>Solicitud: ' + esc_(it.solicitud || '') + '</p>' +
        '<p><span style="color:#dc2626;font-weight:1000;">Fecha:</span> ' + esc_(it.fecha || '') + '</p>' +
        resp +
      '</div></div>';
  }
  function pintarTanda_() {
    var wrap = $('atenc-wrap');
    if (!wrap) return;
    var sent = wrap.querySelector('.atenc-sentinela');
    if (sent) wrap.removeChild(sent);
    var hasta = Math.min(atencPintados + TANDA, atencTodos.length);
    var html = '';
    for (var i = atencPintados; i < hasta; i++) html += tarjetaAtenc_(atencTodos[i]);
    wrap.insertAdjacentHTML('beforeend', html);
    atencPintados = hasta;
    if (atencPintados < atencTodos.length) {
      wrap.insertAdjacentHTML('beforeend',
        '<div class="atenc-sentinela"></div>' +
        '<div class="atenc-mas">' + atencPintados + ' de ' + atencTodos.length + '</div>');
      var s = wrap.querySelector('.atenc-sentinela');
      if (atencObs && s) atencObs.observe(s);
    }
  }
  function renderAtencionesRapido_(items) {
    var wrap = $('atenc-wrap');
    if (!wrap) return;
    atencTodos = Array.isArray(items) ? items : [];
    atencPintados = 0;
    wrap.classList.add('atenc-grid');
    var cnt = $('atenc-count');
    if (cnt) cnt.textContent = String(atencTodos.length);
    if (atencObs) atencObs.disconnect();
    wrap.innerHTML = '';
    if (!atencTodos.length) {
      wrap.innerHTML = '<p class="muted center atenc-vacio" style="margin-top:20px;">No hay registros.</p>';
      return;
    }
    if (!atencObs && window.IntersectionObserver) {
      atencObs = new IntersectionObserver(function (ent) {
        for (var i = 0; i < ent.length; i++) if (ent[i].isIntersecting) { pintarTanda_(); break; }
      }, { rootMargin: '600px 0px' });
    }
    pintarTanda_();
  }

  /* ══════════════ ENGANCHES ══════════════ */

  function envolver_(nombre, antes, despues) {
    var orig = window[nombre];
    if (!existe(orig)) return false;
    window[nombre] = function () {
      var args = arguments;
      try { if (antes) antes.apply(null, args); } catch (e) {}
      var r = orig.apply(this, args);
      if (r && existe(r.then) && despues) return r.then(function (v) { try { despues(); } catch (e) {} return v; });
      if (despues) { try { despues(); } catch (e) {} }
      return r;
    };
    return true;
  }

  function montarEnganches_() {
    /* showView: ancho + transición lateral (se envuelve el último de la cadena) */
    var showOriginal = window.showView;
    if (existe(showOriginal)) {
      window.showView = function (id) {
        var r = showOriginal.apply(this, arguments);
        try { aplicarAncho_(id); transicion_(id); } catch (e) {}
        return r;
      };
    }

    /* Atenciones: rejilla + tandas */
    if (existe(window.renderAtenciones_)) window.renderAtenciones_ = renderAtencionesRapido_;

    /* Esqueletos + memoria del estado de la lista */
    envolver_('loadAndRenderList_', function (estado) {
      if (estado) ultimoEstadoLista = estado;
      esqueleto_('#lista-wrap', 4, false);
    }, soltarEsqueleto_);
    envolver_('atencionesLoadAll_',     function () { esqueleto_('#atenc-wrap', 6, true); },  soltarEsqueleto_);
    envolver_('loadBDPredial_',         function () { esqueleto_('#bdp-list', 4, true); },    soltarEsqueleto_);
    envolver_('loadAndRenderProcesos_', function () { esqueleto_('#proc-list', 3, false); },  soltarEsqueleto_);
    envolver_('loadDriveData_',         function () { esqueleto_('#drive-grid', 6, true); },  soltarEsqueleto_);
  }

  function arrancar_() {
    montarBotonTema_();
    montarClicFuera_();
    montarRipple_();
    montarSonido_();
    montarPDF_();
    montarPTR_();
    montarEnganches_();
    aplicarAncho_(vistaActiva_());
  }

  /* API para las fases siguientes */
  window.BV = {
    _soltarEsqueleto: soltarEsqueletoTodo_,
    tema: temaActual_,
    ponerTema: function (t) { aplicarTema_(t, true); },
    alternarTema: alternarTema_,
    esqueleto: esqueleto_,
    sonar: sonar_,
    vibrar: vibrar_,
    cerrarModalAbierto: function () { var m = modalAbierto_(); return m ? cerrarModal_(m) : false; },
    imprimirPDF: imprimirPDF_,          /* FASE 9: ya no tiene botón, sigue disponible */
    refrescar: refrescarAhora_,
    _cierres: CIERRES,
    _anchas: VISTAS_ANCHAS
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', arrancar_);
  else arrancar_();
})();
