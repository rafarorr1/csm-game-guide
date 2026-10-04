/* Adapta los FBX del meteorito, sin incorporar el maniquí ni sus texturas.
   Extraer con extraer-combate.py; uso: node preparar-cinematica.mjs crouching.json falling.json
   Para añadir o actualizar sólo el ataque: node preparar-cinematica.mjs --deslizar slide.json */
import fs from 'node:fs';
import vm from 'node:vm';
const argumentos=process.argv.slice(2),soloDeslizar=argumentos[0]==='--deslizar';
const fuentes=argumentos.slice(soloDeslizar?1:0).map(p=>JSON.parse(fs.readFileSync(p,'utf8')));
if(fuentes.length!==(soloDeslizar?1:2))throw Error('Indica Crouching y Falling, o --deslizar slide.json, extraídos con extraer-combate.py.');
// El modo incremental conserva sin retargetear las tomas ya aprobadas.
const previos=vm.createContext({window:{}});
if(soloDeslizar)vm.runInContext(fs.readFileSync(new URL('cinematica.js',import.meta.url),'utf8'),previos);
const procedenciaAnterior=soloDeslizar?JSON.parse(fs.readFileSync(new URL('cinematica-procedencia.json',import.meta.url),'utf8')):null;
const c=vm.createContext({console,atob});c.window=c;c.CAOZ_ADREIDA_COMBATE={};
for(const f of ['visor-three-vendor.js','arpg-three-adreida-animacion.js','adreida-scenario/datos.js',...(soloDeslizar?['adreida-piernas-scenario/datos.js']:[]),'arpg-three-adreida.js','arpg-three-modelos.js'])vm.runInContext(fs.readFileSync(new URL('../'+f,import.meta.url),'utf8'),c);
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
// Se interpola la actuación fuente ANTES del IK: interpolar sólo los huesos
// finales a 30 Hz separaba hasta 17 mm las manos durante el barrido rápido.
function densificar(fuente,factor){
  const poses=[];
  for(let i=0;i<=(fuente.poses.length-1)*factor;i++){
    const t=i/factor,a=Math.floor(t),b=Math.min(a+1,fuente.poses.length-1),u=t-a,f={};
    for(const n of Object.keys(fuente.poses[a])){
      f[n]={p:pos(fuente.poses[a],n).lerp(pos(fuente.poses[b],n),u).toArray(),
        q:q(fuente.poses[a][n].q).normalize().slerp(q(fuente.poses[b][n].q).normalize(),u).toArray()};
    }
    poses.push(f);
  }
  return {...fuente,poses,muestras:poses.length};
}
const clips=soloDeslizar?previos.window.CAOZ_ADREIDA_CINE_CLIPS:{};
for(const [indice,nombre]of (soloDeslizar?['deslizarAtaque']:['prepararMeteorito','caerAbismo']).entries()){
  const fuente=soloDeslizar?densificar(fuentes[indice],4):fuentes[indice],rest=fuente.reposo,filas=[];planos.clear();
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
      // En el clip nuevo, cada cuadro de tela se hornea desde su pose; no hereda la apertura máxima anterior.
      if(soloDeslizar)m.tela=null;
      F.posar(m,{anim:'prepararMeteorito',k:0,t:0,dt:0,mezclar:false});
    }else F.animacion.resolver(m,{anim:'muerte',t:0,mezclar:false});
    filas.push([...H.cuerpo.position.toArray(),...huesos.flatMap(n=>H[n].quaternion.toArray())]);
  }
  for(let i=1;i<filas.length;i++)for(let j=0;j<huesos.length;j++){const o=3+j*4;if(filas[i].slice(o,o+4).reduce((s,x,k)=>s+x*filas[i-1][o+k],0)<0)for(let k=0;k<4;k++)filas[i][o+k]*=-1;}
  clips[nombre]={huesos,ancho:filas[0].length,muestras:filas.length,duracion:fuente.duracion,datos:filas.flat().map(x=>+x.toFixed(6))};
  if(soloDeslizar){
    // El guion puede reproducir o escalar el avance sin duplicarlo en la piel.
    // Y queda a cero aquí: el apoyo vertical está horneado en las poses locales.
    const inicio=pos(fuente.poses[0],'Hips');
    clips[nombre].raiz=fuente.poses.flatMap(f=>{const p=pos(f,'Hips').sub(inicio).multiplyScalar(escala);return [p.x,0,p.z].map(x=>+x.toFixed(6));});
    clips[nombre].fps=120;
    clips[nombre].golpe={segundo:1.3,fotogramaFuente:39,fpsFuente:30,fotogramaHorneado:156,criterio:'El eje del mango cruza hacia delante durante el barrido; no es un evento de daño.'};
  }
}
fs.writeFileSync(new URL('cinematica.js',import.meta.url),'/* FBX aportados por el usuario; generado por preparar-cinematica.mjs. */\nwindow.CAOZ_ADREIDA_CINE_CLIPS='+JSON.stringify(clips)+';\n');
const procedencia={fuentes:fuentes.map(({fuente,sha256,duracion,muestras})=>({fuente,sha256,duracion,muestras})),adaptacion:'Veintidós huesos, proporciones del modelo actual, agarre del hacha resuelto con IK en Crouching. Falling conserva las poses sin corrección de suelo: la gravedad y el desplazamiento los dirige el epílogo. Sin mallas ni texturas de los FBX.',reproduccion:'Blender --background --factory-startup --python-exit-code 1 --python extraer-combate.py -- entrada.fbx salida.json; node preparar-cinematica.mjs crouching.json falling.json'};
if(soloDeslizar){
  const fuente=fuentes[0],clip=clips.deslizarAtaque;
  procedencia.fuentes=[...procedenciaAnterior.fuentes.filter(f=>f.fuente!==fuente.fuente),...procedencia.fuentes];
  procedencia.deslizarAtaque={
    clip:'deslizarAtaque',modelo:'adreida-piernas-scenario/datos.js',fps:120,muestras:clip.muestras,
    adaptacion:'Pose local de 22 huesos y altura de apoyo sobre las botas del modelo aprobado. Las dos manos sujetan el hacha con el mismo IK del combate; horneado a 120 Hz después de interpolar las referencias fuente para conservar el agarre entre muestras. XZ del cuerpo permanecen a cero; raiz contiene XYZ por muestra, en metros relativos al primer cuadro (Y=0). No incluye mallas, materiales ni texturas del FBX.',
    golpe:clip.golpe,
    hitos:{arranque:[0,.3],cuerpoBajo:[.35,.8],preparacion:[.3,1.1],barrido:[1.17,1.4],recuperacion:[1.4,fuente.duracion]},
    desplazamientoFinal:clip.raiz.slice(-3),
    reproduccion:'Blender --background --factory-startup --python-exit-code 1 --python extraer-combate.py -- "Great Sword Slide Attack.fbx" slide.json; node preparar-cinematica.mjs --deslizar slide.json',
    licencia:'Animación FBX aportada por el usuario; se redistribuyen únicamente poses adaptadas. No se atribuye licencia CC0 al archivo fuente.'
  };
  procedencia.reproduccion+='; '+procedencia.deslizarAtaque.reproduccion;
}
fs.writeFileSync(new URL('cinematica-procedencia.json',import.meta.url),JSON.stringify(procedencia,null,2)+'\n');
console.log(JSON.stringify(Object.fromEntries(Object.entries(clips).map(([n,v])=>[n,{duracion:v.duracion,muestras:v.muestras}]))));
