/* Transiciones del esqueleto real: continuidad, dos manos, impacto y variantes. */
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const c=vm.createContext({console,atob});c.window=c;
for(const f of ['visor-three-vendor.js','arpg-three-adreida-animacion.js','adreida-scenario/datos.js','arpg-three-adreida.js','arpg-three-modelos.js'])vm.runInContext(fs.readFileSync(new URL(f,import.meta.url),'utf8'),c);
const {THREE}=c.CAOZ_THREE,M=c.CAOZ_ARPG_MODELOS.fabrica(THREE),m=M.crear('adreida'),exacto=M.crear('adreida');
const cuerpo=h=>Object.fromEntries(Object.entries(h.H).filter(([k])=>k!=='raiz'&&!k.startsWith('falda')).map(([k,b])=>[k,{q:b.quaternion.clone(),p:b.position.clone()}]));
function igual(h,foto,etiqueta){for(const [k,b] of Object.entries(foto)){assert.ok(h.H[k].quaternion.angleTo(b.q)<1e-6,`${etiqueta}: ${k}`);assert.ok(h.H[k].position.distanceTo(b.p)<1e-8,`${etiqueta}: posición ${k}`);}}
function seguro(h,dosManos=false){
  h.raiz.updateMatrixWorld(true);
  const apoyo=h.H.manoD.localToWorld(new THREE.Vector3(0,-.3,0)),mano=h.H.manoI.getWorldPosition(new THREE.Vector3());
  if(dosManos)assert.ok(apoyo.distanceTo(mano)<.005,'Las dos manos llegan al mango antes del impacto');
  assert.ok(Object.values(h.H).every(b=>b.matrixWorld.elements.every(Number.isFinite)),'Sin matrices inválidas');
  assert.equal(h.mallas.length,4,'Cuerpo Scenario y tres materiales del hacha');
}
let t=0;
const inicial={anim:'andar',estado:'andar',fase:1.8,paso:1,t:0,mezclar:true,dt:0};
M.posar(m,inicial);const foto=cuerpo(m);
M.posar(m,{anim:'tajoA',estado:'carga',k:0,dt:0,t:0,mezclar:true});igual(m,foto,'Entrada sin salto de pose');
const movimientos=[['carga','tajoA',.38,1],['golpe','tajoA',.64,.17],['recuperacion','tajoA',.64,.3],['quieto','quieto',0,.6],['andar','andar',0,.6],['carga','revesA',.38,.4],['parry','parry',1,.42]];
for(const [estado,anim,k,dur] of movimientos)for(let i=1;i<=Math.ceil(dur*120);i++){
  const avance=estado==='recuperacion'?k:k*i/Math.ceil(dur*120);
  t+=1/120;M.posar(m,{estado,anim,k:avance,potencia:1,paso:1,fase:t*6,t,dt:1/120,mezclar:true});seguro(m,estado==='recuperacion'||estado==='golpe'&&avance>=.38||estado==='parry'&&i/120>=.04);
}
// La pose de impacto coincide con la versión exacta aunque el usuario alargue las transiciones.
M.animacion.configurar({version:1,personaje:'adreida',ajustes:{caminar:.3,carga:.18,regreso:.4,zancada:1}});
M.posar(m,inicial);
const impacto={anim:'tajoA',estado:'golpe',k:.5,t:2,potencia:1,dt:1/120,mezclar:true};
M.posar(m,impacto);M.posar(exacto,{...impacto,mezclar:false});igual(m,cuerpo(exacto),'Impacto sincronizado');
// La recuperación no introduce oscilación en cuerpo ni hacha.
M.posar(m,{...impacto,estado:'recuperacion',k:.64});const reposoFinal=cuerpo(m);
for(let i=0;i<36;i++)M.posar(m,{...impacto,estado:'recuperacion',k:.64,t:3+i/120});
igual(m,reposoFinal,'Cansancio inmóvil');
// Misma transición y misma pose a los 0,1 s, independientemente de la frecuencia de pantalla.
M.animacion.restablecer();
function frecuencia(hz){const h=M.crear('adreida');M.posar(h,{...impacto,estado:'recuperacion',k:.64});for(let i=1;i<=hz/10;i++)M.posar(h,{anim:'quieto',estado:'quieto',t:4,dt:1/hz,mezclar:true});return h;}
const h30=frecuencia(30),h60=frecuencia(60),h120=frecuencia(120);igual(h60,cuerpo(h30),'30/60 Hz');igual(h120,cuerpo(h30),'30/120 Hz');
// Cada personaje guarda su propia transición, también en cooperativo o con Adreidos.
const a=M.crear('adreida'),b=M.crear('adreida');M.posar(a,inicial);M.posar(b,impacto);const antes=cuerpo(b);M.posar(a,{...impacto,t:9});igual(b,antes,'Estados independientes');
// La vista exacta no hereda una transición anterior.
M.posar(a,{...inicial,mezclar:false});M.posar(exacto,{...inicial,mezclar:false});igual(a,cuerpo(exacto),'Fase exacta del inspector');
const original=JSON.stringify(M.animacion.configuracion()),p=M.animacion.configuracion();p.ajustes.carga=.15;
assert.notEqual(JSON.stringify(p),original,'La lectura devuelve una copia');M.animacion.configurar(JSON.parse(JSON.stringify(p)));assert.equal(M.animacion.configuracion().ajustes.carga,.15);
const valido=JSON.stringify(M.animacion.configuracion());
for(const malo of [{...p,version:9},{...p,personaje:'mohamed'},{...p,ajustes:{...p.ajustes,carga:99}},{...p,ajustes:{...p.ajustes,carga:NaN}},{...p,ajustes:{...p.ajustes,extra:1}},{...p,ajustes:{}}]){
  assert.throws(()=>M.animacion.configurar(malo));assert.equal(JSON.stringify(M.animacion.configuracion()),valido,'Importación atómica');
}
M.animacion.restablecer();assert.equal(JSON.stringify(M.animacion.configuracion()),original);
// Regresión del torso inmóvil: medir el pecho en el espacio del personaje,
// porque dos giros locales pueden cancelarse al heredar la rotación de la cadera.
const euler=new THREE.Euler(),orientacion=new THREE.Quaternion(),muestras=[];
for(let i=0;i<120;i++){
 M.posar(m,{anim:'andar',fase:i/120*Math.PI*2,paso:1,t:i/120});m.raiz.updateMatrixWorld(true);seguro(m);
 const giro=nombre=>euler.setFromQuaternion(m.H[nombre].getWorldQuaternion(orientacion)).y;
 muestras.push({pecho:giro('torso'),cadera:giro('cadera'),cabeza:giro('cabeza')});
}
const rango=nombre=>Math.max(...muestras.map(p=>p[nombre]))-Math.min(...muestras.map(p=>p[nombre]));
assert.ok(rango('pecho')>.45&&rango('pecho')<.85,'El pecho participa sin exagerar el giro');
assert.ok(rango('cadera')>.15,'La cintura contrapesa el movimiento');
assert.ok(rango('cabeza')<rango('pecho')*.3,'La cabeza estabiliza la mirada');
for(const paso of [.3,1]){
 M.posar(m,{anim:'andar',fase:Math.PI*2-1e-5,paso});const antes=cuerpo(m);
 M.posar(m,{anim:'andar',fase:0,paso});
 for(const n of ['torso','cadera','cabeza','manoI','manoD'])assert.ok(m.H[n].quaternion.angleTo(antes[n].q)<.001,'Movimiento corporal continuo: '+n);
}
console.log('✓ Carrera de acción: pecho visible, contragiro de cadera, mirada estable y ciclo continuo');
// La mano libre se incorpora al mango sin saltar al cambiar de estado y alcanza
// el agarre completo antes de que pueda producirse el impacto o el parry.
for(const fase of [0,1.6,3.2,4.8])for(const destino of ['quieto','carga','parry']){
 const h=M.crear('adreida'),andar={anim:'andar',estado:'andar',fase,paso:1,mezclar:true,t:1,dt:0};
 M.posar(h,andar);const partida=cuerpo(h),anim=destino==='carga'?'tajoA':destino;
 M.posar(h,{anim,estado:destino,k:0,mezclar:true,t:1,dt:0});igual(h,partida,'Soltar y sujetar sin salto: '+destino);
 for(let i=1;i<=24;i++)M.posar(h,{anim,estado:destino,k:destino==='carga'?.38:destino==='parry'?.5:0,mezclar:true,t:1+i/120,dt:1/120});
 seguro(h,true);
 const guardia=cuerpo(h);M.posar(h,{...andar,t:1.2});igual(h,guardia,'Volver a carrera sin salto: '+destino);
}
console.log('✓ Carrera a una mano: transiciones continuas a reposo, carga y parry');
console.log('✓ Transiciones continuas, agarre, impacto exacto, recuperación fija, 30/60/120 Hz, independencia y variantes validadas');

