'use strict';
(function(){
  const $=id=>document.getElementById(id);
  const motor=window.CAOZ_ASEDIO;
  const datos=window.CAOZ_ASEDIO_DATA;
  let estado=null;
  let balance={thal:{vida:36}};

  function crear(tag,clase,texto){
    const nodo=document.createElement(tag);
    if(clase)nodo.className=clase;
    if(texto!==undefined)nodo.textContent=texto;
    return nodo;
  }
  function plural(n,uno,muchos){return n===1?uno:muchos;}
  function tituloContador(id){return id?String(id).replaceAll('_',' '):'';}
  function accionActual(){return motor.legalActions(estado)[0]||null;}
  function coincide(esperada,parcial){
    if(!esperada||esperada.type!==parcial.type)return false;
    return Object.entries(parcial).every(([clave,valor])=>esperada[clave]===valor);
  }
  function clonarAccion(accion){return JSON.parse(JSON.stringify(accion));}
  function aplicarAccion(accion){
    const respuesta=motor.dispatch(estado,clonarAccion(accion));
    if(!respuesta.ok){
      mostrarAviso(respuesta.mensaje,'error');
      return;
    }
    estado=respuesta.estado;
    mostrarAviso('', '');
    renderizar();
  }
  function mostrarAviso(texto,clase){
    const destino=$('asedioPista');
    if(!texto)return;
    destino.textContent=texto;
    destino.classList.toggle('esError',clase==='error');
  }
  function reiniciar(){
    estado=motor.createState({balance});
    $('asedioMetricas').textContent='Reproduce el guion para medir daño, fases y participación.';
    mostrarAviso('', '');
    renderizar();
  }
  function imagen(art,alternativa){
    const marco=crear('div','asedioArte');
    const img=crear('img');
    img.src='./art/'+encodeURIComponent(art)+'.webp';
    img.alt='';
    img.decoding='async';
    img.addEventListener('error',()=>{img.hidden=true;marco.classList.add('sinArte');});
    const fallback=crear('span','asedioArteFallback',alternativa);
    marco.append(img,fallback);
    return marco;
  }
  function costeTexto(coste){
    const partes=[];
    if(coste?.impulso)partes.push(coste.impulso+' impulso'+(coste.impulso===1?'':'s'));
    if(coste?.accion)partes.push(coste.accion+' '+(coste.accion===1?'acción':'acciones'));
    if(coste?.dominio)partes.push(coste.dominio+' dominio');
    if(coste?.comando)partes.push(coste.comando+' orden'+(coste.comando===1?'':'es'));
    if(coste?.ira)partes.push('+ '+coste.ira+' ira');
    if(coste?.deseo)partes.push(coste.deseo+' deseo');
    return partes.join(' · ');
  }
  function chip(texto,clase){return crear('span','asedioChip '+(clase||''),texto);}
  function estadoNombre(estado){
    const mapa={expuesto:'Expuesto',infectado:'Infectado',golpe_sangre_fria:'Sangre fría',rulchete:'Rulchete',poseido:'Poseído',zancada:'Zancada'};
    return mapa[estado]||tituloContador(estado);
  }
  function crearCarta(id,opciones={}){
    const carta=datos.cards[id];
    if(!carta)return crear('div','asedioCarta asedioCartaVacia','Carta desconocida');
    const accion=accionActual();
    const habilitada=opciones.accion&&coincide(accion,opciones.accion);
    const raiz=habilitada?crear('button','asedioCarta asedioCartaBoton'):crear('div','asedioCarta');
    if(habilitada){
      raiz.type='button';
      raiz.onclick=()=>aplicarAccion(accion);
      raiz.setAttribute('aria-label','Usar '+carta.n+'. '+carta.text);
      raiz.classList.add('esAccion');
    }
    raiz.dataset.card=id;
    raiz.append(imagen(carta.art,carta.n));
    const pie=crear('div','asedioCartaPie');
    pie.append(crear('span','asedioTipo',carta.tipo));
    pie.append(crear('strong','asedioCartaNombre',carta.n));
    pie.append(crear('span','asedioCartaTexto',carta.text));
    const coste=costeTexto(carta.cost);
    if(coste)pie.append(crear('span','asedioCoste',coste));
    raiz.append(pie);
    return raiz;
  }
  function crearUnidad(unidad,opciones={}){
    const accion=accionActual();
    const habilitada=opciones.accion&&coincide(accion,opciones.accion);
    const raiz=habilitada?crear('button','asedioUnidad asedioUnidadBoton'):crear('div','asedioUnidad');
    if(habilitada){
      raiz.type='button';
      raiz.onclick=()=>aplicarAccion(accion);
      raiz.classList.add('esAccion');
      raiz.setAttribute('aria-label','Elegir '+unidad.n+' para interceptar');
    }
    const carta=datos.cards[unidad.cardId];
    if(carta)raiz.append(imagen(carta.art,unidad.n));
    else raiz.append(crear('span','asedioUnidadIcono',unidad.possessed?'☠':'⚔'));
    const texto=crear('div','asedioUnidadTexto');
    texto.append(crear('strong','',unidad.n));
    const resto=Math.max(0,unidad.hp-(unidad.damage||0));
    texto.append(crear('span','',unidad.attack+' / '+resto));
    if(unidad.guard)texto.append(chip('Guardia','guardia'));
    if(unidad.possessed)texto.append(chip('Poseído','poseido'));
    raiz.append(texto);
    return raiz;
  }
  function barraVida(actual,maximo,clase){
    const barra=crear('div','asedioBarra '+(clase||''));
    const relleno=crear('span');
    relleno.style.width=Math.max(0,Math.min(100,(actual/maximo)*100))+'%';
    barra.append(relleno);
    return barra;
  }
  function renderizarTutorial(){
    const paso=motor.currentStep(estado);
    const total=datos.tutorial.steps.length;
    const finalizar=!paso;
    const terminoTemprano=Boolean(estado.tutorial.endedEarly);
    $('asedioCapitulo').textContent=(paso?.chapter||'Resultado').toUpperCase();
    $('asedioProgresoTexto').textContent=finalizar?(terminoTemprano?'Partida terminada antes del guion':'Tutorial completado'):'Paso '+(estado.tutorial.step+1)+' de '+total;
    $('tutorialPasoTitulo').textContent=paso?.title||(estado.winner==='heroes'?'Thal ha caído':'El tutorial terminó');
    $('asedioInstruccion').textContent=paso?.text||(terminoTemprano?'El balance terminó la partida antes de las lecciones restantes.':estado.winner==='heroes'?'El motor confirmó la victoria de los cinco protagonistas.':'No quedan acciones por resolver.');
    const continuar=$('asedioContinuar');
    const esTexto=paso?.kind==='say';
    continuar.hidden=!esTexto;
    continuar.disabled=!esTexto;
    continuar.onclick=esTexto?()=>aplicarAccion(accionActual()):null;
    if(!paso){
      $('asedioPista').textContent=estado.winner==='heroes'?'Puedes reiniciar o probar otro total de vida en el laboratorio.':'Puedes reiniciar el tutorial.';
      $('asedioPista').classList.remove('esError');
    }else if(!esTexto){
      $('asedioPista').textContent='Busca el borde dorado en el tablero: ésa es la única acción válida ahora.';
      $('asedioPista').classList.remove('esError');
    }else{
      $('asedioPista').textContent='Lee la regla y continúa cuando estés listo.';
      $('asedioPista').classList.remove('esError');
    }
    $('asedioTutorial').classList.toggle('esVictoria',estado.over&&estado.winner==='heroes');
  }
  function renderizarThal(){
    const thal=estado.thal;
    $('asedioFase').textContent='FASE '+['I','II','III'][thal.phase-1];
    $('asedioRonda').textContent='RONDA '+estado.round;
    const estadoThal=$('asedioThalEstado');
    estadoThal.replaceChildren();
    const resumen=crear('div','asedioThalResumen');
    const retrato=imagen('domo','THAL');
    retrato.classList.add('asedioRetratoThal');
    resumen.append(retrato);
    const vida=crear('div','asedioThalVida');
    vida.append(crear('strong','',thal.vida+' / '+thal.maxVida+' VIDA'));
    vida.append(barraVida(thal.vida,thal.maxVida,'thal'));
    const estados=crear('div','asedioEstados');
    thal.estados.forEach(s=>estados.append(chip(estadoNombre(s),s)));
    vida.append(estados);
    resumen.append(vida);
    const recursos=crear('div','asedioRecursos');
    recursos.append(chip('◈ '+thal.dominio+' Dominio','dominio'));
    recursos.append(chip('⌁ '+thal.comandos+' Órdenes','ordenes'));
    recursos.append(chip('♨ '+thal.ira+' / '+estado.profile.thal.iraMax+' Ira','ira'));
    recursos.append(chip('◐ '+thal.deseo+' / '+estado.profile.thal.deseoMax+' Deseo','deseo'));
    resumen.append(recursos);
    estadoThal.append(resumen);

    const rastro=$('asedioRastro');
    rastro.replaceChildren();
    estado.rastro.forEach((id,indice)=>{
      const carta=crearCarta(id,{accion:{type:'RESOLVE_RASTRO',actor:'thal',card:id}});
      carta.classList.toggle('asedioResuelve',indice===0);
      const marca=crear('span','asedioMarcaRastro',indice===0?'RESUELVE':'PRESAGIO '+indice);
      carta.prepend(marca);
      rastro.append(carta);
    });
    if(!estado.rastro.length)rastro.append(crear('p','asedioVacio','No quedan Amenazas visibles en el Rastro.'));

    const esbirros=$('asedioEsbirros');
    esbirros.replaceChildren();
    $('asedioEsbirrosContador').textContent=thal.minions.length+' / '+estado.profile.thal.esbirros;
    thal.minions.forEach(unidad=>esbirros.append(crearUnidad(unidad,{accion:{type:'INTERCEPT',actor:'thal',unit:unidad.id}})));
    if(!thal.minions.length)esbirros.append(crear('p','asedioVacio','Thal aún no tiene Esbirros.'));

    const mano=$('asedioManoThal');
    mano.replaceChildren();
    thal.mano.forEach(id=>{
      const carta=datos.cards[id];
      const paso=accionActual();
      const accion=paso?.type==='PLAY_REACTION'?{type:'PLAY_REACTION',actor:'thal',card:id,target:paso.target}:{type:'PLAY_CARD',actor:'thal',card:id};
      mano.append(crearCarta(id,{accion}));
    });
    if(!thal.mano.length)mano.append(crear('p','asedioVacio','La mano de Thal está vacía.'));

    const esperada=accionActual();
    const reflejo=$('asedioReflejo');
    reflejo.disabled=!coincide(esperada,{type:'REFLECTION',actor:'thal'});
    reflejo.classList.toggle('esAccion',!reflejo.disabled);
    reflejo.onclick=reflejo.disabled?null:()=>aplicarAccion(esperada);
    const cierre=$('asedioCerrarRonda');
    cierre.disabled=!coincide(esperada,{type:'CLOSE_ROUND',actor:'thal'});
    cierre.classList.toggle('esAccion',!cierre.disabled);
    cierre.onclick=cierre.disabled?null:()=>aplicarAccion(esperada);
  }
  function renderizarHeroe(id){
    const base=datos.heroes[id];
    const heroe=estado.heroes[id];
    const tarjeta=crear('article','asedioHeroe');
    tarjeta.style.setProperty('--heroe-color',base.color);
    tarjeta.dataset.hero=id;
    const cabecera=crear('header','asedioHeroeCabecera');
    const foto=imagen(base.art,base.icono);
    foto.classList.add('asedioRetratoHeroe');
    cabecera.append(foto);
    const identidad=crear('div','asedioHeroeIdentidad');
    identidad.append(crear('strong','',base.n));
    identidad.append(crear('span','',base.ep));
    cabecera.append(identidad);
    const salud=crear('div','asedioSaludHeroe');
    salud.append(crear('strong','',heroe.vida+'/'+heroe.maxVida));
    salud.append(crear('span','', 'vida'));
    cabecera.append(salud);
    tarjeta.append(cabecera);
    tarjeta.append(barraVida(heroe.vida,heroe.maxVida,'heroe'));
    const recursos=crear('div','asedioHeroeRecursos');
    recursos.append(chip('⚡ '+heroe.impulsos+' impulso'+(heroe.impulsos===1?'':'s')));
    recursos.append(chip('◉ '+heroe.acciones+' '+(heroe.acciones===1?'acción':'acciones')));
    const contador=base.contador;
    recursos.append(chip(base.icono+' '+heroe.contadores[contador]+' '+tituloContador(contador),'contador'));
    tarjeta.append(recursos);
    const estados=crear('div','asedioEstados asedioEstadosHeroe');
    heroe.estados.forEach(s=>estados.append(chip(estadoNombre(s),s)));
    Object.values(heroe.preparaciones).forEach(p=>estados.append(chip(tituloContador(p.key)+(p.charges?' ×'+p.charges:''),'preparacion')));
    tarjeta.append(estados);
    const asalto=crear('button','asedioAsalto','Asaltar a Thal');
    asalto.type='button';
    const esperada=accionActual();
    asalto.disabled=!coincide(esperada,{type:'DECLARE_ASSAULT',actor:id});
    asalto.classList.toggle('esAccion',!asalto.disabled);
    asalto.onclick=asalto.disabled?null:()=>aplicarAccion(esperada);
    const textoAsalto=crear('span','asedioAsaltoDetalle','Base '+(heroe.asalto??base.asalto)+' · '+base.lider);
    tarjeta.append(asalto,textoAsalto);
    const aliados=crear('div','asedioAliados');
    aliados.append(crear('span','asedioMiniEtiqueta','VANGUARDIA Y APOYO'));
    if(heroe.vanguardia)aliados.append(crearUnidad(heroe.vanguardia));
    heroe.apoyo.forEach(u=>aliados.append(crearUnidad(u)));
    if(!heroe.vanguardia&&!heroe.apoyo.length)aliados.append(crear('span','asedioAliadoVacio','Sin aliados en mesa'));
    tarjeta.append(aliados);
    const mano=crear('div','asedioMano asedioManoHeroe');
    mano.setAttribute('aria-label','Mano de '+base.n);
    heroe.mano.forEach(cartaId=>{
      const paso=accionActual();
      const accion=paso?.type==='PLAY_CARD'?{type:'PLAY_CARD',actor:id,card:cartaId,target:paso.target}:null;
      mano.append(crearCarta(cartaId,{accion}));
    });
    if(!heroe.mano.length)mano.append(crear('p','asedioVacio','Sin cartas en mano.'));
    tarjeta.append(mano);
    return tarjeta;
  }
  function renderizarHeroes(){
    const mesa=$('asedioHeroesMesa');
    mesa.replaceChildren();
    datos.tutorial.heroes.forEach(id=>mesa.append(renderizarHeroe(id)));
  }
  function describirEvento(evento){
    const nombre=id=>datos.heroes[id]?.n||datos.cards[id]?.n||tituloContador(id);
    switch(evento.tipo){
      case 'partida.creada':return 'El motor creó la partida de '+evento.profile+'.';
      case 'carta.jugada':return nombre(evento.actor)+' juega '+(datos.cards[evento.card]?.n||evento.card)+'.';
      case 'asalto.declarado':return nombre(evento.actor)+' declara Asalto por '+evento.amount+'.';
      case 'daño.thal':return nombre(evento.actor)+' hace '+evento.amount+' daño directo a Thal.';
      case 'daño.unidad':return nombre(evento.unit)+' recibe '+evento.amount+' daño.';
      case 'daño.hero':return nombre(evento.hero)+' pierde '+evento.amount+' vida.';
      case 'daño.previene':return nombre(evento.hero)+' previene '+evento.amount+' daño con Armadura Mágica.';
      case 'hero.cae':return nombre(evento.hero)+' queda Caído.';
      case 'contador.gana':return nombre(evento.hero)+' gana '+evento.amount+' '+tituloContador(evento.counter)+'.';
      case 'contador.gasta':return nombre(evento.hero)+' gasta '+evento.amount+' '+tituloContador(evento.counter)+'.';
      case 'rastro.resuelve':return 'Thal resuelve '+(datos.cards[evento.card]?.n||evento.card)+'.';
      case 'reaccion.reflejo':return 'Thal reduce el Asalto de '+nombre(evento.actor)+' con Reflejo.';
      case 'guardia.intercepta':return nombre(evento.unit)+' intercepta el Asalto de '+nombre(evento.actor)+'.';
      case 'unidad.cae':return nombre(evento.unit)+' cae.';
      case 'unidad.poseida':return nombre(evento.original)+' regresa Poseído; Deseo sube a '+evento.desire+'.';
      case 'poseido.disipado':return nombre(evento.unit)+' es liberado del control de Thal.';
      case 'fase.cambia':return 'Thal entra en la fase '+evento.phase+'.';
      case 'ronda.cierra':return 'Se cierra la ronda '+evento.round+'.';
      case 'ronda.inicia':return 'Comienza la ronda '+evento.round+'.';
      case 'partida.termina':return evento.winner==='heroes'?'Thal cae a 0: ganan los protagonistas.':'Thal gana por '+evento.why+'.';
      default:return evento.tipo.replaceAll('.',' · ')+'.';
    }
  }
  function renderizarRegistro(){
    const log=$('asedioLog');
    log.replaceChildren();
    estado.eventLog.slice(-12).reverse().forEach(evento=>{
      const item=crear('li','asedioEvento');
      item.append(crear('span','asedioEventoNumero','#'+evento.i));
      item.append(crear('span','',describirEvento(evento)));
      log.append(item);
    });
    const resultado=$('asedioResultado');
    resultado.textContent=estado.over?(estado.winner==='heroes'?'VICTORIA DEL EQUIPO':'VICTORIA DE THAL'):'EN CURSO';
    resultado.className='asedioResultado '+(estado.over&&estado.winner==='heroes'?'heroes':estado.over?'thal':'');
  }
  function renderizar(){
    renderizarTutorial();
    renderizarThal();
    renderizarHeroes();
    renderizarRegistro();
  }
  function crearControlesAsalto(){
    const zona=$('asedioAsaltos');
    zona.replaceChildren();
    datos.tutorial.heroes.forEach(id=>{
      const heroe=datos.heroes[id];
      const etiqueta=crear('label','asedioAsaltoCampo');
      etiqueta.htmlFor='asedioAsalto-'+id;
      etiqueta.append(crear('span','',heroe.n));
      const input=crear('input');
      input.id='asedioAsalto-'+id;
      input.name='asalto-'+id;
      input.type='number';
      input.min='0';
      input.max='12';
      input.step='1';
      input.value=String(heroe.asalto);
      input.inputMode='numeric';
      etiqueta.append(input);
      zona.append(etiqueta);
    });
  }
  function leerBalance(){
    const campo=$('asedioVidaThal');
    const vida=Math.floor(Number(campo.value));
    if(!Number.isFinite(vida)||vida<1||vida>120){
      mostrarAviso('El laboratorio necesita una Vida de Thal entre 1 y 120.','error');
      campo.focus();
      return null;
    }
    const heroStats={};
    for(const id of datos.tutorial.heroes){
      const input=$('asedioAsalto-'+id);
      const asalto=Math.floor(Number(input.value));
      if(!Number.isFinite(asalto)||asalto<0||asalto>12){
        mostrarAviso('El Asalto de '+datos.heroes[id].n+' debe estar entre 0 y 12.','error');
        input.focus();
        return null;
      }
      heroStats[id]={asalto};
    }
    return {thal:{vida},heroStats};
  }
  function aplicarBalance(evento){
    evento.preventDefault();
    const nuevoBalance=leerBalance();
    if(!nuevoBalance)return;
    balance=nuevoBalance;
    reiniciar();
    $('asedioPista').textContent='Nuevo perfil aplicado: Thal comienza con '+balance.thal.vida+' vida.';
  }
  function reproducirGuion(){
    const nuevoBalance=leerBalance();
    if(!nuevoBalance)return;
    const resultado=motor.replayTutorial({balance:nuevoBalance});
    const metricas=motor.metrics(resultado.estado);
    const caja=$('asedioMetricas');
    caja.replaceChildren();
    const titulo=crear('strong','',resultado.ok?'Guion superado':resultado.endedEarly?'Victoria antes de completar el guion':'Guion no derrota a Thal');
    const detalle=crear('span','', 'Thal termina con '+metricas.thal.vida+' vida · fase '+metricas.thal.phase+' · ronda '+metricas.round+' · daño directo '+metricas.total+'.');
    const reparto=crear('span','',Object.entries(metricas.directo).map(([id,daño])=>(datos.heroes[id]?.n||id)+': '+daño).join(' · '));
    caja.append(titulo,detalle,reparto);
    if(!resultado.ok&&resultado.error)caja.append(crear('span','asedioMetricasError',resultado.error));
  }
  function preparar(){
    if(!motor||!datos)throw Error('La sección aislada necesita asedio-datos.js y asedio-motor.js.');
    const contenido=motor.validateContent();
    if(!contenido.ok)throw Error('El contenido de Asedio no es válido: '+contenido.errores.join(' '));
    crearControlesAsalto();
    $('asedioReiniciar').onclick=reiniciar;
    $('asedioBalanceForm').addEventListener('submit',aplicarBalance);
    $('asedioReproducir').onclick=reproducirGuion;
    reiniciar();
    window.CAOZ_ASEDIO_VISTA=Object.freeze({estado:()=>motor.copy(estado),reiniciar,reproducirGuion});
  }
  if(document.readyState==='loading')addEventListener('DOMContentLoaded',preparar,{once:true});else preparar();
})();
