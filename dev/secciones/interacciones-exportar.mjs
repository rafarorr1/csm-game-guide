/* Exporta la revisión de interacciones con renderer y datos reales, sin partida. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {datosDesdeMotor,generar,leer,juego,hash} from './fuentes.mjs';
const aqui=path.dirname(fileURLToPath(import.meta.url));
const csp="default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; worker-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'";
export const cartasInteracciones=Object.freeze(['discipulo','machete','destello','aldrick','esporas','bartolomeo']);
export const lideresInteracciones=Object.freeze(['adreida']);
export const componentesInteracciones=Object.freeze(['arte-vistas.js','arte-remoto.js','acabados.css']);
export const imagenesInteracciones=Object.freeze([...cartasInteracciones.map(id=>id+'.webp'),'lider_adreida.webp']);
function datosLimitados(datos){
  const cards=Object.fromEntries(cartasInteracciones.map(id=>{if(!datos.CARDS[id])throw Error('No existe la carta de la revisión: '+id);return [id,datos.CARDS[id]];}));
  const leaders=Object.fromEntries(lideresInteracciones.map(id=>{if(!datos.LEADERS[id]||!datos.DECKS[id])throw Error('No existe el Protagonista de la revisión: '+id);return [id,datos.LEADERS[id]];}));
  const decks=Object.fromEntries(lideresInteracciones.map(id=>[id,datos.DECKS[id]]));
  return '/* Datos reales mínimos; G permanece nulo y no existe partida. */\nconst CARDS='+JSON.stringify(cards).replace(/</g,'\\u003c')+';\nconst LEADERS='+JSON.stringify(leaders).replace(/</g,'\\u003c')+';\nconst DECKS='+JSON.stringify(decks).replace(/</g,'\\u003c')+';\nconst SUBNAME='+JSON.stringify(datos.SUBNAME).replace(/</g,'\\u003c')+';\nlet ARTE={};const G=null;\n';
}
export function exportar(destino){
  destino=path.resolve(destino);
  if(fs.existsSync(destino)&&(!fs.statSync(destino).isDirectory()||fs.readdirSync(destino).length))throw Error('El destino debe estar vacío; no se sobrescribe otro sitio.');
  const escribir=(f,c)=>{const p=path.join(destino,f);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,c);};
  const copiar=(origen,destinoRel)=>escribir(destinoRel,fs.readFileSync(origen));
  const fuente=leer('motor.js'),datos=datosDesdeMotor(fuente),render=generar('desktop'),datosJS=datosLimitados(datos);
  new vm.Script(datosJS+'\n'+render.renderJS,{filename:'interacciones-renderer.js'});
  const html=fs.readFileSync(path.join(aqui,'interacciones.html'),'utf8').replaceAll('__CSP__',csp);
  escribir('index.html',html);escribir('generado/datos.js',datosJS);escribir('generado/renderer.js',render.renderJS);escribir('generado/base.css',render.css);
  const entorno={};for(const f of ['interacciones.js','interacciones.css','memoria.js','red-estatica.js']){const b=fs.readFileSync(path.join(aqui,f));escribir(f,b);entorno[f]=hash(b);}
  const componentes={};for(const f of componentesInteracciones){const b=fs.readFileSync(path.join(juego,f));escribir('juego/'+f,b);componentes[f]=hash(b);}
  const originales=JSON.parse(leer('art/encuadres.json')),encuadres={},arte={};
  for(const f of imagenesInteracciones){const b=fs.readFileSync(path.join(juego,'art',f));escribir('art/'+f,b);arte[f]=hash(b);const id=f.slice(0,-5);if(!Object.hasOwn(originales,id))throw Error('Falta el encuadre de '+id);encuadres[id]=originales[id];}
  const encuadresJSON=JSON.stringify(encuadres);escribir('art/encuadres.json',encuadresJSON);escribir('catalogo-vacio.json',JSON.stringify({cartas:[]}));
  const procedencia={seccion:'interacciones',almacenamiento:'memoria temporal',partida:false,audio:'host visual sin reproducción ni catálogo',cartas:cartasInteracciones,lideres:lideresInteracciones,componentes,arte,entorno,renderer:render.metadatos,derivados:{'index.html':hash(html),'generado/datos.js':hash(datosJS),'generado/renderer.js':hash(render.renderJS),'generado/base.css':hash(render.css),'art/encuadres.json':hash(encuadresJSON)}};
  escribir('procedencia.json',JSON.stringify(procedencia,null,2));
  escribir('_headers','/*\n  Cache-Control: no-store\n  X-Content-Type-Options: nosniff\n  Content-Security-Policy: '+csp+'\n');
  return procedencia;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  if(!process.argv[2])throw Error('Indica una carpeta de salida nueva.');
  const p=exportar(process.argv[2]);console.log('Exportadas '+p.cartas.length+' cartas y Adreida para revisar interacciones. Sin partida, progreso ni audio remoto.');
}
