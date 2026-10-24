/* ============================================================
   SEC-HACIENDA-FLANDES · ENTRENAMIENTO DEL ASISTENTE (solo DEV)
   24/10/2026 · la vista ASISTENTE de ADMIN-FLANDES, dentro de esta app

   Aquí se entrena el asistente de ayuda (kit/asistente.js + js/ayuda-app.js):
     · TEMAS ........ la base: título, vistas, frases de ejemplo, respuesta
                      y a dónde lleva. Nuevo tema, editar, activar/apagar.
     · POR ENSEÑAR .. lo que la gente preguntó y no tuvo respuesta, o tuvo
                      👎: se asigna a un tema como frase nueva (con las 3
                      sugerencias del mismo motor), se crea un tema con ella
                      o se descarta.
     · PROBAR ....... se escribe una frase y se ve qué respondería, con el
                      MISMO motor del teléfono (sin servidor).

   Red: UNA llamada al entrar ('asistentedatos'), carga única por sesión;
   cada guardado lleva su rid, botón ocupado desde el primer toque, y se
   parcha la lista en memoria (no se vuelve a pedir todo). El cambio sube el
   sello de la base: los teléfonos la reciben en su siguiente apertura, y en
   ESTE equipo se aplica de una vez (para probarla ya en el robot).
   El servidor también exige DEV (Asistente.gs · HAS_exigirDev_).
   ============================================================ */
