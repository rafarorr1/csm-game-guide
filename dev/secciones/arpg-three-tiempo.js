/* Tiempo real por cuadro: una actualización antes de cada dibujo, sin acumulador ni interpolación. */
'use strict';
(function(){
  const MAX_DELTA=.05,PAUSA_LARGA=.25;
  function crearReloj(){
    let total=0,transcurrido=0,perdido=0;
    const salida={pasos:0,avance:0,descartado:0};
    function reiniciar(){salida.pasos=0;salida.avance=0;salida.descartado=0;}
    function avanzar(segundos,simular){
      reiniciar();
      if(!Number.isFinite(segundos)||segundos<=0)return salida;
      // Una pestaña suspendida no recupera segundos de combate al volver.
      if(segundos>PAUSA_LARGA){perdido+=segundos;salida.descartado=segundos;return salida;}
      const dt=Math.min(segundos,MAX_DELTA);
      salida.descartado=segundos-dt;perdido+=salida.descartado;
      if(simular(dt)!==false){salida.pasos=1;salida.avance=dt;total++;transcurrido+=dt;}
      return salida;
    }
    return {avanzar,reiniciar,estado:()=>({modo:'por-cuadro',pasos:total,transcurrido,descartado:perdido})};
  }
  window.CAOZ_ARPG_TIEMPO=Object.freeze({MAX_DELTA,PAUSA_LARGA,crearReloj});
})();
