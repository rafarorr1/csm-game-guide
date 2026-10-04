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
for(const alterar of [x=>x.version=9,x=>x.revision='otra',x=>x.planos.salida.claves[0].pos=[NaN,0,0],x=>x.planos.salida.claves[0].fov=0,x=>x.planos.salida.claves[0].rot=[0,0,0,0],x=>x.planos.salida.claves[0].t=-1,x=>x.planos.salida.claves.push(k(0,4)),x=>x.planos.inventado={vista:'externa',claves:[]}]){const malo=JSON.parse(JSON.stringify(v));alterar(malo);assert.throws(()=>M.validar(malo));}
const vuelta=M.validar(JSON.parse(JSON.stringify(v)));assert.equal(vuelta.planos.salida.claves.length,2);assert(!vuelta.planos.vertigo,'Un plano sin edición conserva su cámara del guion');
console.log('✓ Tomas de cámara: posiciones, focal, rotación normalizada, interpolaciones, cortes exactos, 30/60/120 FPS e importación validada.');

// La desaparición pertenece al plano 06; la actuación conserva su tiempo absoluto.
assert.equal(M.planos.length,10);assert.equal(M.VERSION,5);
assert.equal(M.planoDeFase('ataquePOV'),'carrera');assert.equal(M.planoDeFase('desaparece'),'tropezar');
for(const f of ['tropezar','buscar','levantarse','voltear'])assert.equal(M.planoDeFase(f),'tropezar');
const cuadros=[],inicios={};let grupo=null,inicio=0;
for(const [a,accion]of M.fases.entries()){
 const id=M.planoDeFase(accion);inicios[accion]=a;
 if(id!==grupo){grupo=id;inicio=a;}
 for(let f=0;f<60;f++)cuadros.push({fase:id,accion,tAccion:f/60,t:a+f/60-inicio,camara:k(0,99)});
}
for(const version of [1,2,3,4]){
 const antigua={...M.nueva(),version,planos:{}};
 for(const [i,accion]of M.fases.entries()){
  if(accion==='pies')continue;const id=M.planoDeFase(accion,version);if(antigua.planos[id])continue;
  antigua.planos[id]={vista:i%2?'externa':'original',claves:[k(0,i*100,42,'suave'),k(8,i*100+80)]};
 }
 M.validar(antigua);const agrupada=C.agrupar(antigua,cuadros);assert.equal(agrupada.version,5);
 for(const [i,f]of cuadros.entries()){
  if(f.accion==='pies'){assert.equal(C.tomaEn(agrupada,{fase:'pies',t:f.tAccion,tPlano:f.t}).camara,null,'El insert nuevo conserva su cámara original');continue;}
  const origen=M.planoDeFase(f.accion,version),primera=M.fases.find(a=>M.planoDeFase(a,version)===origen),t=i/60-inicios[primera];
  const esperado=C.muestra(antigua.planos[origen].claves,t),actual=C.muestra(agrupada.planos[f.fase].claves,f.t);
  assert(Math.abs(actual.pos[0]-esperado.pos[0])<1e-8,`La cámara v${version} conserva el encuadre global en ${f.accion} ${f.tAccion}`);
  const runtime=C.tomaEn(antigua,{fase:f.accion,t:f.tAccion,tPlano:f.t,total:i/60,inicios});
  assert(Math.abs(runtime.camara.pos[0]-esperado.pos[0])<1e-8,'La partida reproduce las tomas antiguas con su reloj original');
 }
 assert.equal(JSON.stringify(agrupada.planos.salida),JSON.stringify(antigua.planos.salida),'Las pistas que no cambian conservan sus keyframes originales');
 assert.equal(JSON.stringify(M.validar(agrupada)),JSON.stringify(agrupada));
}
assert.throws(()=>M.validar({...M.nueva(),version:4,planos:{pies:{vista:'original',claves:[]}}}));
const parcial={...M.nueva(),version:3,planos:{carrera:{vista:'externa',claves:[k(0,1),k(3,4)]}}};
const migrada=C.agrupar(parcial,cuadros);assert(migrada.planos.tropezar.claves.length,'El final del antiguo plano 04 sigue a la desaparición');
assert.equal(C.muestra(migrada.planos.tropezar.claves,1).pos[0],99,'La recuperación no editada conserva la cámara original');
assert.equal(M.planoDeFase('cielo'),'techo');assert.equal(M.planoDeFase('cielo',2),'cielo');
assert.throws(()=>M.validar({...M.nueva(),planos:{carrera:{vista:'original',claves:[],vistas:{desaparece:'externa'}}}}));
console.log('✓ Formato 5: insert de pies, corte a recuperación, migración de versiones 1/2/3/4 sin perder encuadres, vistas, curvas ni el reloj global.');
