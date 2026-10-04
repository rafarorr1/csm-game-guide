/* Adapta los FBX del meteorito, sin incorporar el maniquí ni sus texturas.
   Extraer con extraer-combate.py; uso: node preparar-cinematica.mjs crouching.json falling.json */
import fs from 'node:fs';
import vm from 'node:vm';
const fuentes=process.argv.slice(2).map(p=>JSON.parse(fs.readFileSync(p,'utf8')));
if(fuentes.length!==2)throw Error('Indica Great Sword Crouching y Falling extraídos.');
const c=vm.createContext({console,atob});c.window=c;c.CAOZ_ADREIDA_COMBATE={};
for(const f of ['visor-three-vendor.js','arpg-three-adreida-animacion.js','adreida-scenario/datos.js','arpg-three-adreida.js','arpg-three-modelos.js'])vm.runInContext(fs.readFileSync(new URL('../'+f,import.meta.url),'utf8'),c);
const T=c.CAOZ_THREE.THREE,F=c.CAOZ_ARPG_MODELOS.fabrica(T),m=F.crear('adreida'),H=m.H;
const huesos=['cadera','torso','cabeza',...['I','D'].flatMap(l=>['pierna','rodilla','pie','brazo','ante','mano'].map(n=>n+l)),...Array.from({length:7},(_,i)=>'falda'+i)];
const cuerpoHuesos=['cadera','torso','cabeza','piernaI','rodillaI','pieI','piernaD','rodillaD','pieD'];
const originales=Object.values(H).map(b=>({b,p:b.position.clone(),q:b.quaternion.clone()}));
const v=a=>new T.Vector3().fromArray(a),q=a=>new T.Quaternion().fromArray(a),pos=(f,n)=>v(f[n].p),tmp=new T.Quaternion(),base=new T.Matrix4(),planos=new Map();
const cuerpo=m.mallas[0],botas=[];for(let i=0;i<cuerpo.geometry.attributes.position.count;i++)if(cuerpo.geometry.attributes.position.getY(i)<.24)botas.push(i);
function orientar(b,mundo){b.parent.getWorldQuaternion(tmp).invert();b.quaternion.copy(tmp).multiply(mundo);b.updateMatrixWorld(true);}
function cadena(f,n1,n2,n3,b1,b2,invertir=false){
  const d1=pos(f,n2).sub(pos(f,n1)).normalize(),d2=pos(f,n3).sub(pos(f,n2)).normalize(),x=new T.Vector3().crossVectors(d1,d2);
  if(x.lengthSq()<1e-8)x.copy(planos.get(b1)||new T.Vector3(1,0,0));else x.normalize().multiplyScalar(invertir?-1:1);
  if(planos.has(b1)&&x.dot(planos.get(b1))<0)x.negate();planos.set(b1,x.clone());
  for(const [b,d]of [[b1,d1],[b2,d2]]){const y=d.clone().negate(),z=new T.Vector3().crossVectors(x,y).normalize();orientar(b,new T.Quaternion().setFromRotationMatrix(base.makeBasis(x,y,z)));}
}
const clips={};
for(const [indice,nombre]of ['prepararMeteorito','caerAbismo'].entries()){
  const fuente=fuentes[indice],rest=fuente.reposo,filas=[];planos.clear();
  const escala=(m.p.muslo+m.p.pierna)/(pos(rest,'LeftUpLeg').distanceTo(pos(rest,'LeftLeg'))+pos(rest,'LeftLeg').distanceTo(pos(rest,'LeftFoot')));
  const escalaBrazo=(m.p.brazo+m.p.antebrazo)/(pos(rest,'RightArm').distanceTo(pos(rest,'RightForeArm'))+pos(rest,'RightForeArm').distanceTo(pos(rest,'RightHand')));
  const delta=(f,n)=>q(f[n].q).multiply(q(rest[n].q).invert());
  for(const f of fuente.poses){
    for(const o of originales){o.b.position.copy(o.p);o.b.quaternion.copy(o.q);}
    // La trayectoria en el mundo pertenece al guion. Falling no puede anclarse al piso.
    H.cuerpo.position.set(0,indice===0?(f.Hips.p[1]-rest.Hips.p[1])*escala:0,0);H.raiz.updateMatrixWorld(true);
    for(const [h,n]of [['cadera','Hips'],['torso','Spine2'],['cabeza','Head']])orientar(H[h],delta(f,n));
    for(const [l,n]of [['I','Left'],['D','Right']]){
      cadena(f,n+'UpLeg',n+'Leg',n+'Foot',H['pierna'+l],H['rodilla'+l]);orientar(H['pie'+l],delta(f,n+'Foot'));
      if(indice===1){cadena(f,n+'Arm',n+'ForeArm',n+'Hand',H['brazo'+l],H['ante'+l],l==='I');orientar(H['mano'+l],delta(f,n+'Hand').multiply(q([0,0,Math.sin((l==='I'?1:-1)*Math.PI/4),Math.cos(Math.PI/4)])));}
    }
    if(indice===0){
      H.raiz.updateMatrixWorld(true);let minimo=Infinity;
      for(const i of botas)minimo=Math.min(minimo,cuerpo.getVertexPosition(i,new T.Vector3()).y);
      H.cuerpo.position.y+=.012-minimo;H.raiz.updateMatrixWorld(true);
      const G=H.brazoD.getWorldPosition(new T.Vector3()).add(pos(f,'RightHand').sub(pos(f,'RightArm')).multiplyScalar(escalaBrazo));
      const A=pos(f,'RightHandIndex1').sub(pos(f,'RightHandPinky1')).normalize(),arriba=pos(f,'RightHandIndex1').add(pos(f,'RightHandPinky1')).multiplyScalar(.5).sub(pos(f,'RightHand')).normalize(),inv=H.torso.matrixWorld.clone().invert();
      G.applyMatrix4(inv);A.transformDirection(inv);arriba.transformDirection(inv);
      const datos=[...H.cuerpo.position.toArray(),...cuerpoHuesos.flatMap(n=>H[n].quaternion.toArray()),...G.toArray(),...A.toArray(),...arriba.toArray(),0];
      // Resuelve las dos manos con el mismo agarre del combate y hornea el resultado.
      c.CAOZ_ADREIDA_COMBATE.prepararMeteorito={datos,ancho:datos.length,huesos:cuerpoHuesos,muestras:1,impacto:null};
      F.posar(m,{anim:'prepararMeteorito',k:0,t:0,dt:0,mezclar:false});
    }else F.animacion.resolver(m,{anim:'muerte',t:0,mezclar:false});
    filas.push([...H.cuerpo.position.toArray(),...huesos.flatMap(n=>H[n].quaternion.toArray())]);
  }
  for(let i=1;i<filas.length;i++)for(let j=0;j<huesos.length;j++){const o=3+j*4;if(filas[i].slice(o,o+4).reduce((s,x,k)=>s+x*filas[i-1][o+k],0)<0)for(let k=0;k<4;k++)filas[i][o+k]*=-1;}
  clips[nombre]={huesos,ancho:filas[0].length,muestras:filas.length,duracion:fuente.duracion,datos:filas.flat().map(x=>+x.toFixed(6))};
}
fs.writeFileSync(new URL('cinematica.js',import.meta.url),'/* FBX aportados por el usuario; generado por preparar-cinematica.mjs. */\nwindow.CAOZ_ADREIDA_CINE_CLIPS='+JSON.stringify(clips)+';\n');
fs.writeFileSync(new URL('cinematica-procedencia.json',import.meta.url),JSON.stringify({fuentes:fuentes.map(({fuente,sha256,duracion,muestras})=>({fuente,sha256,duracion,muestras})),adaptacion:'Veintidós huesos, proporciones del modelo actual, agarre del hacha resuelto con IK en Crouching. Falling conserva las poses sin corrección de suelo: la gravedad y el desplazamiento los dirige el epílogo. Sin mallas ni texturas de los FBX.',reproduccion:'Blender --background --factory-startup --python-exit-code 1 --python extraer-combate.py -- entrada.fbx salida.json; node preparar-cinematica.mjs crouching.json falling.json'},null,2)+'\n');
console.log(JSON.stringify(Object.fromEntries(Object.entries(clips).map(([n,v])=>[n,{duracion:v.duracion,muestras:v.muestras}]))));
