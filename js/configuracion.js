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
    ATENCION:  'Atención al ciudadano: agregar y responder solicitudes.'
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
    ['usuarios', 'plantillas', 'avanzado'].forEach(function (p) {
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
      if (!estado.esDev && estado.pestana !== 'usuarios') pestana_('usuarios');

      var sub = el_('cfg-sub');
      if (sub) {
        sub.textContent = estado.usuarios.length + ' usuarios' +
          (todo && todo.ultimoCambio ? ' · último cambio: ' + todo.ultimoCambio : '');
      }

      pintarUsuarios_();
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
    var checks = ['DEV', 'ADMIN', 'ABOGADO', 'ASISTENTE', 'ARCHIVO', 'ATENCION'].map(function (r) {
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
    recargar: cargar_,
    _estado: function () { return estado; }
  };

  if (document.readyState === 'complete') setTimeout(montarBoton_, 300);
  else window.addEventListener('load', function () { setTimeout(montarBoton_, 900); });
})();
