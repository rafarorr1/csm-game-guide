/* Niveles, impulsos y reposo con el Spring real de QuickLiquid. */
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const c=vm.createContext({console});c.window=c;
for(const f of ['quick-liquid-vendor.js','arpg-three-orbes.js'])vm.runInContext(fs.readFileSync(new URL(f,import.meta.url),'utf8'),c);
const crear=c.CAOZ_ARPG_ORBES.crearEstado;
const avanzar=(e,s,hz,n,v=0,reducido=false)=>{for(let i=0;i<Math.round(s*hz);i++)e.paso(1/hz,n,v,reducido);return e.estado();};
for(const hz of [20,30,60,144]){
 const e=crear(1);e.paso(0,.4);let s=avanzar(e,2,hz,.4);
 assert.ok(Math.abs(s.nivel-.4)<.0002,`${hz} FPS: el nivel alcanza el recurso`);
 e.paso(1/hz,.4,5.8);s=avanzar(e,.2,hz,.4,5.8);assert.ok(Math.abs(s.inclinacion)>.04,'El líquido responde al movimiento');
 s=avanzar(e,3,hz,.4,0);assert.ok(Math.abs(s.inclinacion)<.002,'El líquido se asienta al detenerse');
 assert.equal(e.paso(1/hz,0).nivel,0,'Vacío exacto al agotar el recurso');assert.equal(e.paso(1/hz,1).nivel,1,'Lleno exacto al máximo');
 assert.equal(e.paso(1/hz,-2).nivel,0);assert.equal(e.paso(1/hz,10).nivel,1);
 s=e.paso(1/hz,.35,8,true);assert.equal(s.nivel,.35);assert.equal(s.inclinacion,0);assert.equal(s.energia,0);
 const t=s.tiempo;e.paso(0,.35,8,true);assert.equal(e.estado().tiempo,t,'Sin avance del juego no avanza la animación');
}
const a=crear(.5),b=crear(.5);a.paso(.016,.1,5);assert.equal(b.estado().nivel,.5,'Alma y Furia tienen estados independientes');
console.log('OK: QuickLiquid real; niveles 0/35/40/100 %, balanceo y reposo a 20/30/60/144 FPS, movimiento reducido e independencia.');
