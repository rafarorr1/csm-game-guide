/* Exporta la revisión de las pruebas de Pitágoras en 3D: el modelo real de
   cada prueba del Editor y su pintor nuevo (pitagoras-mundo-3d.js y un
   módulo por prueba), con el arte dorado de su carta. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {datosDesdeMotor,leer,juego,hash} from './fuentes.mjs';
const aqui=path.dirname(fileURLToPath(import.meta.url));
export const csp="default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; worker-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'";
// Prueba → carta del Editor cuyo arte dorado la rodea.
export const pruebasPesadillas3d=Object.freeze({isometrico:'editorcosecha',laseres:'editorcorte',fps:'editorcuadro',carrera:'editorcarrera',orbital:'editororbita'});
export const componentesPesadillas3d=Object.freeze(['pitagoras-pruebas.js','pitagoras-mundos.js','pitagoras-cine.js','pitagoras-pixel.js','pitagoras-fps.js','pitagoras-dragon.js','pitagoras-mundo-3d.js','pitagoras-cosecha-3d.js','pitagoras-corte-3d.js','pitagoras-cuadro-3d.js','pitagoras-puente-3d.js','pitagoras-dragon-3d.js']);
// Los módulos resuelven su arte relativo a sí mismos (juego/art/…).
// El último asalto (hueco V) pinta al Dragón Celestial Morado de la edición dorada.
export const recursosPesadillas3d=Object.freeze(['art/esbirro-editor-v219.webp','art/tok_dragon-dorado-v1.webp',...Object.values(pruebasPesadillas3d).map(id=>'art/'+id+'-dorado-v1.webp')]);
export function derivarPesadillas3d(){
  const datos=datosDesdeMotor(leer('motor.js')),cards={};
  for(const [tipo,id] of Object.entries(pruebasPesadillas3d)){const c=datos.CARDS[id];if(!c||c.editorJuego!==tipo)throw Error(id+' ya no es la Pesadilla de '+tipo+'.');cards[id]=c;}
  for(const r of recursosPesadillas3d)if(!fs.existsSync(path.join(juego,r)))throw Error('Falta el recurso de las pruebas en 3D: '+r);
  const datosJS='/* Las Pesadillas del Editor en 3D; sin partida. */\nconst CARDS='+JSON.stringify(cards).replace(/</g,'\\u003c')+';\n';
  new vm.Script(datosJS,{filename:'pesadillas-3d-datos.js'});
  return {datosJS};
}
export const pagina=generado=>fs.readFileSync(path.join(aqui,'pesadillas-3d.html'),'utf8').replaceAll('__CSP__',csp).replaceAll('__GENERADO__',generado);
export function exportar(destino){
  destino=path.resolve(destino);
  if(fs.existsSync(destino)&&(!fs.statSync(destino).isDirectory()||fs.readdirSync(destino).length))throw Error('El destino debe estar vacío; no se sobrescribe otro sitio.');
  const escribir=(f,c)=>{const p=path.join(destino,f);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,c);};
  const {datosJS}=derivarPesadillas3d(),html=pagina('./generado');
  escribir('index.html',html);escribir('generado/datos.js',datosJS);
  const entorno={};for(const f of ['pesadillas-3d-mesa.js','pesadillas-3d-mesa.css']){const b=fs.readFileSync(path.join(aqui,f));escribir(f,b);entorno[f]=hash(b);}
  const componentes={};for(const f of componentesPesadillas3d){const b=fs.readFileSync(path.join(juego,f));escribir('juego/'+f,b);componentes[f]=hash(b);}
  const arte={};for(const r of recursosPesadillas3d){const b=fs.readFileSync(path.join(juego,r));escribir('juego/'+r,b);arte[r.slice(4)]=hash(b);}
  const procedencia={seccion:'pesadillas-3d',partida:false,almacenamiento:'ninguno',proposito:'Las pruebas del Editor (Pitágoras) con su modelo real, dibujadas en 3D con el mundo de su carta dorada.',
    pruebas:Object.keys(pruebasPesadillas3d),componentes,arte,entorno,derivados:{'index.html':hash(html),'generado/datos.js':hash(datosJS)}};
  escribir('procedencia.json',JSON.stringify(procedencia,null,2));
  escribir('_headers','/*\n  Cache-Control: no-store\n  X-Content-Type-Options: nosniff\n  Content-Security-Policy: '+csp+'\n');
  return procedencia;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  if(!process.argv[2])throw Error('Indica una carpeta de salida nueva.');
  exportar(process.argv[2]);console.log('Exportada la revisión de las pruebas de Pitágoras en 3D.');
}
