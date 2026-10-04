/* Contacto horneado con el mango: calibra manos y muñecas en las poses de combate. */
import fs from 'node:fs';
import vm from 'node:vm';
const c=vm.createContext({console,atob});c.window=c;
const base=new URL('../',import.meta.url),archivo=new URL('./datos.js',import.meta.url);
for(const f of ['visor-three-vendor.js','adreida-scenario/combate.js','arpg-three-adreida-animacion.js','adreida-scenario/datos.js','adreida-brazos-rigged/datos.js','arpg-three-adreida.js','hacha-adreida-scenario/datos.js','arpg-three-hacha-adreida.js','arpg-three-modelos.js'])vm.runInContext(fs.readFileSync(new URL(f,base),'utf8'),c);
const d=c.CAOZ_ADREIDA_PIERNAS_DATOS;delete d.agarre;
const T=c.CAOZ_THREE.THREE,F=c.CAOZ_ARPG_MODELOS.fabrica(T),m=F.crear('adreida'),mesh=m.mallas[0],g=mesh.geometry,a=g.attributes,es=mesh.skeleton;
const original=a.position.array.slice(),p=new T.Vector3(),normal=new T.Vector3(),filas=[];
function mezcla(i){const r=new T.Matrix4();r.elements.fill(0);for(let j=0;j<4;j++){const n=a.skinIndex.array[i*4+j],w=a.skinWeight.array[i*4+j];if(!w)continue;const b=new T.Matrix4().multiplyMatrices(es.bones[n].matrixWorld,es.boneInverses[n]);for(let k=0;k<16;k++)r.elements[k]+=w*b.elements[k];}return r;}
for(const lado of ['I','D']){
 const parte=d.partes.find(x=>x.nombre==='brazo'+lado),huesos=new Set();m.H['mano'+lado].traverse(b=>{if(b.isBone)huesos.add(es.bones.indexOf(b));});
 for(let i=parte.inicio;i<parte.inicio+parte.vertices;i++){
  let w=0;for(let j=0;j<4;j++)if(huesos.has(a.skinIndex.array[i*4+j]))w+=a.skinWeight.array[i*4+j];if(w>.5)filas.push([i,lado]);
 }
}
const poses=[{anim:'quieto'},...['tajoA','revesA','estocadaA','parry','salto','torbellino'].flatMap(anim=>[.12,.5,.86].map(k=>({anim,k})))];
// Proyecciones alternadas en espacio de enlace: el mismo correctivo sirve para
// reposo y parry, incluida la muñeca con pesos compartidos con el antebrazo.
for(let vuelta=0;vuelta<10;vuelta++){
 let corregidos=0;
 for(const pose of poses){F.posar(m,{...pose,mezclar:false});m.raiz.updateMatrixWorld(true);
  const manos=Object.fromEntries(['I','D'].map(l=>[l,m.H['mano'+l].matrixWorld])),inversas=Object.fromEntries(['I','D'].map(l=>[l,manos[l].clone().invert()]));
  for(const [i,lado]of filas){mesh.getVertexPosition(i,p).applyMatrix4(inversas[lado]);const r=Math.hypot(p.x,p.z);
   if(r>=.02745||r<1e-8)continue;const rr=.0275;p.x*=rr/r;p.z*=rr/r;
   p.applyMatrix4(manos[lado]).applyMatrix4(mezcla(i).invert()).toArray(a.position.array,i*3);corregidos++;
  }
 }
 if(!corregidos)break;
}
F.posar(m,{anim:'quieto',mezclar:false});m.raiz.updateMatrixWorld(true);
const posed=new Float32Array(a.position.count*3);for(let i=0;i<a.position.count;i++)mesh.getVertexPosition(i,p).toArray(posed,i*3);
// Normales soldadas en las costuras UV evitan cortes de luz sobre el puño.
const acumulados=new Map(),claves=[];
for(let i=0;i<a.position.count;i++){const clave=[0,1,2].map(j=>Math.round(posed[i*3+j]*1e6)).join(',');claves.push(clave);if(!acumulados.has(clave))acumulados.set(clave,new T.Vector3());}
const aa=new T.Vector3(),bb=new T.Vector3(),cc=new T.Vector3(),indices=g.index.array;
for(let j=0;j<indices.length;j+=3){const ids=[indices[j],indices[j+1],indices[j+2]];aa.fromArray(posed,ids[0]*3);bb.fromArray(posed,ids[1]*3).sub(aa);cc.fromArray(posed,ids[2]*3).sub(aa);bb.cross(cc);for(const i of ids)acumulados.get(claves[i]).add(bb);}
d.agarre={};const cod=a=>Buffer.from(a.buffer).toString('base64');let max=0;
for(const lado of ['I','D']){const ids=[],delta=[],normales=[];
 for(const [i,l]of filas){if(l!==lado)continue;const inv=mezcla(i).invert();p.fromBufferAttribute(a.position,i).sub(new T.Vector3().fromArray(original,i*3));max=Math.max(max,p.length());normal.copy(acumulados.get(claves[i])).normalize().applyMatrix3(new T.Matrix3().setFromMatrix4(inv)).sub(new T.Vector3().fromBufferAttribute(a.normal,i));ids.push(i);delta.push(...p.toArray());normales.push(...normal.toArray());}
 d.agarre[lado]={indices:cod(new Uint16Array(ids)),posicion:cod(new Float32Array(delta)),normal:cod(new Float32Array(normales))};
}
fs.writeFileSync(archivo,'/* Brazos del archivo del usuario: rig de 30 falanges y contacto calibrado con el hacha. */\nwindow.CAOZ_ADREIDA_PIERNAS_DATOS='+JSON.stringify(d)+';\n');
console.log(`Correctivo en ${poses.length} poses: ${filas.length} vértices de mano; desplazamiento máximo ${(max*1000).toFixed(2)} mm.`);
