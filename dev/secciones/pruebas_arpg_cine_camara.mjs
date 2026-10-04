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
for(const alterar of [x=>x.version=3,x=>x.revision='otra',x=>x.planos.salida.claves[0].pos=[NaN,0,0],x=>x.planos.salida.claves[0].fov=0,x=>x.planos.salida.claves[0].rot=[0,0,0,0],x=>x.planos.salida.claves[0].t=-1,x=>x.planos.salida.claves.push(k(0,4)),x=>x.planos.inventado={vista:'externa',claves:[]}]){const malo=JSON.parse(JSON.stringify(v));alterar(malo);assert.throws(()=>M.validar(malo));}
const vuelta=M.validar(JSON.parse(JSON.stringify(v)));assert.equal(vuelta.planos.salida.claves.length,2);assert(!vuelta.planos.vertigo,'Un plano sin edición conserva su cámara del guion');
console.log('✓ Tomas de cámara: posiciones, focal, rotación normalizada, interpolaciones, cortes exactos, 30/60/120 FPS e importación validada.');

// Dos grupos editoriales conservan una pista continua entre sus acciones.
assert.equal(M.planos.length,10);
assert.equal(M.planoDeFase('ataquePOV'),'carrera');assert.equal(M.planoDeFase('desaparece'),'carrera');
for(const f of ['tropezar','buscar','levantarse','voltear'])assert.equal(M.planoDeFase(f),'tropezar');
const vieja={...M.nueva(),version:1,planos:{carrera:{vista:'original',claves:[k(0,10),k(1,20)]},desaparece:{vista:'externa',claves:[k(0,30)]},salida:{vista:'externa',claves:[k(0,5)]}}};
M.validar(vieja);const cuadros=[];
for(const [i,accion]of ['carrera','ataquePOV','desaparece'].entries())for(let f=0;f<60;f++)cuadros.push({fase:'carrera',accion,tAccion:f/60,t:i+f/60,camara:k(0,99)});
const agrupada=C.agrupar(vieja,cuadros);assert.equal(agrupada.version,2);assert.equal(agrupada.planos.carrera.claves.length,180);assert.equal(agrupada.planos.salida.claves.length,1);assert(!agrupada.planos.desaparece);
for(const f of cuadros){const esperado=C.muestra(vieja.planos[f.accion]?.claves,f.tAccion)||f.camara,actual=C.tomaEn(agrupada,{fase:f.accion,t:f.tAccion,tPlano:f.t});assert.equal(actual.camara.pos[0],esperado.pos[0]);}
assert.equal(C.tomaEn(agrupada,{fase:'ataquePOV',t:0,tPlano:1}).vista,'original');assert.equal(C.tomaEn(agrupada,{fase:'desaparece',t:0,tPlano:2}).vista,'externa');
assert.equal(C.tomaEn(vieja,{fase:'desaparece',t:.2,tPlano:2.2}).camara.pos[0],30,'La partida también puede abrir tomas antiguas');
const continua=M.nueva();continua.planos.carrera={vista:'externa',claves:[k(0,0),k(3,30)]};
assert(Math.abs(C.tomaEn(continua,{fase:'ataquePOV',t:.1,tPlano:2.1}).camara.pos[0]-21)<1e-8,'Una acción nueva no reinicia la pista');
assert.equal(JSON.stringify(M.validar(agrupada)),JSON.stringify(agrupada),'Exportación e importación conservan la migración');
assert.throws(()=>M.validar({...continua,planos:{ataquePOV:{vista:'externa',claves:[]}}}));
assert.throws(()=>M.validar({...continua,planos:{carrera:{vista:'original',claves:[],vistas:{salida:'externa'}}}}));
console.log('✓ Diez planos, reloj continuo, migración de tomas anteriores con cámaras sin editar, cortes, vistas e importación compatible.');
