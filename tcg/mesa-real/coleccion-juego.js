/* Acabados por jugador, separados de las reglas y del inventario del rival.
   Sólo la bienvenida comparte diseños elegidos; no viajan en los estados. */
'use strict';
(function(){
  const PREMIUM=new Set(['foil','dorado']),MAX_IDS=256,MAX_TEXTO=3200;
  const propio=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
  let sesion=null,contrario=null,rival=Object.create(null),bienvenida=null;
  const conocido=id=>typeof id==='string'&&id.length<=100&&
    ((typeof CARDS!=='undefined'&&propio(CARDS,id))||
    (id.startsWith('lider_')&&typeof LEADERS!=='undefined'&&propio(LEADERS,id.slice(6))));
  function limpiar(){sesion=null;contrario=null;rival=Object.create(null);bienvenida=null;}
  function vigente(){
    if(typeof NET==='undefined'||!NET.on||sesion!==NET.sid||
      (NET.peerSid&&contrario&&NET.peerSid!==contrario)){limpiar();return false;}
    return !!contrario;
  }
  function lado(nodo){
    const valor=nodo?.closest?.('[data-lado-arte]')?.dataset.ladoArte;
    return valor==='0'?0:valor==='1'?1:null;
  }
  function marcar(nodo,valor,origen){
    if(!nodo)return nodo;
    const s=valor===0||valor===1?valor:lado(origen);
    if(s===null)nodo.removeAttribute('data-lado-arte');
    else nodo.dataset.ladoArte=String(s);
    return nodo;
  }
  // La ficha se reutiliza: jamás conserva el override de la carta anterior.
  function ficha(nodo,valor,origen){
    if(!nodo)return nodo;
    const acabado=origen?.closest?.('[data-coleccion-acabado]')?.dataset.coleccionAcabado;
    nodo.removeAttribute('data-coleccion-acabado');
    nodo.removeAttribute('data-acabado');
    marcar(nodo,valor,origen);
    if(acabado==='normal'||PREMIUM.has(acabado))nodo.dataset.coleccionAcabado=acabado;
    return nodo;
  }
  function acabado(id,nodo){
    const s=lado(nodo);
    if(s===null)return null;
    if(s===0){const a=window.CAOZ_COLECCION?.elegido(id);return PREMIUM.has(a)?a:'normal';}
    return vigente()&&propio(rival,id)?rival[id]:'normal';
  }
  function validar(datos){
    const mapa=Object.create(null);
    if(!datos||typeof datos!=='object'||Array.isArray(datos)||datos.version!==1||
      !Array.isArray(datos.foil)||!Array.isArray(datos.dorado)||
      datos.foil.length+datos.dorado.length>MAX_IDS)return mapa;
    try{if(JSON.stringify(datos).length>MAX_TEXTO)return mapa;}catch(_){return mapa;}
    for(const a of PREMIUM)for(const id of datos[a]){
      if(!conocido(id)||propio(mapa,id))return Object.create(null);
      mapa[id]=a;
    }
    return mapa;
  }
  function compartir(){
    const datos={version:1,foil:[],dorado:[]};
    const seleccion=window.CAOZ_COLECCION?.leer()?.selecciones||{};
    for(const id of Object.keys(seleccion).sort()){
      const a=seleccion[id];if(!conocido(id)||!PREMIUM.has(a))continue;
      if(datos.foil.length+datos.dorado.length===MAX_IDS)break;
      datos[a].push(id);
      if(JSON.stringify(datos).length>MAX_TEXTO){datos[a].pop();break;}
    }
    return datos;
  }
  /* Sólo una partida abierta por el flujo del Domo puede ganar un sobre.
     La identidad vive fuera del estado online y el recibo se guarda antes de
     retirar la victoria pendiente: recargar o repetir showEnd no vuelve a premiar. */
  let partidasDomo=new WeakMap();
  const premiosEnMemoria=new Set();
  let solicitudDomo=null,reintentando=false;
  const clavePremiosDomo=()=>window.CAOZ_COLECCION?.clave+'.domo-pendientes';
  const idPremioValido=id=>typeof id==='string'&&/^domo_[a-zA-Z0-9_-]{1,90}$/.test(id);
  function contextoDePrueba(){
    const q=new URLSearchParams(location.search||'');
    return ['test','foto','pantalla','biblia','auto','rapido','estudioVista','laboratorio'].some(k=>q.has(k));
  }
  function modoSinPremio(g){
    return !g||g.tutorial||g.fast||g.silent||g.auto||g.online||g.guest||g.campana||
      (typeof NET!=='undefined'&&NET.on)||(typeof TUT!=='undefined'&&TUT.on);
  }
  function leerPremiosDomo(){
    try{
      const lista=JSON.parse(localStorage.getItem(clavePremiosDomo()));
      return Array.isArray(lista)?lista.filter(idPremioValido):[];
    }catch(_){return null;}
  }
  function guardarPremiosDomo(ids){
    try{
      if(ids.length)localStorage.setItem(clavePremiosDomo(),JSON.stringify(ids));
      else localStorage.removeItem(clavePremiosDomo());
      return true;
    }catch(_){return false;}
  }
  function recuperarPremiosDomo(){
    if(reintentando||contextoDePrueba()||!window.CAOZ_COLECCION?.concederSobreDomo)return;
    reintentando=true;
    try{
      const guardados=leerPremiosDomo();
      // No sobrescribir una cola que esta vez no pudimos leer.
      if(guardados===null)return;
      const ids=[...new Set([...guardados,...premiosEnMemoria])];
      if(!ids.length)return;
      // Si el inventario falla, queda una segunda escritura recuperable. Si
      // todo el almacenamiento está bloqueado, conservamos los IDs en memoria.
      guardarPremiosDomo(ids);
      for(const id of ids){
        if(window.CAOZ_COLECCION.concederSobreDomo(id)===true)premiosEnMemoria.delete(id);
        else premiosEnMemoria.add(id);
      }
      guardarPremiosDomo([...premiosEnMemoria]);
    }finally{reintentando=false;}
  }
  function limpiarPremiosDomo(){partidasDomo=new WeakMap();premiosEnMemoria.clear();solicitudDomo=null;}
  function nuevoIdDomo(){
    try{const a=new Uint32Array(4);crypto.getRandomValues(a);return 'domo_'+Array.from(a,n=>n.toString(36)).join('_');}
    catch(_){return 'domo_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2)+'_'+Math.random().toString(36).slice(2);}
  }
  function entregarPremioDomo(g,winner){
    const partida=g&&partidasDomo.get(g);
    if(!partida||modoSinPremio(g)||contextoDePrueba()||!g.over||g.winner!==ME||winner!==ME)return;
    if(!partida.ganada){partida.ganada=true;premiosEnMemoria.add(partida.id);}
    recuperarPremiosDomo();
  }
  function recompensaFinal(g,winner){
    if(winner!==ME||modoSinPremio(g)||contextoDePrueba())return null;
    const partida=g&&partidasDomo.get(g);
    if(!partida?.ganada)return null;
    return {origen:'domo',referencia:partida.id,cantidad:1,guardado:!premiosEnMemoria.has(partida.id)};
  }
  function premioFinal(g,winner){
    const premio=recompensaFinal(g,winner);if(!premio)return '';
    if(!premio.guardado)return '1 sobre ganado · Pendiente de guardar';
    const pendiente=window.CAOZ_COLECCION?.recompensasPendientes?.().some(p=>p.origen===premio.origen&&p.referencia===premio.referencia);
    return pendiente?'Ganaste 1 sobre · Elige su colección':'Ganaste 1 sobre · Guardado en Colección';
  }
  function instalarPremios(){
    if(typeof startMatch!=='function'||typeof setupMatch!=='function'||typeof endGame!=='function')return;
    const empezar=startMatch,preparar=setupMatch,terminar=endGame,mostrar=showEnd,panel=panelFinal;
    startMatch=async function(a,b,opts={}){
      const solicitud={a,b,numero:PARTIDA_N+1,valida:!contextoDePrueba()&&!modoSinPremio(opts)&&opts.volado!==false&&!opts.prueba&&!opts.sinCortinilla};
      solicitudDomo=solicitud;
      try{return await empezar.apply(this,arguments);}
      finally{if(solicitudDomo===solicitud)solicitudDomo=null;}
    };
    setupMatch=function(a,b,opts={}){
      const solicitud=solicitudDomo;
      const valida=solicitud?.valida&&solicitud.numero===PARTIDA_N&&solicitud.a===a&&solicitud.b===b&&!modoSinPremio(opts);
      solicitudDomo=null;
      // setupMatch crea G sincrónicamente antes de esperar el primer reparto.
      const resultado=preparar.apply(this,arguments);
      if(valida&&!modoSinPremio(G))partidasDomo.set(G,{id:nuevoIdDomo(),ganada:false});
      return resultado;
    };
    endGame=function(winner){
      const g=G,resultado=terminar.apply(this,arguments);
      if(G===g)entregarPremioDomo(g,winner);
      return resultado;
    };
    showEnd=function(winner){entregarPremioDomo(G,winner);return mostrar.apply(this,arguments);};
    panelFinal=function(winner){
      const resultado=panel.apply(this,arguments),texto=premioFinal(G,winner),contenedor=document.getElementById('ovPanel');
      if(texto&&contenedor&&!contenedor.querySelector('.coleccionPremioFinal')){
        const aviso=window.crearBotonPremioFinal?.(G,winner);
        if(aviso)contenedor.insertBefore(aviso,contenedor.querySelector('.opts'));
      }
      return resultado;
    };
    recuperarPremiosDomo();
    addEventListener('pageshow',recuperarPremiosDomo);
    addEventListener('focus',recuperarPremiosDomo);
    addEventListener('storage',e=>{if(e.key===clavePremiosDomo())recuperarPremiosDomo();});
    addEventListener('caoz:coleccion',e=>{if(e.detail?.tipo!=='reinicio')recuperarPremiosDomo();else{limpiarPremiosDomo();guardarPremiosDomo([]);}});
  }
  function instalar(){
    if(typeof netSend!=='function'||typeof netRecv!=='function')return;
    const enviar=netSend,recibir=netRecv,cerrar=netClose;
    netSend=function(m){
      vigente();
      return enviar.call(this,m&&(m.t==='join'||m.t==='welcome')?{...m,coleccion:compartir()}:m);
    };
    netRecv=function(m){
      vigente();
      if(NET.on&&m&&typeof m.sid==='string'&&/^[a-zA-Z0-9_-]{1,80}$/.test(m.sid)&&
        m.sid!==NET.sid&&(!NET.peerSid||m.sid===NET.peerSid)){
        const entrada=NET.host&&m.t==='join'&&!NET.peer;
        const saludo=NET.guest&&m.t==='welcome'&&(contrario!==m.sid||bienvenida!==(m.partida||m.sid));
        if(entrada||saludo){
          sesion=NET.sid;contrario=m.sid;rival=validar(m.coleccion);bienvenida=m.partida||m.sid;
        }
        if(m.t==='bye')limpiar();
      }
      return recibir.call(this,m);
    };
    netClose=function(){limpiar();return cerrar.apply(this,arguments);};
  }
  window.CAOZ_COLECCION_JUEGO=Object.freeze({acabado,lado,marcar,ficha,premioFinal,recompensaFinal,reintentarPremio:entregarPremioDomo,clavePremiosDomo,limpiarPremiosDomo});
  const iniciar=()=>{instalar();instalarPremios();};
  if(document.readyState==='complete')iniciar();
  else addEventListener('load',iniciar,{once:true});
})();
