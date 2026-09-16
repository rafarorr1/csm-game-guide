/* Exporta la revisión del selector real de mulligan sin crear una partida. */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {datosDesdeMotor,juego,leer,hash} from './fuentes.mjs';

const aqui=path.dirname(fileURLToPath(import.meta.url));
const csp="default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self'; worker-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'";
export const cartasMulligan=Object.freeze(['discipulo','machete','destello','aldrick','esporas','bartolomeo','augusto','horton']);

export function derivarMulligan(){
  const datos=datosDesdeMotor(leer('motor.js'));
  const cards=Object.fromEntries(cartasMulligan.map(id=>{
    if(!datos.CARDS[id])throw Error('No existe la carta de la revisión: '+id);
    const c=datos.CARDS[id];
    return [id,{id,n:c.n,t:c.t,c:c.c,a:c.a||0,h:c.h||0}];
  }));
  const datosJS='/* Fixture mínimo derivado del catálogo; no inicia motor ni partida. */\nconst CARDS='+JSON.stringify(cards).replace(/</g,'\\u003c')+';\n';
  return {datosJS,cards:Object.keys(cards),motor:hash(leer('motor.js'))};
}

export function exportar(destino){
  destino=path.resolve(destino);
  if(fs.existsSync(destino)&&(!fs.statSync(destino).isDirectory()||fs.readdirSync(destino).length))throw Error('El destino debe estar vacío; no se sobrescribe otro sitio.');
  const escribir=(nombre,contenido)=>{const ruta=path.join(destino,nombre);fs.mkdirSync(path.dirname(ruta),{recursive:true});fs.writeFileSync(ruta,contenido);};
  const derivado=derivarMulligan();
  const plantilla=fs.readFileSync(path.join(aqui,'mulligan.html'),'utf8');
  const html=plantilla.replaceAll('__CSP__',csp).replaceAll('__GENERADO__','./generado/mulligan');
  escribir('index.html',html);escribir('generado/datos.js',derivado.datosJS);
  const entorno={};
  for(const f of ['mulligan.js','mulligan.css']){const b=fs.readFileSync(path.join(aqui,f));escribir(f,b);entorno[f]=hash(b);}
  const componentes={};
  for(const f of ['mulligan-ui.js','mulligan-ui.css']){const b=fs.readFileSync(path.join(juego,f));escribir('juego/'+f,b);componentes[f]=hash(b);}
  const procedencia={seccion:'mulligan',almacenamiento:'memoria temporal',partida:false,ia:false,online:false,progresoReal:false,
    proposito:'Revisar el selector real de mulligan inicial: conservar o cambiar hasta dos cartas antes del primer robo.',
    componentes,entorno,fixture:{cartas:derivado.cards,fuenteMotor:derivado.motor},derivados:{'index.html':hash(html),'generado/datos.js':hash(derivado.datosJS)}};
  escribir('procedencia.json',JSON.stringify(procedencia,null,2));
  escribir('_headers','/*\n  Cache-Control: no-store\n  X-Content-Type-Options: nosniff\n  Content-Security-Policy: '+csp+'\n');
  return procedencia;
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  if(!process.argv[2])throw Error('Indica una carpeta de salida nueva.');
  const p=exportar(process.argv[2]);console.log('Exportado el selector real de mulligan con '+Object.keys(p.componentes).length+' componentes y memoria temporal. Sin partida, IA, online ni progreso real.');
}
