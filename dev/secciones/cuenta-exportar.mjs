/* Exporta la cuenta aislada: interfaz real y servicio de prueba en memoria. */
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const aqui=path.dirname(fileURLToPath(import.meta.url));
const juego=path.resolve(aqui,'../../caoz_tcg');
const hash=b=>createHash('sha256').update(b).digest('hex');
// Mismos bytes que las otras secciones: el publicador conserva una CSP común.
const csp="default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; worker-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'";
export const componentesCuenta=Object.freeze(['cuenta-modelo.js','cuenta-ui.js','cuenta.css']);
export const entornoCuenta=Object.freeze(['cuenta-lab.css','cuenta-lab.js','cuenta-demo.js']);
export const imagenesCuenta=Object.freeze(['logo.webp']);
export function exportar(destino){
  destino=path.resolve(destino);
  if(fs.existsSync(destino)&&(!fs.lstatSync(destino).isDirectory()||fs.readdirSync(destino).length))throw Error('El destino debe estar vacío; no se sobrescribe otro sitio.');
  const leer=(raiz,f)=>{
    const archivo=path.join(raiz,f);
    if(!fs.lstatSync(archivo).isFile())throw Error('La fuente debe ser un archivo normal: '+f);
    return fs.readFileSync(archivo);
  };
  const fuenteHTML=leer(aqui,'cuenta.html'),html=fuenteHTML.toString().replaceAll('__CSP__',csp);
  const paquete=new Map([['index.html',html]]),componentes={},entorno={},arte={};
  for(const f of componentesCuenta){const b=leer(juego,f);paquete.set('juego/'+f,b);componentes[f]=hash(b);}
  for(const f of entornoCuenta){const b=leer(aqui,f);paquete.set(f,b);entorno[f]=hash(b);}
  for(const f of imagenesCuenta){const b=leer(path.join(juego,'art'),f);paquete.set('art/'+f,b);arte[f]=hash(b);}
  const procedencia={seccion:'cuenta',almacenamiento:'memoria temporal',partida:false,progresoReal:false,correoReal:false,
    componentes,entorno,arte,fuentes:{'cuenta.html':hash(fuenteHTML)},derivados:{'index.html':hash(html)}};
  paquete.set('procedencia.json',JSON.stringify(procedencia,null,2));
  paquete.set('_headers','/*\n  Cache-Control: no-store\n  X-Content-Type-Options: nosniff\n  Content-Security-Policy: '+csp+'\n');
  // Se leen todas las fuentes antes de escribir: una dependencia ausente no deja un sitio parcial.
  for(const [f,b] of paquete){const ruta=path.join(destino,f);fs.mkdirSync(path.dirname(ruta),{recursive:true});fs.writeFileSync(ruta,b);}
  return procedencia;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  if(!process.argv[2])throw Error('Indica una carpeta de salida nueva.');
  exportar(process.argv[2]);console.log('Exportada la cuenta aislada con servicio temporal. Sin partida, correos ni progreso reales.');
}
