/* ============================================================
   ALCANCE — FASE 5 · SEC-HACIENDA

   Qué hace
     1) Al iniciar sesión pide UNA vez al servidor el "alcance" del
        usuario: qué botones ve, qué puede hacer y con qué filas
        trabaja. Eso reemplaza a las 8 listas de nombres que vivían
        escritas dentro de app.js.
     2) Llena los selectores de Asignado, Sustanciador y Asistente
        con las personas que de verdad tienen ese rol (o que ya
        aparecen en la columna), en vez de los nombres cableados
        que estaban en index.html.
     3) Vuelve a encender los botones del menú cuando la respuesta
        llega, porque el viaje es asíncrono y app.js pinta antes.

   Si el servidor no responde
     No se inventa permisos: se queda como está (todo apagado menos
     lo básico) y se avisa en consola. Es preferible que falte un
     botón a que aparezca uno que no debería.

   No modifica app.js: se carga después y usa lo que app.js expone.
   ============================================================ */
(function () {
  'use strict';

  if (window.__HACALC_LISTO) return;   /* guarda contra doble montaje */
  window.__HACALC_LISTO = true;

  var REINTENTOS = 2;
  var ESPERA_MS  = 1200;

  /* ---------- utilidades ---------- */

  function norm(s) {
    return String(s == null ? '' : s)
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toUpperCase();
  }

  function uid() {
    try {
      if (typeof window.uidActual_ === 'function') {
        var u = window.uidActual_();
        if (u) return u;
      }
      var p = window.IDN && window.IDN.perfil ? window.IDN.perfil() : null;
      if (p && p.uid) return p.uid;
    } catch (_) {}
    return '';
  }

  /* ---------- selectores ---------- */

  /* id del <select> -> nombre del catálogo que lo llena */
  var SELECTORES = [
    { id: 'proc-asignado',    cat: 'asignados',      vacio: '— Sin asignar —' },
    { id: 'edit-asignado',    cat: 'asignados',      vacio: '— Sin asignar —' },
    { id: 'proc-asistente',   cat: 'asistentesProc', vacio: '— Sin asistente —' },
    { id: 'edit-asistente',   cat: 'asistentesProc', vacio: '— Sin asistente —' },
    { id: 'bdp-sustanciador', cat: 'sustanciadores', vacio: 'NINGUNO' },
    { id: 'bdp-asistente',    cat: 'asistentesPred', vacio: '— Sin asistente —' }
  ];

  function llenarSelect(def, catalogo) {
    var sel = document.getElementById(def.id);
    if (!sel || sel.tagName !== 'SELECT') return;

    var elegido = sel.value;            /* lo que hubiera puesto ya */
    sel.innerHTML = '';

    var op0 = document.createElement('option');
    op0.value = (def.vacio === 'NINGUNO') ? 'NINGUNO' : '';
    op0.textContent = def.vacio;
    sel.appendChild(op0);

    for (var i = 0; i < catalogo.length; i++) {
      var o = document.createElement('option');
      o.value = catalogo[i].nombre;
      o.textContent = catalogo[i].nombre;
      sel.appendChild(o);
    }

    /* Si venía con un nombre que ya no está en el catálogo (una fila
       vieja de alguien que salió), se le agrega para no perderlo. */
    if (elegido && elegido !== op0.value) {
      var hay = false;
      for (var j = 0; j < sel.options.length; j++) {
        if (norm(sel.options[j].value) === norm(elegido)) { hay = true; break; }
      }
      if (!hay) {
        var extra = document.createElement('option');
        extra.value = elegido;
        extra.textContent = elegido;
        sel.appendChild(extra);
      }
      sel.value = elegido;
    }
  }

  function llenarSelectores(alc) {
    var cats = alc.catalogos || {};
    for (var i = 0; i < SELECTORES.length; i++) {
      llenarSelect(SELECTORES[i], cats[SELECTORES[i].cat] || []);
    }
  }

  /* ---------- pastillas de filtro SUSTANCIADOR (BD Predial) ---------- */

  function corto(nombre) {
    var p = String(nombre || '').split(' ').filter(Boolean);
    if (p.length <= 2) return nombre;
    return p[0] + ' ' + p[p.length - 2];
  }

  function llenarPastillas(alc) {
    var cont = document.getElementById('bdp-pills-sustanciador');
    if (!cont) return;
    var lista = (alc.catalogos && alc.catalogos.sustanciadores) || [];

    cont.innerHTML = '';
    var fijas = [
      { v: 'ALL', t: 'TODOS', activa: true },
      { v: 'NINGUNO', t: 'NINGUNO', activa: false }
    ];
    for (var i = 0; i < fijas.length; i++) {
      cont.appendChild(pastilla(fijas[i].v, fijas[i].t, fijas[i].activa));
    }
    for (var j = 0; j < lista.length; j++) {
      cont.appendChild(pastilla(lista[j].nombre, corto(lista[j].nombre), false));
    }
  }

  function pastilla(valor, texto, activa) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'proc-status-pill' + (activa ? ' active' : '');
    b.setAttribute('data-sustanciador', valor);
    b.textContent = texto;
    return b;
  }

  /* ---------- traer el alcance ---------- */

  function pedir(intento, silencioso) {
    var u = uid();
    if (!u) return Promise.resolve(null);

    /* FASE 6 — cuando el alcance se vuelve a pedir por un aviso del
       motor EN VIVO, la petición se marca como silenciosa: la capa 12
       esconde el loader y no levanta el escudo de pantalla. */
    var p;
    if (silencioso) {
      window.__HAC_SILENCIO = true;
      try { p = window.apiGet('alcance', { uid: u }); }
      finally { window.__HAC_SILENCIO = false; }
    } else {
      p = window.apiGet('alcance', { uid: u });
    }

    return p
      .then(function (res) {
        if (res && res.encontrado) return res;
        return null;
      })
      .catch(function (err) {
        if (intento < REINTENTOS) {
          return new Promise(function (ok) {
            setTimeout(function () { ok(pedir(intento + 1, silencioso)); }, ESPERA_MS);
          });
        }
        console.warn('ALCANCE: no se pudo traer el alcance del usuario.', err);
        return null;
      });
  }

  function aplicar(alc) {
    if (!alc) return;
    window.ALC = alc;

    /* El nombre, los roles y el teléfono buenos son los de la hoja.
       currentUser es un `let` de app.js y no se puede tocar desde
       aquí: se hace por la función que app.js expone para eso. */
    try {
      if (typeof window.aplicarAlcanceAlUsuario_ === 'function') {
        window.aplicarAlcanceAlUsuario_(alc);
      }
    } catch (e) { console.warn('ALCANCE usuario:', e); }

    try { llenarSelectores(alc); } catch (e) { console.warn('ALCANCE selectores:', e); }
    try { llenarPastillas(alc);  } catch (e) { console.warn('ALCANCE pastillas:', e); }

    /* ahora sí: encender los botones que correspondan */
    try {
      if (typeof window.aplicarPermisosVistas_ === 'function') {
        window.aplicarPermisosVistas_();
      }
    } catch (e) { console.warn('ALCANCE permisos:', e); }

    /* FASE 6 — las opciones de los modales de descarga se calculan con
       las mismas filas: si el alcance cambió, hay que volver a pedirlas. */
    try {
      if (window.DESCARGAS && typeof window.DESCARGAS.caducar === 'function') {
        window.DESCARGAS.caducar();
      }
    } catch (e) { console.warn('ALCANCE descargas:', e); }

    /* subtítulo de Inicio: los roles reales, no "SUPER USUARIO" a secas */
    try {
      var sub = document.getElementById('inicio-sub');
      if (sub && alc.roles && alc.roles.length) sub.textContent = alc.roles.join(' · ');
    } catch (_) {}
  }

  function cargar(silencioso) {
    return pedir(0, silencioso).then(aplicar);
  }

  /* FASE 6 — el alcance se pide UNA vez al iniciar sesión. Si a alguien
     le asignan su primer expediente mientras tiene la app abierta, sin
     esto no vería el botón hasta volver a entrar. Solo se vuelve a
     pedir cuando hay algo que ganar: si ya ve las dos vistas y las
     tres descargas, no hay nada que actualizar y no se gasta un viaje. */
  function faltaAlgunaPuerta() {
    var a = window.ALC;
    if (!a || !a.ver) return true;
    var llaves = ['semaforo', 'bdPredial',
                  'descargaSolicitudes', 'descargaPredial', 'descargaProcesos'];
    for (var i = 0; i < llaves.length; i++) if (!a.ver[llaves[i]]) return true;
    return false;
  }

  function recargarSiHaceFalta() {
    if (!uid()) return Promise.resolve(null);
    if (!faltaAlgunaPuerta()) return Promise.resolve(window.ALC);
    return cargar(true);
  }

  /* ---------- enganche con el login ---------- */

  var original = window.procesarLoginExitoso_;
  if (typeof original === 'function') {
    window.procesarLoginExitoso_ = function (res, doc) {
      var r = original.apply(this, arguments);
      /* el alcance se pide después de que app.js (e identidad.js) ya
         armaron currentUser: de ahí sale el uid */
      setTimeout(function () { cargar(); }, 0);
      return r;
    };
  }

  /* Al cerrar sesión se olvida todo: nada de permisos heredados
     de la persona anterior en un equipo compartido. */
  try {
    document.getElementById('btn-logout')?.addEventListener('click', function () {
      window.ALC = null;
      try {
        if (typeof window.aplicarPermisosVistas_ === 'function') window.aplicarPermisosVistas_();
      } catch (_) {}
    });
  } catch (_) {}

  /* API para las fases siguientes (los 3 modales de descarga) */
  window.ALCANCE = {
    recargar: cargar,
    recargarSiHaceFalta: recargarSiHaceFalta,
    actual: function () { return window.ALC; },
    catalogo: function (n) {
      return (window.ALC && window.ALC.catalogos && window.ALC.catalogos[n]) || [];
    }
  };

  /* Red de seguridad: si la sesión se restauró sin pasar por el login
     (identidad.js entra directo), igual se pide el alcance. */
  setTimeout(function () {
    if (!window.ALC && uid()) cargar();
  }, 2500);
})();
