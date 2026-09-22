/* Exporta el portal real con un transporte efímero: no publica ni llama al Worker. */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {juego,hash} from './fuentes.mjs';

const aqui=path.dirname(fileURLToPath(import.meta.url));
// La revisión comparte el archivo raíz de cabeceras con las demás secciones.
// Sus bytes deben conservar la política vigente para no alterar sus previews.
const csp="default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; worker-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'";
export const componentesPortal=Object.freeze(['portal.html','portal.css','portal.js']);

export function exportar(destino){
  destino=path.resolve(destino);
  if(fs.existsSync(destino)&&(!fs.statSync(destino).isDirectory()||fs.readdirSync(destino).length))throw Error('El destino debe estar vacío; no se sobrescribe otro sitio.');
  const escribir=(nombre,contenido)=>{const ruta=path.join(destino,nombre);fs.mkdirSync(path.dirname(ruta),{recursive:true});fs.writeFileSync(ruta,contenido);};
  const fuente={};for(const archivo of componentesPortal)fuente[archivo]=fs.readFileSync(path.join(juego,archivo));
  const html=fuente['portal.html'].toString()
    .replace('<!-- __PORTAL_CSP__ -->','<meta http-equiv="Content-Security-Policy" content="'+csp+'">')
    .replace('<link rel="icon" type="image/png" href="art/icono-192.png">','<link rel="icon" href="data:,">')
    .replace('<!-- __PORTAL_PREVIEW__ -->','<script src="portal-preview.js"></script>');
  if(/__PORTAL_CSP__|__PORTAL_PREVIEW__/.test(html))throw Error('La plantilla del portal conserva un marcador sin resolver.');
  escribir('index.html',html);escribir('portal.css',fuente['portal.css']);escribir('portal.js',fuente['portal.js']);
  const preview=fs.readFileSync(path.join(aqui,'portal-preview.js'));escribir('portal-preview.js',preview);
  const procedencia={seccion:'portal',almacenamiento:'memoria temporal',partida:false,ia:false,online:false,progresoReal:false,
    proposito:'Revisar la puerta de acceso y las cinco rutas del portal sin abrir el juego, Beta, estudios ni servicios reales.',
    componentes:Object.fromEntries(componentesPortal.map(f=>[f,{archivo:'caoz_tcg/'+f,sha256:hash(fuente[f])}])),
    entorno:{'portal-preview.js':hash(preview)},rutas:['Producción','Beta','Estudio de Cartas','Estudio de Sonidos','Juego Físico']};
  escribir('procedencia.json',JSON.stringify(procedencia,null,2));
  escribir('_headers','/*\n  Cache-Control: no-store\n  X-Content-Type-Options: nosniff\n  Content-Security-Policy: '+csp+'\n');
  return procedencia;
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  if(!process.argv[2])throw Error('Indica una carpeta de salida nueva.');
  const p=exportar(process.argv[2]);console.log('Exportado el portal aislado con '+p.rutas.length+' rutas y acceso sólo en memoria.');
}
