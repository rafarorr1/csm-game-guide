/* Reloj virtual del teaser, sólo con ?captura=1: se carga antes que los
   módulos y sustituye requestAnimationFrame, performance.now, setTimeout y las
   Web Animations por un tiempo que avanza a mano. Así cada módulo del juego
   (que corre con su propio reloj) dibuja exactamente el fotograma pedido,
   aunque pintarlo tarde segundos. Mientras la página se prepara el reloj va
   libre (sigue al tiempo real); manual() lo detiene y avanzar(ms) lo mueve.
   Sin ?captura=1 no toca nada. */
'use strict';
(function(){
  if(new URLSearchParams(location.search).get('captura')!=='1')return;
  const rafReal=window.requestAnimationFrame.bind(window),stReal=window.setTimeout.bind(window),ctReal=window.clearTimeout.bind(window),ahoraReal=performance.now.bind(performance);
  const animar=Element.prototype.animate;
  let ahora=ahoraReal(),libre=true,sig=1;
  const cuadros=new Map(),tiempos=[],animaciones=[];
  performance.now=()=>ahora;
  window.requestAnimationFrame=cb=>{const id=sig++;cuadros.set(id,cb);return id;};
  window.cancelAnimationFrame=id=>{cuadros.delete(id);};
  window.setTimeout=(cb,ms=0,...args)=>{if(typeof cb!=='function')return stReal(cb,ms);const id=sig++;tiempos.push({id,t:ahora+Math.max(0,+ms||0),cb,args});return id;};
  window.clearTimeout=id=>{const i=tiempos.findIndex(x=>x.id===id);if(i>=0)tiempos.splice(i,1);else ctReal(id);};
  // Las animaciones del DOM se pausan y se colocan en su instante en cada paso.
  Element.prototype.animate=function(...a){const an=animar.apply(this,a);try{an.pause();an.currentTime=0;}catch(_){}animaciones.push({an,t0:ahora});return an;};
  const microtareas=()=>new Promise(r=>stReal(r,0));
  function vencidos(){
    for(let n=0;n<1000;n++){
      let i=-1;for(let k=0;k<tiempos.length;k++)if(tiempos[k].t<=ahora&&(i<0||tiempos[k].t<tiempos[i].t))i=k;
      if(i<0)return;const [x]=tiempos.splice(i,1);try{x.cb(...x.args);}catch(e){console.error(e);}
    }
  }
  function cuadro(){
    const lista=[...cuadros.values()];cuadros.clear();
    for(const cb of lista){try{cb(ahora);}catch(e){console.error(e);}}
    for(let i=animaciones.length-1;i>=0;i--){const {an,t0}=animaciones[i];
      try{const d=an.effect?.getComputedTiming?.().endTime??0;an.currentTime=Math.min(ahora-t0,d);if(ahora-t0>=d&&an.playState!=='idle'){an.finish();animaciones.splice(i,1);}}catch(_){animaciones.splice(i,1);}}
  }
  // Libre: sigue al tiempo real mientras se prepara la página.
  function bomba(){if(!libre)return;ahora=ahoraReal();vencidos();cuadro();rafReal(bomba);}
  rafReal(bomba);
  async function avanzar(ms){
    ahora+=ms;vencidos();await microtareas();cuadro();await microtareas();vencidos();await microtareas();
  }
  window.CAOZ_RELOJ_VIRTUAL=Object.freeze({manual(){libre=false;},avanzar,ahora:()=>ahora,get libre(){return libre;}});
})();
