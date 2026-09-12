/* Adaptadores derivados, no copias editables de la interfaz del juego.
   El compilador nativo delimita cada declaración, incluidas plantillas y regex. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';

export const raiz=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
export const juego=path.join(raiz,'caoz_tcg');
export const vistas=Object.freeze({desktop:'index.html',movil:'movil.html'});
const cache=new Map();
export const hash=texto=>crypto.createHash('sha256').update(texto).digest('hex');
export function leer(nombre){return fs.readFileSync(path.join(juego,nombre),'utf8');}
export function extraerDeclaracion(codigo,nombre,tipo='function'){
  if(!/^[A-Za-z_$][\w$]*$/.test(nombre)||!['function','const','let'].includes(tipo))throw Error('Declaración inválida');
  const patron=new RegExp('^\\s*'+tipo+'\\s+'+nombre+'\\b','gm'),coincidencias=[...codigo.matchAll(patron)];
  if(coincidencias.length!==1)throw Error(`Se esperaba una declaración única de ${nombre}; se encontraron ${coincidencias.length}.`);
  const inicio=coincidencias[0].index;
  for(let fin=inicio;fin<codigo.length;fin++){
    if(codigo[fin]!=='}'&&codigo[fin]!==';')continue;
    const texto=codigo.slice(inicio,fin+1);
    try{new vm.Script(texto,{filename:nombre+'.js'});return {nombre,texto,linea:codigo.slice(0,inicio).split('\n').length,sha256:hash(texto)};}catch(e){if(!(e instanceof SyntaxError))throw e;}
  }
  throw Error(`La declaración ${nombre} no termina o tiene sintaxis inválida.`);
}
export function datosDesdeMotor(codigo){
  // El motor declara sus cartas, pero aquí no dispone de DOM, red, temporizadores,
  // almacenamiento ni APIs de sistema. No se inicia ninguna partida.
  const contexto=vm.createContext({TextEncoder,TextDecoder,URLSearchParams,location:Object.freeze({search:''})},{codeGeneration:{strings:false,wasm:false}});
  const json=new vm.Script(codigo+'\nJSON.stringify({CARDS,LEADERS,DECKS,SUBNAME});',{filename:'motor-datos.js'}).runInContext(contexto,{timeout:1500});
  const datos=JSON.parse(json);
  if(!datos.CARDS||!datos.LEADERS||!datos.DECKS||!datos.SUBNAME)throw Error('Cambió el contrato del catálogo del motor.');
  return datos;
}
export function generar(vista='desktop'){
  if(!Object.hasOwn(vistas,vista))throw Error('Vista desconocida');
  const archivos={html:leer(vistas[vista]),motor:leer('motor.js'),polish:leer('polish-aaa.js')};
  const firma=hash(archivos.html+archivos.motor+archivos.polish);
  if(cache.get(vista)?.firma===firma)return cache.get(vista).resultado;
  const datos=datosDesdeMotor(archivos.motor);
  const funciones=['ponerDibujo','ilustrarLider','ilustrar','cardEl','cartaDeLiderVS'].map(n=>extraerDeclaracion(archivos.html,n));
  const auxiliares=[extraerDeclaracion(archivos.html,'el','const'),extraerDeclaracion(archivos.motor,'encuadreDe'),extraerDeclaracion(archivos.motor,'cap','const'),extraerDeclaracion(archivos.motor,'tribeLine')];
  const cssHTML=[...archivos.html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map(m=>m[1]).join('\n');
  if(!cssHTML.includes('.card'))throw Error('No se encontró el CSS de cartas de la pantalla.');
  const cssDeclaracion=extraerDeclaracion(archivos.polish,'AAA_CSS','const');
  const cssPolish=new vm.Script(cssDeclaracion.texto+'\nAAA_CSS;').runInNewContext({},{timeout:1000});
  if(typeof cssPolish!=='string'||!cssPolish.includes('.card.acomodo'))throw Error('Cambió el contrato del CSS compartido.');
  const datosJS='/* Datos derivados del motor actual; no se ejecuta el motor en el navegador. */\n'+Object.entries(datos).map(([k,v])=>'const '+k+'='+JSON.stringify(v).replace(/</g,'\\u003c')+';').join('\n')+'\nlet ARTE={};const G=null;\n';
  const renderJS='/* Funciones originales extraídas al solicitar la vista. No editar este resultado. */\n'+[...auxiliares,...funciones].map(f=>'// '+f.nombre+' · SHA256 '+f.sha256+'\n'+f.texto).join('\n');
  // Estos ganchos sólo añadirían listeners que Colección elimina al clonar la
  // carta. Se omiten explícitamente; no se simula ninguna acción de combate.
  const adaptadores='\nfunction attachInspect(){}\nfunction pulsacionLarga(){}\nfunction cargarArte(){throw Error("El proveedor real de arte aún no está cargado");}\n';
  const resultado={datosJS,renderJS:renderJS+adaptadores,css:cssHTML+'\n/* AAA_CSS real */\n'+cssPolish,metadatos:{vista,cartas:Object.keys(datos.CARDS).length,protagonistas:Object.keys(datos.LEADERS).length,fuentes:[{archivo:'caoz_tcg/'+vistas[vista],sha256:hash(archivos.html)},{archivo:'caoz_tcg/motor.js',sha256:hash(archivos.motor)},{archivo:'caoz_tcg/polish-aaa.js',sha256:hash(archivos.polish)}],funciones:[...auxiliares,...funciones].map(({nombre,linea,sha256})=>({nombre,linea,sha256})),adaptadores:['attachInspect: sin inspector ajeno a la colección','pulsacionLarga: sin inspector ajeno a la colección','G: null; no existe partida'],almacenamiento:'sólo memoria de la página',red:'sólo recursos de este servidor local'}};
  new vm.Script(datosJS+'\n'+resultado.renderJS);
  cache.set(vista,{firma,resultado});return resultado;
}
