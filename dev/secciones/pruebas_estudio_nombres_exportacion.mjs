/* Comprueba que el estudio aislado usa el validador real y no toca servicios. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import {exportar,derivarNombres,cartasEstudioNombres,componenteNombres} from './estudio-nombres-exportar.mjs';
import {juego,hash} from './fuentes.mjs';

const temporal=fs.mkdtempSync(path.join(os.tmpdir(),'caoz-estudio-nombres-'));
try{
  const destino=path.join(temporal,'estudio-nombres'),procedencia=exportar(destino),leer=n=>fs.readFileSync(path.join(destino,n),'utf8');
  const html=leer('index.html'),css=leer('estudio-nombres.css'),js=leer('estudio-nombres.js'),datos=leer('generado/datos.js'),componente=leer('juego/'+componenteNombres);
  const csp="default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; worker-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'";
  const esperados=['_headers','estudio-nombres.css','estudio-nombres.js','generado/datos.js','index.html','juego/'+componenteNombres,'procedencia.json'].sort();
  const archivos=fs.readdirSync(destino,{recursive:true}).filter(f=>fs.statSync(path.join(destino,f)).isFile()).sort();
  assert.deepEqual(archivos,esperados,'La revisión sólo publica el editor, datos mínimos y componente compartido');
  for(const m of html.matchAll(/(?:src|href)="\.\/([^"?#]+)(?:[?#][^"]*)?"/g))assert.ok(fs.existsSync(path.join(destino,m[1])),m[1]);
  assert.ok(!/__CSP__|__GENERADO__|<iframe/i.test(html),'No quedan marcadores ni juego incrustado');
  assert.ok(!/(?:src|href)=["'](?:https?:)?\/\//i.test(html),'No se cargan recursos remotos');
  assert.ok(html.includes('Content-Security-Policy" content="'+csp+'"'),'La entrada conserva la CSP de sección');
  assert.equal(leer('_headers'),'/*\n  Cache-Control: no-store\n  X-Content-Type-Options: nosniff\n  Content-Security-Policy: '+csp+'\n');
  assert.ok(html.indexOf('generado/datos.js')<html.indexOf('juego/nombres-cartas.js')&&html.indexOf('juego/nombres-cartas.js')<html.indexOf('estudio-nombres.js'),'Datos y validador cargan antes del adaptador');
  for(const prohibido of ['motor.js','final.js','final-core.js','movil.html','audio-domo.js','sw.js','manifest.webmanifest','_worker.js'])assert.ok(!fs.existsSync(path.join(destino,prohibido)),prohibido+' no pertenece a la sección');
  assert.equal(componente,fs.readFileSync(path.join(juego,componenteNombres),'utf8'),'El validador se copia byte a byte desde el juego');
  assert.equal(hash(componente),procedencia.componente.sha256,'La procedencia conserva la firma del componente real');
  const derivado=derivarNombres();assert.equal(datos,derivado.datosJS,'Las cartas se derivan del catálogo actual');assert.deepEqual(procedencia.fixture.cartas,cartasEstudioNombres);
  const ventana={},contexto=vm.createContext({window:ventana});new vm.Script(datos).runInContext(contexto);new vm.Script(componente).runInContext(contexto);
  assert.deepEqual(Array.from(contexto.window.CAOZ_ESTUDIO_NOMBRES_DATOS.cartas,c=>c.id),cartasEstudioNombres,'La muestra tiene cinco IDs reales y estables');
  const api=contexto.CAOZ_NOMBRES_CARTAS;assert.equal(api.validar('  Bruma   del Domo  '),'Bruma del Domo');assert.equal(api.validar(null,{permitirNulo:true}),null);assert.throws(()=>api.validar(''),/Escribe/);assert.throws(()=>api.validar('<mal>'),/no puede incluir/);
  assert.ok(Number.isInteger(api.MAXIMO)&&api.MAXIMO>0,'El límite llega del componente compartido');
  assert.ok(js.includes('api().validar(valor,{permitirNulo:true})')&&js.includes('borradores=new Map'),'El borrador usa el contrato compartido y sólo memoria');
  assert.ok(!/\b(?:fetch|XMLHttpRequest|WebSocket|localStorage|sessionStorage|indexedDB|navigator)\b/.test(js),'El adaptador no abre red ni persistencia');
  assert.ok(css.includes('@media(max-width:540px)')&&html.includes('id="estudioNombresGuardar"')&&html.includes('id="estudioNombresRestaurar"'),'La vista ofrece edición y restauración también en móvil');
  for(const [archivo,firma] of Object.entries(procedencia.entorno))assert.equal(hash(leer(archivo)),firma,archivo+' conserva el adaptador revisado');
  new vm.Script(js,{filename:'estudio-nombres.js'});assert.throws(()=>exportar(destino),/vacío/);
  const segundo=path.join(temporal,'segundo');exportar(segundo);for(const archivo of archivos)assert.deepEqual(fs.readFileSync(path.join(destino,archivo)),fs.readFileSync(path.join(segundo,archivo)),'Exportación determinista: '+archivo);
  console.log('✓ Estudio de nombres: catálogo real, validador compartido y borradores efímeros comprobados.');
}finally{fs.rmSync(temporal,{recursive:true,force:true});}
