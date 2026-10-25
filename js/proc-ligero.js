/* ============================================================
   SEC-HACIENDA-FLANDES · SEMÁFORO LIVIANO (Mi semáforo / Asignaciones)
   24/10/2026 · se carga justo después de app.js

   Antes `listprocesos` traía las 319 asignaciones completas en un viaje:
   536 KB, de los que 290 filas eran historia FINALIZADA, con 6 enlaces de
   documentos y 3 teléfonos cada una. Ahora (backend ProcLigero.gs):

   1) PRIMER PLANO: `listprocesos&fmt=2` trae solo las ACTIVAS, completas
      (31 KB medidos para ADMIN). La lista de trabajo se pinta con eso y
      el asistente ya tiene lo urgente (vencidas, hoy).
   2) HISTORIA DE FONDO: las finalizadas llegan por bloques
      (`listprocesoshist&b=k`, cada uno < 100 KB), detrás de lo de primer
      plano, máximo 2 a la vez (corte.js) y se descartan si se sale de la
      vista. Cada bloque tiene FIRMA: en la sesión se guardan por firma y
      solo se vuelve a pedir el bloque que cambió. Mientras llegan, la
      cabecera dice "cargando historial".
   3) FILA COMPLETA AL ABRIR: una finalizada viaja sin enlaces ni
      teléfonos. Ver la pinta al instante con lo que ya se sabe y la
      completa con `getproceso` (pista de fila); Editar espera la fila
      completa (necesita teléfonos y documentos).
   4) GUARDADOS SIN RECARGAR: agregar / editar / eliminar / rebotar /
      decisión mandan `ligero:1`; el servidor devuelve solo la fila escrita
      (o lo eliminado) y aquí se parcha la lista en memoria. El código de
      app.js sigue recibiendo `res.lista` (la misma lista, ya parchada).

   Sin `fmt` el servidor responde como antes: si este archivo no está o el
   backend es viejo, todo sigue funcionando igual.
   ============================================================ */
