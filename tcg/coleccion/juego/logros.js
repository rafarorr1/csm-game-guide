/* Logros del Domo.
 *
 * Este archivo no toca la mesa ni el DOM. Recibe eventos pequeños y resúmenes
 * estructurados de una partida, actualiza el progreso de la Colección y deja
 * que coleccion-modelo.js entregue el sobre en la misma escritura persistente.
 * Así un doble endGame, una recarga o un reintento de sincronización no puede
 * conceder dos sobres por un mismo logro.
 */
'use strict';
(function(global){
  const PROTAGONISTAS=Object.freeze(['mohamed','fender','talesin','rafaela','adreida']);
  const OTROS=Object.freeze({rafaela:['mohamed','fender','talesin','adreida'],adreida:['mohamed','fender','talesin','rafaela']});
  const PROHIBIDOS=new Set(['__proto__','prototype','constructor']);
  const propio=(objeto,clave)=>Object.prototype.hasOwnProperty.call(objeto,clave);
  const objeto=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
  const idSeguro=id=>typeof id==='string'&&/^[a-z0-9_-]{1,100}$/i.test(id)&&!PROHIBIDOS.has(id);
  const numero=(v,max=100000)=>Number.isSafeInteger(v)&&v>=0&&v<=max?v:0;
  const unico=lista=>[...new Set(lista)];

  /* Los títulos son texto de interfaz; los IDs se mantienen estables para que
     el recibo de cada sobre sobreviva a cualquier ajuste futuro de redacción. */
  const DEFINICIONES=Object.freeze([
    {id:'mohamed_sneaky_tricky',protagonista:'mohamed',titulo:'Sneaky Tricky',descripcion:'Gana usando el Pergamino del Deseo con solo 1 Alma.',tipo:'victoria'},
    {id:'mohamed_ctt',protagonista:'mohamed',titulo:'CTT',descripcion:'Gana una partida sin recibir daño a tu Alma.',tipo:'victoria'},
    {id:'mohamed_ahora_me_ves',protagonista:'mohamed',titulo:'Ahora me ves, ahora no me ves',descripcion:'Gana una partida en menos de 5 rondas.',tipo:'victoria'},
    {id:'mohamed_ladron_templos',protagonista:'mohamed',titulo:'Ladrón de Templos',descripcion:'Gana con el Pergamino del Deseo en menos de 5 rondas.',tipo:'victoria'},
    {id:'mohamed_backstabber',protagonista:'mohamed',titulo:'BackStabber',descripcion:'Derrota a Mohamed con el golpe final de Machete.',tipo:'combate'},
    {id:'mohamed_cinco_caras',protagonista:'mohamed',titulo:'Cinco caras',descripcion:'Saca cara 5 veces seguidas al jugar con Mohamed.',tipo:'racha',meta:5},

    {id:'fender_bardnt',protagonista:'fender',titulo:'Bard(nt)',descripcion:'Gana sin usar ninguna Canción.',tipo:'victoria'},
    {id:'fender_22_canciones',protagonista:'fender',titulo:'22 canciones',descripcion:'Gana usando 22 canciones de Fender.',tipo:'contador',meta:22},
    {id:'fender_vida_goblin',protagonista:'fender',titulo:'La Vida de un Goblin es Difícil',descripcion:'Gana después de hacer 20 de daño a Alma con Machete.',tipo:'victoria'},
    {id:'fender_olvidadizo',protagonista:'fender',titulo:'Olvidadizo',descripcion:'Completa el tutorial de Fender 10 veces.',tipo:'contador',meta:10},
    {id:'fender_rapidin',protagonista:'fender',titulo:'Rapidín',descripcion:'Gana una partida en menos de 5 minutos.',tipo:'victoria'},

    {id:'talesin_amor_salvaje',protagonista:'talesin',titulo:'Amor Salvaje',descripcion:'Derrota a Talesyn con el golpe final de Petunia.',tipo:'combate'},
    {id:'talesin_thalesyn',protagonista:'talesin',titulo:'THALesyn',descripcion:'Gana una partida tras usar a Thal.',tipo:'victoria'},
    {id:'talesin_presidente_thal',protagonista:'talesin',titulo:'Presidente del Partido de Thal',descripcion:'Gana 100 partidas dando el último golpe con Thal.',tipo:'contador',meta:100},
    {id:'talesin_hola_papi',protagonista:'talesin',titulo:'Hola Papi',descripcion:'Gana una partida usando el Pergamino del Deseo.',tipo:'victoria'},
    {id:'talesin_cero_a_heroe',protagonista:'talesin',titulo:'De Cero a Héroe',descripcion:'Lleva una carta de 0 ATQ inicial a 10 ATQ.',tipo:'campo'},
    {id:'talesin_talesimp',protagonista:'talesin',titulo:'TaleSimp',descripcion:'Gana dando el último golpe con Petunia Celestial.',tipo:'victoria'},

    {id:'rafaela_rul_no_es_negro',protagonista:'rafaela',titulo:'¡Rul no es NEGRO!',descripcion:'Derrota a Thal con Rul.',tipo:'combate'},
    {id:'rafaela_you_rul',protagonista:'rafaela',titulo:'¡You RUL!',descripcion:'Gánale a cada otro protagonista con más de 20 de Alma.',tipo:'conjunto',meta:4},
    {id:'rafaela_charles_menson',protagonista:'rafaela',titulo:'Charles Menson',descripcion:'Ten 5 Apóstoles de Rul en el campo al mismo tiempo.',tipo:'campo'},
    {id:'rafaela_oculto',protagonista:'rafaela',titulo:'O(culto)',descripcion:'Ten un Apóstol de Rul con más de 5 ATQ en Sigilo.',tipo:'campo'},

    {id:'adreida_dos_orejas',protagonista:'adreida',titulo:'Dos orejas',descripcion:'Gánale a cada otro protagonista sin recibir daño.',tipo:'conjunto',meta:4},
    {id:'adreida_adreidos',protagonista:'adreida',titulo:'Adreidos',descripcion:'Gánale a otra Adreida.',tipo:'victoria'},
  ]);
  const POR_ID=Object.freeze(Object.fromEntries(DEFINICIONES.map(def=>[def.id,def])));
  const POR_PROTAGONISTA=Object.freeze(Object.fromEntries(PROTAGONISTAS.map(id=>[id,Object.freeze(DEFINICIONES.filter(def=>def.protagonista===id))])));

  function vacio(){return {version:1,obtenidos:[],contadores:{},conjuntos:{},rachas:{},eventos:[]};}
  function sanear(origen){
    const estado=vacio();
    if(!objeto(origen)||origen.version!==1)return estado;
    if(Array.isArray(origen.obtenidos))estado.obtenidos=unico(origen.obtenidos.filter(id=>propio(POR_ID,id)));
    for(const campo of ['contadores','rachas']){
      const valores=objeto(origen[campo])?origen[campo]:{};
      for(const [id,n] of Object.entries(valores))if(propio(POR_ID,id))estado[campo][id]=numero(n);
    }
    const conjuntos=objeto(origen.conjuntos)?origen.conjuntos:{};
    for(const [id,lista] of Object.entries(conjuntos))if(propio(POR_ID,id)&&Array.isArray(lista)){
      const limpio=unico(lista.filter(valor=>PROTAGONISTAS.includes(valor))).slice(0,PROTAGONISTAS.length);
      if(limpio.length)estado.conjuntos[id]=limpio;
    }
    if(Array.isArray(origen.eventos))estado.eventos=unico(origen.eventos.filter(idSeguro)).slice(-1000);
    return estado;
  }
  function copiar(estado){return JSON.parse(JSON.stringify(estado));}
  function leer(){return sanear(global.CAOZ_COLECCION?.leerMetas?.());}
  function logrado(estado,id){return estado.obtenidos.includes(id);}
  function desbloquear(estado,id,nuevos){
    if(!propio(POR_ID,id)||logrado(estado,id))return false;
    estado.obtenidos.push(id);nuevos.push(id);return true;
  }
  function sumar(estado,id,n=1){estado.contadores[id]=Math.min(100000,numero(estado.contadores[id])+Math.max(0,numero(n)));return estado.contadores[id];}
  function racha(estado,id,n){estado.rachas[id]=Math.min(100000,Math.max(0,numero(n)));return estado.rachas[id];}
  function agregarConjunto(estado,id,valor){
    const anterior=Array.isArray(estado.conjuntos[id])?estado.conjuntos[id]:[];
    if(!PROTAGONISTAS.includes(valor)||anterior.includes(valor))return anterior;
    const siguiente=[...anterior,valor];estado.conjuntos[id]=siguiente;return siguiente;
  }
  const ganar=e=>e?.ganada===true||e?.ganador==='local';
  const elegible=e=>e?.elegible!==false&&!e?.auto&&!e?.rapida&&!e?.silenciosa&&!e?.online&&!e?.tutorial;
  const ronda=e=>numero(e?.ronda??e?.turnos??0,100000);
  const fuente=e=>String(e?.ultimoGolpe?.origen??e?.origen??'');
  const jugo=(e,id)=>Array.isArray(e?.cartasJugadas)&&e.cartasJugadas.includes(id)||Array.isArray(e?.cartasEntradas)&&e.cartasEntradas.includes(id);
  const dano=e=>numero(e?.danoAlmaRecibido??e?.danoRecibido??0,100000);
  const alma=e=>numero(e?.almaFinal??e?.alma??0,100000);
  const canciones=e=>numero(e?.cancionesJugadas??e?.canciones??0,100000);
  const danoCarta=(e,id)=>numero(e?.danoAlmaPorCarta?.[id]??0,100000);
  const deseo=e=>e?.causa==='deseo'||e?.pergaminoGano===true;
  const duracion=e=>Number.isSafeInteger(e?.duracionMs)&&e.duracionMs>=0?e.duracionMs:null;
  const idEvento=e=>idSeguro(e?.eventoId)?e.eventoId:idSeguro(e?.id)?e.id:'';
  function yaProcesado(estado,event){const id=idEvento(event);return !!id&&estado.eventos.includes(id);}
  function procesar(estado,event){const id=idEvento(event);if(!id)return;estado.eventos=[...estado.eventos.filter(valor=>valor!==id),id].slice(-1000);}

  /* Contrato de eventos para motor.js. Cada evento es serializable y se puede
     probar sin DOM: volado, tutorial-completado, hito-campo, muerte-unidad y
     partida-finalizada. El motor conserva hechos reales del duelo; no se
     intenta deducir reglas leyendo textos del registro. */
  function aplicarEvento(entrada,event){
    const estado=sanear(entrada),nuevos=[];if(!objeto(event)||typeof event.tipo!=='string'||yaProcesado(estado,event))return {estado,nuevos};
    const lider=String(event.protagonista||'');
    if(event.tipo==='volado'&&elegible(event)&&lider==='mohamed'){
      const n=event.cara===true?numero(estado.rachas.mohamed_cinco_caras)+1:0;
      racha(estado,'mohamed_cinco_caras',n);if(n>=5)desbloquear(estado,'mohamed_cinco_caras',nuevos);
    }
    if(event.tipo==='tutorial-completado'&&lider==='fender'&&event.completado===true){
      const n=sumar(estado,'fender_olvidadizo');if(n>=10)desbloquear(estado,'fender_olvidadizo',nuevos);
    }
    if(event.tipo==='hito-campo'&&elegible(event)){
      if(lider==='talesin'&&numero(event.atkBase)===0&&numero(event.atk)>=10)desbloquear(estado,'talesin_cero_a_heroe',nuevos);
      if(lider==='rafaela'&&numero(event.apostoles)>=5)desbloquear(estado,'rafaela_charles_menson',nuevos);
      if(lider==='rafaela'&&event.apostolSigiloso===true&&numero(event.atk)>=6)desbloquear(estado,'rafaela_oculto',nuevos);
    }
    if(event.tipo==='muerte-unidad'&&elegible(event)&&lider==='rafaela'&&event.objetivo==='tal'&&event.origen==='tok_dragon')desbloquear(estado,'rafaela_rul_no_es_negro',nuevos);
    if(event.tipo==='partida-finalizada'&&elegible(event)&&ganar(event)){
      const rival=String(event.rival||''),r=ronda(event),ultimo=fuente(event);
      if(lider==='mohamed'){
        if(deseo(event)&&alma(event)===1)desbloquear(estado,'mohamed_sneaky_tricky',nuevos);
        if(dano(event)===0)desbloquear(estado,'mohamed_ctt',nuevos);
        if(r>0&&r<5)desbloquear(estado,'mohamed_ahora_me_ves',nuevos);
        if(deseo(event)&&r>0&&r<5)desbloquear(estado,'mohamed_ladron_templos',nuevos);
      }
      if(rival==='mohamed'&&ultimo==='machete')desbloquear(estado,'mohamed_backstabber',nuevos);
      if(lider==='fender'){
        const cantadas=canciones(event);if(cantadas===0)desbloquear(estado,'fender_bardnt',nuevos);
        if(sumar(estado,'fender_22_canciones',cantadas)>=22)desbloquear(estado,'fender_22_canciones',nuevos);
        if(danoCarta(event,'machete')>=20)desbloquear(estado,'fender_vida_goblin',nuevos);
        if(duracion(event)!==null&&duracion(event)<300000)desbloquear(estado,'fender_rapidin',nuevos);
      }
      if(lider==='talesin'){
        if(jugo(event,'tal'))desbloquear(estado,'talesin_thalesyn',nuevos);
        if(ultimo==='tal'&&sumar(estado,'talesin_presidente_thal')>=100)desbloquear(estado,'talesin_presidente_thal',nuevos);
        if(deseo(event))desbloquear(estado,'talesin_hola_papi',nuevos);
        if(ultimo==='tok_petunia')desbloquear(estado,'talesin_talesimp',nuevos);
      }
      if(rival==='talesin'&&ultimo==='petunia')desbloquear(estado,'talesin_amor_salvaje',nuevos);
      if(lider==='rafaela'&&OTROS.rafaela.includes(rival)&&alma(event)>20){
        if(agregarConjunto(estado,'rafaela_you_rul',rival).length===OTROS.rafaela.length)desbloquear(estado,'rafaela_you_rul',nuevos);
      }
      if(lider==='adreida'){
        if(rival==='adreida')desbloquear(estado,'adreida_adreidos',nuevos);
        if(OTROS.adreida.includes(rival)&&dano(event)===0&&agregarConjunto(estado,'adreida_dos_orejas',rival).length===OTROS.adreida.length)desbloquear(estado,'adreida_dos_orejas',nuevos);
      }
    }
    procesar(estado,event);return {estado,nuevos};
  }
  function registrar(event){
    const resultado=aplicarEvento(leer(),event),modelo=global.CAOZ_COLECCION;
    if(!modelo?.guardarLogros)return {ok:false,nuevos:[],estado:resultado.estado};
    const guardado=modelo.guardarLogros(resultado.estado,resultado.nuevos);
    return {ok:!!guardado.ok,nuevos:guardado.nuevos||[],estado:guardado.metas||resultado.estado,recompensas:guardado.recompensas||[]};
  }
  /* Sólo el laboratorio aislado llama esto. La ruta normal siempre llega por
     registrar(evento), que conserva la condición del logro. */
  function simularDesbloqueo(id){
    if(!propio(POR_ID,id))return {ok:false,nuevos:[],estado:leer()};
    const estado=leer(),nuevos=[];desbloquear(estado,id,nuevos);
    const guardado=global.CAOZ_COLECCION?.guardarLogros?.(estado,nuevos);
    return {ok:!!guardado?.ok,nuevos:guardado?.nuevos||[],estado:guardado?.metas||estado,recompensas:guardado?.recompensas||[]};
  }
  function progreso(definicion,origen=leer()){
    const def=typeof definicion==='string'?POR_ID[definicion]:definicion,estado=sanear(origen);if(!def)return {actual:0,total:0,texto:''};
    if(def.tipo==='contador')return {actual:Math.min(def.meta,numero(estado.contadores[def.id])),total:def.meta,texto:Math.min(def.meta,numero(estado.contadores[def.id]))+' / '+def.meta};
    if(def.tipo==='racha')return {actual:Math.min(def.meta,numero(estado.rachas[def.id])),total:def.meta,texto:Math.min(def.meta,numero(estado.rachas[def.id]))+' / '+def.meta};
    if(def.tipo==='conjunto'){const actual=(estado.conjuntos[def.id]||[]).length;return {actual,total:def.meta,texto:actual+' / '+def.meta};}
    return {actual:logrado(estado,def.id)?1:0,total:1,texto:logrado(estado,def.id)?'Completado':'Pendiente'};
  }
  function resumen(origen=leer()){const estado=sanear(origen);return {total:DEFINICIONES.length,obtenidos:estado.obtenidos.length,pendientes:DEFINICIONES.length-estado.obtenidos.length};}

  global.CAOZ_LOGROS=Object.freeze({version:1,protagonistas:PROTAGONISTAS,definiciones:DEFINICIONES,porId:POR_ID,porProtagonista:POR_PROTAGONISTA,vacio,sanear,leer,logrado,progreso,resumen,aplicarEvento,registrar,simularDesbloqueo});
})(globalThis);
