/* Exporta geometría y poses reales del ARPG a datos nativos de PICA200.
   No modifica el juego web. Las mallas ligeras conservan huesos y colores. */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const raiz=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const secciones=path.resolve(raiz,'../../secciones');
const c=vm.createContext({console});c.window=c;
for(const f of ['visor-three-vendor.js','arpg-three-adreida-animacion.js','arpg-three-modelos.js'])vm.runInContext(fs.readFileSync(path.join(secciones,f),'utf8'),c);
const {THREE}=c.CAOZ_THREE,F=c.CAOZ_ARPG_MODELOS.fabrica(THREE,{pielGoblin:false});
const tipos=['adreida','mohamed','goblin','kobold','saqueador','can','troll','cobrador'];
const clips=['quieto','andar','golpe','cargado','salto','parry','torbellino','dolor','muerte','aviso','partido','reves','estocada'];
const cuadros=24,resumen=[];
function simplificar(m,paso){
 const vertices=[],indices=[],mapa=new Map(),caras=new Set();
 for(const mesh of m.mallas){const g=mesh.geometry,P=g.attributes.position,N=g.attributes.normal,C=g.attributes.color,B=g.attributes.skinIndex;const ids=[];
  for(let i=0;i<P.count;i++){
   const p=[P.getX(i),P.getY(i),P.getZ(i)],n=[N.getX(i),N.getY(i),N.getZ(i)],color=[C.getX(i),C.getY(i),C.getZ(i)],h=B.getX(i);
   const key=h+':'+p.map(v=>Math.round(v/paso)).join(',');let id=mapa.get(key);
   if(id===undefined){id=vertices.length;mapa.set(key,id);vertices.push({p:[0,0,0],n:[0,0,0],color:[0,0,0],h,cantidad:0});}
   const v=vertices[id];v.cantidad++;for(let j=0;j<3;j++){v.p[j]+=p[j];v.n[j]+=n[j];v.color[j]+=color[j];}ids.push(id);
  }
  for(let i=0;i<ids.length;i+=3){const a=ids.slice(i,i+3);if(new Set(a).size<3)continue;const k=[...a].sort((x,y)=>x-y).join(',');if(caras.has(k))continue;caras.add(k);indices.push(...a);}
 }
 const usados=new Set(indices),nuevos=[],remap=new Map();for(const id of usados){remap.set(id,nuevos.length);const v=vertices[id],l=Math.hypot(...v.n)||1;nuevos.push([...v.p.map(x=>x/v.cantidad),...v.color.map(x=>Math.pow(Math.max(0,x/v.cantidad),1/2.2)),...v.n.map(x=>x/l),v.h*3]);}
 return {vertices:nuevos,indices:indices.map(i=>remap.get(i))};
}
function serializar(tipo,id){
 const m=F.crear(tipo),esqueleto=m.mallas[0].skeleton,original=m.mallas.reduce((s,x)=>s+x.geometry.attributes.position.count/3,0);
 if(esqueleto.bones.length>24)throw Error('Demasiados huesos para PICA200: '+tipo);
 const limite=tipo==='adreida'?2800:tipo==='goblin'||tipo==='cobrador'?1100:1800;
 let paso=.008,g=simplificar(m,paso);while(g.indices.length/3>limite&&paso<.16){paso*=1.2;g=simplificar(m,paso);}
 if(g.vertices.length>65535)throw Error('Índices fuera de rango');
 const partes=[],cab=Buffer.alloc(24);[0x33475241,g.vertices.length,g.indices.length,esqueleto.bones.length,clips.length,cuadros].forEach((v,i)=>cab.writeUInt32LE(v,i*4));partes.push(cab);
 const vb=Buffer.alloc(g.vertices.length*40);g.vertices.flat().forEach((x,i)=>vb.writeFloatLE(x,i*4));partes.push(vb);
 const ib=Buffer.alloc(Math.ceil(g.indices.length*2/4)*4);g.indices.forEach((x,i)=>ib.writeUInt16LE(x,i*2));partes.push(ib);
 const poses=Buffer.alloc(clips.length*cuadros*esqueleto.bones.length*48);let pos=0;
 for(const clip of clips)for(let i=0;i<cuadros;i++){
  const k=i/(cuadros-1),goblin=['goblin','cobrador'].includes(tipo);let anim=clip,potencia=0,muerte;
  if(clip==='golpe')anim=tipo==='adreida'?'tajoA':tipo==='mohamed'?'disparar':'golpe';
  if(clip==='reves')anim=tipo==='adreida'?'revesA':'golpe';
  if(clip==='estocada')anim=tipo==='adreida'?'estocadaA':'golpe';
  if(clip==='cargado'){anim=tipo==='adreida'?'tajoA':'golpe';potencia=1;}
  if(clip==='salto'&&tipo==='mohamed')anim='acrobacia';
  if(clip==='partido'){anim='muerte';if(goblin)muerte={...F.crearMuerteGoblin('cargado',0),partido:true};}
  if(clip==='muerte'&&goblin)muerte=F.crearMuerteGoblin('tajo',0);
  F.posar(m,{anim,k,t:k*2,fase:k*Math.PI*2,paso:1,potencia,muerte});m.raiz.updateMatrixWorld(true);esqueleto.update();
  for(let b=0;b<esqueleto.bones.length;b++)for(let fila=0;fila<3;fila++)for(const col of [3,2,1,0]){const v=esqueleto.boneMatrices[b*16+col*4+fila];if(!Number.isFinite(v))throw Error('Pose inválida');poses.writeFloatLE(v,pos);pos+=4;}
 }
 partes.push(poses);const bin=Buffer.concat(partes);fs.writeFileSync(path.join(raiz,'romfs',tipo+'.bin'),bin);
 resumen.push({tipo,triangulosOriginales:original,triangulos3ds:g.indices.length/3,vertices:g.vertices.length,huesos:esqueleto.bones.length,bytes:bin.length});
}
fs.mkdirSync(path.join(raiz,'romfs'),{recursive:true});tipos.forEach(serializar);
fs.writeFileSync(path.join(raiz,'romfs','modelos.json'),JSON.stringify({version:1,clips,cuadros,modelos:resumen},null,2));
console.log(JSON.stringify(resumen,null,2));
// Sólo necesitamos la geometría de las casas: los materiales se hornean a colores.
// El lienzo neutro sustituye la pintura procedural que no viaja a la GPU de 3DS.
c.document={createElement(){const canvas={width:1,height:1};const ctx=new Proxy({}, {get(o,k){if(k==='getImageData'||k==='createImageData')return(...args)=>({data:new Uint8ClampedArray((args.length===4?args[2]*args[3]:args[0]*args[1])*4)});if(k==='createRadialGradient'||k==='createLinearGradient')return()=>({addColorStop(){}});if(k==='measureText')return()=>({width:0});return o[k]||(()=>{});},set(o,k,v){o[k]=v;return true;}});canvas.getContext=()=>ctx;return canvas;}};
vm.runInContext(fs.readFileSync(path.join(secciones,'casas-three.js'),'utf8'),c);
const casas=c.CAOZ_CASAS.fabrica(THREE),tonos={yeso:0xc7b99b,madera:0x523521,piedra:0x79756d,teja:0x8b4535,tablas:0x624128,letrero:0x79532d,ventana:0xe8a850};
for(const tipo of ['entramada','piedra','taberna','pozo']){
 const casa=casas.casa(tipo,{semilla:21});casa.updateMatrixWorld(true);const verts=[];
 for(const mesh of casa.children){const mat=mesh.material,nombre=Object.keys(casas.materiales).find(k=>casas.materiales[k]===mat);if(['halo','derrame'].includes(nombre))continue;
  const g=mesh.geometry,P=g.attributes.position,N=g.attributes.normal,C=g.attributes.color,color=new THREE.Color(tonos[nombre]??mat.color?.getHex()??0xc9a45a),norm=new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld);
  for(let i=0;i<P.count;i++){const p=new THREE.Vector3().fromBufferAttribute(P,i).applyMatrix4(mesh.matrixWorld),n=new THREE.Vector3().fromBufferAttribute(N,i).applyMatrix3(norm).normalize();const rgb=[color.r,color.g,color.b].map((v,j)=>Math.pow(Math.min(1,v*(C?C.array[i*3+j]:1)),1/2.2));verts.push([...p.toArray(),...rgb,...n.toArray(),0]);}
 }
 const cab=Buffer.alloc(24);[0x33475241,verts.length,0,1,1,1].forEach((v,i)=>cab.writeUInt32LE(v,i*4));const vb=Buffer.alloc(verts.length*40);verts.flat().forEach((x,i)=>vb.writeFloatLE(x,i*4));const pose=Buffer.alloc(48);[0,0,0,1,0,0,1,0,0,1,0,0].forEach((x,i)=>pose.writeFloatLE(x,i*4));
 fs.writeFileSync(path.join(raiz,'romfs',tipo+'.bin'),Buffer.concat([cab,vb,pose]));console.log(tipo,verts.length/3,'triangulos');
}
