/* Adaptador sin estado para el Archivo externo. No usa almacenamiento,
   red, cuenta, progreso ni el modelo de recompensas del juego. Conserva las
   tres ilustraciones publicadas de cada edición: Normal, Foil y Dorada. */
'use strict';
(function(){
  const acabados=Object.freeze(['normal','foil','dorado']);
  const encuadres=Object.freeze(typeof CAOZ_ENCUADRES_REFERENCIA==='object'&&CAOZ_ENCUADRES_REFERENCIA?CAOZ_ENCUADRES_REFERENCIA:{});
  const ids=Object.freeze([...Object.keys(CARDS||{}),...Object.keys(LEADERS||{}).map(id=>'lider_'+id)]);
  const conocidos=new Set(ids),seleccion=new Map();
  const acabadoValido=a=>acabados.includes(a)?a:'normal';
  const acabadoDe=(id,nodo)=>{
    const forzado=nodo?.closest?.('[data-coleccion-acabado]')?.dataset.coleccionAcabado;
    return acabadoValido(acabados.includes(forzado)?forzado:elegido(id));
  };
  const entrada=(id,acabado='normal')=>{
    if(!conocidos.has(id))return null;
    const todas=encuadres[id]||null;
    // Admite el formato antiguo de una sola cara durante una actualización
    // parcial del CDN, pero todas las nuevas salidas llevan las tres.
    if(todas?.url)return todas;
    return todas?.[acabadoValido(acabado)]||todas?.normal||null;
  };
  const url=(id,acabado)=>entrada(id,acabado)?.url||null;
  const encuadre=(id,acabado,vista)=>{
    const e=entrada(id,acabado);if(!e)return null;
    const base={x:e.x,y:e.y,z:e.z};
    return vista&&window.CAOZ_VISTAS?.resolver?window.CAOZ_VISTAS.resolver(e.vistas,vista,base):base;
  };
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
  window.urlArte=(id,nodo)=>url(id,acabadoDe(id,nodo))||'';
  window.acabadoArte=(id,nodo)=>acabadoDe(id,nodo);
  window.cargarArte=()=>Promise.resolve(false);
  window.CAOZ_ARTE=Object.freeze({
    nombre,ponerNombre,version:(id,acabado='normal',vista)=>{const a=acabadoValido(acabado),e=entrada(id,a);return e?{acabado:a,url:e.url,encuadre:encuadre(id,a,vista),disenoPropio:a!=='normal'}:null;},
    encuadre:(id,vista,nodo)=>encuadre(id,acabadoDe(id,nodo),vista),acabar:(nodo,id)=>{if(nodo&&conocidos.has(id))nodo.dataset.acabado=acabadoDe(id,nodo);},actualizar:()=>{},refrescar:()=>Promise.resolve(false),modificado:(id,nodo)=>!!entrada(id,acabadoDe(id,nodo))
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
