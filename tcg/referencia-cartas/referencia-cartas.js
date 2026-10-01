/* Arranque de la referencia compartible. El componente de Colección es el
   real, pero se deja únicamente Archivo + Visor y no hay una pantalla detrás
   a la cual regresar. */
'use strict';
(function(){
  function fallo(texto){
    const carga=document.getElementById('referenciaCarga');if(!carga)return;
    carga.classList.add('referenciaFallo');carga.innerHTML='<span>CAOZ CON TODO</span><strong>No se pudo abrir el Archivo visual</strong><p>'+texto+'</p>';
  }
  function iniciar(){
    try{
      const modelo=window.CAOZ_COLECCION;
      if(!window.CAOZ_REFERENCIA_VISUAL||!modelo?.ids?.().length||typeof window.abrirColeccion!=='function'||!window.CAOZ_CARTA_DISENO?.crear)throw Error('Faltan los datos visuales de la colección.');
      window.abrirColeccion();
      const panel=document.getElementById('coleccionPanel');if(!panel?.open)throw Error('No se pudo montar el visor.');
      panel.classList.add('coleccionReferenciaCartas');panel.dataset.referencia='visual';
      panel.querySelector('.coleccionAntetitulo').textContent='CAOZ CON TODO · REFERENCIA VISUAL';
      panel.querySelector('#coleccionTitulo').textContent='Archivo de cartas';
      panel.addEventListener('cancel',evento=>{
        // Escape regresa del detalle a la galería mediante el componente real.
        // En la galería no cerramos: esta página sólo contiene el Archivo.
        if(panel.dataset.vista==='cartas'){evento.preventDefault();evento.stopImmediatePropagation();}
      },true);
      document.body.classList.add('referenciaLista');document.getElementById('referenciaCarga')?.setAttribute('hidden','');
      const id=new URLSearchParams(location.search).get('carta');
      if(id&&modelo.ids().includes(id))requestAnimationFrame(()=>{
        const ficha=[...panel.querySelectorAll('.coleccionMini')].find(n=>n.dataset.carta===id);ficha?.click();
      });
    }catch(error){fallo(error?.message||'Intenta abrir el enlace de nuevo.');}
  }
  if(document.readyState==='complete')iniciar();else addEventListener('load',iniciar,{once:true});
})();
