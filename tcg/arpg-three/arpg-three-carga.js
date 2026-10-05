/* Arranque visible antes de descargar y ejecutar los modelos. Sin código en línea. */
'use strict';
(function(){
  const $=id=>document.getElementById(id);
  let completa=false,fallida=false,porcentaje=0,pendientes=0,gestor=null,vigilancia=null;
  const cuadro=()=>new Promise(resolve=>{let resuelto=false;const fin=()=>{if(resuelto)return;resuelto=true;clearTimeout(limite);resolve();};const limite=setTimeout(fin,120);requestAnimationFrame(()=>requestAnimationFrame(fin));});
  function avance(valor,texto){
    if(completa||fallida)return;porcentaje=Math.max(porcentaje,Math.min(99,valor));
    $('cargaProgreso').value=porcentaje;$('cargaPorcentaje').textContent=Math.floor(porcentaje)+'%';
    $('cargaTexto').textContent=texto;if(valor>=45)$('cargaDetalle').textContent='Preparamos los recursos antes de empezar la partida.';
  }
  function error(mensaje){
    if(completa||fallida)return;clearTimeout(vigilancia);fallida=true;$('cargaInicial').dataset.error='';
    $('cargaTitulo').textContent='No pudimos abrir Tomsage';
    $('cargaTexto').textContent=String(mensaje||'La carga se interrumpió. Revisa tu conexión y vuelve a intentarlo.');
    $('cargaDetalle').textContent='Tu navegador puede volver a intentarlo sin cerrar esta pestaña.';
    $('reintentarCarga').hidden=false;$('cargaInicial').setAttribute('aria-busy','false');
  }
  function terminar(){
    if(fallida)return false;clearTimeout(vigilancia);completa=true;porcentaje=100;$('cargaProgreso').value=100;$('cargaPorcentaje').textContent='100%';
    $('cargaInicial').setAttribute('aria-busy','false');$('cargaInicial').hidden=true;
    document.querySelector('.apShell').inert=false;document.documentElement.removeAttribute('data-cargando');return true;
  }
  // Las cargas de personajes empiezan después de las de edificios: contamos cada
  // recurso, no sólo el primer onLoad del gestor de Three.
  function observarTexturas(){
    const m=window.CAOZ_THREE?.THREE.DefaultLoadingManager;if(!m||gestor)return;gestor=m;
    const inicio=m.itemStart.bind(m),fin=m.itemEnd.bind(m);
    m.itemStart=url=>{pendientes++;inicio(url);};m.itemEnd=url=>{pendientes=Math.max(0,pendientes-1);fin(url);};
  }
  async function texturas(){
    const limite=performance.now()+90000;
    do{if(fallida)throw Error('La carga se interrumpió.');if(performance.now()>limite)throw Error('Las texturas tardan demasiado. Revisa tu conexión y vuelve a intentarlo.');await cuadro();}while(pendientes>0);
  }
  window.CAOZ_ARPG_CARGA=Object.freeze({avance,cuadro,texturas,terminar,error,activa:()=>!completa,estado:()=>({completa,fallida,porcentaje,pendientes})});
  addEventListener('error',e=>{if(e.target?.tagName==='SCRIPT'&&!e.target.hasAttribute('data-caoz-carga'))error('No se pudo cargar un recurso del juego. Vuelve a intentarlo.');else if(e.message)error('La preparación se interrumpió: '+e.message);},true);
  addEventListener('unhandledrejection',e=>error('La preparación se interrumpió: '+(e.reason?.message||e.reason)));
  $('reintentarCarga').onclick=()=>location.reload();
  async function iniciar(){
    const lista=[...document.querySelectorAll('script[data-caoz-carga]')];
    // La página y su pantalla de carga se pintan antes de analizar los archivos grandes.
    await cuadro();
    for(const original of lista){const enlace=document.createElement('link');enlace.rel='preload';enlace.as='script';enlace.href=original.src;document.head.appendChild(enlace);}
    for(let i=0;i<lista.length;i++){
      if(fallida)return;avance(i/lista.length*45,'Reuniendo los recursos de Tomsage…');
      $('cargaDetalle').textContent=`Recursos preparados · ${i} / ${lista.length}`;
      await new Promise((resolve,reject)=>{
        const script=document.createElement('script'),limite=setTimeout(()=>reject(Error('La descarga tarda demasiado. Revisa tu conexión y vuelve a intentarlo.')),90000);
        script.src=lista[i].src;script.async=false;script.onload=()=>{clearTimeout(limite);observarTexturas();resolve();};
        script.onerror=()=>{clearTimeout(limite);reject(Error('No se pudo descargar un recurso del juego. Vuelve a intentarlo.'));};document.head.appendChild(script);
      });
      if(i<lista.length-1)await cuadro();
    }
    // Una promesa de textura o de GPU sin respuesta no deja una espera infinita.
    if(!completa&&!fallida)vigilancia=setTimeout(()=>error('La preparación tarda demasiado. Revisa tu conexión y vuelve a intentarlo.'),90000);
  }
  iniciar().catch(error);
})();
