/* El pavimento forma losas reales y cae a la sima; sus tiempos se pueden buscar hacia atrás. */
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const c=vm.createContext({console,atob});c.window=c;
for(const f of ['visor-three-vendor.js','adreida-scenario/combate.js','arpg-three-adreida-animacion.js','adreida-scenario/datos.js','adreida-piernas-scenario/datos.js','arpg-three-adreida.js','hacha-adreida-scenario/datos.js','arpg-three-hacha-adreida.js','arpg-three-modelos.js','adreida-scenario/cinematica.js','arpg-three-adreida-cine.js','arpg-three-mago-particulas.js','arpg-three-mago-hechizo.js','arpg-three-final-mago.js'])vm.runInContext(fs.readFileSync(new URL(f,import.meta.url),'utf8'),c,{filename:f});
const T=c.CAOZ_THREE.THREE,MOD=c.CAOZ_ARPG_MODELOS.fabrica(T),escena=new T.Scene(),casas=new T.Group(),camara=new T.PerspectiveCamera(32,16/9,.5,1200);
casas.userData.ocultacion={cajas:[],opacidades:new Float32Array()};escena.add(casas);
const textura=new T.DataTexture(new Uint8Array([120,110,80,255]),1,1),piso=new T.MeshStandardMaterial({map:textura,normalMap:textura,roughnessMap:textura,roughness:.81}),actor={tipo:'adreida',vivo:true,m:MOD.crear('adreida'),pos:new T.Vector3(9,0,11),dir:0,fase:0};escena.add(actor.m.raiz);
let impacto=null,regresos=0,ui=null;const cine=c.CAOZ_ARPG_FINAL_MAGO.fabrica(T,MOD,{escena,casas,camara,piso:()=>piso,impactar(p){impacto=p.clone();},volver(){regresos++;},interfaz(s){ui={...s};}});
cine.iniciar([actor],{puerta:actor.pos.clone()});const losas=cine.recursos.losasPiso,datos=losas.userData.losas,g=losas.geometry,a=g.attributes;
assert(losas.isMesh&&!losas.isInstancedMesh,'Las caras contiguas forman una malla compartida de pavimento');assert(!losas.visible,'No hay una segunda capa de piso antes del impacto');
assert(datos.length>30&&datos.length<300,'La fractura tiene detalle sin cientos de objetos por cuadro');
assert.equal(losas.material.map,piso.map);assert.equal(losas.material.normalMap,piso.normalMap);assert.equal(losas.material.roughnessMap,piso.roughnessMap);assert.notEqual(losas.material,piso,'Los efectos de losas no modifican el piso compartido');
assert(a.aLosa&&a.aLosa.count===a.position.count);assert(a.position.count<15000,'Las losas conservan un presupuesto pequeño de geometría');
for(const atributo of Object.values(a))assert(atributo.array.every(Number.isFinite),'Atributos de fractura finitos');
let area=0;const superiores=[];
for(let i=0;i<a.position.count;i+=3){
  if(a.normal.getY(i)<.99)continue;
  const p=[0,1,2].map(j=>[a.position.getX(i+j),a.position.getY(i+j),a.position.getZ(i+j)]);
  assert(p.every(x=>Math.abs(x[1]-.028)<1e-6),'Las caras superiores parten a ras del pavimento');
  area+=Math.abs((p[1][0]-p[0][0])*(p[2][2]-p[0][2])-(p[1][2]-p[0][2])*(p[2][0]-p[0][0]))/2;
  superiores.push(p.map(x=>[x[0],x[2]]));
}
assert(Math.abs(area-datos.reduce((s,l)=>s+l.area,0))<.001,'La geometría superior representa las celdas completas');
assert(area>Math.PI*8.4**2*.97&&area<Math.PI*8.4**2*1.06,'Las losas cubren la superficie del cráter, no un anillo exterior');
const dentro=(x,z,p)=>{const [a,b,c]=p,d=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1]);if(Math.abs(d)<1e-12)return false;const u=((b[1]-c[1])*(x-c[0])+(c[0]-b[0])*(z-c[1]))/d,v=((c[1]-a[1])*(x-c[0])+(a[0]-c[0])*(z-c[1]))/d;return u>=-1e-6&&v>=-1e-6&&u+v<=1+1e-6;};
for(let x=-7;x<=7;x+=.4)for(let z=-7;z<=7;z+=.4)if(Math.hypot(x,z)<7.5)assert(superiores.some(t=>dentro(x,z,t)),'No quedan huecos iniciales dentro del pavimento: '+x+','+z);
assert(datos.every(l=>l.grosor>.2&&l.grosor<1),'Los bloques tienen canto, no son láminas sin espesor');
const masTemprana=Math.min(...datos.map(l=>l.demora)),masTardia=Math.max(...datos.map(l=>l.demora));assert(masTardia-masTemprana>.45&&masTardia<1,'La fractura avanza antes de caer el último bloque');
const shader={uniforms:{},vertexShader:'#include <beginnormal_vertex>\n#include <begin_vertex>'};losas.material.onBeforeCompile(shader);
assert.equal(shader.uniforms.uTiempoPiso,losas.userData.tiempo,'El shader usa el reloj capturado por la cinemática');
assert(shader.vertexShader.includes('transformed.y-=')&&shader.vertexShader.includes('objectNormal=girarLosa'),'La GPU desplaza las caras y sus normales');
let previo=null;for(let i=0;i<2400&&!cine.estado().impactado;i++){previo=cine.capturarCuadro();cine.paso(1/60);}assert(impacto&&cine.estado().impactado);
assert(losas.visible);assert.equal(losas.userData.tiempo.value,0);assert(losas.position.distanceTo(new T.Vector3(impacto.x,0,impacto.z))<1e-8,'Las losas parten del punto real de impacto');
assert(a.uv.array.some(v=>v!==0),'La colocación asigna las UV del piso a todas las losas');
const inicio=cine.capturarCuadro(),indices=[0,Math.floor(datos.length/3),Math.floor(datos.length/2),datos.length-1];
for(const i of indices){
  const l=datos[i],reposo=cine.muestraLosa(i,0),espera=cine.muestraLosa(i,l.demora),a=cine.muestraLosa(i,l.demora+.4),b=cine.muestraLosa(i,l.demora+.8),d=cine.muestraLosa(i,l.demora+1.2);
  assert.deepEqual(reposo.posicion,espera.posicion,'Cada losa sostiene el piso hasta su turno');assert.equal(reposo.giro,0);
  assert(a.posicion[1]>b.posicion[1]&&b.posicion[1]>d.posicion[1],'La losa desciende continuamente');
  assert(d.posicion[1]-2*b.posicion[1]+a.posicion[1]<-.5,'La velocidad hacia abajo crece por gravedad');
  const radio=p=>Math.hypot(p[0]-impacto.x,p[2]-impacto.z);assert(radio(d.posicion)<radio(a.posicion),'La losa cae hacia el agujero en vez de alejarse del centro');
  assert(d.giro>a.giro,'El bloque se inclina durante su caída');
}
while(cine.estado().fase==='impacto'&&cine.estado().t<1.5)cine.paso(1/60);const cayendo=cine.capturarCuadro(),posiciones=indices.map(i=>cine.muestraLosa(i));
for(let i=0;i<300&&!cine.estado().terminado;i++)cine.paso(1/60);assert(cine.estado().terminado);const final=cine.capturarCuadro();assert.equal(ui.fase,'fin');assert.equal(ui.negro,1);assert.equal(regresos,0);
const geometria=losas.geometry,vertices=a.position.array.slice(),numeroObjetos=escena.children.length;
for(const cuadro of [previo,final,inicio,cayendo,previo,cayendo]){
  cine.mostrarCuadro(cuadro);assert.deepEqual(cine.estado().pisoRoto,cuadro.estado.pisoRoto,'Buscar restaura edad, centro y número de losas');
  assert.equal(losas.userData.tiempo.value,cuadro.estado.pisoRoto.edad);assert.equal(losas.visible,cuadro.estado.impactado);
  if(cuadro===cayendo)for(const [j,i]of indices.entries()){const ahora=cine.muestraLosa(i),antes=posiciones[j];assert.equal(ahora.edad,antes.edad);assert.equal(ahora.giro,antes.giro);for(let k=0;k<3;k++)assert(Math.abs(ahora.posicion[k]-antes.posicion[k])<1e-6,'Se restaura la misma caída sin resimular');}
  assert.equal(losas.geometry,geometria);assert.deepEqual(a.position.array,vertices,'El scrubbing no deforma el búfer compartido');assert.equal(escena.children.length,numeroObjetos);
}
cine.cancelar();assert.equal(losas.visible,false);assert.equal(losas.userData.tiempo.value,-1);
console.log(`✓ Pavimento: ${datos.length} losas con grosor y mapas del piso, cobertura inicial, fractura escalonada, caída gravitacional hacia la sima y búsqueda reversible sin duplicar geometría.`);
