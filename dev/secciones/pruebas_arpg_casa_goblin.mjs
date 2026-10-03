/* Epílogo: llave, dos decisiones, mando, pausa y cierre del último Troll, sin GPU. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {extraerDeclaracion} from './fuentes.mjs';
const leer=f=>fs.readFileSync(new URL(f,import.meta.url),'utf8');
const c=vm.createContext({console,atob});c.window=c;
for(const f of ['visor-three-vendor.js','arpg-three-adreida-animacion.js','goblin-scenario/datos.js','arpg-three-goblin.js','adreida-scenario/datos.js','arpg-three-adreida.js','arpg-three-modelos.js','casa-goblin-scenario/datos.js','arpg-three-casa-interior.js','arpg-three-casa-goblin.js'])vm.runInContext(leer(f),c);
const T=c.CAOZ_THREE.THREE,MOD=c.CAOZ_ARPG_MODELOS.fabrica(T),materiales=Object.fromEntries(['tablas','madera','piedra','yeso'].map(k=>[k,new T.MeshStandardMaterial()]));
const plaza=new T.Scene(),casa=new T.Group();casa.position.set(12,0,-5);casa.rotation.y=.6;casa.userData.puerta={x:-1,z:2};plaza.add(casa);
let llaves=0,consumos=0,limpiezas=0,regresos=0;
const epilogo=c.CAOZ_ARPG_CASA_GOBLIN.fabrica(T,MOD,{plaza,casa,materiales,
  caminar(h,p,dt){const d=h.pos.distanceTo(p);h.pos.lerp(p,Math.min(1,dt*3/Math.max(.001,d)));return d<.04;},
  consumirLlave(){if(!llaves)return false;llaves--;consumos++;return true;},limpiar(){limpiezas++;},volver(){regresos++;},interfaz(){}});
const h={vivo:true,pos:new T.Vector3(),dir:0,fase:0,m:MOD.crear('adreida')};
const avanzar=(seg,hz=60)=>{for(let i=0;i<Math.ceil(seg*hz);i++)epilogo.paso(1/hz);};
const pad=(...pulsados)=>({buttons:Array.from({length:17},(_,i)=>({pressed:pulsados.includes(i),value:pulsados.includes(i)?1:0}))});
assert(!epilogo.solicitar(h),'No permite entrar antes de vencer al jefe');
assert(epilogo.habilitar());assert(!epilogo.habilitar(),'Habilitar es idempotente');
h.pos.fromArray(epilogo.estado().puerta);assert.equal(epilogo.cerca([h]),h);
assert(epilogo.solicitar(h));avanzar(1);assert.equal(epilogo.estado().fase,'plaza','Sin llave permanece cerrada');
for(const hz of [30,60,120])for(const atacar of [false,true]){
  epilogo.cancelar();assert(!epilogo.activa);llaves=1;const antes=regresos,consumosAntes=consumos;epilogo.habilitar();h.pos.fromArray(epilogo.estado().puerta).add(new T.Vector3(0,0,1));
  assert(epilogo.solicitar(h));const congelado=JSON.stringify(epilogo.estado());epilogo.paso(0);assert.equal(JSON.stringify(epilogo.estado()),congelado);
  avanzar(5,hz);assert.equal(epilogo.estado().fase,'decision');assert.equal(epilogo.estado().vivos,2);assert.equal(consumos,consumosAntes+1);assert.equal(llaves,0);
  assert(!epilogo.solicitar(h));assert.equal(epilogo.escena.children.filter(o=>/goblin/.test(o.name)).length,2);
  epilogo.mando(pad(2));assert.equal(epilogo.estado().fase,'decision','Una pulsación arrastrada de fuera no golpea');epilogo.mando(pad());
  if(atacar){
    epilogo.mando(pad(7));assert.equal(epilogo.estado().fase,'golpe');assert(!epilogo.golpear());assert(!epilogo.salir(),'El golpe termina antes de salir');
    avanzar(.5,hz);assert.equal(epilogo.estado().vivos,0,'El mismo golpe derrota a ambos');avanzar(3,hz);assert.equal(epilogo.estado().fase,'despues');assert(!epilogo.golpear());
    for(const n of epilogo.escena.children.filter(o=>/goblin/.test(o.name))){n.updateMatrixWorld(true);const b=new T.Box3().setFromObject(n);assert(b.min.y>-.3&&b.min.y<.1,`El cuerpo termina apoyado: ${b.min.y}`);}
  }
  epilogo.mando(pad());epilogo.mando(pad(0));assert.equal(epilogo.estado().fase,'salir');avanzar(5,hz);assert.equal(regresos,antes+1);assert.equal(epilogo.estado().fase,'fin');avanzar(1,hz);assert.equal(regresos,antes+1,'Vuelve una sola vez');
  assert.equal(epilogo.estado().vivos,atacar?0:2);
}
assert.equal(limpiezas,consumos);
// La superficie visible debe apoyar los pies a lo largo del recorrido, sin muebles en medio.
const decorado=epilogo.escena.getObjectByName('Interior · Scenario'),entorno=decorado.getObjectByName('Decorado de la casa');
epilogo.escena.updateMatrixWorld(true);const rayo=new T.Raycaster();
for(let z=-3;z<=3.25;z+=.25){
  const k=Math.max(0,Math.min(1,(z+.65)/3.9)),x=-.6*k*k*(3-2*k);
  rayo.set(new T.Vector3(x,1.8,z),new T.Vector3(0,-1,0));const hit=rayo.intersectObject(entorno)[0];
  assert(hit&&Math.abs(hit.point.y)<.08,`Paso despejado y apoyado en ${x}, ${z}: ${hit?.point.y}`);
}
assert.equal(epilogo.estado().decorado.retratos,2);assert(epilogo.estado().decorado.triangulos<=32100);
for(const nombre of ['foto-familia.webp','foto-comida.webp']){
  const foto=decorado.getObjectByName(nombre),p=foto.position;
  rayo.set(new T.Vector3(p.x,p.y,3),new T.Vector3(0,0,-1));const pared=rayo.intersectObject(entorno)[0];
  assert(pared&&pared.point.z<p.z-.01,`El retrato ${nombre} queda delante de la pared`);
}

// Ejecuta la condición real de cierre de etapa, incluidas las dos copias del jefe en cooperativo.
const mesa=leer('arpg-three-mesa.js');let habilitadas=0,huidas=0;
const a=vm.createContext({ABIERTO:false,ol:{i:6,cola:[],lote:1,descanso:2,fin:true},enemigos:[],refuerzosCan:[{}],casaGoblin:{habilitar(){habilitadas++;}},limpiarCombateCasa(){},asustarGoblins(e,todos){assert(todos);huidas++;},banner(){}});
vm.runInContext(extraerDeclaracion(mesa,'cerrarEtapaTroll').texto,a);
const troll={tipo:'troll',estado:'muere'};a.enemigos=[troll,{tipo:'troll',estado:'persigue'}];assert(!a.cerrarEtapaTroll(troll));
a.enemigos=[troll];a.ol.cola=[['troll',0]];assert(!a.cerrarEtapaTroll(troll));a.ol.cola=[];a.ABIERTO=true;assert(!a.cerrarEtapaTroll(troll));a.ABIERTO=false;a.ol.i=5;assert(!a.cerrarEtapaTroll(troll));a.ol.i=6;
assert(a.cerrarEtapaTroll(troll));assert.equal(habilitadas,1);assert.equal(huidas,1);assert.equal(a.ol.cola.length,0);assert.equal(a.refuerzosCan.length,0);assert.equal(a.ol.fin,false);assert.equal(a.ol.descanso,null);
// Relámpagos localizados: sin mallas ni luces nuevas por cuadro, y sin avanzar en pausa.
for(const reducido of [false,true]){
  const casa=c.CAOZ_ARPG_CASA_INTERIOR.crear(T,{reducido}),cantidad=casa.raiz.children.length;
  for(let i=0;i<6*60;i++)casa.paso(1/60);casa.paso(.17);const luz=casa.raiz.getObjectByName('Luz del relámpago');
  assert(casa.estado().relampagos>=1);assert(casa.estado().destello>0);assert(luz.intensity>0&&luz.intensity<=8);
  assert.equal(casa.raiz.getObjectByName('Relámpago exterior').visible,!reducido);
  const detenido=JSON.stringify(casa.estado());casa.paso(0);assert.equal(JSON.stringify(casa.estado()),detenido);
  for(let i=0;i<120;i++)casa.paso(1/60);assert.equal(luz.intensity,0);assert.equal(casa.raiz.children.length,cantidad);
  casa.reiniciar();assert.equal(casa.estado().relampagos,0);assert.equal(luz.intensity,0);
}
assert.equal(epilogo.escena.children.filter(o=>o.isLight&&o.castShadow).length,1,'Sólo un mapa de sombras en la habitación');
console.log('✓ Casa: llave obligatoria, dos decisiones, un golpe para ambos, cuerpos apoyados, mando sin pulsaciones heredadas, pausa, reinicio y regreso único a 30/60/120 FPS; espera al último Troll.');
