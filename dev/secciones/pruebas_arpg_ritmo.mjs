/* Regresión acotada del ritmo: ejecuta la IA y las oleadas reales, sin renderizador.
   Los dobles sustituyen sólo modelos, efectos y daño: no deciden movimientos ni turnos. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {extraerDeclaracion} from './fuentes.mjs';
const fuente=fs.readFileSync(new URL('./arpg-three-mesa.js',import.meta.url),'utf8');
const contexto=vm.createContext({console});contexto.window=contexto;
vm.runInContext(fs.readFileSync(new URL('./visor-three-vendor.js',import.meta.url),'utf8'),contexto);
const obtener=(nombre,tipo='function')=>extraerDeclaracion(fuente,nombre,tipo).texto;
const constantes=['R','PANELES','DEF','RITMO','presion','OLEADAS','ol'].map(n=>obtener(n,'const')).join('\n');
const funciones=['sectorLibre','coordinarEnemigos','crearEnemigo','pasoEnemigo','pasoOleadas','dentroPlaza','separar','enZona','resolverAtaque'].map(n=>obtener(n)).join('\n');
vm.runInContext(`
const FACTOR_COOP=1;const THREE=CAOZ_THREE.THREE,V3=THREE.Vector3,TAU=Math.PI*2,CAPTURA=true,q={get:()=>null};
const rog={vuelta:1,cartas:[],terminado:-1},iniciarDestino=()=>{};
const peligrosTroll=[],activarFaseTroll=()=>{},puedeLanzarGoblin=()=>false,lanzarPiedras=()=>{};
const objetivoEnemigo=()=>heroe,conHeroe=(h,f)=>f();const enemigos=[],obstaculos=[],reloj={t:0},CALLES=[-Math.PI/2,Math.PI/6,Math.PI*5/6];
const ABIERTO=false;const heroe={pos:new V3(),alma:60,almaMax:120,radio:.4,vivo:true,invul:0,estado:'quieto'};const jugadores=[heroe];let sigId=1,semilla=11;
const rnd=()=>(semilla=semilla*16807%2147483647)/2147483647,plano=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z),rumbo=(a,b)=>Math.atan2(b.x-a.x,b.z-a.z);
const frente=a=>new V3(Math.sin(a),0,Math.cos(a)),calle=a=>new V3(Math.cos(a),0,Math.sin(a));
const difAng=(a,b)=>{let d=(b-a)%TAU;if(d>Math.PI)d-=TAU;if(d<-Math.PI)d+=TAU;return d;};
const eventos=[],nacimientos=[];let golpes=0;
const cuerpoDe=tipo=>({radio:tipo==='can'?.62:.34,alto:1.3,caja:{userData:{}},raiz:{position:new V3()},M:{u:{uDisuelve:{value:0}}},mallas:[]});
const cambiar=(e,s)=>{e.estado=s;e.t=0;},banner=()=>{},marca=()=>{},polvo=()=>{},romperPiso=()=>{},temblar=()=>{},brasas=()=>{};
const colocarAtaque=()=>{},cancelarAtaque=e=>{e.ataque=null;},parar=()=>null,herir=()=>{golpes++;},lanzar=()=>{},escena={remove(){}};
function empezarAtaque(e,forma,o){e.alerta={el:{textContent:''}};e.ataque={...o,forma,t0:reloj.t,dir:e.dir,fijado:false};eventos.push({t:reloj.t,id:e.id,tipo:e.tipo,forma,duracion:o.dur});}
${constantes}
${funciones}
function paso(dt=.05){reloj.t+=dt;coordinarEnemigos();for(const e of [...enemigos])pasoEnemigo(e,dt);separar();const antes=new Set(enemigos.map(e=>e.id));pasoOleadas(dt);for(const e of enemigos)if(!antes.has(e.id))nacimientos.push({t:reloj.t,id:e.id,oleada:ol.i});}
function limpiar(){enemigos.length=0;eventos.length=0;nacimientos.length=0;reloj.t=0;sigId=1;golpes=0;presion.siguiente=0;presion.primeraLinea.clear();Object.assign(ol,{auto:false,i:-1,cola:[],espera:1.8,lote:0,descanso:null,fin:false});}
function invocar(tipo,x,z){const e=crearEnemigo(tipo,x,z);e.dentro=true;e.estado='persigue';return e;}
`,contexto);
const ejecutar=s=>vm.runInContext(s,contexto);
// Ocho goblins que llegan juntos: sólo dos se acercan, el resto se abre y los turnos rotan.
const grupo=ejecutar(`limpiar();for(let i=0;i<8;i++)invocar('goblin',(i-3.5)*.8,-7);
let maxAtacan=0,maxCerca=0,minEspera=8;
for(let i=0;i<800;i++){paso();maxAtacan=Math.max(maxAtacan,enemigos.filter(e=>['aviso','golpe'].includes(e.estado)).length);
 if(i>200){maxCerca=Math.max(maxCerca,enemigos.filter(e=>plano(e.pos,heroe.pos)<2.2).length);minEspera=Math.min(minEspera,enemigos.filter(e=>plano(e.pos,heroe.pos)>2.8).length);}}
({maxAtacan,maxCerca,minEspera,participantes:new Set(eventos.map(e=>e.id)).size,ataques:eventos.length,golpes,separacion:Math.min(...eventos.slice(1).map((e,i)=>e.t-eventos[i].t)),vel:DEF.goblin.vel});`);
assert.ok(grupo.vel<5.8*.7,'Mohamed puede ganar distancia mientras dispara');
assert.ok(grupo.maxAtacan<=2&&grupo.maxAtacan>0,'Dos atacantes como máximo');
assert.ok(grupo.maxCerca<=4&&grupo.minEspera>=4,'La multitud no se amontona sobre el jugador');
assert.equal(grupo.participantes,8,'Los turnos rotan: nadie queda esperando para siempre');
assert.ok(grupo.golpes>0&&grupo.separacion>=.55-1e-6,'Siguen siendo peligrosos, con ataques escalonados');
console.log('✓ Grupo de ocho:',JSON.stringify(grupo));
// Dos lanceros y cuatro goblins: los avisos a distancia tampoco empiezan juntos.
const mixto=ejecutar(`limpiar();for(let i=0;i<4;i++)invocar('goblin',(i-1.5)*1.5,-5);invocar('kobold',-6,0);invocar('kobold',6,0);
let maxLanzas=0;for(let i=0;i<500;i++){paso();maxLanzas=Math.max(maxLanzas,enemigos.filter(e=>e.d.lanza&&['aviso','golpe'].includes(e.estado)).length);}
({maxLanzas,tipos:[...new Set(eventos.map(e=>e.tipo))],minIntervalo:Math.min(...eventos.slice(1).map((e,i)=>e.t-eventos[i].t))});`);
assert.equal(mixto.maxLanzas,1);assert.ok(mixto.tipos.includes('goblin')&&mixto.tipos.includes('kobold'));assert.ok(mixto.minIntervalo>=.55-1e-6);
console.log('✓ Ataques mixtos escalonados');
// Sin matar nada, cada oleada pausa los refuerzos tras el primer grupo.
for(let oleada=0;oleada<4;oleada++){
 const r=ejecutar(`limpiar();ol.auto=true;ol.i=${oleada};ol.cola=OLEADAS[ol.i].grupos.flatMap(([tipo,n])=>Array.from({length:n},(_,i)=>[tipo,i]));
 for(let i=0;i<240;i++)paso();({vivos:enemigos.length,cola:ol.cola.length,max:OLEADAS[ol.i].maxVivos,tiempos:nacimientos.map(e=>e.t)});`);
 assert.ok(r.vivos>=3&&r.vivos<=r.max,'La presión limita los refuerzos');assert.ok(r.cola>0);if(r.tiempos.length>3)assert.ok(r.tiempos[3]-r.tiempos[2]>=2.4-1e-6,'Pausa entre grupos');assert.ok(r.vivos<=r.max);assert.ok(r.tiempos[1]-r.tiempos[0]>=.75-1e-6);
}
// Vaciar grupos permite terminar las dos etapas y respeta tres segundos entre ellas.
const oleadas=ejecutar(`limpiar();ol.auto=true;let maxima=[0,0,0,0,0,0,0],cambios=[],ultimaBaja=0;
for(let i=0;i<3000&&!ol.fin;i++){const anterior=ol.i;paso();if(ol.i!==anterior)cambios.push({i:ol.i,pausa:reloj.t-ultimaBaja});
 if(ol.i>=0)maxima[ol.i]=Math.max(maxima[ol.i],enemigos.length);
 if(i%80===79&&enemigos.length){enemigos.length=0;ultimaBaja=reloj.t;}}
({fin:ol.fin,maxima,cambios});`);
assert.ok(oleadas.fin);assert.equal(oleadas.cambios.length,7);assert.ok(oleadas.cambios[4].pausa>=8-1e-6);assert.ok(oleadas.maxima.every((v,i)=>v<=[4,5,6,5,4,4,4][i]));assert.ok(oleadas.cambios.slice(1).every(c=>c.pausa>=3-1e-6));
console.log('✓ Refuerzos por grupos, límites de población y descansos entre oleadas');

// Can mete sus refuerzos en la misma cola: no se salta el límite al gritar.
const jefe=ejecutar(`limpiar();ol.auto=true;ol.i=3;const can=invocar('can',0,-5);can.vida=300;
for(let i=0;i<4;i++)invocar('goblin',i*2-3,-7);
for(let i=0;i<80;i++)paso();const retenidos=ol.cola.length,antes=enemigos.length;
enemigos.splice(1,3);let maxJefe=enemigos.length;for(let i=0;i<160;i++){paso();maxJefe=Math.max(maxJefe,enemigos.length);}
({retenidos,antes,maxJefe,cola:ol.cola.length});`);
assert.equal(jefe.retenidos,3);assert.equal(jefe.antes,5);assert.ok(jefe.maxJefe<=5);assert.equal(jefe.cola,0);
console.log('✓ Los refuerzos de Can esperan y respetan el máximo de cinco');

// Cobro de piso: dos cuadrillas antes del troll; sin contar sus invocaciones durante el combate.
const cobro=ejecutar(`limpiar();ol.auto=true;ol.i=3;ol.descanso=.01;heroe.alma=50;let tipos=[],fasesTroll=[],maximos=0;
for(let i=0;i<1600&&!ol.fin;i++){paso();maximos=Math.max(maximos,enemigos.length);for(const e of enemigos)if(!e.contado){e.contado=true;tipos.push(e.tipo);if(e.tipo==='troll')fasesTroll.push(OLEADAS[ol.i].fase);}
 if(i%100===99)enemigos.length=0;}
({tipos,fasesTroll,maximos,fin:ol.fin,alma:heroe.alma});`);
assert.equal(cobro.tipos.filter(t=>t==='troll').length,1);assert.equal(cobro.tipos.filter(t=>t==='cobrador').length,16);assert.equal(cobro.tipos.length,19);assert.ok(cobro.maximos<=4);assert.ok(cobro.fin);assert.equal(cobro.alma,90);assert.deepEqual(Array.from(cobro.fasesTroll),[3]);
const troll=ejecutar(`limpiar();const e=invocar('troll',0,-3);for(let i=0;i<800;i++)paso();({formas:eventos.map(a=>a.forma),ataques:e.ataques,refuerzos:ol.cola.length});`);
assert.ok(troll.ataques>=2);assert.ok(troll.formas.includes('cono')&&troll.formas.includes('circulo'));assert.equal(troll.refuerzos,0);
console.log('✓ Cobro de piso: tres fases, troll sólo al final, límites de población y curación sólo al entrar');
