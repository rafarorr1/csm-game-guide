/* Exporta el animatic del teaser de 20 s: los módulos reales del juego
   (visor 3D, tormenta, invocar, aliento, poderes, ascensión y cortinilla)
   coreografiados en una sola línea de tiempo, con El Mago del Domo y Thal
   dorados de protagonistas. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {datosDesdeMotor,leer,juego,hash,extraerDeclaracion} from './fuentes.mjs';
const aqui=path.dirname(fileURLToPath(import.meta.url));
export const csp="default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; worker-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'";
// Las cartas de los planos (carta/edición) y las doce de la cortinilla final.
export const cartasTeaser=Object.freeze([
  ['magodomo','dorado'],['tal','dorado'],['rey','normal'],['escarcha','dorado'],['eric','normal'],['discipulo','dorado'],['tok_dragon','dorado'],['petunia','dorado'],['tok_petunia','dorado'],
  ['rulchete','dorado'],['tasha','dorado'],['magodomo','foil'],['tal','foil'],['escarcha','foil']]);
export const muroTeaser=Object.freeze([['magodomo','dorado'],['tal','dorado'],['petunia','dorado'],['escarcha','dorado'],['rulchete','dorado'],['tok_dragon','dorado'],
  ['tasha','dorado'],['tok_petunia','dorado'],['magodomo','foil'],['tal','foil'],['discipulo','dorado'],['escarcha','foil']]);
// Los fondos del montaje: la ilustración de un Lugar, desenfocada.
export const fondosTeaser=Object.freeze(['montanas','puente','antro','domo']);
export const componentesTeaser=Object.freeze(['carta-pintor.js','carta-diseno.css','visor-3d-gl.js','tormenta-gl.js','fx-invocar.js','fx-aliento.js','fx-poderes.js','fx-ascension.js','cortinilla.js',
  'fuentes/cinzel.woff2','fuentes/cormorant-garamond.woff2','fuentes/cormorant-garamond-italica.woff2']);
function ilustracion(encuadres,id,acabado){
  const e=encuadres[id],v=acabado!=='normal'?e?.variantes?.[acabado]:null;
  const url=v?.url||'art/'+id+'.webp',base=v||e||{};
  if(!fs.existsSync(path.join(juego,url)))throw Error('Falta la ilustración del teaser: '+url);
  return {id,acabado,url,enc:{x:base.x??50,y:base.y??50,z:base.z??100}};
}
export function derivarTeaser(){
  const motor=leer('motor.js'),datos=datosDesdeMotor(motor),encuadres=JSON.parse(leer('art/encuadres.json'));
  const lista=cartasTeaser.map(([id,a])=>ilustracion(encuadres,id,a));
  for(const [id,a]of muroTeaser)if(!lista.some(c=>c.id===id&&c.acabado===a))throw Error('La cortinilla del teaser usa una carta sin preparar: '+id+'/'+a);
  const fondos=fondosTeaser.map(id=>{const url='art/'+id+'.webp';if(!fs.existsSync(path.join(juego,url)))throw Error('Falta el fondo del teaser: '+url);return {id,url};});
  const ids=[...new Set(lista.map(c=>c.id))];
  const cards=Object.fromEntries(ids.map(id=>{if(!datos.CARDS[id])throw Error('No existe la carta del teaser: '+id);return [id,datos.CARDS[id]];}));
  const aux=['cap','tribeLine'].map(n=>extraerDeclaracion(motor,n,n==='cap'?'const':'function').texto).join('\n');
  const datosJS='/* Cartas reales del teaser; sin partida. */\nconst CARDS='+JSON.stringify(cards).replace(/</g,'\\u003c')+';\nconst SUBNAME='+JSON.stringify(datos.SUBNAME).replace(/</g,'\\u003c')+';\n'+aux
    +'\nwindow.TEASER_DATOS='+JSON.stringify({cartas:lista,muro:muroTeaser,fondos})+';\n';
  new vm.Script(datosJS,{filename:'teaser-datos.js'});
  return {datosJS,lista,fondos};
}
export const pagina=generado=>fs.readFileSync(path.join(aqui,'teaser.html'),'utf8').replaceAll('__CSP__',csp).replaceAll('__GENERADO__',generado);
export function exportar(destino){
  destino=path.resolve(destino);
  if(fs.existsSync(destino)&&(!fs.statSync(destino).isDirectory()||fs.readdirSync(destino).length))throw Error('El destino debe estar vacío; no se sobrescribe otro sitio.');
  const escribir=(f,c)=>{const p=path.join(destino,f);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,c);};
  const {datosJS,lista,fondos}=derivarTeaser(),html=pagina('./generado');
  escribir('index.html',html);escribir('generado/datos.js',datosJS);
  const entorno={};for(const f of ['teaser-reloj.js','teaser-mesa.js','teaser-mesa.css']){const b=fs.readFileSync(path.join(aqui,f));escribir(f,b);entorno[f]=hash(b);}
  const componentes={};for(const f of componentesTeaser){const b=fs.readFileSync(path.join(juego,f));escribir('juego/'+f,b);componentes[f]=hash(b);}
  const arte={};for(const url of [...new Set(['art/logo.webp',...lista.map(c=>c.url),...fondos.map(f=>f.url)])]){const b=fs.readFileSync(path.join(juego,url));escribir(url,b);arte[url.slice(4)]=hash(b);}
  const procedencia={seccion:'teaser',partida:false,almacenamiento:'ninguno',proposito:'Animatic del teaser de 20 s para el pitch: El Mago del Domo en la tormenta, la invocación y el aliento de Thal, un montaje de poderes, la cortinilla con la colección y el logo.',
    cartas:lista.map(c=>c.id+'/'+c.acabado),componentes,arte,entorno,derivados:{'index.html':hash(html),'generado/datos.js':hash(datosJS)}};
  escribir('procedencia.json',JSON.stringify(procedencia,null,2));
  escribir('_headers','/*\n  Cache-Control: no-store\n  X-Content-Type-Options: nosniff\n  Content-Security-Policy: '+csp+'\n');
  return procedencia;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  if(!process.argv[2])throw Error('Indica una carpeta de salida nueva.');
  exportar(process.argv[2]);console.log('Exportado el animatic del teaser.');
}
