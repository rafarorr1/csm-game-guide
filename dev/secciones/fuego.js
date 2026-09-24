/* Mesa de prueba del aliento de fuego: dos cartas pintadas y el efecto real
   (fx-aliento.js). No hay partida: atacar sólo reproduce la animación. */
'use strict';
(function(){
  const $=id=>document.getElementById(id);
  const ENCUADRES={tal:{x:45,y:41,z:118},bartolomeo:{x:50,y:30,z:100},eric:{x:50,y:30,z:100}};
  const caras=new Map();let ocupado=false;
  function imagen(url){return new Promise(r=>{const i=new Image();i.onload=()=>r(i);i.onerror=()=>r(null);i.src=url;});}
  async function cara(id){
    if(caras.has(id))return caras.get(id);
    const img=await imagen('./art/'+id+'.webp');
    const c=CAOZ_CARTA_PINTOR.hornear({id,acabado:'normal',arte:{img,enc:ENCUADRES[id]},ancho:560});
    caras.set(id,c);return c;
  }
  function poner(hueco,lienzo){const c=document.createElement('canvas');c.width=lienzo.width;c.height=lienzo.height;c.getContext('2d').drawImage(lienzo,0,0);hueco.replaceChildren(c);hueco.style.visibility='';hueco.style.opacity='';hueco.style.transform='';hueco.style.filter='';delete hueco.dataset.fxCeniza;}
  async function montar(){
    poner($('atacante'),await cara('tal'));poner($('objetivo'),await cara($('rival').value));
    $('fuegoEstado').textContent='Listo. Pulsa «Atacar con Thal».';
  }
  async function atacar(){
    if(ocupado)return;ocupado=true;$('atacar').disabled=true;$('reiniciar').disabled=true;
    if($('objetivo').dataset.fxCeniza!==undefined)await montar();
    $('fuegoEstado').textContent='Thal usa Aliento de Ácido…';
    await CAOZ_FX_ALIENTO.reproducir($('mesaFuego'),{atacante:$('atacante'),objetivo:$('objetivo'),imagenObjetivo:caras.get($('rival').value),color:'verde',velocidad:$('lento').checked?.35:1});
    $('fuegoEstado').textContent=CARDS[$('rival').value].n+' se volvió ceniza. «Reiniciar» la devuelve a la mesa.';
    ocupado=false;$('atacar').disabled=false;$('reiniciar').disabled=false;
  }
  async function preparar(){
    await CAOZ_CARTA_PINTOR.fuentes();await montar();
    $('atacar').onclick=atacar;$('reiniciar').onclick=()=>{if(!ocupado)montar();};$('rival').onchange=()=>{if(!ocupado)montar();};
    window.CAOZ_FUEGO_REVISION=Object.freeze({atacar,montar});
  }
  preparar().catch(e=>{$('fuegoEstado').textContent='No se pudo preparar la prueba: '+e.message;});
})();
