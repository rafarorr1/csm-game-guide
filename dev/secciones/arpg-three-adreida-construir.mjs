/* Construye el modelo de juego de Adreida a partir del STL de su miniatura
   (arpg-three-adreida.js). No hace falta volver a ejecutarlo salvo que cambie la
   miniatura o la manera de prepararla; el STL (26 MB) no se guarda en el repo.

     MESHOPT_MODULE=/ruta/a/node_modules/meshoptimizer/index.js \
       node dev/secciones/arpg-three-adreida-construir.mjs miniatura.stl

   Pasos:
     · Suelda los vértices del STL y lo separa en piezas (la miniatura viene en
       158 piezas sueltas: cuerpo, cara, pelo, trenza, falda de piel, peto,
       hombrera, brazales, grebas, hebillas, el hacha…). Cada pieza se pinta con
       su color (la paleta de su carta).
     · Reduce la malla con meshoptimizer (de 524 mil a unos 34 mil triángulos).
     · Oclusión ambiental horneada en los colores: rayos contra una rejilla de
       vóxeles de la malla completa (se oscurecen pliegues, correas y axilas).
     · La ata al esqueleto del juego (el mismo de arpg-three-modelos.js): las
       articulaciones se midieron en la miniatura; cada hueso toma en la pose de
       la miniatura la orientación que, con el giro a cero, da la pose de reposo
       del juego (de pie, brazos caídos, mirando al frente). El cuerpo se pesa
       por cercanía a los huesos; cada pieza de equipo va rígida con los suyos.
     · El hacha se separa de la mano y se vuelve a colocar como la lleva el
       juego: el mango sigue al antebrazo (hacia -Y de la mano), la cabeza de
       doble filo a 1,05 m de la mano con los filos en ±Z.
   Salida: tres mallas (piel y tela lisas; metal; brillo de los ojos) en base64
   dentro de un .js (la CSP solo deja cargar scripts propios). */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const aqui=path.dirname(fileURLToPath(import.meta.url));
const stl=process.argv[2];
if(!stl){console.error('Uso: node arpg-three-adreida-construir.mjs miniatura.stl');process.exit(1);}
const {MeshoptSimplifier}=await import(process.env.MESHOPT_MODULE||'meshoptimizer');
await MeshoptSimplifier.ready;

// three.js y el esqueleto del juego, cargados como en el navegador.
const ctx={console,Math,Float32Array,Uint16Array,Uint32Array,Int8Array,Uint8Array,ArrayBuffer,DataView,Map,Set,WeakMap,Symbol,Object,Array,JSON,Number,String,Error,TypeError,Promise,Reflect,Proxy};
ctx.window=ctx;ctx.self=ctx;ctx.globalThis=ctx;vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(aqui,'visor-three-vendor.js'),'utf8'),ctx);
vm.runInContext(fs.readFileSync(path.join(aqui,'arpg-three-modelos.js'),'utf8'),ctx);
const {THREE}=ctx.CAOZ_THREE;
const V=(x,y,z)=>new THREE.Vector3(x,y,z);

// ---- 1. Leer, soldar y separar en piezas (en mm; de pie en +Y, mirando a +Z) -------------
const f=fs.readFileSync(stl),nt=f.readUInt32LE(80);
const mapa=new Map(),P=[],I=new Uint32Array(nt*3);
for(let i=0;i<nt;i++)for(let k=0;k<3;k++){const o=84+i*50+12+k*12,x=f.readFloatLE(o),y=f.readFloatLE(o+4),z=f.readFloatLE(o+8),c=x+','+y+','+z;
  let v=mapa.get(c);if(v===undefined){v=P.length/3;mapa.set(c,v);P.push(x,z,-y);}I[i*3+k]=v;}
