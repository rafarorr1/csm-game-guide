/* Red real y Service Worker real, sin WebGL: versiones, reanudación y aislamiento. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {exportar,csp} from './arpg-three-exportar.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
const salida=fs.mkdtempSync(path.join(os.tmpdir(),'arpg-cache-'));
const procedencia=exportar(path.join(salida,'arpg-three')),manifiestoReal=JSON.parse(fs.readFileSync(path.join(salida,'arpg-three/arpg-recursos.json')));
assert.equal(manifiestoReal.version,sha(JSON.stringify(manifiestoReal.recursos)));
for(const r of manifiestoReal.recursos){const b=fs.readFileSync(path.join(salida,'arpg-three',r.url));assert.equal(sha(b),r.sha256);assert.equal(b.length,r.bytes);}
assert(!manifiestoReal.recursos.some(r=>r.url==='index.html'||r.url==='arpg-recursos.json'),'Catálogo sin ciclo de hashes');
assert.equal(procedencia.derivados['arpg-recursos.json'],sha(fs.readFileSync(path.join(salida,'arpg-three/arpg-recursos.json'))));
console.log('✓ Exportación: hashes, tamaños, versión determinista y recursos completos.');
const worker=fs.readFileSync(new URL('./arpg-three-cache-sw.js',import.meta.url)),cliente=fs.readFileSync(new URL('./arpg-three-cache.js',import.meta.url));
let version=1,fallo=null;const solicitudes=[];
function catalogo(){const archivos={'a.txt':'Sin cambios','b.txt':'Versión '+version},recursos=Object.entries(archivos).map(([url,b])=>({url,sha256:sha(b),bytes:Buffer.byteLength(b)}));return {archivos,manifiesto:{version:sha(JSON.stringify(recursos)),recursos}};}
const servidor=http.createServer((req,res)=>{
  const u=new URL(req.url,'http://localhost'),ruta=u.pathname;solicitudes.push(ruta+u.search);
  const {archivos,manifiesto}=catalogo();let cuerpo,tipo='text/javascript';
  if(ruta==='/arpg-three/'||ruta==='/arpg-three/sin-sw.html'){
    tipo='text/html';cuerpo=`<!doctype html><meta name="arpg-recursos" content="${manifiesto.version}"><script src="./arpg-three-cache.js" defer></script><script src="./inicio.js" defer></script><p>Prueba caché</p>`;
  }else if(ruta==='/arpg-three/arpg-three-cache-sw.js')cuerpo=worker;
  else if(ruta==='/arpg-three/arpg-three-cache.js')cuerpo=cliente;
  else if(ruta==='/arpg-three/inicio.js')cuerpo='window.terminado=false;window.fallo=null;CAOZ_ARPG_CACHE.preparar().then(x=>{window.resultado=x;window.terminado=true;},e=>{window.fallo=e.message;window.terminado=true;});';
  else if(ruta==='/arpg-three/arpg-recursos.json'){cuerpo=JSON.stringify(manifiesto);tipo='application/json';}
  else if(Object.hasOwn(archivos,ruta.slice('/arpg-three/'.length))&&ruta.startsWith('/arpg-three/')){
    cuerpo=archivos[ruta.slice('/arpg-three/'.length)];tipo='text/plain';
    if(fallo==='red'&&ruta.endsWith('b.txt')){res.writeHead(503);res.end('Interrumpido');return;}
    if(fallo==='hash'&&ruta.endsWith('b.txt'))cuerpo='Archivo equivocado';
  }else if(ruta==='/otra-app/a.txt'){cuerpo='Fuera del ARPG';tipo='text/plain';}
  else{res.writeHead(404);res.end('No existe');return;}
  res.writeHead(200,{'Content-Type':tipo,'Cache-Control':'no-store','Content-Security-Policy':csp});res.end(cuerpo);
});
await new Promise(ok=>servidor.listen(0,'127.0.0.1',ok));
const origen='http://127.0.0.1:'+servidor.address().port,base=origen+'/arpg-three/';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
let navegador;
async function abrir(p){await p.goto(base);await p.waitForFunction(()=>window.terminado,{},{timeout:30000});return p.evaluate(()=>({resultado:window.resultado,fallo:window.fallo}));}
const leer=(p,url)=>p.evaluate(async u=>{const r=await fetch(u);return {estado:r.status,texto:await r.text()};},url);
const peticionesAssets=()=>solicitudes.filter(x=>/\/[ab]\.txt/.test(x));
try{
  navegador=await chromium.launch({headless:true,...(process.env.CHROME_CHANNEL?{channel:process.env.CHROME_CHANNEL}:{})});
  const ctx=await navegador.newContext(),a=await ctx.newPage();let r=await abrir(a);
  assert.equal(r.fallo,null);assert.equal(r.resultado.descargados,2);assert.equal(r.resultado.modo,'lista');
  assert.equal((await leer(a,'./b.txt')).texto,'Versión 1');
  solicitudes.length=0;r=await abrir(a);assert.equal(r.resultado.reutilizados,2);assert.equal(peticionesAssets().length,0);
  await ctx.setOffline(true);assert.equal((await leer(a,'./b.txt')).texto,'Versión 1');await ctx.setOffline(false);
  console.log('✓ Primera visita completa; segunda sin descargar assets; recursos disponibles sin red.');
  version=2;const b=await ctx.newPage();solicitudes.length=0;r=await abrir(b);
  assert.equal(r.resultado.reutilizados,1);assert.equal(r.resultado.descargados,1);assert.equal(peticionesAssets().length,1);
  assert.equal((await leer(a,'./b.txt')).texto,'Versión 1');assert.equal((await leer(b,'./b.txt')).texto,'Versión 2');
  // Reiniciar el trabajador comprueba que las sesiones no dependan de variables globales.
  const cdp=await ctx.newCDPSession(b);await cdp.send('ServiceWorker.enable');await cdp.send('ServiceWorker.stopAllWorkers');
  assert.equal((await leer(a,'./b.txt')).texto,'Versión 1');assert.equal((await leer(b,'./b.txt')).texto,'Versión 2');
  assert.equal((await leer(a,'/otra-app/a.txt')).texto,'Fuera del ARPG');
  console.log('✓ Actualización de un archivo; pestaña anterior y nueva coherentes tras reiniciar SW; scope aislado.');
  await a.evaluate(async()=>{for(const nombre of await caches.keys())if(nombre.endsWith('-archivos-v1')){const c=await caches.open(nombre);for(const r of await c.keys())if(r.url.includes('/b.txt?v='))await c.delete(r);}});
  assert.equal((await leer(a,'./b.txt')).estado,503,'La versión antigua faltante no se reemplaza por bytes nuevos');
  assert.equal((await leer(a,'./b.txt?v='+sha('Versión 1'))).estado,503,'El parámetro de versión se verifica incluso si el servidor lo ignora');
  assert.equal((await leer(b,'./b.txt')).texto,'Versión 2');
  // Volver a instalar la versión A para el caso de actualización interrumpida.
  version=1;await leer(a,'./b.txt');version=2;
  version=3;fallo='red';const c=await ctx.newPage();r=await abrir(c);assert(r.fallo);assert.equal((await leer(a,'./b.txt')).texto,'Versión 1');
  fallo='hash';r=await abrir(c);assert.match(r.fallo,/actualizando|incompleto/);
  fallo=null;solicitudes.length=0;r=await abrir(c);assert.equal(r.resultado.modo,'lista');assert.equal(r.resultado.descargados,1);
  console.log('✓ Descarga interrumpida y hash incorrecto no pasan por éxito; reintento reutiliza archivos completos.');
  await a.evaluate(async()=>{for(const n of await caches.keys())if(n.startsWith('caoz-arpg-'))await caches.delete(n);});
  await cdp.send('ServiceWorker.stopAllWorkers');
  assert.equal((await leer(a,'./b.txt')).estado,503,'Tras perder metadatos la pestaña recupera su catálogo antiguo, nunca bytes nuevos');
  assert.equal((await leer(c,'./b.txt')).texto,'Versión 3');
  console.log('✓ Expulsión total de caché y reinicio del trabajador: la pestaña recupera su catálogo, sin mezclar versiones.');
  const privado=await navegador.newContext({serviceWorkers:'block'}),p=await privado.newPage();
  await p.addInitScript(()=>{Object.defineProperty(navigator,'serviceWorker',{value:undefined});});
  // Simular ausencia de la API como en navegadores sin soporte, no una red fallida.
  await p.addInitScript(()=>{delete Navigator.prototype.serviceWorker;});
  r=await abrir(p);assert.equal(r.resultado?.modo,'sin-cache');assert.equal(r.fallo,null);await privado.close();
  const cuota=await navegador.newContext(),q=await cuota.newPage();
  await q.addInitScript(()=>{Cache.prototype.put=()=>Promise.reject(new DOMException('Sin espacio','QuotaExceededError'));});
  r=await abrir(q);assert.equal(r.resultado.modo,'sin-cache');assert.equal(r.fallo,null);await cuota.close();
  console.log('✓ Sin Service Worker o almacenamiento disponible: arranque normal, sin bloqueo.');
  await ctx.close();
}finally{await navegador?.close();await new Promise(ok=>servidor.close(ok));fs.rmSync(salida,{recursive:true,force:true});}
