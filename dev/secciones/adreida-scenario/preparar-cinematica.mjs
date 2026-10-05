/* Adapta los FBX del meteorito, sin incorporar el maniquí ni sus texturas.
   Extraer con extraer-combate.py; uso: node preparar-cinematica.mjs crouching.json falling.json
   Incrementales: --deslizar slide.json, --salir walking-left-turn.json,
   --correr running.json o --equipar equip-over-shoulder.json. */
import fs from 'node:fs';
import vm from 'node:vm';
const argumentos=process.argv.slice(2),soloDeslizar=argumentos[0]==='--deslizar',soloSalir=argumentos[0]==='--salir',soloCorrer=argumentos[0]==='--correr',soloEquipar=argumentos[0]==='--equipar',brazosFuente=soloSalir||soloCorrer||soloEquipar,incremental=soloDeslizar||brazosFuente;
const fuentes=argumentos.slice(incremental?1:0).map(p=>JSON.parse(fs.readFileSync(p,'utf8')));
if(fuentes.length!==(incremental?1:2))throw Error('Indica Crouching y Falling o un modo incremental --deslizar, --salir, --correr, --equipar seguido del JSON extraído con extraer-combate.py.');
// El modo incremental conserva sin retargetear las tomas ya aprobadas.
const previos=vm.createContext({window:{}});
if(incremental)vm.runInContext(fs.readFileSync(new URL('cinematica.js',import.meta.url),'utf8'),previos);
const procedenciaAnterior=incremental?JSON.parse(fs.readFileSync(new URL('cinematica-procedencia.json',import.meta.url),'utf8')):null;
const c=vm.createContext({console,atob});c.window=c;c.CAOZ_ADREIDA_COMBATE={};
for(const f of ['visor-three-vendor.js','arpg-three-adreida-animacion.js','adreida-scenario/datos.js',...(incremental?['adreida-piernas-scenario/datos.js']:[]),'arpg-three-adreida.js',...(brazosFuente?['hacha-adreida-scenario/datos.js','arpg-three-hacha-adreida.js']:[]),'arpg-three-modelos.js'])vm.runInContext(fs.readFileSync(new URL('../'+f,import.meta.url),'utf8'),c);
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
const clips=incremental?previos.window.CAOZ_ADREIDA_CINE_CLIPS:{};
for(const [indice,nombre]of (brazosFuente?[]:soloDeslizar?['deslizarAtaque']:['prepararMeteorito','caerAbismo']).entries()){
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
if(brazosFuente){
  const fuente=densificar(fuentes[0],4),rest=fuente.reposo,filas=[],raiz=[],giros=[],ejeY=new T.Vector3(0,1,0),frente=new T.Vector3();planos.clear();
  const nombre=soloCorrer?'carreraCine':soloEquipar?'equiparHacha':'salidaConGiro';
  const referenciasSuelo=['LeftFoot','LeftToeBase','LeftToe_End','RightFoot','RightToeBase','RightToe_End'];
  const sueloFuente=soloCorrer?Math.min(...fuente.poses.flatMap(f=>referenciasSuelo.map(n=>f[n].p[1]))):0;
  const escala=(m.p.muslo+m.p.pierna)/(pos(rest,'LeftUpLeg').distanceTo(pos(rest,'LeftLeg'))+pos(rest,'LeftLeg').distanceTo(pos(rest,'LeftFoot')));
  const delta=(f,n)=>q(f[n].q).multiply(q(rest[n].q).invert()),inicio=pos(fuente.poses[0],'Hips');
  let yawInicial=null,yawAnterior=0;
  for(const f of fuente.poses){
    for(const o of originales){o.b.position.copy(o.p);o.b.quaternion.copy(o.q);}
    frente.set(0,0,1).applyQuaternion(delta(f,'Hips'));let yaw=Math.atan2(frente.x,frente.z);
    if(yawInicial===null)yawInicial=yaw;
    while(yaw-yawAnterior>Math.PI)yaw-=Math.PI*2;while(yaw-yawAnterior< -Math.PI)yaw+=Math.PI*2;yawAnterior=yaw;
    // Retarget en el espacio mundial fuente. La raíz temporal absorbe TODO el
    // yaw y se excluye de las poses exportadas: el guion lo aplicará una vez.
    H.raiz.rotation.set(0,yaw,0);H.cuerpo.position.set(0,(f.Hips.p[1]-rest.Hips.p[1])*escala,0);H.raiz.updateMatrixWorld(true);
    for(const [h,n]of [['cadera','Hips'],['torso','Spine2'],['cabeza','Head']])orientar(H[h],delta(f,n));
    for(const [l,n]of [['I','Left'],['D','Right']]){
      cadena(f,n+'UpLeg',n+'Leg',n+'Foot',H['pierna'+l],H['rodilla'+l]);orientar(H['pie'+l],delta(f,n+'Foot'));
      cadena(f,n+'Arm',n+'ForeArm',n+'Hand',H['brazo'+l],H['ante'+l],l==='I');
      orientar(H['mano'+l],delta(f,n+'Hand').multiply(q([0,0,Math.sin((l==='I'?1:-1)*Math.PI/4),Math.cos(Math.PI/4)])));
    }
    // La fuente lleva la mano relajada, cuyo marco de reposo no coincide con
    // el del hacha. Índice/meñique fijan el mango transversal a la palma sin mover
    // la mano, el codo ni el hombro del FBX.
    const eje=pos(f,'RightHandIndex1').sub(pos(f,'RightHandPinky1')).normalize().negate();
    const palma=pos(f,'RightHandIndex1').add(pos(f,'RightHandPinky1')).multiplyScalar(.5).sub(pos(f,'RightHand')).normalize();
    palma.addScaledVector(eje,-palma.dot(eje)).normalize();const normal=new T.Vector3().crossVectors(palma,eje).normalize();
    orientar(H.manoD,new T.Quaternion().setFromRotationMatrix(base.makeBasis(palma,eje,normal)));
    // Sólo se resuelve la tela. No se aplica el IK de combate sobre los brazos:
    // ambos conservan el balanceo y el giro de la animación fuente.
    m.tela=null;F.animacion.resolver(m,{anim:'muerte',t:0,dt:0,mezclar:false});H.raiz.updateMatrixWorld(true);
    let minimo=Infinity;for(const i of botas)minimo=Math.min(minimo,cuerpo.getVertexPosition(i,new T.Vector3()).y);
    // Running conserva su fase aérea, en lugar de pegar una bota al suelo en
    // cada muestra. En salida/equipar el apoyo coincide con la suela aprobada.
    const vuelo=soloCorrer?Math.max(0,Math.min(...referenciasSuelo.map(n=>f[n].p[1]))-sueloFuente)*escala:0;
    H.cuerpo.position.y+=.012+vuelo-minimo;H.raiz.updateMatrixWorld(true);
    filas.push([...H.cuerpo.position.toArray(),...huesos.flatMap(n=>H[n].quaternion.toArray())]);
    const p=pos(f,'Hips').sub(inicio).multiplyScalar(escala).applyAxisAngle(ejeY,-yawInicial);raiz.push(p.x,0,p.z);giros.push(yaw-yawInicial);
  }
  for(let i=1;i<filas.length;i++)for(let j=0;j<huesos.length;j++){const o=3+j*4;if(filas[i].slice(o,o+4).reduce((s,x,k)=>s+x*filas[i-1][o+k],0)<0)for(let k=0;k<4;k++)filas[i][o+k]*=-1;}
  clips[nombre]={huesos,ancho:filas[0].length,muestras:filas.length,duracion:fuente.duracion,fps:120,datos:filas.flat().map(x=>+x.toFixed(6)),raiz:raiz.map(x=>+x.toFixed(6)),giros:giros.map(x=>+x.toFixed(6)),escalaFuente:escala,yawInicialFuente:yawInicial,agarre:soloCorrer?'libre':'derecha'};
  if(soloCorrer)clips[nombre].ciclico=true;
  if(soloEquipar)clips[nombre].transferencia={contacto:.9,extraccion:1,libre:1.5,fpsFuente:30,fotogramaContacto:27,fotogramaExtraccion:30,fotogramaLibre:45};
}
fs.writeFileSync(new URL('cinematica.js',import.meta.url),'/* FBX aportados por el usuario; generado por preparar-cinematica.mjs. */\nwindow.CAOZ_ADREIDA_CINE_CLIPS='+JSON.stringify(clips)+';\n');
const procedencia=incremental?{...procedenciaAnterior}:{fuentes:[],adaptacion:'Veintidós huesos, proporciones del modelo actual, agarre del hacha resuelto con IK en Crouching. Falling conserva las poses sin corrección de suelo: la gravedad y el desplazamiento los dirige el epílogo. Sin mallas ni texturas de los FBX.',reproduccion:'Blender --background --factory-startup --python-exit-code 1 --python extraer-combate.py -- entrada.fbx salida.json; node preparar-cinematica.mjs crouching.json falling.json'};
procedencia.fuentes=[...procedencia.fuentes.filter(p=>!fuentes.some(f=>f.fuente===p.fuente)),...fuentes.map(({fuente,sha256,duracion,muestras})=>({fuente,sha256,duracion,muestras}))];
if(soloDeslizar){
  const fuente=fuentes[0],clip=clips.deslizarAtaque;
  procedencia.deslizarAtaque={
    clip:'deslizarAtaque',modelo:'adreida-piernas-scenario/datos.js',fps:120,muestras:clip.muestras,
    adaptacion:'Pose local de 22 huesos y altura de apoyo sobre las botas del modelo aprobado. Las dos manos sujetan el hacha con el mismo IK del combate; horneado a 120 Hz después de interpolar las referencias fuente para conservar el agarre entre muestras. XZ del cuerpo permanecen a cero; raiz contiene XYZ por muestra, en metros relativos al primer cuadro (Y=0). No incluye mallas, materiales ni texturas del FBX.',
    golpe:clip.golpe,
    hitos:{arranque:[0,.3],cuerpoBajo:[.35,.8],preparacion:[.3,1.1],barrido:[1.17,1.4],recuperacion:[1.4,fuente.duracion]},
    desplazamientoFinal:clip.raiz.slice(-3),
    reproduccion:'Blender --background --factory-startup --python-exit-code 1 --python extraer-combate.py -- "Great Sword Slide Attack.fbx" slide.json; node preparar-cinematica.mjs --deslizar slide.json',
    licencia:'Animación FBX aportada por el usuario; se redistribuyen únicamente poses adaptadas. No se atribuye licencia CC0 al archivo fuente.'
  };
  if(!procedencia.reproduccion.includes(procedencia.deslizarAtaque.reproduccion))procedencia.reproduccion+='; '+procedencia.deslizarAtaque.reproduccion;
}
if(soloSalir){
  const clip=clips.salidaConGiro;
  procedencia.salidaConGiro={clip:'salidaConGiro',modelo:'adreida-piernas-scenario/datos.js',fps:120,muestras:clip.muestras,escalaPiernas:clip.escalaFuente,yawInicialFuente:clip.yawInicialFuente,giroFinal:clip.giros.at(-1),desplazamientoFinal:clip.raiz.slice(-3),
    adaptacion:'Walking Left Turn completo: 22 huesos, incluidos ambos brazos, sin IK que sustituya su actuación. Mano derecha cerrada sobre el hacha aprobada, izquierda libre. Poses locales sin desplazamiento XZ ni yaw global; raiz contiene XYZ relativos al primer cuadro, con Y=0, y giros contiene yaw en radianes relativo al inicio. Ambos se aplican sólo en el guion. Retarget a proporciones y botas aprobadas, interpolación fuente previa al horneado a 120 Hz. Sin maniquí, texturas ni FBX en el runtime.',
    reproduccion:'Blender --background --factory-startup --python-exit-code 1 --python extraer-combate.py -- "Walking Left Turn.fbx" walking-left-turn.json; node preparar-cinematica.mjs --salir walking-left-turn.json',
    licencia:'Animación FBX aportada por el usuario; se redistribuyen únicamente poses adaptadas. No se atribuye licencia CC0 al archivo fuente.'};
  if(!procedencia.reproduccion.includes(procedencia.salidaConGiro.reproduccion))procedencia.reproduccion+='; '+procedencia.salidaConGiro.reproduccion;
}
if(soloCorrer||soloEquipar){
  const nombre=soloCorrer?'carreraCine':'equiparHacha',clip=clips[nombre],fuente=fuentes[0];
  procedencia[nombre]={clip:nombre,modelo:'adreida-piernas-scenario/datos.js',fps:120,muestras:clip.muestras,escalaPiernas:clip.escalaFuente,yawInicialFuente:clip.yawInicialFuente,giroFinal:clip.giros.at(-1),desplazamientoFinal:clip.raiz.slice(-3),
    adaptacion:'Veintidós huesos del rig aprobado, ambos brazos del FBX sin IK de combate. La palma derecha se orienta con las referencias índice/meñique sin mover hombro, codo ni mano. Cuerpo XZ=0; raiz XYZ y giros yaw, relativos al primer cuadro, se entregan separados y sólo se aplican en el guion. Interpolación fuente previa al horneado a 120 Hz. '+(soloCorrer?'Ciclo de Running completo; conserva elevación de las botas durante la fase aérea. El POV puede usar sólo los brazos y suprimir la raíz.':'El gesto de Equip se conserva completo; la transferencia del accesorio espalda→mano corresponde al runtime y sus tiempos se expresan en segundos fuente.'),
    ...(soloEquipar?{transferencia:clip.transferencia}:{}),
    reproduccion:`Blender --background --factory-startup --python-exit-code 1 --python extraer-combate.py -- "${fuente.fuente}" ${soloCorrer?'running':'equip-over-shoulder'}.json; node preparar-cinematica.mjs ${soloCorrer?'--correr running':'--equipar equip-over-shoulder'}.json`,
    licencia:'Animación FBX aportada por el usuario; se redistribuyen únicamente poses adaptadas. No se atribuye licencia CC0 al archivo fuente.'};
  if(!procedencia.reproduccion.includes(procedencia[nombre].reproduccion))procedencia.reproduccion+='; '+procedencia[nombre].reproduccion;
}
fs.writeFileSync(new URL('cinematica-procedencia.json',import.meta.url),JSON.stringify(procedencia,null,2)+'\n');
console.log(JSON.stringify(Object.fromEntries(Object.entries(clips).map(([n,v])=>[n,{duracion:v.duracion,muestras:v.muestras}]))));