const nv=P.length/3,pos=new Float32Array(P);
const padre=new Int32Array(nv).map((_,i)=>i),raiz=i=>{while(padre[i]!==i){padre[i]=padre[padre[i]];i=padre[i];}return i;};
for(let i=0;i<nt;i++){const a=raiz(I[i*3]);for(let k=1;k<3;k++){const b=raiz(I[i*3+k]);if(a!==b)padre[b]=a;}}
const cuenta=new Map();for(let i=0;i<nt;i++){const r=raiz(I[i*3]);cuenta.set(r,(cuenta.get(r)||0)+1);}
// Piezas numeradas de mayor a menor (el orden es estable para este STL).
const orden=[...cuenta.entries()].sort((a,b)=>b[1]-a[1]||a[0]-b[0]).map(e=>e[0]),num=new Map(orden.map((r,i)=>[r,i]));
const pieza=new Int32Array(nv);for(let i=0;i<nv;i++)pieza[i]=num.get(raiz(i));
const nPiezas=orden.length,trisPieza=orden.map(r=>cuenta.get(r));
const centro=Array.from({length:nPiezas},()=>[0,0,0,0]);
for(let i=0;i<nv;i++){const c=centro[pieza[i]];c[0]+=pos[i*3];c[1]+=pos[i*3+1];c[2]+=pos[i*3+2];c[3]++;}
for(const c of centro){c[0]/=c[3];c[1]/=c[3];c[2]/=c[3];}
console.log(nt,'triángulos,',nv,'vértices,',nPiezas,'piezas');

// ---- 2. Qué es cada pieza --------------------------------------------------------------
const CUERPO=0,CARA=7,MANGO=43,CABEZA_HACHA=25;
const CAT={0:'piel',7:'piel',4:'pelo',9:'pelo',18:'pelo',1:'pelaje',12:'negro',26:'negro',83:'ojo',85:'ojo',92:'colmillo',93:'colmillo',86:'hueso',88:'hueso'};
// El hacha: el mango (eje por componentes principales) y la cabeza; más las piezas pequeñas pegadas a ellos.
function ejePrincipal(ids){const m=V(0,0,0);let n=0;for(let i=0;i<nv;i++)if(ids.has(pieza[i])){m.x+=pos[i*3];m.y+=pos[i*3+1];m.z+=pos[i*3+2];n++;}m.multiplyScalar(1/n);
  const C=[0,0,0,0,0,0];for(let i=0;i<nv;i++)if(ids.has(pieza[i])){const x=pos[i*3]-m.x,y=pos[i*3+1]-m.y,z=pos[i*3+2]-m.z;C[0]+=x*x;C[1]+=x*y;C[2]+=x*z;C[3]+=y*y;C[4]+=y*z;C[5]+=z*z;}
  let v=V(1,1,1).normalize();for(let k=0;k<60;k++)v=V(C[0]*v.x+C[1]*v.y+C[2]*v.z,C[1]*v.x+C[3]*v.y+C[4]*v.z,C[2]*v.x+C[4]*v.y+C[5]*v.z).normalize();return {m,v};}
const mango=ejePrincipal(new Set([MANGO])),cabezaH=ejePrincipal(new Set([CABEZA_HACHA]));
const eje=mango.v.clone();if(eje.dot(cabezaH.m.clone().sub(mango.m))<0)eje.negate();
let tMin=1e9,tMax=-1e9;for(let i=0;i<nv;i++)if(pieza[i]===MANGO){const t=V(pos[i*3],pos[i*3+1],pos[i*3+2]).sub(mango.m).dot(eje);tMin=Math.min(tMin,t);tMax=Math.max(tMax,t);}
const enHacha=new Uint8Array(nPiezas).fill(1);enHacha[CUERPO]=0;
for(let i=0;i<nv;i++){const c=pieza[i];if(!enHacha[c])continue;const p=V(pos[i*3],pos[i*3+1],pos[i*3+2]),d=p.clone().sub(mango.m),t=d.dot(eje),r=d.clone().sub(eje.clone().multiplyScalar(t)).length();
  if(!(r<1.6&&t>tMin-.5&&t<tMax+.5))enHacha[c]=0;}
enHacha[MANGO]=enHacha[CABEZA_HACHA]=1;
console.log('Piezas del hacha:',[...enHacha.keys()].filter(c=>enHacha[c]).join(' '));
const categoria=c=>enHacha[c]?(c===MANGO?'madera':'hierro'):CAT[c]||(trisPieza[c]<800?'metal':'cuero');

