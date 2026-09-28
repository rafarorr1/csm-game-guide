/*
   Arranque exclusivo de la revisión. Se instala antes del HTML original para
   conservar su pantalla de escritorio y saltar la cuenta sin tocar ningún
   archivo del juego. `test` también evita el SW y la cortinilla de arranque;
   la partida sigue usando el motor y la interfaz original completos.
*/
'use strict';
(function(){
  const q=new URLSearchParams(location.search);
  q.set('test','mesa-three-fondo');
  q.set('escritorio','1');
  q.set('mesaThree','1');
  const siguiente=location.pathname+'?'+q.toString()+location.hash;
  if(siguiente!==location.pathname+location.search+location.hash)history.replaceState(null,'',siguiente);
  window.CAOZ_MESA_THREE_FONDO=true;
  // El d20 físico original permite mostrarse explícitamente en esta revisión.
  window.CAOZ_D20_PRUEBA=true;
  window.CAOZ_MESA_THREE_FONDO_CONFIG=Object.freeze({
    inicioAutomatico:true,
    jugador:'talesin',
    rival:'gero',
    primero:0
  });
})();
