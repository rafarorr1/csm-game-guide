/* Laboratorio efímero que usa el selector compartido, sin motor ni progreso. */
'use strict';
(function(){
  const INICIAL=Object.freeze(['discipulo','machete','destello','aldrick','esporas']);
  const MAZO=Object.freeze(['bartolomeo','augusto','horton']);
  const $=id=>document.getElementById(id);
  let mano=[],mazo=[];

  window.openOv=()=>$('ov').classList.add('on');
  window.cerrarOv=()=>$('ov').classList.remove('on');

  function carta(id){
    const c=CARDS[id]||{n:id,t:'carta',c:0,a:0,h:0};
    const nodo=document.createElement('article');nodo.className='card mulliganFicha';
    nodo.dataset.tipo=c.t;nodo.innerHTML='<small>'+String(c.t||'carta').toUpperCase()+'</small><h3>'+c.n+'</h3><p>Coste <b>'+Number(c.c||0)+'</b></p><footer><span>⚔ '+Number(c.a||0)+'</span><span>♥ '+Number(c.h||0)+'</span></footer>';
    return nodo;
  }
  function pintar(){
    const cont=$('mulliganMano');cont.replaceChildren();
    mano.forEach((id,i)=>{const n=carta(id);n.setAttribute('aria-label','Carta '+(i+1)+': '+CARDS[id].n);cont.append(n);});
  }
  function barajar(a){return a.map((v,i)=>({v,i,r:(i*37+11)%a.length})).sort((a,b)=>a.r-b.r||a.i-b.i).map(x=>x.v);}
  function restaurar(){mano=[...INICIAL];mazo=[...MAZO];pintar();$('mulliganResultado').textContent='Muestra restaurada: cinco cartas y dos cambios disponibles.';}
  async function elegir(){
    const elegirUI=window.CAOZ_MULLIGAN_UI?.mostrar;
    if(typeof elegirUI!=='function')return;
    const indices=await elegirUI({cartas:mano.slice(),limite:Math.min(2,mano.length,mazo.length),side:0,renderCarta:id=>carta(id),overlay:$('ov'),panel:$('ovPanel'),abrir:window.openOv,cerrar:window.cerrarOv});
    if(!indices.length){$('mulliganResultado').textContent='Conservaste la mano inicial. La oportunidad quedó usada sólo en esta demostración.';return;}
    const original=mano.slice(),elegidos=new Set(indices),devueltas=indices.map(i=>original[i]);
    const robadas=mazo.splice(0,indices.length);
    mano=original.filter((_,i)=>!elegidos.has(i)).concat(robadas);
    mazo=barajar(mazo.concat(devueltas));
    pintar();
    $('mulliganResultado').textContent='Cambiaste '+indices.length+' '+(indices.length===1?'carta':'cartas')+'. Primero llegaron '+robadas.map(id=>CARDS[id].n).join(' y ')+', y después se devolvieron las elegidas al mazo.';
  }
  function preparar(){
    restaurar();$('mulliganAbrir').onclick=elegir;$('mulliganRestaurar').onclick=restaurar;
    window.CAOZ_MULLIGAN_LAB=Object.freeze({abrir:elegir,restaurar,estado:()=>({mano:mano.slice(),mazo:mazo.slice()})});
  }
  if(document.readyState==='loading')addEventListener('DOMContentLoaded',preparar);else preparar();
})();
