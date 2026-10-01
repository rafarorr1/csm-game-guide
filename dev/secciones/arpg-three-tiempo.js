/* Reloj de simulación e interpolación visual. No dependen de controles ni reglas de combate. */
'use strict';
(function(){
  const PASO=1/60,MAX_PASOS=6,PAUSA_LARGA=.25;
  function crearReloj(){
    let acumulado=0,total=0,perdido=0;
    const salida={pasos:0,alfa:1,avance:0,descartado:0};
    function reiniciar(){acumulado=0;salida.pasos=0;salida.alfa=1;salida.avance=0;salida.descartado=0;}
    function avanzar(segundos,simular){
      salida.pasos=0;salida.avance=0;salida.descartado=0;
      if(!Number.isFinite(segundos)||segundos<0){reiniciar();return salida;}
      // Al volver de una suspensión no se ejecutan segundos de combate de golpe.
      if(segundos>PAUSA_LARGA){reiniciar();perdido+=segundos;salida.descartado=segundos;return salida;}
      acumulado+=segundos;
      while(acumulado+1e-10>=PASO&&salida.pasos<MAX_PASOS){
        if(simular(PASO)===false){acumulado=0;salida.alfa=1;return salida;}
        acumulado=Math.max(0,acumulado-PASO);salida.pasos++;total++;salida.avance+=PASO;
      }
      if(acumulado+1e-10>=PASO){const exceso=Math.floor((acumulado+1e-10)/PASO)*PASO;acumulado=Math.max(0,acumulado-exceso);perdido+=exceso;salida.descartado=exceso;}
      salida.alfa=Math.min(1,acumulado/PASO);return salida;
    }
    function unPaso(simular){reiniciar();if(simular(PASO)!==false){salida.pasos=1;salida.avance=PASO;total++;}return salida;}
    return {avanzar,unPaso,reiniciar,estado:()=>({hz:60,pasos:total,acumulado,descartado:perdido})};
  }
  function crearInterpolador(THREE){
    const registros=new Map();let generacion=0,aplicado=false;
    const foto=o=>({p:(o.position||o).clone(),q:o.quaternion?.clone(),s:o.scale?.clone()});
    function copiar(f,o){f.p.copy(o.position||o);if(f.q)f.q.copy(o.quaternion);if(f.s)f.s.copy(o.scale);}
    function empezar(){generacion++;}
    function capturar(o){
      if(!o)return;let r=registros.get(o);
      if(!r){r={o,anterior:foto(o),actual:foto(o),generacion};registros.set(o,r);return;}
      if(r.generacion===generacion)return;
      const antes=r.anterior;r.anterior=r.actual;r.actual=antes;copiar(r.actual,o);r.generacion=generacion;
    }
    function terminar(){for(const [o,r] of registros)if(r.generacion!==generacion)registros.delete(o);}
    function aplicar(alfa){
      const k=Math.max(0,Math.min(1,alfa));aplicado=true;
      for(const {o,anterior:a,actual:b} of registros.values()){
        (o.position||o).lerpVectors(a.p,b.p,k);
        if(b.q)o.quaternion.slerpQuaternions(a.q,b.q,k);
        if(b.s)o.scale.lerpVectors(a.s,b.s,k);
      }
    }
    function restaurar(){if(!aplicado)return;for(const {o,actual} of registros.values()){
      (o.position||o).copy(actual.p);if(actual.q)o.quaternion.copy(actual.q);if(actual.s)o.scale.copy(actual.s);
    }aplicado=false;}
    function dibujar(alfa,fn){try{aplicar(alfa);return fn();}finally{restaurar();}}
    function sincronizar(){restaurar();for(const r of registros.values()){copiar(r.anterior,r.o);copiar(r.actual,r.o);}}
    function limpiar(){restaurar();registros.clear();}
    return {empezar,capturar,terminar,dibujar,sincronizar,limpiar,cantidad:()=>registros.size};
  }
  window.CAOZ_ARPG_TIEMPO=Object.freeze({PASO,MAX_PASOS,PAUSA_LARGA,crearReloj,crearInterpolador});
})();
