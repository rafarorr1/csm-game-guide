/* Roll real y transición de oleadas sin WebGL ni temporizadores de pared. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const leer=f=>fs.readFileSync(new URL(f,import.meta.url),'utf8');
const c=vm.createContext({console,atob});c.window=c;
for(const f of ['visor-three-vendor.js','arpg-three-adreida-animacion.js','adreida-scenario/datos.js','arpg-three-adreida.js','arpg-three-modelos.js','arpg-three-entrada-troll.js'])vm.runInContext(leer(f),c);
const T=c.CAOZ_THREE.THREE,F=c.CAOZ_ARPG_MODELOS.fabrica(T),V=T.Vector3,m=F.crear('adreida'),v=new V();
assert.equal(F.animacion.roll.duracion,35/30);
assert(Math.abs(F.animacion.desplazamientoRoll(1,v).z-5)<1e-5);
assert(F.animacion.desplazamientoRoll(0,v).length()<1e-5);
let vuelo=0,minimo=Infinity,saltoAngular=0;
const huesos=Object.values(m.H).filter(b=>b.isBone),previos=huesos.map(b=>b.quaternion.clone());
const indices=m.mallas.map(mesh=>mesh.geometry.index?[...new Set(mesh.geometry.index.array)]:Array.from({length:mesh.geometry.attributes.position.count},(_,i)=>i));
for(let i=0;i<=180;i++){
  F.posar(m,{anim:'rodar',k:i/180,t:i/180*F.animacion.roll.duracion,desplazamientoExterno:true});m.raiz.updateMatrixWorld(true);
  let suelo=Infinity;
  for(const [j,mesh] of m.mallas.entries())for(const n of indices[j]){mesh.getVertexPosition(n,v);assert(v.toArray().every(Number.isFinite));assert(v.length()<4);suelo=Math.min(suelo,v.y);}
  minimo=Math.min(minimo,suelo);vuelo=Math.max(vuelo,suelo);assert(suelo>-.025,`Penetración en ${i}: ${suelo}`);
  huesos.forEach((b,j)=>{if(i)saltoAngular=Math.max(saltoAngular,previos[j].angleTo(b.quaternion));previos[j].copy(b.quaternion);});
  assert.equal(m.H.cuerpo.position.z,0,'El movimiento mundial no se duplica dentro del modelo');
}
assert(vuelo>.08,'Conserva la fase aérea del FBX');assert(saltoAngular<.4,'Sin saltos de orientación durante el roll');
const fin=m.H.cadera.quaternion.clone();F.posar(m,{anim:'rodar',k:2});assert(fin.angleTo(m.H.cadera.quaternion)<1e-5,'El clip no se repite');

// La caminata utiliza las mismas rutas que el combate: prueba desde detrás del pozo.
const mesa=leer('arpg-three-mesa.js'),nav=vm.createContext({Math,V3:V,TAU:Math.PI*2,MOD:F,ABIERTO:false,R:15,PLANOS_MURALLA:[{x:1,z:0},{x:-1,z:0},{x:0,z:1},{x:0,z:-1}],obstaculos:[{x:-5,z:-3,r:1.3},{x:-2.82,z:-2.51,r:.55}],presion:{rutas:0},reloj:{t:0},plano:(a,b)=>Math.hypot(a.x-b.x,a.z-b.z),rumbo:(a,b)=>Math.atan2(b.x-a.x,b.z-a.z),difAng:(a,b)=>Math.atan2(Math.sin(b-a),Math.cos(b-a))});
vm.runInContext(mesa.slice(mesa.indexOf('  function pasoLibreEnemigo'),mesa.indexOf('  // Una tirada espaciada')),nav);
vm.runInContext(mesa.slice(mesa.indexOf('  function caminarEntrada'),mesa.indexOf('  cinematicaTroll=window')),nav);
function jugador(tipo='adreida',x=0,z=4){return {tipo,pos:new V(x,0,z),dir:0,fase:0,radio:.4,vivo:true,m:F.crear(tipo)};}
const caminante=jugador('adreida',-8,-4.8);let llego=false;
for(let i=0;i<600&&!llego;i++){nav.presion.rutas=0;nav.reloj.t+=1/60;const antes=caminante.pos.clone();llego=nav.caminarEntrada(caminante,new V(),1/60);assert(nav.pasoLibreEnemigo(antes,caminante.pos,caminante.radio));assert(Number.isFinite(caminante.fase));}
assert(llego,'Rodea el pozo y alcanza el centro');
for(const hz of [30,60,120])for(const modo of ['solo','coop','mohamed'])for(const omitir of [null,0,2,3.6]){
  let impactos=0,inicios=0,distanciaImpacto=null;const escena=new T.Scene(),jugadores=[jugador(modo==='mohamed'?'mohamed':'adreida')];if(modo==='coop')jugadores.push(jugador('mohamed',2,4));
  const troll={pos:new V(),m:F.crear('troll')};const cinematica=c.CAOZ_ARPG_ENTRADA_TROLL.fabrica(T,F,{escena,caminar:nav.caminarEntrada,rotulo(){},impactar(){impactos++;distanciaImpacto=jugadores[0].pos.length();},terminar(t){assert.equal(t,troll);inicios++;}});
  assert(cinematica.iniciar(jugadores,troll));assert(!cinematica.iniciar(jugadores,troll),'No puede duplicar la escena');
  let duracion=0;
  while(cinematica.activa&&duracion<15){
    const antes=JSON.stringify(cinematica.estado());cinematica.paso(0);assert.equal(JSON.stringify(cinematica.estado()),antes,'Un paso sin tiempo no adelanta la escena');
    if(omitir!==null&&duracion>=omitir)cinematica.finalizar();else{nav.presion.rutas=0;nav.reloj.t+=1/hz;cinematica.paso(1/hz);}duracion+=1/hz;
  }
  assert(!cinematica.activa);assert.equal(impactos,1);assert.equal(inicios,1);assert(distanciaImpacto>3,'Está fuera del impacto antes de que caiga el Troll');
  assert(Math.abs(jugadores[0].pos.z-5)<1e-4);assert(troll.m.raiz.visible);assert.equal(troll.m.raiz.position.y,0);assert(!cinematica.finalizar());
  assert.equal(escena.children.filter(o=>o.visible).length,0,'Limpia la sombra al devolver el control');
  if(modo==='coop')assert(jugadores[1].pos.distanceTo(new V(3,0,4.5))<1e-4);
  cinematica.iniciar(jugadores,troll);cinematica.cancelar();assert(!cinematica.activa);assert.equal(inicios,1,'Reiniciar no inicia una batalla residual');
}
// Ejecuta la lógica real de oleadas: sólo fase 2 → 3; conserva refuerzos y escalado cooperativo.
for(const factor of [1,2]){
  const entorno={ABIERTO:false,FACTOR_COOP:factor,CAPTURA:false,q:new URLSearchParams('etapa=2'),Math,reloj:{t:0},rnd:()=>.3,refuerzosCan:[],peligrosTroll:[],enemigos:[],jugadores:[{vivo:true}],rog:{cartas:[],terminado:-1},DEF:{troll:{jefe:true},cobrador:{},kobold:{}},banner(){},iniciarDestino(){},casaGoblin:null,finalMago:null,cinematicaTroll:{activa:false},entradas:0};
  // Las funciones invocadas sin receptor necesitan un cierre explícito, como en la partida.
  entorno.iniciarEntradaTroll=()=>{const i=entorno.ol.cola.findIndex(([t])=>t==='troll');entorno.ol.cola.splice(i,1);entorno.entradas++;entorno.cinematicaTroll.activa=true;};
  vm.createContext(entorno);vm.runInContext(mesa.slice(mesa.indexOf('  const OLEADAS='),mesa.indexOf('  function reiniciar(){'))+';this.ol=ol;this.avanzar=pasoOleadas;',entorno);
  Object.assign(entorno.ol,{i:5,descanso:0});entorno.avanzar(1/60);assert.equal(entorno.entradas,1);assert.equal(entorno.ol.i,6);assert.equal(entorno.ol.cola.filter(([t])=>t==='troll').length,factor-1);assert.equal(entorno.ol.cola.filter(([t])=>t==='cobrador').length,6*factor);
  for(let i=0;i<20;i++)entorno.avanzar(1/60);assert.equal(entorno.entradas,1);
}
console.log(`✓ Roll: 181 poses, suelo mínimo ${minimo.toFixed(3)} m, vuelo ${vuelo.toFixed(3)} m, continuidad ${saltoAngular.toFixed(3)} rad; rutas, 36 escenas, pausa, omitir, reinicio, cooperativo y transición real de oleadas.`);
