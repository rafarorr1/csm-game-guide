/* Inicia el componente real y sólo añade los controles del laboratorio. */
'use strict';
(function(){
  const estado=document.getElementById('heroeEstado');
  function reiniciar(){
    window.campanaLimpiarCreador?.();window.campanaLimpiarBorrador?.();window.CAOZ_DEV?.reset?.();
    if(estado)estado.textContent='Apariencia temporal reiniciada. No hay partida, IA, red ni progreso del jugador.';
    window.campanaCrear();
  }
  document.getElementById('heroeReiniciar')?.addEventListener('click',reiniciar);
  window.CAOZ_HEROE=Object.freeze({reiniciar,estado:()=>estado?.textContent||''});
  reiniciar();
})();
