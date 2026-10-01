/* Reloj real, transformaciones de three.js y reglas de ambos héroes, sin GPU. */
import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
import {extraerDeclaracion} from './fuentes.mjs';
const c=vm.createContext({console});c.window=c;
for(const f of ['visor-three-vendor.js','arpg-three-tiempo.js','arpg-three-adreida-animacion.js','arpg-three-modelos.js'])vm.runInContext(fs.readFileSync(new URL(f,import.meta.url),'utf8'),c);
const T=c.CAOZ_ARPG_TIEMPO,THREE=c.CAOZ_THREE.THREE;
for(const hz of [30,60,120,144]){const reloj=T.crearReloj();let pasos=0;for(let i=0;i<hz*10;i++)reloj.avanzar(1/hz,dt=>{assert.equal(dt,1/60);pasos++;});assert.equal(pasos,600,`${hz} FPS: 600 pasos en 10 s`);}
const r=T.crearReloj();let pasos=0;
r.avanzar(.2,()=>pasos++);assert.equal(pasos,6);assert.ok(Math.abs(r.estado().descartado-.1)<1e-9,'Tope de recuperación de carga');
r.avanzar(3,()=>pasos++);assert.equal(pasos,6,'Volver de una suspensión no adelanta el combate');
r.avanzar(1/120,()=>pasos++);assert.equal(pasos,6);r.reiniciar();r.avanzar(1/120,()=>pasos++);assert.equal(pasos,6,'Pausar descarta el medio paso pendiente');
r.unPaso(()=>pasos++);assert.equal(pasos,7,'Un cuadro manual es un paso exacto');
r.avanzar(.1,()=>false);assert.equal(r.estado().acumulado,0,'Una pausa surgida dentro de la simulación corta el lote');
for(const valor of [-1,NaN,Infinity])r.avanzar(valor,()=>assert.fail('No ejecutar duraciones inválidas'));
const irregular=T.crearReloj();let transcurrido=0,n=0;
while(transcurrido<10-1e-9){const d=Math.min([.008,.022,.011,.025,.017][n++%5],10-transcurrido);transcurrido+=d;irregular.avanzar(d,()=>{});}assert.equal(irregular.estado().pasos,600);
console.log('✓ 60 Hz a 30/60/120/144 FPS y con fluctuaciones; pausas, paso manual y recuperación acotada');
// Interpolar sólo al dibujar. Incluso una excepción deja las posiciones de colisión intactas.
const interp=T.crearInterpolador(THREE),o=new THREE.Object3D(),camara=new THREE.PerspectiveCamera(),rotulo=new THREE.Vector3();
const capturar=()=>{interp.empezar();for(const n of [o,camara,rotulo])interp.capturar(n);interp.terminar();};
o.rotation.y=170*Math.PI/180;capturar();o.position.x=2;o.rotation.y=-170*Math.PI/180;camara.position.x=4;rotulo.x=6;capturar();
interp.dibujar(.5,()=>{assert.equal(o.position.x,1);assert.equal(camara.position.x,2);assert.equal(rotulo.x,3);const v=new THREE.Vector3(0,0,1).applyQuaternion(o.quaternion);assert.ok(v.z<-.999,'El giro cruza por el arco más corto');});
assert.equal(o.position.x,2);assert.equal(camara.position.x,4);assert.equal(rotulo.x,6);
assert.throws(()=>interp.dibujar(.25,()=>{throw Error('Dibujo fallido');}));assert.equal(o.position.x,2,'Restaurar tras fallo del render');
o.position.x=80;interp.sincronizar();interp.dibujar(0,()=>assert.equal(o.position.x,80,'Sin barrido al teletransportar'));
interp.empezar();interp.capturar(o);interp.terminar();assert.equal(interp.cantidad(),1,'Eliminar referencias a objetos retirados');interp.limpiar();assert.equal(interp.cantidad(),0);
const nuevo=new THREE.Object3D();nuevo.position.z=50;interp.empezar();interp.capturar(nuevo);interp.terminar();interp.dibujar(0,()=>assert.equal(nuevo.position.z,50,'Una aparición nunca vuela desde el origen'));
console.log('✓ Posiciones, cámara, rótulos y giro corto; restauración, teletransporte y bajas');
// Corregir las manos después de interpolar los huesos evita que el mango se separe en cuadros intermedios.
const modelos=c.CAOZ_ARPG_MODELOS.fabrica(THREE),adreida=modelos.crear('adreida'),entre=T.crearInterpolador(THREE);
for(const anim of ['tajoA','revesA','estocadaA','parry','salto'])for(let k=0;k<=1;k+=1/12){
  modelos.posar(adreida,{anim,k,potencia:1});entre.empezar();for(const b of Object.values(adreida.H))entre.capturar(b);entre.terminar();
  const mano=adreida.H.manoD.quaternion.clone();
  for(const alfa of [.25,.5,.75])entre.dibujar(alfa,()=>{
    modelos.animacion.ajustarAgarre(adreida);adreida.raiz.updateMatrixWorld(true);
    const apoyo=adreida.H.manoD.localToWorld(new THREE.Vector3(0,-.3,0)),izquierda=adreida.H.manoI.getWorldPosition(new THREE.Vector3());
    assert.ok(apoyo.distanceTo(izquierda)<.005,'Agarre continuo en los cuadros interpolados');
  });assert.ok(adreida.H.manoD.quaternion.angleTo(mano)<1e-6,'La corrección visual no altera la pose de simulación');
}
console.log('✓ Agarre del hacha también en cuadros intermedios y a velocidad de ataque elevada');
const fuente=fs.readFileSync(new URL('arpg-three-mesa.js',import.meta.url),'utf8'),extraer=(n,t='function')=>extraerDeclaracion(fuente,n,t).texto;
vm.runInContext(`
const V3=CAOZ_THREE.THREE.Vector3,TAU=Math.PI*2,reloj={t:0},enemigos=[],botines=[],jugadores=[],rog={abierto:false},pausa={activa:false},document={hidden:false};
let heroe,ent,ctl,mando,disparosPendientes,paron=0,registro=[],tick=0;
const aDistancia=()=>heroe.tipo==='mohamed',plano=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z),rumbo=(a,b)=>Math.atan2(b.x-a.x,b.z-a.z),frente=a=>new V3(Math.sin(a),0,Math.cos(a)),difAng=(a,b)=>Math.atan2(Math.sin(b-a),Math.cos(b-a));
const suave=k=>k<=0?0:k>=1?1:k*k*(3-2*k),tramo=(k,a,b)=>suave((k-a)/(b-a));
const puntoApuntado=()=>ctl.apunta.clone(),amenaza=()=>null,numero=()=>{},aturdirPorParry=()=>{},respetarMuralla=()=>{},dentroPlaza=()=>{},rechazo=()=>{},marca=()=>{},polvo=()=>{},romperPiso=()=>{},chispas=()=>{},temblar=()=>{},particula=()=>{},rnd=()=>.4;
const golpearEn=(r,a,d,o)=>{registro.push({tick,t:reloj.t,id:heroe.id,d});return 1;};
${['VEL','COMBO','HAB','PARRY','HEROES','libre'].map(n=>extraer(n,'const')).join('\n')}
${['conHeroe','cambiar','usar','iniciarGolpe','iniciarCarga','ajustarSalto','pasoHeroe','disparar','parar','parryPerfecto'].map(n=>extraer(n)).join('\n')}
function iniciar(coop){jugadores.length=0;registro=[];tick=0;paron=0;reloj.t=0;
for(const [id,tipo] of (coop?['adreida','mohamed']:['adreida']).entries()){
 const h={id,tipo,pos:new V3(id*10,0,0),radio:.4,vivo:true,estado:'quieto',t:0,atq:HEROES[tipo].atq,basicos:1,especial:1,furia:100,dir:0,cd:{ulti:90,parry:0,salto:0,esquiva:0},sigilo:0,ultiT:0,brilloParry:0,escudo:0,invul:0,destello:0,dolor:1,vatq:1,finGolpe:-9,combo:0,carga:0,bloqueoBasico:false,fase:0,paso:0,golpeo:false,dirEsq:new V3(),balas:6,recargaT:0,cadT:0,disparoT:0,disparos:0,parrys:0};
 h.entrada={pendiente:false,piloto:false};h.control={mov:new V3(),atacar:false,apunta:new V3(id*10,0,20)};h.mando={activo:false,foco:true};h.disparosPendientes=[];jugadores.push(h);
}heroe=jugadores[0];ent=heroe.entrada;ctl=heroe.control;mando=heroe.mando;disparosPendientes=heroe.disparosPendientes;
}
function simular(dt){
 for(const h of jugadores)conHeroe(h,()=>{
  if(tick===0){ctl.mov.set(h.id?-1:1,0,0);if(h.id)ctl.atacar=true;}
  if(tick===60){registro.push({andar:h.pos.x,id:h.id});ctl.mov.set(0,0,0);ctl.apunta.copy(h.pos).add(new V3(0,0,20));}
  if(tick===90)ctl.atacar=true;
  if(tick===150&&!h.id)ctl.atacar=false;
  if(tick===180)ctl.atacar=false;
  if(tick===210){h.cd.parry=0;usar('parry');}
  if(tick===213||tick===225)registro.push({tick,id:h.id,parry:parar(h.pos.clone().add(frente(h.dir)),false)});
  if(tick===240){h.cd.salto=0;mando.activo=true;usar('salto',h.pos.clone().add(new V3(0,0,5)));registro.push({salto:h.pos.toArray(),id:h.id,t:reloj.t});}
  if(tick===310)registro.push({aterrizaje:h.pos.toArray(),id:h.id,t:reloj.t,alto:h.alto});
  if(tick===360){h.cd.esquiva=0;usar('esquiva',new V3(1,0,0));}
  if(tick===400){h.cd.parry=0;usar('parry');parryPerfecto(null,h.pos.clone());}
 });
 if(paron>0){paron-=dt;dt*=.08;}reloj.t+=dt;
 for(const h of jugadores)conHeroe(h,()=>{pasoHeroe(dt);for(const disparo of disparosPendientes)registro.push({tick,id:h.id,bala:disparo.dano,t:reloj.t});disparosPendientes.length=0;});tick++;
}
function ejecutar(hz,coop){iniciar(coop);const cr=CAOZ_ARPG_TIEMPO.crearReloj();for(let i=0;i<hz*12;i++)cr.avanzar(1/hz,simular);return JSON.stringify({registro,pasos:cr.estado().pasos,t:reloj.t,heroes:jugadores.map(h=>({x:h.pos.x,z:h.pos.z,estado:h.estado,cd:h.cd,disparos:h.disparos,parrys:h.parrys}))});}
`,c);
for(const coop of [false,true]){
 const base=vm.runInContext(`ejecutar(60,${coop})`,c);
 for(const hz of [30,120,144])assert.equal(vm.runInContext(`ejecutar(${hz},${coop})`,c),base,`${hz} FPS, cooperativo ${coop}: mismos impactos y tiempos`);
 const datos=JSON.parse(base);assert.equal(datos.pasos,720);assert.ok(Math.abs(datos.registro.find(x=>'andar'in x).andar-5.8)<1e-9);
 for(const id of coop?[0,1]:[0]){const inicio=datos.registro.find(x=>x.id===id&&x.salto),fin=datos.registro.find(x=>x.id===id&&x.aterrizaje);assert.ok(Math.abs(fin.aterrizaje[2]-inicio.salto[2]-5)<1e-9);assert.equal(fin.alto,0);}
 assert.equal(datos.registro.find(x=>x.parry).parry,'perfecto');assert.ok(datos.registro.some(x=>x.parry==='bloqueo'));
 assert.ok(datos.registro.some(x=>x.d===36),'Carga completa ×3');
 if(coop)assert.ok(datos.registro.filter(x=>x.bala).length>6,'Mohamed dispara, recarga y vuelve a disparar');
}
console.log('✓ Reglas reales a 30/60/120/144 FPS: andar, salto 5 m, carga, impacto, hitstop, parry, dash, ulti y recarga; solo y cooperativo');
