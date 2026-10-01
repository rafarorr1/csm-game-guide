/* Reglas reales del cooperativo, ultis y mundo abierto, sin GPU. */
import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';import {extraerDeclaracion} from './fuentes.mjs';
const fuente=fs.readFileSync(new URL('arpg-three-mesa.js',import.meta.url),'utf8');
const c=vm.createContext({console});c.window=c;for(const f of ['visor-three-vendor.js','arpg-three-modelos.js'])vm.runInContext(fs.readFileSync(new URL(f,import.meta.url),'utf8'),c);
const get=(n,t='function')=>extraerDeclaracion(fuente,n,t).texto,run=s=>vm.runInContext(s,c);
run(`const THREE=CAOZ_THREE.THREE,V3=THREE.Vector3,MOD=CAOZ_ARPG_MODELOS.fabrica(THREE),TAU=Math.PI*2,escena=new THREE.Scene(),reloj={t:0};
let heroe,ent={},ctl={},mando={},disparosPendientes=[],ABIERTO=false,COOP=true,DOS_MANDOS=true;
const jugadores=[],enemigos=[],aliados=[],obstaculos=[],CALLES=[-Math.PI/2,Math.PI/6,Math.PI*5/6],rog={efectos:[]};
const plano=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z),frente=a=>new V3(Math.sin(a),0,Math.cos(a)),rumbo=(a,b)=>Math.atan2(b.x-a.x,b.z-a.z);
const difAng=(a,b)=>Math.atan2(Math.sin(b-a),Math.cos(b-a));const numero=()=>{},marca=()=>{},chispas=()=>{},temblar=()=>{},aturdirPorParry=()=>{};let paron=0;
const libre=()=>heroe.vivo&&heroe.estado==='quieto',etiqueta=()=>({el:{},pos:new V3()}),quitarEtiqueta=()=>{};
const document={hidden:false},avisos=[],usar=(accion,p)=>{avisos.push({id:heroe.id,accion,p});return true;},aDistancia=()=>heroe.tipo==='mohamed';
const $=()=>({textContent:''});let pads=[];const navigator={getGamepads:()=>pads};
const danar=(e,d)=>e.vida-=d;
${['R','PANELES','HEROES','DESTINO','BOTONES_MANDO','exploracion'].map(n=>get(n,'const')).join('\n')}
${['conHeroe','cambiar','dentroPlaza','respetarMuralla','lanzarUlti','apunalar','pasoAliados','limpiarAliados','liberarModeloTroll','parryPerfecto','aplicarDestino','descubrirMapa','objetivoEnemigo','ejeMando','leerMando','estadoMando'].map(n=>get(n)).join('\n')}
function crear(tipo,id){const m=MOD.crear(tipo);escena.add(m.raiz);const h={id,tipo,m,radio:m.radio,pos:new V3(id*2,0,0),dir:0,vivo:true,estado:'quieto',alma:HEROES[tipo].alma/2,almaMax:HEROES[tipo].alma,atq:HEROES[tipo].atq,basicos:1,sigilo:0,cd:{ulti:0,salto:4,parry:.4},furia:0,parrys:0,entrada:{},control:{mov:new V3()},mando:{indice:null,botones:[],dir:new V3(0,0,-1),activo:false,listo:false,foco:true},disparosPendientes:[]};jugadores.push(h);return h;}
heroe=crear('adreida',0);crear('mohamed',1);ent=heroe.entrada;ctl=heroe.control;mando=heroe.mando;disparosPendientes=heroe.disparosPendientes;
`);
run("rog.efectos=[{stat:'basicos',valor:50,positivo:true},{stat:'vida',valor:-10,positivo:false}];aplicarDestino()");
assert.deepEqual(Array.from(run('jugadores.map(h=>h.basicos)')),[1.5,1.5]);assert.deepEqual(Array.from(run('jugadores.map(h=>h.almaMax)')),[108,90]);assert.deepEqual(Array.from(run('jugadores.map(h=>h.alma/h.almaMax)')),[.5,.5]);
run("rog.efectos=DESTINO.resolver(rog.efectos,{},1).efectos;aplicarDestino()");assert.deepEqual(Array.from(run('jugadores.map(h=>h.basicos)')),[1,1]);assert.deepEqual(Array.from(run('jugadores.map(h=>h.almaMax)')),[108,90]);
assert.throws(()=>run("conHeroe(jugadores[1],()=>{throw Error('prueba')})"));assert.equal(run('heroe.id'),0,'Restaurar contexto incluso con excepción');
console.log('✓ Una tirada aplica buffs y debuffs a ambos; crítico retira positivos y conserva penalizaciones');
run('lanzarUlti();conHeroe(jugadores[1],lanzarUlti)');assert.equal(run('aliados.length'),1);assert.equal(run('jugadores[1].sigilo'),10);assert.equal(run('heroe.cd.ulti'),90);
run('parryPerfecto(null,new V3())');assert.equal(run('heroe.cd.ulti'),89);assert.equal(run('heroe.cd.salto'),0);assert.equal(run('jugadores[1].cd.ulti'),90);
assert.equal(run('lanzarUlti()'),false);run('pasoAliados(29.9)');assert.equal(run('aliados.length'),1);run('pasoAliados(.11)');assert.equal(run('aliados.length'),0);
run("const blanco={pos:new V3(2,0,1),dir:0,radio:.4,estado:'quieto',vida:500,m:{alto:2}};enemigos.push(blanco);jugadores[1].cadT=0;conHeroe(jugadores[1],apunalar)");assert.equal(run('blanco.vida'),455);
run('blanco.dir=Math.PI;jugadores[1].cadT=0;conHeroe(jugadores[1],apunalar)');assert.equal(run('blanco.vida'),446);
run("jugadores[0].pos.set(40,0,0);jugadores[1].sigilo=10");assert.equal(run('objetivoEnemigo(blanco).id'),0);run('jugadores[1].sigilo=0');assert.equal(run('objetivoEnemigo(blanco).id'),1);
console.log('✓ Ulti 90 s, parry −1 s, Adreidos 30 s, daga ×5 detrás/×1 delante, invisibilidad frente a IA');
run("pads=[0,1].map(index=>({index,connected:true,mapping:'standard',axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))}));for(const h of jugadores)conHeroe(h,leerMando);pads[0].axes[0]=1;pads[1].axes[0]=-1;pads[1].buttons[10].pressed=true");
assert.equal(run('conHeroe(jugadores[0],leerMando).mov.x'),1);assert.equal(run('conHeroe(jugadores[1],leerMando).mov.x'),-1);assert.equal(run('avisos[0].id'),1);assert.equal(run('avisos[0].accion'),'ulti');
run('pads.splice(1,1)');assert.equal(run('conHeroe(jugadores[1],leerMando)'),null);assert.equal(run('jugadores[1].mando.activo'),false);
run('DOS_MANDOS=false');assert.equal(run('conHeroe(jugadores[0],leerMando)'),null);
console.log('✓ Dos mandos con movimiento opuesto; ulti L3 sólo en J2; desconexión y reparto teclado/mando');
run('ABIERTO=true;const p=new V3(0,0,-35);dentroPlaza(p,.4)');assert.equal(run('p.z'),-35,'Portón norte transitable en abierto');
run('p.set(26,0,0);dentroPlaza(p,.4)');assert.ok(run('p.x<26'),'Paño sólido');
run('p.set(130,0,0);dentroPlaza(p,.4)');assert.equal(run('p.x'),109.6,'Acantilado exterior');
run('descubrirMapa(new V3());var antes=exploracion.celdas.size;descubrirMapa(new V3())');assert.equal(run('exploracion.celdas.size'),run('antes'));
run('descubrirMapa(new V3(60,0,30))');assert.ok(run('exploracion.celdas.size>antes'));assert.ok(run('exploracion.celdas.size<200'));
console.log('✓ Portones abiertos, muro y borde sólidos; mapa persistente y descubierto por proximidad');

