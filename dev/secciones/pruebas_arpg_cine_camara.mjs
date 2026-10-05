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
for(const alterar of [x=>x.version=13,x=>x.revision='otra',x=>x.planos.salida.claves[0].pos=[NaN,0,0],x=>x.planos.salida.claves[0].fov=0,x=>x.planos.salida.claves[0].rot=[0,0,0,0],x=>x.planos.salida.claves[0].t=-1,x=>x.planos.salida.claves.push(k(0,4)),x=>x.planos.inventado={vista:'externa',claves:[]}]){const malo=JSON.parse(JSON.stringify(v));alterar(malo);assert.throws(()=>M.validar(malo));}
const vuelta=M.validar(JSON.parse(JSON.stringify(v)));assert.equal(vuelta.planos.salida.claves.length,2);assert(!vuelta.planos.vertigo,'Un plano sin edición conserva su cámara del guion');
console.log('✓ Tomas de cámara: posiciones, focal, rotación normalizada, interpolaciones, cortes exactos, 30/60/120 FPS e importación validada.');

// Diez planos estables; el giro se inicia únicamente tras el corte al POV.
assert.equal(M.planos.length,10);assert.equal(M.VERSION,12);
assert.equal(M.planoDeFase('ataquePOV'),'carrera');assert.equal(M.planoDeFase('desaparece'),'tropezar');
for(const f of ['tropezar','buscar','levantarse'])assert.equal(M.planoDeFase(f),'tropezar');
assert.equal(M.planoDeFase('voltear'),'techo');assert.equal(M.planoDeFase('voltear',6),'tropezar');
assert(M.fases.indexOf('levantarse')<M.fases.indexOf('tropezar'));
const duracion={salida:3.6,descubrir:3.4,vertigo:1,pies:79/60,carrera:93/60,ataquePOV:.55,desaparece:.35,levantarse:.3,tropezar:.74,buscar:1.2,voltear:4.6,techo:1.4,hechizo:3.7,cielo:1.7,caida:1,impacto:1,negro:1};
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
 if(f.accion==='salida')return Math.max(0,f.tAccion-1);
 if(f.accion==='descubrir')return f.tAccion*2.4/3.4;
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
 const intacta=JSON.stringify(antigua);M.validar(antigua);const agrupada=C.agrupar(antigua,cuadros);assert.equal(agrupada.version,12);
 assert.equal(JSON.stringify(antigua),intacta,'La migración nunca modifica el documento original');
 for(const f of cuadros){
  const runtime=C.tomaEn(antigua,f.estado),convertida=C.tomaEn(agrupada,f.estado);
  if(f.accion==='pies'&&version<5){assert.equal(convertida.camara,null,'El insert nuevo conserva su cámara original');continue;}
  const esperado=f.accion==='hechizo'||f.accion==='voltear'&&(version<7||f.tAccion<2)?null:C.muestra(antigua.planos[M.planoDeFase(f.accion,version)].claves,relojAnterior(version,f));
  if(!esperado){assert.equal(runtime.camara,null);assert.equal(convertida.camara,null);assert.equal(runtime.vista,convertida.vista,'El hold y las fases nativas conservan la vista entre runtime y editor');}
  else {assert(Math.abs(convertida.camara.pos[0]-esperado.pos[0])<1e-8,`La migración v${version} conserva el encuadre en ${f.accion} ${f.tAccion}`);assert(Math.abs(runtime.camara.pos[0]-convertida.camara.pos[0])<1e-8,'El juego y el editor evalúan el mismo montaje antiguo');}
 }
 assert.equal(JSON.stringify(agrupada.planos.salida.claves.map(k=>({...k,t:k.t-1}))),JSON.stringify(antigua.planos.salida.claves),'El segundo de patada se antepone sin alterar el recorrido de cámara');
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
console.log('✓ Formato 10: diez planos, carrera variable adaptada a F093, migración 1–8, retime de planos 05/06/07, hold nativo de dos segundos, hechizo nuevo y reloj idéntico en editor/juego.');

