/* ============================================================
   SEC-HACIENDA-FLANDES · BD PREDIAL AL INSTANTE (copia en el equipo)
   24/10/2026 · se carga justo después de app.js (antes de bdp-rapido.js)

   Antes cada apertura de BD Predial bajaba el listado entero: 9.515
   expedientes, 3,03 MB, en un viaje a Apps Script.

   Ahora (backend PredSync.gs):
   1) La PRIMERA vez en el equipo se baja como siempre (listpredial fmt=2)
      y con las firmas de cada bloque de 25 filas; se guarda en IndexedDB.
   2) Las siguientes, la lista se pinta AL INSTANTE desde el equipo. Detrás
      va un viaje pequeño (predsync, ~7 KB) con las firmas actuales y solo
      se piden los bloques que cambiaron (predbloques, < 90 KB por viaje).
      Las filas cambiadas se parchan en la lista que se está viendo, sin
      volver a la página 1 ni perder los filtros.
   3) Si cambió casi todo (borrado de filas, alza anual) o cambiaron los
      campos del listado, se baja entera otra vez, de fondo.
   4) Privacidad: la copia es una sola (la del usuario con sesión) y se
      borra al cerrar sesión o si entra otra persona en el equipo.

   Si IndexedDB no está (modo privado) o algo falla, se pide como antes.
   ============================================================ */
