/* Plantillas de enemigos: reutilización de buffers sin compartir actuación ni huesos. */
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
const contexto=vm.createContext({console,atob});contexto.window=contexto;
for(const nombre of ['visor-three-vendor.js','arpg-three-adreida-animacion.js','goblin-scenario/datos.js','arpg-three-goblin.js','kobold-scenario/datos.js','arpg-three-kobold.js','arpg-three-modelos.js'])vm.runInContext(fs.readFileSync(new URL(nombre,import.meta.url),'utf8'),contexto);
const {THREE}=contexto.CAOZ_THREE,fabrica=()=>contexto.CAOZ_ARPG_MODELOS.fabrica(THREE),tipos=['goblin','kobold','saqueador','can','cobrador','troll'];
const casos=tipos.flatMap(tipo=>tipo==='goblin'||tipo==='cobrador'?['clasico','dosHachas','cuchillo','antorcha'].map(varianteGoblin=>[tipo,{varianteGoblin}]):tipo==='kobold'?['rojizo','capucha','acorazado','huesos'].map(varianteKobold=>[tipo,{varianteKobold}]):[[tipo,{}]]);
const modelos=fabrica(),tiempos=[];
for(const [tipo,opciones] of casos){
  const inicio=performance.now(),primero=modelos.crear(tipo,opciones),construido=performance.now(),segundo=modelos.crear(tipo,opciones),fin=performance.now();
  tiempos.push({tipo,variante:opciones.varianteGoblin||opciones.varianteKobold||'base',primero:construido-inicio,reutilizado:fin-construido});
  assert.equal(primero.mallas.length,segundo.mallas.length);assert.equal(primero.alto,segundo.alto);assert.equal(primero.radio,segundo.radio);
  assert.equal(JSON.stringify(primero.p),JSON.stringify(segundo.p),'Las proporciones no se escalan dos veces');
  for(const n of Object.keys(primero.H)){assert.notEqual(primero.H[n],segundo.H[n]);assert.deepEqual(primero.H[n].matrixWorld.elements,segundo.H[n].matrixWorld.elements,tipo+'/'+n+': misma pose de reposo');}
  for(const [i,m] of primero.mallas.entries()){
    const otro=segundo.mallas[i];assert.equal(m.geometry,otro.geometry,tipo+': cada aparición conserva los mismos buffers');
    assert.notEqual(m.material,otro.material,'Daño y disolución permanecen individuales');
    if(m.skeleton){assert.notEqual(m.skeleton,otro.skeleton);assert.deepEqual(m.skeleton.boneInverses.map(b=>b.elements),otro.skeleton.boneInverses.map(b=>b.elements));assert.deepEqual(m.skeleton.bones.map(b=>b.name),otro.skeleton.bones.map(b=>b.name));}
  }
  const antes=JSON.stringify(Object.values(segundo.H).map(h=>h.quaternion.toArray()));modelos.posar(primero,{anim:'andar',t:.3,fase:2,paso:1,dt:.1,mezclar:false});
  assert.equal(JSON.stringify(Object.values(segundo.H).map(h=>h.quaternion.toArray())),antes,'Animar un actor no cambia otro');
}
assert.equal(modelos.estadoPreparacion().plantillas,15);
const total=k=>tiempos.reduce((s,t)=>s+t[k],0);console.log(`✓ 15 variantes: mismos buffers y dimensiones, huesos/poses/materiales independientes. Construcción: ${total('primero').toFixed(1)} ms inicial / ${total('reutilizado').toFixed(1)} ms reutilizada.`);
const preparar=fabrica(),materiales=new Set(),esqueletos=new Set(),raices=[];let llamadas=0,cedidas=0,descartesMaterial=0,descartesGeometria=0,descartesHuesos=0;
const usar=async muestras=>{llamadas++;assert.equal(muestras.length,15);for(const m of muestras){raices.push(m.raiz);m.raiz.traverse(n=>{if(n.geometry)n.geometry.addEventListener('dispose',()=>descartesGeometria++);if(n.skeleton)esqueletos.add(n.skeleton);for(const a of [].concat(n.material||[]))materiales.add(a);});}
  for(const e of esqueletos){e.computeBoneTexture();e.boneTexture.addEventListener('dispose',()=>descartesHuesos++);}for(const m of materiales)m.addEventListener('dispose',()=>descartesMaterial++);
};
const a=await preparar.preparar(tipos,{usar,ceder:async()=>{cedidas++;}}),b=await preparar.preparar(tipos,{usar});
assert.equal(a.nuevos,15);assert.equal(b.nuevos,0);assert.equal(b.total,15);assert.equal(llamadas,1);assert.equal(cedidas,15);
assert(raices.every(r=>r.children.length===0&&r.parent===null),'Las muestras no quedan retenidas como actores');
assert([...esqueletos].every(e=>e.boneTexture===null));assert.equal(descartesHuesos,esqueletos.size);assert.equal(descartesMaterial,0,'Se conservan sólo los materiales que mantienen vivos los programas GPU');assert.equal(descartesGeometria,0,'Los buffers compartidos sobreviven');assert.equal(preparar.estadoPreparacion().materiales,materiales.size);
const concurrente=fabrica(),lotes=[];
const opciones={usar:async m=>{lotes.push(m.length);}};await Promise.all([concurrente.preparar(['goblin'],opciones),concurrente.preparar(['goblin','kobold'],opciones)]);assert.deepEqual(lotes,[4,4]);
const recuperable=fabrica();let descartados=0;
await assert.rejects(recuperable.preparar(['troll'],{usar:async muestras=>{muestras[0].raiz.traverse(n=>{for(const a of [].concat(n.material||[]))a.addEventListener('dispose',()=>descartados++);});throw Error('GPU de prueba');}}),/GPU de prueba/);
assert(descartados>0);assert.equal(recuperable.estadoPreparacion().variantes.length,0);assert.equal((await recuperable.preparar(['troll'])).nuevos,1);
await assert.rejects(recuperable.preparar(['inexistente']),/Modelo desconocido/);
console.log('✓ Preparación idempotente y concurrente, cesión entre variantes, liberación de esqueletos, conservación de programas y reintento tras fallo.');