// v9 ya conoce todos los planos y las cámaras editadas del hold/hechizo.
// La migración acumula paneo, patada previa y pausa final del hechizo.
const manual9={...M.nueva(),version:9,nombre:'Encuadres conservados',planos:{
 salida:{vista:'externa',claves:[k(0,11),k(2,12,30,'suave')]},
 descubrir:{vista:'original',vistas:{descubrir:'externa'},claves:[k(0,20,30,'suave'),k(.48,23,37,'corte'),k(1.2,31,50),k(2.4,42,70)],nativasHasta:{descubrir:.12}},
 carrera:{vista:'original',claves:[k(0,50),k(2.1,71)]},
 tropezar:{vista:'externa',claves:[k(0,82,34,'suave'),k(2.59,100)],nativas:['buscar']},
 techo:{vista:'original',vistas:{hechizo:'externa'},claves:[k(0,123),k(1,135),k(6,180),k(10.7,200)],nativasHasta:{voltear:.35}},
 caida:{vista:'externa',claves:[k(0,211)]}
}};
const antes9=JSON.stringify(manual9),manual10=C.agrupar(M.validar(manual9),cuadros);
assert.equal(JSON.stringify(manual9),antes9);assert.equal(manual10.version,12);assert.equal(C.agrupar(manual10,cuadros),manual10,'No se vuelve a estirar una toma v10');
for(const [id,p]of Object.entries(manual9.planos)){
 if(id==='salida'){assert.equal(JSON.stringify(manual10.planos[id].claves.map(k=>({...k,t:k.t-1}))),JSON.stringify(p.claves));continue;}
 if(id==='techo')continue;
 if(id!=='descubrir'){assert.deepEqual(JSON.parse(JSON.stringify(manual10.planos[id])),JSON.parse(JSON.stringify(p)),'La migración deja intacta toda la pista '+id);continue;}
 assert.equal(manual10.planos[id].claves.length,p.claves.length);
 p.claves.forEach((clave,i)=>{const convertida=manual10.planos[id].claves[i];assert(Math.abs(convertida.t-clave.t*3.4/2.4)<1e-12);assert.equal(JSON.stringify({...convertida,t:clave.t}),JSON.stringify(clave),'Se conservan posición, giro, focal, distancia y curva');});
 assert(Math.abs(manual10.planos[id].nativasHasta.descubrir-.17)<1e-12);
 assert.equal(JSON.stringify(manual10.planos[id].vistas),JSON.stringify(p.vistas));
}
for(const fps of [30,60,120])for(let i=0;i<=fps*3.4;i++){
 const tiempo=i/fps,estado={fase:'descubrir',t:tiempo,tPlano:tiempo},antigua=C.tomaEn(manual9,estado),nueva=C.tomaEn(manual10,estado);
 assert.equal(antigua.vista,nueva.vista);assert.equal(antigua.camara===null,nueva.camara===null);
 if(antigua.camara){assert(Math.abs(antigua.camara.pos[0]-nueva.camara.pos[0])<1e-9);assert(Math.abs(antigua.camara.fov-nueva.camara.fov)<1e-9);}
}
for(const cuadro of cuadros.filter(f=>f.accion!=='descubrir')){
 const a=C.tomaEn(manual9,cuadro.estado),b=C.tomaEn(manual10,cuadro.estado);
 assert.equal(a.vista,b.vista);assert.equal(a.camara===null,b.camara===null);
 if(a.camara)for(const campo of ['pos','rot','fov','distancia']){const valores=x=>[].concat(x.camara[campo]);valores(a).forEach((n,i)=>assert(Math.abs(n-valores(b)[i])<1e-9,'Editor y juego conservan el reloj de '+cuadro.accion));}
}
assert(C.tomaEn(manual10,{fase:'voltear',t:.5,tPlano:.5}).camara,'El hold editado en v9 no vuelve a cámara nativa');
assert.equal(C.tomaEn(manual10,{fase:'hechizo',t:0,tPlano:6}).camara.pos[0],180,'El hechizo editado en v9 no se descarta');
const extremos9={...M.nueva(),version:9,planos:{descubrir:{vista:'original',claves:[k(0,1),k(120,2)],nativasHasta:{descubrir:60}}}};
const extremos10=C.agrupar(M.validar(extremos9),cuadros);assert.equal(extremos10.planos.descubrir.claves.length,2);assert(Math.abs(extremos10.planos.descubrir.claves[1].t-170)<1e-10);M.validar(extremos10);
console.log('✓ v9→v12: paneo, patada y pausa acumulados; encuadres, easing, cortes, intervalos nativos y demás pistas conservados.');

