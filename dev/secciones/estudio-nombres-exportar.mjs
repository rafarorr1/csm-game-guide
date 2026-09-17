/* Exporta una revisión de títulos sin montar el juego ni consultar servicios. */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {datosDesdeMotor,juego,leer,hash} from './fuentes.mjs';

const aqui=path.dirname(fileURLToPath(import.meta.url));
/* Debe conservar la misma cabecera común que las revisiones ya publicadas. */
const csp="default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; worker-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'";
export const cartasEstudioNombres=Object.freeze(['augusto','machete','destello','discipulo','pergamino']);
export const componenteNombres='nombres-cartas.js';

export function derivarNombres(){
  const datos=datosDesdeMotor(leer('motor.js'));
  const cartas=cartasEstudioNombres.map(id=>{
    const c=datos.CARDS[id];if(!c)throw Error('No existe la carta de la revisión: '+id);
    return {id,n:c.n,t:c.t,c:c.c,a:c.a??null,h:c.h??null,r:c.r??0,art:c.art||'✦'};
  });
  const datosJS='/* Muestra mínima derivada del catálogo; no inicia motor ni partida. */\nwindow.CAOZ_ESTUDIO_NOMBRES_DATOS='+JSON.stringify({cartas}).replace(/</g,'\\u003c')+';\n';
  return {cartas,datosJS,motor:hash(leer('motor.js'))};
}

export function exportar(destino){
  destino=path.resolve(destino);
  if(fs.existsSync(destino)&&(!fs.statSync(destino).isDirectory()||fs.readdirSync(destino).length))throw Error('El destino debe estar vacío; no se sobrescribe otro sitio.');
  const escribir=(nombre,contenido)=>{const ruta=path.join(destino,nombre);fs.mkdirSync(path.dirname(ruta),{recursive:true});fs.writeFileSync(ruta,contenido);};
  const componente=fs.readFileSync(path.join(juego,componenteNombres));
  if(!componente.includes('CAOZ_NOMBRES_CARTAS')||!componente.includes('validar'))throw Error('Cambió el contrato compartido de nombres de cartas.');
  const derivado=derivarNombres(),plantilla=fs.readFileSync(path.join(aqui,'estudio-nombres.html'),'utf8');
  const html=plantilla.replaceAll('__CSP__',csp).replaceAll('__GENERADO__','./generado');
  escribir('index.html',html);escribir('generado/datos.js',derivado.datosJS);escribir('juego/'+componenteNombres,componente);
  const entorno={};
  for(const archivo of ['estudio-nombres.css','estudio-nombres.js']){const contenido=fs.readFileSync(path.join(aqui,archivo));escribir(archivo,contenido);entorno[archivo]=hash(contenido);}
  const procedencia={seccion:'estudio-nombres',almacenamiento:'memoria temporal',partida:false,ia:false,online:false,red:false,progresoReal:false,
    proposito:'Revisar cinco títulos reales del catálogo con el validador compartido, sin publicar ni alterar los nombres canónicos.',
    componente:{archivo:'caoz_tcg/'+componenteNombres,sha256:hash(componente)},entorno,
    fixture:{cartas:derivado.cartas.map(c=>c.id),fuenteMotor:derivado.motor},derivados:{plantilla:hash(plantilla),'index.html':hash(html),'generado/datos.js':hash(derivado.datosJS)}};
  escribir('procedencia.json',JSON.stringify(procedencia,null,2));
  escribir('_headers','/*\n  Cache-Control: no-store\n  X-Content-Type-Options: nosniff\n  Content-Security-Policy: '+csp+'\n');
  return procedencia;
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  if(!process.argv[2])throw Error('Indica una carpeta de salida nueva.');
  const p=exportar(process.argv[2]);console.log('Exportado el estudio de nombres con '+p.fixture.cartas.length+' cartas reales y borradores temporales. Sin red, partida ni progreso.');
}
