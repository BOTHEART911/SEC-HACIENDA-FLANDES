/* ============================================================
   BITÁCORA ABIERTA — 05/10/2026 · SEC-HACIENDA-FLANDES
   (backend: BitAbierta.gs)

   Cada tarjeta de ASIGNACIONES y de BD PREDIAL tiene tres lados:
     ab = ABOGADO   (asignado / sustanciador)
     as = ASISTENTE
     ad = ASIGNADOR / ADMIN (el asignador de la fila; si no tiene, los ADMIN)
   Cuando alguien guarda una bitácora, queda ABIERTA para los otros dos
   lados; se cierra para un lado cuando alguien de ese lado escribe la suya
   o toca ENTERADO (que deja una bitácora corta automática).

   El dato viaja en el listado (campo bit_abierta = "aaaammdd|aaaammdd|
   aaaammdd", vacío = cerrado). TODO lo de aquí se calcula en el navegador
   sobre la lista que ya está en memoria: la marca de la tarjeta, la
   pastilla "Bitácoras por responder (n)" con su filtro, la consulta de
   Insights y el número de las tarjetas del inicio. El único viaje propio
   es ENTERADO (una escritura) y, de fondo, el conteo del inicio cuando la
   lista aún no se ha bajado.

   Antigüedad en días hábiles con los festivos de HACIENDA (esFestivo_ de
   app.js, que ya aplica los ajustes de Configuración → Festivos):
   0-1 normal · 2-3 ámbar · más de 3 rojo.
   ============================================================ */
