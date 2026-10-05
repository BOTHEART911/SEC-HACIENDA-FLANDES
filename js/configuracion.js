/* ============================================================
   CONFIGURACIÓN — FASE 1
   SEC-HACIENDA · se carga DESPUÉS de app.js e identidad.js
   No modifica app.js: monta su botón y su vista por su cuenta.
   ============================================================ */
(function () {
  'use strict';

  var ROLES_INFO = {
    DEV:       'Ve todo, incluido Avanzado.',
    ADMIN:     'Ve todo menos Avanzado. Puede crear usuarios y dar roles.',
    ABOGADO:   'Sustanciador: ve y gestiona los expedientes que tiene asignados.',
    ASISTENTE: 'Apoya expedientes donde está como asistente.',
    ARCHIVO:   'Bitácora de expediente en las asignaciones.',
    ATENCION:  'Atención al ciudadano: agregar y responder solicitudes.',
    TRIBUTARIO: 'Industria y Comercio: requerimientos, envíos por correo y seguimiento.'
  };

  var estado = {
    cargado: false,
    uid: '',
    usuarios: [],
    plantillas: [],
    avanzado: [],
    esDev: false,
    pestana: 'usuarios',
    filtro: '',
    sucias: {}          // claves de plantilla/avanzado con cambios sin guardar
  };

  /* ---------- utilidades ---------- */
  function esc_(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function el_(id) { return document.getElementById(id); }
  /* FASE 2: mismo criterio que USR_carpetaId_ del backend. Acepta el ID pelado
     o cualquier forma de enlace de Drive. Devuelve '' si no reconoce nada. */
  function driveId_(valor) {
    var s = String(valor == null ? '' : valor).trim();
    if (!s) return '';
    var m = s.match(/\/folders\/([A-Za-z0-9_-]{10,})/); if (m) return m[1];
    m = s.match(/\/d\/([A-Za-z0-9_-]{10,})/);           if (m) return m[1];
    m = s.match(/[?&]id=([A-Za-z0-9_-]{10,})/);         if (m) return m[1];
    if (/^[A-Za-z0-9_-]{10,}$/.test(s)) return s;
    return '';
  }

  function uid_() { var p = window.IDN && window.IDN.perfil(); return p ? p.uid : ''; }
  function esDev_() { return !!(window.IDN && window.IDN.esDev()); }
  function esAdmin_() { return !!(window.IDN && window.IDN.esAdmin()); }
  function sonido_(cual) {
    try { if (typeof playSoundOnce === 'function' && typeof SOUNDS !== 'undefined') playSoundOnce(SOUNDS[cual]); } catch (_) {}
  }
  function aviso_(icon, title, text) {
    return Swal.fire({ icon: icon, title: title, text: text || '' });
  }
  function iniciales_(nombre) {
    var p = String(nombre || '').trim().split(/\s+/).filter(Boolean);
    if (!p.length) return '?';
    return (p[0][0] + (p.length > 1 ? p[1][0] : '')).toUpperCase();
  }

  /* ============================================================
     BOTÓN EN INICIO
     ============================================================ */
  function montarBoton_() {
    var inicio = el_('view-inicio');
    if (!inicio) return;

    var b = el_('btn-config');
    if (!b) {
      var fila = document.createElement('div');
      fila.className = 'btn-row';
      fila.style.marginTop = '10px';
      fila.innerHTML =
        '<button id="btn-config" class="btn-primary btn-icon-label cfg-btn-inicio" style="display:none;">' +
          ICOS('engranaje') + 'Configuración' +
        '</button>';

      var semaforo = el_('btn-semaforo');
      var ancla = semaforo ? semaforo.parentNode : null;
      if (ancla && ancla.parentNode) ancla.parentNode.insertBefore(fila, ancla.nextSibling);
      else inicio.querySelector('.card').appendChild(fila);

      b = el_('btn-config');
    }
    /* FASE 2 — la tarjeta ya viene en el inicio: se engancha una sola vez */
    if (b && !b.__cfg) {
      b.__cfg = true;
      b.addEventListener('click', function () {
        sonido_('click');
        abrir_();
      });
    }
    b.style.display = esAdmin_() ? '' : 'none';
  }

  function ocultarBoton_() {
    var b = el_('btn-config');
    if (b) b.style.display = 'none';
  }

  /* ============================================================
     VISTA
     ============================================================ */
  function montarVista_() {
    if (el_('view-config')) return;
    var inicio = el_('view-inicio');
    if (!inicio || !inicio.parentNode) return;

    var sec = document.createElement('section');
    sec.id = 'view-config';
    sec.className = 'view';
    sec.innerHTML =
      '<div class="vista kit-ancho cfg-card">' +
        '<p class="hf-intro" id="cfg-sub"></p>' +

        /* FASE 2 SEC-HACIENDA-FLANDES — Usuarios es de ADMIN y DEV.
           Plantillas de mensajes y los IDs (carpetas, plantillas de
           documentos, llaves) son SOLO del desarrollador. */
        '<div class="cfg-tabs panel-toolbar hf-pestanas">' +
          '<button class="cfg-tab panel-tab activa active" data-tab="usuarios">' + ICOS('equipo') + 'Usuarios y roles</button>' +
          /* 05/10/2026 — festivos editables (ADMIN y DEV): la misma lista que usa ICA */
          '<button class="cfg-tab panel-tab" data-tab="festivos">' + ICOS('calendario') + 'Festivos</button>' +
          '<button class="cfg-tab panel-tab cfg-tab-dev" data-tab="plantillas" style="display:none;">' + ICOS('chat') + 'Plantillas de mensajes</button>' +
          '<button class="cfg-tab panel-tab cfg-tab-dev" data-tab="avanzado" style="display:none;">' + ICOS('llave') + 'IDs y ajustes</button>' +
        '</div>' +

        '<div id="cfg-panel-usuarios" class="cfg-panel">' +
          '<div class="cfg-barra">' +
            '<label class="hf-buscar">' + ICO_('buscar', 18) + '<input id="cfg-buscar" type="text" placeholder="Buscar por nombre o perfil" autocomplete="off" /></label>' +
            '<button id="cfg-nuevo" class="kit-btn kit-btn--marca cfg-mini">' + ICOS('mas') + 'Nuevo usuario</button>' +
          '</div>' +
          '<div id="cfg-usuarios" class="cfg-lista"></div>' +
        '</div>' +

        '<div id="cfg-panel-festivos" class="cfg-panel hidden">' +
          '<div id="cfg-festivos"></div>' +
        '</div>' +

        '<div id="cfg-panel-plantillas" class="cfg-panel hidden">' +
          '<p class="hf-intro">Los mensajes que la app manda por WhatsApp. Toca una variable para insertarla donde tengas el cursor. Solo el desarrollador los ve y los cambia.</p>' +
          '<div id="cfg-plantillas" class="cfg-acordeon"></div>' +
        '</div>' +

        '<div id="cfg-panel-avanzado" class="cfg-panel hidden">' +
          '<p class="hf-intro cfg-alerta">' + ICOS('aviso') + 'IDs de carpetas de Drive, llaves de BuilderBot, Firebase, voz y topes. Un dato mal puesto aquí deja de funcionar el envío de mensajes o la subida de archivos.</p>' +
          '<div id="cfg-avanzado" class="cfg-campos"></div>' +
        '</div>' +

        '<button type="button" id="cfg-regresar" class="hf-atras" hidden>Regresar</button>' +
      '</div>';

    inicio.parentNode.appendChild(sec);

    sec.querySelectorAll('.cfg-tab').forEach(function (t) {
      t.addEventListener('click', function () { sonido_('click'); pestana_(t.dataset.tab); });
    });
    el_('cfg-regresar').addEventListener('click', function () {
      sonido_('back');
      if (hayCambios_()) {
        Swal.fire({
          icon: 'warning', title: 'Tienes cambios sin guardar',
          text: 'Si sales ahora se pierden.',
          showCancelButton: true, confirmButtonText: 'Salir igual', cancelButtonText: 'Seguir editando'
        }).then(function (r) { if (r.isConfirmed) { estado.sucias = {}; showView('view-inicio'); } });
        return;
      }
      showView('view-inicio');
    });
    el_('cfg-buscar').addEventListener('input', function () {
      estado.filtro = this.value || '';
      pintarUsuarios_();
    });
    el_('cfg-nuevo').addEventListener('click', function () { sonido_('click'); modalUsuario_(null); });
  }

  function hayCambios_() {
    for (var k in estado.sucias) { if (estado.sucias[k]) return true; }
    return false;
  }

  function pestana_(cual) {
    estado.pestana = cual;
    ['usuarios', 'festivos', 'plantillas', 'avanzado'].forEach(function (p) {
      var panel = el_('cfg-panel-' + p);
      if (panel) panel.classList.toggle('hidden', p !== cual);
    });
    document.querySelectorAll('.cfg-tab').forEach(function (t) {
      t.classList.toggle('activa', t.dataset.tab === cual);
      t.classList.toggle('active', t.dataset.tab === cual);
    });
  }

  /* ============================================================
     CARGA
     ============================================================ */
  async function abrir_() {
    if (!esAdmin_()) { aviso_('warning', 'Sin permiso', 'Solo ADMIN o DEV entran a Configuración.'); return; }
    montarVista_();
    showView('view-config');
    // si cambió la persona en sesión, todo se vuelve a pedir con su permiso
    if (!estado.cargado || estado.uid !== uid_()) await cargar_();
  }

  /* FASE 2 — un solo viaje: cada guardado devuelve la configuración ya
     actualizada (res.todo) y se pinta esa; solo si no vino se pide. */
  async function cargar_(yaVino) {
    try {
      var todo = (yaVino && yaVino.plantillas) ? yaVino : await apiGet('cfgtodo', { uid: uid_() });
      estado.plantillas = (todo && todo.plantillas) || [];
      estado.avanzado = (todo && todo.avanzado) || [];
      estado.esDev = !!(todo && todo.esDev);
      /* FASE 2 — un solo viaje: 'cfgtodo' ya trae la lista de usuarios. */
      estado.usuarios = (todo && Array.isArray(todo.usuarios)) ? todo.usuarios : await apiGet('cfgusuarios', { uid: uid_() });
      estado.cargado = true;
      estado.uid = uid_();
      estado.sucias = {};

      document.querySelectorAll('.cfg-tab-dev').forEach(function (t) { t.style.display = estado.esDev ? '' : 'none'; });
      if (!estado.esDev && estado.pestana !== 'usuarios' && estado.pestana !== 'festivos') pestana_('usuarios');
      FES.datos = (todo && todo.festivos) || null;
      FES.borrador = null;

      var sub = el_('cfg-sub');
      if (sub) {
        sub.textContent = estado.usuarios.length + ' usuarios' +
          (todo && todo.ultimoCambio ? ' · último cambio: ' + todo.ultimoCambio : '');
      }

      pintarUsuarios_();
      pintarFestivos_();
      pintarPlantillas_();
      pintarAvanzado_();
    } catch (e) {
      aviso_('error', 'No se pudo cargar', e.message || String(e));
    }
  }

  /* ============================================================
     USUARIOS
     ============================================================ */
  function pintarUsuarios_() {
    var cont = el_('cfg-usuarios');
    if (!cont) return;

    var f = String(estado.filtro || '').trim().toUpperCase();
    var lista = estado.usuarios.filter(function (u) {
      if (!f) return true;
      return (u.nombre || '').indexOf(f) !== -1 || (u.roles || []).join(',').indexOf(f) !== -1;
    });

    if (!lista.length) {
      cont.innerHTML = '<p class="helper center">Nadie coincide con la búsqueda.</p>';
      return;
    }

    cont.innerHTML = lista.map(function (u) {
      var chips = (u.roles || []).map(function (r) {
        return '<span class="cfg-chip cfg-rol-' + esc_(r) + '">' + esc_(r) + '</span>';
      }).join('');
      if (!chips) chips = '<span class="cfg-chip cfg-rol-vacio">SIN PERFIL</span>';

      var avisos = [];
      if (!u.documento) avisos.push('sin documento: no puede entrar');
      else if (!u.tienePin) avisos.push('sin PIN');

      return '' +
        '<div class="cfg-item' + (u.activo ? '' : ' cfg-inactivo') + '" data-uid="' + esc_(u.uid) + '">' +
          '<div class="cfg-foto">' +
            (u.foto
              ? '<img src="' + esc_(u.foto) + '" alt="" />'
              : '<span>' + esc_(iniciales_(u.nombre)) + '</span>') +
          '</div>' +
          '<div class="cfg-datos">' +
            '<div class="cfg-nombre">' + esc_(u.nombre) + (u.activo ? '' : ' <em>(inactivo)</em>') + '</div>' +
            '<div class="cfg-chips">' + chips + '</div>' +
            (avisos.length ? '<div class="cfg-aviso">' + ICOS('aviso', 14) + esc_(avisos.join(' · ')) + '</div>' : '') +
          '</div>' +
          '<button class="cfg-editar kit-btn" data-uid="' + esc_(u.uid) + '">' + ICOS('lapiz') + 'Editar</button>' +
        '</div>';
    }).join('');

    cont.querySelectorAll('.cfg-editar').forEach(function (b) {
      b.addEventListener('click', function () {
        sonido_('click');
        var u = buscarUsuario_(b.dataset.uid);
        if (u) modalUsuario_(u);
      });
    });
  }

  function buscarUsuario_(uid) {
    for (var i = 0; i < estado.usuarios.length; i++) {
      if (estado.usuarios[i].uid === uid) return estado.usuarios[i];
    }
    return null;
  }

  /* ---------- modal de usuario (crear / editar) ---------- */
  function modalUsuario_(u) {
    var nuevo = !u;
    var puedeDev = esDev_();
    var yo = (window.IDN && window.IDN.perfil()) || {};

    var roles = (u && u.roles) || [];
    var checks = ['DEV', 'ADMIN', 'ABOGADO', 'ASISTENTE', 'ARCHIVO', 'ATENCION', 'TRIBUTARIO'].map(function (r) {
      if (r === 'DEV' && !puedeDev) return '';
      return '<label class="cfg-check' + (roles.indexOf(r) !== -1 ? ' marcado' : '') + '">' +
               '<input type="checkbox" value="' + r + '"' + (roles.indexOf(r) !== -1 ? ' checked' : '') + ' />' +
               '<b>' + r + '</b><span>' + esc_(ROLES_INFO[r] || '') + '</span>' +
             '</label>';
    }).join('');

    var m = document.createElement('div');
    m.className = 'cfg-modal';
    m.innerHTML =
      '<div class="cfg-modal-caja">' +
        '<h3>' + (nuevo ? 'Nuevo usuario' : esc_(u.nombre)) + '</h3>' +
        '<label class="cfg-lbl">Nombre completo' +
          '<input id="cfgu-nombre" type="text" value="' + esc_(u ? u.nombre : '') + '" />' +
        '</label>' +
        '<label class="cfg-lbl">Documento' +
          '<input id="cfgu-doc" type="tel" inputmode="numeric" value="' + esc_(u ? u.documento : '') + '" />' +
        '</label>' +
        '<label class="cfg-lbl">Celular (WhatsApp)' +
          '<input id="cfgu-tel" type="tel" inputmode="numeric" value="' + esc_(u ? u.telefono : '') + '" />' +
        '</label>' +
        '<label class="cfg-lbl">Correo' +
          '<input id="cfgu-correo" type="email" value="' + esc_(u ? u.correo : '') + '" />' +
        '</label>' +
        '<label class="cfg-lbl">ID de Anexos Drive <span class="cfg-opt">(opcional)</span>' +
          '<input id="cfgu-anexos" type="text" placeholder="Pega el ID o el enlace de la carpeta" value="' + esc_(u ? u.carpetaAnexos : '') + '" />' +
          '<small class="cfg-ayuda" id="cfgu-anexos-eco"></small>' +
        '</label>' +
        '<label class="cfg-lbl">ID Carpeta Expedientes <span class="cfg-opt">(opcional)</span>' +
          '<input id="cfgu-exp" type="text" placeholder="Pega el ID o el enlace de la carpeta" value="' + esc_(u ? u.carpetaExpedientes : '') + '" />' +
          '<small class="cfg-ayuda" id="cfgu-exp-eco"></small>' +
        '</label>' +

        '<p class="cfg-lbl-t">Perfil</p>' +
        '<div class="cfg-checks">' + checks + '</div>' +

        (nuevo
          ? '<p class="helper">Al guardar, la app genera el PIN y se lo manda por WhatsApp con el mensaje de bienvenida.</p>'
          : '<div class="cfg-acciones-usuario">' +
              '<button id="cfgu-pin" class="kit-btn">' + ICOS('pin') + 'Generar PIN nuevo y enviarlo</button>' +
              (u.uid === yo.uid ? '' :
                '<button id="cfgu-estado" class="kit-btn' + (u.activo ? ' cfg-peligro' : '') + '">' + ICOS(u.activo ? 'prohibido' : 'check') +
                  (u.activo ? 'Desactivar usuario' : 'Activar usuario') +
                '</button>') +
            '</div>') +

        '<div class="cfg-modal-pie">' +
          '<button id="cfgu-cerrar" class="kit-btn" data-salida>Cerrar</button>' +
          '<button id="cfgu-guardar" class="kit-btn kit-btn--marca">' + ICOS('check') + 'Guardar</button>' +
        '</div>' +
      '</div>';

    document.body.appendChild(m);

    // cierra tocando por fuera
    m.addEventListener('click', function (ev) { if (ev.target === m) cerrar_(); });
    function cerrar_() { if (m.parentNode) m.parentNode.removeChild(m); }
    el_('cfgu-cerrar').addEventListener('click', function () { sonido_('back'); cerrar_(); });

    /* FASE 2: los dos campos de Drive aceptan el ID pelado O el enlace completo.
       El eco de abajo muestra qué ID se entendió, antes de guardar. */
    ['anexos', 'exp'].forEach(function (k) {
      var inp = el_('cfgu-' + k), eco = el_('cfgu-' + k + '-eco');
      if (!inp || !eco) return;
      var pintar = function () {
        var v = String(inp.value || '').trim();
        if (!v) { eco.textContent = ''; eco.className = 'cfg-ayuda'; return; }
        var id = driveId_(v);
        if (id) { eco.textContent = 'ID: ' + id; eco.className = 'cfg-ayuda ok'; }
        else { eco.textContent = 'No parece un ID ni un enlace de carpeta de Drive.'; eco.className = 'cfg-ayuda mal'; }
      };
      inp.addEventListener('input', pintar);
      pintar();
    });

    m.querySelectorAll('.cfg-check input').forEach(function (c) {
      c.addEventListener('change', function () { c.parentNode.classList.toggle('marcado', c.checked); });
    });

    function rolesElegidos_() {
      var out = [];
      m.querySelectorAll('.cfg-check input').forEach(function (c) { if (c.checked) out.push(c.value); });
      return out;
    }

    el_('cfgu-guardar').addEventListener('click', async function () {
      var datos = {
        uid: uid_(),
        nombre: el_('cfgu-nombre').value,
        documento: el_('cfgu-doc').value,
        telefono: el_('cfgu-tel').value,
        correo: el_('cfgu-correo').value,
        carpetaAnexos: el_('cfgu-anexos').value,
        carpetaExpedientes: el_('cfgu-exp').value,
        roles: rolesElegidos_()
      };
      var r = null;
      try {
        if (nuevo) {
          r = await apiPost('usuariocrear', datos);
          cerrar_();
          await Swal.fire({
            icon: 'success', title: 'Usuario creado',
            html: 'PIN: <b>' + esc_(r.pin) + '</b><br/>' +
                  (r.avisado ? 'Se le envió por WhatsApp.' : 'No tenía celular válido: entrégaselo tú.')
          });
        } else {
          datos.objetivo = u.uid;
          r = await apiPost('usuarioguardar', datos);
          cerrar_();
          await Swal.fire({ icon: 'success', title: 'Guardado', timer: 1400, showConfirmButton: false });
        }
        await cargar_(r && r.todo);
      } catch (e) {
        aviso_('error', 'No se pudo guardar', e.message || String(e));
      }
    });

    if (!nuevo) {
      el_('cfgu-pin').addEventListener('click', async function () {
        var c = await Swal.fire({
          icon: 'question', title: 'Generar PIN nuevo',
          text: 'El PIN actual deja de servir de inmediato.',
          showCancelButton: true, confirmButtonText: 'Sí, generar', cancelButtonText: 'Cancelar'
        });
        if (!c.isConfirmed) return;
        try {
          var r = await apiPost('usuariopin', { uid: uid_(), objetivo: u.uid });
          await Swal.fire({
            icon: 'success', title: 'PIN nuevo',
            html: '<b>' + esc_(r.pin) + '</b><br/>' + (r.avisado ? 'Enviado por WhatsApp.' : 'Sin celular válido: entrégaselo tú.')
          });
          await cargar_(r && r.todo);
        } catch (e) { aviso_('error', 'No se pudo', e.message || String(e)); }
      });

      var be = el_('cfgu-estado');
      if (be) be.addEventListener('click', async function () {
        var c = await Swal.fire({
          icon: 'question',
          title: u.activo ? 'Desactivar a ' + u.nombre : 'Activar a ' + u.nombre,
          text: u.activo ? 'No podrá entrar. Su historial se conserva.' : 'Vuelve a tener acceso.',
          showCancelButton: true, confirmButtonText: 'Sí', cancelButtonText: 'No'
        });
        if (!c.isConfirmed) return;
        try {
          var re = await apiPost('usuarioestado', { uid: uid_(), objetivo: u.uid, activo: !u.activo });
          cerrar_();
          await cargar_(re && re.todo);
        } catch (e) { aviso_('error', 'No se pudo', e.message || String(e)); }
      });
    }

    setTimeout(function () { var n = el_('cfgu-nombre'); if (n && nuevo) n.focus(); }, 60);
  }

  /* ============================================================
     PLANTILLAS
     ============================================================ */
  function pintarPlantillas_() {
    var cont = el_('cfg-plantillas');
    if (!cont) return;

    cont.innerHTML = estado.plantillas.map(function (p, i) {
      var vars = (p.vars || []).map(function (v) {
        return '<button type="button" class="cfg-var" data-clave="' + esc_(p.clave) + '" data-var="' + esc_(v) + '">{' + esc_(v) + '}</button>';
      }).join('');
      return '' +
        '<div class="cfg-acc" data-clave="' + esc_(p.clave) + '">' +
          '<button type="button" class="cfg-acc-h">' +
            '<span>' + esc_(p.titulo) + '</span>' +
            (p.esDefecto ? '' : '<em class="cfg-tag">editada</em>') +
            '<i>' + ICO_('abajo', 16) + '</i>' +
          '</button>' +
          '<div class="cfg-acc-b">' +
            '<p class="hf-intro">' + esc_(p.donde) + '</p>' +
            '<div class="cfg-vars">' + vars + '</div>' +
            '<textarea class="cfg-txt" id="cfg-txt-' + i + '" rows="10">' + esc_(p.texto) + '</textarea>' +
            '<div class="cfg-acc-pie">' +
              '<button type="button" class="kit-btn kit-btn--marca cfg-guardar" data-clave="' + esc_(p.clave) + '">' + ICOS('check') + 'Guardar</button>' +
              '<button type="button" class="kit-btn cfg-restaurar" data-clave="' + esc_(p.clave) + '">' + ICOS('devolver') + 'Restaurar original</button>' +
            '</div>' +
          '</div>' +
        '</div>';
    }).join('');

    cont.querySelectorAll('.cfg-acc-h').forEach(function (h) {
      h.addEventListener('click', function () {
        var caja = h.parentNode;
        var abierta = caja.classList.contains('abierta');
        cont.querySelectorAll('.cfg-acc').forEach(function (a) { a.classList.remove('abierta'); });
        if (!abierta) caja.classList.add('abierta');
      });
    });

    cont.querySelectorAll('.cfg-txt').forEach(function (t) {
      t.addEventListener('input', function () {
        var clave = t.closest('.cfg-acc').dataset.clave;
        estado.sucias[clave] = true;
      });
    });

    cont.querySelectorAll('.cfg-var').forEach(function (b) {
      b.addEventListener('click', function () {
        var caja = b.closest('.cfg-acc');
        var t = caja.querySelector('.cfg-txt');
        var texto = '{' + b.dataset.var + '}';
        var ini = t.selectionStart || 0, fin = t.selectionEnd || 0;
        t.value = t.value.substring(0, ini) + texto + t.value.substring(fin);
        t.focus();
        t.selectionStart = t.selectionEnd = ini + texto.length;
        estado.sucias[caja.dataset.clave] = true;
      });
    });

    cont.querySelectorAll('.cfg-guardar').forEach(function (b) {
      b.addEventListener('click', async function () {
        var caja = b.closest('.cfg-acc');
        var texto = caja.querySelector('.cfg-txt').value;
        var cambios = {}; cambios[b.dataset.clave] = texto;
        try {
          var rg = await apiPost('cfgguardar', { uid: uid_(), cambios: cambios });
          estado.sucias[b.dataset.clave] = false;
          await Swal.fire({ icon: 'success', title: 'Plantilla guardada', timer: 1300, showConfirmButton: false });
          await cargar_(rg && rg.todo);
          pestana_('plantillas');
        } catch (e) { aviso_('error', 'No se pudo guardar', e.message || String(e)); }
      });
    });

    cont.querySelectorAll('.cfg-restaurar').forEach(function (b) {
      b.addEventListener('click', async function () {
        var c = await Swal.fire({
          icon: 'question', title: 'Restaurar el texto original',
          showCancelButton: true, confirmButtonText: 'Restaurar', cancelButtonText: 'Cancelar'
        });
        if (!c.isConfirmed) return;
        try {
          var rr = await apiPost('cfgrestaurar', { uid: uid_(), clave: b.dataset.clave });
          estado.sucias[b.dataset.clave] = false;
          await cargar_(rr && rr.todo);
          pestana_('plantillas');
        } catch (e) { aviso_('error', 'No se pudo restaurar', e.message || String(e)); }
      });
    });
  }

  /* ============================================================
     AVANZADO (solo DEV)
     ============================================================ */
  function pintarAvanzado_() {
    var cont = el_('cfg-avanzado');
    if (!cont) return;

    if (!estado.esDev || !estado.avanzado.length) {
      cont.innerHTML = '<p class="helper center">Solo el desarrollador ve esta sección.</p>';
      return;
    }

    /* FASE 2 — agrupado por lo que es (carpetas, WhatsApp, Firebase…) y con
       la explicación de dónde se usa cada llave a la vista. */
    var GRUPOS = [
      { t: 'Carpetas y archivos de Drive', ic: 'carpeta', pre: ['drive.', 'media.'] },
      { t: 'WhatsApp (BuilderBot)', ic: 'whatsapp', pre: ['bb.', 'wa.'] },
      /* FASE 3 — Semáforo y Seguimientos de las 7 a.m. (antes eran dos
         proyectos aparte con todo escrito en el código) */
      { t: 'Tareas diarias: Semáforo y Seguimientos', ic: 'reloj', pre: ['sem.', 'seg.', 'tareas.'] },
      { t: 'Avisos push al teléfono', ic: 'campana', pre: ['push.'] },
      { t: 'Firebase: chat y EN VIVO', ic: 'nube', pre: ['chat.', 'envivo.'] },
      { t: 'Voz de las consultas', ic: 'altavoz', pre: ['voz.'] },
      { t: 'Industria y Comercio (backend ICA)', ic: 'base-datos', pre: ['ica.'] },
      { t: 'Ingreso, enlaces y topes', ic: 'candado', pre: ['pin.', 'sesion.', 'app.', 'visor.'] }
    ];
    function grupoDe(clave) {
      for (var g = 0; g < GRUPOS.length; g++) {
        for (var q = 0; q < GRUPOS[g].pre.length; q++) if (clave.indexOf(GRUPOS[g].pre[q]) === 0) return g;
      }
      return GRUPOS.length - 1;
    }
    var porGrupo = GRUPOS.map(function () { return []; });
    estado.avanzado.forEach(function (a, i) { porGrupo[grupoDe(a.clave)].push({ a: a, i: i }); });

    cont.innerHTML = porGrupo.map(function (lista, g) {
      if (!lista.length) return '';
      return '<section class="cfg-grupo"><h4 class="grupo__t">' + ICO_(GRUPOS[g].ic, 18) + ' ' + esc_(GRUPOS[g].t) + '</h4>' +
        lista.map(function (x) {
          var a = x.a, i = x.i;
          var tipo = a.tipo === 'secreto' ? 'password' : (a.tipo === 'numero' ? 'tel' : 'text');
          return '' +
            '<label class="cfg-lbl">' + esc_(a.titulo) +
              '<span class="cfg-campo">' +
                '<input id="cfg-av-' + i + '" type="' + tipo + '" value="' + esc_(a.valor) + '" data-clave="' + esc_(a.clave) + '" autocomplete="off" />' +
                (a.tipo === 'secreto' ? '<button type="button" class="cfg-ojo" data-i="' + i + '" aria-label="Mostrar u ocultar">' + ICO_('ojo', 18) + '</button>' : '') +
              '</span>' +
              '<small>' + esc_(a.donde || '') + ' · <code>' + esc_(a.clave) + '</code></small>' +
            '</label>';
        }).join('') + '</section>';
    }).join('') +
    '<div class="cfg-acc-pie">' +
      '<button type="button" id="cfg-av-push" class="kit-btn kit-btn--plano">' + ICOS('campana') + 'Probar aviso push en mi teléfono</button>' +
      '<button type="button" id="cfg-av-guardar" class="kit-btn kit-btn--marca">' + ICOS('check') + 'Guardar cambios</button>' +
    '</div>';

    cont.querySelectorAll('.cfg-ojo').forEach(function (o) {
      o.addEventListener('click', function () {
        var inp = el_('cfg-av-' + o.dataset.i);
        inp.type = inp.type === 'password' ? 'text' : 'password';
      });
    });
    cont.querySelectorAll('input[data-clave]').forEach(function (inp) {
      inp.addEventListener('input', function () { estado.sucias[inp.dataset.clave] = true; });
    });

    /* FASE 3 — aviso de prueba a los teléfonos registrados de quien está en sesión */
    el_('cfg-av-push').addEventListener('click', async function () {
      try {
        var rp = await apiPost('cfgprobaraviso', {});
        if (rp && rp.ok) Swal.fire({ icon: 'success', title: 'Aviso enviado', text: 'Llegó a ' + (rp.enviados || 0) + ' teléfono(s).', timer: 2200, showConfirmButton: false });
        else Swal.fire({ icon: 'info', title: 'No salió el aviso', text: (rp && rp.error) || 'Sin teléfonos registrados.' });
      } catch (e) { aviso_('error', 'No se pudo probar', e.message || String(e)); }
    });

    el_('cfg-av-guardar').addEventListener('click', async function () {
      var cambios = {};
      cont.querySelectorAll('input[data-clave]').forEach(function (inp) {
        cambios[inp.dataset.clave] = inp.value;
      });
      try {
        var ra = await apiPost('cfgguardar', { uid: uid_(), cambios: cambios });
        estado.sucias = {};
        await Swal.fire({ icon: 'success', title: 'Guardado', timer: 1300, showConfirmButton: false });
        await cargar_(ra && ra.todo);
        pestana_('avanzado');
      } catch (e) { aviso_('error', 'No se pudo guardar', e.message || String(e)); }
    });
  }

  /* ============================================================
     FESTIVOS — 05/10/2026
     Igual que ADMIN-FLANDES: los de LEY se calculan (fijos, Ley Emiliani
     y Semana Santa) y aquí se marcan los que no aplican; los días no
     laborales extra se AGREGAN con su nombre, se editan o se borran.
     Se guardan en el backend HACIENDA (CONFIG 'festivos.ajustes'), la
     MISMA fuente que usa ICA para los 15 días hábiles.
     · Llega en el viaje de 'cfgtodo' (sin viajes extra).
     · Los cambios se arman en pantalla y se guardan juntos: UN viaje,
       botón ocupado desde el primer toque y rid (reintento solo ante
       falla de red con el MISMO rid).
     · Al guardar se parcha en memoria: la lista de aquí, los días
       hábiles de la app (HAC_PUBLICO.festivos) y los de ICA.
     ============================================================ */
  var FES = { datos: null, borrador: null, guardando: false };
  var DIAS_SEM = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];

  function fIsoOk_(s) {
    var m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return false;
    var d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
  }
  function fDow_(f) { var p = f.split('-'); return new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])).getUTCDay(); }
  function fCorta_(f) { return f.slice(8, 10) + '/' + f.slice(5, 7); }
  function fLarga_(f) { return f.slice(8, 10) + '/' + f.slice(5, 7) + '/' + f.slice(0, 4); }
  function fBorrador_() {
    if (!FES.borrador && FES.datos) {
      FES.borrador = {
        agregar: (FES.datos.agregar || []).map(function (x) { return { f: x.f, n: x.n }; }),
        quitar: (FES.datos.quitar || []).slice()
      };
    }
    return FES.borrador;
  }
  function fSucio_() {
    if (!FES.datos || !FES.borrador) return false;
    var a = JSON.stringify({ a: FES.borrador.agregar.slice().sort(function (x, y) { return x.f < y.f ? -1 : 1; }), q: FES.borrador.quitar.slice().sort() });
    var b = JSON.stringify({ a: (FES.datos.agregar || []).map(function (x) { return { f: x.f, n: x.n }; }), q: (FES.datos.quitar || []).slice().sort() });
    return a !== b;
  }
  function fLey_() { var m = {}; ((FES.datos && FES.datos.ley) || []).forEach(function (x) { m[x.f] = x.n; }); return m; }
  /** Fechas que quedan como festivos (ISO) con el borrador: ley − no aplica + agregados. */
  function fRango_(b) {
    var q = {}; (b.quitar || []).forEach(function (f) { q[f] = 1; });
    var out = ((FES.datos && FES.datos.ley) || []).filter(function (x) { return !q[x.f]; }).map(function (x) { return x.f; });
    (b.agregar || []).forEach(function (x) { out.push(x.f); });
    return out.sort();
  }

  function pintarFestivos_() {
    var cont = el_('cfg-festivos');
    if (!cont) return;
    var D = FES.datos;
    if (!D) { cont.innerHTML = '<p class="hf-intro">No llegaron los festivos. Cierra y vuelve a abrir Configuración.</p>'; return; }
    var b = fBorrador_();
    var ley = fLey_();
    var q = {}; b.quitar.forEach(function (f) { q[f] = 1; });
    var filas = (D.ley || []).map(function (x) { return { f: x.f, n: x.n, o: 'LEY', off: !!q[x.f] }; })
      .concat(b.agregar.map(function (x) { return { f: x.f, n: x.n, o: 'AGREGADO', off: false }; }))
      .sort(function (x, y) { return x.f < y.f ? -1 : 1; });
    var sucio = fSucio_();
    estado.sucias.festivos = sucio;

    var h = '<p class="hf-intro">Los <b>de ley</b> se calculan solos (fijos, Ley Emiliani y Semana Santa). Si uno no aplica, márcalo; si hay un día no laboral extra (un decreto, una fecha local), agrégalo con su nombre. ' +
      'Con estos días se cuentan los <b>días hábiles</b> de toda la app, incluidos los 15 días hábiles de los requerimientos de Industria y Comercio.</p>';
    h += '<div class="cfgf-barra">' +
      '<p class="cfgf-estado">' + ICOS('reloj') + (D.cuando ? 'Última edición: ' + esc_(D.cuando) + (D.por ? ' · ' + esc_(D.por) : '') : 'Sin cambios: solo los festivos de ley.') + '</p>' +
      '<button type="button" id="cfgf-agregar" class="kit-btn kit-btn--marca cfg-mini">' + ICOS('mas') + 'Agregar festivo</button>' +
    '</div>';
    h += '<div class="cfgf-anios">';
    (D.anios || []).forEach(function (y) {
      var del = filas.filter(function (x) { return x.f.slice(0, 4) === String(y); });
      var activos = del.filter(function (x) { return !x.off; }).length;
      h += '<section class="cfgf-anio"><h4>' + y + ' <small>' + activos + ' festivos</small></h4><div class="cfgf-dias">';
      del.forEach(function (x) {
        h += '<div class="cfgf-dia' + (x.off ? ' cfgf-dia--off' : '') + (x.o === 'AGREGADO' ? ' cfgf-dia--mas' : '') + '">' +
          '<b>' + fCorta_(x.f) + ' ' + DIAS_SEM[fDow_(x.f)] + '</b>' +
          '<span class="cfgf-n">' + esc_(x.n) + (x.o === 'AGREGADO' ? ' <em>agregado</em>' : (x.off ? ' <em>no aplica</em>' : '')) + '</span>' +
          '<span class="cfgf-acc">' +
          (x.o === 'AGREGADO'
            ? '<button type="button" class="kit-btn kit-btn--plano cfgf-mini" data-ed="' + x.f + '" title="Editar">' + ICOS('lapiz', 14) + 'Editar</button>' +
              '<button type="button" class="kit-btn kit-btn--plano cfgf-mini cfg-peligro" data-bo="' + x.f + '" title="Borrar">' + ICOS('basura', 14) + 'Borrar</button>'
            : (x.off
              ? '<button type="button" class="kit-btn kit-btn--plano cfgf-mini" data-si="' + x.f + '">' + ICOS('mas', 14) + 'Sí aplica</button>'
              : '<button type="button" class="kit-btn kit-btn--plano cfgf-mini" data-no="' + x.f + '">' + ICOS('menos', 14) + 'No aplica</button>')) +
          '</span></div>';
      });
      h += '</div></section>';
    });
    h += '</div>';
    h += '<div class="cfg-acc-pie cfgf-pie">' +
      '<button type="button" id="cfgf-descartar" class="kit-btn"' + (sucio ? '' : ' disabled') + '>Descartar cambios</button>' +
      '<button type="button" id="cfgf-guardar" class="kit-btn kit-btn--marca"' + (sucio ? '' : ' disabled') + '>' + ICOS('check') + 'Guardar festivos</button>' +
      (sucio ? '<span class="cfgf-pend">' + ICOS('aviso', 14) + 'Hay cambios sin guardar</span>' : '') +
    '</div>';
    cont.innerHTML = h;

    el_('cfgf-agregar').addEventListener('click', function () { sonido_('click'); modalFestivo_(null); });
    cont.querySelectorAll('[data-ed]').forEach(function (bt) {
      bt.addEventListener('click', function () { sonido_('click'); modalFestivo_(bt.dataset.ed); });
    });
    cont.querySelectorAll('[data-bo]').forEach(function (bt) {
      bt.addEventListener('click', function () {
        var f = bt.dataset.bo, x = b.agregar.filter(function (y) { return y.f === f; })[0];
        Swal.fire({ icon: 'warning', title: '¿Borrar este festivo?', text: fLarga_(f) + ' · ' + (x ? x.n : '') + '. Ese día vuelve a ser hábil al guardar.',
          showCancelButton: true, confirmButtonText: 'Sí, borrar', cancelButtonText: 'Cancelar' }).then(function (r) {
          if (!r.isConfirmed) return;
          b.agregar = b.agregar.filter(function (y) { return y.f !== f; });
          pintarFestivos_();
        });
      });
    });
    cont.querySelectorAll('[data-no]').forEach(function (bt) {
      bt.addEventListener('click', function () {
        var f = bt.dataset.no;
        Swal.fire({ icon: 'warning', title: '¿Ese festivo no aplica?', text: fLarga_(f) + ' · ' + (ley[f] || '') + '. Ese día pasa a contarse como hábil al guardar.',
          showCancelButton: true, confirmButtonText: 'Sí, no aplica', cancelButtonText: 'Cancelar' }).then(function (r) {
          if (!r.isConfirmed) return;
          if (b.quitar.indexOf(f) === -1) b.quitar.push(f);
          pintarFestivos_();
        });
      });
    });
    cont.querySelectorAll('[data-si]').forEach(function (bt) {
      bt.addEventListener('click', function () {
        sonido_('click');
        b.quitar = b.quitar.filter(function (y) { return y !== bt.dataset.si; });
        pintarFestivos_();
      });
    });
    el_('cfgf-descartar').addEventListener('click', function () { sonido_('back'); FES.borrador = null; pintarFestivos_(); });
    el_('cfgf-guardar').addEventListener('click', guardarFestivos_);
  }

  /** Agregar (f = null) o editar el agregado del día f. */
  function modalFestivo_(f) {
    var D = FES.datos, b = fBorrador_(), ley = fLey_();
    var x = f ? b.agregar.filter(function (y) { return y.f === f; })[0] : null;
    var y0 = D.anios[0], y1 = D.anios[D.anios.length - 1];
    var m = document.createElement('div');
    m.className = 'cfg-modal';
    m.innerHTML =
      '<div class="cfg-modal-caja cfgf-modal">' +
        '<h3>' + (x ? 'Editar festivo' : 'Agregar festivo') + '</h3>' +
        '<label class="cfg-lbl">Fecha' +
          '<input id="cfgf-fecha" type="date" min="' + y0 + '-01-01" max="' + y1 + '-12-31" value="' + (x ? x.f : '') + '" />' +
        '</label>' +
        '<label class="cfg-lbl">Nombre del festivo' +
          '<input id="cfgf-nombre" type="text" maxlength="80" placeholder="Ej.: Día cívico (Decreto 123 de ' + y0 + ')" value="' + esc_(x ? x.n : '') + '" />' +
          '<small class="cfg-ayuda mal" id="cfgf-error"></small>' +
        '</label>' +
        '<div class="cfg-modal-pie">' +
          '<button type="button" id="cfgf-cerrar" class="kit-btn" data-salida>Cancelar</button>' +
          '<button type="button" id="cfgf-listo" class="kit-btn kit-btn--marca">' + ICOS('check') + (x ? 'Aplicar cambio' : 'Agregar') + '</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(m);
    function cerrar_() { if (m.parentNode) m.parentNode.removeChild(m); }
    m.addEventListener('click', function (ev) { if (ev.target === m) cerrar_(); });
    m.querySelector('#cfgf-cerrar').addEventListener('click', function () { sonido_('back'); cerrar_(); });
    var err = m.querySelector('#cfgf-error');
    m.querySelector('#cfgf-listo').addEventListener('click', function () {
      var fecha = String(m.querySelector('#cfgf-fecha').value || '').trim();
      var nombre = String(m.querySelector('#cfgf-nombre').value || '').replace(/\s+/g, ' ').trim();
      var e = '';
      if (!fIsoOk_(fecha)) e = 'Elige una fecha válida.';
      else if (+fecha.slice(0, 4) < y0 || +fecha.slice(0, 4) > y1) e = 'La fecha debe ser de ' + y0 + ' o ' + y1 + '.';
      else if (fDow_(fecha) === 0 || fDow_(fecha) === 6) e = 'Ese día es fin de semana: ya no cuenta como hábil.';
      else if (ley[fecha] && b.quitar.indexOf(fecha) === -1) e = 'El ' + fLarga_(fecha) + ' ya es festivo de ley (' + ley[fecha] + ').';
      else if (b.agregar.some(function (y) { return y.f === fecha && (!x || y.f !== x.f); })) e = 'El ' + fLarga_(fecha) + ' ya está en la lista.';
      else if (nombre.length < 3) e = 'Escribe el nombre del festivo.';
      if (e) { err.textContent = e; sonido_('error'); return; }
      if (ley[fecha]) {
        /* era de ley y estaba como "no aplica": vuelve a aplicar con su nombre de ley */
        b.quitar = b.quitar.filter(function (y) { return y !== fecha; });
        if (x) b.agregar = b.agregar.filter(function (y) { return y.f !== x.f; });
      } else if (x) { x.f = fecha; x.n = nombre; }
      else b.agregar.push({ f: fecha, n: nombre });
      cerrar_();
      pintarFestivos_();
    });
    setTimeout(function () { var n = m.querySelector('#cfgf-nombre'); if (n && x) n.focus(); }, 60);
  }

  function guardarFestivos_() {
    var bt = el_('cfgf-guardar');
    if (!bt || bt.disabled || FES.guardando) return;
    FES.guardando = true; bt.disabled = true;
    var b = fBorrador_();
    var rid = 'fe' + Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
    var cuerpo = { uid: uid_(), v: FES.datos.v, agregar: b.agregar, quitar: b.quitar, rid: rid };
    function una(n) {
      return window.apiPost('festivosguardar', cuerpo).catch(function (e) {
        /* reintento ÚNICO y solo ante falla de red o respuesta que no es JSON (404 de echo) */
        var red = (e instanceof TypeError) || (e instanceof SyntaxError);
        if (red && n < 1) return new Promise(function (r) { setTimeout(r, 1200); }).then(function () { return una(n + 1); });
        throw e;
      });
    }
    var t0 = Date.now();
    var p = una(0);
    var K = window.KIT, conPieza = false;
    try { if (K && K.piezas && K.piezas.guardado) conPieza = !!(p = K.piezas.guardado.mientras(p, { titulo: 'Guardando los festivos', sub: 'Los días hábiles de toda la app, también los de ICA, los respetan desde ya.' })); } catch (_) {}
    p.then(function (r) {
      try { (window.__cfgMed = window.__cfgMed || []).push({ ruta: 'festivosguardar', ms: Date.now() - t0 }); } catch (_) {}
      FES.guardando = false;
      if (!r || !r.festivos) throw new Error('El servidor no devolvió los festivos.');
      FES.datos = r.festivos;
      FES.borrador = null;
      /* parche en memoria: la app y ICA cuentan con la lista nueva sin recargar nada */
      window.HAC_PUBLICO = window.HAC_PUBLICO || {};
      window.HAC_PUBLICO.festivos = { v: r.festivos.v, agregar: (r.festivos.agregar || []).map(function (x) { return x.f; }), quitar: (r.festivos.quitar || []).slice() };
      try { if (typeof window.hacFestOlvidar_ === 'function') window.hacFestOlvidar_(); } catch (_) {}
      try { if (window.ICA && window.ICA.festivosCambiaron) window.ICA.festivosCambiaron(fRango_(r.festivos)); } catch (_) {}
      pintarFestivos_();
      if (r.conflicto) aviso_('info', 'Alguien guardó antes', 'Otra persona cambió los festivos mientras editabas. Se cargó su lista: revisa y vuelve a hacer tu cambio.');
      else if (!conPieza) { sonido_('success'); Swal.fire({ icon: 'success', title: 'Festivos guardados', timer: 1400, showConfirmButton: false }); }
    }, function (e) {
      FES.guardando = false;
      var b2 = el_('cfgf-guardar'); if (b2) b2.disabled = false;
      aviso_('error', 'No se pudo guardar', (e && e.message) || String(e));
    });
  }

  /* ============================================================
     ENGANCHE CON app.js / identidad.js
     ============================================================ */
  var procesarOriginal = window.procesarLoginExitoso_;
  if (typeof procesarOriginal === 'function') {
    window.procesarLoginExitoso_ = function () {
      var r = procesarOriginal.apply(this, arguments);
      setTimeout(function () { montarBoton_(); }, 0);
      return r;
    };
  }

  var showOriginal = window.showView;
  if (typeof showOriginal === 'function') {
    window.showView = function (id) {
      var r = showOriginal.apply(this, arguments);
      if (id === 'view-inicio') montarBoton_();
      if (id === 'view-login') { estado.cargado = false; estado.sucias = {}; ocultarBoton_(); }
      return r;
    };
  }

  var btnSalir = el_('btn-logout');
  if (btnSalir) btnSalir.addEventListener('click', function () {
    estado.cargado = false; estado.sucias = {}; ocultarBoton_();
  });

  /* API pública para las fases siguientes */
  window.CFG = {
    abrir: abrir_,
    _fes: function () { return FES; },
    recargar: cargar_,
    _estado: function () { return estado; }
  };

  if (document.readyState === 'complete') setTimeout(montarBoton_, 300);
  else window.addEventListener('load', function () { setTimeout(montarBoton_, 900); });
})();
