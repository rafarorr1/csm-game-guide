/* Exporta la revisión de La cosecha en 3D: el modelo real de la prueba I del
   Editor y su pintor nuevo (pitagoras-cosecha-3d.js), con el arte dorado. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {datosDesdeMotor,leer,juego,hash} from './fuentes.mjs';
const aqui=path.dirname(fileURLToPath(import.meta.url));
export const csp="default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; worker-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'";
export const componentesCosecha3d=Object.freeze(['pitagoras-pruebas.js','pitagoras-mundos.js','pitagoras-cine.js','pitagoras-pixel.js','pitagoras-cosecha-3d.js']);
// Los módulos resuelven su arte relativo a sí mismos (juego/art/…).
export const recursosCosecha3d=Object.freeze(['art/esbirro-editor-v219.webp','art/editorcosecha-dorado-v1.webp']);
export function derivarCosecha3d(){
  const datos=datosDesdeMotor(leer('motor.js')),c=datos.CARDS.editorcosecha;
  if(!c||c.editorJuego!=='isometrico')throw Error('La cosecha ya no es la Pesadilla isométrica del Editor.');
  for(const r of recursosCosecha3d)if(!fs.existsSync(path.join(juego,r)))throw Error('Falta el recurso de La cosecha: '+r);
  const datosJS='/* La Pesadilla de La cosecha; sin partida. */\nconst CARDS='+JSON.stringify({editorcosecha:c}).replace(/</g,'\\u003c')+';\n';
  new vm.Script(datosJS,{filename:'cosecha-3d-datos.js'});
  return {datosJS};
}
export const pagina=generado=>fs.readFileSync(path.join(aqui,'cosecha-3d.html'),'utf8').replaceAll('__CSP__',csp).replaceAll('__GENERADO__',generado);
export function exportar(destino){
  destino=path.resolve(destino);
  if(fs.existsSync(destino)&&(!fs.statSync(destino).isDirectory()||fs.readdirSync(destino).length))throw Error('El destino debe estar vacío; no se sobrescribe otro sitio.');
  const escribir=(f,c)=>{const p=path.join(destino,f);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,c);};
  const {datosJS}=derivarCosecha3d(),html=pagina('./generado');
  escribir('index.html',html);escribir('generado/datos.js',datosJS);
  const entorno={};for(const f of ['cosecha-3d-mesa.js','cosecha-3d-mesa.css']){const b=fs.readFileSync(path.join(aqui,f));escribir(f,b);entorno[f]=hash(b);}
  const componentes={};for(const f of componentesCosecha3d){const b=fs.readFileSync(path.join(juego,f));escribir('juego/'+f,b);componentes[f]=hash(b);}
  const arte={};for(const r of recursosCosecha3d){const b=fs.readFileSync(path.join(juego,r));escribir('juego/'+r,b);arte[r.slice(4)]=hash(b);}
  const procedencia={seccion:'cosecha-3d',partida:false,almacenamiento:'ninguno',proposito:'La prueba I del Editor (La cosecha) con su modelo real, dibujada en 3D con el mundo de la carta dorada.',
    componentes,arte,entorno,derivados:{'index.html':hash(html),'generado/datos.js':hash(datosJS)}};
  escribir('procedencia.json',JSON.stringify(procedencia,null,2));
  escribir('_headers','/*\n  Cache-Control: no-store\n  X-Content-Type-Options: nosniff\n  Content-Security-Policy: '+csp+'\n');
  return procedencia;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  if(!process.argv[2])throw Error('Indica una carpeta de salida nueva.');
  exportar(process.argv[2]);console.log('Exportada la revisión de La cosecha en 3D.');
}