(function () {
  'use strict';
  if (window.__HACPREDSYNC) return;
  window.__HACPREDSYNC = true;

  var BD = 'hac-predial', ALMACEN = 'lista', LLAVE = 'actual';
  var MAX_CAMBIADOS = 120;          /* más bloques que esto: se baja entera */
  var sincronizando = false;

  /* ══════════════ utilidades ══════════════ */
  function base() { try { if (typeof API_BASE === 'string' && API_BASE) return API_BASE; } catch (e) {} return ''; }
  function uid() { try { return (typeof uidActual_ === 'function' && uidActual_()) || ''; } catch (e) { return ''; } }
  function memoria() { try { return Array.isArray(__bdpListCache) ? __bdpListCache : null; } catch (e) { return null; } }
  function deEsteUsuario(l) { try { return typeof listaDeEsteUsuario_ === 'function' && listaDeEsteUsuario_(l); } catch (e) { return false; } }

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

  function aObjetos(campos, filas) {
    var nc = campos.length, out = new Array(filas.length);
    for (var i = 0; i < filas.length; i++) {
      var f = filas[i] || [], o = {};
      for (var c = 0; c < nc; c++) o[campos[c]] = f[c];
      out[i] = o;
    }
    return out;
  }
  function bloqueDe(rowIndex, B) { return Math.floor((Number(rowIndex) - 2) / B); }
  function ordenar(l, iRow) {
    l.sort(function (a, b) {
      return iRow === undefined ? (Number(b.rowIndex) - Number(a.rowIndex)) : (Number(b[iRow]) - Number(a[iRow]));
    });
    return l;
  }

  /* ══════════════ IndexedDB: una sola copia ══════════════ */
  function abrir() {
    return new Promise(function (ok, mal) {
      if (!window.indexedDB) { mal(new Error('sin IndexedDB')); return; }
      var rq;
      try { rq = indexedDB.open(BD, 1); } catch (e) { mal(e); return; }
      rq.onupgradeneeded = function () { try { rq.result.createObjectStore(ALMACEN); } catch (e) {} };
      rq.onsuccess = function () { ok(rq.result); };
      rq.onerror = function () { mal(rq.error || new Error('IndexedDB')); };
      rq.onblocked = function () { mal(new Error('IndexedDB bloqueada')); };
    });
  }
  function tx(modo, hacer) {
    return abrir().then(function (db) {
      return new Promise(function (ok, mal) {
        var t = db.transaction(ALMACEN, modo), st = t.objectStore(ALMACEN), res;
        try { res = hacer(st); } catch (e) { mal(e); return; }
        t.oncomplete = function () { db.close(); ok(res && 'result' in res ? res.result : undefined); };
        t.onerror = t.onabort = function () { db.close(); mal(t.error || new Error('IndexedDB')); };
      });
    });
  }
  function leer() {
    var limite = new Promise(function (ok) { setTimeout(function () { ok(null); }, 2500); });
    return Promise.race([tx('readonly', function (st) { return st.get(LLAVE); }).catch(function () { return null; }), limite]);
  }
  function guardar(rec) { return tx('readwrite', function (st) { return st.put(rec, LLAVE); }).catch(function () {}); }
  function borrar() {
    try { var rq = indexedDB.deleteDatabase(BD); rq.onerror = rq.onblocked = function () {}; } catch (e) {}
  }

  /* ══════════════ aviso "actualizando" ══════════════ */
  function aviso(encendido) {
    var b = document.getElementById('bdp-count');
    var pill = b && b.parentNode;
    if (!pill) return;
    var el = document.getElementById('bdp-sync');
    if (!encendido) { if (el) el.remove(); return; }
    if (!el) {
      el = document.createElement('span');
      el.id = 'bdp-sync';
      el.style.cssText = 'margin-left:.5em;opacity:.7;font-size:.85em;white-space:nowrap';
      el.textContent = '· actualizando…';
      pill.appendChild(el);
    }
  }

  /* ══════════════ aplicar cambios a la lista que se está viendo ══════════════ */
  function repintar() {
    try {
      var v = document.getElementById('view-bd-predial');
      if (!v || !v.classList.contains('active') || typeof applyBDPredialFilters_ !== 'function') return;
      var antes = window.__HAC_VIVO;
      window.__HAC_VIVO = true;              /* que no salte a la página 1 */
      try { applyBDPredialFilters_(); } finally { window.__HAC_VIVO = antes; }
    } catch (e) {}
  }
  function blob(r) { try { r.__searchBlob = bdpBlob_(r); } catch (e) {} }

  /** afectados: {k:1}; nuevas: objetos de esos bloques. Devuelve true si algo cambió. */
  function parcharMemoria(B, afectados, nuevas, u) {
    var c = memoria();
    if (!c || !deEsteUsuario(c) || u !== uid()) return false;
    var porId = {};
    nuevas.forEach(function (r) { porId[String(r.id_predial)] = r; });
    var vistos = {}, cambio = false;
    for (var i = c.length - 1; i >= 0; i--) {
      var r = c[i];
      if (!afectados[bloqueDe(r.rowIndex, B)]) continue;
      var n = porId[String(r.id_predial)];
      if (!n) { c.splice(i, 1); cambio = true; continue; }
      vistos[String(r.id_predial)] = 1;
      var igual = true;
      for (var k in n) if (n[k] !== r[k]) { igual = false; break; }
      if (!igual) { Object.assign(r, n); r.__completa = false; blob(r); cambio = true; }
    }
    nuevas.forEach(function (n) {
      if (vistos[String(n.id_predial)]) return;
      /* pudo moverse de bloque: si ya está en otro sitio, se actualiza ahí */
      var ya = null;
      for (var j = 0; j < c.length; j++) if (String(c[j].id_predial) === String(n.id_predial)) { ya = c[j]; break; }
      if (ya) { Object.assign(ya, n); ya.__completa = false; blob(ya); }
      else { blob(n); c.push(n); }
      cambio = true;
    });
    if (cambio) ordenar(c);
    return cambio;
  }

  function reemplazarMemoria(lista, u) {
    var c = memoria();
    if (!c || !deEsteUsuario(c) || u !== uid()) return false;
    lista.forEach(blob);
    c.length = 0;
    Array.prototype.push.apply(c, lista);
    return true;
  }

  /* ══════════════ la sincronización de fondo ══════════════ */
  function recDesde(u, r) {
    return { uid: u, cf: r.sync.cf, B: r.sync.B, firmas: r.sync.firmas, campos: r.campos, filas: r.filas, ts: Date.now() };
  }

  function bajarEntera(u) {
    return pedir('listpredial', { uid: u, fmt: '2', firmas: '1' }).then(function (r) {
      if (!r || Number(r.fmt) !== 2 || !r.sync) return;
      if (u !== uid()) return;
      guardar(recDesde(u, r));
      if (reemplazarMemoria(aObjetos(r.campos, r.filas), u)) repintar();
    });
  }

  function sincronizar(u, rec) {
    if (sincronizando || !u) return;
    sincronizando = true;
    aviso(true);
    var fin = function () { sincronizando = false; aviso(false); };
    pedir('predsync', { uid: u }).then(function (s) {
      if (!s || u !== uid()) return;
      if (s.cf !== rec.cf || s.B !== rec.B) return bajarEntera(u);
      var cambiados = [], quitados = [];
      Object.keys(s.firmas).forEach(function (k) { if (rec.firmas[k] !== s.firmas[k]) cambiados.push(k); });
      Object.keys(rec.firmas).forEach(function (k) { if (!(k in s.firmas)) quitados.push(k); });
      if (!cambiados.length && !quitados.length) return;
      if (cambiados.length > MAX_CAMBIADOS) return bajarEntera(u);

      var recibidos = {}, vueltas = 0;
      function traer(pend) {
        if (!pend.length || vueltas++ > 40) return Promise.resolve();
        return pedir('predbloques', { uid: u, b: pend.join(',') }).then(function (r) {
          if (!r || r.cf !== rec.cf) throw new Error('campos cambiaron');
          Object.keys(r.bloques).forEach(function (k) { recibidos[k] = r.bloques[k]; });
          return traer((r.faltan || []).map(String));
        });
      }
      return traer(cambiados).then(function () {
        if (u !== uid()) return;
        var B = rec.B, iRow = rec.campos.indexOf('rowIndex');
        var afectados = {};
        quitados.forEach(function (k) { afectados[k] = 1; });
        Object.keys(recibidos).forEach(function (k) { afectados[k] = 1; });
        /* la copia del equipo */
        var filas = rec.filas.filter(function (f) { return !afectados[bloqueDe(f[iRow], B)]; });
        var nuevas = [];
        Object.keys(recibidos).forEach(function (k) { Array.prototype.push.apply(nuevas, recibidos[k].filas); });
        Array.prototype.push.apply(filas, nuevas);
        ordenar(filas, iRow);
        var firmas = {};
        Object.keys(s.firmas).forEach(function (k) {
          firmas[k] = recibidos[k] ? recibidos[k].firma : (afectados[k] ? '' : rec.firmas[k]);
        });
        guardar({ uid: u, cf: rec.cf, B: B, firmas: firmas, campos: rec.campos, filas: filas, ts: Date.now() });
        /* la lista que se está viendo */
        if (parcharMemoria(B, afectados, aObjetos(rec.campos, nuevas), u)) repintar();
      }).catch(function (e) {
        if (e && /campos/.test(e.message)) return bajarEntera(u);
      });
    }).catch(function () { /* sin red o cortada: se intenta en la próxima apertura */ })
      .then(fin, fin);
  }

  /* ══════════════ el envoltorio de apiGet('listpredial') ══════════════ */
  function envolver() {
    var original = window.apiGet;
    if (typeof original !== 'function' || original.__predSync) return;
    var envuelta = function (accion, params) {
      if (String(accion || '').toLowerCase() !== 'listpredial' || (params && params.firmas)) {
        return original.apply(this, arguments);
      }
      var self = this, u = uid();
      var p = {};
      for (var k in (params || {})) if (Object.prototype.hasOwnProperty.call(params, k)) p[k] = params[k];
      p.fmt = '2'; p.firmas = '1';

      return leer().then(function (rec) {
        if (rec && rec.uid !== u) { borrar(); rec = null; }      /* otra persona en el equipo */
        if (rec && rec.filas && rec.campos && rec.firmas) {
          /* al instante: lo que ya está en memoria (con los guardados propios) o la copia del equipo */
          var c = memoria();
          var lista = (c && c.length && deEsteUsuario(c)) ? c : aObjetos(rec.campos, rec.filas);
          setTimeout(function () { sincronizar(u, rec); }, 0);
          return lista;
        }
        return Promise.resolve(original.call(self, accion, p)).then(function (r) {
          if (r && !Array.isArray(r) && Number(r.fmt) === 2) {
            if (r.sync && u === uid()) guardar(recDesde(u, r));
            return aObjetos(r.campos, r.filas);
          }
          return r;                                              /* backend viejo */
        });
      });
    };
    envuelta.__predSync = true;
    window.apiGet = envuelta;
  }

  envolver();

  /* Cerrar sesión borra la copia del equipo. */
  document.addEventListener('click', function (e) {
    var t = e.target && e.target.closest ? e.target.closest('#btn-logout') : null;
    if (t) borrar();
  }, true);

  window.PREDSYNC = { borrar: borrar, leer: leer, _sincronizar: sincronizar };
})();
