/* ============================================================
   ASISTENTE — LOTE 13/08/2026 · SEC-HACIENDA

   Qué hace
     Una sola regla para el campo ASISTENTE en los dos formularios
     (AGREGAR/EDITAR ASIGNACIÓN y AGREGAR/EDITAR EXPEDIENTE):

       · ADMIN y DEV        → ponen, cambian y quitan.
       · El abogado del caso → solo puede PONER un asistente cuando
         (asignado / sustanciador)  el caso todavía no tiene. Una vez
                              guardado, no lo cambia ni lo quita.
       · Cualquier otro     → el campo queda bloqueado.

     DIEGO GARCIA es ABOGADO y ADMIN a la vez: manda su ADMIN, así que
     para él nunca se bloquea nada.

   Dónde se decide de verdad
     En el servidor (ASG_reglaAsistente_ en Asignador.gs). Aquí solo se
     bloquea el campo y se explica por qué, para que nadie pierda el
     tiempo eligiendo algo que se va a rechazar. Por eso este archivo
     también le agrega el `uid` a los guardados: sin él, el servidor no
     sabe quién está escribiendo.

   Además arregla un olvido viejo
     El asistente que se elegía en el formulario de expediente predial
     NUNCA se enviaba (app.js no lo metía en el payload), ni al crear ni
     al editar: se elegía y se perdía. Aquí se manda.

   LOTE 06/09/2026 — dos cosas más, las dos de BD Predial:
     · El rol ASISTENTE deja de trabajar por caso: ve y edita CUALQUIER
       expediente. Aquí solo se pinta; el permiso lo vuelve a comprobar el
       servidor en cada guardado.
       LOTE 08/09: y ya no solo los REPARTIDOS — también los que están en
       NINGUNO. Lo estructural (dirección, matrícula, ficha, No. Exp.
       Físico y sustanciador) sigue bloqueado para él.
     · Los campos estructurales (dirección, matrícula, FICHA CATASTRAL,
       NÚMERO DE EXPEDIENTE y sustanciador) siguen bloqueados para él,
       igual que hasta hoy.
     · El campo ASISTENTE del formulario predial queda bloqueado para
       todos menos ADMIN/DEV, mientras se revierte la medida de asignar
       asistente por expediente. Para devolverlo a como estaba, basta
       con quitar `PREDIAL_BLOQUEADO`.

   No modifica app.js: se carga después y envuelve lo que app.js expone.
   ============================================================ */
