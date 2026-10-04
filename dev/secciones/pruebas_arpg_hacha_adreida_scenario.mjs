/* Verifica el arma texturizada, su agarre rígido y su ida/vuelta como búmeran. */
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const c=vm.createContext({console,atob});c.window=c;
for(const f of ['visor-three-vendor.js','arpg-three-adreida-animacion.js','adreida-scenario/datos.js','arpg-three-adreida.js','hacha-adreida-scenario/datos.js','arpg-three-hacha-adreida.js','arpg-three-modelos.js'])vm.runInContext(fs.readFileSync(new URL(f,import.meta.url),'utf8'),c,{filename:f});
const T=c.CAOZ_THREE.THREE,F=c.CAOZ_ARPG_MODELOS.fabrica(T),m=F.crear('adreida'),otro=F.crear('adreida'),g=m.hachaScenario.geometry;
assert.equal(g,otro.hachaScenario.geometry,'Geometría compartida con Adreidos');
assert.notEqual(m.hachaScenario.material,otro.hachaScenario.material,'Destellos independientes');
assert.equal(m.mallas.length,2,'Cuerpo y arma en dos llamadas de dibujo');
assert(g.index.count/3<=4500,'Presupuesto del arma');
const mano=m.hachaScenario.skeleton.bones.indexOf(m.H.manoD),inversa=m.hachaScenario.skeleton.boneInverses[mano];
const puntos=Array.from({length:g.attributes.position.count},(_,i)=>new T.Vector3().fromBufferAttribute(g.attributes.position,i).applyMatrix4(inversa));
const caja=new T.Box3().setFromPoints(puntos),tam=caja.getSize(new T.Vector3());
assert(Math.abs(tam.y-1.625)<1e-4,'Longitud original');assert(Math.abs(tam.z-.76)<1e-4,'Ancho original');
assert(tam.x<.15,'Cabeza sin grosor exagerado');assert(Math.abs(caja.max.y-.305)<1e-4,'Origen junto al pomo');
for(const a of Object.values(g.attributes))assert(a.array.every(Number.isFinite));
assert.equal(g.attributes.uv.count,puntos.length);
for(const anim of ['quieto','andar','tajoA','revesA','estocadaA','parry','salto','torbellino','lanzarHachaA','recogerHachaA'])for(const k of [0,.25,.5,.75,1]){
  F.posar(m,{anim,k,potencia:1,t:k,fase:k*6.28,paso:1});m.raiz.updateMatrixWorld(true);
  for(let i=0;i<puntos.length;i+=17){
    const real=m.hachaScenario.getVertexPosition(i,new T.Vector3()).applyMatrix4(m.hachaScenario.matrixWorld);
    const esperado=m.H.manoD.localToWorld(puntos[i].clone());assert(real.distanceTo(esperado)<1e-5,anim+': el mango sigue la palma sin deformarse');
  }
}
const indice=g.index,uv=g.attributes.uv,proyectil=F.crearHachaAdreida(m).children[0],segundo=F.crearHachaAdreida(otro).children[0];
assert.equal(proyectil.geometry,segundo.geometry);assert.notEqual(proyectil.material,m.hachaScenario.material);
for(let i=0;i<10;i++){F.mostrarHacha(m,false);assert(!m.hachaScenario.visible);assert(otro.hachaScenario.visible);F.mostrarHacha(m,true);assert.equal(g.index,indice);assert.equal(g.attributes.uv,uv);}
assert.deepEqual(Array.from(proyectil.geometry.attributes.uv.array),Array.from(uv.array),'El vuelo conserva el atlas');
const shader={uniforms:{},vertexShader:'#include <common>\n#include <begin_vertex>',fragmentShader:'#include <common>\n#include <clipping_planes_fragment>\n#include <opaque_fragment>'};
m.hachaScenario.material.onBeforeCompile(shader);assert.equal(shader.uniforms.uDestello,m.M.u.uDestello);assert.equal(shader.uniforms.uDisuelve,m.M.u.uDisuelve);
console.log('✓ Hacha: escala, 50 poses rígidas, atlas, parry, disolución, diez lanzamientos y recursos compartidos.');
