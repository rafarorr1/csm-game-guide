/* Salida desarmada y equipo continuo a través del paneo, con caché reversible. */
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const c=vm.createContext({console,atob});c.window=c;
for(const f of ['visor-three-vendor.js','adreida-scenario/combate.js','arpg-three-adreida-animacion.js','adreida-scenario/datos.js','adreida-piernas-scenario/datos.js','arpg-three-adreida.js','hacha-adreida-scenario/datos.js','arpg-three-hacha-adreida.js','arpg-three-modelos.js','adreida-scenario/cinematica.js','arpg-three-adreida-cine.js','arpg-three-mago-particulas.js','arpg-three-mago-hechizo.js','arpg-three-final-mago.js'])vm.runInContext(fs.readFileSync(new URL(f,import.meta.url),'utf8'),c);
const T=c.CAOZ_THREE.THREE,V=T.Vector3,MOD=c.CAOZ_ARPG_MODELOS.fabrica(T),actuacion=c.CAOZ_ARPG_ADREIDA_CINE.fabrica(T,MOD);
const escena=new T.Scene(),camara=new T.PerspectiveCamera(32,16/9,.5,1200),casas=new T.Group();escena.add(casas);
const actor={tipo:'adreida',vivo:true,m:MOD.crear('adreida'),pos:new V(4,0,6),dir:.7,fase:0};escena.add(actor.m.raiz);
actor.m.raiz.position.copy(actor.pos);actor.m.raiz.rotation.y=actor.dir;MOD.posar(actor.m,{anim:'quieto',t:0,dt:0,mezclar:false});
const original={pos:actor.pos.clone(),dir:actor.dir,pose:actuacion.capturar(actor.m),hacha:actor.m.hachaScenario.visible,sinHacha:actor.m.sinHacha};
const cine=c.CAOZ_ARPG_FINAL_MAGO.fabrica(T,MOD,{escena,camara,casas,interfaz(){},impactar(){}});
const clip=c.CAOZ_ADREIDA_CINE_CLIPS.salidaConGiro,finFuente=new V().fromArray(clip.raiz,clip.raiz.length-3),anguloFuente=Math.atan2(finFuente.x,finFuente.z);
const clipEquipo=c.CAOZ_ADREIDA_CINE_CLIPS.equiparHacha,inicioEquipo=1.8,contacto=inicioEquipo+clipEquipo.transferencia.contacto,referencia=MOD.crear('adreida');
const puerta=new V(0,0,-8),normal=new V(0,0,1),umbral=puerta.clone().addScaledVector(normal,-1.8),marco=puerta.clone().addScaledVector(normal,-2.25);
const cuerpo=actor.m.mallas[0],hacha=actor.m.hachaScenario,p=new V(),curvas=new Map(),botas=[];
for(let i=0;i<cuerpo.geometry.attributes.position.count;i++)if(cuerpo.geometry.attributes.position.getY(i)<.24)botas.push(i);
const manoHacha=hacha.skeleton.bones.indexOf(actor.m.H.manoD),inversaMano=hacha.skeleton.boneInverses[manoHacha];
const puntosHacha=Array.from({length:hacha.geometry.attributes.position.count},(_,i)=>new V().fromBufferAttribute(hacha.geometry.attributes.position,i).applyMatrix4(inversaMano));
assert.equal(c.CAOZ_ARPG_FINAL_MAGO.DURACIONES.salida,2.6,'El montaje mantiene la salida de 2.6 segundos');
assert.equal(clip.raiz.length,clip.muestras*3);assert.equal(clip.giros.length,clip.muestras);
assert(finFuente.length()>1,'La trayectoria procede del desplazamiento del FBX');