(function () {
  'use strict';
  if (window.__HACPROCLIG) return;
  window.__HACPROCLIG = true;

  var LIGERAS = { agregarproceso: 1, editarproceso: 1, eliminarproceso: 1, rebotarproceso: 1, procdecision: 1 };
  var completas = (typeof WeakSet === 'function') ? new WeakSet() : null;

  /* estado de la historia, por usuario */
  var H = { uid: '', firmas: {}, bloques: {}, pidiendo: {}, ultima: null };

  /* ══════════════ utilidades ══════════════ */
  function base() { try { if (typeof API_BASE === 'string' && API_BASE) return API_BASE; } catch (e) {} return ''; }
  function uid() { try { return (typeof uidActual_ === 'function' && uidActual_()) || ''; } catch (e) { return ''; } }
  function txt(v) { return String(v == null ? '' : v).trim(); }
  function esCompleta(r) { return !!r && (completas ? completas.has(r) : !!r.__completa); }
  function marcarCompleta(r) {
    if (!r) return;
    if (completas) completas.add(r);
    else { try { Object.defineProperty(r, '__completa', { value: true, configurable: true }); } catch (e) {} }
  }
  function rehidratar(d) {
    var c = d.campos || [], out = new Array((d.filas || []).length);
    for (var i = 0; i < out.length; i++) {
      var f = d.filas[i] || [], o = {};
      for (var j = 0; j < c.length; j++) o[c[j]] = f[j];
      out[i] = o;
    }
    return out;
  }
  function ordenar(l) { l.sort(function (a, b) { return (Number(b.rowIndex) || 0) - (Number(a.rowIndex) || 0); }); return l; }
  function cache() { try { return Array.isArray(__procListCache) ? __procListCache : null; } catch (e) { return null; } }

  /* Petición de fondo: sin loader, sin esqueleto, sin escudo (sesion.js pone la llave, corte.js la ordena). */
  function pedir(accion, params) {
    var u = base();
    if (!u) return Promise.reject(new Error('Sin conexión configurada.'));
    var p = { action: accion };
    for (var k in params) if (Object.prototype.hasOwnProperty.call(params, k)) p[k] = params[k];
    return fetch(u + '?' + new URLSearchParams(p).toString(), { method: 'GET' })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (!j || !j.ok) { var e = new Error((j && j.error) || 'Error'); e.codigo = (j && j.codigo) || ''; throw e; }
        return j.data;
      });
  }

  function reiniciarSiCambioUsuario() {
    var u = uid();
    if (u !== H.uid) { H.uid = u; H.firmas = {}; H.bloques = {}; H.pidiendo = {}; H.ultima = null; }
  }

  /* ══════════════ aviso "cargando historial" ══════════════ */
  function faltantes() {
    return Object.keys(H.firmas).filter(function (k) { return !H.bloques[k] || H.bloques[k].firma !== H.firmas[k]; });
  }
  function pintarAviso() {
    var pill = document.getElementById('proc-count-pill');
    if (!pill) return;
    var el = document.getElementById('proc-hist-cargando');
    var falta = faltantes().length > 0;
    if (!falta) { if (el) el.remove(); return; }
    if (!el) {
      el = document.createElement('span');
      el.id = 'proc-hist-cargando';
      el.style.cssText = 'margin-left:.5em;opacity:.7;font-size:.85em;white-space:nowrap';
      el.textContent = '· cargando historial…';
      pill.appendChild(el);
    }
  }

  /* ══════════════ la historia, por bloques ══════════════ */
  function repintar() {
    try {
      var v = document.getElementById('view-asignaciones');
      if (!v || !v.classList.contains('active') || typeof applyProcFilters_ !== 'function') return;
      var antes = window.__HAC_VIVO;
      window.__HAC_VIVO = true;          /* que la paginación no salte a la página 1 */
      try { applyProcFilters_(); } finally { window.__HAC_VIVO = antes; }
    } catch (e) {}
  }

  function meter(destino, filas) {
    if (!Array.isArray(destino) || !filas || !filas.length) return false;
    var hay = {};
    for (var i = 0; i < destino.length; i++) hay[txt(destino[i].id_proceso)] = 1;
    var n = 0;
    filas.forEach(function (r) { if (!hay[txt(r.id_proceso)]) { destino.push(r); n++; } });
    if (n) ordenar(destino);
    return n > 0;
  }

  function pedirFaltantes() {
    var u = H.uid;
    faltantes().forEach(function (k) {
      if (H.pidiendo[k] === H.firmas[k]) return;
      H.pidiendo[k] = H.firmas[k];
      pedir('listprocesoshist', { uid: u, fmt: '2', b: k }).then(function (d) {
        if (u !== H.uid || !d || Number(d.fmt) !== 2) return;
        var filas = rehidratar(d);
        H.bloques[k] = { firma: d.firma || H.firmas[k], filas: filas };
        var c = cache();
        var cambio = meter(H.ultima, filas);
        if (c && c !== H.ultima) cambio = meter(c, filas) || cambio;
        if (cambio) repintar();
      }).catch(function () { /* cortada o falló: se vuelve a pedir la próxima vez */ })
        .then(function () { if (H.pidiendo[k]) delete H.pidiendo[k]; pintarAviso(); });
    });
    pintarAviso();
  }

  /* ══════════════ 1-2 · la lista ══════════════ */
  function envolverApiGet() {
    var original = window.apiGet;
    if (typeof original !== 'function' || original.__procLig) return;
    var envuelta = function (accion, params) {
      if (String(accion || '').toLowerCase() !== 'listprocesos' || (params && params.fmt)) {
        return original.apply(this, arguments);
      }
      var p = {};
      for (var k in (params || {})) if (Object.prototype.hasOwnProperty.call(params, k)) p[k] = params[k];
      p.fmt = '2';
      return Promise.resolve(original.call(this, accion, p)).then(function (d) {
        if (!d || Array.isArray(d) || Number(d.fmt) !== 2) return d;      /* backend viejo */
        reiniciarSiCambioUsuario();
        var act = rehidratar(d);
        act.forEach(marcarCompleta);
        H.firmas = (d.hist && d.hist.firmas) || {};
        Object.keys(H.bloques).forEach(function (b) { if (!(b in H.firmas)) delete H.bloques[b]; });
        var lista = act.slice();
        Object.keys(H.firmas).forEach(function (b) {
          var B = H.bloques[b];
          if (B && B.firma === H.firmas[b]) Array.prototype.push.apply(lista, B.filas);
        });
        meter(lista, []);
        ordenar(lista);
        H.ultima = lista;
        setTimeout(pedirFaltantes, 0);
        return lista;
      });
    };
    envuelta.__procLig = true;
    window.apiGet = envuelta;
  }

  /* ══════════════ 4 · guardados que parchan ══════════════ */
  function parchar(res, accion) {
    var c = cache();
    var pr = res && res.proc;
    if (!pr || !c) return;
    try { if (typeof listaDeEsteUsuario_ === 'function' && !listaDeEsteUsuario_(c)) return; } catch (e) {}
    if (pr.eliminado) {
      var id = txt(pr.eliminado), n = Number(pr.rowIndex) || 0;
      for (var i = c.length - 1; i >= 0; i--) if (txt(c[i].id_proceso) === id) c.splice(i, 1);
      if (n >= 2) c.forEach(function (r) { if (Number(r.rowIndex) > n) r.rowIndex = Number(r.rowIndex) - 1; });
      H.bloques = {};                      /* las filas se corrieron: la historia se vuelve a pedir */
    } else if (pr.fila && pr.fila.id_proceso) {
      var f = pr.fila, ya = null;
      for (var j = 0; j < c.length; j++) if (txt(c[j].id_proceso) === txt(f.id_proceso)) { ya = c[j]; break; }
      if (ya) { Object.assign(ya, f); marcarCompleta(ya); }
      else { marcarCompleta(f); c.push(f); ordenar(c); }
    } else return;
    res.lista = c;                         /* app.js sigue igual: pinta esta lista, ya parchada */
  }

  function envolverApiPost() {
    var original = window.apiPost;
    if (typeof original !== 'function' || original.__procLig) return;
    var envuelta = function (accion, body) {
      var a = String(accion || '').toLowerCase();
      if (!LIGERAS[a] || !body || typeof body !== 'object') return original.apply(this, arguments);
      var b = {};
      for (var k in body) if (Object.prototype.hasOwnProperty.call(body, k)) b[k] = body[k];
      b.ligero = 1;
      return Promise.resolve(original.call(this, accion, b)).then(function (res) {
        try { if (res && !Array.isArray(res.lista)) parchar(res, a); } catch (e) {}
        return res;
      });
    };
    envuelta.__procLig = true;
    window.apiPost = envuelta;
  }

  /* ══════════════ 3 · la fila completa al abrir ══════════════ */
  function traerCompleta(row, deFondo) {
    if (!row || esCompleta(row)) return Promise.resolve(row);
    var p = { uid: uid(), id_proceso: row.id_proceso, fila: row.rowIndex || '' };
    var prom = deFondo ? pedir('getproceso', p) : window.apiGet('getProceso', p);
    return Promise.resolve(prom).then(function (full) {
      if (full && full.id_proceso) { Object.assign(row, full); marcarCompleta(row); }
      return row;
    });
  }

  function envolverAbrir() {
    var ver = window.abrirVerAsignacion_;
    if (typeof ver === 'function' && !ver.__procLig) {
      var nv = function (row) {
        var r = ver.apply(this, arguments);
        if (row && !esCompleta(row)) {
          traerCompleta(row, true).then(function () {
            var v = document.getElementById('view-ver-asignacion');
            var actual = null; try { actual = currentProcesoSelected; } catch (e) {}
            if (v && v.classList.contains('active') && (!actual || actual === row) && esCompleta(row)) window.abrirVerAsignacion_(row);
          }).catch(function () {});
        }
        return r;
      };
      nv.__procLig = true; nv.__bxp = ver.__bxp;
      window.abrirVerAsignacion_ = nv;
    }
    var ed = window.abrirEditarAsignacion_;
    if (typeof ed === 'function' && !ed.__procLig) {
      var ne = function (row) {
        var self = this, args = arguments;
        if (!row || esCompleta(row)) return ed.apply(self, args);
        return traerCompleta(row, false).then(function () { return ed.apply(self, args); }, function (e) {
          try { Swal.fire({ icon: 'error', title: 'No se pudo abrir', text: String((e && e.message) || e) }); } catch (_) {}
        });
      };
      ne.__procLig = true;
      window.abrirEditarAsignacion_ = ne;
    }
  }

  envolverApiGet();
  envolverApiPost();
  /* Ver y Editar se envuelven al final, por fuera de los demás envoltorios
     (chat, bitácora, asistente), para que todos reciban la fila completa. */
  function alFinal() { setTimeout(envolverAbrir, 0); }
  if (document.readyState === 'complete') alFinal();
  else window.addEventListener('load', alFinal);

  window.PROCLIG = { estado: function () { return { firmas: H.firmas, bloques: Object.keys(H.bloques), faltan: faltantes() }; },
                     completa: esCompleta, traer: traerCompleta };
})();
