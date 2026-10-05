/* Tormenta lejana reversible: las nubes reciben rayos y el paso del meteorito. */
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const c=vm.createContext({console,atob});c.window=c;
for(const f of ['visor-three-vendor.js','arpg-three-mago-hechizo.js'])vm.runInContext(fs.readFileSync(new URL(f,import.meta.url),'utf8'),c,{filename:f});
const T=c.CAOZ_THREE.THREE,escena=new T.Scene(),grupo=new T.Group(),mago=new T.Group();escena.add(grupo);grupo.add(mago);mago.position.set(2,7,-15);mago.rotation.y=.4;
escena.background=new T.Color(0x233442);escena.fog=new T.Fog(0x334556,12,130);
const hemi=new T.HemisphereLight(0x829abd,0x29251f,.5),luna=new T.DirectionalLight(0xc1d6ff,2.1),ambiente=new T.AmbientLight(0xabcdef,.15),puntual=new T.PointLight(0x44ef88,5);escena.add(hemi,luna,ambiente,puntual);luna.castShadow=true;
const inicial={fondo:escena.background.toArray(),niebla:escena.fog.color.toArray(),luces:[hemi.intensity,luna.intensity,ambiente.intensity]},fx=c.CAOZ_ARPG_MAGO_HECHIZO.fabrica(T,{grupo,escena,mago});
assert.equal(grupo.children.filter(m=>m.isInstancedMesh).length,3,'Rayos, contornos y nubes sólo consumen tres llamadas de dibujo');assert.equal(grupo.children.filter(m=>m.isLight).length,0,'El hechizo no añade luces');
assert(!fx.nucleo.castShadow&&!fx.contorno.castShadow);assert(!fx.nucleo.receiveShadow&&!fx.contorno.receiveShadow);assert.equal(fx.nucleo.count,0);
const reposo=fx.capturar(),cielo=new T.Vector3(12,54,-26),impacto=new T.Vector3(0,1,-.45);fx.preparar({cielo,impacto});fx.actualizar(0);assert.deepEqual(escena.background.toArray(),inicial.fondo);assert.equal(hemi.intensity,.5,'El hechizo comienza sin salto de iluminación');assert.equal(fx.nubes.count,30);assert.equal(fx.nubes.material.uniforms.uPresencia.value,0,'Las nubes entran gradualmente');
let pulsos=0,antes=false,minFondo=1,minHemi=1,minLuna=1,segmentosMax=0,minY=Infinity,maxY=-Infinity,distanciaMin=Infinity;const matriz=new T.Matrix4(),p=new T.Vector3();
for(let i=0;i<=240;i++){
 const estado=fx.actualizar(i/60),encendido=fx.nucleo.count>0;if(encendido&&!antes)pulsos++;antes=encendido;
 minFondo=Math.min(minFondo,escena.background.r/inicial.fondo[0]);minHemi=Math.min(minHemi,hemi.intensity/inicial.luces[0]);minLuna=Math.min(minLuna,luna.intensity/inicial.luces[1]);
 assert.equal(puntual.intensity,5,'Conserva el foco de la magia local');assert(luna.castShadow,'La luna mantiene su configuración de sombras');assert.equal(escena.fog.near,12);assert.equal(escena.fog.far,130);
 assert(estado.progreso>=0&&estado.progreso<=1&&estado.pulso>=0&&estado.pulso<=1);segmentosMax=Math.max(segmentosMax,fx.nucleo.count);
 for(let j=0;j<fx.nucleo.count;j++){fx.nucleo.getMatrixAt(j,matriz);p.setFromMatrixPosition(matriz);minY=Math.min(minY,p.y);maxY=Math.max(maxY,p.y);distanciaMin=Math.min(distanciaMin,Math.hypot(p.x-mago.position.x,p.z-mago.position.z));}
 if(i>=180){assert.equal(fx.nucleo.count,0);assert.equal(estado.oscuridad,1,'El cielo permanece más oscuro tras los rayos y hasta el impacto');}
}
assert.equal(pulsos,4,'Produce cuatro descargas separadas');assert(Math.abs(minFondo-.36)<1e-12,'El cielo se oscurece un 64%, sin flashes negros');assert(Math.abs(minHemi-.82)<1e-12,'El hemisferio conserva la lectura de Adreida');assert(Math.abs(minLuna-.78)<1e-12);assert(maxY>48&&minY>15,'Los rayos están altos en el cielo distante');assert(distanciaMin>75,'Ningún rayo cae cerca del tejado ni del personaje');assert(segmentosMax<=32,'Cada pulso reutiliza la misma reserva');
assert(fx.nucleo.instanceMatrix.array.every(Number.isFinite));assert(fx.contorno.instanceMatrix.array.every(Number.isFinite));
const trayecto=new T.Line3(cielo,impacto),cercano=new T.Vector3();for(let i=22;i<30;i++){fx.nubes.getMatrixAt(i,matriz);p.setFromMatrixPosition(matriz);trayecto.closestPointToPoint(p,true,cercano);assert(p.distanceTo(cercano)<5,'Los bancos próximos realmente cruzan la trayectoria del meteorito');}
assert(!fx.nubes.castShadow&&!fx.nubes.receiveShadow);assert.equal(fx.nubes.material.map,undefined,'El vapor es procedural y no depende de assets externos');
const muestras=new Map();for(const t of [0,.48,.55,1.16,1.82,2.53,3,4]){
 fx.actualizar(t);muestras.set(t,{cuadro:fx.capturar(),a:fx.nucleo.instanceMatrix.array.slice(0,fx.nucleo.count*16),b:fx.contorno.instanceMatrix.array.slice(0,fx.contorno.count*16),n:fx.nucleo.count});
}
for(const t of [3,.55,1.82,.48,4,1.16,2.53,0]){fx.actualizar(t);const s=muestras.get(t);assert.equal(fx.nucleo.count,s.n);assert.deepEqual(fx.nucleo.instanceMatrix.array.slice(0,s.n*16),s.a,'Cada rayo tiene la misma forma al buscar atrás');assert.deepEqual(fx.contorno.instanceMatrix.array.slice(0,s.n*16),s.b);assert.deepEqual(fx.capturar().ambiente,s.cuadro.ambiente,'La oscuridad no se acumula al repetir cuadros');assert.deepEqual(fx.capturar().uniformes,s.cuadro.uniformes,'Las nubes y su luz también usan tiempo absoluto');}
fx.actualizar(.55);const flash=fx.capturar().uniformes.rayos.filter(v=>v[3]>0);assert.equal(flash.length,1,'Se ilumina un banco de nubes concreto, no toda la pantalla');assert(flash[0][1]>40);
const meteoro=cielo.clone().lerp(impacto,.12);fx.actualizar(3.6,3,{meteorito:meteoro,edadMeteorito:.6});const pasoMeteoro=fx.capturar();assert.deepEqual(Array.from(pasoMeteoro.uniformes.meteorito),[...meteoro.toArray(),1]);assert.equal(pasoMeteoro.uniformes.edadMeteorito,.6);assert.equal(pasoMeteoro.uniformes.presencia,1,'Las nubes permanecen para que el meteorito las atraviese');fx.actualizar(3.7);assert.equal(fx.capturar().uniformes.meteorito[3],0);fx.mostrar(pasoMeteoro);assert.deepEqual(fx.capturar().uniformes,pasoMeteoro.uniformes,'El cache repone posición, edad e iluminación del paso del meteorito');
fx.actualizar(2);const una=fx.capturar().ambiente;for(let i=0;i<80;i++)fx.actualizar(2);assert.deepEqual(fx.capturar().ambiente,una,'Pausar no sigue multiplicando la intensidad');
fx.mostrar(reposo);assert.deepEqual(escena.background.toArray(),inicial.fondo);assert.deepEqual(escena.fog.color.toArray(),inicial.niebla);assert.deepEqual([hemi.intensity,luna.intensity,ambiente.intensity],inicial.luces,'Buscar un cuadro anterior al hechizo devuelve el ambiente original');
fx.mostrar(muestras.get(2.53).cuadro);assert.deepEqual(fx.capturar().ambiente,muestras.get(2.53).cuadro.ambiente,'El cache restaura colores e intensidades después de las matrices');fx.restaurar();assert.equal(fx.nucleo.count,0);assert.deepEqual(escena.background.toArray(),inicial.fondo);assert.deepEqual(escena.fog.color.toArray(),inicial.niebla);assert.deepEqual([hemi.intensity,luna.intensity,ambiente.intensity],inicial.luces,'Cancelar restaura exactamente las luces originales');
// La siguiente reproducción parte de su ambiente vigente, no de un valor fijo.
hemi.intensity=.7;escena.background.setHex(0x456789);const otroFondo=escena.background.toArray();fx.actualizar(2);assert(Math.abs(hemi.intensity-.7*.82)<1e-12);fx.restaurar();assert.equal(hemi.intensity,.7);assert.deepEqual(escena.background.toArray(),otroFondo);
const reducido=c.CAOZ_ARPG_MAGO_HECHIZO.fabrica(T,{grupo:new T.Group(),escena,mago,reducido:true});let total=0,previo=false;for(let i=0;i<=180;i++){reducido.actualizar(i/60);const v=reducido.nucleo.count>0;if(v&&!previo)total++;previo=v;}assert.equal(total,3,'La versión reducida mantiene tres rayos completos');reducido.restaurar();
console.log('✓ Hechizo del mago: rayos a distancia, nubes procedurales iluminadas localmente, cruce del meteorito y ambiente reversible en tres llamadas de dibujo.');
