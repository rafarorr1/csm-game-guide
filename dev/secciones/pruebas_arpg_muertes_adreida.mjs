/* Pruebas de los clips reales sobre la piel y el hacha actuales, sin navegador. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const c=vm.createContext({console,atob});c.window=c;
for(const f of ['visor-three-vendor.js','arpg-three-adreida-animacion.js','adreida-scenario/datos.js','arpg-three-adreida.js','arpg-three-modelos.js'])vm.runInContext(fs.readFileSync(new URL(f,import.meta.url),'utf8'),c);
const T=c.CAOZ_THREE.THREE,F=c.CAOZ_ARPG_MODELOS.fabrica(T),m=F.crear('adreida'),v=new T.Vector3();
const originales=m.mallas.map(mesh=>mesh.geometry),indices=m.mallas.map(mesh=>mesh.geometry.index?[...new Set(mesh.geometry.index.array)]:Array.from({length:mesh.geometry.attributes.position.count},(_,i)=>i));
const pose=()=>Object.entries(m.H).filter(([k])=>k!=='raiz').flatMap(([,b])=>[...b.position.toArray(),...b.quaternion.toArray()]);
function limites(){
  m.raiz.updateMatrixWorld(true);const cuerpos=[];
  for(const [j,mesh] of m.mallas.entries()){
    let min=Infinity,max=-Infinity;
    for(const i of indices[j]){mesh.getVertexPosition(i,v);assert(v.toArray().every(Number.isFinite));assert(v.length()<4,'Vértice fuera del cuerpo');min=Math.min(min,v.y);max=Math.max(max,v.y);}
    cuerpos.push({min,max});
  }
  return cuerpos;
}
assert.equal(F.animacion.muertes.length,2);
assert.deepEqual(Array.from(F.animacion.muertes,p=>p.duracion),[2.4,2.6]);
const reparto=[0,0];for(let i=0;i<1000;i++)reparto[F.animacion.elegirMuerte(()=>i/1000).variante]++;
assert.deepEqual(reparto,[500,500]);
const finales=[];let minimo=Infinity,maxSeparacion=0;
for(const variante of [0,1]){
  const muerte=F.animacion.elegirMuerte(()=>variante*.5),dur=muerte.duracion;
  for(let i=0;i<=180;i++){
    F.posar(m,{anim:'muerte',muerte,k:i/180,t:i*dur/180,paso:1});
    const b=limites(),suelo=Math.min(...b.map(p=>p.min));minimo=Math.min(minimo,suelo);maxSeparacion=Math.max(maxSeparacion,suelo);
    assert(suelo>-.02,`Penetración del piso: variante ${variante}, fase ${i/180}, y=${suelo}`);
    assert(suelo<.035,`Sin apoyo: variante ${variante}, fase ${i/180}, y=${suelo}`);
    assert(b[0].min<.075,`El arma levanta el cuerpo: variante ${variante}, fase ${i/180}, y=${b[0].min}`);
  }
  const b=limites();assert(b[0].min<.075,'El arma no debe levantar el cuerpo al terminar');assert(b[0].max<.85,'Adreida debe terminar tumbada');
  const final=pose();finales.push(final);
  for(const t of [dur+1,10,30]){F.posar(m,{anim:'muerte',muerte,k:t/dur,t,paso:1});assert.deepEqual(pose(),final,'La pose final no se repite ni respira');}
  // Cambiar ubicación y rumbo del personaje no altera su pose local.
  m.raiz.position.set(8,0,-9);m.raiz.rotation.y=2.1;F.posar(m,{anim:'muerte',muerte,k:1});assert.deepEqual(pose(),final);
  m.raiz.position.set(0,0,0);m.raiz.rotation.y=0;
  for(const hz of [30,60,120]){
    F.posar(m,{anim:'andar',estado:'andar',fase:1,paso:1,mezclar:true,dt:1/hz});
    for(let i=1;i<=Math.ceil(dur*hz);i++)F.posar(m,{anim:'muerte',estado:'muerta',muerte,k:i/hz/dur,t:i/hz,dt:1/hz,mezclar:true});
    assert.deepEqual(pose(),final,'Misma pose final con cualquier frecuencia');
    for(let i=0;i<30;i++)F.posar(m,{anim:'quieto',estado:'quieto',t:0,dt:1/hz,mezclar:true});
    assert(Math.abs(m.H.cuerpo.position.z)<1e-6,'Revivir elimina el desplazamiento de la caída');
  }
}
assert(finales[0].some((v,i)=>Math.abs(v-finales[1][i])>.5),'Las dos caídas deben ser distintas');
assert.equal(m.mallas.length,4);assert(m.mallas.every((mesh,i)=>mesh.geometry===originales[i]),'No crea mallas ni geometrías por cuadro');
// El punto de daño real elige una sola variante; los cuadros sólo la reproducen.
const mesa=fs.readFileSync(new URL('arpg-three-mesa.js',import.meta.url),'utf8');
const herir=mesa.slice(mesa.indexOf('  function herir('),mesa.indexOf('  // Quemadura personal'));
let elecciones=0,semilla=.2;
const entorno={Math,numero(){},temblar(){},reloj:{t:0},rnd:()=>semilla,MOD:{animacion:{elegirMuerte(azar){elecciones++;return F.animacion.elegirMuerte(azar);}}},cambiar(h,s){h.estado=s;h.t=0;}};
vm.createContext(entorno);vm.runInContext(herir+';this.danar=herir;',entorno);
for(const variante of [0,1]){
  semilla=variante*.5;entorno.heroe={tipo:'adreida',vivo:true,alma:10,furia:0,pos:new T.Vector3(),alto:1,muerteT:9};
  entorno.danar(20,new T.Vector3());const muerto=entorno.heroe;
  assert.equal(muerto.muerte.variante,variante);assert.equal(muerto.muerteT,0);assert.equal(muerto.alto,0);assert.equal(muerto.estado,'muerta');
  const seleccion=muerto.muerte;entorno.danar(20,new T.Vector3());assert.equal(muerto.muerte,seleccion);
}
assert.equal(elecciones,2,'Cada muerte sortea sólo una vez');
console.log(`✓ Dos caídas: reparto 50/50, daño real, 362 poses, suelo ${minimo.toFixed(4)}…${maxSeparacion.toFixed(4)} m, final inmóvil, reinicio y 30/60/120 FPS.`);