// Regresión del tirón al recoger el hacha: la dirección del mango y el plano del codo
// no deben invertir la muñeca en un cuadro al pasar cerca del hombro izquierdo.
M.animacion.restablecer();
for(const anim of ['tajoA','revesA','estocadaA'])for(const potencia of [0,1]){
 const dur=anim==='estocadaA'?.8:.6,poses=[];
 for(let i=0;i<Math.ceil(dur*60);i++){const k=i/(dur*60);if(potencia&&k>=.64)break;poses.push({anim,estado:'golpe',k,potencia});}
 if(potencia)for(let i=0;i<18;i++)poses.push({anim,estado:'recuperacion',k:.64,potencia});
 for(let i=0;i<25;i++)poses.push({anim:'quieto',estado:'quieto'});
 let anterior=null;
 for(const [i,pose] of poses.entries()){
  M.posar(m,{...pose,t:i/60,dt:1/60,mezclar:true});seguro(m,pose.estado==='recuperacion'||pose.estado==='golpe'&&pose.k>=.38);
  if(anterior&&(pose.k>=.66||pose.estado==='quieto'))for(const nombre of ['brazoI','anteI','manoI','brazoD','anteD','manoD']){
   assert.ok(m.H[nombre].quaternion.angleTo(anterior[nombre].q)<1,`Recogida continua: ${anim}, carga ${potencia}, cuadro ${i}, ${nombre}`);
  }
  anterior=cuerpo(m);
 }
}
console.log('✓ Los tres hachazos, normales y cargados, recogen el hacha sin invertir codos ni muñecas');
// Los enemigos no saltan de la última pose de recuperación a la guardia en un cuadro.
for(const tipo of ['goblin','cobrador','kobold','saqueador','can','troll','mohamed']){
 const h=M.crear(tipo),objetivo=M.crear(tipo),anim=tipo==='kobold'?'lanzar':tipo==='troll'?'mazazo':'golpe';
 const anterior={anim,k:.99,estado:'recupera',t:4,dt:1/60,mezclar:true};
 if(tipo==='mohamed')Object.assign(anterior,{anim:'quieto',estado:'quieto',armaLista:true,retroceso:0});
 M.posar(h,anterior);const f=cuerpo(h),quieto={anim:'quieto',estado:tipo==='mohamed'?'quieto':'persigue',t:4,dt:0,mezclar:true};
 M.posar(h,quieto);igual(h,f,tipo+': salida continua con dt=0');
 for(let i=0;i<15;i++)M.posar(h,{...quieto,dt:1/60});M.posar(objetivo,{...quieto,mezclar:false});igual(h,cuerpo(objetivo),tipo+': termina en guardia');
 // Volver a preparar un ataque no hereda una mezcla ni retrasa la pose de impacto.
 M.posar(h,anterior);M.posar(objetivo,{...anterior,mezclar:false});igual(h,cuerpo(objetivo),tipo+': ataque sin retraso');
 for(const modelo of [h,objetivo])for(const mesh of modelo.mallas){mesh.geometry.dispose();mesh.material.dispose();}
}
console.log('✓ Goblins, lanceros, escudos, jefes y Mohamed vuelven a guardia sin saltos de pose');
