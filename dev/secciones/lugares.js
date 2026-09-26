/* Mesa de prueba de los escenarios de los Lugares (campo-lugar.js). No hay
   partida: cada botón hace la llamada que hará el juego. */
'use strict';
(function(){
  const $=id=>document.getElementById(id),CARTAS=['rey','bartolomeo','eric','horton','discipulo','tok_petunia'];
  let campo=null,ocupado=false,actual='',estado={};
  const REGLAS={
    tomsage:[['pd','Inicio de turno: pierdes 1 PD máximo']],
    antro:[['robar','Fase Final: pagas 2 PD y robas']],
    puente:[['pasa','Ataque al Alma: sale 14'],['nopasa','Ataque al Alma: sale 5']],
    montanas:[['nadie','Tirada del turno: sale 12'],['aidman','Tirada del turno: sale 2']],
    domo:[['muerte','Muere Eric']],
  };
  function imagen(url){return new Promise(r=>{const i=new Image();i.onload=()=>r(i);i.onerror=()=>r(null);i.src=url;});}
  const caras=new Map();
  async function cara(id){if(caras.has(id))return caras.get(id);const img=await imagen('./art/'+id+'.webp');const c=CAOZ_CARTA_PINTOR.hornear({id,acabado:'normal',arte:{img,enc:{x:50,y:30,z:100}},ancho:360});caras.set(id,c);return c;}
  function poner(n,l){const c=document.createElement('canvas');c.width=l.width;c.height=l.height;c.getContext('2d').drawImage(l,0,0);n.replaceChildren(c);n.style.cssText='';}
  async function montar(){
    for(const id of CARTAS){poner($('c-'+id),await cara(id));$('c-'+id).setAttribute('aria-label',CARDS[id].n);}
    await cara('aidman');$('c-aidman').replaceChildren();$('c-aidman').setAttribute('aria-label','Hueco libre');
    estado={almaRival:20,almaPropia:20,pdRival:5,pdPropio:6,mano:4,mazo:22};pintarMarcadores();
  }
  function pintarMarcadores(){
    $('almaRival').querySelector('b').textContent=estado.almaRival;$('almaPropia').querySelector('b').textContent=estado.almaPropia;
    for(const [id,n]of [['pdRival',estado.pdRival],['pdPropio',estado.pdPropio]]){const c=$(id);c.replaceChildren(...Array.from({length:7},(_,i)=>{const e=document.createElement('i');if(i>=n)e.dataset.apagado='';return e;}));}
    $('mano').querySelector('b').textContent=estado.mano;$('mazo').querySelector('b').textContent=estado.mazo;
  }
  const velocidad=()=>$('lento').checked?.35:1;
  const op=o=>({velocidad:velocidad(),...(typeof window.CAOZ_RELOJ_REVISION==='function'?{reloj:window.CAOZ_RELOJ_REVISION,velocidad:.05}:{}),...o});
  const lado=()=>$('delRival').checked?'arriba':'abajo';
  async function correr(texto,accion){
    if(ocupado)return;ocupado=true;const bs=[...document.querySelectorAll('.lugaresControles button')];bs.forEach(b=>b.disabled=true);
    $('lugaresEstado').textContent=texto;let fin='';
    try{fin=await accion();}catch(e){fin='Error: '+e.message;}
    $('lugaresEstado').textContent=fin||'Listo.';ocupado=false;pintarBotones();
  }
  function pintarBotones(){
    for(const b of document.querySelectorAll('[data-lugar]')){b.disabled=ocupado;b.setAttribute('aria-pressed',String(b.dataset.lugar===actual));}
    $('reglas').replaceChildren(...(REGLAS[actual]||[]).map(([k,t])=>{const b=document.createElement('button');b.type='button';b.className='lugaresBoton oro';b.dataset.regla=k;b.textContent=t;b.disabled=ocupado;b.onclick=()=>ACCIONES[k]();return b;}),
      Object.assign(document.createElement('button'),{type:'button',className:'lugaresBoton',textContent:'Reiniciar mesa',disabled:ocupado,onclick:()=>correr('Reiniciando…',async()=>{await montar();return 'Mesa reiniciada.';})}));
    $('reglas').lastChild.dataset.regla='reiniciar';
  }
  const elegir=id=>correr(id?'Se juega '+CAOZ_CAMPO_LUGAR.LUGARES[id].nombre+'…':'Se retira el Lugar…',async()=>{
    actual=id;if(id)await campo.poner(id,op({lado:lado()}));else await campo.quitar(op());
    return id?CAOZ_CAMPO_LUGAR.LUGARES[id].nombre+' en juego ('+(lado()==='arriba'?'del rival':'tuyo')+').':'Sin Lugar.';});
  const ACCIONES={
    pd:()=>correr('Empieza tu turno en Tomsage…',async()=>{const c=[...$('pdPropio').children].reverse().find(i=>i.dataset.apagado===undefined);
      await campo.perderPD(c,op({alApagar:()=>{estado.pdPropio=Math.max(0,estado.pdPropio-1);pintarMarcadores();}}));return 'Pierdes 1 PD máximo: te quedan '+estado.pdPropio+'.';}),
    robar:()=>correr('Fase Final en el Antro…',async()=>{estado.pdPropio=Math.max(0,estado.pdPropio-2);pintarMarcadores();
      await campo.brindis($('mazo'),$('mano'),op({alRobar:()=>{estado.mano++;estado.mazo--;pintarMarcadores();}}));return 'Pagas 2 PD y robas: tienes '+estado.mano+' cartas.';}),
    pasa:()=>correr('Sir Horton ataca a tu rival…',async()=>{const ok=await campo.ataqueAlma($('c-horton'),14,op());if(ok){estado.almaRival-=4;pintarMarcadores();}return ok?'Sale 14: los guardianes se apartan y el ataque pasa.':'';}),
    nopasa:()=>correr('Sir Horton ataca a tu rival…',async()=>{const ok=await campo.ataqueAlma($('c-horton'),5,op());return ok?'':'Sale 5: los guardianes cruzan los martillos. El ataque no pasa.';}),
    nadie:()=>correr('Tirada de las Montañas…',async()=>{await campo.tiradaAidman(12,op({destino:$('c-aidman')}));return 'Sale 12: no aparece nadie.';}),
    aidman:()=>correr('Tirada de las Montañas…',async()=>{await campo.tiradaAidman(2,op({destino:$('c-aidman'),alAparecer:()=>{poner($('c-aidman'),caras.get('aidman'));$('c-aidman').setAttribute('aria-label','Aidman');}}));return 'Sale 2: ¡Aidman aparece en el campo rival!';}),
    muerte:()=>correr('Eric muere en el Domo…',async()=>{const e=$('c-eric');e.animate?.([{opacity:1},{opacity:.25,filter:'grayscale(1)'}],{duration:500,fill:'forwards'});
      await campo.muerte(e,$('almaRival'),$('pdPropio'),op({alAlma:()=>{estado.almaRival--;pintarMarcadores();},alPD:()=>{estado.pdPropio=Math.min(7,estado.pdPropio+1);pintarMarcadores();}}));
      return 'El rival pierde 1 Alma y tú ganas 1 PD.';}),
  };
  async function preparar(){
    await CAOZ_CARTA_PINTOR.fuentes();await montar();
    campo=CAOZ_CAMPO_LUGAR.crear($('mesaLugar'),{arte:id=>'./art/'+id+'.webp',linea:$('linea')});
    for(const b of document.querySelectorAll('[data-lugar]'))b.onclick=()=>elegir(b.dataset.lugar);
    $('delRival').onchange=()=>{if(actual&&!ocupado)campo.poner(actual,{lado:lado()});};
    pintarBotones();$('lugaresEstado').textContent='Listo. Elige un Lugar.';
    window.CAOZ_LUGARES_REVISION=Object.freeze({elegir,...ACCIONES,campo:()=>campo});
  }
  preparar().catch(e=>{$('lugaresEstado').textContent='No se pudo preparar la prueba: '+e.message;});
})();