// Las tomas v10 reciben la patada previa y la pausa del hechizo; el resto es idéntico.
const manualV10={...manual9,version:10,planos:JSON.parse(JSON.stringify(manual9.planos))};
manualV10.planos.salida.nativasHasta={salida:.25};
const copiaV10=JSON.stringify(manualV10),manualV11=C.agrupar(M.validar(manualV10),cuadros);
assert.equal(JSON.stringify(manualV10),copiaV10);assert.equal(manualV11.version,12);
assert.equal(manualV11.planos.salida.nativasHasta.salida,1.25);
for(const [id,p] of Object.entries(manualV10.planos))if(!['salida','techo'].includes(id))assert.deepEqual(JSON.parse(JSON.stringify(manualV11.planos[id])),JSON.parse(JSON.stringify(p)));
for(const fps of [30,60,120])for(let i=0;i<3.6*fps;i++){
 const t=i/fps,estado={fase:'salida',t,tPlano:t};
 assert.equal(JSON.stringify(C.tomaEn(manualV10,estado)),JSON.stringify(C.tomaEn(manualV11,estado)));
}
assert.equal(C.agrupar(manualV11,cuadros),manualV11,'Reabrir no vuelve a desplazar la salida');
console.log('✓ v10→v12: patada previa y pausa final, cámaras, curvas y resto del montaje conservados.');

