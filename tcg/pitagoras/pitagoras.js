/* Adaptador del laboratorio de Pitágoras. El único estado mutable es la
   semilla de esta pestaña; las reglas viven en los módulos reales copiados. */
'use strict';
(function(){
  const revision=typeof PITAGORAS_REVISION==='undefined'?null:PITAGORAS_REVISION,$=id=>document.getElementById(id);
  const estado=$('pitagorasEstado'),entrada=$('pitagorasSemilla'),iniciar=$('pitagorasIniciar'),otra=$('pitagorasCambiarSemilla'),lista=$('pitagorasListaCartas'),conducta=$('pitagorasConductaDatos');
  const nombres={isometrico:'La cosecha',laseres:'El corte final',fps:'Fuera de cuadro',carrera:'El último puente',orbital:'Órbita muerta',duelo:'La memoria del Editor'};
  function entero(valor,alternativa){const n=Number.parseInt(valor,10);return Number.isSafeInteger(n)&&n>0?n:alternativa;}
  function texto(valor){return String(valor||'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();}
  function decir(mensaje){if(estado)estado.textContent=mensaje;}
  function crear(tag,clase,contenido){const n=document.createElement(tag);if(clase)n.className=clase;if(contenido!==undefined)n.textContent=contenido;return n;}
  function dibujarCartas(){
    if(!lista||!revision)return;
    lista.replaceChildren();
    for(const id of revision.cartas||[]){
      const carta=typeof CARDS==='undefined'?null:CARDS[id];if(!carta)continue;
      const ficha=crear('article','pitagorasCarta');ficha.dataset.carta=id;
      const prueba=crear('p','pitagorasCartaPrueba','PRUEBA · '+(nombres[carta.editorJuego]||carta.editorJuego||'EDITOR'));
      const titulo=crear('h3','',carta.n||id);
      const datos=crear('dl','pitagorasDatos');
      for(const [etiqueta,valor] of [['Coste',carta.c],['ATQ',carta.a],['PV',carta.h]]){const grupo=crear('div');grupo.append(crear('dt','',etiqueta),crear('dd','',String(valor??'—')));datos.append(grupo);}
      const descripcion=crear('p','pitagorasCartaTexto',texto(carta.x)||'Prueba del Editor.');
      ficha.append(prueba,titulo,datos,descripcion);lista.append(ficha);
    }
  }
  function fuente(etiqueta,dato){
    const origen=crear('p','pitagorasFuente');
    origen.append(document.createTextNode(etiqueta+': '+dato.funcion+' · línea '+dato.linea+' · '),crear('code','',dato.sha256.slice(0,12)));
    return origen;
  }
  function fichaConducta(sello,titulo){
    const ficha=crear('article','pitagorasRegla');ficha.append(crear('p','pitagorasCartaPrueba',sello),crear('h3','',titulo));return ficha;
  }
  function metrica(etiqueta,valor){
    const bloque=crear('div','pitagorasMetrica');bloque.append(crear('span','',etiqueta),crear('strong','',String(valor)));return bloque;
  }
  function dibujarConducta(){
    if(!conducta||!revision?.conducta)return;
    const datos=revision.conducta,ritual=datos.ritual,pesadilla=datos.pesadilla,prioridad=datos.prioridad;
    conducta.replaceChildren();
    const inicio=fichaConducta('APERTURA DEL JEFE','Ritual del Editor');
    inicio.append(metrica('PD al iniciar',ritual.pdInicial));
    inicio.append(crear('p','pitagorasReglaTexto','Parte de un mínimo de '+ritual.pisoAntesDeCurva+' y aplica la curva de +'+ritual.incrementoPorTurno+' PD por turno, con tope de '+ritual.tope+'.'));
    if(ritual.bloqueaBonoSegundo)inicio.append(crear('p','pitagorasReglaTexto','El bono normal de segundo jugador (+'+ritual.bonoSegundoJugador+' PD) se suprime en esta reserva inicial: el Ritual se queda en '+ritual.pdInicial+' PD.'));
    inicio.append(fuente('Fuente',datos.procedencia.ritual));

    const limite=fichaConducta('BLOQUEO DEL CICLO','Una Pesadilla por turno');
    limite.append(metrica('Límite derivado',pesadilla.unaPorTurno?'1':'—'));
    const detalle=crear('p','pitagorasReglaTexto');
    detalle.append(document.createTextNode('Compara '),crear('code','',pesadilla.marca),document.createTextNode(' con '),crear('code','',pesadilla.contador),document.createTextNode(pesadilla.marcaAntesDePrueba?' y fija la marca antes de abrir la prueba.':' después de abrir la prueba.'));
    limite.append(detalle,fuente('Marcado',datos.procedencia.pesadilla.marcado));

    const orden=fichaConducta('LECTURA ESTÁTICA','Prioridad de las Pesadillas');orden.classList.add('pitagorasReglaAmplia');
    const resumen=crear('p','pitagorasReglaTexto','Respaldo si una carta no declara prioridad: '+prioridad.respaldo+'. Penalización: −'+prioridad.penalizacionPorPDFaltante+' por cada PD faltante.');
    const listaPrioridades=crear('ul','pitagorasPrioridades');
    for(const item of prioridad.cartas){
      const carta=typeof CARDS==='undefined'?null:CARDS[item.id];if(!carta)continue;
      const fila=crear('li','pitagorasPrioridad');
      const nombre=crear('strong','',carta.n);const base=crear('span','pitagorasBase','Base '+item.base);
      const cabecera=crear('div','pitagorasPrioridadCabecera');cabecera.append(nombre,base);fila.append(cabecera);
      if(item.bonos.length){
        const bonos=crear('ul','pitagorasBonos');
        for(const bono of item.bonos){const linea=crear('li','');linea.append(crear('b','', '+'+bono.valor+' '),document.createTextNode('si '),crear('code','',bono.condicion));bonos.append(linea);}
        fila.append(bonos);
      }else fila.append(crear('p','pitagorasSinBono','Sin bono condicional en la fuente actual.'));
      listaPrioridades.append(fila);
    }
    orden.append(resumen,listaPrioridades,fuente('Fuente',datos.procedencia.prioridad));
    conducta.append(inicio,limite,orden);
  }
  function nuevaSemilla(){
    const bytes=new Uint32Array(1);if(globalThis.crypto?.getRandomValues)crypto.getRandomValues(bytes);else bytes[0]=Math.floor(Math.random()*0x7fffffff);
    entrada.value=String(Math.max(1,bytes[0]>>>0));decir('Nueva semilla lista. El puente usa las reglas reales con este recorrido repetible.');
  }
  async function abrirPuente(){
    const api=window.PITAGORAS_PRUEBAS,puente=revision?.puente;
    if(!api?.iniciar||!puente){decir('No se pudo cargar el módulo real de El último puente.');return;}
    if(api.activa)return;
    const semilla=entero(entrada.value,puente.semilla);entrada.value=String(semilla);iniciar.disabled=true;otra.disabled=true;
    decir('El último puente está abierto. La semilla '+semilla+' se conserva sólo en esta pestaña.');
    try{
      const resultado=await api.iniciar({...puente,semilla,personaje:{...puente.personaje}});
      decir(resultado?.cancelado?'Prueba cerrada sin modificar nada.':resultado?.sobrevivio?'Sobreviviste al puente. Revisa si la presión fue intensa y legible.':'El puente te alcanzó. Revisa dónde dejó de ser defendible.');
    }catch(error){decir('La prueba no pudo abrirse: '+(error?.message||'error inesperado')+'.');}
    finally{iniciar.disabled=false;otra.disabled=false;iniciar.focus({preventScroll:true});}
  }
  function preparar(){
    if(!revision){decir('Falta el fixture temporal de Pitágoras.');return;}
    entrada.value=String(revision.puente.semilla);dibujarConducta();dibujarCartas();iniciar.addEventListener('click',abrirPuente);otra.addEventListener('click',nuevaSemilla);
    window.CAOZ_PITAGORAS_VISTA=Object.freeze({fixture:revision,abrirPuente,nuevaSemilla});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',preparar,{once:true});else preparar();
})();