function cerca(a,b,tol,mensaje){assert(Math.abs(a-b)<=tol,`${mensaje}: ${a} / ${b}`);}
function accesorio(){return actor.m.raiz.getObjectByName('Hacha de Adreida · accesorio de cine');}
function armaVisible(){return hacha.visible?hacha:accesorio().children[0];}
function pose(){actor.m.raiz.updateMatrixWorld(true);const arma=armaVisible();return {pos:actor.pos.clone(),dir:actor.dir,cam:camara.position.clone(),q:camara.quaternion.clone(),mano:hacha.visible,espalda:accesorio().visible,sinHacha:actor.m.sinHacha,arma:[0,97,971,1940,3142].filter(i=>i<arma.geometry.attributes.position.count).map(i=>arma.getVertexPosition(i,new V()).applyMatrix4(arma.matrixWorld)),huesos:Object.fromEntries(['pieI','pieD','cadera','cabeza','manoD'].map(n=>[n,{pos:actor.m.H[n].getWorldPosition(new V()),q:actor.m.H[n].getWorldQuaternion(new T.Quaternion())}]))};}
function igualPose(a,b,tol){assert(a.pos.distanceTo(b.pos)<tol);cerca(a.dir,b.dir,tol,'Orientación conservada');for(const n of Object.keys(a.huesos)){assert(a.huesos[n].pos.distanceTo(b.huesos[n].pos)<tol,n+' conserva posición');assert(a.huesos[n].q.angleTo(b.huesos[n].q)<tol,n+' conserva orientación');}assert.equal(a.mano,b.mano);assert.equal(a.espalda,b.espalda);assert.equal(a.sinHacha,b.sinHacha);a.arma.forEach((v,i)=>assert(v.distanceTo(b.arma[i])<tol,'El caché conserva el arma visible'));}
function planoMarco(){
  // La raíz empieza sólo 45 cm fuera del marco. Verificamos la piel deformada,
  // no un círculo centrado en la raíz ni la caja de la casa que incluye su hueco.
  actor.m.raiz.updateMatrixWorld(true);let minima=Infinity;
  for(let i=0;i<cuerpo.geometry.attributes.position.count;i+=11){cuerpo.getVertexPosition(i,p).applyMatrix4(cuerpo.matrixWorld);minima=Math.min(minima,p.clone().sub(marco).dot(normal));}
  assert(minima>.08,'El cuerpo queda por delante de los jambajes durante la curva: '+minima);
}
function apoyoYAgarre(){
  actor.m.raiz.updateMatrixWorld(true);const arma=armaVisible();let bota=Infinity,filo=Infinity;
  for(const i of botas){cuerpo.getVertexPosition(i,p).applyMatrix4(cuerpo.matrixWorld);bota=Math.min(bota,p.y);}
  for(let i=0;i<puntosHacha.length;i++){
    arma.getVertexPosition(i,p).applyMatrix4(arma.matrixWorld);filo=Math.min(filo,p.y);
    if(hacha.visible&&i%97===0)assert(p.distanceTo(actor.m.H.manoD.localToWorld(puntosHacha[i].clone()))<1e-5,'El mango conserva su anclaje a la mano derecha tras la transferencia');
  }
  assert(bota>=-.003&&bota<.04,'Las botas conservan apoyo tras el FBX y su mezcla: '+bota);
  assert(filo>=-.003,'El hacha no atraviesa el piso: '+filo);
}
function equipoConReloj(estado){
  const edad=estado.total-inicioEquipo;if(edad<.12||edad>=clipEquipo.duracion)return;
  // Una referencia al tiempo absoluto detecta un reinicio del clip al entrar
  // en descubrir; comparar poses consecutivas por igualdad ocultaría el gesto.
  actuacion.equiparHacha(referencia,edad/clipEquipo.duracion);
  for(const n of clipEquipo.huesos)assert(actor.m.H[n].quaternion.angleTo(referencia.H[n].quaternion)<1e-6,'El reloj de equipar continúa en '+estado.fase+': '+n);
}
function cancelarYComprobar(){
  cine.cancelar();assert(actor.pos.distanceTo(original.pos)<1e-8);cerca(actor.dir,original.dir,1e-8,'Cancelar restaura dirección');
  for(const [n,q]of Object.entries(original.pose.rot))assert(actor.m.H[n].quaternion.angleTo(q)<1e-6,'Cancelar restaura '+n);
  assert.equal(hacha.visible,original.hacha);assert.equal(accesorio().visible,false);assert.equal(actor.m.sinHacha,original.sinHacha,'Cancelar restaura el estado de equipo de gameplay');
  original.pose.agarres.forEach((pesos,i)=>{if(pesos)assert.deepEqual(Array.from(actor.m.mallas[i].morphTargetInfluences),Array.from(pesos),'Cancelar restaura el cierre original de la mano');});
}

