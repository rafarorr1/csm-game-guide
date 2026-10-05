/* El meteorito cierra Alpha .01 en negro, sin reiniciar la partida; el editor sigue siendo reversible. */
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const c=vm.createContext({console,atob});c.window=c;
for(const f of ['visor-three-vendor.js','adreida-scenario/combate.js','arpg-three-adreida-animacion.js','adreida-scenario/datos.js','adreida-piernas-scenario/datos.js','arpg-three-adreida.js','hacha-adreida-scenario/datos.js','arpg-three-hacha-adreida.js','arpg-three-modelos.js','arpg-three-impactos.js','adreida-scenario/cinematica.js','arpg-three-adreida-cine.js','arpg-three-mago-particulas.js','arpg-three-mago-hechizo.js','arpg-three-final-mago.js','arpg-cine-camara.js'])vm.runInContext(fs.readFileSync(new URL(f,import.meta.url),'utf8'),c);
const T=c.CAOZ_THREE.THREE,MOD=c.CAOZ_ARPG_MODELOS.fabrica(T),escena=new T.Scene(),camara=new T.PerspectiveCamera(32,16/9,.5,1200),casas=new T.Group();
escena.background=new T.Color(0x233442);escena.fog=new T.Fog(0x233442,30,80);const ambiente=new T.HemisphereLight(0xaaccee,0x332211,.5),luna=new T.DirectionalLight(0xaaccff,2);escena.add(ambiente,luna);const fondoOriginal=escena.background.clone();
const g=new T.BoxGeometry(6,7,5).toNonIndexed();g.translate(5,3.5,-17);const casa=new T.Mesh(g,new T.MeshStandardMaterial());casa.castShadow=true;casas.add(casa);escena.add(casas);
const tapa=new T.Mesh(new T.BoxGeometry(6,9,6).toNonIndexed(),new T.MeshStandardMaterial());tapa.position.set(0,4.5,20);casas.add(tapa);
const salidaCasa=new T.Mesh(new T.BoxGeometry(6,7,5).toNonIndexed(),new T.MeshStandardMaterial());salidaCasa.position.set(17,3.5,17);casas.add(salidaCasa);
casas.userData.ocultacion={cajas:[casa,tapa,salidaCasa].map(m=>new T.Box3().setFromObject(m)),opacidades:new Float32Array([1,1,1])};
const actor={tipo:'adreida',vivo:true,m:MOD.crear('adreida'),pos:new T.Vector3(10,0,10),dir:0,fase:0};escena.add(actor.m.raiz);
const otro={tipo:'mohamed',vivo:true,m:MOD.crear('mohamed'),pos:new T.Vector3(),dir:0,fase:0};escena.add(otro.m.raiz);
const fx=c.CAOZ_ARPG_IMPACTOS.fabrica(T,escena);fx.actualizarMaterial(new T.MeshStandardMaterial());let impactos=0,regresos=0,negro=0,lluvia=null,tormenta=null,avisosFin=0,ultimaInterfaz=null;
const cine=c.CAOZ_ARPG_FINAL_MAGO.fabrica(T,MOD,{escena,camara,casas,planoDeFase:c.CAOZ_ARPG_CINE_CAMARA.planoDeFase,ambienteLluvia(t,p,opciones){lluvia=t;tormenta=opciones;},impactar(p){impactos++;fx.agujero(p,{radio:8.4,profundidad:24,duracion:30});},volver(){regresos++;},interfaz(s){negro=s.negro;ultimaInterfaz={...s};if(s.fase==='fin')avisosFin++;}});
assert.equal(cine.recursos,null,'No reserva geometrías hasta entrar');
assert.equal(c.CAOZ_ARPG_FINAL_MAGO.DURACIONES.vertigo,2.8,'El dolly frontal dura un segundo más');
assert.equal(c.CAOZ_ARPG_CINE_CAMARA.planos[4],'carrera');assert.equal(c.CAOZ_ARPG_CINE_CAMARA.planos[5],'tropezar','El slide conserva el identificador del plano 6 y sus keyframes');
for(const [fase,segundos]of Object.entries({descubrir:3.4,carrera:93/60,ataquePOV:.55,desaparece:.35,levantarse:.30,tropezar:.74,buscar:1.2,voltear:4.6,techo:1.4,hechizo:3}))assert.equal(c.CAOZ_ARPG_FINAL_MAGO.DURACIONES[fase],segundos,'El montaje separa slide, incorporación, giro y POV: '+fase);
for(const fps of [30,60,120]){
 camara.position.set(12,16,22);camara.lookAt(actor.pos);const antes=regresos,finAntes=avisosFin,impactosAntes=impactos,posAntes=actor.pos.clone();
 assert(cine.iniciar([actor,otro],{puerta:new T.Vector3(10,0,10)}));assert(!cine.iniciar([actor]));const orden=[],velocidadesPies=[];let ultimoAlto=0,poseAntes=null,inicioPaneo=null,dirAtaque=null,ultimaCamara=null,inicioPOV=null,rematePos=null,minBusqueda=Infinity,maxBusqueda=-Infinity,particulasVistas=false,reunionVista=false,observacion=0;
 for(let i=0;i<fps*40&&!cine.estado().terminado;i++){
  const est=cine.estado();if(orden.at(-1)!==est.fase)orden.push(est.fase);
  const fijo=JSON.stringify(est);cine.paso(0);assert.equal(JSON.stringify(cine.estado()),fijo,'La pausa no avanza');cine.paso(1/fps);
  assert(Number.isFinite(camara.position.length()+camara.quaternion.lengthSq()));
  if(cine.estado().fase==='techo'&&cine.estado().t>.1)assert(Math.abs(cine.estado().mago[1]-7.16)<.04,'El mago se apoya sobre el tejado');
  if(cine.estado().pov){assert(actor.m.mallas.every(m=>!m.visible),'El cuerpo real y su arma no tapan la primera persona');assert.equal(cine.recursos.brazosFPS.raiz.visible,['carrera','ataquePOV'].includes(cine.estado().fase),'Sólo la toma 5 muestra brazos; la toma 7 mantiene el POV despejado');}
  if(cine.estado().fase==='salida')assert(!cine.recursos.mago.visible,'Adreida sale antes de descubrir al mago');
  if(['desaparece','tropezar','buscar','levantarse'].includes(cine.estado().fase))assert(actor.m.mallas[0].visible,'Deslizamiento, giro y búsqueda se ven en tercera persona');
  if(cine.estado().fase==='buscar'&&cine.estado().t>.1){const cabeza=actor.m.H.cabeza.getWorldPosition(new T.Vector3());assert(cabeza.y>1.35,'Busca al mago de pie después del giro');minBusqueda=Math.min(minBusqueda,actor.m.H.cabeza.rotation.y);maxBusqueda=Math.max(maxBusqueda,actor.m.H.cabeza.rotation.y);}
  const actual=cine.estado();
  const magia=cine.recursos.particulasMago,hechizo=cine.recursos.hechizoMago;
  if(actual.fase==='hechizo'){
   assert(!cine.recursos.meteorito.visible,'No aparece el meteorito durante los tres segundos del hechizo');
   if(actual.t>1.5){assert(escena.background.r<fondoOriginal.r*.45,'El cielo se oscurece después de reconstruirse el mago');assert(ambiente.intensity<.5&&luna.intensity<2);}
   if(hechizo.estado.pulso>.2)assert(hechizo.nucleo.count>0,'El pulso dibuja rayos verdes durante la invocación');
  }
  if(actual.inicios.hechizo===undefined)assert(escena.background.equals(fondoOriginal),'El cielo no se oscurece antes de reconstruirse el mago');
  if(['hechizo','cielo'].includes(actual.fase)){
   assert(tormenta.edadHechizo>=0,'La lluvia recibe el reloj absoluto de la tormenta');
   assert(actor.pos.distanceTo(rematePos)<1e-7,'El viento no desplaza las botas ni al actor sobre la plaza');
   assert(Math.abs(actor.m.H.torso.rotation.z)<.04&&Math.abs(actor.m.H.cabeza.rotation.z)<.02,'El viento inclina el cuerpo ligeramente');
   if(tormenta.edadHechizo>1)assert(actor.m.H.torso.rotation.z<-.005,'Adreida resiste el viento durante el hechizo');
  }
  if(actual.fase==='ataquePOV')assert(Math.hypot(camara.position.x-cine.recursos.mago.position.x,camara.position.z-cine.recursos.mago.position.z)>1.2,'El slide no mete la cámara bajo la túnica');
  if(actual.fase==='tropezar'&&actual.lluviaLiberada&&actual.total-actual.golpeMago>.24){assert.equal(magia.disolucion.value,1,'El mago deja de dibujarse tras convertirse en partículas');assert(magia.particulas.count>=144);particulasVistas=true;}
  if(actual.fase==='voltear'){
   assert.equal(magia.disolucion.value,1,'El mago no reaparece antes de que llegue la estela');
   if(actual.t>0&&actual.t<2.5-1e-8){
    const variacion=camara.getWorldDirection(new T.Vector3()).angleTo(inicioPOV);observacion=Math.max(observacion,variacion);
    assert(variacion<.14,'Observa las partículas lentamente, sin adelantarse al viaje hacia el tejado');assert.equal(actor.dir,dirAtaque,'El cuerpo espera medio segundo antes de reaccionar');
    assert.equal(magia.estado.fase,actual.t+1e-8<2?'explosion':'viaje','Las partículas se reúnen antes de que Adreida las siga');
   }
   if(actual.t>3){const foco=magia.focoViaje(actual.t-2,2.6).clone().project(camara);assert(Math.abs(foco.x)<.05&&Math.abs(foco.y)<.05,'La estela guía la mirada por el centro del POV');assert(magia.estelas.count>0,'Las partículas dejan una estela visible durante el giro');}
  }
  if(['techo','hechizo'].includes(actual.fase))assert.equal(camara.fov,44,'La reconstrucción se ve con el acercamiento del final de la estela');
  if(actual.fase==='techo'&&actual.t>.55&&actual.t<1.2){assert(magia.disolucion.value>0&&magia.disolucion.value<1,'El POV permite ver la reconstrucción progresiva');reunionVista=true;}
  if(actual.fase==='cielo'){assert.equal(cine.recursos.meteorito.children.length,1,'El meteorito sólo dibuja la roca: no lleva estela');assert.equal(magia.disolucion.value,0,'El mago queda completo antes del meteorito');assert.equal(magia.particulas.count,0);}

  assert.equal(lluvia,actual.tLluvia,'El clima sigue exactamente el tiempo de la secuencia');
  if(['salida','descubrir','vertigo','pies','carrera','ataquePOV','desaparece','levantarse'].includes(actual.fase)){assert.equal(actual.lluviaLiberada,false);assert.equal(lluvia,0,'Las gotas siguen suspendidas durante el hechizo');}
  if(!est.lluviaLiberada&&actual.lluviaLiberada){assert.equal(actual.fase,'tropezar');assert(cine.recursos.particulasMago.capturar(),'El golpe inicia la dispersión del mago');assert.equal(lluvia,0);assert(actual.total-actual.inicios.ataquePOV>=1.36-1e-7&&actual.total-actual.inicios.ataquePOV<=1.36+1/fps+1e-7,'El golpe dispara partículas durante el barrido, sin esperar la recuperación');}
  if(est.lluviaLiberada)assert(Math.abs(actual.tLluvia-est.tLluvia-1/fps)<1e-8,'La lluvia cae desde que se interrumpe el hechizo');
  assert.equal(actual.plano,c.CAOZ_ARPG_CINE_CAMARA.planoDeFase(actual.fase));
  if(actual.plano===est.plano)assert(Math.abs(actual.tPlano-est.tPlano-1/fps)<1e-8,'El reloj de cámara continúa al cambiar de acción');else assert.equal(actual.tPlano,0,'Un plano nuevo comienza en cero');
  if(est.fase==='salida'&&actual.fase==='descubrir'){
   inicioPaneo={pos:camara.position.clone(),q:camara.quaternion.clone()};
   const derecha=new T.Vector3(1,0,0).applyQuaternion(camara.quaternion),haciaMago=new T.Vector3(0,2.35,0).sub(camara.position);
   assert(haciaMago.dot(derecha)>0,'El mago queda a la derecha del encuadre inicial: paneo de izquierda a derecha');
  }
  if(actual.fase==='descubrir'){
   assert(camara.position.distanceTo(inicioPaneo.pos)<1e-8,'El paneo gira en su sitio, sin avanzar hacia el dolly');
   assert.equal(camara.fov,42,'El primer plano no hace zoom');
   if(actual.t>3.1){assert(camara.quaternion.angleTo(inicioPaneo.q)>.5,'El paneo recorre de Adreida al mago');const foco=new T.Vector3(0,2.35,0).project(camara);assert(Math.hypot(foco.x,foco.y)<1e-6,'El paneo termina encuadrando al mago');}
  }
  if(est.fase==='descubrir'&&actual.fase==='vertigo'){
   assert(camara.position.distanceTo(inicioPaneo.pos)>3,'El segundo plano comienza con un corte a otra posición');
   assert(Math.abs(camara.fov-18)<1e-8,'El dolly empieza con su propia focal');
  }
  if(est.fase==='vertigo'&&actual.fase==='pies'){
   assert(Math.abs(actor.pos.distanceTo(new T.Vector3(10,0,10))-2*(11/90)**2)<1e-8,'El primer cuadro usa la posición del antiguo F011');
  }
  if(est.fase==='pies'&&actual.fase==='pies')velocidadesPies.push(new T.Vector3(...actual.actor).distanceTo(new T.Vector3(...est.actor))*fps);
  if(actual.fase==='pies'){
   assert(camara.position.y<.6,'El insert mira las botas desde el piso');assert(!actual.pov);
   const bota=actor.pos.clone().setY(.2).project(camara);assert(Math.abs(bota.x)<.8&&Math.abs(bota.y)<.8,'Las botas quedan en el encuadre');
   assert(actor.pos.distanceTo(new T.Vector3(10,0,10))<=2.001,'El insert sólo muestra las primeras pisadas');
  }
  if(est.fase==='pies'&&actual.fase==='carrera')assert(Math.abs(actual.total-actual.inicios.pies-Math.ceil((79/60)*fps-1e-8)/fps)<1e-8,'El insert recorta once cuadros, con duración cuantizada sólo al paso de simulación');
  if(est.fase==='pies'&&actual.fase==='carrera')assert(new T.Vector3(...actual.actor).distanceTo(new T.Vector3(...est.actor))<5.8/fps+.001,'La carrera continúa desde la última pisada del insert sin saltar a la puerta');
  if(actual.fase==='vertigo'&&actual.t>0){
   const d=camara.position.distanceTo(new T.Vector3(0,2.35,0));assert(Math.abs(d*Math.tan(camara.fov*Math.PI/360)-24*Math.tan(9*Math.PI/180))<1e-6,'Dolly y focal se compensan para mantener el tamaño del mago');
   const frenteMago=new T.Vector3(0,0,1).applyQuaternion(cine.recursos.mago.quaternion),haciaCamara=camara.position.clone().sub(cine.recursos.mago.position).setY(0).normalize();
   assert(frenteMago.dot(haciaCamara)>.999,'El dolly mira de frente al mago');
   assert(cine.recursos.aura.visible&&cine.recursos.mago.visible,'El mago está envuelto en el hechizo');
   assert.equal(actual.casaDolly,1,'Sólo selecciona la casa que tapa el inicio del dolly');
   assert(casas.userData.ocultacion.opacidades[1]<.1);assert.equal(casas.userData.ocultacion.opacidades[0],1);assert.equal(casas.userData.ocultacion.opacidades[2],1);
  }
  if(actual.fase!=='vertigo')assert(casas.userData.ocultacion.opacidades.every(v=>v===1),'Las casas vuelven a su opacidad fuera del dolly');
  if(['carrera','ataquePOV','desaparece','tropezar'].includes(actual.fase)){
   assert(Math.abs(actor.pos.x-actor.pos.z)<1e-7,'Carrera, ataque y tropiezo conservan la misma línea desde la puerta');
   if(['desaparece','tropezar'].includes(actual.fase)&&actual.t>0){const frente=new T.Vector3(Math.sin(actor.dir),0,Math.cos(actor.dir)),vista=camara.getWorldDirection(new T.Vector3()).setY(0).normalize();assert(Math.abs(frente.dot(vista))<1e-6,'El fallo se ve de perfil');}
  }
  if(est.fase==='desaparece'&&actual.fase==='levantarse'){dirAtaque=actor.dir;rematePos=new T.Vector3(Math.sin(actor.dir),0,Math.cos(actor.dir)).multiplyScalar(-1.6);}
  if(actual.fase==='levantarse'&&actual.t>.05)assert(actor.pos.distanceTo(rematePos)>.035,'La incorporación conserva impulso después del slide');
  if(est.fase==='tropezar'&&actual.fase==='buscar'){assert(actor.pos.distanceTo(rematePos)>.40&&actor.pos.distanceTo(rematePos)<.43,'El remate avanza 42 cm después del slide antes de plantar el giro');rematePos=actor.pos.clone();}
  if(['levantarse','tropezar','buscar'].includes(actual.fase)){
   assert.equal(actor.dir,dirAtaque,'No gira hacia el tejado antes de cortar al POV');
   if(actual.fase==='buscar')assert(actor.pos.distanceTo(rematePos)<1e-8,'La búsqueda conserva el apoyo final del giro');
  }
  if(est.fase==='buscar'&&actual.fase==='voltear'){
   inicioPOV=camara.getWorldDirection(new T.Vector3());
   assert(actual.pov&&!actual.brazosFPS,'El plano 7 empieza desde sus ojos, sin brazos');
   assert(Math.abs(camara.position.y-actor.pos.y-1.69)<1e-8,'El corte tiene altura de ojos desde el primer cuadro');
   const haciaMago=cine.recursos.mago.position.clone().sub(camara.position).normalize();
   assert(inicioPOV.dot(haciaMago)<0,'El mago permanece detrás del campo visual al entrar al POV');
   assert.equal(actor.dir,dirAtaque,'El cuerpo todavía no ha girado en el corte');
  }
  if(actual.fase==='voltear'&&actual.t>0){
   assert(actual.pov&&!actual.brazosFPS,'Todo el giro al tejado ocurre en primera persona, sin brazos');
   const haciaTecho=cine.recursos.mago.position.clone().sub(actor.pos).setY(0).normalize(),antes=new T.Vector3(Math.sin(dirAtaque),0,Math.cos(dirAtaque));
   assert(haciaTecho.dot(antes)<-.9,'El mago reaparece sobre la casa detrás de Adreida');
   if(actual.t>4.5)assert(camara.getWorldDirection(new T.Vector3()).dot(inicioPOV)<-.7,'La mirada recorre realmente el giro hacia atrás');
  }
  if(est.fase==='voltear'&&actual.fase==='techo'){
   const foco=cine.recursos.mago.position.clone().add(new T.Vector3(0,1.3,0)).project(camara);assert(Math.hypot(foco.x,foco.y)<1e-6,'El movimiento POV termina encuadrando al mago');
   const delta=Math.atan2(Math.sin(actor.dir-dirAtaque),Math.cos(actor.dir-dirAtaque));assert(Math.abs(delta)>Math.PI*5/6,'El cuerpo acompaña el giro de los ojos');
  }
  if(actual.fase==='impacto'){
   const r=cine.recursos;assert(Math.abs(r.onda.scale.x-(1+actual.t*14))<1e-6,'La onda visual alcanza las estructuras a la misma velocidad que su derrumbe');
   assert(Math.abs(r.frenteOnda.scale.x-r.onda.scale.x)<1e-6,'La cortina verde y el frente del suelo coinciden');
   if(actual.t<1.8){assert(r.onda.visible&&r.frenteOnda.visible);assert(r.frenteOnda.scale.y>1,'La magia tiene volumen sobre el suelo');}
  }
  if(['impacto','negro'].includes(actual.fase)){
   assert(camara.position.y>29,'El plano posterior al meteorito abre la vista de la plaza');
   assert.equal(camara.fov,48,'El superwide conserva su focal hasta el fundido');
   if(est.fase==='impacto'&&actual.fase==='negro')ultimaCamara={pos:camara.position.clone(),q:camara.quaternion.clone()};
   if(actual.fase==='negro'&&actual.t>0){assert(camara.position.distanceTo(ultimaCamara.pos)<.001,'El fundido no corta a otra cámara');assert(camara.quaternion.angleTo(ultimaCamara.q)<1e-6);}
   for(const p of [[-18,0,0],[18,0,0],[0,0,-18],[0,0,18]]){const ndc=new T.Vector3(...p).project(camara);assert(Math.abs(ndc.x)<1&&Math.abs(ndc.y)<1,'La destrucción de ambos lados queda dentro del plano general');}
  }
  if(actual.fase==='ataquePOV'&&actual.t>.15&&actual.t<.80){const mano=cine.recursos.brazosFPS.H.manoD.getWorldPosition(new T.Vector3()).project(camara);assert(Math.abs(mano.x)<1&&Math.abs(mano.y)<1,'El arma empieza su arco dentro del encuadre FPS');}
  if(est.fase==='ataquePOV'&&actual.fase==='desaparece'){
   assert(actor.pos.z<3,'El ataque no reinicia la aproximación al cortar');
   assert(Math.abs(actual.total-actual.inicios.ataquePOV-Math.ceil(.55*fps-1e-8)/fps)<1e-7,'El corte continúa a los 0,55 s del slide');
   assert(actual.total-actual.inicios.ataquePOV<.90,'Al entrar al plano 6 todavía se está deslizando');
   assert(actor.m.H.cabeza.getWorldPosition(new T.Vector3()).y-actor.pos.y<1.35,'El plano 6 continúa con la rodilla baja en pleno slide');
  }
  if(['desaparece','levantarse','tropezar'].includes(actual.fase)&&actual.t>0){const apoyo=actor.m.H.manoD.localToWorld(new T.Vector3(0,-.3,0));assert(apoyo.distanceTo(actor.m.H.manoI.getWorldPosition(new T.Vector3()))<.006,'El hachazo fallido conserva las manos sobre el mango');}
  if(est.fase==='hechizo'&&actual.fase==='cielo'){assert.equal(camara.fov,44,'El meteorito no reinicia el zoom a una focal más abierta');assert(cine.recursos.meteorito.visible);assert.equal(actual.meteorito[1],54,'El primer cuadro del meteorito ya está en el cielo, nunca frente a los brazos');assert(cine.recursos.meteorito.position.distanceTo(camara.position)>50,'La roca queda lejos del plano cercano');}
  if(actual.fase==='cielo'&&actual.t>.6)assert.equal(camara.fov,24,'El zoom se completa enseguida al descubrir el meteorito');
  if(actual.fase==='caida'){
   assert(camara.position.y>10,'El corte de preparación también empieza con su cámara correcta');
   const base=c.CAOZ_ARPG_CINE_CAMARA.crear(T).capturar(camara),pose=cine.capturarCuadro().poses;
   const restaurar=cine.respirarCamara();assert.equal(typeof restaurar,'function');const agitada=camara.position.clone();
   assert(agitada.distanceTo(new T.Vector3(...base.pos))<.05,'Respiración leve, sin sacudidas de impacto');
   if(actual.t>.2&&actual.t<.8)assert(agitada.distanceTo(new T.Vector3(...base.pos))>.001,'La respiración mueve la cámara');
   restaurar();assert.deepEqual(camara.position.toArray(),base.pos);assert.deepEqual(camara.quaternion.toArray(),base.rot);
   const otra=cine.respirarCamara();assert(camara.position.equals(agitada),'El mismo cuadro no acumula movimiento');otra();
   assert.deepEqual(cine.capturarCuadro().poses,pose,'La respiración no mueve actores ni brazos');
   camara.position.set(7,12,20);const editada=camara.position.clone(),volver=cine.respirarCamara();volver();assert(camara.position.equals(editada),'También restaura la cámara editada');camara.position.fromArray(base.pos);
  }else assert.equal(cine.respirarCamara(),null,'El movimiento sólo pertenece a la preparación del impacto');
  if(actual.fase==='caida'&&actual.t>.75){assert(actor.m.H.cabeza.getWorldPosition(new T.Vector3()).y<1.4,'Crouching baja el cuerpo para protegerse');poseAntes=['cadera','torso','brazoI','brazoD'].map(n=>({n,q:actor.m.H[n].quaternion.clone()}));}
  if(['impacto','negro'].includes(actual.fase)&&actual.t>0){
   assert(actor.m.raiz.visible&&actor.m.mallas[0].visible,'El impacto nunca oculta a Adreida');
   assert(actual.actor[1]<=ultimoAlto,'La caída avanza hacia abajo, sin anclarse al piso');ultimoAlto=actual.actor[1];
   if(actual.fase==='impacto'&&actual.t>2.5){assert(actual.actor[1]<-3,'Desciende realmente dentro de la geometría');assert(poseAntes.reduce((s,{n,q})=>s+q.angleTo(actor.m.H[n].quaternion),0)>.5,'La pose cambia de Crouching a Falling');const cabeza=actor.m.H.cabeza.getWorldPosition(new T.Vector3()).project(camara);assert(Math.abs(cabeza.x)<.8&&Math.abs(cabeza.y)<.8,'La cámara mantiene la caída dentro del plano');}
  }
 }
 assert.deepEqual(orden,['salida','descubrir','vertigo','pies','carrera','ataquePOV','desaparece','levantarse','tropezar','buscar','voltear','techo','hechizo','cielo','caida','impacto','negro']);
 assert(observacion>.04,'La cabeza explora visiblemente las partículas antes de seguirlas');
 assert(particulasVistas&&reunionVista,'La dispersión y la reconstrucción son fases visibles, no sólo cambios de estado');
 assert(minBusqueda<-.35&&maxBusqueda>.35,'La búsqueda separa dos miradas opuestas antes del POV');
 assert(velocidadesPies.length>25);const razon=velocidadesPies[1]/velocidadesPies[0];
 assert(razon>1.01,'La velocidad debe aumentar durante el insert');
 for(let i=2;i<velocidadesPies.length;i++)assert(Math.abs(velocidadesPies[i]/velocidadesPies[i-1]-razon)<1e-7,'La velocidad crece exponencialmente: igual factor en intervalos iguales');
 assert(velocidadesPies.at(-1)>velocidadesPies[0]*15,'El arranque pasa de lento a carrera de forma perceptible');
 assert.equal(regresos,antes,'El final no regresa al primer nivel');assert.equal(avisosFin,finAntes+1,'La interfaz recibe un único final');assert.equal(ultimaInterfaz.fase,'fin');assert.equal(impactos,impactosAntes+1);assert.equal(negro,1);
 assert.equal(fx.estado().crateres.at(-1).radio,8.4);assert.equal(fx.estado().crateres.at(-1).profundidad,24);assert.equal(cine.recursos.fragmentos.count,180);assert.equal(cine.recursos.humo.count,28);
 assert(cine.estado().derrumbe>2);assert.equal(casa.castShadow,false);
 const estadoTerminado=JSON.stringify(cine.estado());for(let i=0;i<120;i++)cine.paso(1/fps);assert.equal(regresos,antes,'La pantalla final no navega después');assert.equal(avisosFin,finAntes+1);assert.equal(JSON.stringify(cine.estado()),estadoTerminado,'El final permanece detenido');
 cine.cancelar();fx.limpiar();assert(!cine.activa);assert(actor.pos.equals(posAntes),'Cancelar restaura al actor, sin dejarlo bajo el piso');assert.equal(actor.m.raiz.visible,true);assert.equal(otro.m.raiz.visible,true);assert.equal(casa.castShadow,true);assert.equal(camara.fov,32);assert.equal(camara.near,.5);
}
for(const segundos of [0,4,6,8,13,20]){const antes=regresos,finAntes=avisosFin;cine.iniciar([actor,otro]);for(let i=0;i<segundos*60;i++)cine.paso(1/60);assert(cine.finalizar());assert(casas.userData.ocultacion.opacidades.every(v=>v===1),'Omitir restaura la casa aunque se interrumpa el dolly');assert(!cine.finalizar());cine.paso(1);assert.equal(regresos,antes,'Omitir llega al mismo final sin navegar');assert.equal(avisosFin,finAntes+1);assert.equal(ultimaInterfaz.fase,'fin');assert.equal(negro,1);cine.cancelar();fx.limpiar();}
for(let j=0;j<2;j++){cine.iniciar([actor,otro]);while(cine.estado().fase!=='vertigo')cine.paso(1/60);assert(casas.userData.ocultacion.opacidades[1]<.1);cine.cancelar();assert(casas.userData.ocultacion.opacidades.every(v=>v===1),'Cancelar también restaura la casa, incluso al repetir la toma');}
const n=escena.children.length;
for(let i=0;i<4;i++){cine.iniciar([actor,otro]);cine.cancelar();assert.equal(escena.children.length,n,'Reutiliza los efectos entre revisiones');}
cine.iniciar([otro]);assert.equal(otro.m.raiz.visible,false);cine.cancelar();assert.equal(escena.children.length,n,'El actor de historia prestado se retira');
console.log('✓ Final del mago: dolly frontal de 2,8 s, slide en F093 y corte en F126, incorporación y giro continuo, dispersión y reconstrucción del mago, reacción demorada .5s al viaje de partículas, viento y onda verde, POV siguiendo estelas y cierre superwide sin corte, brazos FPS, pausa, dos jugadores, actor Adreida, sima de 24 m de profundidad, ruinas, omisión/reinicio y final permanente sin navegación a 30/60/120 FPS.');

