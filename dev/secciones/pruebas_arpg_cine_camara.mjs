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
for(const alterar of [x=>x.version=10,x=>x.revision='otra',x=>x.planos.salida.claves[0].pos=[NaN,0,0],x=>x.planos.salida.claves[0].fov=0,x=>x.planos.salida.claves[0].rot=[0,0,0,0],x=>x.planos.salida.claves[0].t=-1,x=>x.planos.salida.claves.push(k(0,4)),x=>x.planos.inventado={vista:'externa',claves:[]}]){const malo=JSON.parse(JSON.stringify(v));alterar(malo);assert.throws(()=>M.validar(malo));}
const vuelta=M.validar(JSON.parse(JSON.stringify(v)));assert.equal(vuelta.planos.salida.claves.length,2);assert(!vuelta.planos.vertigo,'Un plano sin edición conserva su cámara del guion');
console.log('✓ Tomas de cámara: posiciones, focal, rotación normalizada, interpolaciones, cortes exactos, 30/60/120 FPS e importación validada.');

// Diez planos estables; el giro se inicia únicamente tras el corte al POV.
assert.equal(M.planos.length,10);assert.equal(M.VERSION,9);
assert.equal(M.planoDeFase('ataquePOV'),'carrera');assert.equal(M.planoDeFase('desaparece'),'tropezar');
for(const f of ['tropezar','buscar','levantarse'])assert.equal(M.planoDeFase(f),'tropezar');
assert.equal(M.planoDeFase('voltear'),'techo');assert.equal(M.planoDeFase('voltear',6),'tropezar');
assert(M.fases.indexOf('levantarse')<M.fases.indexOf('tropezar'));
const duracion={salida:1,descubrir:1,vertigo:1,pies:79/60,carrera:93/60,ataquePOV:.55,desaparece:.35,levantarse:.3,tropezar:.74,buscar:1.2,voltear:4.6,techo:1.4,hechizo:3,cielo:1.7,caida:1,impacto:1,negro:1};
const antes={ataquePOV:.48,desaparece:.57,tropezar:.9,buscar:2.8,levantarse:1.75,voltear:1.1,techo:2.3,cielo:1.7};
const montaje7={ataquePOV:.48,desaparece:.42,levantarse:.52,tropezar:1,buscar:1.85,voltear:1.6,techo:1.3,cielo:1.7};
const montaje8={ataquePOV:.96,desaparece:.08,levantarse:.16,tropezar:.74,buscar:1.2,voltear:2.6,techo:1.4,cielo:1.7};
const ordenAnterior=['salida','descubrir','vertigo','pies','carrera','ataquePOV','desaparece','tropezar','buscar','levantarse','voltear','techo','cielo','caida','impacto','negro'];
const cuadros=[],inicios={};let grupo=null,inicio=0,total=0;
for(const accion of M.fases){
 const id=M.planoDeFase(accion);inicios[accion]=total;
 if(id!==grupo){grupo=id;inicio=total;}
 for(let f=0;f<Math.ceil(duracion[accion]*60);f++){
  const tAccion=f/60,t=total+tAccion-inicio,estado={fase:accion,t:tAccion,tPlano:t,total:total+tAccion,inicios:{...inicios},duracionCarreraAnterior:1.98};
  cuadros.push({fase:id,accion,tAccion,t,estado,camara:k(0,900+cuadros.length)});
 }
 total+=Math.ceil(duracion[accion]*60)/60;
}
function relojAnterior(version,f){
 const duracionPrevia=version>=8?montaje8:version===7?montaje7:antes,orden=version>=7?M.fases.filter(f=>f!=='hechizo'):ordenAnterior;
 const id=M.planoDeFase(f.accion,version),acciones=orden.filter(a=>M.planoDeFase(a,version)===id),e=f.estado;
 if(version>=4&&id==='tropezar')return f.t*(version>=8?2.18:version===7?3.79:6.02)/2.59;
 const t=f.accion==='carrera'?f.tAccion*e.duracionCarreraAnterior/duracion.carrera:f.accion==='voltear'?(f.tAccion-2)*duracionPrevia.voltear/2.6:duracionPrevia[f.accion]===undefined?f.tAccion:f.tAccion*duracionPrevia[f.accion]/duracion[f.accion];
 if(version===1||f.accion==='carrera')return t;
 if(id==='tropezar'||id==='techo')return acciones.slice(0,acciones.indexOf(f.accion)).reduce((s,a)=>s+duracionPrevia[a],0)+t;
 if(f.accion==='desaparece')return e.duracionCarreraAnterior+duracionPrevia.ataquePOV+t;
 if(f.accion==='ataquePOV')return e.duracionCarreraAnterior+t;
 const local=e.total-e.inicios[acciones[0]];
 return local+(id==='pies'&&version===5?11/60:0);
}
for(const version of [1,2,3,4,5,6,7,8]){
 const antigua={...M.nueva(),version,planos:{}};
 for(const [i,accion]of ordenAnterior.entries()){
  if(accion==='pies'&&version<5)continue;const id=M.planoDeFase(accion,version);if(antigua.planos[id])continue;
  antigua.planos[id]={vista:i%2?'externa':'original',claves:[k(0,i*100,42,'suave'),k(8,i*100+80)]};
 }
 const intacta=JSON.stringify(antigua);M.validar(antigua);const agrupada=C.agrupar(antigua,cuadros);assert.equal(agrupada.version,9);
 assert.equal(JSON.stringify(antigua),intacta,'La migración nunca modifica el documento original');
 for(const f of cuadros){
  const runtime=C.tomaEn(antigua,f.estado),convertida=C.tomaEn(agrupada,f.estado);
  if(f.accion==='pies'&&version<5){assert.equal(convertida.camara,null,'El insert nuevo conserva su cámara original');continue;}
  const esperado=f.accion==='hechizo'||f.accion==='voltear'&&(version<7||f.tAccion<2)?null:C.muestra(antigua.planos[M.planoDeFase(f.accion,version)].claves,relojAnterior(version,f));
  if(!esperado){assert.equal(runtime.camara,null);assert.equal(convertida.camara,null);assert.equal(runtime.vista,convertida.vista,'El hold y las fases nativas conservan la vista entre runtime y editor');}
  else {assert(Math.abs(convertida.camara.pos[0]-esperado.pos[0])<1e-8,`La migración v${version} conserva el encuadre en ${f.accion} ${f.tAccion}`);assert(Math.abs(runtime.camara.pos[0]-convertida.camara.pos[0])<1e-8,'El juego y el editor evalúan el mismo montaje antiguo');}
 }
 assert.equal(JSON.stringify(agrupada.planos.salida),JSON.stringify(antigua.planos.salida),'Las pistas que no cambian conservan sus keyframes originales');
 if(version>=4){
  assert.equal(agrupada.planos.tropezar.claves.length,antigua.planos.tropezar.claves.length,'El plano 06 conserva todas las claves, incluso fuera del intervalo visible');
  assert.equal(agrupada.planos.tropezar.claves[0].curva,'suave');
  for(const fps of [30,60,120])for(let i=0;i<2.59*fps;i++){
   const tiempo=i/fps,a=C.muestra(antigua.planos.tropezar.claves,tiempo*(version>=8?2.18:version===7?3.79:6.02)/2.59),b=C.muestra(agrupada.planos.tropezar.claves,tiempo);
   assert(Math.abs(a.pos[0]-b.pos[0])<1e-8,'El retime continuo conserva también el easing entre cuadros');
  }
 }
 assert.equal(JSON.stringify(M.validar(agrupada)),JSON.stringify(agrupada));
}
assert.throws(()=>M.validar({...M.nueva(),version:4,planos:{pies:{vista:'original',claves:[]}}}));
const parcial={...M.nueva(),version:3,planos:{carrera:{vista:'externa',claves:[k(0,1),k(3,4)]}}};
const migrada=C.agrupar(parcial,cuadros);assert(migrada.planos.tropezar.claves.length,'El final del antiguo plano de carrera sigue a la desaparición');
const sinEditar=cuadros.find(f=>f.accion==='levantarse');
assert.equal(C.tomaEn(migrada,sinEditar.estado).camara,null,'La recuperación no editada conserva la cámara programada en vivo');assert(migrada.planos.tropezar.nativas.includes('levantarse'));
assert(!migrada.planos.techo,'Sin cámaras de techo/cielo se conserva todo el nuevo POV programado');
const giroAnterior={...M.nueva(),version:1,planos:{voltear:{vista:'externa',claves:[k(0,4)]}}};
assert(!C.agrupar(giroAnterior,cuadros).planos.techo,'Una cámara antigua del giro externo no contamina el nuevo POV');
const juntas={...M.nueva(),version:6,planos:{tropezar:{vista:'externa',vistas:{voltear:'externa',buscar:'original'},claves:[k(0,1),k(.0011,2)]}}};
const ajustadas=C.agrupar(juntas,cuadros);assert.equal(ajustadas.planos.tropezar.claves.length,2);assert(!('voltear' in ajustadas.planos.tropezar.vistas));assert.equal(ajustadas.planos.tropezar.vistas.buscar,'original');
const cercanasV7={...M.nueva(),version:7,planos:{tropezar:{vista:'original',claves:[k(0,1),k(.0000011,2)]}}};
assert.equal(C.agrupar(M.validar(cercanasV7),cuadros).planos.tropezar.claves.length,2,'El retime conserva claves v7 muy próximas sin rechazarlas');
assert.equal(M.planoDeFase('cielo'),'techo');assert.equal(M.planoDeFase('cielo',2),'cielo');
assert.throws(()=>M.validar({...M.nueva(),planos:{carrera:{vista:'original',claves:[],vistas:{desaparece:'externa'}}}}));
assert.throws(()=>M.validar({...M.nueva(),planos:{tropezar:{vista:'original',claves:[],vistas:{voltear:'externa'}}}}));
const soloCarrera={...M.nueva(),version:1,planos:{carrera:{vista:'original',claves:[k(0,2),k(2,6)]}}};
const carreraMigrada=C.agrupar(soloCarrera,cuadros),slide=cuadros.find(f=>f.accion==='ataquePOV');
assert.equal(C.tomaEn(carreraMigrada,slide.estado).camara,null,'Alargar el slide no convierte una acción sin editar en cámara fija');
assert(carreraMigrada.planos.carrera.nativas.includes('ataquePOV'));
const techoV7={...M.nueva(),version:7,planos:{techo:{vista:'original',claves:[k(0,42),k(4.6,98)]}}};
const techoV9=C.agrupar(techoV7,cuadros),inicioGiro=cuadros.find(f=>f.accion==='voltear'&&f.tAccion===2);
assert.equal(C.tomaEn(techoV9,inicioGiro.estado).camara.pos[0],42,'Una cámara explícita v7 se conserva también durante la nueva estela');
assert(!techoV9.planos.techo.nativas.includes('voltear'),'El formato 7 no permite inferir qué claves creó el usuario');assert.equal(techoV9.planos.techo.nativasHasta.voltear,2);assert(techoV9.planos.techo.nativas.includes('hechizo'));
for(const nativas of [['inventada'],['voltear','voltear'],['buscar']])assert.throws(()=>M.validar({...M.nueva(),planos:{techo:{vista:'original',claves:[k(0,1)],nativas}}}));
assert.throws(()=>M.validar({...M.nueva(),version:7,planos:{techo:{vista:'original',claves:[k(0,1)],nativas:['voltear']}}}));
assert.equal(M.planoDeFase('hechizo'),'techo');assert(!M.planos.includes('hechizo'));
for(const duracionAnterior of [1.55,1.98,2.31]){
 const antigua={...M.nueva(),version:8,planos:{carrera:{vista:'original',claves:[k(0,0),k(5,50)]}}};
 const e={fase:'carrera',t:.775,tPlano:.775,duracionCarreraAnterior:duracionAnterior};
 assert(Math.abs(C.tomaEn(antigua,e).camara.pos[0]-duracionAnterior*5)<1e-8,'La carrera antigua conserva su reloj variable');
 e.fase='ataquePOV';e.t=.275;e.tPlano=1.825;assert(Math.abs(C.tomaEn(antigua,e).camara.pos[0]-(duracionAnterior+.48)*10)<1e-8,'El slide anterior empieza después de toda su carrera');
}
const nativa8={...M.nueva(),version:8,planos:{techo:{vista:'original',claves:[k(2.6,42),k(5,90)],nativas:['voltear']}}};
const nativa9=C.agrupar(nativa8,cuadros);assert(nativa9.planos.techo.nativas.includes('voltear'));
for(const f of cuadros.filter(f=>f.accion==='voltear'||f.accion==='hechizo'))assert.equal(C.tomaEn(nativa9,f.estado).camara,null,'Las nativas v8 y el nuevo hechizo permanecen programados');
const fueraDePlano={...M.nueva(),version:8,planos:{tropezar:{vista:'original',claves:[k(0,1),k(60,5)]}}};
const ampliada=C.agrupar(M.validar(fueraDePlano),cuadros);assert.equal(ampliada.planos.tropezar.claves.length,2);assert(ampliada.planos.tropezar.claves[1].t>60,'Al ampliar el plano se conservan también las claves antiguas fuera de su intervalo visible');
for(const nativasHasta of [[],null,{inventada:2},{voltear:-1},{voltear:NaN}])assert.throws(()=>M.validar({...M.nueva(),planos:{techo:{vista:'original',claves:[k(0,1)],nativasHasta}}}));
assert.throws(()=>M.validar({...M.nueva(),version:8,planos:{techo:{vista:'original',claves:[k(0,1)],nativasHasta:{voltear:2}}}}));
console.log('✓ Formato 9: diez planos, carrera variable adaptada a F093, migración 1–8, retime de planos 05/06/07, hold nativo de dos segundos, hechizo nuevo y reloj idéntico en editor/juego.');
