/* Mma Kick conserva patada, recobro y contrato del contacto con la puerta. */
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const c=vm.createContext({console,atob});c.window=c;
for(const f of ['visor-three-vendor.js','adreida-scenario/combate.js','arpg-three-adreida-animacion.js','adreida-scenario/datos.js','adreida-piernas-scenario/datos.js','arpg-three-adreida.js','hacha-adreida-scenario/datos.js','arpg-three-hacha-adreida.js','arpg-three-modelos.js','adreida-scenario/cinematica.js'])vm.runInContext(fs.readFileSync(new URL(f,import.meta.url),'utf8'),c,{filename:f});
const T=c.CAOZ_THREE.THREE,F=c.CAOZ_ARPG_MODELOS.fabrica(T),m=F.crear('adreida'),clips=c.CAOZ_ADREIDA_CINE_CLIPS,clip=clips.patadaPuerta,body=m.mallas[0],v=new T.Vector3(),q=new T.Quaternion(),eje=new T.Vector3(0,1,0),botas=[],izquierda=[];
const hash=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
for(const[n,h]of Object.entries({prepararMeteorito:'dd74089dcb39bb44eab7325f07233f704aef56ff5022094f3f60aeed28d532de',caerAbismo:'712aac14f36fe8e1365c4e35213d080a7d3d0f859c7c01576cf5ca9e489b9148',deslizarAtaque:'f3fb94c352311b63e1849c8b22e210cb48b1c7d8eacdcc654b19849c05b3503e',salidaConGiro:'5ad32453de0b75a73d61003726dd971b30110d153c61aaaa5f4e02c0f98ae073',carreraCine:'6acc3ec2e154f343e1fff2cedb0f55047dbdadf4755d789fcbbddc22bdde7dfb',equiparHacha:'67e00e184e0eb533c15b5442050eb53cb7d1eaa8040ef5541caf1da016996b8b'}))assert.equal(hash(clips[n]),h,n+' permanece intacto');
assert.equal(clip.duracion,1);assert.equal(clip.fps,120);assert.equal(clip.muestras,121);assert.equal(clip.ancho,91);assert.equal(clip.datos.length,121*91);assert.equal(clip.raiz.length,121*3);assert.equal(clip.giros.length,121);assert.equal(clip.huesos.length,22);assert.equal(clip.agarre,'libre');
assert.equal(clip.tramoFuente.fotogramaInicio,2);assert.equal(clip.tramoFuente.fotogramaFin,32);assert.equal(clip.tramoFuente.duracionCompleta,1.6);assert.equal(clip.contacto,17/30);assert.equal(clip.golpe.segundo,clip.contacto);assert.equal(clip.golpe.fotogramaFuente,19);assert.equal(clip.golpe.fotogramaHorneado,68);assert.equal(clip.golpe.pierna,'I');assert.equal(clip.golpe.apoyo,'D');
assert(clip.datos.every(Number.isFinite)&&clip.raiz.every(Number.isFinite)&&clip.giros.every(Number.isFinite));
for(let i=0;i<body.geometry.attributes.position.count;i++)if(body.geometry.attributes.position.getY(i)<.24){botas.push(i);if(body.geometry.attributes.position.getX(i)>0)izquierda.push(i);}
function posar(k,orientar=true){
  const f=k*120,a=Math.floor(f),b=Math.min(120,a+1),u=f-a;
  m.H.cuerpo.position.fromArray(clip.datos,a*91).lerp(v.fromArray(clip.datos,b*91),u);
  for(let n=0;n<22;n++)m.H[clip.huesos[n]].quaternion.fromArray(clip.datos,a*91+3+n*4).normalize().slerp(q.fromArray(clip.datos,b*91+3+n*4).normalize(),u);
  if(orientar)m.H.cadera.quaternion.premultiply(q.setFromAxisAngle(eje,clip.giroBasePuerta+clip.giros[a]*(1-u)+clip.giros[b]*u));
  m.raiz.updateMatrixWorld(true);
}
let suelo=Infinity,izquierdaAlFinal=Infinity,salto=0,alcance=-Infinity,momentoMaximo=0;
for(let i=0;i<121;i++){
  assert.equal(clip.datos[i*91],0);assert.equal(clip.datos[i*91+2],0);assert.equal(clip.raiz[i*3+1],0);
  for(let n=0;n<22;n++){const giro=new T.Quaternion().fromArray(clip.datos,i*91+3+n*4);assert(Math.abs(giro.lengthSq()-1)<.000003);if(i)salto=Math.max(salto,giro.normalize().angleTo(q.fromArray(clip.datos,(i-1)*91+3+n*4).normalize()));}
}
assert(salto<.3,'No hay giros instantáneos al extender o recoger la pierna: '+salto);
for(let i=0;i<=240;i++){
  posar(i/240);for(const j of botas)suelo=Math.min(suelo,body.getVertexPosition(j,v).y);
  for(const j of izquierda){body.getVertexPosition(j,v);if(v.z>alcance){alcance=v.z;momentoMaximo=i/240;}}
}
assert(suelo>.009,'Las dos botas respetan el suelo también entre muestras: '+suelo);assert(alcance>.95&&alcance<1.08,'La patada tiene alcance suficiente sin alargar el rig');assert(Math.abs(momentoMaximo-clip.contacto)<.05,'El contacto corresponde al máximo de la patada');
posar(clip.contacto);let punta=null,z=-Infinity;for(const j of izquierda){body.getVertexPosition(j,v);if(v.z>z){z=v.z;punta=v.clone();}}
assert(punta.distanceTo(new T.Vector3().fromArray(clip.golpe.contactoPie))<.00001,'El contrato de puerta usa la punta real de la bota');assert(Math.abs(punta.x)<.03&&punta.y>1.3,'El golpe mira al plano +Z y conserva altura de la fuente');
posar(clip.recobro.apoyo);for(const j of izquierda)izquierdaAlFinal=Math.min(izquierdaAlFinal,body.getVertexPosition(j,v).y);assert(izquierdaAlFinal<.025,'La pierna que patea vuelve a apoyar antes de caminar');
const poses=new Map();for(const k of [0,.23,clip.contacto,.81,1]){posar(k);poses.set(k,{pos:m.H.cuerpo.position.clone(),rot:Object.fromEntries(clip.huesos.map(n=>[n,m.H[n].quaternion.clone()]))});}
for(const k of [1,clip.contacto,0,.81,.23]){posar(k);const ref=poses.get(k);assert(m.H.cuerpo.position.distanceTo(ref.pos)<1e-8);for(const[n,giro]of Object.entries(ref.rot))assert(giro.angleTo(m.H[n].quaternion)<1e-6,'El muestreo inverso conserva '+n);}
console.log(`✓ Mma Kick: tramo F002–F032, contacto ${(clip.contacto*1000).toFixed(1)} ms, punta [${punta.toArray().map(x=>x.toFixed(3))}], apoyo a ${(clip.recobro.apoyo*1000).toFixed(1)} ms.`);
console.log(`✓ 241 poses: botas a ${(suelo*1000).toFixed(2)} mm, alcance máximo ${(alcance*100).toFixed(2)} cm a ${momentoMaximo.toFixed(4)} s, muestreo reversible y seis clips previos intactos.`);
