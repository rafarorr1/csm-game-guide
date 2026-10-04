/* Adreida de Scenario: deformación, escala, búmeran y recursos de Adreidos. */
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {recursosAdreida,entornoArpgThree} from './arpg-three-exportar.mjs';
const c=vm.createContext({console,atob});c.window=c;
for(const f of ['visor-three-vendor.js','arpg-three-adreida-animacion.js','adreida-scenario/datos.js','arpg-three-adreida.js','hacha-adreida-scenario/datos.js','arpg-three-hacha-adreida.js','arpg-three-modelos.js'])vm.runInContext(fs.readFileSync(new URL(f,import.meta.url),'utf8'),c,{filename:f});
const {THREE}=c.CAOZ_THREE,F=c.CAOZ_ARPG_MODELOS.fabrica(THREE),m=F.crear('adreida'),otro=F.crear('adreida'),clasico=F.crear('adreida',{modeloAdreida:'clasico'});
const cuerpo=m.mallas[0],g=cuerpo.geometry,a=g.attributes;
assert.equal(m.modeloAdreida,'scenario');assert.equal(g.index.count/3,15408);assert.equal(m.mallas.length,2);
assert.equal(m.alto,clasico.alto);assert.equal(m.radio,clasico.radio);assert.deepEqual(m.p,clasico.p);
g.computeBoundingBox();assert.ok(Math.abs(g.boundingBox.max.y-g.boundingBox.min.y-1.913112)<.0001,'Altura del modelo aprobado');
assert.equal(g,otro.mallas[0].geometry,'Adreidos reutiliza el cuerpo');assert.notEqual(cuerpo.skeleton,otro.mallas[0].skeleton);assert.notEqual(m.M.u,otro.M.u,'Efectos independientes');
for(let i=0;i<a.position.count;i++){
 let suma=0;for(let j=0;j<4;j++){const w=a.skinWeight.array[i*4+j];assert.ok(w>=0&&w<=1);suma+=w;assert.ok(a.skinIndex.array[i*4+j]<cuerpo.skeleton.bones.length);}assert.ok(Math.abs(suma-1)<1e-5);
}
// Las superficies próximas de mano y falda no pueden compartir pesos.
for(let i=0;i<a.position.count;i++){
 const influyentes=Array.from({length:4},(_,j)=>a.skinWeight.array[i*4+j]>.01?cuerpo.skeleton.bones[a.skinIndex.array[i*4+j]]:null);
 if(influyentes.some(b=>b&&[m.H.manoI,m.H.manoD].includes(b)))assert.ok(!influyentes.some(b=>b&&['cadera','piernaI','piernaD',...Array.from({length:7},(_,j)=>'falda'+j)].some(n=>m.H[n]===b)),'Mano sin pesos de falda o pierna');
}
const v=new THREE.Vector3();let poses=0;
// Regresión: el agarre cruzado debe rodear el pecho; no basta con que la mano
// alcance el mango si el codo o la superficie del antebrazo quedan dentro del torso.
const antebrazoIzquierdo=[];
for(let i=0;i<a.position.count;i++){
 let peso=0;for(let j=0;j<4;j++)if(cuerpo.skeleton.bones[a.skinIndex.array[i*4+j]]===m.H.anteI)peso+=a.skinWeight.array[i*4+j];
 if(peso>.85)antebrazoIzquierdo.push(i);
}
assert.ok(antebrazoIzquierdo.length>50,'La prueba mide la superficie del antebrazo');
for(const anim of ['quieto'])for(let i=0;i<50;i++){
 F.posar(m,{anim,t:i/50,fase:i/50*Math.PI*2,paso:1});m.raiz.updateMatrixWorld(true);
 assert.ok(m.H.torso.worldToLocal(m.H.anteI.getWorldPosition(v)).z>.24,anim+': codo delante del pecho');
 for(const j of antebrazoIzquierdo){cuerpo.getVertexPosition(j,v).applyMatrix4(cuerpo.matrixWorld);m.H.torso.worldToLocal(v);assert.ok(v.z>.18,anim+': antebrazo fuera del torso');}
}
for(let i=0;i<100;i++){
 F.posar(m,{anim:'andar',fase:i/100*Math.PI*2,paso:1});m.raiz.updateMatrixWorld(true);
 for(const j of antebrazoIzquierdo){cuerpo.getVertexPosition(j,v).applyMatrix4(cuerpo.matrixWorld);m.H.torso.worldToLocal(v);assert.ok(v.x>.20,'El antebrazo libre no atraviesa el cuerpo al correr');}
}
// Apoyo real: al avanzar una zancada, el pie apoyado debe conservar su posición
// sobre el suelo. Revisar también velocidades de mando y extremos del inspector.
const botas=Array.from({length:a.position.count},(_,i)=>i).filter(i=>a.position.getY(i)<.24);
for(const paso of [.15,.3,.55,1])for(const zancada of [.75,1,1.15]){
 const cfg=F.animacion.configuracion();cfg.ajustes.zancada=zancada;F.animacion.configurar(cfg);
 const largo=F.animacion.longitudZancada(paso),r=Math.max(0,Math.min(1,(paso-.3)/.6)),contacto=.6-.2*r*r*(3-2*r);
 let min=Infinity,max=-Infinity,alturaMin=Infinity;
 for(let i=0;i<100;i++){
  const f=i/100;F.posar(m,{anim:'andar',fase:f*Math.PI*2,paso,t:f});m.raiz.updateMatrixWorld(true);
  if(f<contacto){m.H.pieI.getWorldPosition(v);const z=v.z+f*largo;min=Math.min(min,z);max=Math.max(max,z);}
  for(const j of botas){cuerpo.getVertexPosition(j,v);alturaMin=Math.min(alturaMin,v.y);}
 }
 if(paso<=.3)assert.ok(max-min<.012,`Apoyo de marcha sin patinar: paso ${paso}, zancada ${zancada}`); // Fast Run incluye rodadura de talón y punta; su tobillo no está fijo.
 assert.ok(alturaMin>-.002&&alturaMin<.015,'Las suelas llegan al piso sin hundirse');
}
F.animacion.restablecer();
// Fast Run conserva sus fases de apoyo y vuelo, la flexión profunda de rodilla
// y la misma pose aunque cambie la posición/orientación del personaje en la plaza.
let vuelo=0,apoyo=0,rodilla=0;
for(let i=0;i<120;i++){
 F.posar(m,{anim:'andar',fase:i/120*Math.PI*2,paso:1});m.raiz.updateMatrixWorld(true);let baja=Infinity;
 for(const j of botas)baja=Math.min(baja,cuerpo.getVertexPosition(j,v).y);
 if(baja>.05)vuelo++;if(baja<.015)apoyo++;
 rodilla=Math.max(rodilla,m.H.rodillaI.rotation.x,m.H.rodillaD.rotation.x);
}
assert.ok(vuelo>5&&apoyo>40,'La carrera conserva despegue, vuelo y contacto');
assert.ok(rodilla>1.8,'Recoge la pierna con la flexión del clip importado');
F.posar(m,{anim:'andar',fase:2.1,paso:.55});const altura=m.H.cuerpo.position.y;
m.raiz.position.set(17,0,-8);m.raiz.rotation.y=2.4;F.posar(m,{anim:'andar',fase:2.1,paso:.55});
assert.ok(Math.abs(m.H.cuerpo.position.y-altura)<1e-7,'El apoyo se calcula en el espacio del personaje');
m.raiz.position.set(0,0,0);m.raiz.rotation.set(0,0,0);
// No debe haber un salto de orientación al reiniciar el ciclo.
const articulaciones=['piernaI','rodillaI','pieI','piernaD','rodillaD','pieD'];
F.posar(m,{anim:'andar',fase:Math.PI*2-1e-5,paso:1});const fin=articulaciones.map(n=>m.H[n].quaternion.clone());
F.posar(m,{anim:'andar',fase:0,paso:1});articulaciones.forEach((n,i)=>assert.ok(m.H[n].quaternion.angleTo(fin[i])<.001,'Ciclo continuo: '+n));
for(const anim of ['quieto','andar','tajoA','revesA','estocadaA','parry','salto','torbellino','lanzarHachaA','recogerHachaA','grito','dolor','muerte'])for(const k of [0,.25,.5,.65,.8,1])for(const potencia of [0,1]){
 F.posar(m,{anim,k,potencia,t:k,fase:k*Math.PI*2,paso:1});m.raiz.updateMatrixWorld(true);
 for(let i=0;i<a.position.count;i++){cuerpo.getVertexPosition(i,v);assert.ok(Number.isFinite(v.x+v.y+v.z),anim+': deformación finita');assert.ok(v.length()<4,anim+': sin vértices disparados');}
 poses++;
}
// La adaptación no cambia los puntos de contacto del hacha ni sus animaciones.
for(const anim of ['quieto','andar','tajoA','revesA','estocadaA','salto','parry'])for(const k of [0,.5,1]){
 for(const h of [m,clasico]){F.posar(h,{anim,k,t:k,paso:1,fase:k*6});h.raiz.updateMatrixWorld(true);}
 for(const nombre of ['manoI','manoD','pieI','pieD'])assert.ok(m.H[nombre].getWorldPosition(v).distanceTo(clasico.H[nombre].getWorldPosition(new THREE.Vector3()))<1e-6,nombre+': mismo contacto');
}
const indiceCuerpo=g.index;
F.mostrarHacha(m,false);assert.equal(g.index,indiceCuerpo,'El búmeran no borra el cuerpo');assert.equal(m.hachaScenario.visible,false,'El hacha abandona las manos');assert.equal(otro.hachaScenario.visible,true,'Adreidos conserva su hacha');
const hacha=F.crearHachaAdreida(m),segunda=F.crearHachaAdreida(m);assert.equal(hacha.children.length,1);hacha.children.forEach((mesh,i)=>assert.equal(mesh.geometry,segunda.children[i].geometry));
F.mostrarHacha(m,true);assert.equal(g.index,indiceCuerpo);assert.equal(m.hachaScenario.visible,true,'El hacha vuelve completa');assert.ok(m.hachaScenario.geometry.index.count>0);
for(const f of recursosAdreida){assert.ok(fs.existsSync(new URL(f,import.meta.url)));assert.ok(entornoArpgThree.includes(f));}
for(const pagina of ['arpg-three.html','modelos-visor.html']){const html=fs.readFileSync(new URL(pagina,import.meta.url),'utf8');assert.ok(html.indexOf('adreida-scenario/datos.js')<html.indexOf('arpg-three-modelos.js'));assert.ok(html.includes('arpg-three-adreida.js'));}
console.log(`✓ Adreida Scenario: ${poses} poses, 1200 muestras de marcha, apoyo, suelas, continuidad, escala, pesos, hacha y Adreidos.`);