(function () {
  'use strict';

  var K = window.KIT;
  if (!K) return;
  var VISTA = 'view-asistente';
  var D = null, HORA = null, CARGANDO = null, MOTOR = null;
  var F = { pestana: 'temas', busca: '' };
  var PRUEBA = { vista: 'inicio', frase: '' };

  /* lo que sabe hacer el adaptador (js/ayuda-app.js) */
  var CAT = {
    vistas: ['entrada', 'inicio', 'lista', 'respuesta', 'agregar', 'atenciones', 'estadisticas', 'panel', 'asignaciones', 'ver-asignacion',
      'editar-asignacion', 'agregar-asignacion', 'bd-predial', 'bdp-detalle', 'bdp-form', 'bdp-panel', 'drive-anexos', 'da-form',
      'ica-req', 'config', 'soportes', 'guia', 'asistente'],
    acciones: ['ir:inicio', 'ir:agregar', 'ir:pendientes', 'ir:atenciones', 'ir:informes', 'ir:estadisticas', 'ir:predial', 'ir:predBit',
      'ir:semaforo', 'ir:semBit', 'ir:semVencidas', 'ir:semHoy', 'ir:semNueva', 'ir:ica', 'ir:anexos', 'ir:gerencial', 'ir:soportes',
      'ir:config', 'ir:asistente', 'guia', 'soporte', 'foto', 'pin', 'avisos', 'instalar', 'tema', 'consultas', 'olvide', 'documento'],
    datos: ['nombre', 'queMeToca', 'misFunciones', 'gerencialQuien', 'pendientes', 'predialAlcance', 'descargaPredial', 'bitPendientes',
      'semaforo', 'semVencidas', 'semHoy', 'anexos', 'anexosTipos', 'soportePend', 'soportesDev', 'asistente', 'avisosTelefono']
  };

  function $(id) { return document.getElementById(id); }
  function esc(s) { return K.esc(String(s == null ? '' : s)); }
  function ico(n, t) { return K.icono(n, t || 16); }
  function esDev() { try { return !!(window.IDN && window.IDN.esDev()); } catch (e) { return false; } }
  function aviso(t, tono, ms) { K.aviso(t, tono || 'info', ms || 4000); }
  function nuevoRid() { return 'ayd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10); }
  function llamar(a, d, o) { return window.AYUDA._llamar(a, d, o); }
  function rico(t) { return esc(t).replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>'); }
  function indice(t) { t._t = K.norm([t.id, t.titulo, t.vista, t.accion, (t.frases || []).join(' '), t.respuesta].join(' ')); return t; }
  function hora(d) { return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2); }

  /* ══════════════ datos ══════════════ */
  function recibir(d) {
    D = d || { temas: [], porEnsenar: [], resumen: {} };
    D.temas = (D.temas || []).map(indice);
    D.porEnsenar = D.porEnsenar || [];
    D.resumen = D.resumen || {};
    HORA = new Date();
    MOTOR = null;
  }
  function cargar(fresco) {
    if (D && !fresco) return Promise.resolve(D);
    if (CARGANDO && !fresco) return CARGANDO;
    var t0 = performance.now();
    CARGANDO = llamar('asistentedatos', {}).then(function (d) {
      CARGANDO = null; recibir(d);
      try { window.__ayudaMed.push({ ruta: 'vista:asistente', ms: Math.round(performance.now() - t0) }); } catch (e) {}
      return D;
    }, function (e) { CARGANDO = null; throw e; });
    return CARGANDO;
  }
  function motor() {
    if (!K.piezas.asistente) return null;
    if (!MOTOR) MOTOR = K.piezas.asistente.motor(D ? D.temas : []);
    return MOTOR;
  }
  function temas() { return (D ? D.temas : []).slice().sort(function (a, b) { return (a.orden || 0) - (b.orden || 0); }); }
  function coincide(t, q) {
    q = K.norm(q || ''); if (!q) return true;
    return q.split(' ').filter(Boolean).every(function (p) { return t.indexOf(p) >= 0; });
  }
  /** La base nueva en ESTE equipo: el DEV la prueba en el robot sin esperar a la siguiente apertura. */
  function aplicarAqui(sello) {
    try { if (sello && K.piezas.asistente) K.piezas.asistente.base(D.temas.filter(function (t) { return t.activo !== false; }), sello); } catch (e) {}
  }

  /* ══════════════ la vista ══════════════ */
  function activa() { var v = $(VISTA); return !!(v && v.classList.contains('active')); }

  function montarVista() {
    if ($(VISTA)) return $(VISTA);
    var cont = document.querySelector('.container') || document.body;
    var sec = document.createElement('section');
    sec.id = VISTA; sec.className = 'view';
    sec.innerHTML =
      '<div class="vista kit-ancho ayd">' +
        '<p class="ayd-intro">Lo que responde el robot de ayuda de esta app. Edita los <b>temas</b>, enseña lo que quedó <b>por enseñar</b> y <b>prueba</b> una frase. Los cambios llegan a los teléfonos en su siguiente apertura.</p>' +
        '<div class="kit-tarjeta ayd-res" id="ayd-res" aria-live="polite"></div>' +
        '<div class="kit-pastillas ayd-pest" id="ayd-pest" role="tablist" aria-label="Secciones"></div>' +
        '<div class="ayd-cuerpo" id="ayd-cuerpo"></div>' +
        '<button type="button" class="hf-atras" hidden>Regresar</button>' +
      '</div>';
    cont.appendChild(sec);
    sec.querySelector('.hf-atras').addEventListener('click', salir);
    var pz = $('ayd-pest');
    [['temas', 'Temas'], ['ensenar', 'Por enseñar'], ['probar', 'Probar']].forEach(function (p) {
      var b = K.nodo('<button type="button" class="kit-pastilla" role="tab" data-p="' + p[0] + '"><span></span> <b class="ayd-n"></b></button>');
      b.querySelector('span').textContent = p[1];
      b.addEventListener('click', function () { K.vibrar(6); F.pestana = p[0]; pintar(); });
      pz.appendChild(b);
    });
    return sec;
  }

  function esqueleto() {
    $('ayd-res').innerHTML = '<span class="ayd-esq"></span><span class="ayd-esq"></span><span class="ayd-esq"></span>';
    $('ayd-cuerpo').innerHTML = '<div class="ayd-lista">' + new Array(5).join('<div class="kit-tarjeta ayd-esq-t"><span class="ayd-esq"></span><span class="ayd-esq ayd-esq--c"></span></div>') + '</div>';
  }

  function abrir() {
    if (!esDev()) { aviso('El entrenamiento del asistente es solo del rol DEV.', 'aviso'); return; }
    var t0 = performance.now();
    montarVista();
    if (typeof window.showView === 'function') window.showView(VISTA);
    if (D) { pintar(); return; }
    esqueleto();
    cargar(false).then(function () {
      if (!activa()) return;
      pintar();
      try { window.__ayudaMed.push({ ruta: 'pinta:asistente', ms: Math.round(performance.now() - t0) }); } catch (e) {}
    }, function (e) {
      if (!activa()) return;
      $('ayd-cuerpo').innerHTML = '<div class="kit-tarjeta ayd-vacio">' + ico('aviso', 28) + '<p>' + esc(e.message) + '</p>' +
        '<button type="button" class="kit-btn" id="ayd-reintentar">' + ico('recargar') + ' Reintentar</button></div>';
      $('ayd-reintentar').addEventListener('click', function () { D = null; abrir(); });
    });
  }
  function salir() { if (typeof window.showView === 'function') window.showView('view-inicio'); }

  function pintar() {
    if (!D || !$(VISTA)) return;
    var r = D.resumen || {};
    $('ayd-res').innerHTML =
      '<span><b>' + K.numero(D.temas.length) + '</b> temas</span>' +
      '<span><b>' + K.numero(r.total || 0) + '</b> preguntas</span>' +
      '<span><b>' + K.numero(r.resueltas || 0) + '</b> resueltas</span>' +
      '<span><b>' + K.numero(r.gemini || 0) + '</b> con Gemini</span>' +
      '<span class="ayd-res--malo"><b>' + K.numero(D.porEnsenar.length) + '</b> por enseñar</span>' +
      '<span>' + ico('pulgar-arriba', 14) + ' ' + K.numero(r.buenas || 0) + ' · ' + ico('pulgar-abajo', 14) + ' ' + K.numero(r.malas || 0) + '</span>' +
      (HORA ? '<span class="ayd-hora">' + ico('reloj', 13) + ' Al día a las ' + hora(HORA) +
        ' <button type="button" class="kit-btn kit-btn--plano ayd-ref" id="ayd-ref" title="Volver a traer">' + ico('recargar', 14) + '</button></span>' : '');
    var ref = $('ayd-ref');
    if (ref) ref.addEventListener('click', function () {
      if (ref.disabled) return;
      ref.disabled = true; ref.classList.add('kit-ocupado');
      cargar(true).then(function () { pintar(); aviso('Al día.', 'ok', 1800); }, function (e) { aviso(e.message, 'aviso', 5000); ref.disabled = false; ref.classList.remove('kit-ocupado'); });
    });
    var n = { temas: D.temas.length, ensenar: D.porEnsenar.length, probar: '' };
    $('ayd-pest').querySelectorAll('.kit-pastilla').forEach(function (b) {
      var p = b.getAttribute('data-p');
      b.classList.toggle('active', p === F.pestana);
      b.setAttribute('aria-selected', String(p === F.pestana));
      b.querySelector('.ayd-n').textContent = n[p] === '' ? '' : K.numero(n[p]);
    });
    var z = $('ayd-cuerpo');
    z.innerHTML = '';
    if (F.pestana === 'ensenar') pintarEnsenar(z);
    else if (F.pestana === 'probar') pintarProbar(z);
    else pintarTemas(z);
  }

  /* ══════════════ temas ══════════════ */
  function pintarTemas(z) {
    var barra = K.nodo('<div class="hf-barra ayd-barra">' +
      '<button type="button" class="kit-btn kit-btn--marca">' + ico('mas', 18) + ' Nuevo tema</button>' +
      '<span class="hf-conteo"><b class="ayd-cnt">0</b> <span class="ayd-cnt-t">temas</span></span>' +
      '<label class="hf-buscar">' + ico('buscar', 18) + '<input type="search" placeholder="Título, frase, vista o respuesta" autocomplete="off"></label></div>');
    barra.querySelector('.kit-btn').addEventListener('click', function () { K.vibrar(8); editar(null); });
    var inp = barra.querySelector('input'); inp.value = F.busca;
    var rej = K.nodo('<div class="ayd-lista"></div>');
    z.appendChild(barra); z.appendChild(rej);
    function lista() {
      var L = temas().filter(function (t) { return coincide(t._t, F.busca); });
      barra.querySelector('.ayd-cnt').textContent = K.numero(L.length);
      barra.querySelector('.ayd-cnt-t').textContent = L.length === 1 ? 'tema' : 'temas';
      rej.innerHTML = '';
      if (!L.length) { rej.appendChild(K.nodo('<div class="kit-tarjeta ayd-vacio"><p>' + (D.temas.length ? 'No hay temas con esa búsqueda.' : 'Todavía no hay temas: corre HAS_sembrar en el backend.') + '</p></div>')); return; }
      var frag = document.createDocumentFragment();
      L.forEach(function (t) { frag.appendChild(tarjeta(t)); });
      rej.appendChild(frag);
    }
    var tq = null;
    inp.addEventListener('input', function () { clearTimeout(tq); tq = setTimeout(function () { F.busca = inp.value; lista(); }, 120); });
    lista();
  }

  function tarjeta(t) {
    var el = K.nodo('<button type="button" class="kit-tarjeta ayd-tema' + (t.activo === false ? ' ayd-tema--off' : '') + '">' +
      '<span class="ayd-tema__t"></span><span class="ayd-tema__m"></span><span class="ayd-tema__r"></span></button>');
    el.querySelector('.ayd-tema__t').textContent = t.titulo;
    el.querySelector('.ayd-tema__m').innerHTML =
      '<i>' + esc(t.id) + '</i><i>' + esc(t.vista || 'todas las vistas') + '</i>' +
      (t.accion ? '<i>' + esc(t.accion) + '</i>' : '') +
      (t.activo === false ? '<i class="ayd-chip--off">INACTIVO</i>' : '') +
      '<i>' + K.numero((t.frases || []).length) + ' frases</i>';
    el.querySelector('.ayd-tema__r').textContent = String(t.respuesta || '').replace(/\*\*/g, '').slice(0, 170);
    el.addEventListener('click', function () { K.vibrar(6); editar(t); });
    return el;
  }

  function capa(titulo, cuerpo, botones) {
    var h = K.nodo('<div class="kit-capa kit-sop kit-capa--on ayd-capa" role="dialog" aria-modal="true">' +
      '<div class="kit-capa__velo"></div><section class="kit-capa__hoja kit-sop__hoja ayd-hoja">' +
      '<header class="kit-capa__h"><span></span><button type="button" class="kit-capa__x" aria-label="Cerrar">' + ico('cerrar', 18) + '</button></header>' +
      '<div class="kit-capa__cuerpo kit-sop__cuerpo"></div><footer class="kit-capa__pie"></footer></section></div>');
    h.querySelector('.kit-capa__h span').textContent = titulo;
    h.querySelector('.kit-capa__cuerpo').appendChild(cuerpo);
    var api = { ocupado: false, botones: [] };
    function fuera() { if (api.ocupado) return; document.removeEventListener('keydown', tecla); h.remove(); }
    function tecla(e) { if (e.key === 'Escape') fuera(); }
    api.cerrar = fuera;
    h.querySelector('.kit-capa__x').addEventListener('click', fuera);
    h.querySelector('.kit-capa__velo').addEventListener('click', fuera);
    document.addEventListener('keydown', tecla);
    (botones || []).forEach(function (b) {
      var el = K.nodo('<button type="button" class="kit-btn' + (b.marca ? ' kit-btn--marca' : '') + '"></button>');
      el.innerHTML = (b.icono ? ico(b.icono, 16) + ' ' : '') + esc(b.texto);
      el.addEventListener('click', function () { b.al(el); });
      h.querySelector('.kit-capa__pie').appendChild(el);
      api.botones.push(el);
    });
    document.body.appendChild(h);
    return api;
  }

  function editar(t, conFrase) {
    var nuevo = !t;
    t = t || { id: '', vista: '', titulo: '', frases: conFrase ? [conFrase] : [], respuesta: '', accion: '', activo: true, orden: '' };
    var f = K.nodo('<div class="sop-form ayd-form"></div>');
    function campo(etq, html, ayuda) {
      var l = K.nodo('<label class="kit-sop__campo"><span></span>' + html + (ayuda ? '<small class="ayd-ayuda"></small>' : '') + '</label>');
      l.querySelector('span').textContent = etq;
      if (ayuda) l.querySelector('small').textContent = ayuda;
      f.appendChild(l);
      return l.querySelector('input, textarea');
    }
    var iT = campo('Título (lo que sale en el botón)', '<input maxlength="120" autocomplete="off">'); iT.value = t.titulo;
    var iF = campo('Frases de ejemplo (una por línea)', '<textarea rows="6" maxlength="6000"></textarea>',
      'Cómo lo pregunta la gente, con sus palabras. Entre más variadas, mejor: el buscador entiende errores de escritura y palabras sueltas.');
    iF.value = (t.frases || []).join('\n');
    var iR = campo('Respuesta', '<textarea rows="6" maxlength="2500"></textarea>',
      'Usa **negrita** y saltos de línea. Datos reales de la persona: ' + CAT.datos.map(function (d) { return '{{' + d + '}}'; }).join(' '));
    iR.value = t.respuesta;
    var iV = campo('Vistas donde es pregunta frecuente (separadas por coma; vacío = solo en las búsquedas)', '<input maxlength="300" autocomplete="off">',
      'Vistas: ' + CAT.vistas.join(', ') + '. "entrada" = la pantalla de ingreso (sin sesión).');
    iV.value = t.vista || '';
    var iA = campo('Acción (a dónde lleva)', '<input maxlength="160" autocomplete="off" list="ayd-acciones">',
      'Vacío = solo responde. ir:destino lleva a una vista; preguntar:ID1|ID2 repregunta con botones; guia, soporte, foto, pin, avisos, instalar, tema, consultas, olvide, documento.');
    iA.value = t.accion || '';
    var dl = K.nodo('<datalist id="ayd-acciones"></datalist>');
    CAT.acciones.forEach(function (a) { var o = document.createElement('option'); o.value = a; dl.appendChild(o); });
    f.appendChild(dl);
    var iO = campo('Orden (las frecuentes salen por este orden)', '<input inputmode="numeric" maxlength="4" autocomplete="off">'); iO.value = t.orden || '';
    var lAc = K.nodo('<label class="sop-check"><input type="checkbox"><span>Activo</span></label>');
    var iAc = lAc.querySelector('input'); iAc.checked = t.activo !== false;
    f.appendChild(lAc);
    var rid = nuevoRid();
    var m = capa(nuevo ? 'Nuevo tema' : 'Editar tema · ' + t.id, f, [
      { texto: 'Cancelar', al: function () { m.cerrar(); } },
      { texto: 'Guardar', icono: 'check', marca: true, al: guardar }
    ]);
    setTimeout(function () { (nuevo ? iT : iF).focus(); }, 120);

    function guardar(bt) {
      if (m.ocupado) return;
      var tema = {
        id: t.id, titulo: iT.value.replace(/\s+/g, ' ').trim(),
        frases: iF.value.split('\n').map(function (x) { return x.trim(); }).filter(Boolean),
        respuesta: iR.value.trim(), vista: iV.value.replace(/\s+/g, '').trim(), accion: iA.value.trim(),
        orden: iO.value.trim(), activo: iAc.checked
      };
      if (tema.titulo.length < 3) { aviso('Escribe el título.', 'aviso', 3000); iT.focus(); return; }
      if (!tema.frases.length) { aviso('Pon al menos una frase de ejemplo.', 'aviso', 3000); iF.focus(); return; }
      if (!tema.respuesta) { aviso('Escribe la respuesta.', 'aviso', 3000); iR.focus(); return; }
      m.ocupado = true; m.botones.forEach(function (x) { x.disabled = true; }); bt.classList.add('kit-ocupado');
      var t0 = performance.now();
      llamar('asistentetemaguardar', { tema: tema }, { post: true, rid: rid }).then(function (r) {
        m.ocupado = false; m.cerrar();
        try { window.__ayudaMed.push({ ruta: 'guardar:tema', ms: Math.round(performance.now() - t0) }); } catch (e) {}
        var x = indice(r.tema);
        var i = -1; D.temas.forEach(function (y, k) { if (y.id === x.id) i = k; });
        if (i >= 0) D.temas[i] = x; else D.temas.push(x);
        MOTOR = null;
        aplicarAqui(r.sello);
        aviso(r.nuevo ? 'Tema creado. Llega a los teléfonos en su siguiente apertura.' : 'Tema guardado. Llega a los teléfonos en su siguiente apertura.', 'ok', 4000);
        pintar();
      }, function (e) {
        m.ocupado = false; m.botones.forEach(function (x) { x.disabled = false; }); bt.classList.remove('kit-ocupado');
        aviso((e && e.message) || 'No se pudo guardar el tema.', 'malo', 8000);
      });
    }
  }

  /* ══════════════ por enseñar ══════════════ */
  function pintarEnsenar(z) {
    var L = D.porEnsenar;
    if (!L.length) {
      z.appendChild(K.nodo('<div class="kit-tarjeta ayd-vacio">' + ico('check', 30) + '<p><b>No hay nada por enseñar.</b><br>Aquí llegan las preguntas sin respuesta y las que tuvieron 👎.</p></div>'));
      return;
    }
    var mo = motor();
    var rej = K.nodo('<div class="ayd-lista"></div>');
    L.slice(0, 120).forEach(function (p) {
      var c = K.nodo('<section class="kit-tarjeta ayd-preg"><p class="ayd-preg__q"></p><p class="ayd-preg__m"></p><div class="ayd-preg__sug"></div><div class="ayd-preg__b"></div></section>');
      c.querySelector('.ayd-preg__q').textContent = '«' + p.pregunta + '»';
      c.querySelector('.ayd-preg__m').textContent = [p.fecha, p.vista || 'sin vista', p.voto === '👎' ? '👎 respondió ' + (p.tema || '') : 'sin respuesta'].join(' · ');
      var sug = c.querySelector('.ayd-preg__sug');
      var r = mo ? mo.buscar(p.pregunta, { vista: p.vista, estado: 'ACTIVO', entrada: p.vista === 'entrada' }) : null;
      sug.appendChild(K.nodo('<span class="ayd-et">Asignar como frase de:</span>'));
      (r ? r.candidatos.slice(0, 3) : []).forEach(function (x) {
        var b = K.nodo('<button type="button" class="kit-pastilla"></button>');
        b.textContent = x.tema.titulo + ' · ' + Math.round(x.puntaje * 100) + '%';
        b.addEventListener('click', function () { ensenar(p, x.tema.id, b); });
        sug.appendChild(b);
      });
      var sel = K.nodo('<select class="ayd-sel"><option value="">Otro tema…</option></select>');
      temas().forEach(function (t) { var o = document.createElement('option'); o.value = t.id; o.textContent = t.titulo; sel.appendChild(o); });
      sel.addEventListener('change', function () { if (sel.value) ensenar(p, sel.value, sel); });
      sug.appendChild(sel);
      var bb = c.querySelector('.ayd-preg__b');
      var bN = K.nodo('<button type="button" class="kit-btn kit-btn--plano">' + ico('mas', 15) + ' Crear tema con esta frase</button>');
      bN.addEventListener('click', function () { editar(null, p.pregunta); });
      var bD = K.nodo('<button type="button" class="kit-btn kit-btn--plano">' + ico('cerrar', 15) + ' Descartar</button>');
      bD.addEventListener('click', function () { ensenar(p, '', bD, true); });
      bb.appendChild(bN); bb.appendChild(bD);
      rej.appendChild(c);
    });
    z.appendChild(rej);
  }

  var OCUPADO = false;
  function ensenar(p, idTema, boton, descartar) {
    if (OCUPADO) return;
    OCUPADO = true;
    if (boton) { boton.disabled = true; boton.classList.add('kit-ocupado'); }
    llamar('asistenteensenar', { idPregunta: p.id, idTema: idTema, descartar: !!descartar }, { post: true, rid: p.__rid || (p.__rid = nuevoRid()) }).then(function (r) {
      OCUPADO = false;
      D.porEnsenar = D.porEnsenar.filter(function (x) { return x.id !== p.id; });
      if (D.resumen) D.resumen.porEnsenar = D.porEnsenar.length;
      if (!descartar) {
        var t = null; D.temas.forEach(function (x) { if (x.id === idTema) t = x; });
        if (t && r.frase && t.frases.indexOf(r.frase) < 0) { t.frases.push(r.frase); indice(t); }
        MOTOR = null;
        aplicarAqui(r.sello);
      }
      aviso(descartar ? 'Descartada.' : 'Aprendido: «' + r.frase + '».', 'ok', 3000);
      pintar();
    }, function (e) {
      OCUPADO = false;
      if (boton) { boton.disabled = false; boton.classList.remove('kit-ocupado'); }
      aviso((e && e.message) || 'No se pudo guardar.', 'malo', 7000);
    });
  }

  /* ══════════════ probar ══════════════ */
  function pintarProbar(z) {
    var f = K.nodo('<section class="kit-tarjeta ayd-probar">' +
      '<label class="kit-sop__campo"><span>Vista</span><select class="ayd-sel ayd-v"></select></label>' +
      '<label class="kit-sop__campo"><span>Escribe una frase como la escribiría la gente</span><input class="ayd-q" maxlength="200" autocomplete="off" placeholder="Ej.: qué tengo pendiente"></label>' +
      '<div class="ayd-probar__res" aria-live="polite"></div><div class="ayd-probar__frec"></div></section>');
    var sV = f.querySelector('.ayd-v'), iQ = f.querySelector('.ayd-q'), res = f.querySelector('.ayd-probar__res'), fr = f.querySelector('.ayd-probar__frec');
    CAT.vistas.forEach(function (v) { var o = document.createElement('option'); o.value = v; o.textContent = v; sV.appendChild(o); });
    sV.value = PRUEBA.vista; iQ.value = PRUEBA.frase;
    function correr() {
      PRUEBA.vista = sV.value; PRUEBA.frase = iQ.value;
      var mo = motor();
      fr.innerHTML = '';
      if (mo) {
        fr.appendChild(K.nodo('<span class="ayd-et">Preguntas frecuentes de esta vista:</span>'));
        mo.frecuentes(sV.value, 'ACTIVO').forEach(function (t) { var b = K.nodo('<span class="kit-pastilla"></span>'); b.textContent = t.titulo; fr.appendChild(b); });
      }
      var q = iQ.value.trim();
      if (!q || !mo) { res.innerHTML = '<p class="ayd-nada">Escribe una frase para ver qué respondería el asistente.</p>'; return; }
      var r = mo.buscar(q, { vista: sV.value, estado: 'ACTIVO', entrada: sV.value === 'entrada' });
      var tipo = r.tipo === 'tema' ? '<b class="ayd-ok">Responde</b>' : (r.tipo === 'dudas' ? '<b class="ayd-duda">¿Quisiste decir…?</b>' : '<b class="ayd-malo">Fuera de la app (o Gemini decide)</b>');
      var h = '<p>' + tipo + ' · ' + r.ms + ' ms en el teléfono</p>';
      if (r.tipo === 'tema') h += '<div class="ayd-probar__resp"><p class="ayd-probar__tt">' + esc(r.tema.titulo) + ' <i>' + esc(r.tema.id) + ' · ' + Math.round(r.puntaje * 100) + '%</i></p><p>' + rico(r.tema.respuesta) + '</p>' +
        (r.tema.accion ? '<p class="ayd-probar__acc">' + ico('adelante', 14) + ' ' + esc(r.tema.accion) + '</p>' : '') + '</div>';
      h += '<ol class="ayd-probar__cand">' + r.candidatos.map(function (c) { return '<li>' + esc(c.tema.titulo) + ' <i>' + Math.round(c.puntaje * 100) + '%</i></li>'; }).join('') + '</ol>';
      res.innerHTML = h;
    }
    var tq = null;
    iQ.addEventListener('input', function () { clearTimeout(tq); tq = setTimeout(correr, 120); });
    sV.addEventListener('change', correr);
    z.appendChild(f);
    correr();
    setTimeout(function () { iQ.focus(); }, 80);
  }

  /* ══════════════ enganche ══════════════ */
  function enchufar() {
    var b = $('btn-asistente-dev');
    if (b && !b.__ayd) { b.__ayd = true; b.addEventListener('click', abrir); }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', enchufar); else enchufar();
  window.addEventListener('hac:logout', function () { D = null; MOTOR = null; });

  window.AYUDA_DEV = {
    abrir: abrir,
    /* el asistente trae aquí al DEV con la frase que no supo responder */
    probar: function (frase, vista) {
      F.pestana = 'probar';
      PRUEBA.frase = String(frase || '');
      PRUEBA.vista = CAT.vistas.indexOf(vista) >= 0 ? vista : 'inicio';
      abrir();
    },
    _datos: function () { return D; },
    _cat: CAT
  };
}());
