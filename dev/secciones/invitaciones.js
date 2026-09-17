/* Laboratorio visual: la lógica de enlaces y textos pertenece al módulo real. */
'use strict';
(function(){
  const SALA='RUL42';
  const EDICIONES=Object.freeze({
    produccion:{nombre:'Producción',href:'https://juego.caozcontodo.com/'},
    beta:{nombre:'Beta',href:'https://beta.caoz-tcg.pages.dev/'}
  });
  const $=id=>document.getElementById(id);
  let edicion='produccion';

  function api(){
    if(!window.CAOZ_INVITACIONES)throw Error('No se cargó el componente compartido de invitaciones.');
    return window.CAOZ_INVITACIONES;
  }
  function contexto(){return EDICIONES[edicion];}
  function build(){const n=Number(window.CAOZ_INVITACIONES_BUILD);return Number.isInteger(n)&&n>0?n:undefined;}
  function codigo(){return api().codigo(SALA,contexto().href);}
  function textoCodigo(){return api().mensajeCodigo(codigo(),contexto().href);}
  function urlSala(){return api().enlace(codigo(),contexto().href,build());}
  function nombreEdicion(){return api().nombreEdicion(contexto().href);}
  function resultado(titulo,descripcion,valor){
    $('invitacionesResultadoTitulo').textContent=titulo;
    $('invitacionesResultadoDescripcion').textContent=descripcion;
    $('invitacionesResultadoValor').textContent=valor;
  }
  function pintar(){
    const actual=contexto(),sala=codigo();
    $('invitacionesEdicion').value=edicion;
    $('invitacionesPuenteEdicion').textContent=nombreEdicion();
    $('invitacionesCodigoPuente').textContent=sala;
    $('invitacionesPuenteDescripcion').textContent='El enlace de '+actual.nombre.toLowerCase()+' se abrió en el navegador. No necesitas iniciar sesión aquí para conservar tu invitación.';
    resultado('Elige una ruta de invitación','La muestra usa el código '+sala+' y '+actual.nombre.toLowerCase()+'.',sala);
  }
  async function copiarCodigo(){
    const sala=codigo();
    try{
      if(!navigator.clipboard?.writeText)throw Error('Portapapeles no disponible');
      await navigator.clipboard.writeText(sala);
      return true;
    }catch(_){return false;}
  }
  function compartirCodigo(){
    const sala=codigo();
    resultado('Código para una app instalada','Se comparte texto, sin URL, para que la persona abra su propia instalación.',textoCodigo());
    $('invitacionesCompartirCodigo').focus();
    return sala;
  }
  function compartirEnlace(){
    const enlace=urlSala();
    resultado('Enlace para jugar en navegador','El enlace conserva '+contexto().nombre.toLowerCase()+' y lleva el código de sala.',enlace);
    $('invitacionesCompartirEnlace').focus();
    return enlace;
  }
  function abrirPuente(){
    $('invitacionesFeedback').textContent='';
    $('invitacionesVelo').hidden=false;
    $('invitacionesTengoApp').focus();
  }
  function cerrarPuente(){
    $('invitacionesVelo').hidden=true;
    $('invitacionesMostrarPuente').focus();
  }
  async function tengoApp(){
    const sala=codigo(),copiado=await copiarCodigo();
    const texto=copiado?'Código '+sala+' copiado. Abre Con amigos → Unirme con un código en '+nombreEdicion()+'.':'Usa el código '+sala+' en Con amigos → Unirme con un código de '+nombreEdicion()+'.';
    $('invitacionesFeedback').textContent=texto;
    resultado('Puente hacia la app instalada',texto,sala);
  }
  function seguirNavegador(){
    const texto='Sigues en '+contexto().nombre.toLowerCase()+': la entrada continúa en este navegador con la sala '+codigo()+'.';
    $('invitacionesFeedback').textContent=texto;
    resultado('Entrada en navegador',texto,urlSala());
  }
  function restaurar(){edicion='produccion';pintar();cerrarSilencioso();}
  function cerrarSilencioso(){$('invitacionesVelo').hidden=true;}
  function preparar(){
    pintar();
    $('invitacionesEdicion').addEventListener('change',evento=>{edicion=evento.target.value;pintar();});
    $('invitacionesCompartirCodigo').addEventListener('click',compartirCodigo);
    $('invitacionesCompartirEnlace').addEventListener('click',compartirEnlace);
    $('invitacionesMostrarPuente').addEventListener('click',abrirPuente);
    $('invitacionesCerrarPuente').addEventListener('click',cerrarPuente);
    $('invitacionesTengoApp').addEventListener('click',tengoApp);
    $('invitacionesSeguirNavegador').addEventListener('click',seguirNavegador);
    $('invitacionesVelo').addEventListener('click',evento=>{if(evento.target===$('invitacionesVelo'))cerrarPuente();});
    document.addEventListener('keydown',evento=>{if(evento.key==='Escape'&&!$('invitacionesVelo').hidden)cerrarPuente();});
    window.CAOZ_INVITACIONES_LAB=Object.freeze({codigo,compartirCodigo,compartirEnlace,abrirPuente,cerrarPuente,usarApp:tengoApp,seguirNavegador,restaurar});
  }
  if(document.readyState==='loading')addEventListener('DOMContentLoaded',preparar);else preparar();
})();
