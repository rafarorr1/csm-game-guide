/* Adaptación reproducible de los recursos REALES de la web. La GPU recibe dos
   pesos por vértice, atlas originales RGB565 y 24 huesos compactados como máximo. */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {MeshoptSimplifier} from './vendor/meshopt_simplifier.js';
await MeshoptSimplifier.ready;
const raiz=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const secciones=path.resolve(raiz,'../../secciones'), salida=path.join(raiz,'romfs');
fs.mkdirSync(salida,{recursive:true});
const c=vm.createContext({console,URL,atob:s=>Buffer.from(s,'base64').toString('binary'),setTimeout,clearTimeout});c.window=c;
// Sólo se simula el DOM requerido para montar geometrías; no se renderiza la web.
const ctx=new Proxy({}, {get(o,k){if(k==='getImageData'||k==='createImageData')return(...a)=>({data:new Uint8ClampedArray((a.length===4?a[2]*a[3]:a[0]*a[1])*4)});if(k==='createRadialGradient'||k==='createLinearGradient')return()=>({addColorStop(){}});if(k==='measureText')return()=>({width:0});return o[k]||(()=>{});},set(o,k,v){o[k]=v;return true;}});
c.document={currentScript:{src:''},createElement(){return {width:1,height:1,getContext:()=>ctx};}};
function cargar(f){c.document.currentScript.src=new URL('file://'+path.join(secciones,f)).href;vm.runInContext(fs.readFileSync(path.join(secciones,f),'utf8'),c,{filename:f});}
cargar('visor-three-vendor.js');
const {THREE}=c.CAOZ_THREE;
THREE.TextureLoader.prototype.load=function(url,ok){const t=new THREE.Texture();t.userData.fuente=url;queueMicrotask(()=>ok?.(t));return t;};
for(const f of ['adreida-scenario/combate.js','arpg-three-adreida-animacion.js','goblin-scenario/datos.js','arpg-three-goblin.js','kobold-scenario/datos.js','kobold-scenario/muertes.js','arpg-three-kobold.js','adreida-scenario/datos.js','adreida-piernas-scenario/datos.js','arpg-three-adreida.js','hacha-adreida-scenario/datos.js','arpg-three-hacha-adreida.js','arpg-three-modelos.js','arquitectura-scenario/datos.js','carreta-scenario/datos.js','farol-scenario/datos.js','arpg-three-arquitectura.js'])cargar(f);
const F=c.CAOZ_ARPG_MODELOS.fabrica(THREE,{pielGoblin:true}), clips=['quieto','andar','golpe','cargado','salto','parry','torbellino','dolor','muerte','aviso','partido','reves','estocada','muerte1','muerte2','muerte3'],cuadros=24;
const texturas=[],mapas=new Map(),resumen=[];
function textura(mat,tipo){
 const t=mat?.map,s=t?.userData.fuente;if(!s)return -1;
 const fuente=s.startsWith('file:')?fileURLToPath(s):path.resolve(secciones,s);
 if(!fs.existsSync(fuente))throw Error('Textura original ausente: '+fuente);
 if(mapas.has(fuente))return mapas.get(fuente);
 const id=texturas.length,size=['adreida','entramada','piedra','taberna','piso'].includes(tipo)?512:256;
 texturas.push({source:fuente,size,output:path.join(salida,'tex'+id+'.bin'),flip:!!t.flipY});mapas.set(fuente,id);return id;
}
function palette(m){
 const esq=m.mallas.find(x=>x.skeleton)?.skeleton;if(!esq)return {esq:null,seleccion:[0],mapa:[0]};
 const pesos=esq.bones.map(()=>0), nombres=esq.bones.map(b=>Object.entries(m.H).find(([k,v])=>v===b)?.[0]||'');
 for(const mesh of m.mallas){const a=mesh.geometry.attributes;if(!a.skinIndex)continue;for(let i=0;i<a.position.count;i++)for(let j=0;j<4;j++)pesos[a.skinIndex.array[i*4+j]]+=a.skinWeight.array[i*4+j];}
 const importantes=['cuerpo','cadera','torso','cabeza','brazoI','anteI','manoI','brazoD','anteD','manoD','piernaI','rodillaI','pieI','piernaD','rodillaD','pieD'];
 const seleccion=esq.bones.map((_,i)=>i).sort((a,b)=>(importantes.includes(nombres[b])?1e8:pesos[b])-(importantes.includes(nombres[a])?1e8:pesos[a])).slice(0,24).sort((a,b)=>a-b);
 const mapa=esq.bones.map((b,i)=>{while(!seleccion.includes(i)&&b.parent){b=b.parent;i=esq.bones.indexOf(b);}return Math.max(0,seleccion.indexOf(i));});
 return {esq,seleccion,mapa,nombres};
}
function extraer(mesh,pal,estatico){
 let g=mesh.geometry;const a=g.attributes, P=a.position,N=a.normal,C=a.color,U=a.uv,B=a.skinIndex,W=a.skinWeight, map=mesh.material?.map;
 const vertices=[], remap=new Map(), local=[];const norm=new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld);
 for(let i=0;i<P.count;i++){
  const p=new THREE.Vector3().fromBufferAttribute(P,i),n=new THREE.Vector3().fromBufferAttribute(N,i);
  if(estatico){p.applyMatrix4(mesh.matrixWorld);n.applyMatrix3(norm).normalize();}
  const color=[0,1,2].map(k=>Math.pow(Math.max(0,(C?C.array[i*3+k]:1)*(mesh.material?.color?.toArray()[k]??1)),1/2.2));
  let u=U?U.getX(i):0,v=U?U.getY(i):0;if(map){const uv=new THREE.Vector2(u,v);map.updateMatrix();uv.applyMatrix3(map.matrix);u=uv.x;v=map.flipY?uv.y:1-uv.y;}
  const influencias=new Map();if(B)for(let k=0;k<4;k++){const bi=pal.mapa[B.array[i*4+k]]??0;influencias.set(bi,(influencias.get(bi)||0)+W.array[i*4+k]);}
  const ps=[...influencias].sort((a,b)=>b[1]-a[1]),b0=ps[0]?.[0]??0,b1=ps[1]?.[0]??b0,w=ps.length>1?ps[0][1]/(ps[0][1]+ps[1][1]):1;
  const vals=[...p.toArray(),...color,...n.toArray(),b0*3,b1*3,w,u,v];
  const key=vals.map(x=>Math.round(x*1e5)).join(',');let at=remap.get(key);if(at===undefined){at=vertices.length;vertices.push(vals);remap.set(key,at);}local.push(at);
 }
 let indices=g.index?Array.from(g.index.array,i=>local[i]):local;
 return {vertices,indices};
}
function reducir(g,objetivo){
 const vf=new Float32Array(g.vertices.flat()), attrs=new Float32Array(g.vertices.flatMap(v=>[...v.slice(6,9),...v.slice(12,14),...v.slice(9,12)]));
 if(g.indices.length>objetivo*3){const [indices,error]=MeshoptSimplifier.simplifyWithAttributes(Uint32Array.from(g.indices),vf,14,attrs,8,[.15,.15,.15,.5,.5,.05,.05,.2],null,Math.max(12,objetivo*3),.25,['Permissive']);g.indices=Array.from(indices);g.error=error;}
 const remap=new Map(),vertices=[],indices=g.indices.map(i=>{if(!remap.has(i)){remap.set(i,vertices.length);vertices.push(g.vertices[i]);}return remap.get(i);});return {vertices,indices,error:g.error||0};
}
function serializar(nombre,meshes,pal,m=null,limite=2400){
 const originales=meshes.reduce((s,x)=>s+(x.geometry.index?.count||x.geometry.attributes.position.count)/3,0);
 const verts=[],indices=[],grupos=[];
 for(const mesh of meshes){if(mesh.material?.transparent&&mesh.material.opacity<.5)continue;
  const tris=(mesh.geometry.index?.count||mesh.geometry.attributes.position.count)/3;
  const g=reducir(extraer(mesh,pal,!m),Math.max(32,Math.round(limite*tris/originales)));
  if(!g.indices.length)continue;const base=verts.length,inicio=indices.length;verts.push(...g.vertices);indices.push(...g.indices.map(i=>i+base));grupos.push({inicio,cantidad:g.indices.length,textura:textura(mesh.material,nombre)});
 }
 // Fusiona materiales repetidos; cada atlas cuesta una sola llamada de dibujo.
 const fusion=new Map();for(const g of grupos){if(!fusion.has(g.textura))fusion.set(g.textura,[]);fusion.get(g.textura).push(...indices.slice(g.inicio,g.inicio+g.cantidad));}
 indices.length=0;grupos.length=0;for(const [tex,ids] of fusion){grupos.push({inicio:indices.length,cantidad:ids.length,textura:tex});indices.push(...ids);}
 if(verts.length>65535)throw Error('Excede índices u16: '+nombre);
 const nh=pal.seleccion.length,nc=m?clips.length:1,nf=m?cuadros:1;
 const header=Buffer.alloc(32);[0x34475241,verts.length,indices.length,nh,nc,nf,grupos.length,56].forEach((v,i)=>header.writeUInt32LE(v,i*4));
 const vb=Buffer.alloc(verts.length*56);verts.flat().forEach((v,i)=>{if(!Number.isFinite(v))throw Error('Vértice inválido '+nombre);vb.writeFloatLE(v,i*4);});
 const ib=Buffer.alloc(Math.ceil(indices.length*2/4)*4);indices.forEach((v,i)=>ib.writeUInt16LE(v,i*2));
 const gb=Buffer.alloc(grupos.length*12);grupos.forEach((g,i)=>{gb.writeUInt32LE(g.inicio,i*12);gb.writeUInt32LE(g.cantidad,i*12+4);gb.writeInt32LE(g.textura,i*12+8);});
 const poses=Buffer.alloc(nh*nc*nf*48);let at=0;
 if(m){for(const clip of clips)for(let i=0;i<cuadros;i++){
  const k=i/(cuadros-1);let anim=clip,potencia=0,muerte;
  if(clip==='golpe')anim=nombre==='adreida'?'tajoA':nombre==='mohamed'?'disparar':'golpe';
  if(clip==='reves')anim=nombre==='adreida'?'revesA':'golpe';if(clip==='estocada')anim=nombre==='adreida'?'estocadaA':'golpe';
  if(clip==='cargado'){anim=nombre==='adreida'?'tajoA':'golpe';potencia=1;}if(clip==='salto'&&nombre==='mohamed')anim='acrobacia';
  if(clip.startsWith('muerte')||clip==='partido'){anim='muerte';const variante=Number(clip.slice(6))||0;muerte=(m.tipo==='goblin'||m.tipo==='cobrador')?F.crearMuerteGoblin('tajo',variante):{variante:m.tipo==='adreida'?variante%2:variante};}
  F.posar(m,{anim,k,t:k*2,fase:k*Math.PI*2,paso:1,potencia,muerte,sinMezcla:true});m.raiz.updateMatrixWorld(true);pal.esq.update();
  for(const b of pal.seleccion)for(let f=0;f<3;f++)for(const col of [3,2,1,0]){const v=pal.esq.boneMatrices[b*16+col*4+f];if(!Number.isFinite(v))throw Error('Pose inválida');poses.writeFloatLE(v,at);at+=4;}
 }}else [0,0,0,1,0,0,1,0,0,1,0,0].forEach((v,i)=>poses.writeFloatLE(v,i*4));
 const bin=Buffer.concat([header,vb,ib,gb,poses]);fs.writeFileSync(path.join(salida,nombre+'.bin'),bin);
 const r={tipo:nombre,origen:m?.modeloAdreida||m?.modeloGoblin||m?.modeloKobold||(nombre==='mohamed'||nombre==='can'||nombre==='troll'||nombre==='saqueador'||nombre==='mago'?'procedural original':'Scenario'),triangulosOriginales:originales,triangulos3ds:indices.length/3,vertices:verts.length,huesos:nh,materiales:grupos.length,bytes:bin.length};resumen.push(r);console.log(r);
}
for(const tipo of ['adreida','mohamed','goblin','kobold','saqueador','can','troll','cobrador']){
 const m=F.crear(tipo);m.raiz.updateMatrixWorld(true);serializar(tipo,m.mallas,palette(m),m,tipo==='adreida'?3400:tipo==='goblin'||tipo==='cobrador'?1500:2200);
}
for(const variante of ['dosHachas','cuchillo','antorcha']){const m=F.crear('goblin',{varianteGoblin:variante});m.raiz.updateMatrixWorld(true);serializar('goblin-'+variante,m.mallas,palette(m),m,1500);}
for(const variante of ['capucha','acorazado','huesos']){const m=F.crear('kobold',{varianteKobold:variante});m.raiz.updateMatrixWorld(true);serializar('kobold-'+variante,m.mallas,palette(m),m,1800);}
const casas=c.CAOZ_ARQUITECTURA.fabrica(THREE,{rutaArquitectura:new URL('file://'+path.join(secciones,'arquitectura-scenario/')).href,rutaCarreta:new URL('file://'+path.join(secciones,'carreta-scenario/')).href,rutaFarol:new URL('file://'+path.join(secciones,'farol-scenario/')).href});
for(const tipo of ['entramada','piedra','taberna','pozo','carreta']){const casa=casas.casa(tipo);casa.updateMatrixWorld(true);const mallas=[];casa.traverse(o=>{if(o.isMesh)mallas.push(o);});serializar(tipo,mallas,{seleccion:[0],mapa:[0]},null,tipo==='pozo'?1500:tipo==='carreta'?1600:2600);}
const piso=new THREE.Mesh(new THREE.PlaneGeometry(56,56,14,14).rotateX(-Math.PI/2),new THREE.MeshBasicMaterial({map:new THREE.TextureLoader().load(path.join(secciones,'texturas-piso/scenario-color.webp'))}));piso.material.map.repeat.set(15,15);piso.updateMatrixWorld(true);serializar('piso',[piso],{seleccion:[0],mapa:[0]},null,1200);
// Conserva también el decorado y las dos fotografías familiares originales.
for(const f of ['casa-goblin-scenario/datos.js','arpg-three-casa-interior.js'])cargar(f);
const interior=c.CAOZ_ARPG_CASA_INTERIOR.crear(THREE);interior.raiz.updateMatrixWorld(true);const decorado=[];interior.raiz.traverse(o=>{if(o.isMesh)decorado.push(o);});serializar('interior',decorado,{seleccion:[0],mapa:[0]},null,5000);
// El mago original es procedural: reconstrucción de la misma túnica, ojos y báculo.
const mago=new THREE.Group(),tela=new THREE.MeshBasicMaterial({color:0x5b506c,map:new THREE.TextureLoader().load(path.join(secciones,'texturas-goblin/ropa-color.webp'))}),borde=new THREE.MeshBasicMaterial({color:0x91805d}),negro=new THREE.MeshBasicMaterial({color:0x08080f}),verde=new THREE.MeshBasicMaterial({color:0x63df96});
function pieza(g,mat,p,esc=[1,1,1]){const mesh=new THREE.Mesh(g,mat);mesh.position.fromArray(p);mesh.scale.fromArray(esc);mago.add(mesh);return mesh;}
pieza(new THREE.CylinderGeometry(.27,.58,1.55,12,3,true),tela,[0,.82,0]);pieza(new THREE.SphereGeometry(.35,12,8),tela,[0,1.78,0],[1,1.12,.9]);pieza(new THREE.SphereGeometry(.245,12,8),negro,[0,1.77,.32],[.86,1,.3]);
for(const x of [-.08,.08])pieza(new THREE.SphereGeometry(.035,6,4),verde,[x,1.79,.404]);pieza(new THREE.TorusGeometry(.235,.042,5,12),borde,[0,1.76,.39],[.92,1.18,1]);pieza(new THREE.CylinderGeometry(.29,.34,.12,12),borde,[0,1.2,0]);
for(const lado of [-1,1])pieza(new THREE.CylinderGeometry(.16,.24,.68,8),tela,[lado*.42,1.17,0]).rotation.z=lado*.45;
pieza(new THREE.CylinderGeometry(.033,.055,2.1,8),borde,[-.63,1.05,.08]);pieza(new THREE.TorusGeometry(.16,.028,5,12),borde,[-.63,2.23,.08]);pieza(new THREE.OctahedronGeometry(.115),verde,[-.63,2.23,.08]);mago.updateMatrixWorld(true);serializar('mago',mago.children,{seleccion:[0],mapa:[0]},null,1100);
const trabajos=path.join(salida,'texturas-trabajo.json');fs.writeFileSync(trabajos,JSON.stringify(texturas));
const python=process.env.PYTHON_3DS||'python3', result=spawnSync(python,[path.join(raiz,'tools/texturas.py'),trabajos],{stdio:'inherit'});if(result.status!==0)throw Error('No se pudieron convertir las texturas. Instala Pillow y define PYTHON_3DS.');fs.unlinkSync(trabajos);
const texturaBytes=texturas.reduce((n,t)=>n+fs.statSync(t.output).size,0),bytes=resumen.reduce((n,m)=>n+m.bytes,0)+texturaBytes;
fs.writeFileSync(path.join(salida,'texturas.bin'),Uint32Array.from([texturas.length]));
fs.writeFileSync(path.join(salida,'modelos.json'),JSON.stringify({version:2,clips,cuadros,texturas:texturas.map(t=>({origen:path.relative(secciones,t.source),tamano:t.size,archivo:path.basename(t.output)})),modelos:resumen,memoriaRecursosBytes:bytes,memoriaRecursosMiB:bytes/1048576},null,2));
if(bytes>24*1048576)throw Error('Presupuesto de recursos >24MiB');console.log(`Recursos completos: ${(bytes/1048576).toFixed(2)} MiB`);