// ---- 3. Articulaciones medidas en la miniatura (mm) y escala ------------------------------
const S=.057;
const J={cadera:[0,16.5,1],torso:[0,18,1.3],cabeza:[.2,26.6,-.5],coronilla:[1.2,33,-.6],
  brazoI:[4,24.8,-.4],anteI:[7.4,22.1,-.4],manoI:[9.3,22,3.3],puñoI:[10.4,21.8,5.6],
  brazoD:[-4.3,25.2,-.6],anteD:[-7.1,29.4,-.3],manoD:[-8.4,33.4,-1],puñoD:[-7.3,36.6,-.9],
  piernaI:[2.7,15.8,.6],rodillaI:[6.7,10.2,.2],pieI:[5.6,3,-2.6],puntaI:[8.8,.6,-3.2],
  piernaD:[-3.3,16.2,1.3],rodillaD:[-5.2,9.6,3.9],pieD:[-9,2.8,.9],puntaD:[-8.8,.6,3.4]};
const ojos=V(0,0,0);for(const c of [83,85])ojos.add(V(...centro[c].slice(0,3)).multiplyScalar(.5));
const jv=k=>V(...J[k]);
const base=V(J.cadera[0],0,J.cadera[2]);
const aMundo=p=>p.clone().sub(base).multiplyScalar(S);

// ---- 4. El esqueleto del juego en la pose de la miniatura ---------------------------------
const modelo=ctx.CAOZ_ARPG_MODELOS.fabrica(THREE).crear('adreida'),H=modelo.H;
const huesos=[];H.cuerpo.traverse(o=>{if(o.isBone)huesos.push(Object.keys(H).find(k=>H[k]===o));});
const hijoDe={cadera:'torso',torso:'cabeza',cabeza:'coronilla',brazoI:'anteI',anteI:'manoI',manoI:'puñoI',brazoD:'anteD',anteD:'manoD',manoD:'puñoD',
  piernaI:'rodillaI',rodillaI:'pieI',pieI:'puntaI',piernaD:'rodillaD',rodillaD:'pieD',pieD:'puntaD'};
// Un marco con el eje Y dado y el Z lo más parecido posible al dado.
const marco=(y,z)=>{y=y.clone().normalize();z=z.clone().sub(y.clone().multiplyScalar(z.dot(y))).normalize();const x=new THREE.Vector3().crossVectors(y,z);return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x,y,z));};
// El giro mínimo que lleva el -Y del padre a la dirección del hueso (sin torcerlo).
const sigue=(qPadre,dir)=>new THREE.Quaternion().setFromUnitVectors(V(0,-1,0).applyQuaternion(qPadre),dir.clone().normalize()).multiply(qPadre);
const Q={cuerpo:new THREE.Quaternion(),cadera:new THREE.Quaternion()},W={cuerpo:V(0,0,0),cadera:aMundo(jv('cadera'))};
const dir=k=>jv(hijoDe[k]).sub(jv(k));
Q.torso=marco(dir('torso'),V(0,0,1));
const mirada=ojos.clone().sub(jv('cabeza'));mirada.y=0;
Q.cabeza=marco(dir('cabeza'),mirada);
for(const l of ['I','D']){
  Q['brazo'+l]=marco(dir('brazo'+l).negate(),V(0,0,1));Q['ante'+l]=sigue(Q['brazo'+l],dir('ante'+l));Q['mano'+l]=sigue(Q['ante'+l],dir('mano'+l));
  const pie=dir('pie'+l);pie.y=0;
  Q['pierna'+l]=marco(dir('pierna'+l).negate(),pie);Q['rodilla'+l]=sigue(Q['pierna'+l],dir('rodilla'+l));Q['pie'+l]=Q['rodilla'+l].clone();}
for(const k of huesos)if(!W[k])W[k]=aMundo(jv(k));
const padreDe=k=>Object.keys(H).find(p=>H[p]===H[k].parent);
const local={};
for(const k of huesos){const pk=padreDe(k),qp=pk&&Q[pk]?Q[pk].clone().invert():new THREE.Quaternion(),wp=pk&&W[pk]?W[pk]:V(0,0,0);
  const p=W[k].clone().sub(wp).applyQuaternion(qp),q=qp.clone().multiply(Q[k]);
  local[k]={p:p.toArray().map(x=>+x.toFixed(5)),q:q.toArray().map(x=>+x.toFixed(6))};
  H[k].position.fromArray(local[k].p);H[k].quaternion.fromArray(local[k].q);}
