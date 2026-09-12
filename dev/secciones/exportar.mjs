/* Exporta la vista real como archivos estáticos; no incluye una partida ni backend. */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {generar,juego,hash} from './fuentes.mjs';
const aqui=path.dirname(fileURLToPath(import.meta.url));
const componentes=['arte-vistas.js','coleccion-modelo.js','arte-remoto.js','coleccion-ui.js','coleccion.css','acabados.css'];
const csp="default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; worker-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'";
export function exportar(destino){
  destino=path.resolve(destino);
  if(fs.existsSync(destino)&&fs.readdirSync(destino).length)throw Error('El destino debe estar vacío; no se sobrescribe otro sitio.');
  const escribir=(nombre,contenido)=>{const p=path.join(destino,nombre);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,contenido);};
  const copiar=(origen,nombre)=>escribir(nombre,fs.readFileSync(origen));
  const procedencia={seccion:'coleccion',almacenamiento:'memoria temporal',vistas:{},componentes:{},arte:{}};
  for(const vista of ['desktop','movil']){
    const r=generar(vista);
    let html=fs.readFileSync(path.join(aqui,'coleccion.html'),'utf8').replaceAll('__VISTA__',vista);
    html=html.replace('<meta charset="utf-8">','<meta charset="utf-8">\n<meta http-equiv="Content-Security-Policy" content="'+csp+'">');
    html=html.replace('<script src="./memoria.js"></script>','<script src="./memoria.js"></script>\n<script src="./red-estatica.js"></script>');
    html=html.replace('data-vista="'+vista+'"','data-vista="'+vista+'" data-exportada="1"').replace('ENTORNO AISLADO · LOCAL','VISTA DE PRUEBA');
    html=html.replaceAll(/\.\/generado\/([^"?]+)\?vista=(desktop|movil)/g,(_,f)=>'./generado/'+vista+'/'+f);
    escribir(vista==='movil'?'movil.html':'escritorio.html',html);
    for(const [f,cuerpo] of Object.entries({'datos.js':r.datosJS,'renderer.js':r.renderJS,'base.css':r.css,'manifiesto.json':JSON.stringify(r.metadatos,null,2)}))escribir('generado/'+vista+'/'+f,cuerpo);
    procedencia.vistas[vista]=r.metadatos;
  }
  for(const f of ['memoria.js','coleccion-dev.js','aislado.css','red-estatica.js'])copiar(path.join(aqui,f),f);
  for(const f of componentes){const contenido=fs.readFileSync(path.join(juego,f));escribir('juego/'+f,contenido);procedencia.componentes[f]=hash(contenido);}
  // Sólo arte ya público en el juego: imágenes y encuadres. Nunca bases privadas,
  // estudios, archivos de servidor, audio, claves ni el HTML/motor completo.
  for(const f of fs.readdirSync(path.join(juego,'art'))){
    if(!/^[a-zA-Z0-9_-]+\.(webp|png|jpg|jpeg|svg)$/i.test(f)&&f!=='encuadres.json')continue;
    const p=path.join(juego,'art',f);if(!fs.lstatSync(p).isFile())throw Error('Asset no regular: '+f);
    const b=fs.readFileSync(p);escribir('art/'+f,b);procedencia.arte[f]=hash(b);
  }
  escribir('api/arte/catalogo',JSON.stringify({cartas:[]}));
  escribir('catalogo-vacio.json',JSON.stringify({cartas:[]}));
  escribir('index.html','<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="'+csp+'"><title>Colección · Caoz</title><script src="./abrir.js" defer></script><body><p>Abriendo la colección…</p><a href="./movil.html?estado=sobres">Abrir en móvil</a> · <a href="./escritorio.html?estado=sobres">Abrir en escritorio</a></body></html>');
  escribir('abrir.js',`'use strict';const p=new URLSearchParams(location.search);const v=p.get('vista');const movil=v==='movil'||(v!=='desktop'&&matchMedia('(max-width: 760px)').matches);const url=new URL(movil?'movil.html':'escritorio.html',location.href);url.searchParams.set('estado',p.get('estado')||'sobres');location.replace(url.href);\n`);
  escribir('procedencia.json',JSON.stringify(procedencia,null,2));
  escribir('_headers','/*\n  Cache-Control: no-store\n  X-Content-Type-Options: nosniff\n  Content-Security-Policy: '+csp+'\n');
  return procedencia;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  if(!process.argv[2])throw Error('Indica una carpeta de salida nueva.');
  const r=exportar(process.argv[2]);console.log('Exportadas ambas vistas con '+Object.keys(r.arte).length+' assets públicos. Sin juego completo ni progreso real.');
}
