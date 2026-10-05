/* El slide, la incorporación, el giro y la búsqueda conservan cuerpo y agarre. */
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const c=vm.createContext({console,atob});c.window=c;
for(const f of ['visor-three-vendor.js','adreida-scenario/combate.js','arpg-three-adreida-animacion.js','adreida-scenario/datos.js','adreida-piernas-scenario/datos.js','arpg-three-adreida.js','hacha-adreida-scenario/datos.js','arpg-three-hacha-adreida.js','arpg-three-modelos.js','adreida-scenario/cinematica.js','arpg-three-adreida-cine.js'])vm.runInContext(fs.readFileSync(new URL(f,import.meta.url),'utf8'),c,{filename:f});
const T=c.CAOZ_THREE.THREE,F=c.CAOZ_ARPG_MODELOS.fabrica(T),A=c.CAOZ_ARPG_ADREIDA_CINE.fabrica(T,F),m=F.crear('adreida'),otro=F.crear('adreida'),clip=c.CAOZ_ADREIDA_CINE_CLIPS.deslizarAtaque;
assert(clip&&clip.muestras>20&&clip.duracion>1,'Existe un clip completo extraído de Great Sword Slide Attack');
assert.equal(clip.ancho,3+clip.huesos.length*4);assert.equal(clip.datos.length,clip.muestras*clip.ancho);assert(clip.datos.every(Number.isFinite));
assert.equal(clip.raiz.length,clip.muestras*3);assert(clip.raiz.every(Number.isFinite));assert(Math.hypot(...clip.raiz.slice(0,3))<1e-6);assert(clip.raiz.at(-1)>1,'El clip conserva el avance real para adaptarlo a la plaza');
for(let i=0;i<clip.muestras;i++){assert.equal(clip.datos[i*clip.ancho],0);assert.equal(clip.datos[i*clip.ancho+2],0,'El desplazamiento no se aplica a la vez en cuerpo y raíz');assert.equal(clip.raiz[i*3+1],0,'La altura del cuerpo se conserva en la pose');}
for(const n of clip.huesos)assert(m.H[n]?.isBone,'El clip sólo anima huesos existentes: '+n);
for(let i=0;i<clip.muestras;i++)for(let j=0;j<clip.huesos.length;j++){const q=clip.datos.slice(i*clip.ancho+3+j*4,i*clip.ancho+7+j*4);assert(Math.abs(Math.hypot(...q)-1)<.00001,'Cuaterniones unitarios sin saltos de escala');}
const mesh=m.mallas[0],g=mesh.geometry,v=new T.Vector3(),vertices=g.attributes.position.array.slice(),indices=g.index.array.slice();
F.posar(m,{anim:'quieto',mezclar:false});m.raiz.updateMatrixWorld(true);const alturaReposo=m.H.cabeza.getWorldPosition(v).y;
F.posar(otro,{anim:'quieto',mezclar:false});const poseOtro=A.capturar(otro);
let errorManos=0,alturaMin=Infinity,pisoMin=Infinity;
for(let i=0;i<=60;i++){
 const k=i/60;A.deslizar(m,k);m.raiz.updateMatrixWorld(true);
 alturaMin=Math.min(alturaMin,m.H.cabeza.getWorldPosition(v).y);
 const apoyo=m.H.manoD.localToWorld(new T.Vector3(0,-.3,0)),error=apoyo.distanceTo(m.H.manoI.getWorldPosition(v));errorManos=Math.max(errorManos,error);
 assert(error<.006,`Ambas manos sujetan el mismo mango al deslizar: ${k}, ${error} m`);
 assert.deepEqual(Array.from(mesh.morphTargetInfluences),[1,1],'Los dedos permanecen cerrados sobre el hacha');
 for(const b of Object.values(m.H))assert(Number.isFinite(b.position.length()+b.quaternion.lengthSq())&&Math.abs(b.quaternion.lengthSq()-1)<.00002);
 // Muestra uniforme de piel deformada: incluye rodillas, botas, cadera y manos.
 for(let j=0;j<g.attributes.position.count;j+=13)pisoMin=Math.min(pisoMin,mesh.getVertexPosition(j,v).y);
}
assert(alturaMin<alturaReposo-.25,'Adreida baja el cuerpo de forma visible para deslizarse');
assert(pisoMin>-.04,`La piel del cuerpo no se hunde bajo el pavimento (${pisoMin} m)`);
assert.equal(m.mallas.length,2,'El clip no añade una copia del maniquí ni nuevas llamadas de dibujo');
assert.equal(mesh.geometry,otro.mallas[0].geometry);assert.deepEqual(g.attributes.position.array,vertices);assert.deepEqual(g.index.array,indices,'La animación no modifica la geometría compartida');
for(const [nombre,q] of Object.entries(poseOtro.rot))assert(q.angleTo(otro.H[nombre].quaternion)<1e-7,'Animar un personaje no mueve otro');
// Las búsquedas se calculan desde el tiempo absoluto, sin acumular movimientos.
const estados=new Map();for(const k of [0,.18,.43,.67,.84,1]){A.deslizar(m,k);estados.set(k,A.capturar(m));}
for(const k of [1,.18,.84,0,.67,.43,.18]){A.deslizar(m,k);const p=estados.get(k);assert(m.H.cuerpo.position.distanceTo(p.pos)<1e-8);for(const [nombre,q] of Object.entries(p.rot))assert(q.angleTo(m.H[nombre].quaternion)<1e-6,'Buscar restaura el mismo hueso: '+nombre);}
const guardada=A.capturar(m);A.deslizar(m,.91);A.restaurar(m,guardada);assert(m.H.cuerpo.position.equals(guardada.pos));for(const [nombre,q] of Object.entries(guardada.rot))assert(q.angleTo(m.H[nombre].quaternion)<1e-6);

