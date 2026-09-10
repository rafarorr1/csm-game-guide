/* Ilustraciones públicas del estudio. La mesa cambia sólo imágenes y encuadres:
   nunca se vuelve a renderizar una partida ni se interrumpen sus animaciones. */
'use strict';
(function(){
  const BASE=new URL('.',location.href),CLAVE='caoz_arte_publico_v1:'+BASE.pathname;
  const HASH=/^[a-f0-9]{64}$/,MIME=new Set(['image/webp','image/png','image/jpeg']);
  const EXCLUIR='.cartaJugador,.liderJugador,.fichaJugador,.cartaPitagoras,.identidadPitagoras';
  let muestra=null;
  let originales={},cartas=[],carga=null,peticion=null,firma='',hayFallos=false;
  const conocido=id=>typeof id==='string'&&(Object.hasOwn(CARDS,id)||(id.startsWith('lider_')&&Object.hasOwn(LEADERS,id.slice(6))));
  const encValido=e=>e&&Number.isFinite(e.x)&&Number.isFinite(e.y)&&Number.isFinite(e.z)&&e.x>=0&&e.x<=100&&e.y>=0&&e.y<=100&&e.z>=50&&e.z<=300;
  function limpiarOriginales(datos){
    const limpios={};if(!datos||typeof datos!=='object'||Array.isArray(datos))return limpios;
    for(const [id,e]of Object.entries(datos))if(conocido(id)&&((typeof e==='number'&&Number.isFinite(e)&&e>=0&&e<=100)||encValido(e)))limpios[id]=e;
    return limpios;
  }
  const ACABADOS=['normal','foil','dorado'];
  function limpiarRegistro(e,id,acabado='normal'){
    if(!e||!Number.isInteger(e.revision)||e.revision<0||(e.id!=null&&e.id!==id))return null;
    if(e.hash!==null&&(!HASH.test(e.hash)||!MIME.has(e.mime)))return null;
    if(!encValido(e)&&!(e.hash===null&&e.x===null&&e.y===null&&e.z===null))return null;
    return {id,revision:e.revision,hash:e.hash,mime:e.mime||null,x:e.x,y:e.y,z:e.z,
      vistas:CAOZ_VISTAS.limpiar(e.vistas),acabado,activo:e.activo!==false,heredada:acabado!=='normal'&&(e.heredada===true||e.hash===null)};
  }
  function elegirVariantes(id,variantes){
    const normal=variantes.normal;
    const acabado=['dorado','foil'].find(a=>variantes[a]?.activo&&encValido(variantes[a]))||'normal';
    const elegida=variantes[acabado]||{id,revision:0,hash:null,mime:null,x:null,y:null,z:null,activo:true};
    // El acabado no cambia reglas ni rareza. Una edición de encuadre premium
    // puede utilizar la ilustración normal y conservar su recorte propio.
    const hash=elegida.heredada?normal?.hash||null:elegida.hash;
    const mime=elegida.heredada?normal?.mime||null:elegida.mime;
    return {...elegida,id,acabado,hash,mime,variantes};
  }
  function limpiarCatalogo(datos){
    if(!datos||!Array.isArray(datos.cartas)||datos.cartas.length>1000)return null;
    const limpios=[],vistos=new Set();
    for(const e of datos.cartas){
      if(!e||typeof e.id!=='string')return null;
      // Una fila de una carta retirada no impide actualizar las demás.
      if(!conocido(e.id))continue;
      if(vistos.has(e.id))return null;vistos.add(e.id);
      if(e.variantes&&typeof e.variantes==='object'&&!Array.isArray(e.variantes)){
        const variantes={};for(const a of ACABADOS)variantes[a]=limpiarRegistro(e.variantes[a],e.id,a);
        limpios.push(elegirVariantes(e.id,variantes));
      }else{
        // Cachés y catálogos anteriores a las variantes siguen siendo normales.
        const normal=limpiarRegistro(e,e.id);if(!normal)return null;
        limpios.push(elegirVariantes(e.id,{normal,foil:null,dorado:null}));
      }
    }
    return limpios.sort((a,b)=>a.id.localeCompare(b.id));
  }
  function guardar(){try{localStorage.setItem(CLAVE,JSON.stringify({originales,cartas}));}catch(e){}}
  function recomponer(){
    ARTE={...originales};for(const e of cartas)if(encValido(e))ARTE[e.id]={x:e.x,y:e.y,z:e.z};
  }
  function remoto(id){return cartas.find(e=>e.id===id);}
  window.urlArte=function(id){if(muestra?.id===id)return muestra.url||'art/'+id+'.webp';const e=remoto(id);return e?.hash?'api/arte/imagen/'+e.hash:'art/'+id+'.webp';};
  window.acabadoArte=id=>muestra?.id===id?muestra.acabado:remoto(id)?.acabado||'normal';
  function acabar(nodo,id){
    if(!nodo)return;
    const propio=nodo.closest(EXCLUIR);
    if(propio){propio.removeAttribute('data-acabado');propio.querySelectorAll('[data-acabado]').forEach(n=>n.removeAttribute('data-acabado'));return;}
    let carta=nodo;
    if(nodo.classList.contains('lface'))carta=nodo.closest('.vscard,.lcard,.ltile,.campanaCarta')||nodo;
    else if(nodo.classList.contains('art'))carta=nodo.closest('.big')||nodo;
    if(carta!==nodo)nodo.removeAttribute('data-acabado');
    const acabado=window.acabadoArte(id);if(carta.dataset.acabado!==acabado)carta.dataset.acabado=acabado;
  }
  function encuadreVista(id,vista){if(muestra?.id===id)return muestra.url?muestra.encuadre:null;return remoto(id)?.vistas?.[vista]||encuadreDe(ARTE[id]);}
  function variables(nodo,enc){
    for(const [prop,v]of Object.entries({'--ex':enc.x+'%','--ey':enc.y+'%','--ez':(enc.z/100).toFixed(3)}))nodo.style.setProperty(prop,v);
  }
  function quitar(nodo){
    nodo.querySelectorAll(':scope > .marcoDibujo').forEach(n=>n.remove());
    nodo.classList.remove('conarte');if(nodo.classList.contains('card'))nodo.classList.add('sinarte');
    for(const p of ['--ex','--ey','--ez'])nodo.style.removeProperty(p);
    if(nodo.classList.contains('lrostro'))nodo.textContent=LEADERS[nodo.dataset.arteId.slice(6)]?.art||'';
  }
  function pintar(nodo){
    const id=nodo.dataset.arteId;acabar(nodo,id);
    if(nodo.closest(EXCLUIR))return;
    const enc=encuadreVista(id,CAOZ_VISTAS.identificar(nodo));
    if(!enc){quitar(nodo);return;}
    const url=window.urlArte(id);variables(nodo,enc);
    if(nodo.classList.contains('lrostro')){
      let img=nodo.querySelector('img');if(!img){nodo.textContent='';img=document.createElement('img');img.alt='';nodo.appendChild(img);}
      if(img.getAttribute('src')!==url)img.src=url;
    }else{
      nodo.classList.add('conarte');nodo.classList.remove('sinarte');
      if(typeof ponerDibujo==='function')ponerDibujo(nodo,url,enc);
    }
  }
  function actualizar(){
    document.querySelectorAll('[data-arte-id]').forEach(pintar);
    window.dispatchEvent(new Event('caoz:arte'));
  }
  async function pedir(url,ms){
    const c=new AbortController(),t=setTimeout(()=>c.abort(),ms);
    try{const r=await fetch(url,{cache:'no-store',credentials:'omit',signal:c.signal});if(!r.ok)return null;return await r.json();}
    catch(e){return null;}finally{clearTimeout(t);}
  }
  function refrescar(){
    if(new URLSearchParams(location.search).has('estudioVista'))return Promise.resolve(false);
    if(location.protocol==='file:')return Promise.resolve(false);
    if(peticion)return peticion;
    peticion=(async()=>{
      const nuevos=limpiarCatalogo(await pedir(new URL('api/arte/catalogo',BASE).href,4500));
      if(!nuevos)return false;
      const nuevaFirma=JSON.stringify(nuevos);
      if(nuevaFirma===firma){if(hayFallos){hayFallos=false;actualizar();}return false;}
      cartas=nuevos;firma=nuevaFirma;recomponer();guardar();actualizar();return true;
    })().finally(()=>{peticion=null;});return peticion;
  }
  // Se usa primero lo conocido: ni un servicio caído ni una sesión privada
  // forman parte del arranque del juego. Sólo se conserva información pública.
  try{const previo=JSON.parse(localStorage.getItem(CLAVE)||'null');if(previo){originales=limpiarOriginales(previo.originales);cartas=limpiarCatalogo(previo)||[];}}catch(e){}
  firma=JSON.stringify(cartas);recomponer();
  cargarArte=function(){
    if(carga)return carga;
    carga=(async()=>{
      if(location.protocol!=='file:'){
        const datos=await pedir(new URL('art/encuadres.json',BASE).href,2500);
        if(datos&&typeof datos==='object'&&!Array.isArray(datos))originales=limpiarOriginales(datos);
      }
      recomponer();guardar();actualizar();void refrescar();
    })();return carga;
  };
  // Un reemplazo aún no descargado también puede abrirse sin conexión: se
  // muestra la ilustración original mientras llega la nueva, o su emoji.
  document.addEventListener('error',e=>{
    const img=e.target;if(!(img instanceof HTMLImageElement))return;
    if(img.closest('.campanaRetrato[data-mazo]'))hayFallos=true;
    const nodo=img.closest('[data-arte-id]');if(!nodo||nodo.closest(EXCLUIR))return;
    hayFallos=true;
    const id=nodo.dataset.arteId,base='art/'+id+'.webp',enc=encuadreDe(originales[id]);
    if(enc&&img.getAttribute('src')!==base){img.src=base;variables(nodo,enc);img.parentElement?.style.setProperty('--url','url("'+base+'")');}
    else quitar(nodo);
  },true);
  window.CAOZ_ARTE=Object.freeze({refrescar,actualizar,acabar,encuadre:encuadreVista,previsualizar:datos=>{if(parent===window||!new URLSearchParams(location.search).has('estudioVista'))return;muestra=datos;if(datos.url)ARTE[datos.id]=datos.encuadre;else delete ARTE[datos.id];},modificado:id=>{const e=remoto(id);return !!e&&(!!e.hash||encValido(e));}});
  // Una carta puede construirse fuera del DOM; al entrar ya conocemos su superficie.
  // Sólo se observan nodos añadidos: modificar el encuadre no dispara un bucle.
  const pendientes=new Set();let programado=false;
  new MutationObserver(cambios=>{
    for(const c of cambios)for(const n of c.addedNodes)if(n.nodeType===1){if(n.matches('[data-arte-id]'))pendientes.add(n);n.querySelectorAll('[data-arte-id]').forEach(x=>pendientes.add(x));}
    if(pendientes.size&&!programado){programado=true;queueMicrotask(()=>{programado=false;for(const n of pendientes)if(n.isConnected)pintar(n);pendientes.clear();});}
  }).observe(document.documentElement,{childList:true,subtree:true});
  addEventListener('online',()=>void refrescar());
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)void refrescar();});
  setInterval(()=>{if(!document.hidden)void refrescar();},60000);
})();
