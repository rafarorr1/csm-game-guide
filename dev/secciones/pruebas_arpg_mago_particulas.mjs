/* Superficie real, continuidad del vuelo y reconstrucción reversible del mago. */
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const c=vm.createContext({console,atob});c.window=c;
for(const f of ['visor-three-vendor.js','arpg-three-mago-particulas.js'])vm.runInContext(fs.readFileSync(new URL(f,import.meta.url),'utf8'),c,{filename:f});
const T=c.CAOZ_THREE.THREE,escena=new T.Scene(),grupo=new T.Group(),mago=new T.Group();escena.add(grupo);grupo.add(mago);
const material=new T.MeshStandardMaterial({color:0x554465}),tunica=new T.Mesh(new T.CylinderGeometry(.22,.6,1.6,12),material);tunica.position.y=.8;mago.add(tunica);
const cabeza=new T.Mesh(new T.SphereGeometry(.31,12,8),material);cabeza.position.y=1.82;mago.add(cabeza);
const brazo=new T.Mesh(new T.BoxGeometry(.22,.65,.23),material);brazo.position.set(.5,1.3,0);brazo.rotation.z=-.4;mago.add(brazo);
tunica.castShadow=cabeza.castShadow=true;
const aura=new T.Group();aura.name='Hechizo verde';aura.add(new T.Mesh(new T.SphereGeometry(10),material));mago.add(aura);
const materia=new T.Group(),matTejado=new T.MeshStandardMaterial(),tejadoMalla=new T.Mesh(new T.BoxGeometry(7,.2,7),matTejado);materia.add(tejadoMalla);escena.add(materia);
let programaAnterior=0;matTejado.onBeforeCompile=sh=>{programaAnterior++;sh.uniforms.uEfectoAnterior={value:3};};matTejado.customProgramCacheKey=()=> 'tejado-previo';
const original=tunica.material,fx=c.CAOZ_ARPG_MAGO_PARTICULAS.fabrica(T,{grupo,mago,materia});
assert.notEqual(tunica.material,original,'La disolución no altera el material compartido con el aura');assert.equal(aura.children[0].material,original);assert.equal(cabeza.material,tunica.material,'Comparte un programa de disolución por material');
const shader={uniforms:{},vertexShader:'#include <begin_vertex>',fragmentShader:'#include <alphatest_fragment>'};tunica.material.onBeforeCompile(shader);assert.equal(shader.uniforms.uDisolucionMago,fx.disolucion);assert(shader.fragmentShader.includes('discard'));assert(shader.vertexShader.includes('vMateriaMago=transformed'));
assert.equal(grupo.children.filter(m=>m.isInstancedMesh).length,3,'Partículas, estelas y tejas comparten tres lotes');assert.equal(grupo.children.filter(m=>m.isMesh).length,4,'El aro agrega sólo una llamada de dibujo');assert.equal(grupo.children.filter(m=>m.isLight).length,0,'No añade luces');assert.equal(fx.particulas.count,0);
const shaderTejado={uniforms:{},vertexShader:'#include <begin_vertex>',fragmentShader:''};matTejado.onBeforeCompile(shaderTejado);assert.equal(programaAnterior,1);assert.equal(shaderTejado.uniforms.uEfectoAnterior.value,3);assert.equal(shaderTejado.uniforms.uPlieguePortal,fx.pliegue);assert(shaderTejado.vertexShader.includes('if(abs(uPlieguePortal)>0.)'),'El shader admite el desplazamiento negativo del rebote');assert(matTejado.customProgramCacheKey().startsWith('tejado-previo-'),'Encadena el programa original del tejado');
const origen=new T.Vector3(0,1.05,0),techo=new T.Vector3(0,7,-15),actor=new T.Vector3(0,0,-.45);mago.position.copy(origen);
assert.equal(fx.preparar({origen,techo,actor,rumbo:0}),256);assert.equal(fx.cantidad,256);assert.equal(fx.particulas.count,0,'Preparar no muestra el efecto antes del contacto');
const matriz=new T.Matrix4(),p=new T.Vector3();
const posiciones=()=>{const datos=[];for(let i=0;i<fx.particulas.count;i++){fx.particulas.getMatrixAt(i,matriz);p.setFromMatrixPosition(matriz);datos.push(...p.toArray());}return datos;};
const error=(a,b)=>Math.max(0,...a.map((v,i)=>Math.abs(v-b[i])));
fx.actualizar({fase:'explosion',t:.0001});const comienzo=posiciones();assert.equal(fx.particulas.count,256);assert(fx.disolucion.value<.00001);
for(let i=0;i<comienzo.length;i+=3){assert(Math.abs(comienzo[i])<.75&&Math.abs(comienzo[i+2])<.75,'Las partículas nacen de la superficie del mago, no de una esfera genérica');assert(comienzo[i+1]>=1.04&&comienzo[i+1]<3.21,'No muestrea el enorme aura excluida');}
fx.actualizar({fase:'explosion',t:.8});assert.equal(fx.disolucion.value,1,'El mago se desintegra por completo');const dispersas=posiciones();
assert(!tunica.castShadow&&!cabeza.castShadow,'El mago desintegrado no deja una sombra sólida');
assert(error(dispersas,comienzo)>1.4,'El contacto lanza fragmentos a una distancia visible');
let lados=new Set();for(let i=0;i<dispersas.length;i+=3)lados.add((dispersas[i]>=0?'+':'-')+(dispersas[i+2]>=0?'+':'-'));assert.equal(lados.size,4,'La explosión cubre todos los lados');
const edadSalida=1.78;fx.actualizar({fase:'explosion',t:edadSalida});const finExplosion=posiciones();mago.position.copy(techo);
fx.actualizar({fase:'viaje',t:0,duracion:2.6,desdeImpacto:edadSalida});assert(error(finExplosion,posiciones())<1e-7,'El corte al POV no mueve ninguna molécula instantáneamente');assert.equal(fx.disolucion.value,1,'No aparece el mago sólido detrás mientras viajan las partículas');
const inicio=fx.focoViaje(0).clone(),fin=fx.focoViaje(2.6).clone();assert(inicio.z>actor.z+2&&Math.abs(inicio.y-1.8)<1e-8,'El rastro comienza delante de los ojos');assert(fin.distanceTo(techo.clone().add(new T.Vector3(0,1.3,0)))<1e-8,'El rastro termina en el cuerpo sobre el techo');
const ruta=[];for(let i=0;i<=156;i++)ruta.push(fx.focoViaje(i/60).clone());for(let i=1;i<ruta.length;i++)assert(ruta[i].distanceTo(ruta[i-1])<.25,'La guía de mirada viaja sin saltos de posición');assert(Math.max(...ruta.map(v=>v.x))>2,'La trayectoria describe una curva legible hacia el tejado');
fx.actualizar({fase:'viaje',t:2.6,duracion:2.6,desdeImpacto:edadSalida+2.6});const finViaje=posiciones();fx.actualizar({fase:'reunion',t:0,duracion:1.4,desdeImpacto:edadSalida+2.6});assert(error(finViaje,posiciones())<1e-7,'Reunir la silueta continúa desde la misma nube');
fx.actualizar({fase:'reunion',t:.95,duracion:1.4,desdeImpacto:edadSalida+2.6+.95});assert(fx.disolucion.value>0&&fx.disolucion.value<.5,'La túnica reaparece gradualmente mientras llegan las moléculas');
const pliegueEn=(fase,t)=>{fx.actualizar({fase,t,duracion:1.4,desdeImpacto:edadSalida+2.6+(fase==='resorte'?1.4:0)+t});return fx.pliegue.value;};
const cuadrosResorte=new Map();
for(const fps of [30,60,120]){
 let maxPliegue=0,anterior=0,minRebote=0;
 for(let i=0;i<=fps*1.4;i++){const t=i/fps,v=pliegueEn('reunion',t);maxPliegue=Math.max(maxPliegue,v);assert.equal(fx.portal.visible,t>0&&t<1);assert.equal(fx.restos.count,t>0&&t<1?42:0);assert(fx.restos.instanceMatrix.array.every(Number.isFinite));if(t<=1.316){assert(v>=anterior,'La materia se acerca progresivamente antes de soltarse');anterior=v;}if(t>=1)assert(!fx.portal.visible,'El aro conserva exactamente su segundo aprobado');}
 assert(maxPliegue>.995,'La atracción llega al máximo cuando reaparece entero el mago');
 for(let i=0;i<=fps*.75;i++){const t=i/fps,v=pliegueEn('resorte',t);minRebote=Math.min(minRebote,v);assert.equal(fx.disolucion.value,0);assert.equal(fx.particulas.count+fx.estelas.count+fx.restos.count,0);assert(!fx.portal.visible);assert(tunica.castShadow&&cabeza.castShadow);if(t>=.65)assert.equal(v,0,'Los tejados reposan exactamente al terminar la recuperación');if(i%(fps/30)===0){const clave=Math.round(t*30);if(cuadrosResorte.has(clave))assert.equal(v,cuadrosResorte.get(clave),'El rebote coincide a 30/60/120 FPS');else cuadrosResorte.set(clave,v);}}
 assert(minRebote<-.10&&minRebote>-.16,'La tensión se libera con un único rebote visible y acotado');
}
assert(pliegueEn('reunion',.15)<.02,'La resistencia inicial evita que las casas se lancen de golpe');
assert.equal(pliegueEn('reunion',1.316),1);assert.equal(fx.disolucion.value,0,'La liberación coincide con la reconstrucción completa');
const previoSoltar=pliegueEn('reunion',1.31599),posteriorSoltar=pliegueEn('reunion',1.31601);assert(Math.abs(previoSoltar-posteriorSoltar)<1e-7,'La liberación no introduce un salto de posición');
const corteReunion=pliegueEn('reunion',1.4),centroCorte=fx.capturar().portal.centro;assert.equal(pliegueEn('resorte',0),corteReunion,'El cambio de fase continúa exactamente el mismo reloj de materia');assert.deepEqual(fx.capturar().portal.centro,centroCorte);assert(Math.abs(pliegueEn('reunion',1.39999)-pliegueEn('resorte',.00001))<.001,'La velocidad continúa a ambos lados del corte');
fx.actualizar({fase:'reunion',t:.5,duracion:1.4,desdeImpacto:edadSalida+3.1});const portalMedio=fx.capturar(),tejasMedio=fx.restos.instanceMatrix.array.slice();assert(portalMedio.portal.pliegue>.1&&portalMedio.portal.pliegue<.3);assert.equal(portalMedio.portal.brillo,1);
fx.actualizar({fase:'reunion',t:.9,duracion:1.4,desdeImpacto:edadSalida+3.5});assert(error(Array.from(fx.restos.instanceMatrix.array),Array.from(tejasMedio))>.3,'Las tejas recorren un remolino visible');
fx.actualizar({fase:'reunion',t:.5,duracion:1.4,desdeImpacto:edadSalida+3.1});assert.deepEqual(fx.restos.instanceMatrix.array,tejasMedio,'El remolino depende sólo del reloj absoluto');
fx.restaurar();assert.equal(fx.pliegue.value,0);assert(!fx.portal.visible&&!fx.restos.visible);fx.mostrar(portalMedio);assert.deepEqual(fx.capturar().portal,portalMedio.portal,'El caché restaura deformación del tejado, brillo y edad del aro');
pliegueEn('resorte',.28);const reboteGuardado=fx.capturar();assert(reboteGuardado.portal.pliegue<-.1);pliegueEn('reunion',.3);fx.restaurar();fx.mostrar(reboteGuardado);assert.deepEqual(fx.capturar(),reboteGuardado,'El caché conserva también la tensión negativa durante el hechizo');assert(tunica.castShadow&&cabeza.castShadow);const valorRebote=fx.pliegue.value;assert.equal(pliegueEn('resorte',.28),valorRebote,'Buscar directamente el resorte no depende del recorrido anterior');fx.restaurar();assert.equal(fx.pliegue.value,0,'Cancelar durante el rebote restaura toda la materia');
const estados=new Map();for(const [fase,t,duracion,edad]of [['explosion',.3,1,.3],['explosion',1.2,1,1.2],['viaje',.4,2.6,edadSalida+.4],['viaje',1.8,2.6,edadSalida+1.8],['reunion',.8,1.4,edadSalida+2.6+.8]]){
 const args={fase,t,duracion,desdeImpacto:edad};fx.actualizar(args);estados.set(fase+t,{args,p:fx.particulas.instanceMatrix.array.slice(),e:fx.estelas.instanceMatrix.array.slice(),d:fx.disolucion.value});
}
for(const key of ['reunion0.8','explosion0.3','viaje1.8','explosion1.2','viaje0.4','reunion0.8']){const guardado=estados.get(key);fx.actualizar(guardado.args);assert.equal(fx.disolucion.value,guardado.d);assert.deepEqual(fx.particulas.instanceMatrix.array,guardado.p,'Buscar un cuadro restaura exactamente la nube');assert.deepEqual(fx.estelas.instanceMatrix.array,guardado.e,'Las estelas también usan tiempo absoluto');}
assert(fx.estelas.count<=28*8);assert(fx.estelas.instanceMatrix.array.every(Number.isFinite));assert(fx.particulas.instanceMatrix.array.every(Number.isFinite));
const guardado=fx.capturar();fx.restaurar();assert(tunica.castShadow&&cabeza.castShadow);assert(!brazo.castShadow,'Conserva el ajuste original de cada malla');fx.mostrar(guardado);assert.equal(fx.disolucion.value,guardado.disolucion,'El cache restaura también el shader');assert.deepEqual(fx.estado,guardado.estado);assert(!tunica.castShadow,'Buscar un cuadro también restaura las sombras');
fx.actualizar({fase:'reunion',t:1.4,duracion:1.4,desdeImpacto:edadSalida+4});assert.equal(fx.disolucion.value,0,'Al terminar reaparece entero');assert.equal(fx.particulas.count,0);assert.equal(fx.estelas.count,0);fx.actualizar({fase:'oculto'});assert.equal(fx.disolucion.value,0);assert.equal(fx.estado.fase,'oculto');
fx.preparar({origen,techo,actor,rumbo:0});assert.equal(fx.cantidad,256,'Repetir la cinemática no acumula partículas');
const bajo=c.CAOZ_ARPG_MAGO_PARTICULAS.fabrica(T,{grupo:new T.Group(),mago:mago.clone(),reducido:true});assert.equal(bajo.preparar({origen,techo,actor}),144,'La calidad reducida conserva silueta y trayectoria con menos instancias');
bajo.actualizar({fase:'reunion',t:1.316,duracion:1.4});assert.equal(bajo.pliegue.value,.55,'La calidad reducida mantiene una deformación menor');bajo.actualizar({fase:'resorte',t:.65,duracion:1.4});assert.equal(bajo.pliegue.value,0);
console.log('✓ Partículas del mago: superficie, vuelo continuo, portal de un segundo, atracción resistente y resorte continuo a 30/60/120 FPS, shader encadenado y caché reversible; cuatro llamadas de dibujo.');
