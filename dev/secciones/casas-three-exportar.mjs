/* Exporta la muestra de las casas de Tomsage (casas-three.html): el módulo de
   casas (casas-three.js) y three.js empaquetado (visor-three-vendor.js, sin
   CDN). Incluye las tejas aportadas por el usuario y texturas de madera procedurales. */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {hash} from './fuentes.mjs';
const aqui=path.dirname(fileURLToPath(import.meta.url));
export const csp="default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; worker-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'";
export const texturasCasas=Object.freeze(['texturas-casas/tejas-color.webp','texturas-casas/tejas-normal.webp','texturas-casas/tejas-superficie.webp']);
export const entornoCasasThree=Object.freeze(['casas-three.js','casas-three-mesa.js','casas-three-mesa.css','visor-three-vendor.js',...texturasCasas]);
export const pagina=()=>fs.readFileSync(path.join(aqui,'casas-three.html'),'utf8').replaceAll('__CSP__',csp);
export function exportar(destino){
  destino=path.resolve(destino);
  if(fs.existsSync(destino)&&(!fs.statSync(destino).isDirectory()||fs.readdirSync(destino).length))throw Error('El destino debe estar vacío; no se sobrescribe otro sitio.');
  const escribir=(f,c)=>{const p=path.join(destino,f);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,c);};
  const html=pagina();escribir('index.html',html);
  const entorno={};for(const f of entornoCasasThree){const b=fs.readFileSync(path.join(aqui,f));escribir(f,b);entorno[f]=hash(b);}
  const procedencia={seccion:'casas-three',partida:false,almacenamiento:'ninguno',proposito:'Prueba de arte: las casas de Tomsage para el ARPG en three.js, con interior mapping en las ventanas y texturas procedurales, fundidas en pocas llamadas de dibujo.',three:'0.186.1',entorno,derivados:{'index.html':hash(html)}};
  escribir('procedencia.json',JSON.stringify(procedencia,null,2));
  escribir('_headers','/*\n  Cache-Control: no-store\n  X-Content-Type-Options: nosniff\n  Content-Security-Policy: '+csp+'\n');
  return procedencia;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  if(!process.argv[2])throw Error('Indica una carpeta de salida nueva.');
  exportar(process.argv[2]);console.log('Exportadas las casas de Tomsage.');
}
