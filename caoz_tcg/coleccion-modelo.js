/* Colección local de diseños: las reglas y los mazos no cambian.
 * Las cartas normales son gratuitas; Foil y Dorado se desbloquean por separado.
 * El sobre de prueba contiene tres diseños premium. Mientras quedan novedades,
 * se elige Foil (80 %) o Dorado (20 %) entre los acabados aún no obtenidos; si
 * una categoría está completa se usa la otra. Sólo se repiten diseños cuando
 * quedan menos de tres novedades. Con la colección completa no se gasta sobre.
 * Un único setItem guarda inventario, contador y sobre pendiente: una recarga
 * puede repetir la presentación, pero nunca vuelve a conceder el contenido.
 * No hay monedas, compras, recompensas automáticas ni sincronización de cuenta.
 */
(function(){
  'use strict';
  const acabados=Object.freeze(['normal','foil','dorado']);
  const premium=['foil','dorado'];
  const prohibidos=new Set(['__proto__','prototype','constructor']);
  const propio=(obj,k)=>Object.prototype.hasOwnProperty.call(obj,k);
  const objeto=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
  const entero=(v,max)=>Number.isSafeInteger(v)&&v>=0&&v<=max;
  const idSeguro=id=>typeof id==='string'&&id.length<=100&&/^[a-zA-Z0-9_-]+$/.test(id)&&!prohibidos.has(id);
  const copia=v=>JSON.parse(JSON.stringify(v));
  const maxSobres=100000;

  function ids(){
    const cartas=typeof CARDS!=='undefined'&&objeto(CARDS)?Object.keys(CARDS):[];
    const protagonistas=typeof LEADERS!=='undefined'&&objeto(LEADERS)?Object.keys(LEADERS).filter(idSeguro).map(id=>'lider_'+id):[];
    return [...new Set(cartas.concat(protagonistas).filter(idSeguro))];
  }
  function betaDisponible(){
    const host=String(location.hostname||'').toLowerCase();
    return host==='localhost'||host==='127.0.0.1'||host==='beta.caoz-tcg.pages.dev'||
      (host.endsWith('.github.io')&&/(^|\/)tcg-beta(?:\/|$)/.test(location.pathname||'/'));
  }
  function claveActual(){
    const partes=String(location.pathname||'/').split('/').filter(Boolean);
    const indice=partes.findIndex(p=>p==='tcg-beta'||p==='tcg');
    if(indice>=0)partes.length=indice+1;
    else if(partes.length&&(/\.[a-z0-9]+$/i.test(partes[partes.length-1])||['estudio','sonidos'].includes(partes[partes.length-1])))partes.pop();
    const prueba=new URLSearchParams(location.search||'').has('test')?'.prueba':'';
    return 'caoz.coleccion.v1.'+(betaDisponible()?'beta':'produccion')+'.'+encodeURIComponent(partes.join('/')||'raiz')+prueba;
  }
  const clave=claveActual();
  function vacio(){return {version:1,revision:0,desbloqueos:{},selecciones:{},sobres:0,pendiente:null};}

  function sanear(original){
    const estado=vacio();
    if(!objeto(original)||original.version!==1)return estado;
    const conocidos=new Set(ids());
    estado.revision=entero(original.revision,Number.MAX_SAFE_INTEGER-1)?original.revision:0;
    estado.sobres=entero(original.sobres,maxSobres)?original.sobres:0;
    if(objeto(original.desbloqueos)){
      Object.keys(original.desbloqueos).forEach(id=>{
        if(!conocidos.has(id)||!Array.isArray(original.desbloqueos[id]))return;
        const lista=premium.filter(a=>original.desbloqueos[id].includes(a));
        if(lista.length)estado.desbloqueos[id]=lista;
      });
    }
    if(objeto(original.selecciones)){
      Object.keys(original.selecciones).forEach(id=>{
        const acabado=original.selecciones[id];
        if(conocidos.has(id)&&premium.includes(acabado)&&posee(estado,id,acabado))estado.selecciones[id]=acabado;
      });
    }
    const p=original.pendiente;
    if(objeto(p)&&typeof p.id==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(p.id)&&
      entero(p.creado,Number.MAX_SAFE_INTEGER)&&Array.isArray(p.cartas)&&p.cartas.length===3&&
      p.cartas.every(c=>objeto(c)&&conocidos.has(c.id)&&premium.includes(c.acabado)&&
        typeof c.nueva==='boolean'&&posee(estado,c.id,c.acabado))){
      estado.pendiente={id:p.id,creado:p.creado,cartas:p.cartas.map(c=>({id:c.id,acabado:c.acabado,nueva:c.nueva}))};
    }
    return estado;
  }
  function cargar(){
    let texto;
    try{texto=localStorage.getItem(clave);}catch(_){return null;}
    try{return sanear(JSON.parse(texto||'null'));}catch(_){return vacio();}
  }
  function leer(){return cargar()||vacio();}
  function posee(estado,id,acabado){
    return acabado==='normal'||(propio(estado.desbloqueos,id)&&estado.desbloqueos[id].includes(acabado));
  }
  function valido(id,acabado){return idSeguro(id)&&acabados.includes(acabado)&&ids().includes(id);}
  function tiene(id,acabado){return valido(id,acabado)&&posee(leer(),id,acabado);}
  function elegido(id){
    const estado=leer();
    return idSeguro(id)&&propio(estado.selecciones,id)?estado.selecciones[id]:'normal';
  }
  function avisar(tipo,estado,extra){
    try{window.dispatchEvent(new CustomEvent('caoz:coleccion',{detail:Object.assign({tipo,revision:estado.revision},extra||{})}));}catch(_){}
  }
  function guardar(estado,tipo,extra){
    estado.revision=Math.min(estado.revision+1,Number.MAX_SAFE_INTEGER-1);
    try{localStorage.setItem(clave,JSON.stringify(estado));}
    catch(_){return false;}
    avisar(tipo,estado,extra);
    return true;
  }
  function seleccionar(id,acabado){
    if(!valido(id,acabado))return false;
    const estado=cargar();
    if(!estado)return false;
    if(!posee(estado,id,acabado))return false;
    const actual=propio(estado.selecciones,id)?estado.selecciones[id]:'normal';
    if(actual===acabado)return true;
    if(acabado==='normal')delete estado.selecciones[id];
    else estado.selecciones[id]=acabado;
    return guardar(estado,'seleccion',{id,acabado});
  }
  function desbloquear(id,acabado){
    if(!valido(id,acabado))return false;
    const estado=cargar();
    if(!estado)return false;
    if(posee(estado,id,acabado))return true;
    if(!propio(estado.desbloqueos,id))estado.desbloqueos[id]=[];
    estado.desbloqueos[id].push(acabado);
    return guardar(estado,'desbloqueo',{id,acabado});
  }
  function reiniciar(){
    const anterior=cargar();
    if(!anterior)return false;
    const estado=vacio();estado.revision=anterior.revision;
    return guardar(estado,'reinicio');
  }
  function darSobreBeta(){
    if(!betaDisponible())return false;
    const estado=cargar();
    if(!estado)return false;
    if(estado.sobres>=maxSobres)return false;
    estado.sobres++;
    return guardar(estado,'sobre-beta');
  }
  function sobres(){return leer().sobres;}
  function pendiente(){const p=leer().pendiente;return p?copia(p):null;}
  function azar(){
    try{
      const n=new Uint32Array(1);crypto.getRandomValues(n);
      return n[0]/4294967296;
    }catch(_){return Math.max(0,Math.min(.9999999999999999,Math.random()));}
  }
  function abrirSobre(){
    const estado=cargar();
    if(!estado)return null;
    if(estado.pendiente)return copia(estado.pendiente);
    if(!estado.sobres)return null;
    const catalogo=ids();
    const faltantes={foil:catalogo.filter(id=>!posee(estado,id,'foil')),dorado:catalogo.filter(id=>!posee(estado,id,'dorado'))};
    if(!faltantes.foil.length&&!faltantes.dorado.length)return null;
    const cartas=[];
    for(let i=0;i<3;i++){
      let acabado=azar()<.8?'foil':'dorado';
      const hayNuevas=faltantes.foil.length+faltantes.dorado.length>0;
      if(hayNuevas&&!faltantes[acabado].length)acabado=acabado==='foil'?'dorado':'foil';
      const candidatos=hayNuevas?faltantes[acabado]:catalogo;
      const id=candidatos[Math.floor(azar()*candidatos.length)];
      const nueva=!posee(estado,id,acabado);
      if(nueva){
        if(!propio(estado.desbloqueos,id))estado.desbloqueos[id]=[];
        estado.desbloqueos[id].push(acabado);
        faltantes[acabado].splice(faltantes[acabado].indexOf(id),1);
      }
      cartas.push({id,acabado,nueva});
    }
    const creado=Date.now();
    const sobre={id:'sobre_'+creado.toString(36)+'_'+(estado.revision+1).toString(36)+'_'+Math.floor(azar()*4294967296).toString(36),creado,cartas};
    estado.sobres--;
    estado.pendiente=sobre;
    if(!guardar(estado,'abrir-sobre',{sobre:copia(sobre)}))return null;
    return copia(sobre);
  }
  function cerrarSobre(){
    const estado=cargar();
    if(!estado)return false;
    if(!estado.pendiente)return true;
    estado.pendiente=null;
    return guardar(estado,'cerrar-sobre');
  }
  window.CAOZ_COLECCION=Object.freeze({acabados,clave,ids,tiene,elegido,seleccionar,desbloquear,leer,reiniciar,betaDisponible,darSobreBeta,sobres,abrirSobre,pendiente,cerrarSobre});
  window.addEventListener('storage',event=>{
    if(event.key===clave||event.key===null)avisar('externo',leer());
  });
})();
