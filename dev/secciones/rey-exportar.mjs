/* La mesa de prueba usa cartas y regla extraídas del código real. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {generar,datosDesdeMotor,extraerDeclaracion,leer,juego,hash} from './fuentes.mjs';
const aqui=path.dirname(fileURLToPath(import.meta.url));
const csp="default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; worker-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'";
export const cartasRey=Object.freeze(['rey','can','tok_goblincamino','eric','matildus']);
export function exportar(destino){
  destino=path.resolve(destino);
  if(fs.existsSync(destino)&&fs.readdirSync(destino).length)throw Error('El destino debe estar vacío; no se sobrescribe otro sitio.');
  const escribir=(f,c)=>{const p=path.join(destino,f);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,c);};
  const copiar=(p,f)=>escribir(f,fs.readFileSync(p));
  const fuente=leer('motor.js'),datos=datosDesdeMotor(fuente),regla=extraerDeclaracion(fuente,'avanceCorte'),render=generar('movil');
  const cards=Object.fromEntries(cartasRey.map(id=>{if(!datos.CARDS[id])throw Error('No existe la carta de la prueba: '+id);return[id,datos.CARDS[id]];}));
  const datosJS='/* Cinco cartas reales. No se crea una partida. */\nconst CARDS='+JSON.stringify(cards).replace(/</g,'\\u003c')+';\nconst LEADERS={};const SUBNAME='+JSON.stringify(datos.SUBNAME)+';let ARTE={};const G=null;\n';
  new vm.Script(datosJS+'\n'+render.renderJS+'\n'+regla.texto);
  escribir('index.html',fs.readFileSync(path.join(aqui,'rey.html'),'utf8').replaceAll('__CSP__',csp));
  escribir('generado/datos.js',datosJS);escribir('generado/renderer.js',render.renderJS);escribir('generado/base.css',render.css);escribir('generado/regla.js',regla.texto+'\n');
  for(const f of ['rey.js','rey.css','memoria.js','red-estatica.js'])copiar(path.join(aqui,f),f);
  const componentes={};
  for(const f of ['arte-vistas.js','arte-remoto.js','acabados.css']){const b=fs.readFileSync(path.join(juego,f));escribir('juego/'+f,b);componentes[f]=hash(b);}
  const originales=JSON.parse(leer('art/encuadres.json')),arte={};
  const encuadres=Object.fromEntries(cartasRey.map(id=>{const f=id+'.webp',b=fs.readFileSync(path.join(juego,'art',f));escribir('art/'+f,b);arte[f]=hash(b);if(!Object.hasOwn(originales,id))throw Error('Falta el encuadre de '+id);return[id,originales[id]];}));
  escribir('art/encuadres.json',JSON.stringify(encuadres));escribir('catalogo-vacio.json',JSON.stringify({cartas:[]}));
  const procedencia={seccion:'rey',almacenamiento:'memoria temporal',partida:false,regla:{nombre:regla.nombre,archivo:'caoz_tcg/motor.js',linea:regla.linea,sha256:regla.sha256},cartas:cartasRey,componentes,arte,renderer:render.metadatos};
  escribir('procedencia.json',JSON.stringify(procedencia,null,2));
  escribir('_headers','/*\n  Cache-Control: no-store\n  X-Content-Type-Options: nosniff\n  Content-Security-Policy: '+csp+'\n');
  return procedencia;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  if(!process.argv[2])throw Error('Indica una carpeta de salida nueva.');
  const p=exportar(process.argv[2]);console.log('Exportada la corte con '+p.cartas.length+' cartas y la función real '+p.regla.nombre+'. Sin partida ni progreso real.');
}
