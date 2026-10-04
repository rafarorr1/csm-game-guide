/* Correctivos de cierre en espacio de pose: conserva la mano abierta de Scenario. */
import fs from 'node:fs';
import vm from 'node:vm';
const c=vm.createContext({console,atob});c.window=c;
const base=new URL('../',import.meta.url),archivo=new URL('./datos.js',import.meta.url);
for(const f of ['visor-three-vendor.js','adreida-scenario/combate.js','arpg-three-adreida-animacion.js','adreida-scenario/datos.js','adreida-brazos-scenario/datos.js','arpg-three-adreida.js','hacha-adreida-scenario/datos.js','arpg-three-hacha-adreida.js','arpg-three-modelos.js'])vm.runInContext(fs.readFileSync(new URL(f,base),'utf8'),c);
const d=c.CAOZ_ADREIDA_MODULAR_DATOS;delete d.agarre;
const T=c.CAOZ_THREE.THREE,F=c.CAOZ_ARPG_MODELOS.fabrica(T),m=F.crear('adreida');F.posar(m,{anim:'quieto'});m.raiz.updateMatrixWorld(true);
const mesh=m.mallas[0],g=mesh.geometry,a=g.attributes,es=mesh.skeleton,p=new T.Vector3(),normal=new T.Vector3();
const posed=new Float32Array(a.position.count*3),inversas=new Map(),filas=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
for(let i=0;i<a.position.count;i++)mesh.getVertexPosition(i,p).toArray(posed,i*3);
function mezcla(i){const r=new T.Matrix4();r.elements.fill(0);for(let j=0;j<4;j++){const n=a.skinIndex.array[i*4+j],w=a.skinWeight.array[i*4+j];if(!w)continue;const b=new T.Matrix4().multiplyMatrices(es.bones[n].matrixWorld,es.boneInverses[n]);for(let k=0;k<16;k++)r.elements[k]+=w*b.elements[k];}return r;}
for(const [i,lado,x,y,z,w]of filas){const destino=m.H['mano'+lado].localToWorld(new T.Vector3(x,y,z));p.fromArray(posed,i*3).lerp(destino,w).toArray(posed,i*3);inversas.set(i,mezcla(i).invert());}
// Soldar normales de costuras UV en la pose cerrada evita cortes de luz entre dedos.
const indices=g.index.array,acumulados=new Map(),claves=[];
for(let i=0;i<a.position.count;i++){const clave=[0,1,2].map(j=>Math.round(posed[i*3+j]*1e6)).join(',');claves.push(clave);if(!acumulados.has(clave))acumulados.set(clave,new T.Vector3());}
const aa=new T.Vector3(),bb=new T.Vector3(),cc=new T.Vector3();
for(let j=0;j<indices.length;j+=3){const [i0,i1,i2]=indices.slice(j,j+3);aa.fromArray(posed,i0*3);bb.fromArray(posed,i1*3).sub(aa);cc.fromArray(posed,i2*3).sub(aa);bb.cross(cc);for(const i of [i0,i1,i2])acumulados.get(claves[i]).add(bb);}
d.agarre={};const cod=a=>Buffer.from(a.buffer).toString('base64');
for(const lado of ['I','D']){const ids=[],delta=[],normales=[];
 for(const [i,l]of filas){if(l!==lado)continue;const inv=inversas.get(i);p.fromArray(posed,i*3).applyMatrix4(inv).sub(new T.Vector3().fromBufferAttribute(a.position,i));
  normal.copy(acumulados.get(claves[i])).normalize().applyMatrix3(new T.Matrix3().setFromMatrix4(inv)).sub(new T.Vector3().fromBufferAttribute(a.normal,i));
  ids.push(i);delta.push(...p.toArray());normales.push(...normal.toArray());
 }
 d.agarre[lado]={indices:cod(new Uint16Array(ids)),posicion:cod(new Float32Array(delta)),normal:cod(new Float32Array(normales))};
}
fs.writeFileSync(archivo,'/* Generado por preparar.py: cuerpo, brazos, vendas y hombrera con un atlas. */\nwindow.CAOZ_ADREIDA_MODULAR_DATOS='+JSON.stringify(d)+';\n');
console.log('Correctivos de agarre: '+filas.length+' vértices; dos manos independientes.');
