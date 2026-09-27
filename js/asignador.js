/* ============================================================
   ASIGNADOR — FASE 13 · SEC-HACIENDA

   Qué hace
     Añade un botón más a cada tarjeta de BD Predial. Abre un modal
     con dos secciones — SUSTANCIADORES (rol ABOGADO) y ASISTENTES
     (rol ASISTENTE) — donde se elige uno de una sección, o uno de
     cada una. Al guardar, el servidor escribe las columnas O/P y
     Q/R y avisa por WhatsApp a quien entra y a quien sale, con las
     plantillas de Configuración.

   Quién ve el botón
     · ADMIN y DEV → siempre, y pueden cambiar las dos secciones.
     · ABOGADO que es el sustanciador de ESA fila → solo la sección
       de asistentes (la de sustanciadores queda de solo lectura).
     · Los demás → no lo ven.
     El servidor vuelve a comprobarlo; esto es solo la puerta visual.

   No modifica app.js ni index.html: se carga después y reemplaza
   en caliente `bdpCardHTML_`, que es una declaración global.
   ============================================================ */
(function () {
  'use strict';

  if (window.__HACASG_LISTO) return;
  window.__HACASG_LISTO = true;

  var ICONO = 'img/usuarios.webp';      /* icono que ya vive en el repo */
  var EMOJI = '🧑‍⚖️';

  /* ---------- utilidades ---------- */

  function norm(s) {
    return String(s == null ? '' : s)
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toUpperCase();
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
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

  function alc() { return window.ALC || null; }

  function yo() {
    var a = alc();
    if (a && a.nombre) return norm(a.nombre);
    try {
      var p = window.IDN && window.IDN.perfil ? window.IDN.perfil() : null;
      if (p && p.nombre) return norm(p.nombre);
    } catch (_) {}
    return '';
  }

  function tieneRol(rol) {
    var a = alc();
    return !!(a && a.roles && a.roles.indexOf(rol) !== -1);
  }

  function mando() { return tieneRol('ADMIN') || tieneRol('DEV'); }

  /* Nombres de un catálogo del alcance (llegan como {nombre,telefono} o texto) */
  function catalogo(clave) {
    var a = alc();
    var lista = (a && a.catalogos && a.catalogos[clave]) || [];
    var out = [];
    for (var i = 0; i < lista.length; i++) {
      var it = lista[i];
      var nombre = (it && typeof it === 'object') ? (it.nombre || it.NOMBRE || '') : it;
      nombre = norm(nombre);
      if (nombre && out.indexOf(nombre) === -1) out.push(nombre);
    }
    out.sort();
    return out;
  }

  /* ¿Este usuario puede tocar esta fila? */
  function puedeAsignar(row) {
    if (!alc()) return false;                 /* sin alcance no se arriesga nada */
    if (mando()) return true;
    var mio = yo();
    var suyo = !!(tieneRol('ABOGADO') && mio && norm(row && row.sustanciador) === mio);
    /* LOTE 13/08 — el abogado dueño solo entra si el expediente TODAVÍA no
       tiene asistente: poner el primero sí, cambiarlo o quitarlo no. Esa es
       la misma regla del formulario y la que aplica el servidor. */
    return suyo && !norm(row && row.asistente);
  }

  /* ---------- 1) el botón en la tarjeta ---------- */

  function botonHTML(row) {
    /* data-salida: la capa 12 no le pone candado. Abrir el modal no pide
       red, y sin esto el 2.º toque se lo traga el escudo (mismo caso que
       el FAB de la capa 11 en la Fase 11). El botón Guardar del modal se
       protege por su cuenta: se apaga mientras se guarda. */
    return '<button type="button" class="bdp-icon-btn asg-btn" data-salida data-bdp-act="asignador"' +
      ' title="Asignador (sustanciador / asistente)"' +
      ' data-asg-id="' + esc(row.id_predial || '') + '"' +
      ' data-asg-sust="' + esc(row.sustanciador || '') + '"' +
      ' data-asg-asist="' + esc(row.asistente || '') + '"' +
      ' data-asg-exp="' + esc(row.no_exp_fisico || '') + '"' +
      ' data-asg-nom="' + esc(row.nombres || '') + '">' +
      '<img src="' + ICONO + '" alt="Asignador" onerror="this.replaceWith(document.createTextNode(\'' + EMOJI + '\'))">' +
      '</button>';
  }

  function montarTarjeta() {
    var original = window.bdpCardHTML_;
    if (typeof original !== 'function' || original.__asg) return false;
    var envuelta = function (row, idx, puedeEliminar, puedeDecision) {
      var html = original.apply(this, arguments);
      try {
        if (!row || !puedeAsignar(row)) return html;
        /* El botón entra al FINAL de la fila de acciones de la tarjeta.
           Dentro de .bdp-actions solo hay <button>, así que el primer
           </div> después del ancla es el cierre de ese bloque. */
        var ancla = '<div class="bdp-actions">';
        var i = html.indexOf(ancla);
        if (i === -1) return html;
        var fin = html.indexOf('</div>', i + ancla.length);
        if (fin === -1) return html;
        return html.slice(0, fin) + botonHTML(row) + html.slice(fin);
      } catch (_) { return html; }
    };
    envuelta.__asg = true;
    window.bdpCardHTML_ = envuelta;
    return true;
  }

  /* ---------- 2) el modal ---------- */

  var hoja = null;
  var datos = null;    /* {id, sustActual, asistActual, exp, nombre} */
  var elegido = { sust: null, asist: null };

  function cerrar() {
    if (!hoja) return;
    hoja.classList.remove('asg-on');
    var h = hoja; hoja = null; datos = null;
    setTimeout(function () { if (h && h.parentNode) h.remove(); }, 180);
    document.removeEventListener('keydown', escTecla);
  }
  function escTecla(ev) { if (ev.key === 'Escape') cerrar(); }

  function nodo(html) {
    var d = document.createElement('div');
    d.innerHTML = html;
    return d.firstElementChild;
  }

  function chips(lista, seleccionado, grupo, bloqueado) {
    if (!lista.length) {
      return '<p class="asg-vacio">No hay usuarios con ese rol activos.</p>';
    }
    var out = '';
    for (var i = 0; i < lista.length; i++) {
      var n = lista[i];
      var on = (norm(seleccionado) === n) ? ' asg-on-chip' : '';
      out += '<button type="button" class="asg-chip' + on + '"' +
        (bloqueado ? ' disabled' : '') +
        ' data-asg-grupo="' + grupo + '" data-asg-valor="' + esc(n) + '">' +
        esc(n) + '</button>';
    }
    return out;
  }

  function abrir(row) {
    if (hoja) return;
    if (!puedeAsignar(row)) {
      var yaTiene = !mando() && !!norm(row && row.asistente);
      Swal.fire({ icon: 'warning', title: 'Sin permiso',
        text: yaTiene
          ? 'Este expediente ya tiene asistente. Para cambiarlo, pídeselo a un administrador.'
          : 'Solo un administrador o el sustanciador del expediente puede asignar.' });
      return;
    }

    datos = {
      id: row.id_predial,
      sustActual: norm(row.sustanciador),
      asistActual: norm(row.asistente),
      exp: row.no_exp_fisico || '',
      nombre: row.nombres || ''
    };
    elegido = { sust: null, asist: null };

    var soloAsist = !mando();
    var sustanciadores = catalogo('sustanciadores');
    var asistentes = catalogo('asistentesPred');

    hoja = nodo(
      '<div class="asg-wrap" data-salida role="dialog" aria-modal="true" aria-label="Asignador">' +
      '  <div class="asg-fondo"></div>' +
      '  <section class="asg-hoja">' +
      '    <header class="asg-h">' +
      '      <div class="asg-h-tx"><b>ASIGNADOR</b>' +
      '        <small>' + esc(datos.nombre) + (datos.exp ? ' · Exp. ' + esc(datos.exp) : '') + '</small></div>' +
      '      <button class="asg-x" type="button" aria-label="Cerrar">✕</button>' +
      '    </header>' +
      '    <div class="asg-body">' +
      '      <div class="asg-sec">' +
      '        <div class="asg-sec-t">⚖️ Sustanciadores' +
      (soloAsist ? '<span class="asg-lock">solo lectura</span>' : '') + '</div>' +
      '        <div class="asg-actual">Hoy: <b>' + esc(datos.sustActual || 'NINGUNO') + '</b></div>' +
      '        <div class="asg-chips">' + chips(sustanciadores, datos.sustActual, 'sust', soloAsist) + '</div>' +
      '      </div>' +
      '      <div class="asg-sec">' +
      '        <div class="asg-sec-t">🤝 Asistentes</div>' +
      '        <div class="asg-actual">Hoy: <b>' + esc(datos.asistActual || 'SIN ASISTENTE') + '</b></div>' +
      '        <div class="asg-chips">' + chips(asistentes, datos.asistActual, 'asist', false) +
      /* LOTE 13/08 — quitar el asistente es cosa de ADMIN/DEV */
      ((datos.asistActual && !soloAsist) ? '<button type="button" class="asg-chip asg-quitar" data-asg-grupo="asist" data-asg-valor="">— Quitar asistente —</button>' : '') +
      '        </div>' +
      '      </div>' +
      '      <p class="asg-nota">Se avisa por WhatsApp a quien entra y a quien sale. ' +
      'Puedes cambiar una sección o las dos.</p>' +
      '    </div>' +
      '    <footer class="asg-pie">' +
      '      <button type="button" class="asg-ok" disabled>Guardar</button>' +
      '      <button type="button" class="asg-cancel">Cancelar</button>' +
      '    </footer>' +
      '  </section>' +
      '</div>'
    );

    document.body.appendChild(hoja);
    requestAnimationFrame(function () { hoja.classList.add('asg-on'); });

    hoja.querySelector('.asg-x').addEventListener('click', cerrar);
    hoja.querySelector('.asg-cancel').addEventListener('click', cerrar);
    hoja.querySelector('.asg-fondo').addEventListener('click', cerrar);
    document.addEventListener('keydown', escTecla);

    hoja.addEventListener('click', function (ev) {
      var chip = ev.target.closest ? ev.target.closest('[data-asg-grupo]') : null;
      if (!chip || chip.disabled) return;
      var grupo = chip.dataset.asgGrupo;
      var valor = chip.dataset.asgValor || '';
      var hermanos = hoja.querySelectorAll('[data-asg-grupo="' + grupo + '"]');
      for (var i = 0; i < hermanos.length; i++) hermanos[i].classList.remove('asg-on-chip');
      /* Tocar el que ya estaba elegido lo suelta */
      if (elegido[grupo] === valor) { elegido[grupo] = null; }
      else { elegido[grupo] = valor; chip.classList.add('asg-on-chip'); }
      refrescar();
    });

    hoja.querySelector('.asg-ok').addEventListener('click', guardar);
    refrescar();
  }

  /* Hay algo que guardar cuando al menos una sección cambia de verdad */
  function hayCambio() {
    if (!datos) return false;
    var s = elegido.sust, a = elegido.asist;
    var cambiaS = (s !== null && norm(s) !== datos.sustActual);
    var cambiaA = (a !== null && norm(a) !== datos.asistActual);
    return cambiaS || cambiaA;
  }

  function refrescar() {
    if (!hoja) return;
    var ok = hoja.querySelector('.asg-ok');
    if (ok) ok.disabled = !hayCambio();
  }

  function guardar() {
    if (!datos || !hayCambio()) return;
    var cuerpo = { uid: uid(), id_predial: datos.id };
    if (elegido.sust !== null && norm(elegido.sust) !== datos.sustActual) {
      cuerpo.sustanciador = elegido.sust;
    }
    if (elegido.asist !== null && norm(elegido.asist) !== datos.asistActual) {
      cuerpo.asistente = elegido.asist;   /* cadena vacía = quitar */
    }

    var ok = hoja.querySelector('.asg-ok');
    if (ok) { ok.disabled = true; ok.textContent = 'Guardando…'; }

    window.apiPost('asignarpredial', cuerpo).then(function (res) {
      cerrar();
      try { if (window.SOUNDS) window.playSoundOnce(window.SOUNDS.success); } catch (_) {}
      var sinTel = (res && res.avisos ? res.avisos : []).filter(function (a) { return !a.enviado; });
      Swal.fire({
        icon: 'success',
        title: 'Asignado',
        html: '<b>Sustanciador:</b> ' + esc((res && res.sustanciador) || '—') + '<br>' +
              '<b>Asistente:</b> ' + esc((res && res.asistente) || 'sin asistente') +
              (sinTel.length ? '<br><br><small>Sin WhatsApp (no tienen teléfono en USUARIOS): ' +
                esc(sinTel.map(function (a) { return a.para; }).join(', ')) + '</small>' : ''),
        timer: sinTel.length ? undefined : 1800,
        showConfirmButton: !!sinTel.length
      });
      if (typeof window.loadBDPredial_ === 'function') window.loadBDPredial_();
    }).catch(function (err) {
      if (ok) { ok.disabled = false; ok.textContent = 'Guardar'; }
      Swal.fire({ icon: 'error', title: 'No se pudo asignar', text: String((err && err.message) || err) });
    });
  }

  /* ---------- 3) enganche del clic ---------- */

  function montarClic() {
    var lista = document.getElementById('bdp-list');
    if (!lista || lista.__asg) return false;
    lista.__asg = true;
    lista.addEventListener('click', function (ev) {
      var btn = ev.target.closest ? ev.target.closest('[data-bdp-act="asignador"]') : null;
      if (!btn) return;
      ev.preventDefault();
      ev.stopPropagation();
      try { if (window.SOUNDS) window.playSoundOnce(window.SOUNDS.menu); } catch (_) {}
      abrir({
        id_predial:    btn.dataset.asgId,
        sustanciador:  btn.dataset.asgSust,
        asistente:     btn.dataset.asgAsist,
        no_exp_fisico: btn.dataset.asgExp,
        nombres:       btn.dataset.asgNom
      });
    }, true);   /* captura: corre antes del listener de app.js */
    return true;
  }

  function montar() {
    montarTarjeta();
    montarClic();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', montar);
  } else {
    montar();
  }
  window.addEventListener('load', montar);

  /* Puerta de pruebas */
  window.__hacASG = {
    puedeAsignar: puedeAsignar,
    botonHTML: botonHTML,
    catalogo: catalogo,
    abrir: abrir,
    cerrar: cerrar,
    estado: function () { return { datos: datos, elegido: elegido, hayCambio: hayCambio() }; },
    elegir: function (grupo, valor) { elegido[grupo] = valor; refrescar(); },
    montar: montar
  };
})();
