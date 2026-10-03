/* Contrato del goblin de Scenario: rig, contactos, variantes y recursos compartidos. */
import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
import {recursosGoblin,entornoArpgThree} from './arpg-three-exportar.mjs';
const c=vm.createContext({console,atob});c.window=c;
for(const f of ['visor-three-vendor.js','arpg-three-adreida-animacion.js','goblin-scenario/datos.js','arpg-three-goblin.js','arpg-three-modelos.js'])vm.runInContext(fs.readFileSync(new URL(f,import.meta.url),'utf8'),c,{filename:f});
const {THREE}=c.CAOZ_THREE,F=c.CAOZ_ARPG_MODELOS.fabrica(THREE),v=new THREE.Vector3();
function puntos(m){m.raiz.updateMatrixWorld(true);return m.mallas.flatMap(mesh=>Array.from({length:mesh.geometry.attributes.position.count},(_,i)=>mesh.getVertexPosition(i,new THREE.Vector3()).applyMatrix4(mesh.matrixWorld)));}
function probarSuelo(m){const p=puntos(m),min=Math.min(...p.map(v=>v.y));assert.ok(min>-.035&&min<.03,`Cadáver apoyado: ${min}`);assert.ok(p.every(v=>Number.isFinite(v.x+v.y+v.z)),'Vértices finitos');}
for(const varianteGoblin of Object.keys(F.VARIANTES_GOBLIN)){
 const m=F.crear('goblin',{varianteGoblin}),otro=F.crear('cobrador',{varianteGoblin}),g=m.mallas[0].geometry,a=g.attributes;
 assert.equal(m.modeloGoblin,'scenario');assert.equal(g.index.count/3,7872);assert.equal(g,otro.mallas[0].geometry,'Una geometría por variante, compartida con cobradores');assert.notEqual(m.mallas[0].skeleton,otro.mallas[0].skeleton);
 for(let i=0;i<a.position.count;i++){let suma=0;for(let j=0;j<4;j++){suma+=a.skinWeight.array[i*4+j];assert.ok(a.skinIndex.array[i*4+j]<m.mallas[0].skeleton.bones.length);}assert.ok(Math.abs(suma-1)<1e-5);}
 // Una mano nunca comparte un triángulo con una pierna (produce picos al atacar).
 const esq=m.mallas[0].skeleton;
 for(let i=0;i<g.index.count;i+=3){const bs=[0,1,2].map(j=>esq.bones[a.skinIndex.getX(g.index.getX(i+j))]);assert.ok(!(bs.some(b=>[m.H.manoI,m.H.manoD].includes(b))&&bs.some(b=>[m.H.piernaI,m.H.piernaD,m.H.cadera].includes(b))),'Manos sin pesos de cadera/pierna');}
 for(const anim of ['quieto','andar','golpe','reves','estocada','aviso','lanzar','aturdido'])for(const k of [0,.25,.5,.75,1]){F.posar(m,{anim,k,t:k,fase:k*Math.PI*2,paso:1});assert.ok(puntos(m).every(v=>Number.isFinite(v.x+v.y+v.z)),'Poses finitas');}
 for(const p of F.muertesGoblinImportadas){const muerte=F.crearMuerteGoblin('tajo',p.variante);for(const k of [.4,.7,1]){F.posar(m,{anim:'muerte',k,muerte});if(k===1)probarSuelo(m);}}
 F.posar(m,{anim:'quieto',t:0});assert.equal(m.mallas[0].geometry,g,'Restaura la geometría viva tras la caída');
 assert.equal(F.crear('goblin',{varianteGoblin}).mallas[0].geometry,g,'Reutiliza geometría tras otras apariciones');
}
assert.equal(F.crearHachaArrojadiza().children.length,2,'Hacha arrojadiza conserva madera y metal');
assert.equal(c.CAOZ_ARPG_MODELOS.fabrica(THREE,{pielGoblin:false}).crear('goblin').modeloGoblin,null,'El cuaderno de UV conserva el modelo clásico');
for(const f of recursosGoblin){assert.ok(fs.existsSync(new URL(f,import.meta.url)));assert.ok(entornoArpgThree.includes(f));}
console.log('✓ Scenario: cuatro variantes, cuatro caídas FBX por variante, pesos, armas y recursos compartidos.');
