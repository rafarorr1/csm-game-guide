/* Great Sword: contacto, agarre, impactos y giro sin bloquear las habilidades. */
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {extraerDeclaracion} from './fuentes.mjs';
const c=vm.createContext({console,atob});c.window=c;
for(const f of ['visor-three-vendor.js','adreida-scenario/combate.js','arpg-three-adreida-animacion.js','adreida-scenario/datos.js','arpg-three-adreida.js','hacha-adreida-scenario/datos.js','arpg-three-hacha-adreida.js','arpg-three-modelos.js'])vm.runInContext(fs.readFileSync(new URL(f,import.meta.url),'utf8'),c,{filename:f});
const T=c.CAOZ_THREE.THREE,F=c.CAOZ_ARPG_MODELOS.fabrica(T),m=F.crear('adreida'),v=new T.Vector3(),cuerpo=m.mallas[0],a=cuerpo.geometry.attributes;
const botas=Array.from({length:a.position.count},(_,i)=>i).filter(i=>a.position.getY(i)<.24);
let poses=0,errorMax=0;
for(const anim of ['parry','tajoA','revesA','estocadaA','giro180'])for(const sentidoGiro of anim==='giro180'?[-1,1]:[0])for(let i=0;i<=120;i++){
  F.posar(m,{anim,k:i/120,sentidoGiro,t:i/120});m.raiz.updateMatrixWorld(true);
  const apoyo=m.H.manoD.localToWorld(new T.Vector3(0,-.3,0)),error=apoyo.distanceTo(m.H.manoI.getWorldPosition(v));errorMax=Math.max(errorMax,error);
  assert.ok(error<.005,`${anim} ${i}: ambas manos sobre el mango (${error} m)`);
  let min=Infinity;for(const j of botas)min=Math.min(min,cuerpo.getVertexPosition(j,v).y);
  assert.ok(min>-.003&&min<.02,`${anim} ${i}: suelas sobre el suelo (${min} m)`);
  for(const b of Object.values(m.H))assert.ok(Number.isFinite(b.quaternion.lengthSq())&&Math.abs(b.quaternion.lengthSq()-1)<1e-4,'Rotaciones finitas y unitarias');
  poses++;
}
for(const [anim,k] of [['tajoA',.5],['revesA',.5],['estocadaA',.39/.8]]){
  F.posar(m,{anim,k});m.raiz.updateMatrixWorld(true);
  const punta=m.H.manoD.localToWorld(new T.Vector3(0,-1.15,0));
  assert.ok(punta.z>.6,`${anim}: el filo pasa frente al enemigo al calcular el daño`);
  assert.equal(F.animacion.clipCombate({anim,potencia:1}),null,'El cargado conserva su animación');
}
assert.ok(Math.abs(F.animacion.avanceGiro(0))<1e-5);assert.ok(Math.abs(F.animacion.avanceGiro(1)-1)<1e-5);
// Ejecutar el controlador real a diferentes frecuencias, sin navegador ni reloj artificial.
const fuente=fs.readFileSync(new URL('arpg-three-mesa.js',import.meta.url),'utf8');
Object.assign(c,{MOD:F,V3:T.Vector3,rumbo:(a,b)=>Math.atan2(b.x-a.x,b.z-a.z),difAng:(a,b)=>Math.atan2(Math.sin(b-a),Math.cos(b-a))});
vm.runInContext(extraerDeclaracion(fuente,'orientarAdreida').texto+'\n'+extraerDeclaracion(fuente,'cambiar').texto,c);
for(const fps of [30,60,144])for(const signo of [-1,1]){
 const h={dir:0},mov=new T.Vector3(Math.sin(signo*3),0,Math.cos(signo*3));c.orientarAdreida(h,mov,1/fps);
 assert.ok(h.giro180);assert.equal(Math.sign(h.giro180.delta),signo);assert.ok(Math.abs(h.dir-signo*3)<1e-6);
 let pasos=0;while(h.giro180&&pasos++<fps)c.orientarAdreida(h,mov,1/fps);
 assert.ok(pasos/fps>=.46-1e-8&&pasos/fps<=.46+1/fps,'Giro de 0,46 s independientemente de FPS');
 c.orientarAdreida(h,mov,1/fps);assert.equal(h.giro180,null,'No se repite por mantener el stick');
}
for(const estado of ['parry','esquiva','salto','carga','golpe','muerta']){const h={dir:0};c.orientarAdreida(h,new T.Vector3(0,0,-1),.016);c.cambiar(h,estado);assert.equal(h.giro180,null,'La habilidad interrumpe el giro');assert.equal(h.estado,estado);}
for(const delta of [.2,.8,2]){const h={dir:0};c.orientarAdreida(h,new T.Vector3(Math.sin(delta),0,Math.cos(delta)),.016);assert.ok(!h.giro180,'Giros menores conservan la carrera');}
assert.equal(m.mallas.length,2,'No añade modelos ni mallas a la partida');
console.log(`✓ Great Sword: ${poses} poses, contacto con el suelo, agarre (${(errorMax*1000).toFixed(2)} mm), impactos y pivote a 30/60/144 FPS.`);
