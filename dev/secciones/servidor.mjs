/* Servidor local de secciones: lectura solamente, sin despliegues ni proxy. */
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {fileURLToPath} from 'node:url';
import {generar,juego,vistas} from './fuentes.mjs';
const carpeta=path.dirname(fileURLToPath(import.meta.url));
const prefijo='/dev/secciones/';
const publicos=new Set(['coleccion.html','memoria.js','coleccion-dev.js','aislado.css']);
const componentes=new Set(['arte-vistas.js','coleccion-modelo.js','arte-remoto.js','coleccion-ui.js','sobres-escena.js','sobres-apertura.js','sobres-apertura.css','coleccion.css','acabados.css']);
const mime={'.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.html':'text/html; charset=utf-8','.json':'application/json; charset=utf-8','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.svg':'image/svg+xml','.ico':'image/x-icon'};
const csp="default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; worker-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'";
function enviar(res,estado,cuerpo,tipo){res.writeHead(estado,{'Content-Type':tipo,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':csp});res.end(cuerpo);}
function archivo(res,nombre,raiz){
  const ruta=path.resolve(raiz,nombre),real=fs.realpathSync(ruta),base=fs.realpathSync(raiz)+path.sep;
  if(!real.startsWith(base)||!fs.statSync(real).isFile())return enviar(res,404,'No disponible','text/plain');
  enviar(res,200,fs.readFileSync(real),mime[path.extname(real)]||'application/octet-stream');
}
export function crearServidor(){return http.createServer((req,res)=>{
  try{
    if(!['GET','HEAD'].includes(req.method))return enviar(res,405,'Este entorno sólo permite lecturas.','text/plain; charset=utf-8');
    const url=new URL(req.url,'http://127.0.0.1');
    if(url.pathname==='/'){res.writeHead(302,{Location:prefijo+'coleccion.html?estado=sobres'});return res.end();}
    if(!url.pathname.startsWith(prefijo))return enviar(res,404,'No disponible','text/plain');
    const recurso=decodeURIComponent(url.pathname.slice(prefijo.length)),vista=Object.hasOwn(vistas,url.searchParams.get('vista'))?url.searchParams.get('vista'):'desktop';
    if(recurso==='coleccion.html')return enviar(res,200,fs.readFileSync(path.join(carpeta,recurso),'utf8').replaceAll('__VISTA__',vista),mime['.html']);
    if(recurso==='generado/datos.js')return enviar(res,200,generar(vista).datosJS,mime['.js']);
    if(recurso==='generado/renderer.js')return enviar(res,200,generar(vista).renderJS,mime['.js']);
    if(recurso==='generado/base.css')return enviar(res,200,generar(vista).css,mime['.css']);
    if(recurso==='generado/manifiesto.json')return enviar(res,200,JSON.stringify(generar(vista).metadatos,null,2),mime['.json']);
    if(publicos.has(recurso))return archivo(res,recurso,carpeta);
    if(recurso.startsWith('juego/')&&componentes.has(recurso.slice(6)))return archivo(res,recurso.slice(6),juego);
    if(recurso==='api/arte/catalogo')return enviar(res,200,JSON.stringify({cartas:[]}),mime['.json']);
    if(recurso.startsWith('art/')&&/^[a-zA-Z0-9_./-]+\.(webp|png|jpg|jpeg|svg|json)$/i.test(recurso)&&!recurso.includes('..'))return archivo(res,recurso.slice(4),path.join(juego,'art'));
    return enviar(res,404,'Recurso ajeno a esta sección.','text/plain; charset=utf-8');
  }catch(e){const ausente=['ENOENT','ENOTDIR'].includes(e.code);enviar(res,ausente?404:500,ausente?'No disponible':'La sección no se pudo generar: '+e.message,'text/plain; charset=utf-8');}
});}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const i=process.argv.indexOf('--puerto'),puerto=i>=0?Number(process.argv[i+1]):8878;
  if(!Number.isInteger(puerto)||puerto<1024||puerto>65535)throw Error('Usa --puerto con un número entre 1024 y 65535.');
  const servidor=crearServidor();servidor.on('error',e=>{console.error(e.message);process.exitCode=1;});
  servidor.listen(puerto,'127.0.0.1',()=>console.log(`Colección aislada: http://127.0.0.1:${puerto}${prefijo}coleccion.html?estado=sobres\nMóvil: http://127.0.0.1:${puerto}${prefijo}coleccion.html?vista=movil&estado=sobres\nDatos temporales en memoria; Ctrl+C para cerrar.`));
}
