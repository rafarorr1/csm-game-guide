/* La salida de la casa encadena el meteorito una vez y respeta pausa y reinicio. */
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const c=vm.createContext({console,atob});c.window=c;
for(const f of ['visor-three-vendor.js','adreida-scenario/combate.js','arpg-three-adreida-animacion.js','adreida-scenario/datos.js','arpg-three-adreida.js','hacha-adreida-scenario/datos.js','arpg-three-hacha-adreida.js','arpg-three-modelos.js','arpg-three-impactos.js','adreida-scenario/cinematica.js','arpg-three-adreida-cine.js','arpg-three-final-mago.js'])vm.runInContext(fs.readFileSync(new URL(f,import.meta.url),'utf8'),c);
const T=c.CAOZ_THREE.THREE,MOD=c.CAOZ_ARPG_MODELOS.fabrica(T),escena=new T.Scene(),camara=new T.PerspectiveCamera(32,16/9,.5,1200),casas=new T.Group();
const g=new T.BoxGeometry(6,7,5).toNonIndexed();g.translate(5,3.5,-17);const casa=new T.Mesh(g,new T.MeshStandardMaterial());casa.castShadow=true;casas.add(casa);escena.add(casas);
casas.userData.ocultacion={cajas:[new T.Box3().setFromObject(casa)],opacidades:new Float32Array([1])};
const actor={tipo:'adreida',vivo:true,m:MOD.crear('adreida'),pos:new T.Vector3(10,0,10),dir:0,fase:0};escena.add(actor.m.raiz);
const otro={tipo:'mohamed',vivo:true,m:MOD.crear('mohamed'),pos:new T.Vector3(),dir:0,fase:0};escena.add(otro.m.raiz);
const fx=c.CAOZ_ARPG_IMPACTOS.fabrica(T,escena);fx.actualizarMaterial(new T.MeshStandardMaterial());let impactos=0,regresos=0,negro=0;
const cine=c.CAOZ_ARPG_FINAL_MAGO.fabrica(T,MOD,{escena,camara,casas,caminar(h,p,dt,vel=2.65){const d=h.pos.distanceTo(p);h.dir=Math.atan2(p.x-h.pos.x,p.z-h.pos.z);h.pos.lerp(p,Math.min(1,vel*dt/Math.max(.001,d)));h.fase+=vel*dt*2;return d<.04;},impactar(p){impactos++;fx.agujero(p,{radio:8.4,profundidad:24,duracion:30});},volver(){regresos++;},interfaz(s){negro=s.negro;}});
assert.equal(cine.recursos,null,'No reserva geometrías hasta entrar');
for(const fps of [30,60,120]){
 camara.position.set(12,16,22);camara.lookAt(actor.pos);const antes=regresos,impactosAntes=impactos,posAntes=actor.pos.clone();
 assert(cine.iniciar([actor,otro],{puerta:new T.Vector3(10,0,10)}));assert(!cine.iniciar([actor]));const orden=[];let ultimoAlto=0,poseAntes=null,inicioPaneo=null;
 for(let i=0;i<fps*40&&!cine.estado().terminado;i++){
  const est=cine.estado();if(orden.at(-1)!==est.fase)orden.push(est.fase);
  const fijo=JSON.stringify(est);cine.paso(0);assert.equal(JSON.stringify(cine.estado()),fijo,'La pausa no avanza');cine.paso(1/fps);
  assert(Number.isFinite(camara.position.length()+camara.quaternion.lengthSq()));
  if(cine.estado().fase==='techo'&&cine.estado().t>.1)assert(Math.abs(cine.estado().mago[1]-7.16)<.04,'El mago se apoya sobre el tejado');
  if(cine.estado().pov){assert(actor.m.mallas.every(m=>!m.visible),'El cuerpo real y su arma no tapan la primera persona');assert(cine.recursos.brazosFPS.raiz.visible,'Hay dos brazos reales en primera persona');}
  if(cine.estado().fase==='salida')assert(!cine.recursos.mago.visible,'Adreida sale antes de descubrir al mago');
  if(['desaparece','tropezar','buscar','levantarse'].includes(cine.estado().fase))assert(actor.m.mallas[0].visible,'El ataque, caída y recuperación se ven en tercera persona');
  if(cine.estado().fase==='buscar'&&cine.estado().t>.1){const cabeza=actor.m.H.cabeza.getWorldPosition(new T.Vector3());assert(cabeza.y<1.25,'Busca al mago desde el suelo');}
  const actual=cine.estado();
  if(est.fase==='salida'&&actual.fase==='descubrir')inicioPaneo={pos:camara.position.clone(),q:camara.quaternion.clone()};
  if(actual.fase==='descubrir'){
   assert(camara.position.distanceTo(inicioPaneo.pos)<1e-8,'El paneo gira en su sitio, sin avanzar hacia el dolly');
   assert.equal(camara.fov,42,'El primer plano no hace zoom');
   if(actual.t>2.1){assert(camara.quaternion.angleTo(inicioPaneo.q)>.5,'El paneo recorre de Adreida al mago');const foco=new T.Vector3(0,2.35,0).project(camara);assert(Math.hypot(foco.x,foco.y)<1e-6,'El paneo termina encuadrando al mago');}
  }
  if(est.fase==='descubrir'&&actual.fase==='vertigo'){
   assert(camara.position.distanceTo(inicioPaneo.pos)>3,'El segundo plano comienza con un corte a otra posición');
   assert(Math.abs(camara.fov-18)<1e-8,'El dolly empieza con su propia focal');
  }
  if(actual.fase==='vertigo'&&actual.t>0){
   const d=camara.position.distanceTo(new T.Vector3(0,2.35,0));assert(Math.abs(d*Math.tan(camara.fov*Math.PI/360)-24*Math.tan(9*Math.PI/180))<1e-6,'Dolly y focal se compensan para mantener el tamaño del mago');
   assert(cine.recursos.aura.visible&&cine.recursos.mago.visible,'El mago está envuelto en el hechizo');
  }
  if(actual.fase==='ataquePOV'&&actual.t>.15){const mano=cine.recursos.brazosFPS.H.manoD.getWorldPosition(new T.Vector3()).project(camara);assert(Math.abs(mano.x)<1&&Math.abs(mano.y)<1,'El arma empieza su arco dentro del encuadre FPS');}
  if(est.fase==='ataquePOV'&&actual.fase==='desaparece')assert(actor.pos.z<3,'El ataque no reinicia la aproximación al cortar');
  if(actual.fase==='cielo'&&actual.t>.6)assert.equal(camara.fov,24,'El zoom se completa enseguida al descubrir el meteorito');
  if(actual.fase==='caida'&&actual.t>.75){assert(actor.m.H.cabeza.getWorldPosition(new T.Vector3()).y<1.4,'Crouching baja el cuerpo para protegerse');poseAntes=['cadera','torso','brazoI','brazoD'].map(n=>({n,q:actor.m.H[n].quaternion.clone()}));}
  if(['impacto','abismo','negro'].includes(actual.fase)&&actual.t>0){
   assert(actor.m.raiz.visible&&actor.m.mallas[0].visible,'El impacto nunca oculta a Adreida');
   assert(actual.actor[1]<=ultimoAlto,'La caída avanza hacia abajo, sin anclarse al piso');ultimoAlto=actual.actor[1];
   if(actual.fase==='abismo'&&actual.t>1){assert(actual.actor[1]<-3,'Desciende realmente dentro de la geometría');assert(poseAntes.reduce((s,{n,q})=>s+q.angleTo(actor.m.H[n].quaternion),0)>.5,'La pose cambia de Crouching a Falling');const cabeza=actor.m.H.cabeza.getWorldPosition(new T.Vector3()).project(camara);assert(Math.abs(cabeza.x)<.8&&Math.abs(cabeza.y)<.8,'La cámara mantiene la caída dentro del plano');}
  }
 }
 assert.deepEqual(orden,['salida','descubrir','vertigo','carrera','ataquePOV','desaparece','tropezar','buscar','levantarse','techo','cielo','caida','impacto','abismo','negro']);
 assert.equal(regresos,antes+1);assert.equal(impactos,impactosAntes+1);assert.equal(negro,1);
 assert.equal(fx.estado().crateres.at(-1).radio,8.4);assert.equal(fx.estado().crateres.at(-1).profundidad,24);assert.equal(cine.recursos.fragmentos.count,180);assert.equal(cine.recursos.humo.count,28);
 assert(cine.estado().derrumbe>2);assert.equal(casa.castShadow,false);
 for(let i=0;i<120;i++)cine.paso(1/fps);assert.equal(regresos,antes+1,'No duplica la navegación');
 cine.cancelar();fx.limpiar();assert(!cine.activa);assert(actor.pos.equals(posAntes),'Cancelar restaura al actor, sin dejarlo bajo el piso');assert.equal(actor.m.raiz.visible,true);assert.equal(otro.m.raiz.visible,true);assert.equal(casa.castShadow,true);assert.equal(camara.fov,32);assert.equal(camara.near,.5);
}
for(const segundos of [0,4,8,13,20]){const antes=regresos;cine.iniciar([actor,otro]);for(let i=0;i<segundos*60;i++)cine.paso(1/60);assert(cine.finalizar());assert(!cine.finalizar());cine.paso(1);assert.equal(regresos,antes+1,'Omitir navega una sola vez');cine.cancelar();fx.limpiar();}
const n=escena.children.length;
for(let i=0;i<4;i++){cine.iniciar([actor,otro]);cine.cancelar();assert.equal(escena.children.length,n,'Reutiliza los efectos entre revisiones');}
cine.iniciar([otro]);assert.equal(otro.m.raiz.visible,false);cine.cancelar();assert.equal(escena.children.length,n,'El actor de historia prestado se retira');
console.log('✓ Final del mago: quince planos y brazos FPS, pausa, dos jugadores, actor Adreida, sima de 24 m de profundidad, ruinas, omisión/reinicio y regreso único a 30/60/120 FPS.');
