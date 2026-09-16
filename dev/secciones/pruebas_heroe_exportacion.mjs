/* Procedencia y límites de la revisión aislada del creador de héroe. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import {exportar,derivarHeroe,componentesHeroe,entornoHeroe} from './heroe-exportar.mjs';
import {juego,hash} from './fuentes.mjs';
const temporal=fs.mkdtempSync(path.join(os.tmpdir(),'caoz-heroe-'));
try{
  const destino=path.join(temporal,'heroe'),procedencia=exportar(destino),archivo=f=>fs.readFileSync(path.join(destino,f));
  const html=archivo('index.html').toString(),host=archivo('heroe-host.js').toString(),adaptador=archivo('heroe.js').toString(),memoria=archivo('memoria.js').toString(),datos=archivo('generado/datos.js').toString();
  const esperados=['index.html','_headers','procedencia.json','memoria.js','heroe.css','heroe-host.js','heroe.js','generado/datos.js',...componentesHeroe.map(f=>'juego/'+f)].sort();
  const archivos=fs.readdirSync(destino,{recursive:true}).filter(f=>fs.statSync(path.join(destino,f)).isFile()).sort();
  assert.deepEqual(archivos,esperados,'La revisión sólo publica el creador y sus adaptadores declarados');
  for(const m of html.matchAll(/(?:src|href)="\.\/([^"?#]+)(?:[?#][^"]*)?"/g))assert.ok(fs.existsSync(path.join(destino,m[1])),m[1]);
  assert.ok(!/__CSP__|<iframe/i.test(html),'No quedan marcadores ni se incrusta el juego');
  assert.ok(html.indexOf('memoria.js')<html.indexOf('generado/datos.js')&&html.indexOf('generado/datos.js')<html.indexOf('heroe-host.js')&&html.indexOf('heroe-host.js')<html.indexOf('juego/campana-personaje.js'),'La memoria y el fixture se instalan antes del creador real');
  for(const prohibido of ['motor.js','final.js','final-core.js','campana-mesa.js','audio-domo.js','sw.js','manifest.webmanifest','_worker.js'])assert.ok(!fs.existsSync(path.join(destino,prohibido)),prohibido+' no pertenece a la sección');
  assert.ok(!/\b(?:CARDS|DECKS|newGame|aiTurn|NET|WebSocket|fetch)\b/.test(datos),'El fixture no incluye combate ni red');
  assert.ok(datos.includes('CAOZ_HEROE_LIDERES')&&datos.includes('Talesyn')&&datos.includes('Gero'),'Los nombres del fixture vienen del catálogo real');
  for(const [f,firma] of Object.entries(procedencia.componentes))assert.equal(hash(archivo('juego/'+f)),firma,f+' conserva el componente real');
  for(const [f,firma] of Object.entries(procedencia.entorno))assert.equal(hash(archivo(f)),firma,f+' conserva el adaptador revisado');
  assert.equal(archivo('juego/campana-personaje.js').toString(),fs.readFileSync(path.join(juego,'campana-personaje.js'),'utf8'),'El creador no se duplica ni deriva de una copia manual');
  for(const nombre of ['campanaCrear','campanaPrevisualizar','campanaGeometriaPersonaje','campanaPintarMalla'])assert.ok(!new RegExp('function\\s+'+nombre+'\\b').test(host)&&!new RegExp('function\\s+'+nombre+'\\b').test(adaptador),nombre+' sólo pertenece al componente real');
  assert.ok(host.includes('campanaDialogo')&&host.includes('campanaBoton')&&host.includes('campanaAcciones'),'El host aporta sólo los contratos mínimos del diálogo');
  assert.ok(adaptador.includes('campanaCrear')&&adaptador.includes('CAOZ_DEV?.reset'),'El laboratorio monta y reinicia el componente real con memoria efímera');
  assert.ok(memoria.includes('new Map()')&&memoria.includes("Object.defineProperty(window,'localStorage'")&&!/\b(?:fetch|indexedDB|document\.cookie)\b/.test(memoria),'La memoria temporal no toca progreso persistente');
  assert.equal(procedencia.partida,false);assert.equal(procedencia.ia,false);assert.equal(procedencia.online,false);assert.equal(procedencia.progresoReal,false);
  const derivado=derivarHeroe();assert.equal(datos,derivado.datosJS);assert.ok(derivado.lideres.length>=5,'El fixture conserva los protagonistas reales');
  new vm.Script(host,{filename:'heroe-host.js'});new vm.Script(adaptador,{filename:'heroe.js'});new vm.Script(archivo('juego/campana-personaje.js').toString(),{filename:'campana-personaje.js'});
  assert.throws(()=>exportar(destino),/vacío/);
  const segundo=path.join(temporal,'segundo');exportar(segundo);for(const f of archivos)assert.deepEqual(archivo(f),fs.readFileSync(path.join(segundo,f)),'Exportación determinista: '+f);
  console.log('✓ Héroe: creador real, fixture de protagonistas y memoria aislada comprobados.');
}finally{fs.rmSync(temporal,{recursive:true,force:true});}
