/* Las cartas de la partida con el diseño pintado de la Colección (carta-pintor.js):
   mano, mesa, revelaciones y la ficha ampliada. La carta del juego no cambia
   por dentro —.cost, .nm, .txt, .stats y sus clases siguen ahí, porque el motor,
   el render y las pruebas los leen—; se le pone encima la cara pintada sin
   cifras y se dejan a la vista sólo el coste, el ataque y la vida, que en la
   mesa cambian (rebajas, heridas, mejoras) y no se pueden hornear.
   Cada cara se pinta una vez por carta, edición, ilustración y encuadre, y se
   guarda como imagen: unitFill rehace la carta en cada refresco y volver a
   pintarla costaría decenas de milisegundos. Mientras la primera se pinta, la
   carta se ve con el diseño de siempre. El estado vive en data-piel, no en una
   clase: el render reescribe className entero. */
'use strict';
(function(){
  const MAX=90,hechas=new Map(),esperan=new Map(),cola=[],retiradas=[];let trabajando=false;
  const pintor=()=>window.CAOZ_CARTA_PINTOR;

  // Lo que el proveedor de arte dejó en la carta: imagen resuelta y encuadre.
  function arteDe(carta){
    const img=carta.querySelector(':scope > .marcoDibujo img.dibujo, :scope > .art > .marcoDibujo img');
    if(!img)return {img:null,enc:null};
    const nodo=img.closest('.marcoDibujo').parentElement,v=n=>parseFloat(nodo.style.getPropertyValue(n));
    return {img,enc:{x:isNaN(v('--ex'))?50:v('--ex'),y:isNaN(v('--ey'))?50:v('--ey'),z:isNaN(v('--ez'))?100:v('--ez')*100}};
  }
  function nombreDe(carta,id){return (carta.querySelector('.nm')?.textContent||CARDS[id].n).replace(/\s*★\s*$/,'').trim();}
  function clave(carta,id){
    const a=arteDe(carta);
    return [id,carta.dataset.acabado||carta.closest('[data-acabado]')?.dataset.acabado||'normal',a.img?.getAttribute('src')||'',a.enc?.x,a.enc?.y,a.enc?.z,nombreDe(carta,id)].join('|');
  }
  // Ancho a pintar: el de la carta en pantalla con la densidad de píxeles,
  // por escalones para compartir la misma imagen entre la mano y la mesa.
  function anchoPara(carta){
    // La ficha espera oculta a su cara: se mide por la hoja que la contiene.
    const caja=carta.classList.contains('cjFicha')?carta.parentElement:carta;
    const w=caja.getBoundingClientRect().width*Math.min(devicePixelRatio||1,2);
    return [256,384,512,768].find(p=>p>=w*1.05)||768;
  }

  function vestir(carta,id){
    if(!pintor()||!CARDS[id])return carta;
    let img=carta.querySelector(':scope > .cjCara');
    if(!img){img=document.createElement('img');img.className='cjCara';img.alt='';img.draggable=false;carta.appendChild(img);}
    marcarCifras(carta,id);
    const k=clave(carta,id),h=hechas.get(k);
    carta.dataset.pielClave=k;
    if(h)poner(carta,h);else if(!carta.dataset.piel)carta.dataset.piel='';
    // Ya en pantalla se sabe el tamaño: se repinta si la guardada se queda corta.
    revisarPronto(carta,id);
    return carta;
  }
  function poner(carta,h){
    const img=carta.querySelector(':scope > .cjCara');if(!img)return;
    if(img.getAttribute('src')!==h.url)img.src=h.url;
    const listo=()=>{if(carta.dataset.pielClave&&hechas.get(carta.dataset.pielClave)===h)carta.dataset.piel='lista';};
    if(img.complete&&img.naturalWidth)listo();else img.addEventListener('load',listo,{once:true});
    hechas.delete(carta.dataset.pielClave);hechas.set(carta.dataset.pielClave,h);
  }
  // Las cifras que difieren de las impresas se tiñen: verde si mejoran, rojo si
  // empeoran. El coste rebajado ya lo marca el juego con .rebajado.
  function marcarCifras(carta,id){
    const c=CARDS[id];
    for(const [sel,base]of [['.atk',c.a],['.hp',c.h]]){
      const n=carta.querySelector('.stats '+sel);if(!n)continue;
      const v=parseInt(n.textContent,10);n.classList.toggle('cjSube',v>base);n.classList.toggle('cjBaja',v<base);
    }
  }

  const revisar=new Map();let fotograma=0;
  function revisarPronto(carta,id){
    revisar.set(carta,id);if(fotograma)return;
    fotograma=requestAnimationFrame(()=>{fotograma=0;const lista=[...revisar];revisar.clear();
      for(const [c,id]of lista){
        if(!c.isConnected)continue;
        const k=clave(c,id);c.dataset.pielClave=k;
        const h=hechas.get(k),w=anchoPara(c);
        if(h&&h.ancho>=w){poner(c,h);continue;}
        const a=arteDe(c);
        if(a.img&&!a.img.complete){a.img.addEventListener('load',()=>revisarPronto(c,id),{once:true});a.img.addEventListener('error',()=>revisarPronto(c,id),{once:true});continue;}
        if(h)poner(c,h);
        encolar(k,c,id,w);
      }});
  }
  function encolar(k,carta,id,ancho){
    let e=esperan.get(k);
    if(e){e.cartas.add(carta);e.ancho=Math.max(e.ancho,ancho);return;}
    esperan.set(k,{cartas:new Set([carta]),id,ancho,muestra:carta});cola.push(k);
    if(!trabajando)siguiente();
  }
  function siguiente(){
    const k=cola.shift();if(!k){trabajando=false;return;}trabajando=true;
    pintar(k).catch(()=>{}).finally(()=>(window.requestIdleCallback||requestAnimationFrame)(siguiente,{timeout:80}));
  }
  async function pintar(k){
    const e=esperan.get(k);esperan.delete(k);
    const vivas=[...e.cartas].filter(c=>c.isConnected&&c.dataset.pielClave===k);if(!vivas.length)return;
    await pintor().fuentes();
    const muestra=vivas[0],a=arteDe(muestra),[, acabado]=k.split('|');
    const lienzo=pintor().hornear({id:e.id,acabado,nombre:nombreDe(muestra,e.id),arte:{img:a.img&&a.img.naturalWidth?a.img:null,enc:a.enc},ancho:e.ancho,cifras:false});
    const blob=await new Promise(r=>lienzo.toBlob(r,'image/webp',.92));if(!blob)return;
    const vieja=hechas.get(k),h={url:URL.createObjectURL(blob),ancho:lienzo.width};
    hechas.set(k,h);
    // Las imágenes sustituidas y las más antiguas se sueltan con retraso: una
    // carta en pantalla puede seguir mostrándolas hasta su próximo refresco.
    if(vieja)retiradas.push(vieja.url);
    while(hechas.size>MAX){const [kv,v]=hechas.entries().next().value;hechas.delete(kv);retiradas.push(v.url);}
    while(retiradas.length>24)URL.revokeObjectURL(retiradas.shift());
    for(const c of e.cartas)if(c.isConnected&&c.dataset.pielClave===k)poner(c,h);
  }

  /* La ficha ampliada (.big): la carta pintada arriba, entera y legible; debajo
     siguen las chapas, los objetos equipados y la base/ahora que ya pone el juego. */
  function vestirFicha(box,id){
    box.querySelector(':scope > .cjFicha')?.remove();
    if(!pintor()||!CARDS[id]){delete box.dataset.pielFicha;return box;}
    const c=CARDS[id],carta=document.createElement('div');
    carta.className='cjFicha t-'+c.t;
    carta.dataset.acabado=box.dataset.acabado||'normal';
    const cifras=[['cost','.top .cost'],['atk','.stats .atk'],['hp','.stats .hp']];
    const nm=document.createElement('div');nm.className='nm';nm.textContent=nombreDe(box,id);carta.appendChild(nm);
    const art=box.querySelector('.art');
    if(art?.querySelector('.marcoDibujo img')){
      const marco=art.querySelector('.marcoDibujo').cloneNode(true);carta.appendChild(marco);
      for(const p of ['--ex','--ey','--ez'])carta.style.setProperty(p,art.style.getPropertyValue(p));
      marco.querySelector('img').classList.add('dibujo');
    }
    const stats=document.createElement('div');stats.className='stats';
    for(const [cl,sel]of cifras){const o=box.querySelector(sel);if(!o)continue;const n=document.createElement('span');n.className=cl;n.textContent=o.textContent;(cl==='cost'?carta:stats).appendChild(n);}
    if(stats.children.length)carta.appendChild(stats);
    box.prepend(carta);box.dataset.pielFicha='';
    // Lo impreso de la carta; la regla es el primer .txt, el resto son objetos.
    const impreso=[':scope > .top',':scope > .art',':scope > .tribe',':scope > .txt',':scope > .stats'].map(s=>box.querySelector(s)).filter(Boolean);
    const sep=box.querySelector(':scope > .stats')?.previousElementSibling;if(sep?.classList.contains('bigsep'))impreso.push(sep);
    for(const n of impreso)n.classList.add('cjImpreso');
    vestir(carta,id);
    // Con la cara lista se ocultan las piezas que ya lleva pintadas.
    new MutationObserver((_,o)=>{if(carta.dataset.piel==='lista'){box.dataset.pielFicha='lista';o.disconnect();}}).observe(carta,{attributes:true,attributeFilter:['data-piel']});
    return box;
  }

  /* El dorso de la baraja (la mano del rival): el mismo que gira en el visor 3D,
     con el logo. Se pinta una sola vez, en un rato libre, y lo recoge el CSS. */
  let dorsoHecho=false;
  function pintarDorso(){
    if(dorsoHecho||!pintor())return;dorsoHecho=true;
    const logo=new Image();logo.decoding='async';
    const fin=()=>{
      try{
        const {color}=pintor().dorso(logo.naturalWidth?logo:null),c=document.createElement('canvas');
        c.width=320;c.height=Math.round(320*color.height/color.width);c.getContext('2d').drawImage(color,0,0,c.width,c.height);
        c.toBlob(b=>{if(b)document.documentElement.style.setProperty('--cj-dorso','url("'+URL.createObjectURL(b)+'")');},'image/webp',.9);
      }catch(_){}
    };
    logo.addEventListener('load',fin,{once:true});logo.addEventListener('error',fin,{once:true});logo.src='art/logo.webp';
  }
  if(document.readyState==='complete')(window.requestIdleCallback||requestAnimationFrame)(pintarDorso);
  else addEventListener('load',()=>(window.requestIdleCallback||requestAnimationFrame)(pintarDorso),{once:true});

  window.CAOZ_CARTA_JUEGO=Object.freeze({vestir,vestirFicha});
})();
