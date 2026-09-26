/* La prueba de la cortinilla: pantalla de carga (mientras se pintan las
   cartas), la cortinilla (cortinilla.js) y una réplica del menú principal.
   Tocar o pulsar una tecla durante la cortinilla la salta. */
'use strict';
(function(){
  const $=id=>document.getElementById(id),esc=$('escenario');
  let cortinilla=null,corriendo=false;
  const velocidad=()=>$('lento').checked?.3:1;
  const reloj=()=>typeof window.CAOZ_RELOJ_REVISION==='function'?{reloj:window.CAOZ_RELOJ_REVISION,velocidad:.05}:{};
  const quieto=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
  function reiniciar(){
    cortinilla?.destruir();cortinilla=null;
    $('menu').hidden=true;delete $('menu').dataset.entra;
    for(const k of ['baraja','fuera'])delete $('carga').dataset[k];$('cargaRelleno').style.width='0';$('cargaTexto').textContent='Preparando el Domo…';
  }
  // El logo de la carga mide lo mismo que el dorso de la baraja en el que se convierte.
  function medirLogo(){const filas=innerWidth>=innerHeight?3:4,A=innerHeight/(filas-.3),ancho=A*CAOZ_CORTINILLA.BARAJA*5/7;$('carga').style.setProperty('--logo',Math.round(ancho*860/CAOZ_CARTA_PINTOR.ancho)+'px');}
  function mostrarMenu(){$('menu').hidden=false;}
  async function arrancar(){
    if(corriendo)return;corriendo=true;$('repetir').disabled=true;reiniciar();medirLogo();
    const cartas=window.CORTINILLA_CARTAS.map(c=>({...c,url:c.url?'./'+c.url:null}));
    cortinilla=quieto()?null:CAOZ_CORTINILLA.crear(esc,{cartas,logoUrl:'./art/logo.webp',velocidad:velocidad(),...reloj()});
    let lista=false;
    if(cortinilla)lista=await cortinilla.preparar(k=>{$('cargaRelleno').style.width=Math.round(k*100)+'%';$('cargaTexto').textContent='Preparando el Domo… '+Math.round(k*100)+'%';});
    else for(let k=1;k<=5;k++){await new Promise(r=>setTimeout(r,120));$('cargaRelleno').style.width=k*20+'%';}
    await new Promise(r=>setTimeout(r,250));
    if(lista){
      $('estadoPrueba').textContent='Cortinilla en curso. Toca para saltar.';esc.dataset.reproduciendo='';$('saltarAviso').hidden=false;
      $('carga').dataset.baraja='';
      await cortinilla.reproducir({alCubrir:()=>{$('carga').dataset.fuera='';mostrarMenu();},alAbrir:()=>{$('menu').dataset.entra='';}});
      $('estadoPrueba').textContent='Menú principal. «Repetir» vuelve a la carga.';
    }else{
      // Sin WebGL o con movimiento reducido: la carga se funde en el menú.
      mostrarMenu();$('carga').dataset.fuera='';$('estadoPrueba').textContent=quieto()?'Movimiento reducido: fundido de la carga al menú.':'Sin WebGL: fundido de la carga al menú.';
    }
    delete esc.dataset.reproduciendo;$('saltarAviso').hidden=true;corriendo=false;$('repetir').disabled=false;
  }
  const saltar=()=>{if(esc.dataset.reproduciendo!==undefined)cortinilla?.saltar();};
  esc.addEventListener('pointerdown',saltar);addEventListener('keydown',e=>{if(e.target.closest?.('.panelPrueba'))return;saltar();});
  $('repetir').onclick=()=>arrancar();
  window.CAOZ_CORTINILLA_REVISION=Object.freeze({arrancar,saltar,estado:()=>({corriendo,menu:!$('menu').hidden,carga:$('carga').dataset.fuera===undefined})});
  arrancar();
})();
