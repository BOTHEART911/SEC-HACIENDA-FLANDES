/* ============================================================
   SEC-HACIENDA-FLANDES · FIN-RELOJ.js — 30/10/2026
   EJECUTADO POR FINALIZAR

   Cuando el asignado pide la finalización, la asignación queda en
   EJECUTADO POR FINALIZAR: su reloj se detiene y corre el del
   asignador (quien coordina), que tiene HAC_PUBLICO.finDias días
   hábiles (2 de fábrica) para finalizar o devolver. Si la devuelve,
   los días detenidos se le descuentan al asignado (fin_det).

   Campos que trae cada fila (backend Finalizar.gs):
     fin_sol  'dd/mm/aaaa HH:mm' de la solicitud vigente
     fin_solpor · fin_por · fin_hist (una línea por paso) · fin_det

   Esta pieza va DESPUÉS de app.js y proc-ligero.js y reemplaza, sin
   tocar su código, el cálculo del semáforo (calcSemaforo_), el grupo
   de vencimiento (procGrupoVence_) y la distribución del panel; y
   agrega la línea de tiempo al Ver de la asignación.
   Con un backend que todavía no trae fin_* todo se ve como antes.
   ============================================================ */
(function () {
  'use strict';
  var EST = 'EJECUTADO POR FINALIZAR';

  function llano(s) { return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().trim(); }
  function esPorFin(r) { return !!r && llano(r.estado) === EST; }
  function pad(n) { return ('0' + n).slice(-2); }
  function dmy(s) {
    var m = String(s || '').match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    return m ? pad(m[1]) + '/' + pad(m[2]) + '/' + m[3] : '';
  }
  function hora(s) { var m = String(s || '').match(/(\d{1,2}):(\d{2})/); return m ? pad(m[1]) + ':' + m[2] : ''; }
  function hoy() { return formatDDMMYYYY_(new Date()); }
  function plazo() {
    var n = 0;
    try { n = Number(window.HAC_PUBLICO && window.HAC_PUBLICO.finDias); } catch (e) {}
    return n > 0 ? n : 2;
  }
  function esHabil(d) { var w = d.getDay(); return w !== 0 && w !== 6 && !(typeof esFestivo_ === 'function' && esFestivo_(d)); }
  /** n días hábiles después de 'dd/mm/aaaa' */
  function masHabiles(s, n) {
    var d = parseDDMMYYYYtoDate_(dmy(s));
    if (!d) return '';
    var k = Number(n) || 0;
    while (k > 0) { d.setDate(d.getDate() + 1); if (esHabil(d)) k--; }
    return formatDDMMYYYY_(d);
  }
  /** días hábiles corridos entre dos fechas (mismo día = 0) */
  function entre(a, b) {
    a = dmy(a); b = dmy(b);
    if (!a || !b) return null;
    return Math.max(0, Math.abs(diasHabiles_(a, b)) - 1);
  }
  /** vencimiento del asignado: G más los días detenidos en devoluciones */
  function venceAsignado(r) {
    var det = Number(String((r && r.fin_det) || '0').replace(/[^\d]/g, '')) || 0;
    return det ? masHabiles(r.respuesta, det) : r.respuesta;
  }
  function venceAsignador(r) { var s = dmy(r && r.fin_sol); return s ? masHabiles(s, plazo()) : ''; }
  function copia(r, cambios) { var o = {}; for (var k in r) o[k] = r[k]; for (var c in cambios) o[c] = cambios[c]; return o; }
  function dias(n) { return n + (n === 1 ? ' día hábil' : ' días hábiles'); }

  /* ── 1 · semáforo de la tarjeta ───────────────────────── */
  var semOrig = window.calcSemaforo_;
  if (typeof semOrig === 'function' && !semOrig.__fin) {
    var sem = function (row) {
      if (!row) return semOrig.apply(this, arguments);
      if (esPorFin(row)) {
        var v = venceAsignador(row);
        if (!v) return { clase: 'semaforo-morado', cardClass: 'color-morado', texto: 'Por finalizar' };
        var s = semOrig(copia(row, { estado: 'ASIGNADO', recibido: dmy(row.fin_sol), respuesta: v }));
        return { clase: 'semaforo-morado', cardClass: 'color-morado', texto: 'Por finalizar · ' + String(s.texto || '').replace(/^./, function (c) { return c.toLowerCase(); }), asignador: s.clase };
      }
      if (llano(row.estado) === 'FINALIZADO' && dmy(row.fin_sol) && row.recibido) {
        var d = Math.abs(diasHabiles_(row.recibido, dmy(row.fin_sol)));
        return { clase: 'semaforo-gris', texto: 'Resp. en ' + d + ' días', cardClass: 'color-gris' };
      }
      if (row.fin_det && Number(row.fin_det) > 0 && row.respuesta) return semOrig(copia(row, { respuesta: venceAsignado(row) }));
      return semOrig.apply(this, arguments);
    };
    sem.__fin = true;
    window.calcSemaforo_ = sem;
  }

  /* ── 2 · grupo de vencimiento y filtro ────────────────── */
  var grupoOrig = window.procGrupoVence_;
  if (typeof grupoOrig === 'function' && !grupoOrig.__fin) {
    var grupo = function (row) {
      if (esPorFin(row)) return 'PORFIN';
      if (row && row.fin_det && Number(row.fin_det) > 0 && row.respuesta) return grupoOrig(copia(row, { respuesta: venceAsignado(row) }));
      return grupoOrig.apply(this, arguments);
    };
    grupo.__fin = true;
    window.procGrupoVence_ = grupo;
  }
  try {
    if (Array.isArray(PROC_VENCE) && !PROC_VENCE.some(function (x) { return x.id === 'PORFIN'; })) {
      PROC_VENCE.push({ id: 'PORFIN', etiqueta: 'Por finalizar (asignador)' });
    }
  } catch (e) {}

  /* ── 3 · distribución del panel (con su tarjeta morada) ── */
  window.panelSemaforoDistrib_ = function (rows) {
    var d = { verde: 0, naranja: 0, rojo: 0, 'rojo-claro': 0, gris: 0, morado: 0 };
    (rows || []).forEach(function (r) {
      var c = String(window.calcSemaforo_(r).clase || '').replace('semaforo-', '');
      if (d[c] !== undefined) d[c]++; else d.gris++;
    });
    return d;
  };

  /* ── 4 · línea de tiempo del Ver ──────────────────────── */
  function pasos(row) {
    var out = [];
    String(row.fin_hist || '').split(/\r?\n/).forEach(function (l) {
      var p = l.split('·').map(function (x) { return x.trim(); });
      if (p.length < 3) return;
      var tipo = llano(p[1]);
      if (['SOLICITUD', 'DEVUELTA', 'FINALIZADA'].indexOf(tipo) < 0) return;
      out.push({ fecha: dmy(p[0]), hora: hora(p[0]), tipo: tipo, quien: p[2], extra: p.slice(3).join(' · ') });
    });
    return out;
  }
  function esc(s) { try { return escapeHtml_(String(s == null ? '' : s)); } catch (e) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }); } }

  function lineaHTML(row) {
    var P = pasos(row);
    var fin = llano(row.estado) === 'FINALIZADO';
    var cierre = dmy(row.cierre);
    /* finalizada sin historial (antes del 30/10 o sin solicitud registrada) */
    if (!P.length && fin && cierre) P.push({ fecha: cierre, hora: '', tipo: 'FINALIZADA', quien: row.fin_por || '', extra: '' });
    if (!P.length && !esPorFin(row)) return '';
    var items = [];
    var rec = dmy(row.recibido), venceA = dmy(venceAsignado(row));
    items.push({ cls: 'asig', titulo: 'Asignación', fecha: rec, quien: row.asignado || '',
      nota: venceA ? 'Vence ' + venceA + (Number(row.fin_det) > 0 ? ' (con ' + dias(Number(row.fin_det)) + ' detenidos)' : '') : '' });
    var desde = rec, desdeTipo = 'ASIG';
    P.forEach(function (p) {
      var tramo = entre(desde, p.fecha);
      var de = (desdeTipo === 'SOLICITUD') ? 'asignador' : 'asignado';
      var it = { fecha: p.fecha, hora: p.hora, quien: p.quien, tramo: tramo, de: de };
      if (p.tipo === 'SOLICITUD') {
        it.cls = 'sol'; it.titulo = 'Solicitud de finalización';
        if (venceA && tramo !== null) it.ok = parseDDMMYYYYtoDate_(p.fecha) <= parseDDMMYYYYtoDate_(venceA);
      } else if (p.tipo === 'DEVUELTA') {
        it.cls = 'dev'; it.titulo = 'Devuelta al asignado'; it.nota = p.extra.replace(/^.*?detenidos?\s*·\s*/i, '');
      } else {
        it.cls = 'fin'; it.titulo = 'Finalización';
        if (desdeTipo === 'SOLICITUD' && tramo !== null) it.ok = tramo <= plazo();
      }
      items.push(it);
      desde = p.fecha; desdeTipo = p.tipo;
    });
    if (esPorFin(row)) {
      var v = venceAsignador(row);
      items.push({ cls: 'espera', titulo: 'Esperando finalización', fecha: '', quien: row.coordinador || '',
        nota: v ? 'Reloj del asignador: vence ' + v : 'Reloj del asignador corriendo', tramo: entre(desde, hoy()), de: 'asignador', abierto: true });
    }
    return '<div class="fin-linea" role="list" aria-label="Línea de tiempo de la asignación">' +
      '<div class="fin-linea__tit">Línea de tiempo</div>' +
      items.map(function (it) {
        var tramo = (it.tramo === null || it.tramo === undefined) ? '' :
          '<span class="fin-tramo">' + dias(it.tramo) + ' · ' + (it.de === 'asignador' ? 'asignador' : 'asignado') + (it.abierto ? ' (corriendo)' : '') + '</span>';
        var sello = (it.ok === true) ? '<span class="fin-sello ok">a tiempo</span>' : (it.ok === false ? '<span class="fin-sello tarde">fuera de plazo</span>' : '');
        return '<div class="fin-paso fin-paso--' + it.cls + '" role="listitem">' +
          '<span class="fin-punto" aria-hidden="true"></span>' +
          '<div class="fin-cuerpo">' +
            '<div class="fin-cab"><b>' + esc(it.titulo) + '</b>' + sello + '</div>' +
            '<div class="fin-meta">' + esc([it.fecha, it.hora].filter(Boolean).join(' ')) + (it.quien ? ' · ' + esc(it.quien) : '') + '</div>' +
            (tramo ? '<div class="fin-meta">' + tramo + '</div>' : '') +
            (it.nota ? '<div class="fin-nota">' + esc(it.nota) + '</div>' : '') +
          '</div></div>';
      }).join('') + '</div>';
  }

  function ponerLinea(row) {
    var body = document.getElementById('proc-ver-body');
    if (!body || !row) return;
    var viejo = body.querySelector('.fin-linea');
    if (viejo) viejo.remove();
    var html = lineaHTML(row);
    if (!html) return;
    var tmp = document.createElement('div');
    tmp.innerHTML = html;
    body.insertBefore(tmp.firstChild, body.firstChild);
  }

  function envolverVer() {
    var ver = window.abrirVerAsignacion_;
    if (typeof ver !== 'function' || ver.__fin) return;
    var nv = function (row) {
      var r = ver.apply(this, arguments);
      try { ponerLinea(row); } catch (e) {}
      return r;
    };
    nv.__fin = true; nv.__procLig = ver.__procLig; nv.__bxp = ver.__bxp;
    window.abrirVerAsignacion_ = nv;
  }
  envolverVer();

  /* ── 5 · al pedir la finalización, la fila cambia en memoria ── */
  function aplicarRespuesta(row, res) {
    if (!row || !res) return;
    if (res.proc && res.proc.fila && res.proc.fila.id_proceso) {
      for (var k in res.proc.fila) row[k] = res.proc.fila[k];
    } else if (res.porFinalizar) {
      row.estado = EST;   /* backend sin la fila: al menos el estado */
    }
  }

  window.FINR = {
    EST: EST, esPorFin: esPorFin, venceAsignado: venceAsignado, venceAsignador: venceAsignador,
    plazo: plazo, entre: entre, aplicarRespuesta: aplicarRespuesta, lineaHTML: lineaHTML
  };
})();
