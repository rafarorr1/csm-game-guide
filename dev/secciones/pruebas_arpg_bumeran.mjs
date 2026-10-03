/* Búmeran real: geometría, ida, curva dirigida, impactos y recuperación a distintos FPS. */
import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
import {extraerDeclaracion} from './fuentes.mjs';
const fuente=fs.readFileSync(new URL('arpg-three-mesa.js',import.meta.url),'utf8'),get=(n,t='function')=>extraerDeclaracion(fuente,n,t).texto;
const c=vm.createContext({console,atob});c.window=c;c.cinematicaTroll=null;for(const f of ['visor-three-vendor.js','arpg-three-adreida-animacion.js','adreida-scenario/datos.js','arpg-three-adreida.js','arpg-three-modelos.js'])vm.runInContext(fs.readFileSync(new URL(f,import.meta.url),'utf8'),c);
const run=s=>vm.runInContext(s,c);
run(`const THREE=CAOZ_THREE.THREE,V3=THREE.Vector3,MOD=CAOZ_ARPG_MODELOS.fabrica(THREE),escena=new THREE.Scene(),tiempo={value:0},R=26,bumeranes=[],enemigos=[],obstaculos=[],pausa={activa:false},rog={abierto:false};
const plano=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z),frente=a=>new V3(Math.sin(a),0,Math.cos(a)),rumbo=(a,b)=>Math.atan2(b.x-a.x,b.z-a.z),suave=k=>k<=0?0:k>=1?1:k*k*(3-2*k);
let ABIERTO=false,heroe,ent={},ctl={},mando={},disparosPendientes=[],impactos=[],rechazos=0;
const aDistancia=()=>heroe.tipo==='mohamed',puntoApuntado=()=>heroe.pos.clone().add(frente(heroe.dir)),chispas=()=>{},rechazo=()=>rechazos++;
const danar=(e,d,o)=>impactos.push({id:e.id,dueno:heroe.id,fase:heroe.bumeran.fase,d});
${['BUMERAN','HAB','geoEstelaFlecha','matEstelaFlecha','matEstelaHacha','matEstelaBumeran','libre'].map(n=>get(n,'const')).join('\n')}
${['conHeroe','cambiar','usar','manoBumeran','lanzarBumeran','volverBumeran','quitarBumeran','pasoBumeranes','iniciarGolpe','iniciarCarga'].map(n=>get(n)).join('\n')}
function preparar(){for(const b of [...bumeranes])quitarBumeran(b);obstaculos.length=enemigos.length=impactos.length=0;rechazos=0;
 heroe={id:7,tipo:'adreida',m:MOD.crear('adreida'),pos:new V3(),dir:0,estado:'quieto',t:0,vivo:true,atq:12,especial:1,furia:0,cd:{bumeran:0,provocar:0,torbellino:0},entrada:{},control:{},mando:{},disparosPendientes:[]};ent=heroe.entrada;ctl=heroe.control;mando=heroe.mando;disparosPendientes=heroe.disparosPendientes;
 MOD.posar(heroe.m,{anim:'quieto',t:0});return heroe;
}
`);
run('preparar();lanzarBumeran(heroe);pasoBumeranes(.25)');assert.equal(run('heroe.bumeran.fase'),'vuelta');assert.ok(Math.abs(run('heroe.bumeran.g.position.distanceTo(heroe.bumeran.desde)')-4)<1e-6,'Regresa exactamente tras cuatro metros');
run('preparar();usar("provocar",new V3(0,0,8))');assert.equal(run('heroe.estado'),'lanzarHacha');assert.equal(run('heroe.cd.bumeran'),10);assert.equal(run('heroe.furia'),0);
run('lanzarBumeran(heroe);heroe.estado="quieto";heroe.cd.bumeran=0');assert.equal(run('usar("provocar")'),false,'Un parry no duplica el arma que ya vuela');assert.equal(run('usar("torbellino")'),false);run('iniciarGolpe();iniciarCarga()');assert.equal(run('heroe.estado'),'quieto');
const modelo=run('heroe.m');for(const mesh of modelo.mallas){const g=mesh.geometry;assert.ok(g.index);if(g.attributes.armaArrojable)assert.equal(g.index.count,0,'No quedan triángulos del arma en mano');else assert.ok(g.index.count>0,'El cuerpo y las manos siguen visibles');}
const a=run('MOD.crearHachaAdreida(heroe.m)'),b=run('MOD.crearHachaAdreida(heroe.m)');assert.equal(a.children.length,3);a.children.forEach((m,i)=>{assert.equal(m.geometry,b.children[i].geometry);assert.equal(m.material,b.children[i].material);});
for(const hz of [20,30,60,144]){
 run('preparar();enemigos.push({id:1,estado:"quieto",pos:new V3(0,0,4),radio:3,m:{alto:4}});lanzarBumeran(heroe);var origen=heroe.bumeran.desde.clone(),maxDist=0,curva=0;');
 for(let i=0;i<hz*3;i++)run(`pasoBumeranes(1/${hz});if(heroe.bumeran){const b=heroe.bumeran;if(b.fase==='ida'){maxDist=Math.max(maxDist,b.distancia);if(Math.abs(b.g.position.x-origen.x)>1e-6)throw Error('Ida no recta');}else curva=Math.max(curva,Math.abs(b.g.position.x-origen.x));}`);
 assert.equal(run('bumeranes.length'),0,`${hz}: vuelve a la mano`);assert.equal(run('heroe.m.sinHacha'),false);assert.ok(run('curva')>1,`${hz}: regresa con arco lateral`);
 assert.equal(run('impactos.length'),2,`${hz}: un impacto por tramo`);assert.equal(run('impactos.every(i=>i.dueno===7&&i.d===18)'),true,'Daño y autor correctos');assert.equal(run('heroe.m.mallas.filter(m=>m.geometry.attributes.armaArrojable).every(m=>m.geometry.index===null)'),true,'Recupera toda la geometría');
}
function trayectoria(dir){run('preparar();lanzarBumeran(heroe);pasoBumeranes(BUMERAN.alcance/BUMERAN.vel)');run(`heroe.dir=${dir};heroe.m.raiz.rotation.y=heroe.dir;pasoBumeranes(.55)`);return run('heroe.bumeran.g.position.clone()');}
assert.ok(trayectoria(0).distanceTo(trayectoria(Math.PI))>2,'Girar cambia la curva de regreso');
run('preparar();lanzarBumeran(heroe)');for(let i=0;i<240;i++)run('heroe.pos.x+=5.8/60;heroe.m.raiz.position.copy(heroe.pos);pasoBumeranes(1/60)');assert.equal(run('bumeranes.length'),0,'Alcanza a una Adreida que sigue corriendo');
run('preparar();obstaculos.push({x:0,z:3,r:1});lanzarBumeran(heroe);pasoBumeranes(.3)');assert.equal(run('heroe.bumeran.fase'),'vuelta','Cobertura fuerza el regreso');run('pasoBumeranes(3)');assert.equal(run('bumeranes.length'),0,'No queda atrapada por el obstáculo');
run('preparar();lanzarBumeran(heroe);heroe.vivo=false;pasoBumeranes(.02)');assert.equal(run('bumeranes.length'),0);assert.equal(run('heroe.m.sinHacha'),false,'Limpia el vuelo al morir');
run('preparar();ABIERTO=true;heroe.pos.x=50;heroe.m.raiz.position.copy(heroe.pos);lanzarBumeran(heroe);pasoBumeranes(.15)');assert.equal(run('heroe.bumeran.fase'),'ida','Funciona fuera de la ciudad en el mundo abierto');run('pasoBumeranes(2)');assert.equal(run('bumeranes.length'),0);run('ABIERTO=false');
run('preparar();heroe.tipo="mohamed";usar("provocar")');assert.equal(run('heroe.estado'),'grito','Mohamed conserva su habilidad');
console.log('✓ Búmeran: geometría y manos, E, enfriamiento, ida recta, curva dirigida, daño por tramo, cooperativo, carrera, obstáculos y muerte a 20/30/60/144 FPS');
