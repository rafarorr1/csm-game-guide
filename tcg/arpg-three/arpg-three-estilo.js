/* Puntuación de combate compartida. El tiempo avanza sólo con la partida. */
'use strict';
(function(){
  const VENTANA=3;
  const RANGOS=Object.freeze([
    {golpes:1,rango:'D',nombre:'Despierta',multiplicador:1},
    {golpes:3,rango:'C',nombre:'Cadena',multiplicador:1.5},
    {golpes:6,rango:'B',nombre:'Brutal',multiplicador:2},
    {golpes:10,rango:'A',nombre:'Arrasador',multiplicador:3},
    {golpes:15,rango:'S',nombre:'Salvaje',multiplicador:4},
    {golpes:22,rango:'SS',nombre:'Sin piedad',multiplicador:6},
    {golpes:30,rango:'SSS',nombre:'Caoz absoluto',multiplicador:8}
  ].map(Object.freeze));
  const PUNTOS=Object.freeze({goblin:100,kobold:125,cobrador:150,saqueador:250,can:1500,troll:2500});
  function crear(){
    let puntos=0,golpes=0,restante=0,bajas=0,mejor=0,ultimo=0,aviso=0;
    const nivel=()=>{let n=null;for(const r of RANGOS)if(golpes>=r.golpes)n=r;return n;};
    function impacto(dano,{tipo,baja=false,directo=true}={}){
      if(!Number.isFinite(dano)||dano<=0)return false;
      // Adreidos puede sumar una baja, pero no mantener la cadena sin que juegues.
      if(directo){golpes++;restante=VENTANA;mejor=Math.max(mejor,golpes);}
      if(baja){ultimo=Math.round((PUNTOS[tipo]||100)*(nivel()?.multiplicador||1));puntos+=ultimo;bajas++;aviso=1.4;}
      return true;
    }
    function paso(dt){if(!Number.isFinite(dt)||dt<=0)return;aviso=Math.max(0,aviso-dt);restante=Math.max(0,restante-dt);
      if(restante<1e-9){restante=0;golpes=0;}}
    function estado(){const n=nivel();return {puntos,golpes,bajas,mejor,restante,multiplicador:n?.multiplicador||0,rango:n?.rango||'—',nombre:n?.nombre||'Enlaza tus golpes',ultimo:aviso>0?ultimo:0};}
    function reiniciar(){puntos=golpes=restante=bajas=mejor=ultimo=aviso=0;}
    return Object.freeze({impacto,paso,estado,reiniciar});
  }
  window.CAOZ_ARPG_ESTILO=Object.freeze({crear,RANGOS,PUNTOS,VENTANA});
})();
