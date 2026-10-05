/* Walking Left Turn retargeteado: fuente, raíz separada, apoyo y mano derecha. */
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const c=vm.createContext({console,atob});c.window=c;
for(const f of ['visor-three-vendor.js','adreida-scenario/combate.js','arpg-three-adreida-animacion.js','adreida-scenario/datos.js','adreida-piernas-scenario/datos.js','arpg-three-adreida.js','hacha-adreida-scenario/datos.js','arpg-three-hacha-adreida.js','arpg-three-modelos.js','adreida-scenario/cinematica.js','arpg-three-adreida-cine.js'])vm.runInContext(fs.readFileSync(new URL(f,import.meta.url),'utf8'),c,{filename:f});
const T=c.CAOZ_THREE.THREE,F=c.CAOZ_ARPG_MODELOS.fabrica(T),A=c.CAOZ_ARPG_ADREIDA_CINE.fabrica(T,F),m=F.crear('adreida'),otro=F.crear('adreida'),clips=c.CAOZ_ADREIDA_CINE_CLIPS,clip=clips.salidaConGiro,v=new T.Vector3();
// La ampliación incremental conserva exactamente los tres clips ya aprobados.
for(const [nombre,hash]of Object.entries({prepararMeteorito:'dd74089dcb39bb44eab7325f07233f704aef56ff5022094f3f60aeed28d532de',caerAbismo:'712aac14f36fe8e1365c4e35213d080a7d3d0f859c7c01576cf5ca9e489b9148',deslizarAtaque:'f3fb94c352311b63e1849c8b22e210cb48b1c7d8eacdcc654b19849c05b3503e'}))assert.equal(crypto.createHash('sha256').update(JSON.stringify(clips[nombre])).digest('hex'),hash,nombre+' permanece intacto');
assert.equal(clip.duracion,1.2);assert.equal(clip.muestras,145);assert.equal(clip.fps,120);assert.equal(clip.agarre,'derecha');
assert.equal(clip.ancho,3+clip.huesos.length*4);assert.equal(clip.datos.length,clip.muestras*clip.ancho);assert.equal(clip.raiz.length,clip.muestras*3);assert.equal(clip.giros.length,clip.muestras);
for(const valores of [clip.datos,clip.raiz,clip.giros])assert(valores.every(Number.isFinite));
assert(Math.hypot(...clip.raiz.slice(0,3))===0&&clip.giros[0]===0);assert(Math.abs(Math.hypot(...clip.raiz.slice(-3))-1.797301)<1e-6);assert(Math.abs(clip.giros.at(-1)-.630883)<1e-6);
for(let i=0;i<clip.muestras;i++){
  assert.equal(clip.datos[i*clip.ancho],0);assert.equal(clip.datos[i*clip.ancho+2],0);assert.equal(clip.raiz[i*3+1],0,'El movimiento XZ y la altura de la pose tienen un único dueño');
  for(let n=0;n<clip.huesos.length;n++){const q=new T.Quaternion().fromArray(clip.datos,i*clip.ancho+3+n*4);assert(Math.abs(q.lengthSq()-1)<.000003);}
}
const body=m.mallas[0],arma=m.mallas[1],g=body.geometry,vertices=g.attributes.position.array.slice(),indices=g.index.array.slice(),botas=[];
for(let i=0;i<g.attributes.position.count;i++)if(g.attributes.position.getY(i)<.24)botas.push(i);
F.posar(m,{anim:'quieto',t:0,dt:0,mezclar:false});A.apoyarSalida(m);const reposo=A.capturar(m),raiz=m.raiz.position.clone(),direccion=m.raiz.quaternion.clone();
F.posar(otro,{anim:'quieto',t:0,dt:0,mezclar:false});const poseOtro=A.capturar(otro);
let suelo=Infinity,filo=Infinity,apoyos=0,balanceo=0,brazoAnterior=null;
const posicionArma=arma.getVertexPosition.bind(arma),posicionCuerpo=body.getVertexPosition.bind(body);let consultas=0;
body.getVertexPosition=(i,p)=>{consultas++;return posicionCuerpo(i,p);};
function validar(etiqueta){
  m.raiz.updateMatrixWorld(true);assert(m.raiz.position.equals(raiz)&&m.raiz.quaternion.angleTo(direccion)<1e-7,'La actuación no aplica de nuevo la raíz');
  let minimo=Infinity;for(const i of botas)minimo=Math.min(minimo,posicionCuerpo(i,v).y);suelo=Math.min(suelo,minimo);assert(minimo>.009,etiqueta+': todas las botas despejan el pavimento '+minimo);
  for(let i=0;i<arma.geometry.attributes.position.count;i+=3)filo=Math.min(filo,posicionArma(i,v).y);
  assert(filo>.05,etiqueta+': el filo conserva espacio sobre el suelo '+filo);
  assert.equal(body.morphTargetInfluences[1],1,'La mano derecha permanece cerrada durante el cambio de pose');
  // El arma aprobada conserva su enlace rígido a la mano derecha; no hay una
  // restricción artificial que lleve la izquierda al mango mientras camina.
  const si=arma.geometry.attributes.skinIndex,sw=arma.geometry.attributes.skinWeight;
  for(const i of [0,Math.floor(si.count/2),si.count-1])assert.equal(arma.skeleton.bones[si.getX(i)],m.H.manoD);assert.equal(sw.getX(0),1);
}
for(let i=0;i<=144;i++){
  consultas=0;A.salidaConGiro(m,i/144);apoyos=Math.max(apoyos,consultas);validar('Fuente '+i);
  assert.deepEqual(Array.from(body.morphTargetInfluences),[0,1],'La izquierda queda libre durante la marcha');
  const q=m.H.brazoD.quaternion.clone();if(brazoAnterior)balanceo+=brazoAnterior.angleTo(q);brazoAnterior=q;
  for(const n of ['brazoI','anteI','brazoD','anteD']){const j=clip.huesos.indexOf(n),esperada=new T.Quaternion().fromArray(clip.datos,i*clip.ancho+3+j*4).normalize();assert(m.H[n].quaternion.angleTo(esperada)<1e-6,n+' reproduce el FBX sin reescritura procedural');}
}
assert(balanceo>.8,'El brazo armado conserva el balanceo de la fuente');assert(apoyos<150,'El apoyo evalúa una selección ligera de vértices: '+apoyos);
// Prueba las poses intermedias reales de desaceleración y asentamiento, donde
// el slerp de piernas hundía 5 cm las botas aunque ambas poses fuente fueran válidas.
for(let i=0;i<=84;i++){
  const t=1.65+.35*i/84,u=t<1.4?t:t<1.8?1.4+(t-1.4)-(t-1.4)**2/.8:1.6,k=Math.min(1,u/1.6);
  A.salidaConGiro(m,k,reposo,1-i/84);validar('Asentamiento '+i);
}
for(const n of clip.huesos)assert(m.H[n].quaternion.angleTo(reposo.rot[n])<1e-6,'El empalme termina en el reposo '+n);
assert(m.H.cuerpo.position.distanceTo(reposo.pos)<1e-6,'El apoyo del reposo no cambia al terminar la mezcla');
const estados=new Map();for(const k of [0,.11,.32,.57,.76,1]){A.salidaConGiro(m,k);estados.set(k,{pose:A.capturar(m),pos:new T.Vector3(),yaw:A.movimientoSalida(k,v)});estados.get(k).pos.copy(v);}
for(const k of [1,.11,.76,0,.57,.32,.11]){A.salidaConGiro(m,k);const ref=estados.get(k),yaw=A.movimientoSalida(k,v);assert.equal(yaw,ref.yaw);assert(v.equals(ref.pos));assert(m.H.cuerpo.position.distanceTo(ref.pose.pos)<1e-8);for(const[n,q]of Object.entries(ref.pose.rot))assert(q.angleTo(m.H[n].quaternion)<1e-6,'Reproducción inversa conserva '+n);}
assert.equal(m.mallas.length,2);assert.equal(g,otro.mallas[0].geometry);assert.deepEqual(g.attributes.position.array,vertices);assert.deepEqual(g.index.array,indices);
for(const[n,q]of Object.entries(poseOtro.rot))assert(q.angleTo(otro.H[n].quaternion)<1e-6,'Animar la salida no mueve otra instancia');
console.log(`✓ Walking Left Turn: 145 poses, raíz de 1.7973 m y giro de 36.15° separados; brazos fuente, mano derecha cerrada y clips previos intactos.`);
console.log(`✓ Apoyo y asentamiento: ${apoyos} contactos por cuadro, botas a ${(suelo*1000).toFixed(2)} mm, filo a ${(filo*100).toFixed(2)} cm; scrub reversible y geometría compartida intacta.`);