for(const fps of [30,60,120]){
  assert(cine.iniciar([actor],{puerta,umbral,normal}));const inicio=pose();
  assert(inicio.pos.distanceTo(umbral)<1e-8,'F000 comienza en el umbral');
  cerca(inicio.dir,-anguloFuente,1e-8,'F000 alinea la trayectoria sin duplicar su yaw');
  for(const n of clip.huesos){const indice=clip.huesos.indexOf(n),q=new T.Quaternion().fromArray(clip.datos,3+indice*4).normalize();assert(actor.m.H[n].quaternion.angleTo(q)<1e-6,'F000 ya contiene la pose FBX de '+n);}
  const inicialFijo=JSON.stringify(cine.estado());cine.paso(0);assert.equal(JSON.stringify(cine.estado()),inicialFijo);igualPose(inicio,pose(),1e-6);planoMarco();apoyoYAgarre();
  assert.equal(inicio.mano,false,'Sale sin un arma en la mano');assert.equal(inicio.espalda,true,'El hacha está estibada a la espalda');
  const guardados=[{cuadro:cine.capturarCuadro(),pose:inicio}],finEquipo=inicioEquipo+clipEquipo.duracion+.25;
  let anterior=inicio,anteriorEstado=cine.estado(),maxLateral=0,corte=null,transferido=null;
  for(let i=1;i<=Math.ceil((finEquipo+.05)*fps);i++){
    cine.paso(1/fps);const estado=cine.estado(),actual=pose();
    if(i===1){assert(actual.pos.distanceTo(inicio.pos)<.05,'F000→F001 avanza con la caminata, sin salto');assert(actual.huesos.pieD.pos.distanceTo(inicio.huesos.pieD.pos)<.01,'La primera bota apoyada no salta');}
    assert.notEqual(actual.mano,actual.espalda,'Hay exactamente una hacha visible');
    if(estado.total<contacto-1e-8)assert(!actual.mano&&actual.espalda,'La mano llega al mango antes de transferir el arma');
    if(actual.mano&&transferido===null){transferido=estado.total;assert(transferido>=contacto-1e-8&&transferido<=contacto+1/fps+1e-8,'La transferencia sucede a edad .90 del clip');for(let j=0;j<actual.arma.length;j++)assert(actual.arma[j].distanceTo(anterior.arma[j])<3/fps,'El arma no salta de la espalda a la mano');guardados.push({cuadro:cine.capturarCuadro(),pose:actual});}
    if(transferido!==null)assert(actual.mano&&!actual.espalda,'El hacha permanece en la mano después de sacarla');
    equipoConReloj(estado);apoyoYAgarre();
    if(estado.fase==='salida'){
      maxLateral=Math.max(maxLateral,Math.abs(actual.pos.x));planoMarco();
      assert(actual.pos.distanceTo(anterior.pos)<.07,'La raíz no salta entre muestras');
      cerca(actor.m.H.cuerpo.position.x,0,1e-8,'El cuerpo no duplica el avance X');cerca(actor.m.H.cuerpo.position.z,0,1e-8,'El cuerpo no duplica el avance Z');
      if(estado.t>2){assert(actual.pos.distanceTo(puerta)<1e-7,'Se asienta en el punto de salida');cerca(actual.dir,clip.giros.at(-1)-anguloFuente,1e-7,'El giro fuente se aplica exactamente una vez');}
      if(i%(fps/30)===0&&estado.t<=1.6+1e-8){const clave=Math.round(estado.t*30);if(fps===30)curvas.set(clave,{pos:actual.pos.clone(),dir:actual.dir});else{const ref=curvas.get(clave);assert(actual.pos.distanceTo(ref.pos)<1e-6,'La trayectoria coincide a distintas cadencias');cerca(actual.dir,ref.dir,1e-6,'El giro coincide a distintas cadencias');}}
    }
    if([.5,1.8,2.5,2.6,2.8,3.5].some(t=>Math.abs(estado.total-t)<.5/fps))guardados.push({cuadro:cine.capturarCuadro(),pose:actual});
    if(anteriorEstado.fase==='salida'&&estado.fase==='descubrir'){
      corte={cuadro:i,total:estado.total};
      // La simulación existente redondea los cambios de fase al siguiente paso.
      // Esta tolerancia conserva el montaje actual, sin moverlo un cuadro.
      assert(estado.total>=2.6-1e-8&&estado.total<=2.6+1/fps+1e-8);
      assert(actual.pos.distanceTo(puerta)<1e-7);
      for(const n of Object.keys(actual.huesos))assert(actual.huesos[n].pos.distanceTo(anterior.huesos[n].pos)<2/fps,'Equipar continúa sin salto en el corte: '+n);
      assert(actual.cam.distanceTo(anterior.cam)<1e-8,'El paneo comienza en la misma cámara');assert(actual.q.angleTo(anterior.q)<1e-6);
    }else if(anteriorEstado.fase==='descubrir'&&anteriorEstado.t===0){
      assert(actual.cam.distanceTo(anterior.cam)<1e-8,'Descubrir sólo rota la cámara');assert(actual.q.angleTo(anterior.q)<.005,'El paneo comienza gradualmente');
      assert(actual.pos.distanceTo(anterior.pos)<1e-8,'Descubrir conserva el punto de apoyo');
      for(const n of Object.keys(actual.huesos))assert(actual.huesos[n].pos.distanceTo(anterior.huesos[n].pos)<2/fps,'El primer cuadro de descubrir mantiene continuidad de '+n);
    }
    anterior=actual;anteriorEstado=estado;
  }
  assert(corte);assert(transferido!==null);assert(maxLateral>.05&&maxLateral<.3,'La salida conserva una curva, dentro del espacio frente a la puerta');
  guardados.push({cuadro:cine.capturarCuadro(),pose:pose()});
  for(const x of [...guardados].reverse().concat(guardados)){cine.mostrarCuadro(x.cuadro);igualPose(x.pose,pose(),1e-6);const fija=pose();cine.paso(0);igualPose(fija,pose(),1e-6);}
  cancelarYComprobar();
  cine.iniciar([actor],{puerta,umbral,normal});for(let i=0;i<fps;i++)cine.paso(1/fps);assert.equal(accesorio().visible,true);cancelarYComprobar();
  console.log(`OK salida/equipo ${fps} FPS: corte ${corte.cuadro} (${corte.total.toFixed(6)} s), transferencia ${transferido.toFixed(6)} s; reloj continuo, apoyo, agarre y caché reversible.`);
}
