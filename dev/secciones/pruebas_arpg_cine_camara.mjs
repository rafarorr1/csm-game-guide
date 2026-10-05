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
assert.equal(C.muestra(a,2-1e-10).pos[0],10,'El error de suma del reloj no retrasa un corte un cuadro');
a[0].curva='suave';assert(C.muestra(a,.5).pos[0]<2.5);assert(C.muestra(a,1.5).pos[0]>7.5);
a[1].rot=new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),Math.PI).toArray();const m=C.muestra(a,1);assert(Math.abs(new T.Quaternion().fromArray(m.rot).length()-1)<1e-10);C.aplicar(camara,m);assert.equal(camara.position.x,5);assert.equal(camara.fov,42);
for(const fps of [30,60,120]){for(let i=0;i<=fps*2;i++){const t=i/fps,r=C.muestra(a,t);assert(r.pos.every(Number.isFinite));assert(r.fov>=22&&r.fov<=62);}assert.equal(C.muestra(a,2).pos[0],10);}
for(const alterar of [x=>x.version=9,x=>x.revision='otra',x=>x.planos.salida.claves[0].pos=[NaN,0,0],x=>x.planos.salida.claves[0].fov=0,x=>x.planos.salida.claves[0].rot=[0,0,0,0],x=>x.planos.salida.claves[0].t=-1,x=>x.planos.salida.claves.push(k(0,4)),x=>x.planos.inventado={vista:'externa',claves:[]}]){const malo=JSON.parse(JSON.stringify(v));alterar(malo);assert.throws(()=>M.validar(malo));}
const vuelta=M.validar(JSON.parse(JSON.stringify(v)));assert.equal(vuelta.planos.salida.claves.length,2);assert(!vuelta.planos.vertigo,'Un plano sin edición conserva su cámara del guion');
console.log('✓ Tomas de cámara: posiciones, focal, rotación normalizada, interpolaciones, cortes exactos, 30/60/120 FPS e importación validada.');

