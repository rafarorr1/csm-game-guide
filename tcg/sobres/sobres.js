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
  function menu(){
    componente?.destruir();componente=null;
    document.querySelector('.sobresCabecera h1').textContent='Sobres del Domo';
    const panel=document.createElement('section');panel.className='sobresMenu';
    const imagen=document.createElement('img');imagen.src='./art/logo.webp';imagen.alt='Caoz Con Todo';
    const titulo=document.createElement('h2');titulo.textContent='Un nuevo tesoro te espera';
    const texto=document.createElement('p');texto.textContent='Cinco cartas. Un sello por romper.';
    const abrir=document.createElement('button');abrir.type='button';abrir.className='sobresAccion';abrir.textContent='Abrir sobre';abrir.onclick=montar;
    panel.append(imagen,titulo,texto,abrir);document.getElementById('sobresMontaje').replaceChildren(panel);abrir.focus({preventScroll:true});
  }
  function montar(){
    componente?.destruir();document.body.dataset.propuesta='reliquia';
    document.querySelector('.sobresCabecera h1').textContent='Rompe el sello.';
    const url=new URL(location.href);url.searchParams.set('propuesta','reliquia');history.replaceState(null,'',url);
    componente=window.CAOZ_SOBRES.crear(document.getElementById('sobresMontaje'),{variante:'reliquia',logoUrl:'./art/logo.webp',cartas:ids.map(id=>({id,nombre:CARDS[id].n,acabado:'foil'})),crearCarta:carta,onVolver:menu,
      onCambio:estado=>{document.querySelector('.sobresCabecera h1').textContent=estado.fase==='terminado'||estado.fase==='cerrando'?'Tu nuevo tesoro.':'Rompe el sello.';}});
  }
  async function preparar(){
    altura();addEventListener('resize',altura);window.visualViewport?.addEventListener('resize',altura);
    if(!window.CAOZ_DEV?.aislado)throw Error('La vista de sobres requiere el entorno aislado.');
    await cargarArte();
    document.getElementById('sobresReiniciar').onclick=montar;
    montar();
    window.CAOZ_SOBRES_VISTA=Object.freeze({estado:()=>componente?.estado()||{fase:'menu',reveladas:0,total:5,variante:'reliquia'},reiniciar:montar});
  }
  preparar().catch(()=>{document.getElementById('sobresMontaje').textContent='No se pudo preparar el sobre. Recarga la página para volver a intentarlo.';});
})();
