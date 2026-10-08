/* Descarga verificable antes del arranque; el editor local conserva su flujo sin caché. */
'use strict';
(function(){
  const estado={modo:'sin-iniciar',bytes:0,totalBytes:0,reutilizados:0,descargados:0,total:0,version:null};
  let promesa=null,manifiestoActivo=null;
  navigator.serviceWorker?.addEventListener('message',e=>{
    if(e.data?.tipo==='consultar-version')e.ports[0]?.postMessage({manifiesto:manifiestoActivo});
  });
  function limite(p,ms){return new Promise((ok,mal)=>{const t=setTimeout(()=>mal(Error('La copia local no respondió.')),ms);p.then(v=>{clearTimeout(t);ok(v);},e=>{clearTimeout(t);mal(e);});});}
  async function preparar(progreso=()=>{}){
    if(promesa)return promesa;
    promesa=(async()=>{
      const version=document.querySelector('meta[name="arpg-recursos"]')?.content;
      if(!version){estado.modo='desarrollo';return {...estado};}
      if(!navigator.serviceWorker||!window.isSecureContext||!window.caches){estado.modo='sin-cache';return {...estado};}
      estado.version=version;estado.modo='comprobando';progreso({...estado});
      let manifiesto;
      try{
        const res=await fetch('./arpg-recursos.json?v='+version,{cache:'no-store',signal:AbortSignal.timeout(90000)});
        if(!res.ok)throw Error('No se pudo descargar la lista de recursos. Vuelve a intentar.');manifiesto=await res.json();
        if(manifiesto.version!==version)throw Error('El juego se está actualizando. Vuelve a intentar para cargar la versión completa.');
      }catch(e){throw Error(e.name==='TimeoutError'?'La descarga tarda demasiado. Vuelve a intentar.':e.message);}
      manifiestoActivo=manifiesto;
      // La pestaña conserva el catálogo para recuperar su versión si el navegador
      // borra la caché y reinicia el trabajador mientras sigue abierta.
      try{const prueba=await caches.open('caoz-arpg-prueba-'+encodeURIComponent(new URL('./',location.href).pathname));const key=new URL('__prueba_cache__',location.href);await prueba.put(key,new Response('ok'));await prueba.delete(key);}
      catch{estado.modo='sin-cache';return {...estado};}
      const url=new URL('./arpg-three-cache-sw.js',location.href),correcto=()=>navigator.serviceWorker.controller?.scriptURL===url.href;
      try{
        await limite(navigator.serviceWorker.register(url.href,{scope:new URL('./',location.href).href,updateViaCache:'none'}),15000);
        if(!correcto())await new Promise((ok,mal)=>{
          const fin=()=>{if(!correcto())return;clearTimeout(t);navigator.serviceWorker.removeEventListener('controllerchange',fin);ok();};
          const t=setTimeout(()=>{navigator.serviceWorker.removeEventListener('controllerchange',fin);mal(Error('La copia local no se activó.'));},15000);
          navigator.serviceWorker.addEventListener('controllerchange',fin);fin();
        });
      }catch{estado.modo='sin-cache';return {...estado};}
      await new Promise((ok,mal)=>{
        const canal=new MessageChannel();let t;
        const cerrar=()=>{clearTimeout(t);canal.port1.close();};
        const vigilar=()=>{clearTimeout(t);t=setTimeout(()=>{cerrar();mal(Error('La descarga se interrumpió. Vuelve a intentar.'));},95000);};
        canal.port1.onmessage=e=>{
          const m=e.data;if(m.tipo==='error'){cerrar();if(m.codigo==='almacenamiento'){estado.modo='sin-cache';ok();}else mal(Error(m.mensaje));return;}
          if(m.tipo==='espera'){estado.modo='esperando';progreso({...estado});vigilar();return;}
          if(m.tipo!=='progreso'&&m.tipo!=='lista')return;
          Object.assign(estado,m,{modo:m.tipo==='lista'?(m.persistente===false?'sin-cache':'lista'):'descargando'});progreso({...estado});vigilar();
          if(m.tipo==='lista'){cerrar();ok();}
        };
        vigilar();navigator.serviceWorker.controller.postMessage({tipo:'preparar',manifiesto},[canal.port2]);
      });
      return {...estado};
    })();return promesa;
  }
  window.CAOZ_ARPG_CACHE=Object.freeze({preparar,estado:()=>({...estado})});
})();