// Diez planos estables; el giro se inicia únicamente tras el corte al POV.
assert.equal(M.planos.length,10);assert.equal(M.VERSION,7);
assert.equal(M.planoDeFase('ataquePOV'),'carrera');assert.equal(M.planoDeFase('desaparece'),'tropezar');
for(const f of ['tropezar','buscar','levantarse'])assert.equal(M.planoDeFase(f),'tropezar');
assert.equal(M.planoDeFase('voltear'),'techo');assert.equal(M.planoDeFase('voltear',6),'tropezar');
assert(M.fases.indexOf('levantarse')<M.fases.indexOf('tropezar'));
const duracion={salida:1,descubrir:1,vertigo:1,pies:79/60,carrera:2,ataquePOV:.48,desaparece:.42,levantarse:.52,tropezar:1,buscar:1.85,voltear:1.6,techo:1.3,cielo:1.7,caida:1,impacto:1,negro:1};
const antes={desaparece:.57,tropezar:.9,buscar:2.8,levantarse:1.75,voltear:1.1,techo:2.3,cielo:1.7};
const ordenAnterior=['salida','descubrir','vertigo','pies','carrera','ataquePOV','desaparece','tropezar','buscar','levantarse','voltear','techo','cielo','caida','impacto','negro'];
const cuadros=[],inicios={};let grupo=null,inicio=0,total=0;
for(const accion of M.fases){
 const id=M.planoDeFase(accion);inicios[accion]=total;
 if(id!==grupo){grupo=id;inicio=total;}
 for(let f=0;f<Math.ceil(duracion[accion]*60);f++){
  const tAccion=f/60,t=total+tAccion-inicio,estado={fase:accion,t:tAccion,tPlano:t,total:total+tAccion,inicios:{...inicios}};
  cuadros.push({fase:id,accion,tAccion,t,estado,camara:k(0,900+cuadros.length)});
 }
 total+=Math.ceil(duracion[accion]*60)/60;
}
function relojAnterior(version,f){
 const id=M.planoDeFase(f.accion,version),acciones=ordenAnterior.filter(a=>M.planoDeFase(a,version)===id),e=f.estado;
 if(version>=4&&id==='tropezar')return f.t*6.02/3.79;
 const t=antes[f.accion]===undefined?f.tAccion:f.tAccion*antes[f.accion]/duracion[f.accion];
 if(version===1)return t;
 if(id==='tropezar'||id==='techo')return acciones.slice(0,acciones.indexOf(f.accion)).reduce((s,a)=>s+antes[a],0)+t;
 const local=e.total-e.inicios[acciones[0]];
 return local+(f.accion==='desaparece'?t-f.tAccion:0)+(id==='pies'&&version===5?11/60:0);
}
for(const version of [1,2,3,4,5,6]){
 const antigua={...M.nueva(),version,planos:{}};
 for(const [i,accion]of ordenAnterior.entries()){
  if(accion==='pies'&&version<5)continue;const id=M.planoDeFase(accion,version);if(antigua.planos[id])continue;
  antigua.planos[id]={vista:i%2?'externa':'original',claves:[k(0,i*100,42,'suave'),k(8,i*100+80)]};
 }
 const intacta=JSON.stringify(antigua);M.validar(antigua);const agrupada=C.agrupar(antigua,cuadros);assert.equal(agrupada.version,7);
 assert.equal(JSON.stringify(antigua),intacta,'La migración nunca modifica el documento original');
 for(const f of cuadros){
  const runtime=C.tomaEn(antigua,f.estado),convertida=C.tomaEn(agrupada,f.estado);
  if(f.accion==='pies'&&version<5){assert.equal(convertida.camara,null,'El insert nuevo conserva su cámara original');continue;}
  const esperado=f.accion==='voltear'?f.camara:C.muestra(antigua.planos[M.planoDeFase(f.accion,version)].claves,relojAnterior(version,f));
  assert(Math.abs(convertida.camara.pos[0]-esperado.pos[0])<1e-8,`La migración v${version} conserva el encuadre en ${f.accion} ${f.tAccion}`);
  if(f.accion==='voltear'){assert.equal(runtime.camara,null);assert.equal(runtime.vista,'original');assert.equal(convertida.vista,'original','El giro nuevo conserva los brazos POV');}
  else assert(Math.abs(runtime.camara.pos[0]-convertida.camara.pos[0])<1e-8,'El juego y el editor evalúan el mismo montaje antiguo');
 }
 assert.equal(JSON.stringify(agrupada.planos.salida),JSON.stringify(antigua.planos.salida),'Las pistas que no cambian conservan sus keyframes originales');
 if(version>=4){
  assert.equal(agrupada.planos.tropezar.claves.length,antigua.planos.tropezar.claves.length,'El plano 06 conserva todas las claves, incluso fuera del intervalo visible');
  assert.equal(agrupada.planos.tropezar.claves[0].curva,'suave');
  for(const fps of [30,60,120])for(let i=0;i<3.79*fps;i++){
   const tiempo=i/fps,a=C.muestra(antigua.planos.tropezar.claves,tiempo*6.02/3.79),b=C.muestra(agrupada.planos.tropezar.claves,tiempo);
   assert(Math.abs(a.pos[0]-b.pos[0])<1e-8,'El retime continuo conserva también el easing entre cuadros');
  }
 }
 assert.equal(JSON.stringify(M.validar(agrupada)),JSON.stringify(agrupada));
}
assert.throws(()=>M.validar({...M.nueva(),version:4,planos:{pies:{vista:'original',claves:[]}}}));
const parcial={...M.nueva(),version:3,planos:{carrera:{vista:'externa',claves:[k(0,1),k(3,4)]}}};
const migrada=C.agrupar(parcial,cuadros);assert(migrada.planos.tropezar.claves.length,'El final del antiguo plano de carrera sigue a la desaparición');
const sinEditar=cuadros.find(f=>f.accion==='levantarse');
assert.equal(C.tomaEn(migrada,sinEditar.estado).camara.pos[0],sinEditar.camara.pos[0],'La recuperación no editada conserva la cámara original');
assert(!migrada.planos.techo,'Sin cámaras de techo/cielo se conserva todo el nuevo POV programado');
const giroAnterior={...M.nueva(),version:1,planos:{voltear:{vista:'externa',claves:[k(0,4)]}}};
assert(!C.agrupar(giroAnterior,cuadros).planos.techo,'Una cámara antigua del giro externo no contamina el nuevo POV');
const juntas={...M.nueva(),version:6,planos:{tropezar:{vista:'externa',vistas:{voltear:'externa',buscar:'original'},claves:[k(0,1),k(.0011,2)]}}};
const ajustadas=C.agrupar(juntas,cuadros);assert.equal(ajustadas.planos.tropezar.claves.length,2);assert(!('voltear' in ajustadas.planos.tropezar.vistas));assert.equal(ajustadas.planos.tropezar.vistas.buscar,'original');
assert.equal(M.planoDeFase('cielo'),'techo');assert.equal(M.planoDeFase('cielo',2),'cielo');
assert.throws(()=>M.validar({...M.nueva(),planos:{carrera:{vista:'original',claves:[],vistas:{desaparece:'externa'}}}}));
assert.throws(()=>M.validar({...M.nueva(),planos:{tropezar:{vista:'original',claves:[],vistas:{voltear:'externa'}}}}));
console.log('✓ Formato 7: diez planos, nuevo POV, migración de versiones 1–6, retime continuo del plano 06, cámaras de techo/cielo, vistas y reloj idéntico en editor/juego.');
