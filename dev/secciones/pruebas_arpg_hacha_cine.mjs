/* Estiba, extracción y carrera del epílogo sobre las mallas aprobadas. */
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const c=vm.createContext({console,atob});c.window=c;
for(const f of ['visor-three-vendor.js','adreida-scenario/combate.js','arpg-three-adreida-animacion.js','adreida-scenario/datos.js','adreida-piernas-scenario/datos.js','arpg-three-adreida.js','hacha-adreida-scenario/datos.js','arpg-three-hacha-adreida.js','arpg-three-modelos.js','adreida-scenario/cinematica.js','arpg-three-adreida-cine.js'])vm.runInContext(fs.readFileSync(new URL(f,import.meta.url),'utf8'),c,{filename:f});
const T=c.CAOZ_THREE.THREE,F=c.CAOZ_ARPG_MODELOS.fabrica(T),A=c.CAOZ_ARPG_ADREIDA_CINE.fabrica(T,F),m=F.crear('adreida'),otro=F.crear('adreida'),clip=c.CAOZ_ADREIDA_CINE_CLIPS.equiparHacha,v=new T.Vector3();
F.posar(m,{anim:'quieto',t:0,dt:0,mezclar:false});const inicial=A.capturar(m),geometria=m.hachaScenario.geometry,vertices=geometria.attributes.position.array.slice(),indices=geometria.index.array.slice();
const nodo=A.prepararHacha(m),accesorio=nodo.children[0];assert.equal(nodo,A.prepararHacha(m),'Preparar dos veces conserva los nodos para la caché');assert.equal(nodo.parent,m.H.torso);assert.equal(accesorio.geometry,geometria);assert.equal(accesorio.material,m.hachaScenario.material);assert.equal(m.mallas.length,2,'El accesorio no altera el inventario de mallas del modelo');
A.portarHacha(m,'espalda');assert(nodo.visible&&!m.hachaScenario.visible);const espalda=A.capturar(m);A.visibilidadHacha(m,false);assert(!nodo.visible&&!m.hachaScenario.visible);A.visibilidadHacha(m,true);assert(nodo.visible&&!m.hachaScenario.visible,'La visibilidad global respeta el modo espalda');
const raiz=m.raiz.position.clone(),giro=m.raiz.quaternion.clone();let minimo=Infinity;
for(let i=0;i<=200;i++){
 const k=i/200;A.equiparHacha(m,k);const tomada=k*clip.duracion+1e-8>=clip.transferencia.contacto;
 assert.equal(m.hachaScenario.visible,tomada);assert.equal(nodo.visible,!tomada);assert.equal(A.capturarHacha(m).modo,tomada?'mano':'espalda');assert.equal(nodo.parent,m.H.torso,'Buscar cuadros nunca cambia el padre del accesorio');
 assert(m.raiz.position.distanceTo(raiz)<1e-8&&m.raiz.quaternion.angleTo(giro)<1e-7,'El gesto no traslada ni gira la raíz del actor');
 for(const mesh of [m.mallas[0],tomada?m.hachaScenario:accesorio])for(let j=0;j<mesh.geometry.attributes.position.count;j+=11){mesh.getVertexPosition(j,v).applyMatrix4(mesh.matrixWorld);minimo=Math.min(minimo,v.y);}
}
assert(minimo>0,'El cuerpo y el hacha respetan el suelo durante la extracción');
A.equiparHacha(m,clip.transferencia.contacto/clip.duracion);let errorTransferencia=0;
for(let i=0;i<geometria.attributes.position.count;i++){
 const enMano=m.hachaScenario.getVertexPosition(i,new T.Vector3()).applyMatrix4(m.hachaScenario.matrixWorld),enEspalda=accesorio.getVertexPosition(i,v).applyMatrix4(accesorio.matrixWorld);errorTransferencia=Math.max(errorTransferencia,enMano.distanceTo(enEspalda));
}
assert(errorTransferencia<1e-7,'Accesorio y arma en mano coinciden vértice por vértice en el contacto');
const puntoVisible=()=>{const mesh=nodo.visible?accesorio:m.hachaScenario;return mesh.getVertexPosition(150,new T.Vector3()).applyMatrix4(mesh.matrixWorld);};
A.equiparHacha(m,(clip.transferencia.contacto-1e-6)/clip.duracion);const antes=puntoVisible();A.equiparHacha(m,(clip.transferencia.contacto+1e-6)/clip.duracion);assert(antes.distanceTo(puntoVisible())<.0001,'La transferencia no salta entre muestras contiguas');
const instantaneas=new Map();for(const k of [0,.18,.45,.54,.70,.90,1]){A.equiparHacha(m,k);instantaneas.set(k,{pose:A.capturar(m),punto:puntoVisible()});}
for(const k of [1,.18,.90,.54,0,.70,.45]){A.equiparHacha(m,k);const esperada=instantaneas.get(k);assert(puntoVisible().distanceTo(esperada.punto)<1e-7,'La extracción es absoluta al recorrer la caché hacia atrás');for(const[n,q]of Object.entries(esperada.pose.rot))assert(q.angleTo(m.H[n].quaternion)<1e-6);}
A.restaurar(m,espalda);assert(nodo.visible&&!m.hachaScenario.visible);A.portarHacha(m,'mano');assert(!nodo.visible&&m.hachaScenario.visible);A.restaurar(m,inicial);assert(!nodo.visible&&m.hachaScenario.visible);assert.equal(m.sinHacha,inicial.hacha.sinHacha);assert.deepEqual(Array.from(m.mallas[0].morphTargetInfluences),Array.from(inicial.agarres[0]),'Cancelar restaura también el correctivo de las manos');
for(const k of [0,.13,.25,.50,.75,1]){
 A.carreraCine(m,k);F.posar(otro,{anim:'quieto',t:0,dt:0,sinHacha:true,agarreDerecha:true,mezclar:false});A.fbx(otro,'carreraCine',k);
 for(const n of c.CAOZ_ADREIDA_CINE_CLIPS.carreraCine.huesos)assert(m.H[n].quaternion.angleTo(otro.H[n].quaternion)<1e-6,'Running mantiene el gesto original sin sustituir los brazos: '+n);
 assert(m.H.cuerpo.position.distanceTo(otro.H.cuerpo.position)<1e-8,'Running conserva su fase aérea sin pegar los pies al suelo');
}
const fps=A.crearFPS(),camara=new T.PerspectiveCamera();camara.position.set(0,1.65,0);camara.lookAt(0,1.65,-1);camara.updateMatrixWorld(true);A.fps(fps,camara,Math.PI/2,0,null,'carreraCine');A.carreraCine(otro,.25);
for(const n of ['brazoI','anteI','manoI','brazoD','anteD'])assert(fps.H[n].quaternion.angleTo(otro.H[n].quaternion)<1e-6,'POV usa el brazo importado de Running: '+n);
const ejeArma=new T.Vector3(0,-1,0).applyQuaternion(fps.H.manoD.getWorldQuaternion(new T.Quaternion())).applyQuaternion(camara.quaternion.clone().invert());assert(ejeArma.x>.7&&ejeArma.y>.5,'La muñeca sostiene el filo hacia el lateral derecho del POV');
A.equiparHacha(m,(clip.transferencia.contacto-1e-12)/clip.duracion);assert(m.hachaScenario.visible&&!nodo.visible,'La tolerancia temporal evita retrasar la transferencia exacta un cuadro');
assert.deepEqual(geometria.attributes.position.array,vertices);assert.deepEqual(geometria.index.array,indices,'Ni estiba ni extracción editan geometría compartida');
console.log(`✓ Hacha de cine: 201 poses, transferencia ${(errorTransferencia*1000).toFixed(6)} mm, suelo ${(minimo*1000).toFixed(1)} mm, nodos estables y cancelación/caché reversibles; Running conserva brazos y fase aérea, también en POV.`);

