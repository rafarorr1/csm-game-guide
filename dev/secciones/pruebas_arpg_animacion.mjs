/* Transiciones del esqueleto real: continuidad, dos manos, impacto y variantes. */
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const c=vm.createContext({console});c.window=c;
for(const f of ['visor-three-vendor.js','arpg-three-adreida-animacion.js','arpg-three-modelos.js'])vm.runInContext(fs.readFileSync(new URL(f,import.meta.url),'utf8'),c);
const {THREE}=c.CAOZ_THREE,M=c.CAOZ_ARPG_MODELOS.fabrica(THREE),m=M.crear('adreida'),exacto=M.crear('adreida');
const cuerpo=h=>Object.fromEntries(Object.entries(h.H).filter(([k])=>k!=='raiz'&&!k.startsWith('falda')).map(([k,b])=>[k,{q:b.quaternion.clone(),p:b.position.clone()}]));
function igual(h,foto,etiqueta){for(const [k,b] of Object.entries(foto)){assert.ok(h.H[k].quaternion.angleTo(b.q)<1e-6,`${etiqueta}: ${k}`);assert.ok(h.H[k].position.distanceTo(b.p)<1e-8,`${etiqueta}: posición ${k}`);}}
function seguro(h){
  h.raiz.updateMatrixWorld(true);
  const apoyo=h.H.manoD.localToWorld(new THREE.Vector3(0,-.3,0)),mano=h.H.manoI.getWorldPosition(new THREE.Vector3());
  assert.ok(apoyo.distanceTo(mano)<.005,'Las dos manos siguen en el mango al mezclar');
  assert.ok(Object.values(h.H).every(b=>b.matrixWorld.elements.every(Number.isFinite)),'Sin matrices inválidas');
  assert.equal(h.mallas.length,3,'No aumenta el número de mallas');
}
let t=0;
const inicial={anim:'andar',estado:'andar',fase:1.8,paso:1,t:0,mezclar:true,dt:0};
M.posar(m,inicial);const foto=cuerpo(m);
M.posar(m,{anim:'tajoA',estado:'carga',k:0,dt:0,t:0,mezclar:true});igual(m,foto,'Entrada sin salto de pose');
const movimientos=[['carga','tajoA',.38,1],['golpe','tajoA',.64,.17],['recuperacion','tajoA',.64,.3],['quieto','quieto',0,.6],['andar','andar',0,.6],['carga','revesA',.38,.4],['parry','parry',1,.42]];
for(const [estado,anim,k,dur] of movimientos)for(let i=1;i<=Math.ceil(dur*120);i++){
  t+=1/120;M.posar(m,{estado,anim,k:estado==='recuperacion'?k:k*i/Math.ceil(dur*120),potencia:1,paso:1,fase:t*6,t,dt:1/120,mezclar:true});seguro(m);
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
console.log('✓ Transiciones continuas, agarre, impacto exacto, recuperación fija, 30/60/120 Hz, independencia y variantes validadas');
