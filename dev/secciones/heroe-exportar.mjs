/* Exporta el creador real de héroe con una memoria efímera y sin campaña. */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {datosDesdeMotor,juego,leer,hash} from './fuentes.mjs';
const aqui=path.dirname(fileURLToPath(import.meta.url));
/* La cabecera se publica en la raíz compartida de todas las revisiones: debe
   coincidir byte a byte con la política ya vigente para no alterarlas. */
const csp="default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; worker-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'";
export const componentesHeroe=Object.freeze(['campana-personaje.js']);
export const entornoHeroe=Object.freeze(['heroe.css','heroe-host.js','heroe.js','memoria.js']);
export function derivarHeroe(){
  const datos=datosDesdeMotor(leer('motor.js'));
  const lideres=Object.fromEntries(Object.entries(datos.LEADERS).map(([id,lider])=>[id,{n:lider.n}]));
  if(!lideres.talesin?.n||!lideres.gero?.n)throw Error('Cambió el catálogo de Protagonistas que usa el creador.');
  const datosJS='/* Fixture mínimo derivado del catálogo real; no carga mazos ni cartas. */\nwindow.CAOZ_HEROE_CLAVE="caoz.seccion.heroe";\nwindow.CAOZ_HEROE_LIDERES='+JSON.stringify(lideres).replace(/</g,'\\u003c')+';\n';
  return {datosJS,lideres:Object.keys(lideres),motor:hash(leer('motor.js'))};
}
export function exportar(destino){
  destino=path.resolve(destino);
  if(fs.existsSync(destino)&&(!fs.statSync(destino).isDirectory()||fs.readdirSync(destino).length))throw Error('El destino debe estar vacío; no se sobrescribe otro sitio.');
  const escribir=(nombre,contenido)=>{const ruta=path.join(destino,nombre);fs.mkdirSync(path.dirname(ruta),{recursive:true});fs.writeFileSync(ruta,contenido);};
  const derivado=derivarHeroe(),plantilla=fs.readFileSync(path.join(aqui,'heroe.html'),'utf8'),html=plantilla.replaceAll('__CSP__',csp).replaceAll('__GENERADO__','./generado');
  escribir('index.html',html);escribir('generado/datos.js',derivado.datosJS);
  const entorno={};for(const f of entornoHeroe){const b=fs.readFileSync(path.join(aqui,f));escribir(f,b);entorno[f]=hash(b);}
  const componentes={};for(const f of componentesHeroe){const b=fs.readFileSync(path.join(juego,f));escribir('juego/'+f,b);componentes[f]=hash(b);}
  const procedencia={seccion:'heroe',almacenamiento:'memoria temporal',partida:false,ia:false,online:false,progresoReal:false,
    proposito:'Revisar el creador real de héroe: identidad, silueta, rostro, atuendo, equipo y giro manual.',componentes,entorno,
    fixture:{lideres:derivado.lideres,fuenteMotor:derivado.motor},derivados:{plantillaHeroe:hash(plantilla),'index.html':hash(html),'generado/datos.js':hash(derivado.datosJS)}};
  escribir('procedencia.json',JSON.stringify(procedencia,null,2));
  escribir('_headers','/*\n  Cache-Control: no-store\n  X-Content-Type-Options: nosniff\n  Content-Security-Policy: '+csp+'\n');
  return procedencia;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  if(!process.argv[2])throw Error('Indica una carpeta de salida nueva.');
  const p=exportar(process.argv[2]);console.log('Exportado el creador real de héroe con '+Object.keys(p.componentes).length+' componente y memoria temporal. Sin partida, IA, online ni progreso real.');
}
