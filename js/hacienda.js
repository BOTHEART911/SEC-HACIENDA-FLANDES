/* ============================================================
   SEC-HACIENDA-FLANDES · LA APP COMO UNA MÁS DEL ECOSISTEMA
   Fase 2 · 27/09/2026 (reemplaza a js/flandes.js de la Fase 1)

   En la Fase 1 la identidad Flandes era un ESPEJO encima de la app
   vieja (tarjetas que hacían clic en botones escondidos). En la Fase 2
   las vistas ya están escritas con las piezas del kit (index.html y
   css/hacienda.css), así que este archivo solo hace lo que es de
   todas las vistas:

     1) Hablar con el kit: el kit pide 'ping' y 'config' al CORE de
        Flandes; esta app tiene su propio backend y se le contesta aquí.
     2) Tema: UNA sola llave ('hac.tema.v1') y el botón luna/sol del
        banner, en el MISMO sitio de las otras apps, también en el
        ingreso.
     3) Banner: título de cada vista, flecha atrás y menú de la foto.
     4) Inicio: saludo con la cara, roles y aviso si no hay accesos.
     5) Cambiar el PIN (modal propio; lo usa el ingreso y el menú).
     6) Iconos: [data-ico] → SVG del set, y las imágenes de acción de
        los módulos (editar.webp, eliminar.webp…) → su icono.
     7) El cohete de guardado en lugar del loader iOS.
     8) La portada de instalar y la firma en el pie.
   ============================================================ */
