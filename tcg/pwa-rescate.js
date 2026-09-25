/* Una instalación que vivió cuando el juego usaba la raíz puede conservar un
   worker que sirve una portada vieja aun después de que el Portal redirige a
   /produccion/. Esta puerta no existía en ese precaché: llega desde la red,
   retira sólo las dos PWA del juego y vuelve a abrir la mesa actual. */
(function(){
  'use strict';
  const parametros=new URLSearchParams(location.search);
  function destinoSeguro(){
    const valor=parametros.get('siguiente')||'/produccion/';
    try{
      const url=new URL(valor,location.origin);
      if(url.origin!==location.origin)return '/produccion/';
      const ruta=url.pathname==='/produccion'?'/produccion/':url.pathname;
      if(!['/produccion/','/produccion/index.html','/produccion/movil.html'].includes(ruta))return '/produccion/';
      return ruta+url.search+url.hash;
    }catch(_){return '/produccion/';}
  }
  const destino=destinoSeguro();
  let siguio=false;
  function seguir(){
    if(siguio)return;
    siguio=true;
    location.replace(destino);
  }
  async function retirarPwaAntigua(){
    const scopes=new Set([new URL('/',location.origin).href,new URL('/produccion/',location.origin).href]);
    try{
      if(navigator.serviceWorker&&typeof navigator.serviceWorker.getRegistrations==='function'){
        const registros=await navigator.serviceWorker.getRegistrations();
        await Promise.all(registros.filter(registro=>scopes.has(registro.scope)).map(registro=>registro.unregister()));
      }
    }catch(_){}
    try{
      if(typeof caches!=='undefined'&&typeof caches.keys==='function'){
        const heredada=nombre=>/^caoz-cache-\/-\d+$/.test(nombre)||/^caoz-cache-\/produccion\/-\d+$/.test(nombre)||/^caoz-arte-publico-\/-v\d+$/.test(nombre)||/^caoz-arte-publico-\/produccion\/-v\d+$/.test(nombre);
        const nombres=await caches.keys();
        await Promise.all(nombres.filter(heredada).map(nombre=>caches.delete(nombre)));
      }
    }catch(_){}
  }
  // La reparación nunca puede dejar al jugador mirando esta puerta si el
  // navegador restringe la API PWA: en ese caso abre el juego de todas formas.
  setTimeout(seguir,2500);
  retirarPwaAntigua().finally(seguir);
})();
