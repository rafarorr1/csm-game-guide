/* Siluetas, armas, distribución y contacto de las cuatro variantes reales. */
import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const c=vm.createContext({console});c.window=c;
for(const f of ['visor-three-vendor.js','arpg-three-adreida-animacion.js','arpg-three-modelos.js'])vm.runInContext(fs.readFileSync(new URL(f,import.meta.url),'utf8'),c);
const {THREE}=c.CAOZ_THREE,F=c.CAOZ_ARPG_MODELOS.fabrica(THREE),ids=Object.keys(F.VARIANTES_GOBLIN),v=new THREE.Vector3();
assert.deepEqual(ids,['clasico','dosHachas','cuchillo','antorcha']);
assert.equal(F.crear('goblin').varianteGoblin,'clasico');
for(let ronda=0;ronda<12;ronda++)assert.equal(new Set(ids.map(()=>F.elegirVarianteGoblin(()=>.37))).size,4,'Cada bolsa incluye las cuatro siluetas');
const foto=m=>Object.values(m.H).flatMap(h=>[...h.position.toArray(),...h.quaternion.toArray(),...h.scale.toArray()]);
for(const tipo of ['goblin','cobrador'])for(const id of ids){
 const m=F.crear(tipo,{varianteGoblin:id}),escala=F.VARIANTES_GOBLIN[id].escala;
 assert.equal(m.alto,F.TIPOS[tipo].alto*escala);assert.equal(m.radio,F.TIPOS[tipo].radio*escala);
 assert.equal(m.raiz.scale.x,1);assert.equal(m.mallas.length,3);m.raiz.traverse(o=>assert.ok(!o.isLight,'La antorcha no añade luces dinámicas'));
 const manos=new Set();let triangulos=0;
 for(const mesh of m.mallas){const a=mesh.geometry.attributes;triangulos+=a.position.count/3;
  for(let i=0;i<a.position.count;i++){assert.ok(mesh.skeleton.bones[a.skinIndex.getX(i)],'Todos los vértices siguen un hueso válido');assert.equal(a.skinWeight.getX(i),1);
   if(a.maderaReal?.getX(i))manos.add(mesh.skeleton.bones[a.skinIndex.getX(i)]);
  }
 }
 assert.deepEqual(manos,new Set(id==='dosHachas'?[m.H.manoD,m.H.manoI]:[m.H.manoD]));
 assert.ok(triangulos<6000,'Presupuesto geométrico acotado');
 if(id==='antorcha')assert.equal(m.H.llama.parent,m.H.manoD);
 for(const anim of ['quieto','andar','aviso','golpe','aturdido'])for(const k of [0,.35,.55,1]){F.posar(m,{anim,k,t:1.3,fase:1,paso:1});assert.ok(foto(m).every(Number.isFinite));}
 for(const causa of [...Object.keys(F.muertesGoblin),'partido'])for(const variante of [0,1]){
  const muerte=F.crearMuerteGoblin(causa==='partido'?'cargado':causa,variante);if(causa==='partido')muerte.partido=true;
  for(const k of [0,.2,.4,.6,.8,1]){
   F.posar(m,{anim:'muerte',k,muerte,t:k});m.raiz.updateMatrixWorld(true);
   let min=Infinity;const apoyo={cadera:Infinity,torso:Infinity,cabeza:Infinity},mitades=[Infinity,Infinity],techos=[-Infinity,-Infinity],arriba=new Set();m.H.torso.traverse(b=>arriba.add(b));
   for(const mesh of m.mallas)for(let i=0;i<mesh.geometry.attributes.position.count;i++){
    mesh.applyBoneTransform(i,v.fromBufferAttribute(mesh.geometry.attributes.position,i));assert.ok(v.toArray().every(Number.isFinite));min=Math.min(min,v.y);
    const hueso=mesh.skeleton.bones[mesh.geometry.attributes.skinIndex.getX(i)],grupo=arriba.has(hueso)?1:0;mitades[grupo]=Math.min(mitades[grupo],v.y);techos[grupo]=Math.max(techos[grupo],v.y);for(const n of Object.keys(apoyo))if(m.H[n]===hueso)apoyo[n]=Math.min(apoyo[n],v.y);
   }
   assert.ok(min>-.035,`${tipo}/${id}/${causa}/${variante}/${k}: atraviesa el suelo (${min})`);
   if(k===1){assert.ok(min<.025);if(muerte.partido){assert.ok(mitades.every(y=>y<.025),'Ambas mitades apoyadas');assert.ok(techos.every(y=>y<.7),`${tipo}/${id}/${causa}/${variante}: mitades tumbadas (${techos})`);}else for(const [n,y]of Object.entries(apoyo))assert.ok(y<.072,`${tipo}/${id}/${causa}/${variante}/${n}: suspendido (${y})`);}
  }
  const final=foto(m);F.posar(m,{anim:'muerte',k:1,muerte,t:100});assert.deepEqual(foto(m),final,'El cadáver permanece inmóvil');
 }
 console.log(`✓ ${tipo}/${id}: ${triangulos} triángulos, tres mallas, armas y 26 caídas apoyadas`);
}
