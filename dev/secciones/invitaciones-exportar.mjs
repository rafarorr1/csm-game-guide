/* Exporta la revisión de invitaciones sin abrir una sala ni tocar progreso. */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {juego,hash} from './fuentes.mjs';

const aqui=path.dirname(fileURLToPath(import.meta.url));
/* Esta cabecera se comparte con las demás revisiones publicadas. */
const csp="default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; worker-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'";

export const componenteInvitaciones='invitaciones-compartidas.js';
export const entornoInvitaciones=Object.freeze(['invitaciones.css','invitaciones.js']);

export function derivarInvitaciones(){
  const buildDe=archivo=>{
    const coincidencia=fs.readFileSync(path.join(juego,archivo),'utf8').match(/const\s+BUILD\s*=\s*\{\s*n\s*:\s*(\d+)/);
    if(!coincidencia)throw Error('No se encontró BUILD en '+archivo+'.');
    return Number(coincidencia[1]);
  };
  const escritorio=buildDe('index.html'),movil=buildDe('movil.html');
  if(!Number.isInteger(escritorio)||escritorio<1||movil!==escritorio)throw Error('Las pantallas no comparten el BUILD de invitación.');
  return {build:escritorio,datosJS:'/* Build derivado de las dos mesas, sin cargar el juego. */\nwindow.CAOZ_INVITACIONES_BUILD='+JSON.stringify(escritorio)+';\n'};
}

export function exportar(destino){
  destino=path.resolve(destino);
  if(fs.existsSync(destino)&&(!fs.statSync(destino).isDirectory()||fs.readdirSync(destino).length))throw Error('El destino debe estar vacío; no se sobrescribe otro sitio.');
  const escribir=(nombre,contenido)=>{const ruta=path.join(destino,nombre);fs.mkdirSync(path.dirname(ruta),{recursive:true});fs.writeFileSync(ruta,contenido);};
  const componente=fs.readFileSync(path.join(juego,componenteInvitaciones));
  if(!componente.includes('CAOZ_INVITACIONES'))throw Error('Cambió el contrato compartido de invitaciones.');
  const derivado=derivarInvitaciones(),plantilla=fs.readFileSync(path.join(aqui,'invitaciones.html'),'utf8');
  const html=plantilla.replaceAll('__CSP__',csp).replaceAll('__GENERADO__','./generado');
  escribir('index.html',html);
  escribir('generado/datos.js',derivado.datosJS);
  escribir('juego/'+componenteInvitaciones,componente);
  const entorno={};
  for(const archivo of entornoInvitaciones){
    const contenido=fs.readFileSync(path.join(aqui,archivo));
    escribir(archivo,contenido);entorno[archivo]=hash(contenido);
  }
  const procedencia={
    seccion:'invitaciones',almacenamiento:'ninguno',partida:false,ia:false,online:false,red:false,progresoReal:false,
    proposito:'Revisar las dos rutas de invitación: código para una app instalada y enlace para jugar en navegador, incluido el puente de llegada.',
    componente:{archivo:'caoz_tcg/'+componenteInvitaciones,sha256:hash(componente)},entorno,
    fixture:{build:derivado.build},derivados:{plantilla:hash(plantilla),'index.html':hash(html),'generado/datos.js':hash(derivado.datosJS)}
  };
  escribir('procedencia.json',JSON.stringify(procedencia,null,2));
  escribir('_headers','/*\n  Cache-Control: no-store\n  X-Content-Type-Options: nosniff\n  Content-Security-Policy: '+csp+'\n');
  return procedencia;
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  if(!process.argv[2])throw Error('Indica una carpeta de salida nueva.');
  const p=exportar(process.argv[2]);
  console.log('Exportada la revisión de invitaciones con el componente compartido real. Sin sala, cuenta, red ni progreso.');
}
