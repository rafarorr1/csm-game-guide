/* Ocultación de árboles completos con el Three empaquetado: sin WebGL ni mocks geométricos. */
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const contexto=vm.createContext({console});contexto.window=contexto;
for(const f of ['visor-three-vendor.js','arpg-three-bosque.js','arpg-three-tutorial-mundo.js']){
  vm.runInContext(fs.readFileSync(new URL(f,import.meta.url),'utf8'),contexto,{filename:f});
}
const T=contexto.CAOZ_THREE.THREE;
for(const tutorial of [false,true]){
  const escena=new T.Group();escena.position.set(7,0,-11);escena.rotation.y=.31;
  const obstaculos=[],bosque=tutorial?contexto.CAOZ_ARPG_TUTORIAL_MUNDO.crear(T,{escena}):
    contexto.CAOZ_ARPG_BOSQUE.fabrica(T,{grupo:escena,abierto:true,obstaculos});
  escena.updateMatrixWorld(true);
  const camara=new T.PerspectiveCamera(),matrices=new Map(),esferas=new Map(),indicesArboles=new Map();
  bosque.grupo.traverse(m=>{if(m.isInstancedMesh){matrices.set(m,m.instanceMatrix.array.slice());esferas.set(m,m.boundingSphere.clone());}});
  for(const a of bosque.arboles)for(const slot of a.occlusion.slots){
    if(!indicesArboles.has(slot.malla))indicesArboles.set(slot.malla,new Set());
    indicesArboles.get(slot.malla).add(slot.indice);
  }
  const distribucion=JSON.stringify(bosque.arboles),colisiones=JSON.stringify(obstaculos);
  const a=tutorial?bosque.arboles.find(a=>a.z< -7&&a.z> -12&&a.x>2&&a.x<70&&a.occlusion.slots.length>5):bosque.arboles[0];
  assert(a,'Hay un árbol con piezas reales que puede cruzar la vista');
  const mundo=(x,y,z)=>bosque.grupo.localToWorld(new T.Vector3(x,y,z));
  const objetivo=mundo(a.x,0,a.z-10);
  camara.position.copy(mundo(a.x,14,a.z+10));
  assert(bosque.actualizarOclusion(camara,[objetivo])>0);
  assert.equal(a.occlusion.oculto,true,'Un árbol entre la cámara y el héroe se oculta');
  for(const slot of a.occlusion.slots){
    assert(slot.malla.instanceMatrix.array.slice(slot.indice*16,slot.indice*16+12).every(v=>v===0),
      'Desaparecen todas las piezas: tronco, raíces, ramas y cada copa');
  }
  const versiones=new Map([...matrices.keys()].map(m=>[m,m.instanceMatrix.version]));
  for(let i=0;i<8;i++)bosque.actualizarOclusion(camara,[objetivo]);
  for(const [m,version] of versiones)assert.equal(m.instanceMatrix.version,version,'La vista estable no reenvía matrices a GPU');
  for(const [m,original] of matrices){
    assert(m.boundingSphere.equals(esferas.get(m)),'Se conservan los bounds usados por el culling');
    for(let i=0;i<m.count;i++)if(!indicesArboles.get(m)?.has(i)){
      assert.deepEqual(m.instanceMatrix.array.slice(i*16,i*16+16),original.slice(i*16,i*16+16),
        'Arbustos, rocas, raíces del camino, faroles y portón no cambian');
    }
  }
  bosque.actualizarOclusion(camara,[]);
  for(const [m,original] of matrices)assert.deepEqual(m.instanceMatrix.array,original,'Vaciar objetivos restaura cada matriz exactamente');
  const b=a.occlusion.caja,y=(b.min.y+b.max.y)/2;
  function mirarPorElMargen(distancia){
    camara.position.copy(mundo(b.max.x+distancia,y,b.max.z+10));
    return mundo(b.max.x+distancia,y-.9,b.min.z-10);
  }
  bosque.actualizarOclusion(camara,[mirarPorElMargen(.6)]);assert(a.occlusion.oculto);
  bosque.actualizarOclusion(camara,[mirarPorElMargen(.9)]);assert(a.occlusion.oculto,'El margen de salida evita parpadeos');
  bosque.actualizarOclusion(camara,[]);
  bosque.actualizarOclusion(camara,[mirarPorElMargen(.9)]);assert(!a.occlusion.oculto,'Un árbol visible no se oculta con el margen de salida');
  bosque.actualizarOclusion(camara,[mirarPorElMargen(.6)]);assert(a.occlusion.oculto);
  bosque.actualizarOclusion(camara,[mirarPorElMargen(1.3)]);assert(!a.occlusion.oculto,'El árbol reaparece al dejar libre la vista');
  camara.position.copy(mundo(a.x,14,a.z+10));
  const otro=mundo(a.x+50,0,a.z+10);
  bosque.actualizarOclusion(camara,[otro]);assert(!a.occlusion.oculto);
  bosque.actualizarOclusion(camara,[otro,objetivo]);assert(a.occlusion.oculto,'También protege al segundo héroe cooperativo');
  assert.equal(JSON.stringify(obstaculos),colisiones,'La ocultación no retira colisiones');
  assert.equal(JSON.stringify(bosque.arboles),distribucion,'La distribución serializable permanece intacta');
  if(tutorial){
    bosque.activar(false,{conservarPuerta:true});
    assert(!a.occlusion.oculto,'Salir del tutorial restaura su vegetación');
    assert(bosque.porton.visible);bosque.dispose();
  }
  console.log(`✓ Bosque ${tutorial?'tutorial':'exterior'}: árboles completos, restauración exacta, histéresis, cooperativo, transformaciones y utilería intacta.`);
}
