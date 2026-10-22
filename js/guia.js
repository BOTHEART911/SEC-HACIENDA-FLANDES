/* ============================================================
   SEC-HACIENDA-FLANDES · GUÍA RÁPIDA (18/10/2026)

   UNA guía armada en el momento para quien la abre:
     · cada sección dice qué necesita (un rol, una vista del alcance o
       un permiso de Drive anexos) y solo se pintan las que la persona
       tiene. Varios roles = suma de funciones, sin repetir.
     · lo que no tiene, ni se menciona.
     · si le cambian un rol o un permiso, la próxima apertura (o la
       revalidación de la sesión) ya la arma distinta: no hay nada
       guardado.

   De dónde sale lo que sabe (sin viajes al servidor):
     · roles  → IDN.roles() (sesión)
     · vistas → window.ALC (alcance que llega con el login/revalidación)
     · Drive anexos → ALC.anexos {v, admin, dev, pin, c, pdf} (backend
       18/10). Si el backend aún no lo manda, se toma del panel ya
       cargado (DA.estado().yo) y, si tampoco, de los roles.

   El PDF sale de lo mismo, en el navegador (jsPDF), sin archivos en
   Drive: portada con nombre y roles, y solo sus funciones.
   ============================================================ */
(function () {
  'use strict';

  var K = window.KIT;
  if (!K) return;

  var CDN_PDF = 'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js';
  var MED = [];
  var ROL_TXT = {
    DEV: 'Desarrollador', ADMIN: 'Administrador', ABOGADO: 'Abogado', ASISTENTE: 'Asistente',
    ARCHIVO: 'Archivo', ATENCION: 'Atención', TRIBUTARIO: 'Tributario'
  };

  function $(id) { return document.getElementById(id); }
  function ico(n, t) { try { return K.icono(n, t || 20) || ''; } catch (e) { return ''; } }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  /* **negrita** en los textos cortos */
  function txt(s) { return esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>'); }
  function medir(que, t0) { var ms = Math.round(performance.now() - t0); MED.push({ que: que, ms: ms }); try { console.debug('[guia] ' + que + ' ' + ms + ' ms'); } catch (e) {} return ms; }

  /* ══════════════ quién abre la guía ══════════════ */
  function contexto() {
    var roles = [];
    try { roles = (window.IDN && window.IDN.roles()) || []; } catch (e) {}
    var perfil = null;
    try { perfil = window.IDN && window.IDN.perfil(); } catch (e) {}
    var A = window.ALC || {};
    var ver = A.ver || {}, puede = A.puede || {}, al = A.alcance || {};
    var tiene = function (r) { return roles.indexOf(r) !== -1; };
    var dev = tiene('DEV'), admin = dev || tiene('ADMIN');

    /* Drive anexos: lo que dice el servidor; si no lo trae, el panel en memoria; si no, los roles */
    var ax = null, origen = 'servidor';
    if (A.anexos && typeof A.anexos.v !== 'undefined') ax = A.anexos;
    if (!ax) {
      var S = null;
      try { S = window.DA && window.DA.estado(); } catch (e) {}
      if (S && S.yo) {
        var yo = S.yo, mio = null;
        (S.usuarios || []).forEach(function (u) { if (u.uid === yo.uid) mio = u; });
        ax = { v: 1, admin: !!yo.admin, dev: !!yo.dev, pin: !!yo.pin, c: !!yo.contratista, pdf: !!(mio && mio.pdf) };
        origen = 'panel';
      } else if (ver.driveAnexos) {
        ax = { v: 1, admin: admin, dev: dev, pin: admin && !dev, c: !admin, pdf: false };
        origen = 'roles';
      } else ax = { v: 0 };
    }
    var n = function (r) { return tiene(r); };
    return {
      nombre: (perfil && perfil.nombre) || (A.nombre || ''),
      roles: roles, dev: dev, admin: admin,
      abogado: n('ABOGADO'), asistente: n('ASISTENTE'), archivo: n('ARCHIVO'),
      atencion: n('ATENCION'), tributario: n('TRIBUTARIO'),
      ver: ver, puede: puede, al: al,
      ax: ax.v ? ax : { v: 0 }, axOrigen: origen
    };
  }

  /* ══════════════ las secciones ══════════════
     si(c)     → ¿le toca a esta persona?
     r         → una línea
     b(c)      → bloques: flujo (pasos numerados), tips (ícono + frase),
                 leyenda (color + texto), barra (la barra de arriba),
                 trio (las tres partes de una bitácora), carpetas (árbol) */
  var SEC = [
    {
      id: 'entrar', ic: 'pin', t: 'Entrar y tu PIN',
      si: function () { return true; },
      r: 'La primera vez, tu documento. Después, solo tu PIN.',
      b: function (c) {
        return [
          { k: 'flujo', p: [['persona', 'Documento', '1.ª vez en el equipo'], ['pin', 'PIN', '4 dígitos'], ['casa', 'Inicio', 'Tus tarjetas']] },
          { k: 'tips', p: [
            ['candado', '**5 fallos** bloquean tu usuario unos minutos.'],
            ['llave', '**Cambiar mi PIN**: tarjeta del inicio o menú de tu foto.'],
            ['salvavidas', c.admin ? '¿Alguien olvidó el PIN? Le generas uno en **Configuración**.' : '¿Olvidaste el PIN? Un administrador te genera uno nuevo.']
          ] }
        ];
      }
    },
    {
      id: 'mover', ic: 'brujula', t: 'Moverte por la app',
      si: function () { return true; },
      r: 'Todo está en la barra de arriba y en tu foto.',
      b: function () {
        return [
          { k: 'barra' },
          { k: 'tips', p: [
            ['buscar', '**Consultar** te resume lo que tienes en pantalla.'],
            ['actualizar', 'La app se actualiza sola al volver a ella.'],
            ['descargar', 'Instálala desde el menú de tu foto.']
          ] }
        ];
      }
    },
    {
      id: 'atencion', ic: 'atencion', t: 'Atención predial',
      si: function (c) { return !!(c.ver.pendientes || c.ver.agregarSolicitud); },
      r: 'Respondes al contribuyente que escribe o que llega en persona.',
      b: function (c) {
        var tips = [];
        if (c.ver.agregarSolicitud) tips.push(['mas', '**Agregar atención**: registra a quien viene en persona.']);
        if (c.ver.descargaSolicitudes) tips.push(['excel', '**Mis informes**: tus atenciones a Excel por fechas.']);
        return [
          { k: 'flujo', p: [['whatsapp', 'Llega', 'Solicitud por WhatsApp'], ['bandeja-entrada', 'Pendientes', 'Abres la solicitud'], ['recibo', 'Respondes', 'Con los recibos']] },
          { k: 'chips', t: 'Otras salidas', p: [['al-dia', 'AL DÍA'], ['no-encontrado', 'NO ENCONTRADO'], ['dar-baja', 'Dar de baja']] }
        ].concat(tips.length ? [{ k: 'tips', p: tips }] : []);
      }
    },
    {
      id: 'coordina', ic: 'tendencia', t: 'Seguimiento de la atención',
      si: function (c) { return !!(c.ver.atendidasChat || c.ver.estadisticas); },
      r: 'Lo atendido, los tiempos y el trabajo del equipo.',
      b: function (c) {
        var p = [];
        if (c.ver.atendidasChat) p.push(['libro', '**Atenciones registradas**: chat y ventanilla.']);
        if (c.ver.estadisticas) p.push(['tendencia', '**Estadísticas**: tiempos, zonas y tendencia.']);
        if (c.ver.panel) p.push(['equipo', '**Panel**: carga y avance de cada persona.']);
        return [{ k: 'tips', p: p }];
      }
    },
    {
      id: 'predial', ic: 'base-datos', t: 'Base de datos predial',
      si: function (c) { return !!c.ver.bdPredial; },
      r: function (c) {
        if (c.al.todo) return 'Todos los expedientes: los creas, los repartes y los sigues.';
        if (c.puede.editarPredialAsistente) return 'Ves y trabajas todos los expedientes repartidos.';
        if (c.al.predialSoloExpediente) return 'Los expedientes con archivo físico o con solicitud.';
        return 'Tus expedientes como sustanciador.';
      },
      b: function (c) {
        var tips = [];
        if (c.al.todo) {
          tips.push(['mas', '**Agregar**, editar todos los campos y eliminar.']);
          tips.push(['equipo', '**Asignador**: pones sustanciador y asistente.']);
        } else if (c.puede.editarPredialAsistente) {
          tips.push(['lapiz', 'Editas bitácora, actuación y estado. Nombre, NIT, deuda y número son del administrador.']);
        } else if (c.al.predialSoloExpediente) {
          tips.push(['whatsapp', 'Te llega un WhatsApp cada vez que piden un expediente.']);
        } else {
          tips.push(['devolver', '**Objetar** si no es tuyo; pones asistente si no tiene.']);
        }
        if (!c.al.predialSoloExpediente) tips.push(['archivo', '**Solicitar expediente**: Archivo te responde en la bitácora.']);
        tips.push(['copiar', 'Toca el NIT o el correo de la tarjeta para copiarlo.']);
        if (c.ver.descargaPredial) tips.push(['excel', c.al.todo ? '**Descargar** a Excel con los filtros que quieras.' : c.puede.editarPredialAsistente ? '**Descargar**: los expedientes donde escribiste bitácora.' : '**Descargar** a Excel tus filas.']);
        return [
          { k: 'flujo', p: [['filtro', 'Filtra', 'Pastillas y búsqueda'], ['expediente', 'Abre', 'La tarjeta'], ['lapiz', 'Escribe', 'Bitácora y actuación'], ['check', 'Guarda', 'Al instante']] },
          { k: 'tips', p: tips }
        ];
      }
    },
    /* 21/10 — NOTIFICACIÓN ELECTRÓNICA de la factura predial */
    {
      id: 'notificar', ic: 'sobre', t: 'Notificar la factura por correo',
      si: function (c) { return !!c.ver.bdPredial && !c.al.predialSoloExpediente; },
      r: 'Desde la tarjeta envías la factura del predial al correo del contribuyente, desde cobro coactivo y con la firma de la Secretaria.',
      b: function (c) {
        var tips = [
          ['sobre', 'Botón **Notificar** (sobre) en la tarjeta: escribe los **6 dígitos** de la factura (se guarda con el año delante) y adjunta, arrastra o pega (Ctrl+V) el **PDF**.'],
          ['buscar', '**Validar** revisa que esa factura no se haya enviado antes; si ya salió, no deja enviar.'],
          ['persona', 'Varios propietarios: en **Editar** → **Agregar otro propietario** (hasta 9). Nombre + NIT/CC = destinatario; **solo el correo** = va en copia. Sale **un solo correo con un solo PDF** para todos.'],
          ['reloj', 'Al enviar: aviso **Notificado**, CITACIÓN y ELECTRÓNICA en SI, ESTADO **COBRO PERSUASIVO/LIQUIDACION**, ACTUACIÓN **LIQUIDACION OFICIAL**, la línea en la **bitácora** con el asunto y el reloj **Plazo**: 60 días corridos desde el día siguiente (rojo y latiendo con 10 días o menos).'],
          ['aviso', 'Si un correo **rebota**, la tarjeta dice **Rebote** y la bitácora el correo a corregir: corrígelo en Editar y toca **Reenviar** en Notificar; el plazo vuelve a contar desde el reenvío. Pastilla **Rebotes** en el filtro.'],
          ['excel', '**Informe de notificaciones**: Excel, PDF o informe gerencial de lo que ves, por rango de fechas.'],
          ['balanza', 'Estado del proceso **RECONSIDERACIÓN**: detiene el reloj y lo quita.'],
          ['responder', 'Si el contribuyente responde, la tarjeta dice **Respondió** y el detalle muestra el texto y los adjuntos.'],
          ['filtro', 'Filtro **NOTIFICACIÓN** y Consultar → **Notificaciones y plazos**.']
        ];
        if (c.admin) tips.push(['engranaje', 'El asunto y el cuerpo del correo se cambian en **Configuración → Plantillas**.']);
        return [
          { k: 'flujo', p: [['documento', 'Factura', '6 dígitos + PDF'], ['buscar', 'Validar', 'Que no se repita'], ['enviar', 'Enviar', 'Desde cobro coactivo'], ['reloj', 'Plazo', '60 días']] },
          { k: 'leyenda', p: [['#6b7280', 'Más de 15 días'], ['#e39b2d', '15 días o menos'], ['#d64541', '10 días o menos (late) / vencido / rebote'], ['#b45309', 'Reconsideración']] },
          { k: 'tips', p: tips }
        ];
      }
    },
    {
      id: 'semaforo', ic: 'semaforo', t: 'Mi semáforo',
      si: function (c) { return !!c.ver.semaforo; },
      r: function (c) {
        if (c.admin) return 'Repartes las asignaciones y decides cuándo se cierran.';
        if (c.puede.soloLectura) return 'Ves todas las asignaciones y respondes desde Archivo.';
        return 'Tus asignaciones, con su plazo en días hábiles.';
      },
      b: function (c) {
        var bl = [];
        if (c.admin) {
          bl.push({ k: 'flujo', p: [['mas', 'Asignas', 'Abogado, apoyo y plazo'], ['balanza', 'Trabajan', 'Bitácora y documentos'], ['check', 'Decides', 'Finalizar o pedir evidencia']] });
          bl.push({ k: 'tips', p: [['equipo', '**Panel del equipo** y eliminar asignaciones.']] });
        } else if (c.puede.soloLectura) {
          bl.push({ k: 'tips', p: [['ojo', 'Todas las asignaciones, **solo lectura**.'], ['comentario', 'Respondes en **MENSAJE O BITÁCORA**.']] });
        } else {
          bl.push({ k: 'flujo', p: [['bandeja-entrada', 'Te llega', 'Con WhatsApp y push'], ['lapiz', 'Trabajas', 'Bitácora, etapa, documentos'], ['firma', 'Solicitas', 'Revisión, firma o finalizar']] });
          var t = [['chat', '**Chat** en vivo de cada asignación.']];
          if (c.abogado) t.unshift(['devolver', '**Rebotar** si no es de tu competencia.']);
          if (c.asistente && !c.abogado) t.unshift(['equipo', 'Ves las asignaciones donde eres **apoyo**.']);
          bl.push({ k: 'tips', p: t });
        }
        bl.push({ k: 'leyenda', p: [['#2f9c6e', 'Más de la mitad del plazo'], ['#e39b2d', 'Menos de la mitad'], ['#ef8a80', '3 días hábiles o menos'], ['#d64541', 'Vence hoy o venció'], ['#9aa5a0', 'Finalizada']] });
        return bl;
      }
    },
    {
      id: 'bitacoras', ic: 'libro', t: 'Bitácoras por responder',
      si: function (c) { return !!(c.ver.bdPredial || c.ver.semaforo) && (c.abogado || c.asistente || c.admin); },
      r: 'Cuando uno escribe, los otros dos quedan por responder.',
      b: function () {
        return [
          { k: 'trio', p: [['balanza', 'Abogado'], ['equipo', 'Asistente'], ['llave', 'Asignador o admin']] },
          { k: 'leyenda', p: [['#3b82c4', 'Hasta 1 día hábil'], ['#e39b2d', '2 a 3 días'], ['#d64541', 'Más de 3 días']] },
          { k: 'tips', p: [
            ['check', 'Se cierra con tu bitácora o con **Enterado**.'],
            ['filtro', 'Pastilla **Bitácoras por responder** y Consultar → **por revisar**.'],
            ['campana', 'Aviso push al instante y resumen a las 7 a. m.']
          ] }
        ];
      }
    },
    {
      id: 'ica', ic: 'sobre', t: 'Requerimientos de Industria y Comercio',
      si: function (c) { return c.tributario || c.admin; },
      r: 'Requieres por correo y la app lleva el plazo.',
      b: function () {
        return [
          { k: 'flujo', p: [['mas', 'Agrega', 'Uno o carga masiva'], ['enviar', 'Envía', 'PDF por correo'], ['calendario', 'Plazo', '15 días hábiles'], ['comentario', 'Responde', 'O sale el 2.º']] },
          { k: 'tips', p: [
            ['campana', '**Recordatorio** antes de vencer, en el mismo hilo.'],
            ['clip', 'Si responde, sus adjuntos quedan en el expediente.'],
            ['excel', '**Mi trabajo** a Excel y PDF; hasta 5 evidencias por contribuyente.']
          ] }
        ];
      }
    },
    {
      id: 'anexos', ic: 'clip', t: 'Drive anexos · tus evidencias',
      si: function (c) { return !!c.ax.c; },
      r: 'Subes los anexos de tu cuenta desde la app, por obligación.',
      b: function (c) {
        var tipos = c.ax.pdf ? 'Word, Excel o PDF' : 'Word o Excel';
        return [
          { k: 'flujo', p: [['mas', 'Agregar', 'Evidencia'], ['diana', 'Obligación', 'De 1 a 20'], [c.ax.pdf ? 'pdf' : 'documento', 'Archivo', tipos + ' · 10 MB'], ['lapiz', 'Nombre', 'En mayúsculas']] },
          { k: 'carpetas' },
          { k: 'tips', p: [
            ['copiar', '**Copiar** y pégalo en el campo de Evidencia. **Copiar todos**: uno por línea.'],
            ['ojo', '**Ver archivos** abre tus documentos en la app.'],
            ['lapiz', 'Cuenta abierta: **editar**, **reemplazar** o **eliminar**.'],
            ['candado', 'Cuenta aprobada = sellada. Sin contrato abierto, pídelo a un administrador.']
          ] }
        ];
      }
    },
    {
      id: 'anexos-admin', ic: 'carpeta', t: 'Drive anexos · administrar',
      si: function (c) { return !!c.ax.admin; },
      r: 'Abres contratos, apruebas cuentas y das permisos.',
      b: function (c) {
        var t = [
          ['girar', '**Reabrir** cualquier cuenta o contrato aprobado.'],
          ['pdf', '**Permitir PDF** a un contratista (todos sus contratos).'],
          ['ojo', 'Ves y abres las evidencias de todos.']
        ];
        t.push(c.ax.pin ? ['candado', 'Crear, aprobar, reabrir y PDF piden el **PIN de seguridad**.']
                        : ['llave', 'Como desarrollador no se te pide el PIN de seguridad.']);
        return [
          { k: 'flujo', p: [['persona', 'Elige', 'Al contratista'], ['carpeta', 'Crea', 'El CONTRATO'], ['subir', 'Sube', 'El contratista'], ['check', 'Aprueba', 'Cuenta o contrato']] },
          { k: 'tips', p: t }
        ];
      }
    },
    {
      id: 'gerencial', ic: 'tendencia', t: 'Informe gerencial',
      si: function () { return true; },
      r: 'Un PDF con indicadores y gráficas de un periodo.',
      b: function (c) {
        var p = [['calendario', 'Fechas', 'Desde y hasta']];
        if (c.admin) p.push(['equipo', 'Quién', 'Una persona o toda la Secretaría']);
        p.push(['pdf', 'PDF', 'Listo para descargar']);
        return [{ k: 'flujo', p: p }];
      }
    },
    /* 22/10 — SOPORTE (js/soportes.js + kit/soporte.js) */
    {
      id: 'soporte', ic: 'salvavidas', t: 'Soporte',
      si: function () { return true; },
      r: 'Cuentas lo que pasa y ves en qué va tu solicitud.',
      b: function () {
        return [
          { k: 'flujo', p: [['salvavidas', 'Soporte', 'Inicio o menú de tu foto'], ['comentario', 'Cuenta', 'Qué hacías y qué salió'], ['imagen', 'Capturas', 'Hasta 3: adjuntar, arrastrar o Ctrl+V'], ['estrella', 'Califica', 'Cuando quede resuelto']] },
          { k: 'tips', p: [
            ['reloj', '**Ver mis solicitudes**: el estado, la respuesta y quién te atendió.'],
            ['campana', 'Cuando quede **resuelto** te llega el aviso y al entrar calificas de 1 a 5 estrellas.'],
            ['recargar', 'Con **1 o 2 estrellas** el caso se vuelve a abrir con tu comentario.']
          ] }
        ];
      }
    },
    {
      id: 'soportes', ic: 'responder', t: 'Soportes · desarrollador',
      si: function (c) { return c.dev; },
      r: 'Todos los soportes: responder, estados y descargas.',
      b: function () {
        return [
          { k: 'flujo', p: [['filtro', 'Filtra', 'Estado, fechas y texto'], ['responder', 'Responde', 'En proceso o resuelto'], ['mas', 'Registra', 'Lo atendido por teléfono'], ['descargar', 'Descarga', 'PDF, Excel y gerencial']] },
          { k: 'tips', p: [
            ['whatsapp', 'Cada soporte nuevo llega al **grupo de desarrollo** de FLANDES-CORE con el encabezado **APP SEC HACIENDA**.'],
            ['campana', '**Resuelto** avisa a la persona (push y WhatsApp) y le pide calificar.'],
            ['imagen', 'Las capturas se ven con el visor de la app: no se publican por enlace.'],
            ['engranaje', 'Textos en Configuración → **Plantillas** (Soporte ·) y el grupo en **IDs y ajustes** (Soporte).']
          ] }
        ];
      }
    },
    {
      id: 'config', ic: 'engranaje', t: 'Configuración',
      si: function (c) { return c.admin; },
      r: 'Personas, roles y PIN del equipo.',
      b: function (c) {
        var t = [
          ['persona', '**Crear persona**: le llega su PIN por WhatsApp.'],
          ['equipo', '**Roles**: una persona puede tener varios.'],
          ['pin', '**PIN nuevo** a quien lo olvidó; desactivar a quien sale.']
        ];
        if (c.dev) {
          t.push(['whatsapp', '**Plantillas**: todos los mensajes que manda la app.']);
          t.push(['llave', '**IDs y ajustes**: carpetas, llaves, PIN de anexos y quién los administra.']);
        }
        return [{ k: 'tips', p: t }];
      }
    }
  ];

  /* roles + Contratista + PDF habilitado; "Sin rol" solo si no hay nada */
  function pastillas(c) {
    var p = c.roles.map(function (r) { return ROL_TXT[r] || r; });
    if (c.ax.c) p.push('Contratista');
    if (c.ax.pdf) p.push('PDF habilitado');
    return p.length ? p : ['Sin rol'];
  }

  function resumen(s, c) { return typeof s.r === 'function' ? s.r(c) : s.r; }
  function lasMias(c) { return SEC.filter(function (s) { try { return s.si(c); } catch (e) { return false; } }); }

  /* ══════════════ pintar en pantalla ══════════════ */
  function bloqueHTML(b) {
    var h = '';
    if (b.k === 'flujo') {
      h += '<ol class="gu-flujo">';
      b.p.forEach(function (p, i) {
        h += '<li class="gu-paso"><span class="gu-paso__ico">' + ico(p[0], 22) + '<i>' + (i + 1) + '</i></span>' +
             '<b>' + esc(p[1]) + '</b><small>' + esc(p[2] || '') + '</small></li>';
      });
      h += '</ol>';
    } else if (b.k === 'tips') {
      h += '<ul class="gu-tips">' + b.p.map(function (p) {
        return '<li><span class="gu-tips__ico">' + ico(p[0], 18) + '</span><span>' + txt(p[1]) + '</span></li>';
      }).join('') + '</ul>';
    } else if (b.k === 'chips') {
      h += '<div class="gu-chips">' + (b.t ? '<span class="gu-chips__t">' + esc(b.t) + '</span>' : '') +
           b.p.map(function (p) { return '<span class="gu-chip">' + ico(p[0], 15) + esc(p[1]) + '</span>'; }).join('') + '</div>';
    } else if (b.k === 'leyenda') {
      h += '<div class="gu-ley">' + b.p.map(function (p) {
        return '<span class="gu-ley__i"><i style="background:' + p[0] + '"></i>' + esc(p[1]) + '</span>';
      }).join('') + '</div>';
    } else if (b.k === 'barra') {
      h += '<div class="gu-barra" aria-hidden="true">' +
           '<span class="gu-barra__b">' + ico('atras', 18) + '</span><span class="gu-barra__t">Nombre de la vista</span>' +
           '<span class="gu-barra__b">' + ico('luna', 18) + '</span><span class="gu-barra__f">' + ico('persona', 18) + '</span></div>' +
           '<div class="gu-barra-ley"><span>' + ico('atras', 14) + ' Volver</span><span>' + ico('luna', 14) + ' Claro / oscuro</span><span>' + ico('persona', 14) + ' Guía, PIN, foto, salir</span></div>';
    } else if (b.k === 'trio') {
      h += '<div class="gu-trio" aria-hidden="true">' + b.p.map(function (p, i) {
        return '<span class="gu-trio__n gu-trio__n--' + i + '">' + ico(p[0], 20) + '<b>' + esc(p[1]) + '</b></span>';
      }).join('') + '<span class="gu-trio__c">' + ico('libro', 22) + '</span></div>';
    } else if (b.k === 'carpetas') {
      h += '<div class="gu-arbol" aria-hidden="true"><span class="gu-arbol__k">Ejemplo de cómo queda en Drive</span>' +
           '<div>' + ico('carpeta', 16) + ' CONTRATO 066</div>' +
           '<div class="gu-arbol__2 gu-arbol--sello">' + ico('candado', 14) + ' CUENTA 1 · aprobada</div>' +
           '<div class="gu-arbol__2 gu-arbol--abierta">' + ico('carpeta-abierta', 14) + ' CUENTA 2 · abierta</div>' +
           '<div class="gu-arbol__3">' + ico('hoja', 14) + ' 1.1. MATRIZ DE SEGUIMIENTO.xlsx</div>' +
           '<div class="gu-arbol__3">' + ico('documento', 14) + ' 2.1. INFORME DE ACTIVIDADES.docx</div></div>';
    }
    return h;
  }

  function pintar() {
    var caja = $('guia-cuerpo');
    if (!caja) return;
    var t0 = performance.now();
    var c = contexto();
    var mias = lasMias(c);

    var ini = (c.nombre || '?').split(/\s+/).filter(String).slice(0, 2).map(function (w) { return w.charAt(0); }).join('');
    var h = '<section class="gu-cab">' +
      '<span class="gu-cab__av">' + esc(ini) + '</span>' +
      '<div class="gu-cab__tx"><span class="gu-cab__k">Tu guía rápida</span>' +
      '<b class="gu-cab__n">' + esc(c.nombre || 'Sin sesión') + '</b>' +
      '<span class="gu-cab__roles">' + pastillas(c).map(function (r) { return '<span>' + esc(r) + '</span>'; }).join('') + '</span></div>' +
      '<button type="button" class="kit-btn gu-pdf" id="gu-pdf">' + ico('descargar', 18) + ' PDF</button>' +
      '</section>';

    if (!c.roles.length && !c.ax.c) h += '<p class="gu-nota">' + ico('info', 16) + ' Aún no tienes un rol con funciones. Pídelo a un administrador.</p>';

    /* índice: una baldosa por función */
    h += '<nav class="gu-indice" aria-label="Tus funciones">' + mias.map(function (s) {
      return '<a href="#gu-' + s.id + '" class="gu-ind" data-gu="' + s.id + '"><span>' + ico(s.ic, 20) + '</span>' + esc(s.t) + '</a>';
    }).join('') + '</nav>';

    h += '<div class="gu-secs">';
    mias.forEach(function (s, i) {
      h += '<details class="gu-sec" id="gu-' + s.id + '"' + (i === 0 ? ' open' : '') + '>' +
        '<summary><span class="gu-sec__ico">' + ico(s.ic, 22) + '</span>' +
        '<span class="gu-sec__tx"><b>' + esc(s.t) + '</b><small>' + esc(resumen(s, c)) + '</small></span>' +
        '<span class="gu-sec__fl">' + ico('abajo', 18) + '</span></summary>' +
        '<div class="gu-sec__cu">' + s.b(c).map(bloqueHTML).join('') + '</div></details>';
    });
    h += '</div>';
    h += '<footer class="kit-cred">' + (K.piezas && K.piezas.creditos ? K.piezas.creditos.html() : '') + '</footer>';
    caja.innerHTML = h;
    caja.__firma = firma(c);

    caja.querySelectorAll('.gu-ind').forEach(function (a) {
      a.addEventListener('click', function (e) {
        e.preventDefault();
        var d = $('gu-' + a.getAttribute('data-gu'));
        if (!d) return;
        d.open = true;
        try { d.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (er) { d.scrollIntoView(); }
      });
    });
    var b = $('gu-pdf');
    if (b) b.addEventListener('click', function () { descargarPDF(b); });
    medir('pintar ' + mias.length + ' secciones', t0);
    return mias.map(function (s) { return s.id; });
  }

  /* lo que define la guía de esta persona: si cambia, se vuelve a armar */
  function firma(c) { return [c.nombre, c.roles.join(','), JSON.stringify(c.ver), JSON.stringify(c.ax), c.al.todo, c.puede.soloLectura].join('|'); }

  function abrir() {
    pintar();
    calentar();
    try { if (window.playSoundOnce && window.SOUNDS) window.playSoundOnce(window.SOUNDS.menu); } catch (e) {}
    if (typeof window.showView === 'function') window.showView('view-guia');
  }

  /* si cambian los roles o el alcance con la guía abierta, se rearma sola */
  function siAbierta() {
    var v = $('view-guia'), caja = $('guia-cuerpo');
    if (!v || !caja || !v.classList.contains('active')) return;
    if (caja.__firma !== firma(contexto())) pintar();
  }
  window.addEventListener('hac:login', function () { setTimeout(siAbierta, 0); });
  document.addEventListener('visibilitychange', function () { if (!document.hidden) setTimeout(siAbierta, 1500); });

  /* ══════════════ PDF en el navegador ══════════════ */
  var cargas = {};
  function guion(url) {
    if (cargas[url]) return cargas[url];
    cargas[url] = new Promise(function (res, rej) {
      var s = document.createElement('script');
      s.src = url; s.async = true;
      s.onload = function () { res(true); };
      s.onerror = function () { delete cargas[url]; rej(new Error('No se pudo bajar el generador de PDF.')); };
      document.head.appendChild(s);
    });
    return cargas[url];
  }
  function libPDF() { return (window.jspdf && window.jspdf.jsPDF) ? Promise.resolve(true) : guion(CDN_PDF); }
  function calentar() {
    var ir = function () { libPDF().catch(function () {}); };
    if (window.requestIdleCallback) window.requestIdleCallback(ir, { timeout: 2000 }); else setTimeout(ir, 600);
  }

  /* un ícono del set a PNG (para el PDF), en el color pedido */
  var pngs = {};
  function iconoPNG(nombre, color) {
    var k = nombre + color;
    if (pngs[k]) return pngs[k];
    pngs[k] = new Promise(function (res) {
      var s = ico(nombre, 96);
      if (!s) return res('');
      s = s.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ').replace(/currentColor/g, color);
      var img = new Image();
      img.onload = function () {
        try { var cv = document.createElement('canvas'); cv.width = cv.height = 96; cv.getContext('2d').drawImage(img, 0, 0, 96, 96); res(cv.toDataURL('image/png')); }
        catch (e) { res(''); }
      };
      img.onerror = function () { res(''); };
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s);
    });
    return pngs[k];
  }
  var escudo = null;
  function escudoJPG() {
    if (escudo) return escudo;
    escudo = new Promise(function (res) {
      var img = new Image();
      img.onload = function () {
        try { var cv = document.createElement('canvas'); cv.width = cv.height = 240; var g = cv.getContext('2d');
          g.fillStyle = 'rgb(6,64,43)'; g.fillRect(0, 0, 240, 240); g.drawImage(img, 0, 0, 240, 240); res(cv.toDataURL('image/jpeg', 0.9)); }
        catch (e) { res(''); }
      };
      img.onerror = function () { res(''); };
      img.src = (window.MARCA && window.MARCA.APP_ICON) || 'img/icono-512.png';
    });
    return escudo;
  }

  /* jsPDF con Helvetica habla Latin-1: lo demás se cambia por su par */
  function l1(s) {
    return String(s == null ? '' : s).replace(/\*\*/g, '').replace(/[–—]/g, '-').replace(/[“”]/g, '"').replace(/[‘’]/g, "'")
      .replace(/→/g, '>').replace(/…/g, '...').replace(/[^\x00-\xFF]/g, '');
  }
  function hex(h) { h = h.replace('#', ''); return [parseInt(h.substr(0, 2), 16), parseInt(h.substr(2, 2), 16), parseInt(h.substr(4, 2), 16)]; }

  function descargarPDF(btn) {
    if (btn && btn.__ocupado) return;
    if (btn) { btn.__ocupado = true; btn.disabled = true; btn.classList.add('gu-ocupado'); }
    var libre = function () { if (btn) { btn.__ocupado = false; btn.disabled = false; btn.classList.remove('gu-ocupado'); } };
    var t0 = performance.now();
    var c = contexto(), mias = lasMias(c);
    var nombres = { descargar: 1, check: 1, persona: 1 };
    mias.forEach(function (s) { nombres[s.ic] = 1; s.b(c).forEach(function (b) { (b.p || []).forEach(function (p) { if (typeof p[0] === 'string' && p[0].charAt(0) !== '#') nombres[p[0]] = 1; }); }); });
    nombres.carpeta = nombres['carpeta-abierta'] = nombres.candado = nombres.hoja = nombres.documento = 1;
    var lista = Object.keys(nombres);
    Promise.all([libPDF(), escudoJPG()]
      .concat(lista.map(function (n) { return iconoPNG(n, '#0f5132'); }))
      .concat(mias.map(function (s) { return iconoPNG(s.ic, '#ffffff'); })))
      .then(function (r) {
        var I = {}, B = {};
        lista.forEach(function (n, i) { I[n] = r[2 + i]; });
        mias.forEach(function (s, i) { B[s.ic] = r[2 + lista.length + i]; });
        var doc = armarPDF(c, mias, r[1], I, B);
        var nom = 'GUIA RAPIDA - ' + l1(c.nombre || 'HACIENDA').toUpperCase() + '.pdf';
        doc.save(nom);
        medir('pdf ' + mias.length + ' secciones', t0);
        try { K.aviso && K.aviso('Tu guía en PDF quedó descargada.', 'ok', 2600); } catch (e) {}
        libre();
      })
      .catch(function (e) {
        libre();
        try { K.aviso ? K.aviso((e && e.message) || 'No se pudo armar el PDF. Revisa la conexión.', 'malo', 4000) : alert(e.message); } catch (er) {}
      });
  }

  function armarPDF(c, mias, esc_, I, B) {
    var jsPDF = window.jspdf.jsPDF;
    var doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
    var W = 210, H = 297, mx = 14, y = 0;
    var VERDE = [6, 64, 43], MARCA = [15, 81, 50], TINTA = [28, 38, 33], GRIS = [96, 110, 104], LINEA = [220, 228, 224], SUAVE = [236, 244, 240];
    var hoy = new Date();
    var fecha = ('0' + hoy.getDate()).slice(-2) + '/' + ('0' + (hoy.getMonth() + 1)).slice(-2) + '/' + hoy.getFullYear();
    var img = function (d, x, yy, w, h) { if (d) { try { doc.addImage(d, d.indexOf('image/jpeg') > 0 ? 'JPEG' : 'PNG', x, yy, w, h); } catch (e) {} } };
    var color = function (a, f) { doc[f ? 'setFillColor' : 'setTextColor'](a[0], a[1], a[2]); };

    /* ── portada ── */
    color(VERDE, 1); doc.rect(0, 0, W, 112, 'F');
    img(esc_, mx, 18, 30, 30);
    color([255, 255, 255]); doc.setFont('helvetica', 'bold'); doc.setFontSize(12);
    doc.text(l1('SEC. HACIENDA · ALCALDÍA DE FLANDES'), mx + 36, 28);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.text(l1('Guía rápida de uso · ' + fecha), mx + 36, 35);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(26); doc.text('Tu guía rápida', mx, 70);
    doc.setFontSize(15);
    doc.text(doc.splitTextToSize(l1(c.nombre || ''), W - 2 * mx), mx, 82);
    /* roles como pastillas */
    var px = mx, py = 96;
    doc.setFontSize(9.5);
    pastillas(c).forEach(function (p) {
      var w = doc.getTextWidth(l1(p)) + 8;
      if (px + w > W - mx) { px = mx; py += 9; }
      doc.setFillColor(255, 255, 255); doc.roundedRect(px, py - 5, w, 7, 3.5, 3.5, 'F');
      color(VERDE); doc.text(l1(p), px + 4, py);
      px += w + 3;
    });

    /* índice de funciones: baldosas */
    y = 128;
    color(TINTA); doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.text('Tus funciones en la app', mx, y);
    y += 6;
    var colW = (W - 2 * mx - 6) / 2;
    mias.forEach(function (s, i) {
      var cx = mx + (i % 2) * (colW + 6), cy = y + Math.floor(i / 2) * 15;
      color(SUAVE, 1); doc.roundedRect(cx, cy, colW, 12, 3, 3, 'F');
      color(MARCA, 1); doc.roundedRect(cx + 2, cy + 2, 8, 8, 2, 2, 'F');
      img(B[s.ic], cx + 3.2, cy + 3.2, 5.6, 5.6);
      color(TINTA); doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
      doc.text(l1(s.t), cx + 13, cy + 7.6, { maxWidth: colW - 15 });
    });
    y += Math.ceil(mias.length / 2) * 15 + 6;
    color(GRIS); doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
    doc.text(doc.splitTextToSize(l1('Esta guía se armó con tus roles y permisos de hoy. Si cambian, la app te muestra la nueva al abrir la Guía rápida.'), W - 2 * mx), mx, Math.min(y, H - 30));

    /* ── páginas de funciones ── */
    doc.addPage(); y = 16;
    var nueva = function (alto) { if (y + alto > H - 16) { doc.addPage(); y = 16; } };

    mias.forEach(function (s) {
      var bl = s.b(c);
      /* la sección entera en una página si cabe en una */
      var est = 23 + bl.reduce(function (a, b) {
        return a + ({ flujo: 29, chips: 11, barra: 20, trio: 28, carpetas: 36 }[b.k] ||
          (b.k === 'tips' ? b.p.length * 9.5 + 2 : b.k === 'leyenda' ? Math.ceil(b.p.length / 3) * 7 + 3 : 0));
      }, 0);
      if (est < H - 40) nueva(est); else nueva(30);
      /* cabecera de la sección */
      color(MARCA, 1); doc.roundedRect(mx, y, W - 2 * mx, 14, 3, 3, 'F');
      img(B[s.ic], mx + 3, y + 3, 8, 8);
      color([255, 255, 255]); doc.setFont('helvetica', 'bold'); doc.setFontSize(12.5); doc.text(l1(s.t), mx + 15, y + 6.4);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.text(l1(resumen(s, c)), mx + 15, y + 11.2, { maxWidth: W - 2 * mx - 18 });
      y += 19;

      bl.forEach(function (b) {
        if (b.k === 'flujo') {
          var n = b.p.length, gap = 4, w = (W - 2 * mx - gap * (n - 1)) / n;
          nueva(28);
          b.p.forEach(function (p, i) {
            var x = mx + i * (w + gap);
            color(SUAVE, 1); doc.roundedRect(x, y, w, 24, 3, 3, 'F');
            color(MARCA, 1); doc.circle(x + 6, y + 6, 3.4, 'F');
            color([255, 255, 255]); doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.text(String(i + 1), x + 6, y + 7.3, { align: 'center' });
            img(I[p[0]], x + w - 10, y + 2.5, 7, 7);
            color(TINTA); doc.setFontSize(10); doc.text(l1(p[1]), x + 3, y + 15, { maxWidth: w - 5 });
            color(GRIS); doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.text(doc.splitTextToSize(l1(p[2] || ''), w - 5).slice(0, 2), x + 3, y + 19.5);
            if (i < n - 1) { color(MARCA, 1); doc.triangle(x + w + 1, y + 10, x + w + 1, y + 14, x + w + 3, y + 12, 'F'); }
          });
          y += 29;
        } else if (b.k === 'tips') {
          b.p.forEach(function (p) {
            doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
            var lineas = doc.splitTextToSize(l1(p[1]), W - 2 * mx - 12);
            var alto = Math.max(8, lineas.length * 4.6 + 3);
            nueva(alto);
            img(I[p[0]], mx + 1, y, 5.5, 5.5);
            color(TINTA); doc.text(lineas, mx + 10, y + 4.2);
            y += alto;
          });
          y += 2;
        } else if (b.k === 'chips') {
          nueva(10);
          var x = mx;
          color(GRIS); doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.text(l1(b.t || ''), x, y + 4.6); x += doc.getTextWidth(l1(b.t || '')) + 4;
          b.p.forEach(function (p) {
            doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
            var w = doc.getTextWidth(l1(p[1])) + 13;
            color(SUAVE, 1); doc.roundedRect(x, y, w, 7, 3.5, 3.5, 'F');
            img(I[p[0]], x + 2, y + 1.2, 4.6, 4.6);
            color(MARCA); doc.text(l1(p[1]), x + 8.5, y + 4.9);
            x += w + 3;
          });
          y += 11;
        } else if (b.k === 'leyenda') {
          nueva(9 * Math.ceil(b.p.length / 3));
          var cw = (W - 2 * mx) / 3;
          b.p.forEach(function (p, i) {
            var x = mx + (i % 3) * cw, yy = y + Math.floor(i / 3) * 7;
            doc.setFillColor.apply(doc, hex(p[0])); doc.circle(x + 2.2, yy + 2.6, 2.2, 'F');
            color(TINTA); doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.text(l1(p[1]), x + 6, yy + 3.8);
          });
          y += Math.ceil(b.p.length / 3) * 7 + 3;
        } else if (b.k === 'barra') {
          nueva(20);
          color(VERDE, 1); doc.roundedRect(mx, y, W - 2 * mx, 10, 3, 3, 'F');
          color([255, 255, 255]); doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5);
          doc.text('<  Volver', mx + 4, y + 6.4); doc.text('Nombre de la vista', W / 2, y + 6.4, { align: 'center' }); doc.text('Tema  ·  Tu foto', W - mx - 4, y + 6.4, { align: 'right' });
          color(GRIS); doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
          doc.text(l1('La flecha te devuelve · luna/sol cambia claro y oscuro · tu foto abre guía, PIN, foto, instalar y salir.'), mx, y + 15);
          y += 20;
        } else if (b.k === 'trio') {
          nueva(26);
          var cx = W / 2, pts = [[cx, y + 4], [cx - 40, y + 20], [cx + 40, y + 20]];
          doc.setDrawColor(MARCA[0], MARCA[1], MARCA[2]); doc.setLineWidth(.5);
          doc.line(pts[0][0], pts[0][1], pts[1][0], pts[1][1]); doc.line(pts[0][0], pts[0][1], pts[2][0], pts[2][1]); doc.line(pts[1][0], pts[1][1], pts[2][0], pts[2][1]);
          b.p.forEach(function (p, i) {
            var q = pts[i]; doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
            var w = doc.getTextWidth(l1(p[1])) + 12;
            color(SUAVE, 1); doc.roundedRect(q[0] - w / 2, q[1] - 4, w, 8, 4, 4, 'F');
            img(I[p[0]], q[0] - w / 2 + 2, q[1] - 2.5, 5, 5);
            color(MARCA); doc.text(l1(p[1]), q[0] - w / 2 + 8.5, q[1] + 1.3);
          });
          y += 28;
        } else if (b.k === 'carpetas') {
          nueva(30);
          var filas = [[0, 'carpeta', 'CONTRATO 066'], [1, 'candado', 'CUENTA 1 · aprobada'], [1, 'carpeta-abierta', 'CUENTA 2 · abierta'],
                       [2, 'hoja', '1.1. MATRIZ DE SEGUIMIENTO.xlsx'], [2, 'documento', '2.1. INFORME DE ACTIVIDADES.docx']];
          color(GRIS); doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.text(l1('Ejemplo de cómo queda en Drive'), mx, y + 2); y += 4;
          color(SUAVE, 1); doc.roundedRect(mx, y, W - 2 * mx, filas.length * 5.4 + 4, 3, 3, 'F');
          filas.forEach(function (f, i) {
            var x = mx + 4 + f[0] * 7, yy = y + 3 + i * 5.4;
            img(I[f[1]], x, yy, 4, 4);
            color(TINTA); doc.setFont('helvetica', f[0] ? 'normal' : 'bold'); doc.setFontSize(9); doc.text(l1(f[2]), x + 6, yy + 3.3);
          });
          y += filas.length * 5.4 + 9;
        }
      });
      y += 4;
    });

    /* pies con n/N */
    var N = doc.getNumberOfPages();
    for (var p = 1; p <= N; p++) {
      doc.setPage(p);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
      color(p === 1 ? [140, 150, 146] : GRIS);
      doc.text(l1('Sec. Hacienda · Guía de ' + (c.nombre || '') + ' · ' + fecha + ' · v' + (window.APP_VERSION || '')), mx, H - 8, { maxWidth: W - 2 * mx - 20 });
      doc.text(p + '/' + N, W - mx, H - 8, { align: 'right' });
      doc.setDrawColor(LINEA[0], LINEA[1], LINEA[2]); doc.setLineWidth(.2); doc.line(mx, H - 12, W - mx, H - 12);
    }
    return doc;
  }

  window.GUIA = {
    abrir: abrir, pintar: pintar, pdf: function () { descargarPDF(null); },
    contexto: contexto, secciones: function () { return lasMias(contexto()).map(function (s) { return s.id; }); },
    _armarPDF: armarPDF, _iconoPNG: iconoPNG, medidas: function () { return MED.slice(); }
  };
})();
