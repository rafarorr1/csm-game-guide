/* Exporta el epílogo de Gero con sus componentes reales y una memoria efímera. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {generar,juego,hash} from './fuentes.mjs';
const aqui=path.dirname(fileURLToPath(import.meta.url));
const csp="default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; worker-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'";
export const componentesEpilogoGero=Object.freeze(['arte-vistas.js','coleccion-modelo.js','arte-remoto.js','sobres-escena.js','sobres-apertura.js','sobres-apertura.css','coleccion-ui.js','coleccion.css','acabados.css','campana-deseo.js']);
export const imagenesEpilogoGero=Object.freeze(['logo.webp']);
export function derivarEpilogoGero(){
  const render=generar('desktop');
  // El catálogo y renderer son los del juego. G sólo identifica la escena de
  // laboratorio para campana-deseo.js; no contiene una partida ni jugadores.
  const datosJS=render.datosJS.replace('let ARTE={};const G=null;','let ARTE={};const G={aislada:true,campana:{id:"aislado_epilogo_gero"}};');
  if(datosJS===render.datosJS)throw Error('Cambió el contrato de datos aislados: no se encontró G nulo.');
  new vm.Script(datosJS+'\n'+render.renderJS,{filename:'epilogo-gero-renderer.js'});
  return {datosJS,renderJS:render.renderJS,css:render.css,metadatos:render.metadatos};
}
export function exportar(destino){
  destino=path.resolve(destino);
  if(fs.existsSync(destino)&&(!fs.statSync(destino).isDirectory()||fs.readdirSync(destino).length))throw Error('El destino debe estar vacío; no se sobrescribe otro sitio.');
  const escribir=(nombre,contenido)=>{const ruta=path.join(destino,nombre);fs.mkdirSync(path.dirname(ruta),{recursive:true});fs.writeFileSync(ruta,contenido);};
  const derivado=derivarEpilogoGero();
  const html=fs.readFileSync(path.join(aqui,'epilogo-gero.html'),'utf8').replaceAll('__CSP__',csp).replaceAll('__GENERADO__','./generado');
  escribir('index.html',html);escribir('generado/datos.js',derivado.datosJS);escribir('generado/renderer.js',derivado.renderJS);escribir('generado/base.css',derivado.css);escribir('generado/manifiesto.json',JSON.stringify(derivado.metadatos,null,2));
  const entorno={};for(const f of ['epilogo-gero.js','epilogo-gero.css','memoria.js','red-estatica.js']){const b=fs.readFileSync(path.join(aqui,f));escribir(f,b);entorno[f]=hash(b);}
  const componentes={};for(const f of componentesEpilogoGero){const b=fs.readFileSync(path.join(juego,f));escribir('juego/'+f,b);componentes[f]=hash(b);}
  const arte={};for(const f of imagenesEpilogoGero){const b=fs.readFileSync(path.join(juego,'art',f));escribir('art/'+f,b);arte[f]=hash(b);}
  const encuadres=fs.readFileSync(path.join(juego,'art/encuadres.json'));escribir('art/encuadres.json',encuadres);arte['encuadres.json']=hash(encuadres);
  escribir('catalogo-vacio.json',JSON.stringify({cartas:[]}));
  const procedencia={seccion:'epilogo-gero',almacenamiento:'memoria temporal',partida:false,ia:false,online:false,progresoReal:false,
    flujo:['Victoria contra Gero','Formulario de deseo','Fuego','Deseo concedido','Fundido a negro','Selector de tres sobres','Fundido a negro','Menú de laboratorio'],
    contratoSelector:'abrirRecompensaSobres({origen,referencia,finalCampana:true,onConfirmar})',componentes,arte,entorno,renderer:derivado.metadatos,
    derivados:{'index.html':hash(html),'generado/datos.js':hash(derivado.datosJS),'generado/renderer.js':hash(derivado.renderJS),'generado/base.css':hash(derivado.css)}};
  escribir('procedencia.json',JSON.stringify(procedencia,null,2));
  escribir('_headers','/*\n  Cache-Control: no-store\n  X-Content-Type-Options: nosniff\n  Content-Security-Policy: '+csp+'\n');
  return procedencia;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  if(!process.argv[2])throw Error('Indica una carpeta de salida nueva.');
  const p=exportar(process.argv[2]);console.log('Exportado el epílogo de Gero con '+Object.keys(p.componentes).length+' componentes reales. Sin partida, IA, online ni progreso real.');
}
