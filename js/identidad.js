/* ============================================================
   IDENTIDAD — FASE 0 (roles, sesión y foto de perfil) 
   SEC-HACIENDA · se carga DESPUÉS de app.js
   No modifica app.js: reemplaza en caliente lo que hace falta.
   ============================================================ */
(function () {
  'use strict';

  /* ---------- Almacenamiento ---------- */
  var NS = 'hac';
  var K_SESION  = NS + '.sesion.v1';
  var K_CUENTAS = NS + '.cuentas.v1';
  var K_LISTA   = NS + '.usuarios.v1';

  function leer_(k) {
    try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch (_) { return null; }
  }
  function escribir_(k, v) {
    try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {}
  }
  function borrar_(k) {
    try { localStorage.removeItem(k); } catch (_) {}
  }

  /* ---------- Estado ---------- */
  var perfil = null;            // perfil completo del usuario en sesión
  var uidElegido = '';
  var pinBuf = '';

  var ROLES = ['DEV', 'ADMIN', 'ABOGADO', 'ASISTENTE', 'ARCHIVO', 'ATENCION'];

  function normaliza_(p) {
    var roles = [];
    if (p && Array.isArray(p.roles)) {
      for (var i = 0; i < p.roles.length; i++) {
        var r = String(p.roles[i] || '').trim().toUpperCase();
        if (ROLES.indexOf(r) !== -1 && roles.indexOf(r) === -1) roles.push(r);
      }
    }
    return {
      uid: String((p && p.uid) || ''),
      documento: String((p && p.documento) || ''),
      nombre: String((p && p.nombre) || '').toUpperCase(),
      telefono: String((p && p.telefono) || ''),
      correo: String((p && p.correo) || ''),
      foto: String((p && p.foto) || ''),
      roles: roles,
      isSuper: roles.indexOf('DEV') !== -1 || roles.indexOf('ADMIN') !== -1
    };
  }

  function tieneRol_() {
    if (!perfil || !perfil.roles.length) return false;
    for (var i = 0; i < arguments.length; i++) {
      if (perfil.roles.indexOf(arguments[i]) !== -1) return true;
    }
    return false;
  }

  /* ============================================================
     PERMISOS
     ============================================================ */
  /* FASE 6 — AQUÍ HABÍA UN CHOQUE DE FASES, ya corregido.
     La Fase 0 envolvía canSeeAgregarSolicitud_, canSeePendientes_,
     canSeeAtendidasChat_, canSeeBDPredial_ y canSeeAgregarAsignacion_
     para decidirlos POR ROL desde el navegador. Desde la Fase 5 eso lo
     decide el servidor (Alcance.gs) y app.js solo consulta `window.ALC`,
     así que estos envoltorios estaban PISANDO al servidor: un abogado
     sin un solo expediente seguía viendo BD Predial porque tenía el rol.
     Se quitan. La red de seguridad no se pierde: sin alcance, alcVer_
     devuelve NO para todo (fail-closed), que es más prudente que esto.

     Con ellos se van `envolver_` y `conRoles_`, que ya no usaba nadie.
     `tieneRol_` se queda: la usa la API pública de este archivo
     (IDN.esDev, IDN.esAdmin, ...). */

  /* ============================================================
     CABECERA DE INICIO (avatar, nombre, roles, cambiar de usuario)
     ============================================================ */
  function iniciales_(nombre) {
    var p = String(nombre || '').trim().split(/\s+/).filter(Boolean);
    if (!p.length) return '?';
    return (p[0][0] + (p.length > 1 ? p[1][0] : '')).toUpperCase();
  }

  function montarCabecera_() {
    var vista = document.getElementById('view-inicio');
    if (!vista || document.getElementById('idn-avatar-wrap')) return;

    var nombreEl = document.getElementById('inicio-nombre');
    if (!nombreEl) return;

    var wrap = document.createElement('div');
    wrap.id = 'idn-avatar-wrap';
    wrap.className = 'idn-avatar-wrap';
    wrap.innerHTML =
      '<div class="idn-avatar" id="idn-avatar" title="Cambiar foto">' +
        '<span class="idn-avatar-ini" id="idn-avatar-ini">?</span>' +
        '<img class="idn-avatar-img hidden" id="idn-avatar-img" alt="Foto de perfil" />' +
        '<span class="idn-avatar-cam">✎</span>' +
      '</div>' +
      '<input type="file" id="idn-foto-input" accept="image/*" class="hidden" />';

    nombreEl.parentNode.insertBefore(wrap, nombreEl);

    var chips = document.createElement('div');
    chips.id = 'idn-roles';
    chips.className = 'idn-roles';
    nombreEl.parentNode.insertBefore(chips, nombreEl.nextSibling);

    // Botón "Cambiar de usuario" junto a "Cerrar Sesión"
    var salir = document.getElementById('btn-logout');
    if (salir && !document.getElementById('btn-cambiar-usuario')) {
      var b = document.createElement('button');
      b.id = 'btn-cambiar-usuario';
      b.type = 'button';
      b.className = 'chip';
      b.textContent = 'Cambiar de usuario';
      salir.parentNode.insertBefore(b, salir);
      b.addEventListener('click', function () {
        try { playSoundOnce(SOUNDS.menu); } catch (_) {}
        cerrarSesion_(false);
      });
    }

    document.getElementById('idn-avatar').addEventListener('click', function () {
      document.getElementById('idn-foto-input').click();
    });
    document.getElementById('idn-foto-input').addEventListener('change', subirFoto_);
  }

  function pintarCabecera_() {
    montarCabecera_();
    if (!perfil) return;

    var ini = document.getElementById('idn-avatar-ini');
    var img = document.getElementById('idn-avatar-img');
    if (ini) ini.textContent = iniciales_(perfil.nombre);
    if (img) {
      if (perfil.foto) {
        img.src = perfil.foto;
        img.classList.remove('hidden');
        img.onerror = function () { img.classList.add('hidden'); };
      } else {
        img.classList.add('hidden');
        img.removeAttribute('src');
      }
    }

    var chips = document.getElementById('idn-roles');
    if (chips) {
      chips.innerHTML = '';
      var lista = perfil.roles.length ? perfil.roles : ['SIN ROL'];
      for (var i = 0; i < lista.length; i++) {
        var s = document.createElement('span');
        s.className = 'idn-rol-chip' + (lista[i] === 'SIN ROL' ? ' sin' : '');
        s.textContent = lista[i];
        chips.appendChild(s);
      }
    }

    var sub = document.getElementById('inicio-sub');
    if (sub) sub.textContent = perfil.roles.length ? perfil.roles.join(' · ') : 'SIN ROL ASIGNADO';

    /* FASE 6 — el botón de Mi semáforo tampoco se decide aquí por rol.
       Se le pide a app.js que vuelva a aplicar los permisos, que es el
       único sitio que sabe qué dijo el servidor. */
    try {
      if (typeof window.aplicarPermisosVistas_ === 'function') window.aplicarPermisosVistas_();
    } catch (_) {}
  }

  /* ---------- Foto de perfil ---------- */
  function redimensionar_(file, lado) {
    return new Promise(function (resolve, reject) {
      var fr = new FileReader();
      fr.onerror = function () { reject(new Error('No se pudo leer la imagen')); };
      fr.onload = function () {
        var img = new Image();
        img.onerror = function () { reject(new Error('Imagen no válida')); };
        img.onload = function () {
          var min = Math.min(img.width, img.height);
          var cv = document.createElement('canvas');
          cv.width = lado; cv.height = lado;
          var cx = cv.getContext('2d');
          cx.drawImage(img, (img.width - min) / 2, (img.height - min) / 2, min, min, 0, 0, lado, lado);
          var url = cv.toDataURL('image/jpeg', 0.85);
          resolve(url.split(',')[1]);
        };
        img.src = fr.result;
      };
      fr.readAsDataURL(file);
    });
  }

  async function subirFoto_(ev) {
    var file = ev && ev.target && ev.target.files && ev.target.files[0];
    if (!file) return;
    ev.target.value = '';
    if (!perfil || !perfil.uid) return;

    try {
      var b64 = await redimensionar_(file, 320);
      var res = await apiPost('subirfoto', { uid: perfil.uid, base64: b64, mime: 'image/jpeg' });
      perfil.foto = (res && res.foto) || '';
      if (currentUser) currentUser.foto = perfil.foto;
      guardarSesion_();
      guardarCuenta_();
      pintarCabecera_();
      Swal.fire({ icon: 'success', title: 'Foto actualizada', timer: 1600, showConfirmButton: false });
    } catch (e) {
      Swal.fire({ icon: 'error', title: 'No se pudo guardar la foto', text: e.message || String(e) });
    }
  }

  /* ============================================================
     SESIÓN
     ============================================================ */
  function guardarSesion_() {
    if (!perfil) return;
    escribir_(K_SESION, { perfil: perfil, ts: Date.now() });
  }

  function guardarCuenta_() {
    if (!perfil || !perfil.uid) return;
    var cuentas = leer_(K_CUENTAS) || [];
    cuentas = cuentas.filter(function (c) { return c && c.uid !== perfil.uid; });
    cuentas.unshift({ uid: perfil.uid, nombre: perfil.nombre, foto: perfil.foto });
    escribir_(K_CUENTAS, cuentas.slice(0, 6));
  }

  function cerrarSesion_(olvidarCuenta) {
    borrar_(K_SESION);
    if (olvidarCuenta && perfil && perfil.uid) {
      var cuentas = (leer_(K_CUENTAS) || []).filter(function (c) { return c && c.uid !== perfil.uid; });
      escribir_(K_CUENTAS, cuentas);
    }
    perfil = null;
    uidElegido = '';
    pinBuf = '';
    var b = document.getElementById('btn-logout');
    if (b) b.click(); // reusa el apagado de botones que ya hace app.js
    else showView('view-login');
    setTimeout(pintarLogin_, 0);
  }

  /* ============================================================
     LOGIN: elegir usuario → PIN
     ============================================================ */
  function marcaLogin_() {
    var tab = document.getElementById('tab-pin');
    if (!tab) return null;
    if (!document.getElementById('idn-login')) {
      tab.innerHTML =
        '<div id="idn-login">' +
          /* FASE 9 — aquí ya NO se lista a todo el personal de la Secretaría:
             solo las cuentas que se han usado EN ESTE dispositivo (misma
             lógica de "cambiar de cuenta / eliminar cuenta" de la app pública
             de Jhonny Perdomo). Quien entra por primera vez lo hace por
             Documento y su cuenta queda guardada aquí. */
          '<div id="idn-paso-usuario">' +
            '<p class="idn-titulo">Cuentas de este dispositivo</p>' +
            '<div id="idn-cuentas" class="idn-usuarios"></div>' +
            '<button type="button" class="chip idn-otro" id="idn-otro-doc">+ Entrar con otro documento</button>' +
          '</div>' +
          '<div id="idn-paso-pin" class="hidden">' +
            '<div class="idn-elegido" id="idn-elegido"></div>' +
            '<button type="button" class="chip" id="idn-volver">Elegir otro usuario</button>' +
            '<div class="pin-pad">' +
              '<div class="pin-dot" data-pos="0"></div><div class="pin-dot" data-pos="1"></div>' +
              '<div class="pin-dot" data-pos="2"></div><div class="pin-dot" data-pos="3"></div>' +
            '</div>' +
            '<div class="pin-keypad">' +
              '<button type="button" class="idn-key" data-key="1">1</button>' +
              '<button type="button" class="idn-key" data-key="2">2</button>' +
              '<button type="button" class="idn-key" data-key="3">3</button>' +
              '<button type="button" class="idn-key" data-key="4">4</button>' +
              '<button type="button" class="idn-key" data-key="5">5</button>' +
              '<button type="button" class="idn-key" data-key="6">6</button>' +
              '<button type="button" class="idn-key" data-key="7">7</button>' +
              '<button type="button" class="idn-key" data-key="8">8</button>' +
              '<button type="button" class="idn-key" data-key="9">9</button>' +
              '<button type="button" class="idn-key action" data-key="clear">Borrar</button>' +
              '<button type="button" class="idn-key" data-key="0">0</button>' +
              '<button type="button" class="idn-key action" data-key="back">⌫</button>' +
            '</div>' +
          '</div>' +
        '</div>';

      document.getElementById('idn-volver').addEventListener('click', function () {
        uidElegido = ''; pinBuf = ''; pintarPaso_();
      });
      document.getElementById('idn-otro-doc').addEventListener('click', function () {
        try { playSoundOnce(SOUNDS.menu); } catch (_) {}
        irATab_('doc');
      });
      tab.querySelectorAll('.idn-key').forEach(function (k) {
        k.addEventListener('click', function () { teclaPin_(k.dataset.key); });
      });
    }
    return tab;
  }

  function pintarPuntos_() {
    document.querySelectorAll('#idn-paso-pin .pin-dot').forEach(function (d, i) {
      d.classList.toggle('filled', i < pinBuf.length);
    });
  }

  function teclaPin_(key) {
    if (key === 'clear') pinBuf = '';
    else if (key === 'back') pinBuf = pinBuf.slice(0, -1);
    else if (/^\d$/.test(key) && pinBuf.length < 4) {
      pinBuf += key;
      try { playSoundOnce(SOUNDS.menu); } catch (_) {}
    }
    pintarPuntos_();
    if (pinBuf.length === 4) entrarConPin_();
  }

  /* ---------- Cuentas guardadas en este dispositivo ---------- */
  function cuentas_() {
    var c = leer_(K_CUENTAS);
    return Array.isArray(c) ? c.filter(function (x) { return x && x.uid; }) : [];
  }

  function irATab_(cual) {
    var tabs = document.querySelectorAll('.login-tab');
    for (var i = 0; i < tabs.length; i++) {
      if (tabs[i].dataset.tab === cual) { tabs[i].click(); return true; }
    }
    return false;
  }

  function olvidarCuenta_(uid) {
    var quedan = cuentas_().filter(function (c) { return c.uid !== uid; });
    escribir_(K_CUENTAS, quedan);
    if (uidElegido === uid) { uidElegido = ''; pinBuf = ''; }
    pintarPaso_();
    if (!quedan.length) irATab_('doc');
    return quedan;
  }

  function pintarCuentas_() {
    var cont = document.getElementById('idn-cuentas');
    if (!cont) return;

    var lista = cuentas_();
    cont.innerHTML = '';

    if (!lista.length) {
      cont.innerHTML =
        '<p class="idn-vacio">Todavía no hay cuentas guardadas en este dispositivo. ' +
        'Entra la primera vez con tu <b>Documento</b> y tu cuenta queda aquí para el PIN.</p>';
      return;
    }

    lista.forEach(function (u) {
      var fila = document.createElement('div');
      fila.className = 'idn-cuenta-fila';

      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'idn-usuario';
      b.innerHTML =
        '<span class="idn-mini">' +
          (u.foto ? '<img src="' + u.foto + '" alt="" onerror="this.style.display=\'none\'" />' : '') +
          '<span>' + iniciales_(u.nombre) + '</span>' +
        '</span>' +
        '<span class="idn-nom">' + u.nombre + '</span>';
      b.addEventListener('click', function () {
        uidElegido = u.uid;
        pinBuf = '';
        try { playSoundOnce(SOUNDS.menu); } catch (_) {}
        pintarPaso_();
      });

      var del = document.createElement('button');
      del.type = 'button';
      del.className = 'idn-cuenta-del';
      del.title = 'Quitar esta cuenta de este dispositivo';
      del.setAttribute('aria-label', 'Quitar cuenta');
      del.textContent = '🗑';
      del.addEventListener('click', function (ev) {
        ev.stopPropagation();
        try { playSoundOnce(SOUNDS.back); } catch (_) {}
        olvidarCuenta_(u.uid);
      });

      fila.appendChild(b);
      fila.appendChild(del);
      cont.appendChild(fila);
    });
  }

  function pintarPaso_() {
    var pu = document.getElementById('idn-paso-usuario');
    var pp = document.getElementById('idn-paso-pin');
    if (!pu || !pp) return;

    if (!uidElegido) {
      pu.classList.remove('hidden');
      pp.classList.add('hidden');
      pintarCuentas_();
      return;
    }
    var u = cuentas_().filter(function (x) { return x.uid === uidElegido; })[0];
    document.getElementById('idn-elegido').innerHTML =
      '<span class="idn-mini">' +
        (u && u.foto ? '<img src="' + u.foto + '" alt="" onerror="this.style.display=\'none\'" />' : '') +
        '<span>' + iniciales_(u ? u.nombre : '') + '</span>' +
      '</span>' +
      '<b>' + (u ? u.nombre : '') + '</b>';
    pu.classList.add('hidden');
    pp.classList.remove('hidden');
    pintarPuntos_();
  }

  /* FASE 9 — desapareció cargarUsuarios_(): el login ya no le pide al
     servidor la lista de TODO el personal (endpoint 'usuarioslogin'), que era
     lo que dejaba los nombres de todos a la vista de cualquiera que abriera
     la app. De paso se borra la lista que había quedado guardada. */
  function limpiarListaVieja_() { borrar_(K_LISTA); }

  function pintarLogin_() {
    if (!marcaLogin_()) return;
    limpiarListaVieja_();
    if (!cuentas_().length) irATab_('doc');
    pintarPaso_();
  }

  async function entrarConPin_() {
    try {
      var data = await apiGet('loginpin', { uid: uidElegido, pin: pinBuf });
      pinBuf = ''; pintarPuntos_();

      if (data && data.encontrado) { procesarLoginExitoso_(data, data.documento || ''); return; }

      if (data && data.bloqueado) {
        await Swal.fire({
          icon: 'error', title: 'Usuario bloqueado',
          text: 'Demasiados intentos. Espera ' + (data.minutos || 5) + ' minutos o entra con Documento.'
        });
        return;
      }
      if (data && data.inactivo) {
        await Swal.fire({ icon: 'warning', title: 'Usuario inactivo', text: 'Solicita activación a la Secretaría de Hacienda.' });
        olvidarCuenta_(uidElegido);
        return;
      }
      if (data && data.sinPin) {
        await Swal.fire({ icon: 'info', title: 'Sin PIN', text: 'Este usuario aún no tiene PIN. Entra con Documento.' });
        return;
      }
      await Swal.fire({
        icon: 'error', title: 'PIN incorrecto',
        text: (data && typeof data.restantes === 'number')
          ? ('Te quedan ' + data.restantes + ' intentos.')
          : 'Verifica tu PIN de 4 dígitos.',
        timer: 2600, showConfirmButton: false
      });
    } catch (e) {
      pinBuf = ''; pintarPuntos_();
      Swal.fire({ icon: 'error', title: 'Error', text: e.message || String(e) });
    }
  }

  /* ============================================================
     ENGANCHE CON app.js
     ============================================================ */
  var procesarOriginal = window.procesarLoginExitoso_;

  window.procesarLoginExitoso_ = function (res, doc) {
    perfil = normaliza_(res);
    procesarOriginal(Object.assign({}, res, { isSuper: perfil.isSuper }), doc || perfil.documento);

    if (currentUser) {
      currentUser.uid = perfil.uid;
      currentUser.roles = perfil.roles;
      currentUser.foto = perfil.foto;
      currentUser.telefono = perfil.telefono;
      currentUser.correo = perfil.correo;
    }
    pintarCabecera_();
    guardarSesion_();
    guardarCuenta_();
  };

  // Cerrar sesión: limpia también lo guardado
  document.getElementById('btn-logout')?.addEventListener('click', function () {
    borrar_(K_SESION);
    perfil = null;
    uidElegido = ''; pinBuf = '';
    setTimeout(pintarLogin_, 0);
  });

  /* ---------- Arranque: sesión guardada ---------- */
  async function revalidar_() {
    if (!perfil || !perfil.uid) return;
    try {
      var p = await apiGet('perfil', { uid: perfil.uid });
      if (!p || !p.encontrado) {
        await Swal.fire({
          icon: 'warning',
          title: p && p.inactivo ? 'Tu usuario fue desactivado' : 'Tu usuario ya no está disponible',
          text: 'Debes iniciar sesión de nuevo.'
        });
        cerrarSesion_(true);
        return;
      }
      var antes = perfil.roles.join(',');
      perfil = normaliza_(p);
      if (currentUser) {
        currentUser.roles = perfil.roles;
        currentUser.isSuper = perfil.isSuper;
        currentUser.foto = perfil.foto;
      }
      guardarSesion_();
      guardarCuenta_();
      if (antes !== perfil.roles.join(',')) window.procesarLoginExitoso_(p, p.documento || '');
      else pintarCabecera_();
    } catch (_) { /* sin red: se sigue con lo guardado */ }
  }

  var yaArranco = false;
  var listaPedida = false;   // login ya pintado mientras se decide la vista
  function arrancar_() {
    if (yaArranco) return;

    marcaLogin_();

    // Si la app aún pide instalarse, no se restaura nada: manda esa pantalla.
    // (Y se deja el arranque pendiente para cuando llegue a la de acceso.)
    var activa = document.querySelector('.view.active');
    if (activa && activa.id === 'view-instalar') {
      if (!listaPedida) { listaPedida = true; pintarLogin_(); }
      return;
    }

    yaArranco = true;

    var ses = leer_(K_SESION);
    if (ses && ses.perfil && ses.perfil.uid) {
      window.procesarLoginExitoso_(ses.perfil, ses.perfil.documento || '');
      revalidar_();
    } else {
      pintarLogin_();
    }
  }

  /* initPWAVista() de app.js corre en 'load', es asíncrona y quedó registrada
     como oyente con su referencia original (reemplazarla no sirve de nada).
     Se arranca cuando esa decisión aterriza en una vista. */
  var showOriginal = window.showView;
  if (typeof showOriginal === 'function') {
    window.showView = function (id) {
      var r = showOriginal.apply(this, arguments);
      if (!yaArranco && (id === 'view-login' || id === 'view-instalar')) setTimeout(arrancar_, 0);
      return r;
    };
  }

  /* ---------- API pública (la usarán las fases siguientes) ---------- */
  window.IDN = {
    perfil: function () { return perfil ? JSON.parse(JSON.stringify(perfil)) : null; },
    roles: function () { return perfil ? perfil.roles.slice() : []; },
    tieneRol: function () { return tieneRol_.apply(null, arguments); },
    esDev: function () { return tieneRol_('DEV'); },
    esAdmin: function () { return tieneRol_('ADMIN', 'DEV'); },
    esAbogado: function () { return tieneRol_('ABOGADO'); },
    esAsistente: function () { return tieneRol_('ASISTENTE'); },
    esArchivo: function () { return tieneRol_('ARCHIVO'); },
    esAtencion: function () { return tieneRol_('ATENCION'); },
    cerrarSesion: function () { cerrarSesion_(false); },
    cuentas: function () { return cuentas_(); },
    olvidarCuenta: function (uid) { return olvidarCuenta_(uid); },
    _pintarLogin: pintarLogin_
  };

  marcaLogin_();
  // Red de seguridad: si la decisión de vista nunca llega, se arranca igual.
  if (document.readyState === 'complete') setTimeout(arrancar_, 400);
  else window.addEventListener('load', function () { setTimeout(arrancar_, 1200); });
})();
