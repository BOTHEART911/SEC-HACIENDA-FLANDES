/* SEC-HACIENDA-FLANDES · BASE SEMBRADA DEL ASISTENTE (24/10/2026)
   Respaldo embebido: la usa el asistente la primera vez y en la entrada.
   La de verdad vive en el backend HACIENDA (hoja ASISTENTE_TEMAS) y se
   edita en la vista ENTRENAMIENTO (solo DEV); cuando cambia, llega con el
   arranque y reemplaza esta en el teléfono.
   Generado desde la semilla (generar.py): no se edita a mano. */
window.AYUDA_BASE = [
{
"id": "HC-INICIO",
"app": "HACIENDA",
"vista": "",
"titulo": "Ir al inicio",
"frases": [
"ir al inicio",
"volver al inicio",
"pantalla principal",
"menu principal",
"regresar al menu",
"donde estan los botones"
],
"respuesta": "Te llevo a tu **inicio**: ahí están tus tarjetas por bloques (Predial, Industria y Comercio, Gestión y La app). Solo ves las de tu rol.",
"accion": "ir:inicio",
"estado": "",
"activo": true,
"orden": 1
},
{
"id": "HC-QUE-ME-TOCA",
"app": "HACIENDA",
"vista": "inicio,asignaciones,bd-predial,lista,ica-req",
"titulo": "¿Qué tengo pendiente?",
"frases": [
"que tengo pendiente",
"que me toca hacer",
"que hago primero",
"que es lo mas urgente",
"hay algo urgente",
"por donde empiezo",
"tengo algo vencido",
"que tengo por responder",
"mis pendientes",
"que hay para hoy"
],
"respuesta": "{{queMeToca}}",
"accion": "",
"estado": "",
"activo": true,
"orden": 2
},
{
"id": "HC-MIS-FUNCIONES",
"app": "HACIENDA",
"vista": "inicio,guia",
"titulo": "¿Qué puedo hacer con mi rol?",
"frases": [
"que puedo hacer",
"cuales son mis funciones",
"que hace mi rol",
"para que me sirve la app",
"que permisos tengo",
"que rol tengo",
"por que no veo un boton",
"no me aparece una tarjeta"
],
"respuesta": "{{misFunciones}}\nLa **Guía rápida** se arma con tus roles: solo trae lo que te toca, paso a paso y en PDF.",
"accion": "guia",
"estado": "",
"activo": true,
"orden": 3
},
{
"id": "HC-ROLES",
"app": "HACIENDA",
"vista": "inicio,guia,config",
"titulo": "Los tipos de usuario",
"frases": [
"tipos de usuario",
"que roles hay",
"que hace un abogado",
"que hace el asistente",
"que hace archivo",
"que es el rol tributario",
"que es atencion",
"diferencia entre admin y dev",
"que es el desarrollador"
],
"respuesta": "· **Administrador**: reparte asignaciones y expedientes, ve todo y maneja Configuración (personas, roles y PIN).\n· **Abogado**: sus asignaciones del semáforo y sus expedientes como sustanciador.\n· **Asistente**: apoya al abogado; en la base predial trabaja todos los expedientes repartidos.\n· **Archivo**: ve las asignaciones en solo lectura y responde las solicitudes de expediente.\n· **Atención**: responde las solicitudes de predial que llegan por WhatsApp y registra la atención presencial.\n· **Tributario**: los requerimientos de Industria y Comercio.\n· **Desarrollador**: lo mismo que el administrador, más plantillas, IDs, soportes y el entrenamiento de este asistente.\nUna persona puede tener varios roles: se suman las funciones.",
"accion": "guia",
"estado": "",
"activo": true,
"orden": 4
},
{
"id": "HC-GUIA",
"app": "HACIENDA",
"vista": "",
"titulo": "Guía rápida",
"frases": [
"guia rapida",
"manual",
"instructivo",
"como se usa la app",
"tutorial",
"descargar la guia",
"guia en pdf",
"ayuda de la app"
],
"respuesta": "La **Guía rápida** trae solo tus funciones, paso a paso, con un botón **PDF** para descargarla. Está en la tarjeta del inicio y en el menú de tu foto.",
"accion": "guia",
"estado": "",
"activo": true,
"orden": 5
},
{
"id": "HC-CONSULTAR",
"app": "HACIENDA",
"vista": "lista,atenciones,estadisticas,panel,asignaciones,bd-predial,bdp-panel,drive-anexos",
"titulo": "Consultas de esta vista",
"frases": [
"resumen de lo que veo",
"consultas de esta vista",
"lo que estoy viendo",
"cuantos hay",
"estadisticas de esta vista",
"informe de esta vista",
"resumen en cifras",
"analizar los datos",
"por barrio",
"horas pico",
"carga del equipo"
],
"respuesta": "Las **consultas** resumen en cifras lo que tienes en pantalla, con los filtros puestos: por estado, por persona, por mes, las más antiguas y más. Se calculan en tu equipo, al instante, y las puedes copiar, escuchar o mandar por WhatsApp.",
"accion": "consultas",
"estado": "",
"activo": true,
"orden": 6
},
{
"id": "HC-PIN",
"app": "HACIENDA",
"vista": "",
"titulo": "Cambiar mi PIN",
"frases": [
"cambiar mi pin",
"cambiar el pin",
"cambiar clave",
"cambiar contraseña",
"nuevo pin",
"actualizar mi pin",
"mi llave de entrada"
],
"respuesta": "Tu **PIN** de 4 dígitos es tu llave de entrada. Para cambiarlo te pide el actual; no se aceptan PIN fáciles (1111, 1234) ni uno que ya use otra persona. Te llega un WhatsApp avisando del cambio, sin el PIN.",
"accion": "pin",
"estado": "",
"activo": true,
"orden": 7
},
{
"id": "HC-OLVIDE-PIN",
"app": "HACIENDA",
"vista": "",
"titulo": "Olvidé mi PIN",
"frases": [
"olvide mi pin",
"no me acuerdo del pin",
"perdi el pin",
"recuperar pin",
"me bloquee",
"usuario bloqueado",
"no puedo entrar"
],
"respuesta": "Si no recuerdas tu PIN: en la entrada toca **¿Olvidaste tu PIN?** y te llega al WhatsApp registrado. También un administrador te genera uno nuevo en **Configuración**. Con **5 intentos fallidos** tu usuario queda bloqueado unos minutos.",
"accion": "",
"estado": "",
"activo": true,
"orden": 8
},
{
"id": "HC-FOTO",
"app": "HACIENDA",
"vista": "inicio",
"titulo": "Cambiar mi foto",
"frases": [
"cambiar mi foto",
"foto de perfil",
"poner foto",
"ajustar la foto",
"mi imagen",
"avatar"
],
"respuesta": "Toca tu cara en el saludo del inicio (o **Cambiar foto de perfil** en el menú de tu foto). Desde ahí eliges otra imagen o **Ajustas** la actual: la arrastras y la acercas con la barra.",
"accion": "foto",
"estado": "",
"activo": true,
"orden": 9
},
{
"id": "HC-AVISOS",
"app": "HACIENDA",
"vista": "",
"titulo": "Avisos al teléfono",
"frases": [
"avisos al telefono",
"notificaciones",
"no me llegan avisos",
"activar notificaciones",
"push",
"alertas en el celular"
],
"respuesta": "{{avisosTelefono}}",
"accion": "avisos",
"estado": "",
"activo": true,
"orden": 10
},
{
"id": "HC-INSTALAR",
"app": "HACIENDA",
"vista": "",
"titulo": "Instalar la app",
"frases": [
"instalar la app",
"descargar la app",
"poner la app en el celular",
"icono en la pantalla",
"como la instalo",
"app en el computador"
],
"respuesta": "La app se instala como cualquier otra, desde el menú de tu foto → **Instalar la app**. En iPhone se hace con **Compartir → Agregar a inicio**: te lo muestra paso a paso.",
"accion": "instalar",
"estado": "",
"activo": true,
"orden": 11
},
{
"id": "HC-TEMA",
"app": "HACIENDA",
"vista": "",
"titulo": "Modo oscuro",
"frases": [
"modo oscuro",
"modo claro",
"cambiar colores",
"tema oscuro",
"pantalla negra",
"luna"
],
"respuesta": "El botón de la **luna** (o el sol) en la barra de arriba cambia entre modo claro y oscuro. La app lo recuerda en este equipo.",
"accion": "tema",
"estado": "",
"activo": true,
"orden": 12
},
{
"id": "HC-ACTUALIZA",
"app": "HACIENDA",
"vista": "",
"titulo": "¿Cómo se actualiza la app?",
"frases": [
"actualizar la app",
"nueva version",
"la app esta vieja",
"como se actualiza",
"no veo los cambios",
"version de la app"
],
"respuesta": "No tienes que hacer nada: al abrirla o volver a ella revisa si hay una versión nueva y se recarga sola **una vez**. La versión está en el pie de la app, junto a la firma.",
"accion": "",
"estado": "",
"activo": true,
"orden": 13
},
{
"id": "HC-SIN-RED",
"app": "HACIENDA",
"vista": "",
"titulo": "¿Qué es la barra roja de abajo?",
"frases": [
"barra roja",
"sin conexion",
"no tengo internet",
"internet lento",
"barra ambar",
"se cayo la conexion",
"la app no carga"
],
"respuesta": "La barra **roja** \"Sin conexión\" sale cuando se cae tu internet; lo que estabas haciendo **no se pierde** y, al volver la red, la app vuelve a pedir lo que estaba cargando. Un guardado que ya había salido **no se repite**. La barra **ámbar** avisa que tu internet va lento.\nSi la falla es del servidor, la vista lo dice con su propio mensaje: ahí no es tu conexión.",
"accion": "",
"estado": "",
"activo": true,
"orden": 14
},
{
"id": "HC-SALIR",
"app": "HACIENDA",
"vista": "inicio",
"titulo": "Cambiar de usuario o cerrar sesión",
"frases": [
"cerrar sesion",
"salir de la app",
"cambiar de usuario",
"entrar con otra cuenta",
"otro usuario"
],
"respuesta": "Al final del inicio (y en el menú de tu foto) están **Cambiar de usuario** y **Cerrar sesión**. Tu cuenta queda guardada en el equipo para entrar después solo con el PIN.",
"accion": "",
"estado": "",
"activo": true,
"orden": 15
},
{
"id": "HC-SOPORTE",
"app": "HACIENDA",
"vista": "",
"titulo": "Hablar con soporte",
"frases": [
"hablar con soporte",
"reportar un problema",
"la app no funciona",
"tengo un error",
"algo fallo",
"contactar al desarrollador",
"necesito ayuda de una persona",
"quiero reportar una falla"
],
"respuesta": "En **Soporte** cuentas qué hacías y qué salió, con hasta **3 capturas** (adjuntar, arrastrar o pegar con Ctrl+V). Llega al grupo de desarrollo y ves en qué va en **Ver mis solicitudes**.",
"accion": "soporte",
"estado": "",
"activo": true,
"orden": 16
},
{
"id": "HC-MIS-SOPORTES",
"app": "HACIENDA",
"vista": "",
"titulo": "¿En qué va mi soporte?",
"frases": [
"en que va mi soporte",
"mis solicitudes de soporte",
"como va mi caso de soporte",
"respuesta de soporte",
"estado de mi solicitud de soporte"
],
"respuesta": "{{soportePend}}Abre **Soporte** y toca **Ver mis solicitudes y su respuesta**: ahí está el estado, la respuesta y quién te atendió.",
"accion": "soporte",
"estado": "",
"activo": true,
"orden": 17
},
{
"id": "HC-CALIFICAR",
"app": "HACIENDA",
"vista": "",
"titulo": "Calificar un soporte",
"frases": [
"calificar soporte",
"estrellas",
"calificar la atencion",
"no me resolvieron",
"reabrir soporte"
],
"respuesta": "Cuando tu soporte queda **resuelto** te llega el aviso y, al entrar, calificas de 1 a 5 estrellas. Con **1 o 2 estrellas** el caso se vuelve a abrir con tu comentario.",
"accion": "",
"estado": "",
"activo": true,
"orden": 18
},
{
"id": "HC-GERENCIAL",
"app": "HACIENDA",
"vista": "inicio",
"titulo": "Informe gerencial",
"frases": [
"informe gerencial",
"informe de gestion",
"indicadores",
"pdf con graficas",
"mi gestion del mes",
"informe para el jefe",
"reporte de mi trabajo"
],
"respuesta": "El **Informe gerencial** arma un PDF con indicadores y gráficas de un periodo: eliges **desde y hasta**{{gerencialQuien}} y lo descargas.",
"accion": "ir:gerencial",
"estado": "",
"activo": true,
"orden": 19
},
{
"id": "HC-PENDIENTES",
"app": "HACIENDA",
"vista": "inicio,lista,respuesta,agregar,atenciones,estadisticas",
"titulo": "Solicitudes pendientes de predial",
"frases": [
"solicitudes pendientes",
"pendientes predial",
"solicitudes por whatsapp",
"quien esta esperando respuesta",
"bandeja de entrada",
"solicitudes del chat",
"recibos pendientes"
],
"respuesta": "{{pendientes}}Las solicitudes llegan por WhatsApp y esperan en **Pendientes predial**. Abres la solicitud y respondes con los recibos.",
"accion": "ir:pendientes",
"estado": "",
"activo": true,
"orden": 20
},
{
"id": "HC-RESPONDER",
"app": "HACIENDA",
"vista": "lista,respuesta",
"titulo": "¿Cómo respondo una solicitud?",
"frases": [
"como respondo",
"responder solicitud",
"enviar el recibo",
"adjuntar recibo",
"contestar al contribuyente",
"mandar la factura por whatsapp"
],
"respuesta": "Abre la solicitud en **Pendientes predial**, revisa los datos y responde con los recibos. Si no hace falta recibo, usa otra salida: **AL DÍA**, **NO ENCONTRADO** o **Dar de baja**.",
"accion": "ir:pendientes",
"estado": "",
"activo": true,
"orden": 21
},
{
"id": "HC-AL-DIA",
"app": "HACIENDA",
"vista": "lista,respuesta",
"titulo": "Al día, no encontrado o dar de baja",
"frases": [
"esta al dia",
"no encontrado",
"dar de baja",
"no debe nada",
"no aparece en el sistema",
"solicitud repetida",
"cerrar solicitud sin recibo"
],
"respuesta": "· **AL DÍA**: el predio no debe; se le avisa al contribuyente.\n· **NO ENCONTRADO**: no aparece con los datos que dio.\n· **Dar de baja**: la solicitud no procede (repetida o equivocada).\nCada una cierra la solicitud y queda en **Atenciones registradas**.",
"accion": "",
"estado": "",
"activo": true,
"orden": 22
},
{
"id": "HC-AGREGAR-ATENCION",
"app": "HACIENDA",
"vista": "inicio,agregar,atenciones",
"titulo": "Registrar atención presencial",
"frases": [
"agregar atencion",
"atencion presencial",
"vino una persona",
"registrar atencion en ventanilla",
"contribuyente en persona",
"nueva atencion"
],
"respuesta": "En **Agregar atención predial** registras a quien viene en persona: sus datos, lo que pidió y la respuesta. Queda en **Atenciones registradas** junto con las del chat.",
"accion": "ir:agregar",
"estado": "",
"activo": true,
"orden": 23
},
{
"id": "HC-ATENCIONES",
"app": "HACIENDA",
"vista": "inicio,atenciones",
"titulo": "Atenciones registradas",
"frases": [
"atenciones registradas",
"lo que ya se atendio",
"historial de atenciones",
"atenciones por chat",
"atenciones presenciales",
"buscar una atencion"
],
"respuesta": "**Atenciones registradas** muestra lo ya atendido, por chat y en ventanilla, con su tiempo de respuesta. Usa el buscador y las pestañas.",
"accion": "ir:atenciones",
"estado": "",
"activo": true,
"orden": 24
},
{
"id": "HC-INFORMES",
"app": "HACIENDA",
"vista": "inicio,atenciones",
"titulo": "Mis informes predial (Excel)",
"frases": [
"mis informes",
"descargar excel de atenciones",
"informe de atenciones",
"exportar atenciones",
"reporte en excel"
],
"respuesta": "En **Mis informes predial** descargas a Excel tus atenciones por rango de fechas.",
"accion": "ir:informes",
"estado": "",
"activo": true,
"orden": 25
},
{
"id": "HC-ESTADISTICAS",
"app": "HACIENDA",
"vista": "inicio,estadisticas",
"titulo": "Estadísticas de atención",
"frases": [
"estadisticas",
"tiempos de respuesta",
"zonas que mas piden",
"tendencia",
"graficas de atencion",
"chat vs presencial"
],
"respuesta": "**Estadísticas** muestra tiempos, zonas y la tendencia de las solicitudes del año. Las **consultas** del robot te dan el detalle por mes, zona y canal.",
"accion": "ir:estadisticas",
"estado": "",
"activo": true,
"orden": 26
},
{
"id": "HC-PREDIAL",
"app": "HACIENDA",
"vista": "inicio,bd-predial,bdp-detalle,bdp-form,bdp-panel",
"titulo": "Base de datos predial",
"frases": [
"base de datos predial",
"bd predial",
"expedientes",
"cobro coactivo predial",
"mis expedientes",
"abrir un expediente",
"buscar un contribuyente"
],
"respuesta": "{{predialAlcance}}Filtra con las pastillas o el buscador, abre la tarjeta y escribe la bitácora y la actuación: se guarda al instante.",
"accion": "ir:predial",
"estado": "",
"activo": true,
"orden": 27
},
{
"id": "HC-PRED-BUSCAR",
"app": "HACIENDA",
"vista": "bd-predial,bdp-detalle,bdp-form,bdp-panel",
"titulo": "Buscar y filtrar expedientes",
"frases": [
"buscar expediente",
"filtrar",
"buscar por nit",
"buscar por nombre",
"pastillas",
"solo los mios",
"filtro por clasificacion",
"filtro por actuacion"
],
"respuesta": "Escribe en el buscador (nombre, NIT/cédula, número de expediente) y usa las **pastillas** y filtros: clasificación, actuación, sustanciador, estado, **Mías** y notificación. Todo se filtra en tu equipo, sin esperar al servidor.",
"accion": "",
"estado": "",
"activo": true,
"orden": 28
},
{
"id": "HC-PRED-BITACORA",
"app": "HACIENDA",
"vista": "bd-predial,bdp-detalle,bdp-form,bdp-panel",
"titulo": "Escribir bitácora y actuación",
"frases": [
"escribir bitacora",
"agregar bitacora",
"actuacion",
"cambiar la actuacion",
"estado del proceso",
"anotar en el expediente",
"registrar gestion"
],
"respuesta": "Abre la tarjeta del expediente y escribe en la **bitácora** lo que hiciste; cambia la **actuación** y el **estado del proceso** si corresponde. Se guarda al instante y queda con tu nombre y la fecha.",
"accion": "",
"estado": "",
"activo": true,
"orden": 29
},
{
"id": "HC-PRED-AGREGAR",
"app": "HACIENDA",
"vista": "bd-predial,bdp-detalle,bdp-form,bdp-panel",
"titulo": "Agregar o eliminar un expediente",
"frases": [
"agregar expediente",
"nuevo expediente",
"crear expediente",
"eliminar expediente",
"borrar expediente",
"editar nombre o nit",
"cambiar la deuda"
],
"respuesta": "Agregar, eliminar y editar los campos de fondo (nombre, NIT, deuda, número) es del **administrador**. El abogado y el asistente editan bitácora, actuación y estado.",
"accion": "",
"estado": "",
"activo": true,
"orden": 30
},
{
"id": "HC-PRED-ASIGNADOR",
"app": "HACIENDA",
"vista": "bd-predial,bdp-detalle,bdp-form,bdp-panel",
"titulo": "Asignar sustanciador y asistente",
"frases": [
"asignar sustanciador",
"repartir expedientes",
"asignador",
"poner asistente",
"cambiar el abogado del expediente",
"a quien le toca este expediente"
],
"respuesta": "El administrador reparte con el **Asignador**: pone sustanciador y asistente. El abogado del caso puede **poner** un asistente cuando el expediente no tiene; cambiarlo o quitarlo es del administrador.",
"accion": "",
"estado": "",
"activo": true,
"orden": 31
},
{
"id": "HC-PRED-OBJETAR",
"app": "HACIENDA",
"vista": "bd-predial,bdp-detalle,bdp-form,bdp-panel",
"titulo": "Objetar un expediente",
"frases": [
"objetar",
"no es mio",
"me asignaron un expediente que no es mio",
"devolver expediente",
"rechazar expediente"
],
"respuesta": "Si un expediente no es de tu competencia, usa **Objetar** en la tarjeta: queda la objeción y el administrador decide.",
"accion": "",
"estado": "",
"activo": true,
"orden": 32
},
{
"id": "HC-SOL-EXPEDIENTE",
"app": "HACIENDA",
"vista": "bd-predial,bdp-detalle,bdp-form,bdp-panel,asignaciones,ver-asignacion,editar-asignacion,agregar-asignacion,panel",
"titulo": "Solicitar el expediente a Archivo",
"frases": [
"solicitar expediente",
"pedir el expediente fisico",
"archivo",
"necesito la carpeta",
"expediente en fisico",
"solicitud a archivo"
],
"respuesta": "En la tarjeta toca **Solicitar expediente**: a Archivo le llega un WhatsApp y te responde en la **bitácora** (Mensaje o Bitácora). La tarjeta queda marcada mientras está pendiente.",
"accion": "",
"estado": "",
"activo": true,
"orden": 33
},
{
"id": "HC-COPIAR",
"app": "HACIENDA",
"vista": "bd-predial,bdp-detalle,bdp-form,bdp-panel",
"titulo": "Copiar el NIT o el correo",
"frases": [
"copiar nit",
"copiar correo",
"copiar cedula",
"copiar el documento",
"portapapeles"
],
"respuesta": "Toca el **NIT/cédula** o el **correo** en la tarjeta y queda copiado: lo pegas donde lo necesites.",
"accion": "",
"estado": "",
"activo": true,
"orden": 34
},
{
"id": "HC-PRED-DESCARGAR",
"app": "HACIENDA",
"vista": "bd-predial,bdp-detalle,bdp-form,bdp-panel",
"titulo": "Descargar la base predial a Excel",
"frases": [
"descargar excel predial",
"exportar expedientes",
"descargar la base",
"datos excel",
"descargar mis expedientes"
],
"respuesta": "{{descargaPredial}}",
"accion": "ir:predial",
"estado": "",
"activo": true,
"orden": 35
},
{
"id": "HC-BIT-DESCARGAR",
"app": "HACIENDA",
"vista": "bd-predial,bdp-detalle,bdp-form,bdp-panel,asignaciones,ver-asignacion,editar-asignacion,agregar-asignacion,panel",
"titulo": "Descargar bitácoras (Excel o PDF)",
"frases": [
"descargar bitacoras",
"bitacoras en pdf",
"bitacoras en excel",
"mis bitacoras",
"exportar bitacoras",
"actuaciones descargar"
],
"respuesta": "Desde el detalle (**Ver**) del expediente o de la asignación descargas sus **bitácoras** en Excel o PDF; en la base predial también tus **actuaciones** por fechas.",
"accion": "",
"estado": "",
"activo": true,
"orden": 36
},
{
"id": "HC-NOTIFICAR",
"app": "HACIENDA",
"vista": "bd-predial,bdp-detalle,bdp-form,bdp-panel",
"titulo": "Notificar la factura por correo",
"frases": [
"notificar",
"notificar factura",
"enviar factura por correo",
"notificacion electronica",
"mandar la factura al contribuyente",
"liquidacion oficial por correo"
],
"respuesta": "En la tarjeta toca **Notificar** (el sobre): escribe los **6 dígitos** de la factura (se guarda con el año delante) y adjunta, arrastra o pega el **PDF**. **Validar** revisa que no se haya enviado antes. Sale desde cobro coactivo con la firma de la Secretaria.",
"accion": "",
"estado": "",
"activo": true,
"orden": 37
},
{
"id": "HC-NOTIF-QUEDA",
"app": "HACIENDA",
"vista": "bd-predial,bdp-detalle,bdp-form,bdp-panel",
"titulo": "¿Qué cambia al notificar?",
"frases": [
"que pasa al notificar",
"despues de notificar",
"se cambia el estado",
"citacion",
"estado cobro persuasivo",
"bitacora de la notificacion"
],
"respuesta": "Al enviar: aviso **Notificado**, CITACIÓN y ELECTRÓNICA en SI, estado **COBRO PERSUASIVO/LIQUIDACION**, actuación **LIQUIDACION OFICIAL**, la línea en la bitácora con el asunto y arranca el reloj **Plazo**.",
"accion": "",
"estado": "",
"activo": true,
"orden": 38
},
{
"id": "HC-PLAZO",
"app": "HACIENDA",
"vista": "bd-predial,bdp-detalle,bdp-form,bdp-panel",
"titulo": "El reloj de 60 días",
"frases": [
"plazo",
"reloj",
"cuantos dias tiene",
"60 dias",
"cuando vence la notificacion",
"colores del plazo",
"late en rojo"
],
"respuesta": "El **Plazo** son **60 días corridos** desde el día siguiente al envío. Gris: más de 15 días · ámbar: 15 o menos · rojo y latiendo: 10 o menos o vencido.",
"accion": "",
"estado": "",
"activo": true,
"orden": 39
},
{
"id": "HC-PROPIETARIOS",
"app": "HACIENDA",
"vista": "bd-predial,bdp-detalle,bdp-form,bdp-panel",
"titulo": "Varios propietarios",
"frases": [
"varios propietarios",
"otro propietario",
"copropietarios",
"enviar a varios correos",
"correo en copia"
],
"respuesta": "En **Editar** → **Agregar otro propietario** (hasta 9). Con nombre y NIT/CC es destinatario; con **solo el correo** va en copia. Sale **un solo correo con un solo PDF** para todos.",
"accion": "",
"estado": "",
"activo": true,
"orden": 40
},
{
"id": "HC-REBOTE",
"app": "HACIENDA",
"vista": "bd-predial,bdp-detalle,bdp-form,bdp-panel",
"titulo": "El correo rebotó",
"frases": [
"rebote",
"rebote del correo",
"correo equivocado",
"no le llego el correo",
"reenviar notificacion",
"correo malo"
],
"respuesta": "Si un correo **rebota**, la tarjeta dice **Rebote** y la bitácora trae el correo a corregir: corrígelo en **Editar** y toca **Reenviar** en Notificar. El plazo vuelve a contar desde el reenvío. Pastilla **Rebotes** en el filtro.",
"accion": "",
"estado": "",
"activo": true,
"orden": 41
},
{
"id": "HC-RECONSIDERACION",
"app": "HACIENDA",
"vista": "bd-predial,bdp-detalle,bdp-form,bdp-panel",
"titulo": "Reconsideración",
"frases": [
"reconsideracion",
"detener el plazo",
"parar el reloj",
"recurso del contribuyente"
],
"respuesta": "Con el estado del proceso en **RECONSIDERACIÓN** el reloj se detiene y se quita de la tarjeta.",
"accion": "",
"estado": "",
"activo": true,
"orden": 42
},
{
"id": "HC-RESPONDIO",
"app": "HACIENDA",
"vista": "bd-predial,bdp-detalle,bdp-form,bdp-panel",
"titulo": "El contribuyente respondió",
"frases": [
"respondio",
"el contribuyente contesto",
"respuesta al correo",
"adjuntos de la respuesta",
"ver la respuesta"
],
"respuesta": "Si el contribuyente responde el correo, la tarjeta dice **Respondió** y el detalle muestra el texto y los adjuntos.",
"accion": "",
"estado": "",
"activo": true,
"orden": 43
},
{
"id": "HC-NOTIF-INFORME",
"app": "HACIENDA",
"vista": "bd-predial,bdp-detalle,bdp-form,bdp-panel",
"titulo": "Informe de notificaciones",
"frases": [
"informe de notificaciones",
"cuantas notificaciones",
"excel de notificaciones",
"notificaciones y plazos"
],
"respuesta": "El **Informe de notificaciones** sale en Excel, PDF o informe gerencial de lo que ves, por rango de fechas. El filtro **NOTIFICACIÓN** y las consultas (**Notificaciones y plazos**) te dan el resumen.",
"accion": "",
"estado": "",
"activo": true,
"orden": 44
},
{
"id": "HC-BIT-RESPONDER",
"app": "HACIENDA",
"vista": "inicio,bd-predial,bdp-detalle,bdp-form,bdp-panel,asignaciones,ver-asignacion,editar-asignacion,agregar-asignacion,panel",
"titulo": "Bitácoras por responder",
"frases": [
"bitacoras por responder",
"bitacora abierta",
"me escribieron en la bitacora",
"bitacoras por revisar",
"quien me escribio",
"responder bitacora",
"bitacoras sin contestar",
"bitacoras pendientes",
"tengo bitacoras atrasadas"
],
"respuesta": "{{bitPendientes}}Cuando uno escribe (abogado, asistente o asignador/admin), los otros dos quedan **por responder**. Se cierra con tu bitácora o con **Enterado**. Azul: hasta 1 día hábil · ámbar: 2 a 3 · rojo: más de 3.",
"accion": "preguntar:HC-BIT-PRED|HC-BIT-SEM",
"estado": "",
"activo": true,
"orden": 45
},
{
"id": "HC-BIT-PRED",
"app": "HACIENDA",
"vista": "bd-predial,bdp-detalle,bdp-form,bdp-panel",
"titulo": "Ver las bitácoras por responder del predial",
"frases": [
"bitacoras por responder del predial",
"pastilla de bitacoras predial",
"expedientes con bitacora pendiente"
],
"respuesta": "Te llevo a la base predial con la pastilla **Bitácoras por responder** puesta.",
"accion": "ir:predBit",
"estado": "",
"activo": true,
"orden": 46
},
{
"id": "HC-BIT-SEM",
"app": "HACIENDA",
"vista": "asignaciones,ver-asignacion,editar-asignacion,agregar-asignacion,panel",
"titulo": "Ver las bitácoras por responder del semáforo",
"frases": [
"bitacoras por responder del semaforo",
"asignaciones con bitacora pendiente",
"pastilla de bitacoras semaforo"
],
"respuesta": "Te llevo a **Mi semáforo** con la pastilla **Bitácoras por responder** puesta.",
"accion": "ir:semBit",
"estado": "",
"activo": true,
"orden": 47
},
{
"id": "HC-ENTERADO",
"app": "HACIENDA",
"vista": "bd-predial,bdp-detalle,bdp-form,bdp-panel,asignaciones,ver-asignacion,editar-asignacion,agregar-asignacion,panel",
"titulo": "Enterado",
"frases": [
"enterado",
"marcar enterado",
"ya lo lei",
"cerrar la bitacora sin escribir",
"quitar el pendiente de bitacora"
],
"respuesta": "Si no necesitas escribir nada, toca **Enterado** en la marca de la tarjeta: la bitácora deja de estar por responder para ti.",
"accion": "",
"estado": "",
"activo": true,
"orden": 48
},
{
"id": "HC-SEMAFORO",
"app": "HACIENDA",
"vista": "inicio,asignaciones,ver-asignacion,editar-asignacion,agregar-asignacion,panel",
"titulo": "Mi semáforo",
"frases": [
"mi semaforo",
"mis asignaciones",
"semaforo",
"asignaciones",
"mis casos",
"tareas asignadas",
"que me asignaron"
],
"respuesta": "{{semaforo}}Cada asignación tiene su plazo en **días hábiles** y su color.",
"accion": "ir:semaforo",
"estado": "",
"activo": true,
"orden": 49
},
{
"id": "HC-SEM-COLORES",
"app": "HACIENDA",
"vista": "asignaciones,ver-asignacion,editar-asignacion,agregar-asignacion,panel",
"titulo": "Los colores del semáforo",
"frases": [
"colores del semaforo",
"que significa el rojo",
"que significa el amarillo",
"verde",
"gris",
"cuando se pone rojo"
],
"respuesta": "Verde: más de la mitad del plazo · ámbar: menos de la mitad · rosado: 3 días hábiles o menos · rojo: vence hoy o venció · gris: finalizada.",
"accion": "",
"estado": "",
"activo": true,
"orden": 50
},
{
"id": "HC-SEM-VENCIDAS",
"app": "HACIENDA",
"vista": "inicio,asignaciones,ver-asignacion,editar-asignacion,agregar-asignacion,panel",
"titulo": "Ver las vencidas",
"frases": [
"vencidas",
"asignaciones vencidas",
"que se me vencio",
"atrasadas",
"casos vencidos"
],
"respuesta": "{{semVencidas}}",
"accion": "ir:semVencidas",
"estado": "",
"activo": true,
"orden": 51
},
{
"id": "HC-SEM-HOY",
"app": "HACIENDA",
"vista": "inicio,asignaciones,ver-asignacion,editar-asignacion,agregar-asignacion,panel",
"titulo": "Lo que vence hoy",
"frases": [
"vence hoy",
"para hoy",
"que vence hoy",
"vence proximamente",
"que vence esta semana"
],
"respuesta": "{{semHoy}}",
"accion": "ir:semHoy",
"estado": "",
"activo": true,
"orden": 52
},
{
"id": "HC-SEM-DIAS",
"app": "HACIENDA",
"vista": "asignaciones,ver-asignacion,editar-asignacion,agregar-asignacion,panel",
"titulo": "¿Cómo se cuentan los días?",
"frases": [
"dias habiles",
"cuentan los festivos",
"sabados",
"como se cuenta el plazo",
"faltan dias"
],
"respuesta": "El plazo cuenta **días hábiles**: sin sábados, domingos ni festivos de Colombia. \"Faltan X días\" cuenta hoy y el día de vencimiento.",
"accion": "",
"estado": "",
"activo": true,
"orden": 53
},
{
"id": "HC-SEM-NUEVA",
"app": "HACIENDA",
"vista": "asignaciones,ver-asignacion,editar-asignacion,agregar-asignacion,panel,inicio",
"titulo": "Nueva asignación",
"frases": [
"nueva asignacion",
"asignar un caso",
"agregar asignacion",
"repartir trabajo",
"crear asignacion"
],
"respuesta": "El administrador crea la asignación con abogado, apoyo y plazo; al abogado le llega por WhatsApp y push.",
"accion": "ir:semNueva",
"estado": "",
"activo": true,
"orden": 54
},
{
"id": "HC-SEM-TRABAJAR",
"app": "HACIENDA",
"vista": "asignaciones,ver-asignacion,editar-asignacion,agregar-asignacion,panel",
"titulo": "Trabajar una asignación",
"frases": [
"como trabajo una asignacion",
"subir documento a la asignacion",
"etapa",
"cambiar etapa",
"agregar documento",
"bitacora de la asignacion"
],
"respuesta": "Abre la asignación: escribe la **bitácora**, cambia la **etapa** y agrega documentos (hasta 5). Cuando termines, **solicita** revisión, firma o finalizar.",
"accion": "",
"estado": "",
"activo": true,
"orden": 55
},
{
"id": "HC-SEM-SOLICITAR",
"app": "HACIENDA",
"vista": "asignaciones,ver-asignacion,editar-asignacion,agregar-asignacion,panel",
"titulo": "Solicitar revisión, firma o finalizar",
"frases": [
"solicitar finalizar",
"pedir revision",
"pedir firma",
"terminar la asignacion",
"cerrar asignacion",
"ya termine"
],
"respuesta": "Desde la asignación **solicitas** revisión, firma o finalizar. El administrador decide: la finaliza o te pide evidencia.",
"accion": "",
"estado": "",
"activo": true,
"orden": 56
},
{
"id": "HC-SEM-REBOTAR",
"app": "HACIENDA",
"vista": "asignaciones,ver-asignacion,editar-asignacion,agregar-asignacion,panel",
"titulo": "Rebotar una asignación",
"frases": [
"rebotar",
"no es de mi competencia",
"devolver asignacion",
"me asignaron algo que no es mio"
],
"respuesta": "Si no es de tu competencia, **Rebotar** la devuelve con tu motivo y el administrador la reasigna.",
"accion": "",
"estado": "",
"activo": true,
"orden": 57
},
{
"id": "HC-SEM-CHAT",
"app": "HACIENDA",
"vista": "asignaciones,ver-asignacion,editar-asignacion,agregar-asignacion,panel",
"titulo": "Chat de la asignación",
"frases": [
"chat",
"chat en vivo",
"hablar sobre la asignacion",
"mensajes de la asignacion"
],
"respuesta": "Cada asignación tiene su **chat** en vivo: lo que escribe uno lo ven los demás al instante.",
"accion": "",
"estado": "",
"activo": true,
"orden": 58
},
{
"id": "HC-SEM-ARCHIVO",
"app": "HACIENDA",
"vista": "asignaciones,ver-asignacion,editar-asignacion,agregar-asignacion,panel",
"titulo": "Archivo en el semáforo",
"frases": [
"soy archivo",
"solo lectura",
"responder una solicitud de expediente",
"mensaje o bitacora"
],
"respuesta": "Archivo ve todas las asignaciones en **solo lectura** y responde las solicitudes de expediente en **MENSAJE O BITÁCORA**.",
"accion": "",
"estado": "",
"activo": true,
"orden": 59
},
{
"id": "HC-ICA",
"app": "HACIENDA",
"vista": "inicio,ica-req",
"titulo": "Requerimientos de Industria y Comercio",
"frases": [
"industria y comercio",
"ica",
"requerimientos",
"requerimiento de informacion",
"fiscalizacion ica",
"contribuyentes de ica"
],
"respuesta": "En **Requerimientos** agregas al contribuyente (uno o con carga masiva), envías el PDF por correo y la app lleva el plazo de **15 días hábiles**. Si no responde, sale el **2.º requerimiento**.",
"accion": "ir:ica",
"estado": "",
"activo": true,
"orden": 60
},
{
"id": "HC-ICA-RECORDATORIO",
"app": "HACIENDA",
"vista": "ica-req",
"titulo": "Recordatorio y respuesta en ICA",
"frases": [
"recordatorio ica",
"respondio el requerimiento",
"adjuntos ica",
"segundo requerimiento",
"plazo ica"
],
"respuesta": "Antes de vencer sale un **recordatorio** en el mismo hilo de correo. Si responde, sus adjuntos quedan en el expediente; si no, se envía el 2.º requerimiento.",
"accion": "",
"estado": "",
"activo": true,
"orden": 61
},
{
"id": "HC-ICA-TRABAJO",
"app": "HACIENDA",
"vista": "ica-req",
"titulo": "Mi trabajo en ICA",
"frases": [
"mi trabajo ica",
"descargar ica",
"evidencias ica",
"excel ica"
],
"respuesta": "**Mi trabajo** se descarga a Excel y PDF; cada contribuyente admite hasta 5 evidencias.",
"accion": "",
"estado": "",
"activo": true,
"orden": 62
},
{
"id": "HC-ICA-PRONTO",
"app": "HACIENDA",
"vista": "inicio,ica-req",
"titulo": "Emplazamientos, revisión, HAS SQL y balance",
"frases": [
"emplazamientos",
"revision tecnica",
"auditorio has sql",
"balance ica",
"cuando estara",
"proximamente"
],
"respuesta": "Emplazamientos, Revisión técnica de declaraciones, Auditorio HAS SQL y Balance aparecen como **Próximamente**: se construyen en lo que queda del año.",
"accion": "",
"estado": "",
"activo": true,
"orden": 63
},
{
"id": "HC-ANEXOS",
"app": "HACIENDA",
"vista": "inicio,drive-anexos,da-form",
"titulo": "Drive anexos",
"frases": [
"drive anexos",
"mis evidencias",
"anexos de la cuenta",
"evidencias del contrato",
"carpeta del contrato",
"donde estan mis anexos"
],
"respuesta": "{{anexos}}",
"accion": "ir:anexos",
"estado": "",
"activo": true,
"orden": 64
},
{
"id": "HC-ANEXOS-SUBIR",
"app": "HACIENDA",
"vista": "drive-anexos,da-form",
"titulo": "Subir una evidencia",
"frases": [
"subir evidencia",
"subir evidencias",
"como subo una evidencia",
"subo un archivo",
"agregar evidencia",
"subir archivo",
"que archivos puedo subir",
"tamaño del archivo",
"obligacion"
],
"respuesta": "**Agregar evidencia** → eliges la **obligación** (1 a 20) → el archivo ({{anexosTipos}}, hasta 10 MB) → el nombre en mayúsculas. Queda en la carpeta de tu cuenta abierta.",
"accion": "",
"estado": "",
"activo": true,
"orden": 65
},
{
"id": "HC-ANEXOS-COPIAR",
"app": "HACIENDA",
"vista": "drive-anexos",
"titulo": "Copiar el enlace de la evidencia",
"frases": [
"copiar enlace",
"copiar todos",
"pegar en la cuenta",
"enlace de la evidencia",
"link del archivo"
],
"respuesta": "**Copiar** y lo pegas en el campo de Evidencia de tu cuenta. **Copiar todos**: uno por línea. **Ver archivos** abre tus documentos en la app.",
"accion": "",
"estado": "",
"activo": true,
"orden": 66
},
{
"id": "HC-ANEXOS-SELLADA",
"app": "HACIENDA",
"vista": "drive-anexos",
"titulo": "Cuenta aprobada o sin contrato",
"frases": [
"cuenta sellada",
"no puedo editar la evidencia",
"cuenta aprobada",
"no tengo contrato abierto",
"reemplazar archivo",
"eliminar evidencia"
],
"respuesta": "Con la cuenta **abierta** puedes editar, reemplazar o eliminar. Una cuenta **aprobada** queda sellada. Sin contrato abierto, pídelo a un administrador.",
"accion": "",
"estado": "",
"activo": true,
"orden": 67
},
{
"id": "HC-ANEXOS-ADMIN",
"app": "HACIENDA",
"vista": "drive-anexos",
"titulo": "Administrar Drive anexos",
"frases": [
"crear contrato anexos",
"aprobar cuenta",
"reabrir cuenta",
"permitir pdf",
"pin de seguridad",
"administrar anexos"
],
"respuesta": "El administrador elige al contratista, crea el **CONTRATO**, y aprueba o **reabre** cuentas y contratos; también **Permitir PDF**. Crear, aprobar, reabrir y PDF piden el **PIN de seguridad** (al desarrollador no).",
"accion": "",
"estado": "",
"activo": true,
"orden": 68
},
{
"id": "HC-CONFIG",
"app": "HACIENDA",
"vista": "inicio,config",
"titulo": "Configuración",
"frases": [
"configuracion",
"ajustes",
"administrar usuarios",
"personas y roles",
"opciones de la app"
],
"respuesta": "En **Configuración** el administrador maneja las personas, sus roles y su PIN. El desarrollador ve además **Plantillas** (los mensajes) e **IDs y ajustes** (carpetas, llaves).",
"accion": "ir:config",
"estado": "",
"activo": true,
"orden": 69
},
{
"id": "HC-CREAR-PERSONA",
"app": "HACIENDA",
"vista": "config",
"titulo": "Crear una persona",
"frases": [
"crear usuario",
"nuevo usuario",
"agregar persona",
"dar acceso",
"nuevo funcionario",
"quitar acceso",
"desactivar usuario"
],
"respuesta": "**Crear persona**: nombre, documento, celular y roles; le llega su PIN por WhatsApp. A quien sale lo **desactivas** (no se borra).",
"accion": "ir:config",
"estado": "",
"activo": true,
"orden": 70
},
{
"id": "HC-PIN-NUEVO",
"app": "HACIENDA",
"vista": "config",
"titulo": "Generar un PIN nuevo",
"frases": [
"generar pin",
"pin nuevo para otro",
"alguien olvido el pin",
"reiniciar pin",
"desbloquear usuario"
],
"respuesta": "En **Configuración** busca a la persona y toca **PIN nuevo**: le llega por WhatsApp.",
"accion": "ir:config",
"estado": "",
"activo": true,
"orden": 71
},
{
"id": "HC-PLANTILLAS",
"app": "HACIENDA",
"vista": "config",
"titulo": "Plantillas e IDs (desarrollador)",
"frases": [
"plantillas",
"mensajes de whatsapp",
"cambiar el texto del mensaje",
"ids de carpetas",
"llaves",
"asunto del correo"
],
"respuesta": "**Plantillas** guarda todos los mensajes que manda la app (WhatsApp, push, correo de notificación). **IDs y ajustes**: carpetas, llaves, PIN de anexos y quién los administra. Solo el desarrollador.",
"accion": "ir:config",
"estado": "",
"activo": true,
"orden": 72
},
{
"id": "HC-SOPORTES-DEV",
"app": "HACIENDA",
"vista": "inicio,soportes",
"titulo": "Soportes (desarrollador)",
"frases": [
"soportes",
"casos de soporte",
"responder soporte",
"soportes abiertos",
"atender soporte"
],
"respuesta": "{{soportesDev}}En **Soportes** filtras por estado, respondes (en proceso o resuelto), registras lo atendido por teléfono y descargas PDF, Excel y gerencial.",
"accion": "ir:soportes",
"estado": "",
"activo": true,
"orden": 73
},
{
"id": "HC-ASISTENTE-DEV",
"app": "HACIENDA",
"vista": "inicio,asistente",
"titulo": "Entrenar al asistente",
"frases": [
"entrenar asistente",
"ensenar al asistente",
"preguntas sin respuesta",
"temas del asistente",
"mejorar las respuestas",
"por ensenar"
],
"respuesta": "{{asistente}}En **Entrenamiento del asistente** (solo DEV) editas los temas, enseñas las preguntas sin respuesta o con 👎 y pruebas frases.",
"accion": "ir:asistente",
"estado": "",
"activo": true,
"orden": 74
},
{
"id": "HCE-ENTRAR",
"app": "HACIENDA",
"vista": "entrada",
"titulo": "¿Cómo entro?",
"frases": [
"como entro",
"como ingreso",
"iniciar sesion",
"primera vez",
"con que entro",
"entrar a la app"
],
"respuesta": "La **primera vez** en este equipo escribe tu **documento**; después eliges tu cuenta y escribes tu **PIN** de 4 dígitos.",
"accion": "documento",
"estado": "",
"activo": true,
"orden": 75
},
{
"id": "HCE-OLVIDE",
"app": "HACIENDA",
"vista": "entrada",
"titulo": "Olvidé mi PIN",
"frases": [
"olvide mi pin",
"no recuerdo el pin",
"perdi el pin",
"recuperar el pin",
"me lo mandan"
],
"respuesta": "Elige tu cuenta y toca **¿Olvidaste tu PIN?**: te lo enviamos al WhatsApp registrado (nunca se muestra en pantalla).",
"accion": "olvide",
"estado": "",
"activo": true,
"orden": 76
},
{
"id": "HCE-BLOQUEADO",
"app": "HACIENDA",
"vista": "entrada",
"titulo": "Me bloqueé",
"frases": [
"bloqueado",
"demasiados intentos",
"no me deja entrar",
"pin incorrecto"
],
"respuesta": "Con **5 intentos fallidos** el usuario queda bloqueado unos minutos. Espera y vuelve a intentar, o pide el PIN por WhatsApp.",
"accion": "olvide",
"estado": "",
"activo": true,
"orden": 77
},
{
"id": "HCE-ACCESO",
"app": "HACIENDA",
"vista": "entrada",
"titulo": "No tengo usuario",
"frases": [
"no tengo usuario",
"no tengo acceso",
"como me registro",
"crear cuenta",
"quien me da acceso",
"soy nuevo"
],
"respuesta": "La app es del equipo de la **Secretaría de Hacienda**. Un administrador te crea en Configuración y te llega el PIN por WhatsApp.",
"accion": "",
"estado": "",
"activo": true,
"orden": 78
},
{
"id": "HCE-OTRA",
"app": "HACIENDA",
"vista": "entrada",
"titulo": "Otra cuenta en este equipo",
"frases": [
"otra cuenta",
"entrar con otro documento",
"quitar cuenta",
"borrar cuenta del equipo",
"cambiar de usuario"
],
"respuesta": "**Entrar con otro documento** agrega otra cuenta; el bote de basura junto a una cuenta la quita de este equipo (no borra el usuario).",
"accion": "documento",
"estado": "",
"activo": true,
"orden": 79
},
{
"id": "HCE-INSTALAR",
"app": "HACIENDA",
"vista": "entrada",
"titulo": "Instalar la app",
"frases": [
"instalar",
"descargar la app",
"poner en el celular",
"icono en pantalla"
],
"respuesta": "Se instala desde el navegador: te muestro cómo, paso a paso (en iPhone: Compartir → Agregar a inicio).",
"accion": "instalar",
"estado": "",
"activo": true,
"orden": 80
}
];
