import assert from 'node:assert/strict';
import fs from 'node:fs';
import {resumir} from './arpg-inspector-metricas.mjs';
import {exportar} from './arpg-three-exportar.mjs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
assert.equal(resumir([]),null);
const datos=Array.from({length:100},(_,i)=>({intervalo:i<95?10:50,simulacion:2,envio:3,llamadas:80,triangulos:100000}));
const s=resumir(datos);assert.equal(s.p95,10);assert.equal(s.maximo,50);assert.equal(s.sobre33,5);assert.equal(s.fps,1000/12);assert.equal(s.simulacion,2);assert.equal(s.envio,3);assert.equal(datos[99].intervalo,50);
assert.equal(s.gpu,null,'Sin temporizador compatible no se inventa una duración de GPU');
const parcial=resumir([null,4,undefined,NaN,Infinity,6].map(gpu=>({...datos[0],gpu})));
assert.equal(parcial.gpu,5,'Sólo cuentan consultas de GPU completadas y válidas');
assert.equal(parcial.muestrasGPU,2);assert.equal(parcial.cuadros,6,'Muestrear GPU cada diez cuadros no reduce la muestra de FPS');
// Ejecutar el envoltorio real: una excepción del posproceso tampoco congela las sombras futuras.
const fuente=fs.readFileSync(new URL('./arpg-three-mesa.js',import.meta.url),'utf8');
const inicio=fuente.indexOf('    const dibujarOclusion='),fin=fuente.indexOf('\n  }',inicio);
assert.ok(inicio>0&&fin>inicio);
const renderer={shadowMap:{autoUpdate:true}},objetivo={};let fallar=false;
const oclusion={render(r,buffer){assert.equal(this,oclusion);assert.equal(r.shadowMap.autoUpdate,false);assert.equal(buffer,objetivo);if(fallar)throw Error('Fallo simulado de GPU');return 42;}};
vm.runInNewContext(fuente.slice(inicio,fin),{oclusion});
assert.equal(oclusion.render(renderer,objetivo),42);assert.equal(renderer.shadowMap.autoUpdate,true);
fallar=true;assert.throws(()=>oclusion.render(renderer,objetivo),/Fallo simulado/);assert.equal(renderer.shadowMap.autoUpdate,true);
fallar=false;renderer.shadowMap.autoUpdate=false;oclusion.render(renderer,objetivo);assert.equal(renderer.shadowMap.autoUpdate,false);
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'arpg-inspector-'));
try{exportar(dir);const html=fs.readFileSync(path.join(dir,'index.html'),'utf8');assert.ok(!html.includes('arpg-inspector'));assert.ok(fs.existsSync(path.join(dir,'arpg-three-tiempo.js')));assert.ok(html.indexOf('arpg-three-tiempo.js')<html.indexOf('arpg-three-mesa.js'));assert.ok(html.indexOf('arpg-three-adreida-animacion.js')<html.indexOf('arpg-three-modelos.js'));assert.ok(fs.existsSync(path.join(dir,'arpg-three-adreida-animacion.js')));assert.ok(!fs.existsSync(path.join(dir,'arpg-inspector.js')));}finally{fs.rmSync(dir,{recursive:true,force:true});}
console.log('✓ Percentiles, GPU asíncrona opcional, tiempos sin recorte y exportación sin inspector');
