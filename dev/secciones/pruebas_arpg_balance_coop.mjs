/* Escalado real de oleadas/campamentos y acabado del botín cooperativo. */
import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';import {extraerDeclaracion} from './fuentes.mjs';
const s=fs.readFileSync(new URL('arpg-three-mesa.js',import.meta.url),'utf8'),get=(n,t='function')=>extraerDeclaracion(s,n,t).texto;
for(const factor of [1,2]){
 const c=vm.createContext({});c.window=c;vm.runInContext(fs.readFileSync(new URL('visor-three-vendor.js',import.meta.url),'utf8'),c);const run=s=>vm.runInContext(s,c);
 run(`const THREE=CAOZ_THREE.THREE,V3=THREE.Vector3,FACTOR_COOP=${factor},TAU=Math.PI*2,R=26,CAPTURA=true,q={get:()=>null},COOP=${factor===2};let ABIERTO=false;
 const rog={vuelta:1,cartas:[],terminado:-1},heroe={pos:new V3(),vivo:true,alma:60,almaMax:120},jugadores=[heroe],enemigos=[],peligrosTroll=[],CALLES=[-Math.PI/2,Math.PI/6,Math.PI*5/6];let sigId=1;
 const cuerpoDe=()=>({radio:.4,caja:{userData:{}},raiz:{position:new V3()}}),sectorLibre=()=>0,rnd=()=>.5,rumbo=()=>0,calle=a=>new V3(Math.cos(a),0,Math.sin(a));
 const iniciarDestino=()=>{},banner=()=>{},cambiar=(e,s)=>e.estado=s,pintarMapa=()=>{},descubrirMapa=()=>{},plano=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
 ${['DEF','OLEADAS','ol','RITMO','exploracion'].map(n=>get(n,'const')).join('\n')}
 ${['crearEnemigo','pasoOleadas','pasoExploracion','suavizarCarta'].map(n=>get(n)).join('\n')}
 `);
 for(const tipo of ['goblin','kobold','saqueador','can','troll']){assert.equal(run(`crearEnemigo('${tipo}',0,0).vidaMax`),run(`DEF.${tipo}.vida`)*factor);}
 run('rog.vuelta=3');assert.equal(run("crearEnemigo('goblin',0,0).vidaMax"),51*factor);
 run('rog.vuelta=1;enemigos.length=0;ol.auto=true;ol.descanso=0;pasoOleadas(.1)');assert.equal(run('ol.cola.length'),6*factor);
 for(let i=0;i<150;i++)run('pasoOleadas(.2)');assert.equal(run('enemigos.length'),3*factor,'Primer grupo de refuerzos duplicado');
 run('enemigos.length=0;Object.assign(ol,{i:5,cola:[],descanso:0});pasoOleadas(.1)');assert.equal(run("ol.cola.filter(([t])=>t==='troll').length"),factor);assert.equal(run('ol.cola.length'),7*factor);
 run('ABIERTO=true;enemigos.length=0;heroe.pos.set(0,0,-55);pasoExploracion(.01)');assert.equal(run('enemigos.length'),6*factor);
 assert.equal(run('RITMO.cuerpo'),2*factor);
 run('const mat=new THREE.MeshPhysicalMaterial({metalness:1,clearcoat:1,iridescence:1});mat.roughnessMap=new THREE.Texture();mat.userData.u={uDestellos:{value:1}};const carta=new THREE.Group();carta.add(new THREE.Mesh(new THREE.PlaneGeometry(),mat));suavizarCarta(carta)');
 assert.equal(run('mat.clearcoat'),0);assert.equal(run('mat.iridescence'),0);assert.equal(run('mat.roughnessMap'),null);assert.equal(run('mat.userData.u.uDestellos.value'),0);assert.ok(run('mat.roughness>.9&&mat.envMapIntensity<.1'));
}
console.log('✓ Solo intacto; cooperativo duplica vida, jefes, oleadas, campamentos y población; cartas mates sin laca ni destellos');
