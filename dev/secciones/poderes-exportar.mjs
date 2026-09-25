/* Exporta la prueba de animaciones de poderes: cartas pintadas y el efecto real. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {datosDesdeMotor,leer,juego,hash,extraerDeclaracion} from './fuentes.mjs';
const aqui=path.dirname(fileURLToPath(import.meta.url));
export const csp="default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; worker-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'";
export const cartasPoderes=Object.freeze(['rey','bartolomeo','eric','horton','discipulo','tok_petunia','llavemago','pergamino','tok_dragon']);
export const componentesPoderes=Object.freeze(['carta-pintor.js','carta-diseno.css','fx-poderes.js','fuentes/cinzel.woff2','fuentes/cormorant-garamond.woff2','fuentes/cormorant-garamond-italica.woff2']);
export function derivarPoderes(){
  const motor=leer('motor.js'),datos=datosDesdeMotor(motor);
  const cards=Object.fromEntries(cartasPoderes.map(id=>{if(!datos.CARDS[id])throw Error('No existe la carta de la prueba: '+id);return [id,datos.CARDS[id]];}));
  const aux=['cap','tribeLine'].map(n=>extraerDeclaracion(motor,n,n==='cap'?'const':'function').texto).join('\n');
  const datosJS='/* Cartas reales; sin partida. */\nconst CARDS='+JSON.stringify(cards).replace(/</g,'\\u003c')+';\nconst SUBNAME='+JSON.stringify(datos.SUBNAME).replace(/</g,'\\u003c')+';\n'+aux+'\n';
  new vm.Script(datosJS,{filename:'poderes-datos.js'});
  return {datosJS};
}
export const pagina=generado=>fs.readFileSync(path.join(aqui,'poderes.html'),'utf8').replaceAll('__CSP__',csp).replaceAll('__GENERADO__',generado);
export function exportar(destino){
  destino=path.resolve(destino);
  if(fs.existsSync(destino)&&(!fs.statSync(destino).isDirectory()||fs.readdirSync(destino).length))throw Error('El destino debe estar vacío; no se sobrescribe otro sitio.');
  const escribir=(f,c)=>{const p=path.join(destino,f);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,c);};
  const {datosJS}=derivarPoderes(),html=pagina('./generado');
  escribir('index.html',html);escribir('generado/datos.js',datosJS);
  const entorno={};for(const f of ['poderes.js','poderes.css']){const b=fs.readFileSync(path.join(aqui,f));escribir(f,b);entorno[f]=hash(b);}
  const componentes={};for(const f of componentesPoderes){const b=fs.readFileSync(path.join(juego,f));escribir('juego/'+f,b);componentes[f]=hash(b);}
  const arte={};for(const id of cartasPoderes){const b=fs.readFileSync(path.join(juego,'art',id+'.webp'));escribir('art/'+id+'.webp',b);arte[id+'.webp']=hash(b);}
  const procedencia={seccion:'poderes',partida:false,almacenamiento:'ninguno',proposito:'Pruebas de animación de poderes y estados: Esporas e Infectado, Polimorfia de Rulchete, Rayo de Escarcha y Collar de Agua, Poseído, Ascensión de Talesyn, Aturdido y Risa de Tasha, Llaves del Domo y Pergamino de Deseo.',
    cartas:cartasPoderes,componentes,arte,entorno,derivados:{'index.html':hash(html),'generado/datos.js':hash(datosJS)}};
  escribir('procedencia.json',JSON.stringify(procedencia,null,2));
  escribir('_headers','/*\n  Cache-Control: no-store\n  X-Content-Type-Options: nosniff\n  Content-Security-Policy: '+csp+'\n');
  return procedencia;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  if(!process.argv[2])throw Error('Indica una carpeta de salida nueva.');
  exportar(process.argv[2]);console.log('Exportada la prueba de animaciones de poderes.');
}
