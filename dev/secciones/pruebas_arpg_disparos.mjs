/* Balas reales de Mohamed: cañón, altura, daño y dueño, sin GPU. */
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {extraerDeclaracion} from './fuentes.mjs';
const fuente=fs.readFileSync(new URL('arpg-three-mesa.js',import.meta.url),'utf8');
const get=(n,t='function')=>extraerDeclaracion(fuente,n,t).texto;
const c=vm.createContext({console});c.window=c;c.cinematicaTroll=null;c.finalMago=null;c.casaGoblin=null;
for(const f of ['arpg-three-estilo.js','visor-three-vendor.js','arpg-three-adreida-animacion.js','arpg-three-modelos.js'])vm.runInContext(fs.readFileSync(new URL(f,import.meta.url),'utf8'),c);
c.estilo=c.CAOZ_ARPG_ESTILO.crear();
vm.runInContext(`
const THREE=CAOZ_THREE.THREE,V3=THREE.Vector3,MOD=CAOZ_ARPG_MODELOS.fabrica(THREE),escena=new THREE.Scene(),reloj={t:0};
const obstaculos=[],enemigos=[],jugadores=[],balas=[],PLANOS_MURALLA=[{x:0,z:1},{x:0,z:-1},{x:1,z:0},{x:-1,z:0}],ABIERTO=false,R=26,poses={};
let heroe,ent,ctl,mando,disparosPendientes,punteria=null;
const ejeBala=new V3(0,1,0),ejeCanon=new V3(0,-1,0),estiloBala='plomo';
const frente=a=>new V3(Math.sin(a),0,Math.cos(a)),plano=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z),rumbo=(a,b)=>Math.atan2(b.x-a.x,b.z-a.z),aDistancia=()=>heroe.tipo==='mohamed';
const geoMira=new THREE.BufferGeometry().setFromPoints([new V3(),new V3()]),lineaMira={},puntoMira={position:new V3(),material:{color:new THREE.Color()}};
const particula=()=>{},chispas=()=>{},numero=()=>{},activarFaseTroll=()=>{},blindadoTroll=()=>false,rnd=()=>.5,morir=(e,impacto)=>{e.estado='muere';e.letal=impacto;},mallaBala=()=>new THREE.Group();
${get('HEROES','const')}
${['conHeroe','puntoApuntado','objetivoDisparo','actualizarPunteria','impactoBala','disparar','pasoBalas','danar'].map(n=>get(n)).join('\n')}
const modelo=MOD.crear('mohamed');escena.add(modelo.raiz);
function iniciar(coop,tipo,distancia,dir){
 enemigos.length=0;obstaculos.length=0;for(const b of balas)escena.remove(b.g);balas.length=0;jugadores.length=0;
 const h={id:coop?1:0,tipo:'mohamed',m:modelo,pos:new V3(2,0,4),dir,estado:'quieto',vivo:true,sigilo:0,disparoT:0,balas:6,disparos:0,furia:0,atq:9,basicos:1.5};
 h.entrada={pendiente:false};h.control={apunta:h.pos.clone().addScaledVector(frente(dir),7)};h.mando={activo:true};h.disparosPendientes=[];
 const principal=coop?{tipo:'adreida',atq:12,furia:0,entrada:{},control:{},mando:{},disparosPendientes:[]}:h;
 jugadores.push(principal);if(coop)jugadores.push(h);heroe=principal;ent=principal.entrada;ctl=principal.control;mando=principal.mando;disparosPendientes=principal.disparosPendientes;
 const e={id:1,tipo,pos:h.pos.clone().addScaledVector(frente(dir),distancia),m:MOD.TIPOS[tipo],radio:MOD.TIPOS[tipo].radio,vida:100,estado:'quieto',emp:new V3(),d:{aguante:false},provocado:0};enemigos.push(e);
 h.m.raiz.position.copy(h.pos);h.m.raiz.rotation.y=h.dir;MOD.posar(h.m,{anim:'quieto',armaLista:true,retroceso:1,t:0,dt:1/60});
 return {h,e,principal};
}
`,c);
const run=s=>vm.runInContext(s,c);
for(const coop of [false,true])for(const tipo of ['goblin','cobrador','kobold','saqueador','can'])for(const distancia of [1,1.5,3,6,10])for(const dir of [0,Math.PI/2,Math.PI,-Math.PI/2]){
 run(`var caso=iniciar(${coop},'${tipo}',${distancia},${dir});conHeroe(caso.h,()=>{disparar();actualizarPunteria();});`);
 assert.equal(run('punteria.enemigo'),1,`La mira alcanza ${tipo} a ${distancia} m, cooperativo=${coop}`);
 assert.ok(run('balas[0].origen.distanceTo(punteria.desde)<1e-8&&balas[0].dir.distanceTo(punteria.direccion)<1e-8'),'Cañón, mira y bala coinciden');
 for(let i=0;i<70;i++)run('pasoBalas(1/120)');
 assert.equal(run('caso.e.vida'),86,'Se aplica una sola vez el daño de Mohamed con sus buffs');
 assert.equal(run('caso.h.furia'),3);assert.equal(run('heroe===caso.principal'),true,'Se restaura el jugador activo');
 if(coop)assert.equal(run('caso.principal.furia'),0,'El disparo pertenece a Mohamed');
}
console.log('✓ Daño, buffs y Furia de Mohamed en solo y cooperativo; cinco enemigos, cinco distancias y cuatro direcciones');
for(const hz of [20,30,60,120,144]){
 run('caso=iniciar(true,"goblin",3,0);conHeroe(caso.h,()=>{disparar();actualizarPunteria();});');
 for(let i=0;i<hz;i++)run(`pasoBalas(1/${hz})`);
 assert.equal(run('caso.e.vida'),86,'El daño no depende de los FPS');
}
run('caso=iniciar(true,"goblin",6,0);obstaculos.push({x:2,z:7,r:1.3});conHeroe(caso.h,()=>{disparar();actualizarPunteria();});');
assert.equal(run('punteria.bloqueado'),true);assert.equal(run('punteria.enemigo'),null);
for(let i=0;i<60;i++)run('pasoBalas(1/60)');
assert.equal(run('caso.e.vida'),100,'El pozo sigue protegiendo al enemigo');
run('caso=iniciar(true,"goblin",3,0);caso.e.pos.x+=2;conHeroe(caso.h,()=>{disparar();actualizarPunteria();});');
assert.equal(run('punteria.enemigo'),null,'No atrae la mira hacia un enemigo fuera de la dirección apuntada');
for(let i=0;i<60;i++)run('pasoBalas(1/60)');assert.equal(run('caso.e.vida'),100);
console.log('✓ Impactos a 20/30/60/120/144 FPS; el pozo bloquea y los tiros desviados fallan');

// La bala conserva el ataque y su dirección aunque Mohamed cambie de estado o se mueva.
for(const causa of ['disparo','abanico']){
 run(`caso=iniciar(true,"goblin",6,0);caso.e.vida=1;conHeroe(caso.h,()=>{disparar({causa:'${causa}'});actualizarPunteria();});caso.h.estado='salto';caso.h.pos.x+=10;`);
 for(let i=0;i<70;i++)run('pasoBalas(1/120)');
 assert.equal(run('caso.e.letal.causa'),causa);assert.ok(run('caso.e.letal.direccion.z>.9'));assert.equal(run('caso.e.vida<=0'),true);
}
console.log('✓ Disparo y abanico conservan el origen letal en vuelo y cooperativo');
