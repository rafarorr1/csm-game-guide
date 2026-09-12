/* Sólo procedencia, aislamiento y regla de esta mesa. No ejecuta una partida. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import vm from 'node:vm';
import {exportar,cartasRey} from './rey-exportar.mjs';
import {extraerDeclaracion,leer,hash} from './fuentes.mjs';
const temporal=fs.mkdtempSync(path.join(os.tmpdir(),'caoz-rey-'));
try{
  const p=exportar(temporal),html=fs.readFileSync(path.join(temporal,'index.html'),'utf8'),regla=fs.readFileSync(path.join(temporal,'generado/regla.js'),'utf8');
  assert.equal(regla,extraerDeclaracion(leer('motor.js'),'avanceCorte').texto+'\n');assert.equal(p.regla.sha256,hash(regla.slice(0,-1)));
  for(const m of html.matchAll(/(?:src|href)="\.\/([^"]+)"/g))assert.ok(fs.existsSync(path.join(temporal,m[1])),m[1]);
  assert.ok(html.indexOf('memoria.js')<html.indexOf('generado/datos.js'));assert.ok(!html.includes('<iframe'));
  for(const f of ['motor.js','final.js','sw.js','manifest.webmanifest','_worker.js','estudio.html'])assert.ok(!fs.existsSync(path.join(temporal,f)));
  assert.deepEqual(Object.keys(JSON.parse(fs.readFileSync(path.join(temporal,'art/encuadres.json'),'utf8'))),cartasRey);
  assert.equal(fs.readdirSync(path.join(temporal,'art')).length,6);
  assert.throws(()=>exportar(temporal),/vacío/);
  console.log('✓ Paquete acotado, recursos completos y regla idéntica al motor.');
  const contexto=vm.createContext({});new vm.Script(fs.readFileSync(path.join(temporal,'generado/datos.js'),'utf8')+'\n'+regla).runInContext(contexto);
  assert.equal(vm.runInContext('G',contexto),null);assert.equal(vm.runInContext('typeof newGame',contexto),'undefined');assert.equal(vm.runInContext('Object.keys(CARDS).length',contexto),5);
  const campo=[{uid:'rey',alive:true,card:{id:'rey'}},{uid:'can',alive:true,card:{id:'can'}},{uid:'goblin1',alive:true,card:{id:'tok_goblincamino',token:true}},{uid:'goblin2',alive:true,card:{id:'tok_goblincamino',token:true}}];
  let e=contexto.avanceCorte(campo,null,2);assert.equal(e.turnos,1,'Can y sus fichas no deben ganar al primer inicio');
  e=contexto.avanceCorte(campo,e,2);assert.equal(e.turnos,1,'No debe duplicarse un mismo inicio');
  assert.equal(contexto.avanceCorte(campo,e).turnos,1,'Una actualización visual no suma turnos');
  assert.equal(contexto.avanceCorte(campo,e,4).turnos,2,'La corte sostenida gana al segundo inicio');
  campo[3].alive=false;e=contexto.avanceCorte(campo,e);assert.equal(e.turnos,0,'Perder un aliado reinicia el avance');
  campo[3].alive=true;e=contexto.avanceCorte(campo,e,6);assert.equal(e.turnos,1);
  campo[0]={...campo[0],uid:'otro_rey'};assert.equal(contexto.avanceCorte(campo,e).turnos,0,'Reponer El Rey no conserva el progreso');
  console.log('✓ Dos inicios propios, fichas válidas, sin duplicados y reinicio al romper la corte.');
}finally{fs.rmSync(temporal,{recursive:true,force:true});}