// v12 inserta 42 cuadros después de los rayos y antes de mirar al meteorito.
const estado07=t=>{const fase=t<4.6?'voltear':t<6?'techo':t<9.7?'hechizo':'cielo',inicio={voltear:0,techo:4.6,hechizo:6,cielo:9.7};return {fase,t:t-inicio[fase],tPlano:t,total:100+t,inicios:Object.fromEntries(Object.entries(inicio).map(([f,v])=>[f,100+v]))};};
function mismaCamara(a,b,mensaje){
 assert.equal(a===null,b===null,mensaje);if(!a)return;
 for(const campo of ['pos','rot','fov','distancia'])[].concat(a[campo]).forEach((n,i)=>assert(Math.abs(n-[].concat(b[campo])[i])<1e-8,`${mensaje}: ${campo} ${n} / ${[].concat(b[campo])[i]}`));
}
for(const curva of ['suave','lineal','corte']){
 const a=k(6.2,13,32,curva),b=k(10.4,47,78);a.distancia=3;b.distancia=26;
 a.rot=new T.Quaternion().setFromEuler(new T.Euler(.4,-.8,.12)).toArray();b.rot=new T.Quaternion().setFromEuler(new T.Euler(-.5,1.6,-.3)).toArray();
 const original={...manual9,version:11,planos:{...manual9.planos,techo:{vista:'externa',claves:[k(0,-2),a,b,k(14,70)]}}},copia=JSON.stringify(original),convertida=C.agrupar(M.validar(original),cuadros);
 assert.equal(JSON.stringify(original),copia);assert.equal(convertida.version,12);assert.equal(C.agrupar(convertida,cuadros),convertida);
 for(const [id,p]of Object.entries(original.planos))if(id!=='techo')assert.deepEqual(JSON.parse(JSON.stringify(convertida.planos[id])),JSON.parse(JSON.stringify(p)),'v11 conserva íntegra la pista '+id);
 assert.equal(convertida.planos.techo.claves.length,original.planos.techo.claves.length+2);
 for(const clave of original.planos.techo.claves){const tiempo=clave.t>=9?clave.t+.7:clave.t,nueva=convertida.planos.techo.claves.find(k=>k.t===tiempo);assert(nueva,'Conserva cada clave y desplaza sólo las que empiezan en 9 s');assert.equal(nueva.curva,clave.curva);mismaCamara(nueva,clave,'Conserva datos originales');}
 assert.equal(JSON.stringify(M.validar(convertida)),JSON.stringify(convertida),'El tramo suave sobrevive guardar, validar y reabrir');
 for(const fps of [30,60,120])for(let f=0;f<=14.7*fps;f++){
  const t=f/fps,pausa=t>=9&&t<9.7,previo=t<9?t:t<9.7?9:t-.7,esperada=C.muestra(original.planos.techo.claves,previo),nueva=C.tomaEn(convertida,estado07(t));
  mismaCamara(nueva.camara,esperada,`Easing ${curva} a ${fps} FPS en ${t}`);
  mismaCamara(C.tomaEn(original,estado07(t)).camara,nueva.camara,'Retiming directo y documento migrado coinciden');
  if(pausa)mismaCamara(nueva.camara,C.muestra(original.planos.techo.claves,9),'Los 42 cuadros de pausa quedan inmóviles');
 }
 for(const t of [8.03173,8.9991,9.07777,9.69821,9.7001,10.12345,11.03456])mismaCamara(C.muestra(convertida.planos.techo.claves,t),C.muestra(original.planos.techo.claves,t<9?t:t<9.7?9:t-.7),'El easing también se conserva entre cuadros');
}
const corte9={...M.nueva(),version:11,planos:{techo:{vista:'original',claves:[k(0,13,42,'corte'),k(9,44,55,'suave'),k(10.7,80)]}}},corte12=C.agrupar(M.validar(corte9),cuadros);
assert.equal(corte12.planos.techo.claves.find(k=>k.pos[0]===44).t,9.7);
for(const t of [8.99,9,9.1,9.5,9.699]){assert.equal(C.tomaEn(corte9,estado07(t)).camara.pos[0],13);assert.equal(C.tomaEn(corte12,estado07(t)).camara.pos[0],13,'Un corte en 9 s espera al final de la pausa');}
for(const t of [9.7-1e-10,9.7,9.71,10.4])mismaCamara(C.tomaEn(corte9,estado07(t)).camara,C.tomaEn(corte12,estado07(t)).camara,'El corte conserva su cuadro exacto y la interpolación posterior');
for(const hasta of [2.5,3,3.2,120]){
 const anterior={...corte9,planos:{techo:{...corte9.planos.techo,nativasHasta:{hechizo:hasta}}}},nueva=C.agrupar(M.validar(anterior),cuadros);
 assert.equal(nueva.planos.techo.nativasHasta.hechizo,hasta>=3?hasta+.7:hasta);
 for(const t of [6,8.49,8.5,8.99,9,9.35,9.699,9.7,9.71])mismaCamara(C.tomaEn(anterior,estado07(t)).camara,C.tomaEn(nueva,estado07(t)).camara,'El intervalo nativo incluye la pausa cuando ya llegaba al final del hechizo');
}
for(const claves of [[],[k(0,85)],[k(11,85)],[k(0,85),k(8,90)]]){
 const anterior={...M.nueva(),version:11,planos:{techo:{vista:'original',claves}}},nueva=C.agrupar(anterior,cuadros);
 assert.equal(nueva.planos.techo.claves.length,claves.length,'Una cámara constante no necesita claves de pausa');
 for(const t of [8.9,9,9.4,9.7,11])mismaCamara(C.tomaEn(anterior,estado07(t)).camara,C.tomaEn(nueva,estado07(t)).camara,'Pistas vacías o constantes conservadas');
}
const maximas={...M.nueva(),version:11,planos:{techo:{vista:'original',claves:Array.from({length:1500},(_,i)=>k(i*240/1499,i%100))},salida:{vista:'original',claves:Array.from({length:1500},(_,i)=>k(i/10,0))},descubrir:{vista:'original',claves:Array.from({length:1500},(_,i)=>k(i/10,0))},caida:{vista:'original',claves:Array.from({length:500},(_,i)=>k(i/10,0))}}};
const ampliadas12=C.agrupar(M.validar(maximas),cuadros);assert.equal(ampliadas12.planos.techo.claves.length,1502);assert.equal(ampliadas12.planos.techo.claves.at(-1).t,240.7);M.validar(ampliadas12);
for(const tramoSuave of [null,[],[0,0],[.5,.4],[-1,1],[0,2],[0,NaN],[0,1,2]])assert.throws(()=>M.validar({...M.nueva(),planos:{techo:{vista:'original',claves:[{...k(0,1),tramoSuave}]}}}));
assert.throws(()=>M.validar({...M.nueva(),version:11,planos:{techo:{vista:'original',claves:[{...k(0,1),tramoSuave:[0,.5]}]}}}));
console.log('✓ v11→v12: pausa inmóvil de 0.7 s, easing intacto antes/después, cortes exactos, reloj directo idéntico, cámaras nativas y 5000 claves antiguas conservadas.');