H.raiz.updateMatrixWorld(true);
// Altura de la cadera de pie (piernas rectas): muslo + pierna + tobillo, la media de las dos.
const largo=l=>jv('rodilla'+l).distanceTo(jv('pierna'+l))+jv('pie'+l).distanceTo(jv('rodilla'+l))+J['pie'+l][1];
const caderaDePie=+(S*(largo('I')+largo('D'))/2).toFixed(4);

// ---- 5. Reducir la malla ------------------------------------------------------------------
function reducir(filtro,objetivo){const L=[];for(let i=0;i<nt;i++)if(filtro(pieza[I[i*3]]))L.push(I[i*3],I[i*3+1],I[i*3+2]);
  const [r]=MeshoptSimplifier.simplify(new Uint32Array(L),pos,3,objetivo*3,.02,[]);return r;}
const iCuerpo=reducir(c=>!enHacha[c],30000),iHacha=reducir(c=>enHacha[c],3200);
console.log('Reducida:',iCuerpo.length/3,'+',iHacha.length/3,'triángulos');

// ---- 6. Oclusión ambiental (rejilla de vóxeles de la malla completa) ------------------------
const TAM=.25,caja=new THREE.Box3();for(let i=0;i<nv;i++)caja.expandByPoint(V(pos[i*3],pos[i*3+1],pos[i*3+2]));caja.expandByScalar(5);
const NX=Math.ceil((caja.max.x-caja.min.x)/TAM),NY=Math.ceil((caja.max.y-caja.min.y)/TAM),NZ=Math.ceil((caja.max.z-caja.min.z)/TAM),vox=new Uint8Array(NX*NY*NZ);
const celda=(x,y,z)=>{const i=Math.floor((x-caja.min.x)/TAM),j=Math.floor((y-caja.min.y)/TAM),k=Math.floor((z-caja.min.z)/TAM);return i<0||j<0||k<0||i>=NX||j>=NY||k>=NZ?-1:(k*NY+j)*NX+i;};
for(let i=0;i<nt;i++){const a=I[i*3]*3,b=I[i*3+1]*3,c=I[i*3+2]*3;
  for(const [u,w] of [[0,0],[1,0],[0,1],[.33,.33],[.5,0],[0,.5],[.5,.5]]){const t=1-u-w,x=pos[a]*t+pos[b]*u+pos[c]*w,y=pos[a+1]*t+pos[b+1]*u+pos[c+1]*w,z=pos[a+2]*t+pos[b+2]*u+pos[c+2]*w,q=celda(x,y,z);if(q>=0)vox[q]=1;}}
const RAYOS=[];{const n=32;for(let i=0;i<n;i++){const y=1-(i+.5)/n*2,r=Math.sqrt(1-y*y),a=i*2.399963;RAYOS.push(V(Math.cos(a)*r,y,Math.sin(a)*r));}}
function oclusion(p,nrm){let luz=0,tot=0;for(const d of RAYOS){const c=d.dot(nrm);if(c<=.05)continue;tot+=c;let libre=1;
  for(let s=.55;s<4.5;s+=TAM*.9){const q=celda(p.x+nrm.x*.3+d.x*s,p.y+nrm.y*.3+d.y*s,p.z+nrm.z*.3+d.z*s);if(q>=0&&vox[q]){libre=0;break;}}luz+=libre*c;}
  return tot?luz/tot:1;}

