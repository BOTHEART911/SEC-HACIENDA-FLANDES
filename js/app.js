/* ================== CONFIGURACIÓN ================== */
// TODO: pega aquí la URL /exec de tu Apps Script desplegado
/* FASE 3 — la dirección del backend vive SOLO en js/marca.js. */
const API_BASE = (window.MARCA && window.MARCA.API_URL) || '';
 
/* ================== SONIDOS (mismos tags/estilo indexref) ================== */
const SOUNDS = {
  question: 'sound/pay-fail.mp3',
  info: 'sound/default-notification.mp3',
  success: 'sound/pay-success.mp3',
  error: 'sound/low-battery.mp3',
  warning: 'sound/low-battery.mp3',
  login: 'sound/siri-star.mp3',
  logout: 'sound/siri-end.mp3',
  back: 'sound/keyboard-enter.mp3',
  menu: 'sound/namedrop-popup.mp3'
};
function playSoundOnce(url){
  try{ const a=new Audio(url); a.preload='auto'; a.play().catch(()=>{}); }catch(e){}
}
if (window.Swal && typeof Swal.fire === 'function'){
  const __fire = Swal.fire.bind(Swal);
  Swal.fire = function(options = {}, ...rest){
    try{
      const icon = options.icon || options.type;
      if (icon && SOUNDS[icon]) playSoundOnce(SOUNDS[icon]);
    }catch(_){}
    return __fire(options, ...rest);
  };
}

/* ================== LOADER ================== */
const loader = document.getElementById('loader');
let loadingCount = 0, loaderTimer = null;
function startLoading(){
  loadingCount++;
  if (loadingCount === 1){
    loaderTimer = setTimeout(()=>{ loader.classList.remove('hidden'); loaderTimer = null; }, 120);
  }
}
function stopLoading(){
  if (loadingCount === 0) return;
  loadingCount--;
  if (loadingCount === 0){
    if (loaderTimer){ clearTimeout(loaderTimer); loaderTimer = null; }
    loader.classList.add('hidden');
  }
}

  /* ================== PREDIAL SUBMENU TOGGLE ================== */
/* FASE 2 — PREDIAL es un bloque del inicio, ya no un submenú plegable. */

/* ================== API ================== */
async function apiGet(action, params = {}){
  startLoading();
  try{
    const url = new URL(API_BASE);
    url.search = new URLSearchParams({ action, ...params }).toString();
    const r = await fetch(url.toString(), { method: 'GET' });
    const j = await r.json();
    if(!j.ok){ const er = new Error(j.error || 'Error'); er.codigo = j.codigo || ''; throw er; }
    return j.data;
  } finally { stopLoading(); }
}
async function apiPost(action, body = {}){
  startLoading();
  try{
    const url = API_BASE + '?action=' + encodeURIComponent(action);
    const r = await fetch(url, {
      method:'POST',
      headers: { 'Content-Type':'text/plain;charset=utf-8' },
      body: JSON.stringify(body)
    });
    const j = await r.json();
    if(!j.ok){ const er = new Error(j.error || 'Error'); er.codigo = j.codigo || ''; throw er; }
    return j.data;
  } finally { stopLoading(); }
}

/* FASE 8 — abre un archivo en el VISOR de la app (js/visor.js).
   Si el visor no cargó (404, red), se comporta como siempre: pestaña nueva.
   Así ningún listado se queda sin poder abrir su archivo. */
function verArchivo_(url, nombre, agregar){
  /* FASE 9 · ajuste 3 — si quien abre el visor pasa una función "agregar",
     el modal de previsualización muestra el botón ＋ Agregar con la misma
     acción del botón Agregar del explorador del modal EXPEDIENTE. */
  if(window.VISOR && typeof window.VISOR.abrir === 'function'){
    return window.VISOR.abrir(url, { nombre: nombre, agregar: agregar });
  }
  window.open(url, '_blank', 'noopener');
  return true;
}

/* ================== PWA ==================
   FASE 2 SEC-HACIENDA-FLANDES — la instalación la llevan las piezas del
   kit Flandes (kit/instalar.js: los 8 casos de instalación, también el
   iPhone por Compartir; kit/bienvenida.js: la portada). Aquí solo queda
   el arranque: la app abre SIEMPRE en el ingreso; la portada de instalar
   se pone encima cuando corresponde. */
async function initPWAVista(){
  showView('view-login');
}
if ('serviceWorker' in navigator){
  window.addEventListener('load', ()=>{
    navigator.serviceWorker.register('./sw.js').catch(()=>{});
  });
}
window.addEventListener('load', initPWAVista);

/* ================== VISTAS ================== */
function showView(id){
  for(const el of document.querySelectorAll('.view')) el.classList.remove('active');
  document.getElementById(id)?.classList.add('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

  /* ================== MODAL RESPUESTA LIMPIA ================== */
function openRespuestaLimpiaModal_(){
  const m = document.getElementById('modal-respuesta-limpia');
  if(!m) return;
  document.getElementById('respuesta-limpia').value = '';
  m.classList.remove('hidden');
  setTimeout(()=> document.getElementById('respuesta-limpia')?.focus(), 50);
}

function closeRespuestaLimpiaModal_(){
  const m = document.getElementById('modal-respuesta-limpia');
  if(!m) return;
  m.classList.add('hidden');
}

document.getElementById('btn-cerrar-respuesta-limpia')?.addEventListener('click', ()=>{
  playSoundOnce(SOUNDS.back);
  closeRespuestaLimpiaModal_();
});

document.getElementById('btn-enviar-respuesta-limpia')?.addEventListener('click', async ()=>{
  try{
    if(!currentUser){
      Swal.fire({ icon:'warning', title:'Sesión inválida' });
      return;
    }
    if(!currentCardSelected){
      Swal.fire({ icon:'warning', title:'Solicitud inválida' });
      return;
    }

    const respuesta = String(document.getElementById('respuesta-limpia').value || '').trim();
    if(!respuesta){
      Swal.fire({ icon:'warning', title:'Respuesta requerida', text:'Escribe un mensaje para enviar.' });
      return;
    }

    const ok = await Swal.fire({
      icon:'question',
      title:'Enviar RESPUESTA LIMPIA',
      text:'Esta acción marcará la solicitud como atendida y enviará mensaje al usuario.',
      showCancelButton:true,
      confirmButtonText:'Enviar',
      cancelButtonText:'Cancelar'
    });
    if(!ok.isConfirmed) return;

    const resMR = await apiPost('marcarRespuesta', conLista_({
      id_predial: currentCardSelected.id_predial,
      respuesta: respuesta,
      usuario: currentUser.nombre || ''
    }));

    closeRespuestaLimpiaModal_();
    Swal.fire({ icon:'success', title:'Enviado', timer:1400, showConfirmButton:false });

    await loadAndRenderList_(currentListMode, resMR && resMR.lista);
  }catch(e){
    Swal.fire({ icon:'error', title:'Error', text: String(e.message || e) });
  }
});

  /* ================== RESET FORMULARIO DE SOLICITUD PREDIAL ================== */
  function resetAgregarSolicitudForm_(){
  // Limpia inputs
  const p = document.getElementById('Propietario');
  const id = document.getElementById('identidad');
  const cel = document.getElementById('celular');
  if(p) p.value = '';
  if(id) id.value = '';
  if(cel) cel.value = '';

  // Limpia select (Choices si existe, si no, normal)
  const sel = document.getElementById('upd-residencia');
  try{
    if(choicesResidencia){
      choicesResidencia.removeActiveItems();
      // intenta dejarlo en vacío (sin seleccionar nada)
      choicesResidencia.setChoiceByValue('');
    } else if(sel){
      sel.value = '';
    }
  }catch(_){
    try{ if(sel) sel.value = ''; }catch(__){}
  }
}

/* FASE 2 — lo que se le agrega a una escritura de SOLICITUDES para que la
   respuesta traiga la lista ya actualizada (un solo viaje). */
function conLista_(body){
  return Object.assign({ uid: uidActual_(), devolverLista: currentListMode || 'PENDIENTE' }, body || {});
}

/* ================== VALIDACIONES ================== */
function onlyDigits(s){ return String(s||'').replace(/\D/g,''); }
function bindNumericSanitizer(id, maxLen){
  const el = document.getElementById(id);
  if(!el) return;
  el.addEventListener('input', ()=>{
    const raw = onlyDigits(el.value);
    el.value = maxLen ? raw.slice(0, maxLen) : raw;
  });
}
bindNumericSanitizer('login-doc', 10);
bindNumericSanitizer('identidad', 10);
/* (Cambio #1) Teléfono permite hasta 12 dígitos */
bindNumericSanitizer('celular', 12);

function validatePhone_(digits){
  const s = onlyDigits(digits);
  if(s.length === 10) return true;
  if(s.length === 12 && s.startsWith('57')) return true;
  return false;
}
function normalizePhoneForSave_(digits){
  const s = onlyDigits(digits);
  if(s.length === 12 && s.startsWith('57')) return s;
  if(s.length === 10) return '57' + s;
  throw new Error('Teléfono inválido');
}

document.getElementById('toggle-doc')?.addEventListener('click', ()=>{
  const el = document.getElementById('login-doc');
  const oculto = el.type === 'password';
  el.type = oculto ? 'text' : 'password';
  const b = document.getElementById('toggle-doc');
  if (b) {
    b.innerHTML = window.ICO_ ? window.ICO_(oculto ? 'ojo-tapado' : 'ojo', 18) : '';
    b.setAttribute('aria-label', oculto ? 'Ocultar documento' : 'Mostrar documento');
  }
});

/* ================== ESTADO ================== */
let currentUser = null; // { documento, nombre, isSuper, uid, roles }

/* FASE 5 — el uid (huella del documento) es lo único que se manda al
   servidor para identificarse. Lo pone js/identidad.js al iniciar
   sesión; si aún no está, se pide a IDN directamente. */
function uidActual_(){
  if (currentUser && currentUser.uid) return currentUser.uid;
  try{
    const p = window.IDN && window.IDN.perfil ? window.IDN.perfil() : null;
    if (p && p.uid) return p.uid;
  }catch(_){}
  return '';
}
let currentListMode = 'PENDIENTE'; // PENDIENTE | ATENDIDA CHAT | ATENDIDA PRESENCIAL
let currentCardSelected = null; // card object
let choicesResidencia = null;

  /* ================== PERMISOS DE VISTAS ==================
     FASE 5 — se acabaron las listas de nombres en el código.
     Quién ve qué lo decide el servidor (Alcance.gs) leyendo la
     columna ROLES de USUARIOS y las columnas de responsable de
     cada hoja. Aquí solo se consulta lo que llegó.

     window.ALC lo llena js/alcance.js al iniciar sesión. Mientras
     no haya llegado, todo es NO: nunca se muestra de más.
     ======================================================== */
window.ALC = window.ALC || null;

function alcListo_(){ return !!(window.ALC && window.ALC.encontrado); }

function alcVer_(llave){
  return alcListo_() && !!(window.ALC.ver && window.ALC.ver[llave]);
}
function alcPuede_(llave){
  return alcListo_() && !!(window.ALC.puede && window.ALC.puede[llave]);
}
function alcRol_(rol){
  return alcListo_() && Array.isArray(window.ALC.roles) &&
         window.ALC.roles.indexOf(rol) !== -1;
}
function alcCatalogo_(nombre){
  if(!alcListo_() || !window.ALC.catalogos) return [];
  return window.ALC.catalogos[nombre] || [];
}
/** Teléfono de alguien, buscado en los catálogos que trajo el servidor. */
function alcContactoDe_(nombre){
  const n = normalizeText_(nombre || '');
  if(!n) return '';
  const cs = window.ALC && window.ALC.catalogos ? window.ALC.catalogos : {};
  for(const k in cs){
    const lista = cs[k] || [];
    for(let i = 0; i < lista.length; i++){
      if(normalizeText_(lista[i].nombre) === n) return lista[i].contacto || '';
    }
  }
  return '';
}

function canSeeAtendidasChat_(){    return alcVer_('atendidasChat'); }
function canSeeAgregarSolicitud_(){ return alcVer_('agregarSolicitud'); }
function canSeePendientes_(){       return alcVer_('pendientes'); }
function canSeeAgregarAsignacion_(){return alcVer_('agregarAsignacion'); }


  /* ================== MI SEMÁFORO ================== */

/* FASE 7 — BORRADO: aquí vivía una PRIMERA versión de renderProcList_ (con
   makeIconBtn_ y llamadas a updateProceso / deleteProceso, acciones que NO
   existen en el router) que quedaba pisada por la versión buena de más
   abajo. Con ella se iba un segundo listener del buscador '#proc-filter'
   que usaba __procCache, una variable NUNCA declarada: lanzaba un
   ReferenceError en cada tecla. El buscador bueno está más abajo. */

  /* FASE 2: el botón "MIS PROCESOS" y su llamada getMisProcesosLink se
     eliminaron junto con la columna H de USUARIOS. */

// Regresar
document.getElementById('btn-asignaciones-back')?.addEventListener('click', () => {
  playSoundOnce(SOUNDS.back);
  showView('view-inicio');
});

/* ✅ Handlers (no duplicar en otra parte) */
document.getElementById('btn-estadisticas')?.addEventListener('click', async ()=>{
  playSoundOnce(SOUNDS.back);
  await openEstadisticas_();
});

document.getElementById('btn-estad-back')?.addEventListener('click', ()=>{
  playSoundOnce(SOUNDS.back);
  destroyEstadChart_();
  showView('view-inicio');
});

document.getElementById('btn-estad-tiempo')?.addEventListener('click', async ()=>{
  playSoundOnce(SOUNDS.back);
  await showEstadTiempo_();
});

document.getElementById('btn-estad-zonas')?.addEventListener('click', async ()=>{
  playSoundOnce(SOUNDS.back);
  await showEstadZonas_();
});

/* Seguridad: ocultar botón al logout */
document.getElementById('btn-logout')?.addEventListener('click', ()=>{
  try{
    const bEst = document.getElementById('btn-estadisticas');
    if(bEst) bEst.style.display = 'none';
  }catch(_){}
});

/* ================== DRIVE ANEXOS (NUEVO) ================== */
/* FASE 5 — la exclusión de Drive Anexos se mantiene, pero ya no vive
   en el código: es la llave 'drive.ocultar' de Configuración → Avanzado
   y la aplica el servidor. */
const DRIVE_ICON_EDIT = 'img/editar.webp';
const DRIVE_ICON_DRIVE = 'img/drive.webp';

let DRIVE_DATA = [];
let DRIVE_EDIT_TARGET = null;

function canSeeDriveAnexos_(){
  return alcVer_('driveAnexos');
}

function normalizeDriveFolderId_(link){
  const s = String(link || '').trim();
  if(!s) return '';
  const m1 = s.match(/\/folders\/([A-Za-z0-9_-]{10,})/);
  if(m1) return m1[1];
  const m2 = s.match(/[?&]id=([A-Za-z0-9_-]{10,})/);
  if(m2) return m2[1];
  return '';
}

function isValidGmail_(email){
  const e = String(email || '').trim().toLowerCase();
  if(!e) return false;
  return /^[a-z0-9._%+-]+@gmail\.com$/.test(e);
}

function openDriveEdit_(row){
  DRIVE_EDIT_TARGET = row;
  document.getElementById('drive-edit-nombre').textContent = String(row.nombre || '').trim();
  document.getElementById('drive-edit-correo').value = String(row.correo || '').trim();
  showView('view-drive-editar');
  setTimeout(()=> document.getElementById('drive-edit-correo')?.focus(), 50);
}

function renderDriveGrid_(list){
  const grid = document.getElementById('drive-grid');
  grid.innerHTML = '';

  /* FASE 7 — antes, si el nombre no calzaba con la hoja, la vista quedaba
     en blanco sin decir nada y parecía un error de la app. */
  if(!list.length){
    grid.innerHTML = '<p class="muted center" style="grid-column:1/-1;margin-top:20px;">' +
      'No hay carpetas para mostrar. Si crees que debería aparecer la tuya, ' +
      'avisa a la Secretaría: tu nombre en la hoja de usuarios debe coincidir.</p>';
    return;
  }

  list.forEach(row=>{
    const correo = String(row.correo || '').trim();
    const isRed = !correo;

    const card = document.createElement('div');
    card.className = 'drive-card ' + (isRed ? 'red' : 'green');

    const nameEl = document.createElement('div');
    nameEl.className = 'drive-name';
    nameEl.textContent = String(row.nombre || '').trim();

    const mailEl = document.createElement('div');
    mailEl.className = 'drive-mail';
    mailEl.textContent = correo || '';

    const iconRow = document.createElement('div');
    iconRow.className = 'icon-row';

    const btnEdit = document.createElement('button');
    btnEdit.type = 'button';
    btnEdit.className = 'btn-icon';
    btnEdit.setAttribute('aria-label','Editar correo');
    btnEdit.title = 'Editar correo';
    btnEdit.innerHTML = '<img src="' + DRIVE_ICON_EDIT + '" alt="Editar">';
    btnEdit.addEventListener('click', ()=>{
      playSoundOnce(SOUNDS.menu);
      openDriveEdit_(row);
    });

    const btnDrive = document.createElement('button');
    btnDrive.type = 'button';
    btnDrive.className = 'btn-icon';
    btnDrive.setAttribute('aria-label','Abrir carpeta Drive');
    btnDrive.title = 'Abrir carpeta Drive';
    btnDrive.innerHTML = '<img src="' + DRIVE_ICON_DRIVE + '" alt="Drive">';
    btnDrive.addEventListener('click', ()=>{
      playSoundOnce(SOUNDS.info);
      const link = String(row.enlace || '').trim();
      if(!link){
        Swal.fire({ icon:'info', title:'Sin carpeta', text:'Este registro no tiene enlace de carpeta.' });
        return;
      }
      window.open(link, '_blank', 'noopener');
    });

    iconRow.appendChild(btnEdit);
    iconRow.appendChild(btnDrive);

    card.appendChild(nameEl);
    card.appendChild(mailEl);
    card.appendChild(iconRow);

    grid.appendChild(card);
  });
}

/* El buscador solo tiene sentido cuando se ven varias tarjetas. */
function applyDriveFilter_(){
  const wrapFiltro = document.getElementById('drive-filter-row');
  const varias = DRIVE_DATA.length > 1;
  if (wrapFiltro) wrapFiltro.style.display = varias ? '' : 'none';

  const q = normalizeText_(document.getElementById('drive-filter')?.value || '');
  const lista = (!q || !varias)
    ? DRIVE_DATA
    : DRIVE_DATA.filter(r => normalizeText_((r.nombre || '') + ' ' + (r.correo || '')).includes(q));

  const cont = document.getElementById('drive-count');
  if (cont) cont.textContent = String(lista.length);
  renderDriveGrid_(lista);
}

/**
 * Regla pedida: al entrar a DRIVE ANEXOS, el usuario ve inicialmente SOLO su tarjeta (la que coincida con su nombre).
 * Igual dejamos el filtro disponible.
 */
/* FASE 7 — el recorte lo hace ahora el SERVIDOR: antes bajaban al
   navegador el nombre, el correo y el enlace de carpeta de los 26
   usuarios y el front se quedaba con una tarjeta. ADMIN y DEV reciben
   las de todo el equipo; cualquier otro, la suya. */
async function loadDriveData_(){
  const list = await apiGet('listDriveRows', { uid: uidActual_() });
  DRIVE_DATA = Array.isArray(list) ? list : [];
  applyDriveFilter_();
}

async function openDriveAnexosView_(){
  if(!currentUser){
    Swal.fire({ icon:'warning', title:'Sesión inválida' });
    return;
  }
  if(!canSeeDriveAnexos_()){
    // no mostrar nada (según requisito)
    return;
  }
  DRIVE_DATA = [];
  const fEl = document.getElementById('drive-filter');
  if (fEl) fEl.value = '';
  showView('view-drive-anexos');
  await loadDriveData_();
}

   /* ================== LOGIN ================== */
document.getElementById('btn-login')?.addEventListener('click', async ()=>{
  const doc = (document.getElementById('login-doc').value || '').trim();

  if(doc === ''){
    await Swal.fire({ icon:'question', title:'¿Deseas comenzar?', text:'Ingresa un Documento para validar.', timer:3000, showConfirmButton:false });
    return;
  }
  if(!/^\d{6,10}$/.test(doc)){
    await Swal.fire({ icon:'error', title:'CONTRASEÑA INCORRECTA', text:'La contraseña contiene entre 6 y 10 dígitos numéricos.', timer:3000, showConfirmButton:false });
    return;
  }

  try{
    const res = await apiGet('login', { documento: doc });

    if(!res?.encontrado){
      await Swal.fire({ icon:'info', title:'NO TIENES ACCESO AÚN', text:'Solicitar acceso a Secretaría de Hacienda.', timer:6000, showConfirmButton:false });
      return;
    }
    /* FASE 3 — con PIN, el documento solo identifica la cuenta: se pide el PIN. */
    if(res.requierePin){
      const ld = document.getElementById('login-doc'); if (ld) ld.value = '';
      if (window.IDN && window.IDN._pedirPin) window.IDN._pedirPin(res);
      return;
    }

    procesarLoginExitoso_(res, doc);
  }catch(e){
    Swal.fire({ icon:'error', title:'Error', text: e.message || String(e) });
  }
});

/* ================== PERMISOS DE LAS VISTAS ==================
   FASE 5 — un solo sitio que enciende y apaga los botones del menú.
   Se llama al iniciar sesión y otra vez cuando llega el alcance del
   servidor (js/alcance.js), porque ese viaje es asíncrono.
   Es idempotente: se puede llamar las veces que haga falta.
   ============================================================ */
/** Vuelca en currentUser lo que dijo el servidor.
    Hace falta una función aquí dentro porque `currentUser` es un `let`
    del ámbito de app.js: NO es una propiedad de window y js/alcance.js
    no puede tocarlo desde fuera. */
function aplicarAlcanceAlUsuario_(alc){
  if(!currentUser || !alc) return false;
  currentUser.isSuper = !!alc.isSuper;
  currentUser.roles   = alc.roles || [];
  if(alc.nombre)   currentUser.nombre   = alc.nombre;
  if(alc.contacto) currentUser.telefono = alc.contacto;
  if(alc.uid)      currentUser.uid      = alc.uid;
  return true;
}

function aplicarPermisosVistas_(){
  const botones = [
    ['btn-estadisticas',            function(){ return alcVer_('estadisticas'); }],
    ['btn-panel-dashboard',         function(){ return alcVer_('panel'); }],
    ['btn-semaforo',                function(){ return canSeeSemaforo_(); }],
    ['btn-agregar',                 function(){ return canSeeAgregarSolicitud_(); }],
    ['btn-bd-predial',              function(){ return canSeeBDPredial_(); }],
    ['btn-pendientes',              function(){ return canSeePendientes_(); }],
    ['btn-atenciones-registradas',  function(){ return canSeeAtendidasChat_(); }],
    ['btn-drive-anexos',            function(){ return canSeeDriveAnexos_(); }],
    /* FASE 6 — los 3 botones de descarga a Excel. Se encienden con la
       misma regla que la vista donde viven: tener filas a tu nombre. */
    ['btn-mis-informes',            function(){ return alcVer_('descargaSolicitudes'); }],
    ['btn-bdp-mis-exp',             function(){ return alcVer_('descargaPredial'); }],
    ['btn-mis-procesos',            function(){ return alcVer_('descargaProcesos'); }]
  ];
  for(let i = 0; i < botones.length; i++){
    try{
      const el = document.getElementById(botones[i][0]);
      if(el) el.style.display = botones[i][1]() ? '' : 'none';
    }catch(_){}
  }

  /* FASE 7 — la cabecera PREDIAL solo se enciende si hay algo debajo:
     antes quien no tenía ninguno de los 6 sub-botones abría un submenú
     vacío y parecía que la app estaba rota. */
  /* FASE 2 — cada bloque del inicio (Predial, Gestión…) se esconde solo si
     no le queda ninguna tarjeta encendida. Antes era el submenú plegable. */
  try{
    document.querySelectorAll('#view-inicio .bloque').forEach(function(bl){
      const hay = Array.from(bl.querySelectorAll('.acceso'))
        .some(b => b.style.display !== 'none' && !b.hidden);
      bl.hidden = !hay;
    });
  }catch(_){}
}

/* Todos los botones que dependen de quién entró. */
const APAGAR_AL_SALIR_ = [
  'btn-agregar', 'btn-pendientes', 'btn-atenciones-registradas', 'btn-bd-predial',
  'btn-estadisticas', 'btn-semaforo', 'btn-panel-dashboard', 'btn-drive-anexos',
  'btn-mis-informes', 'btn-bdp-mis-exp', 'btn-mis-procesos',
  'btn-cat-predial', 'predial-submenu'
];

/* ================== ÉXITO DE LOGIN (compartido doc + PIN) ================== */
function procesarLoginExitoso_(res, doc){
    currentUser = {
      documento: String(res.documento || doc),
      nombre: String(res.nombre || ''),
      isSuper: !!res.isSuper
    };

    aplicarPermisosVistas_();

    document.getElementById('inicio-nombre').textContent = (currentUser.nombre || '').toUpperCase();
    document.getElementById('inicio-sub').textContent = currentUser.isSuper ? 'ADMINISTRADOR' : 'USUARIO';

   playSoundOnce(SOUNDS.login);
    showView('view-inicio');
}

/* ================== LOGIN PIN ================== */
let __pinBuffer = '';

function pintarPinDots_(){
  document.querySelectorAll('.pin-dot').forEach((d,i)=>{
    d.classList.toggle('filled', i < __pinBuffer.length);
  });
}

function setupLoginPinUI_(){
  document.querySelectorAll('.login-tab').forEach(tab=>{
    tab.addEventListener('click', ()=>{
      document.querySelectorAll('.login-tab').forEach(t=>t.classList.remove('active'));
      tab.classList.add('active');
      const target = tab.dataset.tab;
      document.getElementById('tab-pin')?.classList.toggle('hidden', target !== 'pin');
      document.getElementById('tab-doc')?.classList.toggle('hidden', target !== 'doc');
      __pinBuffer = '';
      pintarPinDots_();
    });
  });

  /* FASE 2 — el teclado de PIN lo pinta identidad.js (primero la cuenta,
     después el PIN). Estas teclas viejas ya no existen en la página. */
  document.querySelectorAll('.pin-key').forEach(k=>{
    k.addEventListener('click', ()=>{
      const key = k.dataset.key;
      if(key === 'clear'){ __pinBuffer = ''; }
      else if(key === 'back'){ __pinBuffer = __pinBuffer.slice(0,-1); }
      else if(/^\d$/.test(key)){
        if(__pinBuffer.length < 4){ __pinBuffer += key; playSoundOnce(SOUNDS.menu); }
      }
      pintarPinDots_();
      if(__pinBuffer.length === 4) hacerLoginPin_();
    });
  });
}

async function hacerLoginPin_(){
  try{
    const data = await apiGet('loginPin', { pin: __pinBuffer }); // apiGet ya gestiona el loader
    if(!data?.encontrado){
      __pinBuffer = '';
      pintarPinDots_();
      await Swal.fire({ icon:'error', title:'PIN incorrecto', text:'Verifica tu PIN de 4 dígitos.', timer:2500, showConfirmButton:false });
      return;
    }
    procesarLoginExitoso_(data, '');
  }catch(e){
    __pinBuffer = '';
    pintarPinDots_();
    Swal.fire({ icon:'error', title:'Error', text: e.message || String(e) });
  }
}

setupLoginPinUI_();

/* ================== LOGOUT ================== */
document.getElementById('btn-logout')?.addEventListener('click', ()=>{
  stopPendientesAutoRefresh_();
  stopAsignacionesAutoRefresh_();
  playSoundOnce(SOUNDS.logout);
  currentUser = null;
  currentCardSelected = null;
  const ld = document.getElementById('login-doc'); if (ld) ld.value = '';
  /* FASE 7 — se apagan TODOS los botones del menú de una lista sola. La
     lista escrita a mano se había quedado corta: no apagaba Drive Anexos
     ni los 3 botones de descarga de la Fase 6. */
  APAGAR_AL_SALIR_.forEach(function(id){
    try{ const b = document.getElementById(id); if(b) b.style.display = 'none'; }catch(_){}
  });
  showView('view-login');
});

try{ const b = document.getElementById('btn-drive-anexos'); if(b) b.style.display = 'none'; }catch(_){}
try{ const b = document.getElementById('btn-estadisticas'); if(b) b.style.display = 'none'; }catch(_){}
try{ const b = document.getElementById('btn-semaforo');     if(b) b.style.display = 'none'; }catch(_){}
try{ const b = document.getElementById('btn-bd-predial'); if(b) b.style.display = 'none'; }catch(_){}

/* ================== INICIO: botones ================== */
document.getElementById('btn-pendientes')?.addEventListener('click', async ()=>{
  playSoundOnce(SOUNDS.back);

  if(!canSeePendientes_()){
    Swal.fire({ icon:'warning', title:'No tienes permiso para ver PENDIENTES' });
    return;
  }

  if(!currentUser){
    Swal.fire({ icon:'warning', title:'Sesión inválida' });
    return;
  }

  try{
    // ✅ Antes de entrar a la vista, validamos si hay filas
    const data = await apiGet('listSolicitudes', { estado: 'PENDIENTE' });
    const items = Array.isArray(data) ? data : [];

    if(items.length === 0){
      // Por si quedó algún refresco prendido
      stopPendientesAutoRefresh_();

      // ✅ No entrar a la vista, solo alert
      await showAlDiaAlert_();
      return;
    }

    // ✅ Sí hay filas -> entrar y renderizar
    currentListMode = 'PENDIENTE';
    document.getElementById('lista-title').textContent = 'PENDIENTES PREDIAL';
    document.getElementById('lista-filter').value = '';
    __listCache = items;
    renderList_(__listCache);
    showView('view-lista');

    // ✅ Auto-refresh cada 30s solo en Pendientes
    startPendientesAutoRefresh_();
  }catch(e){
    Swal.fire({ icon:'error', title:'Error', text: String(e.message || e) });
  }
});

document.getElementById('btn-agregar')?.addEventListener('click', ()=>{
  playSoundOnce(SOUNDS.back);

  if(!canSeeAgregarSolicitud_()){
    Swal.fire({ icon:'warning', title:'No tienes permiso para AGREGAR SOLICITUD' });
    return;
  }

  initResidenciaChoices_();
  resetAgregarSolicitudForm_(); // <-- resetea al iniciar la vista
  showView('view-agregar');
});

  /* FASE 2: el botón "MIS INFORMES PREDIAL" y su llamada getMisInformesLink se
     eliminaron junto con la columna G de USUARIOS. */

/* ================== LISTA: render + filtro ================== */
let __listCache = [];

/* ================== AUTO REFRESH PENDIENTES (NUEVO) ================== */
let __pendientesIntervalId = null;
const PENDIENTES_REFRESH_MS = 15000;

function startPendientesAutoRefresh_(){
  // Evita duplicar intervalos
  stopPendientesAutoRefresh_();

  __pendientesIntervalId = setInterval(async ()=>{
    try{
      /* FASE 12 — con el EN VIVO conectado este reloj NO pide nada: las
         vistas se actualizan por aviso de Firebase. El intervalo queda
         solo como red de seguridad para cuando el EN VIVO se cae (ahí
         HACVIVO.activo() devuelve false y el reloj vuelve a trabajar). */
      if(window.HACVIVO && typeof window.HACVIVO.activo === 'function' && window.HACVIVO.activo()) return;
      try{ console.warn('[RELOJ] recarga automática de PENDIENTES (EN VIVO apagado)'); }catch(_){}
      // Solo refrescar si:
      // 1) estoy en modo PENDIENTE
      // 2) la vista lista está activa (el usuario realmente está viendo la lista)
      const vistaListaActiva = document.getElementById('view-lista')?.classList.contains('active');
      if(currentListMode !== 'PENDIENTE') return;
      if(!vistaListaActiva) return;

      // Respeta el filtro actual (si el usuario está buscando algo)
      const q = String(document.getElementById('lista-filter')?.value || '').trim();

      // Carga lista actualizada desde backend
      await loadAndRenderList_('PENDIENTE');

      // Si había filtro, lo reaplicamos (dispara el listener o filtra manual)
      if(q){
        document.getElementById('lista-filter').value = q;
        const evt = new Event('input', { bubbles:true });
        document.getElementById('lista-filter').dispatchEvent(evt);
      }
    }catch(_){
      // Silencioso: no molestamos al usuario cada 30s si hay un fallo puntual
    }
  }, PENDIENTES_REFRESH_MS);
}

function stopPendientesAutoRefresh_(){
  if(__pendientesIntervalId){
    clearInterval(__pendientesIntervalId);
    __pendientesIntervalId = null;
  }
}

  /* ================== AUTO REFRESH ASIGNACIONES ================== */
let __asignacionesIntervalId = null;
const ASIGNACIONES_REFRESH_MS = 60000; // 60 segundos

function startAsignacionesAutoRefresh_() {
  // Evita duplicar intervalos
  stopAsignacionesAutoRefresh_();

  __asignacionesIntervalId = setInterval(async () => {
    try {
      /* FASE 12 — con el EN VIVO conectado este reloj NO pide nada: las
         vistas se actualizan por aviso de Firebase. El intervalo queda
         solo como red de seguridad para cuando el EN VIVO se cae (ahí
         HACVIVO.activo() devuelve false y el reloj vuelve a trabajar). */
      if(window.HACVIVO && typeof window.HACVIVO.activo === 'function' && window.HACVIVO.activo()) return;
      try{ console.warn('[RELOJ] recarga automática de ASIGNACIONES (EN VIVO apagado)'); }catch(_){}
      // Solo refrescar si la vista asignaciones está activa
      const vistaActiva = document.getElementById('view-asignaciones')?.classList.contains('active');
      if (!vistaActiva) return;

      // Respeta el filtro actual (si el usuario está buscando algo)
      const q = String(document.getElementById('proc-filter')?.value || '').trim();

      // Carga lista actualizada desde backend
      await loadAndRenderProcesos_();

      // Si había filtro, lo reaplicamos
      if (q) {
        document.getElementById('proc-filter').value = q;
        const evt = new Event('input', { bubbles: true });
        document.getElementById('proc-filter').dispatchEvent(evt);
      }
    } catch (_) {
      // Silencioso: no interrumpir al usuario
    }
  }, ASIGNACIONES_REFRESH_MS);
}

function stopAsignacionesAutoRefresh_() {
  if (__asignacionesIntervalId) {
    clearInterval(__asignacionesIntervalId);
    __asignacionesIntervalId = null;
  }
}
  
function normalizeText_(s){
  return String(s||'')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g,'')
    .toUpperCase();
}





/* Normaliza una zona: quita el espacio + número romano final
   Ej: "ARAGON I" → "ARAGON", "ORQUIDEAS REAL IV" → "ORQUIDEAS REAL" */
function normalizeZona_(barrio) {
  if (!barrio) return '';
  let s = String(barrio).trim().toUpperCase();
  s = s.replace(/\s+[IVX]+$/i, '').trim();
  return s;
}

  function showAlDiaAlert_(){
  return Swal.fire({
    icon: 'success',
    title: 'Estás al día',
    html: 'No hay solicitudes pendientes. Cuando llegue una nueva, la verás aquí.',
    timer: 3200,
    showConfirmButton: false
  });
}

async function loadAndRenderList_(estado, listaYa){
  /* FASE 2 — un solo viaje: si la escritura trajo la lista nueva, se pinta
     esa; si no, se pide. */
  const data = Array.isArray(listaYa) ? listaYa : await apiGet('listSolicitudes', { estado });
  __listCache = Array.isArray(data) ? data : [];
  /* FASE 7 — antes pintaba la caché entera: cada refresco (y con el motor
     EN VIVO llegan solos) borraba lo que el usuario tenía filtrado. */
  aplicarFiltroLista_();
}

/** Un solo sitio decide qué se ve en PENDIENTES: la caché pasada por el
    buscador. Lo usan el listener del input y cada recarga. */
function aplicarFiltroLista_(){
  const q = normalizeText_(document.getElementById('lista-filter')?.value || '');
  if(!q){ renderList_(__listCache); return; }
  renderList_(__listCache.filter(it=>{
    const blob = normalizeText_([
      it.id_predial, it.nombre, it.documento, it.barrio, it.whatsapp,
      it.codigo, it.solicitud, it.fecha, it.estado, it.observacion, it.respondida
    ].join(' '));
    return blob.includes(q);
  }));
}

function renderList_(items){
  const wrap = document.getElementById('lista-wrap');
  wrap.innerHTML = '';

  document.getElementById('lista-count').textContent = String(items.length);

  if(!items.length){
    const p = document.createElement('p');
    p.className = 'muted center';
    p.textContent = 'No hay registros.';
    wrap.appendChild(p);
    return;
  }

  for(const it of items){
    const card = document.createElement('div');
    card.className = 'sol-card';

    const head = document.createElement('div');
    head.className = 'sol-head';

    const title = document.createElement('p');
    title.className = 'sol-title';
    title.innerHTML = `Usuario: <b>${escapeHtml_(it.nombre || '')}</b>`;

    head.appendChild(title);

    const meta = document.createElement('div');
    meta.className = 'sol-meta';

    const respondedExtra = (currentListMode === 'ATENDIDA CHAT' && it.respondida && String(it.respondida).trim())
  ? `<p><span style="color:#16a34a;font-weight:1000;">RESPONDIDA:</span> ${escapeHtml_(it.respondida)}</p>`
  : '';

    meta.innerHTML = `
      <p>Documento / NIT: ${escapeHtml_(it.documento || '')}</p>
      <p>Residencia: ${escapeHtml_(it.barrio || '')}</p>
      <p>Código Catastral: ${escapeHtml_(it.codigo || '')}</p>
      <p>Solicitud: ${escapeHtml_(it.solicitud || '')}</p>
      <p><span style="color:#dc2626;font-weight:1000;">Fecha:</span> ${escapeHtml_(it.fecha || '')}</p>
      ${respondedExtra}
    `;

    const actions = document.createElement('div');
    actions.className = 'sol-actions';

    const btnResp = document.createElement('button');
    btnResp.className = 'btn-respond';
    btnResp.type = 'button';
    btnResp.innerHTML = ICO_('recibo', 16) + ' Responder y adjuntar';
    btnResp.addEventListener('click', async ()=>{
      currentCardSelected = it;
      await openRespuestaViewWithCheck_();
    });

    const icons = document.createElement('div');
    icons.className = 'right-icons';

    // Icono AL DÍA
    const alDiaBtn = document.createElement('button');
    alDiaBtn.className = 'icon-btn';
    alDiaBtn.type = 'button';
    alDiaBtn.title = 'AL DÍA';
    alDiaBtn.innerHTML = `<img src="img/al-dia.webp" alt="AL DÍA">`;
    alDiaBtn.addEventListener('click', async ()=>{
      const ok = await Swal.fire({
        icon:'question',
        title:'Marcar como AL DÍA',
        text:'Esta acción marcará la solicitud como atendida y enviará mensaje al usuario.',
        showCancelButton:true,
        confirmButtonText:'Sí, continuar',
        cancelButtonText:'Cancelar'
      });
      if(!ok.isConfirmed) return;
      const r1 = await apiPost('marcarAlDia', conLista_({ id_predial: it.id_predial, usuario: currentUser ? (currentUser.nombre || '') : '' }));
      await loadAndRenderList_(currentListMode, r1 && r1.lista);
      Swal.fire({ icon:'success', title:'Listo', timer:1400, showConfirmButton:false });
    });

    // Icono NO ENCONTRADO
    const noBtn = document.createElement('button');
    noBtn.className = 'icon-btn';
    noBtn.type = 'button';
    noBtn.title = 'NO ENCONTRADO';
    noBtn.innerHTML = `<img src="img/no-found.webp" alt="NO ENCONTRADO">`;
    noBtn.addEventListener('click', async ()=>{
      const ok = await Swal.fire({
        icon:'question',
        title:'Marcar como NO ENCONTRADO',
        text:'Esta acción marcará la solicitud como atendida y enviará mensaje al usuario.',
        showCancelButton:true,
        confirmButtonText:'Sí, continuar',
        cancelButtonText:'Cancelar'
      });
      if(!ok.isConfirmed) return;
      const r2 = await apiPost('marcarNoEncontrado', conLista_({ id_predial: it.id_predial, usuario: currentUser ? (currentUser.nombre || '') : '' }));
      await loadAndRenderList_(currentListMode, r2 && r2.lista);
      Swal.fire({ icon:'success', title:'Listo', timer:1400, showConfirmButton:false });
    });

    // Icono RESPUESTA LIMPIA
const respLimpiaBtn = document.createElement('button');
respLimpiaBtn.className = 'icon-btn';
respLimpiaBtn.type = 'button';
respLimpiaBtn.title = 'RESPUESTA LIMPIA';
respLimpiaBtn.innerHTML = `<img src="img/mensaje.webp" alt="RESPUESTA LIMPIA">`;
respLimpiaBtn.addEventListener('click', async ()=>{
  currentCardSelected = it;
  playSoundOnce(SOUNDS.menu);
  openRespuestaLimpiaModal_();
});

    // Icono DAR DE BAJA (solo en PENDIENTES)
    const bajaBtn = document.createElement('button');
    bajaBtn.className = 'icon-btn';
    bajaBtn.type = 'button';
    bajaBtn.title = 'DAR DE BAJA';
    bajaBtn.innerHTML = `<img src="img/eliminar.webp" alt="DAR DE BAJA">`;
    bajaBtn.addEventListener('click', async ()=>{
     playSoundOnce(SOUNDS.warning);
      const ok = await Swal.fire({
        icon: 'warning',
        title: 'DAR DE BAJA',
        html: `
          <div style="text-align:left; font-size:.92rem; line-height:1.55;">
            <p style="margin:0 0 10px;"><b>Esta acción no se puede deshacer.</b></p>
            <p style="margin:0 0 10px;">El registro será <b>eliminado permanentemente</b> de la hoja SOLICITUDES.</p>
            <p style="margin:0; color:#b91c1c; font-weight:800;">
              Realiza esta acción ÚNICAMENTE si la solicitud ya fue referida o atendida en el Grupo de WhatsApp de solicitudes.
            </p>
          </div>
        `,
        showCancelButton: true,
        confirmButtonText: 'Sí, dar de baja',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#dc2626'
      });
      if(!ok.isConfirmed) return;

      try{
        const r3 = await apiPost('darDeBajaSolicitud', conLista_({
          id_predial: it.id_predial,
          usuario: currentUser ? (currentUser.nombre || '') : ''
        }));
        await loadAndRenderList_(currentListMode, r3 && r3.lista);

        // Si ya no quedan pendientes, salir y mostrar "AL DÍA"
        if(__listCache.length === 0){
          stopPendientesAutoRefresh_();
          showView('view-inicio');
          await showAlDiaAlert_();
          return;
        }

        Swal.fire({ icon:'success', title:'Solicitud dada de baja', timer:1400, showConfirmButton:false });
      }catch(e){
        Swal.fire({ icon:'error', title:'Error', text: String(e.message || e) });
      }
    });

    icons.appendChild(respLimpiaBtn);
    icons.appendChild(alDiaBtn);
    icons.appendChild(noBtn);
    icons.appendChild(bajaBtn);

    actions.appendChild(btnResp);
    actions.appendChild(icons);

    card.appendChild(head);
    card.appendChild(meta);
    card.appendChild(actions);

    wrap.appendChild(card);
  }
}

function escapeHtml_(s){
  return String(s||'')
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#039;');
}

document.getElementById('lista-filter')?.addEventListener('input', aplicarFiltroLista_);

document.getElementById('lista-back')?.addEventListener('click', ()=>{
  playSoundOnce(SOUNDS.back);

  // ✅ NUEVO: parar refresco al salir
  stopPendientesAutoRefresh_();

  showView('view-inicio');
});

/* ================== RESPUESTA SOLICITUD ================== */
const MAX_PDF_MB = 2;
function isPdfFile_(file){
  if(!file) return false;
  const nameOk = /\.pdf$/i.test(String(file.name||''));
  const typeOk = String(file.type||'').toLowerCase() === 'application/pdf';
  return nameOk || typeOk;
}
function setPdfStatus_(id, file){
  const el = document.getElementById(id + '-status');
  if(!el) return;
  if(!file){ el.textContent = ''; return; }
  el.textContent = `CARGADO: ${file.name}`;
}

['recibo1','recibo2','recibo3','recibo4','recibo5'].forEach(id=>{
  const inp = document.getElementById(id);
  if(!inp) return;
  inp.addEventListener('change', async ()=>{
    const file = inp.files && inp.files[0] ? inp.files[0] : null;
    setPdfStatus_(id, null);
    if(!file) return;

    if(!isPdfFile_(file)){
      inp.value = '';
      await Swal.fire({ icon:'warning', title:'Archivo inválido', text:'Solo se permiten archivos PDF.' });
      return;
    }
    const sizeMB = file.size/(1024*1024);
    if(sizeMB > MAX_PDF_MB){
      inp.value = '';
      await Swal.fire({ icon:'warning', title:'Archivo muy pesado', text:`El PDF supera ${MAX_PDF_MB} MB.` });
      return;
    }
    setPdfStatus_(id, file);
  });
});

/* (Cambio #3) Al entrar a RESPONDER - ADJUNTAR: validación por estado solo en PENDIENTES */
async function openRespuestaViewWithCheck_(){
  if(!currentCardSelected){
    Swal.fire({ icon:'warning', title:'Selecciona una solicitud' });
    return;
  }

  // Solo la vista PENDIENTE hace verificación fuerte
  if(currentListMode === 'PENDIENTE'){
    try{
      const still = await apiGet('getSolicitudById', { id_predial: currentCardSelected.id_predial });
      const estadoNow = String(still?.estado || '').toUpperCase().trim();

      if(estadoNow !== 'PENDIENTE'){
        await Swal.fire({ icon:'info', title:'YA FUE RESPONDIDA', timer:2000, showConfirmButton:false });
        // refresca lista de pendientes para que desaparezca
        await loadAndRenderList_('PENDIENTE');
        return;
      }
    }catch(_){
      // si falla la consulta, por seguridad dejamos pasar a responder
    }
  }

  openRespuestaView_();
}

function openRespuestaView_(){
  if(!currentCardSelected){
    Swal.fire({ icon:'warning', title:'Selecciona una solicitud' });
    return;
  }

  document.getElementById('respuesta').value = '';
  ['recibo1','recibo2','recibo3','recibo4','recibo5'].forEach(id=>{
    const inp = document.getElementById(id);
    if(inp) inp.value = '';
    setPdfStatus_(id, null);
  });

    const v = document.getElementById('vigencia');
  if(v) v.value = '';

       // Mostrar resumen centrado (igual a la tarjeta de PENDIENTES)
  const rh = document.getElementById('resp-head');
  if(rh && currentCardSelected){
    rh.innerHTML = `
      <div style="font-weight:1000; margin-bottom:6px;">Usuario: <b>${escapeHtml_(currentCardSelected.nombre || '')}</b></div>
      <div style="display:grid; gap:4px; font-weight:800; color:var(--text-sub);">
        <div>Documento / NIT: ${escapeHtml_(currentCardSelected.documento || '')}</div>
        <div>Residencia: ${escapeHtml_(currentCardSelected.barrio || '')}</div>
        <div>Código Catastral: ${escapeHtml_(currentCardSelected.codigo || '')}</div>
        <div>Solicitud: ${escapeHtml_(currentCardSelected.solicitud || '')}</div>
        <div>Fecha: ${escapeHtml_(currentCardSelected.fecha || '')}</div>
      </div>
    `;
  }

  showView('view-respuesta');
}

async function fileToBase64_(file){
  const dataUrl = await new Promise((resolve, reject)=>{
    const r = new FileReader();
    r.onload = ()=> resolve(String(r.result||''));
    r.onerror = ()=> reject(new Error('No se pudo leer el archivo'));
    r.readAsDataURL(file);
  });
  return (dataUrl.split(',')[1] || '');
}

document.getElementById('resp-back')?.addEventListener('click', ()=>{
  playSoundOnce(SOUNDS.back);
  showView('view-lista');
});

document.getElementById('resp-guardar')?.addEventListener('click', async ()=>{
  if(!currentCardSelected){
    Swal.fire({ icon:'warning', title:'Solicitud inválida' });
    return;
  }

  const respuesta = String(document.getElementById('respuesta').value || '').trim();
  const files = ['recibo1','recibo2','recibo3','recibo4','recibo5']
    .map(id => document.getElementById(id)?.files?.[0] || null)
    .filter(Boolean);

  if(files.length < 1){
    await Swal.fire({ icon:'warning', title:'Adjunta al menos 1 PDF', text:'Debes adjuntar mínimo un recibo.' });
    return;
  }

    const vigencia = String(document.getElementById('vigencia').value || '').trim();
  if(!vigencia){
    await Swal.fire({ icon:'warning', title:'Vigencia requerida', text:'Selecciona una vigencia.' });
    return;
  }

  const ok = await Swal.fire({
    icon:'question',
    title:'Guardar respuesta',
    text:`Se guardarán ${files.length} PDF(s) y se enviará mensaje al usuario.`,
    showCancelButton:true,
    confirmButtonText:'Guardar',
    cancelButtonText:'Cancelar'
  });
  if(!ok.isConfirmed) return;

  const pdfs = [];
  for(let i=0;i<files.length;i++){
    pdfs.push({ filename: files[i].name, base64: await fileToBase64_(files[i]) });
  }

  const r4 = await apiPost('guardarRespuesta', conLista_({
    id_predial: currentCardSelected.id_predial,
    respuesta: respuesta,
    vigencia: vigencia,
    pdfs: pdfs,
    usuario: currentUser ? (currentUser.nombre || '') : ''
  }));

  await Swal.fire({ icon:'success', title:'Enviado', timer:1500, showConfirmButton:false });

  showView('view-lista');
  await loadAndRenderList_(currentListMode, r4 && r4.lista);
});

/* ================== AGREGAR SOLICITUD (presencial) ================== */
function initResidenciaChoices_(){
  if(choicesResidencia) return;
  const el = document.getElementById('upd-residencia');
  if(!el) return;
  choicesResidencia = new Choices(el, {
    searchEnabled: true,
    itemSelectText: '',
    shouldSort: false
  });
}

function validateTwoWords_(s){
  const parts = String(s||'').trim().split(/\s+/).filter(Boolean);
  return parts.length >= 2;
}

/* (Cambio #1) buscar contacto por documento y autocompletar A/B/C/D */
document.getElementById('btn-buscar-contacto')?.addEventListener('click', async ()=>{
  try{
    if(!currentUser){
      Swal.fire({ icon:'warning', title:'Sesión inválida' });
      return;
    }
    const doc = onlyDigits(document.getElementById('identidad').value || '');
    if(!/^\d{6,10}$/.test(doc)){
      // no alertas si no está / inválido: solo no hacer nada (como pediste, sin enredos)
      return;
    }

    const found = await apiGet('buscarContacto', { documento: doc });
    if(!found?.encontrado) return;

    // autocompletar
    if(found.nombre) document.getElementById('Propietario').value = String(found.nombre);
    if(found.whatsapp) document.getElementById('celular').value = onlyDigits(found.whatsapp);

    // residencia: solo si existe exactamente en el select
    if(found.barrio){
      const val = String(found.barrio).toUpperCase().trim();
      const sel = document.getElementById('upd-residencia');
      const exists = Array.from(sel.options).some(o => String(o.value).toUpperCase().trim() === val);
      if(exists){
        try{
          choicesResidencia?.setChoiceByValue(val);
        }catch(_){
          sel.value = val;
        }
      }
    }
  }catch(_){
    // sin alertas
  }
});

document.getElementById('add-back')?.addEventListener('click', ()=>{
  playSoundOnce(SOUNDS.back);
  showView('view-inicio');
});

document.getElementById('add-guardar')?.addEventListener('click', async ()=>{
  if(!currentUser){
    Swal.fire({ icon:'warning', title:'Sesión inválida' });
    return;
  }
  const propietario = String(document.getElementById('Propietario').value||'').trim();
  const identidad = onlyDigits(document.getElementById('identidad').value||'');
  const residencia = String(document.getElementById('upd-residencia').value||'').trim();
  const celularRaw = onlyDigits(document.getElementById('celular').value||'');

  if(!validateTwoWords_(propietario)){
    Swal.fire({ icon:'warning', title:'Nombre inválido', text:'Debe contener al menos 2 palabras.' });
    return;
  }
  if(!/^\d{6,10}$/.test(identidad)){
    Swal.fire({ icon:'warning', title:'Documento/NIT inválido', text:'Debe tener entre 6 y 10 dígitos.' });
    return;
  }
  if(!residencia){
    Swal.fire({ icon:'warning', title:'Residencia requerida' });
    return;
  }
  if(!validatePhone_(celularRaw)){
    Swal.fire({ icon:'warning', title:'Teléfono inválido', text:'Debe tener 10 dígitos, o 12 si empieza con 57.' });
    return;
  }

  // (Cambio solicitado) quitamos el resumen/confirm modal de guardar
  // Guardar directo
  await apiPost('agregarSolicitudPresencial', {
    propietario,
    identidad,
    residencia,
    celular: normalizePhoneForSave_(celularRaw), // ya normalizado (con 57 si aplica)
    usuario: currentUser ? (currentUser.nombre || '') : ''
  });

  await Swal.fire({ icon:'success', title:'Guardado', timer:1400, showConfirmButton:false });

  // Limpiar campos
  document.getElementById('Propietario').value = '';
  document.getElementById('identidad').value = '';
  document.getElementById('celular').value = '';
  try{ document.getElementById('upd-residencia').value = ''; choicesResidencia?.setChoiceByValue(''); }catch(_){}

 // Ir a INICIO (requisito nuevo)
  showView('view-inicio');
});

  /* ===== DRIVE ANEXOS: botones ===== */
document.getElementById('btn-drive-anexos')?.addEventListener('click', async ()=>{
  playSoundOnce(SOUNDS.back);
  try{
    await openDriveAnexosView_();
  }catch(e){
    Swal.fire({ icon:'error', title:'Error', text: String(e.message || e) });
  }
});

/* FASE 7 — buscador de Drive Anexos (solo se ve con varias tarjetas). */
document.getElementById('drive-filter')?.addEventListener('input', applyDriveFilter_);

document.getElementById('btn-drive-regresar')?.addEventListener('click', ()=>{
  playSoundOnce(SOUNDS.back);
  showView('view-inicio');
});

document.getElementById('btn-drive-back-edit')?.addEventListener('click', ()=>{
  playSoundOnce(SOUNDS.back);
  DRIVE_EDIT_TARGET = null;
  showView('view-drive-anexos');
});

document.getElementById('btn-drive-guardar')?.addEventListener('click', async ()=>{
  if(!DRIVE_EDIT_TARGET){
    Swal.fire({ icon:'warning', title:'Registro inválido' });
    return;
  }

  const newEmail = String(document.getElementById('drive-edit-correo').value || '').trim().toLowerCase();
  if(!isValidGmail_(newEmail)){
    Swal.fire({ icon:'warning', title:'Correo inválido', text:'Debes ingresar un correo @gmail.com válido.' });
    return;
  }

  const oldEmail = String(DRIVE_EDIT_TARGET.correo || '').trim().toLowerCase();
  if(!normalizeDriveFolderId_(String(DRIVE_EDIT_TARGET.enlace || '').trim())){
    Swal.fire({ icon:'error', title:'Carpeta inválida', text:'Este registro no tiene una carpeta de Drive válida.' });
    return;
  }

  try{
    /* FASE 7 — el folderId ya NO viaja: el servidor lo saca de la hoja y
       comprueba que esa fila sea tuya (o que seas ADMIN/DEV). */
    const rDr = await apiPost('updateDriveCorreo', {
      uid: uidActual_(),
      rowIndex: DRIVE_EDIT_TARGET.rowIndex,
      newEmail,
      oldEmail
    });

    Swal.fire({ icon:'success', title:'Guardado', timer:1600, showConfirmButton:false });

    /* FASE 2 — la lista nueva viene en la misma respuesta */
    if (rDr && Array.isArray(rDr.lista)) { DRIVE_DATA = rDr.lista; applyDriveFilter_(); }
    else await loadDriveData_();
    DRIVE_EDIT_TARGET = null;
    showView('view-drive-anexos');
  }catch(e){
    Swal.fire({ icon:'error', title:'Error', text: String(e.message || e) });
  }
});

  /* ============================================================
   MI SEMÁFORO 🚦 — Lógica JavaScript
   Agregar al final del bloque <script> de index.html
   ============================================================ */

/* FASE 5 — GRUPOS_SEMAFORO y COORDINADORES_CONTACTO3 eliminados.
   Ya no hay parejas fijas abogado–asistente ni tabla de teléfonos:
   cada persona lleva el suyo en la columna CONTACTO de USUARIOS y el
   servidor lo manda en el alcance. */

function getContacto3ByCoordinador_(nombre) {
  return alcContactoDe_(nombre);
}

/* Teléfono del usuario que tiene la sesión abierta. */
function getContactoUsuarioLogueado_() {
  if (!currentUser) return '';
  if (alcListo_() && window.ALC.contacto) return String(window.ALC.contacto);
  return String(currentUser.telefono || '');
}

/* ── FASE 7 · FESTIVOS DE COLOMBIA, CALCULADOS ──────────────────
   Antes era una lista escrita a mano solo para 2026 (y le faltaban el
   1 y el 12 de enero). Ahora salen del año que sea: los fijos, los que
   la Ley Emiliani corre al lunes siguiente y los que dependen de la
   Pascua. Misma lógica que en el backend, para que los días hábiles
   den igual en los dos lados.                                       */
const __FEST_CACHE = {};

function festPascua_(anio) {
  const a = anio % 19, b = Math.floor(anio / 100), c = anio % 100;
  const d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(anio, mes - 1, dia);
}

function festLunes_(fecha) {
  const d = new Date(fecha);
  const dow = d.getDay();
  if (dow !== 1) d.setDate(d.getDate() + ((8 - dow) % 7));
  return d;
}

function festDelAnio_(anio) {
  if (__FEST_CACHE[anio]) return __FEST_CACHE[anio];
  const set = new Set();
  const meter = d => set.add(formatDDMMYYYY_(d));

  [[0,1],[4,1],[6,20],[7,7],[11,8],[11,25]]
    .forEach(x => meter(new Date(anio, x[0], x[1])));
  [[0,6],[2,19],[5,29],[7,15],[9,12],[10,1],[10,11]]
    .forEach(x => meter(festLunes_(new Date(anio, x[0], x[1]))));

  const pascua = festPascua_(anio);
  [-3, -2, 43, 64, 71].forEach(n => {
    const d = new Date(pascua);
    d.setDate(d.getDate() + n);
    meter(d);
  });

  __FEST_CACHE[anio] = set;
  return set;
}

function esFestivo_(fecha) {
  return festDelAnio_(fecha.getFullYear()).has(formatDDMMYYYY_(fecha));
}

const CAT_ICONS = {
  'GESTIÓN DE IMPUESTOS (FACTURACIÓN)':         'img/categoria1.png',
  'COBRO COACTIVO Y PERSUASIVO':                'img/categoria2.png',
  'PETICIONES Y RELACIONES CIUDADANAS (PQRSD)': 'img/categoria3.png',
  'RECURSOS DE LEY (DEFENSA DEL CIUDADANO)':    'img/categoria4.png',
  'TUTELA':                                     'img/alerta.webp'
};

const SUBCAT_ICONS = {
  'LIQUIDACIÓN DE IMPUESTOS (FACTURACIÓN)':     'img/subcategoria1-1.png',
  'EXENCIONES Y BENEFICIOS TRIBUTARIOS':        'img/subcategoria1-2.png',
  'REVISIONES DE AVALÚO O TARIFA':              'img/subcategoria1-3.png',
  'DEVOLUCIONES O COMPENSACIONES DE SALDO':     'img/subcategoria1-4.png',
  'ETAPA PERSUASIVA (INVITACIÓN AL PAGO)':      'img/subcategoria2-1.png',
  'ETAPA COACTIVA (EMBARGOS Y EJECUCIÓN)':      'img/subcategoria2-2.png',
  'FACILIDADES DE PAGO (ACUERDOS)':             'img/subcategoria2-3.png',
  'DERECHO DE PETICIÓN DE INFORMACIÓN':         'img/subcategoria3-1.png',
  'CERTIFICACIONES Y CONSTANCIAS':              'img/subcategoria3-2.png',
  'QUEJAS, RECLAMOS Y SUGERENCIAS':             'img/subcategoria3-3.png',
  'RECURSO DE REPOSICIÓN':                      'img/subcategoria4-1.png',
  'RECURSO DE RECONSIDERACIÓN':                 'img/subcategoria4-2.png',
  'REVOCATORIA DIRECTA':                        'img/subcategoria4-3.png'
};

const SUBCAT_POR_CAT = {
  'GESTIÓN DE IMPUESTOS (FACTURACIÓN)': [
    'LIQUIDACIÓN DE IMPUESTOS (FACTURACIÓN)',
    'EXENCIONES Y BENEFICIOS TRIBUTARIOS',
    'REVISIONES DE AVALÚO O TARIFA',
    'DEVOLUCIONES O COMPENSACIONES DE SALDO'
  ],
  'COBRO COACTIVO Y PERSUASIVO': [
    'ETAPA PERSUASIVA (INVITACIÓN AL PAGO)',
    'ETAPA COACTIVA (EMBARGOS Y EJECUCIÓN)',
    'FACILIDADES DE PAGO (ACUERDOS)'
  ],
  'PETICIONES Y RELACIONES CIUDADANAS (PQRSD)': [
    'DERECHO DE PETICIÓN DE INFORMACIÓN',
    'CERTIFICACIONES Y CONSTANCIAS',
    'QUEJAS, RECLAMOS Y SUGERENCIAS'
  ],
 'RECURSOS DE LEY (DEFENSA DEL CIUDADANO)': [
    'RECURSO DE REPOSICIÓN',
    'RECURSO DE RECONSIDERACIÓN',
    'REVOCATORIA DIRECTA'
  ],
  'TUTELA': []
};

const ETAPAS_POR_CAT = {
  'GESTIÓN DE IMPUESTOS (FACTURACIÓN)': [
    'Recepción y Análisis','Requerimiento de Información',
    'Proyección de Acto Administrativo','Notificación','Firmeza'
  ],
  'COBRO COACTIVO Y PERSUASIVO': [
    'Verificación de Título Ejecutivo','Mandamiento de Pago',
    'Investigaciones de Bienes / Medidas Cautelares',
    'Resolución de Excepciones','Terminación y Archivo'
  ],
  'PETICIONES Y RELACIONES CIUDADANAS (PQRSD)': [
    'En Trámite / Reparto Interno','Solicitud de Concepto Técnico',
    'Respuesta Proyectada','Respuesta Enviada / Finalizado'
  ],
 'RECURSOS DE LEY (DEFENSA DEL CIUDADANO)': [
 'Auto Admisorio','Práctica de Pruebas','Fallo de Segunda Instancia'
  ],
  'TUTELA': [
    'Recepción y Reparto',
    'Contestación / Respuesta a la Tutela',
    'Fallo de Primera Instancia',
    'Impugnación',
    'Fallo de Segunda Instancia',
    'Cumplimiento del Fallo'
  ]
};

/* ── Colores de borde por categoría / subcategoría ──────── */
const CAT_COLORS = {
  'GESTIÓN DE IMPUESTOS (FACTURACIÓN)':         { border: '#1e40af', bg: '#dbeafe' }, // azul oscuro / azul claro
  'COBRO COACTIVO Y PERSUASIVO':                { border: '#15803d', bg: '#dcfce7' }, // verde oscuro / verde claro
  'PETICIONES Y RELACIONES CIUDADANAS (PQRSD)': { border: '#6d28d9', bg: '#ede9fe' }, // lila oscuro / lila claro
  'RECURSOS DE LEY (DEFENSA DEL CIUDADANO)':    { border: '#c2410c', bg: '#ffedd5' }, // naranja oscuro / naranja claro
  'TUTELA':                                     { border: '#dc2626', bg: '#fee2e2' }  // rojo oscuro / rojo claro
};

// Mapa: subcategoría → su categoría padre (para heredar color más claro)
const SUBCAT_TO_CAT = {
  'LIQUIDACIÓN DE IMPUESTOS (FACTURACIÓN)':  'GESTIÓN DE IMPUESTOS (FACTURACIÓN)',
  'EXENCIONES Y BENEFICIOS TRIBUTARIOS':     'GESTIÓN DE IMPUESTOS (FACTURACIÓN)',
  'REVISIONES DE AVALÚO O TARIFA':           'GESTIÓN DE IMPUESTOS (FACTURACIÓN)',
  'DEVOLUCIONES O COMPENSACIONES DE SALDO':  'GESTIÓN DE IMPUESTOS (FACTURACIÓN)',
  'ETAPA PERSUASIVA (INVITACIÓN AL PAGO)':   'COBRO COACTIVO Y PERSUASIVO',
  'ETAPA COACTIVA (EMBARGOS Y EJECUCIÓN)':   'COBRO COACTIVO Y PERSUASIVO',
  'FACILIDADES DE PAGO (ACUERDOS)':          'COBRO COACTIVO Y PERSUASIVO',
  'DERECHO DE PETICIÓN DE INFORMACIÓN':      'PETICIONES Y RELACIONES CIUDADANAS (PQRSD)',
  'CERTIFICACIONES Y CONSTANCIAS':           'PETICIONES Y RELACIONES CIUDADANAS (PQRSD)',
  'QUEJAS, RECLAMOS Y SUGERENCIAS':          'PETICIONES Y RELACIONES CIUDADANAS (PQRSD)',
  'RECURSO DE REPOSICIÓN':                   'RECURSOS DE LEY (DEFENSA DEL CIUDADANO)',
  'RECURSO DE RECONSIDERACIÓN':              'RECURSOS DE LEY (DEFENSA DEL CIUDADANO)',
  'REVOCATORIA DIRECTA':                     'RECURSOS DE LEY (DEFENSA DEL CIUDADANO)'
};

function getCatColor_(catName) {
  const key = normalizeText_(catName || '');
  return Object.entries(CAT_COLORS).find(([k]) => normalizeText_(k) === key)?.[1] || null;
}
function getSubcatColor_(subcatName) {
  const catKey = SUBCAT_TO_CAT[subcatName] ||
    Object.entries(SUBCAT_TO_CAT).find(([k]) => normalizeText_(k) === normalizeText_(subcatName))?.[1];
  return catKey ? CAT_COLORS[catKey] || null : null;
}

const ICONO_JURIDICO   = 'img/juridico.png';
const ICONO_CHINCHETA  = 'img/chincheta.png';
const ICONO_ELIMINAR   = 'img/eliminar.webp';
const ICONO_EDITAR     = 'img/editar.webp';
const ICONO_VER        = 'img/mostrar.png';
const ICONO_FIRMA      = 'img/firma.webp';
const ICONO_REBOTAR    = 'img/devolver.webp';
const ICONO_INBOX      = 'img/inbox.webp';
const ICONO_OUTBOX     = 'img/outbox.webp';
const ICONO_MEMORIA    = 'img/memoria.webp';

/* FASE 2 SEC-HACIENDA-FLANDES — la llave de BuilderBot ya NO vive en el
   navegador (estaba a la vista de cualquiera en un repo público). Todos
   los WhatsApp los manda el servidor con las plantillas de Configuración. */

/* ── ARCHIVO: quien lleva la bitácora del expediente ──
   FASE 5 — antes era el nombre y el teléfono de SOL MAR escritos a
   mano. Ahora es el rol ARCHIVO de la hoja USUARIOS: si mañana lo
   lleva otra persona, se le da el rol y ya. */

function getPrefijo_(nombreCompleto) {
  // Retorna los dos primeros nombres en mayúsculas
  const partes = String(nombreCompleto || '')
    .replace(/\s+/g, ' ').trim().toUpperCase().split(' ').filter(Boolean);
  return partes.slice(0, 2).join(' ');
}

function esArchivo_() {
  return alcRol_('ARCHIVO');
}

/** Teléfonos de quienes tienen el rol ARCHIVO (puede ser más de uno). */
function telsArchivo_() {
  const lista = alcCatalogo_('archivo');
  const out = [];
  for (let i = 0; i < lista.length; i++) {
    const t = String(lista[i].contacto || '').trim();
    if (t) out.push(t);
  }
  return out;
}

/* Compatibilidad con el nombre viejo. */
function esSolMar_() { return esArchivo_(); }

/* ── Filtro por estado (pastillas) ───────────────────────── */
let __procStatusFilter = 'ALL';

/* ====================================================================
   FASE 9 · ASIGNACIONES — barra compacta de filtros
   Mismo aparato visual que BD Predial (.vf): un chip por filtro, el panel
   se despliega al tocarlo y el chip queda con lo elegido.

   · ESTADO      → las pastillas de siempre (ocultas) siguen mandando.
   · ASIGNADO    → se arma con los nombres que traen las filas cargadas.
   · VENCIMIENTO → Vencidos / Vence hoy / Vence próximamente / Más de 3 días.

   Al entrar a la vista los tres arrancan en "Todos".
   ==================================================================== */
let __procFiltroAsignado = 'ALL';
let __procFiltroVence    = 'ALL';
/* 17/09 — SOLICITUD EXPEDIENTE: ALL | PENDIENTE | RESPONDIDA | NINGUNA */
let __procFiltroSolexp   = 'ALL';

/** Estado de la solicitud de expediente de una fila (js/solicitud-exp.js).
 *  Sin el módulo, toda fila cuenta como "sin solicitud" y el filtro no
 *  esconde nada que no deba. */
function solexpEstado_(row, vista) {
  try {
    if (window.SOLEXP && typeof window.SOLEXP.estadoFila === 'function') {
      return window.SOLEXP.estadoFila(row, vista);
    }
  } catch (_) {}
  return 'NINGUNA';
}

/** Opciones del filtro con su número al lado. */
function solexpOpciones_(filas, vista) {
  const c = { PENDIENTE: 0, RESPONDIDA: 0, NINGUNA: 0 };
  (filas || []).forEach(r => { c[solexpEstado_(r, vista)]++; });
  const n = v => ' (' + v.toLocaleString('es-CO') + ')';
  return [
    { valor: 'ALL',        texto: 'Todas' },
    { valor: 'PENDIENTE',  texto: 'Pendientes de respuesta' + n(c.PENDIENTE) },
    { valor: 'RESPONDIDA', texto: 'Respondidas' + n(c.RESPONDIDA) },
    { valor: 'NINGUNA',    texto: 'Sin solicitud' + n(c.NINGUNA) }
  ];
}

const PROC_VENCE = [
  { id: 'ALL',      etiqueta: 'Todos' },
  { id: 'VENCIDOS', etiqueta: 'Vencidos' },
  { id: 'HOY',      etiqueta: 'Vence hoy' },
  { id: 'PRONTO',   etiqueta: 'Vence próximamente' },
  { id: 'LEJOS',    etiqueta: 'Más de 3 días' }
];

/** Nombre corto para que el chip no se desborde (igual que SUSTANCIADOR). */
function procNombreCorto_(nombre) {
  const p = String(nombre || '').trim().split(/\s+/);
  return p.length <= 2 ? p.join(' ') : (p[0] + ' ' + p[p.length - 2]);
}

/** Grupo de vencimiento de una fila. '' = no aplica (FINALIZADO o sin fecha). */
function procGrupoVence_(row) {
  const estado = String(row.estado || '').trim().toUpperCase();
  if (estado === 'FINALIZADO') return '';
  const d = parseDDMMYYYYtoDate_(row.respuesta);
  if (!d) return '';
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  if (d.getTime() <  hoy.getTime()) return 'VENCIDOS';
  if (d.getTime() === hoy.getTime()) return 'HOY';
  /* diasHabiles_ cuenta los dos extremos: mañana = 2, pasado hábil = 3.
     Es el mismo número que la tarjeta muestra en "Faltan X días". */
  const faltan = diasHabiles_(formatDDMMYYYY_(hoy), row.respuesta);
  return (faltan <= 3) ? 'PRONTO' : 'LEJOS';
}

function procAsignados_() {
  const vistos = [];
  (Array.isArray(__procListCache) ? __procListCache : []).forEach(r => {
    const n = String(r.asignado || '').trim();
    if (n && vistos.indexOf(n) === -1) vistos.push(n);
  });
  return vistos.sort((a, b) => a.localeCompare(b, 'es'));
}

function procPastillasEstado_() {
  return Array.from(document.querySelectorAll('#proc-status-filter .proc-status-pill'));
}

function procCerrarPaneles_(menos) {
  document.querySelectorAll('#proc-filtros .vf').forEach(el => {
    if (el !== menos) el.classList.remove('abierto');
  });
}

/** Opciones vivas de cada chip: [{valor, texto}], la primera siempre "Todos". */
function procOpciones_(id) {
  if (id === 'estado') {
    return procPastillasEstado_().map(b => ({
      valor: b.dataset.status || 'ALL',
      texto: (b.textContent || '').trim()
    }));
  }
  if (id === 'asignado') {
    return [{ valor: 'ALL', texto: 'Todos' }].concat(
      procAsignados_().map(n => ({ valor: n, texto: procNombreCorto_(n) }))
    );
  }
  if (id === 'solexp') return solexpOpciones_(__procListCache, 'view-asignaciones');
  return PROC_VENCE.map(v => ({ valor: v.id, texto: v.etiqueta }));
}

function procValorActual_(id) {
  if (id === 'estado')   return __procStatusFilter || 'ALL';
  if (id === 'asignado') return __procFiltroAsignado || 'ALL';
  if (id === 'solexp')   return __procFiltroSolexp || 'ALL';
  return __procFiltroVence || 'ALL';
}

const PROC_FILTROS = [
  { id: 'estado',   titulo: 'ESTADO',      todas: 'Todos' },
  { id: 'asignado', titulo: 'ASIGNADO',    todas: 'Todos' },
  { id: 'vence',    titulo: 'VENCIMIENTO', todas: 'Todos' },
  { id: 'solexp',   titulo: 'SOLICITUD EXP.', todas: 'Todas' }
];

function procSincronizarFiltros_() {
  const barra = document.getElementById('proc-filtros');
  if (!barra) return;

  PROC_FILTROS.forEach(cfg => {
    const caja = barra.querySelector('.vf[data-vf="' + cfg.id + '"]');
    if (!caja) return;

    const ops    = procOpciones_(cfg.id);
    const actual = procValorActual_(cfg.id);
    const elegida = ops.find(o => o.valor === actual) || ops[0];
    const esTodas = !elegida || elegida.valor === 'ALL';

    const valor = caja.querySelector('.vf-valor');
    if (valor) valor.textContent = esTodas ? cfg.todas : elegida.texto;
    caja.querySelector('.vf-chip')?.classList.toggle('sel', !esTodas);

    const panel = caja.querySelector('.vf-panel');
    if (!panel) return;
    const firma = ops.map(o => o.valor + '=' + o.texto).join('|');
    if (panel.dataset.firma !== firma) {
      panel.dataset.firma = firma;
      panel.innerHTML = ops.map((o, i) =>
        '<button type="button" class="vf-op" data-i="' + i + '">' +
        escapeHtml_(o.texto) + '</button>'
      ).join('');
    }
    Array.from(panel.querySelectorAll('.vf-op')).forEach((op, i) => {
      op.classList.toggle('activa', ops[i] && ops[i].valor === actual);
    });
  });
}

function procMontarFiltros_() {
  const barra = document.getElementById('proc-filtros');
  if (!barra || barra.dataset.listo === '1') return;
  barra.dataset.listo = '1';

  barra.innerHTML = PROC_FILTROS.map(cfg =>
    '<div class="vf" data-vf="' + cfg.id + '">' +
      '<button type="button" class="vf-chip">' +
        '<span class="vf-titulo">' + cfg.titulo + '</span>' +
        '<span class="vf-valor">' + cfg.todas + '</span>' +
        '<span class="vf-flecha" aria-hidden="true">▾</span>' +
      '</button>' +
      '<div class="vf-panel"></div>' +
    '</div>'
  ).join('');

  barra.addEventListener('click', (e) => {
    const chip = e.target.closest('.vf-chip');
    if (chip) {
      const caja = chip.closest('.vf');
      const abierto = caja.classList.contains('abierto');
      procCerrarPaneles_(null);
      if (!abierto) { caja.classList.add('abierto'); playSoundOnce(SOUNDS.menu); }
      return;
    }
    const op = e.target.closest('.vf-op');
    if (!op) return;
    const caja = op.closest('.vf');
    const id   = caja.dataset.vf;
    const ops  = procOpciones_(id);
    const eleg = ops[Number(op.dataset.i)];
    caja.classList.remove('abierto');
    if (!eleg) return;

    if (id === 'estado') {
      /* La pastilla de siempre sigue siendo la fuente de verdad. */
      const pas = procPastillasEstado_()[Number(op.dataset.i)];
      if (pas) { pas.click(); return; }   // el click ya repinta y sincroniza
    } else if (id === 'asignado') {
      __procFiltroAsignado = eleg.valor;
    } else if (id === 'solexp') {
      __procFiltroSolexp = eleg.valor;
    } else {
      __procFiltroVence = eleg.valor;
    }
    playSoundOnce(SOUNDS.menu);
    applyProcFilters_();
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('#proc-filtros')) procCerrarPaneles_(null);
  });

  procSincronizarFiltros_();
}

function applyProcFilters_() {
  let filtered = Array.isArray(__procListCache) ? __procListCache.slice() : [];

  // 1) Filtro por estado (pastilla)
  if (__procStatusFilter && __procStatusFilter !== 'ALL') {
    const target = normalizeText_(__procStatusFilter);
    filtered = filtered.filter(row => normalizeText_(row.estado || '') === target);
  }

  // 1.b) FASE 9 — filtro por ASIGNADO
  if (__procFiltroAsignado && __procFiltroAsignado !== 'ALL') {
    const objetivo = normalizeText_(__procFiltroAsignado);
    filtered = filtered.filter(row => normalizeText_(row.asignado || '') === objetivo);
  }

  // 1.c) FASE 9 — filtro por VENCIMIENTO
  if (__procFiltroVence && __procFiltroVence !== 'ALL') {
    filtered = filtered.filter(row => procGrupoVence_(row) === __procFiltroVence);
  }

  // 1.d) 17/09 — filtro por SOLICITUD EXPEDIENTE
  if (__procFiltroSolexp && __procFiltroSolexp !== 'ALL') {
    filtered = filtered.filter(row => solexpEstado_(row, 'view-asignaciones') === __procFiltroSolexp);
  }

  // 2) Filtro por texto (input que YA EXISTE — no se toca)
  const q = normalizeText_(document.getElementById('proc-filter')?.value || '');
  if (q) {
    filtered = filtered.filter(row => {
      const blob = normalizeText_([
        row.id_proceso, row.estado, row.recibido, row.consecutivo, row.descripcion,
        row.respuesta, row.medio, row.categoria, row.subcategoria, row.asignado,
        row.asistente, row.coordinador, row.etapa, row.bitacora,
        row.peticionario, row.expediente
      ].join(' '));
      return blob.includes(q);
    });
  }

  renderProcList_(filtered);
  procSincronizarFiltros_();
}

/* ── Estado global ──────────────────────────────────────── */
let currentProcesoSelected = null;
let __procListCache = [];
let __procFechaTarget = null; // 'recibido' | 'respuesta' | 'edit-recibido' | 'edit-respuesta' | 'edit-cierre'

/* ── Utilidades de fecha ────────────────────────────────── */
function parseDDMMYYYYtoDate_(str) {
  const s = String(str || '').trim();
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const d = parseInt(m[1], 10), mo = parseInt(m[2], 10), y = parseInt(m[3], 10);
  const dt = new Date(y, mo - 1, d);
  if (isNaN(dt.getTime())) return null;
  return dt;
}

function formatDDMMYYYY_(date) {
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${d}/${m}/${date.getFullYear()}`;
}

function formatFechaLarga_(str) {
  // dd/mm/yyyy → "Viernes, 10 de abril de 2026"
  const dt = parseDDMMYYYYtoDate_(str);
  if (!dt) return str || '';
  const dias   = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
  const meses  = ['enero','febrero','marzo','abril','mayo','junio',
                  'julio','agosto','septiembre','octubre','noviembre','diciembre'];
  return `${dias[dt.getDay()]}, ${dt.getDate()} de ${meses[dt.getMonth()]} de ${dt.getFullYear()}`;
}

function diasHabiles_(fechaIni, fechaFin) {
  // Retorna días hábiles INCLUYENDO ambos extremos (fechaIni y fechaFin).
  // "Faltan X días" cuenta desde hoy (inclusive) hasta el vencimiento (inclusive).
  // "Resp. en X días" cuenta desde recibido (inclusive) hasta cierre (inclusive).
  const a = parseDDMMYYYYtoDate_(fechaIni);
  const b = parseDDMMYYYYtoDate_(fechaFin);
  if (!a || !b) return 0;
  let count = 0;
  const cursor = new Date(a);   // ← arranca EN fechaIni (inclusive)
  const end    = new Date(b);
  const dir    = end >= cursor ? 1 : -1;
  while (dir === 1 ? cursor <= end : cursor >= end) {
    const dow  = cursor.getDay();
    if (dow !== 0 && dow !== 6 && !esFestivo_(cursor)) count += dir;
    cursor.setDate(cursor.getDate() + dir);
  }
  return count;
}

function calcSemaforo_(row) {
  const estado = String(row.estado || '').trim().toUpperCase();
  if (estado === 'FINALIZADO') {
    const dias = diasHabiles_(row.recibido, row.cierre);
    return { clase: 'semaforo-gris', texto: `Resp. en ${Math.abs(dias)} días`, cardClass: 'color-gris' };
  }
  const hoy    = formatDDMMYYYY_(new Date());
  const total  = diasHabiles_(row.recibido, row.respuesta);
  const faltan = diasHabiles_(hoy, row.respuesta);

  if (faltan <= 0) {
    // Vencido → rojo oscuro
    return {
      clase: 'semaforo-rojo',
      cardClass: 'color-rojo',
      texto: faltan === 0 ? 'Vence hoy' : `Venció hace ${Math.abs(faltan)} días`
    };
  }
  if (faltan <= 3) {
    // ≤ 3 días → rojo claro
    return {
      clase: 'semaforo-rojo-claro',
      cardClass: 'color-rojo-claro',
      texto: `Faltan ${faltan} días`
    };
  }
  if (total > 0 && (faltan / total) < 0.5) {
    // Menos de la mitad del plazo → naranja
    return {
      clase: 'semaforo-naranja',
      cardClass: 'color-naranja',
      texto: `Faltan ${faltan} días`
    };
  }
  // Más de la mitad del plazo → verde
  return {
    clase: 'semaforo-verde',
    cardClass: '',
    texto: `Faltan ${faltan} días`
  };
}

/* ── Visibilidad botón semáforo ─────────────────────────── */
function canSeeSemaforo_() {
  return alcVer_('semaforo');
}

function updateSemaforoBtn_() {
  try {
    const b = document.getElementById('btn-semaforo');
    if (b) b.style.display = canSeeSemaforo_() ? '' : 'none';
  } catch (_) {}
}

/* ── Picker de fechas para procesos ─────────────────────── */
(function initProcPicker_() {
  const dSel = document.getElementById('proc-picker-dia');
  const mSel = document.getElementById('proc-picker-mes');
  if (!dSel || !mSel || dSel.childElementCount) return;
  for (let d = 1; d <= 31; d++) {
    const o = document.createElement('option');
    o.value = String(d).padStart(2, '0');
    o.textContent = o.value;
    dSel.appendChild(o);
  }
  const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                 'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  meses.forEach((nm, i) => {
    const o = document.createElement('option');
    o.value = String(i + 1).padStart(2, '0');
    o.textContent = nm;
    mSel.appendChild(o);
  });
})();

function abrirProcPicker_(target) {
  __procFechaTarget = target;
  const m = document.getElementById('proc-fecha-modal');
  if (m) { m.classList.add('open'); m.setAttribute('aria-hidden', 'false'); }
}
// Alias global para los onclick del HTML
function abrirProcPicker(t) { abrirProcPicker_(t); }

function cancelarProcPicker() {
  const m = document.getElementById('proc-fecha-modal');
  if (m) { m.classList.remove('open'); m.setAttribute('aria-hidden', 'true'); }
  __procFechaTarget = null;
}

function confirmarProcPicker() {
  const dia = document.getElementById('proc-picker-dia')?.value || '01';
  const mes = document.getElementById('proc-picker-mes')?.value || '01';
  const val = `${dia}/${mes}/${new Date().getFullYear()}`;

  if (__procFechaTarget) {
    let inputId = '';
    switch (__procFechaTarget) {
      case 'recibido':       inputId = 'proc-recibido'; break;
      case 'respuesta':      inputId = 'proc-respuesta'; break;
      case 'edit-recibido':  inputId = 'edit-recibido'; break;
      case 'edit-respuesta': inputId = 'edit-respuesta'; break;
      case 'edit-cierre':    inputId = 'edit-cierre'; break;
    }
    if (inputId) {
      const el = document.getElementById(inputId);
      if (el) el.value = val;
    }
  }
  cancelarProcPicker();
}

/* ── Contactos de los formularios ───────────────────────
   FASE 5 — el asistente ya NO se deduce del abogado: se elige en su
   propio selector y puede quedar vacío. Lo único automático es el
   teléfono de cada uno, que sale de USUARIOS. */
function getGrupoByAsignado_(nombre) {
  const c = alcContactoDe_(nombre);
  return c ? { asignado: nombre, contacto1: c } : null;
}

/** Rellena solo los teléfonos ocultos a partir de lo elegido. */
function autoFillContactos_(prefijo) {
  const asignado = document.getElementById(prefijo + 'asignado');
  const asist    = document.getElementById(prefijo + 'asistente');
  const c1       = document.getElementById(prefijo + 'contacto1');
  const c2       = document.getElementById(prefijo + 'contacto2');
  if (c1) c1.value = asignado ? alcContactoDe_(asignado.value) : '';
  if (c2) c2.value = (asist && asist.value) ? alcContactoDe_(asist.value) : '';
}

/* Compatibilidad: el nombre viejo sigue funcionando. */
function autoFillAsistente_(asignadoVal, prefijo) {
  autoFillContactos_(prefijo);
}

/* ── Selector de categorías con iconos ──────────────────── */
function renderCatSelector_(containerId, selectId, selectedValue, prefijo) {
  const wrap = document.getElementById(containerId);
  if (!wrap) return;
  wrap.innerHTML = '';
  Object.entries(CAT_ICONS).forEach(([cat, iconUrl]) => {
    const color   = getCatColor_(cat);
    const borderC = color ? color.border : '#aaa';
    const bgC     = color ? color.bg     : '#f9f9f9';
    const isSelected = normalizeText_(selectedValue) === normalizeText_(cat);

    const pill = document.createElement('div');
    pill.className = 'cat-pill-colored clickable' + (isSelected ? ' selected' : '');
    pill.style.borderColor = borderC;
    pill.style.background  = bgC;
    pill.style.color       = borderC;
    pill.innerHTML = `<img src="${iconUrl}" alt="${cat}" /><span>${cat}</span>`;
    pill.title = cat;
    pill.addEventListener('click', () => {
      wrap.querySelectorAll('.cat-pill-colored').forEach(p => p.classList.remove('selected'));
      pill.classList.add('selected');
      const sel = document.getElementById(selectId);
      if (sel) sel.value = cat;
      renderSubcatSelector_(
        prefijo + 'subcat-selector',
        prefijo + 'subcategoria',
        cat, ''
      );
      if (prefijo === 'edit-') updateEditEtapas_(cat);
    });
    wrap.appendChild(pill);
  });

  const sel = document.getElementById(selectId);
  if (sel) {
    sel.innerHTML = '<option value="">— Selecciona —</option>';
    Object.keys(CAT_ICONS).forEach(cat => {
      const o = document.createElement('option');
      o.value = cat; o.textContent = cat;
      sel.appendChild(o);
    });
    if (selectedValue) sel.value = selectedValue;
  }
}

function renderSubcatSelector_(containerId, selectId, catVal, selectedValue) {
  const wrap = document.getElementById(containerId);
  if (!wrap) return;
  wrap.innerHTML = '';
  const subcats = SUBCAT_POR_CAT[catVal] || [];
  subcats.forEach(subcat => {
    const iconUrl = getSubcatIcon_(subcat);
    const color   = getSubcatColor_(subcat);
    const borderC = color ? color.border : '#aaa';
    // tono más claro: mezcla bg con un poco más de blanco
    const bgC     = color ? color.bg     : '#f9f9f9';
    const isSelected = normalizeText_(selectedValue) === normalizeText_(subcat);

    const pill = document.createElement('div');
    pill.className = 'cat-pill-colored clickable' + (isSelected ? ' selected' : '');
    // borde mismo color pero bg más claro (usamos opacity trick)
    pill.style.borderColor = borderC;
    pill.style.background  = bgC;
    pill.style.color       = borderC;
    pill.style.opacity     = '0.88'; // tono visualmente más claro que la cat
    pill.innerHTML = iconUrl
      ? `<img src="${iconUrl}" alt="${subcat}" /><span>${subcat}</span>`
      : `<span>${subcat}</span>`;
    pill.title = subcat;
    pill.addEventListener('click', () => {
      wrap.querySelectorAll('.cat-pill-colored').forEach(p => p.classList.remove('selected'));
      pill.classList.add('selected');
      const sel = document.getElementById(selectId);
      if (sel) sel.value = subcat;
    });
    wrap.appendChild(pill);
  });

  const sel = document.getElementById(selectId);
  if (sel) {
    sel.innerHTML = '<option value="">— Opcional —</option>';
    subcats.forEach(s => {
      const o = document.createElement('option');
      o.value = s; o.textContent = s;
      sel.appendChild(o);
    });
    if (selectedValue) sel.value = selectedValue;
  }
}

/* ── Normalizar icono de subcategoría ───────────────────── */
function getSubcatIcon_(subcat) {
  if (!subcat) return '';
  const key = normalizeText_(subcat);
  return Object.entries(SUBCAT_ICONS).find(([k]) => normalizeText_(k) === key)?.[1] || '';
}
function getCatIcon_(cat) {
  if (!cat) return '';
  const key = normalizeText_(cat);
  return Object.entries(CAT_ICONS).find(([k]) => normalizeText_(k) === key)?.[1] || '';
}

/* ── WhatsApp Builderbot ────────────────────────────────── */
function sendProcWA_(numero, mensaje) {
  /* FASE 2 — ya no se manda nada desde el navegador. Si algún módulo viejo
     la llama, se avisa en consola para encontrarlo. */
  try { console.warn('[sendProcWA_] obsoleto: los avisos los manda el servidor'); } catch (_) {}
}

/* ── Vista ASIGNACIONES ─────────────────────────────────── */
async function abrirVistaAsignaciones_(listaYa) {
  if (!currentUser) return;
  showView('view-asignaciones');
  document.getElementById('proc-filter').value = '';

  /* FASE 7 — al entrar, los filtros arrancan limpios (antes la pastilla
     de estado se quedaba marcada de la visita anterior). */
  __procStatusFilter = 'ALL';
  document.querySelectorAll('#proc-status-filter .proc-status-pill')
    .forEach(b => b.classList.toggle('active', (b.dataset.status || 'ALL') === 'ALL'));
  /* FASE 9 — los dos filtros nuevos también arrancan en "Todos". */
  __procFiltroAsignado = 'ALL';
  __procFiltroVence    = 'ALL';
  __procFiltroSolexp   = 'ALL';
  procMontarFiltros_();
  procSincronizarFiltros_();
  // Mostrar / ocultar botón agregar
  const btnAgregar = document.getElementById('btn-agregar-asignacion');
  if (btnAgregar) btnAgregar.style.display = canSeeAgregarAsignacion_() ? '' : 'none';

  await loadAndRenderProcesos_(listaYa);
  startAsignacionesAutoRefresh_();
}

/* FASE 2 SEC-HACIENDA-FLANDES — un solo viaje: si la acción que se acaba
   de guardar ya trajo la lista actualizada, se pinta esa y no se vuelve a
   pedir al servidor. */
async function loadAndRenderProcesos_(listaYa) {
  if (Array.isArray(listaYa)) {
    __procListCache = listaYa;
    applyProcFilters_();
    return;
  }
  /* FASE 5 — el navegador ya no dice a nombre de quién pide ni si es
     super: manda su uid y el servidor devuelve exactamente las filas
     donde esa persona es ASIGNADO o ASISTENTE (o todas, si es ADMIN,
     DEV o ARCHIVO). Aquí desapareció la suplantación por pareja. */
  const data = await apiGet('listProcesos', { uid: uidActual_() });
  __procListCache = Array.isArray(data) ? data : [];
  /* FASE 7 — antes pintaba la caché entera: la pastilla de estado seguía
     marcada pero la lista se veía completa, y con el motor EN VIVO pasaba
     solo cada vez que alguien guardaba un proceso. */
  applyProcFilters_();
}

function renderProcList_(items) {
  const wrap = document.getElementById('proc-list');
  const countEl = document.getElementById('proc-count');
  if (!wrap) return;
  wrap.innerHTML = '';
  if (countEl) countEl.textContent = String(items.length);

  if (!items.length) {
    wrap.innerHTML = '<p class="muted center" style="grid-column:1/-1;">No hay asignaciones.</p>';
    return;
  }

  for (const row of items) {
    const sem = calcSemaforo_(row);
    const catIcon  = getCatIcon_(row.categoria);
    const subcatIcon = getSubcatIcon_(row.subcategoria);
    const cat  = row.categoria  || '';
    const subcat = row.subcategoria || '';
    const etapa = row.etapa || '';

    const card = document.createElement('div');
    card.className = `proc-card ${sem.cardClass}`;

    // HEAD: asignado + estado
    const head = document.createElement('div');
    head.className = 'proc-head';

    const headLeft = document.createElement('div');
    headLeft.className = 'proc-head-left';
    headLeft.innerHTML = `
      <p class="proc-asignado">${escapeHtml_(row.asignado || '')}</p>
      ${row.asistente ? `<p class="proc-asistente">${escapeHtml_(row.asistente)}</p>` : ''}
    `;

    const headRight = document.createElement('div');
    headRight.className = 'proc-head-right';
    headRight.innerHTML = `
      <div class="proc-estado-badge ${sem.clase}">
        ${escapeHtml_(row.estado || '')}
        <span class="proc-dias-txt">${sem.texto}</span>
      </div>
    `;

    head.appendChild(headLeft);
    head.appendChild(headRight);
    card.appendChild(head);

    // Descripción con chincheta
    const desc = document.createElement('div');
    desc.className = 'proc-descripcion';
    desc.innerHTML = `
      <img src="${ICONO_CHINCHETA}" alt="📌" title="Asunto" />
      <span>${escapeHtml_(row.descripcion || '')}</span>
    `;
    card.appendChild(desc);

    // Fila categorías + etapa
    const catRow = document.createElement('div');
    catRow.className = 'cat-row';
        if (cat) catRow.innerHTML += `
      <div class="cat-pill" title="${escapeHtml_(cat)}">
        ${catIcon ? `<img src="${catIcon}" alt="${escapeHtml_(cat)}" />` : ''}
        <span>${escapeHtml_(cat)}</span>
      </div>`;
    if (subcat) catRow.innerHTML += `
      <div class="cat-pill" title="${escapeHtml_(subcat)}">
        ${subcatIcon ? `<img src="${subcatIcon}" alt="${escapeHtml_(subcat)}" />` : ''}
        <span>${escapeHtml_(subcat)}</span>
      </div>`;
    if (etapa) catRow.innerHTML += `
      <div class="etapa-col">
        <div class="etapa-badge-mini">
          <img src="img/juridico.png" alt="⚖️" />
          <span>Etapa Jurídica</span>
        </div>
        <span class="etapa-valor">${escapeHtml_(etapa)}</span>
      </div>`;
    card.appendChild(catRow);

    // Acciones
    const actions = document.createElement('div');
    actions.className = 'proc-actions';

    // Consultivo (consecutivo)
           const consWrap = document.createElement('div');
    consWrap.style.cssText = 'display:flex;flex-direction:column;gap:2px;';
    if (row.consecutivo) {
      const consEl = document.createElement('span');
      consEl.style.cssText = 'font-size:.70rem;font-weight:700;color:var(--text-muted);';
      consEl.textContent = 'CONSEC: ' + row.consecutivo;
      consWrap.appendChild(consEl);
    }
    if (row.peticionario) {
      const petEl = document.createElement('span');
      petEl.style.cssText = 'font-size:.68rem;font-weight:600;color:var(--text-sub);';
      petEl.textContent = 'PET: ' + row.peticionario;
      consWrap.appendChild(petEl);
    }
    if (row.expediente) {
      const expEl = document.createElement('span');
      expEl.style.cssText = 'font-size:.68rem;font-weight:700;color:var(--primary);';
      expEl.textContent = 'EXP: ' + row.expediente;
      consWrap.appendChild(expEl);
    }
    actions.appendChild(consWrap);

    const icons = document.createElement('div');
    icons.className = 'proc-icons';

    // Firmar (solo super)
    if (currentUser?.isSuper) {
      const btnFirma = _mkProcIconBtn_(ICONO_FIRMA, 'Decisión');
      btnFirma.addEventListener('click', () => {
        currentProcesoSelected = row;
        abrirDecision_(row);
      });
      icons.appendChild(btnFirma);
    }

    // Eliminar (solo super)
    if (currentUser.isSuper) {
      const btnElim = _mkProcIconBtn_(ICONO_ELIMINAR, 'Eliminar asignación');
      btnElim.addEventListener('click', async () => {
        const ok = await Swal.fire({
          icon: 'warning',
          title: '¿Eliminar asignación?',
          html: `<b>${escapeHtml_(row.descripcion || row.id_proceso)}</b><br>Esta acción es irreversible.`,
          showCancelButton: true, confirmButtonText: 'Eliminar', cancelButtonText: 'Cancelar'
        });
        if (!ok.isConfirmed) return;
        const rEl = await apiPost('eliminarProceso', { uid: uidActual_(), id_proceso: row.id_proceso });
        playSoundOnce(SOUNDS.success);
        await loadAndRenderProcesos_(rEl && rEl.lista);
      });
      icons.appendChild(btnElim);
    }

    // Ver
    const btnVer = _mkProcIconBtn_(ICONO_VER, 'Ver detalles');
    btnVer.addEventListener('click', () => {
      playSoundOnce(SOUNDS.menu);
      currentProcesoSelected = row;
      abrirVerAsignacion_(row);
    });
    icons.appendChild(btnVer);

    // Editar
    const estadoUpper = String(row.estado || '').toUpperCase();
    const puedeEditar = currentUser.isSuper || estadoUpper !== 'FINALIZADO';
    if (puedeEditar) {
      const btnEdit = _mkProcIconBtn_(ICONO_EDITAR, 'Editar asignación');
      btnEdit.addEventListener('click', () => {
        playSoundOnce(SOUNDS.menu);
        currentProcesoSelected = row;
        abrirEditarAsignacion_(row);
      });
      icons.appendChild(btnEdit);
    }

    actions.appendChild(icons);
    card.appendChild(actions);
    wrap.appendChild(card);
  }
}

function _mkProcIconBtn_(src, title) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'proc-icon-btn';
  btn.title = title;
  btn.setAttribute('aria-label', title);
  btn.innerHTML = `<img src="${src}" alt="${title}" />`;
  return btn;
}

// Filtro asignaciones (input de texto YA EXISTE en el HTML — solo cambiamos su lógica
// para que se combine con el filtro de pastillas)
document.getElementById('proc-filter')?.addEventListener('input', () => {
  applyProcFilters_();
});

// Handlers de las pastillas de estado
document.querySelectorAll('#proc-status-filter .proc-status-pill').forEach(btn => {
  btn.addEventListener('click', () => {
    playSoundOnce(SOUNDS.menu);
    document.querySelectorAll('#proc-status-filter .proc-status-pill')
      .forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    __procStatusFilter = btn.dataset.status || 'ALL';
    applyProcFilters_();
  });
});

// Botones vista asignaciones
document.getElementById('btn-agregar-asignacion')?.addEventListener('click', () => {
  playSoundOnce(SOUNDS.back);
  abrirAgregarAsignacion_();
});

  /* ================== PANEL DASHBOARD ================== */
document.getElementById('btn-panel-dashboard')?.addEventListener('click', async () => {
  playSoundOnce(SOUNDS.back);
  if (!currentUser || !currentUser.isSuper) {
    Swal.fire({ icon: 'warning', title: 'Solo SUPER USUARIO' });
    return;
  }
  await abrirPanel_();
});
  
document.getElementById('btn-asignaciones-back')?.addEventListener('click', () => {
  playSoundOnce(SOUNDS.back);
  stopAsignacionesAutoRefresh_();
  showView('view-inicio');
});
document.getElementById('btn-semaforo')?.addEventListener('click', async () => {
  playSoundOnce(SOUNDS.back);
  if (!currentUser) return;
  await abrirVistaAsignaciones_();
});

/* ── Vista AGREGAR ASIGNACIÓN ─────────────────────────────*/
function abrirAgregarAsignacion_() {
  // Limpiar form
  ['proc-recibido','proc-consecutivo','proc-respuesta'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  document.getElementById('proc-descripcion').value = '';
  const procPet = document.getElementById('proc-peticionario'); if (procPet) procPet.value = '';
  const procExp = document.getElementById('proc-expediente');   if (procExp) procExp.value = '';
  document.getElementById('proc-medio').value = '';
  document.getElementById('proc-asignado').value = '';
  document.getElementById('proc-asistente').value = '';
  document.getElementById('proc-contacto1').value = '';
  document.getElementById('proc-contacto2').value = '';
  // Coordinador y contacto3 del usuario logueado
  document.getElementById('proc-coordinador').value = currentUser?.nombre || '';
document.getElementById('proc-contacto3').value   = getContactoUsuarioLogueado_();
  // Files
  ['proc-recibido1','proc-recibido2','proc-recibido3'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
    const st = document.getElementById(id + '-status'); if (st) st.textContent = '';
  });
  // Selector categorías
  renderCatSelector_('proc-cat-selector', 'proc-categoria', '', 'proc-');
  renderSubcatSelector_('proc-subcat-selector', 'proc-subcategoria', '', '');

  showView('view-agregar-asignacion');
}

// Asignado → auto asistente/contactos
document.getElementById('proc-asignado')?.addEventListener('change', () => {
  autoFillContactos_('proc-');
});

// Validación archivos agregar
['proc-recibido1','proc-recibido2','proc-recibido3'].forEach(id => {
  document.getElementById(id)?.addEventListener('change', () => {
    const f = document.getElementById(id)?.files?.[0];
    const st = document.getElementById(id + '-status');
    if (!f) { if (st) st.textContent = ''; return; }
    if (f.size > 10 * 1024 * 1024) {
      document.getElementById(id).value = '';
      if (st) st.textContent = '';
      Swal.fire({ icon: 'warning', title: 'Archivo muy pesado', text: 'Máximo 10 MB por PDF.' });
      return;
    }
    if (st) st.textContent = `✓ ${f.name}`;
  });
});

/* ── Helper: si consecutivo es 100% numérico, anteponer ' para preservar ceros ── */
function formatConsecutivo_(value) {
  const s = String(value || '').trim();
  if (!s) return '';
  if (/^\d+$/.test(s)) return "'" + s;   // solo dígitos → anteponer '
  return s.toUpperCase();
}

// Guardar asignación
document.getElementById('btn-proc-add-guardar')?.addEventListener('click', async () => {
  // Validaciones
  const recibido     = document.getElementById('proc-recibido').value.trim();
  const consecutivo  = document.getElementById('proc-consecutivo').value.trim();
  const descripcion  = document.getElementById('proc-descripcion').value.trim();
  const respuesta    = document.getElementById('proc-respuesta').value.trim();
  const medio        = document.getElementById('proc-medio').value;
  const categoria    = document.getElementById('proc-categoria').value;
  const subcategoria = document.getElementById('proc-subcategoria')?.value || '';
  autoFillContactos_('proc-');
  const asignado     = document.getElementById('proc-asignado').value;
  const peticionario = (document.getElementById('proc-peticionario')?.value || '').trim().toUpperCase();
  const expediente   = (document.getElementById('proc-expediente')?.value   || '').trim().toUpperCase();
  const contacto1    = document.getElementById('proc-contacto1').value;
  const asistente    = document.getElementById('proc-asistente').value;
  const contacto2    = document.getElementById('proc-contacto2').value;
  const coordinador  = document.getElementById('proc-coordinador').value;
  const contacto3    = document.getElementById('proc-contacto3').value;

  if (!recibido)    { Swal.fire({ icon:'warning', title:'Fecha de Recibido requerida' }); return; }
  if (!consecutivo) { Swal.fire({ icon:'warning', title:'Consecutivo requerido' }); return; }
  if (!descripcion) { Swal.fire({ icon:'warning', title:'Asunto requerido' }); return; }
  if (!respuesta)   { Swal.fire({ icon:'warning', title:'Fecha de Respuesta requerida' }); return; }
 // Validar días mínimos (TUTELA no exige ningún mínimo)
  const hoy = formatDDMMYYYY_(new Date());
  if (categoria !== 'TUTELA') {
    if (diasHabiles_(hoy, respuesta) < 3) {
      Swal.fire({ icon:'warning', title:'Fecha muy cercana', text:'Selecciona al menos 3 días hábiles desde hoy.' });
      return;
    }
  }
  if (!medio)    { Swal.fire({ icon:'warning', title:'Medio requerido' }); return; }
  if (!categoria){ Swal.fire({ icon:'warning', title:'Categoría requerida' }); return; }

  // Subir archivos
  const files = {};
  for (const id of ['proc-recibido1','proc-recibido2','proc-recibido3']) {
    const f = document.getElementById(id)?.files?.[0];
    if (f) files[id.replace('proc-','')] = { filename: f.name, base64: await fileToBase64_(f) };
  }

  // Resumen
  const resumenHtml = buildResumenHtml_({
    'Recibido': recibido,
    'Consecutivo': consecutivo,
    'Asunto': descripcion,
    ...(peticionario ? { 'Peticionario': peticionario } : {}),
    ...(expediente   ? { 'N° EXP. INTERNO': expediente } : {}),
    'Respuesta': respuesta,
    'Medio': medio,
    'Categoría': categoria,
    'Subcategoría': subcategoria,
    'Asignado': asignado,
    'Asistente': asistente,
    'Documentos': Object.keys(files).length + ' archivo(s)'
  });
  
  const ok = await Swal.fire({
    icon: 'info', title: 'Confirmar Asignación',
    html: resumenHtml, showCancelButton: true,
    confirmButtonText: 'Guardar', cancelButtonText: 'Editar'
  });
  if (!ok.isConfirmed) return;

  try {
    const res = await apiPost('agregarProceso', {
      uid: uidActual_(),
      recibido, consecutivo: formatConsecutivo_(consecutivo),
      descripcion: descripcion.toUpperCase(), respuesta, medio,
      peticionario: peticionario,
      expediente:   expediente,
      categoria, subcategoria, asignado, contacto1, asistente,
      contacto2, coordinador, contacto3,
      recibido1: files['recibido1'] || null,
      recibido2: files['recibido2'] || null,
      recibido3: files['recibido3'] || null
    });

    /* FASE 2 — los WhatsApp al asignado y al asistente los manda el
       servidor (plantillas proc.asignacion y proc.apoyonuevo). */
    playSoundOnce(SOUNDS.success);
    if (asignado) {
      await Swal.fire({
        icon: 'success', title: 'Asignación guardada',
        html: `<b>Asignado:</b> ${escapeHtml_(asignado)}${asistente ? `<br><b>Apoyo:</b> ${escapeHtml_(asistente)}` : ''}` +
              `<br><small>${res && res.avisados ? 'Se les avisó por WhatsApp.' : 'Sin teléfono para avisar por WhatsApp.'}</small>`,
        timer: 3000, showConfirmButton: false
      });
    } else {
      await Swal.fire({
        icon: 'success', title: 'Registro guardado',
        html: 'No olvides asignarlo a tiempo.',
        timer: 2500, showConfirmButton: false
      });
    }
    await abrirVistaAsignaciones_(res && res.lista);
    return;
  } catch (e) {
    Swal.fire({ icon: 'error', title: 'Error', text: String(e.message || e) });
  }
});

document.getElementById('btn-proc-add-back')?.addEventListener('click', () => {
  playSoundOnce(SOUNDS.back);
  showView('view-asignaciones');
});

/* ── Vista VER DETALLES ─────────────────────────────────── */
function abrirVerAsignacion_(row) {
  const sem = calcSemaforo_(row);
  const catIcon    = getCatIcon_(row.categoria);
  const subcatIcon = getSubcatIcon_(row.subcategoria);

  // Header
  const header = document.getElementById('proc-ver-header');
  header.innerHTML = '';
  if (row.categoria) {
    header.innerHTML += `
      <div class="cat-pill" style="padding:8px 14px;">
        ${catIcon ? `<img src="${catIcon}" alt="${escapeHtml_(row.categoria)}" />` : ''}
        <span style="font-weight:700;">${escapeHtml_(row.categoria)}</span>
      </div>`;
  }
  if (row.subcategoria) {
    header.innerHTML += `
      <div class="cat-pill" style="padding:8px 14px;">
        ${subcatIcon ? `<img src="${subcatIcon}" alt="${escapeHtml_(row.subcategoria)}" />` : ''}
        <span style="font-weight:700;">${escapeHtml_(row.subcategoria)}</span>
      </div>`;
  }
      if (row.etapa) {
    header.innerHTML += `
      <div class="etapa-col">
        <div class="etapa-badge-mini">
          <img src="img/juridico.png" alt="⚖️" />
          <span>Etapa Jurídica</span>
        </div>
        <span class="etapa-valor">${escapeHtml_(row.etapa)}</span>
      </div>`;
  }
  header.innerHTML += `
    <div class="proc-estado-badge ${sem.clase}" style="min-width:140px;">
      ${escapeHtml_(row.estado || '')}
      <span class="proc-dias-txt">${sem.texto}</span>
    </div>`;

  // Cuerpo
  const body = document.getElementById('proc-ver-body');
  body.innerHTML = '';
   const addField = (label, value, esHTML) => {
    if (!value) return;
    const div = document.createElement('div');
    div.className = 'proc-detalle-field';
    const rendered = esHTML ? value : escapeHtml_(value).replace(/\n/g, '<br>');
    div.innerHTML = `<span class="proc-detalle-label">${label}</span>
      <span class="proc-detalle-value">${rendered}</span>`;
    body.appendChild(div);
  };
  addField('Asunto:',               row.descripcion);
  addField('Consecutivo:',          row.consecutivo);
  addField('Fecha de Recibido:',    formatFechaLarga_(row.recibido));
  addField('Medio:',                row.medio);
  addField('Fecha de Respuesta:',   formatFechaLarga_(row.respuesta));
  addField('Bitácora:', row.bitacora ? escapeHtml_(row.bitacora).replace(/\n/g, '<br>') : '', true);
  addField('Fecha de Cierre:',      formatFechaLarga_(row.cierre));
  addField('Asignado:',             row.asignado);
  addField('Asistente:',            row.asistente);

  // Evidencia
  const evWrap = document.getElementById('proc-ver-evidencia');
  const evImg  = document.getElementById('proc-ver-evidencia-img');
  if (row.evidencia) {
    evImg.src = row.evidencia;
    evWrap.style.display = '';
    /* FASE 8: la evidencia es una imagen y ya hay lightbox; se unifica.
       Antes esta era la única que se abría en pestaña nueva. */
    evImg.onclick = () => (typeof openLightbox_ === 'function'
      ? openLightbox_(row.evidencia)
      : window.open(row.evidencia, '_blank', 'noopener'));
  } else {
    evWrap.style.display = 'none';
  }

  // Archivos recibidos y respuestas
  const filesWrap = document.getElementById('proc-ver-files');
  filesWrap.innerHTML = '';
  const addFileIcon_ = (urls, srcIcon, label) => {
    const validUrls = urls.filter(Boolean);
    if (!validUrls.length) return;
    validUrls.forEach((url, idx) => {
      if (!url) return;
      const item = document.createElement('div');
      item.className = 'proc-file-item';
      item.title = `${label} ${idx + 1}`;
      item.innerHTML = `
        <img src="${srcIcon}" alt="${label}" />
        ${validUrls.length > 1 ? `<span class="proc-file-counter">${idx + 1}</span>` : ''}
        <span class="proc-file-label">${label} ${idx + 1}</span>`;
      /* FASE 8: se abre en el visor de la app, no en pestaña nueva */
      item.addEventListener('click', () => verArchivo_(url, `${label} ${idx + 1}`));
      filesWrap.appendChild(item);
    });
  };
  addFileIcon_([row.recibido1, row.recibido2, row.recibido3], ICONO_INBOX,  'Recibido');
  addFileIcon_([row.respuesta1, row.respuesta2, row.respuesta3], ICONO_OUTBOX, 'Respuesta');

  // Creación
  const creacionEl = document.getElementById('proc-ver-creacion');
  if (creacionEl && row.creacion) creacionEl.textContent = `Creada: ${row.creacion}`;

  // Botones acción
  const actionsWrap = document.getElementById('proc-ver-actions');
  actionsWrap.innerHTML = '';
  const estado = String(row.estado || '').toUpperCase();

  // Rebotar
  if (estado === 'ASIGNADO') {
    const btnRebotar = document.createElement('button');
    btnRebotar.type = 'button';
    btnRebotar.className = 'proc-action-btn proc-btn-rebotar';
    btnRebotar.title = 'Rebotar asignación';
    btnRebotar.innerHTML = `<img src="${ICONO_REBOTAR}" alt="Rebotar" /> REBOTAR`;
    btnRebotar.addEventListener('click', () => {
      document.getElementById('proc-rebote').value = '';
      document.getElementById('modal-rebotar').classList.remove('hidden');
    });
    actionsWrap.appendChild(btnRebotar);
  }

  // Editar
  const puedeEditar = currentUser.isSuper || estado !== 'FINALIZADO';
  if (puedeEditar) {
    const btnEditar = document.createElement('button');
    btnEditar.type = 'button';
    btnEditar.className = 'btn-primary proc-action-btn';
    btnEditar.style.width = 'auto';
    btnEditar.innerHTML = `<img src="${ICONO_EDITAR}" style="width:20px;height:20px;vertical-align:middle;" alt="Editar" /> EDITAR`;
    btnEditar.addEventListener('click', () => {
      playSoundOnce(SOUNDS.menu);
      abrirEditarAsignacion_(row);
    });
    actionsWrap.appendChild(btnEditar);
  }

  // Solicitar Finalización
  if (estado === 'PENDIENTE DE EVIDENCIA') {
    const btnFin = document.createElement('button');
    btnFin.type = 'button';
    btnFin.className = 'proc-action-btn';
    btnFin.style.cssText = 'background:linear-gradient(135deg,#7c3aed,#5b21b6);color:#fff;border:0;width:auto;';
    btnFin.title = 'Solicitar Finalización';
    btnFin.innerHTML = `<img src="${ICONO_MEMORIA}" class="proc-btn-finalizar" alt="Finalizar" style="width:28px;height:28px;" /> SOLICITAR FINALIZACIÓN`;
    btnFin.addEventListener('click', async () => {
      const ok = await Swal.fire({
        icon: 'success', title: 'FINALIZACIÓN DE ASIGNACIÓN',
        html: `Antes de realizar este proceso corrobora:<br>
          - Oficio(s) de respuesta firmado y adjuntado<br>
          - Bitácora Editada correctamente<br>
          - Etapa Jurídica Actualizada`,
        showCancelButton: true, confirmButtonText: 'Confirmar', cancelButtonText: 'Cancelar'
      });
      if (!ok.isConfirmed) return;
      await apiPost('procAviso', { uid: uidActual_(), id_proceso: row.id_proceso, rowIndex: row.rowIndex, tipo: 'finalizacion' });
      playSoundOnce(SOUNDS.success);
      await Swal.fire({ icon:'success', title:'Solicitud enviada', timer:1800, showConfirmButton:false });
      abrirVerAsignacion_(row);
    });
    actionsWrap.appendChild(btnFin);
  }

  // Creada al final
  addField('Creada:', row.creacion);
  showView('view-ver-asignacion');
}

document.getElementById('btn-ver-asignacion-back')?.addEventListener('click', () => {
  playSoundOnce(SOUNDS.back);
  showView('view-asignaciones');
});

/* ── Modal REBOTAR ──────────────────────────────────────── */
document.getElementById('btn-rebote-regresar')?.addEventListener('click', () => {
  playSoundOnce(SOUNDS.back);
  document.getElementById('modal-rebotar').classList.add('hidden');
});

document.getElementById('btn-rebote-guardar')?.addEventListener('click', async () => {
  const rebote = document.getElementById('proc-rebote').value.trim();
  if (!rebote) {
    Swal.fire({ icon:'warning', title:'Justificación requerida' });
    return;
  }
  if (!currentProcesoSelected) return;
  try {
    const resReb = await apiPost('rebotarProceso', { uid: uidActual_(), id_proceso: currentProcesoSelected.id_proceso, rebote });
    /* FASE 2 — el aviso al coordinador lo manda el servidor (proc.rebote).
       Antes salía DOS veces: una del navegador y otra del servidor. */
    document.getElementById('modal-rebotar').classList.add('hidden');
    playSoundOnce(SOUNDS.success);
    await Swal.fire({ icon:'success', title:'Asignación Rebotada', timer:1800, showConfirmButton:false });
    // La lista ya vino en la respuesta (un solo viaje); si no hay, al inicio
    await loadAndRenderProcesos_(resReb && resReb.lista);
    if (__procListCache.length) showView('view-asignaciones');
    else showView('view-inicio');
  } catch (e) {
    Swal.fire({ icon:'error', title:'Error', text: String(e.message || e) });
  }
});

/* ── Vista EDITAR ASIGNACIÓN ────────────────────────────── */
function updateEditEtapas_(cat) {
  const sel = document.getElementById('edit-etapa');
  if (!sel) return;
  sel.innerHTML = '<option value="">— Selecciona —</option>';
  const etapas = ETAPAS_POR_CAT[cat] || ETAPAS_POR_CAT[normalizeText_(cat)] ||
    Object.entries(ETAPAS_POR_CAT).find(([k]) => normalizeText_(k) === normalizeText_(cat))?.[1] || [];
  etapas.forEach(e => {
    const o = document.createElement('option');
    o.value = e; o.textContent = e;
    sel.appendChild(o);
  });
}

function abrirEditarAsignacion_(row) {
  if (!row) return;
  currentProcesoSelected = row;

  // Badge identificador
  const badgeRow = document.getElementById('edit-badge-row');
  if (badgeRow) {
    badgeRow.innerHTML = `<div class="edit-badge">${escapeHtml_(row.id_proceso || '')} — ${escapeHtml_(row.consecutivo || '')}</div>`;
  }

  // Determinar si puede ver campos super
  /* FASE 5 — aquí había una variable con un nombre propio escrito a
     mano (esDiegoSuper) que no se usaba en ningún sitio. Eliminada. */
  const esSuper = currentUser?.isSuper || false;

  // Mostrar/ocultar campos solo super
  const superFields = document.getElementById('edit-super-fields');
  const recibidosSuper = document.getElementById('edit-recibidos-super');
  const cierreSuper   = document.getElementById('edit-cierre-super');
  if (superFields)    superFields.style.display   = esSuper ? '' : 'none';
  if (recibidosSuper) recibidosSuper.style.display = esSuper ? '' : 'none';
  if (cierreSuper)    cierreSuper.style.display    = esSuper ? '' : 'none';

  // Pre-llenar campos super
  if (esSuper) {
    const er = document.getElementById('edit-recibido');   if (er) er.value = row.recibido || '';
    const ec = document.getElementById('edit-consecutivo'); if (ec) ec.value = row.consecutivo || '';
    const ed = document.getElementById('edit-descripcion'); if (ed) ed.value = row.descripcion || '';
    const esp = document.getElementById('edit-respuesta'); if (esp) esp.value = row.respuesta || '';
    const em = document.getElementById('edit-medio');       if (em) em.value = row.medio || '';
    const ea = document.getElementById('edit-asignado');    if (ea) ea.value = row.asignado || '';
    const ecierre = document.getElementById('edit-cierre'); if (ecierre) ecierre.value = row.cierre || '';
    const epet = document.getElementById('edit-peticionario'); if (epet) epet.value = row.peticionario || '';
    const eexp = document.getElementById('edit-expediente');   if (eexp) eexp.value = row.expediente   || '';
    document.getElementById('edit-contacto1').value =
      row.contacto1 || alcContactoDe_(row.asignado);
  }

  // Campos ambos roles
  renderCatSelector_('edit-cat-selector', 'edit-categoria', row.categoria || '', 'edit-');
  const catVal = row.categoria || '';
  renderSubcatSelector_('edit-subcat-selector', 'edit-subcategoria', catVal, row.subcategoria || '');
  document.getElementById('edit-asistente').value   = row.asistente   || '';
  document.getElementById('edit-contacto2').value   = row.contacto2   || '';
  document.getElementById('edit-coordinador').value = row.coordinador || '';
  document.getElementById('edit-contacto3').value   = row.contacto3   || '';
  document.getElementById('edit-bitacora').value    = row.bitacora    || '';
  window.__bitacoraOriginal = row.bitacora || ''; // <-- NUEVO: guardar original para diff

  // Etapas
  updateEditEtapas_(catVal);
  const etapaSel = document.getElementById('edit-etapa');
  if (etapaSel && row.etapa) etapaSel.value = row.etapa;

   // Estados: solo super ve el select; asignado no lo necesita (se deduce de bitácora)
  const estadoSel = document.getElementById('edit-estado');
  const estadoWrap = estadoSel ? estadoSel.closest('label, div') : null;

  // Ocultar label + select del estado para no-super
  const allLabels = document.querySelectorAll('#view-editar-asignacion label');
  let estadoLabel = null;
  allLabels.forEach(lbl => { if (lbl.textContent.trim() === 'Estado') estadoLabel = lbl; });

  if (!esSuper) {
    if (estadoLabel) estadoLabel.style.display = 'none';
    if (estadoSel)   estadoSel.style.display   = 'none';
  } else {
    if (estadoLabel) estadoLabel.style.display = '';
    if (estadoSel)   estadoSel.style.display   = '';
    estadoSel.innerHTML = '<option value="">— Selecciona —</option>';
    const estadosSuper = ['ASIGNADO','PENDIENTE ASIGNACION','EN PROYECCIÓN','PENDIENTE EVIDENCIA','FINALIZADO'];
    estadosSuper.forEach(s => {
      const o = document.createElement('option');
      o.value = s; o.textContent = s;
      estadoSel.appendChild(o);
    });
    if (row.estado) estadoSel.value = row.estado;
  }

  // Limpiar files
  ['edit-recibido1','edit-recibido2','edit-recibido3','edit-respuesta1','edit-respuesta2','edit-respuesta3','edit-evidencia']
    .forEach(id => {
      const el = document.getElementById(id); if (el) el.value = '';
      const st = document.getElementById(id + '-status'); if (st) st.textContent = '';
    });

    // Limpiar si la fila no tiene valores (protección)
  if (!row.peticionario) { const el = document.getElementById('edit-peticionario'); if(el) el.value=''; }
  if (!row.expediente)   { const el = document.getElementById('edit-expediente');   if(el) el.value=''; }

    // Mostrar/ocultar campos de respuesta según estado
  const estadoActualParaEditar = String(row.estado || '').toUpperCase();
  const puedeVerRespuesta = esSuper || estadoActualParaEditar === 'EN PROYECCIÓN';
  ['edit-respuesta1','edit-respuesta2','edit-respuesta3'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    // buscar el label anterior
    let prev = el.previousElementSibling;
    while (prev && prev.tagName !== 'LABEL') prev = prev.previousElementSibling;
    if (prev) prev.style.display = puedeVerRespuesta ? '' : 'none';
    el.style.display = puedeVerRespuesta ? '' : 'none';
    const st = document.getElementById(id + '-status');
    if (st) st.style.display = puedeVerRespuesta ? '' : 'none';
  });

    // Ocultar campo evidencia si estado es ASIGNADO (solo puede subirse desde EN PROYECCIÓN o super)
  const puedeVerEvidencia = esSuper || estadoActualParaEditar !== 'ASIGNADO';
  const editEvInput = document.getElementById('edit-evidencia');
  if (editEvInput) {
    let evLabel = editEvInput.previousElementSibling;
    while (evLabel && evLabel.tagName !== 'LABEL') evLabel = evLabel.previousElementSibling;
    if (evLabel) evLabel.style.display = puedeVerEvidencia ? '' : 'none';
    editEvInput.style.display = puedeVerEvidencia ? '' : 'none';
    const evSt = document.getElementById('edit-evidencia-status');
    if (evSt) evSt.style.display = puedeVerEvidencia ? '' : 'none';
    const evPrev = document.getElementById('edit-evidencia-preview');
    if (evPrev && !puedeVerEvidencia) evPrev.style.display = 'none';
  }

  showView('view-editar-asignacion');
}

// Cambio de asignado en editar
document.getElementById('edit-asignado')?.addEventListener('change', () => {
  autoFillContactos_('edit-');
});

// Validación files editar (10MB pdf, 5MB imagen)
['edit-recibido1','edit-recibido2','edit-recibido3','edit-respuesta1','edit-respuesta2','edit-respuesta3'].forEach(id => {
  document.getElementById(id)?.addEventListener('change', () => {
    const f = document.getElementById(id)?.files?.[0];
    const st = document.getElementById(id + '-status');
    if (!f) { if (st) st.textContent = ''; return; }
    if (f.size > 10 * 1024 * 1024) {
      document.getElementById(id).value = '';
      if (st) st.textContent = '';
      Swal.fire({ icon:'warning', title:'Archivo muy pesado', text:'Máximo 10 MB por PDF.' });
      return;
    }
    if (st) st.textContent = `✓ ${f.name}`;
  });
});
document.getElementById('edit-evidencia')?.addEventListener('change', () => {
  const f = document.getElementById('edit-evidencia')?.files?.[0];
  const st = document.getElementById('edit-evidencia-status');
  if (!f) { if (st) st.textContent = ''; return; }
  if (f.size > 5 * 1024 * 1024) {
    document.getElementById('edit-evidencia').value = '';
    if (st) st.textContent = '';
    Swal.fire({ icon:'warning', title:'Imagen muy pesada', text:'Máximo 5 MB.' });
    return;
  }
  if (st) st.textContent = `✓ ${f.name}`;
});

document.getElementById('btn-edit-asig-back')?.addEventListener('click', () => {
  playSoundOnce(SOUNDS.back);
  showView('view-asignaciones');
});

document.getElementById('btn-edit-asig-guardar')?.addEventListener('click', async () => {
  if (!currentProcesoSelected) return;
  const row    = currentProcesoSelected;
  const esSuper = currentUser?.isSuper || false;

    // Validar bitácora requerida
  const _bitacoraVal = (document.getElementById('edit-bitacora')?.value || '').trim();
  if (!_bitacoraVal) {
    Swal.fire({ icon: 'warning', title: 'Bitácora requerida', text: 'Debes escribir al menos una entrada en la bitácora antes de guardar.' });
    document.getElementById('edit-bitacora')?.focus();
    return;
  }

  // Validar etapa jurídica requerida
  const _etapaVal = (document.getElementById('edit-etapa')?.value || '').trim();
  if (!_etapaVal) {
    Swal.fire({ icon: 'warning', title: 'Etapa Jurídica requerida', text: 'Selecciona la etapa jurídica correspondiente antes de guardar.' });
    document.getElementById('edit-etapa')?.focus();
    return;
  }

  const payload = {
    id_proceso: row.id_proceso,
    rowIndex:   row.rowIndex
  };

  if (esSuper) {
    const er  = document.getElementById('edit-recibido')?.value.trim();
    const ec  = document.getElementById('edit-consecutivo')?.value.trim();
    const ed  = document.getElementById('edit-descripcion')?.value.trim();
    const esp = document.getElementById('edit-respuesta')?.value.trim();
    const em  = document.getElementById('edit-medio')?.value;
    const ea  = document.getElementById('edit-asignado')?.value;
    const eci = document.getElementById('edit-cierre')?.value.trim();
    if (er)               payload.recibido    = er;
    if (ec)               payload.consecutivo = formatConsecutivo_(ec);
    if (ed)               payload.descripcion = ed.toUpperCase();
    const _pet = (document.getElementById('edit-peticionario')?.value || '').trim().toUpperCase();
    const _exp = (document.getElementById('edit-expediente')?.value   || '').trim().toUpperCase();
    if (_pet) payload.peticionario = _pet;
    if (_exp) payload.expediente   = _exp;
    if (esp)              payload.respuesta   = esp;
    if (em)               payload.medio       = em;
    if (ea !== undefined) payload.asignado    = ea;
    if (eci)              payload.cierre      = eci;
    payload.contacto1 = document.getElementById('edit-contacto1')?.value || '';

    // Super: recoge estado del select
    payload.estado = document.getElementById('edit-estado')?.value || '';
  } else {
    // Asignado: el estado se deduce automáticamente de la bitácora
    // No lee el select (que está oculto para el asignado)
    const bitacoraNueva = (document.getElementById('edit-bitacora')?.value || '').trim();
    if (bitacoraNueva) {
      payload.estado = 'EN PROYECCIÓN';
    }
    // Si no hay bitácora, no cambiamos el estado (queda el actual)
  }

  payload.categoria    = document.getElementById('edit-categoria')?.value    || '';
  payload.subcategoria = document.getElementById('edit-subcategoria')?.value || '';
  autoFillContactos_('edit-');
  payload.asistente    = document.getElementById('edit-asistente')?.value    || '';
  payload.contacto2    = document.getElementById('edit-contacto2')?.value    || '';
  payload.coordinador  = document.getElementById('edit-coordinador')?.value  || '';
  payload.contacto3    = document.getElementById('edit-contacto3')?.value    || '';
    // ── Bitácora: anteponer NOMBRE DEL USUARIO solo a la entrada NUEVA ──
    const _bitTextarea = (document.getElementById('edit-bitacora')?.value || '').trim();
    const _bitOriginal = String(window.__bitacoraOriginal || '').trim();
    const _nombreUser  = String(currentUser?.nombre || '').toUpperCase();
    const _hoy         = formatDDMMYYYY_(new Date());

    if (!_bitTextarea) {
      payload.bitacora = '';
    } else if (_bitTextarea === _bitOriginal) {
      // Sin cambios: dejar como estaba
      payload.bitacora = _bitOriginal;
    } else if (_bitOriginal && _bitTextarea.startsWith(_bitOriginal)) {
      // Se agregó texto al final
      const _nuevoTexto = _bitTextarea.slice(_bitOriginal.length).trim();
      payload.bitacora = _nuevoTexto
        ? _bitOriginal + '\n' + _nombreUser + ' ' + _hoy + ': ' + _nuevoTexto
        : _bitOriginal;
    } else {
      // Bitácora vacía o reescrita totalmente → tratar todo como entrada nueva
      payload.bitacora = _nombreUser + ' ' + _hoy + ': ' + _bitTextarea;
    }
 payload.etapa        = document.getElementById('edit-etapa')?.value        || '';

  // Archivos de respuesta: solo permitidos si estado es EN PROYECCIÓN o super
  const estadoActual = String(row.estado || '').toUpperCase();
  const puedeSubirRespuesta = esSuper || estadoActual === 'EN PROYECCIÓN' || payload.estado === 'EN PROYECCIÓN';

  const fileFields = [
    { id:'edit-recibido1',  key:'recibido1',  permitido: esSuper },
    { id:'edit-recibido2',  key:'recibido2',  permitido: esSuper },
    { id:'edit-recibido3',  key:'recibido3',  permitido: esSuper },
    { id:'edit-respuesta1', key:'respuesta1', permitido: puedeSubirRespuesta },
    { id:'edit-respuesta2', key:'respuesta2', permitido: puedeSubirRespuesta },
    { id:'edit-respuesta3', key:'respuesta3', permitido: puedeSubirRespuesta },
    { id:'edit-evidencia',  key:'evidencia',  permitido: true }
  ];
  for (const { id, key, permitido } of fileFields) {
    if (!permitido) continue;
    const f = document.getElementById(id)?.files?.[0];
    if (f) payload[key] = { filename: f.name, base64: await fileToBase64_(f) };
  }

  // Resumen
  const resumenFields = {};
  if (payload.recibido)    resumenFields['Recibido']    = payload.recibido;
  if (payload.consecutivo) resumenFields['Consecutivo'] = payload.consecutivo;
  if (payload.descripcion) resumenFields['Asunto']      = payload.descripcion;
  if (payload.peticionario) resumenFields['Peticionario']    = payload.peticionario;
  if (payload.expediente)   resumenFields['N° EXP. INTERNO'] = payload.expediente;
  if (payload.respuesta)   resumenFields['Respuesta']   = payload.respuesta;
  if (payload.medio)       resumenFields['Medio']       = payload.medio;
  if (payload.categoria)   resumenFields['Categoría']   = payload.categoria;
  if (payload.subcategoria)resumenFields['Subcategoría']= payload.subcategoria;
  if (payload.etapa)       resumenFields['Etapa']       = payload.etapa;
  if (payload.estado)      resumenFields['Estado']      = payload.estado;
  if (payload.bitacora)    resumenFields['Bitácora']    = payload.bitacora.substring(0,60) + (payload.bitacora.length>60?'…':'');
  if (payload.cierre)      resumenFields['Cierre']      = payload.cierre;
  const filesCount = fileFields.filter(f => payload[f.key]).length;
  if (filesCount) resumenFields['Archivos'] = filesCount + ' archivo(s)';

  const ok = await Swal.fire({
    icon:'info', title:'Confirmar Edición',
    html: buildResumenHtml_(resumenFields),
    showCancelButton:true, confirmButtonText:'Guardar', cancelButtonText:'Seguir editando'
  });
  if (!ok.isConfirmed) return;

  try {
    if (!payload.uid) payload.uid = uidActual_();
    const rEd = await apiPost('editarProceso', payload);
    playSoundOnce(SOUNDS.success);
    await Swal.fire({ icon:'success', title:'Cambios guardados', html:'Sigue cada día tu asignación', timer:2000, showConfirmButton:false });
    await abrirVistaAsignaciones_(rEd && rEd.lista);
  } catch (e) {
    Swal.fire({ icon:'error', title:'Error', text: String(e.message || e) });
  }
});
     
/* ── Utilidad: resumen HTML dinámico ────────────────────── */
function buildResumenHtml_(fields) {
  let html = '<div style="text-align:left;font-size:.9rem;">';
  for (const [label, value] of Object.entries(fields)) {
    if (!value && value !== 0) continue;
    html += `<div class="proc-resumen-item"><b>${escapeHtml_(label)}:</b><span>${escapeHtml_(String(value))}</span></div>`;
  }
  html += '</div>';
  return html;
}

/* ── Integrar en el login handler (pegar después del login existente) ── */
// En la función de login, después de setear currentUser, agregar:
// updateSemaforoBtn_();
// Reemplazamos con un patch que detecta cambio en currentUser
const __origLoginBtn = document.getElementById('btn-login');
if (__origLoginBtn && !__origLoginBtn.dataset.semaforoPatch) {
  __origLoginBtn.dataset.semaforoPatch = '1';
  __origLoginBtn.addEventListener('click', () => {
    // Aplazar para que el login original termine
    setTimeout(updateSemaforoBtn_, 600);
  });
}

// En logout
const __origLogoutBtn = document.getElementById('btn-logout');
if (__origLogoutBtn && !__origLogoutBtn.dataset.semaforoPatch) {
  __origLogoutBtn.dataset.semaforoPatch = '1';
  __origLogoutBtn.addEventListener('click', () => {
    try {
      const b = document.getElementById('btn-semaforo');
      if (b) b.style.display = 'none';
    } catch (_) {}
  });
}

  /* ============================================================
   PARCHES DE MEJORA — aplicar al final del <script>
   ============================================================ */

/* ── 1. LIGHTBOX ─────────────────────────────────────────── */
(function initLightbox_() {
  const lb    = document.getElementById('proc-lightbox');
  const lbImg = document.getElementById('proc-lightbox-img');
  const lbClose = document.getElementById('proc-lightbox-close');
  if (!lb || !lbImg) return;

  window.openLightbox_ = function(src) {
    lbImg.src = src;
    lb.classList.add('open');
    document.body.style.overflow = 'hidden';
  };
  window.closeLightbox_ = function() {
    lb.classList.remove('open');
    lbImg.src = '';
    document.body.style.overflow = '';
  };

  lb.addEventListener('click', closeLightbox_);
  lbClose.addEventListener('click', (e) => { e.stopPropagation(); closeLightbox_(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeLightbox_(); });
})();

/* ── 2. PREVIEW EVIDENCIA en EDITAR ─────────────────────── */
(function patchEditEvidencia_() {
  const inp     = document.getElementById('edit-evidencia');
  const preview = document.getElementById('edit-evidencia-preview');
  const preImg  = document.getElementById('edit-evidencia-preview-img');
  if (!inp || !preview || !preImg) return;

  // Reemplazamos el listener existente con uno nuevo
  const newInp = inp.cloneNode(true);
  inp.parentNode.replaceChild(newInp, inp);

  newInp.addEventListener('change', () => {
    const f  = newInp.files?.[0];
    const st = document.getElementById('edit-evidencia-status');
    preview.style.display = 'none';
    preImg.src = '';
    if (!f) { if (st) st.textContent = ''; return; }
    if (f.size > 5 * 1024 * 1024) {
      newInp.value = '';
      if (st) st.textContent = '';
      Swal.fire({ icon: 'warning', title: 'Imagen muy pesada', text: 'Máximo 5 MB.' });
      return;
    }
    if (st) st.textContent = `✓ ${f.name}`;
    const reader = new FileReader();
    reader.onload = (e) => {
      preImg.src = e.target.result;
      preview.style.display = '';
    };
    reader.readAsDataURL(f);
  });
})();

/* ── 3. HELPER: formatear fecha creación ────────────────── */
function formatCreacionLarga_(str) {
  // "10/04/2026 15:30:00" → "10/04/2026 — Viernes, 10 de abril de 2026"
  const parte = String(str || '').trim().split(' ')[0]; // solo la parte dd/mm/yyyy
  const m = parte.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return str || '';
  const dd = parseInt(m[1], 10), mm2 = parseInt(m[2], 10) - 1, yy = parseInt(m[3], 10);
  const dt = new Date(yy, mm2, dd);
  if (isNaN(dt.getTime())) return str || '';
  const dias  = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
  const meses = ['enero','febrero','marzo','abril','mayo','junio',
                 'julio','agosto','septiembre','octubre','noviembre','diciembre'];
  return `${parte} — ${dias[dt.getDay()]}, ${dd} de ${meses[mm2]} de ${yy}`;
}

/* ── 4. REEMPLAZAR renderProcList_ (iconos solo imagen) ─── */
renderProcList_ = function(items) {
  const wrap    = document.getElementById('proc-list');
  const countEl = document.getElementById('proc-count');
  if (!wrap) return;
  wrap.innerHTML = '';
  if (countEl) countEl.textContent = String(items.length);

  if (!items.length) {
    wrap.innerHTML = '<p class="muted center" style="grid-column:1/-1;">No hay asignaciones.</p>';
    return;
  }

  for (const row of items) {
    const sem       = calcSemaforo_(row);
    const catIcon   = getCatIcon_(row.categoria);
    const subcatIcon= getSubcatIcon_(row.subcategoria);
    const etapa     = row.etapa || '';

    const card = document.createElement('div');
    card.className = `proc-card ${sem.cardClass}`;

    // HEAD
    const head = document.createElement('div');
    head.className = 'proc-head';

    const headLeft = document.createElement('div');
    headLeft.className = 'proc-head-left';
    headLeft.innerHTML = `
      <p class="proc-asignado">${escapeHtml_(row.asignado || '')}</p>
      ${row.asistente ? `<p class="proc-asistente">${escapeHtml_(row.asistente)}</p>` : ''}
    `;

    const headRight = document.createElement('div');
    headRight.className = 'proc-head-right';
    headRight.innerHTML = `
      <div class="proc-estado-badge ${sem.clase}">
        ${escapeHtml_(row.estado || '')}
        <span class="proc-dias-txt">${sem.texto}</span>
      </div>
    `;

    head.appendChild(headLeft);
    head.appendChild(headRight);
    card.appendChild(head);

    // Descripción (con truncado a 3 líneas y pastilla "…" press-and-hold)
    const desc = document.createElement('div');
    desc.className = 'proc-descripcion';
    desc.innerHTML = `
      <img src="${ICONO_CHINCHETA}" alt="📌" />
      <div class="proc-desc-wrap">
        <span class="proc-desc-text">${escapeHtml_(row.descripcion || '')}</span>
        <button type="button" class="proc-desc-pill"
          aria-label="Mantén presionado para ver completo"
          title="Mantén presionado para ver el asunto completo">
          <span class="proc-desc-pill-dots">•••</span>
        </button>
      </div>
    `;
    card.appendChild(desc);

    // Press-and-hold para expandir el asunto
    const __descText = desc.querySelector('.proc-desc-text');
    const __descPill = desc.querySelector('.proc-desc-pill');
    if (__descText && __descPill) {
      // Ocultar la pastilla si el texto NO necesita truncado
      requestAnimationFrame(() => {
        if (__descText.scrollHeight <= __descText.clientHeight + 1) {
          __descPill.style.display = 'none';
        }
      });

      const __expand = (e) => {
        if (e) e.preventDefault();
        __descText.classList.add('expanded');
      };
      const __collapse = () => {
        __descText.classList.remove('expanded');
      };

      // Desktop
      __descPill.addEventListener('mousedown',  __expand);
      __descPill.addEventListener('mouseup',    __collapse);
      __descPill.addEventListener('mouseleave', __collapse);
      // Móvil
      __descPill.addEventListener('touchstart', __expand, { passive: false });
      __descPill.addEventListener('touchend',   __collapse);
      __descPill.addEventListener('touchcancel',__collapse);
      // Seguridad: si sueltas fuera
      __descPill.addEventListener('blur',       __collapse);
    }

        // Fila iconos categoría (CON COLOR)
    const catRow = document.createElement('div');
    catRow.className = 'cat-row';

    if (row.categoria && catIcon) {
      const cColor = getCatColor_(row.categoria);
      const pill   = document.createElement('div');
      pill.className = 'cat-pill-colored';
      pill.title     = row.categoria;
      pill.style.borderColor = cColor ? cColor.border : '#aaa';
      pill.style.background  = cColor ? cColor.bg     : '#f9f9f9';
      pill.style.color       = cColor ? cColor.border : '#333';
      pill.innerHTML = `<img src="${catIcon}" alt="${escapeHtml_(row.categoria)}" /><span>${escapeHtml_(row.categoria)}</span>`;
      catRow.appendChild(pill);
    }
    if (row.subcategoria && subcatIcon) {
      const sColor = getSubcatColor_(row.subcategoria);
      const pill   = document.createElement('div');
      pill.className = 'cat-pill-colored';
      pill.title     = row.subcategoria;
      pill.style.borderColor = sColor ? sColor.border : '#aaa';
      pill.style.background  = sColor ? sColor.bg     : '#f9f9f9';
      pill.style.color       = sColor ? sColor.border : '#333';
      pill.style.opacity     = '0.88';
      pill.innerHTML = `<img src="${subcatIcon}" alt="${escapeHtml_(row.subcategoria)}" /><span>${escapeHtml_(row.subcategoria)}</span>`;
      catRow.appendChild(pill);
    }
    if (etapa) {
      const etapaPill = document.createElement('div');
      etapaPill.className = 'etapa-badge-mini';
      etapaPill.title = 'Etapa Jurídica: ' + etapa;
      etapaPill.innerHTML = `<img src="${ICONO_JURIDICO}" alt="⚖️" /><span>${escapeHtml_(etapa)}</span>`;
      catRow.appendChild(etapaPill);
    }
    card.appendChild(catRow);

    // Acciones
    const actions = document.createElement('div');
    actions.className = 'proc-actions';

        const consWrap = document.createElement('div');
    consWrap.style.cssText = 'display:flex;flex-direction:column;gap:2px;';

    if (row.consecutivo) {
      const el = document.createElement('span');
      el.style.cssText = 'font-size:.64rem;font-weight:700;color:var(--text-sub);';
      el.textContent = 'Consecutivo: ' + row.consecutivo;
      consWrap.appendChild(el);
    }
    if (row.peticionario) {
      const el = document.createElement('span');
      el.style.cssText = 'font-size:.64rem;font-weight:600;color:var(--text-sub);';
      el.textContent = 'Peticionario: ' + row.peticionario;
      consWrap.appendChild(el);
    }
    if (row.expediente) {
      const el = document.createElement('span');
      el.style.cssText = 'font-size:.64rem;font-weight:700;color:var(--primary);';
      el.textContent = 'N° Exp. Interno: ' + row.expediente;
      consWrap.appendChild(el);
    }

   if (row.coordinador) {
  const el = document.createElement('span');
  el.style.cssText = 'font-size:.64rem;font-weight:500;color:var(--text-muted);font-style:italic;';
  el.textContent = 'Asignado por: ' + row.coordinador;
  consWrap.appendChild(el);
}
    
    actions.appendChild(consWrap);

    const icons = document.createElement('div');
    icons.className = 'proc-icons';

if (currentUser?.isSuper && String(row.estado || '').toUpperCase() !== 'FINALIZADO') {
      const btnFirma = _mkProcIconBtn_(ICONO_FIRMA, 'Decisión');
      btnFirma.addEventListener('click', () => {
        currentProcesoSelected = row;
        abrirDecision_(row);
      });
      icons.appendChild(btnFirma);

      const btnElim = _mkProcIconBtn_(ICONO_ELIMINAR, 'Eliminar asignación');
      btnElim.addEventListener('click', async () => {
        const ok = await Swal.fire({ icon:'warning', title:'¿Eliminar asignación?', html:`<b>${escapeHtml_(row.descripcion || row.id_proceso)}</b><br>Esta acción es irreversible.`, showCancelButton:true, confirmButtonText:'Eliminar', cancelButtonText:'Cancelar' });
        if (!ok.isConfirmed) return;
        const rEl = await apiPost('eliminarProceso', { uid: uidActual_(), id_proceso: row.id_proceso });
        playSoundOnce(SOUNDS.success);
        await loadAndRenderProcesos_(rEl && rEl.lista);
      });
      icons.appendChild(btnElim);
    }

    const btnVer = _mkProcIconBtn_(ICONO_VER, 'Ver detalles');
    btnVer.addEventListener('click', () => { playSoundOnce(SOUNDS.menu); currentProcesoSelected = row; abrirVerAsignacion_(row); });
    icons.appendChild(btnVer);

    const estadoUpper   = String(row.estado || '').toUpperCase();
const miNombre      = normalizeText_(currentUser?.nombre || '');
const esSuperUser   = !!currentUser?.isSuper;
const esCoordRow    = miNombre === normalizeText_(row.coordinador || '');
const esAsignadoRow = miNombre === normalizeText_(row.asignado || '') ||
                      miNombre === normalizeText_(row.asistente || '');
const puedeEditar   = esSuperUser ||
                      esCoordRow ||
                      (esAsignadoRow && estadoUpper !== 'FINALIZADO');
if (puedeEditar) {
  const btnEdit = _mkProcIconBtn_(ICONO_EDITAR, 'Editar asignación');
  btnEdit.addEventListener('click', () => { playSoundOnce(SOUNDS.menu); currentProcesoSelected = row; abrirEditarAsignacion_(row); });
  icons.appendChild(btnEdit);
}

    actions.appendChild(icons);
    card.appendChild(actions);
    wrap.appendChild(card);
  }
};

/* ── 5. REEMPLAZAR abrirVerAsignacion_ ──────────────────── */
abrirVerAsignacion_ = function(row) {
  const sem        = calcSemaforo_(row);
  const catIcon    = getCatIcon_(row.categoria);
  const subcatIcon = getSubcatIcon_(row.subcategoria);

  // Header: solo iconos + estado
   // Header: pills con color + estado
  const header = document.getElementById('proc-ver-header');
  header.innerHTML = '';

  if (row.categoria && catIcon) {
    const cColor = getCatColor_(row.categoria);
    const pill   = document.createElement('div');
    pill.className = 'cat-pill-colored';
    pill.title     = row.categoria;
    pill.style.borderColor = cColor ? cColor.border : '#aaa';
    pill.style.background  = cColor ? cColor.bg     : '#f9f9f9';
    pill.style.color       = cColor ? cColor.border : '#333';
    pill.innerHTML = `<img src="${catIcon}" alt="${escapeHtml_(row.categoria)}" /><span>${escapeHtml_(row.categoria)}</span>`;
    header.appendChild(pill);
  }
  if (row.subcategoria && subcatIcon) {
    const sColor = getSubcatColor_(row.subcategoria);
    const pill   = document.createElement('div');
    pill.className = 'cat-pill-colored';
    pill.title     = row.subcategoria;
    pill.style.borderColor = sColor ? sColor.border : '#aaa';
    pill.style.background  = sColor ? sColor.bg     : '#f9f9f9';
    pill.style.color       = sColor ? sColor.border : '#333';
    pill.style.opacity     = '0.88';
    pill.innerHTML = `<img src="${subcatIcon}" alt="${escapeHtml_(row.subcategoria)}" /><span>${escapeHtml_(row.subcategoria)}</span>`;
    header.appendChild(pill);
  }
  if (row.etapa) {
    const etapaPill = document.createElement('div');
    etapaPill.className = 'etapa-badge-mini';
    etapaPill.title = 'Etapa Jurídica: ' + row.etapa;
    etapaPill.innerHTML = `<img src="${ICONO_JURIDICO}" alt="⚖️" /><span>${escapeHtml_(row.etapa)}</span>`;
    header.appendChild(etapaPill);
  }
   const estadoBadge = document.createElement('div');
  estadoBadge.className = `proc-estado-badge ${sem.clase}`;
  estadoBadge.style.minWidth = '140px';
  estadoBadge.innerHTML = `${escapeHtml_(row.estado || '')}<span class="proc-dias-txt">${sem.texto}</span>`;
  header.appendChild(estadoBadge);

  // Cuerpo — SIN "Creada" aquí
  const body = document.getElementById('proc-ver-body');
  body.innerHTML = '';
    const addField = (label, value, esHTML) => {
    if (!value) return;
    const div = document.createElement('div');
    div.className = 'proc-detalle-field';
    const rendered = esHTML ? value : escapeHtml_(value).replace(/\n/g, '<br>');
    div.innerHTML = `<span class="proc-detalle-label">${label}</span>
      <span class="proc-detalle-value" style="white-space:pre-line;">${rendered}</span>`;
    body.appendChild(div);
  };
  addField('Asunto:',             row.descripcion);
  addField('Peticionario:',       row.peticionario);
  addField('N° Exp. Interno:',   row.expediente);
  addField('Consecutivo:',        row.consecutivo);
  addField('Fecha de Recibido:',  formatFechaLarga_(row.recibido));
  addField('Medio:',              row.medio);
  addField('Fecha de Respuesta:', formatFechaLarga_(row.respuesta));
  addField('Bitácora:',           row.bitacora);
  addField('Fecha de Cierre:',    formatFechaLarga_(row.cierre));
  addField('Asignado:',           row.asignado);
  addField('Asistente:',          row.asistente);

  // Creación con formato largo (posición correcta, debajo de campos)
  const creacionEl = document.getElementById('proc-ver-creacion');
if (creacionEl) {
  creacionEl.className = 'proc-creacion-field';
  let html = '';
  if (row.creacion) {
    html += `<span>Creada:</span> ${escapeHtml_(formatCreacionLarga_(row.creacion))}`;
  }
  if (row.coordinador) {
    if (html) html += '<br>';
    html += `<span>Asignado por:</span> ${escapeHtml_(row.coordinador)}`;
  }
  creacionEl.innerHTML = html;
}

  // Evidencia — con zoom al hacer clic
  const evWrap = document.getElementById('proc-ver-evidencia');
  const evImg  = document.getElementById('proc-ver-evidencia-img');
  if (row.evidencia) {
    // Forzar la URL de visualización directa desde Drive
    let evUrl = String(row.evidencia).trim();
    // Si es enlace de Drive, convertir a thumbnail/preview
    const driveMatch = evUrl.match(/\/d\/([A-Za-z0-9_-]{10,})\//);
    if (driveMatch) {
      evUrl = `https://lh3.googleusercontent.com/d/${driveMatch[1]}`;
    }
    evImg.src = evUrl;
    evImg.style.cursor = 'zoom-in';
    // Reemplazar listener previo
    const newEvImg = evImg.cloneNode(true);
    evImg.parentNode.replaceChild(newEvImg, evImg);
    newEvImg.addEventListener('click', () => {
      if (typeof openLightbox_ === 'function') openLightbox_(evUrl);
    });
    evWrap.style.display = '';
  } else {
    evWrap.style.display = 'none';
  }

  // Archivos recibidos / respuestas
  const filesWrap = document.getElementById('proc-ver-files');
  filesWrap.innerHTML = '';
  const addFileIcon_ = (urls, srcIcon, label) => {
    const validUrls = urls.filter(Boolean);
    if (!validUrls.length) return;
    validUrls.forEach((url, idx) => {
      if (!url) return;
      const item = document.createElement('div');
      item.className = 'proc-file-item';
      item.title = `${label} ${idx + 1}`;
      item.innerHTML = `
        <img src="${srcIcon}" alt="${label}" />
        ${validUrls.length > 1 ? `<span class="proc-file-counter">${idx + 1}</span>` : ''}
        <span class="proc-file-label">${label} ${idx + 1}</span>`;
      /* FASE 8: se abre en el visor de la app, no en pestaña nueva */
      item.addEventListener('click', () => verArchivo_(url, `${label} ${idx + 1}`));
      filesWrap.appendChild(item);
    });
  };
  addFileIcon_([row.recibido1, row.recibido2, row.recibido3],     ICONO_INBOX,  'Recibido');
  addFileIcon_([row.respuesta1, row.respuesta2, row.respuesta3],  ICONO_OUTBOX, 'Respuesta');

   // Botones acción
  const actionsWrap = document.getElementById('proc-ver-actions');
  actionsWrap.innerHTML = '';
  const estado = String(row.estado || '').toUpperCase();

  // ── REBOTAR (solo cuando ASIGNADO) ───────────────────────
  if (estado === 'ASIGNADO') {
    const btnRebotar = document.createElement('button');
    btnRebotar.type = 'button';
    btnRebotar.className = 'proc-action-btn proc-btn-rebotar';
    btnRebotar.innerHTML = `<img src="${ICONO_REBOTAR}" alt="Rebotar" /> REBOTAR`;
    btnRebotar.addEventListener('click', () => {
      document.getElementById('proc-rebote').value = '';
      document.getElementById('modal-rebotar').classList.remove('hidden');
    });
    actionsWrap.appendChild(btnRebotar);
  }

  // ── EDITAR (asignado NO puede editar si FINALIZADO) ───────
  const miNombre      = normalizeText_(currentUser?.nombre || '');
const esCoordRow    = miNombre === normalizeText_(row.coordinador || '');
const esAsignadoRow = miNombre === normalizeText_(row.asignado || '') ||
                      miNombre === normalizeText_(row.asistente || '');
const puedeEditar = currentUser?.isSuper ||
                    esCoordRow ||
                    (esAsignadoRow && estado !== 'FINALIZADO');
if (puedeEditar) {
  const btnEditar = document.createElement('button');
    btnEditar.type = 'button';
    btnEditar.className = 'btn-primary proc-action-btn';
    btnEditar.style.width = 'auto';
    btnEditar.innerHTML = `<img src="${ICONO_EDITAR}" style="width:20px;height:20px;vertical-align:middle;" alt="Editar" /> EDITAR`;
    btnEditar.addEventListener('click', () => { playSoundOnce(SOUNDS.menu); abrirEditarAsignacion_(row); });
    actionsWrap.appendChild(btnEditar);
  }

  // ── SOLICITAR PROCESO (asignado, cuando EN PROYECCIÓN) ────
  if (!currentUser?.isSuper && (estado === 'EN PROYECCIÓN' || estado === 'PENDIENTE EVIDENCIA')) {
    const btnSP = document.createElement('button');
    btnSP.type = 'button';
    btnSP.className = 'proc-action-btn';
    btnSP.style.cssText = 'background:linear-gradient(135deg,#7c3aed,#5b21b6);color:#fff;border:0;width:auto;';
    btnSP.innerHTML = `<img src="${ICONO_MEMORIA}" style="width:28px;height:28px;" alt="Solicitar" /> SOLICITAR PROCESO`;
    btnSP.addEventListener('click', () => abrirSolicitarProceso_(row));
    actionsWrap.appendChild(btnSP);
  }

    // ── DECISIÓN (solo super usuario, no visible si FINALIZADO) ──
  if (currentUser?.isSuper && estado !== 'FINALIZADO') {
    const btnDec = document.createElement('button');
    btnDec.type = 'button';
    btnDec.className = 'proc-action-btn';
    btnDec.style.cssText = 'background:linear-gradient(135deg,#0a7a46,#06402B);color:#fff;border:0;width:auto;';
    btnDec.innerHTML = `<img src="${ICONO_FIRMA}" style="width:22px;height:22px;" alt="Decisión" /> DECISIÓN`;
    btnDec.addEventListener('click', () => abrirDecision_(row));
    actionsWrap.appendChild(btnDec);
  }

  showView('view-ver-asignacion');
};

/* ── 6. PATCH abrirEditarAsignacion_: indicar archivos ya cargados ── */
const __origAbrirEditar = abrirEditarAsignacion_;
abrirEditarAsignacion_ = function(row) {
  __origAbrirEditar(row);

  // Mapeo: id del input → URL ya guardada en row
  const fileMap = [
    { inputId: 'edit-recibido1',  url: row.recibido1  || '', label: 'Recibido 1'  },
    { inputId: 'edit-recibido2',  url: row.recibido2  || '', label: 'Recibido 2'  },
    { inputId: 'edit-recibido3',  url: row.recibido3  || '', label: 'Recibido 3'  },
    { inputId: 'edit-respuesta1', url: row.respuesta1 || '', label: 'Respuesta 1' },
    { inputId: 'edit-respuesta2', url: row.respuesta2 || '', label: 'Respuesta 2' },
    { inputId: 'edit-respuesta3', url: row.respuesta3 || '', label: 'Respuesta 3' },
    { inputId: 'edit-evidencia',  url: row.evidencia  || '', label: 'Evidencia'   }
  ];

  fileMap.forEach(({ inputId, url, label }) => {
    const inp = document.getElementById(inputId);
    if (!inp) return;

    // Eliminar badge anterior si existía
    const prevBadge = document.getElementById(inputId + '-loaded');
    if (prevBadge) prevBadge.remove();

    if (!url) return;

    const badge = document.createElement('a');
    badge.id        = inputId + '-loaded';
    badge.href      = url;
    badge.target    = '_blank';
    badge.rel       = 'noopener';
    badge.className = 'file-already-loaded';
    badge.innerHTML = `<img src="${ICONO_INBOX}" alt="Cargado" />${label}: archivo ya cargado — clic para ver`;
    inp.parentNode.insertBefore(badge, inp.nextSibling);
  });

  // Preview evidencia si ya tiene imagen
  const evPreview = document.getElementById('edit-evidencia-preview');
  const evPreImg  = document.getElementById('edit-evidencia-preview-img');
  if (evPreview && evPreImg) {
    const evUrl = row.evidencia || '';
    if (evUrl) {
      let thumb = evUrl;
      const dm = evUrl.match(/\/d\/([A-Za-z0-9_-]{10,})\//);
      if (dm) thumb = `https://lh3.googleusercontent.com/d/${dm[1]}`;
      evPreImg.src = thumb;
      evPreview.style.display = '';
    } else {
      evPreview.style.display = 'none';
      evPreImg.src = '';
    }
  }
};

     /* ── SOLICITAR PROCESO (asignado → coordinador) ─────────── */
let __spTipoSeleccionado = null; // 'revision' | 'finalizacion'
let __spRowActual        = null;

function abrirSolicitarProceso_(row) {
  __spRowActual = row;
  // Primer Swal: elegir tipo
  Swal.fire({
    icon: 'question',
    title: 'SOLICITAR PROCESO',
    html: '¿Qué tipo de solicitud deseas enviar?',
    showCancelButton: true,
    showDenyButton:   true,
    confirmButtonText: 'Revisión / Firma',
    denyButtonText:    'Finalización',
    cancelButtonText:  'Cancelar'
  }).then(result => {
    if (result.isConfirmed) {
      __spTipoSeleccionado = 'Revisión / Firma';
      document.getElementById('modal-sp-titulo').textContent = 'Solicitar revisión o firma';
      document.getElementById('modal-sp-solicitud').value = '';
      document.getElementById('modal-solicitar-proceso').classList.remove('hidden');
    } else if (result.isDenied) {
      __spTipoSeleccionado = 'Finalización';
      document.getElementById('modal-sp-titulo').textContent = 'Solicitar la finalización';
      document.getElementById('modal-sp-solicitud').value = '';
      document.getElementById('modal-solicitar-proceso').classList.remove('hidden');
    }
  });
}

document.getElementById('btn-sp-cancelar')?.addEventListener('click', () => {
  playSoundOnce(SOUNDS.back);
  document.getElementById('modal-solicitar-proceso').classList.add('hidden');
  __spTipoSeleccionado = null;
  __spRowActual = null;
});

document.getElementById('btn-sp-guardar')?.addEventListener('click', async () => {
  if (!__spRowActual || !__spTipoSeleccionado) return;
  const row      = __spRowActual;
  const solicitud = String(document.getElementById('modal-sp-solicitud').value || '').trim();
  const tipo     = __spTipoSeleccionado;

  try {
    await apiPost('procAviso', {
      uid: uidActual_(), id_proceso: row.id_proceso, rowIndex: row.rowIndex,
      tipo: 'solicitud', clase: tipo, texto: solicitud
    });
  } catch (e) {
    Swal.fire({ icon:'error', title:'No se pudo enviar', text: String(e.message || e) });
    return;
  }
  document.getElementById('modal-solicitar-proceso').classList.add('hidden');
  __spTipoSeleccionado = null;
  __spRowActual = null;

  playSoundOnce(SOUNDS.success);
  await Swal.fire({ icon: 'success', title: 'Solicitud enviada', timer: 1800, showConfirmButton: false });
});

/* ── DECISIÓN (super usuario → asignado) ────────────────── */
let __decTipoSeleccionado = null; // 'FINALIZADO' | 'PENDIENTE EVIDENCIA'
let __decRowActual        = null;

function abrirDecision_(row) {
  __decRowActual = row;
  Swal.fire({
    icon: 'info',
    title: 'DECISIÓN',
    html: '¿Cuál es la decisión para esta asignación?',
    showCancelButton: true,
    showDenyButton:   true,
    confirmButtonText: 'Finalizar',
    denyButtonText:    'Pendiente de Evidencia',
    cancelButtonText:  'Cancelar'
  }).then(result => {
    if (result.isConfirmed) {
      __decTipoSeleccionado = 'FINALIZADO';
      document.getElementById('modal-dec-titulo').textContent = 'Finalizar la asignación';
      document.getElementById('modal-dec-solicitud').value = '';
      document.getElementById('modal-decision').classList.remove('hidden');
    } else if (result.isDenied) {
      __decTipoSeleccionado = 'PENDIENTE EVIDENCIA';
      document.getElementById('modal-dec-titulo').textContent = 'Pedir la evidencia';
      document.getElementById('modal-dec-solicitud').value = '';
      document.getElementById('modal-decision').classList.remove('hidden');
    }
  });
}

document.getElementById('btn-dec-cancelar')?.addEventListener('click', () => {
  playSoundOnce(SOUNDS.back);
  document.getElementById('modal-decision').classList.add('hidden');
  __decTipoSeleccionado = null;
  __decRowActual = null;
});

document.getElementById('btn-dec-guardar')?.addEventListener('click', async () => {
  if (!__decRowActual || !__decTipoSeleccionado) return;
  const row      = __decRowActual;
  const solicitud = String(document.getElementById('modal-dec-solicitud').value || '').trim();
  const tipo     = __decTipoSeleccionado;

  try {
    /* FASE 2 — estado + aviso al asignado + lista nueva, en UN viaje
       (procdecision). El texto sale de las plantillas proc.finalizado y
       proc.pendevidencia de Configuración. */
    const resDec = await apiPost('procDecision', {
      uid: uidActual_(), id_proceso: row.id_proceso, rowIndex: row.rowIndex,
      estado: tipo, texto: solicitud
    });

    document.getElementById('modal-decision').classList.add('hidden');
    __decTipoSeleccionado = null;
    __decRowActual = null;

    playSoundOnce(SOUNDS.success);
    const titulo = tipo === 'FINALIZADO' ? 'ASIGNACIÓN FINALIZADA' : 'PENDIENTE DE EVIDENCIA';
    await Swal.fire({ icon:'success', title: titulo, timer:2000, showConfirmButton:false });
    await abrirVistaAsignaciones_(resDec && resDec.lista);
  } catch (e) {
    Swal.fire({ icon:'error', title:'Error', text: String(e.message || e) });
  }
});

  /* ============================================================
   CHAT TIEMPO REAL — Firebase Realtime Database
   ============================================================ */

/* ── 1. Cargar Firebase SDK (compat para uso sin bundler) ── */
(function loadFirebaseSDK_() {
  const scripts = [
    'https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js',
    'https://www.gstatic.com/firebasejs/10.12.2/firebase-database-compat.js'
  ];
  scripts.forEach(src => {
    if (document.querySelector(`script[src="${src}"]`)) return;
    const s = document.createElement('script');
    s.src = src; s.defer = true;
    document.head.appendChild(s);
  });
})();

/* ── 2. Config Firebase ─────────────────────────────────── */
/* FASE 3 — la configuración del chat viaja SOLO en el login
   (Configuración → Avanzado → chat.firebase); ya no hay copia escrita aquí. */

/* ── 3. Estado global del chat ──────────────────────────── */
let __fbApp      = null;
let __fbDB       = null;
let __chatRef    = null;   // ref a mensajes del proceso activo
let __typingRef  = null;   // ref a indicadores de escritura
let __chatProcId = null;   // id_proceso activo en el chat
let __chatProc   = null;   // objeto proceso completo
let __chatUnsubMsg    = null; // unsubscribe mensajes
let __chatUnsubTyping = null; // unsubscribe typing
let __typingTimer     = null; // debounce escritura
let __chatOpen        = false;
let __lastMsgCount    = 0;
let __chatToastTimer  = null;
let __lastDateShown   = '';

/* ── 4. Inicializar Firebase (lazy, cuando se abre el chat) ─*/
function initFirebase_() {
  return new Promise((resolve) => {
    if (__fbDB) { resolve(__fbDB); return; }

    const waitForSDK = () => {
      /* FASE 2 — también hay que esperar al módulo de la base: los dos
         scripts llegan por separado y a veces 'app' llega primero. */
      if (typeof firebase === 'undefined' || !firebase.app || typeof firebase.database !== 'function') {
        setTimeout(waitForSDK, 80);
        return;
      }
      try {
        /* FASE 3 — app de Firebase CON NOMBRE ('chat'): la de por defecto
           queda para los avisos push (otro proyecto de Firebase). Antes el
           chat tomaba la primera que hubiera y se habrían cruzado. */
        const cfgChat = window.HAC_PUBLICO && window.HAC_PUBLICO.chatFirebase;
        if (!cfgChat || !cfgChat.databaseURL) { resolve(null); return; }
        __fbApp = firebase.apps.filter(a => a.name === 'chat')[0] || firebase.initializeApp(cfgChat, 'chat');
        __fbDB = firebase.database(__fbApp);
        resolve(__fbDB);
      } catch (e) {
        console.error('Firebase init error:', e);
        resolve(null);
      }
    };
    waitForSDK();
  });
}

/* ── 5. Utilidades de tiempo ────────────────────────────── */
function tsRelativo_(ts) {
  if (!ts) return '';
  const diff = Date.now() - ts;
  if (diff < 60000)  return 'ahora';
  if (diff < 3600000) return Math.floor(diff / 60000) + ' min';
  if (diff < 86400000) return Math.floor(diff / 3600000) + 'h';
  const d = new Date(ts);
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`;
}

function fechaCorta_(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const hoy = new Date();
  if (d.toDateString() === hoy.toDateString()) return 'HOY';
  const ayer = new Date(hoy); ayer.setDate(hoy.getDate() - 1);
  if (d.toDateString() === ayer.toDateString()) return 'AYER';
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
}

function horaHHMM_(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

/* ── 6. Render de un mensaje ────────────────────────────── */
function renderChatMsg_(key, data, container) {
  const esMio = normalizeText_(data.autor || '') ===
                normalizeText_(currentUser?.nombre || '');

  // Separador de fecha
  const fechaStr = fechaCorta_(data.ts);
  if (fechaStr !== __lastDateShown) {
    __lastDateShown = fechaStr;
    const sep = document.createElement('div');
    sep.className = 'chat-date-sep';
    sep.textContent = '── ' + fechaStr + ' ──';
    sep.dataset.msgKey = key + '_sep';
    container.appendChild(sep);
  }

  const wrap = document.createElement('div');
  wrap.className = 'chat-msg ' + (esMio ? 'mine' : 'other');
  wrap.dataset.msgKey = key;

  const author = document.createElement('div');
  author.className = 'chat-author';
  author.textContent = esMio ? 'Tú' : (data.autor || '');

  const bubble = document.createElement('div');
  bubble.className = 'chat-bubble';
  // Preservar saltos de línea
  bubble.innerHTML = escapeHtml_(data.texto || '').replace(/\n/g, '<br>');

  const meta = document.createElement('div');
  meta.className = 'chat-meta';
  meta.innerHTML = `<span>${horaHHMM_(data.ts)}</span>`;

  wrap.appendChild(author);
  wrap.appendChild(bubble);
  wrap.appendChild(meta);
  return wrap;
}

/* ── 7. Scroll al fondo ─────────────────────────────────── */
function chatScrollBottom_(force) {
  const c = document.getElementById('chat-messages');
  if (!c) return;
  const nearBottom = c.scrollHeight - c.scrollTop - c.clientHeight < 120;
  if (force || nearBottom) {
    requestAnimationFrame(() => { c.scrollTop = c.scrollHeight; });
  }
}

/* ── 8. Toast mensaje nuevo ─────────────────────────────── */
function showChatToast_(autor) {
  const t = document.getElementById('chat-toast');
  if (!t) return;
  t.textContent = (autor ? 'Mensaje de ' + autor : 'Nuevo mensaje');
  t.classList.add('show');
  clearTimeout(__chatToastTimer);
  __chatToastTimer = setTimeout(() => t.classList.remove('show'), 3500);
}

/* ── 9. Abrir chat ──────────────────────────────────────── */
async function abrirChat_(row) {
  if (!currentUser) return;

  __chatProc  = row;
  __chatProcId = row.id_proceso;
  __lastDateShown = '';

  // Header
  document.getElementById('chat-header-title').textContent =
    (row.consecutivo || row.id_proceso) + ' — ' + (row.descripcion || '').substring(0, 40);
  document.getElementById('chat-header-sub').textContent =
    (row.asignado || '') + (row.asistente ? ' · ' + row.asistente : '');

// Limpiar mensajes anteriores
const container = document.getElementById('chat-messages');
container.innerHTML = '';
__lastDateShown = '';

// Re-crear el placeholder vacío en lugar de reutilizar el del DOM
const emptyPlaceholder = document.createElement('div');
emptyPlaceholder.id = 'chat-empty';
emptyPlaceholder.className = 'chat-empty';
emptyPlaceholder.innerHTML = `
  <img src="img/chincheta.png" alt="">
  <p>Aún no hay mensajes.<br>¡Sé el primero en escribir!</p>
`;
container.appendChild(emptyPlaceholder);

  // Desuscribir listeners previos
  cerrarListeners_();

  // Abrir modal
  document.getElementById('modal-chat').classList.add('open');
  // Botón de resetear el chat: solo quien tenga el rol DEV
  // (FASE 5 — antes estaba amarrado a un nombre propio)
const resetBtn = document.getElementById('btn-chat-reset');
if (resetBtn) {
  resetBtn.style.display = alcRol_('DEV') ? 'flex' : 'none';
}
  
  document.body.style.overflow = 'hidden';
  __chatOpen = true;

  // Inicializar Firebase
  const db = await initFirebase_();
  if (!db) {
    Swal.fire({ icon: 'error', title: 'Error de conexión', text: 'No se pudo conectar con Firebase.' });
    cerrarChat_();
    return;
  }

  // Refs
  __chatRef   = db.ref('chats/' + __chatProcId + '/mensajes');
  __typingRef = db.ref('chats/' + __chatProcId + '/typing/' +
    encodeURIComponent(currentUser.nombre || 'usuario'));

  // Escuchar mensajes en tiempo real
  let primeraCarga = true;
__chatUnsubMsg = __chatRef.on('child_added', (snap) => {
  const data = snap.val();
  if (!data) return;

  // Ocultar placeholder — buscar por id de forma segura
  const empty = container.querySelector('#chat-empty') ||
                document.getElementById('chat-empty');
  if (empty) empty.style.display = 'none';

  const msgEl = renderChatMsg_(snap.key, data, container);
  container.appendChild(msgEl);

    if (primeraCarga) {
      chatScrollBottom_(true);
    } else {
      // Mensaje nuevo mientras ya está abierto
      const esMio = normalizeText_(data.autor || '') ===
                    normalizeText_(currentUser?.nombre || '');
      if (esMio) {
        chatScrollBottom_(true);
      } else {
        chatScrollBottom_(false);
        if (!__chatOpen) showChatToast_(data.autor);
        // Notificación si el chat está abierto pero el usuario scrolleó arriba
        const c2 = document.getElementById('chat-messages');
        const nearBottom = c2.scrollHeight - c2.scrollTop - c2.clientHeight < 120;
        if (!nearBottom) showChatToast_(data.autor);
      }
    }
  });

  // Marcar primera carga completa
  __chatRef.once('value', () => {
    primeraCarga = false;
    chatScrollBottom_(true);
  });

  // Escuchar indicadores de escritura (otros usuarios)
  const typingRootRef = db.ref('chats/' + __chatProcId + '/typing');
  __chatUnsubTyping = typingRootRef.on('value', (snap) => {
    const typing = snap.val() || {};
    const others = Object.entries(typing)
      .filter(([k, v]) => {
        const nombre = decodeURIComponent(k);
        return v === true &&
               normalizeText_(nombre) !== normalizeText_(currentUser?.nombre || '');
      })
      .map(([k]) => decodeURIComponent(k).split(' ')[0]); // solo primer nombre

    const typingEl  = document.getElementById('chat-typing');
    const typingWho = document.getElementById('chat-typing-who');
    if (others.length && typingEl) {
      typingWho.textContent = others[0];
      typingEl.classList.add('visible');
      chatScrollBottom_(false);
    } else if (typingEl) {
      typingEl.classList.remove('visible');
    }
  });

  // Input foco
  setTimeout(() => document.getElementById('chat-input')?.focus(), 180);
}

/* ── 10. Cerrar chat ────────────────────────────────────── */
function cerrarChat_() {
  document.getElementById('modal-chat').classList.remove('open');
  document.body.style.overflow = '';
  __chatOpen = false;
  // Limpiar presencia typing
  if (__typingRef) {
    __typingRef.set(false).catch(() => {});
  }
  cerrarListeners_();
}

function cerrarListeners_() {
  if (__chatRef && __chatUnsubMsg) {
    __chatRef.off('child_added', __chatUnsubMsg);
    __chatUnsubMsg = null;
  }
  if (__typingRef) {
    const typingRootRef2 = __typingRef.parent;
    if (typingRootRef2 && __chatUnsubTyping) {
      typingRootRef2.off('value', __chatUnsubTyping);
      __chatUnsubTyping = null;
    }
  }
  clearTimeout(__typingTimer);
}

/* ── 11. Enviar mensaje ─────────────────────────────────── */
async function enviarMensaje_() {
  const inp = document.getElementById('chat-input');
  if (!inp) return;
  const texto = inp.value.trim();
  if (!texto || !__chatRef) return;

  inp.value = '';
  inp.style.height = '';

  // Limpiar typing
  if (__typingRef) __typingRef.set(false).catch(() => {});
  clearTimeout(__typingTimer);

  try {
    await __chatRef.push({
      autor: currentUser?.nombre || 'Usuario',
      texto: texto,
      ts:    firebase.database.ServerValue.TIMESTAMP
    });
  } catch (e) {
    Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo enviar el mensaje.' });
  }
}

/* ── 12. Indicador de escritura (debounce 2.5s) ─────────── */
function onChatInputChange_() {
  if (!__typingRef) return;
  __typingRef.set(true).catch(() => {});
  clearTimeout(__typingTimer);
  __typingTimer = setTimeout(() => {
    __typingRef.set(false).catch(() => {});
  }, 2500);
}

/* ── 13. Auto-resize textarea ───────────────────────────── */
function chatInputAutoResize_() {
  const el = document.getElementById('chat-input');
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 120) + 'px';
}

/* ── 14. Badges de no leídos en botones de la lista ─────── */
let __chatBadgeListeners = {}; // id_proceso → unsubscribe

function suscribirBadgeChat_(idProceso, btnEl) {
  if (__chatBadgeListeners[idProceso]) return; // ya suscrito
  initFirebase_().then(db => {
    if (!db) return;
    const ref = db.ref('chats/' + idProceso + '/mensajes');
    const handler = ref.on('value', snap => {
      const data = snap.val() || {};
      const total = Object.keys(data).length;
      // Badge en botón chat de la tarjeta (si existe)
      const badge = btnEl?.querySelector('.chat-unread-badge');
      if (badge) badge.textContent = total > 99 ? '99+' : String(total);
    });
    __chatBadgeListeners[idProceso] = () => ref.off('value', handler);
  });
}

/* ── 15. Eventos ────────────────────────────────────────── */
document.getElementById('btn-chat-close')?.addEventListener('click', () => {
  playSoundOnce(SOUNDS.back);
  cerrarChat_();
});

// Cerrar al clic fuera del chat-box
document.getElementById('modal-chat')?.addEventListener('click', (e) => {
  if (e.target === document.getElementById('modal-chat')) cerrarChat_();
});

// Enviar con botón
document.getElementById('btn-chat-send')?.addEventListener('click', () => {
  playSoundOnce(SOUNDS.success);
  enviarMensaje_();
});

// Enviar con Enter (Shift+Enter = salto de línea)
document.getElementById('chat-input')?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    playSoundOnce(SOUNDS.success);
    enviarMensaje_();
  }
});

// Typing + auto-resize
document.getElementById('chat-input')?.addEventListener('input', () => {
  onChatInputChange_();
  chatInputAutoResize_();
});

// Cerrar con Escape
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && __chatOpen) cerrarChat_();
});

/* ── 16. PATCH abrirVerAsignacion_: agregar botón chat ──── */
const __origVerAsig2 = abrirVerAsignacion_;
abrirVerAsignacion_ = function(row) {
  __origVerAsig2(row);

  // Agregar botón chat en proc-ver-actions si no existe
  setTimeout(() => {
    const actionsWrap = document.getElementById('proc-ver-actions');
    if (!actionsWrap) return;

    // ── NUEVO: eliminar botón chat anterior (si quedó de otra asignación)
    const prevBtn = actionsWrap.querySelector('.proc-btn-chat');
    if (prevBtn) prevBtn.remove();

    // ── NUEVO: cancelar listener de badge anterior
    if (typeof __chatBadgeCurrentUnsubscribe_ === 'function') {
      __chatBadgeCurrentUnsubscribe_();
      __chatBadgeCurrentUnsubscribe_ = null;
    }

    const btnChat = document.createElement('button');
    btnChat.type = 'button';
    btnChat.className = 'proc-btn-chat proc-action-btn';
    btnChat.innerHTML = `
      <img src="img/chat.webp"
           alt="Chat" style="width:22px;height:22px;" />
      CHAT
      <span class="chat-unread-badge" id="chat-badge-ver" style="display:none;"></span>
    `;
    btnChat.addEventListener('click', () => {
      playSoundOnce(SOUNDS.menu);
      // ── NUEVO: siempre pasa el row ACTUAL (no una referencia vieja)
      abrirChat_(row);
    });

    // Insertar como primer botón
    actionsWrap.insertBefore(btnChat, actionsWrap.firstChild);

    // ── NUEVO: Badge ligado al id_proceso del row ACTUAL
    initFirebase_().then(db => {
      if (!db) return;

      const badgeRef = db.ref('chats/' + row.id_proceso + '/mensajes');
      const badgeHandler = badgeRef.on('value', snap => {
        const badge = document.getElementById('chat-badge-ver');
        if (!badge) return;
        const n = snap.numChildren();
        if (n > 0) {
          badge.textContent = n > 99 ? '99+' : String(n);
          badge.style.display = '';
        } else {
          badge.style.display = 'none';
        }
      });

      // Guardar función para cancelar este listener al abrir otra asignación
      window.__chatBadgeCurrentUnsubscribe_ = () => {
        badgeRef.off('value', badgeHandler);
      };
    });

  }, 80);
};

  /* ── RESET CHAT (solo rol DEV) ─────────────────────────── */
document.getElementById('btn-chat-reset')?.addEventListener('click', async () => {
  if (!__fbDB || !__chatProcId) return;

  const ok = await Swal.fire({
    icon: 'warning',
    title: 'Resetear Chat',
    html: '¿Estás seguro? Se eliminarán <b>todos los mensajes</b> de este chat. Esta acción es irreversible.',
    showCancelButton: true,
    confirmButtonText: 'Sí, eliminar todo',
    cancelButtonText: 'Cancelar'
  });
  if (!ok.isConfirmed) return;

  try {
    // Borrar todo el nodo del chat en Firebase
    await __fbDB.ref('chats/' + __chatProcId).remove();

    // Limpiar visualmente el contenedor de mensajes
    const container = document.getElementById('chat-messages');
    if (container) {
      container.innerHTML = '';
      __lastDateShown = '';

      // Re-insertar el placeholder vacío
      const emptyEl = document.createElement('div');
      emptyEl.id = 'chat-empty';
      emptyEl.className = 'chat-empty';
      emptyEl.innerHTML = `
        <img src="img/chincheta.png" alt="">
        <p>Aún no hay mensajes.<br>¡Sé el primero en escribir!</p>
      `;
      container.appendChild(emptyEl);
    }

    playSoundOnce(SOUNDS.success);
    await Swal.fire({ icon: 'success', title: 'Chat reiniciado', timer: 1500, showConfirmButton: false });
  } catch (e) {
    Swal.fire({ icon: 'error', title: 'Error', text: String(e.message || e) });
  }
});

  /* ============================================================
   SOLICITUD EXPEDIENTE (antes "con SOLMAR")
   17/09/2026 — el modal MENSAJE O BITÁCORA, el lector, el envío y el
   aviso por WhatsApp viven en js/solicitud-exp.js (window.SOLEXP), que
   sirve a ASIGNACIONES y a BD PREDIAL con la misma regla. Aquí solo
   queda la puerta con el nombre de siempre.
   El envío ya NO arma el historial en el navegador: el servidor añade
   el mensaje nuevo con su fecha (SolicitudExp.gs), así dos personas
   escribiendo a la vez no se pisan.
   ============================================================ */

function abrirExpedienteModal_(row) {
  if (window.SOLEXP && typeof window.SOLEXP.abrir === 'function') {
    window.SOLEXP.abrir('view-asignaciones', row);
    return;
  }
  Swal.fire({ icon: 'warning', title: 'No se pudo abrir',
              text: 'Falta js/solicitud-exp.js. Recarga la app.' });
}

function cerrarExpedienteModal_() {
  if (window.SOLEXP && typeof window.SOLEXP.cerrar === 'function') window.SOLEXP.cerrar();
  else document.getElementById('modal-expediente')?.classList.add('hidden');
}

/* ── PATCH renderProcList_: botón expediente + chat en tarjeta ── */
const __origRenderProcListFinal = renderProcList_;
renderProcList_ = function(items) {
  __origRenderProcListFinal(items);

  const wrap = document.getElementById('proc-list');
  if (!wrap) return;

  const cards = wrap.querySelectorAll('.proc-card');
  const esSolMar = esArchivo_();

  // Cancelar listeners de badge anteriores para evitar fugas de memoria
  if (window.__chatCardBadgeUnsubs) {
    window.__chatCardBadgeUnsubs.forEach(fn => { try { fn(); } catch(_) {} });
  }
  window.__chatCardBadgeUnsubs = [];

  cards.forEach((card, idx) => {
    const row = items[idx];
    if (!row) return;

    const iconsWrap = card.querySelector('.proc-icons');
    if (!iconsWrap) return;

    // Si es SOL MAR: ocultar TODOS los botones excepto el de expediente
    if (esSolMar) {
      iconsWrap.querySelectorAll('.proc-icon-btn').forEach(b => { b.style.display = 'none'; });
    }

    // ── 1. BOTÓN SOLICITUD EXPEDIENTE (primera posición) ─────
    // Evitar duplicados
    if (!iconsWrap.querySelector('.proc-btn-expediente-wrap')) {
      const btnExp = document.createElement('button');
      btnExp.type = 'button';
      btnExp.className = 'proc-icon-btn proc-btn-expediente-wrap';
      btnExp.title = 'Solicitud Expediente';
      btnExp.setAttribute('aria-label', 'Solicitud Expediente');
      btnExp.innerHTML = `<img src="img/expediente.webp"
        alt="Expediente" style="width:24px;height:24px;object-fit:contain;" />`;
      btnExp.addEventListener('click', () => {
        playSoundOnce(SOUNDS.menu);
        abrirExpedienteModal_(row);
      });
      iconsWrap.insertBefore(btnExp, iconsWrap.firstChild);
    }
    /* 17/09 — rojo con latido si falta la respuesta de ARCHIVO. */
    window.SOLEXP?.pintarBoton(iconsWrap.querySelector('.proc-btn-expediente-wrap'), row, 'view-asignaciones');

    // ── 2. BOTÓN CHAT (segunda posición, después de expediente) ─
    // SOL MAR no tiene acceso al chat en tarjetas
    if (!esSolMar && !iconsWrap.querySelector('.proc-btn-chat-card')) {

      const btnChat = document.createElement('button');
      btnChat.type = 'button';
      btnChat.className = 'proc-icon-btn proc-btn-chat-card';
      btnChat.title = 'Chat de asignación';
      btnChat.setAttribute('aria-label', 'Chat');
      btnChat.style.position = 'relative'; // necesario para el badge absoluto
      btnChat.innerHTML = `
        <img src="img/chat.webp"
             alt="Chat" style="width:24px;height:24px;object-fit:contain;" />
        <span class="chat-unread-badge" id="chat-card-badge-${row.id_proceso}"
              style="display:none;"></span>
      `;
      btnChat.addEventListener('click', () => {
        playSoundOnce(SOUNDS.menu);
        abrirChat_(row);
      });

      // Insertar en segunda posición (después del botón expediente)
      const expBtn = iconsWrap.querySelector('.proc-btn-expediente-wrap');
      if (expBtn && expBtn.nextSibling) {
        iconsWrap.insertBefore(btnChat, expBtn.nextSibling);
      } else if (expBtn) {
        iconsWrap.appendChild(btnChat);
      } else {
        iconsWrap.insertBefore(btnChat, iconsWrap.firstChild);
      }

      // Badge en tiempo real con Firebase (independiente por tarjeta)
      initFirebase_().then(db => {
        if (!db) return;

        const badgeRef = db.ref('chats/' + row.id_proceso + '/mensajes');
        const badgeHandler = badgeRef.on('value', snap => {
          const badge = document.getElementById('chat-card-badge-' + row.id_proceso);
          if (!badge) return;
          const n = snap.numChildren();
          if (n > 0) {
            badge.textContent = n > 99 ? '99+' : String(n);
            badge.style.display = '';
          } else {
            badge.style.display = 'none';
          }
        });

        // Guardar función de limpieza
        window.__chatCardBadgeUnsubs.push(() => {
          badgeRef.off('value', badgeHandler);
        });
      });
    }
  });
};

  /* ============================================================
   PANEL DASHBOARD — Lógica
   ============================================================ */

/* ── Iconos panel ───────────────────────────────────────── */
const PANEL_ICON_BARRAS  = 'img/barras.png';
const PANEL_ICON_USUARIOS= 'img/usuarios.webp';
const PANEL_ICON_RELOJ   = 'img/reloj.png';
const PANEL_ICON_TARGET  = 'img/target.webp';

/* ── Estado panel ───────────────────────────────────────── */
let __panelTabActual  = 'resumen';
let __panelCharts     = {};

/* ── Colores estados ─────────────────────────────────────── */
const PANEL_ESTADO_COLORS = {
  'ASIGNADO':              '#2563eb',
  'EN PROYECCIÓN':         '#7c3aed',
  'PENDIENTE EVIDENCIA':   '#f97316',
  'PENDIENTE ASIGNACION':  '#d97706',
  'FINALIZADO':            '#16a34a',
  'REBOTADO':              '#dc2626'
};

/* ── Colores categoría ──────────────────────────────────── */
const PANEL_CAT_COLORS_LIST = ['#1e40af','#15803d','#6d28d9','#c2410c'];

/* Color fijo por categoría (usa CAT_COLORS; si no está, cae al ciclo) */
function panelCatColor_(cat, idx) {
  const c = getCatColor_(cat);
  return (c && c.border) ? c.border : PANEL_CAT_COLORS_LIST[idx % PANEL_CAT_COLORS_LIST.length];
}

/* ── Destruir chart panel ───────────────────────────────── */
function panelDestroyChart_(key) {
  try {
    if (__panelCharts[key]) {
      __panelCharts[key].destroy();
      delete __panelCharts[key];
    }
  } catch(_) {}
}

/* ── Cambiar tab ─────────────────────────────────────────── */
function panelShowTab_(tab) {
  __panelTabActual = tab;
  const tabs   = ['resumen','equipo','tiempo','cats'];
  const tabIds = { resumen:'panel-tab-resumen', equipo:'panel-tab-equipo',
                   tiempo:'panel-tab-tiempo',   cats:'panel-tab-cats' };
  tabs.forEach(t => {
    const viewEl = document.getElementById('panel-view-' + t);
    const tabEl  = document.getElementById(tabIds[t]);
    if (!viewEl || !tabEl) return;
    const isActive = (t === tab);
    viewEl.style.display = isActive ? '' : 'none';
    tabEl.classList.toggle('active', isActive);
    if (isActive) {
      viewEl.classList.remove('panel-animate');
      void viewEl.offsetWidth; // reflow para reiniciar animación
      viewEl.classList.add('panel-animate');
    }
  });

  // Renderizar el tab seleccionado con los datos actuales
  if (!window.__panelData) return;
  switch(tab) {
    case 'resumen': panelRenderResumen_(__panelData); break;
    case 'equipo':  panelRenderEquipo_(__panelData);  break;
    case 'tiempo':  panelRenderTiempo_(__panelData);  break;
    case 'cats':    panelRenderCats_(__panelData);    break;
  }
}

/* ── Regresar ────────────────────────────────────────────── */
function panelGoBack_() {
  playSoundOnce(SOUNDS.back);
  // Destruir todos los charts para liberar memoria
  Object.keys(__panelCharts).forEach(k => panelDestroyChart_(k));
  showView('view-asignaciones');
}

/* ── Abrir panel ─────────────────────────────────────────── */
async function abrirPanel_() {
  if (!currentUser?.isSuper) {
    Swal.fire({ icon: 'warning', title: 'Solo SUPER USUARIO' });
    return;
  }
  playSoundOnce(SOUNDS.menu);
  showView('view-panel');
  panelShowTab_('resumen');

  try {
    /* FASE 2 — el panel se abre desde Mi semáforo, que ya tiene las
       asignaciones en memoria (y el EN VIVO las mantiene al día): no se
       vuelven a pedir. Solo si por algo no están, se piden. */
    const data = (Array.isArray(__procListCache) && __procListCache.length)
      ? __procListCache
      : await apiGet('listProcesos', { uid: uidActual_() });
    const rows  = Array.isArray(data) ? data : [];
    window.__panelData = rows;

    const subtitle = document.getElementById('panel-subtitle');
    if (subtitle) {
      const ts = new Date();
      subtitle.textContent =
        `${rows.length} asignaciones · Actualizado ${String(ts.getHours()).padStart(2,'0')}:${String(ts.getMinutes()).padStart(2,'0')}`;
    }

    panelRenderResumen_(rows);
  } catch(e) {
    Swal.fire({ icon: 'error', title: 'Error al cargar datos', text: String(e.message || e) });
  }
}

/* ── Helpers estadísticas ────────────────────────────────── */
function panelCountByKey_(rows, key) {
  const map = {};
  rows.forEach(r => {
    const v = String(r[key] || '').trim().toUpperCase() || 'SIN DATO';
    map[v] = (map[v] || 0) + 1;
  });
  return map;
}

function panelSemaforoDistrib_(rows) {
  const dist = { verde: 0, naranja: 0, rojo: 0, 'rojo-claro': 0, gris: 0 };
  rows.forEach(r => {
    const sem = calcSemaforo_(r);
    const cls = sem.clase.replace('semaforo-', '');
    if (dist[cls] !== undefined) dist[cls]++;
    else dist.gris++;
  });
  return dist;
}

/* ── TAB: RESUMEN ────────────────────────────────────────── */
function panelRenderResumen_(rows) {
  const total     = rows.length;
  const pendAsig  = rows.filter(r => normalizeText_(r.estado||'') === 'PENDIENTE ASIGNACION').length;
  const asignados = rows.filter(r => normalizeText_(r.estado||'') === 'ASIGNADO').length;
  const enProy    = rows.filter(r => normalizeText_(r.estado||'') === 'EN PROYECCION').length;
  const pendEv    = rows.filter(r => normalizeText_(r.estado||'').includes('EVIDENCIA')).length;
  const finaliz   = rows.filter(r => normalizeText_(r.estado||'') === 'FINALIZADO').length;
  const activos   = total - finaliz;

  // ── KPIs ────────────────────────────────────────────────
  const kpiWrap = document.getElementById('panel-kpis-main');
  if (kpiWrap) {
    kpiWrap.innerHTML = '';
    const kpis = [
      { icon: PANEL_ICON_BARRAS,   value: total,    label: 'Total',          sub: 'asignaciones',       cls: '' },
      { icon: PANEL_ICON_TARGET,   value: activos,  label: 'Activas',        sub: 'en seguimiento',     cls: 'kpi-blue' },
      { icon: PANEL_ICON_USUARIOS, value: asignados,label: 'Asignadas',      sub: 'esperando respuesta',cls: 'kpi-blue' },
      { icon: PANEL_ICON_RELOJ,    value: enProy,   label: 'En Proyección',  sub: 'trabajando en ello', cls: 'kpi-naranja' },
      { icon: PANEL_ICON_TARGET,   value: pendEv,   label: 'Pend. Evidencia',sub: 'falta soporte',      cls: 'kpi-naranja' },
      { icon: PANEL_ICON_BARRAS,   value: finaliz,  label: 'Finalizadas',    sub: 'completadas',        cls: 'kpi-verde' }
    ];
    kpis.forEach(k => {
      const el = document.createElement('div');
      el.className = 'kpi-card ' + k.cls;
      el.innerHTML = `
        <img class="kpi-icon" src="${k.icon}" alt="${k.label}" />
        <div class="kpi-value">${k.value}</div>
        <div class="kpi-label">${k.label}</div>
        <div class="kpi-sub">${k.sub}</div>
      `;
      kpiWrap.appendChild(el);
    });
  }

  // ── Semáforo visual ──────────────────────────────────────
  const semDist = panelSemaforoDistrib_(rows);
  const semWrap = document.getElementById('panel-semaforo');
  if (semWrap) {
    semWrap.innerHTML = '';
    const semConfig = [
      { key: 'verde',      label: 'A TIEMPO',         cls: 'semaforo-verde' },
      { key: 'naranja',    label: 'MITAD DE PLAZO',   cls: 'semaforo-naranja' },
      { key: 'rojo-claro', label: '≤ 3 DÍAS',         cls: 'semaforo-rojo-claro' },
      { key: 'rojo',       label: 'VENCIDO',          cls: 'semaforo-rojo' },
      { key: 'gris',       label: 'FINALIZADO',       cls: 'semaforo-gris' }
    ];
    semConfig.forEach(s => {
      const sc = document.createElement('div');
      sc.className = 'sem-card ' + s.cls;
      sc.innerHTML = `
        <div class="sem-dot"></div>
        <div class="sem-value">${semDist[s.key] || 0}</div>
        <div class="sem-label">${s.label}</div>
      `;
      semWrap.appendChild(sc);
    });
  }

  // ── Chart estados ────────────────────────────────────────
  panelDestroyChart_('estados');
  const ctxEstados = document.getElementById('panel-chart-estados');
  if (ctxEstados) {
    const estadosMap = panelCountByKey_(rows, 'estado');
    const labels  = Object.keys(estadosMap);
    const values  = labels.map(l => estadosMap[l]);
    const colors  = labels.map(l =>
      PANEL_ESTADO_COLORS[l.toUpperCase()] ||
      Object.entries(PANEL_ESTADO_COLORS)
        .find(([k]) => normalizeText_(k) === normalizeText_(l))?.[1] ||
      '#94a3b8'
    );
    __panelCharts['estados'] = new Chart(ctxEstados, {
      type: 'bar',
      plugins: [window.ChartDataLabels || {}],
      data: {
        labels,
        datasets: [{
          data: values,
          backgroundColor: colors,
          borderRadius: 10,
          borderSkipped: false
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          datalabels: {
            color: '#fff',
            font: { weight: '900', size: 14 },
            anchor: 'center', align: 'center',
            formatter: v => v > 0 ? v : '',
            textStrokeColor: 'rgba(0,0,0,.3)',
            textStrokeWidth: 3
          }
        },
        scales: {
          x: {
            ticks: {
              color: '#3d5248', font: { weight: '700', size: 10 },
              maxRotation: 30, minRotation: 0
            },
            grid: { display: false }
          },
          y: {
            beginAtZero: true, ticks: { precision: 0, color: '#6b7c74', font: { weight: '600' } },
            grid: { color: 'rgba(6,64,43,.07)' }
          }
        }
      }
    });
  }
}

/* ── TAB: EQUIPO ─────────────────────────────────────────── */
function panelRenderEquipo_(rows) {
  const hoy = formatDDMMYYYY_(new Date());

  // Ranking por asignado en 4 buckets
  const byAsignado = {};
  rows.forEach(r => {
    const n = (r.asignado || '').trim().toUpperCase() || 'SIN ASIGNAR';
    if (!byAsignado[n]) byAsignado[n] = { total: 0, activo: 0, porVencer: 0, vencida: 0, finaliz: 0 };
    byAsignado[n].total++;

    const estado = normalizeText_(r.estado || '');
    if (estado === 'FINALIZADO') {
      byAsignado[n].finaliz++;
    } else {
      const faltan = diasHabiles_(hoy, r.respuesta);
      if (faltan < 0)                       byAsignado[n].vencida++;    // estrictamente vencida
      else if (faltan >= 0 && faltan <= 3)  byAsignado[n].porVencer++;  // hoy y 1–3 días hábiles
      else                                  byAsignado[n].activo++;     // > 3 días
    }
  });

  const sorted = Object.entries(byAsignado)
    .sort((a,b) => b[1].total - a[1].total);

  // Ranking
  const rankWrap = document.getElementById('panel-ranking');
  if (rankWrap) {
    rankWrap.innerHTML = '';
    if (!sorted.length) {
      rankWrap.innerHTML = '<div class="panel-empty">Sin datos de equipo.</div>';
    } else {
      sorted.forEach(([nombre, stats], idx) => {
        const initials = nombre.split(' ').slice(0,2).map(w=>w[0]||'').join('');
        const posCls   = idx === 0 ? 'gold' : idx === 1 ? 'silver' : idx === 2 ? 'bronze' : '';
        const medals   = ['🥇','🥈','🥉'];
        const posSymbol= idx < 3 ? medals[idx] : (idx + 1);

        const parts = [];
        if (stats.activo > 0)    parts.push(`<span style="color:#16a34a;font-weight:800;">ACTIVO: ${stats.activo}</span>`);
        if (stats.porVencer > 0) parts.push(`<span style="color:#f97316;font-weight:800;">POR VENCER: ${stats.porVencer}</span>`);
        if (stats.vencida > 0)   parts.push(`<span style="color:#dc2626;font-weight:800;">VENCIDAS: ${stats.vencida}</span>`);
        if (stats.finaliz > 0)   parts.push(`<span style="color:#6b7280;font-weight:800;">FINALIZADAS: ${stats.finaliz}</span>`);
        const detailHtml = parts.length
          ? parts.join(' · ')
          : '<span style="color:var(--text-muted);">Sin asignaciones</span>';

        const item = document.createElement('div');
        item.className = 'ranking-item';
        item.innerHTML = `
          <div class="ranking-pos ${posCls}">${posSymbol}</div>
          <div class="ranking-avatar">${initials}</div>
          <div class="ranking-info">
            <div class="ranking-name">${escapeHtml_(nombre)}</div>
            <div class="ranking-detail" style="font-size:.66rem;line-height:1.45;">${detailHtml}</div>
          </div>
          <div class="ranking-count">${stats.total}</div>
        `;
        rankWrap.appendChild(item);
      });
    }
  }

  // Chart carga de trabajo (4 series apiladas con colores semáforo)
  panelDestroyChart_('equipo');
  const ctxEq = document.getElementById('panel-chart-equipo');
  if (ctxEq && sorted.length) {
    const topN   = sorted.slice(0, 8);
    const labels = topN.map(([n]) => {
      const parts = n.split(' ');
      return parts.length >= 2 ? parts[0] + ' ' + parts[parts.length-1] : n;
    });
    const actData  = topN.map(([,s]) => s.activo);
    const pvData   = topN.map(([,s]) => s.porVencer);
    const venData  = topN.map(([,s]) => s.vencida);
    const finData  = topN.map(([,s]) => s.finaliz);

    __panelCharts['equipo'] = new Chart(ctxEq, {
      type: 'bar',
      plugins: [window.ChartDataLabels || {}],
      data: {
        labels,
        datasets: [
          { label: 'ACTIVO',      data: actData, backgroundColor: '#16a34a', borderRadius: 6, stack: 'stack' },
          { label: 'POR VENCER',  data: pvData,  backgroundColor: '#f97316', borderRadius: 6, stack: 'stack' },
          { label: 'VENCIDAS',    data: venData, backgroundColor: '#dc2626', borderRadius: 6, stack: 'stack' },
          { label: 'FINALIZADAS', data: finData, backgroundColor: '#6b7280', borderRadius: 6, stack: 'stack' }
        ]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { font: { weight: '700', size: 11 }, color: '#3d5248', boxWidth: 12, padding: 8 }
          },
          datalabels: {
            color: '#fff',
            font: { weight: '900', size: 11 },
            anchor: 'center', align: 'center',
            formatter: v => v > 0 ? v : '',
            textStrokeColor: 'rgba(0,0,0,.3)',
            textStrokeWidth: 3
          }
        },
        scales: {
          x: {
            stacked: true, beginAtZero: true,
            ticks: { precision: 0, color: '#6b7c74', font: { weight: '600' } },
            grid: { color: 'rgba(6,64,43,.07)' }
          },
          y: {
            stacked: true,
            ticks: { color: '#3d5248', font: { weight: '700', size: 11 } },
            grid: { display: false }
          }
        }
      }
    });
  }
}

/* ── TAB: TIEMPOS ────────────────────────────────────────── */
function panelRenderTiempo_(rows) {
  // Solo activos (no finalizados)
  const activos = rows.filter(r => normalizeText_(r.estado||'') !== 'FINALIZADO');
  const hoy = formatDDMMYYYY_(new Date());

  // Calcular días restantes
  const conDias = activos.map(r => {
    const faltan = diasHabiles_(hoy, r.respuesta);
    const sem    = calcSemaforo_(r);
    return { ...r, _faltan: faltan, _semClase: sem.clase, _semTxt: sem.texto };
  });

  // Ordenar: vencidos primero, luego por días asc
  conDias.sort((a,b) => a._faltan - b._faltan);

  // KPIs de tiempo
  const vencidos  = conDias.filter(r => r._faltan < 0).length;
  const hoyVence  = conDias.filter(r => r._faltan === 0).length;
  const tresDias  = conDias.filter(r => r._faltan > 0 && r._faltan <= 3).length;
  const enPlazo   = conDias.filter(r => r._faltan > 3).length;
  const promDias  = activos.length
    ? Math.round(conDias.filter(r=>r._faltan>0).reduce((a,b)=>a+b._faltan,0) /
        Math.max(conDias.filter(r=>r._faltan>0).length, 1))
    : 0;

  const kpiTiempoWrap = document.getElementById('panel-kpis-tiempo');
  if (kpiTiempoWrap) {
    kpiTiempoWrap.innerHTML = '';
    const kpis = [
      { icon: PANEL_ICON_RELOJ,   value: vencidos, label: 'Vencidos',     sub: 'requieren atención urgente', cls: 'kpi-rojo' },
      { icon: PANEL_ICON_RELOJ,   value: hoyVence, label: 'Vencen Hoy',   sub: 'vencimiento inmediato',      cls: 'kpi-rojo' },
      { icon: PANEL_ICON_TARGET,  value: tresDias, label: '≤ 3 Días',     sub: 'plazo muy corto',            cls: 'kpi-naranja' },
      { icon: PANEL_ICON_BARRAS,  value: enPlazo,  label: 'A Tiempo',     sub: 'más de 3 días hábiles',      cls: 'kpi-verde' },
      { icon: PANEL_ICON_RELOJ,   value: promDias, label: 'Días Prom.',   sub: 'promedio hábiles restantes', cls: '' }
    ];
    kpis.forEach(k => {
      const el = document.createElement('div');
      el.className = 'kpi-card ' + k.cls;
      el.innerHTML = `
        <img class="kpi-icon" src="${k.icon}" alt="${k.label}" />
        <div class="kpi-value">${k.value}</div>
        <div class="kpi-label">${k.label}</div>
        <div class="kpi-sub">${k.sub}</div>
      `;
      kpiTiempoWrap.appendChild(el);
    });
  }

  // Timeline
  const tlWrap = document.getElementById('panel-timeline');
  if (tlWrap) {
    tlWrap.innerHTML = '';
    if (!conDias.length) {
      tlWrap.innerHTML = '<div class="panel-empty">Sin asignaciones activas.</div>';
    } else {
      conDias.slice(0, 30).forEach(r => {
        const cls   = r._semClase.replace('semaforo-', 'tl-');
        const bgCls = r._faltan < 0  ? 'bg-rojo'
                    : r._faltan <= 3 ? 'bg-naranja'
                    : 'bg-verde';

        const item = document.createElement('div');
        item.className = `timeline-item ${cls}`;

        const fechaParts = String(r.respuesta || '').split('/');
        const fechaCorta = fechaParts.length === 3
          ? fechaParts[0] + '/' + fechaParts[1]
          : (r.respuesta || '—');

        item.innerHTML = `
          <div class="timeline-date">${escapeHtml_(fechaCorta)}<br><span style="font-size:.60rem;color:var(--text-muted);">${escapeHtml_(fechaParts[2]||'')}</span></div>
          <div class="timeline-info">
            <div class="timeline-name">${escapeHtml_((r.asignado||'').split(' ').slice(0,2).join(' '))}</div>
            <div class="timeline-desc">${escapeHtml_(r.descripcion||'')}</div>
          </div>
          <span class="timeline-badge ${bgCls}">${escapeHtml_(r._semTxt)}</span>
        `;
        tlWrap.appendChild(item);
      });
    }
  }
}

/* ── TAB: CATEGORÍAS ─────────────────────────────────────── */
function panelRenderCats_(rows) {
  // Categorías
  const catMap     = panelCountByKey_(rows, 'categoria');
  const sortedCats = Object.entries(catMap).sort((a,b) => b[1]-a[1]);
  const maxCat     = Math.max(...sortedCats.map(([,v])=>v), 1);

  // Lista categorías (igual que antes)
  const catsWrap = document.getElementById('panel-cats');
  if (catsWrap) {
    catsWrap.innerHTML = '';
    sortedCats.forEach(([cat, count], idx) => {
      const iconUrl = getCatIcon_(cat);
      const color   = panelCatColor_(cat, idx);
      const pct     = Math.round((count / maxCat) * 100);
      const item = document.createElement('div');
      item.className = 'cat-stat-item';
      item.innerHTML = `
        ${iconUrl ? `<img class="cat-stat-icon" src="${iconUrl}" alt="${cat}" />` : ''}
        <div class="cat-stat-info">
          <div class="cat-stat-name" title="${escapeHtml_(cat)}">${escapeHtml_(cat)}</div>
          <div class="cat-stat-bar-track">
            <div class="cat-stat-bar-fill" style="width:${pct}%;background:${color};"></div>
          </div>
        </div>
        <div class="cat-stat-count">${count}</div>
      `;
      catsWrap.appendChild(item);
    });
    if (!sortedCats.length) catsWrap.innerHTML = '<div class="panel-empty">Sin datos.</div>';
  }

  // Mapa: categoría → { subcat: count }
  const subcatPorCat = {};
  rows.forEach(r => {
    const cat    = String(r.categoria    || '').trim();
    const subcat = String(r.subcategoria || '').trim();
    if (!cat || !subcat) return;
    if (!subcatPorCat[cat]) subcatPorCat[cat] = {};
    subcatPorCat[cat][subcat] = (subcatPorCat[cat][subcat] || 0) + 1;
  });

  // Categoría activa por defecto = la más grande
  let activeCat = sortedCats[0]?.[0] || null;

  // Render lista + chart de subcats según categoría
  const renderSubcatsView = (catName) => {
    const titleListEl  = document.getElementById('panel-subcats-list-title');
    const titleChartEl = document.getElementById('panel-subcats-chart-title');
    const subcatsWrap  = document.getElementById('panel-subcats');

    const subMap = (catName && subcatPorCat[catName]) ? subcatPorCat[catName] : {};
    const titleSuffix = catName ? ` — ${catName}` : '';

    if (titleListEl)  titleListEl.textContent  = `POR SUBCATEGORÍA${titleSuffix}`;
    if (titleChartEl) titleChartEl.textContent = `GRÁFICO POR SUBCATEGORÍA${titleSuffix}`;

    const sortedSubs = Object.entries(subMap).sort((a,b) => b[1]-a[1]);
    const maxSub     = Math.max(...sortedSubs.map(([,v])=>v), 1);

    // Lista subcats
    if (subcatsWrap) {
      subcatsWrap.innerHTML = '';
      sortedSubs.slice(0, 10).forEach(([sub, count], idx) => {
        const iconUrl = getSubcatIcon_(sub);
        const color   = PANEL_CAT_COLORS_LIST[idx % PANEL_CAT_COLORS_LIST.length];
        const pct     = Math.round((count / maxSub) * 100);
        const item = document.createElement('div');
        item.className = 'cat-stat-item';
        item.innerHTML = `
          ${iconUrl ? `<img class="cat-stat-icon" src="${iconUrl}" alt="${sub}" />` : ''}
          <div class="cat-stat-info">
            <div class="cat-stat-name" title="${escapeHtml_(sub)}">${escapeHtml_(sub)}</div>
            <div class="cat-stat-bar-track">
              <div class="cat-stat-bar-fill" style="width:${pct}%;background:${color};"></div>
            </div>
          </div>
          <div class="cat-stat-count">${count}</div>
        `;
        subcatsWrap.appendChild(item);
      });
      if (!sortedSubs.length) {
        subcatsWrap.innerHTML = '<div class="panel-empty">Sin subcategorías.</div>';
      }
    }

    // Chart subcats (dona derecha)
    panelDestroyChart_('subcats');
    const ctxSubs = document.getElementById('panel-chart-subcats');
    if (ctxSubs && sortedSubs.length) {
      const labels = sortedSubs.map(([k]) => {
        const words = k.split(' ');
        return words.length > 3 ? words.slice(0,3).join(' ') + '…' : k;
      });
      const values = sortedSubs.map(([,v]) => v);
      const colors = sortedSubs.map((_,i) => PANEL_CAT_COLORS_LIST[i % PANEL_CAT_COLORS_LIST.length]);

      __panelCharts['subcats'] = new Chart(ctxSubs, {
        type: 'doughnut',
        plugins: [window.ChartDataLabels || {}],
        data: {
          labels,
          datasets: [{
            data: values,
            backgroundColor: colors,
            borderWidth: 3,
            borderColor: '#fff',
            hoverOffset: 10
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '60%',
          animation: { duration: 400 },
          plugins: {
            legend: {
              position: 'bottom',
              labels: { font: { weight: '700', size: 11 }, color: '#3d5248', boxWidth: 12, padding: 10 }
            },
            tooltip: {
              backgroundColor: 'rgba(255,255,255,.97)',
              titleColor: '#06402B', bodyColor: '#3d5248',
              borderColor: 'rgba(6,64,43,.15)', borderWidth: 1.5,
              padding: 10, cornerRadius: 10,
              callbacks: {
                label: (ctx) => {
                  const total = ctx.dataset.data.reduce((a,b)=>a+b,0) || 1;
                  const pct = Math.round((ctx.parsed / total) * 100);
                  return ` ${ctx.label}: ${ctx.parsed} (${pct}%)`;
                }
              }
            },
            datalabels: {
              color: '#fff',
              font: { weight: '900', size: 13 },
              formatter: (v, ctx) => {
                const pctVal = Math.round(v / (ctx.dataset.data.reduce((a,b)=>a+b,0)||1) * 100);
                return pctVal >= 5 ? pctVal + '%' : '';
              },
              textStrokeColor: 'rgba(0,0,0,.4)',
              textStrokeWidth: 3
            }
          }
        }
      });
    } else {
      // Si no hay subcats, destruir cualquier chart anterior
      panelDestroyChart_('subcats');
    }
  };

  // Render inicial con la categoría más grande
  renderSubcatsView(activeCat);

  // Chart de categorías (dona izquierda) con hover interactivo
  panelDestroyChart_('cats');
  const ctxCats = document.getElementById('panel-chart-cats');
  if (ctxCats && sortedCats.length) {
    const fullLabels = sortedCats.map(([k]) => k);
    const labels = sortedCats.map(([k]) => {
      const words = k.split(' ');
      return words.length > 3 ? words.slice(0,3).join(' ') + '…' : k;
    });
    const values = sortedCats.map(([,v]) => v);
    const colors = sortedCats.map(([k],i) => panelCatColor_(k, i));

    __panelCharts['cats'] = new Chart(ctxCats, {
      type: 'doughnut',
      plugins: [window.ChartDataLabels || {}],
      data: {
        labels,
        datasets: [{
          data: values,
          backgroundColor: colors,
          borderWidth: 3,
          borderColor: '#fff',
          hoverOffset: 10
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '60%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: { font: { weight: '700', size: 11 }, color: '#3d5248', boxWidth: 12, padding: 10 }
          },
          tooltip: {
            backgroundColor: 'rgba(255,255,255,.97)',
            titleColor: '#06402B', bodyColor: '#3d5248',
            borderColor: 'rgba(6,64,43,.15)', borderWidth: 1.5,
            padding: 10, cornerRadius: 10,
            callbacks: {
              label: (ctx) => {
                const total = ctx.dataset.data.reduce((a,b)=>a+b,0) || 1;
                const pct = Math.round((ctx.parsed / total) * 100);
                return ` ${ctx.label}: ${ctx.parsed} (${pct}%)`;
              }
            }
          },
          datalabels: {
            color: '#fff',
            font: { weight: '900', size: 13 },
            formatter: (v, ctx) => {
              const pctVal = Math.round(v / (ctx.dataset.data.reduce((a,b)=>a+b,0)||1) * 100);
              return pctVal >= 5 ? pctVal + '%' : '';
            },
            textStrokeColor: 'rgba(0,0,0,.4)',
            textStrokeWidth: 3
          }
        },
        onHover: (event, activeElements, chart) => {
          chart.canvas.style.cursor = activeElements.length ? 'pointer' : 'default';
          if (activeElements.length > 0) {
            const idx = activeElements[0].index;
            const catName = fullLabels[idx];
            if (catName !== activeCat) {
              activeCat = catName;
              renderSubcatsView(activeCat);
            }
          }
        }
      }
    });
  }
}

  /* ================== ATENCIONES REGISTRADAS ================== */
let __atencionesTabActual = 'chat';
let __atencionesChatCache = [];
let __atencionesPresCache = [];

async function abrirAtenciones_() {
  if (!currentUser || !canSeeAtendidasChat_()) {
    Swal.fire({ icon: 'warning', title: 'Sin permiso' });
    return;
  }
  __atencionesTabActual = 'chat';
  document.getElementById('atenc-filter').value = '';

  // La pestaña Presencial solo es visible para super usuario
  const tabPres = document.getElementById('tab-atenc-pres');
  if (tabPres) tabPres.style.display = currentUser?.isSuper ? '' : 'none';

  atencionesShowTabUI_('chat');
  showView('view-atenciones');
  await atencionesLoadAll_();
}

/* FASE 7 — antes eran DOS llamadas y cada una recorría la hoja entera de
   2.634 filas. Ahora es UNA sola, el servidor lee solo hasta la columna P
   y devuelve filas (arrays) en vez de objetos: los nombres de campo
   repetidos 2.630 veces pesaban más que los datos. Aquí se vuelven a
   armar, que es trabajo de milisegundos en el navegador. */
function atencHidratar_(campos, filas) {
  const out = new Array(filas.length);
  for (let i = 0; i < filas.length; i++) {
    const f = filas[i], obj = {};
    for (let c = 0; c < campos.length; c++) obj[campos[c]] = f[c];
    out[i] = obj;
  }
  return out;
}

async function atencionesLoadAll_() {
  const res = await apiGet('listAtenciones', { uid: uidActual_() });
  const campos = (res && res.campos) || [];
  __atencionesChatCache = atencHidratar_(campos, (res && res.chat) || []);
  __atencionesPresCache = atencHidratar_(campos, (res && res.pres) || []);
  aplicarFiltroAtenciones_();
}

/** Un solo sitio decide qué se ve: la pestaña activa pasada por el
    buscador. Antes cada recarga (y el motor EN VIVO recarga solo)
    dejaba el texto escrito pero mostraba la lista completa. */
function aplicarFiltroAtenciones_() {
  const source = __atencionesTabActual === 'chat'
    ? __atencionesChatCache
    : __atencionesPresCache;
  const q = normalizeText_(document.getElementById('atenc-filter')?.value || '');
  if (!q) { renderAtenciones_(source); return; }
  renderAtenciones_(source.filter(it => {
    const blob = normalizeText_([
      it.id_predial, it.nombre, it.documento, it.barrio,
      it.codigo, it.solicitud, it.fecha, it.respondida
    ].join(' '));
    return blob.includes(q);
  }));
}

function atencionesShowTab_(tab) {
  __atencionesTabActual = tab;
  atencionesShowTabUI_(tab);
  document.getElementById('atenc-filter').value = '';
  aplicarFiltroAtenciones_();
}

function atencionesShowTabUI_(tab) {
  const tabChat = document.getElementById('tab-atenc-chat');
  const tabPres = document.getElementById('tab-atenc-pres');
  if (tabChat) tabChat.classList.toggle('active', tab === 'chat');
  if (tabPres) tabPres.classList.toggle('active', tab === 'pres');
}

function renderAtenciones_(items) {
  const wrap = document.getElementById('atenc-wrap');
  if (!wrap) return;
  wrap.innerHTML = '';
  document.getElementById('atenc-count').textContent = String(items.length);

  if (!items.length) {
    wrap.innerHTML = '<p class="muted center" style="margin-top:20px;">No hay registros.</p>';
    return;
  }

  for (const it of items) {
    const card = document.createElement('div');
    card.className = 'sol-card';

    const head = document.createElement('div');
    head.className = 'sol-head';
    const titleEl = document.createElement('p');
    titleEl.className = 'sol-title';
    titleEl.innerHTML = `Usuario: <b>${escapeHtml_(it.nombre || '')}</b>`;
    head.appendChild(titleEl);

    const meta = document.createElement('div');
    meta.className = 'sol-meta';
    const respondedExtra = (it.respondida && String(it.respondida).trim())
      ? `<p><span style="color:#16a34a;font-weight:1000;">RESPONDIDA:</span> ${escapeHtml_(it.respondida)}</p>`
      : '';
    meta.innerHTML = `
      <p>Documento / NIT: ${escapeHtml_(it.documento || '')}</p>
      <p>Residencia: ${escapeHtml_(it.barrio || '')}</p>
      <p>Código Catastral: ${escapeHtml_(it.codigo || '')}</p>
      <p>Solicitud: ${escapeHtml_(it.solicitud || '')}</p>
      <p><span style="color:#dc2626;font-weight:1000;">Fecha:</span> ${escapeHtml_(it.fecha || '')}</p>
      ${respondedExtra}
    `;

    card.appendChild(head);
    card.appendChild(meta);
    wrap.appendChild(card);
  }
}

document.getElementById('btn-atenciones-registradas')?.addEventListener('click', async () => {
  playSoundOnce(SOUNDS.back);
  await abrirAtenciones_();
});

document.getElementById('atenc-filter')?.addEventListener('input', aplicarFiltroAtenciones_);

document.getElementById('atenc-back')?.addEventListener('click', () => {
  playSoundOnce(SOUNDS.back);
  showView('view-inicio');
});

  /* ============================================================
   ESTADÍSTICAS DASHBOARD v2 — Lógica completa
   ============================================================ */

const ESTAD_ICON = {
  calendario: 'img/calendario.webp',
  mapa:       'img/mapa.png',
  tendencia:  'img/tendencia.png',
  barras:     'img/barras.png'
};

let __estadTabActual      = 'tiempo';
let __estadChartsDash     = {};
let __estadZonasPages     = [];
let __estadZonasPagActual = 0;

/* ── Destruir chart por clave ────────────────────────────── */
function estadDestroyChart_(key) {
  try {
    if (__estadChartsDash[key]) {
      __estadChartsDash[key].destroy();
      delete __estadChartsDash[key];
    }
  } catch(_) {}
}

/* ── Cambiar tab ─────────────────────────────────────────── */
function estadShowTab_(tab) {
  __estadTabActual = tab;
  ['tiempo','zonas','tendencia'].forEach(t => {
    const view = document.getElementById('estad-view-' + t);
    const btn  = document.getElementById('estad-tab-btn-' + t);
    if (!view || !btn) return;
    const active = (t === tab);
    view.style.display = active ? '' : 'none';
    btn.classList.toggle('active', active);
    if (active) {
      view.classList.remove('estad-tab-content');
      void view.offsetWidth;
      view.classList.add('estad-tab-content');
    }
  });

  if (!__estadCache || !__estadCache.length) return;

  switch (tab) {
    case 'tiempo':    estadRenderTiempo_();    break;
    case 'zonas':     estadRenderZonas_();     break;
    case 'tendencia': estadRenderTendencia_(); break;
  }
}

/* ── Regresar ────────────────────────────────────────────── */
function estadGoBack_() {
  playSoundOnce(SOUNDS.back);
  Object.keys(__estadChartsDash).forEach(k => estadDestroyChart_(k));
  destroyEstadChart_();
  showView('view-inicio');
}

/* ── OVERRIDE openEstadisticas_ ─────────────────────────── */
openEstadisticas_ = async function() {
  if (!currentUser || !currentUser.isSuper) {
    Swal.fire({ icon: 'warning', title: 'Solo SUPER USUARIO' });
    return;
  }

  showView('view-estadisticas');
  estadShowTab_('tiempo');

  try {
    await loadEstadisticasData_();

    const sub = document.getElementById('estad-dash-subtitle');
    if (sub) {
      const ts = new Date();
      sub.textContent =
        `${__estadCache.length} atendidas · Actualizado ` +
        `${String(ts.getHours()).padStart(2,'0')}:${String(ts.getMinutes()).padStart(2,'0')}`;
    }

    estadRenderTiempo_();
  } catch(e) {
    Swal.fire({ icon: 'error', title: 'Error', text: String(e.message || e) });
  }
};

/* ══════════════════════════════════════════════════════════
   TAB: TIEMPO 2026
══════════════════════════════════════════════════════════ */
function estadRenderTiempo_() {
  const rows = __estadCache;
  const data = buildDataTiempo2026_(rows);

  const totalChat = data.totals.chat;
  const totalPres = data.totals.pres;
  const totalAll  = totalChat + totalPres;

  /* Mes más activo */
  let bestLabel = '—';
  let bestVal   = 0;
  if (data.labels.length) {
    data.labels.forEach((lbl, i) => {
      const combined = data.datasets.reduce((s, ds) => s + (ds.data[i] || 0), 0);
      if (combined > bestVal) { bestVal = combined; bestLabel = lbl; }
    });
  }
  const promMensual = data.labels.length
    ? Math.round(totalAll / data.labels.length)
    : 0;

  /* ── KPIs ── */
  const kpiWrap = document.getElementById('estad-kpis-tiempo');
  if (kpiWrap) {
    kpiWrap.innerHTML = '';
    [
      { icon: ESTAD_ICON.barras,     value: totalAll,    label: 'Total ' + ESTAD_ANIO_,  sub: 'solicitudes atendidas', cls: '' },
      { icon: ESTAD_ICON.calendario, value: totalChat,   label: 'CHAT',        sub: 'atendidas por chat',    cls: 'kpi-naranja' },
      { icon: ESTAD_ICON.calendario, value: totalPres,   label: 'PRESENCIAL',  sub: 'atendidas presencial',  cls: 'kpi-verde' },
      { icon: ESTAD_ICON.tendencia,  value: promMensual, label: 'Prom./Mes',   sub: 'atenciones promedio',   cls: '' },
      { icon: ESTAD_ICON.barras,     value: bestLabel,   label: 'Mejor Mes',   sub: `${bestVal} atendidas`,  cls: 'kpi-blue' }
    ].forEach(k => {
      const vs     = String(k.value);
      const isLong = vs.length > 5;
      const el = document.createElement('div');
      el.className = 'kpi-card ' + k.cls;
      el.innerHTML = `
        <img class="kpi-icon" src="${k.icon}" alt="${k.label}" />
        <div class="kpi-value" style="${isLong ? 'font-size:1rem;line-height:1.2;text-align:center;' : ''}">${escapeHtml_(vs)}</div>
        <div class="kpi-label">${k.label}</div>
        <div class="kpi-sub">${k.sub}</div>
      `;
      kpiWrap.appendChild(el);
    });
  }

  /* ── Pills totales ── */
  const pillWrap = document.getElementById('estad-totals-tiempo');
  if (pillWrap) {
    pillWrap.innerHTML = `
      <div class="estad-tend-pill">
        <span class="estad-tend-pill-icon">${ICO_('chat',18)}</span>
        <span class="estad-tend-pill-value">${totalChat}</span>
        <span class="estad-tend-pill-label">CHAT</span>
      </div>
      <div class="estad-tend-pill">
        <span class="estad-tend-pill-icon">${ICO_('atencion',18)}</span>
        <span class="estad-tend-pill-value">${totalPres}</span>
        <span class="estad-tend-pill-label">PRESENCIAL</span>
      </div>
      <div class="estad-tend-pill">
        <span class="estad-tend-pill-icon">${ICO_('grafica',18)}</span>
        <span class="estad-tend-pill-value">${totalAll}</span>
        <span class="estad-tend-pill-label">TOTAL</span>
      </div>
    `;
  }

  /* ── Gráfico barras ── */
  estadDestroyChart_('tiempo');
  const canvas = document.getElementById('estad-canvas-tiempo');
  if (!canvas) return;

  const dl = window.ChartDataLabels;

  __estadChartsDash['tiempo'] = new Chart(canvas.getContext('2d'), {
    type: 'bar',
    data: { labels: data.labels, datasets: data.datasets },
    plugins: dl ? [dl] : [],
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            boxWidth: 14, boxHeight: 14,
            color: '#3d5248', font: { weight: '700', size: 13 }
          }
        },
        tooltip: {
          backgroundColor: 'rgba(255,255,255,.97)',
          titleColor: '#06402B', bodyColor: '#3d5248',
          borderColor: 'rgba(6,64,43,.15)', borderWidth: 1.5,
          titleFont: { weight: '800', size: 13 },
          bodyFont: { weight: '600', size: 12 },
          padding: 12, cornerRadius: 12
        },
        datalabels: dl ? {
          color: '#fff',
          anchor: 'center', align: 'center', clamp: true,
          font: { weight: '900', size: 15, family: "'IBM Plex Sans',sans-serif" },
          formatter: v => (v && v > 0) ? String(v) : '',
          textStrokeColor: 'rgba(0,0,0,.28)', textStrokeWidth: 3
        } : { display: false }
      },
      scales: {
        x: {
          stacked: true,
          ticks: { color: '#06402B', font: { weight: '700', size: 13 }, maxRotation: 0 },
          grid: { display: false }
        },
        y: {
          stacked: true, beginAtZero: true,
          ticks: { precision: 0, color: '#3d5248', font: { weight: '700' } },
          grid: { color: 'rgba(6,64,43,.08)' }
        }
      }
    }
  });
}

/* ══════════════════════════════════════════════════════════
   TAB: ZONAS
══════════════════════════════════════════════════════════ */
function estadRenderZonas_() {
  const rows  = __estadCache;
  const built = buildDataZonasChunks_(rows);
  __estadZonasPages     = built.pages;
  __estadZonasPagActual = 0;

  /* Mapa de zonas para KPIs y top */
  const byZona = {};
  rows.forEach(r => {
    const est  = normalizeText_(r.estado || '');
    const zona = normalizeZona_(r.barrio); 
    if (!zona) return;
    if (!byZona[zona]) byZona[zona] = { chat: 0, pres: 0 };
    if (est === 'ATENDIDA CHAT')       byZona[zona].chat++;
    if (est === 'ATENDIDA PRESENCIAL') byZona[zona].pres++;
  });

  const zonasSorted = Object.entries(byZona)
    .map(([z, v]) => ({ zona: z, chat: v.chat, pres: v.pres, total: v.chat + v.pres }))
    .sort((a, b) => b.total - a.total);

  const topZona  = zonasSorted[0]?.zona  || '—';
  const topVal   = zonasSorted[0]?.total || 0;
  const numZonas = zonasSorted.length;
  const totC     = built.totals.chat;
  const totP     = built.totals.pres;

  /* ── KPIs ── */
  const kpiWrap = document.getElementById('estad-kpis-zonas');
  if (kpiWrap) {
    kpiWrap.innerHTML = '';
    [
      { icon: ESTAD_ICON.mapa,       value: numZonas,    label: 'Zonas',       sub: 'con actividad registrada', cls: '' },
      { icon: ESTAD_ICON.mapa,       value: topZona,     label: 'Zona Top',    sub: `${topVal} atendidas`,      cls: 'kpi-blue' },
      { icon: ESTAD_ICON.calendario, value: totC,        label: 'CHAT',        sub: 'en todas las zonas',       cls: 'kpi-naranja' },
      { icon: ESTAD_ICON.calendario, value: totP,        label: 'PRESENCIAL',  sub: 'en todas las zonas',       cls: 'kpi-verde' },
      { icon: ESTAD_ICON.barras,     value: totC + totP, label: 'Total Registros', sub: 'atenciones acumuladas', cls: '' }
    ].forEach(k => {
      const vs     = String(k.value);
      const isLong = vs.length > 8;
      const el = document.createElement('div');
      el.className = 'kpi-card ' + k.cls;
      el.innerHTML = `
        <img class="kpi-icon" src="${k.icon}" alt="${k.label}" />
        <div class="kpi-value" style="${isLong ? 'font-size:.72rem;line-height:1.25;text-align:center;word-break:break-word;' : ''}">${escapeHtml_(vs)}</div>
        <div class="kpi-label">${k.label}</div>
        <div class="kpi-sub">${k.sub}</div>
      `;
      kpiWrap.appendChild(el);
    });
  }

  /* ── Top zonas lista ── */
  const topWrap = document.getElementById('estad-top-zonas');
  if (topWrap) {
    topWrap.innerHTML = '';
    const maxVal = zonasSorted[0]?.total || 1;
    const medals = ['🥇','🥈','🥉'];
    zonasSorted.slice(0, 8).forEach((item, idx) => {
      const pct    = Math.round((item.total / maxVal) * 100);
      const posCls = idx === 0 ? 'gold' : idx === 1 ? 'silver' : idx === 2 ? 'bronze' : '';
      const posStr = idx < 3 ? medals[idx] : (idx + 1);
      const el = document.createElement('div');
      el.className = 'estad-top-item';
      el.innerHTML = `
        <div class="estad-top-pos ${posCls}">${posStr}</div>
        <div class="estad-top-info">
          <div class="estad-top-name" title="${escapeHtml_(item.zona)}">${escapeHtml_(item.zona)}</div>
          <div class="estad-top-bar-track">
            <div class="estad-top-bar-fill" style="width:${pct}%;"></div>
          </div>
        </div>
        <div class="estad-top-count">${item.total}</div>
      `;
      topWrap.appendChild(el);
    });
  }

  /* Primer gráfico y paginador */
  estadRenderZonasPagina_(0);
}

function estadRenderZonasPagina_(pageIdx) {
  __estadZonasPagActual = pageIdx;
  const pages = __estadZonasPages;
  if (!pages || !pages.length) return;

  const page = pages[pageIdx];
  if (!page) return;

  /* Etiqueta de página */
  const lblEl = document.getElementById('estad-zonas-page-label');
  if (lblEl) {
    lblEl.textContent = pages.length > 1
      ? `Página ${pageIdx + 1} / ${pages.length}`
      : '';
  }

  /* Destruir chart anterior */
  estadDestroyChart_('zonas');

  const canvas = document.getElementById('estad-canvas-zonas');
  if (!canvas) return;

  const isSmall = window.matchMedia('(max-width:700px)').matches;
  const dl      = window.ChartDataLabels;

  /* Totales por serie para leyenda */
  const totalChatSerie = (page.datasets || [])
    .find(d => String(d.label||'').toUpperCase() === 'CHAT')
    ?.data?.reduce((a, b) => a + (Number(b)||0), 0) || 0;
  const totalPresSerie = (page.datasets || [])
    .find(d => String(d.label||'').toUpperCase() === 'PRESENCIAL')
    ?.data?.reduce((a, b) => a + (Number(b)||0), 0) || 0;

  const datasets = (page.datasets || []).map(ds => {
    const lkey = String(ds.label||'').toUpperCase();
    const t    = lkey === 'CHAT' ? totalChatSerie : totalPresSerie;
    return { ...ds, label: `${ds.label}  (Total: ${t})` };
  });

  __estadChartsDash['zonas'] = new Chart(canvas.getContext('2d'), {
    type: 'bar',
    data: { labels: page.labels, datasets },
    plugins: dl ? [dl] : [],
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            boxWidth: 12, boxHeight: 12,
            color: '#3d5248', font: { weight: '700', size: 12 }
          }
        },
        tooltip: {
          backgroundColor: 'rgba(255,255,255,.97)',
          titleColor: '#06402B', bodyColor: '#3d5248',
          borderColor: 'rgba(6,64,43,.15)', borderWidth: 1.5,
          padding: 12, cornerRadius: 12,
          titleFont: { weight: '800' }, bodyFont: { weight: '600' }
        },
                 datalabels: dl ? {
            color: '#fff',
            anchor: 'center', align: 'center', clamp: true,
            font: {
              weight: '900',
              size: isSmall ? 12 : 15,
              family: "'IBM Plex Sans',sans-serif"
            },
            formatter: v => (v && v > 0) ? String(v) : '',
            textStrokeColor: 'rgba(0,0,0,.55)', textStrokeWidth: 4
          } : { display: false }
      },
      scales: {
        x: {
          stacked: true,
          ticks: {
            color: '#06402B',
            font: { weight: '700', size: isSmall ? 9 : 11 },
            autoSkip: false,
            minRotation: 90, maxRotation: 90
          },
          grid: { display: false }
        },
        y: {
          stacked: true, beginAtZero: true,
          ticks: { precision: 0, color: '#3d5248', font: { weight: '700' } },
          grid: { color: 'rgba(6,64,43,.08)' }
        }
      }
    }
  });

  /* ── Paginador ── */
  const pagerWrap = document.getElementById('estad-pager-zonas');
  if (!pagerWrap) return;
  pagerWrap.innerHTML = '';

  if (pages.length <= 1) return;

  /* Botón anterior */
  const btnPrev = document.createElement('button');
  btnPrev.className = 'estad-pager-btn';
  btnPrev.innerHTML = ICO_('atras', 16) + ' Anterior';
  btnPrev.disabled = (pageIdx === 0);
  btnPrev.addEventListener('click', () => {
    if (__estadZonasPagActual > 0) estadRenderZonasPagina_(__estadZonasPagActual - 1);
  });
  pagerWrap.appendChild(btnPrev);

  /* Botones numéricos */
  pages.forEach((_, i) => {
    const btn = document.createElement('button');
    btn.className = 'estad-pager-btn' + (i === pageIdx ? ' active' : '');
    btn.textContent = String(i + 1);
    btn.addEventListener('click', () => estadRenderZonasPagina_(i));
    pagerWrap.appendChild(btn);
  });

  /* Botón siguiente */
  const btnNext = document.createElement('button');
  btnNext.className = 'estad-pager-btn';
  btnNext.innerHTML = 'Siguiente ' + ICO_('adelante', 16);
  btnNext.disabled = (pageIdx === pages.length - 1);
  btnNext.addEventListener('click', () => {
    if (__estadZonasPagActual < __estadZonasPages.length - 1)
      estadRenderZonasPagina_(__estadZonasPagActual + 1);
  });
  pagerWrap.appendChild(btnNext);
}

/* ══════════════════════════════════════════════════════════
   TAB: TENDENCIA
══════════════════════════════════════════════════════════ */
function estadRenderTendencia_() {
  const rows = __estadCache;

  /* Construir datos mensuales completos */
  const byMonth = {};
  rows.forEach(r => {
    const est   = normalizeText_(r.estado || '');
    const fecha = parseFechaObj_(r.fecha || '');
if (!fecha || fecha.yyyy !== ESTAD_ANIO_) return;
const key = String(fecha.mm).padStart(2, '0');
    if (!byMonth[key]) byMonth[key] = { chat: 0, pres: 0 };
    if (est === 'ATENDIDA CHAT')       byMonth[key].chat++;
    if (est === 'ATENDIDA PRESENCIAL') byMonth[key].pres++;
  });

  const monthsSorted = Object.keys(byMonth).sort();
  const labels  = monthsSorted.map(k => MONTHS_ES[parseInt(k, 10) - 1]);
  const chatArr = monthsSorted.map(k => byMonth[k].chat);
  const presArr = monthsSorted.map(k => byMonth[k].pres);
  const totArr  = monthsSorted.map((k, i) => chatArr[i] + presArr[i]);

  const totalAll  = totArr.reduce((a, b) => a + b, 0);
  const totalChat = chatArr.reduce((a, b) => a + b, 0);
  const totalPres = presArr.reduce((a, b) => a + b, 0);
  const maxMes    = Math.max(...totArr, 0);
  const minMes    = totArr.length ? Math.min(...totArr.filter(v => v > 0)) : 0;
  const promMes   = totArr.length ? Math.round(totalAll / totArr.length) : 0;

  /* Variación último mes vs anterior */
  let varPct = null;
  if (totArr.length >= 2) {
    const last = totArr[totArr.length - 1];
    const prev = totArr[totArr.length - 2];
    varPct = prev > 0 ? Math.round(((last - prev) / prev) * 100) : null;
  }

  /* ── KPIs ── */
  const kpiWrap = document.getElementById('estad-kpis-tendencia');
  if (kpiWrap) {
    kpiWrap.innerHTML = '';
    [
      { icon: ESTAD_ICON.barras,    value: totalAll,  label: 'Total ' + ESTAD_ANIO_,   sub: 'solicitudes acumuladas', cls: '' },
      { icon: ESTAD_ICON.tendencia, value: maxMes,    label: 'Pico Mensual', sub: 'máximo en un mes',       cls: 'kpi-blue' },
      { icon: ESTAD_ICON.tendencia, value: minMes,    label: 'Mínimo Mes',   sub: 'mínimo registrado',      cls: '' },
      { icon: ESTAD_ICON.barras,    value: promMes,   label: 'Promedio',     sub: 'atenciones por mes',     cls: '' },
      {
        icon:  ESTAD_ICON.tendencia,
        value: varPct !== null ? (varPct >= 0 ? '+' + varPct + '%' : varPct + '%') : '—',
        label: 'Var. Último Mes',
        sub:   'vs mes anterior',
        cls:   varPct === null ? '' : varPct >= 0 ? 'kpi-verde' : 'kpi-rojo'
      }
    ].forEach(k => {
      const vs     = String(k.value);
      const isLong = vs.length > 5;
      const el = document.createElement('div');
      el.className = 'kpi-card ' + k.cls;
      el.innerHTML = `
        <img class="kpi-icon" src="${k.icon}" alt="${k.label}" />
        <div class="kpi-value" style="${isLong ? 'font-size:1rem;line-height:1.2;text-align:center;' : ''}">${escapeHtml_(vs)}</div>
        <div class="kpi-label">${k.label}</div>
        <div class="kpi-sub">${k.sub}</div>
      `;
      kpiWrap.appendChild(el);
    });
  }

  /* ── Gráfico de línea ── */
  estadDestroyChart_('tendencia');
  const canvas = document.getElementById('estad-canvas-tendencia');
  if (canvas && labels.length) {
    const dl = window.ChartDataLabels;

    __estadChartsDash['tendencia'] = new Chart(canvas.getContext('2d'), {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'TOTAL',
            data: totArr,
            borderColor: '#06402B',
            backgroundColor: 'rgba(6,64,43,.10)',
            borderWidth: 3,
            pointBackgroundColor: '#06402B',
            pointRadius: 6,
            pointHoverRadius: 9,
            fill: true,
            tension: 0.38
          },
          {
            label: 'CHAT',
            data: chatArr,
            borderColor: '#f97316',
            backgroundColor: 'rgba(249,115,22,.08)',
            borderWidth: 2.5,
            pointBackgroundColor: '#f97316',
            pointRadius: 5,
            pointHoverRadius: 8,
            fill: false,
            tension: 0.38
          },
          {
            label: 'PRESENCIAL',
            data: presArr,
            borderColor: '#16a34a',
            backgroundColor: 'rgba(22,163,74,.08)',
            borderWidth: 2.5,
            pointBackgroundColor: '#16a34a',
            pointRadius: 5,
            pointHoverRadius: 8,
            fill: false,
            tension: 0.38
          }
        ]
      },
      plugins: dl ? [dl] : [],
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              boxWidth: 14, boxHeight: 14,
              color: '#3d5248', font: { weight: '700', size: 13 }
            }
          },
          tooltip: {
            backgroundColor: 'rgba(255,255,255,.97)',
            titleColor: '#06402B', bodyColor: '#3d5248',
            borderColor: 'rgba(6,64,43,.15)', borderWidth: 1.5,
            titleFont: { weight: '800', size: 13 },
            bodyFont: { weight: '600', size: 12 },
            padding: 12, cornerRadius: 12
          },
          datalabels: dl ? {
            color: (ctx) => {
              const colors = ['#06402B','#f97316','#16a34a'];
              return colors[ctx.datasetIndex] || '#333';
            },
            anchor: 'top', align: 'top', offset: 4,
            font: { weight: '900', size: 13, family: "'IBM Plex Sans',sans-serif" },
            formatter: v => (v && v > 0) ? String(v) : '',
            textStrokeColor: 'rgba(255,255,255,.8)', textStrokeWidth: 4
          } : { display: false }
        },
        scales: {
          x: {
            ticks: { color: '#06402B', font: { weight: '700', size: 12 }, maxRotation: 0 },
            grid: { color: 'rgba(6,64,43,.06)' }
          },
          y: {
            beginAtZero: true,
            ticks: { precision: 0, color: '#3d5248', font: { weight: '700' } },
            grid: { color: 'rgba(6,64,43,.08)' }
          }
        }
      }
    });
  }

  /* ── Tabla comparación mensual ── */
  const tbody = document.getElementById('estad-month-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (!monthsSorted.length) {
    tbody.innerHTML = `
      <tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:16px;">
        Sin datos para ${ESTAD_ANIO_}.
      </td></tr>`;
    return;
  }

  let acumTotal = 0;
  let prevTotal = null;

  monthsSorted.forEach((key, i) => {
    const mes   = labels[i];
    const chat  = chatArr[i];
    const pres  = presArr[i];
    const tot   = totArr[i];
    acumTotal  += tot;

    /* Variación vs mes anterior */
    let varStr  = '—';
    let varCls  = '';
    if (prevTotal !== null && prevTotal > 0) {
      const diff = Math.round(((tot - prevTotal) / prevTotal) * 100);
      varStr = (diff >= 0 ? '+' : '') + diff + '%';
      varCls = diff > 0  ? 'style="color:#16a34a;font-weight:900;"'
             : diff < 0  ? 'style="color:#dc2626;font-weight:900;"'
             : 'style="color:#6b7280;"';
    } else if (prevTotal !== null) {
      varStr = tot > 0 ? '🆕' : '—';
    }
    prevTotal = tot;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="td-mes">${escapeHtml_(mes)}</td>
      <td class="td-chat">${chat}</td>
      <td class="td-pres">${pres}</td>
      <td class="td-total">${tot}</td>
      <td ${varCls}>${varStr}</td>
    `;
    tbody.appendChild(tr);
  });

  /* Fila totales */
  const trFoot = document.createElement('tr');
  trFoot.innerHTML = `
    <td class="td-foot">TOTAL</td>
    <td class="td-foot td-chat">${totalChat}</td>
    <td class="td-foot td-pres">${totalPres}</td>
    <td class="td-foot td-total">${totalAll}</td>
    <td class="td-foot">—</td>
  `;
  tbody.appendChild(trFoot);
}

/* ── Desconectar botones legacy (Tiempo / Zonas) ─────────── */
/* Los botones btn-estad-tiempo y btn-estad-zonas ya no existen en el
   nuevo HTML, pero si el navegador los tiene en caché los neutralizamos. */
(function patchLegacyEstadButtons_() {
  const bTiempo = document.getElementById('btn-estad-tiempo');
  const bZonas  = document.getElementById('btn-estad-zonas');
  const bBack   = document.getElementById('btn-estad-back');

  if (bTiempo) {
    bTiempo.replaceWith(bTiempo.cloneNode(true));
  }
  if (bZonas) {
    bZonas.replaceWith(bZonas.cloneNode(true));
  }
  if (bBack) {
    bBack.addEventListener('click', () => {
      playSoundOnce(SOUNDS.back);
      estadGoBack_();
    });
  }
})();

  /* ============================================================
   ESTADÍSTICAS — Variables y helpers faltantes
   ============================================================ */

/* 1. Caché de datos */
let __estadCache = [];

/* 2. Nombres de meses */
const MONTHS_ES = [
  'Ene','Feb','Mar','Abr','May','Jun',
  'Jul','Ago','Sep','Oct','Nov','Dic'
];

/* 3. destroyEstadChart_ (alias que faltaba) */
function destroyEstadChart_() {
  Object.keys(__estadChartsDash).forEach(k => estadDestroyChart_(k));
}

/* 4. Cargar datos del backend */
async function loadEstadisticasData_() {
  /* FASE 2 — UN solo viaje: 'listAtenciones' ya trae chat y presencial
     juntos (antes eran dos llamadas que recorrían la hoja entera cada una). */
  const res = await apiGet('listAtenciones', { uid: uidActual_() });
  const campos = (res && res.campos) || [];
  const chat = atencHidratar_(campos, (res && res.chat) || []);
  const pres = atencHidratar_(campos, (res && res.pres) || []);
  __estadCache = [
    ...(Array.isArray(chat) ? chat.map(r => ({ ...r, estado: 'ATENDIDA CHAT' }))        : []),
    ...(Array.isArray(pres) ? pres.map(r => ({ ...r, estado: 'ATENDIDA PRESENCIAL' })) : [])
  ];
}

/* 5. Helper parser que devuelve {yyyy, mm, dd} — usado en tendencia */
function parseFechaObj_(str) {
  const s = String(str || '').trim();
  if (!s) return null;

  // dd/mm/yyyy  o  d/m/yyyy  (acepta hora al final: "16/04/2026 10:30:00")
  let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return { dd: parseInt(m[1],10), mm: parseInt(m[2],10), yyyy: parseInt(m[3],10) };

  // ISO: yyyy-mm-dd
  m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return { dd: parseInt(m[3],10), mm: parseInt(m[2],10), yyyy: parseInt(m[1],10) };

  // dd-mm-yyyy
  m = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})/);
  if (m) return { dd: parseInt(m[1],10), mm: parseInt(m[2],10), yyyy: parseInt(m[3],10) };

  return null;
}

/* 6. buildDataTiempo2026_ */
/* FASE 2 — el año de las estadísticas es el año en curso (antes, 2026 fijo). */
const ESTAD_ANIO_ = new Date().getFullYear();
function buildDataTiempo2026_(rows) {
  const byMonth = {};
  let totalChat = 0, totalPres = 0;

  rows.forEach(r => {
    const est = normalizeText_(r.estado || '');
    const f   = parseFechaObj_(r.fecha || '');
    if (!f || f.yyyy !== ESTAD_ANIO_) return;
    const key = String(f.mm).padStart(2,'0');
    if (!byMonth[key]) byMonth[key] = { chat:0, pres:0 };
    if (est === 'ATENDIDA CHAT')       { byMonth[key].chat++; totalChat++; }
    if (est === 'ATENDIDA PRESENCIAL') { byMonth[key].pres++; totalPres++; }
  });

  const sorted = Object.keys(byMonth).sort();
  return {
    labels:   sorted.map(k => MONTHS_ES[parseInt(k,10) - 1]),
    datasets: [
      { label:'CHAT',       data: sorted.map(k => byMonth[k].chat),
        backgroundColor:'#f97316', borderRadius:8, stack:'stack' },
      { label:'PRESENCIAL', data: sorted.map(k => byMonth[k].pres),
        backgroundColor:'#16a34a', borderRadius:8, stack:'stack' }
    ],
    totals: { chat: totalChat, pres: totalPres }
  };
}

/* 7. buildDataZonasChunks_ */
function buildDataZonasChunks_(rows) {
  const byZona = {};
  let totalChat = 0, totalPres = 0;

  rows.forEach(r => {
    const est  = normalizeText_(r.estado || '');
    const zona = normalizeZona_(r.barrio);
    if (!zona) return;
    if (!byZona[zona]) byZona[zona] = { chat:0, pres:0 };
    if (est === 'ATENDIDA CHAT')       { byZona[zona].chat++; totalChat++; }
    if (est === 'ATENDIDA PRESENCIAL') { byZona[zona].pres++; totalPres++; }
  });

  const sorted = Object.entries(byZona)
    .sort((a,b) => (b[1].chat + b[1].pres) - (a[1].chat + a[1].pres));

  const PAGE_SIZE = 15;
  const pages = [];
  for (let i = 0; i < sorted.length; i += PAGE_SIZE) {
    const chunk = sorted.slice(i, i + PAGE_SIZE);
    pages.push({
      labels: chunk.map(([z]) => z),
      datasets: [
        { label:'CHAT',       data: chunk.map(([,v]) => v.chat),
          backgroundColor:'#f97316', borderRadius:6, stack:'stack' },
        { label:'PRESENCIAL', data: chunk.map(([,v]) => v.pres),
          backgroundColor:'#16a34a', borderRadius:6, stack:'stack' }
      ]
    });
  }

  return {
    pages:  pages.length ? pages : [{ labels:[], datasets:[] }],
    totals: { chat: totalChat, pres: totalPres }
  };
}

/* ============================================================
   BASE DE DATOS IMPUESTO PREDIAL — Frontend
   Fase 2 — Lista + filtros + permisos
   ============================================================ */

/* ── Permisos ───────────────────────────────────────────
   FASE 5 — SUSTANCIADORES_PREDIAL, ASISTENTES_PREDIAL y
   EDITORES_PREDIAL_TOTAL eliminadas. Manda el rol de la hoja y,
   fila por fila, la columna SUSTANCIADOR / ASISTENTE. */

function canSeeBDPredial_()     { return alcVer_('bdPredial'); }
function canEditarTodoPredial_(){ return alcPuede_('editarTodoPredial'); }
function canAgregarPredial_()   { return alcPuede_('agregarPredial'); }
function canEditarPredial_()    { return canEditarTodoPredial_(); }
function canEliminarPredial_()  { return alcPuede_('eliminarPredial'); }
function canDecisionPredial_()  { return alcPuede_('decisionPredial'); }
function canVerPanelPredial_()  { return alcPuede_('verPanelPredial'); }

/** ¿Tiene sentido ofrecerle "SOLO LAS MÍAS"? Solo si ve más que las suyas. */
function bdpVerPastillaMias_() {
  return alcListo_() && !!window.ALC.alcance && window.ALC.alcance.predial === 'TODO';
}

/** ¿Trabaja expedientes prediales (como sustanciador o asistente)? */
function esSustanciadorPredial_() {
  return alcListo_() && window.ALC.alcance &&
         window.ALC.alcance.predial === 'MIAS';
}

/* ── ¿El usuario es sustanciador o asistente DE ESTE expediente? ── */
function esSustanciadorOAsistenteDePredial_(row) {
  if (!currentUser || !row) return false;
  const n = normalizeText_(currentUser.nombre || '');
  return normalizeText_(row.sustanciador || '') === n ||
         normalizeText_(row.asistente   || '') === n;
}

/* ── ¿Puede editar ESTE expediente?
      super/editor total → todos · sustanciador/asistente → solo los suyos ── */
function canEditarEstePredial_(row) {
  if (!currentUser) return false;
  if (canEditarTodoPredial_()) return true;
  return esSustanciadorOAsistenteDePredial_(row);
}

/* ── Estado global ────────────────────────────────────── */
let __bdpListCache       = [];
let __bdpFilterClasif    = 'ALL';
let __bdpFilterActuacion = 'ALL';
let __bdpFilterSustanciador = 'ALL'; 
let __bdpFilterEstado    = 'ALL';
let __bdpFilterMias      = false;
let __bdpFilterSolexp    = 'ALL';   /* 17/09 — SOLICITUD EXPEDIENTE */
let __bdpSelected        = null;

/* ── Formatear valor en pesos ─────────────────────────── */
function bdpFormatPesos_(valor) {
  const n = Number(valor) || 0;
  return '$ ' + n.toLocaleString('es-CO');
}

/* ── Formatear DEBE DESDE (YYYYMM) → "Enero - 2026" ──── */
function bdpFormatDebeDesde_(yyyymm) {
  const s = String(yyyymm || '').trim();
  if (!/^\d{6}$/.test(s)) return s;
  const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                 'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const y = s.substring(0, 4);
  const m = parseInt(s.substring(4, 6), 10);
  if (m < 1 || m > 12) return s;
  return meses[m - 1] + ' - ' + y;
}

/* ── Quitar apóstrofe inicial (ficha catastral) ───────── */
function bdpCleanFicha_(s) {
  let v = String(s || '').trim();
  if (v.startsWith("'")) v = v.substring(1);
  return v;
}

/* ── Abrir la vista ───────────────────────────────────── */
async function abrirBDPredial_() {
  if (!currentUser || !canSeeBDPredial_()) {
    Swal.fire({ icon: 'warning', title: 'Sin permiso' });
    return;
  }

  /* Reset filtros */
  __bdpFilterClasif    = 'ALL';
  __bdpFilterActuacion = 'ALL';
 __bdpFilterSustanciador = 'ALL';
  __bdpFilterEstado    = 'ALL';
  __bdpFilterSolexp    = 'ALL';
  __bdpFilterMias      = false;
  __bdpSelected        = null;

  /* Reset visual pastillas */
  document.querySelectorAll('#bdp-pills-clasif    .proc-status-pill').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('#bdp-pills-actuacion .proc-status-pill').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('#bdp-pills-estado    .proc-status-pill').forEach(b => b.classList.remove('active'));
  document.querySelector('#bdp-pills-clasif    [data-clasif="ALL"]')?.classList.add('active');
  document.querySelector('#bdp-pills-actuacion [data-actuacion="ALL"]')?.classList.add('active');
  document.querySelectorAll('#bdp-pills-sustanciador .proc-status-pill').forEach(b => b.classList.remove('active'));
  document.querySelector('#bdp-pills-sustanciador [data-sustanciador="ALL"]')?.classList.add('active');
  document.querySelector('#bdp-pills-estado    [data-estado="ALL"]')?.classList.add('active');
  document.querySelectorAll('#bdp-pills-solexp .proc-status-pill').forEach(b => b.classList.remove('active'));
  document.querySelector('#bdp-pills-solexp [data-solexp="ALL"]')?.classList.add('active');
  document.getElementById('bdp-pill-mias')?.classList.remove('active');

  /* Reset filtro de texto */
  const filterInput = document.getElementById('bdp-filter');
  if (filterInput) filterInput.value = '';

  /* Permisos: mostrar/ocultar botones */
  const btnPanel   = document.getElementById('btn-bdp-panel');
  const btnAgregar = document.getElementById('btn-bdp-agregar');
  if (btnPanel)   btnPanel.style.display   = canVerPanelPredial_()  ? '' : 'none';
  if (btnAgregar) btnAgregar.style.display = canAgregarPredial_()   ? '' : 'none';

 /* Pastilla "Solo las mías" para sustanciadores */
  const miasWrap = document.getElementById('bdp-pills-mias-wrap');
  /* FASE 7 — desde el alcance por filas, quien no es ADMIN ya recibe SOLO
     sus expedientes: la pastilla no filtraba nada y confundía. Se deja
     para quien ve todo (un ADMIN que además sustancia). */
  if (miasWrap)   miasWrap.style.display = bdpVerPastillaMias_() ? '' : 'none';

  /* Pastillas SUSTANCIADOR: SOLO el SUPER USUARIO ve el filtro completo */
  const verSustPills = !!(currentUser && currentUser.isSuper);
  const sustLabel = document.getElementById('bdp-label-sustanciador');
  const sustPills = document.getElementById('bdp-pills-sustanciador');
  if (sustLabel) sustLabel.style.display = verSustPills ? '' : 'none';
  if (sustPills) sustPills.style.display = verSustPills ? '' : 'none';
  if (!verSustPills) __bdpFilterSustanciador = 'ALL';

 showView('view-bd-predial');

  /* FASE 7 — selectores compactos: se montan una vez y se ponen al día
     con las pastillas ya reiniciadas de arriba. */
  bdpMontarFiltros_();
  bdpSincronizarFiltros_();

  /* Mostrar mensaje de carga inmediato para que el usuario sepa que está procesando */
  const wrap = document.getElementById('bdp-list');
  if (wrap) {
    wrap.innerHTML = '<p class="muted center" style="grid-column:1/-1; margin-top:40px; font-size:.95rem;">Cargando expedientes…</p>';
  }
  const countEl = document.getElementById('bdp-count');
  if (countEl) countEl.textContent = '...';
  
  await loadBDPredial_();
}

/* ── Cargar desde backend (con cache de búsqueda) ─────── */
async function loadBDPredial_() {
  try {
    const data = await apiGet('listpredial', { uid: uidActual_() });
    const rows = Array.isArray(data) ? data : [];

    /* Pre-calcular el blob de búsqueda UNA sola vez por fila.
       Esto evita recalcular normalizeText_(join(' ')) en cada keystroke. */
    rows.forEach(r => { r.__searchBlob = bdpBlob_(r); });

    __bdpListCache = rows;
    applyBDPredialFilters_();
  } catch (e) {
    Swal.fire({ icon: 'error', title: 'Error', text: String(e.message || e) });
  }
}

/* FASE 2 SEC-HACIENDA-FLANDES — UN SOLO VIAJE en BD Predial.
   Antes, cada guardado (editar, actuación, archivo, asignar, eliminar)
   volvía a bajar el listado COMPLETO (9.500 expedientes, ~2 MB, 6-7 s).
   Ahora la escritura devuelve la fila tal como quedó y aquí se reemplaza
   en la memoria: la lista se repinta al instante y con los filtros que el
   usuario tenía puestos. Si por algo no vino la fila, se recarga como antes. */
function bdpBlob_(r) {
  return normalizeText_([
    r.id_predial, r.matricula, r.ficha_catastral, r.nombres,
    r.direccion_predio, r.correo_electronico, r.nit_cedula,
    r.debe_desde, r.deuda_hasta, r.valor_deuda, r.clasificacion,
    r.no_exp_fisico, r.actuacion, r.sustanciador, r.asistente,
    r.bitacora, r.estado_proceso, r.asignador
  ].join(' '));
}
function bdpAplicarFila_(fila, idBorrado) {
  if (idBorrado) {
    const id = String(idBorrado);
    __bdpListCache = __bdpListCache.filter(r => String(r.id_predial) !== id);
    applyBDPredialFilters_();
    return true;
  }
  if (!fila || !fila.id_predial || !__bdpListCache.length) {
    loadBDPredial_();
    return false;
  }
  fila.__completa = true;
  const i = __bdpListCache.findIndex(r => String(r.id_predial) === String(fila.id_predial));
  let row;
  if (i >= 0) { row = Object.assign(__bdpListCache[i], fila); }
  else { row = fila; __bdpListCache.unshift(row); }
  row.__searchBlob = bdpBlob_(row);
  applyBDPredialFilters_();
  return true;
}
window.bdpAplicarFila_ = bdpAplicarFila_;

/* ── Aplicar todos los filtros (OPTIMIZADO) ───────────── */
function applyBDPredialFilters_() {
  bdpContarSolexp_();
  bdpSincronizarFiltros_();
  let filtered = __bdpListCache;

  if (__bdpFilterClasif !== 'ALL') {
    filtered = filtered.filter(r =>
      normalizeText_(r.clasificacion || '') === __bdpFilterClasif
    );
  }
  if (__bdpFilterActuacion !== 'ALL') {
    filtered = filtered.filter(r =>
      normalizeText_(r.actuacion || '') === __bdpFilterActuacion
    );
  }
  if (__bdpFilterSustanciador !== 'ALL') {
    filtered = filtered.filter(r =>
      normalizeText_(r.sustanciador || '') === __bdpFilterSustanciador
    );
  }
  if (__bdpFilterEstado !== 'ALL') {
    filtered = filtered.filter(r =>
      normalizeText_(r.estado_proceso || '') === __bdpFilterEstado
    );
  }
  /* 17/09 — SOLICITUD EXPEDIENTE (columna AP) */
  if (__bdpFilterSolexp !== 'ALL') {
    filtered = filtered.filter(r => solexpEstado_(r, 'view-bd-predial') === __bdpFilterSolexp);
  }
  if (__bdpFilterMias && currentUser) {
    const miNombre = normalizeText_(currentUser.nombre || '');
    filtered = filtered.filter(r =>
      normalizeText_(r.sustanciador || '') === miNombre ||
      normalizeText_(r.asistente || '')    === miNombre
    );
  }

  const q = normalizeText_(document.getElementById('bdp-filter')?.value || '');
  if (q) {
    /* Usar el blob pre-calculado (cache) en lugar de recalcular */
    filtered = filtered.filter(r => (r.__searchBlob || '').includes(q));
  }

  renderBDPredial_(filtered);
}

/* ══════════════ FASE 7 · FILTROS COMPACTOS DE BD PREDIAL ══════════════
   Las 4 filas de pastillas (CLASIFICACIÓN, ACTUACIÓN, SUSTANCIADOR y
   ESTADO PROCESO) ocupaban media pantalla antes de ver un expediente.
   Ahora hay 4 selectores: arrancan en "Todas", al tocarlos se despliegan
   las opciones y el selector queda con lo elegido.

   Las pastillas originales NO se borran: quedan ocultas y siguen siendo
   la única fuente de verdad. El selector no hace más que darle clic a la
   pastilla que toca, así que toda la lógica de filtrado de siempre —y la
   lista de sustanciadores que arma js/alcance.js— sigue mandando igual.
   ==================================================================== */
const BDP_FILTROS = [
  { id: 'clasif',       origen: 'bdp-pills-clasif',       titulo: 'CLASIFICACIÓN',  todas: 'Todas' },
  { id: 'actuacion',    origen: 'bdp-pills-actuacion',    titulo: 'ACTUACIÓN',      todas: 'Todas' },
  { id: 'sustanciador', origen: 'bdp-pills-sustanciador', titulo: 'SUSTANCIADOR',   todas: 'Todos' },
  { id: 'estado',       origen: 'bdp-pills-estado',       titulo: 'ESTADO PROCESO', todas: 'Todos' },
  { id: 'solexp',       origen: 'bdp-pills-solexp',       titulo: 'SOLICITUD EXP.', todas: 'Todas' }
];

function bdpPastillas_(cfg) {
  const cont = document.getElementById(cfg.origen);
  return cont ? Array.from(cont.querySelectorAll('.proc-status-pill')) : [];
}

/** ¿El grupo está a la vista? (SUSTANCIADOR solo lo ve quien ve todo) */
function bdpGrupoVisible_(cfg) {
  const cont = document.getElementById(cfg.origen);
  return !!cont && cont.style.display !== 'none';
}

function bdpCerrarPaneles_(menos) {
  document.querySelectorAll('#bdp-filtros .vf').forEach(el => {
    if (el !== menos) el.classList.remove('abierto');
  });
}

/** Deja cada selector con lo que digan las pastillas de verdad. */
function bdpSincronizarFiltros_() {
  const barra = document.getElementById('bdp-filtros');
  if (!barra) return;

  BDP_FILTROS.forEach(cfg => {
    const caja = barra.querySelector('.vf[data-vf="' + cfg.id + '"]');
    if (!caja) return;

    caja.style.display = bdpGrupoVisible_(cfg) ? '' : 'none';

    const pastillas = bdpPastillas_(cfg);
    const activa = pastillas.find(b => b.classList.contains('active')) || pastillas[0];
    const esTodas = !activa || activa === pastillas[0];

    const valor = caja.querySelector('.vf-valor');
    if (valor) valor.textContent = esTodas ? cfg.todas : (activa.textContent || '').trim();
    caja.querySelector('.vf-chip')?.classList.toggle('sel', !esTodas);

    /* Las opciones se rehacen si cambiaron (js/alcance.js reescribe las
       de SUSTANCIADOR cuando llega el alcance). */
    const panel = caja.querySelector('.vf-panel');
    if (!panel) return;
    const firma = pastillas.map(b => (b.textContent || '').trim()).join('|');
    if (panel.dataset.firma !== firma) {
      panel.dataset.firma = firma;
      panel.innerHTML = pastillas.map((b, i) =>
        '<button type="button" class="vf-op" data-i="' + i + '">' +
        escapeHtml_((b.textContent || '').trim()) + '</button>'
      ).join('');
    }
    Array.from(panel.querySelectorAll('.vf-op')).forEach((op, i) => {
      op.classList.toggle('activa', pastillas[i] === activa);
    });
  });
}

function bdpMontarFiltros_() {
  const barra = document.getElementById('bdp-filtros');
  if (!barra || barra.dataset.listo === '1') return;
  barra.dataset.listo = '1';

  barra.innerHTML = BDP_FILTROS.map(cfg =>
    '<div class="vf" data-vf="' + cfg.id + '">' +
      '<button type="button" class="vf-chip">' +
        '<span class="vf-titulo">' + cfg.titulo + '</span>' +
        '<span class="vf-valor">' + cfg.todas + '</span>' +
        '<span class="vf-flecha" aria-hidden="true">▾</span>' +
      '</button>' +
      '<div class="vf-panel"></div>' +
    '</div>'
  ).join('');

  barra.addEventListener('click', (e) => {
    const chip = e.target.closest('.vf-chip');
    if (chip) {
      const caja = chip.closest('.vf');
      const abierto = caja.classList.contains('abierto');
      bdpCerrarPaneles_(null);
      if (!abierto) { caja.classList.add('abierto'); playSoundOnce(SOUNDS.menu); }
      return;
    }
    const op = e.target.closest('.vf-op');
    if (!op) return;
    const caja = op.closest('.vf');
    const cfg = BDP_FILTROS.find(c => c.id === caja.dataset.vf);
    const pastilla = bdpPastillas_(cfg)[Number(op.dataset.i)];
    caja.classList.remove('abierto');
    if (pastilla) pastilla.click();      /* manda la pastilla de siempre */
    bdpSincronizarFiltros_();
  });

  /* Se cierra al tocar fuera, como los modales de la Fase 3. */
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#bdp-filtros')) bdpCerrarPaneles_(null);
  });

  /* js/alcance.js rehace las pastillas de SUSTANCIADOR cuando llega el
     alcance: hay que volver a leerlas. */
  const contSust = document.getElementById('bdp-pills-sustanciador');
  if (contSust && window.MutationObserver) {
    new MutationObserver(() => bdpSincronizarFiltros_())
      .observe(contSust, { childList: true });
  }

  bdpSincronizarFiltros_();
}

/* 17/09 — el filtro SOLICITUD EXP. de BD Predial. Mismo aparato que los
   otros: las pastillas ocultas (#bdp-pills-solexp) mandan. Aquí solo se
   les pone el número de expedientes en cada estado, sobre la lista que el
   servidor dejó ver. (La variable vive junto a las demás, arriba.) */

function bdpContarSolexp_() {
  const cont = document.getElementById('bdp-pills-solexp');
  if (!cont) return;
  const ops = solexpOpciones_(__bdpListCache, 'view-bd-predial');
  cont.querySelectorAll('.proc-status-pill').forEach(b => {
    const o = ops.find(x => x.valor === (b.dataset.solexp || 'ALL'));
    if (o && b.textContent !== o.texto) b.textContent = o.texto;
  });
}

document.querySelectorAll('#bdp-pills-solexp .proc-status-pill').forEach(btn => {
  btn.addEventListener('click', () => {
    playSoundOnce(SOUNDS.menu);
    document.querySelectorAll('#bdp-pills-solexp .proc-status-pill').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    __bdpFilterSolexp = btn.dataset.solexp || 'ALL';
    applyBDPredialFilters_();
  });
});

/* ── Render de tarjetas — PAGINADO (reemplaza la versión anterior) ── */
let   __bdpFilteredCache = [];   // resultado actual de los filtros
let   __bdpPage          = 0;    // página visible
const __BDP_PAGE_SIZE    = 100;  // tarjetas por página

/* Punto de entrada que ya usa applyBDPredialFilters_ — NO cambia su firma */
function renderBDPredial_(items) {
  __bdpFilteredCache = Array.isArray(items) ? items : [];
  __bdpPage = 0;
  bdpPaintPage_();
}

/* Pinta SOLO la página actual (máx __BDP_PAGE_SIZE tarjetas en el DOM) */
function bdpPaintPage_() {
  const wrap    = document.getElementById('bdp-list');
  const countEl = document.getElementById('bdp-count');
  if (!wrap) return;

  const items = __bdpFilteredCache;
  const total = items.length;
  if (countEl) countEl.textContent = String(total);

  if (!total) {
    wrap.innerHTML = '<p class="muted center" style="grid-column:1/-1; margin-top:20px;">No hay expedientes que coincidan con los filtros.</p>';
    return;
  }

  const totalPages = Math.ceil(total / __BDP_PAGE_SIZE);
  if (__bdpPage > totalPages - 1) __bdpPage = totalPages - 1;
  if (__bdpPage < 0)              __bdpPage = 0;

  const start = __bdpPage * __BDP_PAGE_SIZE;
  const slice = items.slice(start, start + __BDP_PAGE_SIZE);

  const puedeEliminar = canEliminarPredial_();
  const puedeDecision = canDecisionPredial_();
  const pager = bdpPagerHTML_(__bdpPage, totalPages);

  /* Toda la página como UN solo string → un único innerHTML */
  let html = pager;
  for (let i = 0; i < slice.length; i++) {
    html += bdpCardHTML_(slice[i], start + i, puedeEliminar, puedeDecision);
  }
  html += pager;
  wrap.innerHTML = html;
}

/* Tarjeta como string (sin createElement ni addEventListener por tarjeta) */
function bdpCardHTML_(row, idx, puedeEliminar, puedeDecision) {
  const clasif     = (row.clasificacion  || 'BAJA').toUpperCase();
  const actuacion  = (row.actuacion      || 'NINGUNA').toUpperCase();
  const estadoProc = (row.estado_proceso || 'PENDIENTE').toUpperCase();
  const fichaTxt   = bdpCleanFicha_(row.ficha_catastral);
  const correoTxt  = String(row.correo_electronico || '').trim();

  /* AJUSTE 10/09 — dato TOCABLE: al tocarlo se copia al portapapeles.
     Solo se vuelve tocable si hay valor; sin valor se pinta el guion de
     siempre y no pasa nada al tocarlo. El texto que se copia NO sale del
     DOM sino de la fila (BDP_COPIABLES), así el recorte visual con "…"
     del correo nunca puede recortar lo que se copia. */
  const cop = (val, clave) => !String(val || '').trim() ? '' :
    '<span class="bdp-copy" data-bdp-copy="' + clave + '" title="Toca para copiar">' +
    escapeHtml_(val) + '</span>';

  let acciones = '';
  if (puedeEliminar) {
    acciones +=
      '<button type="button" class="bdp-icon-btn danger-icon" data-bdp-act="eliminar" title="Eliminar expediente">' +
      '<img src="img/eliminar.webp" alt="Eliminar"></button>';
  }
  acciones +=
    '<button type="button" class="bdp-icon-btn" data-bdp-act="ver" title="Ver detalles">' +
    '<img src="img/mostrar.png" alt="Ver"></button>';
  if (canEditarEstePredial_(row)) {
    acciones +=
      '<button type="button" class="bdp-icon-btn" data-bdp-act="editar" title="Editar expediente">' +
      '<img src="img/editar.webp" alt="Editar"></button>';
  }
  if (puedeDecision) {
    acciones +=
      '<button type="button" class="bdp-icon-btn bdp-icon-btn--marca" data-bdp-act="decision" title="Actuación y seguimiento">' +
      '<img src="img/firma.webp" alt="Actuación"></button>';
 }
  /* 17/09 — SOLICITUD EXPEDIENTE: rojo con latido si falta la respuesta de
     ARCHIVO. Se pinta como string (sin tocar el DOM por tarjeta). */
  const sxEst = solexpEstado_(row, 'view-bd-predial');
  const sxCls = sxEst === 'PENDIENTE' ? ' sex-btn sex-pendiente' : (sxEst === 'RESPONDIDA' ? ' sex-btn sex-respondida' : ' sex-btn');
  const sxTit = sxEst === 'PENDIENTE' ? 'Solicitud Expediente · falta respuesta de ARCHIVO'
              : (sxEst === 'RESPONDIDA' ? 'Solicitud Expediente · respondida' : 'Solicitud Expediente');
  acciones +=
    '<button type="button" class="bdp-icon-btn' + sxCls + '" data-bdp-act="solexp" title="' + sxTit + '" aria-label="' + sxTit + '">' +
    '<img src="img/expediente.webp" alt="Solicitud Expediente"></button>';
  acciones +=
    '<button type="button" class="bdp-icon-btn" data-bdp-act="expediente" title="Expediente (archivo)">' +
    '<img src="img/pdf.webp" alt="Expediente"></button>';

  return (
    '<div class="bdp-card clasif-' + clasif + '" data-bdp-idx="' + idx + '">' +
      '<div class="bdp-head">' +
        '<div class="bdp-head-left">' +
          '<p class="bdp-nombres">' + (cop(row.nombres, 'nombres') || escapeHtml_(row.nombres || '')) + '</p>' +
          '<p class="bdp-direccion">' + ICO_('ubicacion', 14) + ' ' + (cop(row.direccion_predio, 'direccion') || 'Sin dirección') + '</p>' +
        '</div>' +
        '<div class="bdp-head-right">' +
          '<div class="bdp-valor-deuda">' + bdpFormatPesos_(row.valor_deuda) + '</div>' +
          '<span class="bdp-clasif-badge ' + clasif + '">' + clasif + '</span>' +
        '</div>' +
      '</div>' +
      '<div class="bdp-grid">' +
        '<div><b>Ficha Catastral</b>' + (cop(fichaTxt, 'ficha') || '—') + '</div>' +
        '<div><b>N° Exp. Físico</b>' + (cop(row.no_exp_fisico, 'exp') || '—') + '</div>' +
        '<div><b>Sustanciador</b>'  + escapeHtml_(row.sustanciador || '—') + '</div>' +
        '<div><b>Asignador</b>'     + escapeHtml_(row.asignador || '—') + '</div>' +
        '<div><b>Debe desde</b>'    + escapeHtml_(bdpFormatDebeDesde_(row.debe_desde)) + '</div>' +
        '<div><b>Deuda hasta</b>'   + escapeHtml_(bdpFormatDebeDesde_(row.deuda_hasta)) + '</div>' +
        /* AJUSTE 10/09 — NIT y correo comparten la última fila, a todo el
           ancho. El correo va SIEMPRE en una sola línea (se recorta con "…"):
           así la tarjeta mide igual con correo, sin correo o con uno de 192
           caracteres, que los hay. */
        '<div class="bdp-cell-id">' +
          '<div class="bdp-id-nit"><b>NIT / Cédula</b>' + (cop(row.nit_cedula, 'nit') || '—') + '</div>' +
          '<div class="bdp-id-correo"><b>Correo electrónico</b>' +
            (correoTxt
              ? '<span class="bdp-copy bdp-correo" data-bdp-copy="correo" title="' + escapeHtml_(correoTxt) + '">' + escapeHtml_(correoTxt) + '</span>'
              : '<span class="bdp-correo bdp-sin-dato">Sin correo</span>') +
          '</div>' +
        '</div>' +
      '</div>' +
   '<div style="display:flex; gap:14px; flex-wrap:wrap; align-items:flex-start; margin-top:4px;">' +
        '<div style="display:flex; flex-direction:column; gap:2px;">' +
          '<span class="bdp-pill-label">Actuación</span>' +
          '<span class="bdp-actuacion act-' + actuacion.replace(/\s+/g,'_') + '">' + escapeHtml_(actuacion) + '</span>' +
        '</div>' +
        '<div style="display:flex; flex-direction:column; gap:2px;">' +
          '<span class="bdp-pill-label">Estado</span>' +
          '<span class="bdp-estado est-'    + estadoProc.replace(/\s+/g,'-') + '">' + escapeHtml_(estadoProc) + '</span>' +
        '</div>' +
      '</div>' +
      '<div class="bdp-actions">' + acciones + '</div>' +
    '</div>'
  );
}

/* Paginador (reutiliza .estad-pager-btn que YA existe en styles.css) */
function bdpPagerHTML_(page, totalPages) {
  if (totalPages <= 1) return '';
  const b = (p, label, disabled) =>
    '<button type="button" class="estad-pager-btn" data-bdp-page="' + p + '"' +
    (disabled ? ' disabled' : '') + '>' + label + '</button>';
  return (
    '<div style="grid-column:1/-1;display:flex;gap:6px;flex-wrap:wrap;' +
    'justify-content:center;align-items:center;margin:6px 0;">' +
      b(0, '« Primera', page === 0) +
      b(page - 1, '‹ Ant.', page === 0) +
      '<span style="font-weight:800;color:var(--primary);font-size:.82rem;padding:0 8px;">' +
        'Página ' + (page + 1) + ' / ' + totalPages +
      '</span>' +
      b(page + 1, 'Sig. ›', page >= totalPages - 1) +
      b(totalPages - 1, 'Última »', page >= totalPages - 1) +
    '</div>'
  );
}

function _bdpMkBtn_(src, title) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'bdp-icon-btn';
  btn.title = title;
  btn.setAttribute('aria-label', title);
  btn.innerHTML = `<img src="${src}" alt="${title}" />`;
  return btn;
}

/* ── Botón principal: abrir BD ─────────────────────────── */
document.getElementById('btn-bd-predial')?.addEventListener('click', () => {
  playSoundOnce(SOUNDS.back);
  abrirBDPredial_();
});

/* ── REGRESAR ─────────────────────────────────────────── */
document.getElementById('btn-bdp-back')?.addEventListener('click', () => {
  playSoundOnce(SOUNDS.back);
  showView('view-inicio');
});

/* ── Pastillas filtro CLASIFICACION ────────────────────── */
document.querySelectorAll('#bdp-pills-clasif .proc-status-pill').forEach(btn => {
  btn.addEventListener('click', () => {
    playSoundOnce(SOUNDS.menu);
    document.querySelectorAll('#bdp-pills-clasif .proc-status-pill').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    __bdpFilterClasif = btn.dataset.clasif || 'ALL';
    applyBDPredialFilters_();
  });
});

/* ── Pastillas filtro ACTUACION ────────────────────────── */
document.querySelectorAll('#bdp-pills-actuacion .proc-status-pill').forEach(btn => {
  btn.addEventListener('click', () => {
    playSoundOnce(SOUNDS.menu);
    document.querySelectorAll('#bdp-pills-actuacion .proc-status-pill').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    __bdpFilterActuacion = btn.dataset.actuacion || 'ALL';
    applyBDPredialFilters_();
  });
});

/* ── Pastillas filtro SUSTANCIADOR ───────────────────────
   FASE 5 — la escucha va en el contenedor, no en cada botón: los
   nombres ya no están escritos en el HTML, los pone js/alcance.js
   con quien realmente tiene expedientes. */
document.getElementById('bdp-pills-sustanciador')?.addEventListener('click', (ev) => {
  const btn = ev.target.closest('.proc-status-pill');
  if (!btn) return;
  playSoundOnce(SOUNDS.menu);
  document.querySelectorAll('#bdp-pills-sustanciador .proc-status-pill').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  __bdpFilterSustanciador = normalizeText_(btn.dataset.sustanciador || 'ALL');
  applyBDPredialFilters_();
});

/* ── Pastillas filtro ESTADO PROCESO ───────────────────── */
document.querySelectorAll('#bdp-pills-estado .proc-status-pill').forEach(btn => {
  btn.addEventListener('click', () => {
    playSoundOnce(SOUNDS.menu);
    document.querySelectorAll('#bdp-pills-estado .proc-status-pill').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    __bdpFilterEstado = btn.dataset.estado || 'ALL';
    applyBDPredialFilters_();
  });
});

/* ── Pastilla "Solo las mías" ──────────────────────────── */
document.getElementById('bdp-pill-mias')?.addEventListener('click', () => {
  playSoundOnce(SOUNDS.menu);
  const btn = document.getElementById('bdp-pill-mias');
  __bdpFilterMias = !__bdpFilterMias;
  if (__bdpFilterMias) btn.classList.add('active');
  else btn.classList.remove('active');
  applyBDPredialFilters_();
});

/* ── Filtro de texto ───────────────────────────────────── */
let __bdpFilterTimer = null;
document.getElementById('bdp-filter')?.addEventListener('input', () => {
  clearTimeout(__bdpFilterTimer);
   __bdpFilterTimer = setTimeout(applyBDPredialFilters_, 350);
});

/* ── FASE 7 · la fila completa se pide cuando hace falta ────────────
   El listado ahora trae el objeto ligero (18 campos): es lo que la
   tarjeta, los filtros y el buscador necesitan, y para un ADMIN baja el
   viaje de 5,3 MB a 3,0 MB. Ver / Editar / Decisión / Expediente sí
   necesitan las 41 columnas, así que se piden al abrir y se guardan en
   la misma fila de la caché: la segunda vez ya no hay viaje.        */
async function bdpFilaCompleta_(row) {
  if (!row || row.__completa) return row;
  try {
    const full = await apiGet('getpredial', { id_predial: row.id_predial });
    if (full && full.id_predial) {
      Object.assign(row, full);
      row.__completa = true;
    }
  } catch (e) {
    Swal.fire({ icon: 'error', title: 'No se pudo abrir', text: String(e.message || e) });
    return null;
  }
  return row;
}

/* ══════════ AJUSTE 10/09 · COPIAR DATOS DE LA TARJETA ══════════
   El valor que se copia se saca SIEMPRE de la fila del caché, nunca del
   texto de pantalla: la ficha va sin el apóstrofe del caché y el correo
   va completo aunque en pantalla se vea recortado con "…". */
const BDP_COPIABLES = {
  nombres:   { et: 'Nombre',          val: r => String(r.nombres || '').trim() },
  direccion: { et: 'Dirección',       val: r => String(r.direccion_predio || '').trim() },
  ficha:     { et: 'Ficha catastral', val: r => bdpCleanFicha_(r.ficha_catastral) },
  exp:       { et: 'N° Exp. Físico',  val: r => String(r.no_exp_fisico || '').trim() },
  nit:       { et: 'NIT / Cédula',    val: r => String(r.nit_cedula || '').trim() },
  correo:    { et: 'Correo',          val: r => String(r.correo_electronico || '').trim() }
};

let __bdpCopyToastTimer = null;
function bdpAvisoCopia_(msg, ok) {
  let t = document.getElementById('bdp-copy-toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'bdp-copy-toast';
    t.className = 'bdp-copy-toast';
    t.setAttribute('role', 'status');
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.toggle('error', !ok);
  t.classList.add('show');
  clearTimeout(__bdpCopyToastTimer);
  __bdpCopyToastTimer = setTimeout(() => t.classList.remove('show'), 1400);
}

async function bdpCopiarDeTarjeta_(el, row, clave) {
  const def = BDP_COPIABLES[clave];
  if (!def || !row) return;
  const txt = def.val(row);
  if (!txt) return;                       /* sin valor no se copia nada */
  const ok = await bdpCopiarPortapapeles_(txt);
  if (ok) playSoundOnce(SOUNDS.menu);
  el.classList.add(ok ? 'copiado' : 'copia-error');
  setTimeout(() => el.classList.remove('copiado', 'copia-error'), 900);
  bdpAvisoCopia_(ok ? '✓ ' + def.et + ' copiado' : 'No se pudo copiar', ok);
}

/* ── Delegación de eventos BD Predial (UN solo listener, se registra 1 vez) ── */
document.getElementById('bdp-list')?.addEventListener('click', async (e) => {

  /* Paginador */
  const pageBtn = e.target.closest('[data-bdp-page]');
  if (pageBtn) {
    if (pageBtn.disabled) return;
    playSoundOnce(SOUNDS.menu);
    __bdpPage = Number(pageBtn.dataset.bdpPage) || 0;
    bdpPaintPage_();
    document.getElementById('bdp-list')?.scrollIntoView({ behavior:'smooth', block:'start' });
    return;
  }

  /* AJUSTE 10/09 — copiar un dato de la tarjeta. Va ANTES de las acciones,
     pero los tocables no están dentro de ningún [data-bdp-act], así que no
     se pisan: un botón de acción nunca entra aquí. */
  const copyEl = e.target.closest('[data-bdp-copy]');
  if (copyEl) {
    const cardCopy = copyEl.closest('[data-bdp-idx]');
    if (!cardCopy) return;
    await bdpCopiarDeTarjeta_(
      copyEl,
      __bdpFilteredCache[Number(cardCopy.dataset.bdpIdx)],
      copyEl.dataset.bdpCopy
    );
    return;
  }

  /* Acciones de tarjeta */
  const actBtn = e.target.closest('[data-bdp-act]');
  if (!actBtn) return;
  const cardEl = e.target.closest('[data-bdp-idx]');
  if (!cardEl) return;
  const row = __bdpFilteredCache[Number(cardEl.dataset.bdpIdx)];
  if (!row) return;

  const act = actBtn.dataset.bdpAct;

  if (act === 'ver') {
    playSoundOnce(SOUNDS.menu);
    if (!(await bdpFilaCompleta_(row))) return;
    __bdpSelected = row;
    abrirBDPDetalle_(row);
    return;
  }
  if (act === 'editar') {
    playSoundOnce(SOUNDS.menu);
    if (!(await bdpFilaCompleta_(row))) return;
    __bdpSelected = row;
    abrirBDPEditar_(row);
    return;
  }
  if (act === 'decision') {
    playSoundOnce(SOUNDS.menu);
    if (!(await bdpFilaCompleta_(row))) return;
    __bdpSelected = row;
    abrirBDPDecision_(row);
    return;
  }
  if (act === 'solexp') {
    /* La columna AP ya viaja en el listado: no hace falta la fila completa. */
    playSoundOnce(SOUNDS.menu);
    if (window.SOLEXP && typeof window.SOLEXP.abrir === 'function') window.SOLEXP.abrir('view-bd-predial', row);
    else Swal.fire({ icon: 'warning', title: 'No se pudo abrir', text: 'Falta js/solicitud-exp.js. Recarga la app.' });
    return;
  }
  if (act === 'expediente') {
    playSoundOnce(SOUNDS.menu);
    if (!(await bdpFilaCompleta_(row))) return;
    __bdpSelected = row;
    abrirBDPExpediente_(row);
    return;
  }
  if (act === 'eliminar') {
    const ok = await Swal.fire({
      icon:'warning',
      title:'¿Eliminar expediente?',
      html:'<b>' + escapeHtml_(row.nombres || row.id_predial) + '</b><br>' +
           '<b>Exp. Físico:</b> ' + escapeHtml_(row.no_exp_fisico || '') + '<br><br>' +
           'Esta acción es irreversible.',
      showCancelButton:true,
      confirmButtonText:'Eliminar',
      cancelButtonText:'Cancelar',
      confirmButtonColor:'#dc2626'
    });
    if (!ok.isConfirmed) return;
    try {
      await apiPost('eliminarpredial', { uid: uidActual_(), id_predial: row.id_predial });
      playSoundOnce(SOUNDS.success);
      bdpAplicarFila_(null, row.id_predial);
      Swal.fire({ icon:'success', title:'Eliminado', timer:1400, showConfirmButton:false });
    } catch (err) {
      Swal.fire({ icon:'error', title:'Error', text:String(err.message || err) });
    }
    return;
  }
});

/* FASE 2: el botón "DATOS EXCEL" (btn-bdp-mis-exp) y su llamada
   getmisexpedienteslink se eliminaron junto con la columna I de USUARIOS. */

/* ── MIS EXPEDIENTES (explorador Drive, columna K de USUARIOS) ── */
let __bdpExpStack     = [];   // pila de folderIds para "Atrás"
let __bdpExpRootId    = '';   // id de la carpeta raíz del usuario
let __bdpExpItems     = [];   // ítems de la carpeta actual (para filtrar)
let __bdpExpCurrentId = '';   // id de la carpeta que se está viendo
let __bdpExpAllFiles  = null;  // caché plano recursivo de TODOS los archivos (búsqueda profunda)
let __bdpExpLoadingAll = false;

const BDP_EXP_ICON_FOLDER = 'img/carpeta-drive.webp';
const BDP_EXP_ICON_FILE   = 'img/pdf.webp';

document.getElementById('btn-bdp-expedientes')?.addEventListener('click', async () => {
  playSoundOnce(SOUNDS.back);
 if (!currentUser) { Swal.fire({ icon:'warning', title:'Sesión inválida' }); return; }
  __bdpExpStack = [];
  __bdpExpAllFiles = null;   // fuerza recarga del árbol al reabrir
  await bdpExpCargar_('');   // '' = carpeta raíz (CARPETA EXPEDIENTES DRIVE de USUARIOS)
});

async function bdpExpCargar_(folderId) {
  const modal   = document.getElementById('modal-bdp-expedientes');
  const listEl  = document.getElementById('bdp-exp-list');
  const pathEl  = document.getElementById('bdp-exp-path');
  const backBtn = document.getElementById('btn-bdp-exp-atras');
  if (!modal || !listEl) return;

  modal.classList.remove('hidden');
  listEl.innerHTML = '<p class="muted center" style="padding:24px;">Cargando…</p>';
  if (pathEl) pathEl.textContent = '';

  try {
    const res = await apiGet('listmisexpedientes', {
      documento: currentUser.documento,
      folderId : folderId || ''
    });

    if (!res || res.found === false) {
      listEl.innerHTML = '<p class="muted center" style="padding:24px;">No tienes carpeta de expedientes configurada en la hoja USUARIOS (columna K).</p>';
      if (backBtn) backBtn.style.display = 'none';
      return;
    }

    __bdpExpRootId    = res.rootId || __bdpExpRootId;
    __bdpExpCurrentId = res.folderId || folderId || __bdpExpRootId;
    if (pathEl) pathEl.innerHTML = ICO_('carpeta-abierta', 16) + ' ' + escapeHtml_(res.folderName || 'Expedientes');
    if (backBtn) backBtn.style.display = (__bdpExpStack.length > 0) ? '' : 'none';

 __bdpExpItems = Array.isArray(res.items) ? res.items : [];
    const filtroEl = document.getElementById('bdp-exp-filtro');
    if (filtroEl) filtroEl.value = '';   // reinicia el filtro al cambiar de carpeta
    bdpExpRender_('');
    return;
  } catch (e) {
    listEl.innerHTML = '<p class="muted center" style="padding:24px;color:#dc2626;">Error: ' + escapeHtml_(String(e.message || e)) + '</p>';
  }
}

/* Pinta la lista aplicando el filtro de texto.
   - Sin filtro: navegación normal por el nivel actual.
   - Con filtro: búsqueda PROFUNDA en todo el árbol (caché __bdpExpAllFiles). */
function bdpExpRender_(filtro) {
  const listEl = document.getElementById('bdp-exp-list');
  if (!listEl) return;
  const folderId = __bdpExpCurrentId;
  const q = normalizeText_(filtro || '');

  // Sin texto → mostrar el nivel actual como siempre
  if (!q) {
    if (!__bdpExpItems.length) {
      listEl.innerHTML = '<p class="muted center" style="padding:24px;">Esta carpeta está vacía.</p>';
      return;
    }
    bdpExpPintarItems_(__bdpExpItems, folderId, false);
    return;
  }

  // Con texto → búsqueda profunda en todo el árbol
  if (__bdpExpAllFiles === null) {
    bdpExpCargarTodos_();   // dispara la carga única (si no está en curso)
    const localMatch = __bdpExpItems.filter(it => normalizeText_(it.name).includes(q));
    listEl.innerHTML = '<p class="muted center" style="padding:16px;">Buscando en todas las subcarpetas…</p>';
    if (localMatch.length) bdpExpPintarItems_(localMatch, folderId, false);
    return;
  }

  const matches = __bdpExpAllFiles.filter(f => normalizeText_(f.name).includes(q));
  if (!matches.length) {
    listEl.innerHTML = '<p class="muted center" style="padding:24px;">Sin resultados para el filtro.</p>';
    return;
  }
  bdpExpPintarItems_(matches, folderId, true);   // true = mostrar la ruta (carpeta contenedora)
}

/* Carga UNA sola vez el árbol completo (todos los archivos con su ruta). */
async function bdpExpCargarTodos_() {
  if (__bdpExpLoadingAll || __bdpExpAllFiles !== null) return;
  __bdpExpLoadingAll = true;
  try {
    const res = await apiGet('buscarmisexpedientes', { documento: currentUser.documento });
    __bdpExpAllFiles = (res && Array.isArray(res.files)) ? res.files : [];
  } catch (e) {
    __bdpExpAllFiles = [];
  } finally {
    __bdpExpLoadingAll = false;
    const fEl = document.getElementById('bdp-exp-filtro');
    if (fEl && fEl.value.trim()) bdpExpRender_(fEl.value);   // re-render con el filtro vigente
  }
}

/* Pinta una lista de ítems (carpetas y/o archivos).
   showPath añade la carpeta contenedora bajo el nombre. */
function bdpExpPintarItems_(items, folderId, showPath) {
  const listEl = document.getElementById('bdp-exp-list');
  if (!listEl) return;
  listEl.innerHTML = '';
  items.forEach(it => {
    const isFolder = it.type === 'folder';
    const rowEl = document.createElement('div');
    rowEl.className = 'bdp-exp-item' + (isFolder ? ' is-folder' : '');
    const rutaHtml = (showPath && it.path)
      ? `<span class="hf-ruta">${ICO_('carpeta', 12)} ${escapeHtml_(it.path)}</span>`
      : '';
    rowEl.innerHTML = `
      <img class="bdp-exp-icon" src="${isFolder ? BDP_EXP_ICON_FOLDER : BDP_EXP_ICON_FILE}" alt="" />
      <span class="bdp-exp-name" title="${escapeHtml_(it.name)}">${escapeHtml_(it.name)}${rutaHtml}</span>
    `;

    if (isFolder) {
      rowEl.addEventListener('click', () => {
        playSoundOnce(SOUNDS.back);
        __bdpExpStack.push(folderId || __bdpExpRootId);
        bdpExpCargar_(it.id);
      });
    } else {
      const actions = document.createElement('div');
      actions.className = 'bdp-exp-actions';

      const openBtn = document.createElement('button');
      openBtn.type = 'button';
      openBtn.className = 'bdp-exp-open';
      openBtn.textContent = 'Abrir';
      openBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        verArchivo_(it.url, it.name);          /* FASE 8: visor en modal */
      });

      const copyBtn = document.createElement('button');
      copyBtn.type = 'button';
      copyBtn.className = 'bdp-exp-copy';
      copyBtn.textContent = 'Copiar';
      copyBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const ok = await bdpCopiarPortapapeles_(it.url);
        copyBtn.textContent = ok ? '¡Copiado!' : 'Error';
        copyBtn.classList.add(ok ? 'copied' : 'error');
        setTimeout(() => {
          copyBtn.textContent = 'Copiar';
          copyBtn.classList.remove('copied', 'error');
        }, 1200);
      });

      actions.appendChild(openBtn);
      actions.appendChild(copyBtn);
      rowEl.appendChild(actions);
    }
    listEl.appendChild(rowEl);
  });
}

/* Atrás */
document.getElementById('btn-bdp-exp-atras')?.addEventListener('click', () => {
  if (!__bdpExpStack.length) return;
  playSoundOnce(SOUNDS.back);
  const prev = __bdpExpStack.pop();
  bdpExpCargar_(prev === __bdpExpRootId ? '' : prev);
});

/* Salir */
document.getElementById('btn-bdp-exp-salir')?.addEventListener('click', () => {
  playSoundOnce(SOUNDS.back);
  document.getElementById('modal-bdp-expedientes')?.classList.add('hidden');
  __bdpExpStack = [];
});

/* ============================================================
   MODAL EXPEDIENTE (archivo AL) — visualizar / explorar / asociar
   ============================================================ */
let __bdpArchRow       = null;
let __bdpArchMode      = 'live';   // 'live' (id existe) | 'defer' (agregar, sin id)
let __bdpFormArchivoSel= '';       // url elegida en modo defer
let __bdpArchStack     = [];
let __bdpArchRootId    = '';
let __bdpArchItems     = [];
let __bdpArchCurrentId = '';

const BDP_ARCH_ICON_FOLDER = 'img/carpeta-drive.webp';
const BDP_ARCH_ICON_FILE   = 'img/pdf.webp';

/* Extrae el ID de archivo de una URL de Drive y arma el preview embebible */
function bdpDriveFileId_(url) {
  const s = String(url || '');
  let m = s.match(/\/file\/d\/([A-Za-z0-9_-]{10,})/); if (m) return m[1];
  m = s.match(/[?&]id=([A-Za-z0-9_-]{10,})/);        if (m) return m[1];
  m = s.match(/\/d\/([A-Za-z0-9_-]{10,})/);          if (m) return m[1];
  return '';
}
function bdpDrivePreview_(url) {
  const id = bdpDriveFileId_(url);
  return id ? ('https://drive.google.com/file/d/' + id + '/preview') : url;
}

function abrirBDPExpediente_(row) {
  __bdpArchRow = row;
  __bdpArchMode = 'live';
  document.getElementById('bdp-arch-context').innerHTML =
    '<b>' + escapeHtml_(row.nombres || '') + '</b> — Exp. ' + escapeHtml_(row.no_exp_fisico || '');
  document.getElementById('modal-bdp-archivo').classList.remove('hidden');

  const url = String(row.archivo_expediente || '').trim();
  if (url) bdpArchMostrarArchivo_(url);
  else     bdpArchMostrarExplorador_();
}

/* Entrada desde el formulario Ingresar/Editar
   FASE 9 (ajuste 2): a esta funcion le faltaba el cierre de la de arriba, asi
   que quedaba DECLARADA DENTRO de abrirBDPExpediente_ y nunca fue global:
   el boton EXPEDIENTE (ARCHIVO) del formulario reventaba con
   "abrirBDPExpedienteDesdeForm_ is not defined". */
function abrirBDPExpedienteDesdeForm_() {
  // EDITAR: expediente ya existe → trabaja en vivo
  if (__bdpFormMode === 'edit' && __bdpFormRow && __bdpFormRow.id_predial) {
    abrirBDPExpediente_(__bdpFormRow);
    return;
  }
  // INGRESAR: aún no hay expediente → selección diferida
  __bdpArchMode = 'defer';
  __bdpArchRow  = null;
  document.getElementById('bdp-arch-context').innerHTML =
    '<b>Nuevo expediente</b> — el archivo se guardará al crear';
  document.getElementById('modal-bdp-archivo').classList.remove('hidden');
  const url = String(__bdpFormArchivoSel || '').trim();
  if (url) bdpArchMostrarArchivo_(url);
  else     bdpArchMostrarExplorador_();
}

function bdpArchMostrarArchivo_(url) {
  document.getElementById('bdp-arch-explorer').style.display = 'none';
  document.getElementById('bdp-arch-view').style.display = 'flex';
  document.getElementById('bdp-arch-iframe').src = bdpDrivePreview_(url);
}

function bdpArchMostrarExplorador_() {
  document.getElementById('bdp-arch-view').style.display = 'none';
  document.getElementById('bdp-arch-iframe').src = '';   // detiene la carga del anterior
  document.getElementById('bdp-arch-explorer').style.display = 'flex';
  __bdpArchStack = [];
  const f = document.getElementById('bdp-arch-filtro'); if (f) f.value = '';
  bdpArchCargar_('');
}

async function bdpArchCargar_(folderId) {
  const listEl  = document.getElementById('bdp-arch-list');
  const pathEl  = document.getElementById('bdp-arch-path');
  const backBtn = document.getElementById('btn-bdp-arch-atras');
  if (!listEl) return;
  listEl.innerHTML = '<p class="muted center" style="padding:24px;">Cargando…</p>';
  if (pathEl) pathEl.textContent = '';
  try {
    const res = await apiGet('listmisexpedientes', {
      documento: currentUser.documento, folderId: folderId || ''
    });
    if (!res || res.found === false) {
      listEl.innerHTML = '<p class="muted center" style="padding:24px;">No tienes carpeta de expedientes configurada (columna K de USUARIOS).</p>';
      if (backBtn) backBtn.style.display = 'none';
      return;
    }
    __bdpArchRootId    = res.rootId || __bdpArchRootId;
    __bdpArchCurrentId = res.folderId || folderId || __bdpArchRootId;
    if (pathEl) pathEl.innerHTML = ICO_('carpeta-abierta', 16) + ' ' + escapeHtml_(res.folderName || 'Expedientes');
    if (backBtn) backBtn.style.display = (__bdpArchStack.length > 0) ? '' : 'none';
    __bdpArchItems = Array.isArray(res.items) ? res.items : [];
    bdpArchRender_('');
  } catch (e) {
    listEl.innerHTML = '<p class="muted center" style="padding:24px;color:#dc2626;">Error: ' + escapeHtml_(String(e.message || e)) + '</p>';
  }
}

function bdpArchRender_(filtro) {
  const listEl = document.getElementById('bdp-arch-list');
  if (!listEl) return;
  const q = normalizeText_(filtro || '');
  const items = q ? __bdpArchItems.filter(it => normalizeText_(it.name).includes(q)) : __bdpArchItems;
  if (!__bdpArchItems.length) { listEl.innerHTML = '<p class="muted center" style="padding:24px;">Esta carpeta está vacía.</p>'; return; }
  if (!items.length)          { listEl.innerHTML = '<p class="muted center" style="padding:24px;">Sin resultados para el filtro.</p>'; return; }

  const folderId = __bdpArchCurrentId;
  listEl.innerHTML = '';
  items.forEach(it => {
    const isFolder = it.type === 'folder';
    const rowEl = document.createElement('div');
    rowEl.className = 'bdp-exp-item' + (isFolder ? ' is-folder' : '');
    rowEl.innerHTML =
      '<img class="bdp-exp-icon" src="' + (isFolder ? BDP_ARCH_ICON_FOLDER : BDP_ARCH_ICON_FILE) + '" alt="" />' +
      '<span class="bdp-exp-name" title="' + escapeHtml_(it.name) + '">' + escapeHtml_(it.name) + '</span>';

    if (isFolder) {
      rowEl.addEventListener('click', () => {
        playSoundOnce(SOUNDS.back);
        __bdpArchStack.push(folderId || __bdpArchRootId);
        bdpArchCargar_(it.id);
      });
    } else {
      const actions = document.createElement('div');
      actions.className = 'bdp-exp-actions';

      const openBtn = document.createElement('button');
      openBtn.type = 'button';
      openBtn.className = 'bdp-exp-open';
      openBtn.textContent = 'Abrir';
      /* FASE 9 · ajuste 3: el visor lleva el botón ＋ Agregar con esta misma acción. */
      openBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        verArchivo_(it.url, it.name, () => bdpArchAgregar_(it));
      });

      const addBtn = document.createElement('button');
      addBtn.type = 'button';
      addBtn.className = 'bdp-exp-add';
      addBtn.textContent = 'Agregar';
      addBtn.addEventListener('click', (e) => { e.stopPropagation(); bdpArchAgregar_(it); });

      actions.appendChild(openBtn);
      actions.appendChild(addBtn);
      rowEl.appendChild(actions);
    }
    listEl.appendChild(rowEl);
  });
}

async function bdpArchAgregar_(it) {
  if (__bdpArchMode === 'defer') {
    __bdpFormArchivoSel = it.url;
    playSoundOnce(SOUNDS.success);
    bdpCerrarVisor_();
    bdpArchMostrarArchivo_(it.url);
    bdpEscaneadoAviso_();
    return;
  }
  try {
    const ok = await Swal.fire({
      icon: 'question', title: 'Agregar archivo',
      html: 'Se asociará <b>' + escapeHtml_(it.name) + '</b> a este expediente.',
      showCancelButton: true, confirmButtonText: 'Agregar', cancelButtonText: 'Cancelar'
    });
    if (!ok.isConfirmed) return;
    const rSet = await apiPost('setexpedientearchivo', { uid: uidActual_(), id_predial: __bdpArchRow.id_predial, rowIndex: __bdpArchRow.rowIndex, url: it.url });
    __bdpArchRow.archivo_expediente = it.url;    // refresca en memoria
    playSoundOnce(SOUNDS.success);
    await Swal.fire({ icon: 'success', title: 'Archivo agregado', timer: 1200, showConfirmButton: false });
    bdpCerrarVisor_();
    bdpArchMostrarArchivo_(it.url);
    bdpEscaneadoAviso_();
    bdpAplicarFila_(rSet && rSet.fila);          // la fila vino en la misma respuesta
  } catch (e) {
    Swal.fire({ icon: 'error', title: 'Error', text: String(e.message || e) });
  }
}

/* Reemplazar → explorador */
document.getElementById('btn-bdp-arch-reemplazar')?.addEventListener('click', () => {
  playSoundOnce(SOUNDS.menu);
  bdpArchMostrarExplorador_();
});

/* Eliminar → quita la referencia AL (no borra el archivo de Drive) */
document.getElementById('btn-bdp-arch-eliminar')?.addEventListener('click', async () => {
  if (__bdpArchMode === 'defer') {
    playSoundOnce(SOUNDS.back);
    __bdpFormArchivoSel = '';
    bdpEscaneadoAviso_();
    bdpArchMostrarExplorador_();
    return;
  }
  const ok = await Swal.fire({
    icon: 'warning', title: '¿Quitar archivo?',
    html: 'Se quitará la referencia del archivo en este expediente.<br>(No se elimina el archivo de Drive)',
    showCancelButton: true, confirmButtonText: 'Quitar', cancelButtonText: 'Cancelar', confirmButtonColor: '#dc2626'
  });
  if (!ok.isConfirmed) return;
  try {
    const rQui = await apiPost('eliminarexpedientearchivo', { uid: uidActual_(), id_predial: __bdpArchRow.id_predial, rowIndex: __bdpArchRow.rowIndex });
    __bdpArchRow.archivo_expediente = '';
    playSoundOnce(SOUNDS.success);
    await Swal.fire({ icon: 'success', title: 'Archivo quitado', timer: 1200, showConfirmButton: false });
    bdpEscaneadoAviso_();
    bdpArchMostrarExplorador_();
    bdpAplicarFila_(rQui && rQui.fila);
  } catch (e) {
    Swal.fire({ icon: 'error', title: 'Error', text: String(e.message || e) });
  }
});

/* Salir (ambos estados) */
function bdpArchCerrar_() {
  document.getElementById('modal-bdp-archivo').classList.add('hidden');
  document.getElementById('bdp-arch-iframe').src = '';
  __bdpArchStack = [];
}
document.getElementById('btn-bdp-arch-salir1')?.addEventListener('click', () => { playSoundOnce(SOUNDS.back); bdpArchCerrar_(); });
document.getElementById('btn-bdp-arch-salir2')?.addEventListener('click', () => { playSoundOnce(SOUNDS.back); bdpArchCerrar_(); });

/* Atrás (explorador) */
document.getElementById('btn-bdp-arch-atras')?.addEventListener('click', () => {
  if (!__bdpArchStack.length) return;
  playSoundOnce(SOUNDS.back);
  const prev = __bdpArchStack.pop();
  bdpArchCargar_(prev === __bdpArchRootId ? '' : prev);
});

/* Filtro (explorador) */
document.getElementById('bdp-arch-filtro')?.addEventListener('input', (e) => bdpArchRender_(e.target.value));
document.getElementById('bdp-arch-filtro-clear')?.addEventListener('click', () => {
  const el = document.getElementById('bdp-arch-filtro');
  if (el) { el.value = ''; el.focus(); }
  bdpArchRender_('');
});

/* Filtro en tiempo real */
document.getElementById('bdp-exp-filtro')?.addEventListener('input', (e) => {
  bdpExpRender_(e.target.value);
});
document.getElementById('bdp-exp-filtro-clear')?.addEventListener('click', () => {
  const el = document.getElementById('bdp-exp-filtro');
  if (el) { el.value = ''; el.focus(); }
  bdpExpRender_('');
});

/* Copiar texto al portapapeles (con respaldo para contextos no seguros) */
async function bdpCopiarPortapapeles_(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (_) {}
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch (_) {
    return false;
  }
}

/* ── Placeholders Fase 3 / 4 ───────────────────────────── */
document.getElementById('btn-bdp-agregar')?.addEventListener('click', () => {
  playSoundOnce(SOUNDS.back);
  Swal.fire({ icon:'info', title:'Agregar Expediente', text:'Disponible en Fase 3.', timer:1400, showConfirmButton:false });
});

document.getElementById('btn-bdp-panel')?.addEventListener('click', () => {
  playSoundOnce(SOUNDS.back);
  Swal.fire({ icon:'info', title:'Panel', text:'Disponible en Fase 4.', timer:1400, showConfirmButton:false });
});

/* ============================================================
   BD PREDIAL — Fase 3: AGREGAR / EDITAR / VER / DECISIÓN / REBOTAR / CHAT
   ============================================================ */

/* ── Estado ───────────────────────────────────────────── */
let __bdpFormMode    = 'add';   // 'add' | 'edit'
let __bdpFormRow     = null;
let __bdpDetRow      = null;
let __bdpAnioTarget  = '';
let __bdpFechaTarget = '';
let __bdpDecRow      = null;
let __bdpRebRow      = null;

/* ── Helpers visuales ─────────────────────────────────── */
function bdpFormatPesosInput_(value) {
  const n = Number(String(value).replace(/\D/g, '')) || 0;
  return n === 0 ? '' : '$ ' + n.toLocaleString('es-CO');
}
function bdpDigitsOnly_(value) {
  return String(value || '').replace(/\D/g, '');
}

/* ── Sanitizadores numéricos ──────────────────────────── */
function bdpSetupNumericInputs_() {
  /* NIT */
  const nit = document.getElementById('bdp-nit');
  if (nit && !nit.dataset.binded) {
    nit.dataset.binded = '1';
    nit.addEventListener('input', () => {
      nit.value = bdpDigitsOnly_(nit.value).slice(0, 10);
    });
  }
  /* Matrícula */
  const mat = document.getElementById('bdp-matricula');
  if (mat && !mat.dataset.binded) {
    mat.dataset.binded = '1';
    mat.addEventListener('input', () => {
      mat.value = bdpDigitsOnly_(mat.value);
    });
  }
  /* Ficha */
  const ficha = document.getElementById('bdp-ficha');
  if (ficha && !ficha.dataset.binded) {
    ficha.dataset.binded = '1';
    ficha.addEventListener('input', () => {
      ficha.value = bdpDigitsOnly_(ficha.value).slice(0, 15);
    });
  }
  /* Valor Deuda con formato pesos */
  const valor = document.getElementById('bdp-valor-deuda');
  if (valor && !valor.dataset.binded) {
    valor.dataset.binded = '1';
    valor.addEventListener('input', () => {
      valor.value = bdpFormatPesosInput_(valor.value);
      bdpUpdateClasifPreview_();
    });
  }
  /* Exp número */
  const expNum = document.getElementById('bdp-exp-numero');
  if (expNum && !expNum.dataset.binded) {
    expNum.dataset.binded = '1';
    expNum.addEventListener('input', () => {
      expNum.value = bdpDigitsOnly_(expNum.value).slice(0, 4);
    });
  }
}

/* ── Llenar A-Z en select letra ───────────────────────── */
function bdpPopulateLetras_() {
  const sel = document.getElementById('bdp-exp-letra');
  if (!sel || sel.childElementCount > 1) return;
  for (let i = 65; i <= 90; i++) {
    const o = document.createElement('option');
    o.value = String.fromCharCode(i);
    o.textContent = o.value;
    sel.appendChild(o);
  }
}

/* ── Teléfonos del expediente ───────────────────────────
   FASE 5 — aquí vivía una 6ª tabla de parejas escrita a mano.
   El asistente ahora se elige aparte y cada teléfono sale de
   USUARIOS. Si no hay asistente, el expediente queda sin apoyo,
   que es un caso válido. */
function bdpAutoFillAsistente_(sustanciador) {
  const asist = document.getElementById('bdp-asistente');
  const cs = document.getElementById('bdp-contacto-sust');
  const ca = document.getElementById('bdp-contacto-asist');
  if (cs) cs.value = alcContactoDe_(sustanciador);
  if (ca) ca.value = (asist && asist.value) ? alcContactoDe_(asist.value) : '';
}

/* ── Vista previa de CLASIFICACION en el form ─────────── */
function bdpUpdateClasifPreview_() {
  const v = Number(bdpDigitsOnly_(document.getElementById('bdp-valor-deuda')?.value || '')) || 0;
  const out = document.getElementById('bdp-clasif-preview');
  if (!out) return;
  let label = '', color = '';
   if (v <= 0)                   { label = ''; color = ''; }
  else if (v >= 10527174)       { label = 'ALTA';  color = '#dc2626'; }
  else if (v < 2671074)         { label = 'BAJA';  color = '#16a34a'; }
  else                         { label = 'MEDIA'; color = '#f97316'; }
  out.innerHTML = label
    ? `Clasificación automática: <b style="color:${color};">${label}</b>`
    : '';
}

/* ── Picker AÑO (DEBE DESDE) ──────────────────────────── */
function abrirBDPAnio_() {
  __bdpAnioTarget = 'debe-desde';
  const sel = document.getElementById('bdp-anio-select');
  if (sel && !sel.childElementCount) {
    const anioActual = new Date().getFullYear();
    for (let y = anioActual; y >= 1975; y--) {
      const o = document.createElement('option');
      o.value = String(y);
      o.textContent = String(y);
      sel.appendChild(o);
    }
  }
  document.getElementById('bdp-anio-modal').classList.add('open');
  document.getElementById('bdp-anio-modal').setAttribute('aria-hidden', 'false');
}
function cancelarBDPAnio() {
  document.getElementById('bdp-anio-modal').classList.remove('open');
  document.getElementById('bdp-anio-modal').setAttribute('aria-hidden', 'true');
}
function confirmarBDPAnio() {
  const sel = document.getElementById('bdp-anio-select');
  const y = sel?.value || '';
  if (!y) { cancelarBDPAnio(); return; }
  document.getElementById('bdp-debe-desde').value     = bdpFormatDebeDesde_(y + '01');
  document.getElementById('bdp-debe-desde-raw').value = y + '01';
  cancelarBDPAnio();
}

/* ── Picker FECHA (dd/mm/2026) ────────────────────────── */
function abrirBDPFecha_(target) {
  __bdpFechaTarget = target;
  const dSel = document.getElementById('bdp-pick-dia');
  const mSel = document.getElementById('bdp-pick-mes');
  if (dSel && !dSel.childElementCount) {
    for (let d = 1; d <= 31; d++) {
      const o = document.createElement('option');
      o.value = String(d).padStart(2,'0');
      o.textContent = o.value;
      dSel.appendChild(o);
    }
  }
if (mSel && !mSel.childElementCount) {
    const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                   'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    meses.forEach((nm, i) => {
      const o = document.createElement('option');
      o.value = String(i + 1).padStart(2,'0');
      o.textContent = nm;
      mSel.appendChild(o);
    });
  }
  const ySel = document.getElementById('bdp-pick-anio');
  if (ySel && !ySel.childElementCount) {
    const anioActual = new Date().getFullYear();
    for (let y = anioActual; y >= 2010; y--) {
      const o = document.createElement('option');
      o.value = String(y);
      o.textContent = String(y);
      ySel.appendChild(o);
    }
  }
  document.getElementById('bdp-fecha-modal').classList.add('open');
  document.getElementById('bdp-fecha-modal').setAttribute('aria-hidden', 'false');
}
function cancelarBDPFecha() {
  document.getElementById('bdp-fecha-modal').classList.remove('open');
  document.getElementById('bdp-fecha-modal').setAttribute('aria-hidden', 'true');
}
function confirmarBDPFecha() {
 const d = document.getElementById('bdp-pick-dia')?.value || '01';
  const m = document.getElementById('bdp-pick-mes')?.value || '01';
  const y = document.getElementById('bdp-pick-anio')?.value || String(new Date().getFullYear());
  const val = `${d}/${m}/${y}`;
  const map = {
    'fecha-oficio-persuas': 'bdp-fecha-oficio-persuas',
    'fecha-entrega':        'bdp-fecha-entrega',
    'fecha-resolucion':     'bdp-fecha-resolucion',
    'fecha-oficio':         'bdp-fecha-oficio'
  };
  const inputId = map[__bdpFechaTarget];
  if (inputId) {
    const el = document.getElementById(inputId);
    if (el) el.value = val;
  }
  cancelarBDPFecha();
}

/* ── Abrir AGREGAR ────────────────────────────────────── */
function abrirBDPAgregar_() {
  if (!canAgregarPredial_()) {
    Swal.fire({ icon:'warning', title:'Sin permiso' });
    return;
  }
__bdpFormMode = 'add';
  __bdpFormRow  = null;
  window.__bdpBitacoraOriginal = '';
  document.getElementById('bdp-form-title').textContent = 'AGREGAR EXPEDIENTE';
  document.getElementById('bdp-form-badge').innerHTML = '';

  /* Limpiar campos */
  [
    'bdp-nombres','bdp-nit','bdp-correo','bdp-direccion','bdp-matricula',
    'bdp-ficha','bdp-debe-desde','bdp-debe-desde-raw','bdp-valor-deuda',
    'bdp-exp-numero','bdp-bitacora','bdp-oficio-persuas',
    'bdp-fecha-oficio-persuas','bdp-fecha-entrega','bdp-resol-liquidac',
    'bdp-fecha-resolucion','bdp-oficio-citacion','bdp-fecha-oficio',
    'bdp-ejecutoria','bdp-f-mp','bdp-asistente'
  ].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });

  document.getElementById('bdp-escaneado').value      = 'NO';
  document.getElementById('bdp-actuacion').value      = 'NINGUNA';
  document.getElementById('bdp-estado-proceso').value = 'NINGUNO';
 /* Desbloquear Valor Deuda al AGREGAR (puede haber quedado readonly por un AL DÍA previo) */
  const __valorNuevo = document.getElementById('bdp-valor-deuda');
  if (__valorNuevo) {
    __valorNuevo.readOnly = false;
    __valorNuevo.style.background = '';
    __valorNuevo.style.cursor = '';
  }
  ['notif-citacion','notif-electr','notif-personal','notif-aviso','publicacion-web','mandam-pago']
    .forEach(k => { const el = document.getElementById('bdp-'+k); if (el) el.value = 'NO'; });
  document.getElementById('bdp-sustanciador').value = 'NINGUNO';
  document.getElementById('bdp-exp-letra').value    = '';

  /* Deuda hasta automática */
  const anio = new Date().getFullYear();
  document.getElementById('bdp-deuda-hasta').value = bdpFormatDebeDesde_(String(anio) + '01');

  /* Asignador = usuario actual */
  document.getElementById('bdp-asignador').value = currentUser?.nombre || '';

  document.getElementById('bdp-clasif-preview').innerHTML = '';

  /* Mostrar todos los campos super */
  document.getElementById('bdp-super-fields').style.display = '';
  document.getElementById('bdp-extra-fields').style.display = '';

bdpPopulateLetras_();
  bdpSetupNumericInputs_();
 bdpBloquearCamposEstructurales_(false);

  bdpSetSeguimiento_('bdp-form-seg-fecha','bdp-form-seg-check','bdp-form-seg-aviso','','');
  __bdpFormArchivoSel = '';

  showView('view-bdp-form');
}

/* ── Bloquea (sustanciador/asistente) o libera (super/editor total) los
      5 campos estructurales: Dirección, Matrícula, Ficha, No. Exp. Físico y Sustanciador ── */
function bdpBloquearCamposEstructurales_(bloquear) {
  ['bdp-direccion','bdp-matricula','bdp-ficha','bdp-exp-numero'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.readOnly = bloquear;
    el.style.background = bloquear ? 'rgba(6,64,43,.04)' : '';
    el.style.cursor     = bloquear ? 'not-allowed' : '';
  });
  ['bdp-exp-letra','bdp-sustanciador'].forEach(id => {   // selects → disabled
    const el = document.getElementById(id);
    if (!el) return;
    el.disabled = bloquear;
    el.style.background = bloquear ? 'rgba(6,64,43,.04)' : '';
    el.style.cursor     = bloquear ? 'not-allowed' : '';
  });
}

/* ── Abrir EDITAR ─────────────────────────────────────── */
function abrirBDPEditar_(row) {
  if (!canEditarEstePredial_(row)) {
    Swal.fire({ icon:'warning', title:'Sin permiso' });
    return;
  }
  __bdpFormMode = 'edit';
  __bdpFormRow  = row;
  window.__bdpBitacoraOriginal = row.bitacora || '';

  document.getElementById('bdp-form-title').textContent = 'EDITAR EXPEDIENTE';
  document.getElementById('bdp-form-badge').innerHTML =
    `<div class="edit-badge">${escapeHtml_(row.id_predial)} — ${escapeHtml_(row.no_exp_fisico || '')}</div>`;

  bdpPopulateLetras_();
  bdpSetupNumericInputs_();

  /* Cargar valores */
  document.getElementById('bdp-nombres').value   = row.nombres || '';
  document.getElementById('bdp-nit').value       = row.nit_cedula || '';
  document.getElementById('bdp-correo').value    = row.correo_electronico || '';
  document.getElementById('bdp-direccion').value = row.direccion_predio || '';

  const matRaw = String(row.matricula || '').replace(/^357-/, '');
  document.getElementById('bdp-matricula').value = matRaw;

  const fichaRaw = bdpCleanFicha_(row.ficha_catastral);
  document.getElementById('bdp-ficha').value = fichaRaw;

  document.getElementById('bdp-escaneado').value = row.escaneado || 'NO';

  document.getElementById('bdp-debe-desde').value     = bdpFormatDebeDesde_(row.debe_desde || '');
  document.getElementById('bdp-debe-desde-raw').value = row.debe_desde || '';
  document.getElementById('bdp-deuda-hasta').value    = bdpFormatDebeDesde_(row.deuda_hasta || '');

  document.getElementById('bdp-valor-deuda').value = bdpFormatPesosInput_(row.valor_deuda || 0);
  bdpUpdateClasifPreview_();

  /* Separar letra y número del exp físico */
 const exp = String(row.no_exp_fisico || '').toUpperCase();
  const mExp = exp.match(/^([A-Z])-?(\d{4})$/);
  document.getElementById('bdp-exp-letra').value  = mExp ? mExp[1] : '';
  document.getElementById('bdp-exp-numero').value = mExp ? mExp[2] : '';

  document.getElementById('bdp-sustanciador').value = row.sustanciador || '';
  document.getElementById('bdp-asistente').value    = row.asistente || '';
  document.getElementById('bdp-contacto-sust').value  = row.contacto_sustanciador || '';
  document.getElementById('bdp-contacto-asist').value = row.contacto_asistente || '';
  document.getElementById('bdp-asignador').value         = row.asignador || '';
  document.getElementById('bdp-contacto-asignador').value= row.contacto_asignador || '';

  document.getElementById('bdp-bitacora').value       = row.bitacora || '';
  document.getElementById('bdp-actuacion').value      = row.actuacion || 'NINGUNA';
 document.getElementById('bdp-estado-proceso').value = row.estado_proceso || 'NINGUNO';

  document.getElementById('bdp-oficio-persuas').value       = row.oficio_persuas || '';
  document.getElementById('bdp-fecha-oficio-persuas').value = row.fecha_oficio_persuas || '';
  document.getElementById('bdp-fecha-entrega').value        = row.fecha_entrega || '';
  document.getElementById('bdp-resol-liquidac').value       = row.resol_liquidac || '';
  document.getElementById('bdp-fecha-resolucion').value     = row.fecha_resolucion || '';
  document.getElementById('bdp-oficio-citacion').value      = row.oficio_citacion || '';
  document.getElementById('bdp-fecha-oficio').value         = row.fecha_oficio || '';
  document.getElementById('bdp-notif-citacion').value       = row.notif_citacion || 'NO';
  document.getElementById('bdp-notif-electr').value         = row.notif_electr   || 'NO';
  document.getElementById('bdp-notif-personal').value       = row.notif_personal || 'NO';
  document.getElementById('bdp-notif-aviso').value          = row.notif_aviso    || 'NO';
  document.getElementById('bdp-publicacion-web').value      = row.publicacion_web|| 'NO';
  document.getElementById('bdp-ejecutoria').value           = row.ejecutoria || '';
  document.getElementById('bdp-mandam-pago').value          = row.mandam_pago || 'NO';
  document.getElementById('bdp-f-mp').value                 = row.f_mp || '';

  /* Permisos: solo super edita todo. Usuario normal solo bitácora+actuación
     (en este momento solo super puede llegar aquí, pero dejamos el control listo) */
const esSuper = canEditarTodoPredial_();
  const esSustanciario = !esSuper && esSustanciadorOAsistenteDePredial_(row);
  // Editor total Y sustanciador/asistente ven todos los campos
  const verCamposExtendidos = esSuper || esSustanciario;
  document.getElementById('bdp-super-fields').style.display = verCamposExtendidos ? '' : 'none';
  document.getElementById('bdp-extra-fields').style.display = verCamposExtendidos ? '' : 'none';
  // El sustanciador/asistente NO puede tocar los 5 campos estructurales
  bdpBloquearCamposEstructurales_(esSustanciario);

/* Si el expediente ya está en estado AL DIA, bloquear Valor Deuda visualmente */
  if (normalizeText_(row.estado_proceso || '') === 'AL DIA') {
    const valorEl = document.getElementById('bdp-valor-deuda');
    if (valorEl) {
      valorEl.value = '';
      valorEl.readOnly = true;
      valorEl.style.background = 'rgba(6,64,43,.04)';
      valorEl.style.cursor = 'not-allowed';
    }
  } else {
    /* Si NO está AL DÍA, asegurar que el campo quede editable
       (pudo haber quedado readonly por un AL DÍA abierto antes) */
    const valorEl = document.getElementById('bdp-valor-deuda');
    if (valorEl) {
      valorEl.readOnly = false;
      valorEl.style.background = '';
      valorEl.style.cursor = '';
    }
  }

 bdpSetSeguimiento_('bdp-form-seg-fecha','bdp-form-seg-check','bdp-form-seg-aviso', row.fecha_seguimiento, row.recordatorio);

  showView('view-bdp-form');
}

/* ── Cambio de sustanciador autocompleta asistente ────── */
document.getElementById('bdp-sustanciador')?.addEventListener('change', () => {
  bdpAutoFillAsistente_(document.getElementById('bdp-sustanciador').value);
});

 /* ── Estado "AL DIA" → Valor Deuda se pone en 0 ──────────── */
document.getElementById('bdp-estado-proceso')?.addEventListener('change', () => {
  const estado = document.getElementById('bdp-estado-proceso').value || '';
  const valorEl = document.getElementById('bdp-valor-deuda');
  if (!valorEl) return;

  if (normalizeText_(estado) === 'AL DIA') {
    valorEl.value = '';            // muestra vacío (equivale a $ 0)
    valorEl.readOnly = true;
    valorEl.style.background = 'rgba(6,64,43,.04)';
    valorEl.style.cursor = 'not-allowed';
    bdpUpdateClasifPreview_();     // recalcula la clasificación a BAJA
  } else {
    valorEl.readOnly = false;
    valorEl.style.background = '';
    valorEl.style.cursor = '';
  }
});

/* ── Auto-consecutivo al cambiar letra del Exp. Físico ── */
function bdpSiguienteConsecutivo_(letra) {
  const L = String(letra || '').trim().toUpperCase();
  if (!L) return '';
  const rows = Array.isArray(__bdpListCache) ? __bdpListCache : [];

  // En modo edición, excluir el expediente actual para que no se cuente a sí mismo
  const idEditando = (__bdpFormMode === 'edit' && __bdpFormRow)
    ? String(__bdpFormRow.id_predial || '')
    : '';

  let max = 0;
  rows.forEach(r => {
    // Excluir el expediente actual en edición
    if (idEditando && String(r.id_predial || '') === idEditando) return;

    const exp = String(r.no_exp_fisico || '').trim().toUpperCase();
    // Acepta "A-0001" y "A0001"
    const m = exp.match(/^([A-Z])-?(\d{4})$/);
    if (m && m[1] === L) {
      const n = parseInt(m[2], 10);
      if (!isNaN(n) && n > max) max = n;
    }
  });
  return String(max + 1).padStart(4, '0');
}

document.getElementById('bdp-exp-letra')?.addEventListener('change', () => {
  // Aplica tanto en AGREGAR como en EDITAR
  const letra  = document.getElementById('bdp-exp-letra').value || '';
  const numEl  = document.getElementById('bdp-exp-numero');
  if (!numEl) return;
  if (!letra) { numEl.value = ''; return; }

  // En edición: si la letra elegida es la MISMA del expediente actual,
  // mantener el número original (no recalcular)
  if (__bdpFormMode === 'edit' && __bdpFormRow) {
    const expOriginal = String(__bdpFormRow.no_exp_fisico || '').toUpperCase();
    const mOrig = expOriginal.match(/^([A-Z])-?(\d{4})$/);
    if (mOrig && mOrig[1] === letra) {
      numEl.value = mOrig[2];
      return;
    }
  }

  // En agregar, o en edición cuando se cambia a otra letra:
  // calcular el siguiente consecutivo libre
  numEl.value = bdpSiguienteConsecutivo_(letra);
});

/* ── Validar duplicados Matrícula / Ficha / Exp. Físico ── */
function bdpValidarDuplicados_(payload) {
  const rows     = Array.isArray(__bdpListCache) ? __bdpListCache : [];
  const newMat   = String(payload.matricula        || '').trim();   // solo dígitos
  const newFicha = String(payload.ficha_catastral  || '').trim();   // solo dígitos
  const newExp   = String(payload.no_exp_fisico    || '').trim().toUpperCase();

  for (const r of rows) {
    const expRef = escapeHtml_(r.no_exp_fisico || r.id_predial || '');

    // 1) Matrícula (en caché viene como "357-12345")
    if (newMat) {
      const matCache = String(r.matricula || '').replace(/^357-/, '').trim();
      if (matCache && matCache === newMat) {
        return {
          campo: 'Matrícula',
          html: `La <b>Matrícula</b> <code>357-${escapeHtml_(newMat)}</code> ya está registrada en el expediente <b>${expRef}</b>.<br><br>Por favor cambia este valor.`
        };
      }
    }

    // 2) Ficha catastral (limpiamos posible apóstrofe inicial del caché)
    if (newFicha) {
      const fichaCache = bdpCleanFicha_(r.ficha_catastral || '').trim();
      if (fichaCache && fichaCache === newFicha) {
        return {
          campo: 'Ficha Catastral',
          html: `La <b>Ficha Catastral</b> <code>${escapeHtml_(newFicha)}</code> ya está registrada en el expediente <b>${expRef}</b>.<br><br>Por favor cambia este valor.`
        };
      }
    }

    // 3) No. Exp. Físico
    if (newExp) {
      const expCache = String(r.no_exp_fisico || '').trim().toUpperCase();
      if (expCache && expCache === newExp) {
        return {
          campo: 'No. Exp. Físico',
          html: `El <b>No. Exp. Físico</b> <code>${escapeHtml_(newExp)}</code> ya está registrado.<br><br>Por favor cambia este valor.`
        };
      }
    }
  }
  return null;
}

/* ── Botón GUARDAR ────────────────────────────────────── */
document.getElementById('btn-bdp-form-guardar')?.addEventListener('click', async () => {
 const esEdit = (__bdpFormMode === 'edit');
  const esSuper = canEditarTodoPredial_();
  // El sustanciador/asistente puede guardar los campos generales de SU expediente
  const puedeCamposGenerales = esSuper ||
    (esEdit && esSustanciadorOAsistenteDePredial_(__bdpFormRow));

 const _bitTextarea = (document.getElementById('bdp-bitacora')?.value || '').trim();
  const actuacion = document.getElementById('bdp-actuacion')?.value || 'NINGUNA';
  const estadoProc = document.getElementById('bdp-estado-proceso')?.value || 'PENDIENTE';

  if (!_bitTextarea) {
    Swal.fire({ icon:'warning', title:'Bitácora requerida' });
    return;
  }

  /* Bitácora: NOMBRE + FECHA en la entrada NUEVA, sin borrar las anteriores */
  const _bitOriginal = String(window.__bdpBitacoraOriginal || '').trim();
  const _nombreUser  = String(currentUser?.nombre || '').toUpperCase();
  const _hoy         = formatDDMMYYYY_(new Date());

  let bitacora;
  if (_bitTextarea === _bitOriginal) {
    bitacora = _bitOriginal;                       // sin cambios
  } else if (_bitOriginal && _bitTextarea.startsWith(_bitOriginal)) {
    const _nuevoTexto = _bitTextarea.slice(_bitOriginal.length).trim();
    bitacora = _nuevoTexto
      ? _bitOriginal + '\n' + _nombreUser + ' ' + _hoy + ': ' + _nuevoTexto
      : _bitOriginal;
  } else {
    bitacora = _nombreUser + ' ' + _hoy + ': ' + _bitTextarea;
  }

/* Seguimiento (aplica a AGREGAR y EDITAR, para cualquier editor) */
  const _segFecha = bdpISOaDDMMYYYY_(document.getElementById('bdp-form-seg-fecha')?.value || '');
  const _segCheck = !!document.getElementById('bdp-form-seg-check')?.checked;
  const _segOrigRec   = (esEdit && __bdpFormRow) ? __bdpFormRow.recordatorio     : '';
  const _segOrigFecha = (esEdit && __bdpFormRow) ? __bdpFormRow.fecha_seguimiento : '';

/* Validar campos super solo si aplican */
  let payload = {
    bitacora,
    actuacion,
    estado_proceso: estadoProc,
    fecha_seguimiento: _segFecha,
    recordatorio: bdpCalcRecordatorio_(_segOrigRec, _segOrigFecha, _segFecha, _segCheck),
    isSuper: puedeCamposGenerales ? 'true' : 'false'
  };

  /* Si el estado es AL DIA → valor_deuda siempre 0 (columna K) */
  const esAlDia = normalizeText_(estadoProc) === 'AL DIA';

 if (puedeCamposGenerales) {
    const nombres  = (document.getElementById('bdp-nombres').value || '').trim();
    const nit      = bdpDigitsOnly_(document.getElementById('bdp-nit').value || '');
    const direccion= (document.getElementById('bdp-direccion').value || '').trim();
    const valorRaw = Number(bdpDigitsOnly_(document.getElementById('bdp-valor-deuda').value || '')) || 0;
    const debeRaw  = (document.getElementById('bdp-debe-desde-raw').value || '').trim();
    bdpAutoFillAsistente_(document.getElementById('bdp-sustanciador').value || '');
    const sust     = document.getElementById('bdp-sustanciador').value || '';
    const expLet   = (document.getElementById('bdp-exp-letra').value || '').trim().toUpperCase();
    const expNum   = (document.getElementById('bdp-exp-numero').value || '').trim();

    if (!nombres) { Swal.fire({ icon:'warning', title:'Nombres requeridos' }); return; }
    if (!nit || !/^\d{1,10}$/.test(nit)) { Swal.fire({ icon:'warning', title:'NIT/Cédula inválido', text:'1 a 10 dígitos' }); return; }
    if (!direccion) { Swal.fire({ icon:'warning', title:'Dirección requerida' }); return; }
    // Si el estado es AL DIA, el valor se fuerza a 0 y NO se valida como requerido
    if (!esAlDia) {
      if (!valorRaw || valorRaw <= 0) { Swal.fire({ icon:'warning', title:'Valor Deuda requerido' }); return; }
    }
    if (!debeRaw || !/^\d{6}$/.test(debeRaw)) { Swal.fire({ icon:'warning', title:'Selecciona el año de Debe Desde' }); return; }
    if (!sust) { Swal.fire({ icon:'warning', title:'Sustanciador requerido' }); return; }
    if (!expLet || !expNum || expNum.length !== 4) {
      Swal.fire({ icon:'warning', title:'No. Exp. Físico inválido', text:'Letra + 4 dígitos (ej: A0001)' });
      return;
    }
    /* FASE 9 · ajuste 5 */
    const escaneadoSel = String(document.getElementById('bdp-escaneado').value || 'NO').toUpperCase();
    if (escaneadoSel === 'SI' && !bdpArchivoDelForm_()) {
      document.getElementById('bdp-escaneado').value = 'NO';
      Swal.fire({
        icon: 'warning',
        title: 'Falta el expediente en archivo',
        html: 'No se puede guardar con <b>¿Escaneado? = SI</b> sin archivo asociado. ' +
              'Usa el botón <b>EXPEDIENTE (ARCHIVO)</b>.'
      });
      return;
    }

    payload = {
      ...payload,
      nombres,
      nit_cedula: nit,
      correo_electronico: (document.getElementById('bdp-correo').value || '').trim(),
      direccion_predio: direccion,
      matricula: bdpDigitsOnly_(document.getElementById('bdp-matricula').value || ''),
      ficha_catastral: bdpDigitsOnly_(document.getElementById('bdp-ficha').value || ''),
      escaneado: document.getElementById('bdp-escaneado').value || 'NO',
      debe_desde: debeRaw,
      valor_deuda: esAlDia ? 0 : valorRaw,
      no_exp_fisico: expLet + '-' + expNum,
      sustanciador: sust,

      oficio_persuas:       (document.getElementById('bdp-oficio-persuas').value || '').trim(),
      fecha_oficio_persuas: (document.getElementById('bdp-fecha-oficio-persuas').value || '').trim(),
      fecha_entrega:        (document.getElementById('bdp-fecha-entrega').value || '').trim(),
      resol_liquidac:       (document.getElementById('bdp-resol-liquidac').value || '').trim(),
      fecha_resolucion:     (document.getElementById('bdp-fecha-resolucion').value || '').trim(),
      oficio_citacion:      (document.getElementById('bdp-oficio-citacion').value || '').trim(),
      fecha_oficio:         (document.getElementById('bdp-fecha-oficio').value || '').trim(),
      notif_citacion:       document.getElementById('bdp-notif-citacion').value || 'NO',
      notif_electr:         document.getElementById('bdp-notif-electr').value   || 'NO',
      notif_personal:       document.getElementById('bdp-notif-personal').value || 'NO',
      notif_aviso:          document.getElementById('bdp-notif-aviso').value    || 'NO',
      publicacion_web:      document.getElementById('bdp-publicacion-web').value|| 'NO',
      ejecutoria:           (document.getElementById('bdp-ejecutoria').value || '').trim(),
      mandam_pago:          document.getElementById('bdp-mandam-pago').value || 'NO',
      f_mp:                 (document.getElementById('bdp-f-mp').value || '').trim()
    };
  }

/* Reforzar: si el estado es AL DIA, valor_deuda siempre va en 0
     (cubre el caso del usuario no-super que solo edita estado/actuación/bitácora) */
  if (esAlDia) {
    payload.valor_deuda = 0;
  }

 /* AGREGAR */
 if (!esEdit) {
    if (!canAgregarPredial_()) { Swal.fire({ icon:'warning', title:'Sin permiso' }); return; }

    // ── Validar que no se duplique Matrícula / Ficha / Exp. Físico ──
    const dup = bdpValidarDuplicados_(payload);
    if (dup) {
      await Swal.fire({
        icon: 'info',
        title: dup.campo + ' duplicada',
        html: dup.html,
        confirmButtonText: 'Entendido'
      });
      return;
    }

    payload.asignador = currentUser?.nombre || '';
    payload.archivo_expediente = __bdpFormArchivoSel || '';
    try {
      const ok = await Swal.fire({
        icon:'question', title:'Guardar expediente',
        text: `Contribuyente: ${payload.nombres}. Se notificará por WhatsApp al sustanciador.`,
        showCancelButton:true, confirmButtonText:'Guardar', cancelButtonText:'Cancelar'
      });
      if (!ok.isConfirmed) return;
      const res = await apiPost('agregarpredial', payload);
      playSoundOnce(SOUNDS.success);
      await Swal.fire({ icon:'success', title:'Expediente creado', html:`<b>${res.id_predial}</b><br>Clasificación: ${res.clasificacion}`, timer:2200, showConfirmButton:false });
      if (res && res.fila && __bdpListCache.length) { showView('view-bd-predial'); bdpAplicarFila_(res.fila); }
      else await abrirBDPredial_();
    } catch (e) {
      Swal.fire({ icon:'error', title:'Error', text:String(e.message||e) });
    }
    return;
  }

  /* EDITAR */
  payload.id_predial = __bdpFormRow.id_predial;
  payload.rowIndex   = __bdpFormRow.rowIndex;
  try {
    const ok = await Swal.fire({
      icon:'question', title:'Guardar cambios',
      text:'Se actualizará el expediente con los datos editados.',
      showCancelButton:true, confirmButtonText:'Guardar', cancelButtonText:'Cancelar'
    });
    if (!ok.isConfirmed) return;
    const rEdP = await apiPost('editarpredial', payload);
    playSoundOnce(SOUNDS.success);
    await Swal.fire({ icon:'success', title:'Guardado', timer:1400, showConfirmButton:false });
    if (rEdP && rEdP.fila && __bdpListCache.length) { showView('view-bd-predial'); bdpAplicarFila_(rEdP.fila); }
    else await abrirBDPredial_();
  } catch (e) {
    Swal.fire({ icon:'error', title:'Error', text:String(e.message||e) });
  }
});

/* ====================================================================
   FASE 9 · ajuste 5 — ¿Escaneado? = SI solo si hay EXPEDIENTE ARCHIVO
   Al crear, el archivo elegido vive en __bdpFormArchivoSel (modo diferido);
   al editar, en la fila (__bdpFormRow.archivo_expediente), que es lo que
   actualizan Agregar / Quitar del modal EXPEDIENTE.
   ==================================================================== */
function bdpArchivoDelForm_() {
  if (__bdpFormMode === 'edit' && __bdpFormRow) {
    return String(__bdpFormRow.archivo_expediente || '').trim();
  }
  return String(__bdpFormArchivoSel || '').trim();
}

/* Devuelve el select a NO cuando se quedó en SI sin archivo. */
function bdpEscaneadoAviso_() {
  const sel = document.getElementById('bdp-escaneado');
  if (!sel) return;
  if (String(sel.value || '').toUpperCase() === 'SI' && !bdpArchivoDelForm_()) {
    sel.value = 'NO';
  }
}

function bdpCerrarVisor_() {
  try { if (window.VISOR && window.VISOR.abierto && window.VISOR.abierto()) window.VISOR.cerrar(); }
  catch (_) {}
}

document.getElementById('bdp-escaneado')?.addEventListener('change', (e) => {
  const sel = e.target;
  if (String(sel.value || '').toUpperCase() !== 'SI') return;
  if (bdpArchivoDelForm_()) return;
  sel.value = 'NO';
  Swal.fire({
    icon: 'warning',
    title: 'Falta el expediente en archivo',
    html: 'Para marcar <b>¿Escaneado? = SI</b> primero hay que asociar el archivo ' +
          'con el botón <b>EXPEDIENTE (ARCHIVO)</b>.'
  });
});

/* ── Regresar del form ────────────────────────────────── */
document.getElementById('btn-bdp-form-back')?.addEventListener('click', () => {
  playSoundOnce(SOUNDS.back);
  showView('view-bd-predial');
});

document.getElementById('btn-bdp-form-archivo')?.addEventListener('click', () => {
  playSoundOnce(SOUNDS.menu);
  abrirBDPExpedienteDesdeForm_();
});

/* ── VER DETALLES ─────────────────────────────────────── */
function abrirBDPDetalle_(row) {
  __bdpDetRow = row;

  /* HEADER */
  const header = document.getElementById('bdp-det-header');
  const clasif = (row.clasificacion || 'BAJA').toUpperCase();
  const actuacion = (row.actuacion || 'NINGUNA').toUpperCase();
  const estadoProc = (row.estado_proceso || 'PENDIENTE').toUpperCase();
  header.innerHTML = `
    <span class="bdp-clasif-badge ${clasif}" style="font-size:.82rem; padding:6px 14px;">${clasif}</span>
    <span class="bdp-actuacion act-${actuacion.replace(/\s+/g,'_')}" style="font-size:.82rem; padding:6px 14px;">${escapeHtml_(actuacion)}</span>
    <span class="bdp-estado est-${estadoProc.replace(/\s+/g,'-')}" style="font-size:.82rem; padding:6px 14px;">${escapeHtml_(estadoProc)}</span>
  `;

  /* CUERPO */
  const body = document.getElementById('bdp-det-body');
  body.innerHTML = '';

  /* Sección: Identificación */
  const ident = bdpDetSection_(ICO_('casa',18) + ' Identificación del predio', [
    ['ID Predial',          row.id_predial],
    ['No. Exp. Físico',     row.no_exp_fisico],
    ['Nombres',             row.nombres],
    ['NIT / Cédula',        row.nit_cedula],
    ['Correo electrónico',  row.correo_electronico],
    ['Dirección del predio',row.direccion_predio],
    ['Matrícula',           row.matricula],
    ['Ficha Catastral',     bdpCleanFicha_(row.ficha_catastral)],
    ['Escaneado',           row.escaneado]
  ]);
  body.appendChild(ident);

  /* Sección: Deuda */
  const deuda = bdpDetSection_(ICO_('dinero',18) + ' Información de deuda', [
    ['Debe desde',     bdpFormatDebeDesde_(row.debe_desde)],
    ['Deuda hasta',    bdpFormatDebeDesde_(row.deuda_hasta)],
    ['Valor deuda',    bdpFormatPesos_(row.valor_deuda)],
    ['Clasificación',  row.clasificacion]
  ]);
  body.appendChild(deuda);

  /* Sección: Gestión */
  const gest = bdpDetSection_(ICO_('balanza',18) + ' Gestión jurídica', [
    ['Actuación',       row.actuacion],
    ['Estado proceso',  row.estado_proceso],
    ['Sustanciador',    row.sustanciador],
    ['Asistente',       row.asistente],
    ['Asignador',       row.asignador]
  ]);
  body.appendChild(gest);

  /* Sección: Seguimiento */
  if (row.fecha_seguimiento) {
    const rec = String(row.recordatorio || '').trim().toUpperCase();
    let msg = '';
    if (rec === 'RECORDADO')      msg = 'Recordado el día ' + formatFechaLarga_(row.fecha_seguimiento);
    else if (rec === 'PROGRAMADO') msg = 'Te recordaré el día ' + formatFechaLarga_(row.fecha_seguimiento);
    const wrap = document.createElement('div');
    wrap.className = 'bdp-det-section';
    wrap.innerHTML =
      '<div class="bdp-det-section-title">' + ICO_('calendario',18) + ' Seguimiento</div>' +
      '<div class="bdp-det-grid"><div><b>Fecha de seguimiento</b>' +
      '<span class="val">' + escapeHtml_(row.fecha_seguimiento) + '</span></div></div>' +
      (msg ? '<div class="bdp-seg-aviso" style="margin-top:8px;">' + ICO_('campana',16) + ' ' + escapeHtml_(msg) + '</div>' : '');
    body.appendChild(wrap);
  }

  /* Sección: Persuasivo */
  const persuas = bdpDetSection_(ICO_('sobre',18) + ' Persuasivo', [
    ['Oficio persuasivo',       row.oficio_persuas],
    ['Fecha oficio persuasivo', row.fecha_oficio_persuas],
    ['Fecha entrega',           row.fecha_entrega]
  ]);
  if (persuas) body.appendChild(persuas);

  /* Sección: Liquidación */
  const liq = bdpDetSection_(ICO_('documento',18) + ' Liquidación y citación', [
    ['Resolución liquidación', row.resol_liquidac],
    ['Fecha resolución',       row.fecha_resolucion],
    ['Oficio citación',        row.oficio_citacion],
    ['Fecha oficio',           row.fecha_oficio]
  ]);
  if (liq) body.appendChild(liq);

  /* Sección: Notificaciones */
  const notif = bdpDetSection_(ICO_('campana',18) + ' Notificaciones', [
    ['Citación',       row.notif_citacion],
    ['Electrónica',    row.notif_electr],
    ['Personal',       row.notif_personal],
    ['Aviso',          row.notif_aviso],
    ['Publicación web',row.publicacion_web]
  ]);
  if (notif) body.appendChild(notif);

  /* Sección: Coactivo */
  const coac = bdpDetSection_(ICO_('aviso',18) + ' Coactivo', [
    ['Ejecutoria',         row.ejecutoria],
    ['Mandamiento de pago',row.mandam_pago],
    ['F-MP',               row.f_mp]
  ]);
  if (coac) body.appendChild(coac);

  /* Bitácora */
  if (row.bitacora) {
    const wrap = document.createElement('div');
    wrap.className = 'bdp-det-section';
    wrap.innerHTML = `
      <div class="bdp-det-section-title">${ICO_('libro',18)} Bitácora</div>
      <div class="bdp-det-bitacora">${escapeHtml_(row.bitacora)}</div>
    `;
    body.appendChild(wrap);
  }

  /* BOTONES de acción */
  const actions = document.getElementById('bdp-det-actions');
  actions.innerHTML = '';


  /* REBOTAR */
  const btnReb = document.createElement('button');
  btnReb.type = 'button';
  btnReb.className = 'proc-action-btn proc-btn-rebotar';
  btnReb.innerHTML = `<img src="img/devolver.webp" alt="Rebotar" /> REBOTAR`;
  btnReb.addEventListener('click', () => {
    playSoundOnce(SOUNDS.menu);
    __bdpRebRow = row;
    document.getElementById('bdp-reb-context').innerHTML =
      `<b>${escapeHtml_(row.nombres || '')}</b> — Exp. ${escapeHtml_(row.no_exp_fisico || '')}`;
    document.getElementById('bdp-reb-justif').value = '';
    document.getElementById('modal-bdp-rebotar').classList.remove('hidden');
  });
 actions.appendChild(btnReb);

  /* EXPEDIENTE (archivo) */
  const btnArch = document.createElement('button');
  btnArch.type = 'button';
  btnArch.className = 'btn-primary proc-action-btn';
  btnArch.style.width = 'auto';
  btnArch.style.background = 'linear-gradient(135deg,#b91c1c,#7f1d1d)';
  btnArch.innerHTML = '<img src="img/pdf.webp" style="width:20px;height:20px;vertical-align:middle;" alt="" /> EXPEDIENTE';
  btnArch.addEventListener('click', () => { playSoundOnce(SOUNDS.menu); abrirBDPExpediente_(row); });
  actions.appendChild(btnArch);

/* EDITAR */
  if (canEditarEstePredial_(row)) {
    const btnEd = document.createElement('button');
    btnEd.type = 'button';
    btnEd.className = 'btn-primary proc-action-btn';
    btnEd.style.width = 'auto';
    btnEd.innerHTML = `<img src="img/editar.webp"
      style="width:20px;height:20px;vertical-align:middle;" alt="Editar" /> EDITAR`;
    btnEd.addEventListener('click', () => {
      playSoundOnce(SOUNDS.menu);
      abrirBDPEditar_(row);
    });
    actions.appendChild(btnEd);
  }

  showView('view-bdp-detalle');
}

function bdpDetSection_(title, pairs) {
  /* Solo crea la sección si hay al menos un campo con valor */
  const hasData = pairs.some(([_, v]) => v != null && String(v).trim() !== '' && String(v).trim() !== '0');
  if (!hasData) return null;
  const wrap = document.createElement('div');
  wrap.className = 'bdp-det-section';
  let html = `<div class="bdp-det-section-title">${title}</div><div class="bdp-det-grid">`;
  pairs.forEach(([label, value]) => {
    if (value == null) return;
    const s = String(value).trim();
    if (!s || s === '0') return;
    html += `<div><b>${escapeHtml_(label)}</b><span class="val">${escapeHtml_(s)}</span></div>`;
  });
  html += '</div>';
  wrap.innerHTML = html;
  return wrap;
}

document.getElementById('btn-bdp-det-back')?.addEventListener('click', () => {
  playSoundOnce(SOUNDS.back);
  showView('view-bd-predial');
});

/* ── Seguimiento (fecha + recordar) — helpers compartidos ── */
function bdpISOaDDMMYYYY_(iso) {          // 2026-07-13 → 13/07/2026
  const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
}
function bdpDDMMYYYYaISO_(str) {          // 13/07/2026 → 2026-07-13
  const m = String(str || '').match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : '';
}

/* Decide qué guardar en AN respetando un 'RECORDADO' externo si la fecha no cambió */
function bdpCalcRecordatorio_(originalRec, originalFecha, segFecha, segCheck) {
  if (!segFecha || !segCheck) return '';
  const o = String(originalRec || '').trim().toUpperCase();
  return (o === 'RECORDADO' && segFecha === String(originalFecha || '').trim())
    ? 'RECORDADO' : 'PROGRAMADO';
}

/* Conecta el comportamiento (habilitar check, aviso dinámico) */
function bdpWireSeguimiento_(fechaId, checkId, avisoId, recordatorioActual) {
  const fechaEl = document.getElementById(fechaId);
  const checkEl = document.getElementById(checkId);
  const avisoEl = document.getElementById(avisoId);
  if (!fechaEl || !checkEl || !avisoEl) return;

  fechaEl.min = new Date().toISOString().slice(0, 10);   // desde hoy en adelante
  const yaRecordado = String(recordatorioActual || '').trim().toUpperCase() === 'RECORDADO';

  const refrescar = () => {
    const tieneFecha = !!fechaEl.value;
    checkEl.disabled = !tieneFecha;
    if (!tieneFecha) checkEl.checked = false;
    if (checkEl.checked && tieneFecha) {
      const larga = formatFechaLarga_(bdpISOaDDMMYYYY_(fechaEl.value));
      avisoEl.textContent = (yaRecordado ? 'Recordado el día ' : 'Te recordaré el día ') + larga;
      avisoEl.style.display = '';
    } else {
      avisoEl.style.display = 'none';
      avisoEl.textContent = '';
    }
  };
  fechaEl.onchange = refrescar;
  checkEl.onchange = refrescar;
  refrescar();
}

/* Carga valores + conecta */
function bdpSetSeguimiento_(fechaId, checkId, avisoId, fechaDDMMYYYY, recordatorio) {
  const fechaEl = document.getElementById(fechaId);
  const checkEl = document.getElementById(checkId);
  if (fechaEl) fechaEl.value = bdpDDMMYYYYaISO_(fechaDDMMYYYY);
  const rec = String(recordatorio || '').trim().toUpperCase();
  if (checkEl) checkEl.checked = (rec === 'PROGRAMADO' || rec === 'RECORDADO');
  bdpWireSeguimiento_(fechaId, checkId, avisoId, recordatorio);
}

/* ── DECISIÓN ─────────────────────────────────────────── */
function abrirBDPDecision_(row) {
  if (!canDecisionPredial_()) {
    Swal.fire({ icon:'warning', title:'Sin permiso' });
    return;
  }
  __bdpDecRow = row;
  document.getElementById('bdp-dec-context').innerHTML =
    `<b>${escapeHtml_(row.nombres || '')}</b> — Exp. ${escapeHtml_(row.no_exp_fisico || '')}<br>` +
    `Actuación actual: <b>${escapeHtml_(row.actuacion || 'NINGUNA')}</b>`;
  document.getElementById('bdp-dec-actuacion').value = row.actuacion || 'NINGUNA';
  bdpSetSeguimiento_('bdp-seg-fecha','bdp-seg-check','bdp-seg-aviso', row.fecha_seguimiento, row.recordatorio);
  document.getElementById('modal-bdp-decision').classList.remove('hidden');
}

document.getElementById('btn-bdp-dec-cancelar')?.addEventListener('click', () => {
  playSoundOnce(SOUNDS.back);
  document.getElementById('modal-bdp-decision').classList.add('hidden');
  __bdpDecRow = null;
});

document.getElementById('btn-bdp-dec-guardar')?.addEventListener('click', async () => {
 if (!__bdpDecRow) return;
  const nueva = document.getElementById('bdp-dec-actuacion').value;
  if (!nueva) { Swal.fire({ icon:'warning', title:'Selecciona una actuación' }); return; }

  const segFecha = bdpISOaDDMMYYYY_(document.getElementById('bdp-seg-fecha').value || '');
  const segCheck = document.getElementById('bdp-seg-check').checked;
  const recordatorio = bdpCalcRecordatorio_(__bdpDecRow.recordatorio, __bdpDecRow.fecha_seguimiento, segFecha, segCheck);
  try {
    const ok = await Swal.fire({
      icon:'question',
      title:'Confirmar decisión',
      html:`Nueva actuación: <b>${escapeHtml_(nueva)}</b><br>Se notificará al sustanciador.`,
      showCancelButton:true, confirmButtonText:'Confirmar', cancelButtonText:'Cancelar'
    });
    if (!ok.isConfirmed) return;

    const rDecP = await apiPost('decisionpredial', {
      uid: uidActual_(),
      rowIndex: __bdpDecRow.rowIndex,
      id_predial: __bdpDecRow.id_predial,
      actuacion: nueva,
      usuario: currentUser?.nombre || '',
      fecha_seguimiento: segFecha,
      recordatorio: recordatorio
    });

    document.getElementById('modal-bdp-decision').classList.add('hidden');
    __bdpDecRow = null;
    playSoundOnce(SOUNDS.success);
    await Swal.fire({ icon:'success', title:'Actuación actualizada', timer:1400, showConfirmButton:false });
    bdpAplicarFila_(rDecP && rDecP.fila);
  } catch (e) {
    Swal.fire({ icon:'error', title:'Error', text:String(e.message||e) });
  }
});

/* ── REBOTAR ──────────────────────────────────────────── */
document.getElementById('btn-bdp-reb-cancelar')?.addEventListener('click', () => {
  playSoundOnce(SOUNDS.back);
  document.getElementById('modal-bdp-rebotar').classList.add('hidden');
  __bdpRebRow = null;
});

document.getElementById('btn-bdp-reb-guardar')?.addEventListener('click', async () => {
  if (!__bdpRebRow) return;
  const just = (document.getElementById('bdp-reb-justif').value || '').trim();
  if (!just) {
    Swal.fire({ icon:'warning', title:'Justificación requerida' });
    return;
  }
  try {
    await apiPost('rebotarpredial', {
      id_predial: __bdpRebRow.id_predial,
      justificacion: just,
      usuario: currentUser?.nombre || ''
    });
    document.getElementById('modal-bdp-rebotar').classList.add('hidden');
    __bdpRebRow = null;
    playSoundOnce(SOUNDS.success);
    await Swal.fire({ icon:'success', title:'Objeción enviada', timer:1400, showConfirmButton:false });
  } catch (e) {
    Swal.fire({ icon:'error', title:'Error', text:String(e.message||e) });
  }
});

/* ── Reemplazar botón AGREGAR del placeholder Fase 2 ──── */
(function rebindBDPAgregar_() {
  const btn = document.getElementById('btn-bdp-agregar');
  if (!btn) return;
  const clone = btn.cloneNode(true);
  btn.parentNode.replaceChild(clone, btn);
  clone.addEventListener('click', () => {
    playSoundOnce(SOUNDS.back);
    abrirBDPAgregar_();
  });
})();

   /* ============================================================
   BD PREDIAL — Fase 4: PANEL 📊
   ============================================================ */

let __bdppTabActual = 'resumen';
let __bdppCharts    = {};
let __bdppData      = [];

/* ── Paleta consistente ──────────────────────────────── */
const BDPP_COLORS = {
  ALTA:   '#dc2626',
  MEDIA:  '#f97316',
  BAJA:   '#16a34a',
  PEND:   '#f97316',
  ALDIA:  '#16a34a',
  ACCENT: ['#1e40af','#15803d','#6d28d9','#c2410c','#0891b2','#be185d','#4338ca','#65a30d','#a16207','#7c2d12']
};

/* ── Destruir chart ──────────────────────────────────── */
function bdppDestroyChart_(key) {
  try {
    if (__bdppCharts[key]) {
      __bdppCharts[key].destroy();
      delete __bdppCharts[key];
    }
  } catch(_) {}
}
function bdppDestroyAll_() {
  Object.keys(__bdppCharts).forEach(k => bdppDestroyChart_(k));
}

/* ── Abrir panel ─────────────────────────────────────── */
async function abrirBDPPanel_() {
  if (!canVerPanelPredial_()) {
    Swal.fire({ icon:'warning', title:'Solo SUPER USUARIO' });
    return;
  }
  playSoundOnce(SOUNDS.menu);
  showView('view-bdp-panel');
  bdppShowTab_('resumen');

  try {
    /* FASE 2 — la BD Predial ya está en memoria (9.500 expedientes, ~2 MB):
       el panel trabaja con ella en vez de volver a bajarla. */
    const data = (Array.isArray(__bdpListCache) && __bdpListCache.length)
      ? __bdpListCache
      : await apiGet('listpredial', { uid: uidActual_() });
    __bdppData = Array.isArray(data) ? data : [];

    const sub = document.getElementById('bdpp-subtitle');
    if (sub) {
      const ts = new Date();
      sub.textContent = `${__bdppData.length} expedientes · Actualizado ` +
        `${String(ts.getHours()).padStart(2,'0')}:${String(ts.getMinutes()).padStart(2,'0')}`;
    }
    bdppRenderResumen_();
  } catch (e) {
    Swal.fire({ icon:'error', title:'Error al cargar datos', text:String(e.message||e) });
  }
}

/* ── Cambio de pestaña ───────────────────────────────── */
function bdppShowTab_(tab) {
  __bdppTabActual = tab;
  const tabs = ['resumen','cartera','actuaciones','equipo'];
  tabs.forEach(t => {
    const view = document.getElementById('bdpp-view-' + t);
    const btn  = document.getElementById('bdpp-tab-' + t);
    if (!view || !btn) return;
    const active = (t === tab);
    view.style.display = active ? '' : 'none';
    btn.classList.toggle('active', active);
    if (active) {
      view.classList.remove('panel-animate');
      void view.offsetWidth;
      view.classList.add('panel-animate');
    }
  });
  if (!__bdppData?.length) return;
  switch (tab) {
    case 'resumen':     bdppRenderResumen_();     break;
    case 'cartera':     bdppRenderCartera_();     break;
    case 'actuaciones': bdppRenderActuaciones_(); break;
    case 'equipo':      bdppRenderEquipo_();      break;
  }
}

function bdppGoBack_() {
  playSoundOnce(SOUNDS.back);
  bdppDestroyAll_();
  showView('view-bd-predial');
}

/* ── Helpers de cálculo ──────────────────────────────── */
function bdppFmtPesos_(n) {
  return '$ ' + (Number(n) || 0).toLocaleString('es-CO');
}
function bdppFmtPesosCorto_(n) {
  const v = Number(n) || 0;

  // 1.000 millones o más → abreviar a "MM" mostrando miles de millones (truncado a millón)
  if (v >= 1e9) {
    const millones = Math.floor(v / 1e6);     // ej: 7.384.018.200 → 7384
    const milesMM  = Math.floor(millones / 1000);
    const restoMM  = millones % 1000;
    let out = milesMM.toLocaleString('es-CO');
    if (restoMM > 0) {
      out += '.' + String(restoMM).padStart(3, '0');
    }
    return '$ ' + out + ' MM';
  }

  // 1 millón a 999 millones → "M" (millones)
  if (v >= 1e6) {
    const millones = Math.floor(v / 1e6);     // ej: 35.000.000 → 35
    const milesResto = Math.floor((v % 1e6) / 1000); // ej: 1.250.000 → 250
    let out = millones.toLocaleString('es-CO');
    if (milesResto > 0) {
      out += '.' + String(milesResto).padStart(3, '0');
    }
    return '$ ' + out + ' M';
  }

  // Menos de 1 millón → completo
  return '$ ' + v.toLocaleString('es-CO');
}
function bdppGroupCount_(rows, key) {
  const map = {};
  rows.forEach(r => {
    const v = String(r[key] || '').trim().toUpperCase() || 'SIN DATO';
    map[v] = (map[v] || 0) + 1;
  });
  return map;
}
function bdppGroupSum_(rows, key, sumKey) {
  const map = {};
  rows.forEach(r => {
    const v = String(r[key] || '').trim().toUpperCase() || 'SIN DATO';
    map[v] = (map[v] || 0) + (Number(r[sumKey]) || 0);
  });
  return map;
}

/* ══════════════════════════════════════════════════════
   TAB: RESUMEN
══════════════════════════════════════════════════════ */
function bdppRenderResumen_() {
  const rows = __bdppData;
  const total = rows.length;
  const totalDeuda = rows.reduce((a, r) => a + (Number(r.valor_deuda) || 0), 0);
  const sinEstado = rows.filter(r => normalizeText_(r.estado_proceso||'') === 'NINGUNO').length;
  const alDia = rows.filter(r => normalizeText_(r.estado_proceso||'') === 'AL DIA').length;
  const altas = rows.filter(r => normalizeText_(r.clasificacion||'') === 'ALTA').length;
  const promDeuda = total > 0 ? Math.round(totalDeuda / total) : 0;

  /* KPIs */
  const kpiWrap = document.getElementById('bdpp-kpis-resumen');
  if (kpiWrap) {
    kpiWrap.innerHTML = '';
    [
      { value: total,                  label:'Total Expedientes', sub:'registrados',          cls:'' },
      { value: bdppFmtPesosCorto_(totalDeuda), label:'Cartera Total', sub:'monto adeudado',   cls:'kpi-blue' },
      { value: bdppFmtPesosCorto_(promDeuda),  label:'Deuda Promedio', sub:'por expediente',  cls:'' },
      { value: altas,                  label:'Clasif. ALTA',      sub:'requieren prioridad',  cls:'kpi-rojo' },
      { value: sinEstado,              label:'Sin Estado',        sub:'estado del proceso',   cls:'kpi-naranja' },
      { value: alDia,                  label:'Al Día',            sub:'estado del proceso',   cls:'kpi-verde' }
    ].forEach(k => {
      const vs = String(k.value);
      const isLong = vs.length > 6;
      const el = document.createElement('div');
      el.className = 'kpi-card ' + k.cls;
      el.innerHTML = `
        <img class="kpi-icon" src="img/barras.png" alt="" />
        <div class="kpi-value" style="${isLong?'font-size:1.1rem;text-align:center;':''}">${escapeHtml_(vs)}</div>
        <div class="kpi-label">${k.label}</div>
        <div class="kpi-sub">${k.sub}</div>
      `;
      kpiWrap.appendChild(el);
    });
  }

  /* Donut clasificación */
  bdppDestroyChart_('clasif');
  const ctxC = document.getElementById('bdpp-chart-clasif');
  if (ctxC) {
    const map = bdppGroupCount_(rows, 'clasificacion');
    const labels = ['ALTA','MEDIA','BAJA'].filter(k => map[k]);
    const data   = labels.map(k => map[k]);
    const colors = labels.map(k => BDPP_COLORS[k] || '#94a3b8');

    __bdppCharts['clasif'] = new Chart(ctxC, {
      type: 'doughnut',
      plugins: [window.ChartDataLabels || {}],
      data: { labels, datasets: [{ data, backgroundColor: colors, borderWidth: 3, borderColor: '#fff', hoverOffset: 10 }] },
      options: bdppDoughnutOpts_()
    });
  }

  /* Donut estado proceso */
  bdppDestroyChart_('estado');
  const ctxE = document.getElementById('bdpp-chart-estado');
  if (ctxE) {
    const map = bdppGroupCount_(rows, 'estado_proceso');
    const labels = Object.keys(map);
    const data   = labels.map(k => map[k]);
    const colors = labels.map(k => {
      const key = normalizeText_(k);
      if (key === 'AL DIA')                          return '#16a34a';
      if (key === 'ACUERDO DE PAGO')                 return '#15803d';
      if (key === 'COBRO PERSUASIVO/LIQUIDACION')    return '#0284c7';
      if (key === 'COBRO COACTIVO')                  return '#7c3aed';
      return '#9ca3af'; // NINGUNO y otros
    });

    __bdppCharts['estado'] = new Chart(ctxE, {
      type: 'doughnut',
      plugins: [window.ChartDataLabels || {}],
      data: { labels, datasets: [{ data, backgroundColor: colors, borderWidth: 3, borderColor: '#fff', hoverOffset: 10 }] },
      options: bdppDoughnutOpts_()
    });
  }
}

/* ══════════════════════════════════════════════════════
   TAB: CARTERA
══════════════════════════════════════════════════════ */
function bdppRenderCartera_() {
  const rows = __bdppData;
  const totalDeuda = rows.reduce((a, r) => a + (Number(r.valor_deuda) || 0), 0);

  const sumPorClasif = bdppGroupSum_(rows, 'clasificacion', 'valor_deuda');
  const montoAlta  = sumPorClasif['ALTA']  || 0;
  const montoMedia = sumPorClasif['MEDIA'] || 0;
  const montoBaja  = sumPorClasif['BAJA']  || 0;
  const maxDeuda   = rows.length ? Math.max(...rows.map(r => Number(r.valor_deuda) || 0)) : 0;

  /* KPIs cartera */
  const kpiWrap = document.getElementById('bdpp-kpis-cartera');
  if (kpiWrap) {
    kpiWrap.innerHTML = '';
    [
      { value: bdppFmtPesosCorto_(totalDeuda), label:'Cartera Total',      sub:'todos los expedientes', cls:'kpi-blue' },
      { value: bdppFmtPesosCorto_(montoAlta),  label:'Cartera ALTA',       sub:'monto clasificación alta', cls:'kpi-rojo' },
      { value: bdppFmtPesosCorto_(montoMedia), label:'Cartera MEDIA',      sub:'monto clasificación media', cls:'kpi-naranja' },
      { value: bdppFmtPesosCorto_(montoBaja),  label:'Cartera BAJA',       sub:'monto clasificación baja', cls:'kpi-verde' },
      { value: bdppFmtPesosCorto_(maxDeuda),   label:'Deuda más alta',     sub:'expediente top',         cls:'' }
    ].forEach(k => {
      const vs = String(k.value);
      const el = document.createElement('div');
      el.className = 'kpi-card ' + k.cls;
      el.innerHTML = `
        <img class="kpi-icon" src="img/target.webp" alt="" />
        <div class="kpi-value" style="${vs.length>6?'font-size:1.1rem;text-align:center;':''}">${escapeHtml_(vs)}</div>
        <div class="kpi-label">${k.label}</div>
        <div class="kpi-sub">${k.sub}</div>
      `;
      kpiWrap.appendChild(el);
    });
  }

  /* Top 10 deudores */
  const topWrap = document.getElementById('bdpp-top-deudores');
  if (topWrap) {
    topWrap.innerHTML = '';
    const sorted = rows.slice()
      .sort((a, b) => (Number(b.valor_deuda)||0) - (Number(a.valor_deuda)||0))
      .slice(0, 10);

    if (!sorted.length) {
      topWrap.innerHTML = '<div class="panel-empty">Sin datos.</div>';
    } else {
      const medals = ['🥇','🥈','🥉'];
      const maxVal = Number(sorted[0].valor_deuda) || 1;
      sorted.forEach((r, idx) => {
        const v = Number(r.valor_deuda) || 0;
        const pct = Math.round((v / maxVal) * 100);
        const initials = String(r.nombres||'').split(' ').slice(0,2).map(w => w[0]||'').join('');
        const posCls = idx === 0 ? 'gold' : idx === 1 ? 'silver' : idx === 2 ? 'bronze' : '';
        const posSym = idx < 3 ? medals[idx] : (idx + 1);
        const clasif = (r.clasificacion||'').toUpperCase();
        const colorClasif = BDPP_COLORS[clasif] || '#6b7280';

        const item = document.createElement('div');
        item.className = 'ranking-item';
        item.innerHTML = `
          <div class="ranking-pos ${posCls}">${posSym}</div>
          <div class="ranking-avatar" style="background:linear-gradient(135deg,${colorClasif},${colorClasif});">${initials}</div>
          <div class="ranking-info">
            <div class="ranking-name" title="${escapeHtml_(r.nombres||'')}">${escapeHtml_(r.nombres||'')}</div>
            <div class="ranking-detail">
              <span style="color:${colorClasif};font-weight:800;">${clasif}</span> ·
              Exp: ${escapeHtml_(r.no_exp_fisico||'—')} ·
              <span style="font-weight:700;">${bdppFmtPesos_(v)}</span>
              <div style="height:4px;background:rgba(6,64,43,.08);border-radius:999px;margin-top:4px;overflow:hidden;">
                <div style="height:100%;width:${pct}%;background:${colorClasif};border-radius:999px;"></div>
              </div>
            </div>
          </div>
          <div class="ranking-count" style="font-size:.78rem;">${bdppFmtPesosCorto_(v)}</div>
        `;
        topWrap.appendChild(item);
      });
    }
  }

  /* Chart monto por clasificación */
  bdppDestroyChart_('monto-clasif');
  const ctx = document.getElementById('bdpp-chart-monto-clasif');
  if (ctx) {
    const labels = ['ALTA','MEDIA','BAJA'].filter(k => sumPorClasif[k]);
    const data   = labels.map(k => sumPorClasif[k] || 0);
    const colors = labels.map(k => BDPP_COLORS[k]);

    __bdppCharts['monto-clasif'] = new Chart(ctx, {
      type: 'bar',
      plugins: [window.ChartDataLabels || {}],
      data: {
        labels,
        datasets: [{ data, backgroundColor: colors, borderRadius: 10, borderSkipped: false }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: { label: (ctx) => ' ' + bdppFmtPesos_(ctx.parsed.y) }
          },
          datalabels: {
            color: '#fff',
            font: { weight: '900', size: 13 },
            anchor: 'center', align: 'center',
            formatter: v => v > 0 ? bdppFmtPesosCorto_(v) : '',
            textStrokeColor: 'rgba(0,0,0,.35)', textStrokeWidth: 3
          }
        },
        scales: {
          x: { ticks:{ color:'#06402B', font:{weight:'700', size:13} }, grid:{ display:false } },
          y: {
            beginAtZero: true,
            ticks: { color:'#3d5248', font:{weight:'600'}, callback: v => bdppFmtPesosCorto_(v) },
            grid:  { color:'rgba(6,64,43,.07)' }
          }
        }
      }
    });
  }
}

/* ══════════════════════════════════════════════════════
   TAB: ACTUACIONES
══════════════════════════════════════════════════════ */
function bdppRenderActuaciones_() {
  const rows = __bdppData;
  const countActuacion = bdppGroupCount_(rows, 'actuacion');
  const sumActuacion   = bdppGroupSum_(rows, 'actuacion', 'valor_deuda');

  /* Orden lógico de actuaciones */
const ORDER = ['NINGUNA','COMUNICACION PERSUASIVA','LIQUIDACION OFICIAL',
                 'MANDAMIENTO DE PAGO','EMBARGO','SENTENCIA','DESEMBARGO',
                 'INSOLVENCIA','PRESCRIPCION','REVOCATORIA DIRECTA'];

  const sinActuacion = countActuacion['NINGUNA'] || 0;
  const persuasiva   = countActuacion['COMUNICACION PERSUASIVA'] || 0;
  const liquidacion  = countActuacion['LIQUIDACION OFICIAL'] || 0;
  const embargos     = countActuacion['EMBARGO'] || 0;
  const mandam       = countActuacion['MANDAMIENTO DE PAGO'] || 0;

  /* KPIs */
  const kpiWrap = document.getElementById('bdpp-kpis-actuaciones');
  if (kpiWrap) {
    kpiWrap.innerHTML = '';
    [
      { value: rows.length,    label:'Total Expedientes',  sub:'todos',                 cls:'' },
      { value: sinActuacion,   label:'Sin Actuación',      sub:'requieren primer paso', cls:'kpi-rojo' },
      { value: persuasiva,     label:'Comunic. Persuasiva',sub:'expedientes',           cls:'kpi-naranja' },
      { value: liquidacion,    label:'Liquid. Oficial',    sub:'expedientes',           cls:'kpi-blue' },
      { value: embargos,       label:'Embargos',           sub:'medidas cautelares',    cls:'kpi-rojo' },
      { value: mandam,         label:'Mandam. de Pago',    sub:'expedientes',           cls:'kpi-blue' }
    ].forEach(k => {
      const el = document.createElement('div');
      el.className = 'kpi-card ' + k.cls;
      el.innerHTML = `
        <img class="kpi-icon" src="img/firma.webp" alt="" />
        <div class="kpi-value">${k.value}</div>
        <div class="kpi-label">${k.label}</div>
        <div class="kpi-sub">${k.sub}</div>
      `;
      kpiWrap.appendChild(el);
    });
  }

  /* Chart conteo por actuación */
  bdppDestroyChart_('actuacion');
  const ctx1 = document.getElementById('bdpp-chart-actuacion');
  if (ctx1) {
    const labels = ORDER.filter(k => countActuacion[k]);
    const data   = labels.map(k => countActuacion[k]);
    const colors = labels.map((_, i) => BDPP_COLORS.ACCENT[i % BDPP_COLORS.ACCENT.length]);

    __bdppCharts['actuacion'] = new Chart(ctx1, {
      type: 'bar',
      plugins: [window.ChartDataLabels || {}],
      data: {
        labels,
        datasets: [{ data, backgroundColor: colors, borderRadius: 8, borderSkipped: false }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: ctx => ' ' + ctx.parsed.x + ' expedientes' } },
          datalabels: {
            color: '#fff',
            font: { weight: '900', size: 12 },
            anchor: 'center', align: 'center',
            formatter: v => v > 0 ? v : '',
            textStrokeColor: 'rgba(0,0,0,.35)', textStrokeWidth: 3
          }
        },
        scales: {
          x: { beginAtZero: true, ticks:{ precision:0, color:'#3d5248', font:{weight:'600'} }, grid:{ color:'rgba(6,64,43,.07)' } },
          y: { ticks:{ color:'#06402B', font:{weight:'700', size:11} }, grid:{ display:false } }
        }
      }
    });
  }

  /* Chart monto por actuación */
  bdppDestroyChart_('monto-actuacion');
  const ctx2 = document.getElementById('bdpp-chart-monto-actuacion');
  if (ctx2) {
    const labels = ORDER.filter(k => sumActuacion[k]);
    const data   = labels.map(k => sumActuacion[k]);
    const colors = labels.map((_, i) => BDPP_COLORS.ACCENT[i % BDPP_COLORS.ACCENT.length]);

    __bdppCharts['monto-actuacion'] = new Chart(ctx2, {
      type: 'bar',
      plugins: [window.ChartDataLabels || {}],
      data: { labels, datasets: [{ data, backgroundColor: colors, borderRadius: 8, borderSkipped: false }] },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: ctx => ' ' + bdppFmtPesos_(ctx.parsed.x) } },
          datalabels: {
            color: '#fff',
            font: { weight: '900', size: 11 },
            anchor: 'center', align: 'center',
            formatter: v => v > 0 ? bdppFmtPesosCorto_(v) : '',
            textStrokeColor: 'rgba(0,0,0,.35)', textStrokeWidth: 3
          }
        },
        scales: {
          x: { beginAtZero: true, ticks:{ color:'#3d5248', font:{weight:'600'}, callback: v => bdppFmtPesosCorto_(v) }, grid:{ color:'rgba(6,64,43,.07)' } },
          y: { ticks:{ color:'#06402B', font:{weight:'700', size:11} }, grid:{ display:false } }
        }
      }
    });
  }
}

/* ══════════════════════════════════════════════════════
   TAB: EQUIPO
══════════════════════════════════════════════════════ */
function bdppRenderEquipo_() {
  const rows = __bdppData;

  /* Agrupar por sustanciador */
  const bySust = {};
  rows.forEach(r => {
    const n = String(r.sustanciador || 'SIN ASIGNAR').trim().toUpperCase();
    if (!bySust[n]) bySust[n] = { total:0, pend:0, alDia:0, alta:0, media:0, baja:0, monto:0 };
    bySust[n].total++;
    bySust[n].monto += Number(r.valor_deuda) || 0;
    const est = normalizeText_(r.estado_proceso || '');
    if (est === 'NINGUNO') bySust[n].pend++;
    if (est === 'AL DIA')  bySust[n].alDia++;
    const cla = normalizeText_(r.clasificacion || '');
    if (cla === 'ALTA')  bySust[n].alta++;
    if (cla === 'MEDIA') bySust[n].media++;
    if (cla === 'BAJA')  bySust[n].baja++;
  });

  const sorted = Object.entries(bySust).sort((a, b) => b[1].total - a[1].total);

  /* KPIs */
  const totalSust  = sorted.length;
  const promPorSust= totalSust ? Math.round(rows.length / totalSust) : 0;
  const topSust    = sorted[0]?.[0] || '—';
  const topSustCnt = sorted[0]?.[1]?.total || 0;
  const topSustMon = sorted[0]?.[1]?.monto || 0;

  const kpiWrap = document.getElementById('bdpp-kpis-equipo');
  if (kpiWrap) {
    kpiWrap.innerHTML = '';
    [
      { value: totalSust,                       label:'Sustanciadores',    sub:'con expedientes',     cls:'' },
      { value: promPorSust,                     label:'Promedio',          sub:'expedientes / sust.', cls:'kpi-blue' },
      { value: topSust.split(' ').slice(0,2).join(' '), label:'Top Sustanciador', sub:`${topSustCnt} expedientes`, cls:'kpi-verde' },
      { value: bdppFmtPesosCorto_(topSustMon),  label:'Cartera Top',       sub:'sustanciador #1',     cls:'kpi-naranja' }
    ].forEach(k => {
      const vs = String(k.value);
      const isLong = vs.length > 10;
      const el = document.createElement('div');
      el.className = 'kpi-card ' + k.cls;
      el.innerHTML = `
        <img class="kpi-icon" src="img/usuarios.webp" alt="" />
        <div class="kpi-value" style="${isLong?'font-size:.82rem;line-height:1.2;text-align:center;':''}">${escapeHtml_(vs)}</div>
        <div class="kpi-label">${k.label}</div>
        <div class="kpi-sub">${k.sub}</div>
      `;
      kpiWrap.appendChild(el);
    });
  }

  /* Ranking */
  const rankWrap = document.getElementById('bdpp-ranking-sust');
  if (rankWrap) {
    rankWrap.innerHTML = '';
    if (!sorted.length) {
      rankWrap.innerHTML = '<div class="panel-empty">Sin datos.</div>';
    } else {
      const medals = ['🥇','🥈','🥉'];
      sorted.forEach(([nombre, s], idx) => {
        const initials = nombre.split(' ').slice(0,2).map(w => w[0]||'').join('');
        const posCls = idx === 0 ? 'gold' : idx === 1 ? 'silver' : idx === 2 ? 'bronze' : '';
        const posSym = idx < 3 ? medals[idx] : (idx + 1);

        const parts = [];
        if (s.alta)  parts.push(`<span style="color:#dc2626;font-weight:800;">ALTA: ${s.alta}</span>`);
        if (s.media) parts.push(`<span style="color:#f97316;font-weight:800;">MEDIA: ${s.media}</span>`);
        if (s.baja)  parts.push(`<span style="color:#16a34a;font-weight:800;">BAJA: ${s.baja}</span>`);
       if (s.pend)  parts.push(`<span style="color:#f97316;">Sin estado: ${s.pend}</span>`);
        if (s.alDia) parts.push(`<span style="color:#16a34a;">Al día: ${s.alDia}</span>`);

        const item = document.createElement('div');
        item.className = 'ranking-item';
        item.innerHTML = `
          <div class="ranking-pos ${posCls}">${posSym}</div>
          <div class="ranking-avatar">${initials}</div>
          <div class="ranking-info">
            <div class="ranking-name">${escapeHtml_(nombre)}</div>
            <div class="ranking-detail" style="font-size:.66rem;line-height:1.45;">
              ${parts.join(' · ')}
              <div style="margin-top:2px;color:var(--primary);font-weight:800;">
                ${bdppFmtPesos_(s.monto)}
              </div>
            </div>
          </div>
          <div class="ranking-count">${s.total}</div>
        `;
        rankWrap.appendChild(item);
      });
    }
  }

  /* Chart carga por sustanciador (stack alta/media/baja) */
  bdppDestroyChart_('sust');
  const ctx1 = document.getElementById('bdpp-chart-sust');
  if (ctx1 && sorted.length) {
    const labels = sorted.map(([n]) => {
      const parts = n.split(' ');
      return parts.length >= 2 ? parts[0] + ' ' + parts[parts.length-1] : n;
    });
    const dAlta  = sorted.map(([,s]) => s.alta);
    const dMedia = sorted.map(([,s]) => s.media);
    const dBaja  = sorted.map(([,s]) => s.baja);

    __bdppCharts['sust'] = new Chart(ctx1, {
      type: 'bar',
      plugins: [window.ChartDataLabels || {}],
      data: {
        labels,
        datasets: [
          { label:'ALTA',  data:dAlta,  backgroundColor: BDPP_COLORS.ALTA,  borderRadius:6, stack:'s' },
          { label:'MEDIA', data:dMedia, backgroundColor: BDPP_COLORS.MEDIA, borderRadius:6, stack:'s' },
          { label:'BAJA',  data:dBaja,  backgroundColor: BDPP_COLORS.BAJA,  borderRadius:6, stack:'s' }
        ]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position:'bottom', labels:{ font:{weight:'700', size:11}, color:'#3d5248', boxWidth:12, padding:8 } },
          datalabels: {
            color:'#fff', anchor:'center', align:'center',
            font:{weight:'900', size:11},
            formatter: v => v > 0 ? v : '',
            textStrokeColor:'rgba(0,0,0,.35)', textStrokeWidth:3
          }
        },
        scales: {
          x: { stacked:true, beginAtZero:true, ticks:{precision:0, color:'#3d5248', font:{weight:'600'}}, grid:{color:'rgba(6,64,43,.07)'} },
          y: { stacked:true, ticks:{color:'#06402B', font:{weight:'700', size:11}}, grid:{display:false} }
        }
      }
    });
  }

  /* Chart monto por sustanciador */
  bdppDestroyChart_('monto-sust');
  const ctx2 = document.getElementById('bdpp-chart-monto-sust');
  if (ctx2 && sorted.length) {
    const labels = sorted.map(([n]) => {
      const parts = n.split(' ');
      return parts.length >= 2 ? parts[0] + ' ' + parts[parts.length-1] : n;
    });
    const montos = sorted.map(([,s]) => s.monto);
    const colors = sorted.map((_, i) => BDPP_COLORS.ACCENT[i % BDPP_COLORS.ACCENT.length]);

    __bdppCharts['monto-sust'] = new Chart(ctx2, {
      type: 'bar',
      plugins: [window.ChartDataLabels || {}],
      data: { labels, datasets: [{ data: montos, backgroundColor: colors, borderRadius: 8, borderSkipped: false }] },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: ctx => ' ' + bdppFmtPesos_(ctx.parsed.y) } },
          datalabels: {
            color:'#fff', anchor:'center', align:'center',
            font:{weight:'900', size:11},
            formatter: v => v > 0 ? bdppFmtPesosCorto_(v) : '',
            textStrokeColor:'rgba(0,0,0,.35)', textStrokeWidth:3
          }
        },
        scales: {
          x: { ticks:{color:'#06402B', font:{weight:'700', size:11}, maxRotation:30}, grid:{display:false} },
          y: { beginAtZero:true, ticks:{color:'#3d5248', font:{weight:'600'}, callback: v => bdppFmtPesosCorto_(v) }, grid:{color:'rgba(6,64,43,.07)'} }
        }
      }
    });
  }
}

/* ══════════════════════════════════════════════════════
   Opciones comunes para doughnuts
══════════════════════════════════════════════════════ */
function bdppDoughnutOpts_() {
  return {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '60%',
    plugins: {
      legend: {
        position: 'bottom',
        labels: { font:{weight:'700', size:12}, color:'#3d5248', boxWidth:14, padding:10 }
      },
      tooltip: {
        backgroundColor: 'rgba(255,255,255,.97)',
        titleColor: '#06402B', bodyColor:'#3d5248',
        borderColor: 'rgba(6,64,43,.15)', borderWidth: 1.5,
        padding: 10, cornerRadius: 10,
        callbacks: {
          label: (ctx) => {
            const total = ctx.dataset.data.reduce((a,b) => a + b, 0) || 1;
            const pct = Math.round((ctx.parsed / total) * 100);
            return ` ${ctx.label}: ${ctx.parsed} (${pct}%)`;
          }
        }
      },
      datalabels: {
        color: '#fff',
        font: { weight:'900', size:13 },
        formatter: (v, ctx) => {
          const total = ctx.dataset.data.reduce((a,b) => a + b, 0) || 1;
          const pct = Math.round(v / total * 100);
          return pct >= 5 ? pct + '%' : '';
        },
        textStrokeColor: 'rgba(0,0,0,.4)', textStrokeWidth: 3
      }
    }
  };
}

/* ── Conectar botón PANEL del header de BD Predial ───── */
(function rebindBDPPanel_() {
  const btn = document.getElementById('btn-bdp-panel');
  if (!btn) return;
  const clone = btn.cloneNode(true);
  btn.parentNode.replaceChild(clone, btn);
  clone.addEventListener('click', () => {
    playSoundOnce(SOUNDS.back);
    abrirBDPPanel_();
  });
})();


     /* ============================================================
   PAGINACIÓN — 100 tarjetas por página
   ASIGNACIONES + ATENCIONES REGISTRADAS
   (misma lógica de BASE DE DATOS PREDIAL)
   ============================================================ */

/* Helper genérico: construye el paginador */
function buildGenericPager_(totalPages, pageActual, onGoToPage) {
  const pager = document.createElement('div');
  pager.style.cssText =
    'grid-column:1/-1;display:flex;gap:6px;flex-wrap:wrap;' +
    'justify-content:center;align-items:center;margin:6px 0;';

  const mkBtn = (page, label, disabled) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'estad-pager-btn';
    b.textContent = label;
    b.disabled = disabled;
    if (!disabled) {
      b.addEventListener('click', () => {
        playSoundOnce(SOUNDS.menu);
        onGoToPage(page);
      });
    }
    return b;
  };

  pager.appendChild(mkBtn(0, '« Primera', pageActual === 0));
  pager.appendChild(mkBtn(pageActual - 1, '‹ Ant.', pageActual === 0));

  const lbl = document.createElement('span');
  lbl.style.cssText =
    'font-weight:800;color:var(--primary);font-size:.82rem;padding:0 8px;';
  lbl.textContent = 'Página ' + (pageActual + 1) + ' / ' + totalPages;
  pager.appendChild(lbl);

  pager.appendChild(mkBtn(pageActual + 1, 'Sig. ›', pageActual >= totalPages - 1));
  pager.appendChild(mkBtn(totalPages - 1, 'Última »', pageActual >= totalPages - 1));

  return pager;
}

/* ════════ AJUSTE 1 — PAGINACIÓN ASIGNACIONES ════════ */
const __PROC_PAGE_SIZE = 100;
let   __procPagedCache = [];
let   __procPage       = 0;

(function patchProcPagination_() {
  // Captura la versión ACTUAL de renderProcList_ (con chat + expediente)
  const __innerRenderProc = renderProcList_;

  function procPaintPage_() {
    const wrap = document.getElementById('proc-list');
    if (!wrap) return;

    const items      = __procPagedCache;
    const total      = items.length;
    const totalPages = Math.max(1, Math.ceil(total / __PROC_PAGE_SIZE));

    if (__procPage > totalPages - 1) __procPage = totalPages - 1;
    if (__procPage < 0)              __procPage = 0;

    const start = __procPage * __PROC_PAGE_SIZE;
    const slice = items.slice(start, start + __PROC_PAGE_SIZE);

    // Renderiza SOLO la página actual (tarjetas + listeners + chat/expediente)
    __innerRenderProc(slice);

    // El contador refleja el TOTAL, no solo la página
    const countEl = document.getElementById('proc-count');
    if (countEl) countEl.textContent = String(total);

    // Paginador arriba y abajo
    if (totalPages > 1) {
      const goTo = (p) => {
        __procPage = p;
        procPaintPage_();
        document.getElementById('proc-list')
          ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      };
      wrap.insertBefore(buildGenericPager_(totalPages, __procPage, goTo), wrap.firstChild);
      wrap.appendChild(buildGenericPager_(totalPages, __procPage, goTo));
    }
  }

  // Nuevo renderProcList_ paginado
  renderProcList_ = function(items) {
    __procPagedCache = Array.isArray(items) ? items : [];
    __procPage = 0;
    procPaintPage_();
  };
})();

/* ════════ AJUSTE 2 — PAGINACIÓN ATENCIONES REGISTRADAS ════════ */
const __ATENC_PAGE_SIZE = 100;
let   __atencPagedCache = [];
let   __atencPage       = 0;

(function patchAtencionesPagination_() {
  const __innerRenderAtenc = renderAtenciones_;

  function atencPaintPage_() {
    const wrap = document.getElementById('atenc-wrap');
    if (!wrap) return;

    const items      = __atencPagedCache;
    const total      = items.length;
    const totalPages = Math.max(1, Math.ceil(total / __ATENC_PAGE_SIZE));

    if (__atencPage > totalPages - 1) __atencPage = totalPages - 1;
    if (__atencPage < 0)              __atencPage = 0;

    const start = __atencPage * __ATENC_PAGE_SIZE;
    const slice = items.slice(start, start + __ATENC_PAGE_SIZE);

    __innerRenderAtenc(slice);

    const countEl = document.getElementById('atenc-count');
    if (countEl) countEl.textContent = String(total);

    if (totalPages > 1) {
      const goTo = (p) => {
        __atencPage = p;
        atencPaintPage_();
        document.getElementById('atenc-wrap')
          ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      };
      wrap.insertBefore(buildGenericPager_(totalPages, __atencPage, goTo), wrap.firstChild);
      wrap.appendChild(buildGenericPager_(totalPages, __atencPage, goTo));
    }
  }

  renderAtenciones_ = function(items) {
    __atencPagedCache = Array.isArray(items) ? items : [];
    __atencPage = 0;
    atencPaintPage_();
  };
})();

/* ================== AUTO-ACTUALIZACIÓN ==================
   SEC-HACIENDA-FLANDES: la hace kit/version.js con el número de
   version.js (el mismo mecanismo de las apps Flandes). El viejo
   version.json y su recarga por 'controllerchange' salieron: dos
   vigilantes a la vez recargaban la página dos veces. */
