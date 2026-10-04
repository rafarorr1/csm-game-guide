/* Contacto de la piel con el mango y filo orientado en la trayectoria del golpe. */
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const c=vm.createContext({console,atob});c.window=c;
for(const f of ['visor-three-vendor.js','adreida-scenario/combate.js','arpg-three-adreida-animacion.js','adreida-scenario/datos.js','adreida-brazos-scenario/datos.js','arpg-three-adreida.js','hacha-adreida-scenario/datos.js','arpg-three-hacha-adreida.js','arpg-three-modelos.js'])vm.runInContext(fs.readFileSync(new URL(f,import.meta.url),'utf8'),c,{filename:f});
const T=c.CAOZ_THREE.THREE,F=c.CAOZ_ARPG_MODELOS.fabrica(T),m=F.crear('adreida'),mesh=m.mallas[0],at=mesh.geometry.attributes;
const posar=a=>{F.posar(m,a);m.raiz.updateMatrixWorld(true);};
const centro=a=>{posar(a);return m.H.manoD.localToWorld(new T.Vector3(0,-1.05,0));};
let alineacionMin=1,radioMin=Infinity;
for(const potencia of [0,.001,.5,1])for(const [anim,k] of [['tajoA',.5],['revesA',.5],['estocadaA',.39/.8],['salto',.86]]){
  const v=centro({anim,k:k+.0005,potencia}).sub(centro({anim,k:k-.0005,potencia}));posar({anim,k,potencia});
  v.applyQuaternion(m.H.manoD.getWorldQuaternion(new T.Quaternion()).invert());v.y=0;v.normalize();
  alineacionMin=Math.min(alineacionMin,Math.abs(v.z));
  assert(Math.abs(v.z)>.99,`${anim}, carga ${potencia}: la trayectoria presenta el filo, no la cara plana (${Math.abs(v.z)})`);
}
// En el torbellino gira la raíz completa; el filo debe seguir la tangente del círculo.
m.raiz.rotation.y=.001;const gira=centro({anim:'torbellino'});
m.raiz.rotation.y=-.001;gira.sub(centro({anim:'torbellino'}));m.raiz.rotation.y=0;posar({anim:'torbellino'});
gira.applyQuaternion(m.H.manoD.getWorldQuaternion(new T.Quaternion()).invert());gira.y=0;gira.normalize();
assert(Math.abs(gira.z)>.98,'El torbellino corta con el filo durante el giro completo');
// La comprobación es sobre la piel deformada, no sólo sobre el origen de la mano.
for(const lado of ['I','D']){
 const mano=m.H['mano'+lado],bones=mesh.skeleton.bones,vertices=[];
 for(let i=0;i<at.position.count;i++){let peso=0;for(let j=0;j<4;j++){const b=bones[at.skinIndex.array[i*4+j]];if(b===mano||b.name.startsWith('dedo'+lado))peso+=at.skinWeight.array[i*4+j];}if(peso>.999)vertices.push(i);}
 assert(vertices.length>1400);
 for(const anim of ['quieto','tajoA','revesA','estocadaA','parry','salto','torbellino']){
  posar({anim,k:anim==='salto'?.86:.5});const inversa=mano.matrixWorld.clone().invert();let cerca=0;
  for(const i of vertices){const p=mesh.getVertexPosition(i,new T.Vector3()).applyMatrix4(mesh.matrixWorld).applyMatrix4(inversa),radio=Math.hypot(p.x,p.z);radioMin=Math.min(radioMin,radio);if(radio<.032)cerca++;assert(radio>.021,`${anim}: la piel de ${lado} atraviesa el mango (${radio})`);}
  assert(cerca>40,`${anim}: la mano ${lado} mantiene contacto con el mango`);
 }
 // Cada yema participa en el agarre; el meñique más corto no usa el cierre del índice.
 for(const dedo of ['Pulgar','Indice','Medio','Anular','Menique']){
  const id=bones.indexOf(m.H['dedo'+lado+dedo+'1']),inv=mano.matrixWorld.clone().invert();let cerca=Infinity;
  for(const i of vertices)for(let j=0;j<4;j++)if(at.skinIndex.array[i*4+j]===id&&at.skinWeight.array[i*4+j]>.9){const p=mesh.getVertexPosition(i,new T.Vector3()).applyMatrix4(mesh.matrixWorld).applyMatrix4(inv);cerca=Math.min(cerca,Math.hypot(p.x,p.z));}
  assert(cerca<.042,`${lado} ${dedo}: yema demasiado lejos (${cerca})`);
 }
}
// El giro del arma no puede producir un salto de orientación al terminar el ataque.
for(const fps of [30,60,144])for(const anim of ['tajoA','revesA','estocadaA']){
 const h=F.crear('adreida');let ultima;
 for(let i=0;i<=fps*1.4;i++){
  const t=i/fps,ataca=t<.6;F.posar(h,{anim:ataca?anim:'quieto',estado:ataca?'golpe':'quieto',k:ataca?t/.6:0,t,dt:1/fps,mezclar:true});h.raiz.updateMatrixWorld(true);
  const q=h.H.manoD.getWorldQuaternion(new T.Quaternion());if(ultima&&t>=.6)assert(q.angleTo(ultima)<1.0,`${anim} a ${fps} fps, t ${t}: salto de muñeca ${q.angleTo(ultima)}`);ultima=q;
 }
}
assert.equal(m.mallas.length,2,'Se mantienen dos llamadas de dibujo');
console.log(`✓ Filo en 16 impactos (mínimo ${(alineacionMin*100).toFixed(2)}%), piel fuera del mango (mínimo ${(radioMin*100).toFixed(2)} cm), diez yemas y transiciones a 30/60/144 fps.`);
