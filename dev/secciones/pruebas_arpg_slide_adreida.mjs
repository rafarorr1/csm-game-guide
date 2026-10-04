/* El ataque deslizante usa el FBX sobre Adreida, sin sustituir su cuerpo ni su agarre. */
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const c=vm.createContext({console,atob});c.window=c;
for(const f of ['visor-three-vendor.js','adreida-scenario/combate.js','arpg-three-adreida-animacion.js','adreida-scenario/datos.js','adreida-piernas-scenario/datos.js','arpg-three-adreida.js','hacha-adreida-scenario/datos.js','arpg-three-hacha-adreida.js','arpg-three-modelos.js','adreida-scenario/cinematica.js','arpg-three-adreida-cine.js'])vm.runInContext(fs.readFileSync(new URL(f,import.meta.url),'utf8'),c,{filename:f});
const T=c.CAOZ_THREE.THREE,F=c.CAOZ_ARPG_MODELOS.fabrica(T),A=c.CAOZ_ARPG_ADREIDA_CINE.fabrica(T,F),m=F.crear('adreida'),otro=F.crear('adreida'),clip=c.CAOZ_ADREIDA_CINE_CLIPS.deslizarAtaque;
assert(clip&&clip.muestras>20&&clip.duracion>1,'Existe un clip completo extraído de Great Sword Slide Attack');
assert.equal(clip.ancho,3+clip.huesos.length*4);assert.equal(clip.datos.length,clip.muestras*clip.ancho);assert(clip.datos.every(Number.isFinite));
assert.equal(clip.raiz.length,clip.muestras*3);assert(clip.raiz.every(Number.isFinite));assert(Math.hypot(...clip.raiz.slice(0,3))<1e-6);assert(clip.raiz.at(-1)>1,'El clip conserva el avance real para adaptarlo a la plaza');
for(let i=0;i<clip.muestras;i++){assert.equal(clip.datos[i*clip.ancho],0);assert.equal(clip.datos[i*clip.ancho+2],0,'El desplazamiento no se aplica a la vez en cuerpo y raíz');assert.equal(clip.raiz[i*3+1],0,'La altura del cuerpo se conserva en la pose');}
for(const n of clip.huesos)assert(m.H[n]?.isBone,'El clip sólo anima huesos existentes: '+n);
for(let i=0;i<clip.muestras;i++)for(let j=0;j<clip.huesos.length;j++){const q=clip.datos.slice(i*clip.ancho+3+j*4,i*clip.ancho+7+j*4);assert(Math.abs(Math.hypot(...q)-1)<.00001,'Cuaterniones unitarios sin saltos de escala');}
const mesh=m.mallas[0],g=mesh.geometry,v=new T.Vector3(),vertices=g.attributes.position.array.slice(),indices=g.index.array.slice();
F.posar(m,{anim:'quieto',mezclar:false});m.raiz.updateMatrixWorld(true);const alturaReposo=m.H.cabeza.getWorldPosition(v).y;
F.posar(otro,{anim:'quieto',mezclar:false});const poseOtro=A.capturar(otro);
let errorManos=0,alturaMin=Infinity,pisoMin=Infinity;
for(let i=0;i<=60;i++){
 const k=i/60;A.deslizar(m,k);m.raiz.updateMatrixWorld(true);
 alturaMin=Math.min(alturaMin,m.H.cabeza.getWorldPosition(v).y);
 const apoyo=m.H.manoD.localToWorld(new T.Vector3(0,-.3,0)),error=apoyo.distanceTo(m.H.manoI.getWorldPosition(v));errorManos=Math.max(errorManos,error);
 assert(error<.006,`Ambas manos sujetan el mismo mango al deslizar: ${k}, ${error} m`);
 assert.deepEqual(Array.from(mesh.morphTargetInfluences),[1,1],'Los dedos permanecen cerrados sobre el hacha');
 for(const b of Object.values(m.H))assert(Number.isFinite(b.position.length()+b.quaternion.lengthSq())&&Math.abs(b.quaternion.lengthSq()-1)<.00002);
 // Muestra uniforme de piel deformada: incluye rodillas, botas, cadera y manos.
 for(let j=0;j<g.attributes.position.count;j+=13)pisoMin=Math.min(pisoMin,mesh.getVertexPosition(j,v).y);
}
assert(alturaMin<alturaReposo-.25,'Adreida baja el cuerpo de forma visible para deslizarse');
assert(pisoMin>-.04,`La piel del cuerpo no se hunde bajo el pavimento (${pisoMin} m)`);
assert.equal(m.mallas.length,2,'El clip no añade una copia del maniquí ni nuevas llamadas de dibujo');
assert.equal(mesh.geometry,otro.mallas[0].geometry);assert.deepEqual(g.attributes.position.array,vertices);assert.deepEqual(g.index.array,indices,'La animación no modifica la geometría compartida');
for(const [nombre,q] of Object.entries(poseOtro.rot))assert(q.angleTo(otro.H[nombre].quaternion)<1e-7,'Animar un personaje no mueve otro');
// Las búsquedas se calculan desde el tiempo absoluto, sin acumular movimientos.
const estados=new Map();for(const k of [0,.18,.43,.67,.84,1]){A.deslizar(m,k);estados.set(k,A.capturar(m));}
for(const k of [1,.18,.84,0,.67,.43,.18]){A.deslizar(m,k);const p=estados.get(k);assert(m.H.cuerpo.position.distanceTo(p.pos)<1e-8);for(const [nombre,q] of Object.entries(p.rot))assert(q.angleTo(m.H[nombre].quaternion)<1e-6,'Buscar restaura el mismo hueso: '+nombre);}
const guardada=A.capturar(m);A.deslizar(m,.91);A.restaurar(m,guardada);assert(m.H.cuerpo.position.equals(guardada.pos));for(const [nombre,q] of Object.entries(guardada.rot))assert(q.angleTo(m.H[nombre].quaternion)<1e-6);
console.log(`✓ Slide de Adreida: ${clip.muestras} muestras, 61 poses, cuerpo ${(alturaReposo-alturaMin).toFixed(2)} m más bajo, agarre ${(errorManos*1000).toFixed(2)} mm, suelo ${(pisoMin*1000).toFixed(1)} mm y búsquedas reversibles sin cambiar geometría.`);