(function () {
  'use strict';
  if (window.BITAB) return;

  var VISTAS = {
    'view-bd-predial': {
      lista: '__bdpListCache', refrescar: 'applyBDPredialFilters_', render: 'renderBDPredial_',
      ab: 'sustanciador', as: 'asistente', ad: 'asignador', post: 'bitenteradopred', id: 'id_predial',
      et: 'BD Predial', inicio: 'btn-bd-predial', k: 'pred',
      ficha: function (r) { return txt(r.nombres) + (txt(r.no_exp_fisico) ? ' · ' + txt(r.no_exp_fisico) : ''); }
    },
    'view-asignaciones': {
      lista: '__procListCache', refrescar: 'applyProcFilters_', render: 'renderProcList_',
      ab: 'asignado', as: 'asistente', ad: 'coordinador', post: 'bitenteradoproc', id: 'id_proceso',
      et: 'Asignaciones', inicio: 'btn-semaforo', k: 'proc',
      ficha: function (r) { return (txt(r.consecutivo) || txt(r.id_proceso)) + ' · ' + (txt(r.peticionario) || txt(r.descripcion).slice(0, 70)); }
    }
  };
  var LADOS = ['ab', 'as', 'ad'];
  var SIN = { '': 1, 'NINGUNO': 1, 'NINGUNA': 1, 'N/A': 1, 'SIN ASIGNAR': 1 };
  var encendido = { 'view-bd-predial': false, 'view-asignaciones': false };

  /* ---------- piezas ---------- */
  function $(id) { return document.getElementById(id); }
  function txt(v) { return String(v == null ? '' : v).trim(); }
  function norm(s) {
    return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/\s+/g, ' ').trim().toUpperCase();
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function ico(n, t) { try { return window.ICO_ ? window.ICO_(n, t || 16) : ''; } catch (_) { return ''; } }
  /* las listas de app.js son `let` de nivel superior: se leen por nombre */
  function leer(nombre) { try { var v = (0, eval)(nombre); return Array.isArray(v) ? v : []; } catch (_) { return []; } }
  function yo() {
    try {
      if (window.ALC && window.ALC.nombre) return norm(window.ALC.nombre);
      var p = window.IDN && window.IDN.perfil && window.IDN.perfil();
      if (p && p.nombre) return norm(p.nombre);
    } catch (_) {}
    return '';
  }
  function esAdmin() { try { return !!(window.IDN && window.IDN.esAdmin()); } catch (_) { return false; } }
  function sonar(n) { try { if (window.playSoundOnce && window.SOUNDS && window.SOUNDS[n]) window.playSoundOnce(window.SOUNDS[n]); } catch (_) {} }

  function parse(v) {
    var p = String(v == null ? '' : v).split('|');
    return [0, 1, 2].map(function (i) { var s = txt(p[i]); return /^\d{8}$/.test(s) ? s : ''; });
  }
  function miembros(r, def) {
    var f = function (c) { var s = norm(r[c]); return SIN[s] ? '' : s; };
    return { ab: f(def.ab), as: f(def.as), ad: f(def.ad) };
  }

  /* ---------- días hábiles ---------- */
  var hab = {};
  function hoyClave() {
    var d = new Date();
    return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
  }
  function esHabil(d) {
    var dow = d.getDay();
    if (dow === 0 || dow === 6) return false;
    try { return typeof window.esFestivo_ === 'function' ? !window.esFestivo_(d) : true; } catch (_) { return true; }
  }
  /** Hábiles DESPUÉS del día de apertura y hasta hoy (hoy cuenta). */
  function habiles(desde) {
    var h = hoyClave(), k = desde + '>' + h;
    if (hab[k] !== undefined) return hab[k];
    var d = new Date(+desde.slice(0, 4), +desde.slice(4, 6) - 1, +desde.slice(6, 8));
    var n = 0, g = 0;
    while (g++ < 400) {
      d.setDate(d.getDate() + 1);
      var c = d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
      if (c > h) break;
      if (esHabil(d)) n++;
    }
    return (hab[k] = n);
  }
  function nivel(dias) { return dias > 3 ? 'rojo' : (dias >= 2 ? 'ambar' : 'normal'); }

  /**
   * ¿Esta tarjeta está por responder para MÍ? null si no.
   * { dias, nivel, lados:['ab',…], desde:'aaaammdd' }
   */
  function estado(r, vista) {
    var def = VISTAS[vista];
    if (!def || !r || !r.bit_abierta) return null;
    var a = parse(r.bit_abierta);
    if (!a[0] && !a[1] && !a[2]) return null;
    var y = yo();
    if (!y) return null;
    var m = miembros(r, def);
    var desde = '', lados = [];
    var toma = function (i) { lados.push(LADOS[i]); if (!desde || a[i] < desde) desde = a[i]; };
    if (a[0] && m.ab && m.ab === y) toma(0);
    if (a[1] && m.as && m.as === y) toma(1);
    if (a[2] && ((m.ad && m.ad === y) || (!m.ad && esAdmin()))) toma(2);
    if (!desde) return null;
    var dias = habiles(desde);
    return { dias: dias, nivel: nivel(dias), lados: lados, desde: desde };
  }

  /** Todas las mías por responder de una vista, las más viejas primero. */
  function pendientes(vista, filas) {
    var def = VISTAS[vista];
    if (!def) return [];
    var lista = Array.isArray(filas) ? filas : leer(def.lista);
    var out = [];
    for (var i = 0; i < lista.length; i++) {
      var r = lista[i];
      if (!r || !r.bit_abierta) continue;
      var e = estado(r, vista);
      if (e) out.push({ r: r, e: e });
    }
    out.sort(function (x, z) { return z.e.dias - x.e.dias; });
    return out;
  }

  /* ---------- la marca de la tarjeta ---------- */
  function textoDias(d) { return d === 0 ? 'hoy' : (d === 1 ? '1 día hábil' : d + ' días hábiles'); }
  function marcaHTML(e) {
    return '<div class="ba-marca ba-marca--' + e.nivel + '" role="status">' + ico('libro', 15) +
      '<span>Bitácora por responder · ' + esc(textoDias(e.dias)) + '</span>' +
      '<button type="button" class="ba-enterado" data-bit-enterado="1" title="Marcar como leída sin escribir: deja una bitácora corta “ENTERADO.”">' +
      ico('al-dia', 14) + ' Enterado</button></div>';
  }

  /* BD Predial pinta cada tarjeta como texto (bdpCardHTML_): se le suma la
     marca al mismo texto, sin tocar el DOM tarjeta por tarjeta. */
  function envolverTarjetaPredial() {
    var orig = window.bdpCardHTML_;
    if (typeof orig !== 'function' || orig.__ba) return;
    var env = function (row) {
      var html = orig.apply(this, arguments);
      /* otra capa pudo envolver después: la marca va una sola vez */
      if (html.indexOf('ba-marca') !== -1) return html;
      var e = estado(row, 'view-bd-predial');
      if (!e) return html;
      return html.replace('<div class="bdp-card ', '<div class="bdp-card ba-card ba-card--' + e.nivel + ' ')
                 .replace('<div class="bdp-actions">', marcaHTML(e) + '<div class="bdp-actions">');
    };
    env.__ba = true;
    window.bdpCardHTML_ = env;
  }

  /* Asignaciones arma sus tarjetas con el DOM y pagina por dentro: se
     decoran cuando cambia la lista pintada (también al pasar de página). */
  function decorarProcesos() {
    var wrap = $('proc-list');
    if (!wrap) return;
    var cards = wrap.querySelectorAll('.proc-card');
    if (!cards.length) return;
    var todo = leer('__procPagedCache');
    var pag = 0, tam = 100;
    try { pag = (0, eval)('__procPage') || 0; tam = (0, eval)('__PROC_PAGE_SIZE') || 100; } catch (_) {}
    var slice = todo.slice(pag * tam, pag * tam + tam);
    cards.forEach(function (card, i) {
      var r = slice[i];
      var vieja = card.querySelector('.ba-marca');
      var e = r ? estado(r, 'view-asignaciones') : null;
      card.classList.remove('ba-card', 'ba-card--normal', 'ba-card--ambar', 'ba-card--rojo');
      if (!e) { if (vieja) vieja.remove(); return; }
      card.classList.add('ba-card', 'ba-card--' + e.nivel);
      card.__baFila = r;
      var tmp = document.createElement('div');
      tmp.innerHTML = marcaHTML(e);
      var nueva = tmp.firstChild;
      if (vieja) vieja.replaceWith(nueva);
      else {
        var iconos = card.querySelector('.proc-icons');
        if (iconos && iconos.parentNode) iconos.parentNode.insertBefore(nueva, iconos);
        else card.appendChild(nueva);
      }
    });
  }
  var obsProc = null;
  function observarProcesos() {
    var wrap = $('proc-list');
    if (!wrap || obsProc) return;
    var pend = false;
    obsProc = new MutationObserver(function (muts) {
      /* nuestros propios cambios (la marca) no vuelven a disparar */
      var propio = muts.every(function (m) {
        return Array.prototype.every.call(m.addedNodes, function (n) { return n.classList && n.classList.contains('ba-marca'); }) &&
               Array.prototype.every.call(m.removedNodes, function (n) { return n.classList && n.classList.contains('ba-marca'); });
      });
      if (propio || pend) return;
      pend = true;
      requestAnimationFrame(function () { pend = false; decorarProcesos(); });
    });
    obsProc.observe(wrap, { childList: true, subtree: true });
  }

  /* ---------- la pastilla (filtro local) ---------- */
  function envolverRender(vista) {
    var def = VISTAS[vista];
    var orig = window[def.render];
    if (typeof orig !== 'function' || orig.__ba) return;
    var env = function (items) {
      var lista = Array.isArray(items) ? items : [];
      if (encendido[vista]) lista = lista.filter(function (r) { return !!estado(r, vista); });
      var res = orig.call(this, lista);
      try { pintarNumero(vista); } catch (_) {}
      return res;
    };
    env.__ba = true;
    window[def.render] = env;
  }

  function pintarPastilla(vista) {
    if ($('ba-pill-' + vista)) return;
    var sec = $(vista);
    if (!sec) return;
    var cont = sec.querySelector('.hf-rapidas');
    if (!cont) {
      var ancla = $('proc-filtros');
      if (!ancla || !ancla.parentNode || vista !== 'view-asignaciones') return;
      cont = document.createElement('div');
      cont.className = 'hf-rapidas';
      ancla.parentNode.insertBefore(cont, ancla.nextSibling);
    }
    var b = document.createElement('button');
    b.type = 'button';
    b.id = 'ba-pill-' + vista;
    b.className = 'proc-status-pill ba-pill';
    b.setAttribute('aria-pressed', 'false');
    b.innerHTML = ico('libro', 15) + ' Bitácoras por responder <span class="ba-num" id="ba-num-' + vista + '">0</span>';
    b.addEventListener('click', function () {
      encendido[vista] = !encendido[vista];
      b.classList.toggle('active', encendido[vista]);
      b.setAttribute('aria-pressed', String(encendido[vista]));
      sonar('menu');
      refrescar(vista);
    });
    cont.insertBefore(b, cont.firstChild);
  }
  function pintarNumero(vista) {
    var el = $('ba-num-' + vista);
    if (!el) return;
    var p = pendientes(vista);
    var rojos = p.filter(function (x) { return x.e.nivel === 'rojo'; }).length;
    el.textContent = String(p.length);
    var b = $('ba-pill-' + vista);
    if (b) {
      b.classList.toggle('ba-pill--hay', p.length > 0);
      b.classList.toggle('ba-pill--rojo', rojos > 0);
      b.title = p.length ? (p.length + ' por responder' + (rojos ? ', ' + rojos + ' con más de 3 días hábiles' : '')) : 'Nada por responder';
    }
    ponerEnInicio(VISTAS[vista].k, { n: p.length, rojo: rojos });
  }
  function refrescar(vista) {
    var def = VISTAS[vista];
    try { if (typeof window[def.refrescar] === 'function') window[def.refrescar](); } catch (e) { console.warn('BITAB:', e); }
  }

  /* ---------- ENTERADO (una escritura, con escudo y rid) ---------- */
  function nuevoRid() { return 'be-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
  function reintentable(e) {
    if (!e) return false;
    if (e.name === 'TypeError' || e.name === 'SyntaxError') return true;   /* red caída o el 404 de echo de Google */
    return /RED|Failed to fetch|NetworkError|404/i.test(String(e.codigo || '') + ' ' + String(e.message || ''));
  }
  function enviar(accion, cuerpo, intento) {
    return window.apiPost(accion, cuerpo).catch(function (e) {
      if ((intento || 0) < 1 && reintentable(e)) return enviar(accion, cuerpo, 1);   /* mismo rid */
      throw e;
    });
  }

  function enterado(vista, r, btn) {
    var def = VISTAS[vista];
    if (!r || !def || (btn && btn.__baOcupado)) return;
    var marca = btn && btn.closest('.ba-marca');
    if (btn) { btn.__baOcupado = true; btn.disabled = true; btn.classList.add('ba-ocupado'); }
    if (marca) marca.classList.add('ba-marca--enviando');
    var rid = (btn && btn.__baRid) || nuevoRid();
    if (btn) btn.__baRid = rid;
    sonar('menu');
    enviar(def.post, { id: r[def.id], rowIndex: r.rowIndex, rid: rid }).then(function (res) {
      /* se parcha la fila en memoria: nada de recargar la lista */
      if (res) {
        if (res.bitacora !== undefined) r.bitacora = res.bitacora;
        if (res.bit_abierta !== undefined) r.bit_abierta = res.bit_abierta;
        if (res.rowIndex) r.rowIndex = res.rowIndex;
      }
      sonar('success');
      try { if (window.Swal) window.Swal.fire({ toast: true, position: 'top', icon: 'success', title: 'Enterado. Quedó en la bitácora.', timer: 1800, showConfirmButton: false }); } catch (_) {}
      refrescar(vista);
    }, function (e) {
      if (btn) { btn.__baOcupado = false; btn.disabled = false; btn.classList.remove('ba-ocupado'); if (!reintentable(e)) btn.__baRid = null; }
      if (marca) marca.classList.remove('ba-marca--enviando');
      sonar('error');
      try { if (window.Swal) window.Swal.fire({ icon: 'error', title: 'No se pudo marcar', text: String(e && e.message || e) }); } catch (_) {}
    });
  }

  /* Un solo escucha para las dos vistas (antes que el de app.js). */
  document.addEventListener('click', function (ev) {
    var btn = ev.target.closest && ev.target.closest('[data-bit-enterado]');
    if (!btn) return;
    ev.preventDefault(); ev.stopPropagation();
    var cardP = btn.closest('[data-bdp-idx]');
    if (cardP) {
      var fila = leer('__bdpFilteredCache')[Number(cardP.getAttribute('data-bdp-idx'))];
      return enterado('view-bd-predial', fila, btn);
    }
    var cardA = btn.closest('.proc-card');
    if (cardA && cardA.__baFila) return enterado('view-asignaciones', cardA.__baFila, btn);
  }, true);

  /* ---------- conteo en el inicio ---------- */
  var conteos = { pred: null, proc: null };
  function ponerEnInicio(k, c) {
    conteos[k] = c;
    var def = k === 'pred' ? VISTAS['view-bd-predial'] : VISTAS['view-asignaciones'];
    var b = $(def.inicio);
    if (!b) return;
    var t = b.querySelector('.acceso__t') || b;
    var s = t.querySelector('.ba-badge');
    if (!c || !c.n) { if (s) s.remove(); return; }
    if (!s) { s = document.createElement('span'); s.className = 'ba-badge'; t.appendChild(s); }
    s.textContent = String(c.n);
    s.classList.toggle('ba-badge--rojo', c.rojo > 0);
    s.title = c.n + (c.n === 1 ? ' bitácora' : ' bitácoras') + ' por responder' + (c.rojo ? ' (' + c.rojo + ' en rojo)' : '');
  }
  /* De fondo y en silencio: los botones del inicio ya están pintados; si la
     lista de la vista ya está en memoria se cuenta ahí y no se viaja. */
  var pidiendo = false, ultimo = 0;
  function contarInicio() {
    var pred = leer('__bdpListCache'), proc = leer('__procListCache');
    if (pred.length) pintarNumeroSilencioso('view-bd-predial', pred);
    if (proc.length) pintarNumeroSilencioso('view-asignaciones', proc);
    if ((pred.length && proc.length) || pidiendo || Date.now() - ultimo < 60000) return;
    if (typeof window.apiGet !== 'function' || !yo()) return;
    pidiendo = true; ultimo = Date.now();
    var p;
    window.__HAC_SILENCIO = true;
    try { p = window.apiGet('bitpendientes', {}); } finally { window.__HAC_SILENCIO = false; }
    p.then(function (res) {
      if (!res) return;
      if (!leer('__bdpListCache').length && res.pred) ponerEnInicio('pred', res.pred);
      if (!leer('__procListCache').length && res.proc) ponerEnInicio('proc', res.proc);
    }, function () {}).then(function () { pidiendo = false; });
  }
  function pintarNumeroSilencioso(vista, filas) {
    var p = pendientes(vista, filas);
    ponerEnInicio(VISTAS[vista].k, { n: p.length, rojo: p.filter(function (x) { return x.e.nivel === 'rojo'; }).length });
  }

  /* ---------- Insights: "Bitácoras por revisar" ---------- */
  function insight(vista) {
    var def = VISTAS[vista];
    var p = pendientes(vista);
    var titulo = 'Bitácoras por revisar · ' + def.et;
    if (!yo()) return { titulo: titulo, texto: 'No logro saber con qué usuario estás dentro.', voz: 'No sé con qué usuario estás dentro.' };
    if (!p.length) return { titulo: titulo, texto: '✅ No tienes ninguna bitácora por responder en ' + def.et + '.', voz: 'No tienes bitácoras por responder.' };
    var g = { rojo: [], ambar: [], normal: [] };
    p.forEach(function (x) { g[x.e.nivel].push(x); });
    var linea = function (x) {
      /* el lector de Insights ya escapa el texto: aquí va plano */
      var ult = (txt(x.r.bitacora).split(/\r?\n/).filter(function (l) { return /\d{1,2}\/\d{1,2}\/\d{4}/.test(l); }).pop() || '')
        .replace(/[*_]/g, '').slice(0, 110);
      return '- **' + def.ficha(x.r).replace(/\*/g, '') + '** — ' + textoDias(x.e.dias) + (ult ? ' · última: ' + ult : '');
    };
    var partes = ['Tienes **' + p.length + '** ' + (p.length === 1 ? 'bitácora' : 'bitácoras') + ' por responder en ' + def.et +
      '. Escribe la tuya o toca **Enterado** en la tarjeta. La pastilla *Bitácoras por responder* las deja solas en pantalla.'];
    if (g.rojo.length) partes.push('**🔴 Más de 3 días hábiles (' + g.rojo.length + ')**\n' + g.rojo.slice(0, 15).map(linea).join('\n') + (g.rojo.length > 15 ? '\n- … y ' + (g.rojo.length - 15) + ' más' : ''));
    if (g.ambar.length) partes.push('**🟠 2 a 3 días hábiles (' + g.ambar.length + ')**\n' + g.ambar.slice(0, 15).map(linea).join('\n') + (g.ambar.length > 15 ? '\n- … y ' + (g.ambar.length - 15) + ' más' : ''));
    if (g.normal.length) partes.push('**🟢 Recientes (' + g.normal.length + ')**\n' + g.normal.slice(0, 15).map(linea).join('\n') + (g.normal.length > 15 ? '\n- … y ' + (g.normal.length - 15) + ' más' : ''));
    return {
      titulo: titulo, texto: partes.join('\n\n'),
      voz: 'Tienes ' + p.length + (p.length === 1 ? ' bitácora' : ' bitácoras') + ' por responder' + (g.rojo.length ? ', ' + g.rojo.length + ' con más de tres días hábiles.' : '.')
    };
  }

  /* ---------- montaje ---------- */
  function alEntrar(id) {
    if (VISTAS[id]) {
      pintarPastilla(id);
      if (id === 'view-asignaciones') { observarProcesos(); decorarProcesos(); }
      setTimeout(function () { pintarNumero(id); }, 300);
    }
    if (id === 'view-inicio') setTimeout(contarInicio, 900);
  }
  function engancharVistas() {
    var orig = window.showView;
    if (typeof orig !== 'function' || orig.__ba) return;
    var env = function (id) {
      var r = orig.apply(this, arguments);
      try { alEntrar(id); } catch (e) { console.warn('BITAB:', e); }
      return r;
    };
    env.__ba = true;
    window.showView = env;
  }
  function arrancar() {
    envolverTarjetaPredial();
    envolverRender('view-bd-predial');
    envolverRender('view-asignaciones');
    engancharVistas();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', arrancar);
  else arrancar();
  /* app.js reasigna renderProcList_ al final y otras capas envuelven
     showView y los render: se vuelve a envolver (idempotente, marca __ba). */
  setTimeout(arrancar, 1500);
  setTimeout(arrancar, 4000);
  /* el inicio se pinta antes que showView exista envuelto: un primer conteo */
  window.addEventListener('load', function () { setTimeout(contarInicio, 2500); });

  window.BITAB = {
    estado: estado, pendientes: pendientes, parse: parse, habiles: habiles, nivel: nivel,
    insight: insight, enterado: enterado, contarInicio: contarInicio, conteos: function () { return conteos; },
    pastilla: function (vista, v) { encendido[vista] = !!v; var b = $('ba-pill-' + vista); if (b) b.classList.toggle('active', !!v); refrescar(vista); },
    encendido: function (vista) { return !!encendido[vista]; },
    montar: alEntrar, decorarProcesos: decorarProcesos
  };
})();
