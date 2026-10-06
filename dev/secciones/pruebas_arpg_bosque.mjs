/* Vegetación exterior: lotes estáticos y exclusiones de circulación reales. */
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const c=vm.createContext({console,atob});c.window=c;
for(const f of ['visor-three-vendor.js','arpg-three-bosque.js'])vm.runInContext(fs.readFileSync(new URL(f,import.meta.url),'utf8'),c,{filename:f});
const T=c.CAOZ_THREE.THREE,calles=[-Math.PI/2,Math.PI/6,Math.PI*5/6],claros=[{x:0,z:-55},{x:52,z:30},{x:-65,z:38}];
for(const abierto of [false,true])for(const reducido of [false,true]){
 const grupo=new T.Group(),obstaculos=[{x:0,z:0,r:2}],b=c.CAOZ_ARPG_BOSQUE.fabrica(T,{grupo,radioMuralla:26,calles,abierto,reducido,obstaculos});
 assert.equal(grupo.children.length,1);assert.equal(b.estadisticas.llamadas,b.grupo.children.length);assert(b.grupo.children.length<=72);assert.equal(b.estadisticas.zonas,24);assert.equal(b.arboles.length,reducido?250:500,'Las tres capas mantienen la densidad prevista');
 assert.deepEqual(Array.from(b.estadisticas.capas),reducido?[50,80,120]:[100,160,240]);assert.equal(obstaculos.length,abierto?b.arboles.length+1:1,'Sólo añade colisiones al mapa abierto');
 const sectores=new Set(),altos=[];
 for(const a of b.arboles){
  const r=Math.hypot(a.x,a.z);assert(r-a.huella>=30,'Ninguna copa entra a la muralla ni la plaza');assert(r+a.huella<=b.estadisticas.radioExterior+3,'Las raíces y copas quedan sobre el terreno existente');
  for(const calle of calles){const x=Math.cos(calle),z=Math.sin(calle);if(a.x*x+a.z*z>0)assert(Math.abs(a.x*z-a.z*x)-a.huella>=3.2,'Los corredores de puerta dejan más de6m libres, incluyendo copas');}
  if(abierto)for(const claro of claros)assert(Math.hypot(a.x-claro.x,a.z-claro.z)-a.huella>=9,'Quedan despejados el combate y los accesos a los campamentos');
  sectores.add(Math.floor((Math.atan2(a.z,a.x)+Math.PI)*12/(Math.PI*2)));altos.push(a.alto);
 }
 assert.equal(sectores.size,12,'El bosque rodea toda la ciudad');assert(Math.max(...altos)-Math.min(...altos)>8,'Las siluetas varían de altura entre árboles y capas');assert(b.arboles.some(a=>a.conifera)&&b.arboles.some(a=>!a.conifera));
 let triangulos=0;
 for(const m of b.grupo.children){assert(m.isInstancedMesh);assert.equal(m.castShadow,false);assert.equal(m.receiveShadow,false);assert.equal(m.material.transparent,false);assert.equal(m.matrixAutoUpdate,false);assert.equal(m.instanceMatrix.usage,T.StaticDrawUsage);assert(m.instanceMatrix.array.every(Number.isFinite));assert(m.instanceColor.array.every(Number.isFinite));assert(m.boundingSphere.radius>0);triangulos+=(m.geometry.index?.count||m.geometry.attributes.position.count)/3*m.count;}
 assert(triangulos<100000,'La vegetación completa queda por debajo de100mil triángulos');assert(!b.grupo.children.some(n=>n.isLight));
 assert.equal(new Set(b.grupo.children.map(m=>m.geometry)).size,3,'Los sectores comparten exactamente tres geometrías');
 assert.equal(new Set(b.grupo.children.map(m=>m.material)).size,3,'Los sectores comparten exactamente tres materiales');
 const camara=new T.PerspectiveCamera(32,16/9,.5,1200);camara.position.set(0,Math.sin(.92)*21,4+Math.cos(.92)*21);camara.lookAt(0,.8,4);camara.updateMatrixWorld(true);
 const frustum=new T.Frustum().setFromProjectionMatrix(new T.Matrix4().multiplyMatrices(camara.projectionMatrix,camara.matrixWorldInverse)),visibles=b.grupo.children.filter(m=>frustum.intersectsObject(m)),triVisibles=visibles.reduce((s,m)=>s+(m.geometry.index?.count||m.geometry.attributes.position.count)/3*m.count,0);
 assert(triVisibles<triangulos*.35,'El encuadre de combate omite la mayoría de los árboles exteriores');
 assert(visibles.length<=12,'Los lotes visibles de bosque no dominan las llamadas de la plaza');
 const repetida=c.CAOZ_ARPG_BOSQUE.fabrica(T,{grupo:new T.Group(),radioMuralla:26,calles,abierto,reducido});assert.equal(JSON.stringify(repetida.arboles),JSON.stringify(b.arboles),'La distribución es independiente del azar y de la partida');
 for(let i=0;i<b.grupo.children.length;i++)assert.deepEqual(repetida.grupo.children[i].instanceMatrix.array,b.grupo.children[i].instanceMatrix.array);
 console.log(`✓ Bosque ${abierto?'abierto':'ciudad'}${reducido?' reducido':''}: ${b.arboles.length} árboles, ${triangulos} triángulos totales / ${triVisibles} visibles, ${visibles.length} lotes visibles, calles/claros libres y semilla estable.`);
}
