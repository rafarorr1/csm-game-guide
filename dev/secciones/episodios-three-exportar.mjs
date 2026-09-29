/* Exporta las batallas de la historia (episodios-three.html), Episodio 1:
   «Emboscada en la Carreta hacia el Domo». Usa los modelos del ARPG
   (arpg-three-modelos.js), su hoja de estilos del HUD, three.js empaquetado
   (visor-three-vendor.js, sin CDN) y los retratos de los líderes del grupo. */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {juego,hash} from './fuentes.mjs';
const aqui=path.dirname(fileURLToPath(import.meta.url));
export const csp="default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; worker-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'";
export const entornoEpisodiosThree=Object.freeze(['episodios-three-mesa.js','episodios-three-mesa.css','arpg-three-mesa.css','arpg-three-modelos.js','visor-three-vendor.js']);
export const componentesEpisodiosThree=Object.freeze(['carta-diseno.css','fuentes/cinzel.woff2','fuentes/cormorant-garamond.woff2','fuentes/cormorant-garamond-italica.woff2']);
export const arteEpisodiosThree=Object.freeze(['lider_adreida','lider_mohamed','lider_fender','lider_talesin','lider_rafaela'].map(id=>'art/'+id+'.webp'));
export const pagina=()=>fs.readFileSync(path.join(aqui,'episodios-three.html'),'utf8').replaceAll('__CSP__',csp);
export function exportar(destino){
  destino=path.resolve(destino);
  if(fs.existsSync(destino)&&(!fs.statSync(destino).isDirectory()||fs.readdirSync(destino).length))throw Error('El destino debe estar vacío; no se sobrescribe otro sitio.');
  const escribir=(f,c)=>{const p=path.join(destino,f);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,c);};
  const html=pagina();escribir('index.html',html);
  const entorno={};for(const f of entornoEpisodiosThree){const b=fs.readFileSync(path.join(aqui,f));escribir(f,b);entorno[f]=hash(b);}
  const componentes={};for(const f of componentesEpisodiosThree){const b=fs.readFileSync(path.join(juego,f));escribir('juego/'+f,b);componentes[f]=hash(b);}
  const arte={};for(const url of arteEpisodiosThree){const b=fs.readFileSync(path.join(juego,url));escribir(url,b);arte[url.slice(4)]=hash(b);}
  const procedencia={seccion:'episodios-three',partida:false,almacenamiento:'ninguno',proposito:'Las batallas de la historia en three.js: el Episodio 1 (Emboscada en la Carreta hacia el Domo) jugable con Adreida, con el resto del grupo siguiendo la historia.',three:'0.186.1',componentes,arte,entorno,derivados:{'index.html':hash(html)}};
  escribir('procedencia.json',JSON.stringify(procedencia,null,2));
  escribir('_headers','/*\n  Cache-Control: no-store\n  X-Content-Type-Options: nosniff\n  Content-Security-Policy: '+csp+'\n');
  return procedencia;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  if(!process.argv[2])throw Error('Indica una carpeta de salida nueva.');
  exportar(process.argv[2]);console.log('Exportado el Episodio 1.');
}
