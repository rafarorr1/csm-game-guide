/* FBX Running y Equip: datos locales, ciclo y gesto fuente conservados. */
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const c=vm.createContext({console,atob});c.window=c;
for(const f of ['visor-three-vendor.js','adreida-scenario/combate.js','arpg-three-adreida-animacion.js','adreida-scenario/datos.js','adreida-piernas-scenario/datos.js','arpg-three-adreida.js','hacha-adreida-scenario/datos.js','arpg-three-hacha-adreida.js','arpg-three-modelos.js','adreida-scenario/cinematica.js'])vm.runInContext(fs.readFileSync(new URL(f,import.meta.url),'utf8'),c,{filename:f});
const T=c.CAOZ_THREE.THREE,F=c.CAOZ_ARPG_MODELOS.fabrica(T),m=F.crear('adreida'),clips=c.CAOZ_ADREIDA_CINE_CLIPS,q=new T.Quaternion(),v=new T.Vector3(),body=m.mallas[0],botas=[];
for(let i=0;i<body.geometry.attributes.position.count;i++)if(body.geometry.attributes.position.getY(i)<.24)botas.push(i);
const hash=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
for(const[n,h]of Object.entries({prepararMeteorito:'dd74089dcb39bb44eab7325f07233f704aef56ff5022094f3f60aeed28d532de',caerAbismo:'712aac14f36fe8e1365c4e35213d080a7d3d0f859c7c01576cf5ca9e489b9148',deslizarAtaque:'f3fb94c352311b63e1849c8b22e210cb48b1c7d8eacdcc654b19849c05b3503e',salidaConGiro:'5ad32453de0b75a73d61003726dd971b30110d153c61aaaa5f4e02c0f98ae073'}))assert.equal(hash(clips[n]),h,n+' conserva los datos aprobados');
function posar(clip,k){
  const f=k*(clip.muestras-1),a=Math.floor(f),b=Math.min(clip.muestras-1,a+1),u=f-a;
  m.H.cuerpo.position.fromArray(clip.datos,a*clip.ancho).lerp(v.fromArray(clip.datos,b*clip.ancho),u);
  for(let n=0;n<clip.huesos.length;n++)m.H[clip.huesos[n]].quaternion.fromArray(clip.datos,a*clip.ancho+3+n*4).normalize().slerp(q.fromArray(clip.datos,b*clip.ancho+3+n*4).normalize(),u);
  m.raiz.updateMatrixWorld(true);
}
const resumen={};
for(const[nombre,duracion,muestras]of [['carreraCine',19/30,77],['equiparHacha',50/30,201]]){
  const clip=clips[nombre];assert.equal(clip.duracion,duracion);assert.equal(clip.muestras,muestras);assert.equal(clip.fps,120);assert.equal(clip.huesos.length,22);assert.equal(clip.ancho,91);assert.equal(clip.datos.length,muestras*91);assert.equal(clip.raiz.length,muestras*3);assert.equal(clip.giros.length,muestras);
  assert(clip.datos.every(Number.isFinite)&&clip.raiz.every(Number.isFinite)&&clip.giros.every(Number.isFinite));assert.deepEqual(Array.from(clip.raiz.slice(0,3)),[0,0,0]);assert.equal(clip.giros[0],0);
  let bajo=Infinity,alto=-Infinity,salto=0;
  for(let i=0;i<muestras;i++){
    assert.equal(clip.datos[i*91],0);assert.equal(clip.datos[i*91+2],0);assert.equal(clip.raiz[i*3+1],0,'La raíz XZ y el apoyo no se duplican');
    for(let n=0;n<22;n++){
      const giro=new T.Quaternion().fromArray(clip.datos,i*91+3+n*4);assert(Math.abs(giro.lengthSq()-1)<.000003);
      if(i)salto=Math.max(salto,giro.normalize().angleTo(q.fromArray(clip.datos,(i-1)*91+3+n*4).normalize()));
    }
  }
  assert(salto<.35,nombre+' conserva continuidad entre muestras: '+salto);
  // Incluye instantes entre muestras, donde el slerp podría penetrar el apoyo.
  for(let i=0;i<=2*(muestras-1);i++){
    posar(clip,i/(2*(muestras-1)));let minimo=Infinity;
    for(const j of botas)minimo=Math.min(minimo,body.getVertexPosition(j,v).y);
    bajo=Math.min(bajo,minimo);alto=Math.max(alto,minimo);
  }
  assert(bajo>.009,nombre+' mantiene las suelas sobre el suelo: '+bajo);
  if(nombre==='carreraCine'){
    assert.equal(clip.agarre,'libre');assert.equal(clip.ciclico,true);assert(alto>.06,'Running mantiene la fase aérea');
    for(let n=0;n<22;n++){const a=new T.Quaternion().fromArray(clip.datos,3+n*4).normalize(),b=new T.Quaternion().fromArray(clip.datos,(muestras-1)*91+3+n*4).normalize();assert(a.angleTo(b)<.00001,'El ciclo cierra sin salto en '+clip.huesos[n]);}
    assert(Math.hypot(...clip.raiz.slice(-3))>3,'Running conserva el avance separado para quien lo necesite');
    posar(clip,0);const manoInicial=m.H.manoD.getWorldPosition(new T.Vector3());posar(clip,.5);assert(manoInicial.distanceTo(m.H.manoD.getWorldPosition(v))>.35,'El brazo derecho conserva un balanceo visible del FBX');
  }else{
    const t=clip.transferencia;assert.equal(t.contacto,.9);assert.equal(t.extraccion,1);assert.equal(t.libre,1.5);assert(t.contacto<t.extraccion&&t.extraccion<t.libre&&t.libre<duracion);
    assert.equal(t.fotogramaContacto,t.contacto*t.fpsFuente);assert.equal(t.fotogramaExtraccion,t.extraccion*t.fpsFuente);
    posar(clip,0);const manoInicio=m.H.manoD.getWorldPosition(new T.Vector3());
    posar(clip,t.contacto/duracion);const manoContacto=m.H.manoD.getWorldPosition(new T.Vector3()),torso=m.H.torso.getWorldPosition(new T.Vector3());assert(manoContacto.y-manoInicio.y>.7,'La mano sube realmente hacia el hombro');assert(manoContacto.z<torso.z&&manoContacto.y>torso.y+.6,'El contacto queda detrás y arriba del torso');
    posar(clip,t.libre/duracion);assert(m.H.manoD.getWorldPosition(v).distanceTo(manoContacto)>.65,'La extracción aparta la mano del hombro');
    assert.equal(clip.agarre,'derecha');assert(Math.abs(clip.giros.at(-1))>.5,'El giro de la fuente se entrega separado');
  }
  resumen[nombre]={muestras,saltoMaximoRadianes:salto,alturaMinimaBotas:bajo,alturaMaximaBotas:alto};
}
console.log('✓ Clips FBX: carrera cíclica, equipar con contacto de hombro y extracción, raíz separada, botas completas sin penetración y clips previos intactos.');
console.log(JSON.stringify(resumen));