run('p.set(30,0,0);respetarMuralla(new V3(24,0,0),p,.4)');assert.ok(run('p.x<26'),'Ni salto ni dash cruzan el muro');
run('p.set(0,0,-30);respetarMuralla(new V3(0,0,-24),p,.4)');assert.equal(run('p.z'),-30,'El segmento del salto puede cruzar la puerta');
console.log('✓ Los segmentos de salto y dash respetan la muralla, conservando la abertura del portón');

// Desconectar J1 nunca entrega su héroe al mando de J2.
run("DOS_MANDOS=true;const mandoSegundo={index:1,connected:true,mapping:'standard',axes:[1,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))};pads=[mandoSegundo];jugadores[0].mando.indice=0;jugadores[1].mando.indice=1;jugadores[1].mando.listo=true");
assert.equal(run('conHeroe(jugadores[0],leerMando)'),null);assert.equal(run('conHeroe(jugadores[1],leerMando).mov.x'),1);
console.log('✓ Al desconectar J1, el mando de J2 conserva a Mohamed');
run(`${get('PARRY','const')}
${['enZona','parar','resolverAtaque'].map(n=>get(n)).join('\n')}
const cancelarAtaque=e=>e.ataque=null,herir=d=>heroe.alma-=d,bloqueado=d=>heroe.alma-=Math.round(d*.3),esquivado=()=>{};
function atacante(){return {pos:new V3(),radio:.4,tipo:'saqueador',ataques:0,ataque:{forma:'cono',radio:2.5,ang:1,dir:0,dano:14}};}
for(const h of jugadores){h.pos.set(h.id? .25:-.25,0,1);h.alma=100;h.invul=0;h.estado='quieto';h.sigilo=0;}
resolverAtaque(atacante());`);
assert.deepEqual(Array.from(run('jugadores.map(h=>h.alma)')),[86,86]);
run("jugadores[1].estado='parry';jugadores[1].t=.05;jugadores[1].dir=Math.PI;resolverAtaque(atacante())");assert.deepEqual(Array.from(run('jugadores.map(h=>h.alma)')),[86,86]);
assert.equal(run('jugadores[1].parrys'),1);assert.equal(run('heroe.id'),0);
console.log('✓ Un área golpea a ambos; el parry de Mohamed detiene el golpe y protege al equipo');
