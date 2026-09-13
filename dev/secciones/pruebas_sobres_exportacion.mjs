/* Procedencia, dependencias y memoria de esta sección; no inicia el juego. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {exportar,cartasSobres,componentesSobres,imagenesSobres} from './sobres-exportar.mjs';
import {exportar as exportarRey} from './rey-exportar.mjs';
import {datosDesdeMotor,generar,leer,juego,hash} from './fuentes.mjs';
const aqui=path.dirname(fileURLToPath(import.meta.url));
const temporal=fs.mkdtempSync(path.join(os.tmpdir(),'caoz-sobres-'));
try{
  const destino=path.join(temporal,'sobres'),p=exportar(destino),archivo=f=>fs.readFileSync(path.join(destino,f));
  const html=archivo('index.html').toString(),datos=archivo('generado/datos.js').toString();
  const esperados=['index.html','_headers','procedencia.json','catalogo-vacio.json','memoria.js','red-estatica.js','sobres.js','sobres.css',
    'generado/datos.js','generado/renderer.js','generado/base.css','art/encuadres.json',
    ...componentesSobres.map(f=>'juego/'+f),...imagenesSobres.map(f=>'art/'+f)].sort();
  const archivos=fs.readdirSync(destino,{recursive:true}).filter(f=>fs.statSync(path.join(destino,f)).isFile()).sort();
  assert.deepEqual(archivos,esperados,'La exportación sólo debe incluir las dependencias declaradas de la apertura');
  for(const m of html.matchAll(/(?:src|href)="\.\/([^"?#]+)(?:[?#][^"]*)?"/g))assert.ok(fs.existsSync(path.join(destino,m[1])),m[1]);
  assert.ok(!/__CSP__|<iframe/i.test(html),'Sin marcadores pendientes ni iframe');
  for(const m of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi))assert.equal(m[1].trim(),'','Sin scripts inline');
  assert.ok(html.indexOf('memoria.js')>=0&&html.indexOf('memoria.js')<html.indexOf('generado/datos.js'),'La memoria temporal debe instalarse primero');
  assert.ok(!/(?:src|href)=["'](?:https?:)?\/\//i.test(html),'La entrada no carga dependencias remotas');
  const contexto=vm.createContext({});new vm.Script(datos).runInContext(contexto);
  const cards=JSON.parse(vm.runInContext('JSON.stringify(CARDS)',contexto)),origen=datosDesdeMotor(leer('motor.js'));
  assert.deepEqual(Object.keys(cards),cartasSobres);
  for(const id of cartasSobres)assert.deepEqual(cards[id],origen.CARDS[id],id+' debe conservar los datos del juego');
  for(const nombre of ['newGame','aiTurn','DECKS','CAOZ_COLECCION'])assert.equal(vm.runInContext('typeof '+nombre,contexto),'undefined',nombre+' no debe acompañar esta sección');
  assert.equal(vm.runInContext('G',contexto),null);
  assert.equal(vm.runInContext('Object.keys(LEADERS).length',contexto),0);
  assert.equal(archivo('generado/renderer.js').toString(),generar('movil').renderJS);
  assert.equal(archivo('generado/base.css').toString(),generar('movil').css);
  for(const [f,firma] of Object.entries(p.componentes)){assert.equal(hash(archivo('juego/'+f)),firma);assert.equal(hash(fs.readFileSync(path.join(juego,f))),firma);}
  for(const [f,firma] of Object.entries(p.entorno)){assert.equal(hash(archivo(f)),firma);assert.equal(hash(fs.readFileSync(path.join(aqui,f))),firma);}
  for(const [f,firma] of Object.entries(p.arte)){assert.equal(hash(archivo('art/'+f)),firma);assert.equal(hash(fs.readFileSync(path.join(juego,'art',f))),firma);}
  for(const [f,firma] of Object.entries(p.derivados))assert.equal(hash(archivo(f)),firma);
  const encuadres=JSON.parse(archivo('art/encuadres.json')),originales=JSON.parse(leer('art/encuadres.json'));
  assert.deepEqual(Object.keys(encuadres),cartasSobres);
  for(const id of cartasSobres)assert.deepEqual(encuadres[id],originales[id]);
  assert.equal(p.partida,false);assert.equal(p.inventario,false);
  assert.deepEqual(JSON.parse(archivo('catalogo-vacio.json')),{cartas:[]});
  for(const f of archivos.filter(f=>f.endsWith('.js')))new vm.Script(archivo(f).toString(),{filename:f});
  assert.throws(()=>exportar(destino),/vacío/);
  const segundo=path.join(temporal,'segundo');exportar(segundo);
  for(const f of archivos)assert.deepEqual(archivo(f),fs.readFileSync(path.join(segundo,f)),'Exportación determinista: '+f);
  const rey=path.join(temporal,'rey');exportarRey(rey);
  assert.deepEqual(archivo('_headers'),fs.readFileSync(path.join(rey,'_headers')),'Sobres conserva la CSP compartida existente');
  console.log('✓ Cinco cartas, seis imágenes locales, renderer y componentes idénticos a sus fuentes; exportación determinista y CSP conservada.');
  let accesosPersistentes=0;
  const ventana={};
  for(const tipo of ['localStorage','sessionStorage'])Object.defineProperty(ventana,tipo,{configurable:true,get(){accesosPersistentes++;throw Error('No tocar progreso persistente');}});
  vm.runInNewContext(archivo('memoria.js').toString(),{window:ventana});
  ventana.localStorage.setItem('carta','tal');ventana.sessionStorage.setItem('apertura','1');
  assert.equal(ventana.localStorage.getItem('carta'),'tal');ventana.CAOZ_DEV.reset();
  assert.equal(ventana.localStorage.length,0);assert.equal(ventana.sessionStorage.length,0);assert.equal(accesosPersistentes,0);
  console.log('✓ La prueba utiliza memoria desechable sin leer ni escribir el progreso del navegador.');
}finally{fs.rmSync(temporal,{recursive:true,force:true});}
