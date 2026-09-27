/* ============================================================
   DESCARGAR BITÁCORAS / ACTUACIONES — SEC-HACIENDA · Excel y PDF
   BD Predial (10/09/2026) + ASIGNACIONES (11/09/2026)
   + ACTUACIONES de BD Predial (14/09/2026)
   + las actuaciones SIN AUTOR REGISTRADO (14/09/2026)

   Lo nuevo del 14/09
     · Una TERCERA fuente: el historial de ACTUACIONES de BD Predial
       (columna AO de la hoja), que el backend escribe con el MISMO
       formato de línea que la bitácora. Por eso aquí no hay un lector
       nuevo: se reutiliza window.BITACORA.anotaciones tal cual.
     · `abrir()` acepta un AUTOR fijado desde fuera. Lo usa el modal
       MI TRABAJO (js/mi-trabajo.js) para que lo que se ve en pantalla y
       lo que se descarga sean exactamente lo mismo: si un DEV está
       mirando las anotaciones de NICOL, el archivo sale con las de
       NICOL, sin tener que volver a elegir.
     · La pastilla ya no se pinta si js/mi-trabajo.js está montado: ese
       módulo agrupa las entradas en un solo botón. Si ese archivo no
       carga (404, caché vieja), esta pastilla se pinta como el 11/09 y
       no se pierde la descarga.

   Qué agrega
     Un botón  📥 DESCARGAR BITÁCORAS  junto a las pastillas
     🗒️ MIS BITÁCORAS / 📖 VER MIS BITÁCORAS que ya puso el lote
     del 06/09, y un botón  🗒️ BITÁCORA  dentro del modal Ver de
     cada expediente. Los dos abren el mismo modal de descarga.

   De dónde salen los datos: DE LA MEMORIA, no del servidor
     BD Predial: la columna S (BITACORA) ya viaja en el listado
     ligero (rowToPredialListObj_) ⇒ las 9.4xx filas ya están en el
     navegador. Se lee __bdpFilteredCache (lo filtrado en pantalla)
     y __bdpListCache (todo lo visible).
     ASIGNACIONES: listProcesos_ manda la fila COMPLETA (A..AD), así
     que la columna Q (BITACORA) y todas las demás ya están aquí. Se
     lee __procPagedCache (lo filtrado, las 253 filas del filtro, no
     la página de 100 que se está pintando) y __procListCache.
     CERO viajes a Apps Script, cero endpoints nuevos, cero cambios
     en los .gs. Es el mismo patrón de carga única de las vistas: el
     viaje se paga una vez al entrar y no se vuelve a pagar.

   Por qué no hay que revalidar permisos
     El caché de pantalla ES lo que el servidor ya autorizó a ver
     (PRED_puerta_/PRED_visible_ en Código.gs). Aquí no se puede
     bajar nada que no estuviera ya en pantalla.

   Quién ve qué anotaciones (decisión del 10/09)
     · ADMIN y DEV eligen: TODAS las anotaciones o SOLO LAS MÍAS.
     · Los demás: SOLO LAS SUYAS, sin opción.
     La regla de "mías" es la MISMA que usa el servidor para la
     descarga por bitácora (DSC_bitacoraEnRango_) y la misma que usa
     el modal 📖 VER MIS BITÁCORAS: se reutiliza el lector que ya
     expone js/bitacora.js (window.BITACORA.anotaciones), no se
     escribe una segunda copia que se pueda desincronizar.

   Excel y PDF
     Las dos librerías se bajan del CDN solo cuando se usan por
     primera vez, igual que la Fase 6 con SheetJS. Si el CDN falla:
     Excel cae a CSV y PDF cae a la ventana de impresión del
     navegador (que en móvil y en PC ofrece "Guardar como PDF").

   Quién NO ve el botón
     El rol ARCHIVO (SOL MAR) ve las 253 asignaciones pero la app le
     esconde los botones de la tarjeta y no escribe bitácora: la
     descarga le saldría vacía. En ASIGNACIONES no se le pinta. En
     BD Predial todo sigue igual que el 10/09.

   17/09/2026 — SOLICITUDES DE EXPEDIENTE (Asignaciones col AD y BD
   Predial col AP). Dos fuentes más con su PROPIO lector
   (window.SOLEXP.lectorDescarga, js/solicitud-exp.js): una solicitud no
   es una bitácora (bloques con autor, fecha opcional, y la respuesta de
   ARCHIVO). Lo que cambia en el motor:
     · `F.lector(texto, autor)` — si la fuente lo trae, se usa en vez del
       lector de bitácora. Sin él, todo sigue como antes.
     · `F.sinFecha` — los mensajes viejos no tienen fecha: el modal ofrece
       «Incluir los mensajes sin fecha» (encendido de fábrica). Con un
       rango de fechas puesto quedan fuera, como las actuaciones sin autor.
     · Columnas por MENSAJE (`porItem`): TIPO (SOLICITUD / RESPUESTA) y
       ESTADO de la solicitud, además de las del expediente.
     · Las palabras fijas del PDF («anotaciones», «Anotaciones de…») salen
       ahora de la fuente.

   No modifica app.js, styles.css ni js/bitacora.js.
   ============================================================ */
