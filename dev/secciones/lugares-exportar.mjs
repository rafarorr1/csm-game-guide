/* Exporta la prueba de los escenarios de los Lugares: cartas pintadas, ilustraciones de los Lugares y el módulo real. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {datosDesdeMotor,leer,juego,hash,extraerDeclaracion} from './fuentes.mjs';
const aqui=path.dirname(fileURLToPath(import.meta.url));
export const csp="default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; worker-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'";
export const cartasLugares=Object.freeze(['rey','bartolomeo','eric','horton','discipulo','tok_petunia','aidman','tomsage','antro','puente','montanas','domo']);
export const componentesLugares=Object.freeze(['carta-pintor.js','carta-diseno.css','campo-lugar.js','fuentes/cinzel.woff2','fuentes/cormorant-garamond.woff2','fuentes/cormorant-garamond-italica.woff2']);
export function derivarLugares(){
  const motor=leer('motor.js'),datos=datosDesdeMotor(motor);
  const cards=Object.fromEntries(cartasLugares.map(id=>{if(!datos.CARDS[id])throw Error('No existe la carta de la prueba: '+id);return [id,datos.CARDS[id]];}));
  const aux=['cap','tribeLine'].map(n=>extraerDeclaracion(motor,n,n==='cap'?'const':'function').texto).join('\n');
  const datosJS='/* Cartas reales; sin partida. */\nconst CARDS='+JSON.stringify(cards).replace(/</g,'\\u003c')+';\nconst SUBNAME='+JSON.stringify(datos.SUBNAME).replace(/</g,'\\u003c')+';\n'+aux+'\n';
  new vm.Script(datosJS,{filename:'lugares-datos.js'});
  return {datosJS};
}
export const pagina=generado=>fs.readFileSync(path.join(aqui,'lugares.html'),'utf8').replaceAll('__CSP__',csp).replaceAll('__GENERADO__',generado);
export function exportar(destino){
  destino=path.resolve(destino);
  if(fs.existsSync(destino)&&(!fs.statSync(destino).isDirectory()||fs.readdirSync(destino).length))throw Error('El destino debe estar vacío; no se sobrescribe otro sitio.');
  const escribir=(f,c)=>{const p=path.join(destino,f);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,c);};
  const {datosJS}=derivarLugares(),html=pagina('./generado');
  escribir('index.html',html);escribir('generado/datos.js',datosJS);
  const entorno={};for(const f of ['lugares.js','lugares.css']){const b=fs.readFileSync(path.join(aqui,f));escribir(f,b);entorno[f]=hash(b);}
  const componentes={};for(const f of componentesLugares){const b=fs.readFileSync(path.join(juego,f));escribir('juego/'+f,b);componentes[f]=hash(b);}
  const arte={};for(const id of cartasLugares){const b=fs.readFileSync(path.join(juego,'art',id+'.webp'));escribir('art/'+id+'.webp',b);arte[id+'.webp']=hash(b);}
  const procedencia={seccion:'lugares',partida:false,almacenamiento:'ninguno',proposito:'Prueba del campo de batalla según el Lugar: cada uno de los cinco Lugares convierte la mesa en su escenario, con portal al cambiar y sus reglas visibles.',
    cartas:cartasLugares,componentes,arte,entorno,derivados:{'index.html':hash(html),'generado/datos.js':hash(datosJS)}};
  escribir('procedencia.json',JSON.stringify(procedencia,null,2));
  escribir('_headers','/*\n  Cache-Control: no-store\n  X-Content-Type-Options: nosniff\n  Content-Security-Policy: '+csp+'\n');
  return procedencia;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  if(!process.argv[2])throw Error('Indica una carpeta de salida nueva.');
  exportar(process.argv[2]);console.log('Exportada la prueba de los escenarios de los Lugares.');
}
