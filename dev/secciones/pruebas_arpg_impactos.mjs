/* Ciclo de vida de cráteres y visibilidad de casas; lógica real, sin navegador. */
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {extraerDeclaracion} from './fuentes.mjs';
const c=vm.createContext({console});c.window=c;
for(const f of ['visor-three-vendor.js','arpg-three-impactos.js'])vm.runInContext(fs.readFileSync(new URL(f,import.meta.url),'utf8'),c);
const {THREE}=c.CAOZ_THREE,escena=new THREE.Scene(),fx=c.CAOZ_ARPG_IMPACTOS.fabrica(THREE,escena);
const piso=new THREE.MeshStandardMaterial({map:new THREE.Texture(),normalMap:new THREE.Texture()});
fx.actualizarMaterial(piso);fx.agujero(new THREE.Vector3(2,0,-3));assert.equal(fx.estado().crateres.length,1);
const crater=escena.children[0];
crater.geometry.computeBoundingBox();assert.ok(crater.geometry.boundingBox.min.y<-.3,'El fondo queda por debajo de la plaza');
assert.equal(crater.material[0].map,piso.map,'El labio comparte la textura del piso');
const shader={vertexShader:THREE.ShaderLib.standard.vertexShader,fragmentShader:THREE.ShaderLib.standard.fragmentShader,uniforms:{}};
piso.onBeforeCompile(shader);assert.equal(shader.uniforms.uHuecos.value[0].z,1.05);
fx.paso(3.5);assert.equal(shader.uniforms.uHuecos.value[0].w,1);
fx.paso(.75);assert.equal(shader.uniforms.uCantidadHuecos.value,1);assert.equal(shader.uniforms.uHuecos.value[0].w,.5);
assert.equal(shader.uniforms.uHuecos.value[0].z,1.05,'El agujero conserva su radio durante el desvanecimiento');
assert.deepEqual(Array.from(crater.scale.toArray()),[1.05,1,1.05],'No se contrae ni se hunde al desaparecer');
for(const material of crater.material){const sh={fragmentShader:THREE.ShaderLib.standard.fragmentShader,uniforms:{}};material.onBeforeCompile(sh);assert.equal(sh.uniforms.uCraterOpacidad.value,.5,'Pared y labio comparten la opacidad del hueco');}
fx.paso(.65);assert.equal(fx.estado().crateres.length,1);assert.ok(shader.uniforms.uHuecos.value[0].w<.02);
fx.paso(.11);assert.equal(fx.estado().crateres.length,0);assert.equal(shader.uniforms.uHuecos.value[0].z,0);assert.equal(shader.uniforms.uCantidadHuecos.value,0,'Piso sin cráteres omite cálculos por píxel');assert.equal(escena.children.length,0);
for(let i=0;i<20;i++)fx.agujero(new THREE.Vector3(i,0,0));assert.equal(fx.estado().crateres.length,8);assert.equal(escena.children.length,8);
fx.limpiar();assert.equal(escena.children.length,0);assert.ok(shader.uniforms.uHuecos.value.every(v=>v.z===0));
// La sima mantiene el labio a ras de la plaza; no estira adoquines por sus paredes.
fx.agujero(new THREE.Vector3(),{radio:8.4,profundidad:24,duracion:30});
const sima=escena.getObjectByName('Sima bajo Tomsage');sima.geometry.computeBoundingBox();
assert(sima.geometry.boundingBox.min.y<-24);assert(sima.geometry.boundingBox.max.y<.2);
assert.equal(sima.material[1].map,null,'Las paredes son roca, no pavimento estirado');
const ray=new THREE.Raycaster(new THREE.Vector3(0,1,0),new THREE.Vector3(0,-1,0));escena.updateMatrixWorld(true);
assert(ray.intersectObject(sima)[0].point.y<-24,'La profundidad existe en geometría, no sólo en color');fx.limpiar();
console.log('✓ Cráter bajo el piso, radio constante, desvanecimiento gradual y limpieza a los cinco segundos');
// La cinta usa los puntos mundiales del arma y se desvanece al terminar el ataque.
const raiz=new THREE.Group(),mano=new THREE.Object3D(),punta=new THREE.Object3D();
raiz.position.set(3,0,2);mano.position.set(0,1,0);punta.position.set(0,2,1);raiz.add(mano,punta);
const h={tipo:'adreida',estado:'golpe',carga:1,t:.25,m:{raiz,H:{manoD:mano},M:{punta}}};
fx.hacha(h,.016);raiz.position.x+=.2;fx.hacha(h,.016);
const cinta=escena.children[0];assert.equal(cinta.visible,true);
assert.ok(Math.abs(cinta.geometry.attributes.position.getX(0)-3.2)<1e-5,'La estela sigue el hacha en el mundo');
assert.ok(cinta.geometry.attributes.position.count<=40,'Geometría acotada');
h.estado='quieto';fx.hacha(h,.2);assert.equal(cinta.visible,false);
fx.limpiar();assert.equal(escena.children.length,0);
console.log('✓ Estela unida al arma, geometría limitada y limpieza al terminar');
const fuente=fs.readFileSync(new URL('arpg-three-mesa.js',import.meta.url),'utf8');
vm.runInContext(`
 const THREE=CAOZ_THREE.THREE,V3=THREE.Vector3,camara={position:new V3(0,8,10)};
 const jugadores=[{vivo:true,pos:new V3(),m:{alto:2}}];
 const cajas=[new THREE.Box3(new V3(-2,0,3),new V3(2,6,6)),new THREE.Box3(new V3(-2,0,-8),new V3(2,6,-5))];
 const casasFundidas={userData:{ocultacion:{cajas,opacidades:new Float32Array([1,1])}}};
 const rayoCasa=new THREE.Ray(),interseccionCasa=new V3(),destinoCasa=new V3();
 ${extraerDeclaracion(fuente,'actualizarCasasOcultas','function').texto}
 actualizarCasasOcultas(1);
 `,c);
assert.ok(vm.runInContext('casasFundidas.userData.ocultacion.opacidades[0]<.2',c));
assert.equal(vm.runInContext('casasFundidas.userData.ocultacion.opacidades[1]',c),1,'La casa detrás del jugador permanece opaca');
vm.runInContext('jugadores[0].pos.x=8;actualizarCasasOcultas(1)',c);
assert.ok(vm.runInContext('casasFundidas.userData.ocultacion.opacidades[0]>.99',c));
vm.runInContext('jugadores.push({vivo:true,pos:new V3(),m:{alto:2}});actualizarCasasOcultas(1)',c);
assert.ok(vm.runInContext('casasFundidas.userData.ocultacion.opacidades[0]<.2',c),'Protege también al segundo jugador');
console.log('✓ Sólo se transparenta la casa interpuesta; se restaura y funciona con ambos jugadores');