// Exportación opcional de las poses reales ya deformadas para revisión headless.
const salida=process.argv.indexOf('--exportar');
if(salida>=0){
 const poses=[],guardar=nombre=>{m.raiz.updateMatrixWorld(true);const objetos=[];for(const mesh of [m.mallas[0],nodo.visible?accesorio:m.hachaScenario]){const posiciones=[];for(let i=0;i<mesh.geometry.attributes.position.count;i++){mesh.getVertexPosition(i,v).applyMatrix4(mesh.matrixWorld);posiciones.push(...v.toArray());}objetos.push({nombre:mesh===m.mallas[0]?'cuerpo':'hacha',posiciones,indices:Array.from(mesh.geometry.index.array)});}poses.push({nombre,objetos});};
 A.portarHacha(m,'espalda');A.salidaConGiro(m,.5);guardar('Salida · espalda');
 for(const t of [0,.5,.9,1.2,1.5,clip.duracion]){A.equiparHacha(m,t/clip.duracion);guardar('Equipar '+t.toFixed(2)+' s');}
 for(const k of [0,.25,.5,.75]){A.carreraCine(m,k);guardar('Running '+k.toFixed(2));}
 fs.writeFileSync(process.argv[salida+1],JSON.stringify({poses}));console.log('Poses exportadas: '+process.argv[salida+1]);
}
