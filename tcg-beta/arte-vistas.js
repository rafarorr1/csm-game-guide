/* Encuadres por superficie. Los identificadores se conservan entre escritorio y móvil. */
'use strict';
(function(){
  const nombres={revelada:'Carta jugada y efectos',ruta:'Rival en la ruta',mano:'Carta en la mano',campo:'Carta en el campo',detalle:'Ficha ampliada',coleccion:'Colección y selección de cartas',descarte:'Alcantarillas',memoria:'Prueba de memoria',seleccion:'Selección de protagonista',vs:'Pantalla de VS',victoria:'Victoria y derrota',hud:'Protagonista en combate',campana:'Carta de campaña',honor:'Retrato en el menú'};
  const claves=new Set(Object.keys(nombres).flatMap(k=>['desktop_'+k,'movil_'+k]));
  const valido=e=>!!e&&typeof e==='object'&&!Array.isArray(e)&&['x','y','z'].every(k=>typeof e[k]==='number'&&Number.isFinite(e[k]))&&e.x>=0&&e.x<=100&&e.y>=0&&e.y<=100&&e.z>=50&&e.z<=300;
  const limpiar=v=>Object.fromEntries(Object.entries(v||{}).filter(([k,e])=>claves.has(k)&&valido(e)).map(([k,e])=>[k,{x:e.x,y:e.y,z:e.z}]));
  // Una vista sin ajuste propio comparte el de la otra pantalla antes de usar la base.
  const opuesta=clave=>clave.replace(/^(desktop|movil)_/,p=>p==='desktop_'?'movil_':'desktop_');
  const resolver=(mapa,clave,base)=>mapa?.[clave]||mapa?.[opuesta(clave)]||base;
  function identificar(nodo){
    const exp=nodo.closest('[data-vista-arte]')?.dataset.vistaArte;if(claves.has(exp))return exp;
    let vista='mano';
    if(nodo.closest('.big'))vista='detalle';
    else if(nodo.closest('.campanaRetrato'))vista='honor';
    else if(nodo.closest('.campanaRuta'))vista='ruta';
    else if(nodo.closest('.revela,.fxcard'))vista='revelada';
    else if(nodo.closest('.lrostro,.leadercard'))vista='hud';
    else if(nodo.closest('.fin'))vista='victoria';
    else if(nodo.closest('.campanaCarta'))vista='campana';
    else if(nodo.closest('.vscard'))vista='vs';
    else if(nodo.closest('.lcard,.ltile'))vista='seleccion';
    else if(nodo.closest('.alcantarillaPila'))vista='descarte';
    else if(nodo.closest('.gallery,.gcards'))vista='coleccion';
    else if(nodo.closest('.unit,#myField,#foeField'))vista='campo';
    return (document.getElementById('panelCerrar')?'movil_':'desktop_')+vista;
  }
  window.CAOZ_VISTAS=Object.freeze({nombres,claves,valido,limpiar,identificar,opuesta,resolver,
    disponibles:c=>(c.esLider?['seleccion','vs','victoria','hud','detalle','campana','ruta','honor']:['mano',...(c.tipo==='personaje'?['campo']:[]),'detalle','coleccion','descarte','revelada','memoria'])});
})();
