/* Mesa de prueba de las animaciones de poderes (fx-poderes.js). No hay
   partida: cada botón hace la misma llamada que hará el juego. */
'use strict';
(function(){
  const $=id=>document.getElementById(id),FX=()=>window.CAOZ_FX_PODERES;
  const CARTAS=['rey','bartolomeo','eric','horton','discipulo','tok_petunia','llavemago','pergamino'],EXTRA=['tok_dragon'];
  const carta=id=>$('c-'+id),mesa=()=>$('mesaPoderes');
  const caras=new Map();let ocupado=false,dragon=false,congelado=false,llaves=1,turnoPergamino=0;
  function imagen(url){return new Promise(r=>{const i=new Image();i.onload=()=>r(i);i.onerror=()=>r(null);i.src=url;});}
  async function cara(id){
    if(caras.has(id))return caras.get(id);
    const img=await imagen('./art/'+id+'.webp');
    const c=CAOZ_CARTA_PINTOR.hornear({id,acabado:'normal',arte:{img,enc:{x:50,y:30,z:100}},ancho:420});
    caras.set(id,c);return c;
  }
  function poner(hueco,lienzo){
    const c=document.createElement('canvas');c.width=lienzo.width;c.height=lienzo.height;c.getContext('2d').drawImage(lienzo,0,0);hueco.replaceChildren(c);
    for(const p of ['visibility','opacity','transform','filter','translate','rotate'])hueco.style[p]='';
    for(const k of Object.keys(hueco.dataset))delete hueco.dataset[k];
  }
  function cambiarCara(hueco,lienzo,nombre){const c=hueco.querySelector(':scope > canvas'),g=c.getContext('2d');g.clearRect(0,0,c.width,c.height);g.drawImage(lienzo,0,0,c.width,c.height);hueco.setAttribute('aria-label',nombre);}
  async function montar(){
    for(const id of CARTAS){poner(carta(id),await cara(id));carta(id).setAttribute('aria-label',CARDS[id].n);}
    for(const id of EXTRA)await cara(id);
    dragon=false;congelado=false;llaves=1;turnoPergamino=0;$('llavesCuenta').textContent='1';
    [...$('gracia').children].forEach((p,i)=>{if(i<4)p.dataset.llena='';else delete p.dataset.llena;});
    etiquetas();$('poderesEstado').textContent='Listo. Elige una animación.';
  }
  function etiquetas(){
    boton('polimorfia').textContent=dragon?'3 · Termina la Polimorfia':'3 · Polimorfia de Rulchete';
    boton('escarcha').textContent=congelado?'4 · Descongelar':'4 · Rayo de Escarcha';
  }
  const boton=a=>document.querySelector('[data-accion="'+a+'"]');
  const velocidad=()=>$('lento').checked?.35:1;
  // CAOZ_RELOJ_REVISION (sólo al revisar fotograma a fotograma) sustituye al reloj real.
  const op=o=>({velocidad:velocidad(),...(typeof window.CAOZ_RELOJ_REVISION==='function'?{reloj:window.CAOZ_RELOJ_REVISION,velocidad:.05}:{}),...o});
  async function correr(texto,fin,accion){
    if(ocupado)return;ocupado=true;for(const b of document.querySelectorAll('#controles button'))b.disabled=true;
    $('poderesEstado').textContent=texto;
    try{await accion();$('poderesEstado').textContent=typeof fin==='function'?fin():fin;}
    catch(e){$('poderesEstado').textContent='Error: '+e.message;}
    etiquetas();ocupado=false;for(const b of document.querySelectorAll('#controles button'))b.disabled=false;
  }
  const ACCIONES={
    // Sir Horton muere y las Esporas del Demonio infectan a todo el campo rival.
    esporas:()=>correr('Sir Horton muere: Esporas del Demonio…','Todo el campo rival queda Infectado.',async()=>{
      const h=carta('horton');h.animate?.([{filter:'none',opacity:1},{filter:'grayscale(1) brightness(.6)',opacity:.35}],{duration:600/velocidad(),fill:'forwards'});
      await FX().esporas(mesa(),op({origen:h,objetivos:['rey','bartolomeo','eric'].map(carta)}));}),
    polimorfia:()=>{const a=dragon;return correr(a?'Termina la Polimorfia…':'Rulchete transforma al Discípulo de Rul…',()=>dragon?'El Discípulo es un Dragón Celestial Morado 7/7.':'El Dragón vuelve a ser el Discípulo de Rul.',async()=>{
      const n=carta('discipulo'),[de,a2,nombre]=a?['tok_dragon','discipulo','Discípulo de Rul']:['discipulo','tok_dragon','Dragón Celestial Morado'];
      await FX().polimorfar(mesa(),op({objetivo:n,imagen:n.querySelector('canvas'),imagenNueva:caras.get(a2),sacudir:mesa(),alCambiar:()=>{cambiarCara(n,caras.get(a2),nombre);dragon=!a;}}));});},
    escarcha:()=>congelado
      ?correr('Eric se descongela…','Eric ya no está congelado.',async()=>{await FX().descongelar(mesa(),op({objetivo:carta('eric')}));congelado=false;})
      :correr('Rayo de Escarcha sobre Eric…','Eric queda congelado: pierde Prisa y −1 ATQ.',async()=>{await FX().congelar(mesa(),op({objetivo:carta('eric'),origen:carta('discipulo'),impacto:[.55,.38]}));congelado=true;}),
    collar:()=>correr('Fuego contra Bartolomeo, que lleva el Collar de Agua…','El Collar de Agua apaga el fuego: Bartolomeo no recibe daño.',()=>
      FX().apagar(mesa(),op({objetivo:carta('bartolomeo'),origen:carta('horton')}))),
    gema:()=>correr('Gema del Conserje: El Rey escucha voces…','El Rey queda Poseído.',()=>FX().poseer(mesa(),op({objetivo:carta('rey')}))),
    poseer:()=>correr('Thal posee a Bartolomeo…','Bartolomeo flota hasta tu campo, Poseído.',()=>FX().poseer(mesa(),op({objetivo:carta('bartolomeo'),destino:$('hueco')}))),
    talesyn:()=>correr('Talesyn gana su quinta Ficha de Gracia…','Talesyn asciende: la mesa se baña de luz celestial.',()=>{
      const pip=[...$('gracia').children].find(p=>p.dataset.llena===undefined);
      return FX().gracia(mesa(),op({pip,celestiales:[carta('tok_petunia'),dragon&&carta('discipulo')].filter(Boolean),alLlenar:()=>{if(pip)pip.dataset.llena='';}}));}),
    aturdir:()=>correr('Eric queda Aturdido…','Eric está Aturdido.',()=>FX().aturdir(mesa(),op({objetivo:carta('eric')}))),
    tasha:()=>correr('El Rey ataca… ¡Risa Incontrolable de Tasha!','El ataque se cancela: El Rey queda Aturdido.',()=>FX().risa(mesa(),op({objetivo:carta('rey')}))),
    llave:()=>correr('La Llave del Mago da una Llave del Domo…',()=>'Tienes '+llaves+' Llave'+(llaves>1?'s':'')+' del Domo.',()=>
      FX().llave(mesa(),op({desde:carta('llavemago'),hasta:$('llaves'),alLlegar:()=>{llaves=llaves>=3?1:llaves+1;$('llavesCuenta').textContent=String(llaves);}}))),
    pergamino:()=>{turnoPergamino=turnoPergamino>=2?1:turnoPergamino+1;const t=turnoPergamino;
      return correr('Turno '+t+' del Pergamino de Deseo…',t>=2?'¡Deseo concedido! Victoria del Pergamino.':'El Pergamino cuenta su primer turno.',()=>FX().pergamino(mesa(),op({objetivo:carta('pergamino'),turno:t,total:2})));},
    reiniciar:()=>{if(!ocupado)montar();},
  };
  async function preparar(){
    await CAOZ_CARTA_PINTOR.fuentes();await montar();
    for(const b of document.querySelectorAll('#controles button'))b.onclick=()=>ACCIONES[b.dataset.accion]();
    window.CAOZ_PODERES_REVISION=Object.freeze({...ACCIONES,montar});
  }
  preparar().catch(e=>{$('poderesEstado').textContent='No se pudo preparar la prueba: '+e.message;});
})();
