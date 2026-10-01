import assert from 'node:assert/strict';
import fs from 'node:fs';
import {resumir} from './arpg-inspector-metricas.mjs';
import {exportar} from './arpg-three-exportar.mjs';
import os from 'node:os';
import path from 'node:path';
assert.equal(resumir([]),null);
const datos=Array.from({length:100},(_,i)=>({intervalo:i<95?10:50,simulacion:2,envio:3,llamadas:80,triangulos:100000}));
const s=resumir(datos);assert.equal(s.p95,10);assert.equal(s.maximo,50);assert.equal(s.sobre33,5);assert.equal(s.fps,1000/12);assert.equal(s.simulacion,2);assert.equal(s.envio,3);assert.equal(datos[99].intervalo,50);
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'arpg-inspector-'));
try{exportar(dir);const html=fs.readFileSync(path.join(dir,'index.html'),'utf8');assert.ok(!html.includes('arpg-inspector'));assert.ok(!fs.existsSync(path.join(dir,'arpg-inspector.js')));}finally{fs.rmSync(dir,{recursive:true,force:true});}
console.log('✓ Percentiles, tiempos sin recorte y separación del inspector respecto al paquete jugable');
