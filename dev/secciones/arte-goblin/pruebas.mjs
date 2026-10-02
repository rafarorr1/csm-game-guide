/* Correspondencia geométrica de la guía: UV v1, modelo real y puntos del localizador. */
import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';import crypto from 'node:crypto';
import {extraerDeclaracion} from '../fuentes.mjs';
const atlas=JSON.parse(fs.readFileSync(new URL('goblin-uv-v1.json',import.meta.url),'utf8'));
const fuente=fs.readFileSync(new URL('vista.js',import.meta.url),'utf8'),c=vm.createContext({atlas});c.window=c;
for(const f of ['visor-three-vendor.js','arpg-three-adreida-animacion.js','arpg-three-modelos.js'])vm.runInContext(fs.readFileSync(new URL('../'+f,import.meta.url),'utf8'),c);
vm.runInContext(extraerDeclaracion(fuente,'piezaUV','const').texto+'\n'+extraerDeclaracion(fuente,'localizarUV').texto,c);
const pieza=(u,v)=>vm.runInContext(`piezaUV(${u},${v})`,c),localizar=c.localizarUV,THREE=c.CAOZ_THREE.THREE,MOD=c.CAOZ_ARPG_MODELOS.fabrica(THREE),m=MOD.crear('goblin'),v=new THREE.Vector3();
const vistos=new Set();let n=0;
for(const mesh of m.mallas){
 const material=Object.keys(m.M).find(k=>m.M[k]===mesh.material),d=atlas.mallas.find(a=>a.material===material),P=mesh.geometry.attributes.position.array;
 assert.equal(crypto.createHash('sha256').update(Buffer.from(P.buffer,P.byteOffset,P.byteLength)).digest('hex'),d.huella,'La guía usa exactamente la geometría entregada');
 mesh.geometry.setAttribute('uv',new THREE.Float32BufferAttribute(d.uv,2));const uv=mesh.geometry.attributes.uv;
 for(let i=0;i<uv.count;i+=3){
  const x=(uv.getX(i)+uv.getX(i+1)+uv.getX(i+2))/3,y=(uv.getY(i)+uv.getY(i+1)+uv.getY(i+2))/3,p=pieza(x,y);assert.ok(p);vistos.add(p.id);
  const r=localizar({x,y},mesh,i);if(!r)continue;n++;
  for(const peso of r.pesos)assert.ok(Math.abs(peso-1/3)<1e-8,'El centro UV devuelve el centro del triángulo');
  const afuera=localizar({x:2,y:2},mesh,i);assert.equal(afuera,null,'No asigna un punto fuera del triángulo');
  for(const anim of ['quieto','andar','golpe']){
   MOD.posar(m,{anim,t:.27,k:.45,fase:1.2,paso:1,dt:1/60,mezclar:false});m.raiz.rotation.y=.8;m.raiz.updateMatrixWorld(true);
   const esperado=new THREE.Vector3(),actual=new THREE.Vector3();for(let j=0;j<3;j++){mesh.getVertexPosition(i+j,v).applyMatrix4(mesh.matrixWorld);esperado.addScaledVector(v,1/3);actual.addScaledVector(v,r.pesos[j]);}
   assert.ok(actual.distanceTo(esperado)<1e-8,'El punto sigue la superficie durante la animación');
  }
 }
}
assert.equal(vistos.size,39);assert.ok(n>1000);assert.equal(pieza(.99,.01),undefined,'Las UV ajenas no se asocian por accidente');
const vacio=atlas.piezas.every(p=>{const [x,y,w,h]=p.celda;return !(.99*4096>=x&&.99*4096<x+w&&.99*4096>=y&&.99*4096<y+h);});assert.ok(vacio,'La última celda sigue vacía');
console.log(`✓ 39 piezas, geometría v1 intacta y ${n} triángulos: puntos exactos en reposo, caminata y ataque; zonas ajenas rechazadas`);
