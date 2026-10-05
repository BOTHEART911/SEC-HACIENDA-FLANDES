/* ============================================================
   SEC-HACIENDA-FLANDES · GUÍA RÁPIDA
   Fase 2 · 27/09/2026

   Qué es
     La guía de uso DENTRO de la app: cómo se entra, qué hay en cada
     parte y, sobre todo, qué puede hacer cada tipo de usuario (DEV,
     ADMIN, ABOGADO, ASISTENTE, ARCHIVO y ATENCIÓN). Se abre desde la
     tarjeta "Guía rápida" del inicio y desde el menú de la foto.

   De dónde sale lo que dice
     De las reglas reales del servidor (Alcance.gs, Config.gs,
     Identidad.gs) y de app.js, no de una idea general: si una regla
     cambia allá, hay que cambiarla aquí. Los roles de quien la lee se
     resaltan, para que cada quien encuentre lo suyo primero.
   ============================================================ */
(function () {
  'use strict';

  var K = window.KIT;
  if (!K) return;

  function ico(n, t) { return K.icono(n, t || 20); }
  function esc(s) { return K.esc ? K.esc(s) : String(s == null ? '' : s); }

  var ROLES = [
    {
      id: 'DEV', t: 'Desarrollador', ic: 'engranaje',
      p: 'Todo lo del administrador y, además, la parte técnica de la app.',
      puede: [
        'Configuración → Plantillas de mensajes: todos los WhatsApp que manda la app, con sus variables.',
        'Configuración → IDs y ajustes: carpetas de Drive, llaves de BuilderBot, Firebase del chat y del EN VIVO, voz de las consultas y topes del PIN.',
        'Dar o quitar el rol DEV a otra persona.'
      ]
    },
    {
      id: 'ADMIN', t: 'Administrador', ic: 'llave',
      p: 'Ve y gestiona toda la Secretaría. Es quien coordina.',
      puede: [
        'Predial: pendientes por chat, agregar atención presencial, atenciones registradas, estadísticas e informes.',
        'Base de datos predial completa: agregar, editar todos los campos, eliminar, cambiar la actuación, asignar sustanciador y asistente, y el panel.',
        'Mi semáforo completo: agregar asignaciones, tomar la decisión (finalizar o pedir evidencia), eliminar y el panel del equipo.',
        'Drive anexos de todo el equipo.',
        'Configuración → Usuarios y roles: crear personas (la app les manda el PIN por WhatsApp), editar, dar roles, desactivar y generar un PIN nuevo. Puede crear otro administrador.'
      ]
    },
    {
      id: 'ABOGADO', t: 'Abogado (sustanciador)', ic: 'balanza',
      p: 'Trabaja las asignaciones y los expedientes que tiene a su nombre.',
      puede: [
        'Mi semáforo: sus asignaciones (como asignado o como apoyo). Ver, editar bitácora, etapa jurídica, documentos de respuesta y evidencia.',
        'Rebotar una asignación que no es de su competencia y solicitar al coordinador la revisión, la firma o la finalización.',
        'Chat en tiempo real de cada asignación.',
        'Base de datos predial: los expedientes donde es sustanciador. Editar bitácora, actuación y estado; objetar (rebotar) y poner asistente cuando no hay.',
        'Descargar a Excel sus propias filas y abrir sus expedientes en Drive.'
      ]
    },
    {
      id: 'ASISTENTE', t: 'Asistente', ic: 'equipo',
      p: 'Apoya a los abogados en los expedientes y asignaciones.',
      puede: [
        'Base de datos predial: ve y edita TODOS los expedientes (bitácora, actuación y estado). Los campos de estructura (nombre, NIT, deuda, número de expediente) son del administrador.',
        'Mi semáforo: las asignaciones donde está como apoyo.',
        'Descargar a Excel los expedientes donde ha escrito bitácora.'
      ]
    },
    {
      id: 'ARCHIVO', t: 'Archivo', ic: 'archivo',
      p: 'Lleva la bitácora de los expedientes físicos.',
      puede: [
        'Mi semáforo: ve todas las asignaciones en modo lectura y responde en MENSAJE O BITÁCORA.',
        'Base de datos predial: los expedientes con archivo o con solicitud de expediente.',
        'Le llega un WhatsApp cada vez que alguien pide un expediente.'
      ]
    },
    {
      id: 'ATENCION', t: 'Atención al contribuyente', ic: 'atencion',
      p: 'Atiende a la gente por chat y en ventanilla.',
      puede: [
        'Pendientes predial: responder las solicitudes que llegan por WhatsApp adjuntando los recibos, o marcarlas AL DÍA, NO ENCONTRADO, respuesta limpia o dar de baja.',
        'Agregar atención predial: registrar a quien viene en persona.'
      ]
    },
    {
      id: 'TRIBUTARIO', t: 'Tributario (Industria y Comercio)', ic: 'sobre',
      p: 'Fiscaliza el Impuesto de Industria y Comercio: requiere información a los contribuyentes y hace el seguimiento.',
      puede: [
        'Requerimientos: agregar contribuyentes uno a uno o con la plantilla de carga masiva en Excel.',
        'Enviar el requerimiento por correo desde cobrocoactivo@flandes-tolima.gov.co (uno a uno o de 10 en 10). El PDF queda como primera evidencia.',
        'Seguimiento: la app cuenta los días hábiles, manda un recordatorio antes de vencer, detecta la respuesta del contribuyente y, si vence sin respuesta, ofrece el 2.º requerimiento.',
        'Evidencias (hasta 5 por contribuyente), bitácora, cambio de etapa, Mi trabajo con descarga a Excel y PDF, y la configuración de textos del correo.',
        'El administrador y el desarrollador ven también este módulo.'
      ]
    }
  ];

  var SECCIONES = [
    {
      t: 'Entrar a la app', ic: 'candado', items: [
        'La primera vez en un dispositivo entras con tu <b>documento</b>. Desde ahí tu cuenta queda guardada y entras con tu <b>PIN</b> de 4 dígitos.',
        'En el computador puedes escribir el PIN con el teclado.',
        'Si fallas el PIN 5 veces, tu usuario se bloquea unos minutos.',
        'La sesión queda abierta. Para salir usa <b>Cerrar sesión</b> o <b>Cambiar de usuario</b> (menú de tu foto o al final del inicio).'
      ]
    },
    {
      t: 'Cambiar mi PIN', ic: 'pin', items: [
        'Desde el inicio (tarjeta <b>Cambiar mi PIN</b>), desde el menú de tu foto o en la pantalla de ingreso, después de elegir tu cuenta.',
        'Pide el PIN actual y el nuevo dos veces. No se aceptan números repetidos (1111) ni seguidos (1234).',
        'Te llega un aviso por WhatsApp de que se cambió, sin el PIN. Si no fuiste tú, avisa a un administrador.',
        '¿Olvidaste el PIN? Un administrador te genera uno nuevo desde Configuración y te llega por WhatsApp.'
      ]
    },
    {
      t: 'Moverse por la app', ic: 'brujula', items: [
        'Arriba está la barra con el nombre de la vista. La flecha de la izquierda te devuelve.',
        'El botón <b>luna / sol</b> cambia entre modo claro y oscuro. En el celular está en el menú de tu foto.',
        'Tu foto abre el menú: guía, cambiar PIN, cambiar foto, instalar, cambiar de usuario y cerrar sesión.',
        'El botón <b>Consultar</b> de cada lista te da resúmenes de lo que tienes en pantalla (vencidas, por barrio, por sustanciador…).'
      ]
    },
    {
      t: 'Requerimientos de Industria y Comercio', ic: 'sobre', items: [
        '<b>Agregar</b> un contribuyente o subir muchos con <b>Carga masiva</b> (descarga la plantilla, llénala y súbela; la app te dice qué filas corregir).',
        '<b>Enviar</b>: la app arma el PDF con la plantilla, lo manda desde cobrocoactivo@flandes-tolima.gov.co y lo guarda como primera evidencia. Marca varias tarjetas para enviarlas de 10 en 10.',
        'Desde el envío corre el plazo (15 días hábiles por defecto). Cuando faltan pocos días sale un <b>recordatorio</b> en el mismo hilo del correo.',
        'Si el contribuyente responde al correo, la tarjeta pasa a <b>Respondió</b> sola y sus adjuntos quedan en el expediente.',
        'Si vence sin respuesta, la tarjeta se pone en rojo (<b>Pendiente de seguimiento</b>) y aparece el botón del <b>2.º requerimiento</b>.',
        'Etapas: Creado, Requerimiento y Evaluación cambian solas; las demás las mueves tú con el botón de etapa.'
      ]
    },
    {
      t: 'Bitácoras por responder', ic: 'libro', items: [
        'En Asignaciones y en BD Predial cada tarjeta tiene tres lados: el <b>abogado</b>, el <b>asistente</b> y el <b>asignador o administrador</b>. Cuando uno guarda una bitácora, la tarjeta queda <b>por responder</b> para los otros dos.',
        'La tarjeta lo muestra con una franja y los días hábiles que lleva: azul hasta 1 día, <b>naranja</b> 2 a 3, <b>rojo</b> más de 3.',
        'Se cierra para tu lado cuando escribes tu bitácora o tocas <b>Enterado</b> (queda una línea corta “ENTERADO.” con tu nombre y la fecha).',
        'La pastilla <b>Bitácoras por responder</b> deja solo esas tarjetas; en <b>Consultar</b> está <b>Bitácoras por revisar</b> con las más viejas primero. El número también sale en el inicio.',
        'Te llega un aviso push al instante y un resumen a las 7 am. Si te reasignan una tarjeta, lo pendiente pasa a ti; al finalizar la asignación o dejar el expediente al día se cierra todo.'
      ]
    },
    {
      t: 'Colores del semáforo', ic: 'semaforo', items: [
        '<b>Verde</b>: le queda más de la mitad del plazo. <b>Naranja</b>: le queda menos de la mitad. <b>Rojo claro</b>: faltan 3 días hábiles o menos. <b>Rojo</b>: vence hoy o ya venció. <b>Gris</b>: finalizada.',
        'Los días se cuentan hábiles: sin fines de semana ni festivos de Colombia.'
      ]
    },
    {
      t: 'La app al día', ic: 'actualizar', items: [
        'Cuando se publica una versión nueva, la app se actualiza sola al volver a ella.',
        'Si te quedas sin internet, sale un aviso arriba y la app te dice cuando vuelve la conexión.',
        'Puedes instalarla como una app del teléfono o del computador desde el menú de tu foto.'
      ]
    }
  ];

  function misRoles() {
    try { return (window.IDN && window.IDN.roles && window.IDN.roles()) || []; } catch (e) { return []; }
  }

  function pintar() {
    var caja = document.getElementById('guia-cuerpo');
    if (!caja) return;
    var mios = misRoles();

    var h = '';
    h += '<section class="hf-guia-cab">' +
         '  <span class="hf-guia-cab__ico">' + ico('libro', 28) + '</span>' +
         '  <div><h2 class="hf-guia-cab__t">Guía rápida</h2>' +
         '  <p class="hf-guia-cab__p">La app de la Secretaría de Hacienda reúne la atención del impuesto predial, la base de datos de expedientes y el semáforo de asignaciones. Lo que ves depende de tu tipo de usuario.</p></div>' +
         '</section>';

    h += '<section class="bloque"><h3 class="bloque__t">Tipos de usuario</h3>' +
         '<p class="hf-intro">Una persona puede tener varios roles a la vez (por ejemplo, ADMIN y ABOGADO). Los roles los asigna un administrador desde Configuración.' +
         (mios.length ? ' Tus roles están resaltados.' : ' Todavía no tienes un rol: pídelo a un administrador.') + '</p>' +
         '<div class="kit-rejilla hf-roles">';
    ROLES.forEach(function (r) {
      var es = mios.indexOf(r.id) !== -1;
      h += '<article class="hf-rol' + (es ? ' hf-rol--mio' : '') + '">' +
           '  <header class="hf-rol__cab"><span class="hf-rol__ico">' + ico(r.ic, 22) + '</span>' +
           '  <div><b class="hf-rol__t">' + esc(r.t) + '</b><span class="hf-rol__id">' + esc(r.id) + (es ? ' · tu rol' : '') + '</span></div></header>' +
           '  <p class="hf-rol__p">' + esc(r.p) + '</p>' +
           '  <ul class="hf-rol__l">' + r.puede.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' +
           '</article>';
    });
    h += '</div></section>';

    h += '<section class="bloque"><h3 class="bloque__t">Cómo se usa</h3><div class="kit-rejilla hf-roles">';
    SECCIONES.forEach(function (s) {
      h += '<article class="grupo hf-guia-sec">' +
           '  <h4 class="grupo__t">' + ico(s.ic, 18) + ' ' + esc(s.t) + '</h4>' +
           '  <ul class="hf-rol__l">' + s.items.map(function (x) { return '<li>' + x + '</li>'; }).join('') + '</ul>' +
           '</article>';
    });
    h += '</div></section>';

    h += '<footer class="kit-cred">' + (K.piezas.creditos ? K.piezas.creditos.html() : '') + '</footer>';
    caja.innerHTML = h;
  }

  function abrir() {
    pintar();
    try { if (window.playSoundOnce && window.SOUNDS) window.playSoundOnce(window.SOUNDS.menu); } catch (e) {}
    if (typeof window.showView === 'function') window.showView('view-guia');
  }

  window.GUIA = { abrir: abrir, pintar: pintar, roles: ROLES };
})();
