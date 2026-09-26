/* Mesa de prueba de la invocación (fx-invocar.js): tu mano con cinco cartas
   en sus tres ediciones (una legendaria), casillas vacías en cada campo, el
   rival que invoca desde arriba y una ficha que aparece del aire. */
'use strict';
(function(){
  const $=id=>document.getElementById(id);
  const MANO=[['eric','normal'],['horton','foil'],['rey','dorado'],['bartolomeo','normal'],['machete','foil']],RIVAL=[['aidman','normal'],['tasha','foil'],['escarcha','normal']],FICHA=['tok_petunia','dorado'];
  const caras=new Map();let enVuelo=0;
  const velocidad=()=>$('lento').checked?.3:1;
  const op=()=>typeof window.CAOZ_RELOJ_REVISION==='function'?{reloj:window.CAOZ_RELOJ_REVISION,velocidad:.05}:{velocidad:velocidad()};
  function imagen(url){return new Promise(r=>{const i=new Image();i.onload=()=>r(i);i.onerror=()=>r(null);i.src=url;});}
  async function cara(id,acabado){
    const k=id+'/'+acabado;if(caras.has(k))return caras.get(k);
    const v=window.INVOCAR_ARTE[k],img=await imagen('./'+v.url);
    const c=CAOZ_CARTA_PINTOR.hornear({id,acabado,arte:{img,enc:v.enc},ancho:360});caras.set(k,c);return c;
  }
  const copia=l=>{const c=document.createElement('canvas');c.width=l.width;c.height=l.height;c.getContext('2d').drawImage(l,0,0);return c;};
  function casillas(n){return Array.from({length:n},()=>{const d=document.createElement('div');d.className='invCasilla';return d;});}
  async function montar(){
    $('campoRival').replaceChildren(...casillas(5));$('campoPropio').replaceChildren(...casillas(5));
    $('manoRival').replaceChildren(...Array.from({length:4},()=>{const d=document.createElement('div');d.className='dorso';return d;}));
    const botones=[];
    for(const [id,acabado]of MANO){const b=document.createElement('button');b.type='button';b.className='invCarta';b.dataset.id=id;b.dataset.acabado=acabado;
      b.setAttribute('aria-label','Invocar '+CARDS[id].n+(CARDS[id].r===2?' (legendaria)':'')+' · '+acabado);b.append(copia(await cara(id,acabado)));b.onclick=()=>jugar(b);botones.push(b);}
    $('mano').replaceChildren(...botones);$('estado').textContent='Listo. Toca una carta de tu mano.';
  }
  const libreEn=campo=>[...$(campo).children].find(c=>!c.dataset.id);
  // Como en la partida: la carta ya está en su casilla cuando empieza la animación.
  async function invocarEn(campo,id,acabado,extra){
    const hueco=libreEn(campo);if(!hueco){$('estado').textContent='Ese campo está lleno. «Reiniciar» lo vacía.';return;}
    enVuelo++;hueco.dataset.id=id;const c=copia(await cara(id,acabado));hueco.append(c);
    $('estado').textContent='Invocando '+CARDS[id].n+'…';
    const hecho=await CAOZ_FX_INVOCAR.invocar($('fx'),{carta:hueco,imagen:c,acabado,legendaria:CARDS[id].r===2,sacudir:$('mesa'),...op(),...extra});
    enVuelo--;$('estado').textContent=hecho?CARDS[id].n+' está en la mesa.':CARDS[id].n+' está en la mesa (sin animación).';
    return hecho;
  }
  function jugar(b){if(b.disabled)return;b.disabled=true;b.style.visibility='hidden';invocarEn('campoPropio',b.dataset.id,b.dataset.acabado,{desde:b,lado:'abajo'});}
  let turnoRival=0;
  $('rival').onclick=()=>{const [id,acabado]=RIVAL[turnoRival++%RIVAL.length];$('manoRival').lastChild?.remove();invocarEn('campoRival',id,acabado,{lado:'arriba'});};
  $('ficha').onclick=()=>invocarEn('campoPropio',FICHA[0],FICHA[1],{aire:true});
  $('reiniciar').onclick=()=>{if(!enVuelo)montar();};
  CAOZ_CARTA_PINTOR.fuentes().then(montar).catch(e=>{$('estado').textContent='No se pudo preparar la prueba: '+e.message;});
  window.CAOZ_INVOCAR_REVISION=Object.freeze({montar,enVuelo:()=>enVuelo});
})();
