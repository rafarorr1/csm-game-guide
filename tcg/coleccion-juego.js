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
  window.CAOZ_COLECCION_JUEGO=Object.freeze({acabado,lado,marcar,ficha});
  if(document.readyState==='complete')instalar();
  else addEventListener('load',instalar,{once:true});
})();
