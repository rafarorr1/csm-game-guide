/* Dash durante Torbellino: recorrido barrido, cadencia y esqueleto reales, sin GPU. */
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {extraerDeclaracion} from './fuentes.mjs';
const fuente=fs.readFileSync(new URL('arpg-three-mesa.js',import.meta.url),'utf8');
const get=(n,t='function')=>extraerDeclaracion(n==='libre'?fuente.slice(fuente.indexOf('const libre=()=>')):fuente,n,t).texto;
const c=vm.createContext({console,atob,tutorial:null,casaGoblin:null,cinematicaTroll:null,finalMago:null,enTutorial:()=>false});c.window=c;
for(const f of ['visor-three-vendor.js','arpg-three-adreida-animacion.js','adreida-scenario/datos.js','arpg-three-adreida.js','arpg-three-modelos.js'])vm.runInContext(fs.readFileSync(new URL(f,import.meta.url),'utf8'),c);
const run=s=>vm.runInContext(s,c);
run(`const THREE=CAOZ_THREE.THREE,V3=THREE.Vector3,MOD=CAOZ_ARPG_MODELOS.fabrica(THREE),TAU=Math.PI*2;
const enemigos=[],botines=[],obstaculos=[],PLANOS_MURALLA=[{x:1,z:0},{x:-1,z:0},{x:0,z:1},{x:0,z:-1}],R=26,ABIERTO=false;
const reloj={t:0},pausa={activa:false},rog={abierto:false},poses={},document={hidden:false};
const plano=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z),frente=a=>new V3(Math.sin(a),0,Math.cos(a)),rumbo=(a,b)=>Math.atan2(b.x-a.x,b.z-a.z),difAng=(a,b)=>Math.atan2(Math.sin(b-a),Math.cos(b-a));
let heroe,ent,ctl,mando,disparosPendientes,paron=0,impactos=[];
const aDistancia=()=>heroe.tipo==='mohamed',puntoApuntado=()=>heroe.pos.clone().add(frente(heroe.dir)),amenaza=()=>null,rnd=()=>.5;
const chispas=()=>{},particula=()=>{},rechazo=()=>{},pasoFuegoRopa=()=>{},apagarFuego=h=>h.incendio=null;
const danar=(e,d,o)=>{e.vida-=d;impactos.push({id:e.id,dueno:heroe.id,t:reloj.t,d,causa:o.causa});};
${['VEL','COMBO','HAB','PARRY','HEROES','TORBELLINO','libre'].map(n=>get(n,'const')).join('\n')}
${['conHeroe','cambiar','girando','recargaHabilidad','usar','orientarAdreida','pasoHeroe','pasoTorbellino','dentroPlaza','respetarMuralla','posarHeroe'].map(n=>get(n)).join('\n')}
function preparar(tipo='adreida',id=0){enemigos.length=obstaculos.length=impactos.length=0;reloj.t=0;
 const h={id,tipo,m:MOD.crear(tipo),pos:new V3(),radio:.42,vivo:true,estado:'quieto',t:0,atq:12,especial:1,furia:100,dir:0,giro:0,torbellino:null,
 cd:{esquiva:0,parry:0},sigilo:0,ultiT:0,brilloParry:0,escudo:0,invul:0,destello:0,dolor:1,vatq:1,combo:0,carga:0,fase:0,paso:0,dirEsq:new V3(),disparoT:9,
 entrada:{},control:{mov:new V3(),atacar:false},mando:{activo:false,foco:true},disparosPendientes:[]};
 heroe=h;ent=h.entrada;ctl=h.control;mando=h.mando;disparosPendientes=h.disparosPendientes;return h;
}
function enemigo(x,z){const e={id:enemigos.length+1,pos:new V3(x,0,z),radio:.34,estado:'quieto',vida:1000};enemigos.push(e);return e;}
function avanzar(s,hz=60,dibujar=false){for(let t=0;t<s-1e-9;){const dt=Math.min(1/hz,s-t);reloj.t+=dt;pasoHeroe(dt);if(dibujar)posarHeroe(dt);t+=dt;}}
`);
for(const hz of [20,30,60,144]){
 run('preparar();usar("torbellino");enemigo(0,-2.8);enemigo(2.88,.40375);enemigo(0,2.5);enemigo(0,5.4);enemigo(3.2,1);enemigo(0,6);usar("esquiva")');
 assert.equal(run('heroe.estado'),'esquiva');assert.equal(run('heroe.furia'),70,'Un único coste de Furia');
 assert.equal(run('heroe.cd.esquiva'),1.05);assert.ok(run('heroe.invul>.2'));
 assert.equal(run('usar("esquiva")'),false,'La animación en curso impide reiniciar el dash');
 run(`avanzar(.2,${hz})`);
 assert.ok(Math.abs(run('heroe.pos.z')-2.72)<1e-8,`${hz} FPS: recorre todo el dash`);
 assert.equal(run('heroe.estado'),'torbellino');assert.ok(Math.abs(run('heroe.torbellino.t')-.2)<1e-8);
 assert.equal(run('impactos.length'),4,`${hz} FPS: alcanza inicio, centro, lateral entre cuadros y final`);
 assert.equal(run('impactos.every(i=>i.id<=4&&i.d===6&&i.causa==="torbellino")'),true,'Daño normal, sin alcanzar blancos fuera del recorrido');
 run(`avanzar(1.15,${hz})`);assert.equal(run('heroe.estado'),'quieto');assert.equal(run('heroe.torbellino'),null,'El dash no reinicia la duración');
 const golpes=run('impactos.length');run(`avanzar(.3,${hz})`);assert.equal(run('impactos.length'),golpes,'Sin daño residual');
 // El mismo objetivo nunca recibe un golpe por cuadro, tampoco al entrar/salir del dash.
 run('preparar();enemigo(0,1.4);usar("torbellino")');run(`avanzar(.4,${hz});usar("esquiva");avanzar(.95,${hz})`);
 const tiempos=run('impactos.map(i=>i.t)');assert.equal(tiempos.length,7,`${hz} FPS: siete impactos durante el giro completo`);
 for(let i=1;i<tiempos.length;i++)assert.ok(tiempos[i]-tiempos[i-1]>=.2-1e-8,'Cadencia máxima: un impacto por enemigo cada 0,2 s');
 // Dash tardío: conserva la capacidad ofensiva hasta su último centímetro.
 run('preparar();usar("torbellino")');run(`avanzar(1.3,${hz});enemigo(0,5.4);usar("esquiva");avanzar(.19,${hz})`);
 assert.equal(run('girando(heroe)'),true);run('avanzar(.01)');assert.equal(run('impactos.length'),1);assert.equal(run('heroe.estado'),'quieto');assert.equal(run('heroe.torbellino'),null);
}
console.log('✓ Giro y daño en todo el dash a 20/30/60/144 FPS; coste, cadencia y recarga intactos, sin reinicio de animación');
// La dirección de desplazamiento no reinicia la orientación del cuerpo ni la pose.
run('preparar();usar("torbellino");avanzar(.35,60,true)');
const m=run('heroe.m'),giro=m.raiz.rotation.y,pose=Object.values(m.H).map(b=>b.quaternion.clone());
run('usar("esquiva",new V3(1,0,0));posarHeroe(0)');
assert.ok(Math.abs(m.raiz.rotation.y-giro)<1e-8,'Giro visual continuo al cambiar 90° de dirección');
Object.values(m.H).forEach((b,i)=>assert.ok(b.quaternion.angleTo(pose[i])<1e-6,'No cambia a la pose agachada del dash'));
run('avanzar(.1,60,true)');assert.ok(Math.abs(m.raiz.rotation.y-giro-1.7)<1e-8,'Sigue girando a la misma velocidad');
assert.equal(run('usar("parry")'),false,'Parry no interrumpe un dash');
run('avanzar(.1);usar("parry")');assert.equal(run('heroe.torbellino'),null,'Parry al volver a tierra sí cancela el giro');
run('preparar();usar("torbellino");cambiar(heroe,"muerta");heroe.vivo=false');assert.equal(run('heroe.torbellino'),null,'La muerte limpia el giro');
console.log('✓ Conserva el giro y el esqueleto al cambiar de dirección; limpieza por parry o muerte');
// Las colisiones reales limitan el recorrido que produce daño.
run('preparar();heroe.pos.set(25,0,0);enemigo(30,0);usar("torbellino");usar("esquiva",new V3(1,0,0));avanzar(.2,20)');
assert.ok(run('heroe.pos.x<=R-heroe.radio'));assert.equal(run('impactos.length'),0,'No golpea sobre la prolongación del dash detrás de la muralla');
run('preparar();obstaculos.push({x:0,z:2,r:1});usar("torbellino");usar("esquiva");avanzar(.2,20)');
assert.ok(run('heroe.pos.z<=.58+1e-8'),'El dash giratorio respeta el pozo');
// Dash normal y cooperativo: no heredan la ofensiva de otra Adreida.
for(const tipo of ['adreida','mohamed']){run(`preparar('${tipo}');enemigo(0,1);usar('esquiva');avanzar(.2)`);assert.equal(run('impactos.length'),0);assert.equal(run('heroe.estado'),'quieto');assert.equal(run('heroe.torbellino'),null);}
run('var adreida=preparar();usar("torbellino");var mohamed=preparar("mohamed",1);enemigo(0,1);conHeroe(adreida,()=>{usar("esquiva");avanzar(.2)});usar("esquiva");avanzar(.2)');
assert.equal(run('impactos.every(i=>i.dueno===0)'),true);assert.equal(run('mohamed.torbellino'),null);assert.equal(run('adreida.estado'),'torbellino');
console.log('✓ Muralla, pozo, dash normal y estados independientes en cooperativo');
