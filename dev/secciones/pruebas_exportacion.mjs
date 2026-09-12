/* Comprueba el paquete alojable y el flujo de revisión fuera de localhost. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import {exportar} from './exportar.mjs';
import {generar,leer,hash} from './fuentes.mjs';
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'caoz-seccion-export-'));
try{
  const destino=path.join(temp,'vista');const r=exportar(destino);
  for(const f of ['index.html','movil.html','escritorio.html','art/tal.webp','api/arte/catalogo'])assert.ok(fs.statSync(path.join(destino,f)).isFile(),f);
  for(const f of ['motor.js','final.js','sw.js','_worker.js','estudio.html','audio'])assert.ok(!fs.existsSync(path.join(destino,f)),f);
  for(const [f,h] of Object.entries(r.componentes))assert.equal(hash(fs.readFileSync(path.join(destino,'juego',f))),h);
  assert.throws(()=>exportar(destino),/vacío/);
  for(const vista of ['desktop','movil']){
    const html=fs.readFileSync(path.join(destino,vista==='movil'?'movil.html':'escritorio.html'),'utf8');
    assert.ok(html.includes('data-vista="'+vista+'"'));assert.ok(html.includes('data-exportada="1"'));
    for(const m of html.matchAll(/(?:src|href)="\.\/([^"?]+)(?:[^\"]*)"/g))assert.ok(fs.existsSync(path.join(destino,m[1])),m[1]);
  }
  console.log('✓ Paquete real, ambas vistas, rutas completas y sin archivos del juego entero.');
  const peticiones=[];
  const red={location:{href:'https://revision.example/movil.html'},URL,fetch:(url,opciones)=>{peticiones.push({url,opciones});return Promise.resolve();}};red.window=red;
  vm.runInNewContext(fs.readFileSync(new URL('./red-estatica.js',import.meta.url),'utf8'),red);
  await red.fetch('https://revision.example/api/arte/catalogo',{credentials:'omit'});
  await red.fetch('https://revision.example/art/encuadres.json',{credentials:'omit'});
  await red.fetch('https://otro.example/art/encuadres.json',{credentials:'omit'});
  assert.equal(peticiones[0].url,'https://revision.example/catalogo-vacio.json');
  assert.equal(peticiones[0].opciones.credentials,'same-origin');assert.equal(peticiones[1].opciones.credentials,'same-origin');
  assert.equal(peticiones[2].opciones.credentials,'omit');
  console.log('✓ La lectura privada sólo adapta el catálogo y los encuadres del mismo origen.');
  let reemplazo;
  for(const [movil,vista,archivo] of [[true,'','movil.html'],[false,'','escritorio.html'],[true,'desktop','escritorio.html']]){
    vm.runInNewContext(fs.readFileSync(path.join(destino,'abrir.js'),'utf8'),{URL,URLSearchParams,matchMedia:()=>({matches:movil}),location:{search:'?vista='+vista,href:'https://revision.example/',replace:u=>{reemplazo=u;}}});
    assert.equal(new URL(reemplazo).pathname,'/'+archivo);
  }
  console.log('✓ El enlace elige móvil/escritorio y respeta la selección explícita.');
  let listo,submit,aperturas=0;
  const form={elements:{vista:{value:''},estado:{value:''}},addEventListener:(_,f)=>{submit=f;}};
  const estado={},abrir={};
  const contexto=vm.createContext({console,URL,URLSearchParams,TextEncoder,TextDecoder,Map,Math,Date,CustomEvent:class{},dispatchEvent(){},addEventListener:(_,f)=>{listo=f;},location:{hostname:'revision.example',pathname:'/movil.html',href:'https://revision.example/movil.html',search:'?estado=sobres'},document:{readyState:'loading',body:{dataset:{vista:'movil',exportada:'1'},append(){}},createElement:()=>({}),getElementById:id=>id==='devEscenarios'?form:id==='devAbrir'?abrir:estado},abrirColeccion:()=>{aperturas++;},cargarArte:()=>Promise.resolve()});
  vm.runInContext('window=globalThis',contexto);
  vm.runInContext(fs.readFileSync(new URL('./memoria.js',import.meta.url),'utf8'),contexto);
  vm.runInContext(generar('movil').datosJS,contexto);
  vm.runInContext(leer('coleccion-modelo.js'),contexto);
  assert.equal(contexto.CAOZ_COLECCION.betaDisponible(),false);
  vm.runInContext(fs.readFileSync(new URL('./coleccion-dev.js',import.meta.url),'utf8'),contexto);
  listo();await new Promise(resolve=>setImmediate(resolve));
  assert.equal(contexto.CAOZ_COLECCION.sobres(),2);assert.equal(aperturas,1);
  const sobre=contexto.CAOZ_COLECCION.abrirSobre();assert.equal(sobre.cartas.length,5);assert.ok(sobre.cartas.every(c=>c.acabado==='foil'));
  form.elements.vista.value='desktop';submit({preventDefault(){}});
  assert.equal(new URL(contexto.location.href).pathname,'/escritorio.html');
  console.log('✓ En un dominio remoto hay dos sobres, cinco Foil y cambio de presentación, con memoria temporal.');
}finally{fs.rmSync(temp,{recursive:true,force:true});}
