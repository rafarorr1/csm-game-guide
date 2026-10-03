/* Extrae el movimiento corporal de Quaternius y lo adapta al rig de Caoz.
   Uso: node dev/secciones/adreida-scenario/preparar-movimiento.mjs /ruta/biblioteca.glb
   Sólo compila datos; no incorpora el modelo ni requiere un cargador GLTF en la partida. */
import fs from 'node:fs';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
const archivo=new URL('../arpg-three-adreida-animacion.js',import.meta.url);
const c=vm.createContext({console});c.window=c;vm.runInContext(fs.readFileSync(new URL('../visor-three-vendor.js',import.meta.url),'utf8'),c);const T=c.CAOZ_THREE.THREE;
const buf=fs.readFileSync(process.argv[2]),length=buf.readUInt32LE(12),d=JSON.parse(buf.subarray(20,20+length)),bin=buf.subarray(28+length);
if(createHash('sha256').update(buf).digest('hex')!=='4c748767741a3e495d89667b9a218b690ba9810b9517a12e960780e3ca72c4e9')throw Error('La biblioteca no coincide con la fuente documentada.');
function read(i){const a=d.accessors[i],size={SCALAR:1,VEC3:3,VEC4:4,MAT4:16}[a.type],C={5126:Float32Array,5123:Uint16Array,5125:Uint32Array,5121:Uint8Array}[a.componentType],out=new C(a.count*size);if(a.bufferView!==undefined){const b=d.bufferViews[a.bufferView],start=(b.byteOffset||0)+(a.byteOffset||0);for(let n=0;n<a.count;n++)for(let k=0;k<size;k++)out[n*size+k]=new C(bin.buffer,bin.byteOffset+start+n*(b.byteStride||size*C.BYTES_PER_ELEMENT)+k*C.BYTES_PER_ELEMENT,1)[0];}if(a.sparse){const s=a.sparse,I={5121:Uint8Array,5123:Uint16Array,5125:Uint32Array}[s.indices.componentType],iv=d.bufferViews[s.indices.bufferView],vv=d.bufferViews[s.values.bufferView],ix=new I(bin.buffer,bin.byteOffset+(iv.byteOffset||0)+(s.indices.byteOffset||0),s.count),v=new C(bin.buffer,bin.byteOffset+(vv.byteOffset||0)+(s.values.byteOffset||0),s.count*size);for(let n=0;n<s.count;n++)out.set(v.subarray(n*size,(n+1)*size),ix[n]*size);}return out;}
const nodes=d.nodes.map(n=>{const b=new T.Object3D();b.name=n.name;if(n.translation)b.position.fromArray(n.translation);if(n.rotation)b.quaternion.fromArray(n.rotation);if(n.scale)b.scale.fromArray(n.scale);if(n.matrix)new T.Matrix4().fromArray(n.matrix).decompose(b.position,b.quaternion,b.scale);return b;});d.nodes.forEach((n,i)=>n.children?.forEach(j=>nodes[i].add(nodes[j])));const roots=nodes.filter(n=>!n.parent);roots.forEach(n=>n.updateMatrixWorld(true));const named=Object.fromEntries(nodes.map(n=>[n.name,n]));const rest=nodes.map(n=>({p:n.position.clone(),q:n.quaternion.clone(),s:n.scale.clone(),world:n.getWorldQuaternion(new T.Quaternion())}));
function setup(name){const a=d.animations.find(a=>a.name===name),tracks=a.channels.map(ch=>{const s=a.samplers[ch.sampler],i=read(s.input),o=read(s.output);if(s.interpolation&&s.interpolation!=='LINEAR')throw Error(s.interpolation);return {node:nodes[ch.target.node],prop:{rotation:'quaternion',translation:'position',scale:'scale'}[ch.target.path],times:i,values:o,size:o.length/i.length};}),duration=Math.max(...tracks.map(t=>t.times[t.times.length-1]));return {tracks,duration};}
const q=new T.Quaternion();function sample(clip,t){nodes.forEach((n,i)=>{n.position.copy(rest[i].p);n.quaternion.copy(rest[i].q);n.scale.copy(rest[i].s);});for(const tr of clip.tracks){let i=0;while(i<tr.times.length-2&&tr.times[i+1]<t)i++;const w=Math.min(1,Math.max(0,(t-tr.times[i])/(tr.times[i+1]-tr.times[i]||1))),target=tr.node[tr.prop];target.fromArray(tr.values,i*tr.size);if(tr.prop==='quaternion')target.slerp(q.fromArray(tr.values,(i+1)*tr.size),w);else for(let j=0;j<tr.size;j++)target.setComponent(j,tr.values[i*tr.size+j]*(1-w)+tr.values[(i+1)*tr.size+j]*w);}roots.forEach(n=>n.updateMatrixWorld(true));}
const namedRest={};for(const n of ['pelvis','spine_03','Head'])namedRest[n]=named[n].getWorldQuaternion(new T.Quaternion());

const resultado={muestras:32,campos:['caderaX','caderaY','caderaZ','pechoX','pechoY','pechoZ','cabezaX','cabezaY','cabezaZ','lateral','vertical']};
for(const [clave,nombre] of [['caminar','Walk_Loop'],['correr','Sprint_Loop']]){
 const clip=setup(nombre),filas=[],pie=new T.Vector3();let inicio=0,maximo=-Infinity;
 // La fase cero coincide con el pie izquierdo adelantado, antes del apoyo.
 for(let i=0;i<240;i++){sample(clip,i/240*clip.duration);named.foot_l.getWorldPosition(pie);if(pie.z>maximo){maximo=pie.z;inicio=i/240;}}
 for(let i=0;i<resultado.muestras;i++){
  sample(clip,((inicio+i/resultado.muestras)%1)*clip.duration);const fila=[];
  for(const n of ['pelvis','spine_03','Head']){
   const delta=named[n].getWorldQuaternion(new T.Quaternion()).multiply(namedRest[n].clone().invert());
   const e=new T.Euler().setFromQuaternion(delta);fila.push(e.x,e.y,e.z);
  }
  const p=named.pelvis.getWorldPosition(new T.Vector3());fila.push(p.x,p.y);filas.push(fila);
 }
 // Quitar la inclinación de reposo del maniquí: se añade la guardia de Adreida en runtime.
 const medias=filas[0].map((_,j)=>filas.reduce((s,f)=>s+f[j],0)/filas.length);
 resultado[clave]={nombre,duracion:clip.duration,inicio,datos:filas.flatMap(f=>f.map((v,j)=>+((v-medias[j]).toFixed(6))))};
}
const inicio='  // INICIO MOVIMIENTO QUATERNIUS',fin='  // FIN MOVIMIENTO QUATERNIUS';
const bloque=inicio+' — generado por adreida-scenario/preparar-movimiento.mjs; CC0.\n  const movimientoCorporal='+JSON.stringify(resultado)+';\n'+fin;
const actual=fs.readFileSync(archivo,'utf8');
fs.writeFileSync(archivo,actual.includes(inicio)?actual.slice(0,actual.indexOf(inicio))+bloque+actual.slice(actual.indexOf(fin)+fin.length):actual.replace('  const limites=',bloque+'\n  const limites='));
console.log('Preparados Walk_Loop y Sprint_Loop: 32 muestras corporales por ciclo.');
