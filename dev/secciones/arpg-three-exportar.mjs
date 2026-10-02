/* Exporta la prueba de ARPG en three.js («Las Grietas del Editor», Hito 1):
   modelos 3D sencillos hechos con primitivas (arpg-three-modelos.js), three.js
   empaquetado en visor-three-vendor.js (sin CDN) y las cartas físicas de
   three-carta.js para el botín (los Objetos del juego en sus tres ediciones). */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {datosDesdeMotor,leer,juego,hash,extraerDeclaracion} from './fuentes.mjs';
const aqui=path.dirname(fileURLToPath(import.meta.url));
export const csp="default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; worker-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'";
// El botín: Objetos de equipo en sus tres ediciones y la Llave del Mago (sólo dorada, la suelta Can).
export const botinArpgThree=Object.freeze(['mazo','arco','collar','espadaluz','espadaboveda','lentesmachete','sombrero','brazosagua']);
export const cartasArpgThree=Object.freeze([...botinArpgThree.flatMap(id=>['normal','foil','dorado'].map(ed=>[id,ed])),['llavemago','dorado']]);
export const componentesArpgThree=Object.freeze(['carta-pintor.js','carta-diseno.css','fuentes/cinzel.woff2','fuentes/cormorant-garamond.woff2','fuentes/cormorant-garamond-italica.woff2']);
export const texturasGoblin=Object.freeze(['texturas-goblin/piel-color.webp','texturas-goblin/piel-normal.png','texturas-goblin/piel-superficie.png']);
export const entornoArpgThree=Object.freeze(['arpg-three-tiempo.js','arpg-three-mesa.js','arpg-three-mesa.css','arpg-three-adreida-animacion.js','arpg-three-modelos.js','casas-three.js','visor-three-vendor.js','three-carta.js',...texturasGoblin]);
function ilustraciones(){
  const encuadres=JSON.parse(leer('art/encuadres.json'));
  return cartasArpgThree.map(([id,acabado])=>{
    const e=encuadres[id],v=acabado!=='normal'?e?.variantes?.[acabado]:null;
    const url=v?.url||(acabado==='normal'?'art/'+id+'.webp':'art/'+id+'-'+acabado+'-v1.webp'),base=v||e||{};
    if(!fs.existsSync(path.join(juego,url)))throw Error('Falta la ilustración del botín: '+url);
    return {id,acabado,url,enc:{x:base.x??50,y:base.y??50,z:base.z??100}};
  });
}
export function derivarArpgThree(){
  const motor=leer('motor.js'),datos=datosDesdeMotor(motor),lista=ilustraciones();
  const cards=Object.fromEntries([...new Set(lista.map(c=>c.id))].map(id=>{const c=datos.CARDS[id];if(!c)throw Error('No existe la carta del botín: '+id);if(c.t!=='objeto')throw Error('El botín son Objetos: '+id);return [id,c];}));
  const aux=['cap','tribeLine'].map(n=>extraerDeclaracion(motor,n,n==='cap'?'const':'function').texto).join('\n');
  const datosJS='/* Las Grietas del Editor (ARPG en three.js); sin partida. */\nconst CARDS='+JSON.stringify(cards).replace(/</g,'\\u003c')+';\nconst SUBNAME='+JSON.stringify(datos.SUBNAME).replace(/</g,'\\u003c')+';\n'+aux+'\nwindow.ARPG_THREE_ARTE='+JSON.stringify(Object.fromEntries(lista.map(c=>[c.id+'/'+c.acabado,{url:c.url,enc:c.enc}])))+';\n';
  new vm.Script(datosJS,{filename:'arpg-three-datos.js'});
  return {datosJS,lista};
}
export const pagina=generado=>fs.readFileSync(path.join(aqui,'arpg-three.html'),'utf8').replaceAll('__CSP__',csp).replaceAll('__GENERADO__',generado);
export function exportar(destino){
  destino=path.resolve(destino);
  if(fs.existsSync(destino)&&(!fs.statSync(destino).isDirectory()||fs.readdirSync(destino).length))throw Error('El destino debe estar vacío; no se sobrescribe otro sitio.');
  const escribir=(f,c)=>{const p=path.join(destino,f);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,c);};
  const {datosJS,lista}=derivarArpgThree(),html=pagina('./generado');
  escribir('index.html',html);escribir('generado/datos.js',datosJS);
  const entorno={};for(const f of entornoArpgThree){const b=fs.readFileSync(path.join(aqui,f));escribir(f,b);entorno[f]=hash(b);}
  const componentes={};for(const f of componentesArpgThree){const b=fs.readFileSync(path.join(juego,f));escribir('juego/'+f,b);componentes[f]=hash(b);}
  const arte={};for(const url of ['art/logo.webp','art/lider_adreida.webp','art/lider_mohamed.webp',...lista.map(c=>c.url)]){const b=fs.readFileSync(path.join(juego,url));escribir(url,b);arte[url.slice(4)]=hash(b);}
  const procedencia={seccion:'arpg-three',partida:false,almacenamiento:'ninguno',proposito:'Proyecto paralelo: prueba de un ARPG isométrico al estilo Diablo en three.js (Hito 1, una sala jugable) con modelos 3D sencillos hechos con primitivas y el botín como cartas físicas del juego.',three:'0.186.1',
    cartas:lista.map(c=>c.id+'/'+c.acabado),componentes,arte,entorno,derivados:{'index.html':hash(html),'generado/datos.js':hash(datosJS)}};
  escribir('procedencia.json',JSON.stringify(procedencia,null,2));
  escribir('_headers','/*\n  Cache-Control: no-store\n  X-Content-Type-Options: nosniff\n  Content-Security-Policy: '+csp+'\n');
  return procedencia;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  if(!process.argv[2])throw Error('Indica una carpeta de salida nueva.');
  exportar(process.argv[2]);console.log('Exportadas las Grietas del Editor.');
}
