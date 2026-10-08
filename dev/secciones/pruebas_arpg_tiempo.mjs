/* Reloj real, transformaciones de three.js y reglas de ambos héroes, sin GPU. */
import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
import {extraerDeclaracion} from './fuentes.mjs';
const c=vm.createContext({console,tutorial:null,enTutorial:()=>false});c.window=c;
for(const f of ['visor-three-vendor.js','arpg-three-tiempo.js','arpg-three-adreida-animacion.js','arpg-three-modelos.js'])vm.runInContext(fs.readFileSync(new URL(f,import.meta.url),'utf8'),c);
const T=c.CAOZ_ARPG_TIEMPO,THREE=c.CAOZ_THREE.THREE;
// Cada imagen recibe su tiempo real, incluso si llega antes de 1/60 s.
for(const hz of [30,60,120,144]){const reloj=T.crearReloj();let pasos=0,tiempo=0;for(let i=0;i<hz*10;i++)reloj.avanzar(1/hz,dt=>{assert.equal(dt,1/hz);tiempo+=dt;pasos++;});assert.equal(pasos,hz*10);assert.ok(Math.abs(tiempo-10)<1e-9);}
const r=T.crearReloj();let pasos=0;
r.avanzar(.2,dt=>{pasos++;assert.equal(dt,.05);});assert.equal(pasos,1,'Un cuadro lento no ejecuta un lote de actualizaciones');
assert.ok(Math.abs(r.estado().descartado-.15)<1e-9);
r.avanzar(3,()=>pasos++);assert.equal(pasos,1,'Volver de una suspensión no adelanta el combate');
r.reiniciar();r.avanzar(1/120,()=>pasos++);assert.equal(pasos,2,'No hay que acumular medio paso para actualizar');
r.avanzar(.01,()=>false);assert.equal(r.estado().pasos,2,'Pausa dentro del cuadro');
for(const valor of [0,-1,NaN,Infinity])r.avanzar(valor,()=>assert.fail('No ejecutar duraciones inválidas'));
const irregular=T.crearReloj();let transcurrido=0,n=0;
while(transcurrido<10-1e-9){const d=Math.min([.008,.022,.011,.025,.017][n++%5],10-transcurrido);transcurrido+=d;irregular.avanzar(d,dt=>assert.equal(dt,d));}assert.equal(irregular.estado().pasos,n);assert.ok(Math.abs(irregular.estado().transcurrido-10)<1e-9);
console.log('✓ Una actualización por imagen a 30/60/120/144 FPS y con fluctuaciones; pausa y delta acotado');
const fuente=fs.readFileSync(new URL('arpg-three-mesa.js',import.meta.url),'utf8'),extraer=(n,t='function')=>extraerDeclaracion(fuente,n,t).texto;
// El dibujo real consume la pose actual completa sin sustituir raíces, huesos ni matrices.
c.assert=assert;
vm.runInContext(`{
 const THREE=CAOZ_THREE.THREE,MOD=CAOZ_ARPG_MODELOS.fabrica(THREE);
 const escena=new THREE.Scene(),camara=new THREE.PerspectiveCamera(),etiquetas=[],colocar=()=>{};
 let dibujo=()=>{};const dibujar=()=>dibujo();
 ${extraer('dibujarCuadro')}
 const modelos=Object.keys(MOD.TIPOS).map(tipo=>MOD.crear(tipo));
 for(const [i,m] of modelos.entries()){escena.add(m.raiz);m.raiz.position.set(i*.2,0,3);m.raiz.rotation.y=1.7;MOD.posar(m,{anim:m.tipo==='adreida'?'tajoA':'golpe',k:.88,t:1,dt:1/120});}
 escena.updateMatrixWorld(true);
 const fotos=modelos.map(m=>({huesos:Object.values(m.H).map(b=>[b,b.quaternion.clone(),b.matrixWorld.clone()]),vertices:m.mallas.map(mesh=>Array.from({length:20},(_,i)=>mesh.getVertexPosition(Math.floor(i*mesh.geometry.attributes.position.count/20),new THREE.Vector3())))}));
 dibujo=()=>{for(const [i,m] of modelos.entries()){
  for(const [h,q,matriz] of fotos[i].huesos){assert.ok(h.quaternion.angleTo(q)<1e-6);assert.ok(h.matrixWorld.elements.every((x,k)=>Math.abs(x-matriz.elements[k])<1e-9),'El dibujo usa las matrices actuales');}
  for(const [j,mesh] of m.mallas.entries())for(let v=0;v<20;v++)assert.ok(mesh.getVertexPosition(Math.floor(v*mesh.geometry.attributes.position.count/20),new THREE.Vector3()).distanceTo(fotos[i].vertices[j][v])<1e-5,'La piel conserva su forma: '+m.tipo);
 }};
 dibujarCuadro();dibujarCuadro();
 dibujo=()=>{throw Error('Fallo de GPU simulado');};assert.throws(()=>dibujarCuadro());
 for(const [i,m] of modelos.entries())for(const [h,q,matriz] of fotos[i].huesos){assert.ok(h.quaternion.angleTo(q)<1e-6);assert.ok(h.matrixWorld.equals(matriz));}
}`,c);
console.log('✓ Los ocho personajes se dibujan con sus poses actuales, sin transformaciones temporales');
vm.runInContext(`
const V3=CAOZ_THREE.THREE.Vector3,TAU=Math.PI*2,reloj={t:0},enemigos=[],botines=[],jugadores=[],rog={abierto:false},pausa={activa:false},document={hidden:false};
let heroe,ent,ctl,mando,disparosPendientes,paron=0,registro=[],tick=0,tickAnterior=-1,tiempoReal=0;
const aDistancia=()=>heroe.tipo==='mohamed',plano=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z),rumbo=(a,b)=>Math.atan2(b.x-a.x,b.z-a.z),frente=a=>new V3(Math.sin(a),0,Math.cos(a)),difAng=(a,b)=>Math.atan2(Math.sin(b-a),Math.cos(b-a));
const suave=k=>k<=0?0:k>=1?1:k*k*(3-2*k),tramo=(k,a,b)=>suave((k-a)/(b-a));
const puntoApuntado=()=>ctl.apunta.clone(),amenaza=()=>null,numero=()=>{},aturdirPorParry=()=>{},respetarMuralla=()=>{},dentroPlaza=()=>{},rechazo=()=>{},marca=()=>{},polvo=()=>{},romperPiso=()=>{},chispas=()=>{},temblar=()=>{},particula=()=>{},rnd=()=>.4;
const golpearEn=(r,a,d,o)=>{registro.push({tick,t:reloj.t,id:heroe.id,d});return 1;};
${['VEL','COMBO','HAB','PARRY','HEROES','libre'].map(n=>extraer(n,'const')).join('\n')}
${['conHeroe','cambiar','usar','iniciarGolpe','iniciarCarga','ajustarSalto','pasoHeroe','disparar','parar','parryPerfecto'].map(n=>extraer(n)).join('\n')}
function iniciar(coop){jugadores.length=0;registro=[];tick=0;tickAnterior=-1;tiempoReal=0;paron=0;reloj.t=0;
for(const [id,tipo] of (coop?['adreida','mohamed']:['adreida']).entries()){
 const h={id,tipo,pos:new V3(id*10,0,0),radio:.4,vivo:true,estado:'quieto',t:0,atq:HEROES[tipo].atq,basicos:1,especial:1,furia:100,dir:0,cd:{ulti:90,parry:0,salto:0,esquiva:0},sigilo:0,ultiT:0,brilloParry:0,escudo:0,invul:0,destello:0,dolor:1,vatq:1,finGolpe:-9,combo:0,carga:0,bloqueoBasico:false,fase:0,paso:0,golpeo:false,dirEsq:new V3(),balas:6,recargaT:0,cadT:0,disparoT:0,disparos:0,parrys:0};
 h.entrada={pendiente:false,piloto:false};h.control={mov:new V3(),atacar:false,apunta:new V3(id*10,0,20)};h.mando={activo:false,foco:true};h.disparosPendientes=[];jugadores.push(h);
}heroe=jugadores[0];ent=heroe.entrada;ctl=heroe.control;mando=heroe.mando;disparosPendientes=heroe.disparosPendientes;
}
function simular(dt){
 tick=tiempoReal*60;const en=n=>tick+1e-8>=n&&tickAnterior+1e-8<n,deltaReal=dt;
 for(const h of jugadores)conHeroe(h,()=>{
  if(en(0)){ctl.mov.set(h.id?-1:1,0,0);if(h.id)ctl.atacar=true;}
  if(en(60)){registro.push({andar:h.pos.x,id:h.id});ctl.mov.set(0,0,0);ctl.apunta.copy(h.pos).add(new V3(0,0,20));}
  if(en(90))ctl.atacar=true;
  if(en(150)&&!h.id)ctl.atacar=false;
  if(en(180))ctl.atacar=false;
  if(en(210)){h.cd.parry=0;usar('parry');}
  if(en(213)||en(225))registro.push({tick,id:h.id,parry:parar(h.pos.clone().add(frente(h.dir)),false)});
  if(en(240)){h.cd.salto=0;mando.activo=true;usar('salto',h.pos.clone().add(new V3(0,0,5)));registro.push({salto:h.pos.toArray(),id:h.id,t:reloj.t});}
  if(en(310))registro.push({aterrizaje:h.pos.toArray(),id:h.id,t:reloj.t,alto:h.alto});
  if(en(360)){h.cd.esquiva=0;usar('esquiva',new V3(1,0,0));}
  if(en(400)){h.cd.parry=0;usar('parry');parryPerfecto(null,h.pos.clone());}
 });
 if(paron>0){paron-=dt;dt*=.08;}reloj.t+=dt;
 for(const h of jugadores)conHeroe(h,()=>{pasoHeroe(dt);for(const disparo of disparosPendientes)registro.push({tick,id:h.id,bala:disparo.dano,t:reloj.t});disparosPendientes.length=0;});tickAnterior=tick;tiempoReal+=deltaReal;
}
function ejecutar(hz,coop){iniciar(coop);const cr=CAOZ_ARPG_TIEMPO.crearReloj();for(let i=0;i<hz*12;i++)cr.avanzar(1/hz,simular);return JSON.stringify({registro,pasos:cr.estado().pasos,t:reloj.t,heroes:jugadores.map(h=>({x:h.pos.x,z:h.pos.z,estado:h.estado,cd:h.cd,disparos:h.disparos,parrys:h.parrys}))});}
`,c);
for(const coop of [false,true])for(const hz of [30,60,120,144]){
 const datos=JSON.parse(vm.runInContext(`ejecutar(${hz},${coop})`,c));assert.equal(datos.pasos,hz*12);
 assert.ok(Math.abs(datos.registro.find(x=>'andar'in x).andar-5.8)<.2,'Velocidad de marcha constante');
 for(const id of coop?[0,1]:[0]){const inicio=datos.registro.find(x=>x.id===id&&x.salto),fin=datos.registro.find(x=>x.id===id&&x.aterrizaje);assert.ok(Math.abs(fin.aterrizaje[2]-inicio.salto[2]-5)<1e-9);assert.equal(fin.alto,0);}
 assert.equal(datos.registro.find(x=>x.parry).parry,'perfecto');assert.ok(datos.registro.some(x=>x.parry==='bloqueo'));
 assert.ok(datos.registro.some(x=>x.d===36),'Carga completa ×3');
 if(coop)assert.ok(datos.registro.filter(x=>x.bala).length>6,'Mohamed dispara, recarga y vuelve a disparar');
}
console.log('✓ Combate con delta variable a 30/60/120/144 FPS: marcha, salto 5 m, carga, parry y recarga; solo y cooperativo');
