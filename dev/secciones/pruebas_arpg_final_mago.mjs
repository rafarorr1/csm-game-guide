/* La salida de la casa encadena el meteorito una vez y respeta pausa y reinicio. */
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const c=vm.createContext({console,atob});c.window=c;
for(const f of ['visor-three-vendor.js','adreida-scenario/combate.js','arpg-three-adreida-animacion.js','adreida-scenario/datos.js','arpg-three-adreida.js','arpg-three-modelos.js','arpg-three-impactos.js','arpg-three-final-mago.js'])vm.runInContext(fs.readFileSync(new URL(f,import.meta.url),'utf8'),c);
const T=c.CAOZ_THREE.THREE,MOD=c.CAOZ_ARPG_MODELOS.fabrica(T),escena=new T.Scene(),camara=new T.PerspectiveCamera(32,16/9,.5,1200),casas=new T.Group();
const g=new T.BoxGeometry(6,7,5).toNonIndexed();g.translate(5,3.5,-17);const casa=new T.Mesh(g,new T.MeshStandardMaterial());casa.castShadow=true;casas.add(casa);escena.add(casas);
casas.userData.ocultacion={cajas:[new T.Box3().setFromObject(casa)],opacidades:new Float32Array([1])};
const actor={tipo:'adreida',vivo:true,m:MOD.crear('adreida'),pos:new T.Vector3(10,0,10),dir:0,fase:0};escena.add(actor.m.raiz);
const otro={tipo:'mohamed',vivo:true,m:MOD.crear('mohamed'),pos:new T.Vector3(),dir:0,fase:0};escena.add(otro.m.raiz);
const fx=c.CAOZ_ARPG_IMPACTOS.fabrica(T,escena);fx.actualizarMaterial(new T.MeshStandardMaterial());let impactos=0,regresos=0,negro=0;
const cine=c.CAOZ_ARPG_FINAL_MAGO.fabrica(T,MOD,{escena,camara,casas,caminar(h,p,dt,vel=2.65){const d=h.pos.distanceTo(p);h.dir=Math.atan2(p.x-h.pos.x,p.z-h.pos.z);h.pos.lerp(p,Math.min(1,vel*dt/Math.max(.001,d)));h.fase+=vel*dt*2;return d<.04;},impactar(p){impactos++;fx.agujero(p,{radio:8.4,profundidad:3.2,duracion:30});},volver(){regresos++;},interfaz(s){negro=s.negro;}});
assert.equal(cine.recursos,null,'No reserva geometrías hasta entrar');
for(const fps of [30,60,120]){
 camara.position.set(12,16,22);camara.lookAt(actor.pos);const antes=regresos,impactosAntes=impactos;
 assert(cine.iniciar([actor,otro],{puerta:new T.Vector3(10,0,10)}));assert(!cine.iniciar([actor]));const orden=[];
 for(let i=0;i<fps*40&&!cine.estado().terminado;i++){
  const est=cine.estado();if(orden.at(-1)!==est.fase)orden.push(est.fase);
  const fijo=JSON.stringify(est);cine.paso(0);assert.equal(JSON.stringify(cine.estado()),fijo,'La pausa no avanza');cine.paso(1/fps);
  assert(Number.isFinite(camara.position.length()+camara.quaternion.lengthSq()));
  if(cine.estado().fase==='techo'&&cine.estado().t>.1)assert(Math.abs(cine.estado().mago[1]-7.16)<.04,'El mago se apoya sobre el tejado');
  if(cine.estado().pov)assert(!actor.m.mallas[0].visible,'El cuerpo no tapa la primera persona');
 }
 assert.deepEqual(orden,['salida','carrera','desaparece','buscar','techo','cielo','caida','impacto','negro']);
 assert.equal(regresos,antes+1);assert.equal(impactos,impactosAntes+1);assert.equal(negro,1);
 assert.equal(fx.estado().crateres.at(-1).radio,8.4);assert.equal(cine.recursos.fragmentos.count,180);assert.equal(cine.recursos.humo.count,28);
 assert(cine.estado().derrumbe>3);assert.equal(casa.castShadow,false);
 for(let i=0;i<120;i++)cine.paso(1/fps);assert.equal(regresos,antes+1,'No duplica la navegación');
 cine.cancelar();fx.limpiar();assert(!cine.activa);assert.equal(actor.m.raiz.visible,true);assert.equal(otro.m.raiz.visible,true);assert.equal(casa.castShadow,true);assert.equal(camara.fov,32);assert.equal(camara.near,.5);
}
for(const segundos of [0,4,8,13]){const antes=regresos;cine.iniciar([actor,otro]);for(let i=0;i<segundos*60;i++)cine.paso(1/60);assert(cine.finalizar());assert(!cine.finalizar());cine.paso(1);assert.equal(regresos,antes+1,'Omitir navega una sola vez');cine.cancelar();fx.limpiar();}
const n=escena.children.length;
for(let i=0;i<4;i++){cine.iniciar([actor,otro]);cine.cancelar();assert.equal(escena.children.length,n,'Reutiliza los efectos entre revisiones');}
cine.iniciar([otro]);assert.equal(otro.m.raiz.visible,false);cine.cancelar();assert.equal(escena.children.length,n,'El actor de historia prestado se retira');
console.log('✓ Final del mago: nueve planos, pausa, dos jugadores, actor Adreida, cráter de 16,8 m, ruinas, omisión/reinicio y regreso único a 30/60/120 FPS.');
