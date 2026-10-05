/* Salto real de Adreida compartido por POV, cuerpo y recuperación del epílogo. */
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const c=vm.createContext({console,atob});c.window=c;
for(const f of ['visor-three-vendor.js','adreida-scenario/combate.js','arpg-three-adreida-animacion.js','adreida-scenario/datos.js','adreida-piernas-scenario/datos.js','arpg-three-adreida.js','hacha-adreida-scenario/datos.js','arpg-three-hacha-adreida.js','arpg-three-modelos.js','adreida-scenario/cinematica.js','arpg-three-adreida-cine.js'])vm.runInContext(fs.readFileSync(new URL(f,import.meta.url),'utf8'),c,{filename:f});
const T=c.CAOZ_THREE.THREE,F=c.CAOZ_ARPG_MODELOS.fabrica(T),A=c.CAOZ_ARPG_ADREIDA_CINE.fabrica(T,F),m=F.crear('adreida'),original=F.crear('adreida'),fps=A.crearFPS(),v=new T.Vector3(),R=A.tiemposSalto;
assert.equal(R.duracion,1.94);assert.equal(R.ataque+R.recuperacion,R.duracion);assert.equal(R.impacto,.946);
const raiz=m.raiz.position.clone(),rotacion=m.raiz.quaternion.clone(),geometrias=m.mallas.map(mesh=>({geo:mesh.geometry,pos:mesh.geometry.attributes.position.array.slice(),idx:mesh.geometry.index.array.slice()}));
let suelo=Infinity,agarre=0,vuelo=0;const poses=new Map();
for(let i=0;i<=240;i++){
 const t=R.duracion*i/240,e=A.saltoHacha(m,t);vuelo=Math.max(vuelo,e.vuelo);
 assert(m.raiz.position.distanceTo(raiz)<1e-8&&m.raiz.quaternion.angleTo(rotacion)<1e-8,'La actuación deja la raíz al guion');
 const distancia=m.H.manoD.localToWorld(new T.Vector3(0,-.3,0)).distanceTo(m.H.manoI.getWorldPosition(v));agarre=Math.max(agarre,distancia);assert(distancia<.006,'Ambas manos conservan el mango durante el salto y la recuperación');
 assert.deepEqual(Array.from(m.mallas[0].morphTargetInfluences),[1,1],'Las dos manos permanecen cerradas');
 for(const mesh of m.mallas)for(let j=0;j<mesh.geometry.attributes.position.count;j+=11)suelo=Math.min(suelo,mesh.getVertexPosition(j,v).y);
 if(i%20===0)poses.set(t,A.capturar(m));
}
assert(vuelo>2.39,'Conserva los 2.4 m del arco de combate');assert(suelo>0,'Las botas y el filo respetan el pavimento');
assert.equal(A.muestrearSalto(R.impacto).vuelo,0);assert.equal(A.muestrearSalto(R.impacto).avance,1);assert(A.muestrearSalto(R.impacto).impacto&&!A.muestrearSalto(R.impacto-1/120).impacto,'El evento de impacto se dispara en su fotograma');
const igual=(modelo,p,mensaje,tolerancia=1e-6)=>{assert(modelo.H.cuerpo.position.distanceTo(p.pos)<tolerancia,mensaje+' · cuerpo');for(const[n,q]of Object.entries(p.rot))assert(q.angleTo(modelo.H[n].quaternion)<tolerancia,mensaje+' · '+n);};
for(const[t,p]of [...poses].reverse()){A.saltoHacha(m,t);igual(m,p,'El reloj absoluto es reversible');}
for(const t of [.132,.33,.825,R.impacto,.99,R.ataque,R.duracion]){A.saltoHacha(m,t-1e-6);const p=A.capturar(m);A.saltoHacha(m,t+1e-6);igual(m,p,'Continuidad en '+t,.0001);}
for(const k of [0,.12,.3,.5,.75,.86]){
 A.saltoHacha(m,k*R.ataque);F.posar(original,{anim:'salto',k,t:0,dt:0,mezclar:false});
 for(const n of ['cadera','torso','cabeza','brazoI','anteI','manoI','brazoD','anteD','manoD','piernaI','rodillaI','pieI','piernaD','rodillaD','pieD'])assert(m.H[n].quaternion.angleTo(original.H[n].quaternion)<1e-6,'Se reutiliza la pose original: '+n);
}
A.saltoHacha(m,R.impacto);const punta=m.M.punta.getWorldPosition(new T.Vector3());assert(punta.z>.95&&punta.z<1.4,'El filo alcanza al frente en el impacto');
const centro=t=>{A.saltoHacha(m,t);return m.H.manoD.localToWorld(new T.Vector3(0,-1.05,0));};const velocidad=centro(R.impacto+.0001).sub(centro(R.impacto-.0001));A.saltoHacha(m,R.impacto);velocidad.applyQuaternion(m.H.manoD.getWorldQuaternion(new T.Quaternion()).invert());velocidad.y=0;velocidad.normalize();assert(Math.abs(velocidad.z)>.98,'El golpe presenta el filo en la trayectoria, no la cara plana');
A.saltoHacha(m,R.duracion);const fin=A.capturar(m);A.buscarDePie(m,0);igual(m,fin,'La búsqueda empieza exactamente en la guardia final');
A.carreraCine(m,.25);const carrera=A.capturar(m);A.saltoHacha(m,0,carrera,0);igual(m,carrera,'La entrada cero conserva el último cuadro de carrera');
const camara=new T.PerspectiveCamera(68,16/9,.045,100),manos=[];
for(const t of [.36,.72]){
 const e=A.muestrearSalto(t);camara.position.set(0,1.65+e.vuelo,0);camara.updateMatrixWorld(true);A.fpsSaltoHacha(fps,camara,t);manos.push(fps.H.manoD.getWorldPosition(new T.Vector3()).sub(camara.position));
 const distancia=fps.H.manoD.localToWorld(new T.Vector3(0,-.3,0)).distanceTo(fps.H.manoI.getWorldPosition(v));assert(distancia<.006,'POV conserva el mismo agarre doble');
}
assert(manos[0].distanceTo(manos[1])<1e-6,'La altura del salto sólo se aplica una vez al seguir la cámara');
A.fps(fps,camara,1.2,0,null,'carreraCine');const antesFPS=A.capturar(fps),raizFPS=fps.raiz.position.clone();A.fps(fps,camara,1.2,0,0,'saltoHacha');igual(fps,antesFPS,'POV enlaza con Running sin cambiar el primer cuadro');assert(fps.raiz.position.distanceTo(raizFPS)<1e-7);
for(const[g,i]of geometrias.map((g,i)=>[g,i])){assert.equal(m.mallas[i].geometry,g.geo);assert.deepEqual(g.geo.attributes.position.array,g.pos);assert.deepEqual(g.geo.index.array,g.idx);}
console.log(`✓ Salto de cine: 241 poses, vuelo ${vuelo.toFixed(3)} m, impacto ${R.impacto.toFixed(3)} s, filo a ${punta.z.toFixed(3)} m, agarre ${(agarre*1000).toFixed(3)} mm, suelo ${(suelo*1000).toFixed(1)} mm; fuente, empalmes, raíz, caché y POV sin doble altura.`);