// ---- 7. Pesos: el cuerpo por cercanía a los huesos; cada pieza, rígida con los suyos -------------
const segmentos=huesos.filter(k=>hijoDe[k]).map(k=>({k,a:k==='cadera'?V(0,14.5,1):jv(k),b:jv(hijoDe[k])}));
const distSeg=(p,s)=>{const ab=s.b.clone().sub(s.a),t=Math.max(0,Math.min(1,p.clone().sub(s.a).dot(ab)/ab.lengthSq()));return p.distanceTo(s.a.clone().add(ab.multiplyScalar(t)));};
function pesos(p){const L=segmentos.map(s=>({k:s.k,w:Math.pow(1/(distSeg(p,s)+.25),6)})).sort((a,b)=>b.w-a.w).slice(0,4),t=L.reduce((a,x)=>a+x.w,0);return L.map(x=>({k:x.k,w:x.w/t}));}
const piezaRigida=new Map();
function pesosPieza(c){if(piezaRigida.has(c))return piezaRigida.get(c);const acc=new Map();let n=0;
  for(let i=0;i<nv;i+=3)if(pieza[i]===c){for(const x of pesos(V(pos[i*3],pos[i*3+1],pos[i*3+2])))acc.set(x.k,(acc.get(x.k)||0)+x.w);n++;}
  if(!n)for(const x of pesos(V(...centro[c].slice(0,3))))acc.set(x.k,x.w);
  // Lo que cuelga de la cabeza (pelo, trenza, diadema) va con la cabeza.
  let L=[...acc.entries()].map(([k,w])=>({k,w})).sort((a,b)=>b.w-a.w).slice(0,4);if(L[0].k==='cabeza'||CAT[c]==='pelo')L=[{k:'cabeza',w:1}];
  const t=L.reduce((a,x)=>a+x.w,0);L=L.map(x=>({k:x.k,w:x.w/t}));piezaRigida.set(c,L);return L;}

// ---- 8. Colores (paleta de la carta) --------------------------------------------------------
const PALETA={piel:0x86c49c,pelo:0x252a52,pelaje:0x7a5a3c,negro:0x2a2530,hierro:0xc3c8d2,madera:0x4a3322,cuero:0x6b4428,metal:0x8f929c,ojo:0xff2238,colmillo:0xf3ecd8,hueso:0xe2d6bc};
const CUEROS=[0x6b4428,0x5a3a22,0x7a4e2c,0x4e3220];
const color=new THREE.Color();
function colorDe(c){const g=categoria(c);color.set(g==='cuero'?CUEROS[c%CUEROS.length]:PALETA[g]);return color.clone();}

// ---- 9. Armar las tres mallas --------------------------------------------------------------
const matManoD=H.manoD.matrixWorld.clone();
// El hacha en el marco de la mano del juego: -Y hacia la cabeza, filos en ±Z, cara plana hacia X.
const filos=ejePrincipal(new Set([CABEZA_HACHA])).v;filos.sub(eje.clone().multiplyScalar(filos.dot(eje))).normalize();
// El hacha, al 82% de la de la miniatura: a la escala del juego la cabeza medía casi un metro.
const ESC_HACHA=.82,agarre=cabezaH.m.clone().sub(eje.clone().multiplyScalar(1.05/(S*ESC_HACHA))),ejeY=eje.clone().negate(),ejeX=new THREE.Vector3().crossVectors(ejeY,filos);
const hachaAMundo=p=>{const d=p.clone().sub(agarre);return V(d.dot(ejeX),d.dot(ejeY),d.dot(filos)).multiplyScalar(S*ESC_HACHA).applyMatrix4(matManoD);};
const mallas={piel:{v:[],i:[],mapa:new Map()},metal:{v:[],i:[],mapa:new Map()},brillo:{v:[],i:[],mapa:new Map()}};
const normales=new Float32Array(nv*3);
for(const L of [iCuerpo,iHacha])for(let i=0;i<L.length;i+=3){const a=V(...pos.subarray(L[i]*3,L[i]*3+3)),b=V(...pos.subarray(L[i+1]*3,L[i+1]*3+3)),c=V(...pos.subarray(L[i+2]*3,L[i+2]*3+3));
  const n=b.sub(a).cross(c.sub(a));for(let k=0;k<3;k++){normales[L[i+k]*3]+=n.x;normales[L[i+k]*3+1]+=n.y;normales[L[i+k]*3+2]+=n.z;}}
const nombreMalla=c=>{const g=categoria(c);return g==='ojo'?'brillo':g==='hierro'||g==='metal'?'metal':'piel';};
let semilla=7;const azar=()=>(semilla=(semilla*16807)%2147483647)/2147483647;
function vertice(M,v){if(M.mapa.has(v))return M.mapa.get(v);const c=pieza[v],p=V(pos[v*3],pos[v*3+1],pos[v*3+2]),n=V(normales[v*3],normales[v*3+1],normales[v*3+2]).normalize();
  const ao=oclusion(p,n),col=colorDe(c).multiplyScalar((.3+.7*ao)*(1+(azar()-.5)*.06));
  let mundo,nm,w;
  if(enHacha[c]){mundo=hachaAMundo(p);nm=V(n.dot(ejeX),n.dot(ejeY),n.dot(filos)).transformDirection(matManoD);w=[{k:'manoD',w:1}];}
  else{mundo=aMundo(p);nm=n;w=c===CUERPO||c===CARA?pesos(p):pesosPieza(c);}
  const id=M.v.length;M.v.push({p:mundo,n:nm,c:col,w});M.mapa.set(v,id);return id;}
