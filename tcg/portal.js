/* El portal no conoce ni conserva la contraseña: el Worker decide la sesión. */
(function(){
  'use strict';
  const API=window.CAOZ_PORTAL_API||'/api/portal/sesion';
  const REINICIO_PWA='portal-pwa-limpia';
  const $=id=>document.getElementById(id);
  const inicio=$('portalInicio'),acceso=$('portalAcceso'),menu=$('portalMenu'),formulario=$('portalFormulario'),clave=$('portalClave'),enviar=$('portalEnviar'),estado=$('portalEstado'),salir=$('portalSalir'),estadoMenu=$('portalMenuEstado');
  if(!inicio||!acceso||!menu||!formulario||!clave||!enviar||!estado||!salir||!estadoMenu)return;
  const esInicio=location.pathname==='/'||location.pathname==='/inicio'||location.pathname==='/inicio.html';

  // Una invitación y los atajos antiguos seguían llegando a la raíz. Al pedir
  // acceso se conserva el destino, pero nunca se acepta una redirección ajena.
  function destinoSeguro(valor){
    if(typeof valor!=='string'||!valor||valor.length>4096)return '';
    try{
      const u=new URL(valor,location.origin),rutas=['/estudio','/estudio.html','/sonidos','/sonidos.html'];
      if(u.origin!==location.origin)return '';
      if(u.pathname==='/produccion')return '/produccion/'+u.search+u.hash;
      if(u.pathname.startsWith('/produccion/')||u.pathname.startsWith('/fisico/')||rutas.includes(u.pathname))return u.pathname+u.search+u.hash;
    }catch(_){}
    return '';
  }
  // El juego vivió antes en la raíz. Si queda una PWA de aquella época, puede
  // responder desde su caché con la portada antigua incluso bajo /produccion/.
  // La marca permite reiniciar una sola vez ya sin ese controlador heredado.
  const parametros=new URLSearchParams(location.search),yaReinicio=parametros.get(REINICIO_PWA)==='1';
  // Beta nace ya dentro de una PWA de raíz legítima. La retirada es una
  // migración única de Producción, que es donde el juego vivió en la raíz.
  const LIMPIA_PWA_RAIZ=location.hostname==='juego.caozcontodo.com';
  if(parametros.has(REINICIO_PWA)){
    parametros.delete(REINICIO_PWA);
    try{
      if(typeof history!=='undefined'&&typeof history.replaceState==='function'){
        const limpio=location.pathname+(parametros.toString()?'?'+parametros.toString():'')+location.hash;
        history.replaceState(null,'',limpio);
      }
    }catch(_){}
  }
  const siguiente=destinoSeguro(parametros.get('siguiente'))||(()=>{
    parametros.delete('siguiente');const resto=parametros.toString();
    return resto?'/produccion/?'+resto+location.hash:'';
  })();
  // Esta puerta no pertenecía a las PWA antiguas. Antes de entrar a la mesa,
  // puede retirar su worker y caché viejos sin tocar cuentas ni progreso.
  function puertaProduccion(destino){
    try{
      const u=new URL(destino,location.origin),rutas=['/produccion/','/produccion/index.html','/produccion/movil.html'];
      if(u.origin===location.origin&&rutas.includes(u.pathname))return '/abrir-produccion?siguiente='+encodeURIComponent(u.pathname+u.search+u.hash);
    }catch(_){}
    return destino;
  }

  const texto=(n,error=false)=>{estado.textContent=n;estado.classList.toggle('portalError',!!error);};
  const mostrarInicio=()=>{acceso.hidden=true;menu.hidden=true;inicio.hidden=false;};
  const mostrarAcceso=(mensaje='',error=false)=>{inicio.hidden=true;menu.hidden=true;acceso.hidden=false;texto(mensaje,error);if(!mensaje)setTimeout(()=>clave.focus(),0);};
  const cacheRaizLegada=nombre=>/^caoz-cache-\/-\d+$/.test(nombre)||/^caoz-arte-publico-\/-v\d+$/.test(nombre);
  async function retirarPwaRaiz(){
    if(!LIMPIA_PWA_RAIZ)return false;
    let retirada=false;
    try{
      if(typeof navigator!=='undefined'&&navigator.serviceWorker&&typeof navigator.serviceWorker.getRegistrations==='function'){
        const raiz=new URL('/',location.origin).href,controlador=navigator.serviceWorker.controller,registros=await navigator.serviceWorker.getRegistrations(),urlControlador=controlador&&new URL(controlador.scriptURL,location.origin);
        if(urlControlador&&urlControlador.origin===location.origin&&urlControlador.pathname==='/sw.js')retirada=true;
        for(const registro of registros||[]){
          if(registro&&registro.scope===raiz)retirada=(await registro.unregister())||retirada;
        }
      }
    }catch(_){}
    try{
      if(typeof caches!=='undefined'&&typeof caches.keys==='function'){
        const nombres=await caches.keys();
        await Promise.all(nombres.filter(cacheRaizLegada).map(nombre=>caches.delete(nombre)));
      }
    }catch(_){}
    return retirada;
  }
  function reiniciarPortal(){
    const url=new URL(location.href);url.searchParams.set(REINICIO_PWA,'1');
    location.replace(url.pathname+url.search+url.hash);
  }
  async function prepararPortal(){
    if(await retirarPwaRaiz()){
      if(!yaReinicio){reiniciarPortal();return false;}
      mostrarAcceso('El navegador aún conserva una versión anterior. Cierra por completo esta pestaña o la app y vuelve a abrir el Portal.',true);
      return false;
    }
    return true;
  }
  const mostrarMenu=async()=>{
    if(!await prepararPortal())return false;
    if(siguiente){location.replace(puertaProduccion(siguiente));return;}
    inicio.hidden=true;acceso.hidden=true;menu.hidden=false;estadoMenu.textContent='Elige una herramienta de Develop.';
    return true;
  };
  async function respuesta(r){try{return await r.json();}catch(_){return {};}}
  async function consultar(confirmar=false){
    try{
      const r=await fetch(API,{credentials:'same-origin',headers:{Accept:'application/json'}});
      const datos=await respuesta(r);
      if(r.ok&&datos.autenticado===true)return mostrarMenu();
      mostrarAcceso(confirmar?'No se pudo confirmar la sesión. Escribe la contraseña otra vez.':datos.error||'Escribe la contraseña para entrar.',confirmar||!r.ok);
      return false;
    }catch(_){mostrarAcceso(confirmar?'No se pudo confirmar la sesión. Escribe la contraseña otra vez.':'No se pudo comprobar el acceso. Intenta de nuevo.',true);return false;}
  }
  formulario.addEventListener('submit',async e=>{
    e.preventDefault();const valor=clave.value;
    if(!valor){texto('Escribe la contraseña.',true);clave.focus();return;}
    enviar.disabled=true;texto('Abriendo el portal…');
    try{
      const r=await fetch(API,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({clave:valor})});
      const datos=await respuesta(r);clave.value='';
      // La redirección sólo ocurre después de que el navegador devuelva la
      // cookie recién emitida. Si una PWA o una política del navegador la
      // bloquea, el jugador se queda aquí con una explicación, no en un ciclo.
      if(r.ok){await consultar(true);return;}
      texto(datos.error||'La contraseña no es correcta.',true);clave.focus();
    }catch(_){texto('No se pudo abrir el portal. Intenta de nuevo.',true);}
    finally{enviar.disabled=false;}
  });
  salir.addEventListener('click',async()=>{
    salir.disabled=true;estadoMenu.textContent='Cerrando portal…';
    try{await fetch(API,{method:'DELETE',credentials:'same-origin',headers:{Accept:'application/json'}});}catch(_){}
    finally{salir.disabled=false;mostrarAcceso('Sesión cerrada.');}
  });
  document.addEventListener('click',e=>{
    const enlace=e.target.closest('[data-destino]');
    if(!enlace||!window.CAOZ_PORTAL_PREVIEW)return;
    e.preventDefault();estadoMenu.textContent='En producción, esta puerta abrirá: '+enlace.dataset.destino+'.';
  });
  (async()=>{if(!await prepararPortal())return;if(esInicio){mostrarInicio();return;}await consultar();})();
})();