(function () {
  'use strict';

  var K = window.KIT;
  if (!K) { try { console.warn('[hacienda] falta kit.js'); } catch (e) {} return; }
  var M = window.MARCA || {};
  function $(id) { return document.getElementById(id); }

  /* ══════════════ 1) EL KIT NO HABLA CON EL CORE ══════════════ */
  var pedirOriginal = K.pedir;
  K.pedir = function (accion, datos) {
    if (accion === 'config') return Promise.resolve({});
    if (accion === 'ping') {
      var url = (M.API_URL || '') + '?action=ping&t=' + Date.now();
      return fetch(url, { cache: 'no-store' }).then(function () { return { ok: true }; });
    }
    /* FASE 3 — la pieza de avisos (kit/avisos.js) habla con ESTE backend:
       la configuración de Firebase ya llegó en el login y el teléfono se
       registra con la acción 'registrardispositivo' (con la llave de sesión). */
    if (accion === 'configPush') {
      var pp = (window.HAC_PUBLICO && window.HAC_PUBLICO.push) || null;
      return pp ? Promise.resolve(pp) : Promise.reject(new Error('Sin configuración de avisos'));
    }
    if (accion === 'registrarDispositivo') {
      return fetch((M.API_URL || '') + '?action=registrardispositivo', {
        method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ fcm: datos && datos.fcm, plataforma: datos && datos.plataforma })
      }).then(function (r) { return r.json(); }).then(function (j) {
        if (!j || !j.ok) throw new Error((j && j.error) || 'No se pudo registrar el teléfono');
        return j.data;
      });
    }
    return pedirOriginal.apply(K, arguments);
  };

  /* FASE 3 — la sesión de esta app es la de js/sesion.js (no la del CORE) */
  K.token = function () { return window.HAC_SESION ? window.HAC_SESION.tk() : ''; };

  /* ══════════════ 1b) AVISOS PUSH ══════════════
     El service worker de los avisos no puede traer la configuración de
     Firebase escrita: se la pasamos en la dirección con la que se registra
     (firebase-messaging-sw.js?c=...). La dirección es estable (misma
     configuración = misma dirección), así que no se re-registra de más. */
  (function () {
    var sw = navigator.serviceWorker;
    if (!sw || !sw.register) return;
    var registrar = sw.register.bind(sw);
    sw.register = function (url, opciones) {
      try {
        var cfg = window.HAC_PUBLICO && window.HAC_PUBLICO.push && window.HAC_PUBLICO.push.firebase;
        if (/firebase-messaging-sw\.js$/.test(String(url)) && cfg && cfg.apiKey) {
          url = url + '?c=' + encodeURIComponent(btoa(JSON.stringify(cfg)));
        }
      } catch (e) {}
      return registrar(url, opciones);
    };
  }());

  function avisos() { return K.piezas && K.piezas.avisos; }
  var escuchando = false;
  window.addEventListener('hac:login', function () {
    var a = avisos();
    if (!a) return;
    var pp = window.HAC_PUBLICO && window.HAC_PUBLICO.push;
    if (!pp || !pp.firebase || !pp.vapid || pp.activo === false) return;
    a.configurar(pp);
    /* Igual que en las apps Flandes: el permiso se pide con el PRIMER toque
       dentro de la app (el navegador solo lo muestra si sale de un toque) y
       el teléfono queda registrado en silencio. */
    a.autoActivar();
    if (!escuchando) {
      escuchando = true;
      a.alLlegar(function (x) {
        K.aviso((x.titulo ? x.titulo + ': ' : '') + (x.cuerpo || ''), 'info', 6000);
      });
    }
  });
  window.addEventListener('hac:logout', function () { var a = avisos(); if (a) a.olvidar(); });

  function activarAvisos() {
    var a = avisos();
    var pp = window.HAC_PUBLICO && window.HAC_PUBLICO.push;
    if (!a || !pp || !pp.firebase || !pp.vapid) {
      K.aviso('Los avisos al teléfono aún no están configurados.', 'aviso', 4000);
      return;
    }
    a.configurar(pp);
    if (a.estado() === 'listo') { K.aviso('Los avisos ya están activos en este teléfono.', 'ok', 3000); return; }
    a.activar({ forzar: true });
  }

  /* ══════════════ 2) TEMA ══════════════ */
  var K_TEMA = 'hac.tema.v1';
  K.cuando('kit:tema', function (d) {
    var t = (d && d.tema) || K.temaActual();
    try { localStorage.setItem(K_TEMA, t); } catch (e) {}
    var m = document.querySelector('meta[name="theme-color"]');
    if (m) m.setAttribute('content', t === 'oscuro' ? '#0d1512' : '#06402B');
    /* las gráficas de Chart.js se pintaron con los colores del otro tema */
    try { if (window.Chart) Object.values(window.Chart.instances || {}).forEach(function (c) { c.update(); }); } catch (e) {}
  });
  (function sincronizar() {
    var t = null;
    try { t = localStorage.getItem(K_TEMA); } catch (e) {}
    if (t === 'oscuro' || t === 'claro') { if (t !== K.temaActual()) K.ponerTema(t, true); }
    else K.ponerTema(document.documentElement.getAttribute('data-tema') === 'oscuro' ? 'oscuro' : 'claro', true);
  }());

  /* ══════════════ 3) BANNER ══════════════ */
  var TITULOS = {
    'view-inicio': M.TITULO || 'Sec. Hacienda',
    'view-guia': 'Guía rápida',
    'view-lista': 'Pendientes predial',
    'view-respuesta': 'Responder solicitud',
    'view-agregar': 'Agregar atención predial',
    'view-atenciones': 'Atenciones registradas',
    'view-estadisticas': 'Estadísticas',
    'view-panel': 'Panel del semáforo',
    'view-drive-anexos': 'Drive anexos',
    'view-drive-editar': 'Correo de edición',
    'view-asignaciones': 'Mi semáforo',
    'view-agregar-asignacion': 'Nueva asignación',
    'view-ver-asignacion': 'Detalle de la asignación',
    'view-editar-asignacion': 'Editar asignación',
    'view-bd-predial': 'Base de datos predial',
    'view-bdp-form': 'Expediente predial',
    'view-bdp-detalle': 'Detalle del expediente',
    'view-bdp-panel': 'Panel base de datos',
    'view-config': 'Configuración'
  };
  var PUERTA = { 'view-login': 1, 'view-instalar': 1 };

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
  /* "PENDIENTES PREDIAL" → "Pendientes predial" (como los demás títulos) */
  function frase(s) { s = String(s || '').toLowerCase(); return s.charAt(0).toUpperCase() + s.slice(1); }
  function fotoActual(p) { return (p && p.foto) || ''; }
  function rolesTexto(p) {
    var r = (p && p.roles) || [];
    return r.length ? r.join(' · ') : 'Sin rol asignado';
  }

  /* ══════════════ FOTO DE PERFIL (FASE 4) ══════════════
     Tocar la cara del saludo abre la foto en grande. Desde ahí:
       · Cambiar foto → elegir otra imagen y encuadrarla.
       · Ajustar      → mover (arrastrar) y acercar (barra) la actual.
     Se guarda un cuadrado de 320 px, igual que antes (subirfoto). */
  var FT = { img: null, esc: 1, x: 0, y: 0, editando: false, nueva: false };
  var LADO = 320;

  function fotoNota(t) { var n = $('foto-nota'); if (n) n.textContent = t || ''; }
  function fotoModo(editar) {
    FT.editando = editar;
    $('foto-zoom').classList.toggle('hidden', !editar);
    $('foto-guardar').classList.toggle('hidden', !editar);
    $('foto-ajustar').classList.toggle('hidden', editar || !FT.img);
    $('foto-marco').classList.toggle('hf-foto__marco--editar', editar);
    fotoNota(editar ? 'Arrastra la foto para encuadrarla y usa la barra para acercarla.' : '');
  }
  function fotoPintar() {
    var el = $('foto-img'), m = $('foto-marco');
    if (!FT.img) return;
    var tam = m.clientWidth || 240;
    var base = tam / Math.min(FT.img.naturalWidth, FT.img.naturalHeight);
    var w = FT.img.naturalWidth * base * FT.esc, h = FT.img.naturalHeight * base * FT.esc;
    /* que la foto siempre cubra el círculo */
    FT.x = Math.min(0, Math.max(tam - w, FT.x));
    FT.y = Math.min(0, Math.max(tam - h, FT.y));
    el.style.width = w + 'px'; el.style.height = h + 'px';
    el.style.transform = 'translate(' + FT.x + 'px,' + FT.y + 'px)';
  }
  function fotoCentrar() {
    var m = $('foto-marco'), tam = m.clientWidth || 240;
    var base = tam / Math.min(FT.img.naturalWidth, FT.img.naturalHeight);
    FT.x = (tam - FT.img.naturalWidth * base * FT.esc) / 2;
    FT.y = (tam - FT.img.naturalHeight * base * FT.esc) / 2;
    fotoPintar();
  }
  function fotoCargar(src, cruzado) {
    return new Promise(function (ok, mal) {
      var im = new Image();
      if (cruzado) im.crossOrigin = 'anonymous';
      im.onload = function () { ok(im); };
      im.onerror = function () { mal(new Error('No se pudo abrir la imagen')); };
      im.src = src;
    });
  }
  function fotoMostrar(im, nueva) {
    FT.img = im; FT.nueva = !!nueva; FT.esc = 1;
    var el = $('foto-img');
    el.src = im.src; el.hidden = false;
    $('foto-ini').hidden = true;
    $('foto-rango').value = '1';
    fotoCentrar();
  }

  function cambiarFoto() {
    var p = perfil();
    if (!p) return;
    var m = $('modal-foto');
    FT.img = null;
    var el = $('foto-img'); el.hidden = true; el.removeAttribute('src'); el.style.transform = '';
    var ini = $('foto-ini'); ini.hidden = false;
    ini.textContent = (K.piezas.personas && K.piezas.personas.iniciales) ? K.piezas.personas.iniciales(p.nombre || '') : '';
    m.classList.remove('hidden');
    fotoModo(false);
    var foto = fotoActual(p);
    if (!foto) { fotoNota('Aún no tienes foto. Toca "Cambiar foto" para elegir una.'); return; }
    /* la foto de Drive grande; se pide "sin credenciales" para poder recortarla */
    var grande = foto.replace(/sz=w\d+/, 'sz=w800');
    fotoCargar(grande, true).catch(function () { return fotoCargar(grande, false); })
      .then(function (im) { fotoMostrar(im, false); fotoModo(false); })
      .catch(function () { fotoNota('No se pudo mostrar tu foto actual.'); });
  }
  function cerrarFoto() { var m = $('modal-foto'); if (m) m.classList.add('hidden'); fotoModo(false); }

  function guardarFoto() {
    if (!FT.img || !window.IDN_guardarFotoB64) return;
    var m = $('foto-marco'), tam = m.clientWidth || 240;
    var base = tam / Math.min(FT.img.naturalWidth, FT.img.naturalHeight) * FT.esc;
    var cv = document.createElement('canvas'); cv.width = LADO; cv.height = LADO;
    var cx = cv.getContext('2d');
    cx.drawImage(FT.img, -FT.x / base, -FT.y / base, tam / base, tam / base, 0, 0, LADO, LADO);
    var b64;
    try { b64 = cv.toDataURL('image/jpeg', 0.88).split(',')[1]; }
    catch (e) {
      /* la foto actual vino de Drive sin permiso para recortarla: se pide elegirla de nuevo */
      fotoNota('Para ajustar esta foto, elígela de nuevo con "Cambiar foto".');
      return;
    }
    var b = $('foto-guardar'); b.disabled = true;
    Promise.resolve(window.IDN_guardarFotoB64(b64)).then(function () {
      cerrarFoto();
      pintarInicio();
      K.aviso('Foto actualizada', 'ok', 2200);
    }).catch(function (e) {
      fotoNota('No se pudo guardar: ' + String((e && e.message) || e));
    }).then(function () { b.disabled = false; });
  }

  function engancharFoto() {
    var m = $('modal-foto');
    if (!m || m.__hf) return;
    m.__hf = true;
    $('foto-cerrar').addEventListener('click', cerrarFoto);
    $('foto-cambiar').addEventListener('click', function () { $('foto-archivo').click(); });
    $('foto-ajustar').addEventListener('click', function () { if (FT.img) fotoModo(true); });
    $('foto-guardar').addEventListener('click', guardarFoto);
    $('foto-archivo').addEventListener('change', function (ev) {
      var f = ev.target.files && ev.target.files[0];
      ev.target.value = '';
      if (!f) return;
      var url = URL.createObjectURL(f);
      fotoCargar(url, false).then(function (im) { fotoMostrar(im, true); fotoModo(true); })
        .catch(function () { fotoNota('Esa imagen no se pudo abrir. Prueba con otra.'); });
    });
    $('foto-rango').addEventListener('input', function (ev) {
      if (!FT.img) return;
      var tam = $('foto-marco').clientWidth || 240, c = tam / 2;
      var ant = FT.esc, nue = Number(ev.target.value) || 1;
      /* acercar desde el centro del círculo */
      FT.x = c - (c - FT.x) * nue / ant; FT.y = c - (c - FT.y) * nue / ant;
      FT.esc = nue; fotoPintar();
    });
    var marco = $('foto-marco'), arr = null;
    marco.addEventListener('pointerdown', function (ev) {
      if (!FT.editando || !FT.img) return;
      arr = { x: ev.clientX, y: ev.clientY, ox: FT.x, oy: FT.y };
      try { marco.setPointerCapture(ev.pointerId); } catch (e) {}
      ev.preventDefault();
    });
    marco.addEventListener('pointermove', function (ev) {
      if (!arr) return;
      FT.x = arr.ox + ev.clientX - arr.x; FT.y = arr.oy + ev.clientY - arr.y; fotoPintar();
    });
    ['pointerup', 'pointercancel'].forEach(function (t) { marco.addEventListener(t, function () { arr = null; }); });
    marco.addEventListener('wheel', function (ev) {
      if (!FT.editando || !FT.img) return;
      ev.preventDefault();
      var r = $('foto-rango');
      r.value = String(Math.min(3, Math.max(1, Number(r.value) - ev.deltaY * 0.002)));
      r.dispatchEvent(new Event('input'));
    }, { passive: false });
    m.addEventListener('click', function (ev) { if (ev.target === m) cerrarFoto(); });
    document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape' && !m.classList.contains('hidden')) cerrarFoto(); });
  }
  function salir() {
    var b = $('btn-logout');
    if (b) b.click();
  }
  function cambiarUsuario() { var b = $('btn-cambiar-usuario'); if (b) b.click(); }

  var modo = '';   /* 'puerta' | 'app' */
  function montarPuerta() {
    if (!K.piezas.banner) return;
    if (modo === 'puerta') return;
    modo = 'puerta';
    K.piezas.banner.montar({ titulo: '', menu: [] });
    K.piezas.banner.atras(null);
    var b = K.piezas.banner.elemento();
    if (b) { var pf = b.querySelector('.kit-banner__perfil'); if (pf) pf.hidden = true; }
    document.title = (M.TITULO || 'Sec. Hacienda') + ' · ' + (M.MUNICIPIO || 'Alcaldía de Flandes');
  }
  function montarApp() {
    if (!K.piezas.banner) return;
    var p = perfil() || {};
    modo = 'app';
    K.piezas.banner.montar({
      titulo: M.TITULO || 'Sec. Hacienda',
      nombre: p.nombre || '',
      foto: fotoActual(p),
      rol: rolesTexto(p),
      menu: [
        { texto: 'Guía rápida', al: function () { if (window.GUIA) window.GUIA.abrir(); } },
        { texto: 'Cambiar mi PIN', al: function () { abrirPin(); } },
        { texto: 'Cambiar foto de perfil', al: cambiarFoto },
        { texto: 'Avisos al teléfono', al: activarAvisos },
        { texto: 'Instalar la app', al: function () { if (K.piezas.instalar) K.piezas.instalar.abrir(); } },
        { texto: 'Cambiar de usuario', al: cambiarUsuario },
        { texto: 'Cerrar sesión', peligro: true, al: salir }
      ]
    });
    var b = K.piezas.banner.elemento();
    if (b) {
      var pf = b.querySelector('.kit-banner__perfil'); if (pf) pf.hidden = false;
      if (K.piezas.cielo && !b.__cielo) { b.__cielo = true; K.piezas.cielo.soloFondo(b); }
    }
  }

  function atrasDe(vista) {
    var b = vista.querySelector('.hf-atras');
    if (b) return function () { K.vibrar(8); b.click(); };
    return function () { if (typeof window.showView === 'function') window.showView('view-inicio'); };
  }

  function alCambiarVista() {
    var v = vistaActiva();
    if (!v) return;
    var id = v.id;
    var raiz = document.documentElement;
    raiz.classList.toggle('hf-en-puerta', !!PUERTA[id]);
    raiz.setAttribute('data-hf-vista', id);
    if (PUERTA[id]) { montarPuerta(); return; }
    if (modo !== 'app') montarApp();
    var t = TITULOS[id];
    if (id === 'view-lista') { var lt = $('lista-title'); if (lt && lt.textContent.trim()) t = frase(lt.textContent.trim()); }
    if (id === 'view-bdp-form') { var ft = $('bdp-form-title'); if (ft && ft.textContent.trim()) t = frase(ft.textContent.trim()); }
    K.piezas.banner.vista(t || M.TITULO || '');
    if (id === 'view-inicio') { K.piezas.banner.atras(null); pintarInicio(); }
    else K.piezas.banner.atras(atrasDe(v));
    iconizar(v);
  }

  /* ══════════════ 4) INICIO ══════════════ */
  function pintarInicio() {
    var p = perfil();
    var nombre = (p && p.nombre) || ($('inicio-nombre') ? $('inicio-nombre').textContent : '');
    var n = $('inicio-nombre'), r = $('inicio-sub'), c = $('hf-cara');
    var nuevoN = tituloCaso(nombreCorto(nombre)), nuevoR = rolesTexto(p);
    /* solo si cambia: el vigilante del nombre llama a esta misma función */
    if (n && nombre && n.textContent !== nuevoN) n.textContent = nuevoN;
    if (r && r.textContent !== nuevoR) r.textContent = nuevoR;
    if (c) {
      var foto = fotoActual(p);
      var clave = foto + '|' + nombre;
      if (c.getAttribute('data-k') !== clave) {
        c.setAttribute('data-k', clave);
        c.innerHTML = '';
        if (K.piezas.personas) c.appendChild(K.piezas.personas.avatar(nombre, { tam: 64, foto: foto }));
        c.insertAdjacentHTML('beforeend', '<span class="hf-cara__cam" aria-hidden="true">' + K.icono('camara', 14) + '</span>');
      }
    }
    if (modo === 'app' && p) K.piezas.banner.perfil({ nombre: p.nombre || '', foto: fotoActual(p), rol: rolesTexto(p) });
    revisarVacio();
  }

  function revisarVacio() {
    var v = $('hf-vacio');
    if (!v) return;
    var algun = false;
    document.querySelectorAll('#view-inicio [data-bloque="predial"] .acceso, #view-inicio [data-bloque="gestion"] .acceso').forEach(function (b) {
      if (b.style.display !== 'none' && !b.hidden) algun = true;
    });
    var ocultar = algun || !perfil() || !window.ALC;
    if (v.hidden !== ocultar) v.hidden = ocultar;
  }

  /* ══════════════ 5) CAMBIAR EL PIN ══════════════ */
  var pinPara = null;   /* { uid, nombre } */
  function abrirPin(quien) {
    var p = perfil();
    pinPara = quien && quien.uid ? quien : (p ? { uid: p.uid, nombre: p.nombre } : null);
    if (!pinPara || !pinPara.uid) {
      if (window.Swal) Swal.fire({ icon: 'info', title: 'Primero elige tu cuenta', text: 'En el ingreso, toca tu nombre y luego "Cambiar mi PIN".' });
      return;
    }
    var m = $('modal-pin');
    ['pin-actual', 'pin-nuevo', 'pin-repite'].forEach(function (i) { var e = $(i); if (e) e.value = ''; });
    ojosPin(false);
    errorPin('');
    var q = $('pin-quien');
    if (q) q.textContent = tituloCaso(nombreCorto(pinPara.nombre || ''));
    m.classList.remove('hidden');
    setTimeout(function () { var a = $('pin-actual'); if (a) a.focus(); }, 60);
  }
  function cerrarPin() { var m = $('modal-pin'); if (m) m.classList.add('hidden'); pinPara = null; ojosPin(false); }

  /* FASE 4 — el ojo de cada campo del PIN (mismo botón del kit que el de la
     contraseña en las apps Flandes): muestra u oculta lo escrito. */
  function pintarOjo(b, visible) {
    b.innerHTML = K.icono(visible ? 'ojo-tapado' : 'ojo', 18);
    b.setAttribute('aria-pressed', visible ? 'true' : 'false');
    b.setAttribute('aria-label', visible ? 'Ocultar el PIN' : 'Mostrar el PIN');
  }
  function ojosPin(visible) {
    document.querySelectorAll('#modal-pin [data-ojo-de]').forEach(function (b) {
      var campo = $(b.getAttribute('data-ojo-de'));
      if (campo) campo.type = visible ? 'text' : 'password';
      pintarOjo(b, visible);
    });
  }
  function errorPin(t) {
    var e = $('pin-error');
    if (!e) return;
    e.textContent = t || '';
    e.classList.toggle('kit-sesion__error--on', !!t);
  }
  function soloDigitos(e) { e.value = String(e.value || '').replace(/\D/g, '').slice(0, 4); }

  function guardarPin() {
    if (!pinPara) return;
    var a = $('pin-actual').value, n = $('pin-nuevo').value, r = $('pin-repite').value;
    if (!/^\d{4}$/.test(a)) return errorPin('Escribe tu PIN actual de 4 dígitos.');
    if (!/^\d{4}$/.test(n)) return errorPin('El PIN nuevo debe tener 4 dígitos.');
    if (n !== r) return errorPin('El PIN nuevo y su repetición no coinciden.');
    if (n === a) return errorPin('El PIN nuevo debe ser distinto al actual.');
    if (/^(\d)\1{3}$/.test(n) || '0123456789'.indexOf(n) !== -1 || '9876543210'.indexOf(n) !== -1) {
      return errorPin('Ese PIN es muy fácil de adivinar. Evita números repetidos o seguidos.');
    }
    errorPin('');
    var boton = $('pin-guardar');
    if (boton) boton.disabled = true;
    Promise.resolve(window.apiPost('cambiarpin', { uid: pinPara.uid, actual: a, nuevo: n })).then(function (res) {
      if (res && res.ok) {
        cerrarPin();
        try { if (window.playSoundOnce && window.SOUNDS) window.playSoundOnce(window.SOUNDS.success); } catch (e) {}
        if (window.Swal) Swal.fire({ icon: 'success', title: 'PIN cambiado', text: 'Desde ahora entras con tu PIN nuevo.' + (res.avisado ? ' Te llegó un aviso por WhatsApp.' : ''), timer: 2600, showConfirmButton: false });
        return;
      }
      if (res && res.bloqueado) return errorPin('Demasiados intentos. Espera ' + (res.minutos || 5) + ' minutos.');
      errorPin('El PIN actual no es correcto' + (res && typeof res.restantes === 'number' ? '. Te quedan ' + res.restantes + ' intentos.' : '.'));
    }).catch(function (e) {
      errorPin(String((e && e.message) || e));
    }).then(function () { if (boton) boton.disabled = false; });
  }

  function engancharPin() {
    var m = $('modal-pin');
    if (!m || m.__hf) return;
    m.__hf = true;
    $('pin-cancelar').addEventListener('click', cerrarPin);
    $('pin-guardar').addEventListener('click', guardarPin);
    ['pin-actual', 'pin-nuevo', 'pin-repite'].forEach(function (i) {
      var e = $(i);
      e.addEventListener('input', function () { soloDigitos(e); });
      e.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') guardarPin(); });
    });
    m.querySelectorAll('[data-ojo-de]').forEach(function (b) {
      pintarOjo(b, false);
      b.addEventListener('click', function (ev) {
        ev.preventDefault();
        var campo = $(b.getAttribute('data-ojo-de'));
        if (!campo) return;
        var ver = campo.type === 'password';
        campo.type = ver ? 'text' : 'password';
        pintarOjo(b, ver);
        campo.focus();
      });
    });
    m.addEventListener('click', function (ev) { if (ev.target === m) cerrarPin(); });
    document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape' && !m.classList.contains('hidden')) cerrarPin(); });
  }
  window.HAC_PIN = { abrir: abrirPin, cerrar: cerrarPin };

  /* ══════════════ 6) ICONOS ══════════════ */
  function pintarIconos(raiz) {
    (raiz || document).querySelectorAll('i.hi[data-ico]').forEach(function (i) {
      if (i.__hi) return;
      i.__hi = true;
      i.innerHTML = K.icono(i.getAttribute('data-ico'), Number(i.getAttribute('data-t')) || 18);
    });
  }

  /* Imágenes de ACCIÓN de los módulos → icono. Las ilustraciones de las
     categorías del semáforo no están en la lista y se quedan. */
  var MAPA = window.ICO_POR_IMG || {};
  function nombreImg(src) {
    var m = String(src || '').match(/(?:^|\/)img\/([A-Za-z0-9_-]+)\.(?:png|webp|gif|jpe?g)(?:\?|$)/);
    return m ? m[1] : '';
  }
  function iconizar(raiz) {
    pintarIconos(raiz);
    var imgs = (raiz || document).querySelectorAll('img[src*="img/"]');
    for (var i = 0; i < imgs.length; i++) {
      var im = imgs[i];
      if (im.__hi) continue;
      var n = MAPA[nombreImg(im.getAttribute('src'))];
      if (!n) { im.__hi = true; continue; }
      var w = parseInt(im.getAttribute('width') || im.style.width || '', 10) || 0;
      var sp = document.createElement('span');
      sp.className = 'hi-img ' + (im.className || '');
      sp.setAttribute('aria-hidden', 'true');
      if (im.title) sp.title = im.title;
      sp.innerHTML = K.icono(n, w >= 24 ? 22 : 18);
      if (im.parentNode) im.parentNode.replaceChild(sp, im);
    }
  }
  var pendiente = null;
  function vigilarIconos() {
    iconizar(document);
    new MutationObserver(function () {
      if (pendiente) return;
      pendiente = requestAnimationFrame(function () { pendiente = null; iconizar(document); });
    }).observe(document.body, { childList: true, subtree: true });
  }

  /* ══════════════ 7) EL COHETE EN VEZ DEL LOADER iOS ══════════════ */
  function vigilarLoader() {
    var l = $('loader');
    if (!l || !K.piezas.guardado) return;
    var abierto = false;
    function mirar() {
      var on = !l.classList.contains('hidden') && !document.body.classList.contains('hac-sin-loader');
      if (on && !abierto) {
        abierto = true;
        var v = vistaActiva();
        var entrando = v && PUERTA[v.id];
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

  /* ══════════════ 8) PORTADA Y FIRMA ══════════════ */
  function portada() {
    var b = K.piezas.bienvenida;
    if (!b || !b.procede || !b.procede()) return;
    b.abrir({ titulo: M.TITULO || 'Sec. Hacienda', sub: M.MUNICIPIO || 'Alcaldía de Flandes', imagen: M.APP_ICON || 'img/icono-512.png' });
  }
  function firmas() {
    if (!K.piezas.creditos) return;
    ['hf-cred-login', 'hf-cred-inicio'].forEach(function (id) { var f = $(id); if (f) f.innerHTML = K.piezas.creditos.html(); });
  }

  /* ══════════════ ARRANQUE ══════════════ */
  function vigilarVistas() {
    var obs = new MutationObserver(function () {
      clearTimeout(obs._t);
      obs._t = setTimeout(alCambiarVista, 0);
    });
    document.querySelectorAll('.view').forEach(function (v) { obs.observe(v, { attributes: true, attributeFilter: ['class'] }); });
    var cont = document.querySelector('.container') || document.body;
    new MutationObserver(function (muts) {
      muts.forEach(function (m) {
        m.addedNodes.forEach(function (n) {
          if (n.nodeType === 1 && n.classList.contains('view')) obs.observe(n, { attributes: true, attributeFilter: ['class'] });
        });
      });
    }).observe(cont, { childList: true });
    ['lista-title', 'bdp-form-title'].forEach(function (id) {
      var e = $(id);
      if (e) new MutationObserver(function () { alCambiarVista(); }).observe(e, { childList: true, characterData: true, subtree: true });
    });
    /* cuando llegan los permisos, el inicio sabe si mostrar el aviso */
    var ini = $('view-inicio');
    if (ini) new MutationObserver(function (muts) {
      for (var i = 0; i < muts.length; i++) if (muts[i].target.id !== 'hf-vacio') { clearTimeout(ini._t); ini._t = setTimeout(revisarVacio, 30); return; }
    }).observe(ini, { subtree: true, attributes: true, attributeFilter: ['style', 'hidden'] });
    /* la foto nueva o la persona nueva */
    var n = $('inicio-nombre');
    if (n) new MutationObserver(function () { if (vistaActiva() && vistaActiva().id === 'view-inicio') pintarInicio(); })
      .observe(n, { childList: true, characterData: true, subtree: true });
    document.addEventListener('load', function (e) { if (e.target && e.target.id === 'idn-avatar-img') pintarInicio(); }, true);
  }

  function botones() {
    var g = $('btn-guia'); if (g) g.addEventListener('click', function () { if (window.GUIA) window.GUIA.abrir(); });
    var p = $('btn-cambiar-pin'); if (p) p.addEventListener('click', function () { abrirPin(); });
    var c = $('hf-cara'); if (c) c.addEventListener('click', cambiarFoto);
    engancharFoto();
    /* Estadísticas: la pestaña dice el año en curso */
    var t = $('estad-tab-tiempo-t'); if (t) t.textContent = 'Año ' + new Date().getFullYear();
    var tl = $('estad-label-tiempo'); if (tl) tl.textContent = 'Atención predial por mes · ' + new Date().getFullYear();
  }

  function arrancar() {
    try { if (K.piezas.version) K.piezas.version.vigilar(); } catch (e) {}
    try { if (K.piezas.conexion) K.piezas.conexion.vigilar(); } catch (e) {}
    try { if (K.piezas.instalar) K.piezas.instalar.vigilar(); } catch (e) {}
    firmas();
    botones();
    engancharPin();
    vigilarLoader();
    vigilarIconos();
    vigilarVistas();
    alCambiarVista();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', arrancar);
  else arrancar();
  window.addEventListener('load', function () { setTimeout(portada, 60); });

  window.HAC_FLANDES = { refrescar: function () { alCambiarVista(); pintarInicio(); }, iconizar: iconizar };
})();
