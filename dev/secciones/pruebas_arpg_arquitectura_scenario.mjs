/* Comprueba escala, apertura real de la puerta y agrupación de la arquitectura. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {recursosArquitectura} from './casas-three-exportar.mjs';
const contexto2d=new Proxy({}, {get(o,k){if(k==='getImageData'||k==='createImageData')return (...a)=>({data:new Uint8ClampedArray(a.length===4?a[2]*a[3]*4:a[0]*a[1]*4)});if(k==='createLinearGradient'||k==='createRadialGradient')return ()=>({addColorStop(){}});if(k==='measureText')return ()=>({width:30});return o[k]??(()=>{});}});
const c=vm.createContext({console,atob,document:{createElement:()=>({width:0,height:0,getContext:()=>contexto2d})}});c.window=c;
for(const f of ['visor-three-vendor.js','arquitectura-scenario/datos.js','carreta-scenario/datos.js','farol-scenario/datos.js','arpg-three-arquitectura.js','casas-three.js'])vm.runInContext(fs.readFileSync(new URL(f,import.meta.url),'utf8'),c);
const T=c.CAOZ_THREE.THREE,F=c.CAOZ_CASAS.fabrica(T,{texturas:false}),tipos=['entramada','piedra','taberna','pozo'];
for(const ruta of recursosArquitectura)assert(fs.statSync(new URL(ruta,import.meta.url)).size>20,ruta);
const casas=tipos.map(tipo=>F.casa(tipo));
for(const casa of casas){
  assert(casa.userData.arquitecturaScenario);const {tipo}=casa.userData;
  assert(casa.userData.triangulos<(tipo==='pozo'?8100:18000));
  for(const m of casa.children){const g=m.geometry;assert(!g.index,'El fundido recibe triángulos sin índice');
    for(const atributo of ['normal','uv','color'])assert.equal(g.attributes[atributo].count,g.attributes.position.count,atributo+' por vértice');
    for(const atributo of Object.values(g.attributes))assert(atributo.array.every(Number.isFinite),'Geometría finita');
  }
  const caja=new T.Box3().setFromObject(casa);assert(Math.abs(caja.min.y)<.01,'Apoya en el suelo');
  assert(Math.abs(caja.max.y-c.CAOZ_ARQUITECTURA_DATOS[tipo].tamano[1])<.01);
  const copia=F.casa(tipo);assert.equal(copia.children[0].geometry,casa.children[0].geometry,'Las copias comparten geometría');assert.equal(copia.children[0].material,casa.children[0].material);
}
const abierta=F.casa('piedra',{puertaInteractiva:true}),p=abierta.userData.puerta;
assert.equal(p.x,-1.144);assert.equal(p.z,2.36);assert.equal(p.alto,2.8);assert.equal(p.ancho,1.62);
abierta.updateMatrixWorld(true);
for(const x of [-1.9,-1.144,-.4])for(const y of [.25,1,2.7]){
  const rayo=new T.Raycaster(new T.Vector3(x,y,3.25),new T.Vector3(0,0,-1),0,1.64);
  assert.equal(rayo.intersectObject(abierta,true).length,0,'El vano no conserva una puerta estática ni triángulos cruzados');
}
const a=F.casa('entramada',{ancho:5.4}),b=F.casa('entramada',{ancho:6.6});
assert(Math.abs(new T.Box3().setFromObject(b).getSize(new T.Vector3()).x/new T.Box3().setFromObject(a).getSize(new T.Vector3()).x-6.6/5.4)<.001);
const barrio=F.fundir([...casas,abierta,a,b],{ocultables:true});
assert(barrio.children.length<=7,'Cuatro atlas, faroles, piedra y agua del abrevadero');
assert.equal(barrio.userData.ocultacion.opacidades.length,7);
for(const m of barrio.children)assert.equal(m.geometry.attributes.aCasa.count,m.geometry.attributes.position.count);
assert.equal(F.casa('pozo').userData.huella[0],2.88,'Conserva la huella del pozo');
assert(F.casa('caja').userData.triangulos>0,'Conserva la utilería');
console.log('✓ Cuatro modelos, atlas locales, escalas, normales y UV válidas, puerta recortada, geometría compartida y '+barrio.children.length+' materiales agrupados.');

for(const casa of casas.filter(c=>c.userData.tipo!=='pozo')){
  assert.equal(casa.userData.faroles.length,1,'Cada exterior tiene su farol');
  const lampara=casa.children.find(m=>m.geometry.attributes.aLlama);assert(lampara);
  assert(lampara.geometry.attributes.aLlama.array.some(x=>x>0),'La llama tiene emisión');
  assert(lampara.geometry.attributes.aLlama.array.filter(x=>x>0).length<lampara.geometry.attributes.aLlama.count*.05,'La emisión no ilumina toda la carcasa');
}
const escena=new T.Scene(),actualizar=F.lucesFaroles(casas,escena,barrio),camara=new T.PerspectiveCamera();camara.position.set(0,2,6);actualizar(camara);
const luces=escena.children.filter(n=>n.isPointLight);assert.equal(luces.length,2);assert(luces.every(l=>!l.castShadow&&l.intensity>0));
actualizar(camara,false);assert(luces.every(l=>l.intensity===0),'El impacto apaga las luces');
barrio.userData.ocultacion.opacidades.fill(0);actualizar(camara);assert(luces.every(l=>l.intensity===0),'Una fachada invisible no conserva luces flotantes');
console.log('✓ Faroles huecos compartidos, llama localizada y máximo de dos luces sin sombras; ocultación e impacto respetados.');

const carreta=F.casa('carreta');assert.equal(carreta.userData.tipo,'carreta');
assert.equal(carreta.userData.triangulos,8731);assert.equal(carreta.children.length,1);
const cc=new T.Box3().setFromObject(carreta);assert(Math.abs(cc.min.y)<1e-6);assert(Math.abs(cc.max.y-1.25)<1e-6);
const junto=F.fundir([...casas,carreta],{ocultables:true});
assert.equal(junto.children.length,F.fundir(casas).children.length+1,'La carreta añade un único material agrupado');
assert.equal(junto.userData.ocultacion.opacidades.length,casas.length+1,'La carreta participa en ocultación e impacto');
console.log('✓ Carreta: suelo, dimensiones, colisión visual y un material agrupado.');

// Dos barrios con el mismo atlas dejan de formar una esfera que cubra toda la plaza.
const cercanas=[],lejanas=[];
for(const [lista,x,z]of [[cercanas,0,0],[lejanas,60,60]])for(let i=0;i<3;i++){const casa=F.casa(tipos[i]);casa.position.set(x+i*5,0,z);lista.push(casa);}
const edificios=[...cercanas,...lejanas],sectores=F.fundir(edificios,{ocultables:true});sectores.updateMatrixWorld(true);
assert.equal(sectores.userData.ocultacion.cajas.length,edificios.length);
const porCasa=new Uint32Array(edificios.length);
for(const m of sectores.children){assert(m.frustumCulled,'Las casas estáticas conservan descarte por encuadre');assert(!m.matrixAutoUpdate);for(const id of m.geometry.attributes.aCasa.array)porCasa[id]++;}
for(let i=0;i<edificios.length;i++)assert.equal(porCasa[i],edificios[i].children.reduce((n,m)=>n+m.geometry.attributes.position.count,0),'El fundido conserva todos los vértices y el índice original de la casa');
const cam=new T.PerspectiveCamera(32,16/9,.5,1200);cam.position.set(0,17,17);cam.lookAt(0,.8,4);cam.updateMatrixWorld(true);
const frustum=new T.Frustum().setFromProjectionMatrix(new T.Matrix4().multiplyMatrices(cam.projectionMatrix,cam.matrixWorldInverse));
const visibles=sectores.children.filter(m=>frustum.intersectsObject(m));assert(visibles.length>0&&visibles.length<sectores.children.length);
for(const m of visibles)assert(!m.geometry.attributes.aCasa.array.some(id=>id>=cercanas.length),'Ningún lote del barrio lejano se envía al encuadre de combate');
assert.equal(new Set(sectores.children.map(m=>m.material)).size,sectores.children.length,'Cada lote mantiene su hook independiente para la destrucción del epílogo');
console.log('✓ Sectores: mismos vértices, cajas e índices de ocultación; descarte del barrio lejano y materiales independientes para el meteorito.');
