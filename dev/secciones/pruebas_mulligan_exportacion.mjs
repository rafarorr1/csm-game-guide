import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {exportar,cartasMulligan} from './mulligan-exportar.mjs';

const aqui=path.dirname(fileURLToPath(import.meta.url));
const salida=fs.mkdtempSync(path.join(os.tmpdir(),'caoz-mulligan-export-'));
try{
  const p=exportar(salida),leer=n=>fs.readFileSync(path.join(salida,n),'utf8');
  assert.equal(p.seccion,'mulligan');
  assert.equal(p.partida,false);assert.equal(p.ia,false);assert.equal(p.online,false);assert.equal(p.progresoReal,false);
  for(const n of ['index.html','procedencia.json','_headers','mulligan.js','mulligan.css','juego/mulligan-ui.js','juego/mulligan-ui.css','generado/datos.js'])assert.ok(fs.existsSync(path.join(salida,n)),n+' falta en el paquete');
  const procedencia=JSON.parse(leer('procedencia.json'));
  assert.deepEqual(procedencia.fixture.cartas,cartasMulligan);
  assert.match(leer('index.html'),/juego\/mulligan-ui\.js/);
  assert.match(leer('mulligan.js'),/CAOZ_MULLIGAN_UI/);
  assert.match(leer('juego/mulligan-ui.js'),/hasta dos cartas|LIMITE_MAXIMO/);
  new vm.Script(leer('generado/datos.js'));new vm.Script(leer('mulligan.js'));
  console.log('Mulligan aislado: selector compartido, fixture acotado y sin partida/IA/red/progreso: OK');
}finally{fs.rmSync(salida,{recursive:true,force:true});}
