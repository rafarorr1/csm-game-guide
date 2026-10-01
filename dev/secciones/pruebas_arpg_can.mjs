/* Combo real de Can: geometría, ritmo variable, parry cooperativo y limpieza de avisos, sin GPU. */
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {extraerDeclaracion} from './fuentes.mjs';
const fuente=fs.readFileSync(new URL('./arpg-three-mesa.js',import.meta.url),'utf8');
const get=(n,t='function')=>extraerDeclaracion(fuente,n,t).texto;
const c=vm.createContext({console});c.window=c;
for(const f of ['visor-three-vendor.js','arpg-three-adreida-animacion.js','arpg-three-modelos.js'])vm.runInContext(fs.readFileSync(new URL(f,import.meta.url),'utf8'),c);
vm.runInContext(`
const THREE=CAOZ_THREE.THREE,V3=THREE.Vector3,TAU=Math.PI*2,reloj={t:0},escena=new THREE.Scene(),enemigos=[],jugadores=[],presion={siguiente:0,primeraLinea:new Set()};
let heroe,paron=0,recibidos=[];
const frente=a=>new V3(Math.sin(a),0,Math.cos(a)),plano=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z),rumbo=(a,b)=>Math.atan2(b.x-a.x,b.z-a.z),difAng=(a,b)=>Math.atan2(Math.sin(b-a),Math.cos(b-a));
const cambiar=(e,s)=>{e.estado=s;e.t=0;},rnd=()=>.5,dentroPlaza=()=>{},activarFaseTroll=()=>{},destinoEnemigo=(e,p)=>p,numero=()=>{},chispas=()=>{},marca=()=>{},polvo=()=>{},temblar=()=>{};
const geoLinea=new THREE.PlaneGeometry(1,1).rotateX(-Math.PI/2).translate(0,0,.5),geoMarca=new THREE.PlaneGeometry(2,2).rotateX(-Math.PI/2);
const etiqueta=()=>({pos:new V3(),el:{textContent:'',classList:{toggle(){}},style:{setProperty(){}}}}),quitarEtiqueta=()=>{};
const herir=(d)=>{heroe.alma-=d;recibidos.push({id:heroe.id,d});},esquivado=()=>{};
const conHeroe=(h,f)=>{const anterior=heroe;heroe=h;try{return f();}finally{heroe=anterior;}};
${['DEF','PARRY','R','matMarca'].map(n=>get(n,'const')).join('\n')}
${['matZona','empezarAtaque','colocarAtaque','cancelarAtaque','enZona','parar','parryPerfecto','aturdirPorParry','bloqueado','resolverAtaque','empezarComboCan','pasoEnemigo'].map(n=>get(n)).join('\n')}
function nuevoHeroe(id,x=0,z=2.5){return {id,pos:new V3(x,0,z),estado:'quieto',t:0,radio:.4,invul:0,vivo:true,dir:Math.PI,alma:120,furia:0,parrys:0,bloqueos:0,cd:{parry:.5,salto:5,esquiva:1,ulti:20}};}
function iniciar(dir=0){for(const e of enemigos)cancelarAtaque(e);enemigos.length=0;jugadores.length=0;reloj.t=0;paron=0;recibidos=[];presion.siguiente=0;
 heroe=nuevoHeroe(0);jugadores.push(heroe);
 const e={id:1,tipo:'can',d:{...DEF.can},pos:new V3(),dir,estado:'persigue',t:0,vida:800,vidaMax:800,radio:.62,emp:new V3(),cd:0,provocado:0,destello:0,dentro:true,fase:0,paso:0,ataques:0,m:{alto:2.4}};
 enemigos.push(e);empezarComboCan(e);return e;
}
function avanzarHasta(e,condicion,dt){for(let i=0;i<400&&!condicion();i++){reloj.t+=dt;pasoEnemigo(e,dt);}if(!condicion())throw Error('El combo no llegó al estado esperado');}
`,c);
const run=s=>vm.runInContext(s,c);
for(const dir of [0,Math.PI/2,Math.PI,-Math.PI/3]){
 run(`var can=iniciar(${dir});var centro=can.pos.clone().addScaledVector(frente(can.dir),2.5),izq=can.pos.clone().addScaledVector(frente(can.dir-Math.PI/3),2.5),der=can.pos.clone().addScaledVector(frente(can.dir+Math.PI/3),2.5);`);
 assert.equal(run('enZona(can.ataque,can,centro,.24)'),true);
 assert.equal(run('enZona(can.ataque,can,izq,.24)||enZona(can.ataque,can,der,.24)'),false);
 assert.equal(run('enZona(can.ataque,can,can.pos.clone().addScaledVector(frente(can.dir),5),.24)'),false,'No golpea fuera del radio');
 run('var direccion=can.comboCan.dir;cancelarAtaque(can,true);heroe.pos.set(9,0,-6);empezarComboCan(can,1);');
 assert.equal(run('can.comboCan.dir===direccion'),true,'Los conos no persiguen al jugador');
 assert.equal(run('enZona(can.ataque,can,centro,.24)'),false,'El sector central queda libre');
 assert.equal(run('enZona(can.ataque,can,izq,.24)&&enZona(can.ataque,can,der,.24)'),true);
 assert.equal(run('enZona(can.ataque,can,can.pos.clone().addScaledVector(frente(can.dir+Math.PI),2.5),.24)'),false,'La espalda queda fuera del semicírculo');
 // Un empuje desplaza el centro de todos los conos con Can, no su orientación.
 run('can.pos.set(2,0,3);colocarAtaque(can);');
 for(const i of [0,1])assert.equal(run(`can.ataque.zonas[${i}].centro===can.pos&&can.ataque.m.children[${i}].position.x===can.pos.x&&can.ataque.m.children[${i}].position.z===can.pos.z&&can.ataque.m.children[${i}].scale.x===can.ataque.zonas[${i}].radio&&can.ataque.m.children[${i}].rotation.y===can.ataque.zonas[${i}].dir&&can.ataque.m.children[${i}].material.uniforms.uAng.value===can.ataque.zonas[${i}].ang`),true,'Aviso y daño comparten centro, radio y ángulo');
 assert.equal(run('enZona(can.ataque,can,can.pos.clone().addScaledVector(frente(direccion),2.5),.24)'),false);
 assert.equal(run('enZona(can.ataque,can,can.pos.clone().addScaledVector(frente(direccion+Math.PI/3),2.5),.24)'),true);
}
console.log('✓ Conos radiales: frente → lados, hueco central y origen unido a Can en cuatro orientaciones');
for(const hz of [30,60,120,144]){
 run(`can=iniciar();avanzarHasta(can,()=>can.estado==='golpe',1/${hz});var tCentro=reloj.t;heroe.pos.copy(can.pos).addScaledVector(frente(can.dir+Math.PI/3),2.5);avanzarHasta(can,()=>can.comboCan?.paso===1,1/${hz});avanzarHasta(can,()=>can.estado==='golpe',1/${hz});var tLados=reloj.t;avanzarHasta(can,()=>can.estado==='persigue',1/${hz});`);
 assert.deepEqual(Array.from(run('recibidos.map(x=>x.d)')),[32,27]);
 assert.ok(run('tLados-tCentro')>=.77-1e-8&&run('tLados-tCentro')<.77+2/hz+.001,'Ritmo constante al cambiar FPS');
 assert.equal(run('can.comboCan'),null);assert.equal(run('escena.children.length'),0,'No quedan marcas después del combo');
 assert.ok(run('can.cd')>1,'Se puede contraatacar después de los dos golpes');
}
console.log('✓ Dos impactos, sin repetir daño, a 30/60/120/144 FPS; recuperación al terminar');
for(const fase of [0,1]){
 run(`can=iniciar();${fase?'cancelarAtaque(can,true);empezarComboCan(can,1);heroe.pos.copy(can.pos).addScaledVector(frente(can.dir-Math.PI/3),2.5);':''}heroe.estado='parry';heroe.t=.1;heroe.dir=rumbo(heroe.pos,can.pos);resolverAtaque(can);`);
 assert.equal(run('heroe.alma'),120);assert.equal(run('can.estado'),'aturdido');assert.equal(run('can.comboCan'),null);assert.equal(run('escena.children.length'),0);
 assert.equal(run('heroe.parrys'),1);assert.equal(run('heroe.cd.salto+heroe.cd.esquiva+heroe.cd.parry'),0);assert.equal(run('heroe.cd.ulti'),19);
 assert.ok(run('can.expuestoHasta>reloj.t'),'Parry abre una ventana de contraataque');
}
// En cooperativo, un parry en cualquiera de los flancos cancela ambos impactos antes de dañar al compañero.
run("can=iniciar();cancelarAtaque(can,true);empezarComboCan(can,1);heroe.pos.copy(can.pos).addScaledVector(frente(can.dir-Math.PI/3),2.5);jugadores.push(nuevoHeroe(1));jugadores[1].pos.copy(can.pos).addScaledVector(frente(can.dir+Math.PI/3),2.5);jugadores[1].estado='parry';jugadores[1].t=.1;jugadores[1].dir=rumbo(jugadores[1].pos,can.pos);resolverAtaque(can);");
assert.deepEqual(Array.from(run('jugadores.map(h=>h.alma)')),[120,120]);assert.equal(run('can.comboCan'),null);
run("can=iniciar();heroe.estado='parry';heroe.t=.25;resolverAtaque(can);");assert.equal(run('heroe.alma'),110);assert.equal(run('can.comboCan.paso'),0,'Un bloqueo tardío no cancela la cadena');
run("can=iniciar();heroe.invul=.1;resolverAtaque(can);");assert.equal(run('heroe.alma'),120,'El dash evita el golpe');
run('can=iniciar();reloj.t=can.ataque.dur-.1;colocarAtaque(can);');assert.equal(run('can.ataque.m.children[0].material.uniforms.uC.value.getHex()'),0xbfffff,'Señal de parry en la ventana final');
run('cancelarAtaque(can);');assert.equal(run('can.comboCan'),null);assert.equal(run('escena.children.length'),0,'Interrupción o muerte retiran toda la cadena');
console.log('✓ Parry en ambos golpes y cooperativo; bloqueo, dash, color del aviso y cancelación limpia');
const M=c.CAOZ_ARPG_MODELOS.fabrica(c.CAOZ_THREE.THREE),m=M.crear('can');
for(const anim of ['canCentro','canLados'])for(let i=0;i<=120;i++){M.posar(m,{anim,k:i/60,t:i/60,dt:1/60,mezclar:true,estado:'aviso'});m.raiz.updateMatrixWorld(true);for(const h of Object.values(m.H))assert.ok(h.matrixWorld.elements.every(Number.isFinite));}
console.log('✓ Poses de Can válidas durante preparación, impacto y recuperación');

M.posar(m,{anim:'canCentro',k:1.2,t:2});const finalCentro=Object.values(m.H).map(h=>({q:h.quaternion.clone(),p:h.position.clone()}));
M.posar(m,{anim:'canLados',k:0,t:2});for(const [i,h] of Object.values(m.H).entries()){assert.ok(h.quaternion.angleTo(finalCentro[i].q)<1e-6,'El segundo golpe empieza desde la pose del primero');assert.ok(h.position.distanceTo(finalCentro[i].p)<1e-9);}
console.log('✓ Continuidad de cuerpo y brazos entre el golpe central y los laterales');
