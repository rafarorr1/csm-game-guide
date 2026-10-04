/* Adapta Great Sword al esqueleto y al mango de Adreida, sin malla del FBX.
   Uso: node preparar-combate.mjs bloqueo.json corte.json giro.json */
import fs from 'node:fs';
import vm from 'node:vm';
const entradas=process.argv.slice(2).map(p=>JSON.parse(fs.readFileSync(p,'utf8')));
if(entradas.length!==3)throw Error('Indica bloqueo, corte y giro extraídos con extraer-combate.py.');
const c=vm.createContext({console,atob});c.window=c;
for(const f of ['visor-three-vendor.js','arpg-three-adreida-animacion.js','adreida-scenario/datos.js','arpg-three-adreida.js','arpg-three-modelos.js'])vm.runInContext(fs.readFileSync(new URL('../'+f,import.meta.url),'utf8'),c);
const T=c.CAOZ_THREE.THREE,F=c.CAOZ_ARPG_MODELOS.fabrica(T),m=F.crear('adreida'),H=m.H;
const huesos=['cadera','torso','cabeza','piernaI','rodillaI','pieI','piernaD','rodillaD','pieD'];
const originales=Object.values(H).map(b=>({b,p:b.position.clone(),q:b.quaternion.clone()}));
const v=a=>new T.Vector3().fromArray(a),q=a=>new T.Quaternion().fromArray(a),pos=(f,n)=>v(f[n].p),tmp=new T.Quaternion(),base=new T.Matrix4();
function orientar(b,mundo){b.parent.getWorldQuaternion(tmp).invert();b.quaternion.copy(tmp).multiply(mundo);b.updateMatrixWorld(true);}
const planos=new Map();
function cadena(f,n1,n2,n3,b1,b2,correccion){
  const d1=pos(f,n2).sub(pos(f,n1)).normalize().applyQuaternion(correccion),d2=pos(f,n3).sub(pos(f,n2)).normalize().applyQuaternion(correccion);
  const x=new T.Vector3().crossVectors(d1,d2);if(x.lengthSq()<1e-8)x.copy(planos.get(b1)||new T.Vector3(1,0,0));x.normalize();
  const anterior=planos.get(b1);if(anterior&&x.dot(anterior)<0)x.negate();planos.set(b1,x.clone());
  for(const [b,d]of [[b1,d1],[b2,d2]]){const y=d.clone().negate(),z=new T.Vector3().crossVectors(x,y).normalize();orientar(b,new T.Quaternion().setFromRotationMatrix(base.makeBasis(x,y,z)));}
}
const cuerpo=m.mallas[0],botas=[];for(let i=0;i<cuerpo.geometry.attributes.position.count;i++)if(cuerpo.geometry.attributes.position.getY(i)<.24)botas.push(i);
const clips={};
for(const [nombre,fi,desde,hasta,impacto]of [['parry',0,0,15,null],['tajoA',1,0,24,12],['revesA',1,24,48,39],['estocadaA',1,48,92,66],['giro180',2,0,24,null]]){
  const fuente=entradas[fi],rest=fuente.reposo,filas=[],poses=fuente.poses.slice(desde,hasta+1);planos.clear();
  const escala=(m.p.muslo+m.p.pierna)/(pos(rest,'LeftUpLeg').distanceTo(pos(rest,'LeftLeg'))+pos(rest,'LeftLeg').distanceTo(pos(rest,'LeftFoot')));
  const brazos=(m.p.brazo+m.p.antebrazo)/(pos(rest,'RightArm').distanceTo(pos(rest,'RightForeArm'))+pos(rest,'RightForeArm').distanceTo(pos(rest,'RightHand')));
  const delta=(f,n)=>q(f[n].q).multiply(q(rest[n].q).invert());
  const rumbos=[];let anterior=0;
  for(const f of poses){const frente=new T.Vector3(0,0,1).applyQuaternion(delta(f,'Hips'));let a=Math.atan2(frente.x,frente.z);while(a-anterior>Math.PI)a-=Math.PI*2;while(a-anterior< -Math.PI)a+=Math.PI*2;rumbos.push(a);anterior=a;}
  const total=rumbos.at(-1)-rumbos[0];
  for(const [i,f]of poses.entries()){
    for(const o of originales){o.b.position.copy(o.p);o.b.quaternion.copy(o.q);}
    const giro=nombre==='giro180'?rumbos[i]-rumbos[0]:0,correccion=new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),-giro);
    H.cuerpo.position.set(0,(f.Hips.p[1]-rest.Hips.p[1])*escala,0);H.raiz.updateMatrixWorld(true);
    for(const [h,n]of [['cadera','Hips'],['torso','Spine2'],['cabeza','Head']])orientar(H[h],delta(f,n).premultiply(correccion));
    for(const [l,n]of [['I','Left'],['D','Right']]){cadena(f,n+'UpLeg',n+'Leg',n+'Foot',H['pierna'+l],H['rodilla'+l],correccion);orientar(H['pie'+l],delta(f,n+'Foot').premultiply(correccion));}
    H.raiz.updateMatrixWorld(true);let minimo=Infinity;
    for(const j of botas)minimo=Math.min(minimo,cuerpo.getVertexPosition(j,new T.Vector3()).y);
    H.cuerpo.position.y+=.008-minimo;H.raiz.updateMatrixWorld(true);
    const G=H.brazoD.getWorldPosition(new T.Vector3()).add(pos(f,'RightHand').sub(pos(f,'RightArm')).multiplyScalar(brazos).applyQuaternion(correccion));
    const A=pos(f,'RightHandIndex1').sub(pos(f,'RightHandPinky1')).normalize().applyQuaternion(correccion);
    const arriba=pos(f,'RightHandIndex1').add(pos(f,'RightHandPinky1')).multiplyScalar(.5).sub(pos(f,'RightHand')).normalize().applyQuaternion(correccion);
    const inv=H.torso.matrixWorld.clone().invert();G.applyMatrix4(inv);A.transformDirection(inv);arriba.transformDirection(inv);
    const fila=[...H.cuerpo.position.toArray()];for(const n of huesos)fila.push(...H[n].quaternion.toArray());fila.push(...G.toArray(),...A.toArray(),...arriba.toArray(),nombre==='giro180'?giro/total:0);filas.push(fila);
  }
  for(let i=1;i<filas.length;i++)for(let j=0;j<huesos.length;j++){const o=3+j*4;if(filas[i].slice(o,o+4).reduce((s,x,k)=>s+x*filas[i-1][o+k],0)<0)for(let k=0;k<4;k++)filas[i][o+k]*=-1;}
  clips[nombre]={huesos,ancho:filas[0].length,muestras:filas.length,duracion:(hasta-desde)/30,impacto:impacto===null?null:(impacto-desde)/(hasta-desde),datos:filas.flat().map(x=>+x.toFixed(6))};
}
fs.writeFileSync(new URL('combate.js',import.meta.url),'/* Movimientos Great Sword, aportados por el usuario; generado por preparar-combate.mjs. */\nwindow.CAOZ_ADREIDA_COMBATE='+JSON.stringify(clips)+';\n');
fs.writeFileSync(new URL('combate-procedencia.json',import.meta.url),JSON.stringify({fuentes:entradas.map(f=>({archivo:f.fuente,sha256:f.sha256,duracion:f.duracion,muestras:f.muestras})),segmentos:{tajoA:[0,24,12],revesA:[24,48,39],estocadaA:[48,92,66],parry:[0,15],giro180:[0,24]},adaptacion:'Nueve huesos del cuerpo y referencias del mango tomadas de los nudillos. Traslación horizontal del FBX eliminada; contacto de las botas horneado. El giro del clip se separa del esqueleto para que el control lo aplique una sola vez. Tiempos de impacto originales del juego conservados. No incluye mallas ni texturas de los FBX.'},null,2)+'\n');
console.log(JSON.stringify(Object.fromEntries(Object.entries(clips).map(([k,v])=>[k,{muestras:v.muestras,duracion:v.duracion,impacto:v.impacto}]))));
