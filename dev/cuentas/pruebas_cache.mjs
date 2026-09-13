/* Ejecuta ambos SW en un entorno controlado. Ninguna respuesta privada debe
   llegar a CacheStorage, incluso mientras la PWA conserva todavía la build254. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {webcrypto} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const raiz=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const actual=fs.readFileSync(path.join(raiz,'caoz_tcg/sw.js'),'utf8');
let anterior=execFileSync('git',['show','origin/develop:caoz_tcg/sw.js'],{cwd:raiz,encoding:'utf8'});
if(!/const VERSION\s*=\s*254\s*;/.test(anterior))anterior=execFileSync('git',['show','build-254:caoz_tcg/sw.js'],{cwd:raiz,encoding:'utf8'});
function worker(codigo){
 const escuchas={},acciones=[];
 const c=vm.createContext({URL,Request,Response,AbortController,setTimeout,clearTimeout,
  fetch:async()=>new Response('{}',{headers:{'Content-Type':'application/json'}}),
  caches:{open:async()=>({match:async()=>null,put:async()=>acciones.push('guardar'),addAll:async()=>{}})},
  self:{registration:{scope:'https://juego.caozcontodo.com/'},location:{origin:'https://juego.caozcontodo.com'},addEventListener:(n,fn)=>escuchas[n]=fn}
 });
 vm.runInContext(codigo+'\nglobalThis.__nucleo=NUCLEO;',c);
 return {nucleo:Array.from(c.__nucleo),async pedir(ruta,metodo='GET'){
  let capturada=false;const pendientes=[];
  escuchas.fetch({request:new Request(new URL(ruta,'https://juego.caozcontodo.com/'),{method:metodo}),respondWith(p){capturada=true;pendientes.push(p);}});
  await Promise.all(pendientes);return {capturada,guardadas:acciones.length};
 }};
}
const nuevo=worker(actual),viejo=worker(anterior);
for(const ruta of ['sesion','codigo','verificar','progreso','salir'])for(const metodo of ['GET','POST']){
 const r=await nuevo.pedir('/api/cuenta/'+ruta,metodo);
 assert.equal(r.capturada,false,metodo+' '+ruta+' evita el SW nuevo');assert.equal(r.guardadas,0);
 const legado=await viejo.pedir('/api/cuenta/'+ruta+'?test=cuenta',metodo);
 assert.equal(legado.capturada,false,metodo+' '+ruta+' evita también la PWA254');assert.equal(legado.guardadas,0);
}
console.log('✓ GET y POST de cuentas evitan CacheStorage en el SW nuevo y en la PWA254');
for(const archivo of ['cuenta-modelo.js','cuenta-progreso.js','cuenta-servicio.js','cuenta-ui.js','cuenta-acceso.js','cuenta-juego.js','cuenta.css','cuenta-juego.css'])assert(nuevo.nucleo.includes(archivo),archivo+' queda disponible sin red');
for(const archivo of ['cuenta-servidor.js','cuenta-correo.js','cuenta-demo.js'])assert(!nuevo.nucleo.includes(archivo),archivo+' nunca se precarga en el navegador');
console.log('✓ La PWA precarga sólo los componentes del cliente');
// Sabotaje: retirar la exclusión vuelve observable la filtración de la API.
const modificado=actual.replace(/^.*if\(\/\\\/api\\\/cuenta.*\n/m,'');
assert.notEqual(modificado,actual,'Se retiró exactamente la guarda privada');
const roto=await worker(modificado).pedir('/api/cuenta/sesion');
assert(roto.capturada&&roto.guardadas>0,'La prueba detecta la regresión al retirar la guarda');
const legadoSinProteccion=await worker(anterior).pedir('/api/cuenta/sesion');
assert(legadoSinProteccion.capturada&&legadoSinProteccion.guardadas>0,'El caso254 demuestra por qué hace falta el bypass del cliente');
console.log('✓ Sabotaje detectado: sin exclusión se guarda la respuesta de sesión');
const datos=new Map(),urls=[];
const contexto=vm.createContext({URL,Date,crypto:webcrypto,AbortController,setTimeout,clearTimeout,setInterval,clearInterval,
 location:{hostname:'juego.caozcontodo.com',pathname:'/',search:''},
 localStorage:{getItem:k=>datos.get(k)??null,setItem:(k,v)=>datos.set(k,String(v)),removeItem:k=>datos.delete(k)},
 fetch:async u=>{urls.push(u);return new Response(JSON.stringify({sesion:null,progreso:null,revision:0}),{headers:{'Content-Type':'application/json'}});}
});
for(const archivo of ['cuenta-progreso.js','cuenta-servicio.js'])vm.runInContext(fs.readFileSync(path.join(raiz,'caoz_tcg',archivo),'utf8'),contexto);
await vm.runInContext('CAOZ_CUENTA_SERVICIO.crear({progreso:CAOZ_CUENTA_PROGRESO.crear()}).sesion()',contexto);
assert.equal(urls.length,1);assert.equal(new URL(urls[0],'https://juego.caozcontodo.com').searchParams.get('test'),'cuenta');
assert.equal((await worker(anterior).pedir(urls[0])).capturada,false);
console.log('✓ El cliente real incluye el bypass mientras se actualiza la PWA anterior');