for(const L of [iCuerpo,iHacha])for(let i=0;i<L.length;i+=3){const M=mallas[nombreMalla(pieza[L[i]])];for(let k=0;k<3;k++)M.i.push(vertice(M,L[i+k]));}

// ---- 10. Empaquetar ---------------------------------------------------------------------------
const trozos=[],cab={huesos,local,caderaDePie,mallas:{}};let desp=0;
const poner=(nombre,arr)=>{const b=Buffer.from(arr.buffer,arr.byteOffset,arr.byteLength);const pad=(4-b.length%4)%4;trozos.push(b,Buffer.alloc(pad));const r={o:desp,n:arr.length};desp+=b.length+pad;return r;};
for(const [nombre,M] of Object.entries(mallas)){const n=M.v.length,bb=new THREE.Box3();for(const x of M.v)bb.expandByPoint(x.p);const tam=bb.getSize(V(0,0,0)).max(V(1e-4,1e-4,1e-4));
  const Pq=new Uint16Array(n*3),Nq=new Int8Array(n*3),Cq=new Uint8Array(n*3),SI=new Uint8Array(n*4),SW=new Uint8Array(n*4);
  M.v.forEach((x,i)=>{for(const [a,e] of [['x',0],['y',1],['z',2]]){Pq[i*3+e]=Math.round((x.p[a]-bb.min[a])/tam[a]*65535);Nq[i*3+e]=Math.round(x.n[a]*127);}
    // En sRGB (8 bits en lineal se escalonarían en los tonos oscuros); el juego los pasa a lineal al cargar.
    const s=x.c.clone().convertLinearToSRGB();Cq[i*3]=Math.min(255,Math.round(s.r*255));Cq[i*3+1]=Math.min(255,Math.round(s.g*255));Cq[i*3+2]=Math.min(255,Math.round(s.b*255));
    // Pesos en 8 bits que suman exactamente 255 (lo que sobra o falta va al mayor, el primero).
    const q=x.w.map(y=>Math.round(y.w*255));q[0]+=255-q.reduce((a,b)=>a+b,0);
    x.w.forEach((y,j)=>{SI[i*4+j]=huesos.indexOf(y.k);SW[i*4+j]=q[j];});});
  const indices=n<65536?new Uint16Array(M.i):new Uint32Array(M.i);
  cab.mallas[nombre]={vertices:n,triangulos:M.i.length/3,min:bb.min.toArray().map(x=>+x.toFixed(5)),tam:tam.toArray().map(x=>+x.toFixed(5)),
    pos:poner(nombre,Pq),normal:poner(nombre,Nq),color:poner(nombre,Cq),skinIndex:poner(nombre,SI),skinWeight:poner(nombre,SW),indices:{...poner(nombre,indices),bits:n<65536?16:32}};
  console.log(nombre,n,'vértices',M.i.length/3,'triángulos');}
const b64=Buffer.concat(trozos).toString('base64');
const salida=`/* Adreida, la Guerrera Semiorca: el modelo de su miniatura para el ARPG (arpg-three).
   Generado por arpg-three-adreida-construir.mjs a partir del STL: no editar a mano.
   CAOZ_ADREIDA = {huesos, local (posición y giro de cada hueso en la pose de la miniatura),
   caderaDePie, mallas{piel,metal,brillo}: desplazamientos en los datos}; datos en base64. */
'use strict';
window.CAOZ_ADREIDA=Object.freeze({cab:${JSON.stringify(cab)},
datos:'${b64}'});
`;
fs.writeFileSync(path.join(aqui,'arpg-three-adreida.js'),salida);
console.log('arpg-three-adreida.js:',(salida.length/1024).toFixed(0),'KB');
