/* Exporta sólo la apertura: cinco cartas reales y sus componentes compartidos. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {generar,datosDesdeMotor,leer,juego,hash} from './fuentes.mjs';
const aqui=path.dirname(fileURLToPath(import.meta.url));
const csp="default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; worker-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'";
export const cartasSobres=Object.freeze(['tal','rey','eric','armadura','zancada']);
export const componentesSobres=Object.freeze(['sobres-apertura.js','sobres-apertura.css','sobres-escena.js','arte-vistas.js','arte-remoto.js','acabados.css']);
export const imagenesSobres=Object.freeze([...cartasSobres.map(id=>id+'.webp'),'logo.webp']);
export function exportar(destino){
  destino=path.resolve(destino);
  if(fs.existsSync(destino)&&(!fs.statSync(destino).isDirectory()||fs.readdirSync(destino).length))throw Error('El destino debe estar vacío; no se sobrescribe otro sitio.');
  const escribir=(f,c)=>{const p=path.join(destino,f);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,c);};
  const fuente=leer('motor.js'),datos=datosDesdeMotor(fuente),render=generar('movil');
  const cards=Object.fromEntries(cartasSobres.map(id=>{if(!datos.CARDS[id])throw Error('No existe la carta de la prueba: '+id);return[id,datos.CARDS[id]];}));
  const datosJS='/* Cinco cartas reales. No se crea una partida ni inventario. */\nconst CARDS='+JSON.stringify(cards).replace(/</g,'\\u003c')+';\nconst LEADERS={};const SUBNAME='+JSON.stringify(datos.SUBNAME)+';let ARTE={};const G=null;\n';
  new vm.Script(datosJS+'\n'+render.renderJS);
  const html=fs.readFileSync(path.join(aqui,'sobres.html'),'utf8').replaceAll('__CSP__',csp);
  escribir('index.html',html);
  escribir('generado/datos.js',datosJS);escribir('generado/renderer.js',render.renderJS);escribir('generado/base.css',render.css);
  const entorno={};
  for(const f of ['sobres.js','sobres.css','memoria.js','red-estatica.js']){const b=fs.readFileSync(path.join(aqui,f));escribir(f,b);entorno[f]=hash(b);}
  const componentes={};
  for(const f of componentesSobres){const b=fs.readFileSync(path.join(juego,f));escribir('juego/'+f,b);componentes[f]=hash(b);}
  const originales=JSON.parse(leer('art/encuadres.json')),arte={};
  for(const f of imagenesSobres){const b=fs.readFileSync(path.join(juego,'art',f));escribir('art/'+f,b);arte[f]=hash(b);}
  const encuadres=Object.fromEntries(cartasSobres.map(id=>{if(!Object.hasOwn(originales,id))throw Error('Falta el encuadre de '+id);return[id,originales[id]];}));
  const encuadresJSON=JSON.stringify(encuadres);escribir('art/encuadres.json',encuadresJSON);
  escribir('catalogo-vacio.json',JSON.stringify({cartas:[]}));
  const procedencia={seccion:'sobres',almacenamiento:'memoria temporal',partida:false,inventario:false,cartas:cartasSobres,
    componentes,arte,entorno,renderer:render.metadatos,derivados:{'index.html':hash(html),'generado/datos.js':hash(datosJS),
      'generado/renderer.js':hash(render.renderJS),'generado/base.css':hash(render.css),'art/encuadres.json':hash(encuadresJSON)}};
  escribir('procedencia.json',JSON.stringify(procedencia,null,2));
  // Estas cabeceras son comunes a Colección y El Rey; conservar sus bytes.
  escribir('_headers','/*\n  Cache-Control: no-store\n  X-Content-Type-Options: nosniff\n  Content-Security-Policy: '+csp+'\n');
  return procedencia;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  if(!process.argv[2])throw Error('Indica una carpeta de salida nueva.');
  const p=exportar(process.argv[2]);console.log('Exportada la apertura con '+p.cartas.length+' cartas y '+Object.keys(p.arte).length+' imágenes locales. Sin partida ni progreso real.');
}
