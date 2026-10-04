/* Evaluación de tomas portables, cortes y datos importados. Sin navegador. */
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const c=vm.createContext({console,atob});c.window=c;
for(const f of ['visor-three-vendor.js','arpg-cine-camara.js'])vm.runInContext(fs.readFileSync(new URL(f,import.meta.url),'utf8'),c);
const T=c.CAOZ_THREE.THREE,M=c.CAOZ_ARPG_CINE_CAMARA,C=M.crear(T),camara=new T.PerspectiveCamera();
const k=(t,x,fov=42,curva='lineal')=>({t,pos:[x,2,10],rot:[0,0,0,1],fov,distancia:10,curva});
const d=M.nueva();d.planos.salida={vista:'externa',claves:[k(2,10,62),k(0,0,22)]};
const v=M.validar(d);assert.equal(v.planos.salida.claves[0].t,0,'Ordena una toma importada sin modificar el documento fuente');assert.equal(d.planos.salida.claves[0].t,2);
const a=v.planos.salida.claves;assert.equal(C.muestra(a,-1).pos[0],0);assert.equal(C.muestra(a,5).pos[0],10);assert.equal(C.muestra(a,1).pos[0],5);assert.equal(C.muestra(a,1).fov,42);assert.equal(C.muestra([],0),null);
a[0].curva='corte';assert.equal(C.muestra(a,1.999).pos[0],0);assert.equal(C.muestra(a,2).pos[0],10,'El corte cambia exactamente al llegar al keyframe');
a[0].curva='suave';assert(C.muestra(a,.5).pos[0]<2.5);assert(C.muestra(a,1.5).pos[0]>7.5);
a[1].rot=new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),Math.PI).toArray();const m=C.muestra(a,1);assert(Math.abs(new T.Quaternion().fromArray(m.rot).length()-1)<1e-10);C.aplicar(camara,m);assert.equal(camara.position.x,5);assert.equal(camara.fov,42);
for(const fps of [30,60,120]){for(let i=0;i<=fps*2;i++){const t=i/fps,r=C.muestra(a,t);assert(r.pos.every(Number.isFinite));assert(r.fov>=22&&r.fov<=62);}assert.equal(C.muestra(a,2).pos[0],10);}
for(const alterar of [x=>x.version=2,x=>x.revision='otra',x=>x.planos.salida.claves[0].pos=[NaN,0,0],x=>x.planos.salida.claves[0].fov=0,x=>x.planos.salida.claves[0].rot=[0,0,0,0],x=>x.planos.salida.claves[0].t=-1,x=>x.planos.salida.claves.push(k(0,4)),x=>x.planos.inventado={vista:'externa',claves:[]}]){const malo=JSON.parse(JSON.stringify(v));alterar(malo);assert.throws(()=>M.validar(malo));}
const vuelta=M.validar(JSON.parse(JSON.stringify(v)));assert.equal(vuelta.planos.salida.claves.length,2);assert(!vuelta.planos.vertigo,'Un plano sin edición conserva su cámara del guion');
console.log('✓ Tomas de cámara: posiciones, focal, rotación normalizada, interpolaciones, cortes exactos, 30/60/120 FPS e importación validada.');
