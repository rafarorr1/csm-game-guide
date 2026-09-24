/* Exporta la revisión de las cartas de la partida con la cara pintada: el
   renderer real de cada pantalla (cardEl, ilustrar…), la ficha ampliada del
   motor (inspectHTML) y los componentes reales del pintor. Sin partida. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {datosDesdeMotor,generar,leer,juego,hash,extraerDeclaracion} from './fuentes.mjs';
const aqui=path.dirname(fileURLToPath(import.meta.url));
export const csp="default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; worker-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'";
export const cartasRevision=Object.freeze(['magodomo','lucius','bolafuego','esporas','espadaluz','domo','tal','aldrick','machete','petunia','bartolomeo','discipulo']);
export const componentesCartas=Object.freeze(['arte-vistas.js','arte-remoto.js','acabados.css','carta-pintor.js','carta-juego.js','carta-juego.css','carta-diseno.css','fuentes/cinzel.woff2','fuentes/cormorant-garamond.woff2','fuentes/cormorant-garamond-italica.woff2']);
export const imagenesCartas=Object.freeze([...cartasRevision.map(id=>id+'.webp'),'logo.webp']);
export const paginasCartas=Object.freeze({desktop:'index.html',movil:'movil.html'});

export function derivarCartas(vista='desktop'){
  const base=generar(vista),datos=datosDesdeMotor(leer('motor.js'));
  const cards=Object.fromEntries(cartasRevision.map(id=>{if(!datos.CARDS[id])throw Error('No existe la carta de la revisión: '+id);return [id,datos.CARDS[id]];}));
  const datosJS='/* Datos reales mínimos; G permanece nulo y no existe partida. */\nconst CARDS='+JSON.stringify(cards).replace(/</g,'\\u003c')+';\nconst LEADERS={};\nconst SUBNAME='+JSON.stringify(datos.SUBNAME).replace(/</g,'\\u003c')+';\nlet ARTE={};const G=null;\n';
  const ficha=extraerDeclaracion(leer('motor.js'),'inspectHTML');
  const renderJS=base.renderJS+'\n// inspectHTML · SHA256 '+ficha.sha256+'\n'+ficha.texto+'\n';
  new vm.Script(datosJS+'\n'+renderJS,{filename:'cartas-renderer.js'});
  return {datosJS,renderJS,css:base.css,metadatos:{...base.metadatos,cartas:cartasRevision,ficha:{nombre:'inspectHTML',archivo:'caoz_tcg/motor.js',sha256:ficha.sha256}}};
}
export function pagina(vista,generado){
  const otra=vista==='desktop'?'movil':'desktop';
  return fs.readFileSync(path.join(aqui,'cartas.html'),'utf8').replaceAll('__CSP__',csp).replaceAll('__VISTA__',vista).replaceAll('__GENERADO__',generado)
    .replaceAll('__OTRA__',generado.startsWith('./generado/cartas/')?'./cartas.html?vista='+otra:'./'+paginasCartas[otra]);
}
export function exportar(destino){
  destino=path.resolve(destino);
  if(fs.existsSync(destino)&&(!fs.statSync(destino).isDirectory()||fs.readdirSync(destino).length))throw Error('El destino debe estar vacío; no se sobrescribe otro sitio.');
  const escribir=(f,c)=>{const p=path.join(destino,f);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,c);};
  const derivados={};
  for(const [vista,archivo]of Object.entries(paginasCartas)){
    const d=derivarCartas(vista),html=pagina(vista,'./generado/'+vista);
    escribir(archivo,html);escribir('generado/'+vista+'/datos.js',d.datosJS);escribir('generado/'+vista+'/renderer.js',d.renderJS);escribir('generado/'+vista+'/base.css',d.css);
    Object.assign(derivados,{[archivo]:hash(html),['generado/'+vista+'/datos.js']:hash(d.datosJS),['generado/'+vista+'/renderer.js']:hash(d.renderJS),['generado/'+vista+'/base.css']:hash(d.css)});
  }
  const entorno={};for(const f of ['cartas.js','cartas.css','memoria.js','red-estatica.js']){const b=fs.readFileSync(path.join(aqui,f));escribir(f,b);entorno[f]=hash(b);}
  const componentes={};for(const f of componentesCartas){const b=fs.readFileSync(path.join(juego,f));escribir('juego/'+f,b);componentes[f]=hash(b);}
  const originales=JSON.parse(leer('art/encuadres.json')),encuadres={},arte={};
  for(const f of imagenesCartas){const b=fs.readFileSync(path.join(juego,'art',f));escribir('art/'+f,b);arte[f]=hash(b);const id=f.slice(0,-5);if(id==='logo')continue;if(!Object.hasOwn(originales,id))throw Error('Falta el encuadre de '+id);encuadres[id]=originales[id];}
  const encuadresJSON=JSON.stringify(encuadres);escribir('art/encuadres.json',encuadresJSON);escribir('catalogo-vacio.json',JSON.stringify({cartas:[]}));
  derivados['art/encuadres.json']=hash(encuadresJSON);
  const procedencia={seccion:'cartas',almacenamiento:'memoria temporal',partida:false,
    proposito:'Revisar las cartas de la partida con la cara pintada de la Colección: mano, mesa con cifras vivas, ediciones, ficha ampliada y dorso.',
    cartas:cartasRevision,componentes,arte,entorno,renderer:{desktop:derivarCartas('desktop').metadatos,movil:derivarCartas('movil').metadatos},derivados};
  escribir('procedencia.json',JSON.stringify(procedencia,null,2));
  escribir('_headers','/*\n  Cache-Control: no-store\n  X-Content-Type-Options: nosniff\n  Content-Security-Policy: '+csp+'\n');
  return procedencia;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  if(!process.argv[2])throw Error('Indica una carpeta de salida nueva.');
  const p=exportar(process.argv[2]);console.log('Exportadas '+p.cartas.length+' cartas de la partida, en escritorio y teléfono. Sin partida ni progreso.');
}
