/* Servidor local de secciones: lectura solamente, sin despliegues ni proxy. */
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {fileURLToPath} from 'node:url';
import {generar,juego,vistas} from './fuentes.mjs';
import {generarFondoCuenta} from './cuenta-fondo.mjs';
import {derivarEpilogoGero} from './epilogo-gero-exportar.mjs';
import {derivarPitagoras,recursosPitagoras} from './pitagoras-exportar.mjs';
import {derivarHeroe} from './heroe-exportar.mjs';
import {derivarMulligan} from './mulligan-exportar.mjs';
import {derivarInvitaciones} from './invitaciones-exportar.mjs';
import {derivarNombres} from './estudio-nombres-exportar.mjs';
import {derivarCartas,pagina as paginaCartas} from './cartas-exportar.mjs';
import {derivarFuego,pagina as paginaFuego} from './fuego-exportar.mjs';
const carpeta=path.dirname(fileURLToPath(import.meta.url));
const prefijo='/dev/secciones/';
const publicos=new Set(['coleccion.html','interacciones.html','epilogo-gero.html','pitagoras.html','heroe.html','mulligan.html','invitaciones.html','estudio-nombres.html','memoria.js','red-estatica.js','coleccion-dev.js','aislado.css','interacciones.js','interacciones.css','epilogo-gero.js','epilogo-gero.css','pitagoras.js','pitagoras.css','heroe.css','heroe-host.js','heroe.js','mulligan.js','mulligan.css','invitaciones.js','invitaciones.css','estudio-nombres.js','estudio-nombres.css','cartas.js','cartas.css','fuego.js','fuego.css','cuenta-lab.css','cuenta-lab.js','cuenta-demo.js','cuenta-fondo.css']);
const componentes=new Set(['arte-vistas.js','coleccion-modelo.js','arte-remoto.js','coleccion-ui.js','visor-3d.js','visor-3d-gl.js','visor-3d.css','carta-pintor.js','carta-diseno.js','carta-diseno.css','carta-juego.js','carta-juego.css','fx-aliento.js','fx-ascension.js','fuentes/cinzel.woff2','fuentes/cormorant-garamond.woff2','fuentes/cormorant-garamond-italica.woff2','sobres-escena.js','sobres-apertura.js','sobres-revelacion.js','sobres-apertura.css','coleccion.css','acabados.css','campana-deseo.js','campana-personaje.js','cuenta-modelo.js','cuenta-progreso.js','cuenta-servicio.js','cuenta-acceso.js','cuenta-ui.js','cuenta.css','pitagoras-pruebas.js','pitagoras-mundos.js','pitagoras-cine.js','pitagoras-pixel.js','mulligan-ui.js','mulligan-ui.css','invitaciones-compartidas.js','nombres-cartas.js']);
const recursosPitagorasLocales=new Set(recursosPitagoras);
const mime={'.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.html':'text/html; charset=utf-8','.json':'application/json; charset=utf-8','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.svg':'image/svg+xml','.ico':'image/x-icon','.woff2':'font/woff2'};
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
    if(recurso==='interacciones.html')return enviar(res,200,fs.readFileSync(path.join(carpeta,recurso),'utf8').replaceAll('__CSP__',csp),mime['.html']);
    if(recurso==='epilogo-gero.html')return enviar(res,200,fs.readFileSync(path.join(carpeta,recurso),'utf8').replaceAll('__CSP__',csp).replaceAll('__GENERADO__','./generado/epilogo-gero'),mime['.html']);
    if(recurso==='pitagoras.html')return enviar(res,200,fs.readFileSync(path.join(carpeta,recurso),'utf8').replaceAll('__CSP__',csp).replaceAll('__GENERADO__','./generado/pitagoras'),mime['.html']);
    if(recurso==='heroe.html')return enviar(res,200,fs.readFileSync(path.join(carpeta,recurso),'utf8').replaceAll('__CSP__',csp).replaceAll('__GENERADO__','./generado/heroe'),mime['.html']);
    if(recurso==='mulligan.html')return enviar(res,200,fs.readFileSync(path.join(carpeta,recurso),'utf8').replaceAll('__CSP__',csp).replaceAll('__GENERADO__','./generado/mulligan'),mime['.html']);
    if(recurso==='invitaciones.html')return enviar(res,200,fs.readFileSync(path.join(carpeta,recurso),'utf8').replaceAll('__CSP__',csp).replaceAll('__GENERADO__','./generado/invitaciones'),mime['.html']);
    if(recurso==='estudio-nombres.html')return enviar(res,200,fs.readFileSync(path.join(carpeta,recurso),'utf8').replaceAll('__CSP__',csp).replaceAll('__GENERADO__','./generado/estudio-nombres'),mime['.html']);
    if(recurso==='fuego.html')return enviar(res,200,paginaFuego('./generado/fuego'),mime['.html']);
    if(recurso==='generado/fuego/datos.js')return enviar(res,200,derivarFuego().datosJS,mime['.js']);
    if(recurso==='cartas.html')return enviar(res,200,paginaCartas(vista,'./generado/cartas/'+vista),mime['.html']);
    {const m=/^generado\/cartas\/(desktop|movil)\/(datos\.js|renderer\.js|base\.css)$/.exec(recurso);if(m){const d=derivarCartas(m[1]);return enviar(res,200,m[2]==='datos.js'?d.datosJS:m[2]==='renderer.js'?d.renderJS:d.css,mime[path.extname(m[2])]);}}
    if(recurso==='cuenta.html')return enviar(res,200,fs.readFileSync(path.join(carpeta,recurso),'utf8').replaceAll('__CSP__',csp).replace('__CUENTA_FONDO__',generarFondoCuenta().html),mime['.html']);
    if(recurso==='cuenta-fondo-real.css')return enviar(res,200,generarFondoCuenta().css,mime['.css']);
    if(recurso==='generado/datos.js')return enviar(res,200,generar(vista).datosJS,mime['.js']);
    if(recurso==='generado/renderer.js')return enviar(res,200,generar(vista).renderJS,mime['.js']);
    if(recurso==='generado/base.css')return enviar(res,200,generar(vista).css,mime['.css']);
    if(recurso==='generado/manifiesto.json')return enviar(res,200,JSON.stringify(generar(vista).metadatos,null,2),mime['.json']);
    if(recurso==='generado/epilogo-gero/datos.js')return enviar(res,200,derivarEpilogoGero().datosJS,mime['.js']);
    if(recurso==='generado/epilogo-gero/renderer.js')return enviar(res,200,derivarEpilogoGero().renderJS,mime['.js']);
    if(recurso==='generado/epilogo-gero/base.css')return enviar(res,200,derivarEpilogoGero().css,mime['.css']);
    if(recurso==='generado/epilogo-gero/manifiesto.json')return enviar(res,200,JSON.stringify(derivarEpilogoGero().metadatos,null,2),mime['.json']);
    if(recurso==='generado/pitagoras/datos.js')return enviar(res,200,derivarPitagoras().datosJS,mime['.js']);
    if(recurso==='generado/pitagoras/manifiesto.json')return enviar(res,200,JSON.stringify(derivarPitagoras().metadatos,null,2),mime['.json']);
    if(recurso==='generado/heroe/datos.js')return enviar(res,200,derivarHeroe().datosJS,mime['.js']);
    if(recurso==='generado/mulligan/datos.js')return enviar(res,200,derivarMulligan().datosJS,mime['.js']);
    if(recurso==='generado/invitaciones/datos.js')return enviar(res,200,derivarInvitaciones().datosJS,mime['.js']);
    if(recurso==='generado/estudio-nombres/datos.js')return enviar(res,200,derivarNombres().datosJS,mime['.js']);
    if(publicos.has(recurso))return archivo(res,recurso,carpeta);
    if(recurso.startsWith('juego/')&&componentes.has(recurso.slice(6)))return archivo(res,recurso.slice(6),juego);
    if(recurso.startsWith('juego/art/')&&recursosPitagorasLocales.has(recurso.slice(6)))return archivo(res,recurso.slice(6),juego);
    if(recurso==='api/arte/catalogo'||recurso==='catalogo-vacio.json')return enviar(res,200,JSON.stringify({cartas:[]}),mime['.json']);
    if(recurso.startsWith('art/')&&/^[a-zA-Z0-9_./-]+\.(webp|png|jpg|jpeg|svg|json)$/i.test(recurso)&&!recurso.includes('..'))return archivo(res,recurso.slice(4),path.join(juego,'art'));
    return enviar(res,404,'Recurso ajeno a esta sección.','text/plain; charset=utf-8');
  }catch(e){const ausente=['ENOENT','ENOTDIR'].includes(e.code);enviar(res,ausente?404:500,ausente?'No disponible':'La sección no se pudo generar: '+e.message,'text/plain; charset=utf-8');}
});}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const i=process.argv.indexOf('--puerto'),puerto=i>=0?Number(process.argv[i+1]):8878;
  if(!Number.isInteger(puerto)||puerto<1024||puerto>65535)throw Error('Usa --puerto con un número entre 1024 y 65535.');
  const servidor=crearServidor();servidor.on('error',e=>{console.error(e.message);process.exitCode=1;});
  servidor.listen(puerto,'127.0.0.1',()=>console.log(`Colección aislada: http://127.0.0.1:${puerto}${prefijo}coleccion.html?estado=sobres\nEpílogo de Gero: http://127.0.0.1:${puerto}${prefijo}epilogo-gero.html\nPitágoras: http://127.0.0.1:${puerto}${prefijo}pitagoras.html\nCreador de héroe: http://127.0.0.1:${puerto}${prefijo}heroe.html\nMulligan inicial: http://127.0.0.1:${puerto}${prefijo}mulligan.html\nInvitaciones de sala: http://127.0.0.1:${puerto}${prefijo}invitaciones.html\nEstudio de nombres: http://127.0.0.1:${puerto}${prefijo}estudio-nombres.html\nCartas de la partida: http://127.0.0.1:${puerto}${prefijo}cartas.html\nAliento de fuego: http://127.0.0.1:${puerto}${prefijo}fuego.html\nDatos temporales en memoria; Ctrl+C para cerrar.`));
}