// Se hornea una vez y se puede saltar en ambas direcciones sin ejecutar actuación.
cine.iniciar([actor,otro]);const cuadros=[];
while(!cine.estado().terminado){cuadros.push(cine.capturarCuadro());cine.paso(1/60);}
cuadros.push(cine.capturarCuadro());
const inicio5=cuadros.findIndex(f=>f.estado.fase==='carrera'),inicioSlide=cuadros.findIndex(f=>f.estado.fase==='ataquePOV'),inicio6=cuadros.findIndex(f=>f.estado.fase==='desaparece');
assert.equal(inicioSlide-inicio5,93,'F093 del plano 5 inicia exactamente el deslizamiento');
assert.equal(inicio6-inicio5,126,'F126 corta al plano 6 manteniendo el mismo slide');
assert.equal(cuadros.filter(f=>f.estado.fase==='hechizo').length,180,'El hechizo dura tres segundos antes del meteorito');
assert.equal(cuadros.filter(f=>f.estado.fase==='pies').length,79,'El editor muestra 79 cuadros: el F011 previo es el nuevo F000');
const muestras=[0,cuadros.findIndex(f=>f.estado.fase==='ataquePOV'&&f.estado.t>.3),cuadros.findIndex(f=>f.estado.fase==='pies'&&f.estado.t>.7),cuadros.findIndex(f=>f.estado.fase==='techo'),cuadros.findIndex(f=>f.estado.fase==='desaparece'),cuadros.findIndex(f=>f.estado.fase==='levantarse'&&f.estado.t>.1),cuadros.findIndex(f=>f.estado.fase==='voltear'&&f.estado.t>.45),cuadros.findIndex(f=>f.estado.fase==='tropezar'&&f.estado.t>.3),cuadros.findIndex(f=>f.estado.fase==='techo'&&f.estado.t>.75),cuadros.findIndex(f=>f.estado.fase==='hechizo'&&f.estado.t>1.1),cuadros.findIndex(f=>f.estado.fase==='cielo'&&f.estado.t>.8),cuadros.findIndex(f=>f.estado.fase==='impacto'&&f.estado.t>1.4),cuadros.length-1];
const recursosAntes=escena.children.length;
for(const i of [...muestras,...muestras.slice().reverse(),...muestras]){
 for(const x of cuadros[i].agarres)x.n.morphTargetInfluences.fill(-1);
 const f=cuadros[i];cine.mostrarCuadro(f);const actual=cine.estado();for(const clave of ['mago','meteorito']){assert(actual[clave].every((v,j)=>Math.abs(v-f.estado[clave][j])<1e-5),'Posiciones visuales conservadas con precisión submilimétrica');actual[clave]=f.estado[clave];}assert.equal(JSON.stringify(actual),JSON.stringify(f.estado),'Restaurar conserva fase, relojes, lluvia y posiciones');
 assert.deepEqual(cine.recursos.particulasMago.capturar(),f.particulas,'Scrub restaura exactamente la disolución y el estado de las partículas');
 assert.deepEqual(cine.recursos.hechizoMago.capturar(),f.hechizo,'Scrub restaura exactamente cielo, nubes, niebla y luces del hechizo');
 assert.equal(tormenta.edadHechizo,f.estado.inicios.hechizo===undefined?-1:Math.max(0,f.estado.total-f.estado.inicios.hechizo),'La lluvia y el viento recuperan su intensidad al retroceder');
 assert.deepEqual([cine.recursos.sello,cine.recursos.humo,cine.recursos.onda,cine.recursos.frenteOnda].map(m=>m.material.opacity),Array.from(f.opacidad),'La energía de la onda también se restaura');
 for(const x of f.agarres)assert.deepEqual(x.n.morphTargetInfluences,x.pesos,'Buscar cuadros restaura el cierre de los dedos, incluido el POV');
 for(const m of cine.recursos.brazosFPS.mallas){assert.equal(m.material.depthTest,f.estado.fase!=='ataquePOV','La búsqueda restaura la capa del arma en POV');assert.equal(m.renderOrder,f.estado.fase==='ataquePOV'?40:0);}
 assert.equal(ultimaInterfaz.fase,f.estado.terminado?'fin':f.estado.fase,'Buscar el cuadro final restaura también el aviso terminal');if(f.estado.terminado)assert.equal(negro,1);
 const antes=cine.capturarCuadro();camara.position.set(70,20,-30);camara.lookAt(new T.Vector3(2,3,4));cine.vistaEditor(false);
 const despues=cine.capturarCuadro();for(let j=0;j<antes.poses.length;j++){if(j%12===10)continue;assert(Math.abs(antes.poses[j]-despues.poses[j])<1e-6,'Mover cámara no cambia transformaciones, huesos ni brazos POV');}
 cine.vistaEditor(true);const externa=cine.capturarCuadro();for(let j=0;j<antes.poses.length;j++){if(j%12===10)continue;assert(Math.abs(antes.poses[j]-externa.poses[j])<1e-6,'Alternar vista sólo cambia visibilidad');}
 assert.equal(escena.children.length,recursosAntes,'Scrub no reserva geometría ni crea partículas nuevas');
}
const bytes=cuadros.reduce((n,f)=>n+f.poses.byteLength+f.instancias.reduce((m,x)=>m+x.i.byteLength,0),0);
assert(bytes<64*1024*1024,'La actuación almacenada debe caber en 64 MiB sin duplicar texturas');
cine.cancelar();fx.limpiar();assert(escena.background.equals(fondoOriginal));assert.equal(ambiente.intensity,.5);assert.equal(luna.intensity,2);
console.log(`✓ Actuación bloqueada: caché reversible de ${cuadros.length} cuadros (${(bytes/1024/1024).toFixed(1)} MiB), brazos anclados, instancias y sombras restauradas sin resimular.`);