(function () {
  'use strict';

  if (window.__HACASIS_LISTO) return;
  window.__HACASIS_LISTO = true;

  /* ══════════════ utilidades ══════════════ */

  function norm(s) {
    return String(s == null ? '' : s)
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
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

  function alc() { return window.ALC || null; }

  function miNombre() {
    var a = alc();
    if (a && a.nombre) return a.nombre;
    try { return (window.currentUser && window.currentUser.nombre) || ''; } catch (_) { return ''; }
  }

  function tieneRol(rol) {
    var a = alc();
    return !!(a && a.roles && a.roles.indexOf(rol) !== -1);
  }

  /* ADMIN o DEV. Se pregunta por el alcance del servidor, no por listas. */
  function manda() {
    var a = alc();
    if (a && typeof a.isSuper === 'boolean') return a.isSuper;
    return tieneRol('ADMIN') || tieneRol('DEV');
  }

  /**
   * La misma regla del servidor, para pintar el formulario.
   * `dueno` = SUSTANCIADOR (predial) o ASIGNADO (procesos) de la fila.
   * Devuelve { puede, motivo }.
   */
  function regla(dueno, asistenteActual) {
    if (manda()) return { puede: true, motivo: '' };

    var soyDueno = !!norm(dueno) && norm(miNombre()) === norm(dueno);

    if (!tieneRol('ABOGADO') || !soyDueno) {
      return { puede: false, motivo: 'Solo un administrador puede asignar el asistente.' };
    }
    if (norm(asistenteActual)) {
      return {
        puede: false,
        motivo: 'Este caso ya tiene asistente. Para cambiarlo, pídeselo a un administrador.'
      };
    }
    return { puede: true, motivo: '' };
  }

  /* ══════════════ LOTE 06/09 · el asistente en BD Predial ══════════════ */

  /* Mientras se revierte la medida del asistente por expediente, el campo
     ASISTENTE del formulario predial no lo toca nadie más que ADMIN/DEV.
     Poner en false para volver a la regla del 13/08. */
  var PREDIAL_BLOQUEADO = true;

  /** ¿Esta persona entra a PREDIAL por tener el rol ASISTENTE?
   *  Lo decide el servidor (alcance.predialAsistente); el rol es solo el
   *  respaldo por si llega un alcance viejo del caché. */
  function asistenteGlobal() {
    var a = alc();
    if (a && a.alcance && typeof a.alcance.predialAsistente === 'boolean') {
      return a.alcance.predialAsistente;
    }
    return !manda() && tieneRol('ASISTENTE');
  }

  /* LOTE 08/09 — se quitó `repartido(row)`: el asistente ya no distingue
     entre expediente repartido y sin repartir. Quién ve qué lo decide el
     servidor (PRED_visible_ en Código.gs); aquí solo se pinta. */

  /* El asistente pasa a ser "dueño" de cualquier expediente que vea.
     Con envolver ESTA función basta: app.js la usa para decidir el botón
     de editar de la tarjeta, para abrir el formulario, para mostrar los
     campos extendidos, para bloquear los estructurales y para permitir el
     guardado. Un solo sitio, sin tocar app.js. */
  function engancharPredial() {
    var original = window.esSustanciadorOAsistenteDePredial_;
    if (typeof original !== 'function' || original.__asis) return;
    var envuelta = function (row) {
      if (original.call(this, row)) return true;
      return !!(row && asistenteGlobal());
    };
    envuelta.__asis = true;
    window.esSustanciadorOAsistenteDePredial_ = envuelta;
  }

  /* ══════════════ pintar el campo ══════════════ */

  function aviso(sel, texto) {
    var id = sel.id + '-nota';
    var n = document.getElementById(id);
    if (!texto) { if (n) n.remove(); return; }
    if (!n) {
      n = document.createElement('p');
      n.id = id;
      n.className = 'muted';
      n.style.margin = '4px 0 0';
      n.style.fontSize = '.75rem';
      sel.parentNode.insertBefore(n, sel.nextSibling);
    }
    n.textContent = texto;
  }

  function aplicar(idSelect, dueno, asistenteActual) {
    var sel = document.getElementById(idSelect);
    if (!sel) return;

    var r = regla(dueno, asistenteActual);
    sel.disabled = !r.puede;
    sel.style.background = r.puede ? '' : 'rgba(6,64,43,.04)';
    sel.style.cursor     = r.puede ? '' : 'not-allowed';
    aviso(sel, r.motivo);
  }

  /* LOTE 06/09 — en el formulario predial el campo queda bloqueado para
     todos menos ADMIN/DEV. Se explica por qué, para que el abogado no crea
     que es un error. */
  function aplicarPredial(dueno, asistenteActual) {
    var sel = document.getElementById('bdp-asistente');
    if (!sel) return;
    if (PREDIAL_BLOQUEADO && !manda()) {
      sel.disabled = true;
      sel.style.background = 'rgba(6,64,43,.04)';
      sel.style.cursor = 'not-allowed';
      aviso(sel, 'Por ahora el asistente no se asigna por expediente: todos los asistentes trabajan todos los expedientes.');
      return;
    }
    aplicar('bdp-asistente', dueno, asistenteActual);
  }

  /* ══════════════ enganches con los formularios ══════════════ */

  function envolver(nombre, despues) {
    var original = window[nombre];
    if (typeof original !== 'function' || original.__asis) return;
    var envuelta = function () {
      var r = original.apply(this, arguments);
      try { despues.apply(this, arguments); } catch (e) { console.warn('ASISTENTE:', e); }
      return r;
    };
    envuelta.__asis = true;
    window[nombre] = envuelta;
  }

  function engancharFormularios() {
    /* Expediente predial */
    envolver('abrirBDPAgregar_', function () {
      /* Al crear, el sustanciador se elige en el mismo formulario: la regla
         se recalcula cada vez que cambia ese select. */
      aplicarPredial(document.getElementById('bdp-sustanciador')?.value || '', '');
    });

    envolver('abrirBDPEditar_', function (row) {
      aplicarPredial((row && row.sustanciador) || '', (row && row.asistente) || '');
    });

    document.getElementById('bdp-sustanciador')?.addEventListener('change', function () {
      /* Solo mientras se está CREANDO: al editar manda el sustanciador guardado. */
      if (window.__bdpFormMode === 'edit') return;
      aplicarPredial(this.value || '', '');
    });

    /* Asignación (procesos) */
    envolver('abrirEditarAsignacion_', function (row) {
      aplicar('edit-asistente', (row && row.asignado) || '', (row && row.asistente) || '');
    });

    document.getElementById('proc-asignado')?.addEventListener('change', function () {
      aplicar('proc-asistente', this.value || '', '');
    });
  }

  /* ══════════════ los guardados ══════════════
     Se envuelve apiPost para dos cosas: mandar el uid (el servidor decide
     con él, no con el isSuper que viaja en el cuerpo) y meter el asistente
     del formulario predial, que app.js nunca envió. */

  function engancharApi() {
    var original = window.apiPost;
    if (typeof original !== 'function' || original.__asis) return;

    var envuelta = function (accion, cuerpo) {
      var a = String(accion || '').toLowerCase();
      if (a === 'editarpredial' || a === 'agregarpredial' || a === 'editarproceso') {
        cuerpo = cuerpo || {};
        if (!cuerpo.uid) {
          var u = uid();
          if (u) cuerpo.uid = u;
        }
        if ((a === 'editarpredial' || a === 'agregarpredial') && cuerpo.asistente === undefined) {
          var sel = document.getElementById('bdp-asistente');
          var vista = document.getElementById('view-bdp-form');
          /* solo si lo que se está guardando es ese formulario */
          if (sel && vista && vista.classList.contains('active')) {
            cuerpo.asistente = sel.value || '';
          }
        }
        return original.call(this, accion, cuerpo);
      }
      return original.apply(this, arguments);
    };
    envuelta.__asis = true;
    window.apiPost = envuelta;
  }

  function arrancar() {
    engancharFormularios();
    engancharApi();
    engancharPredial();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', arrancar);
  else arrancar();

  /* js/en-vivo.js también envuelve apiPost; si se monta después, se vuelve a
     envolver la versión suya para no quedar por fuera de la cadena. */
  setTimeout(engancharApi, 1500);

  window.ASISTENTE = {
    regla: regla,
    aplicar: aplicar,
    manda: manda,
    /* LOTE 06/09 — lo usan js/bitacora.js y las pruebas */
    asistenteGlobal: asistenteGlobal,
    /* LOTE 08/09 — `repartido` se quitó de la puerta: ya no hay tal
       distinción y nadie más lo llamaba (comprobado en el repo). */
    norm: norm,
    miNombre: miNombre
  };
})();
