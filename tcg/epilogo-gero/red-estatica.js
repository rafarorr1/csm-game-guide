/* Adaptador del catálogo vacío para una sección estática, sin backend ni sesión. */
'use strict';
(function(){
  const original=window.fetch.bind(window),base=new URL('.',location.href);
  const catalogo=new URL('api/arte/catalogo',base).href;
  window.fetch=function(entrada,opciones){
    const metodo=String(opciones?.method||entrada?.method||'GET').toUpperCase();
    const url=new URL(typeof entrada==='string'||entrada instanceof URL?entrada:entrada.url,base);
    if(metodo==='GET'&&url.href.split('?')[0]===catalogo){
      url.pathname=new URL('catalogo-vacio.json',base).pathname;
      return original(url.href,opciones);
    }
    return original(entrada,opciones);
  };
})();
