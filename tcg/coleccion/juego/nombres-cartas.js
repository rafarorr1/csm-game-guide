/* Nombres visibles de cartas. Los IDs, reglas y datos de partida permanecen
   canónicos; este módulo sólo valida títulos seguros para la interfaz. */
'use strict';
(function(global){
  const MAXIMO=70,MAXIMO_ARTISTA=100;
  const prohibidos=/[\u0000-\u001f\u007f<>]/u;
  function validar(valor,{permitirNulo=false}={}){
    if(permitirNulo&&valor===null)return null;
    if(typeof valor!=='string')throw Error('El nombre debe ser texto.');
    const titulo=valor.normalize('NFC').replace(/\s+/gu,' ').trim();
    if(!titulo)throw Error('Escribe un nombre para la carta.');
    if([...titulo].length>MAXIMO)throw Error('El nombre puede tener hasta '+MAXIMO+' caracteres.');
    if(prohibidos.test(titulo))throw Error('El nombre no puede incluir signos < > ni caracteres de control.');
    return titulo;
  }
  function legible(valor){try{return validar(valor);}catch(_){return null;}}
  function validarArtista(valor,{permitirNulo=false}={}){
    if(permitirNulo&&valor===null)return null;
    if(typeof valor!=='string')throw Error('El nombre del artista debe ser texto.');
    const artista=valor.normalize('NFC').replace(/\s+/gu,' ').trim();
    if(!artista)throw Error('Escribe el nombre del artista.');
    if([...artista].length>MAXIMO_ARTISTA)throw Error('El nombre del artista puede tener hasta '+MAXIMO_ARTISTA+' caracteres.');
    if(prohibidos.test(artista))throw Error('El nombre del artista no puede incluir signos < > ni caracteres de control.');
    return artista;
  }
  function artistaLegible(valor){try{return validarArtista(valor);}catch(_){return null;}}
  global.CAOZ_NOMBRES_CARTAS=Object.freeze({MAXIMO,MAXIMO_ARTISTA,validar,legible,validarArtista,artistaLegible});
})(globalThis);
