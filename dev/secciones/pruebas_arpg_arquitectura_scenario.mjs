/* Comprueba escala, apertura real de la puerta y agrupación de la arquitectura. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {recursosArquitectura} from './casas-three-exportar.mjs';
const contexto2d=new Proxy({}, {get(o,k){if(k==='getImageData'||k==='createImageData')return (...a)=>({data:new Uint8ClampedArray(a.length===4?a[2]*a[3]*4:a[0]*a[1]*4)});if(k==='createLinearGradient'||k==='createRadialGradient')return ()=>({addColorStop(){}});if(k==='measureText')return ()=>({width:30});return o[k]??(()=>{});}});
const c=vm.createContext({console,atob,document:{createElement:()=>({width:0,height:0,getContext:()=>contexto2d})}});c.window=c;
for(const f of ['visor-three-vendor.js','arquitectura-scenario/datos.js','arpg-three-arquitectura.js','casas-three.js'])vm.runInContext(fs.readFileSync(new URL(f,import.meta.url),'utf8'),c);
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
assert(barrio.children.length<=6,'Cuatro atlas, piedra y agua del abrevadero');
assert.equal(barrio.userData.ocultacion.opacidades.length,7);
for(const m of barrio.children)assert.equal(m.geometry.attributes.aCasa.count,m.geometry.attributes.position.count);
assert.equal(F.casa('pozo').userData.huella[0],2.88,'Conserva la huella del pozo');
assert(F.casa('caja').userData.triangulos>0,'Conserva la utilería');
console.log('✓ Cuatro modelos, atlas locales, escalas, normales y UV válidas, puerta recortada, geometría compartida y '+barrio.children.length+' materiales agrupados.');
