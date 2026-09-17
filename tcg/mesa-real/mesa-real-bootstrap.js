/* La revisión no acepta rutas alternativas: siempre abre un duelo de prueba
   local. ?test desactiva cuenta/progreso y el service worker del juego. */
(() => {
  const esperado='?test&foto=fender%2Cadreida&arena=domo';
  if(location.search!==esperado)location.replace(location.pathname+esperado);
})();
