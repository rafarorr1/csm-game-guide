/* Exporta la prueba del visor en WebGPU: El Mago del Domo en sus tres
   ediciones, con visor-3d-gpu.js junto a visor-3d-gl.js. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {datosDesdeMotor,leer,juego,hash,extraerDeclaracion} from './fuentes.mjs';
const aqui=path.dirname(fileURLToPath(import.meta.url));
export const csp="default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; worker-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'";
// El Mago del Domo en sus tres ediciones.
export const cartasVisorGpu=Object.freeze([['magodomo','normal'],['magodomo','foil'],['magodomo','dorado']]);
export const componentesVisorGpu=Object.freeze(['carta-pintor.js','carta-diseno.css','visor-3d-gl.js','visor-3d-gpu.js','tormenta-gl.js','tormenta-gpu.js','fuentes/cinzel.woff2','fuentes/cormorant-garamond.woff2','fuentes/cormorant-garamond-italica.woff2']);
function ilustraciones(){
  const encuadres=JSON.parse(leer('art/encuadres.json'));
  return cartasVisorGpu.map(([id,acabado])=>{
    const e=encuadres[id],v=acabado!=='normal'?e?.variantes?.[acabado]:null;
    const url=v?.url||'art/'+id+'.webp',base=v||e||{};
    if(!fs.existsSync(path.join(juego,url)))throw Error('Falta la ilustración del visor: '+url);
    return {id,acabado,url,enc:{x:base.x??50,y:base.y??50,z:base.z??100}};
  });
}
export function derivarVisorGpu(){
  const motor=leer('motor.js'),datos=datosDesdeMotor(motor),lista=ilustraciones();
  const cards=Object.fromEntries(lista.map(({id})=>{if(!datos.CARDS[id])throw Error('No existe la carta del visor: '+id);return [id,datos.CARDS[id]];}));
  const aux=['cap','tribeLine'].map(n=>extraerDeclaracion(motor,n,n==='cap'?'const':'function').texto).join('\n');
  const datosJS='/* El Mago del Domo; sin partida. */\nconst CARDS='+JSON.stringify(cards).replace(/</g,'\\u003c')+';\nconst SUBNAME='+JSON.stringify(datos.SUBNAME).replace(/</g,'\\u003c')+';\n'+aux+'\nwindow.VISOR_GPU_ARTE='+JSON.stringify(Object.fromEntries(lista.map(c=>[c.acabado,{url:c.url,enc:c.enc}])))+';\n';
  new vm.Script(datosJS,{filename:'visor-gpu-datos.js'});
  return {datosJS,lista};
}
export const pagina=generado=>fs.readFileSync(path.join(aqui,'visor-gpu.html'),'utf8').replaceAll('__CSP__',csp).replaceAll('__GENERADO__',generado);
export function exportar(destino){
  destino=path.resolve(destino);
  if(fs.existsSync(destino)&&(!fs.statSync(destino).isDirectory()||fs.readdirSync(destino).length))throw Error('El destino debe estar vacío; no se sobrescribe otro sitio.');
  const escribir=(f,c)=>{const p=path.join(destino,f);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,c);};
  const {datosJS,lista}=derivarVisorGpu(),html=pagina('./generado');
  escribir('index.html',html);escribir('generado/datos.js',datosJS);
  const entorno={};for(const f of ['visor-gpu-mesa.js','visor-gpu-mesa.css']){const b=fs.readFileSync(path.join(aqui,f));escribir(f,b);entorno[f]=hash(b);}
  const componentes={};for(const f of componentesVisorGpu){const b=fs.readFileSync(path.join(juego,f));escribir('juego/'+f,b);componentes[f]=hash(b);}
  const arte={};for(const url of ['art/logo.webp',...lista.map(c=>c.url)]){const b=fs.readFileSync(path.join(juego,url));escribir(url,b);arte[url.slice(4)]=hash(b);}
  const procedencia={seccion:'visor-gpu',partida:false,almacenamiento:'ninguno',proposito:'Prueba del visor 3D en WebGPU con El Mago del Domo, junto al mismo visor en WebGL para compararlos, en un estudio o en medio de una tormenta.',
    cartas:lista.map(c=>c.id+'/'+c.acabado),componentes,arte,entorno,derivados:{'index.html':hash(html),'generado/datos.js':hash(datosJS)}};
  escribir('procedencia.json',JSON.stringify(procedencia,null,2));
  escribir('_headers','/*\n  Cache-Control: no-store\n  X-Content-Type-Options: nosniff\n  Content-Security-Policy: '+csp+'\n');
  return procedencia;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  if(!process.argv[2])throw Error('Indica una carpeta de salida nueva.');
  exportar(process.argv[2]);console.log('Exportada la prueba del visor en WebGPU.');
}
