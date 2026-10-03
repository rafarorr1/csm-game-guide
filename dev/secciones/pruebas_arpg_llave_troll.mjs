/* Última baja, colocación segura y mano que recoge la llave real, sin GPU. */
import assert from 'node:assert/strict';
import fs from 'node:fs';import vm from 'node:vm';import {extraerDeclaracion} from './fuentes.mjs';
const leer=f=>fs.readFileSync(new URL(f,import.meta.url),'utf8'),c=vm.createContext({console,atob});c.window=c;
for(const f of ['visor-three-vendor.js','arpg-three-adreida-animacion.js','adreida-scenario/datos.js','arpg-three-adreida.js','arpg-three-modelos.js','llave-scenario/datos.js','arpg-three-entrada-troll.js'])vm.runInContext(leer(f),c);
const T=c.CAOZ_THREE.THREE,F=c.CAOZ_ARPG_MODELOS.fabrica(T),V=T.Vector3,mesa=leer('arpg-three-mesa.js'),get=n=>extraerDeclaracion(mesa,n).texto;
const llave=c.CAOZ_ARPG_ENTRADA_TROLL.crearLlave(T),meshLlave=llave.children[0];
assert(llave.userData.scenario);assert.equal(llave.children.length,1,'Una sola malla para la llave');
assert.equal(meshLlave.geometry.index.count/3,2360);
const cajaLlave=new T.Box3().setFromObject(llave);assert(Math.abs(cajaLlave.max.y-cajaLlave.min.y-.72)<1e-5);
assert(cajaLlave.min.z>-.06&&cajaLlave.max.z<.06,'El grosor queda por encima del piso al tumbarla');
assert.equal(meshLlave.material.emissive.getHex(),0);
const m=F.crear('adreida'),v=new V(),indices=m.mallas.map(mesh=>mesh.geometry.index?[...new Set(mesh.geometry.index.array)]:Array.from({length:mesh.geometry.attributes.position.count},(_,i)=>i));let suelo=Infinity,manoContacto;
for(let i=0;i<=100;i++){
  const k=i/100;F.posar(m,{anim:'recogerLlave',k,t:k*1.8});m.raiz.updateMatrixWorld(true);
  for(const [j,mesh] of m.mallas.entries())for(const n of indices[j]){mesh.getVertexPosition(n,v);assert(v.toArray().every(Number.isFinite));assert(v.length()<4);suelo=Math.min(suelo,v.y);}
  if(i===46)manoContacto=m.H.manoI.getWorldPosition(new V());
}
assert(suelo>-.02,`La recogida no atraviesa el piso: ${suelo}`);
assert(manoContacto.distanceTo(new V(.32,.17,.58))<.02,'La mano alcanza físicamente la llave');
assert(m.H.manoI.getWorldPosition(new V()).y>1.3,'Levanta la llave para verla');
const arnes=vm.createContext({console,Math,V3:V,TAU:Math.PI*2,COOP:true,ABIERTO:false,R:26,PLANOS_MURALLA:Array.from({length:24},(_,i)=>({x:Math.cos(i*Math.PI/12),z:Math.sin(i*Math.PI/12)})),obstaculos:[{x:-5,z:-3,r:1.3},{x:-2.82,z:-2.51,r:.55},{x:6.5,z:-5.5,r:1.5},{x:-8.3,z:5.5,r:1.1},{x:8.5,z:4.8,r:1}],plano:(a,b)=>Math.hypot(a.x-b.x,a.z-b.z),rumbo:(a,b)=>Math.atan2(b.x-a.x,b.z-a.z),frente:a=>new V(Math.sin(a),0,Math.cos(a)),ol:{auto:true,i:5,cola:[],descanso:3},enemigos:[],llaveEntradaTroll:null,cancelarAtaque(){},limpiarPeligrosTroll(){},cambiar(e,s){e.estado=s;},brasas(){}});
for(const n of ['pasoLibreEnemigo','lugarLlaveTroll','prepararLlaveDelUltimo','morir'])vm.runInContext(get(n),arnes);
for(const modo of ['ultima','otraEtapa','quedanVivos','quedanEnCola','abierto','manual']){
  const e={tipo:'kobold',pos:new V(7,0,-3),estado:'quieto',vida:10,m:{alto:1},sinBotin:true};arnes.enemigos=[e];arnes.llaveEntradaTroll=null;arnes.ol={auto:modo!=='manual',i:modo==='otraEtapa'?4:5,cola:modo==='quedanEnCola'?[['kobold',0]]:[],descanso:3};arnes.ABIERTO=modo==='abierto';
  if(modo==='quedanVivos')arnes.enemigos.push({estado:'persigue'});
  arnes.morir(e);assert.equal(!!arnes.llaveEntradaTroll,modo==='ultima',modo);
  if(modo==='ultima'){assert(arnes.llaveEntradaTroll.equals(e.pos));e.pos.set(20,0,20);arnes.morir(e);assert(arnes.llaveEntradaTroll.equals(new V(7,0,-3)),'Una sola llave desde el punto del golpe letal');assert.equal(arnes.ol.descanso,0);}
}
arnes.ABIERTO=false;let sitios=0;
for(let x=-24;x<=24;x+=3)for(let z=-24;z<=24;z+=3){
  const origen=new V(x,0,z);if(origen.length()>25||!arnes.pasoLibreEnemigo(origen,origen,.4))continue;
  const s=arnes.lugarLlaveTroll(origen),llave=new V(.32,0,.58).applyAxisAngle(new V(0,1,0),s.dir).add(s.centro),fin=s.centro.clone().addScaledVector(arnes.frente(s.dir),5);
  assert(llave.distanceTo(origen)>=2.49&&llave.distanceTo(origen)<=5.01,'La llave cae a pocos metros de la baja');
  assert(arnes.pasoLibreEnemigo(s.centro,fin,.75),'La rodada evita el pozo y la utilería');assert(arnes.pasoLibreEnemigo(s.centro,s.centro,1.4),'Hay espacio para el Troll');
  assert(s.acompanantes.length===1);assert(arnes.PLANOS_MURALLA.every(n=>fin.x*n.x+fin.z*n.z<=26-.75));sitios++;
}
for(const hz of [30,60,120])for(const omitir of [null,0,1.5,3.5,5]){
  const escena=new T.Scene(),h={tipo:'adreida',vivo:true,m:F.crear('adreida'),pos:new V(2,0,4),dir:0,fase:0},troll={pos:new V(),m:F.crear('troll')},centro=new V(3,0,1),dir=.7,eventos=[];let recogidas=0,impactos=0;
  const cine=c.CAOZ_ARPG_ENTRADA_TROLL.fabrica(T,F,{escena,caminar(h,p,dt){const d=h.pos.distanceTo(p);h.pos.lerp(p,Math.min(1,dt*2.65/Math.max(.001,d)));return d<.04;},rotulo(f){eventos.push(f);},recoger(){recogidas++;assert.equal(impactos,0);},impactar(p){impactos++;assert.equal(recogidas,1);assert(p.equals(centro));assert(h.pos.distanceTo(centro)>3);},terminar(){}});
  cine.iniciar([h],troll,{centro,dir,origen:new V()});let t=0;while(cine.activa&&t<20){if(omitir!==null&&t>=omitir)cine.finalizar();else cine.paso(1/hz);t+=1/hz;}
  assert(!cine.activa);assert.equal(recogidas,1);assert.equal(impactos,1);assert(troll.pos.equals(centro));
  const fin=F.animacion.desplazamientoRoll(1,new V()).applyAxisAngle(new V(0,1,0),dir).add(centro);assert(h.pos.distanceTo(fin)<1e-6);
  if(omitir===null)assert.deepEqual(eventos,['botin','caminar','recoger','sombra','esquiva','impacto']);
  assert(escena.children.every(o=>!o.visible));cine.iniciar([h],troll,{centro,dir,origen:new V()});cine.cancelar();assert.equal(recogidas,1,'Cancelar no regala otra llave');
}
console.log(`✓ Llave: última baja real, contacto de la mano, 101 poses con suelo ${suelo.toFixed(3)} m, ${sitios} posiciones seguras, fases en orden, recogida única, omisión y cancelación a 30/60/120 FPS.`);
