/* ============================================================
   SEC-HACIENDA-FLANDES · DRIVE ANEXOS = EVIDENCIAS (18/10/2026)

   La vista DRIVE ANEXOS pasa a ser donde el contratista sube sus
   anexos (Word o Excel) desde la app. En Drive ya no edita nada:
   solo puede LEER su cuenta abierta. Lo aprobado queda sellado.

   UN VIAJE: 'dapanel' trae todo (contratos, cuentas y evidencias que
   le tocan a quien entra). Filtros, buscador y cambios de contrato son
   locales. Tras cada guardado se PARCHA la fila en memoria: nada de
   volver a pedir la lista.

   SUBIDA DIRECTA: 'dasubida' (un viaje corto: candado + rid) abre una
   sesión de Drive; el navegador manda los bytes a Drive (no pasan por
   Apps Script) y 'daconfirmar' se manda detrás. Reintento solo ante
   falla de red y con el MISMO rid.

   Si el servidor dice modo VIEJO (o es un backend anterior), se
   pintan las tarjetas de siempre con la lista que vino en el mismo
   viaje.
   ============================================================ */
(function (raiz) {
  'use strict';
  var K = raiz.KIT || {};
  var API = String((raiz.MARCA && raiz.MARCA.API_URL) || '');
  var EXT_OK = ['doc', 'docx', 'xls', 'xlsx'];
  var ACEPTA = '.doc,.docx,.xls,.xlsx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,' +
               'application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  /* 18/10 — PDF solo para el contratista con el permiso (lo activa un ADMIN con PIN o el DEV).
     Sin permiso, nada de esto aparece: tipos, textos y selector quedan como siempre. */
  var EXT_PDF = EXT_OK.concat('pdf');
  var ACEPTA_PDF = ACEPTA + ',.pdf,application/pdf';
  var MIME = {
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  };

  /* ── estado de la vista (carga única por sesión) ── */
  var S = null;            /* { yo, usuarios, carpetas:[], evidencias:[], topeMB, oblMax, modo } */
  var SEL = { uid: '', contrato: '' };
  var FORM = null;         /* { modo:'nuevo'|'editar', ev, contrato } */
  var MED = raiz.DA_MED = [];

  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function ico(n, t) { try { return raiz.ICO_ ? raiz.ICO_(n, t || 18) : ''; } catch (_) { return ''; } }
  function kico(n, t) { try { return K.icono ? K.icono(n, t || 18) : ico(n, t); } catch (_) { return ''; } }
  function aviso(t, tipo, ms) { try { if (K.aviso) return K.aviso(t, tipo || 'info', ms || 3500); } catch (_) {} try { raiz.Swal && raiz.Swal.fire({ icon: 'info', text: t }); } catch (_) {} }
  /* SOUNDS y playSoundOnce son de app.js (const/función globales, no de window) */
  function sonar(k) { try { if (typeof SOUNDS !== 'undefined' && SOUNDS[k] && typeof playSoundOnce === 'function') playSoundOnce(SOUNDS[k]); } catch (_) {} }
  function nuevoRid() { return 'da-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8); }
  function medir(ruta, t0, extra) { var ms = Math.round(performance.now() - t0); MED.push({ ruta: ruta, ms: ms, extra: extra || '' }); try { console.debug('[anexos] ' + ruta + ' ' + ms + ' ms' + (extra ? ' · ' + extra : '')); } catch (_) {} return ms; }
  function tres(n) { n = String(Number(n) || 0); return n.length < 3 ? ('000' + n).slice(-3) : n; }
  function peso(b) { b = Number(b) || 0; if (b < 1024) return b + ' B'; if (b < 1048576) return Math.round(b / 1024) + ' KB'; return (b / 1048576).toFixed(1).replace('.', ',') + ' MB'; }
  function rehidratar(o) { if (!o || !o.campos) return []; return (o.filas || []).map(function (f) { var r = {}; o.campos.forEach(function (c, i) { r[c] = f[i]; }); return r; }); }

  /* ══════════════ escrituras: botón ocupado, rid, un reintento con el mismo rid ══════════════ */
  function reintentable(e) { return !!e && (e.name === 'TypeError' || e.name === 'SyntaxError' || e.__red); }
  function post(accion, cuerpo, intento) {
    var url = API + '?action=' + encodeURIComponent(accion);
    var t0 = performance.now();
    return fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(cuerpo) })
      .then(function (r) { if (r.status === 404) { var e = new Error('echo404'); e.__red = true; throw e; } return r.json(); })
      .then(function (j) {
        medir(accion, t0);
        if (!j.ok) { var er = new Error(j.error || 'Error'); er.codigo = j.codigo || ''; throw er; }
        return j.data;
      })
      .catch(function (e) {
        if ((intento || 0) < 1 && reintentable(e)) return post(accion, cuerpo, 1);   /* mismo rid */
        throw e;
      });
  }
  /** Ejecuta una escritura con el botón ocupado desde el primer toque. */
  function conBoton(btn, fn) {
    if (btn && btn.__daOcupado) return Promise.resolve(null);
    if (btn) { btn.__daOcupado = true; btn.disabled = true; btn.classList.add('da-ocupado'); }
    var rid = (btn && btn.__daRid) || nuevoRid();
    if (btn) btn.__daRid = rid;
    return Promise.resolve().then(function () { return fn(rid); }).then(function (r) {
      if (btn) { btn.__daOcupado = false; btn.disabled = false; btn.classList.remove('da-ocupado'); btn.__daRid = null; }
      return r;
    }, function (e) {
      if (btn) { btn.__daOcupado = false; btn.disabled = false; btn.classList.remove('da-ocupado'); if (!reintentable(e)) btn.__daRid = null; }
      throw e;
    });
  }
  function fallo(titulo, e) {
    sonar('error');
    try { raiz.Swal.fire({ icon: 'error', title: titulo, text: String((e && e.message) || e) }); } catch (_) { aviso(String(e && e.message || e), 'malo'); }
  }

  /* ══════════════ datos en memoria ══════════════ */
  function carpetasDe(uid) { return S.carpetas.filter(function (c) { return c.u === uid; }); }
  function contratosDe(uid) { return carpetasDe(uid).filter(function (c) { return c.t === 'CONTRATO'; }).sort(function (a, b) { return b.n - a.n; }); }
  function cuentasDe(ctId) { return S.carpetas.filter(function (c) { return c.t === 'CUENTA' && c.ct === ctId; }).sort(function (a, b) { return a.n - b.n; }); }
  /* la cuenta que se llena ahora: la ÚLTIMA si está abierta; si no, la última + 1
     (una cuenta vieja reabierta se corrige en su propia tarjeta) */
  function cuentaAbierta(ctId) {
    var cs = cuentasDe(ctId), ult = cs[cs.length - 1];
    if (ult && ult.s === 'ABIERTA') return { fila: ult, n: ult.n };
    return { fila: null, n: ult ? ult.n + 1 : 1 };
  }
  function evidenciasDe(cuId) {
    return S.evidencias.filter(function (e) { return e.cu === cuId && e.s !== 'ELIMINADA'; })
      .sort(function (a, b) { return a.o - b.o || a.k - b.k; });
  }
  function porId(lista, id) { for (var i = 0; i < lista.length; i++) if (lista[i].id === id) return i; return -1; }
  function parchar(lista, filas) {
    (filas || []).forEach(function (f) { var i = porId(lista, f.id); if (i >= 0) lista[i] = f; else lista.push(f); });
  }
  function usuario(uid) { for (var i = 0; i < S.usuarios.length; i++) if (S.usuarios[i].uid === uid) return S.usuarios[i]; return null; }
  function contrato(id) { var i = porId(S.carpetas, id); return i >= 0 ? S.carpetas[i] : null; }
  function textoCopiar(ev) {
    var ct = contrato(ev.ct), cu = contrato(ev.cu);
    return 'CONTRATO ' + tres(ct ? ct.n : 0) + ' – CUENTA ' + (cu ? cu.n : '') + ' - ' + ev.o + '.' + ev.k + '. ' + ev.nm + '.' + ev.x;
  }

  /* ══════════════ abrir la vista (UN viaje) ══════════════ */
  function abrir() {
    var f = $('drive-filter'); if (f) f.value = '';
    raiz.showView('view-drive-anexos');
    /* carga única por sesión: si ya está en memoria se pinta al instante */
    if (S && S.__uid === uidActual()) { pintar(); return Promise.resolve(); }
    $('da-panel').innerHTML = '';
    $('da-panel').hidden = true;
    var t0 = performance.now();
    return raiz.apiGet('dapanel', { uid: uidActual() }).then(function (r) {
      medir('dapanel', t0, (r && r.modo) || '');
      if (!r || r.modo === 'VIEJO') return viejo(r && r.lista);
      S = {
        __uid: uidActual(), modo: r.modo, yo: r.yo, usuarios: r.usuarios || [],
        carpetas: rehidratar(r.carpetas), evidencias: rehidratar(r.evidencias),
        topeMB: r.topeMB || 10, oblMax: r.oblMax || 20
      };
      if (!S.yo.admin) SEL.uid = S.yo.uid;
      else if (SEL.uid && !usuario(SEL.uid)) SEL.uid = '';
      pintar();
    }, function (e) {
      if (e && e.message === '__HAC_CANCELADA__') return;
      /* backend anterior sin la ruta: las tarjetas de siempre */
      if (/acci[oó]n no v[aá]lida/i.test(String(e && e.message))) return viejo(null);
      fallo('No se pudo abrir Drive anexos', e);
    });
  }
  function uidActual() { try { return raiz.uidActual_(); } catch (_) { return ''; } }

  /** Modo de siempre: tarjetas con el enlace a la carpeta. */
  function viejo(lista) {
    S = null;
    $('da-panel').hidden = true;
    $('drive-grid').hidden = false;
    var intro = $('drive-intro'); if (intro) intro.hidden = false;
    if (Array.isArray(lista)) return raiz.__daPintarViejo(lista);
    return raiz.__daCargarViejo();
  }

  /* ══════════════ pintar ══════════════ */
  function pintar() {
    var p = $('da-panel');
    $('drive-grid').hidden = true; $('drive-grid').innerHTML = '';
    var intro = $('drive-intro'); if (intro) intro.hidden = true;
    var fr = $('drive-filter-row');
    p.hidden = false;
    if (S.yo.admin && !SEL.uid) {
      if (fr) fr.style.display = '';
      p.innerHTML = cabecera() + listaAdmin();
      filtrarAdmin();
    } else {
      if (fr) fr.style.display = 'none';
      p.innerHTML = cabecera() + panelUsuario(SEL.uid || S.yo.uid);
      adelantarVer();
    }
  }

  /* 18/10 — "Ver archivos" sin espera: la carpeta de la primera cuenta que se
     ve (la actual o la última aprobada) se pide de fondo, detrás de lo que se
     está pintando, y queda lista con su primer archivo. Una sola a la vez; si
     la persona ya salió de la vista, no se pide. */
  var tAdel = 0;
  function adelantarVer() {
    clearTimeout(tAdel);
    tAdel = setTimeout(function () {
      var v = $('view-drive-anexos'), b = document.querySelector('#da-panel [data-da="ver-carpeta"]');
      if (PEND > 0 || !b || !v || v.hidden || v.offsetParent === null || !raiz.VISOR || !raiz.VISOR.adelantarCarpeta) return;
      raiz.VISOR.adelantarCarpeta(b.dataset.f, b.dataset.fi || '');
    }, 700);
  }
  /** Lo que la vista sabe de la cuenta; si cambia (subir, editar, borrar), la carpeta se pide de nuevo. */
  function firmaCuenta(cuId) {
    var s = '';
    S.evidencias.forEach(function (e) { if (e.cu === cuId && !e.__pend) s += e.id + ':' + (e.a || '') + ':' + e.s + ':' + e.o + '.' + e.k + ':' + e.nm + ';'; });
    var x = 0; for (var i = 0; i < s.length; i++) x = (x * 31 + s.charCodeAt(i)) >>> 0;
    return String(x);
  }

  function cabecera() {
    var h = '';
    if (S.modo === 'PRUEBA') h += '<div class="da-banda da-banda--prueba">' + kico('herramienta', 16) + ' MODO PRUEBA · hojas y carpetas de prueba (solo tú lo ves)</div>';
    if (S.yo.dev) {
      h += '<div class="da-dev">' +
        '<button type="button" class="kit-btn kit-btn--plano" data-da="arranque">' + kico('cohete', 16) + ' Arranque</button>' +
        (S.modo === 'PRUEBA' ? '<button type="button" class="kit-btn kit-btn--plano" data-da="sembrar">' + kico('herramienta', 16) + ' Sembrar prueba</button>' : '') +
        '</div>';
    }
    return h;
  }

  /* ── administradores: lista de contratistas ── */
  function resumenUsuario(u) {
    var cts = contratosDe(u.uid), ab = cts.filter(function (c) { return c.s === 'ABIERTO'; });
    var n = 0;
    ab.forEach(function (c) { var a = cuentaAbierta(c.id); if (a.fila) n += evidenciasDe(a.fila.id).length; });
    return { contratos: cts.length, abiertos: ab.length, evid: n };
  }
  function listaAdmin() {
    var h = '<div class="da-rejilla" id="da-lista">';
    S.usuarios.forEach(function (u) {
      var r = resumenUsuario(u);
      h += '<button type="button" class="da-persona' + (r.abiertos ? '' : ' da-persona--sin') + '" data-da="persona" data-uid="' + esc(u.uid) + '" data-busca="' + esc((u.nombre + ' ' + u.correo).toLowerCase()) + '">' +
        '<span class="da-persona__n">' + esc(u.nombre) + '</span>' +
        '<span class="da-persona__c">' + esc(u.correo || 'sin correo') + '</span>' +
        '<span class="da-persona__m">' +
          '<span class="da-chip">' + r.abiertos + ' de ' + r.contratos + ' contrato' + (r.contratos === 1 ? '' : 's') + ' abierto' + (r.abiertos === 1 ? '' : 's') + '</span>' +
          (u.pdf ? '<span class="da-chip da-chip--pdf" title="Puede subir PDF">' + kico('pdf', 14) + ' PDF</span>' : '') +
          (r.evid ? '<span class="da-chip da-chip--ok">' + r.evid + ' anexo' + (r.evid === 1 ? '' : 's') + ' en cuenta abierta</span>' : '') +
        '</span></button>';
    });
    h += '</div>';
    if (!S.usuarios.length) h = '<p class="muted center">No hay contratistas con carpeta de anexos.</p>';
    return h;
  }
  function filtrarAdmin() {
    var q = String(($('drive-filter') || {}).value || '').toLowerCase().trim();
    var n = 0;
    document.querySelectorAll('#da-lista .da-persona').forEach(function (b) {
      var ok = !q || b.dataset.busca.indexOf(q) !== -1;
      b.hidden = !ok; if (ok) n++;
    });
    var c = $('drive-count'); if (c) c.textContent = String(n);
  }

  /* ── panel de UN contratista ── */
  function panelUsuario(uid) {
    var u = usuario(uid);
    if (!u) return '<p class="muted center">No tienes carpeta de anexos. Pide a la Secretaría que la configuren.</p>';
    var cts = contratosDe(uid);
    var abiertos = cts.filter(function (c) { return c.s === 'ABIERTO'; });
    if (!SEL.contrato || !cts.some(function (c) { return c.id === SEL.contrato; })) SEL.contrato = (abiertos[0] || cts[0] || {}).id || '';
    var h = '';
    if (S.yo.admin) {
      h += '<div class="da-quien">' +
        '<button type="button" class="kit-btn kit-btn--plano" data-da="volver">' + kico('atras', 16) + ' Todos</button>' +
        '<div class="da-quien__t"><b>' + esc(u.nombre) + '</b><span>' + esc(u.correo || 'sin correo') + '</span></div>' +
        '<div class="da-quien__acc">' +
          '<button type="button" class="kit-btn kit-btn--plano" data-da="correo">' + kico('sobre', 16) + ' Correo</button>' +
          '<button type="button" class="kit-btn kit-btn--plano da-btn-pdf' + (u.pdf ? ' da-btn-pdf--on' : '') + '" data-da="pdf" aria-pressed="' + !!u.pdf + '" title="' + (u.pdf ? 'Tiene permiso de subir PDF: tocar para quitarlo' : 'Solo Word y Excel: tocar para permitir PDF') + '">' +
            kico('pdf', 16) + (u.pdf ? ' PDF permitido · Quitar' : ' Permitir PDF') + '</button>' +
          '<button type="button" class="kit-btn kit-btn--marca" data-da="nuevo-contrato">' + kico('mas', 16) + ' Crear contrato</button>' +
        '</div></div>';
    }
    if (!abiertos.length) {
      h += '<div class="da-vacio">' + kico('candado', 28) + '<p><b>No tienes un CONTRATO abierto.</b><br>' +
        (S.yo.admin ? 'Crea el contrato para que pueda subir sus anexos.' : 'Pídele a un administrador de la Secretaría que lo cree para poder subir tus anexos.') + '</p></div>';
    }
    if (cts.length) {
      h += '<div class="kit-pastillas kit-pastillas--envuelve da-contratos" role="tablist">';
      cts.forEach(function (c) {
        h += '<button type="button" class="kit-pastilla' + (c.s === 'ABIERTO' ? '' : ' da-pastilla--sellada') + '" aria-pressed="' + (c.id === SEL.contrato) + '" data-da="contrato" data-id="' + esc(c.id) + '">' +
          (c.s === 'ABIERTO' ? '' : kico('candado', 14) + ' ') + 'CONTRATO ' + tres(c.n) + '</button>';
      });
      h += '</div>';
      var ct = contrato(SEL.contrato);
      if (ct) h += panelContrato(ct);
    }
    return h;
  }

  function panelContrato(ct) {
    var h = '';
    var abierto = ct.s === 'ABIERTO';
    var cs = cuentasDe(ct.id);
    if (S.yo.admin) {
      h += '<div class="da-ctacc">' +
        '<span class="da-estado da-estado--' + (abierto ? 'ab' : 'ap') + '">' + (abierto ? 'Contrato abierto' : 'Contrato aprobado') + '</span>' +
        (abierto ? '<button type="button" class="kit-btn kit-btn--plano" data-da="aprobar" data-id="' + esc(ct.id) + '">' + kico('check', 16) + ' Aprobar contrato completo</button>'
                 : '<button type="button" class="kit-btn kit-btn--plano" data-da="reabrir" data-id="' + esc(ct.id) + '">' + kico('girar', 16) + ' Reabrir contrato</button>') +
        '</div>';
    }
    /* cuenta que se llena ahora */
    var ab = abierto ? cuentaAbierta(ct.id) : null;
    if (abierto) h += tarjetaCuenta(ct, ab.fila, ab.n, true);
    /* cuentas viejas REABIERTAS por un administrador: también se corrigen */
    cs.filter(function (c) { return c.s === 'ABIERTA' && !(ab && ab.fila && ab.fila.id === c.id); }).reverse()
      .forEach(function (c) { h += tarjetaCuenta(ct, c, c.n, true, false, true); });
    /* historial: aprobadas, de la más reciente a la más vieja */
    var aprob = cs.filter(function (c) { return c.s === 'APROBADA'; }).reverse();
    if (aprob.length) {
      h += '<h4 class="da-sub">' + ico('libro', 16) + ' Historial (aprobadas, solo lectura)</h4>';
      aprob.forEach(function (c) { h += tarjetaCuenta(ct, c, c.n, false); });
    }
    return h;
  }

  function tarjetaCuenta(ct, fila, n, editable, _no, reabierta) {
    var evs = fila ? evidenciasDe(fila.id) : (editable ? evidenciasDe('__nueva__' + ct.id) : []);
    var h = '<section class="da-cuenta' + (editable ? ' da-cuenta--abierta' : '') + '">' +
      '<header class="da-cuenta__cab">' +
        '<div class="da-cuenta__t">' + (editable ? kico('lapiz', 18) : kico('candado', 18)) +
          ' <b>CUENTA ' + n + '</b><span class="da-estado da-estado--' + (editable ? 'ab' : 'ap') + '">' + (editable ? (reabierta ? 'reabierta' : 'abierta') : 'aprobada') + '</span>' +
          (fila ? '' : '<span class="da-nota">se crea con tu primer anexo</span>') + '</div>' +
        '<div class="da-cuenta__acc">';
    if (editable) h += '<button type="button" class="kit-btn kit-btn--marca" data-da="agregar" data-ct="' + esc(ct.id) + '"' + (reabierta ? ' data-cu="' + esc(fila.id) + '"' : '') + '>' + kico('mas', 16) + ' Agregar evidencia</button>';
    if (evs.length && fila) h += '<button type="button" class="kit-btn kit-btn--plano" data-da="copiar-todos" data-cu="' + esc(fila.id) + '">' + kico('copiar', 16) + ' Copiar todos</button>';
    if (fila && fila.f) h += '<button type="button" class="kit-btn kit-btn--plano" data-da="ver-carpeta" data-f="' + esc(fila.f) + '" data-fi="' + esc(firmaCuenta(fila.id)) + '">' + ico('carpeta-abierta', 16) + ' Ver archivos</button>';
    if (S.yo.admin && fila && editable) h += '<button type="button" class="kit-btn kit-btn--plano" data-da="aprobar" data-id="' + esc(fila.id) + '">' + kico('check', 16) + ' Aprobar cuenta</button>';
    /* 18/10 — cualquier cuenta aprobada se puede reabrir (con PIN, salvo DEV) */
    if (S.yo.admin && fila && !editable) h += '<button type="button" class="kit-btn kit-btn--plano" data-da="reabrir" data-id="' + esc(fila.id) + '">' + kico('girar', 16) + ' Reabrir</button>';
    h += '</div></header>';
    if (evs.length) {
      h += '<div class="da-tabla" role="table">';
      evs.forEach(function (e) {
        var subiendo = e.s === 'SUBIENDO';
        if (e.__pend) {
          h += '<div class="da-fila da-fila--sub da-fila--pend" role="row" data-id="' + esc(e.id) + '">' +
            '<span class="da-fila__num">' + e.o + '.' + e.k + '.</span>' +
            '<span class="da-fila__ico"><span class="da-giro"></span></span>' +
            '<span class="da-fila__nom"><b>' + esc(e.nm) + '.' + esc(e.x) + '</b><small>' + esc(e.__txt || 'Guardando…') + '</small></span>' +
            '<span class="da-fila__acc"></span></div>';
          return;
        }
        h += '<div class="da-fila' + (subiendo ? ' da-fila--sub' : '') + '" role="row" data-id="' + esc(e.id) + '">' +
          '<span class="da-fila__num">' + e.o + '.' + e.k + '.</span>' +
          '<span class="da-fila__ico">' + kico(e.x === 'pdf' ? 'pdf' : (/^xls/.test(e.x) ? 'hoja' : 'documento'), 18) + '</span>' +
          '<span class="da-fila__nom"><b>' + esc(e.nm) + '.' + esc(e.x) + '</b><small>Obligación ' + e.o + (e.p ? ' · ' + peso(e.p) : '') + (subiendo ? ' · subida sin confirmar' : '') + '</small></span>' +
          '<span class="da-fila__acc">' +
            (subiendo ? '<button type="button" class="da-ib" data-da="reconfirmar" data-id="' + esc(e.id) + '" title="Confirmar la subida">' + kico('recargar', 18) + '</button>'
                      : '<button type="button" class="da-ib" data-da="ver" data-id="' + esc(e.id) + '" title="Ver">' + kico('ojo', 18) + '</button>' +
                        '<button type="button" class="da-ib" data-da="copiar" data-id="' + esc(e.id) + '" title="Copiar">' + kico('copiar', 18) + '</button>') +
            (editable && !subiendo ? '<button type="button" class="da-ib" data-da="editar" data-id="' + esc(e.id) + '" title="Editar o reemplazar">' + kico('lapiz', 18) + '</button>' : '') +
            (editable ? '<button type="button" class="da-ib da-ib--malo" data-da="eliminar" data-id="' + esc(e.id) + '" title="Eliminar">' + kico('basura', 18) + '</button>' : '') +
          '</span></div>';
      });
      h += '</div>';
    } else if (editable) {
      h += '<p class="da-nada">Aún no hay evidencias en esta cuenta.</p>';
    } else if (fila) {
      h += '<p class="da-nada">Anexos de antes de la app: ábrelos con <b>Ver archivos</b>.</p>';
    }
    return h + '</section>';
  }

  /* ══════════════ acciones ══════════════ */
  document.addEventListener('click', function (ev) {
    var b = ev.target.closest && ev.target.closest('[data-da]');
    if (!b || !$('view-drive-anexos') || !(b.closest('#da-panel') || b.closest('#view-da-form'))) return;
    var a = b.dataset.da;
    if (a === 'persona') { sonar('menu'); SEL.uid = b.dataset.uid; SEL.contrato = ''; pintar(); raiz.scrollTo({ top: 0 }); return; }
    if (a === 'volver') { sonar('back'); SEL.uid = ''; pintar(); return; }
    if (a === 'contrato') { sonar('menu'); SEL.contrato = b.dataset.id; pintar(); return; }
    if (a === 'agregar') return abrirForm('nuevo', null, b.dataset.ct, b.dataset.cu);
    if (a === 'editar') return abrirForm('editar', evi(b.dataset.id));
    if (a === 'eliminar') return eliminar(b, evi(b.dataset.id));
    if (a === 'copiar') return copiar([evi(b.dataset.id)]);
    if (a === 'copiar-todos') return copiar(evidenciasDe(b.dataset.cu).filter(function (e) { return e.s === 'ACTIVO'; }));
    if (a === 'ver') {
      /* se abren todas las evidencias de esa cuenta, empezando por la tocada (siguiente/anterior y precarga) */
      var e = evi(b.dataset.id); if (!e || !raiz.VISOR) return;
      var todas = evidenciasDe(e.cu).filter(function (x) { return x.s === 'ACTIVO' && x.a; });
      var ix = Math.max(0, porId(todas, e.id));
      raiz.VISOR.lista(todas.map(function (x) { return { id: x.a, titulo: x.o + '.' + x.k + '. ' + x.nm + '.' + x.x, mime: MIME[x.x], peso: x.p }; }), { indice: ix });
      return;
    }
    if (a === 'ver-carpeta') {   /* 19/10: sin botón Carpeta (la raíz solo tiene subcarpetas: siempre salía vacío) */ if (raiz.VISOR) raiz.VISOR.carpeta(b.dataset.f, { firma: b.dataset.fi || '' }); return; }
    if (a === 'reconfirmar') return reconfirmar(b, evi(b.dataset.id));
    if (a === 'aprobar') return accionAdmin(b, 'daaprobar', b.dataset.id);
    if (a === 'reabrir') return accionAdmin(b, 'dareabrir', b.dataset.id);
    if (a === 'nuevo-contrato') return nuevoContrato(b);
    if (a === 'pdf') return permisoPdf(b);
    if (a === 'correo') { var u = usuario(SEL.uid); if (u) return correo(u); return; }
    if (a === 'arranque') return arranque(b);
    if (a === 'sembrar') return sembrar(b);
  });
  function evi(id) { var i = porId(S.evidencias, id); return i >= 0 ? S.evidencias[i] : null; }

  function copiar(evs) {
    evs = (evs || []).filter(Boolean);
    if (!evs.length) return;
    var txt = evs.map(textoCopiar).join('\n');
    var fin = function () {
      sonar('success');
      aviso(evs.length === 1 ? 'Pega en el campo de Evidencia ' + evs[0].o : 'Se copiaron ' + evs.length + ' evidencias (una por línea).', 'ok', 2500);
    };
    try { navigator.clipboard.writeText(txt).then(fin, function () { copiarViejo(txt); fin(); }); }
    catch (_) { copiarViejo(txt); fin(); }
  }
  function copiarViejo(t) { var a = document.createElement('textarea'); a.value = t; document.body.appendChild(a); a.select(); try { document.execCommand('copy'); } catch (_) {} a.remove(); }

  /* ── PIN de seguridad (administradores que no son DEV) ── */
  function pedirPin(que) {
    if (!S.yo.pin) return Promise.resolve('');
    return raiz.Swal.fire({
      title: 'PIN de seguridad', text: que, input: 'password', inputAttributes: { inputmode: 'numeric', maxlength: 8, autocomplete: 'off' },
      showCancelButton: true, confirmButtonText: 'Continuar', cancelButtonText: 'Cancelar',
      inputValidator: function (v) { return /^\d{4,8}$/.test(v || '') ? null : 'Escribe el PIN (4 a 8 dígitos).'; }
    }).then(function (r) { if (!r.isConfirmed) throw { cancelado: true }; return r.value; });
  }

  function accionAdmin(btn, accion, id) {
    var f = contrato(id); if (!f) return;
    var esCt = f.t === 'CONTRATO';
    var que = (accion === 'daaprobar' ? 'Aprobar ' : 'Reabrir ') + (esCt ? 'el CONTRATO ' + tres(f.n) : 'la CUENTA ' + f.n);
    var aclara = accion === 'daaprobar'
      ? 'El contratista pierde de inmediato la edición y el acceso en Drive a esa carpeta; la verá como historial.'
      : 'El contratista vuelve a poder agregar, cambiar y eliminar anexos de esa cuenta.';
    raiz.Swal.fire({ icon: 'question', title: que + '?', text: aclara, showCancelButton: true, confirmButtonText: 'Sí', cancelButtonText: 'No' })
      .then(function (r) { if (!r.isConfirmed) throw { cancelado: true }; return pedirPin(que); })
      .then(function (pin) {
        return conBoton(btn, function (rid) {
          var t0 = performance.now();
          return post(accion, { rid: rid, id: id, pin: pin }).then(function (res) {
            medir(accion + ' (total)', t0);
            parchar(S.carpetas, res.carpetas); sonar('success');
            aviso(que + ': listo.', 'ok', 2200); pintar();
          });
        });
      })
      .catch(function (e) { if (e && e.cancelado) return; fallo('No se pudo', e); });
  }

  function nuevoContrato(btn) {
    var u = usuario(SEL.uid); if (!u) return;
    raiz.Swal.fire({
      title: 'Crear contrato', html: '<p style="margin:0 0 8px">' + esc(u.nombre) + '</p>', input: 'text',
      inputLabel: 'Número del contrato', inputPlaceholder: 'Ej. 237', inputAttributes: { inputmode: 'numeric', maxlength: 4 },
      showCancelButton: true, confirmButtonText: 'Crear', cancelButtonText: 'Cancelar',
      inputValidator: function (v) { return /^\d{1,4}$/.test(String(v || '').trim()) ? null : 'Escribe solo el número (ej. 237).'; }
    }).then(function (r) {
      if (!r.isConfirmed) throw { cancelado: true };
      var num = String(r.value).trim();
      return pedirPin('Crear el CONTRATO ' + tres(num) + ' de ' + u.nombre).then(function (pin) {
        return conBoton(btn, function (rid) {
          var t0 = performance.now();
          return post('dacontrato', { rid: rid, para: u.uid, numero: num, pin: pin }).then(function (res) {
            medir('dacontrato (total)', t0);
            parchar(S.carpetas, res.carpetas); SEL.contrato = res.carpetas[0].id; sonar('success');
            aviso('CONTRATO ' + tres(num) + ' creado.', 'ok', 2200); pintar();
          });
        });
      });
    }).catch(function (e) { if (e && e.cancelado) return; fallo('No se pudo crear el contrato', e); });
  }

  /** ADMIN (con PIN) o DEV (sin PIN): activa o quita el permiso de PDF del contratista. */
  function permisoPdf(btn) {
    var u = usuario(SEL.uid); if (!u) return;
    var activar = !u.pdf;
    var que = (activar ? 'Permitir PDF a ' : 'Quitar el PDF a ') + u.nombre;
    raiz.Swal.fire({ icon: 'question', title: que + '?', showCancelButton: true, confirmButtonText: 'Sí', cancelButtonText: 'No',
      text: activar ? 'Podrá subir PDF (máx. ' + (S.topeMB || 10) + ' MB) en todos sus contratos, además de Word y Excel.'
                    : 'Vuelve a subir solo Word y Excel. Los PDF que ya subió se quedan y se pueden ver, editar y eliminar.' })
      .then(function (r) { if (!r.isConfirmed) throw { cancelado: true }; return pedirPin(que); })
      .then(function (pin) {
        return conBoton(btn, function (rid) {
          var t0 = performance.now();
          return post('dapdf', { rid: rid, para: u.uid, activo: activar, pin: pin }).then(function (res) {
            medir('dapdf (total)', t0, res && res._ms != null ? 'servidor ' + res._ms + ' ms' : '');
            if (res.pdf) u.pdf = true; else delete u.pdf;       /* parche en memoria, sin recargar */
            sonar('success'); aviso(res.pdf ? 'PDF permitido.' : 'PDF quitado.', 'ok', 2200); pintar();
          });
        });
      })
      .catch(function (e) { if (e && e.cancelado) return; fallo('No se pudo cambiar el permiso de PDF', e); });
  }

  function eliminar(btn, e) {
    if (!e) return;
    raiz.Swal.fire({ icon: 'warning', title: '¿Eliminar ' + e.o + '.' + e.k + '. ' + e.nm + '?', text: 'Se borra definitivamente de Drive. No se puede deshacer.',
      showCancelButton: true, confirmButtonText: 'Eliminar', cancelButtonText: 'Cancelar', confirmButtonColor: '#dc2626' })
      .then(function (r) {
        if (!r.isConfirmed) return;
        return conBoton(btn, function (rid) {
          return post('daeliminar', { rid: rid, id: e.id }).then(function () {
            var i = porId(S.evidencias, e.id); if (i >= 0) S.evidencias.splice(i, 1);
            sonar('success'); aviso('Evidencia eliminada.', 'ok', 2000); pintar();
          });
        });
      }).catch(function (er) { fallo('No se pudo eliminar', er); });
  }

  function reconfirmar(btn, e) {
    if (!e) return;
    conBoton(btn, function (rid) {
      return post('daconfirmar', { rid: rid, id: e.id }).then(function (res) { parchar(S.evidencias, [res.evidencia]); sonar('success'); pintar(); });
    }).catch(function (er) { fallo('La subida no se pudo confirmar', er); });
  }

  /* ══════════════ formulario: agregar / editar / reemplazar ══════════════ */
  var ADJ = null;
  function abrirForm(modo, ev, ctId, cuId) {
    sonar('menu');
    var ct = contrato(modo === 'editar' ? ev.ct : ctId);
    if (!ct) return;
    var cu = modo === 'editar' ? contrato(ev.cu) : (cuId ? contrato(cuId) : null);
    var nCuenta = cu ? cu.n : cuentaAbierta(ct.id).n;
    var duenio = usuario(ct.u);
    var pdf = !!(duenio && duenio.pdf);
    FORM = { modo: modo, ev: ev, contrato: ct, cuenta: (modo === 'nuevo' && cu) ? cu : null, pdf: pdf };
    $('da-f-titulo').textContent = modo === 'editar' ? 'Editar evidencia' : 'Agregar evidencia';
    $('da-f-cuenta').value = 'CONTRATO ' + tres(ct.n) + ' · CUENTA ' + nCuenta;
    var sel = $('da-f-obl');
    if (!sel.options.length) for (var i = 1; i <= (S.oblMax || 20); i++) sel.add(new Option('Obligación ' + i, String(i)));
    sel.value = modo === 'editar' ? String(ev.o) : '';
    if (modo !== 'editar') sel.selectedIndex = -1;
    $('da-f-nombre').value = modo === 'editar' ? ev.nm : '';
    $('da-f-adj-lbl').innerHTML = modo === 'editar' ? 'Reemplazar el archivo <span class="muted">(opcional: el actual se borra definitivamente)</span>' : 'Adjunto <span class="muted">(' + (pdf ? 'Word, Excel o PDF' : 'Word o Excel') + ', máx. ' + (S.topeMB || 10) + ' MB)</span>';
    $('da-f-actual').textContent = modo === 'editar' ? 'Archivo actual: ' + ev.o + '.' + ev.k + '. ' + ev.nm + '.' + ev.x : '';
    $('da-f-progreso').hidden = true;
    var zona = $('da-f-zona');
    if (ADJ) { try { ADJ.desmontar(); } catch (_) {} }
    ADJ = K.piezas && K.piezas.adjuntos ? K.piezas.adjuntos.montar(zona, {
      acepta: pdf ? ACEPTA_PDF : ACEPTA, varios: false, maximo: 1, maximoMB: S.topeMB || 10, etiqueta: 'El adjunto',
      antes: function (f) {
        if (!pdf && (/\.pdf$/i.test(f.name || '') || f.type === 'application/pdf')) return 'No se permiten PDF. Sube el Word o el Excel original.';
        return '';
      },
      alCambiar: function (l) {
        /* el nombre se propone del archivo si aún está vacío */
        if (l.length && !$('da-f-nombre').value.trim()) $('da-f-nombre').value = String(l[0].name).replace(/\.[^.]+$/, '').toUpperCase();
      }
    }) : null;
    raiz.showView('view-da-form');
    setTimeout(function () { try { sel.focus(); } catch (_) {} }, 60);
  }

  function extDe(nombre) { var m = String(nombre || '').toLowerCase().match(/\.([a-z0-9]+)$/); return m ? m[1] : ''; }

  /** PUT directo a Drive con progreso. Devuelve los metadatos que manda Drive. */
  function subirDrive(sesion, archivo, ext, alAvance) {
    return new Promise(function (ok, mal) {
      var x = new XMLHttpRequest();
      x.open('PUT', sesion, true);
      x.setRequestHeader('Content-Type', MIME[ext]);
      x.upload.onprogress = function (e) { if (e.lengthComputable && alAvance) alAvance(e.loaded / e.total); };
      x.onload = function () {
        if (x.status >= 200 && x.status < 300) { try { ok(JSON.parse(x.responseText)); } catch (_) { ok({}); } }
        else { var e = new Error('Drive no recibió el archivo (' + x.status + ').'); mal(e); }
      };
      x.onerror = function () { var e = new Error('Se cortó la conexión mientras subía el archivo.'); e.__red = true; mal(e); };
      x.send(archivo);
    });
  }
  function progreso(f, txt) {
    var p = $('da-f-progreso'); p.hidden = false;
    p.querySelector('.da-prog__barra').style.width = Math.round(f * 100) + '%';
    p.querySelector('.da-prog__txt').textContent = txt || (Math.round(f * 100) + ' %');
  }

  /* ── guardado SIN esperar: el formulario se cierra al primer toque y la fila
        muestra el avance. Lo que tarda (Apps Script + Drive) va de fondo. ── */
  var PEND = 0;
  raiz.addEventListener('beforeunload', function (e) { if (PEND > 0) { e.preventDefault(); e.returnValue = ''; } });
  function filaTemp(base, campos) { var o = {}; for (var k in base) o[k] = base[k]; for (var j in campos) o[j] = campos[j]; return o; }
  function quitarFila(id) { var i = porId(S.evidencias, id); if (i >= 0) S.evidencias.splice(i, 1); }
  function avance(id, txt) {
    var i = porId(S.evidencias, id); if (i < 0) return;
    S.evidencias[i].__txt = txt;
    var el = document.querySelector('.da-fila[data-id="' + id + '"] small');
    if (el) el.textContent = txt; else if (S) pintar();
  }

  function guardarForm(btn) {
    if (!FORM) return;
    var obl = parseInt($('da-f-obl').value, 10);
    var nombre = String($('da-f-nombre').value || '').trim().toUpperCase();
    var arch = ADJ ? ADJ.archivos()[0] : null;
    if (!(obl >= 1 && obl <= (S.oblMax || 20))) return aviso('Escoge la obligación (1 a ' + (S.oblMax || 20) + ').', 'aviso');
    if (!nombre) return aviso('Escribe el nombre del adjunto.', 'aviso');
    var pdf = !!FORM.pdf;
    if (FORM.modo === 'nuevo' && !arch) return aviso(pdf ? 'Adjunta el archivo (Word, Excel o PDF).' : 'Adjunta el archivo (Word o Excel).', 'aviso');
    var ext = arch ? extDe(arch.name) : '';
    if (arch && (pdf ? EXT_PDF : EXT_OK).indexOf(ext) === -1) {
      if (pdf) return aviso('Solo Word, Excel o PDF (.doc, .docx, .xls, .xlsx, .pdf).', 'aviso');
      return aviso(ext === 'pdf' ? 'No se permiten PDF. Sube el Word o el Excel original.' : 'Solo Word o Excel (.doc, .docx, .xls, .xlsx).', 'aviso');
    }
    if (arch && arch.size > (S.topeMB || 10) * 1048576) return aviso('El archivo pesa más de ' + (S.topeMB || 10) + ' MB.', 'aviso');
    if (btn.__daOcupado) return;
    btn.__daOcupado = true; setTimeout(function () { btn.__daOcupado = false; }, 800);

    var t0 = performance.now();
    var rid = nuevoRid();
    var modo = FORM.modo, ev0 = FORM.ev, ct = FORM.contrato, cuFija = FORM.cuenta;
    var tmpId = 'tmp-' + rid, previo = null;

    /* 1) la fila aparece YA, con el avance */
    if (modo === 'nuevo') {
      var ab = cuFija ? { fila: cuFija } : cuentaAbierta(ct.id);
      S.evidencias.push({ id: tmpId, u: ct.u, ct: ct.id, cu: ab.fila ? ab.fila.id : '__nueva__' + ct.id, o: obl, k: '…', nm: nombre, x: ext,
                          a: '', p: arch.size, s: 'SUBIENDO', __pend: true, __txt: 'Preparando la subida…' });
    } else {
      previo = filaTemp(ev0, {});
      var i0 = porId(S.evidencias, ev0.id);
      S.evidencias[i0] = filaTemp(ev0, { o: obl, nm: nombre, __pend: true, __txt: arch ? 'Preparando el reemplazo…' : 'Guardando cambios…' });
      if (obl !== ev0.o) S.evidencias[i0].k = '…';
    }
    PEND++;
    medir('guardar (lo que espera la persona)', t0);
    terminarForm(modo === 'editar' ? (arch ? 'Reemplazando el archivo…' : 'Guardando cambios…') : 'Subiendo la evidencia…', true);

    /* 2) de fondo: editar → abrir sesión → bytes a Drive → confirmar */
    var idReal = modo === 'editar' ? ev0.id : tmpId;
    var paso = Promise.resolve();
    if (modo === 'editar' && (obl !== ev0.o || nombre !== ev0.nm)) {
      paso = paso.then(function () {
        return post('daeditar', { rid: rid + '-e', id: ev0.id, obligacion: obl, nombre: nombre }).then(function (r) {
          parchar(S.evidencias, [filaTemp(r.evidencia, arch ? { __pend: true, __txt: 'Preparando el reemplazo…' } : {})]); pintar();
        });
      });
    }
    paso.then(function () {
      if (!arch) return null;
      var cuerpo = modo === 'editar'
        ? { rid: rid, reemplaza: ev0.id, ext: ext, peso: arch.size }
        : { rid: rid, contrato: ct.id, cuenta: cuFija ? cuFija.id : '', obligacion: obl, nombre: nombre, ext: ext, peso: arch.size };
      var t1 = performance.now();
      return post('dasubida', cuerpo).then(function (s) {
        medir('dasubida', t1);
        parchar(S.carpetas, [s.cuenta]);
        if (modo === 'nuevo') { quitarFila(tmpId); idReal = s.evidencia.id; }
        parchar(S.evidencias, [filaTemp(s.evidencia, { __pend: true, __txt: 'Subiendo a Drive… 0 %' })]);
        pintar();
        var t2 = performance.now();
        return subirDrive(s.sesion, arch, ext, function (f) { avance(idReal, 'Subiendo a Drive… ' + Math.round(f * 100) + ' %'); })
          .then(function (meta) {
            medir('PUT Drive', t2, peso(arch.size));
            var ev = filaTemp(s.evidencia, { s: 'ACTIVO', a: meta.id || s.evidencia.a, x: ext, p: arch.size });
            parchar(S.evidencias, [ev]); pintar();
            var t3 = performance.now();
            /* la confirmación al servidor: si falla, queda el botón de confirmar (el archivo no se pierde) */
            return post('daconfirmar', { rid: rid + '-c', id: s.evidencia.id, archivo: meta.id || '' }).then(function (c) {
              medir('daconfirmar', t3); parchar(S.evidencias, [c.evidencia]);
            }, function (e) {
              parchar(S.evidencias, [filaTemp(ev, { s: 'SUBIENDO' })]);
              aviso('El archivo subió, pero falta confirmarlo: toca el botón de confirmar en la fila.', 'aviso', 6000);
            });
          });
      });
    }).then(function () {
      PEND--; medir('guardar (total de fondo)', t0, arch ? peso(arch.size) : '');
      sonar('success');
      var e = evi(idReal);
      aviso(modo === 'editar' ? (arch ? 'Archivo reemplazado.' : 'Evidencia actualizada.') : 'Evidencia ' + (e ? e.o + '.' + e.k + '.' : '') + ' guardada.', 'ok', 2200);
      if (S) pintar();
    }, function (e) {
      PEND--;
      /* nada quedó a medias en la pantalla: se deshace lo que se mostró */
      if (modo === 'nuevo') { quitarFila(tmpId); if (idReal !== tmpId) { var sr = evi(idReal); if (sr) { delete sr.__pend; delete sr.__txt; } } }
      else {
        /* si el cambio de nombre/obligación ya quedó, se deja; si no, vuelve a como estaba */
        var ac = evi(previo.id);
        if (ac && ac.__pend) { if (ac.k === '…' || ac.nm !== previo.nm) parchar(S.evidencias, [previo]); else { delete ac.__pend; delete ac.__txt; } }
      }
      if (S) pintar();
      fallo(modo === 'editar' ? 'No se pudo guardar el cambio' : 'No se pudo subir «' + nombre + '»', e);
    });
  }
  function terminarForm(msg, silencio) {
    if (!silencio) sonar('success');
    aviso(msg, silencio ? 'info' : 'ok', 2000);
    FORM = null; if (ADJ) { try { ADJ.limpiar(); } catch (_) {} }
    raiz.showView('view-drive-anexos'); pintar();
  }

  /* ══════════════ correo (vista de siempre) ══════════════ */
  function correo(u) {
    if (S.modo === 'PRUEBA') return aviso('En modo PRUEBA el correo no se cambia (tocaría la hoja real).', 'aviso', 4000);
    if (!u.rowIndex || !u.carpeta) return aviso('No se encontró la fila o la carpeta de este usuario.', 'aviso');
    try { raiz.__daEditarCorreo({ rowIndex: u.rowIndex, nombre: u.nombre, correo: u.correo, enlace: 'https://drive.google.com/drive/folders/' + u.carpeta, __uid: u.uid }); } catch (_) {}
  }
  /** Lo llama app.js tras guardar el correo: se parcha en memoria. */
  function correoNuevo(uid, nuevo) {
    var u = S && usuario(uid); if (!u) return false;
    u.correo = nuevo; raiz.showView('view-drive-anexos'); pintar(); return true;
  }

  /* ══════════════ DEV: arranque y siembra ══════════════ */
  function sembrar(btn) {
    conBoton(btn, function (rid) {
      return post('dasembrar', { rid: rid }).then(function (r) { aviso('Sembrado: ' + (r.hechos || []).join(', '), 'ok', 4000); });
    }).catch(function (e) { fallo('No se pudo sembrar', e); });
  }
  function arranque(btn) {
    var t0 = performance.now();
    raiz.apiGet('daarranque', {}).then(function (v) {
      medir('daarranque (vista)', t0);
      var filas = (v.quitar || []).map(function (q, i) {
        return '<label class="da-arr__q"><input type="checkbox" data-k="' + esc(q.clave) + '"' + (q.madre ? '' : ' checked') + '> ' +
          '<span><b>' + esc(q.correo) + '</b> · ' + esc(q.rol) + '<br><small>' + esc(q.nombre) + '</small></span></label>';
      }).join('');
      var cuentas = 0, contratos = 0;
      (v.usuarios || []).forEach(function (u) { contratos += u.contratos.length; u.contratos.forEach(function (c) { cuentas += c.cuentas.length; }); });
      return raiz.Swal.fire({
        title: 'Arranque' + (v.modo === 'PRUEBA' ? ' (PRUEBA)' : ''), width: 720, showCancelButton: true,
        confirmButtonText: 'Ejecutar arranque', cancelButtonText: 'Cerrar',
        html: '<div class="da-arr"><p>' + (v.usuarios || []).length + ' contratistas · ' + contratos + ' contratos (quedan ABIERTOS) · ' + cuentas + ' cuentas (quedan APROBADAS).</p>' +
          '<p><b>Permisos que se quitarían</b> (desmarca lo que no):</p><div class="da-arr__lista">' + (filas || '<p>Ninguno.</p>') + '</div></div>',
        preConfirm: function () {
          return [].map.call(document.querySelectorAll('.da-arr__q input:checked'), function (i) { return i.dataset.k; });
        }
      });
    }).then(function (r) {
      if (!r || !r.isConfirmed) return;
      return conBoton(btn, function (rid) {
        return post('daarranque', { rid: rid, quitar: r.value }).then(function (res) {
          raiz.Swal.fire({ icon: res.errores && res.errores.length ? 'warning' : 'success', title: 'Arranque hecho',
            html: res.registradas + ' carpetas registradas · ' + res.permisosQuitados + ' permisos quitados · modo ' + res.modo +
              (res.errores && res.errores.length ? '<br><small>' + res.errores.map(esc).join('<br>') + '</small>' : '') });
          S = null; return abrir();
        });
      });
    }).catch(function (e) { if (e && e.message === '__HAC_CANCELADA__') return; fallo('Arranque', e); });
  }

  /* ══════════════ enganches ══════════════ */
  raiz.addEventListener('DOMContentLoaded', enganchar);
  if (document.readyState !== 'loading') enganchar();
  var enganchado = false;
  function enganchar() {
    if (enganchado) return; enganchado = true;
    var g = $('da-f-guardar'); if (g) g.addEventListener('click', function () { guardarForm(g); });
    var at = $('da-f-atras'); if (at) at.addEventListener('click', function () { sonar('back'); FORM = null; raiz.showView('view-drive-anexos'); });
    var f = $('drive-filter'); if (f) f.addEventListener('input', function () { if (S && S.yo.admin && !SEL.uid) filtrarAdmin(); });
    var n = $('da-f-nombre'); if (n) n.addEventListener('input', function () { var p = n.selectionStart; n.value = n.value.toUpperCase(); try { n.setSelectionRange(p, p); } catch (_) {} });
  }
  /* la sesión cambia: lo de memoria era de otra persona */
  raiz.addEventListener('hac:sesionVencida', function () { S = null; SEL = { uid: '', contrato: '' }; });

  raiz.DA = { abrir: abrir, correoNuevo: correoNuevo, estado: function () { return S; }, medidas: function () { return MED.slice(); }, olvidar: function () { S = null; } };
})(window);
