import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';import {extraerDeclaracion} from './fuentes.mjs';
const s=fs.readFileSync(new URL('arpg-three-mesa.js',import.meta.url),'utf8');const c=vm.createContext({});
vm.runInContext(`const TAU=Math.PI*2,obstaculos=[];${extraerDeclaracion(s,'R','const').texto}${extraerDeclaracion(s,'PANELES','const').texto}${extraerDeclaracion(s,'dentroPlaza','function').texto}`,c);
for(let i=0;i<360;i++)for(const radio of [.42,.7]){c.p={x:30*Math.cos(i*Math.PI/180),z:30*Math.sin(i*Math.PI/180)};c.radio=radio;vm.runInContext('dentroPlaza(p,radio)',c);assert.ok(vm.runInContext('PLANOS_MURALLA.every(n=>p.x*n.x+p.z*n.z<=R-radio+1e-8)',c));}
for(const a of [-Math.PI/2,Math.PI/6,Math.PI*5/6]){c.p={x:35*Math.cos(a),z:35*Math.sin(a)};vm.runInContext('dentroPlaza(p,.42)',c);assert.ok(Math.abs(Math.hypot(c.p.x,c.p.z)-(26-.42))<1e-8);}
console.log('✓ Límite sobre las 24 caras visibles; portones bloquean al héroe; radios de héroe y troll respetados');
