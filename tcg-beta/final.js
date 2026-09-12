/* ==========================================================================
   CAOZ CON TODO — scripts compartidos
   --------------------------------------------------------------------------
   final-core.js conserva la cinemática/records histórica; campana-mesa.js dibuja
   la mesa de campaña y polish-aaa.js monta
   la nueva capa visual de combate y cartas. Se cargan de forma síncrona para
   que el script específico de index.html/movil.html encuentre las funciones
   compartidas exactamente igual que antes.
   ========================================================================== */
'use strict';
(function(){
  const src=(document.currentScript&&document.currentScript.src)||'';
  let b='166';
  try{ b=new URL(src,location.href).searchParams.get('b')||b; }catch(e){}
  document.write('<link rel="stylesheet" href="acabados.css?b='+encodeURIComponent(b)+'">');
  document.write('<script src="arte-vistas.js?b='+encodeURIComponent(b)+'"><\/script>');
  if(new URLSearchParams(location.search).has('estudioVista'))document.write('<script src="estudio-vista.js?b='+encodeURIComponent(b)+'"><\/script>');
  document.write('<link rel="stylesheet" href="coleccion.css?b='+encodeURIComponent(b)+'">');
  document.write('<link rel="stylesheet" href="sobres-apertura.css?b='+encodeURIComponent(b)+'">');
  document.write('<script src="coleccion-modelo.js?b='+encodeURIComponent(b)+'"><\/script>');
  document.write('<script src="arte-remoto.js?b='+encodeURIComponent(b)+'"><\/script>');
  document.write('<script src="final-core.js?b='+encodeURIComponent(b)+'"><\/script>');
  document.write('<script src="campana-personaje.js?b='+encodeURIComponent(b)+'"><\/script>');
  document.write('<script src="campana-deseo.js?b='+encodeURIComponent(b)+'"><\/script>');
  document.write('<script src="campana-mesa.js?b='+encodeURIComponent(b)+'"><\/script>');
  document.write('<script src="campana-pitagoras.js?b='+encodeURIComponent(b)+'"><\/script>');
  document.write('<script src="campana-secreto.js?b='+encodeURIComponent(b)+'"><\/script>');
  document.write('<script src="campana-honores.js?b='+encodeURIComponent(b)+'"><\/script>');
  document.write('<script src="pitagoras-pruebas.js?b='+encodeURIComponent(b)+'"><\/script>');
  document.write('<script src="pitagoras-mundos.js?b='+encodeURIComponent(b)+'"><\/script>');
  document.write('<script src="pitagoras-cine.js?b='+encodeURIComponent(b)+'"><\/script>');
  document.write('<script src="pitagoras-fps.js?b='+encodeURIComponent(b)+'"><\/script>');
  document.write('<script src="pitagoras-pixel.js?b='+encodeURIComponent(b)+'"><\/script>');
  document.write('<script src="pitagoras-laboratorio.js?b='+encodeURIComponent(b)+'"><\/script>');
  document.write('<script src="pitagoras-combate.js?b='+encodeURIComponent(b)+'"><\/script>');
  document.write('<script src="pitagoras-mesa.js?b='+encodeURIComponent(b)+'"><\/script>');
  document.write('<script src="dado-fisico.js?b='+encodeURIComponent(b)+'"><\/script>');
  document.write('<script src="moneda-fisica.js?b='+encodeURIComponent(b)+'"><\/script>');
  document.write('<script src="polish-aaa.js?b='+encodeURIComponent(b)+'"><\/script>');
  document.write('<script src="coleccion-juego.js?b='+encodeURIComponent(b)+'"><\/script>');
  document.write('<script src="sobres-escena.js?b='+encodeURIComponent(b)+'"><\/script>');
  document.write('<script src="sobres-apertura.js?b='+encodeURIComponent(b)+'"><\/script>');
  document.write('<script src="coleccion-ui.js?b='+encodeURIComponent(b)+'"><\/script>');
  document.write('<script src="audio-domo.js?b='+encodeURIComponent(b)+'"><\/script>');
})();