(function () {
  'use strict';

  if (window.__HACBITEXP_LISTO) return;
  window.__HACBITEXP_LISTO = true;

  var CDN_XLSX  = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
  var CDN_JSPDF = 'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js';
  var ICONO = 'img/icono-192.png';

  /* ══════════════ las dos vistas ══════════════
     Todo lo que cambia entre BD Predial y Asignaciones vive aquí: el resto
     del archivo (modal, Excel, PDF, respaldos) es uno solo para las dos.
     Las columnas viven TODAS en lo que ya está en memoria: ninguna obliga a
     pedirle nada al servidor. `num` marca las que van al Excel como número
     (para que sumen) y `ficha` las que pasan por el limpiador de app.js. */
  var FUENTES = {

    'view-bd-predial': {
      clave:      'hac.bitexport.v2',   /* .v1 era el catálogo sin CORREO */
      campo:      'bitacora',
      etiqueta:   'ANOTACIÓN',
      cosa:       'anotación',
      cosas:      'anotaciones',
      pastilla:   'bxp-pill',
      wrap:       'bit-pill-predial-wrap',
      ancla:      'bdp-pills-mias-wrap',
      pantalla:   '__bdpFilteredCache',
      todo:       '__bdpListCache',
      detalle:    'abrirBDPDetalle_',
      acciones:   'bdp-det-actions',
      subtitulo:  'Secretaría de Hacienda · Base de Datos del Impuesto Predial',
      tituloUno:  'BITÁCORA DEL EXPEDIENTE',
      tituloVar:  'BITÁCORA DE EXPEDIENTES',
      archivoUno: 'BITACORA ',
      archivoVar: 'BITACORAS BD PREDIAL',
      enPantalla: 'Lo que estoy viendo en BD Predial',
      enTodo:     'Todos los expedientes',
      todoTxt:    'Todos los expedientes visibles',
      pantallaTxt:'Los expedientes filtrados en pantalla',
      uno:        'expediente',
      varios:     'expedientes',
      prefijo:    'EXP. ',
      /* columnas que ya salen en la barra del grupo: no se repiten debajo */
      arriba:     ['nombres', 'no_exp_fisico'],
      oculto:     function () { return false; },
      id:         function (r) { return txt(r.id_predial); },
      titulo:     function (r) { return txt(r.no_exp_fisico) || txt(r.id_predial) || '—'; },
      quien:      function (r) { return txt(r.nombres); },
      columnas: [
        { k: 'no_exp_fisico',      t: 'NO. EXP. FÍSICO',    def: true  },
        { k: 'nombres',            t: 'NOMBRES',            def: true  },
        { k: 'ficha_catastral',    t: 'FICHA CATASTRAL',    def: true, ficha: true },
        { k: 'direccion_predio',   t: 'DIRECCIÓN PREDIO',   def: true  },
        { k: 'correo_electronico', t: 'CORREO ELECTRÓNICO', def: true  },
        { k: 'nit_cedula',         t: 'NIT O CÉDULA',       def: false },
        { k: 'valor_deuda',        t: 'VALOR DEUDA',        def: false, num: true },
        { k: 'clasificacion',      t: 'CLASIFICACIÓN',      def: false },
        { k: 'actuacion',          t: 'ACTUACIÓN',          def: false },
        { k: 'sustanciador',       t: 'SUSTANCIADOR',       def: false },
        { k: 'asistente',          t: 'ASISTENTE',          def: false },
        { k: 'estado_proceso',     t: 'ESTADO PROCESO',     def: false }
      ]
    },

    'view-asignaciones': {
      clave:      'hac.bitexport.proc.v1',
      campo:      'bitacora',
      etiqueta:   'ANOTACIÓN',
      cosa:       'anotación',
      cosas:      'anotaciones',
      pastilla:   'bxp-pill-proc',
      wrap:       'bit-pill-procesos-wrap',
      ancla:      'proc-filtros',
      /* __procPagedCache lo deja la paginación de app.js y trae el filtrado
         COMPLETO (no la página pintada). Si aún no se pintó la lista, se cae
         al listado entero para no bajar un archivo vacío. */
      pantalla:   '__procPagedCache',
      todo:       '__procListCache',
      detalle:    'abrirVerAsignacion_',
      acciones:   'proc-ver-actions',
      subtitulo:  'Secretaría de Hacienda · Asignaciones',
      tituloUno:  'BITÁCORA DE LA ASIGNACIÓN',
      tituloVar:  'BITÁCORA DE ASIGNACIONES',
      archivoUno: 'BITACORA ',
      archivoVar: 'BITACORAS ASIGNACIONES',
      enPantalla: 'Lo que estoy viendo en Asignaciones',
      enTodo:     'Todas las asignaciones',
      todoTxt:    'Todas las asignaciones visibles',
      pantallaTxt:'Las asignaciones filtradas en pantalla',
      uno:        'asignación',
      varios:     'asignaciones',
      prefijo:    'CONS. ',
      arriba:     ['consecutivo', 'peticionario'],
      /* El rol ARCHIVO (SOL MAR) no escribe bitácora: el archivo le saldría
         vacío. No se le pinta el botón. */
      oculto:     function () {
        try { return !!(window.esArchivo_ && window.esArchivo_()); }
        catch (_) { return false; }
      },
      /* Se agrupa por id_proceso (A, único). El CONSECUTIVO solo se muestra:
         hay 253 asignaciones y 201 consecutivos distintos, así que agrupar
         por consecutivo fusionaría procesos que no son el mismo. */
      id:         function (r) { return txt(r.id_proceso); },
      titulo:     function (r) { return txt(r.consecutivo) || txt(r.id_proceso) || '—'; },
      quien:      function (r) { return txt(r.peticionario); },
      columnas: [
        { k: 'consecutivo',  t: 'CONSECUTIVO',     def: true  },
        { k: 'descripcion',  t: 'ASUNTO',          def: true  },
        { k: 'peticionario', t: 'PETICIONARIO',    def: true  },
        { k: 'estado',       t: 'ESTADO',          def: true  },
        { k: 'expediente',   t: 'EXP. INTERNO',    def: false },
        { k: 'etapa',        t: 'ETAPA JURÍDICA',  def: false },
        { k: 'categoria',    t: 'CATEGORÍA',       def: false },
        { k: 'subcategoria', t: 'SUBCATEGORÍA',    def: false },
        { k: 'medio',        t: 'MEDIO',           def: false },
        { k: 'asignado',     t: 'ASIGNADO',        def: false },
        { k: 'asistente',    t: 'ASISTENTE',       def: false },
        { k: 'recibido',     t: 'FECHA RECIBIDO',  def: false },
        { k: 'respuesta',    t: 'FECHA RESPUESTA', def: false },
        { k: 'cierre',       t: 'FECHA DE CIERRE', def: false }
      ]
    },

    /* ══════════════ 14/09 · ACTUACIONES de BD Predial ══════════════
       Misma vista y mismos cachés que 'view-bd-predial': lo único que
       cambia es de qué columna sale el historial (AO en vez de S) y
       cómo se titula. Las columnas del expediente son las mismas 12 de
       la bitácora más ACTUACIÓN ACTUAL, FECHA DE SEGUIMIENTO y ESTADO
       DEL SEGUIMIENTO, que es lo que da sentido a una actuación. */
    'view-bd-predial-actuaciones': {
      clave:      'hac.actexport.v1',
      campo:      'actuaciones',
      etiqueta:   'ACTUACIÓN REGISTRADA',
      cosa:       'actuación',
      cosas:      'actuaciones',
      pastilla:   'bxp-pill-act',
      wrap:       'bit-pill-predial-wrap',
      ancla:      'bdp-pills-mias-wrap',
      pantalla:   '__bdpFilteredCache',
      todo:       '__bdpListCache',
      detalle:    null,      /* no se engancha al Ver: va por MI TRABAJO */
      acciones:   'bdp-det-actions',
      subtitulo:  'Secretaría de Hacienda · Base de Datos del Impuesto Predial',
      tituloUno:  'ACTUACIONES DEL EXPEDIENTE',
      tituloVar:  'ACTUACIONES DE EXPEDIENTES',
      archivoUno: 'ACTUACIONES ',
      archivoVar: 'ACTUACIONES BD PREDIAL',
      enPantalla: 'Lo que estoy viendo en BD Predial',
      enTodo:     'Todos los expedientes',
      todoTxt:    'Todos los expedientes visibles',
      pantallaTxt:'Los expedientes filtrados en pantalla',
      uno:        'expediente',
      varios:     'expedientes',
      prefijo:    'EXP. ',
      arriba:     ['nombres', 'no_exp_fisico'],
      oculto:     function () { return false; },
      id:         function (r) { return txt(r.id_predial); },
      titulo:     function (r) { return txt(r.no_exp_fisico) || txt(r.id_predial) || '—'; },
      quien:      function (r) { return txt(r.nombres); },
      /* 14/09 — los 779 expedientes que ya tenían actuación antes de que la
         hoja guardara el autor. No tienen línea de historial, así que el
         lector no devuelve nada por ellos: hay que armarles el item a mano.
         Sin esto no salían en el archivo aunque sí se vieran en la lista. */
      sinAutor:   function (r) {
        var act = txt(r.actuacion).toUpperCase();
        if (!act || act === 'NINGUNA') return null;
        if (txt(r.actuaciones)) return null;      /* ya tiene historial */
        var seg = txt(r.fecha_seguimiento);
        return {
          dia: 0, anio: 0, mes: 0,
          fecha: '—',
          autor: '',                               /* Excel y PDF ya pintan SIN AUTOR */
          texto: act + (seg ? ' \u00b7 seguimiento ' + seg : ' \u00b7 sin fecha de seguimiento'),
          fila: r,
          sinAutor: true
        };
      },
      columnas: [
        { k: 'no_exp_fisico',      t: 'NO. EXP. FÍSICO',    def: true  },
        { k: 'nombres',            t: 'NOMBRES',            def: true  },
        { k: 'actuacion',          t: 'ACTUACIÓN ACTUAL',   def: true  },
        { k: 'fecha_seguimiento',  t: 'FECHA DE SEGUIMIENTO', def: true },
        { k: 'recordatorio',       t: 'ESTADO DEL SEGUIMIENTO', def: true },
        { k: 'sustanciador',       t: 'SUSTANCIADOR',       def: true  },
        { k: 'ficha_catastral',    t: 'FICHA CATASTRAL',    def: false, ficha: true },
        { k: 'direccion_predio',   t: 'DIRECCIÓN PREDIO',   def: false },
        { k: 'correo_electronico', t: 'CORREO ELECTRÓNICO', def: false },
        { k: 'nit_cedula',         t: 'NIT O CÉDULA',       def: false },
        { k: 'valor_deuda',        t: 'VALOR DEUDA',        def: false, num: true },
        { k: 'clasificacion',      t: 'CLASIFICACIÓN',      def: false },
        { k: 'asistente',          t: 'ASISTENTE',          def: false },
        { k: 'estado_proceso',     t: 'ESTADO PROCESO',     def: false }
      ]
    },

    /* ══════════════ 17/09 · SOLICITUDES DE EXPEDIENTE ══════════════ */
    'view-asignaciones-solicitudes': fuenteSolicitudes('view-asignaciones', {
      clave:      'hac.solexport.proc.v1',
      campo:      'solicitudExpediente',
      pastilla:   'bxp-pill-sx-proc',
      wrap:       'bit-pill-procesos-wrap',
      ancla:      'proc-filtros',
      pantalla:   '__procPagedCache',
      todo:       '__procListCache',
      subtitulo:  'Secretaría de Hacienda · Asignaciones',
      tituloUno:  'SOLICITUDES DE EXPEDIENTE DE LA ASIGNACIÓN',
      tituloVar:  'SOLICITUDES DE EXPEDIENTE · ASIGNACIONES',
      archivoUno: 'SOLICITUDES EXPEDIENTE ',
      archivoVar: 'SOLICITUDES EXPEDIENTE ASIGNACIONES',
      enPantalla: 'Lo que estoy viendo en Asignaciones',
      enTodo:     'Todas las asignaciones',
      todoTxt:    'Todas las asignaciones visibles',
      pantallaTxt:'Las asignaciones filtradas en pantalla',
      uno:        'asignación',
      varios:     'asignaciones',
      prefijo:    'CONS. ',
      arriba:     ['consecutivo', 'peticionario'],
      id:         function (r) { return txt(r.id_proceso); },
      titulo:     function (r) { return txt(r.consecutivo) || txt(r.id_proceso) || '—'; },
      quien:      function (r) { return txt(r.peticionario); },
      columnas: [
        { k: '__tipo',       t: 'TIPO (SOLICITUD / RESPUESTA)', def: true, porItem: 'tipo' },
        { k: '__estado',     t: 'ESTADO DE LA SOLICITUD', def: true, porFila: 'estado' },
        { k: 'consecutivo',  t: 'CONSECUTIVO',     def: true  },
        { k: 'expediente',   t: 'EXP. INTERNO',    def: true  },
        { k: 'peticionario', t: 'PETICIONARIO',    def: true  },
        { k: 'asignado',     t: 'ASIGNADO',        def: true  },
        { k: 'asistente',    t: 'ASISTENTE',       def: false },
        { k: 'descripcion',  t: 'ASUNTO',          def: false },
        { k: 'estado',       t: 'ESTADO',          def: false },
        { k: 'etapa',        t: 'ETAPA JURÍDICA',  def: false },
        { k: 'categoria',    t: 'CATEGORÍA',       def: false },
        { k: 'recibido',     t: 'FECHA RECIBIDO',  def: false },
        { k: 'respuesta',    t: 'FECHA RESPUESTA', def: false }
      ]
    }),

    'view-bd-predial-solicitudes': fuenteSolicitudes('view-bd-predial', {
      clave:      'hac.solexport.pred.v1',
      campo:      'solicitud_expediente',
      pastilla:   'bxp-pill-sx-pred',
      wrap:       'bit-pill-predial-wrap',
      ancla:      'bdp-pills-mias-wrap',
      pantalla:   '__bdpFilteredCache',
      todo:       '__bdpListCache',
      subtitulo:  'Secretaría de Hacienda · Base de Datos del Impuesto Predial',
      tituloUno:  'SOLICITUDES DE EXPEDIENTE',
      tituloVar:  'SOLICITUDES DE EXPEDIENTE · BD PREDIAL',
      archivoUno: 'SOLICITUDES EXPEDIENTE ',
      archivoVar: 'SOLICITUDES EXPEDIENTE BD PREDIAL',
      enPantalla: 'Lo que estoy viendo en BD Predial',
      enTodo:     'Todos los expedientes',
      todoTxt:    'Todos los expedientes visibles',
      pantallaTxt:'Los expedientes filtrados en pantalla',
      uno:        'expediente',
      varios:     'expedientes',
      prefijo:    'EXP. ',
      arriba:     ['nombres', 'no_exp_fisico'],
      id:         function (r) { return txt(r.id_predial); },
      titulo:     function (r) { return txt(r.no_exp_fisico) || txt(r.id_predial) || '—'; },
      quien:      function (r) { return txt(r.nombres); },
      columnas: [
        { k: '__tipo',             t: 'TIPO (SOLICITUD / RESPUESTA)', def: true, porItem: 'tipo' },
        { k: '__estado',           t: 'ESTADO DE LA SOLICITUD', def: true, porFila: 'estado' },
        { k: 'no_exp_fisico',      t: 'NO. EXP. FÍSICO',    def: true  },
        { k: 'nombres',            t: 'NOMBRES',            def: true  },
        { k: 'sustanciador',       t: 'SUSTANCIADOR',       def: true  },
        { k: 'asistente',          t: 'ASISTENTE',          def: false },
        { k: 'ficha_catastral',    t: 'FICHA CATASTRAL',    def: false, ficha: true },
        { k: 'nit_cedula',         t: 'NIT O CÉDULA',       def: false },
        { k: 'direccion_predio',   t: 'DIRECCIÓN PREDIO',   def: false },
        { k: 'actuacion',          t: 'ACTUACIÓN',          def: false },
        { k: 'estado_proceso',     t: 'ESTADO PROCESO',     def: false }
      ]
    })
  };

  /** Arma una fuente de SOLICITUDES: lo común de las dos vistas va aquí. */
  function fuenteSolicitudes(vista, def) {
    def.vistaBase  = vista;
    def.etiqueta   = 'MENSAJE';
    def.cosa       = 'mensaje';
    def.cosas      = 'mensajes';
    def.detalle    = null;           /* se entra por MI TRABAJO */
    def.acciones   = null;
    def.sinFecha   = true;
    def.tituloModal = 'DESCARGAR SOLICITUDES DE EXPEDIENTE';
    def.todasTxt   = 'Todas las solicitudes';
    def.miasTxt    = 'Solo las mías';
    def.autorTxt   = function (a) {
      return a ? ('Solicitudes en las que participó ' + a) : 'Solicitudes de todos';
    };
    def.oculto     = function () { return false; };
    def.lector     = function (texto, autor) {
      if (!window.SOLEXP || typeof window.SOLEXP.lectorDescarga !== 'function') return null;
      return window.SOLEXP.lectorDescarga(vista)(texto, autor);
    };
    def.estado     = function (r) {
      try { return window.SOLEXP.estadoFila(r, vista); } catch (_) { return ''; }
    };
    return def;
  }

  var F = FUENTES['view-bd-predial'];   /* la vista con la que se abrió */
  var expFijo = null;      /* fila cuando el modal se abre desde un expediente */
  var bajando = false;
  /* 14/09 — autor impuesto por quien abrió el modal (MI TRABAJO). null = el
     modal decide como siempre. '' = TODAS las anotaciones, sin filtrar. */
  var autorFijo = null;

  /* ══════════════ utilidades ══════════════ */

  function $(id) { return document.getElementById(id); }
  function txt(v) { return String(v == null ? '' : v).trim(); }

  function escapar(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }

  /* Los cachés de app.js son `let` de nivel superior: no cuelgan de window
     pero sí se ven desde otro script clásico. Mismo truco de js/bitacora.js. */
  function leer(nombre) {
    try {
      /* jshint evil:true */
      var v = (0, eval)(nombre);
      return Array.isArray(v) ? v : [];
    } catch (_) { return []; }
  }

  function miNombre() {
    try {
      if (window.ALC && window.ALC.nombre) return txt(window.ALC.nombre);
      if (window.currentUser && window.currentUser.nombre) return txt(window.currentUser.nombre);
    } catch (_) {}
    return '';
  }

  function mando() {
    try { return !!(window.IDN && window.IDN.esAdmin && window.IDN.esAdmin()); }
    catch (_) { return false; }
  }

  /* El lector de bitácora es el de js/bitacora.js: una sola regla en toda la
     app. Si ese archivo no montó, no se inventa otra: se avisa y no se baja. */
  function anotaciones(texto, autor) {
    /* 17/09 — la fuente puede traer su propio lector (SOLICITUDES). */
    if (typeof F.lector === 'function') return F.lector(texto, autor);
    if (window.BITACORA && typeof window.BITACORA.anotaciones === 'function') {
      return window.BITACORA.anotaciones(texto, autor);
    }
    return null;
  }

  function ficha(v) {
    try {
      if (typeof window.bdpCleanFicha_ === 'function') return txt(window.bdpCleanFicha_(v));
    } catch (_) {}
    return txt(v).replace(/^'/, '');
  }

  function valorCol(fila, col, it) {
    /* 17/09 — columnas que no viven en la fila: el TIPO de cada mensaje y el
       ESTADO de la solicitud del expediente. */
    if (col.porItem) {
      /* Sin mensaje (la barra del grupo en el PDF) va vacía y no se pinta. */
      var v = it ? it[col.porItem] : '';
      return txt(v === 'PENDIENTE' ? 'PENDIENTE DE RESPUESTA' : v);
    }
    if (col.porFila) {
      var e = (typeof F[col.porFila] === 'function') ? F[col.porFila](fila) : '';
      if (e === 'PENDIENTE') return 'PENDIENTE DE RESPUESTA';
      if (e === 'RESPONDIDA') return 'RESPONDIDA';
      return e === 'NINGUNA' ? 'SIN SOLICITUD' : txt(e);
    }
    if (col.ficha) return ficha(fila[col.k]);
    if (col.num)   return Number(fila[col.k]) || 0;
    return txt(fila[col.k]);
  }

  function pesos(n) {
    var x = Number(n) || 0;
    return '$ ' + x.toLocaleString('es-CO');
  }

  function hoyISO(d) {
    var f = d || new Date();
    var p = function (n) { return String(n).padStart(2, '0'); };
    return f.getFullYear() + '-' + p(f.getMonth() + 1) + '-' + p(f.getDate());
  }

  function dia(iso) {
    var m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? Number(m[1]) * 10000 + Number(m[2]) * 100 + Number(m[3]) : 0;
  }

  function selloArchivo() {
    var f = new Date();
    var p = function (n) { return String(n).padStart(2, '0'); };
    return p(f.getDate()) + '-' + p(f.getMonth() + 1) + '-' + f.getFullYear();
  }

  function selloLargo() {
    var f = new Date();
    var p = function (n) { return String(n).padStart(2, '0'); };
    return p(f.getDate()) + '/' + p(f.getMonth() + 1) + '/' + f.getFullYear() +
           ' a las ' + p(f.getHours()) + ':' + p(f.getMinutes());
  }

  function nombreArchivo(base, ext) {
    return String(base).replace(/[\\/:*?"<>|]/g, ' ').replace(/\s+/g, ' ').trim() +
           ' ' + selloArchivo() + '.' + ext;
  }

  function guardadas() {
    try {
      var t = JSON.parse(localStorage.getItem(F.clave) || '{}');
      return Array.isArray(t.columnas) ? t.columnas : null;
    } catch (_) { return null; }
  }

  function guardar(cols) {
    try { localStorage.setItem(F.clave, JSON.stringify({ columnas: cols })); }
    catch (_) {}
  }

  /* El aviso va por los dos caminos del lote 06/09: SweetAlert (que desde ese
     lote sí sale por encima de los modales) y una línea dentro del modal. */
  function avisar(icono, titulo, texto) {
    enModal(titulo, texto, icono);
    if (window.Swal) window.Swal.fire({ icon: icono, title: titulo, text: texto || '' });
    else alert(titulo + (texto ? '\n' + texto : ''));
  }

  function enModal(titulo, texto, icono) {
    var capa = $('modal-bitexp');
    if (!capa || capa.classList.contains('hidden')) return;
    var el = $('bxp-avance');
    if (!el) return;
    el.textContent = titulo + (texto ? ' — ' + texto : '');
    el.className = 'bxp-avance ' +
      (icono === 'error' || icono === 'warning' ? 'bxp-avance-malo' : 'bxp-avance-aviso');
  }

  function avance(texto) {
    var el = $('bxp-avance');
    if (!el) return;
    el.textContent = texto || '';
    el.className = 'bxp-avance';
  }

  /* ══════════════ armar los datos ══════════════ */

  /** Las filas sobre las que se trabaja, según el alcance elegido. */
  function filasDelAlcance() {
    if (expFijo) return [expFijo];
    var quiero = (document.querySelector('input[name="bxp-alcance"]:checked') || {}).value || 'pantalla';
    if (quiero === 'todo') return leer(F.todo);
    var v = leer(F.pantalla);
    /* Asignaciones: si todavía no se pintó la lista, __procPagedCache está
       vacío. Vale más bajar todo lo visible que bajar nada. */
    return v.length ? v : leer(F.todo);
  }

  /** ¿De quién son las anotaciones que cuentan? '' = de todos. */
  function autorElegido() {
    /* Si quien abrió el modal ya eligió a alguien (MI TRABAJO), manda eso:
       lo que se ve y lo que baja tienen que ser lo mismo. */
    if (autorFijo !== null) return autorFijo;
    if (!mando()) return miNombre();
    var v = (document.querySelector('input[name="bxp-autor"]:checked') || {}).value || 'todas';
    return v === 'mias' ? miNombre() : '';
  }

  /** ¿Entran las que no tienen autor registrado? Solo existe la opción en
   *  la fuente que las tiene; si el check no está pintado, se asume que sí,
   *  que es lo que muestra la lista de MI TRABAJO. */
  function incluirSinAutor() {
    var c = $('bxp-sinautor');
    return c ? !!c.checked : true;
  }

  /** Cuántas hay en el alcance elegido, para poder decirlo en el modal. */
  function cuantasSinAutor() {
    if (!F.sinAutor) return 0;
    var filas = filasDelAlcance();
    var n = 0;
    for (var i = 0; i < filas.length; i++) if (F.sinAutor(filas[i])) n++;
    return n;
  }

  /** 17/09 — ¿Entran los mensajes sin fecha? Solo existe en SOLICITUDES. */
  function incluirSinFecha() {
    var c = $('bxp-sinfecha');
    return c ? !!c.checked : true;
  }

  /** Cuántos mensajes sin fecha hay en el alcance y autor elegidos. */
  function cuantasSinFecha() {
    if (!F.sinFecha) return 0;
    var filas = filasDelAlcance();
    var autor = autorElegido();
    var n = 0;
    for (var i = 0; i < filas.length; i++) {
      var a = anotaciones(filas[i][F.campo], autor);
      if (!a) return 0;
      for (var j = 0; j < a.length; j++) if (!a[j].dia) n++;
    }
    return n;
  }

  function rangoElegido() {
    var on = $('bxp-fechas') && $('bxp-fechas').checked;
    if (!on) return { desde: 0, hasta: 0 };
    return {
      desde: dia($('bxp-fechas-desde') ? $('bxp-fechas-desde').value : ''),
      hasta: dia($('bxp-fechas-hasta') ? $('bxp-fechas-hasta').value : '')
    };
  }

  /**
   * El corazón: convierte filas de expediente en una lista de ANOTACIONES.
   * Devuelve { items:[…], expedientes:n } o null si el lector no está.
   * Cada item lleva su expediente al lado, para que Excel salga plano y el
   * PDF pueda agrupar sin volver a recorrer nada.
   */
  function recolectar() {
    var filas  = filasDelAlcance();
    var autor  = autorElegido();
    var rango  = rangoElegido();
    var items  = [];
    var exps   = {};
    /* 17/09 — mensajes sin fecha: fuera si hay rango o si se apagó el check. */
    var conSinFecha = !!F.sinFecha && incluirSinFecha() && !rango.desde && !rango.hasta;

    for (var i = 0; i < filas.length; i++) {
      var r = filas[i];
      var anot = anotaciones(r[F.campo || 'bitacora'], autor);
      if (anot === null) return null;
      if (!anot.length) continue;

      for (var j = 0; j < anot.length; j++) {
        var a = anot[j];
        if (F.sinFecha && !a.dia) {
          if (!conSinFecha) continue;
        } else {
          if (rango.desde && a.dia < rango.desde) continue;
          if (rango.hasta && a.dia > rango.hasta) continue;
        }
        items.push({
          dia: a.dia, anio: a.anio, mes: a.mes, orden: a.orden || 0,
          fecha: a.fecha, autor: a.autor, texto: a.texto,
          tipo: a.tipo || '', sinFecha: !!a.sinFecha,
          fila: r
        });
        /* La cuenta va por el ID de la hoja (id_predial en Predial,
           id_proceso en Asignaciones), que es único; lo que se muestra
           (N° Exp. Físico / Consecutivo) puede faltar o repetirse. */
        exps[F.id(r) || ('#' + i)] = true;
      }
    }

    /* 14/09 — las que no tienen autor registrado. Van en su propia pasada,
       DESPUÉS de las demás, porque no salen del lector: se arman de la
       columna ACTUACIÓN (N) y la FECHA DE SEGUIMIENTO (AM) de la fila.
       Quedan fuera si hay un rango de fechas puesto, por lo mismo que en el
       servidor: sin fecha, una fila no puede estar dentro de un rango. */
    if (F.sinAutor && incluirSinAutor() && !rango.desde && !rango.hasta) {
      for (var h = 0; h < filas.length; h++) {
        var it = F.sinAutor(filas[h]);
        if (!it) continue;
        items.push(it);
        exps[F.id(filas[h]) || ('#sa' + h)] = true;
      }
    }

    var n = 0;
    for (var k in exps) { if (Object.prototype.hasOwnProperty.call(exps, k)) n++; }
    return { items: items, expedientes: n };
  }

  function columnasMarcadas() {
    var out = [];
    var cajas = document.querySelectorAll('#bxp-columnas input[type=checkbox]');
    for (var i = 0; i < cajas.length; i++) {
      if (!cajas[i].checked) continue;
      for (var j = 0; j < F.columnas.length; j++) {
        if (F.columnas[j].k === cajas[i].value) out.push(F.columnas[j]);
      }
    }
    return out;
  }

  /* ══════════════ el modal ══════════════ */

  function crearModal() {
    if ($('modal-bitexp')) return;

    var capa = document.createElement('div');
    capa.id = 'modal-bitexp';
    capa.className = 'hidden';
    capa.setAttribute('role', 'dialog');
    capa.innerHTML =
      '<div class="card narrow bxp-caja">' +
        '<h2 id="bxp-titulo" style="color:var(--primary);margin-top:0;">DESCARGAR BITÁCORAS</h2>' +
        '<p id="bxp-alcance-txt" class="bxp-alcance"></p>' +
        '<div id="bxp-opciones"></div>' +
        '<div class="bxp-cols-cab">' +
          '<label id="bxp-cols-tit">Columnas del expediente</label>' +
          '<div class="bxp-cols-acc">' +
            '<button type="button" id="btn-bxp-todas" class="bxp-mini" data-salida="1">Todas</button>' +
            '<button type="button" id="btn-bxp-ninguna" class="bxp-mini" data-salida="1">Ninguna</button>' +
          '</div>' +
        '</div>' +
        '<p class="bxp-nota" id="bxp-nota-fijas"></p>' +
        '<div id="bxp-columnas" class="bxp-columnas"></div>' +
        '<p id="bxp-conteo" class="bxp-conteo"></p>' +
        '<p id="bxp-avance" class="bxp-avance"></p>' +
        '<div class="btn-row bxp-botones" style="margin-top:14px;">' +
          '<button id="btn-bxp-excel" class="btn-primary">DESCARGAR EXCEL</button>' +
          '<button id="btn-bxp-pdf" class="bxp-btn-pdf">DESCARGAR PDF</button>' +
          '<button id="btn-bxp-cerrar" class="danger">CERRAR</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(capa);

    $('btn-bxp-cerrar').addEventListener('click', cerrar);
    $('btn-bxp-todas').addEventListener('click', function () { marcarTodas(true); });
    $('btn-bxp-ninguna').addEventListener('click', function () { marcarTodas(false); });
    $('btn-bxp-excel').addEventListener('click', function () { descargar('excel'); });
    $('btn-bxp-pdf').addEventListener('click', function () { descargar('pdf'); });

    $('bxp-opciones').addEventListener('change', function (ev) {
      var t = ev && ev.target;
      if (t && t.id === 'bxp-fechas') {
        var caja = $('bxp-fechas-bloque');
        if (caja) caja.classList.toggle('bxp-off', !t.checked);
      }
      pintarConteo();
    });
    $('bxp-opciones').addEventListener('input', pintarConteo);
    $('bxp-columnas').addEventListener('change', pintarConteo);

    /* Que cierre con clic fuera, como los demás modales (Fase 3). */
    try { if (window.BV && window.BV._cierres) window.BV._cierres['modal-bitexp'] = ['btn-bxp-cerrar']; }
    catch (_) {}
  }

  function marcarTodas(valor) {
    var cajas = document.querySelectorAll('#bxp-columnas input[type=checkbox]');
    for (var i = 0; i < cajas.length; i++) cajas[i].checked = valor;
    pintarConteo();
  }

  function pintarColumnas() {
    var cont = $('bxp-columnas');
    cont.innerHTML = '';
    var previas = guardadas();

    for (var i = 0; i < F.columnas.length; i++) {
      var col = F.columnas[i];
      var id = 'bxp-c-' + col.k;

      var fila = document.createElement('label');
      fila.className = 'bxp-col';
      fila.setAttribute('for', id);

      var caja = document.createElement('input');
      caja.type = 'checkbox';
      caja.id = id;
      caja.value = col.k;
      caja.checked = previas ? (previas.indexOf(col.k) !== -1) : col.def;

      var t = document.createElement('span');
      t.textContent = col.t;

      fila.appendChild(caja);
      fila.appendChild(t);
      cont.appendChild(fila);
    }
  }

  function pintarOpciones() {
    var cont = $('bxp-opciones');
    cont.innerHTML = '';

    var hoy = new Date();
    var primero = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    var html = '';

    /* ── de quién ── */
    if (autorFijo !== null) {
      html += '<p class="bxp-nota bxp-fijo">' +
        (autorFijo
          ? (F.autorTxt ? escapar(F.autorTxt(autorFijo)).replace(escapar(autorFijo), '<b>' + escapar(autorFijo) + '</b>') + '.'
                        : 'Se descargan las ' + escapar(F.cosas || 'anotaciones') + ' de <b>' + escapar(autorFijo) + '</b>.')
          : 'Se descargan <b>todas</b> las ' + escapar(F.sinFecha ? 'solicitudes' : (F.cosas || 'anotaciones')) + '.') +
        ' Para cambiarlo, cierra y elige otro en el listado.</p>';
    } else if (mando()) {
      html +=
        '<div class="bxp-bloque">' +
          '<div class="bxp-tit">' + escapar(cap(F.cosas || 'anotaciones')) + '</div>' +
          '<label class="bxp-radio" for="bxp-autor-todas">' +
            '<input type="radio" name="bxp-autor" id="bxp-autor-todas" value="todas" checked>' +
            '<span>' + escapar(F.todasTxt || ('Todas las ' + (F.cosas || 'anotaciones'))) + '</span></label>' +
          '<label class="bxp-radio" for="bxp-autor-mias">' +
            '<input type="radio" name="bxp-autor" id="bxp-autor-mias" value="mias">' +
            '<span>' + escapar(F.miasTxt || 'Solo las mías') + '</span></label>' +
        '</div>';
    } else {
      html += '<p class="bxp-nota bxp-fijo">Se descargan <b>solo tus ' + escapar(F.sinFecha ? 'solicitudes' : (F.cosas || 'anotaciones')) + '</b>.</p>';
    }

    /* ── alcance ── */
    if (!expFijo) {
      html +=
        '<div class="bxp-bloque">' +
          '<div class="bxp-tit">Alcance</div>' +
          '<label class="bxp-radio" for="bxp-alc-pantalla">' +
            '<input type="radio" name="bxp-alcance" id="bxp-alc-pantalla" value="pantalla" checked>' +
            '<span>' + escapar(F.enPantalla) + ' <i id="bxp-n-pantalla"></i></span></label>' +
          '<label class="bxp-radio" for="bxp-alc-todo">' +
            '<input type="radio" name="bxp-alcance" id="bxp-alc-todo" value="todo">' +
            '<span>' + escapar(F.enTodo) + ' <i id="bxp-n-todo"></i></span></label>' +
          '<p class="bxp-nota">«' + escapar(F.enPantalla) + '» respeta las pastillas, los filtros y el ' +
            'buscador que tengas puestos ahora mismo.</p>' +
        '</div>';
    }

    /* ── 14/09 · las que no tienen autor registrado ── */
    if (F.sinAutor) {
      var nSA = cuantasSinAutor();
      html +=
        '<div class="bxp-bloque">' +
          '<label class="bxp-check" for="bxp-sinautor">' +
            '<input type="checkbox" id="bxp-sinautor" checked>' +
            '<span>Incluir las que no tienen autor registrado ' +
              '(<b>' + nSA.toLocaleString('es-CO') + '</b>)</span>' +
          '</label>' +
          '<p class="bxp-nota">Son expedientes que ya tenían actuación antes de que la app ' +
            'guardara quién la pone. Salen con <b>—</b> en la fecha y <b>SIN AUTOR</b>, y con la ' +
            'actuación que tienen hoy. Si eliges un rango de fechas quedan fuera: sin fecha, ' +
            'una fila no puede estar dentro de un rango.</p>' +
        '</div>';
    }

    /* ── 17/09 · los mensajes sin fecha (SOLICITUDES) ── */
    if (F.sinFecha) {
      html +=
        '<div class="bxp-bloque">' +
          '<label class="bxp-check" for="bxp-sinfecha">' +
            '<input type="checkbox" id="bxp-sinfecha" checked>' +
            '<span>Incluir los mensajes sin fecha (<b id="bxp-n-sinfecha">0</b>)</span>' +
          '</label>' +
          '<p class="bxp-nota">Son los mensajes que se escribieron antes de que la app guardara ' +
            'la fecha. Salen con <b>SIN FECHA</b>. Si eliges un rango de fechas quedan fuera: ' +
            'sin fecha, un mensaje no puede estar dentro de un rango.</p>' +
        '</div>';
    }

    /* ── rango de fechas ── */
    html +=
      '<div class="bxp-bloque bxp-off" id="bxp-fechas-bloque">' +
        '<label class="bxp-check" for="bxp-fechas">' +
          '<input type="checkbox" id="bxp-fechas">' +
          '<span>Solo un rango de fechas (opcional)</span>' +
        '</label>' +
        '<div class="bxp-rango">' +
          '<div><label for="bxp-fechas-desde">Desde</label>' +
            '<input type="date" id="bxp-fechas-desde" value="' + hoyISO(primero) + '"></div>' +
          '<div><label for="bxp-fechas-hasta">Hasta</label>' +
            '<input type="date" id="bxp-fechas-hasta" value="' + hoyISO(hoy) + '"></div>' +
        '</div>' +
        '<p class="bxp-nota">Se mira la fecha de cada <b>' +
          escapar((F.cosa || 'anotación').toUpperCase()) + '</b>, no la del expediente.</p>' +
      '</div>';

    cont.innerHTML = html;

    if (!expFijo) {
      var p = $('bxp-n-pantalla'), t = $('bxp-n-todo');
      var nPant = leer(F.pantalla);
      if (!nPant.length) nPant = leer(F.todo);
      if (p) p.textContent = '(' + nPant.length.toLocaleString('es-CO') + ')';
      if (t) t.textContent = '(' + leer(F.todo).length.toLocaleString('es-CO') + ')';
    }
  }

  function pintarConteo() {
    var el = $('bxp-conteo');
    if (!el) return;
    var nsf = $('bxp-n-sinfecha');
    if (nsf) nsf.textContent = cuantasSinFecha().toLocaleString('es-CO');
    var d = recolectar();
    if (d === null) { el.textContent = ''; return; }
    if (!d.items.length) {
      el.textContent = 'Con lo que elegiste no queda ninguna ' + (F.cosa || 'anotación') + ' para descargar.';
      return;
    }
    var texto = 'Se van a descargar ' + d.items.length.toLocaleString('es-CO') + ' ' +
      (d.items.length === 1 ? (F.cosa || 'anotación') : (F.cosas || 'anotaciones')) +
      ' de ' + d.expedientes.toLocaleString('es-CO') +
      ' ' + (d.expedientes === 1 ? F.uno : F.varios) + '.';

    /* Aviso del tamaño del PDF. La fórmula sale de medir el PDF de verdad con
       estos mismos datos: 200 exp/270 anot = 28 págs · 800/1.087 = 110 ·
       1.927/2.540 = 261. Sale ~1 página por cada 17 entre expedientes y
       anotaciones. El Excel no tiene este problema y por eso no se avisa. */
    var pags = Math.ceil((d.expedientes + d.items.length) * 0.06);
    if (pags > 20) {
      texto += ' En PDF serían unas ' + pags.toLocaleString('es-CO') +
               ' páginas: si es para imprimir, conviene un rango de fechas.';
    }
    el.textContent = texto;
  }

  function abrir(fila, vista, opciones) {
    if (vista && FUENTES[vista]) F = FUENTES[vista];
    expFijo = fila || null;
    opciones = opciones || {};
    /* `autor` puede venir como '' (todas) y eso NO es lo mismo que no venir. */
    autorFijo = Object.prototype.hasOwnProperty.call(opciones, 'autor')
      ? String(opciones.autor == null ? '' : opciones.autor)
      : null;
    crearModal();

    $('bxp-titulo').textContent = expFijo
      ? F.tituloUno
      : (F.tituloModal || ('DESCARGAR ' + (F.cosas || 'anotaciones').toUpperCase()));
    $('bxp-alcance-txt').innerHTML = expFijo
      ? escapar(F.titulo(expFijo) || 'Sin número') + ' — ' + escapar(F.quien(expFijo))
      : ('Una fila por ' + (F.cosa || 'anotación') + ', con ' +
         (F.uno === 'asignación' ? 'la asignación' : 'el expediente') + ' al lado.');

    var notaFijas = $('bxp-nota-fijas');
    if (notaFijas) {
      notaFijas.innerHTML = 'Cada fila lleva siempre <b>FECHA</b>, <b>AUTOR</b> y <b>' +
        escapar(F.etiqueta || 'ANOTACIÓN') + '</b>. Lo que marques aquí se agrega al lado.';
    }

    var cabCols = $('bxp-cols-tit');
    if (cabCols) cabCols.textContent = 'Columnas de ' + (F.uno === 'asignación' ? 'la asignación' : 'del expediente');

    pintarOpciones();
    pintarColumnas();
    avance('');
    pintarConteo();

    $('modal-bitexp').classList.remove('hidden');
  }

  function cerrar() {
    if (bajando) return;                 /* no dejar el archivo a medias */
    var m = $('modal-bitexp');
    if (m) m.classList.add('hidden');
    expFijo = null;
    autorFijo = null;
  }

  /* ══════════════ librerías (perezosas) ══════════════ */

  function cargarScript(url, listo) {
    if (listo()) return Promise.resolve(true);
    return new Promise(function (ok) {
      var s = document.createElement('script');
      s.src = url;
      s.onload = function () { ok(listo()); };
      s.onerror = function () { ok(false); };
      document.head.appendChild(s);
    });
  }

  function cargarXLSX() {
    return cargarScript(CDN_XLSX, function () { return !!window.XLSX; });
  }

  function cargarJSPDF() {
    return cargarScript(CDN_JSPDF, function () {
      return !!(window.jspdf && window.jspdf.jsPDF);
    });
  }

  /* ══════════════ la descarga ══════════════ */

  function descargar(formato) {
    if (bajando) return;

    var d = recolectar();
    if (d === null) {
      avisar('error', 'No se puede leer la bitácora',
             'Falta js/bitacora.js. Recarga la app e inténtalo otra vez.');
      return;
    }
    if (!d.items.length) {
      avisar('info', 'No hay ' + (F.cosas || 'anotaciones') + ' para descargar',
             'Con el alcance y las fechas que elegiste no quedó ninguna.');
      return;
    }

    var cols = columnasMarcadas();
    guardar(cols.map(function (c) { return c.k; }));

    bajando = true;
    $('btn-bxp-excel').disabled = true;
    $('btn-bxp-pdf').disabled = true;
    avance('Armando el archivo…');

    var trabajo = (formato === 'pdf')
      ? escribirPDF(d, cols)
      : escribirExcel(d, cols);

    trabajo.then(function () {
      avance(d.items.length.toLocaleString('es-CO') + ' ' +
             (F.cosas || 'anotaciones') + ' descargadas.');
    }).catch(function (e) {
      avisar('error', 'No se pudo descargar', (e && e.message) ? e.message : String(e));
    }).then(function () {
      bajando = false;
      var a = $('btn-bxp-excel'), b = $('btn-bxp-pdf');
      if (a) a.disabled = false;
      if (b) b.disabled = false;
    });
  }

  function baseNombre() {
    if (expFijo) return F.archivoUno + (F.titulo(expFijo) || F.varios.toUpperCase());
    return F.archivoVar;
  }

  function descripcionAlcance() {
    if (expFijo) {
      var cab = F.uno.charAt(0).toUpperCase() + F.uno.slice(1);
      return cab + ' ' + (F.titulo(expFijo) || '—') + ' — ' + F.quien(expFijo);
    }
    var quiero = (document.querySelector('input[name="bxp-alcance"]:checked') || {}).value || 'pantalla';
    return quiero === 'todo' ? F.todoTxt : F.pantallaTxt;
  }

  function descripcionAutor() {
    var a = autorElegido();
    if (typeof F.autorTxt === 'function') return F.autorTxt(a);
    var c = cap(F.cosas || 'anotaciones');
    return a ? (c + ' de ' + a) : (c + ' de todos los autores');
  }

  function cap(s) {
    s = String(s || '');
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  function descripcionRango() {
    var r = rangoElegido();
    if (!r.desde && !r.hasta) return 'Sin rango de fechas';
    var f = function (n) {
      if (!n) return '—';
      var s = String(n);
      return s.slice(6, 8) + '/' + s.slice(4, 6) + '/' + s.slice(0, 4);
    };
    return 'Del ' + f(r.desde) + ' al ' + f(r.hasta);
  }

  /* ── Excel: plano, una fila por anotación, de la más nueva a la más vieja ── */

  function escribirExcel(d, cols) {
    var items = d.items.slice().sort(function (a, b) {
      if (b.dia !== a.dia) return b.dia - a.dia;
      var x = F.titulo(a.fila), y = F.titulo(b.fila);
      if (x !== y) return x < y ? -1 : 1;
      /* 17/09 — dentro de la misma conversación y el mismo día manda la
         misma regla del archivo: de la más nueva a la más vieja (la
         respuesta encima de su solicitud). */
      return (b.orden || 0) - (a.orden || 0);
    });

    /* 14/09 — era fijo 'ANOTACIÓN': en el Excel de ACTUACIONES la tercera
       columna decía lo que no era. */
    var encabezados = ['FECHA', 'AUTOR', F.etiqueta || 'ANOTACIÓN'];
    for (var i = 0; i < cols.length; i++) encabezados.push(cols[i].t);

    var filas = items.map(function (it) {
      /* 14/09 — el Excel dejaba el AUTOR en blanco donde el PDF ya escribía
         SIN AUTOR. Ahora los dos dicen lo mismo. */
      var f = [it.fecha, it.autor || 'SIN AUTOR', it.texto];
      for (var j = 0; j < cols.length; j++) f.push(valorCol(it.fila, cols[j], it));
      return f;
    });

    return cargarXLSX().then(function (hay) {
      if (!hay) return escribirCSV(encabezados, filas);

      var hoja = window.XLSX.utils.aoa_to_sheet([encabezados].concat(filas));
      hoja['!cols'] = anchos(encabezados, filas);
      hoja['!freeze'] = { xSplit: 0, ySplit: 1 };

      var libro = window.XLSX.utils.book_new();
      window.XLSX.utils.book_append_sheet(libro, hoja,
        (F.cosas || 'anotaciones').toUpperCase().slice(0, 31));
      window.XLSX.writeFile(libro, nombreArchivo(baseNombre(), 'xlsx'));
      return true;
    });
  }

  function anchos(encabezados, filas) {
    var out = [];
    for (var c = 0; c < encabezados.length; c++) {
      var max = String(encabezados[c] || '').length;
      var tope = Math.min(filas.length, 200);
      for (var i = 0; i < tope; i++) {
        var n = String(filas[i][c] == null ? '' : filas[i][c]).length;
        if (n > max) max = n;
      }
      /* La ANOTACIÓN es la columna larga: se le deja más aire que a las demás */
      var techo = (c === 2) ? 70 : 45;
      out.push({ wch: Math.min(Math.max(max + 2, 10), techo) });
    }
    return out;
  }

  function escribirCSV(encabezados, filas) {
    var esc = function (v) {
      var s = String(v == null ? '' : v);
      return /[";\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    var lineas = [encabezados.map(esc).join(';')];
    for (var i = 0; i < filas.length; i++) lineas.push(filas[i].map(esc).join(';'));

    var blob = new Blob(['\ufeff' + lineas.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    bajarBlob(blob, nombreArchivo(baseNombre(), 'csv'));

    avisar('info', 'Se descargó en CSV',
           'No se pudo cargar la librería de Excel. El CSV abre en Excel con doble clic.');
    return true;
  }

  function bajarBlob(blob, nombre) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = nombre;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  /* ── PDF: agrupado por expediente, que es como se lee una bitácora ── */

  /** Agrupa por expediente. Dentro de cada uno, en orden cronológico
   *  (de la más vieja a la más nueva); los expedientes se ordenan por su
   *  anotación más reciente. */
  function agrupar(items) {
    var mapa = {}, orden = [];
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      var clave = F.id(it.fila) || ('#' + i);
      if (!mapa[clave]) {
        mapa[clave] = {
          clave: clave,
          titulo: F.titulo(it.fila),
          fila: it.fila, anot: [], ultimo: 0
        };
        orden.push(clave);
      }
      mapa[clave].anot.push(it);
      if (it.dia > mapa[clave].ultimo) mapa[clave].ultimo = it.dia;
    }
    var grupos = orden.map(function (k) { return mapa[k]; });
    grupos.sort(function (a, b) { return b.ultimo - a.ultimo; });
    grupos.forEach(function (g) {
      g.anot.sort(function (a, b) {
        /* 17/09 — en SOLICITUDES manda el orden de la conversación: los
           mensajes viejos sin fecha (dia 0) van antes que los fechados, y a
           igual día, la solicitud antes que su respuesta. */
        if (F.sinFecha) return (a.orden || 0) - (b.orden || 0);
        return a.dia - b.dia;
      });
    });
    return grupos;
  }

  /** El icono de la app como dataURL, para el encabezado del PDF. Es un
   *  archivo del propio repo (ya en la caché del service worker), no una
   *  imagen de fuera: si falla, el PDF sale igual, sin escudo. */
  function iconoDataURL() {
    return fetch(ICONO)
      .then(function (r) { return r.ok ? r.blob() : null; })
      .then(function (b) {
        if (!b) return null;
        return new Promise(function (ok) {
          var fr = new FileReader();
          fr.onload = function () { ok(String(fr.result)); };
          fr.onerror = function () { ok(null); };
          fr.readAsDataURL(b);
        });
      })
      .catch(function () { return null; });
  }

  function escribirPDF(d, cols) {
    var grupos = agrupar(d.items);

    return Promise.all([cargarJSPDF(), iconoDataURL()]).then(function (res) {
      if (!res[0]) return imprimirHTML(grupos, cols, d);
      return dibujarPDF(grupos, cols, d, res[1]);
    });
  }

  function dibujarPDF(grupos, cols, d, icono) {
    var jsPDF = window.jspdf.jsPDF;
    var doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });

    var M = 14;                       /* margen */
    var W = 210, H = 297;
    var ANCHO = W - M * 2;
    var y = 0;
    var VERDE = [6, 64, 43];
    var GRIS  = [107, 124, 116];

    function cabecera() {
      doc.setFillColor(VERDE[0], VERDE[1], VERDE[2]);
      doc.rect(0, 0, W, 22, 'F');
      if (icono) {
        try { doc.addImage(icono, 'PNG', M, 4, 14, 14); } catch (_) {}
      }
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.text('ALCALDÍA MUNICIPAL DE FLANDES — TOLIMA', M + (icono ? 18 : 0), 10);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.text(F.subtitulo, M + (icono ? 18 : 0), 15.5);
      doc.setTextColor(0, 0, 0);
      y = 30;
    }

    function pieDeTodas() {
      var total = doc.internal.getNumberOfPages();
      for (var p = 1; p <= total; p++) {
        doc.setPage(p);
        doc.setDrawColor(220, 226, 223);
        doc.line(M, H - 14, W - M, H - 14);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(GRIS[0], GRIS[1], GRIS[2]);
        doc.text('Generado desde la app SEC-HACIENDA · ' + selloLargo(), M, H - 9);
        doc.text('Página ' + p + ' de ' + total, W - M, H - 9, { align: 'right' });
        doc.setTextColor(0, 0, 0);
      }
    }

    function espacio(alto) {
      if (y + alto <= H - 18) return;
      doc.addPage();
      cabecera();
    }

    cabecera();

    /* ── portada de la primera página ── */
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.setTextColor(VERDE[0], VERDE[1], VERDE[2]);
    doc.text(expFijo ? F.tituloUno : F.tituloVar, M, y);
    doc.setTextColor(0, 0, 0);
    y += 7;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    var meta = [
      descripcionAlcance(),
      descripcionAutor(),
      descripcionRango(),
      d.items.length.toLocaleString('es-CO') + ' ' +
        (d.items.length === 1 ? (F.cosa || 'anotación') : (F.cosas || 'anotaciones')) + ' en ' +
        d.expedientes.toLocaleString('es-CO') + ' ' +
        (d.expedientes === 1 ? F.uno : F.varios),
      'Generado por ' + (miNombre() || '—') + ' el ' + selloLargo()
    ];
    for (var i = 0; i < meta.length; i++) {
      /* splitTextToSize corta con la fuente que esté puesta EN ESE MOMENTO:
         si se corta con un tamaño y se dibuja con otro, el texto se sale del
         margen. Por eso la fuente se fija SIEMPRE antes de cortar. */
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      var lineas = doc.splitTextToSize(meta[i], ANCHO);
      doc.text(lineas, M, y);
      y += lineas.length * 4.4;
    }
    y += 3;
    doc.setDrawColor(VERDE[0], VERDE[1], VERDE[2]);
    doc.setLineWidth(0.6);
    doc.line(M, y, W - M, y);
    doc.setLineWidth(0.2);
    y += 7;

    /* ── grupos ── */
    for (var g = 0; g < grupos.length; g++) {
      var gr = grupos[g];

      espacio(24);

      /* barra del expediente */
      doc.setFillColor(233, 240, 236);
      doc.rect(M, y - 4.6, ANCHO, 8, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(VERDE[0], VERDE[1], VERDE[2]);
      var tituloG = F.prefijo + gr.titulo;
      var nom = F.quien(gr.fila);
      if (nom) tituloG += '  —  ' + nom;
      doc.text(doc.splitTextToSize(tituloG, ANCHO - 4)[0], M + 2, y);   /* fuente ya fijada arriba */
      doc.setTextColor(0, 0, 0);
      y += 7;

      /* datos del expediente (las columnas marcadas), en dos columnas */
      var pares = [];
      for (var c = 0; c < cols.length; c++) {
        if (F.arriba.indexOf(cols[c].k) !== -1) continue;   /* ya van arriba */
        var v = valorCol(gr.fila, cols[c]);
        if (cols[c].num) { if (!v) continue; v = pesos(v); }
        if (!txt(v)) continue;
        pares.push([cols[c].t, String(v)]);
      }
      if (pares.length) {
        doc.setFontSize(8);
        var colW = ANCHO / 2;
        for (var p2 = 0; p2 < pares.length; p2 += 2) {
          espacio(6);
          for (var lado = 0; lado < 2 && (p2 + lado) < pares.length; lado++) {
            var x = M + lado * colW;
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(GRIS[0], GRIS[1], GRIS[2]);
            doc.text(pares[p2 + lado][0] + ': ', x, y);
            var wl = doc.getTextWidth(pares[p2 + lado][0] + ': ');
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            doc.setTextColor(0, 0, 0);
            doc.text(doc.splitTextToSize(pares[p2 + lado][1], colW - wl - 4)[0], x + wl, y);
          }
          y += 4.4;
        }
        y += 1.5;
      }

      /* anotaciones */
      for (var a = 0; a < gr.anot.length; a++) {
        var it = gr.anot[a];

        /* Cada texto se corta con la MISMA fuente con la que se va a dibujar.
           La cabecera también se corta: en las anotaciones mal escritas (las
           que llevan el texto ANTES de la fecha) el "autor" es un párrafo
           entero y sin cortar se salía de la hoja. */
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        var cabeza = doc.splitTextToSize(
          it.fecha + '  ·  ' + (it.autor || 'SIN AUTOR') + (it.tipo ? '  ·  ' + it.tipo : ''), ANCHO - 6);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        var cuerpo = doc.splitTextToSize(it.texto || '(sin texto)', ANCHO - 6);

        espacio(cabeza.length * 4.4 + cuerpo.length * 4.2 + 4);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(VERDE[0], VERDE[1], VERDE[2]);
        doc.text(cabeza, M + 3, y);
        doc.setTextColor(0, 0, 0);
        y += cabeza.length * 4.4;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.text(cuerpo, M + 3, y);
        y += cuerpo.length * 4.2 + 3;
      }

      y += 3;
    }

    pieDeTodas();
    doc.save(nombreArchivo(baseNombre(), 'pdf'));
    return true;
  }

  /** Respaldo si no se pudo bajar jsPDF: se abre el mismo contenido en una
   *  ventana lista para imprimir. Tanto el móvil como el PC ofrecen ahí
   *  "Guardar como PDF", así nadie se queda sin su archivo. */
  function imprimirHTML(grupos, cols, d) {
    var html =
      '<!doctype html><html lang="es"><head><meta charset="utf-8">' +
      '<title>' + escapar(baseNombre()) + '</title><style>' +
      'body{font-family:Helvetica,Arial,sans-serif;color:#0f1f16;margin:24px;}' +
      'h1{color:#06402B;font-size:18px;margin:0 0 8px;}' +
      '.meta{font-size:12px;color:#3d5248;margin-bottom:4px;}' +
      'hr{border:0;border-top:2px solid #06402B;margin:14px 0;}' +
      '.g{margin:0 0 18px;page-break-inside:avoid;}' +
      '.gt{background:#e9f0ec;color:#06402B;font-weight:700;padding:6px 8px;font-size:13px;}' +
      '.gd{font-size:11px;color:#6b7c74;padding:6px 8px 0;}' +
      '.a{padding:6px 8px 0;}' +
      '.af{font-weight:700;color:#06402B;font-size:11px;}' +
      '.at{font-size:12px;white-space:pre-wrap;margin:2px 0 0;}' +
      '</style></head><body>' +
      '<h1>' + escapar(expFijo ? F.tituloUno : F.tituloVar) + '</h1>' +
      '<div class="meta">' + escapar(descripcionAlcance()) + '</div>' +
      '<div class="meta">' + escapar(descripcionAutor()) + '</div>' +
      '<div class="meta">' + escapar(descripcionRango()) + '</div>' +
      '<div class="meta">' + d.items.length + ' ' + escapar(d.items.length === 1 ? (F.cosa || 'anotación') : (F.cosas || 'anotaciones')) +
        ' en ' + d.expedientes + ' ' + F.varios + '</div>' +
      '<div class="meta">Generado por ' + escapar(miNombre() || '—') + ' el ' + escapar(selloLargo()) + '</div>' +
      '<hr>';

    for (var g = 0; g < grupos.length; g++) {
      var gr = grupos[g];
      html += '<div class="g"><div class="gt">' + escapar(F.prefijo + gr.titulo) +
              (F.quien(gr.fila) ? ' &mdash; ' + escapar(F.quien(gr.fila)) : '') + '</div>';

      var datos = [];
      for (var c = 0; c < cols.length; c++) {
        if (F.arriba.indexOf(cols[c].k) !== -1) continue;
        var v = valorCol(gr.fila, cols[c]);
        if (cols[c].num) { if (!v) continue; v = pesos(v); }
        if (!txt(v)) continue;
        datos.push(escapar(cols[c].t) + ': ' + escapar(String(v)));
      }
      if (datos.length) html += '<div class="gd">' + datos.join(' &nbsp;·&nbsp; ') + '</div>';

      for (var a = 0; a < gr.anot.length; a++) {
        html += '<div class="a"><div class="af">' + escapar(gr.anot[a].fecha) + ' &middot; ' +
                escapar(gr.anot[a].autor || 'SIN AUTOR') +
                (gr.anot[a].tipo ? ' &middot; ' + escapar(gr.anot[a].tipo) : '') + '</div>' +
                '<p class="at">' + escapar(gr.anot[a].texto || '(sin texto)') + '</p></div>';
      }
      html += '</div>';
    }
    html += '</body></html>';

    var v = window.open('', '_blank');
    if (!v) {
      avisar('warning', 'No se pudo abrir la ventana de impresión',
             'Permite las ventanas emergentes o descárgalo en Excel.');
      return true;
    }
    v.document.write(html);
    v.document.close();
    setTimeout(function () { try { v.focus(); v.print(); } catch (_) {} }, 400);

    avisar('info', 'Se abrió para imprimir',
           'No se pudo cargar la librería de PDF. En la ventana que se abrió elige "Guardar como PDF".');
    return true;
  }

  /* ══════════════ los botones ══════════════ */

  /** La pastilla de la vista, al lado de las dos del lote 06/09. */
  function pintarPastilla(vista) {
    /* 14/09 — si js/mi-trabajo.js montó, las entradas viven dentro de su
       modal y esta pastilla no se pinta (era la tercera de la fila). Si ese
       archivo no cargó, se pinta como siempre: nadie se queda sin descarga. */
    if (window.MITRABAJO && window.MITRABAJO.gobierna) return;
    var def = FUENTES[vista];
    if (!def || def.oculto()) return;
    if ($(def.pastilla)) return;

    var b = document.createElement('button');
    b.type = 'button';
    b.id = def.pastilla;
    b.className = 'proc-status-pill bxp-pill';
    b.setAttribute('data-salida', '1');
    b.innerHTML = '📥 DESCARGAR BITÁCORAS';
    b.addEventListener('click', function () {
      try { if (window.playSoundOnce && window.SOUNDS) window.playSoundOnce(window.SOUNDS.menu); } catch (_) {}
      abrir(null, vista);
    });

    /* Primero se intenta junto a las pastillas del lote 06/09; si ese lote
       no montó, se cuelga del mismo sitio donde va aquella fila. */
    var wrap = $(def.wrap);
    if (wrap) { wrap.appendChild(b); return; }

    var ancla = $(def.ancla);
    if (!ancla || !ancla.parentNode) return;
    var propio = document.createElement('div');
    propio.className = 'bit-wrap bxp-wrap';
    propio.id = def.pastilla + '-wrap';
    propio.appendChild(b);
    ancla.parentNode.insertBefore(propio, ancla.nextSibling);
  }

  /** El botón dentro del Ver de un expediente / de una asignación. */
  function engancharDetalle() {
    for (var vista in FUENTES) {
      if (!Object.prototype.hasOwnProperty.call(FUENTES, vista)) continue;
      engancharUno(vista);
    }
  }

  function engancharUno(vista) {
    var def = FUENTES[vista];
    if (!def.detalle) return;      /* la fuente de ACTUACIONES no cuelga del Ver */
    var original = window[def.detalle];
    if (typeof original !== 'function' || original.__bxp) return;
    var envuelta = function (row) {
      var r = original.apply(this, arguments);
      try { botonDetalle(row, vista); } catch (e) { console.warn('BITEXPORT:', e); }
      return r;
    };
    envuelta.__bxp = true;
    window[def.detalle] = envuelta;
  }

  function botonDetalle(row, vista) {
    var def = FUENTES[vista || 'view-bd-predial'];
    if (!def || def.oculto()) return;
    var acciones = $(def.acciones);
    if (!acciones || !row) return;
    if (!txt(row.bitacora)) return;          /* sin bitácora no hay qué bajar */
    if ($('btn-bxp-exp')) return;            /* app.js ya limpió el contenedor */

    var b = document.createElement('button');
    b.type = 'button';
    b.id = 'btn-bxp-exp';
    b.className = 'proc-action-btn bxp-btn-exp';
    b.setAttribute('data-salida', '1');
    b.innerHTML = '🗒️ BITÁCORA';
    b.addEventListener('click', function () {
      try { if (window.playSoundOnce && window.SOUNDS) window.playSoundOnce(window.SOUNDS.menu); } catch (_) {}
      abrir(row, def === FUENTES['view-asignaciones'] ? 'view-asignaciones' : 'view-bd-predial');
    });
    acciones.appendChild(b);
  }

  function alEntrar(vista) {
    if (!FUENTES[vista]) return;
    pintarPastilla(vista);
  }

  function engancharVistas() {
    var original = window.showView;
    if (typeof original !== 'function' || original.__bxp) return;
    var envuelta = function (id) {
      var r = original.apply(this, arguments);
      try { alEntrar(id); } catch (e) { console.warn('BITEXPORT:', e); }
      return r;
    };
    envuelta.__bxp = true;
    window.showView = envuelta;
  }

  function arrancar() {
    engancharVistas();
    engancharDetalle();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', arrancar);
  else arrancar();

  /* Otras capas también envuelven showView y app.js define abrirBDPDetalle_
     al final de su archivo: se vuelve a enganchar por si alguna llegó
     después. Es idempotente (marca __bxp). */
  setTimeout(arrancar, 1500);

  /* Puerta para las pruebas. */
  window.BITEXPORT = {
    abrir: abrir,
    cerrar: cerrar,
    recolectar: recolectar,
    agrupar: agrupar,
    columnas: columnasMarcadas,
    catalogo: function (vista) { return (FUENTES[vista] || F).columnas; },
    fuentes: FUENTES,
    vista: function () { return F === FUENTES['view-asignaciones'] ? 'view-asignaciones' : 'view-bd-predial'; },
    montar: alEntrar,
    botonDetalle: botonDetalle,
    ficha: ficha,
    expediente: function () { return expFijo; }
  };
})();