const mismaPose=(esperada,mensaje,tolerancia=1e-6)=>{assert(m.H.cuerpo.position.distanceTo(esperada.pos)<tolerancia,mensaje+' (posición)');for(const [n,q]of Object.entries(esperada.rot))assert(q.angleTo(m.H[n].quaternion)<tolerancia,mensaje+' ('+n+')');};
const R=A.tiemposRemate,finGiro=R.subida+R.giro,inicioGiro=R.subida-.05;
assert.equal(JSON.stringify(R),JSON.stringify({duracion:1.04,subida:.30,giro:.46,freno:.28}),'La integración recibe los tiempos del remate inmediato');assert(Object.isFrozen(R));assert.equal(R.subida+R.giro+R.freno,R.duracion);
A.deslizar(m,.9/clip.duracion);const finSlide=A.capturar(m);A.rematarDeslizamiento(m,0);mismaPose(finSlide,'La incorporación nace del cuadro exacto a los 0.90 s');
const alturaSalidaSlide=m.H.cabeza.getWorldPosition(v).y;A.rematarDeslizamiento(m,.06/R.duracion);assert(m.H.cabeza.getWorldPosition(v).y>alturaSalidaSlide+.05,'A los 60 ms ya está incorporándose para el corte de toma');
const origen=m.raiz.position.clone(),orientacion=m.raiz.quaternion.clone();let pisoRemate=Infinity,agarreRemate=0;
const comprobarPose=etiqueta=>{
 const error=m.H.manoD.localToWorld(new T.Vector3(0,-.3,0)).distanceTo(m.H.manoI.getWorldPosition(v));agarreRemate=Math.max(agarreRemate,error);assert(error<.006,etiqueta+': las dos manos siguen en el mango');
 assert(m.raiz.position.distanceTo(origen)<1e-8&&m.raiz.quaternion.angleTo(orientacion)<1e-7,etiqueta+': el giro no mueve la raíz de la plaza');
 assert(Math.hypot(m.H.cuerpo.position.x,m.H.cuerpo.position.z)<.35,etiqueta+': el cuerpo transfiere su peso alrededor del pivote sin avanzar por la plaza');
 for(const mesh of m.mallas)for(let j=0;j<mesh.geometry.attributes.position.count;j+=13)pisoRemate=Math.min(pisoRemate,mesh.getVertexPosition(j,v).y);
 for(const b of Object.values(m.H))assert(Number.isFinite(b.position.length()+b.quaternion.lengthSq())&&Math.abs(b.quaternion.lengthSq()-1)<.00002,etiqueta+': pose finita y normalizada');
 assert.deepEqual(Array.from(m.mallas[0].morphTargetInfluences),[1,1],etiqueta+': los dedos permanecen cerrados');
};
for(let i=0;i<=152;i++){A.rematarDeslizamiento(m,i/152);comprobarPose('Remate '+i);}
const finRemate=A.capturar(m),alturaDePie=m.H.cabeza.getWorldPosition(v).y;assert(alturaDePie>alturaReposo-.035,'Termina erguida antes de buscar al mago');
A.buscarDePie(m,0);mismaPose(finRemate,'La búsqueda empieza en la misma pose del freno');
let cabezaIzquierda=0,cabezaDerecha=0,espacioCabeza=Infinity;
for(let i=0;i<=74;i++){
 A.buscarDePie(m,1.2*i/74);comprobarPose('Búsqueda '+i);cabezaIzquierda=Math.min(cabezaIzquierda,m.H.cabeza.rotation.y);cabezaDerecha=Math.max(cabezaDerecha,m.H.cabeza.rotation.y);const alturaCabeza=m.H.cabeza.getWorldPosition(v).y;assert(alturaCabeza>alturaReposo-.035,'Busca al mago de pie');
 let techoArma=-Infinity;for(let j=0;j<m.mallas[1].geometry.attributes.position.count;j++)techoArma=Math.max(techoArma,m.mallas[1].getVertexPosition(j,v).y);
 espacioCabeza=Math.min(espacioCabeza,alturaCabeza-techoArma);assert(alturaCabeza-techoArma>.25,'La guardia baja deja libre la cabeza durante la búsqueda');
}
assert(cabezaIzquierda<-.9&&cabezaDerecha>1,'La cabeza comprueba ambos lados antes de pasar a POV');
A.buscarDePie(m,1.2);mismaPose(finRemate,'La búsqueda regresa al centro al terminar sus 1.2 s');const busquedaFinal=A.capturar(m);A.buscarDePie(m,1.2-1e-5);mismaPose(busquedaFinal,'La búsqueda termina sin saltar la cabeza',1e-6);A.buscarDePie(m,1.2+1e-5);mismaPose(busquedaFinal,'La pose final se sostiene después del tiempo de búsqueda');
A.buscarDePie(m,.6);const mitadBusqueda=A.capturar(m);A.buscarDePie(m,1.2,null,1,2.4);mismaPose(mitadBusqueda,'La duración opcional conserva el recorrido normalizado de la mirada');
assert(pisoRemate>0,`Cuerpo y hacha quedan sobre el suelo durante toda la actuación (${pisoRemate} m)`);
// La orientación puede coincidir al principio y al final, pero el arco recorre
// una vuelta completa, siempre en el mismo sentido y sin el atajo de slerp.
let anteriorAngulo=null,vuelta=0,elevacionDerecha=0,flexionIzquierda=0;
A.rematarDeslizamiento(m,R.subida/R.duracion);const pivoteInicial=m.H.pieI.getWorldPosition(new T.Vector3()),alturaInicioGiro=m.H.cabeza.getWorldPosition(v).y;let alturaGiro=alturaInicioGiro;
for(let i=0;i<=116;i++){
 const t=inicioGiro+(finGiro-inicioGiro)*i/116;A.rematarDeslizamiento(m,t/R.duracion);v.set(0,0,1).applyQuaternion(m.H.cadera.quaternion);const angulo=Math.atan2(v.x,v.z);
 if(anteriorAngulo!==null){const paso=Math.atan2(Math.sin(angulo-anteriorAngulo),Math.cos(angulo-anteriorAngulo));assert(paso>=-1e-8,'El giro no invierte el sentido al cruzar 180°');vuelta+=paso;}anteriorAngulo=angulo;
 const pivote=m.H.pieI.getWorldPosition(new T.Vector3()),pieLibre=m.H.pieD.getWorldPosition(v);
 if(t>=R.subida)assert(Math.hypot(pivote.x-pivoteInicial.x,pivote.z-pivoteInicial.z)<1e-7,'La bota izquierda pivota en su punto de apoyo sin patinar por el suelo');
 elevacionDerecha=Math.max(elevacionDerecha,pieLibre.y-pivote.y);flexionIzquierda=Math.max(flexionIzquierda,m.H.rodillaI.rotation.x);alturaGiro=Math.min(alturaGiro,m.H.cabeza.getWorldPosition(v).y);
}
assert(Math.abs(vuelta-Math.PI*2)<.035,'El giro recorre una vuelta completa mientras termina la inclinación de la subida');
assert(elevacionDerecha>.12&&flexionIzquierda>1&&alturaInicioGiro-alturaGiro>.045,'El giro carga una rodilla, recoge la otra pierna y baja el peso del cuerpo');
for(const t of [R.subida,(inicioGiro+finGiro)/2,finGiro,R.duracion]){A.rematarDeslizamiento(m,t/R.duracion);for(const mesh of m.mallas)for(let i=0;i<mesh.geometry.attributes.position.count;i++)assert(mesh.getVertexPosition(i,v).y>0,'Todos los vértices respetan el suelo en apoyo, carga y freno');}
for(let i=0;i<=21;i++){A.rematarDeslizamiento(m,(finGiro+R.freno*i/21)/R.duracion);for(let j=0;j<m.mallas[1].geometry.attributes.position.count;j+=7)assert(m.mallas[1].getVertexPosition(j,v).y<1.45,'El freno recoge el arma por abajo sin levantarla sobre la cabeza');}
// Todos los empalmes son continuos, incluso al evaluar instantes separados por
// una milésima de cuadro, y las búsquedas son independientes del orden de lectura.
for(const t of [inicioGiro,R.subida,finGiro,R.duracion]){A.rematarDeslizamiento(m,(t-1e-6)/R.duracion);const antes=A.capturar(m);A.rematarDeslizamiento(m,Math.min(1,(t+1e-6)/R.duracion));mismaPose(antes,'Empalme continuo a '+t+' s',.0001);}
A.rematarDeslizamiento(m,(R.subida-.004)/R.duracion);const caderaAntes=m.H.cadera.quaternion.clone();A.rematarDeslizamiento(m,(R.subida+.004)/R.duracion);assert(caderaAntes.angleTo(m.H.cadera.quaternion)>.015,'La cadera ya está girando al acabar de subir, sin pausa entre acciones');
for(const [animar,tiempos]of [[k=>A.rematarDeslizamiento(m,k),[0,.13,.3421,.52,.7237,.91,1]],[t=>A.buscarDePie(m,t),[0,.17,.336,.57,.864,1.06,1.2]]]){
 const poses=new Map();for(const t of tiempos){animar(t);poses.set(t,A.capturar(m));}
 for(const t of [...tiempos].reverse()){animar(t);mismaPose(poses.get(t),'La actuación absoluta restaura '+t);}
 const guardada=A.capturar(m);A.deslizar(m,.71);A.restaurar(m,guardada);mismaPose(guardada,'Capturar y restaurar conserva la nueva actuación');
}
A.rematarDeslizamiento(m,.19,finSlide,0);mismaPose(finSlide,'La entrada cero conserva la pose anterior');
A.rematarDeslizamiento(m,.19,finSlide,.45);comprobarPose('Mezcla de incorporación');
A.buscarDePie(m,.7,finRemate,0);mismaPose(finRemate,'La entrada cero conserva el freno');
A.buscarDePie(m,.7,finRemate,.45);comprobarPose('Mezcla de búsqueda');
assert.equal(m.mallas.length,2);assert.equal(mesh.geometry,otro.mallas[0].geometry);assert.deepEqual(g.attributes.position.array,vertices);assert.deepEqual(g.index.array,indices,'El remate tampoco modifica la geometría compartida');
for(const [nombre,q]of Object.entries(poseOtro.rot))assert(q.angleTo(otro.H[nombre].quaternion)<1e-7,'El remate no modifica otro personaje');
const primeraPersona=A.crearFPS(),camara=new T.PerspectiveCamera();camara.position.set(2,1.4,-3);camara.lookAt(0,1,0);camara.updateMatrixWorld(true);
A.fps(primeraPersona,camara,0,.9,.9/clip.duracion,'deslizarAtaque');const poseFPS=A.capturar(primeraPersona),posFPS=primeraPersona.raiz.position.clone(),giroFPS=primeraPersona.raiz.quaternion.clone();
A.fps(primeraPersona,camara,0,.9,0,'rematarDeslizamiento');assert(primeraPersona.H.cuerpo.position.distanceTo(poseFPS.pos)<1e-7&&primeraPersona.raiz.position.distanceTo(posFPS)<1e-7&&primeraPersona.raiz.quaternion.angleTo(giroFPS)<1e-7,'El remate FPS enlaza en la misma posición y encuadre que el slide');
for(const[n,q]of Object.entries(poseFPS.rot))assert(q.angleTo(primeraPersona.H[n].quaternion)<1e-6,'El remate FPS no mezcla de nuevo desde idle: '+n);
A.fps(primeraPersona,camara,0,.96,.06/R.duracion,'rematarDeslizamiento');for(const mesh of primeraPersona.mallas)assert(!mesh.material.depthTest&&!mesh.material.depthWrite&&mesh.renderOrder===40,'Los primeros 60 ms del remate conservan la capa de presentación FPS');
console.log(`✓ Slide de Adreida: ${clip.muestras} muestras, 61 poses, cuerpo ${(alturaReposo-alturaMin).toFixed(2)} m más bajo, agarre ${(errorManos*1000).toFixed(2)} mm, suelo ${(pisoMin*1000).toFixed(1)} mm y búsquedas reversibles sin cambiar geometría.`);
console.log(`✓ Remate ${R.duracion} s y búsqueda 1.2 s: 228 poses, vuelta completa anticipada, agarre ${(agarreRemate*1000).toFixed(3)} mm, suelo ${(pisoRemate*1000).toFixed(1)} mm y empalmes continuos, absolutos y reversibles, incluido FPS.`);
console.log(`✓ Peso del giro: pivote izquierdo fijo, pierna derecha ${(elevacionDerecha*100).toFixed(1)} cm más alta, carga vertical ${((alturaInicioGiro-alturaGiro)*100).toFixed(1)} cm y guardia ${(espacioCabeza*100).toFixed(1)} cm por debajo de la cabeza.`);
