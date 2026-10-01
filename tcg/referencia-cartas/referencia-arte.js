/* Adaptador sin estado para el Archivo externo. No usa almacenamiento,
   red, cuenta, progreso ni el modelo de recompensas del juego. */
'use strict';
(function(){
  const acabados=Object.freeze(['normal','foil','dorado']);
  const encuadres=Object.freeze(typeof CAOZ_ENCUADRES_REFERENCIA==='object'&&CAOZ_ENCUADRES_REFERENCIA?CAOZ_ENCUADRES_REFERENCIA:{});
  const ids=Object.freeze([...Object.keys(CARDS||{}),...Object.keys(LEADERS||{}).map(id=>'lider_'+id)]);
  const conocidos=new Set(ids),seleccion=new Map();
  const acabadoValido=a=>acabados.includes(a)?a:'normal';
  const entrada=id=>conocidos.has(id)?encuadres[id]||null:null;
  const url=id=>entrada(id)?.url||null;
  const encuadre=id=>{const e=entrada(id);return e?{x:e.x,y:e.y,z:e.z}:null;};
  function nombre(id,base){return String(base??id);}
  function ponerNombre(nodo,id,base){
    const texto=nombre(id,base);if(nodo){nodo.dataset.nombreId=id;nodo.dataset.nombreBase=String(base??'');nodo.textContent=texto;}return texto;
  }
  function elegido(id){return conocidos.has(id)?seleccion.get(id)||'normal':'normal';}
  function seleccionar(id,acabado){
    if(!conocidos.has(id)||!acabados.includes(acabado))return false;
    seleccion.set(id,acabado);window.dispatchEvent(new Event('caoz:coleccion'));return true;
  }
  window.CAOZ_REFERENCIA_VISUAL=true;
  window.urlArte=id=>url(id)||'';
  window.acabadoArte=id=>elegido(id);
  window.cargarArte=()=>Promise.resolve(false);
  window.CAOZ_ARTE=Object.freeze({
    nombre,ponerNombre,version:(id,acabado='normal')=>{const e=entrada(id);return e?{acabado:acabadoValido(acabado),url:e.url,encuadre:{x:e.x,y:e.y,z:e.z},disenoPropio:false}:null;},
    encuadre:(id)=>encuadre(id),acabar:(nodo,id)=>{if(nodo&&conocidos.has(id))nodo.dataset.acabado=elegido(id);},actualizar:()=>{},refrescar:()=>Promise.resolve(false),modificado:()=>false
  });
  // Contrato mínimo que consume Archivo/Visor. Todas las ediciones existen
  // para comparar el acabado gráfico, pero la elección sólo vive en esta RAM.
  window.CAOZ_COLECCION=Object.freeze({
    acabados,ids:()=>ids.slice(),tiene:(id,acabado)=>conocidos.has(id)&&acabados.includes(acabado),cantidad:(id,acabado)=>conocidos.has(id)&&acabados.includes(acabado)?1:0,
    elegido,seleccionar,betaDisponible:()=>false,canjeables:()=>0,canjear:()=>false,sobres:()=>0,grupos:()=>[],recompensasPendientes:()=>[],inventarioSobres:()=>[],pendiente:()=>null,
    abrirSobre:()=>null,cerrarSobre:()=>false,elegirSobres:()=>false,darSobreBeta:()=>false,concederSobreDomo:()=>false,concederSobreCampana:()=>false,concederSobreLogro:()=>false,
    leer:()=>Object.freeze({referencia:true}),reiniciar:()=>{},usarClaveDeCuenta:()=>null
  });
})();
