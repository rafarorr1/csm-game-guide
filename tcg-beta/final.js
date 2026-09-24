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
  // Un nombre de Estudio es contenido de presentación, no una modificación de
  // CARDS/LEADERS. Este marcador permite que cada vista escriba el título con
  // textContent y que arte-remoto lo refresque cuando llega el catálogo.
  window.marcarNombreCarta=function(nodo,id,base){
    const original=String(base??id);
    if(!nodo)return original;
    const sufijo=nodo.dataset.nombreSufijo??(nodo.textContent.startsWith(original)?nodo.textContent.slice(original.length):'');
    nodo.dataset.nombreId=id;nodo.dataset.nombreBase=original;nodo.dataset.nombreSufijo=sufijo;
    if(typeof window.ponerNombreCarta==='function')return window.ponerNombreCarta(nodo,id,original);
    nodo.textContent=original+sufijo;return nodo.textContent;
  };
  const src=(document.currentScript&&document.currentScript.src)||'';
  let b='166';
  try{ b=new URL(src,location.href).searchParams.get('b')||b; }catch(e){}
  // El parámetro es sólo de los recursos, nunca de la página: las versiones
  // antiguas de la PWA lo dejan pasar directo a la red y así no pueden dejar
  // a medio cargar una versión nueva. El SW actual sí lo atiende y conserva
  // la caché normal; ?test=1 de las pruebas sigue siendo un bypass aparte.
  const recurso=nombre=>nombre+'?b='+encodeURIComponent(b)+'&test=arranque';
  const estilo=nombre=>document.write('<link rel="stylesheet" href="'+recurso(nombre)+'">');
  const guion=nombre=>document.write('<script src="'+recurso(nombre)+'"><\/script>');
  // Las tipografías del tema se piden en cuanto su CSS está leído: si llegan
  // tarde, un panel abierto cambia de medida al aplicarlas. Sin etiquetas
  // nuevas: cada recurso escrito aquí lleva el query de rescate de la PWA.
  window.addEventListener?.('DOMContentLoaded',()=>{for(const f of ["700 16px 'Cinzel Domo'","500 16px 'Cormorant Domo Texto'"])document.fonts?.load(f).catch(()=>{});},{once:true});
  estilo('acabados.css');
  guion('arte-vistas.js');
  if(new URLSearchParams(location.search).has('estudioVista'))guion('estudio-vista.js');
  guion('nombres-cartas.js');
  estilo('coleccion.css');
  estilo('sobres-apertura.css');
  estilo('carta-diseno.css');
  estilo('carta-juego.css');
  estilo('visor-3d.css');
  guion('coleccion-modelo.js');
  guion('arte-remoto.js');
  // Las invitaciones se cargan antes del coordinador: las dos mesas comparten
  // el mismo parser y la misma ruta de regreso a una app instalada.
  guion('invitaciones-compartidas.js');
  guion('final-core.js');
  guion('campana-personaje.js');
  guion('campana-deseo.js');
  guion('campana-mesa.js');
  guion('campana-pitagoras.js');
  guion('campana-secreto.js');
  guion('campana-honores.js');
  guion('pitagoras-pruebas.js');
  guion('pitagoras-mundos.js');
  guion('pitagoras-cine.js');
  guion('pitagoras-fps.js');
  guion('pitagoras-pixel.js');
  guion('pitagoras-laboratorio.js');
  guion('pitagoras-combate.js');
  guion('pitagoras-mesa.js');
  guion('dado-fisico.js');
  guion('moneda-fisica.js');
  guion('polish-aaa.js');
  guion('fx-aliento.js');
  guion('coleccion-juego.js');
  guion('sobres-escena.js');
  guion('sobres-apertura.js');
  guion('sobres-revelacion.js');
  guion('carta-pintor.js');
  guion('carta-diseno.js');
  guion('carta-juego.js');
  guion('visor-3d-gl.js');
  guion('visor-3d.js');
  guion('coleccion-ui.js');
  estilo('cuenta.css');
  estilo('cuenta-juego.css');
  // El tema del visor para el resto del juego: después del CSS de cada módulo.
  estilo('tema-domo.css');
  guion('cuenta-modelo.js');
  guion('cuenta-progreso.js');
  guion('cuenta-servicio.js');
  guion('cuenta-ui.js');
  guion('cuenta-acceso.js');
  guion('cuenta-juego.js');
  guion('audio-domo.js');
})();
