/* Mesa de prueba de Thal: entrada con onda de ácido, ataque que no mata y
   ataque letal, con el efecto real (fx-aliento.js). No hay partida. */
'use strict';
(function(){
  const $=id=>document.getElementById(id);
  const ENCUADRES={tal:{x:45,y:41,z:118},rey:{x:50,y:30,z:100},bartolomeo:{x:50,y:30,z:100},eric:{x:50,y:30,z:100}};
  const RIVALES=['rey','bartolomeo','eric'];
  const caras=new Map();let ocupado=false;
  function imagen(url){return new Promise(r=>{const i=new Image();i.onload=()=>r(i);i.onerror=()=>r(null);i.src=url;});}
  async function cara(id){
    if(caras.has(id))return caras.get(id);
    const img=await imagen('./art/'+id+'.webp');
    const c=CAOZ_CARTA_PINTOR.hornear({id,acabado:'normal',arte:{img,enc:ENCUADRES[id]},ancho:520});
    caras.set(id,c);return c;
  }
  function poner(hueco,lienzo){const c=document.createElement('canvas');c.width=lienzo.width;c.height=lienzo.height;c.getContext('2d').drawImage(lienzo,0,0);hueco.replaceChildren(c);
    hueco.style.visibility='';hueco.style.opacity='';hueco.style.transform='';hueco.style.filter='';delete hueco.dataset.fxCeniza;}
  async function montar(){
    poner($('atacante'),await cara('tal'));for(const id of RIVALES)poner($('rival-'+id),await cara(id));
    $('fuegoEstado').textContent='Listo. Elige una animación.';
  }
  const velocidad=()=>$('lento').checked?.35:1;
  async function correr(texto,fin,accion){
    if(ocupado)return;ocupado=true;for(const b of ['entrar','golpear','matar','reiniciar'])$(b).disabled=true;
    if(document.querySelector('[data-fx-ceniza]'))await montar();
    $('fuegoEstado').textContent=texto;await accion();$('fuegoEstado').textContent=fin;
    ocupado=false;for(const b of ['entrar','golpear','matar','reiniciar'])$(b).disabled=false;
  }
  const entrar=()=>correr('Thal entra: Aliento de Ácido, 3 de daño a todos los rivales…','Las tres cartas recibieron 3 de daño.',()=>
    CAOZ_FX_ALIENTO.entrada($('mesaFuego'),{carta:$('atacante'),afectados:RIVALES.map(id=>({nodo:$('rival-'+id),dano:3})),velocidad:velocidad()}));
  const golpear=()=>correr('Thal ataca a El Rey…','El Rey encaja el golpe y sigue en pie.',()=>
    CAOZ_FX_ALIENTO.ataque($('mesaFuego'),{atacante:$('atacante'),objetivo:$('rival-rey'),letal:false,dano:CARDS.tal.a,velocidad:velocidad()}));
  const matar=()=>correr('Thal ataca a Bartolomeo…','Bartolomeo se volvió ceniza. «Reiniciar» lo devuelve a la mesa.',()=>
    CAOZ_FX_ALIENTO.ataque($('mesaFuego'),{atacante:$('atacante'),objetivo:$('rival-bartolomeo'),imagenObjetivo:caras.get('bartolomeo'),letal:true,velocidad:velocidad()}));
  async function preparar(){
    await CAOZ_CARTA_PINTOR.fuentes();await montar();
    $('entrar').onclick=entrar;$('golpear').onclick=golpear;$('matar').onclick=matar;$('reiniciar').onclick=()=>{if(!ocupado)montar();};
    window.CAOZ_FUEGO_REVISION=Object.freeze({entrar,golpear,matar,montar});
  }
  preparar().catch(e=>{$('fuegoEstado').textContent='No se pudo preparar la prueba: '+e.message;});
})();
