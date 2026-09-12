/* Adaptador de lectura para la vista alojada con sesión privada. Nunca se usa en el juego. */
'use strict';
(function(){
  const original=window.fetch.bind(window),base=new URL('.',location.href);
  const encuadres=new URL('art/encuadres.json',base).href;
  const catalogo=new URL('api/arte/catalogo',base).href;
  window.fetch=function(entrada,opciones){
    const metodo=String(opciones?.method||entrada?.method||'GET').toUpperCase();
    const url=new URL(typeof entrada==='string'||entrada instanceof URL?entrada:entrada.url,base);
    if(metodo==='GET'&&(url.href===encuadres||url.href.split('?')[0]===catalogo)){
      if(url.href.split('?')[0]===catalogo)url.pathname=new URL('catalogo-vacio.json',base).pathname;
      return original(url.href,{...opciones,credentials:'same-origin'});
    }
    return original(entrada,opciones);
  };
})();
