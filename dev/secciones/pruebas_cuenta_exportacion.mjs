/* Contrato del paquete aislado: sólo cuenta, dependencias locales y fuentes intactas. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {exportar,componentesCuenta,entornoCuenta,imagenesCuenta} from './cuenta-exportar.mjs';
import {crearServidor} from './servidor.mjs';
const aqui=path.dirname(fileURLToPath(import.meta.url)),juego=path.resolve(aqui,'../../caoz_tcg');
const hash=b=>createHash('sha256').update(b).digest('hex');
const temporal=fs.mkdtempSync(path.join(os.tmpdir(),'caoz-cuenta-'));
const fuentes=[path.join(aqui,'cuenta.html'),...entornoCuenta.map(f=>path.join(aqui,f)),
  ...componentesCuenta.map(f=>path.join(juego,f)),...imagenesCuenta.map(f=>path.join(juego,'art',f)),
  ...['index.html','movil.html','motor.js','final.js','final-core.js','sw.js','coleccion-modelo.js'].map(f=>path.join(juego,f))];
const firmas=()=>Object.fromEntries(fuentes.map(f=>[f,hash(fs.readFileSync(f))]));
const antes=firmas();let servidor;
try{
  const destino=path.join(temporal,'cuenta'),p=exportar(destino),archivo=f=>fs.readFileSync(path.join(destino,f));
  const esperados=['index.html','_headers','procedencia.json','art/logo.webp','cuenta-lab.css','cuenta-lab.js','cuenta-demo.js',
    'juego/cuenta.css','juego/cuenta-modelo.js','juego/cuenta-ui.js'].sort();
  const archivos=fs.readdirSync(destino,{recursive:true}).filter(f=>fs.statSync(path.join(destino,f)).isFile()).sort();
  assert.deepEqual(archivos,esperados,'La cuenta sólo incluye diez archivos declarados; no copia motor, SW ni otras secciones');
  const html=archivo('index.html').toString();
  assert.ok(!/__CSP__|<iframe|<base\b/i.test(html),'Sin marcadores pendientes ni documentos externos');
  function local(valor,desde){
    if(valor.startsWith('#')||valor.startsWith('data:'))return;
    assert.ok(!/^(?:[a-z]+:|\/)/i.test(valor),'Recurso local relativo: '+valor);
    const f=path.resolve(destino,path.dirname(desde),valor.split(/[?#]/)[0]);
    assert.ok(f.startsWith(destino+path.sep)&&fs.existsSync(f),'Dependencia incluida: '+desde+' → '+valor);
  }
  for(const m of html.matchAll(/(?:src|href)=["']([^"']+)["']/g))local(m[1],'index.html');
  for(const m of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi))assert.equal(m[1].trim(),'','Sin scripts inline');
  for(const f of archivos.filter(f=>f.endsWith('.css'))){
    const css=archivo(f).toString();assert.ok(!/@import/i.test(css),'Sin hojas externas: '+f);
    for(const m of css.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g))local(m[1].trim(),f);
  }
  for(const f of archivos.filter(f=>f.endsWith('.js'))){
    const js=archivo(f).toString();new vm.Script(js,{filename:f});
    assert.ok(!/\b(?:fetch|XMLHttpRequest|WebSocket|EventSource)\s*\(|\b(?:localStorage|sessionStorage)\s*[.\[]|\bindexedDB\s*\.|\bserviceWorker\s*\.|\bsendBeacon\s*\(|\bdocument\s*\.\s*cookie\b/.test(js),f+' no usa red, cookies ni almacenamiento persistente');
  }
  assert.equal(p.seccion,'cuenta');assert.equal(p.almacenamiento,'memoria temporal');
  for(const clave of ['partida','progresoReal','correoReal'])assert.equal(p[clave],false,clave);
  for(const [f,firma] of Object.entries(p.componentes)){assert.equal(hash(archivo('juego/'+f)),firma);assert.equal(hash(fs.readFileSync(path.join(juego,f))),firma);}
  for(const [f,firma] of Object.entries(p.entorno)){assert.equal(hash(archivo(f)),firma);assert.equal(hash(fs.readFileSync(path.join(aqui,f))),firma);}
  for(const [f,firma] of Object.entries(p.arte)){assert.equal(hash(archivo('art/'+f)),firma);assert.equal(hash(fs.readFileSync(path.join(juego,'art',f))),firma);}
  for(const [f,firma] of Object.entries(p.fuentes))assert.equal(hash(fs.readFileSync(path.join(aqui,f))),firma);
  for(const [f,firma] of Object.entries(p.derivados))assert.equal(hash(archivo(f)),firma);
  const meta=html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/i);assert.ok(meta,'CSP en la entrada estática');
  // Se comparan las constantes existentes sin exportar/ejecutar otra sección ni su motor.
  for(const f of ['exportar.mjs','rey-exportar.mjs','sobres-exportar.mjs','servidor.mjs']){
    const fuente=fs.readFileSync(path.join(aqui,f),'utf8'),csp=fuente.match(/const csp="([^"]+)";/);
    assert.ok(csp,'CSP existente: '+f);assert.equal(meta[1],csp[1],f+' conserva la política compartida');
    assert.equal(archivo('_headers').toString(),'/*\n  Cache-Control: no-store\n  X-Content-Type-Options: nosniff\n  Content-Security-Policy: '+csp[1]+'\n');
  }
  assert.throws(()=>exportar(destino),/vacío/,'No sobrescribir un sitio existente');
  const otro=path.join(temporal,'otro');exportar(otro);
  for(const f of archivos)assert.deepEqual(archivo(f),fs.readFileSync(path.join(otro,f)),'Exportación determinista: '+f);
  const ocupado=path.join(temporal,'ocupado');fs.writeFileSync(ocupado,'conservar');assert.throws(()=>exportar(ocupado),/vacío/);assert.equal(fs.readFileSync(ocupado,'utf8'),'conservar');
  assert.deepEqual(firmas(),antes,'La exportación no cambia sus fuentes ni el juego');
  console.log('✓ Paquete exacto de diez archivos locales, hashes de procedencia, CSP común, fuentes intactas y salida determinista.');

  servidor=crearServidor();await new Promise((resolver,rechazar)=>{servidor.once('error',rechazar);servidor.listen(0,'127.0.0.1',resolver);});
  const base='http://127.0.0.1:'+servidor.address().port+'/dev/secciones/';
  const entrada=await fetch(base+'cuenta.html');assert.equal(entrada.status,200);assert.equal(await entrada.text(),html);assert.equal(entrada.headers.get('content-security-policy'),meta[1]);
  for(const f of esperados.filter(f=>f.endsWith('.js')||f.endsWith('.css')||f.endsWith('.webp'))){const r=await fetch(base+f);assert.equal(r.status,200,f);assert.deepEqual(Buffer.from(await r.arrayBuffer()),archivo(f),f);}
  for(const f of ['motor.js','juego/motor.js','sw.js','api/cuenta/sesion','api/cuenta/codigo'])assert.equal((await fetch(base+f)).status,404,'Sin rutas de juego o cuenta real: '+f);
  assert.equal((await fetch(base+'cuenta.html',{method:'POST'})).status,405,'Servidor de lectura, sin operaciones de cuenta');
  assert.equal((await fetch(base+'coleccion.html')).status,200,'La entrada anterior sigue disponible');
  assert.deepEqual(await (await fetch(base+'api/arte/catalogo')).json(),{cartas:[]},'El catálogo temporal anterior no cambia');
  console.log('✓ Servidor local sirve los mismos bytes y conserva las otras rutas, sin API real ni escritura.');
}finally{
  if(servidor){servidor.closeAllConnections();await new Promise(r=>servidor.close(r));}
  fs.rmSync(temporal,{recursive:true,force:true});
}
