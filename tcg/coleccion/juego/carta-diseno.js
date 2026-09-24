/* Carta de la Colección con el diseño pintado (carta-pintor.js): relieve,
   texturas, gemas y tipografías del visor 3D, con la luz ya horneada. El
   proveedor de arte sigue colocando la ilustración de cada edición en la
   propia carta ([data-arte-id], con --ex/--ey/--ez y .marcoDibujo invisible);
   el pintor lee de ahí la imagen y su encuadre, y repinta cuando cambian. El
   nombre también existe como texto (.nombreCarta, transparente sobre el
   pintado) para lectores de pantalla, búsqueda y las comprobaciones de títulos. Se pinta sólo cerca de la pantalla y de
   una en una, para no trabar la rejilla. Los Protagonistas no pasan por aquí. */
'use strict';
(function(){
  const nodo=(tag,clase,texto)=>{const n=document.createElement(tag);if(clase)n.className=clase;if(texto!=null)n.textContent=texto;return n;};
  const cola=[],pendientes=new WeakSet();let trabajando=false;
  const visibles=typeof IntersectionObserver==='function'?new IntersectionObserver(es=>{for(const e of es)if(e.isIntersecting){visibles.unobserve(e.target);encolar(e.target);}},{rootMargin:'400px'}):null;

  // Lo que el proveedor de arte dejó en la carta: imagen resuelta y encuadre.
  function arteDe(carta){
    const img=carta.querySelector(':scope > .marcoDibujo img.dibujo');
    if(!img||!carta.classList.contains('conarte'))return {img:null};
    const v=n=>parseFloat(carta.style.getPropertyValue(n));
    return {img,enc:{x:isNaN(v('--ex'))?50:v('--ex'),y:isNaN(v('--ey'))?50:v('--ey'),z:isNaN(v('--ez'))?100:v('--ez')*100}};
  }
  function cargada(img){
    if(!img||img.complete)return Promise.resolve();
    return new Promise(r=>{const fin=()=>{img.removeEventListener('load',fin);img.removeEventListener('error',fin);r();};img.addEventListener('load',fin);img.addEventListener('error',fin);});
  }
  function encolar(carta){if(pendientes.has(carta))return;pendientes.add(carta);cola.push(carta);if(!trabajando)siguiente();}
  function siguiente(){
    const carta=cola.shift();if(!carta){trabajando=false;return;}trabajando=true;
    pintar(carta).catch(()=>{}).finally(()=>{pendientes.delete(carta);(window.requestIdleCallback||setTimeout)(siguiente,{timeout:60});});
  }
  async function pintar(carta){
    if(!carta.isConnected)return;
    const pintor=window.CAOZ_CARTA_PINTOR;if(!pintor)return;
    await pintor.fuentes();const arte=arteDe(carta);await cargada(arte.img);
    const ancho=Math.round(Math.min(pintor.ancho,Math.max(260,(carta.clientWidth||300)*Math.min(devicePixelRatio||1,2)*1.15)));
    const hecho=pintor.hornear({id:carta.dataset.card,acabado:carta.dataset.acabado||'normal',nombre:carta.querySelector('.cdNombre')?.textContent,arte:{...arte,img:arte.img&&arte.img.naturalWidth?arte.img:null},ancho});
    const lienzo=carta.querySelector('.cdLienzo');lienzo.width=hecho.width;lienzo.height=hecho.height;lienzo.getContext('2d').drawImage(hecho,0,0);
    carta.dataset.pintada=String(hecho.width);carta.dataset.firma=firma(carta);carta.classList.add('cdLista');
  }
  // Lo que cambia el dibujo: ilustración, encuadre, edición y nombre.
  function firma(carta){const a=arteDe(carta);return [a.img?.getAttribute('src')||'',a.enc?.x,a.enc?.y,a.enc?.z,carta.dataset.acabado,carta.querySelector('.cdNombre')?.textContent].join('|');}
  // Una sola revisión por fotograma para todas las cartas que cambiaron: sin
  // un temporizador por carta, aunque la rejilla tenga más de cien.
  const revisar=new Set();let fotograma=0;
  function pedirRevision(carta){
    revisar.add(carta);if(fotograma)return;
    fotograma=requestAnimationFrame(()=>{fotograma=0;const lista=[...revisar];revisar.clear();
      for(const c of lista){const p=Number(c.dataset.pintada)||0,chica=p&&c.clientWidth*Math.min(devicePixelRatio||1,2)>p*1.3;if(!p||chica||c.dataset.firma!==firma(c))programar(c);}});
  }
  function programar(carta){
    if(!carta.isConnected)return;
    if(visibles&&!carta.dataset.pintada)visibles.observe(carta);else encolar(carta);
  }

  function crear(id,acabado){
    const c=CARDS[id];if(!c)throw Error('Carta desconocida: '+id);
    const carta=nodo('div','cdCarta t-'+c.t+(acabado==='dorado'?' cdFullArt':' cdClasica'));carta.dataset.card=id;
    carta.dataset.arteId=id;
    const nombre=nodo('span','nombreCarta cdNombre');
    if(typeof window.marcarNombreCarta==='function')window.marcarNombreCarta(nombre,id,c.n);else nombre.textContent=c.n;
    carta.append(nodo('canvas','cdLienzo'),nombre);
    // Repintar cuando el proveedor cambia la ilustración, la edición o el nombre,
    // o cuando la carta crece mucho más de lo que se pintó (rejilla → detalle).
    const repintar=()=>pedirRevision(carta);
    const vigia=new MutationObserver(repintar);
    vigia.observe(carta,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['src','style']});
    if(typeof ResizeObserver==='function')new ResizeObserver(repintar).observe(carta);
    carta.addEventListener('load',repintar,true);
    return carta;
  }
  window.CAOZ_CARTA_DISENO=Object.freeze({crear,arteDe,cargada});
})();
