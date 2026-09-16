/* Estados temporales para revisar cuatro interacciones; no se crea una partida. */
'use strict';
(function(){
  const idsIniciales=Object.freeze(['discipulo','machete','destello','aldrick','esporas','bartolomeo']);
  const MENSAJE_GOLPE='Golpe Directo requiere un Personaje aliado en tu campo.';
  const $=id=>document.getElementById(id);
  let ids=[...idsIniciales],activa=null,audio={volumen:70,silencio:false};

  function notaMano(texto){$('notaMano').textContent=texto;}
  function activar(slot){
    if(activa===slot)return;
    if(activa)activa.classList.remove('is-hover');
    activa=slot;slot.classList.add('is-hover');
    notaMano('La ranura de '+CARDS[slot.dataset.carta].n+' conserva el cursor mientras la carta crece.');
  }
  function desactivar(slot){
    if(activa!==slot)return;
    slot.classList.remove('is-hover');activa=null;
    notaMano('La ranura recibe el cursor; la carta visual no cambia el objetivo del mouse.');
  }
  function inclinar(slot,e){
    const r=slot.getBoundingClientRect();
    if(!r.width||!r.height)return;
    slot.style.setProperty('--mx',Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)).toFixed(3));
    slot.style.setProperty('--my',Math.max(0,Math.min(1,(e.clientY-r.top)/r.height)).toFixed(3));
  }
  function montarMano(){
    const mano=$('hand');mano.replaceChildren();mano.style.setProperty('--n',ids.length);
    activa=null;
    ids.forEach((id,i)=>{
      const slot=document.createElement('div'),carta=cardEl(id,{});
      slot.className='handSlot';slot.tabIndex=0;slot.setAttribute('role','button');slot.dataset.indice=String(i);slot.dataset.carta=id;slot.style.setProperty('--i',String(i));slot.style.setProperty('--slot-z',String(i+1));slot.setAttribute('aria-label','Mirar '+CARDS[id].n);
      slot.dataset.vistaArte='desktop_mano';carta.setAttribute('aria-hidden','true');slot.append(carta);
      slot.addEventListener('pointerenter',e=>{if(e.pointerType==='mouse')activar(slot);});
      slot.addEventListener('pointerleave',e=>{if(e.pointerType==='mouse')desactivar(slot);});
      slot.addEventListener('pointermove',e=>{if(e.pointerType==='mouse')inclinar(slot,e);});
      slot.addEventListener('focus',()=>activar(slot));slot.addEventListener('blur',()=>desactivar(slot));
      slot.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();notaMano(CARDS[id].n+' sigue siendo una carta de prueba; su hitbox es la ranura estable.');}});
      mano.append(slot);
    });
    notaMano('La ranura recibe el cursor; la carta visual no cambia el objetivo del mouse.');
  }
  function abrirDescarte(){
    const galeria=$('discardGallery');galeria.replaceChildren();
    ids.forEach(id=>{
      const carta=cardEl(id,{});carta.dataset.vistaArte='desktop_coleccion';carta.tabIndex=0;carta.setAttribute('aria-label','Descartar '+CARDS[id].n);
      carta.onclick=()=>{
        ids=ids.filter(x=>x!==id);montarMano();$('resultadoDescarte').textContent='Descartaste '+CARDS[id].n+'. La mano temporal ahora tiene '+ids.length+' cartas.';
        $('discardDialog').close('descartada');
      };
      galeria.append(carta);
    });
    $('resultadoDescarte').textContent='La escala máxima es 1.05; el cuadro no cambia de tamaño.';
    const dialogo=$('discardDialog');if(typeof dialogo.showModal==='function')dialogo.showModal();else dialogo.setAttribute('open','');
  }
  function usarGolpe(){
    // Esta prioridad replica la regla: antes de comprobar el coste, se exige
    // un objetivo aliado. Con 2 PD y campo vacío no se debe culpar al recurso.
    const aliados=0,pd=2,resultado=$('resultadoGolpe');
    if(!aliados){resultado.textContent=MENSAJE_GOLPE;resultado.className='resultadoRegla error';return;}
    if(pd<LEADERS.adreida.habCost){resultado.textContent='Necesitas '+LEADERS.adreida.habCost+' PD.';resultado.className='resultadoRegla error';return;}
    resultado.textContent='Elige un Personaje aliado para recibir +2 ATQ.';resultado.className='resultadoRegla ok';
  }
  function pintarAudio(){
    const b=$('audioSilencio'),r=$('audioVolumen');r.value=String(audio.volumen);
    b.textContent=audio.silencio||audio.volumen===0?'♪ Silenciado':'♪ Sonido';b.setAttribute('aria-pressed',String(!audio.silencio&&audio.volumen>0));
    $('audioEstado').textContent=audio.silencio||audio.volumen===0?'Sonido silenciado':'Volumen: '+audio.volumen+' %';
  }
  async function preparar(){
    if(!window.CAOZ_DEV?.aislado)throw Error('La revisión requiere el entorno aislado.');
    await cargarArte();
    const lider=cartaDeLiderVS('adreida','interaccionesLeader',0);lider.id='liderAdreida';$('adreidaCarta').replaceChildren(lider);
    montarMano();$('abrirDescarte').onclick=abrirDescarte;$('cerrarDescarte').onclick=()=>$('discardDialog').close();$('usarGolpe').onclick=usarGolpe;
    $('restaurarMano').onclick=()=>{ids=[...idsIniciales];montarMano();$('resultadoDescarte').textContent='Mano temporal restaurada. Abre el descarte para revisar sus seis cartas.';};
    $('audioSilencio').onclick=()=>{audio.silencio=!audio.silencio;pintarAudio();};$('audioVolumen').oninput=()=>{audio.volumen=Number($('audioVolumen').value);audio.silencio=false;pintarAudio();};pintarAudio();
    window.CAOZ_INTERACCIONES=Object.freeze({estado:()=>({mano:[...ids],pd:2,aliados:0,audio:{...audio}}),abrirDescarte,usarGolpe,restaurar:()=>$('restaurarMano').click()});
  }
  if(document.readyState==='loading')addEventListener('DOMContentLoaded',()=>preparar().catch(e=>{notaMano('No se pudo preparar la revisión: '+e.message);}));else preparar().catch(e=>{notaMano('No se pudo preparar la revisión: '+e.message);});
})();
