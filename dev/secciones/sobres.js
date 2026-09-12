(function(){
  'use strict';
  const ids=['tal','rey','eric','armadura','zancada'];let componente=null;
  function altura(){document.documentElement.style.setProperty('--sobres-alto',(window.visualViewport?.height||innerHeight)+'px');}
  function carta(item){
    const n=cardEl(item.id,{}).cloneNode(true);n.dataset.coleccionAcabado='foil';n.dataset.acabado='foil';n.dataset.vistaArte='movil_coleccion';n.removeAttribute('tabindex');
    const soporte=n.matches('[data-arte-id]')?n:n.querySelector('[data-arte-id]');
    if(soporte){const v=window.CAOZ_ARTE?.version?.(item.id,'foil','movil_coleccion'),enc=v?.encuadre||encuadreDe(ARTE[item.id]),url=v?.url||('art/'+item.id+'.webp');if(enc){soporte.classList.add('conarte');soporte.classList.remove('sinarte');ponerDibujo(soporte,url,enc);}}
    return n;
  }
  function montar(variante){
    componente?.destruir();document.body.dataset.propuesta=variante;
    document.querySelectorAll('[data-propuesta]').forEach(b=>{if(b.tagName==='BUTTON')b.setAttribute('aria-pressed',String(b.dataset.propuesta===variante));});
    const url=new URL(location.href);url.searchParams.set('propuesta',variante);history.replaceState(null,'',url);
    componente=window.CAOZ_SOBRES.crear(document.getElementById('sobresMontaje'),{variante,logoUrl:'./art/logo.webp',cartas:ids.map(id=>({id,nombre:CARDS[id].n,acabado:'foil'})),crearCarta:carta,onRepetir:()=>montar(variante)});
  }
  async function preparar(){
    altura();addEventListener('resize',altura);window.visualViewport?.addEventListener('resize',altura);
    if(!window.CAOZ_DEV?.aislado)throw Error('La vista de sobres requiere el entorno aislado.');
    await cargarArte();
    document.querySelectorAll('button[data-propuesta]').forEach(b=>b.onclick=()=>montar(b.dataset.propuesta));
    document.getElementById('sobresReiniciar').onclick=()=>montar(document.body.dataset.propuesta);
    montar(new URLSearchParams(location.search).get('propuesta')==='arcano'?'arcano':'reliquia');
    window.CAOZ_SOBRES_VISTA=Object.freeze({estado:()=>componente.estado(),reiniciar:()=>montar(document.body.dataset.propuesta)});
  }
  preparar().catch(()=>{document.getElementById('sobresMontaje').textContent='No se pudo preparar el sobre. Recarga la página para volver a intentarlo.';});
})();
