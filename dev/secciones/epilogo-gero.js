/* Recorrido aislado del epílogo de Gero. Los adaptadores sólo sostienen la
   escena: no crean una partida ni leen el avance real del navegador. */
'use strict';
(function(){
  const cuerpo=document.body,estado=document.getElementById('epilogoGeroEstado');
  const inicio=document.getElementById('epilogoGeroIniciar'),reiniciar=document.getElementById('epilogoGeroReiniciar');
  let campana=null,recompensaAbierta=false,confirmada=false;
  const runId='aislado_epilogo_gero';
  function decir(fase,texto){
    cuerpo.dataset.fase=fase;
    if(estado)estado.textContent=texto;
  }
  function temporizar(ms,fn){return setTimeout(fn,ms);}
  // Estos adaptadores son el borde mínimo que campana-deseo.js y Colección necesitan.
  // La memoria vive sólo en esta página y no representa progreso de campaña.
  window.campanaLeer=()=>campana;
  window.campanaGuardar=dato=>{campana=dato;return true;};
  window.campanaCerrar=()=>{};
  window.cerrarCinematica=()=>{};
  window.limpiarTransicionMenu=()=>{};
  function terminar(eleccion){
    if(confirmada)return true;
    confirmada=true;decir('fundido-final','Tus tres sobres se guardan. Volviendo al menú principal…');
    // El valor se conserva sólo como diagnóstico de la escena aislada; no se
    // persiste ni se transmite al juego o a una cuenta.
    window.CAOZ_EPILOGO_GERO.ultimaEleccion=Array.isArray(eleccion?.grupos)?eleccion.grupos.slice():[];
    // Colección mantiene su propio negro mientras espera esta promesa. Sólo
    // revelamos el laboratorio cuando este segundo fundido ya está opaco; así
    // no hay un cuadro donde se vea el selector al cerrarse su diálogo.
    return new Promise(resolve=>temporizar(matchMedia('(prefers-reduced-motion:reduce)').matches?0:820,()=>{
      decir('menu','Revisión terminada. Puedes iniciar otra vez con datos nuevos en memoria.');
      resolve(true);
      requestAnimationFrame(()=>reiniciar?.focus({preventScroll:true}));
    }));
  }
  function abrirSobresFinal(id,partida){
    if(recompensaAbierta||!campana||id!==campana.id||partida!==G)return false;
    const modelo=window.CAOZ_COLECCION;
    if(!modelo?.concederSobreCampana||typeof window.abrirRecompensaSobres!=='function'){
      decir('error','No se pudo preparar la selección de sobres en esta revisión.');return false;
    }
    if(!modelo.concederSobreCampana(id)){
      decir('error','No se pudo registrar la recompensa temporal.');return false;
    }
    recompensaAbierta=true;decir('seleccion','Desliza entre las colecciones y elige tres sobres.');
    // Este es el contrato de integración: la pantalla real decide cómo se
    // presenta el final y avisa una sola vez cuando los tres sobres se guardan.
    const abierta=window.abrirRecompensaSobres({origen:'campana',referencia:id,finalCampana:true,onConfirmar:terminar});
    if(abierta===false){recompensaAbierta=false;decir('error','La selección de sobres no se pudo abrir.');return false;}
    return true;
  }
  // Este es el mismo borde que final-core.js instala en la campaña. El alias
  // mantiene la sección legible con revisiones previas del deseo, sin sumar
  // un flujo de recompensa distinto.
  window.campanaAbrirSobresFinal=abrirSobresFinal;
  window.campanaElegirPremioAlVolver=id=>abrirSobresFinal(id,G);
  function empezar(){
    window.campanaCerrarDeseo?.();
    document.getElementById('coleccionPanel')?.querySelector('.coleccionCerrar')?.click();
    window.CAOZ_DEV?.reset?.();
    recompensaAbierta=false;confirmada=false;
    // El deseo real identifica el epílogo de Gero con esta marca desde la
    // victoria. Sin ella, campana-deseo tomaría la salida histórica (que el
    // laboratorio deliberadamente no carga) en vez del selector fullscreen.
    campana={version:1,id:runId,lider:'talesin',etapa:6,deseoFinalGero:true};
    decir('victoria','Victoria contra Gero. El Domo te pide un deseo.');
    if(typeof window.campanaAbrirDeseo!=='function'){decir('error','No se cargó la cinemática del deseo.');return;}
    window.campanaAbrirDeseo();
  }
  document.addEventListener('keydown',evento=>{
    if(cuerpo.dataset.fase==='seleccion'&&evento.key==='Escape'){evento.preventDefault();evento.stopImmediatePropagation();}
  },true);
  window.CAOZ_EPILOGO_GERO={estado:()=>cuerpo.dataset.fase,simularVictoria:empezar,ultimaEleccion:[]};
  inicio?.addEventListener('click',empezar);reiniciar?.addEventListener('click',empezar);
  cargarArte?.().catch(()=>{}).finally(()=>decir('inicio','Datos reales de Colección en memoria temporal. No hay partida, IA, online ni avance del jugador.'));
})();
