/* Ataques reales: azar espaciado, hachas interceptables y quemadura personal. */
import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
import {extraerDeclaracion} from './fuentes.mjs';
const fuente=fs.readFileSync(new URL('arpg-three-mesa.js',import.meta.url),'utf8'),get=(n,t='function')=>extraerDeclaracion(fuente,n,t).texto;
const c=vm.createContext({console,tutorial:null,enTutorial:()=>false,casaGoblin:null,cinematicaTroll:null,finalMago:null});c.window=c;for(const f of ['visor-three-vendor.js','arpg-three-adreida-animacion.js','arpg-three-modelos.js'])vm.runInContext(fs.readFileSync(new URL(f,import.meta.url),'utf8'),c);
const run=s=>vm.runInContext(s,c);
run(`const THREE=CAOZ_THREE.THREE,V3=THREE.Vector3,MOD=CAOZ_ARPG_MODELOS.fabrica(THREE),TAU=Math.PI*2,FACTOR_COOP=1,R=26,DUR_ESQ=.2;
const escena=new THREE.Scene(),reloj={t:0},tiempo={value:0},enemigos=[],jugadores=[],lanzas=[],obstaculos=[],presion={primeraLinea:new Set([1]),siguiente:0},pausa={activa:false},rog={abierto:false};
let heroe,ent={},ctl={mov:new V3()},mando={},disparosPendientes=[],paron=0,paradas=0,dañoDevuelto=0,muestras=0,azar=.1;
const rnd=()=>{muestras++;return azar;},plano=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z),frente=a=>new V3(Math.sin(a),0,Math.cos(a)),rumbo=(a,b)=>Math.atan2(b.x-a.x,b.z-a.z);
const activarFaseTroll=()=>{},destinoEnemigo=(e,p)=>p,dentroPlaza=()=>{},colocarAtaque=()=>{},difAng=(a,b)=>b-a;
const numero=()=>{},temblar=()=>{},chispas=()=>{},particula=()=>{},marca=()=>{},polvo=()=>{},cancelarAtaque=e=>e.ataque=null,esquivado=()=>{},danar=(e,n)=>{dañoDevuelto+=n;};
function parryPerfecto(){paradas++;cambiar(heroe,'quieto');}
function empezarAtaque(e,forma,a){e.ataque={...a,forma,dir:e.dir,t0:reloj.t};e.alerta={el:{textContent:''}};}
const geoHalo=new THREE.SphereGeometry(1,8,6),materialesHaloFlecha=[0xffa530,0xfff3c0,0xffd060].map(color=>new THREE.MeshBasicMaterial({color}));
${['geoLanza','matPuntaLanza','geoPluma','geoEstelaFlecha','matEstelaFlecha','materialesHaloHacha','matEstelaHacha','HAB','PARRY','HEROES','RITMO'].map(n=>get(n,'const')).join('\n')}
${['cambiar','conHeroe','herir','prenderFuego','apagarFuego','pasoFuego','recargaHabilidad','usar','parar','bloqueado','pasoLibreEnemigo','intentarHachaGoblin','pasoEnemigo','resolverAtaque','enZona','lanzar','lanzarHacha','alturaHacha','pasoLanzas'].map(n=>get(n)).join('\n')}
function preparar(variante='clasico'){
 reloj.t=0;presion.siguiente=0;presion.primeraLinea=new Set([1]);enemigos.length=jugadores.length=0;for(const l of lanzas)escena.remove(l.g);lanzas.length=0;obstaculos.length=0;paradas=dañoDevuelto=muestras=0;azar=.1;
 heroe={id:0,tipo:'adreida',pos:new V3(0,0,5),dir:Math.PI,radio:.42,alma:120,vivo:true,escudo:0,invul:0,furia:0,estado:'quieto',t:0,cd:{esquiva:0},dirEsq:new V3(),entrada:{},control:{mov:new V3()},mando:{},disparosPendientes:[]};jugadores.push(heroe);ent=heroe.entrada;ctl=heroe.control;mando=heroe.mando;
 const e={id:1,tipo:'goblin',m:MOD.crear('goblin',{varianteGoblin:variante}),pos:new V3(),dir:0,radio:.34,d:{dano:13},cd:0,provocado:0,estado:'persigue',ataques:0};enemigos.push(e);return e;
}
function volar(dt){reloj.t+=dt;pasoLanzas(dt);}
`);
run("var e=preparar();Object.assign(e,{emp:new V3(),destello:0,t:0,dentro:true,fase:0,paso:0});e.d.vel=2.85;pasoEnemigo(e,.01)");assert.equal(run('e.estado'),'aviso');assert.equal(run('e.tiraHacha'),true);
run('reloj.t=1.1;pasoEnemigo(e,.01)');assert.equal(run('lanzas[0].tipo'),'hacha','La IA ejecuta el lanzamiento al terminar el aviso');
for(const id of ['clasico','dosHachas']){
 run(`var e=preparar('${id}');`);assert.equal(run('intentarHachaGoblin(e,5)'),true);assert.equal(run('e.ataque.forma'),'linea');assert.equal(run('e.ataque.dur'),1.05);assert.equal(run('e.alerta.el.textContent'),'¡Hacha!');
 run('resolverAtaque(e)');assert.equal(run('lanzas.length'),1);assert.equal(run('lanzas[0].tipo'),'hacha');assert.equal(run('lanzas[0].dano'),11);assert.equal(run('heroe.alma'),120,'El aviso no hace daño a distancia');
}
for(const id of ['cuchillo','antorcha']){run(`e=preparar('${id}')`);assert.equal(run('intentarHachaGoblin(e,5)'),false);}
for(const bloqueo of ['e.cd=1','e.provocado=2','presion.siguiente=1','presion.primeraLinea.clear()','obstaculos.push({x:0,z:2,r:1})',"enemigos.push({id:2,d:{},tiraHacha:true,estado:'aviso'})"]){run(`e=preparar();${bloqueo}`);assert.equal(run('intentarHachaGoblin(e,5)'),false,bloqueo);}
for(const distancia of [2,9]){run('e=preparar()');assert.equal(run(`intentarHachaGoblin(e,${distancia})`),false);}
run('e=preparar();azar=.8;intentarHachaGoblin(e,5)');const tiros=run('muestras');for(let i=0;i<100;i++)run('intentarHachaGoblin(e,5)');assert.equal(run('muestras'),tiros,'No tira azar cada cuadro');
// La altura sigue una parábola: asciende, pasa por encima y cae al blanco original.
run('e=preparar();lanzarHacha(e,{dir:0,dano:11});heroe.pos.z=2.5;volar(.25)');
assert.ok(Math.abs(run('lanzas[0].g.position.y')-2.75)<1e-6,'El vértice queda 1.8 m por encima del punto de salida');
assert.equal(run('heroe.alma'),120,'No golpea al pasar por encima de la cabeza');
run('heroe.pos.z=5;volar(.3)');assert.equal(run('heroe.alma'),109,'Puede golpear al descender sobre su destino');
// Colisiones, parry y cobertura a velocidades de render distintas.
for(const hz of [20,30,60,144])for(const defensa of ['ninguna','parry','dash','pozo']){
 run(`e=preparar();lanzarHacha(e,{dir:0,dano:11});${defensa==='parry'?"heroe.estado='parry';heroe.t=.1;":defensa==='dash'?'heroe.invul=1;':defensa==='pozo'?'obstaculos.push({x:0,z:2.5,r:.6});':''}`);
 for(let i=0;i<hz*3;i++)run(`volar(1/${hz})`);
 assert.equal(run('heroe.alma'),defensa==='ninguna'?109:120,`${hz} FPS/${defensa}`);assert.equal(run('lanzas.length'),0,'Limpieza del proyectil');
 assert.equal(run('paradas'),defensa==='parry'?1:0);if(defensa==='parry')assert.equal(run('dañoDevuelto'),33);
}
run('e=preparar();lanzarHacha(e,{dir:0,dano:11});heroe.pos.x=3');for(let i=0;i<180;i++)run('volar(1/60)');assert.equal(run('heroe.alma'),120,'No sigue al jugador tras fijar la dirección');
for(const defensa of ['ninguna','parry','bloqueo']){run(`e=preparar();lanzar(e,{dir:0,dano:16,ancho:.8});${defensa==='parry'||defensa==='bloqueo'?"heroe.estado='parry';heroe.t="+(defensa==='parry'?'.1':'.3')+';':''}`);for(let i=0;i<60;i++)run('volar(1/20)');assert.equal(run('heroe.alma'),defensa==='ninguna'?104:defensa==='bloqueo'?115:120);if(defensa==='parry')assert.equal(run('dañoDevuelto'),48);}
const a=run('MOD.crearHachaArrojadiza()'),b=run('MOD.crearHachaArrojadiza()');assert.equal(a.children.length,2);for(let i=0;i<2;i++){assert.equal(a.children[i].geometry,b.children[i].geometry);assert.equal(a.children[i].material,b.children[i].material);assert.equal(a.children[i].isSkinnedMesh,undefined);}
console.log('✓ Hachas: variantes correctas, tirada espaciada, turnos, aviso, materiales compartidos, cobertura, parry y colisiones a 20/30/60/144 FPS');
// El contacto de antorcha se resuelve por la ruta real del combate, incluidos bloqueo y cooperativo.
for(const defensa of ['ninguna','parry','bloqueo','dash','fuera']){
 run(`e=preparar('antorcha');heroe.pos.z=${defensa==='fuera'?4:1};e.ataque={forma:'cono',dir:0,radio:2,ang:.85,dano:13};${defensa==='parry'||defensa==='bloqueo'?"heroe.estado='parry';heroe.t="+(defensa==='parry'?'.1':'.3')+';':defensa==='dash'?'heroe.invul=1;':''}resolverAtaque(e)`);
 assert.equal(run('!!heroe.incendio'),defensa==='ninguna',defensa);
}
for(const hz of [20,30,60,144]){
 run("e=preparar('antorcha');prenderFuego(e)");for(let i=0;i<5*hz;i++)run(`pasoFuego(1/${hz})`);
 assert.equal(run('heroe.alma'),110,'Cinco pulsos exactos');assert.equal(run('heroe.incendio'),null,'Se apaga al cumplir cinco segundos');run('pasoFuego(2)');assert.equal(run('heroe.alma'),110);
}
run("e=preparar('antorcha');prenderFuego(e);pasoFuego(1.2);usar('esquiva');pasoFuego(5)");assert.equal(run('heroe.alma'),118);assert.equal(run('heroe.incendio'),null,'Dash cancela inmediatamente');
run("e=preparar('antorcha');prenderFuego(e);heroe.cd.esquiva=1;usar('esquiva')");assert.ok(run('heroe.incendio'),'Un intento con cooldown no apaga');
run("e=preparar('antorcha');prenderFuego(e);pasoFuego(.5);prenderFuego(e);pasoFuego(5)");assert.equal(run('heroe.alma'),110,'Reaviva la duración sin acumular instancias');
run("e=preparar('antorcha');heroe.alma=1;prenderFuego(e);pasoFuego(2)");assert.equal(run('heroe.vivo'),false);assert.equal(run('heroe.incendio'),null,'Limpia al morir');
run("e=preparar('antorcha');heroe.tipo='mohamed';prenderFuego(e)");assert.equal(run('heroe.incendio'),undefined,'La quemadura solicitada afecta a Adreida');
run("e=preparar('antorcha');const adreida=heroe;const compañero={...heroe,tipo:'mohamed',incendio:null,pos:new V3(2,0,5)};jugadores.push(compañero);prenderFuego(e);conHeroe(compañero,()=>pasoFuego(5));");assert.equal(run('heroe.incendio.restante'),5);assert.equal(run('jugadores[1].incendio'),null);
console.log('✓ Antorcha: contacto, parry/bloqueo/invulnerabilidad, cinco segundos, dash válido, reimpactos, muerte y estado individual en cooperativo');
